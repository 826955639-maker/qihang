'use strict';
/* 学生端逻辑 */
if (!Auth.token || Auth.role !== 'student') location.href = '/';

const students = JSON.parse(localStorage.getItem('qh_students') || '[]');
let currentId = students[0] && students[0].id;
let ttView = 'today';
let ttDate = new Date().toISOString().slice(0, 10);

function initHeader() {
  const sw = document.getElementById('studentSwitch');
  sw.innerHTML = students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  sw.value = currentId;
  sw.onchange = () => { currentId = Number(sw.value); renderAll(); };
  document.getElementById('logout').onclick = () => Auth.logout();
}
function updateName() {
  const s = students.find((x) => x.id === currentId);
  document.getElementById('studentName').textContent = s ? s.name : '学生端';
  document.getElementById('studentGrade').textContent = s ? s.grade : '';
}

/* Tab 切换 */
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b === btn));
  ['checkin', 'timetable', 'bill'].forEach((t) => document.getElementById('tab-' + t).classList.toggle('hidden', t !== btn.dataset.tab));
  if (btn.dataset.tab === 'checkin') loadCheckin();
  if (btn.dataset.tab === 'timetable') loadTimetable();
  if (btn.dataset.tab === 'bill') loadBill();
});

/* ---------- 签到 ---------- */
async function loadCheckin() {
  const wrap = document.getElementById('tab-checkin');
  wrap.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const { date, sessions } = await api(`/api/student/today?studentId=${currentId}`);
    if (!sessions.length) { wrap.innerHTML = `<div class="empty">今日（${date}）暂无课程 🎉</div>`; return; }
    wrap.innerHTML = `<h2 style="font-size:16px">今日待签到 · ${date}</h2>`;
    sessions.forEach((s) => {
      const done = s.my_status === 'present';
      const leave = s.my_status === 'leave';
      const item = el(`<div class="item">
        <div class="head">
          <span class="title">${esc(s.subject)}</span>
          ${statusBadge(s.my_status)}
        </div>
        <div class="meta">🕐 ${s.start_time}-${s.end_time} · 👩‍🏫 ${esc(s.teacher || '待定')} · 🏫 ${esc(s.classroom || '待定')}</div>
        <div class="meta">单价 ${money(s.price)} · 余额 <b style="color:${s.balance < s.price ? 'var(--warn)' : 'var(--ok)'}">${money(s.balance)}</b></div>
        <div class="btn-row mt"></div>
      </div>`);
      const btnRow = item.querySelector('.btn-row');
      if (done || leave) {
        btnRow.innerHTML = `<button class="btn secondary" disabled>${done ? '已签到 ✓' : '已请假'}</button>`;
      } else {
        const sign = el('<button class="btn">✍️ 签到</button>');
        sign.onclick = () => openSignModal(s);
        const lv = el('<button class="btn ghost">请假</button>');
        lv.onclick = () => requestLeave(s);
        btnRow.appendChild(sign); btnRow.appendChild(lv);
      }
      wrap.appendChild(item);
    });
  } catch (e) { wrap.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function openSignModal(s) {
  const body = el(`<div>
    <p class="small muted">课程：<b>${esc(s.subject)}</b> ${s.start_time}-${s.end_time}</p>
    <p class="small">请确认本人为 <b>${esc(students.find((x) => x.id === currentId).name)}</b>，并在下方手写签名：</p>
    <canvas class="sign-pad" id="pad"></canvas>
    <div class="sign-hint">在框内手写签名（防代签留痕凭证）</div>
    <div class="btn-row">
      <button class="btn ghost" id="clearSign">清除</button>
      <button class="btn" id="submitSign">确认签到并扣费 ${money(s.price)}</button>
    </div>
  </div>`);
  const { close } = openModal('手写签到', body);
  const pad = SignaturePad(body.querySelector('#pad'));
  body.querySelector('#clearSign').onclick = () => pad.clear();
  body.querySelector('#submitSign').onclick = async () => {
    if (pad.isEmpty()) return toast('请先手写签名');
    try {
      const r = await api('/api/student/checkin', { method: 'POST', body: { studentId: currentId, sessionId: s.session_id, signature: pad.dataURL() } });
      close(); toast(`签到成功，扣费 ${money(r.charged)}，余额 ${money(r.balance)}`);
      loadCheckin();
    } catch (e) { toast(e.message); }
  };
}

async function requestLeave(s) {
  if (!confirm(`确认为「${s.subject} ${s.start_time}」请假？请假不扣费、不计课时。`)) return;
  try {
    await api('/api/student/leave', { method: 'POST', body: { studentId: currentId, sessionId: s.session_id } });
    toast('请假成功'); loadCheckin();
  } catch (e) { toast(e.message); }
}

/* ---------- 课表 ---------- */
async function loadTimetable() {
  const wrap = document.getElementById('tab-timetable');
  wrap.innerHTML = `
    <div class="seg" id="ttSeg">
      <button data-v="today" class="${ttView === 'today' ? 'active' : ''}">今日</button>
      <button data-v="week" class="${ttView === 'week' ? 'active' : ''}">本周</button>
      <button data-v="date" class="${ttView === 'date' ? 'active' : ''}">按日期</button>
    </div>
    <div id="ttDatePick" class="${ttView === 'date' ? '' : 'hidden'}" style="margin-bottom:12px">
      <input type="date" id="ttDate" value="${ttDate}" />
    </div>
    <div id="ttList"></div>`;
  wrap.querySelector('#ttSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    ttView = b.dataset.v; loadTimetable();
  };
  const dp = wrap.querySelector('#ttDate');
  if (dp) dp.onchange = () => { ttDate = dp.value; fetchTT(); };
  fetchTT();
}
async function fetchTT() {
  const list = document.getElementById('ttList');
  list.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const q = ttView === 'date' ? `&date=${ttDate}` : '';
    const { sessions, from, to } = await api(`/api/student/timetable?studentId=${currentId}&view=${ttView}${q}`);
    if (!sessions.length) { list.innerHTML = `<div class="empty">${from === to ? from : from + ' ~ ' + to} 无课程</div>`; return; }
    let curDate = '';
    list.innerHTML = '';
    sessions.forEach((s) => {
      if (s.date !== curDate) { curDate = s.date; list.appendChild(el(`<h3 style="margin:14px 0 6px;font-size:14px;color:var(--muted)">${s.date}</h3>`)); }
      const st = timeStatus(s.date, s.start_time, s.end_time);
      list.appendChild(el(`<div class="item">
        <div class="head"><span class="title">${esc(s.subject)} ${s.enrolled ? '' : '<span class="badge gray">未报名</span>'}</span>
          ${s.status === 'canceled' ? statusBadge('canceled') : `<span class="badge ${st.cls}">${st.txt}</span>`}</div>
        <div class="meta">🕐 ${s.start_time}-${s.end_time} · 👩‍🏫 ${esc(s.teacher || '待定')} · 🏫 ${esc(s.classroom || '待定')}</div>
        ${s.my_status ? `<div class="meta">我的状态：${statusBadge(s.my_status)}</div>` : ''}
      </div>`));
    });
  } catch (e) { list.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function timeStatus(date, start, end) {
  const now = new Date();
  const s = new Date(`${date}T${start}:00`), e = new Date(`${date}T${end}:00`);
  if (now < s) return { cls: 'blue', txt: '未开始' };
  if (now > e) return { cls: 'gray', txt: '已结束' };
  return { cls: 'ok', txt: '进行中' };
}

/* ---------- 账单 ---------- */
async function loadBill() {
  const wrap = document.getElementById('tab-bill');
  wrap.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const { courses, history } = await api(`/api/student/bill?studentId=${currentId}`);
    let html = '<h2 style="font-size:16px">课程账户</h2>';
    if (!courses.length) html += '<div class="empty">暂无报名课程</div>';
    courses.forEach((c) => {
      const warn = c.balance < c.warn_threshold * c.price;
      html += `<div class="card">
        <div class="flex-between"><b>${esc(c.subject)}</b>
          <span class="badge ${warn ? 'warn' : 'ok'}">${warn ? '余额不足' : '余额充足'}</span></div>
        <div class="row"><span class="muted">单价</span><span>${money(c.price)}/节</span></div>
        <div class="row"><span class="muted">已上课</span><span>${c.present_count} 节</span></div>
        <div class="row"><span class="muted">已请假</span><span>${c.leave_count} 次</span></div>
        <div class="row"><span class="muted">累计充值</span><span>${money(c.total_recharge)}</span></div>
        <div class="row"><span class="muted">累计消耗</span><span>${money(c.total_consumed)}</span></div>
        <div class="row"><span class="muted">当前余额</span><span style="color:${warn ? 'var(--warn)' : 'var(--ok)'};font-weight:700">${money(c.balance)}</span></div>
        ${warn ? '<div class="small" style="color:var(--warn);margin-top:8px">⚠️ 余额偏低，请及时补交学费</div>' : ''}
      </div>`;
    });
    html += '<h2 style="font-size:16px;margin-top:6px">历史签到记录</h2>';
    if (!history.length) html += '<div class="empty">暂无记录</div>';
    else {
      html += '<div class="table-wrap"><table><thead><tr><th>日期</th><th>科目</th><th>状态</th><th>扣费</th><th>签名</th></tr></thead><tbody>';
      history.forEach((h) => {
        html += `<tr><td>${h.date}<br><span class="small muted">${h.start_time}</span></td><td>${esc(h.subject)}</td>
          <td>${statusBadge(h.status)}</td><td>${h.charged ? money(h.charged) : '-'}</td>
          <td>${h.signature ? `<img src="${h.signature}" style="height:28px;border:1px solid var(--border);border-radius:4px;cursor:pointer" onclick="showSig('${encodeURIComponent(h.signature)}')" />` : '-'}</td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    wrap.innerHTML = html;
  } catch (e) { wrap.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
function showSig(enc) {
  const img = el(`<div style="text-align:center"><img src="${decodeURIComponent(enc)}" style="max-width:100%;border:1px solid var(--border);border-radius:8px" /></div>`);
  openModal('签名凭证', img);
}

function renderAll() { updateName(); loadCheckin(); }
initHeader(); renderAll();
