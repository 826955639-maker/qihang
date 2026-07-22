'use strict';

const { db } = require('./db');

/** 'YYYY-MM-DD' -> Date (本地零点) */
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** Date -> 'YYYY-MM-DD' */
function fmtDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
/** ISO 星期：1=周一 .. 7=周日 */
function isoWeekday(dt) {
  const wd = dt.getDay(); // 0=周日
  return wd === 0 ? 7 : wd;
}

/**
 * 根据排课配置计算出应生成的所有课次日期列表。
 * @returns {string[]} 日期数组
 */
function computeDates(course) {
  const dates = [];
  if (course.mode === 'camp') {
    if (!course.start_date || !course.end_date) return dates;
    const rest = new Set(safeJSON(course.rest_days, []));
    const start = parseDate(course.start_date);
    const end = parseDate(course.end_date);
    const limit = course.total_sessions || Infinity;
    for (let dt = new Date(start); dt <= end && dates.length < limit; dt.setDate(dt.getDate() + 1)) {
      const ds = fmtDate(dt);
      if (rest.has(ds)) continue;
      dates.push(ds);
    }
  } else if (course.mode === 'weekly') {
    if (!course.start_date || !course.end_date) return dates;
    const weekdays = new Set(safeJSON(course.weekdays, []));
    const start = parseDate(course.start_date);
    const end = parseDate(course.end_date);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      if (weekdays.has(isoWeekday(dt))) dates.push(fmtDate(dt));
    }
  }
  return dates;
}

function safeJSON(str, dflt) {
  if (!str) return dflt;
  try { return JSON.parse(str); } catch { return dflt; }
}

/**
 * 生成 / 重新生成某排课的课次实例。
 * 保留已有签到记录对应的实例（不删已签到的课次），新增缺失的，删除多余的未签到实例。
 */
const regenerateSessions = db.transaction((courseId) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) throw new Error('course not found');

  const wanted = computeDates(course); // 有序
  const wantedSet = new Set(wanted);

  const existing = db.prepare('SELECT * FROM session_instances WHERE course_id = ?').all(courseId);
  const existingByDate = new Map(existing.map((s) => [s.date, s]));

  // 删除多余且无签到记录的实例
  const hasAttendance = db.prepare(
    'SELECT COUNT(*) c FROM attendance_records WHERE session_id = ?'
  );
  const delStmt = db.prepare('DELETE FROM session_instances WHERE id = ?');
  for (const s of existing) {
    if (!wantedSet.has(s.date)) {
      if (hasAttendance.get(s.id).c === 0) delStmt.run(s.id);
    }
  }

  // 新增缺失实例 + 更新时间/序号
  const insStmt = db.prepare(`
    INSERT INTO session_instances(course_id, date, start_time, end_time, seq, status)
    VALUES (?, ?, ?, ?, ?, 'scheduled')
  `);
  const updStmt = db.prepare(
    'UPDATE session_instances SET start_time=?, end_time=?, seq=? WHERE id=?'
  );
  wanted.forEach((ds, idx) => {
    const seq = idx + 1;
    const ex = existingByDate.get(ds);
    if (ex) {
      updStmt.run(course.start_time, course.end_time, seq, ex.id);
    } else {
      insStmt.run(courseId, ds, course.start_time, course.end_time, seq);
    }
  });

  return db.prepare('SELECT COUNT(*) c FROM session_instances WHERE course_id = ?').get(courseId).c;
});

/**
 * 教室时间冲突检测：同一教室、同一天、时间段重叠即冲突。
 * @returns {Array} 冲突的课次列表（含课程信息）
 */
function detectConflicts(course, excludeCourseId = null) {
  const dates = computeDates(course);
  if (dates.length === 0 || !course.classroom_id) return [];
  const conflicts = [];
  const q = db.prepare(`
    SELECT si.date, si.start_time, si.end_time, c.subject, c.grade, c.id AS course_id
    FROM session_instances si
    JOIN courses c ON c.id = si.course_id
    WHERE c.classroom_id = ? AND si.date = ? AND si.status = 'scheduled'
      AND (? IS NULL OR c.id != ?)
  `);
  for (const ds of dates) {
    const sameDay = q.all(course.classroom_id, ds, excludeCourseId, excludeCourseId);
    for (const s of sameDay) {
      if (overlaps(course.start_time, course.end_time, s.start_time, s.end_time)) {
        conflicts.push({ date: ds, ...s });
      }
    }
  }
  return conflicts;
}

function overlaps(s1, e1, s2, e2) {
  return s1 < e2 && s2 < e1;
}

module.exports = { computeDates, regenerateSessions, detectConflicts, fmtDate, isoWeekday };
