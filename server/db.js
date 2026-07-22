'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.QIHANG_DB || path.join(DATA_DIR, 'qihang.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * 建表。所有金额单位统一为「元」，用 REAL 存储（演示系统足够；生产可改为整数分）。
 * 课时数即"节数"。
 */
function init() {
  db.exec(`
  -- 年级枚举以文本存储：初一/初二/初三/高一/一对一

  CREATE TABLE IF NOT EXISTS students (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    grade        TEXT NOT NULL,
    guardian_phone TEXT,
    enroll_date  TEXT,
    note         TEXT,
    created_at   TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    phone        TEXT,
    subjects     TEXT,             -- 擅长科目
    hourly_fee   REAL DEFAULT 0,   -- 单节课时费标准
    created_at   TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS classrooms (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    note         TEXT
  );

  -- 排课配置（一条 = 某年级某科目一个固定时间段的课）
  -- mode: 'camp'(集训营) | 'weekly'(常规周期)
  CREATE TABLE IF NOT EXISTS courses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    grade         TEXT NOT NULL,
    subject       TEXT NOT NULL,
    teacher_id    INTEGER REFERENCES teachers(id),
    classroom_id  INTEGER REFERENCES classrooms(id),
    unit_price    REAL DEFAULT 0,       -- 每节课默认收费标准
    mode          TEXT NOT NULL,        -- camp | weekly
    start_time    TEXT NOT NULL,        -- 'HH:MM'
    end_time      TEXT NOT NULL,        -- 'HH:MM'
    -- 集训营模式
    start_date    TEXT,                 -- 'YYYY-MM-DD'
    end_date      TEXT,
    rest_days     TEXT,                 -- JSON 数组: ["2025-08-02", ...]
    total_sessions INTEGER,             -- 总讲次（可为空=按日期区间生成）
    -- 常规周期模式
    weekdays      TEXT,                 -- JSON 数组: [1..7] (1=周一)
    status        TEXT DEFAULT 'active',-- active | archived
    note          TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 具体课次实例（排课自动生成："某年某月某日某节课"）
  CREATE TABLE IF NOT EXISTS session_instances (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    date          TEXT NOT NULL,        -- 'YYYY-MM-DD'
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    seq           INTEGER,              -- 第几讲
    status        TEXT DEFAULT 'scheduled', -- scheduled | canceled(停课)
    UNIQUE(course_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_session_course ON session_instances(course_id);
  CREATE INDEX IF NOT EXISTS idx_session_date ON session_instances(date);

  -- 报名关系
  CREATE TABLE IF NOT EXISTS enrollments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    billing_type  TEXT DEFAULT 'balance', -- package(打包套餐) | balance(预存余额)
    unit_price    REAL,                 -- 该生此课单价（可覆盖 courses.unit_price）
    status        TEXT DEFAULT 'active',-- active(在读) | paused(停课) | finished(已结课)
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(student_id, course_id)
  );

  -- 学生账户（按课程独立余额）
  CREATE TABLE IF NOT EXISTS student_accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id     INTEGER REFERENCES courses(id) ON DELETE CASCADE, -- NULL=不区分课程的整体账户
    total_recharge REAL DEFAULT 0,      -- 累计充值
    total_consumed REAL DEFAULT 0,      -- 累计消耗
    balance        REAL DEFAULT 0,      -- 当前余额
    warn_threshold INTEGER DEFAULT 2,   -- 低于 X 节课费用时预警
    UNIQUE(student_id, course_id)
  );

  -- 充值/退款流水
  CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL REFERENCES students(id),
    course_id     INTEGER REFERENCES courses(id),  -- 可空=整体充值
    amount        REAL NOT NULL,        -- 正数
    type          TEXT NOT NULL,        -- recharge(充值) | refund(退款)
    method        TEXT,                 -- package(打包报名) | prestore(预存充值) | refund(退款)
    operator      TEXT,                 -- 经手人
    note          TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_txn_student ON transactions(student_id);
  CREATE INDEX IF NOT EXISTS idx_txn_created ON transactions(created_at);

  -- 签到记录
  CREATE TABLE IF NOT EXISTS attendance_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL REFERENCES students(id),
    session_id    INTEGER NOT NULL REFERENCES session_instances(id) ON DELETE CASCADE,
    status        TEXT NOT NULL,        -- present(正常签到) | leave(请假) | absent(旷课) | canceled(停课)
    signed_at     TEXT,
    signature     TEXT,                 -- 手写签名 dataURL（仅 present）
    charged       REAL DEFAULT 0,       -- 本次扣费金额
    operator      TEXT,                 -- student | admin
    note          TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(student_id, session_id)
  );
  CREATE INDEX IF NOT EXISTS idx_att_session ON attendance_records(session_id);
  CREATE INDEX IF NOT EXISTS idx_att_student ON attendance_records(student_id);

  -- 操作日志
  CREATE TABLE IF NOT EXISTS audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    actor         TEXT,                 -- 操作人
    action        TEXT,                 -- 动作
    entity        TEXT,                 -- 实体类型
    entity_id     TEXT,
    detail        TEXT,                 -- JSON
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 分红比例 / 系统配置
  CREATE TABLE IF NOT EXISTS settings (
    key           TEXT PRIMARY KEY,
    value         TEXT
  );

  -- 分红负责人
  CREATE TABLE IF NOT EXISTS partners (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    ratio         REAL DEFAULT 0        -- 分成比例 0~1
  );

  -- 其他成本（场地/耗材等，手动录入）
  CREATE TABLE IF NOT EXISTS costs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    amount        REAL NOT NULL,
    incurred_at   TEXT DEFAULT (datetime('now','localtime')),
    note          TEXT
  );

  -- 教师课时费结算标记
  CREATE TABLE IF NOT EXISTS teacher_settlements (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id    INTEGER NOT NULL REFERENCES teachers(id),
    period        TEXT NOT NULL,        -- 'YYYY-MM' 或自定义标识
    sessions      INTEGER,
    amount        REAL,
    paid          INTEGER DEFAULT 0,
    paid_at       TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );
  `);

  // 默认配置
  const setDefault = db.prepare(
    'INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)'
  );
  setDefault.run('absent_charge', '1');        // 旷课默认扣费
  setDefault.run('leave_lead_hours', '2');     // 请假需提前 X 小时
  setDefault.run('admin_password', 'admin123');
}

module.exports = { db, init, DB_PATH };
