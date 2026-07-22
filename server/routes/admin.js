'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../auth');
const { audit, ensureAccount, unitPriceFor } = require('../lib');
const { regenerateSessions, detectConflicts, computeDates, fmtDate } = require('../schedule');

const router = express.Router();
router.use(requireAdmin);

/* ------------------------- 教室 ------------------------- */
router.get('/classrooms', (req, res) => {
  res.json(db.prepare('SELECT * FROM classrooms ORDER BY id').all());
});
router.post('/classrooms', (req, res) => {
  const { name, note } = req.body;
  if (!name) return res.status(400).json({ error: '缺少名称' });
  const info = db.prepare('INSERT INTO classrooms(name, note) VALUES (?,?)').run(name, note || null);
  audit('admin', 'create', 'classroom', info.lastInsertRowid, { name });
  res.json({ id: info.lastInsertRowid });
});
router.delete('/classrooms/:id', (req, res) => {
  db.prepare('DELETE FROM classrooms WHERE id = ?').run(req.params.id);
  audit('admin', 'delete', 'classroom', req.params.id);
  res.json({ ok: true });
});

/* ------------------------- 教师 ------------------------- */
router.get('/teachers', (req, res) => {
  res.json(db.prepare('SELECT * FROM teachers ORDER BY id').all());
});
router.post('/teachers', (req, res) => {
  const { id, name, phone, subjects, hourly_fee } = req.body;
  if (!name) return res.status(400).json({ error: '缺少姓名' });
  if (id) {
    db.prepare('UPDATE teachers SET name=?, phone=?, subjects=?, hourly_fee=? WHERE id=?')
      .run(name, phone || null, subjects || null, hourly_fee || 0, id);
    audit('admin', 'update', 'teacher', id, { name });
    return res.json({ id });
  }
  const info = db.prepare('INSERT INTO teachers(name, phone, subjects, hourly_fee) VALUES (?,?,?,?)')
    .run(name, phone || null, subjects || null, hourly_fee || 0);
  audit('admin', 'create', 'teacher', info.lastInsertRowid, { name });
  res.json({ id: info.lastInsertRowid });
});

/* ------------------------- 学生 ------------------------- */
router.get('/students', (req, res) => {
  const grade = req.query.grade;
  const rows = grade
    ? db.prepare('SELECT * FROM students WHERE grade = ? ORDER BY id').all(grade)
    : db.prepare('SELECT * FROM students ORDER BY grade, id').all();
  res.json(rows);
});
router.post('/students', (req, res) => {
  const { id, name, grade, guardian_phone, enroll_date, note } = req.body;
  if (!name || !grade) return res.status(400).json({ error: '缺少姓名或年级' });
  if (id) {
    db.prepare('UPDATE students SET name=?, grade=?, guardian_phone=?, enroll_date=?, note=? WHERE id=?')
      .run(name, grade, guardian_phone || null, enroll_date || null, note || null, id);
    audit('admin', 'update', 'student', id, { name });
    return res.json({ id });
  }
  const info = db.prepare(
    'INSERT INTO students(name, grade, guardian_phone, enroll_date, note) VALUES (?,?,?,?,?)'
  ).run(name, grade, guardian_phone || null, enroll_date || fmtDate(new Date()), note || null);
  audit('admin', 'create', 'student', info.lastInsertRowid, { name });
  res.json({ id: info.lastInsertRowid });
});

/* ------------------------- 排课 ------------------------- */
router.get('/courses', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, t.name AS teacher_name, cr.name AS classroom_name,
      (SELECT COUNT(*) FROM session_instances si WHERE si.course_id=c.id) AS session_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS enroll_count
    FROM courses c
    LEFT JOIN teachers t ON t.id=c.teacher_id
    LEFT JOIN classrooms cr ON cr.id=c.classroom_id
    ORDER BY c.grade, c.start_time
  `).all();
  res.json(rows);
});

router.get('/courses/:id/sessions', (req, res) => {
  const rows = db.prepare(`
    SELECT si.*,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id=si.id AND ar.status='present') AS present,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id=si.id AND ar.status='leave') AS leave_cnt
    FROM session_instances si WHERE si.course_id = ? ORDER BY si.date
  `).all(req.params.id);
  res.json(rows);
});

/** 冲突预检（不落库），供前端保存前提示 */
router.post('/courses/check-conflict', (req, res) => {
  const conflicts = detectConflicts(req.body, req.body.id || null);
  res.json({ conflicts });
});

/** 新建 / 编辑排课，并自动生成课次实例 */
router.post('/courses', (req, res) => {
  const b = req.body;
  if (!b.grade || !b.subject || !b.mode || !b.start_time || !b.end_time) {
    return res.status(400).json({ error: '缺少必填字段（年级/科目/模式/时间）' });
  }
  if (!b.classroom_id) return res.status(400).json({ error: '请分配教室' });

  const conflicts = detectConflicts(b, b.id || null);
  if (conflicts.length && !b.force) {
    return res.status(409).json({ error: '教室时间冲突', conflicts });
  }

  const restDays = b.rest_days ? JSON.stringify(b.rest_days) : null;
  const weekdays = b.weekdays ? JSON.stringify(b.weekdays) : null;

  let courseId = b.id;
  const tx = db.transaction(() => {
    if (courseId) {
      db.prepare(`UPDATE courses SET grade=?, subject=?, teacher_id=?, classroom_id=?, unit_price=?,
        mode=?, start_time=?, end_time=?, start_date=?, end_date=?, rest_days=?, total_sessions=?,
        weekdays=?, note=? WHERE id=?`).run(
        b.grade, b.subject, b.teacher_id || null, b.classroom_id, b.unit_price || 0,
        b.mode, b.start_time, b.end_time, b.start_date || null, b.end_date || null, restDays,
        b.total_sessions || null, weekdays, b.note || null, courseId);
      audit('admin', 'update', 'course', courseId, { subject: b.subject });
    } else {
      const info = db.prepare(`INSERT INTO courses(grade, subject, teacher_id, classroom_id, unit_price,
        mode, start_time, end_time, start_date, end_date, rest_days, total_sessions, weekdays, note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        b.grade, b.subject, b.teacher_id || null, b.classroom_id, b.unit_price || 0,
        b.mode, b.start_time, b.end_time, b.start_date || null, b.end_date || null, restDays,
        b.total_sessions || null, weekdays, b.note || null);
      courseId = info.lastInsertRowid;
      audit('admin', 'create', 'course', courseId, { subject: b.subject });
    }
    regenerateSessions(courseId);
  });
  tx();
  const count = db.prepare('SELECT COUNT(*) c FROM session_instances WHERE course_id=?').get(courseId).c;
  res.json({ id: courseId, sessions_generated: count });
});

router.delete('/courses/:id', (req, res) => {
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  audit('admin', 'delete', 'course', req.params.id);
  res.json({ ok: true });
});

/** 停课/恢复某个课次实例 */
router.post('/sessions/:id/cancel', (req, res) => {
  const status = req.body.cancel ? 'canceled' : 'scheduled';
  db.prepare('UPDATE session_instances SET status=? WHERE id=?').run(status, req.params.id);
  audit('admin', 'session_status', 'session', req.params.id, { status });
  res.json({ ok: true });
});

/* ------------------------- 报名 ------------------------- */
router.get('/courses/:id/enrollments', (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, s.name, s.guardian_phone, sa.balance, sa.total_recharge, sa.total_consumed
    FROM enrollments e JOIN students s ON s.id=e.student_id
    LEFT JOIN student_accounts sa ON sa.student_id=e.student_id AND sa.course_id=e.course_id
    WHERE e.course_id = ? ORDER BY s.name
  `).all(req.params.id);
  res.json(rows);
});
router.post('/enrollments', (req, res) => {
  const { student_id, course_id, unit_price, billing_type } = req.body;
  if (!student_id || !course_id) return res.status(400).json({ error: '缺少学生或课程' });
  try {
    db.prepare(`INSERT INTO enrollments(student_id, course_id, unit_price, billing_type, status)
                VALUES (?,?,?,?, 'active')`)
      .run(student_id, course_id, unit_price ?? null, billing_type || 'balance');
  } catch (e) {
    return res.status(400).json({ error: '该生已报名此课程' });
  }
  ensureAccount(student_id, course_id);
  audit('admin', 'enroll', 'enrollment', `${student_id}-${course_id}`, {});
  res.json({ ok: true });
});
router.delete('/enrollments/:id', (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/* ------------------------- 签到管理（管理员代录/改） ------------------------- */
router.get('/sessions/:id/roster', (req, res) => {
  const session = db.prepare(`
    SELECT si.*, c.subject, c.grade, c.course_id FROM session_instances si
    JOIN courses c ON c.id=si.course_id WHERE si.id=?`).get(req.params.id);
  const roster = db.prepare(`
    SELECT s.id AS student_id, s.name, ar.status, ar.signed_at, ar.charged
    FROM enrollments e JOIN students s ON s.id=e.student_id
    LEFT JOIN attendance_records ar ON ar.student_id=s.id AND ar.session_id=?
    WHERE e.course_id = (SELECT course_id FROM session_instances WHERE id=?)
    ORDER BY s.name
  `).all(req.params.id, req.params.id);
  res.json({ session, roster });
});

/** 管理员手动设置某生某课次状态（present 会扣费，其它不扣）*/
router.post('/attendance', (req, res) => {
  const { student_id, session_id, status } = req.body;
  const session = db.prepare('SELECT * FROM session_instances WHERE id=?').get(session_id);
  if (!session) return res.status(400).json({ error: '课次不存在' });
  const tx = db.transaction(() => {
    const existed = db.prepare('SELECT * FROM attendance_records WHERE student_id=? AND session_id=?')
      .get(student_id, session_id);
    // 撤销旧的扣费
    if (existed && existed.charged) {
      const acc = ensureAccount(student_id, session.course_id);
      db.prepare('UPDATE student_accounts SET balance=balance+?, total_consumed=total_consumed-? WHERE id=?')
        .run(existed.charged, existed.charged, acc.id);
    }
    let charge = 0;
    if (status === 'present') charge = unitPriceFor(student_id, session.course_id);
    if (status === 'absent') {
      const ac = db.prepare("SELECT value FROM settings WHERE key='absent_charge'").get().value;
      if (ac === '1') charge = unitPriceFor(student_id, session.course_id);
    }
    if (charge) {
      const acc = ensureAccount(student_id, session.course_id);
      db.prepare('UPDATE student_accounts SET balance=balance-?, total_consumed=total_consumed+? WHERE id=?')
        .run(charge, charge, acc.id);
    }
    if (existed) {
      db.prepare('UPDATE attendance_records SET status=?, charged=?, operator=?, signature=CASE WHEN ?=\'present\' THEN signature ELSE NULL END WHERE id=?')
        .run(status, charge, 'admin', status, existed.id);
    } else {
      db.prepare('INSERT INTO attendance_records(student_id, session_id, status, charged, operator, signed_at) VALUES (?,?,?,?,?,datetime(\'now\',\'localtime\'))')
        .run(student_id, session_id, status, charge, 'admin');
    }
    audit('admin', 'set_attendance', 'session', session_id, { student_id, status, charge });
  });
  tx();
  res.json({ ok: true });
});

/* ------------------------- 财务：充值 / 退款 ------------------------- */
router.post('/finance/transaction', (req, res) => {
  const { student_id, course_id, amount, type, method, operator, note, package_sessions } = req.body;
  if (!student_id || !amount || !type) return res.status(400).json({ error: '缺少必填字段' });
  const amt = Number(amount);
  if (amt <= 0) return res.status(400).json({ error: '金额需为正' });

  const tx = db.transaction(() => {
    const cid = course_id || null;
    db.prepare(`INSERT INTO transactions(student_id, course_id, amount, type, method, operator, note)
                VALUES (?,?,?,?,?,?,?)`)
      .run(student_id, cid, amt, type, method || null, operator || 'admin', note || null);

    const acc = ensureAccount(student_id, cid);
    if (type === 'recharge') {
      db.prepare('UPDATE student_accounts SET total_recharge=total_recharge+?, balance=balance+? WHERE id=?')
        .run(amt, amt, acc.id);
      // 打包报名：按总课时折算单价并写入报名单价
      if (method === 'package' && cid && package_sessions) {
        const per = amt / Number(package_sessions);
        db.prepare('UPDATE enrollments SET unit_price=?, billing_type=\'package\' WHERE student_id=? AND course_id=?')
          .run(per, student_id, cid);
      }
    } else { // refund
      db.prepare('UPDATE student_accounts SET balance=balance-? WHERE id=?').run(amt, acc.id);
    }
    audit('admin', type, 'transaction', student_id, { amount: amt, course_id: cid, method });
  });
  tx();
  res.json({ ok: true });
});

router.get('/finance/transactions', (req, res) => {
  const { from, to, student_id } = req.query;
  let sql = `SELECT tr.*, s.name AS student_name, c.subject FROM transactions tr
             JOIN students s ON s.id=tr.student_id
             LEFT JOIN courses c ON c.id=tr.course_id WHERE 1=1`;
  const params = [];
  if (from) { sql += ' AND date(tr.created_at) >= ?'; params.push(from); }
  if (to) { sql += ' AND date(tr.created_at) <= ?'; params.push(to); }
  if (student_id) { sql += ' AND tr.student_id = ?'; params.push(student_id); }
  sql += ' ORDER BY tr.created_at DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

/** 多退少补：某生每门课 应收/已收/差额 */
router.get('/finance/reconcile/:studentId', (req, res) => {
  const sid = req.params.studentId;
  const courses = db.prepare(`
    SELECT c.id AS course_id, c.subject, COALESCE(e.unit_price, c.unit_price) AS price,
      (SELECT COUNT(*) FROM attendance_records ar JOIN session_instances si ON si.id=ar.session_id
        WHERE ar.student_id=? AND si.course_id=c.id AND ar.status='present') AS present_count,
      (SELECT COALESCE(SUM(CASE WHEN type='recharge' THEN amount ELSE -amount END),0)
        FROM transactions WHERE student_id=? AND (course_id=c.id)) AS received,
      sa.balance
    FROM enrollments e JOIN courses c ON c.id=e.course_id
    LEFT JOIN student_accounts sa ON sa.student_id=e.student_id AND sa.course_id=c.id
    WHERE e.student_id=?
  `).all(sid, sid, sid);
  const rows = courses.map((c) => {
    const due = c.present_count * c.price;      // 应收
    const diff = c.received - due;              // 差额
    return { ...c, due, diff,
      status: diff >= 0 ? `余额充足，可上 ${c.price ? Math.floor(diff / c.price) : 0} 节课`
                        : `需补交 ¥${Math.abs(diff).toFixed(2)}` };
  });
  const totalRecv = db.prepare("SELECT COALESCE(SUM(CASE WHEN type='recharge' THEN amount ELSE -amount END),0) v FROM transactions WHERE student_id=?").get(sid).v;
  const totalDue = rows.reduce((s, r) => s + r.due, 0);
  res.json({ courses: rows, summary: { totalRecv, totalDue, diff: totalRecv - totalDue } });
});

/* ------------------------- 教师课时费结算 ------------------------- */
router.get('/finance/teacher-fees', (req, res) => {
  const period = req.query.period || fmtDate(new Date()).slice(0, 7); // YYYY-MM
  const teachers = db.prepare('SELECT * FROM teachers ORDER BY id').all();
  const rows = teachers.map((t) => {
    // 实际（有正常签到发生即视为已上课）上课次数：该老师课程在本月、且有至少1人正常签到的课次
    const sessions = db.prepare(`
      SELECT COUNT(DISTINCT si.id) c FROM session_instances si
      JOIN courses co ON co.id=si.course_id
      WHERE co.teacher_id=? AND strftime('%Y-%m', si.date)=?
        AND EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.session_id=si.id AND ar.status='present')
    `).get(t.id, period).c;
    const settlement = db.prepare('SELECT * FROM teacher_settlements WHERE teacher_id=? AND period=?').get(t.id, period);
    return { teacher_id: t.id, name: t.name, hourly_fee: t.hourly_fee,
      sessions, amount: sessions * t.hourly_fee,
      paid: settlement ? settlement.paid : 0 };
  });
  res.json({ period, rows });
});

router.post('/finance/teacher-fees/pay', (req, res) => {
  const { teacher_id, period, sessions, amount } = req.body;
  const existed = db.prepare('SELECT * FROM teacher_settlements WHERE teacher_id=? AND period=?').get(teacher_id, period);
  if (existed) {
    db.prepare("UPDATE teacher_settlements SET sessions=?, amount=?, paid=1, paid_at=datetime('now','localtime') WHERE id=?")
      .run(sessions, amount, existed.id);
  } else {
    db.prepare("INSERT INTO teacher_settlements(teacher_id, period, sessions, amount, paid, paid_at) VALUES (?,?,?,?,1,datetime('now','localtime'))")
      .run(teacher_id, period, sessions, amount);
  }
  audit('admin', 'pay_teacher', 'teacher', teacher_id, { period, amount });
  res.json({ ok: true });
});

/* ------------------------- 成本 / 分红 ------------------------- */
router.get('/finance/costs', (req, res) => res.json(db.prepare('SELECT * FROM costs ORDER BY incurred_at DESC').all()));
router.post('/finance/costs', (req, res) => {
  const { name, amount, note } = req.body;
  const info = db.prepare('INSERT INTO costs(name, amount, note) VALUES (?,?,?)').run(name, Number(amount), note || null);
  audit('admin', 'add_cost', 'cost', info.lastInsertRowid, { name, amount });
  res.json({ id: info.lastInsertRowid });
});

router.get('/partners', (req, res) => res.json(db.prepare('SELECT * FROM partners ORDER BY id').all()));
router.post('/partners', (req, res) => {
  const { id, name, ratio } = req.body;
  if (id) db.prepare('UPDATE partners SET name=?, ratio=? WHERE id=?').run(name, ratio, id);
  else db.prepare('INSERT INTO partners(name, ratio) VALUES (?,?)').run(name, ratio || 0);
  res.json({ ok: true });
});
router.delete('/partners/:id', (req, res) => {
  db.prepare('DELETE FROM partners WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

/** 机构总账 / 分红：按时间段 */
router.get('/finance/summary', (req, res) => {
  const from = req.query.from || fmtDate(new Date()).slice(0, 7) + '-01';
  const to = req.query.to || fmtDate(new Date());
  const income = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='recharge' THEN amount ELSE -amount END),0) v
    FROM transactions WHERE date(created_at) BETWEEN ? AND ?`).get(from, to).v;

  // 教师课时费（按区间内有正常签到的课次）
  const teacherFee = db.prepare(`
    SELECT COALESCE(SUM(cnt * t.hourly_fee),0) v FROM (
      SELECT co.teacher_id, COUNT(DISTINCT si.id) cnt FROM session_instances si
      JOIN courses co ON co.id=si.course_id
      WHERE si.date BETWEEN ? AND ?
        AND EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.session_id=si.id AND ar.status='present')
      GROUP BY co.teacher_id
    ) x JOIN teachers t ON t.id=x.teacher_id
  `).get(from, to).v;

  const otherCost = db.prepare('SELECT COALESCE(SUM(amount),0) v FROM costs WHERE date(incurred_at) BETWEEN ? AND ?').get(from, to).v;
  const totalCost = teacherFee + otherCost;
  const dividable = income - totalCost;
  const partners = db.prepare('SELECT * FROM partners ORDER BY id').all()
    .map((p) => ({ ...p, share: dividable * p.ratio }));

  res.json({ from, to, income, teacherFee, otherCost, totalCost, dividable, partners });
});

/* ------------------------- 看板 ------------------------- */
router.get('/dashboard', (req, res) => {
  const today = fmtDate(new Date());
  const month = today.slice(0, 7);
  const todaySessions = db.prepare("SELECT COUNT(*) c FROM session_instances WHERE date=? AND status='scheduled'").get(today).c;
  const todayExpected = db.prepare(`
    SELECT COUNT(*) c FROM session_instances si JOIN enrollments e ON e.course_id=si.course_id
    WHERE si.date=? AND si.status='scheduled'`).get(today).c;
  const todayPresent = db.prepare(`
    SELECT COUNT(*) c FROM attendance_records ar JOIN session_instances si ON si.id=ar.session_id
    WHERE si.date=? AND ar.status='present'`).get(today).c;
  const checkinRate = todayExpected ? Math.round((todayPresent / todayExpected) * 100) : 0;

  // 待补费学生数（任一课程账户余额低于 预警阈值*该课单价）
  const owing = db.prepare(`
    SELECT COUNT(DISTINCT sa.student_id) c FROM student_accounts sa
    JOIN courses co ON co.id=sa.course_id
    WHERE sa.balance < sa.warn_threshold * COALESCE((SELECT unit_price FROM enrollments e WHERE e.student_id=sa.student_id AND e.course_id=sa.course_id), co.unit_price)
  `).get().c;

  const monthIncome = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='recharge' THEN amount ELSE -amount END),0) v
    FROM transactions WHERE strftime('%Y-%m', created_at)=?`).get(month).v;

  const monthTeacherFee = db.prepare(`
    SELECT COALESCE(SUM(cnt * t.hourly_fee),0) v FROM (
      SELECT co.teacher_id, COUNT(DISTINCT si.id) cnt FROM session_instances si
      JOIN courses co ON co.id=si.course_id
      WHERE strftime('%Y-%m', si.date)=?
        AND EXISTS (SELECT 1 FROM attendance_records ar WHERE ar.session_id=si.id AND ar.status='present')
      GROUP BY co.teacher_id
    ) x JOIN teachers t ON t.id=x.teacher_id`).get(month).v;

  res.json({ today, todaySessions, checkinRate, todayPresent, todayExpected, owing, monthIncome, monthTeacherFee,
    students: db.prepare('SELECT COUNT(*) c FROM students').get().c,
    courses: db.prepare('SELECT COUNT(*) c FROM courses').get().c });
});

/* ------------------------- 操作日志 / 设置 ------------------------- */
router.get('/logs', (req, res) => {
  res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 300').all());
});

router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const obj = {};
  rows.forEach((r) => { if (r.key !== 'admin_password') obj[r.key] = r.value; });
  res.json(obj);
});
router.post('/settings', (req, res) => {
  const up = db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(req.body)) {
    if (k === 'admin_password' && !v) continue;
    up.run(k, String(v));
  }
  audit('admin', 'update_settings', 'settings', '', {});
  res.json({ ok: true });
});

module.exports = router;
