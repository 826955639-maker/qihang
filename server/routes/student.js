'use strict';

const express = require('express');
const { db } = require('../db');
const { requireStudent, ownsStudent } = require('../auth');
const { audit, ensureAccount, unitPriceFor } = require('../lib');
const { fmtDate } = require('../schedule');

const router = express.Router();
router.use(requireStudent);

// 中间件：校验 studentId 归属当前登录手机号
function checkOwn(req, res, next) {
  const studentId = Number(req.query.studentId || req.body.studentId);
  if (!studentId || !ownsStudent(req.session.phone, studentId)) {
    return res.status(403).json({ error: '无权访问该学生数据' });
  }
  req.studentId = studentId;
  next();
}

/** 课表：按学生年级展示课次，支持 today / week / date 视图 */
router.get('/timetable', checkOwn, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.studentId);
  const view = req.query.view || 'today';
  const baseDate = req.query.date || fmtDate(new Date());
  let from = baseDate, to = baseDate;
  if (view === 'week') {
    const d = new Date(baseDate);
    const wd = d.getDay() === 0 ? 7 : d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (wd - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    from = fmtDate(mon); to = fmtDate(sun);
  }
  const rows = db.prepare(`
    SELECT si.id AS session_id, si.date, si.start_time, si.end_time, si.seq, si.status,
           c.id AS course_id, c.subject, c.grade,
           t.name AS teacher, cr.name AS classroom,
           (SELECT status FROM attendance_records WHERE student_id=? AND session_id=si.id) AS my_status,
           (SELECT 1 FROM enrollments WHERE student_id=? AND course_id=c.id) AS enrolled
    FROM session_instances si
    JOIN courses c ON c.id = si.course_id
    LEFT JOIN teachers t ON t.id = c.teacher_id
    LEFT JOIN classrooms cr ON cr.id = c.classroom_id
    WHERE c.grade = ? AND si.date BETWEEN ? AND ?
    ORDER BY si.date, si.start_time
  `).all(req.studentId, req.studentId, student.grade, from, to);
  res.json({ student, view, from, to, sessions: rows });
});

/** 今日待签到：学生已报名、今天、尚未签到/请假的课次 */
router.get('/today', checkOwn, (req, res) => {
  const today = fmtDate(new Date());
  const rows = db.prepare(`
    SELECT si.id AS session_id, si.date, si.start_time, si.end_time,
           c.id AS course_id, c.subject, t.name AS teacher, cr.name AS classroom,
           ar.status AS my_status, ar.signed_at,
           COALESCE(e.unit_price, c.unit_price) AS price,
           sa.balance
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN session_instances si ON si.course_id = c.id AND si.date = ?
    LEFT JOIN teachers t ON t.id = c.teacher_id
    LEFT JOIN classrooms cr ON cr.id = c.classroom_id
    LEFT JOIN attendance_records ar ON ar.student_id = e.student_id AND ar.session_id = si.id
    LEFT JOIN student_accounts sa ON sa.student_id = e.student_id AND sa.course_id = c.id
    WHERE e.student_id = ? AND e.status = 'active'
    ORDER BY si.start_time
  `).all(today, req.studentId);
  res.json({ date: today, sessions: rows });
});

/** 签到（正常签到）：事务保证「记签到 + 扣费」一致 */
router.post('/checkin', checkOwn, (req, res) => {
  const { sessionId, signature } = req.body;
  if (!sessionId) return res.status(400).json({ error: '缺少课次' });
  if (!signature || !signature.startsWith('data:image')) {
    return res.status(400).json({ error: '请先手写签名' });
  }
  try {
    const result = doCheckin(req.studentId, Number(sessionId), signature, 'student');
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const doCheckin = db.transaction((studentId, sessionId, signature, operator) => {
  const session = db.prepare('SELECT * FROM session_instances WHERE id = ?').get(sessionId);
  if (!session) throw new Error('课次不存在');
  if (session.status === 'canceled') throw new Error('该次课已停课');

  const enr = db.prepare(
    "SELECT * FROM enrollments WHERE student_id=? AND course_id=? AND status='active'"
  ).get(studentId, session.course_id);
  if (!enr) throw new Error('未报名该课程或已停课');

  const existed = db.prepare(
    'SELECT * FROM attendance_records WHERE student_id=? AND session_id=?'
  ).get(studentId, sessionId);
  if (existed && existed.status === 'present') throw new Error('已签到，请勿重复');
  if (existed && existed.status === 'leave') throw new Error('已请假，不能再签到');

  const charge = unitPriceFor(studentId, session.course_id);
  const acc = ensureAccount(studentId, session.course_id);

  // 扣费：余额扣减，消耗累加（允许扣成负数=欠费，界面会提示补交）
  db.prepare(
    'UPDATE student_accounts SET balance = balance - ?, total_consumed = total_consumed + ? WHERE id = ?'
  ).run(charge, charge, acc.id);

  if (existed) {
    db.prepare(`UPDATE attendance_records SET status='present', signed_at=datetime('now','localtime'),
                signature=?, charged=?, operator=? WHERE id=?`)
      .run(signature, charge, operator, existed.id);
  } else {
    db.prepare(`INSERT INTO attendance_records(student_id, session_id, status, signed_at, signature, charged, operator)
                VALUES (?,?, 'present', datetime('now','localtime'), ?, ?, ?)`)
      .run(studentId, sessionId, signature, charge, operator);
  }
  audit(operator === 'admin' ? 'admin' : 'student:' + studentId, 'checkin', 'session', sessionId,
        { studentId, charge });

  const newBal = db.prepare('SELECT balance FROM student_accounts WHERE id=?').get(acc.id).balance;
  return { ok: true, charged: charge, balance: newBal };
});

/** 请假：需在课程开始前 N 小时；不扣费、不签名 */
router.post('/leave', checkOwn, (req, res) => {
  const { sessionId } = req.body;
  const session = db.prepare('SELECT * FROM session_instances WHERE id = ?').get(Number(sessionId));
  if (!session) return res.status(400).json({ error: '课次不存在' });
  const enr = db.prepare("SELECT * FROM enrollments WHERE student_id=? AND course_id=?")
    .get(req.studentId, session.course_id);
  if (!enr) return res.status(403).json({ error: '未报名该课程' });

  const existed = db.prepare('SELECT * FROM attendance_records WHERE student_id=? AND session_id=?')
    .get(req.studentId, session.id);
  if (existed && existed.status === 'present') return res.status(400).json({ error: '已签到，不能请假' });

  const leadHours = Number(db.prepare("SELECT value FROM settings WHERE key='leave_lead_hours'").get().value);
  const start = new Date(`${session.date}T${session.start_time}:00`);
  if (Date.now() + leadHours * 3600 * 1000 > start.getTime()) {
    return res.status(400).json({ error: `请假需在开课前 ${leadHours} 小时提交` });
  }

  if (existed) {
    db.prepare("UPDATE attendance_records SET status='leave', operator='student', charged=0, signature=NULL WHERE id=?")
      .run(existed.id);
  } else {
    db.prepare("INSERT INTO attendance_records(student_id, session_id, status, operator) VALUES (?,?, 'leave', 'student')")
      .run(req.studentId, session.id);
  }
  audit('student:' + req.studentId, 'leave', 'session', session.id, {});
  res.json({ ok: true });
});

/** 个人账单：每门课的上课/请假次数、充值/消耗/余额 + 历史签到 */
router.get('/bill', checkOwn, (req, res) => {
  const courses = db.prepare(`
    SELECT c.id AS course_id, c.subject, COALESCE(e.unit_price, c.unit_price) AS price,
           sa.total_recharge, sa.total_consumed, sa.balance, sa.warn_threshold,
           (SELECT COUNT(*) FROM attendance_records ar JOIN session_instances si ON si.id=ar.session_id
              WHERE ar.student_id=e.student_id AND si.course_id=c.id AND ar.status='present') AS present_count,
           (SELECT COUNT(*) FROM attendance_records ar JOIN session_instances si ON si.id=ar.session_id
              WHERE ar.student_id=e.student_id AND si.course_id=c.id AND ar.status='leave') AS leave_count
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    LEFT JOIN student_accounts sa ON sa.student_id=e.student_id AND sa.course_id=c.id
    WHERE e.student_id = ?
    ORDER BY c.subject
  `).all(req.studentId);

  const history = db.prepare(`
    SELECT ar.id, ar.status, ar.signed_at, ar.signature, ar.charged,
           si.date, si.start_time, c.subject
    FROM attendance_records ar
    JOIN session_instances si ON si.id = ar.session_id
    JOIN courses c ON c.id = si.course_id
    WHERE ar.student_id = ?
    ORDER BY si.date DESC, si.start_time DESC
    LIMIT 200
  `).all(req.studentId);

  res.json({ courses, history });
});

module.exports = router;
