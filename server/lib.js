'use strict';

const { db } = require('./db');

/** 记录操作日志 */
function audit(actor, action, entity, entityId, detail) {
  db.prepare(
    'INSERT INTO audit_logs(actor, action, entity, entity_id, detail) VALUES (?,?,?,?,?)'
  ).run(actor, action, entity, String(entityId ?? ''), detail ? JSON.stringify(detail) : null);
}

/** 确保存在 student+course 账户，返回该账户 */
function ensureAccount(studentId, courseId) {
  let acc = db
    .prepare('SELECT * FROM student_accounts WHERE student_id = ? AND course_id IS ?')
    .get(studentId, courseId);
  if (!acc) {
    db.prepare(
      'INSERT INTO student_accounts(student_id, course_id, total_recharge, total_consumed, balance) VALUES (?,?,0,0,0)'
    ).run(studentId, courseId);
    acc = db
      .prepare('SELECT * FROM student_accounts WHERE student_id = ? AND course_id IS ?')
      .get(studentId, courseId);
  }
  return acc;
}

/** 取某生某课的实际单价：优先报名表覆盖价，其次课程默认价 */
function unitPriceFor(studentId, courseId) {
  const enr = db
    .prepare('SELECT unit_price FROM enrollments WHERE student_id = ? AND course_id = ?')
    .get(studentId, courseId);
  if (enr && enr.unit_price != null) return enr.unit_price;
  const c = db.prepare('SELECT unit_price FROM courses WHERE id = ?').get(courseId);
  return c ? c.unit_price : 0;
}

module.exports = { audit, ensureAccount, unitPriceFor };
