'use strict';

const crypto = require('crypto');
const { db } = require('./db');

// 内存会话表：token -> { role, phone? }
const sessions = new Map();

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

function adminLogin(password) {
  const row = db.prepare("SELECT value FROM settings WHERE key='admin_password'").get();
  if (!row || password !== row.value) return null;
  const token = newToken();
  sessions.set(token, { role: 'admin' });
  return token;
}

function studentLogin(phone) {
  const students = db
    .prepare('SELECT id, name, grade FROM students WHERE guardian_phone = ? ORDER BY name')
    .all(phone);
  if (students.length === 0) return null;
  const token = newToken();
  sessions.set(token, { role: 'student', phone });
  return { token, students };
}

function getSession(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  if (!token) return null;
  return sessions.get(token) || null;
}

function requireAdmin(req, res, next) {
  const s = getSession(req);
  if (!s || s.role !== 'admin') return res.status(401).json({ error: '需要管理员登录' });
  req.session = s;
  next();
}

function requireStudent(req, res, next) {
  const s = getSession(req);
  if (!s || s.role !== 'student') return res.status(401).json({ error: '需要学生登录' });
  req.session = s;
  next();
}

/** 校验该 phone 会话是否拥有此 studentId */
function ownsStudent(phone, studentId) {
  const row = db
    .prepare('SELECT id FROM students WHERE id = ? AND guardian_phone = ?')
    .get(studentId, phone);
  return !!row;
}

module.exports = { adminLogin, studentLogin, requireAdmin, requireStudent, ownsStudent, getSession };
