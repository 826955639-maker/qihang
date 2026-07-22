'use strict';

/**
 * 种子数据：按暑期海报录入，供开发/演示测试。
 * 用法：
 *   node server/seed.js          # 仅在库为空时写入
 *   node server/seed.js --reset  # 清空数据库后重新写入
 *
 * 说明：海报为招生物料，不含内部定价，故单价/课时费为演示占位值，
 *       管理员可在后台随时修改（unit_price / hourly_fee）。
 */

const fs = require('fs');
const path = require('path');

const reset = process.argv.includes('--reset');
if (reset) {
  const p = path.join(__dirname, '..', 'data', 'qihang.db');
  for (const f of [p, p + '-wal', p + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f);
}

const { db, init } = require('./db');
const { regenerateSessions } = require('./schedule');
const { ensureAccount } = require('./lib');
init();

if (db.prepare('SELECT COUNT(*) c FROM teachers').get().c > 0 && !reset) {
  console.log('数据库已有数据，跳过（如需重置：node server/seed.js --reset）');
  process.exit(0);
}

const YEAR = 2026;
const D = (m, d) => `${YEAR}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// 演示占位价格
const PRICE = 100;      // 每节课学生单价（元）
const HOURLY = 300;     // 教师单节课时费（元）

console.log('写入种子数据…');

/* 教室（4 间，可后台增删） */
const classroomIds = ['A 教室', 'B 教室', 'C 教室', 'D 教室'].map(
  (n) => db.prepare('INSERT INTO classrooms(name) VALUES (?)').run(n).lastInsertRowid
);

/* 教师（课时费为占位值，可后台修改） */
function T(name, subjects) {
  return db.prepare('INSERT INTO teachers(name, subjects, hourly_fee) VALUES (?,?,?)')
    .run(name, subjects, HOURLY).lastInsertRowid;
}
const tZ = T('中考命题专家 Z 老师', '数学,语文');
const tExpert = T('中考命题专家', '政治');
const tSD = T('SD 附中名师', '历史');
const tZhang = T('SD 附中张老师', '物理');
const tHuaxue = T('中考命题专家/汾 D 名师', '化学');
const tFenD = T('SD 附中汾 D 名师', '英语,化学,物理,历史');

let roomCursor = 0;
const nextRoom = () => classroomIds[(roomCursor++) % classroomIds.length];

/* 排课（集训营模式） */
function camp(grade, subject, teacher, start, end, s, e, sessions, restDays, room) {
  const id = db.prepare(`INSERT INTO courses(grade, subject, teacher_id, classroom_id, unit_price,
    mode, start_time, end_time, start_date, end_date, rest_days, total_sessions)
    VALUES (?,?,?,?,?, 'camp', ?,?,?,?,?,?)`).run(
    grade, subject, teacher, room ?? nextRoom(), PRICE, s, e, start, end,
    restDays ? JSON.stringify(restDays) : null, sessions).lastInsertRowid;
  regenerateSessions(id);
  return id;
}

/* 新初一（7/26-8/11，8/2 休息） */
const g1Room = classroomIds[0];
camp('初一', '数学', tZ,     D(7, 26), D(8, 11), '09:10', '10:40', 15, [D(8, 2)], g1Room);
camp('初一', '语文', tZ,     D(7, 26), D(8, 11), '10:50', '12:10', 15, [D(8, 2)], g1Room);
camp('初一', '政治', tExpert, D(7, 26), D(7, 31), '16:10', '17:40', 5, null, g1Room);
camp('初一', '历史', tSD,     D(7, 26), D(7, 31), '17:50', '19:20', 5, null, g1Room);
// 初一 分班考 8/13-8/16
camp('初一', '数学(分班考)', tZ,   D(8, 13), D(8, 16), '14:30', '16:00', 4, null, g1Room);
camp('初一', '语文(分班考)', tZ,   D(8, 13), D(8, 16), '16:10', '17:40', 4, null, g1Room);
camp('初一', '英语(分班考)', tFenD, D(8, 13), D(8, 16), '17:50', '19:20', 4, null, g1Room);

/* 新初二·二期（7/26-8/10，8/2 休息） */
const g2Room = classroomIds[1];
camp('初二', '语文', tZ,     D(7, 26), D(8, 10), '07:30', '09:00', 15, [D(8, 2)], g2Room);
camp('初二', '物理', tZhang, D(7, 26), D(8, 10), '09:10', '10:40', 15, [D(8, 2)], g2Room);
camp('初二', '数学', tZ,     D(7, 26), D(8, 10), '10:50', '12:20', 15, [D(8, 2)], g2Room);
camp('初二', '化学', tHuaxue, D(7, 26), D(8, 10), '14:30', '16:00', 15, [D(8, 2)], g2Room);
camp('初二', '英语', tFenD,  D(7, 26), D(8, 10), '16:10', '17:40', 15, [D(8, 2)], g2Room);

/* 新初三·二期（7/26-8/11，8/3 休息） */
const g3Room = classroomIds[2];
camp('初三', '数学', tZ,     D(7, 26), D(8, 11), '07:30', '09:00', 15, [D(8, 3)], g3Room);
camp('初三', '语文', tZ,     D(7, 26), D(8, 11), '09:10', '10:40', 15, [D(8, 3)], g3Room);
camp('初三', '英语', tFenD,  D(7, 26), D(8, 11), '10:50', '12:20', 15, [D(8, 3)], g3Room);
camp('初三', '化学', tFenD,  D(7, 26), D(8, 11), '14:30', '16:00', 15, [D(8, 3)], g3Room);
camp('初三', '物理', tFenD,  D(7, 26), D(8, 11), '16:10', '17:40', 15, [D(8, 3)], g3Room);
camp('初三', '政治', tExpert, D(7, 26), D(8, 11), '17:50', '19:20', 8, [D(8, 3)], g3Room);
camp('初三', '历史', tFenD,  D(7, 26), D(8, 11), '19:30', '21:00', 8, [D(8, 3)], g3Room);

/* 高一：海报暂缺 —— 用「常规周期模式」建一个演示课，覆盖到"今天"便于立即测试签到 */
const g4Id = db.prepare(`INSERT INTO courses(grade, subject, teacher_id, classroom_id, unit_price,
  mode, start_time, end_time, start_date, end_date, weekdays, note)
  VALUES (?,?,?,?,?, 'weekly', ?,?,?,?,?,?)`).run(
  '高一', '数学', tZ, classroomIds[3], PRICE, '19:00', '20:30',
  D(7, 1), D(8, 31), JSON.stringify([1, 2, 3, 4, 5, 6, 7]), '常规周期模式演示课').lastInsertRowid;
regenerateSessions(g4Id);

/* 学生 + 报名 + 充值（演示账户，家长手机号即登录账号） */
function addStudent(name, grade, phone) {
  return db.prepare('INSERT INTO students(name, grade, guardian_phone, enroll_date) VALUES (?,?,?,?)')
    .run(name, grade, phone, D(7, 20)).lastInsertRowid;
}
function enroll(studentId, courseId, recharge) {
  db.prepare("INSERT INTO enrollments(student_id, course_id, status) VALUES (?,?, 'active')").run(studentId, courseId);
  ensureAccount(studentId, courseId);
  if (recharge) {
    db.prepare("INSERT INTO transactions(student_id, course_id, amount, type, method, operator, note) VALUES (?,?,?, 'recharge','prestore','admin','演示充值')")
      .run(studentId, courseId, recharge);
    const acc = ensureAccount(studentId, courseId);
    db.prepare('UPDATE student_accounts SET total_recharge=total_recharge+?, balance=balance+? WHERE id=?')
      .run(recharge, recharge, acc.id);
  }
}

const coursesByGrade = (g) => db.prepare("SELECT id FROM courses WHERE grade=?").all(g).map((r) => r.id);

// 演示：手机号 13800000001 家长名下 2 个孩子
const s1 = addStudent('张小明', '初一', '13800000001');
const s2 = addStudent('李小红', '初三', '13800000001');
// 手机号 13800000002
const s3 = addStudent('王小刚', '初二', '13800000002');
const s4 = addStudent('赵小丽', '高一', '13800000002');

coursesByGrade('初一').forEach((c) => enroll(s1, c, 1500));
coursesByGrade('初三').forEach((c) => enroll(s2, c, 1500));
coursesByGrade('初二').forEach((c) => enroll(s3, c, 1500));
coursesByGrade('高一').forEach((c) => enroll(s4, c, 800));

/* 分红负责人（比例可后台配置） */
db.prepare('INSERT INTO partners(name, ratio) VALUES (?,?)').run('负责人甲', 0.6);
db.prepare('INSERT INTO partners(name, ratio) VALUES (?,?)').run('负责人乙', 0.4);

console.log('完成。');
console.log('  管理员登录密码: admin123');
console.log('  学生登录手机号: 13800000001 或 13800000002');
console.log(`  课程数: ${db.prepare('SELECT COUNT(*) c FROM courses').get().c}，` +
  `课次实例: ${db.prepare('SELECT COUNT(*) c FROM session_instances').get().c}`);
