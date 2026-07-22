'use strict';
/* 通用工具：API 请求、鉴权、Toast、签名板、格式化 */

const Auth = {
  get token() { return localStorage.getItem('qh_token'); },
  get role() { return localStorage.getItem('qh_role'); },
  set(token, role) { localStorage.setItem('qh_token', token); localStorage.setItem('qh_role', role); },
  clear() { localStorage.clear(); },
  logout() { this.clear(); location.href = '/'; }
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers['Authorization'] = 'Bearer ' + Auth.token;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* 无内容 */ }
  if (res.status === 401) { toast('登录已过期，请重新登录'); setTimeout(() => Auth.logout(), 800); throw new Error('401'); }
  if (!res.ok) { const err = new Error((data && data.error) || '请求失败'); err.data = data; err.status = res.status; throw err; }
  return data;
}

let toastTimer;
function toast(msg, ms = 2200) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function money(n) { return '¥' + Number(n || 0).toFixed(2); }
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
function statusBadge(s) {
  const map = {
    present: ['ok', '已签到'], leave: ['leave', '请假'], absent: ['warn', '旷课'],
    canceled: ['gray', '停课'], null: ['gray', '未签到'], scheduled: ['blue', '未开始']
  };
  const [cls, txt] = map[s] || map['null'];
  return `<span class="badge ${cls}">${txt}</span>`;
}

/* 弹层 */
function openModal(title, contentEl) {
  const bg = el(`<div class="modal-bg"><div class="modal"><h2><span>${esc(title)}</span><button class="close">&times;</button></h2></div></div>`);
  bg.querySelector('.modal').appendChild(contentEl);
  const close = () => bg.remove();
  bg.querySelector('.close').onclick = close;
  bg.onclick = (e) => { if (e.target === bg) close(); };
  document.body.appendChild(bg);
  return { close, bg };
}

/* Canvas 手写签名板 —— 支持触屏与鼠标 */
function SignaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  }
  let drawing = false, dirty = false;
  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function start(e) { drawing = true; dirty = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
  function move(e) { if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
  function end() { drawing = false; }
  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
  setTimeout(resize, 0);
  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
    isEmpty() { return !dirty; },
    dataURL() { return canvas.toDataURL('image/png'); }
  };
}
