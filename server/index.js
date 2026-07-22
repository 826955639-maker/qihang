'use strict';

const path = require('path');
const express = require('express');
const { init } = require('./db');
const { adminLogin, studentLogin } = require('./auth');

init();

const app = express();
app.use(express.json({ limit: '5mb' })); // 签名 dataURL 可能较大

// ---- 登录 ----
app.post('/api/auth/admin-login', (req, res) => {
  const token = adminLogin((req.body || {}).password);
  if (!token) return res.status(401).json({ error: '密码错误' });
  res.json({ token, role: 'admin' });
});

app.post('/api/auth/student-login', (req, res) => {
  const result = studentLogin((req.body || {}).phone);
  if (!result) return res.status(404).json({ error: '未找到该手机号下的学生，请联系管理员登记' });
  res.json({ ...result, role: 'student' });
});

// ---- 业务路由 ----
app.use('/api/admin', require('./routes/admin'));
app.use('/api/student', require('./routes/student'));

// ---- 静态前端 ----
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`起航附中管理系统已启动: http://localhost:${PORT}`);
});
