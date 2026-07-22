'use strict';
/* 管理端逻辑 */
if (!Auth.token || Auth.role !== 'admin') location.href = '/';

const GRADES = ['初一', '初二', '初三', '高一', '一对一'];
const today = new Date().toISOString().slice(0, 10);
document.getElementById('todayLbl').textContent = today;
document.getElementById('logout').onclick = () => Auth.logout();

let cache = { teachers: [], classrooms: [] };

async function loadRefs() {
  [cache.teachers, cache.classrooms] = await Promise.all([
    api('/api/admin/teachers'), api('/api/admin/classrooms')
  ]);
}

const view = document.getElementById('view');
document.getElementById('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#nav button').forEach((x) => x.classList.toggle('active', x === b));
  render(b.dataset.tab);
});

async function render(tab) {
  view.innerHTML = '<div class="empty">加载中…</div>';
  try {
    if (tab === 'dashboard') return renderDashboard();
    if (tab === 'courses') return renderCourses();
    if (tab === 'students') return renderStudents();
    if (tab === 'teachers') return renderTeachers();
    if (tab === 'finance') return renderFinance();
    if (tab === 'logs') return renderLogs();
    if (tab === 'settings') return renderSettings();
  } catch (e) { view.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

/* ================= 看板 ================= */
async function renderDashboard() {
  const d = await api('/api/admin/dashboard');
  view.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="num">${d.todaySessions}</div><div class="lbl">今日课程数</div></div>
      <div class="stat"><div class="num">${d.checkinRate}%</div><div class="lbl">今日签到率 (${d.todayPresent}/${d.todayExpected})</div></div>
      <div class="stat"><div class="num" style="color:var(--warn)">${d.owing}</div><div class="lbl">待补费学生数</div></div>
      <div class="stat"><div class="num">${money(d.monthIncome)}</div><div class="lbl">本月总营收</div></div>
      <div class="stat"><div class="num" style="color:var(--leave)">${money(d.monthTeacherFee)}</div><div class="lbl">本月教师应付课时费</div></div>
      <div class="stat"><div class="num">${d.students}</div><div class="lbl">学生总数</div></div>
      <div class="stat"><div class="num">${d.courses}</div><div class="lbl">排课总数</div></div>
    </div>
    <div class="card mt"><b>快捷操作</b>
      <div class="wrap-actions mt">
        <button class="btn sm" onclick="document.querySelector('[data-tab=courses]').click()">➕ 排课管理</button>
        <button class="btn sm secondary" onclick="document.querySelector('[data-tab=finance]').click()">💰 收款登记</button>
        <button class="btn sm secondary" onclick="document.querySelector('[data-tab=students]').click()">👨‍🎓 学生管理</button>
      </div>
    </div>`;
}

/* ================= 排课 ================= */
let courseFilter = '';
async function renderCourses() {
  const courses = await api('/api/admin/courses');
  view.innerHTML = `
    <div class="flex-between">
      <select id="cf" style="width:auto"><option value="">全部年级</option>${GRADES.map((g) => `<option ${g === courseFilter ? 'selected' : ''}>${g}</option>`).join('')}</select>
      <button class="btn sm" id="addCourse">➕ 新建排课</button>
    </div>
    <div id="courseList" class="mt"></div>`;
  document.getElementById('cf').onchange = (e) => { courseFilter = e.target.value; renderCourses(); };
  document.getElementById('addCourse').onclick = () => courseModal();
  const list = document.getElementById('courseList');
  const shown = courses.filter((c) => !courseFilter || c.grade === courseFilter);
  if (!shown.length) { list.innerHTML = '<div class="empty">暂无排课，点击"新建排课"创建</div>'; return; }
  list.innerHTML = '';
  shown.forEach((c) => {
    const modeTxt = c.mode === 'camp' ? '集训营' : '常规周期';
    list.appendChild(el(`<div class="item">
      <div class="head"><span class="title">${esc(c.grade)} · ${esc(c.subject)}</span>
        <span class="badge blue">${modeTxt}</span></div>
      <div class="meta">🕐 ${c.start_time}-${c.end_time} · 👩‍🏫 ${esc(c.teacher_name || '待定')} · 🏫 ${esc(c.classroom_name || '未分配')}</div>
      <div class="meta">单价 ${money(c.unit_price)} · 课次 ${c.session_count} · 报名 ${c.enroll_count} 人</div>
      <div class="wrap-actions mt">
        <button class="btn sm secondary" data-act="enroll">报名/名单</button>
        <button class="btn sm secondary" data-act="sessions">课次签到</button>
        <button class="btn sm ghost" data-act="edit">编辑</button>
        <button class="btn sm danger" data-act="del">删除</button>
      </div>
    </div>`));
    const item = list.lastChild;
    item.querySelector('[data-act=edit]').onclick = () => courseModal(c);
    item.querySelector('[data-act=enroll]').onclick = () => enrollModal(c);
    item.querySelector('[data-act=sessions]').onclick = () => sessionsModal(c);
    item.querySelector('[data-act=del]').onclick = async () => {
      if (!confirm(`删除排课「${c.grade} ${c.subject}」及其所有课次？`)) return;
      await api('/api/admin/courses/' + c.id, { method: 'DELETE' }); renderCourses();
    };
  });
}

function courseModal(c = {}) {
  const isCamp = (c.mode || 'camp') === 'camp';
  const rest = c.rest_days ? JSON.parse(c.rest_days).join(',') : '';
  const wd = c.weekdays ? JSON.parse(c.weekdays) : [];
  const body = el(`<div>
    <div class="grid2">
      <div><label>年级</label><select id="f_grade">${GRADES.map((g) => `<option ${g === c.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
      <div><label>科目</label><input id="f_subject" value="${esc(c.subject || '')}" placeholder="如 数学" /></div>
      <div><label>任课教师</label><select id="f_teacher"><option value="">未指定</option>${cache.teachers.map((t) => `<option value="${t.id}" ${t.id === c.teacher_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
      <div><label>教室（必填）</label><select id="f_room"><option value="">请选择</option>${cache.classrooms.map((r) => `<option value="${r.id}" ${r.id === c.classroom_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div><label>学生单价(元/节)</label><input id="f_price" type="number" value="${c.unit_price ?? 100}" /></div>
      <div><label>排课模式</label><select id="f_mode"><option value="camp" ${isCamp ? 'selected' : ''}>集训营（日期区间）</option><option value="weekly" ${!isCamp ? 'selected' : ''}>常规周期（每周循环）</option></select></div>
      <div><label>上课开始时间</label><input id="f_start" type="time" value="${c.start_time || '09:10'}" /></div>
      <div><label>上课结束时间</label><input id="f_end" type="time" value="${c.end_time || '10:40'}" /></div>
    </div>
    <div id="campFields">
      <div class="grid2">
        <div><label>开始日期</label><input id="f_sd" type="date" value="${c.start_date || ''}" /></div>
        <div><label>结束日期</label><input id="f_ed" type="date" value="${c.end_date || ''}" /></div>
      </div>
      <label>休息日（逗号分隔多个日期，如 2026-08-02,2026-08-09）</label>
      <input id="f_rest" value="${rest}" placeholder="可留空" />
      <label>总讲次（可留空=按日期区间生成）</label>
      <input id="f_total" type="number" value="${c.total_sessions || ''}" placeholder="如 15" />
    </div>
    <div id="weeklyFields" class="hidden">
      <label>每周上课（可多选）</label>
      <div class="wrap-actions" id="wdBox">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<label class="flex" style="width:auto;margin:0"><input type="checkbox" style="width:auto" value="${d}" ${wd.includes(d) ? 'checked' : ''}/> ${WD[d]}</label>`).join('')}</div>
      <div class="grid2">
        <div><label>循环开始日期</label><input id="f_wsd" type="date" value="${c.mode === 'weekly' ? (c.start_date || '') : ''}" /></div>
        <div><label>循环结束日期</label><input id="f_wed" type="date" value="${c.mode === 'weekly' ? (c.end_date || '') : ''}" /></div>
      </div>
    </div>
    <div id="conflictBox"></div>
    <div class="btn-row mt"><button class="btn" id="saveCourse">保存并生成课次</button></div>
  </div>`);
  const { close } = openModal(c.id ? '编辑排课' : '新建排课', body);
  const modeSel = body.querySelector('#f_mode');
  const toggle = () => {
    const camp = modeSel.value === 'camp';
    body.querySelector('#campFields').classList.toggle('hidden', !camp);
    body.querySelector('#weeklyFields').classList.toggle('hidden', camp);
  };
  modeSel.onchange = toggle; toggle();

  body.querySelector('#saveCourse').onclick = async () => {
    const mode = modeSel.value;
    const payload = {
      id: c.id, grade: body.querySelector('#f_grade').value, subject: body.querySelector('#f_subject').value.trim(),
      teacher_id: body.querySelector('#f_teacher').value || null, classroom_id: body.querySelector('#f_room').value || null,
      unit_price: Number(body.querySelector('#f_price').value) || 0, mode,
      start_time: body.querySelector('#f_start').value, end_time: body.querySelector('#f_end').value
    };
    if (mode === 'camp') {
      payload.start_date = body.querySelector('#f_sd').value; payload.end_date = body.querySelector('#f_ed').value;
      payload.rest_days = body.querySelector('#f_rest').value.split(',').map((s) => s.trim()).filter(Boolean);
      payload.total_sessions = Number(body.querySelector('#f_total').value) || null;
    } else {
      payload.weekdays = [...body.querySelectorAll('#wdBox input:checked')].map((i) => Number(i.value));
      payload.start_date = body.querySelector('#f_wsd').value; payload.end_date = body.querySelector('#f_wed').value;
    }
    if (!payload.subject) return toast('请填写科目');
    if (!payload.classroom_id) return toast('请分配教室');
    try {
      const r = await api('/api/admin/courses', { method: 'POST', body: payload });
      close(); toast(`保存成功，生成 ${r.sessions_generated} 个课次`); renderCourses();
    } catch (e) {
      if (e.status === 409 && e.data && e.data.conflicts) {
        const cb = body.querySelector('#conflictBox');
        cb.innerHTML = `<div class="card" style="background:#fff7ed;border:1px solid #fdba74;margin-top:12px">
          <b style="color:var(--warn)">⚠️ 教室时间冲突（${e.data.conflicts.length}）</b>
          <div class="small mt">${e.data.conflicts.slice(0, 8).map((x) => `${x.date} ${x.start_time}-${x.end_time} · ${esc(x.grade)}${esc(x.subject)}`).join('<br>')}</div>
          <button class="btn sm danger mt" id="forceSave">仍然保存（忽略冲突）</button></div>`;
        cb.querySelector('#forceSave').onclick = async () => {
          payload.force = true;
          const r = await api('/api/admin/courses', { method: 'POST', body: payload });
          close(); toast(`已保存，生成 ${r.sessions_generated} 个课次`); renderCourses();
        };
      } else toast(e.message);
    }
  };
}

async function enrollModal(c) {
  const [roster, allStudents] = await Promise.all([
    api('/api/admin/courses/' + c.id + '/enrollments'),
    api('/api/admin/students' + (c.grade === '一对一' ? '' : '?grade=' + encodeURIComponent(c.grade)))
  ]);
  const enrolledIds = new Set(roster.map((r) => r.student_id));
  const body = el(`<div>
    <p class="small muted">课程：${esc(c.grade)} ${esc(c.subject)} · 默认单价 ${money(c.unit_price)}</p>
    <div class="flex mt">
      <select id="addStu" style="flex:1">${allStudents.filter((s) => !enrolledIds.has(s.id)).map((s) => `<option value="${s.id}">${esc(s.name)} (${esc(s.grade)})</option>`).join('') || '<option value="">无可添加学生</option>'}</select>
      <input id="addPrice" type="number" placeholder="优惠单价(可空)" style="width:120px" />
      <button class="btn sm" id="doEnroll">报名</button>
    </div>
    <div class="table-wrap mt"><table><thead><tr><th>姓名</th><th>单价</th><th>余额</th><th></th></tr></thead><tbody id="rosterBody"></tbody></table></div>
  </div>`);
  openModal(`报名名单 · ${c.subject}`, body);
  function fill(rows) {
    const tb = body.querySelector('#rosterBody');
    tb.innerHTML = rows.length ? '' : '<tr><td colspan="4" class="muted">暂无报名</td></tr>';
    rows.forEach((r) => {
      const tr = el(`<tr><td>${esc(r.name)}</td><td>${money(r.unit_price ?? c.unit_price)}</td><td>${money(r.balance || 0)}</td>
        <td><button class="btn sm danger">移除</button></td></tr>`);
      tr.querySelector('button').onclick = async () => {
        if (!confirm('移除该学生报名？')) return;
        await api('/api/admin/enrollments/' + r.id, { method: 'DELETE' });
        const nr = await api('/api/admin/courses/' + c.id + '/enrollments'); fill(nr);
      };
      tb.appendChild(tr);
    });
  }
  fill(roster);
  body.querySelector('#doEnroll').onclick = async () => {
    const sid = body.querySelector('#addStu').value; if (!sid) return;
    const price = body.querySelector('#addPrice').value;
    try {
      await api('/api/admin/enrollments', { method: 'POST', body: { student_id: Number(sid), course_id: c.id, unit_price: price ? Number(price) : null } });
      toast('报名成功'); enrollModal(c);
    } catch (e) { toast(e.message); }
  };
}

async function sessionsModal(c) {
  const sessions = await api('/api/admin/courses/' + c.id + '/sessions');
  const body = el(`<div><p class="small muted">共 ${sessions.length} 个课次，点击查看/代录签到</p><div id="sess"></div></div>`);
  openModal(`课次 · ${c.subject}`, body);
  const box = body.querySelector('#sess');
  sessions.forEach((s) => {
    const it = el(`<div class="item" style="padding:10px"><div class="flex-between">
      <div><b>第${s.seq}讲</b> ${s.date} <span class="small muted">${s.start_time}-${s.end_time}</span>
        ${s.status === 'canceled' ? statusBadge('canceled') : ''}</div>
      <div class="wrap-actions">
        <span class="badge ok">签${s.present}</span><span class="badge leave">假${s.leave_cnt}</span>
        <button class="btn sm secondary" data-a="roster">名单</button>
        <button class="btn sm ghost" data-a="cancel">${s.status === 'canceled' ? '恢复' : '停课'}</button>
      </div></div></div>`);
    it.querySelector('[data-a=roster]').onclick = () => rosterModal(s.id, c);
    it.querySelector('[data-a=cancel]').onclick = async () => {
      await api('/api/admin/sessions/' + s.id + '/cancel', { method: 'POST', body: { cancel: s.status !== 'canceled' } });
      sessionsModal(c);
    };
    box.appendChild(it);
  });
}

async function rosterModal(sessionId, c) {
  const { session, roster } = await api('/api/admin/sessions/' + sessionId + '/roster');
  const body = el(`<div><p class="small muted">${session.date} ${session.start_time}-${session.end_time} · ${esc(c.subject)}</p>
    <div class="table-wrap"><table><thead><tr><th>姓名</th><th>状态</th><th>代录</th></tr></thead><tbody id="rb"></tbody></table></div></div>`);
  openModal('课次签到名单', body);
  const tb = body.querySelector('#rb');
  roster.forEach((r) => {
    const tr = el(`<tr><td>${esc(r.name)}</td><td>${statusBadge(r.status)}</td>
      <td><select style="width:auto"><option value="">-</option>
        <option value="present" ${r.status === 'present' ? 'selected' : ''}>正常签到</option>
        <option value="leave" ${r.status === 'leave' ? 'selected' : ''}>请假</option>
        <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>旷课</option></select></td></tr>`);
    tr.querySelector('select').onchange = async (e) => {
      if (!e.target.value) return;
      await api('/api/admin/attendance', { method: 'POST', body: { student_id: r.student_id, session_id: sessionId, status: e.target.value } });
      toast('已更新'); rosterModal(sessionId, c);
    };
    tb.appendChild(tr);
  });
}

/* ================= 学生 ================= */
let stuFilter = '';
async function renderStudents() {
  const students = await api('/api/admin/students' + (stuFilter ? '?grade=' + encodeURIComponent(stuFilter) : ''));
  view.innerHTML = `
    <div class="flex-between">
      <select id="sf" style="width:auto"><option value="">全部年级</option>${GRADES.map((g) => `<option ${g === stuFilter ? 'selected' : ''}>${g}</option>`).join('')}</select>
      <button class="btn sm" id="addStudent">➕ 新增学生</button>
    </div>
    <div class="table-wrap mt"><table><thead><tr><th>姓名</th><th>年级</th><th>家长手机</th><th>报名日期</th><th></th></tr></thead><tbody id="stb"></tbody></table></div>`;
  document.getElementById('sf').onchange = (e) => { stuFilter = e.target.value; renderStudents(); };
  document.getElementById('addStudent').onclick = () => studentModal();
  const tb = document.getElementById('stb');
  tb.innerHTML = students.length ? '' : '<tr><td colspan="5" class="muted">暂无学生</td></tr>';
  students.forEach((s) => {
    const tr = el(`<tr><td>${esc(s.name)}</td><td>${esc(s.grade)}</td><td>${esc(s.guardian_phone || '-')}</td><td>${esc(s.enroll_date || '-')}</td>
      <td class="wrap-actions"><button class="btn sm secondary" data-a="bill">对账</button><button class="btn sm ghost" data-a="edit">编辑</button></td></tr>`);
    tr.querySelector('[data-a=edit]').onclick = () => studentModal(s);
    tr.querySelector('[data-a=bill]').onclick = () => reconcileModal(s);
    tb.appendChild(tr);
  });
}
function studentModal(s = {}) {
  const body = el(`<div>
    <label>姓名</label><input id="s_name" value="${esc(s.name || '')}" />
    <label>年级</label><select id="s_grade">${GRADES.map((g) => `<option ${g === s.grade ? 'selected' : ''}>${g}</option>`).join('')}</select>
    <label>家长手机号（登录账号）</label><input id="s_phone" value="${esc(s.guardian_phone || '')}" />
    <label>报名日期</label><input id="s_date" type="date" value="${s.enroll_date || today}" />
    <label>备注</label><input id="s_note" value="${esc(s.note || '')}" />
    <div class="btn-row mt"><button class="btn" id="saveStu">保存</button></div>
  </div>`);
  const { close } = openModal(s.id ? '编辑学生' : '新增学生', body);
  body.querySelector('#saveStu').onclick = async () => {
    const payload = { id: s.id, name: body.querySelector('#s_name').value.trim(), grade: body.querySelector('#s_grade').value,
      guardian_phone: body.querySelector('#s_phone').value.trim(), enroll_date: body.querySelector('#s_date').value, note: body.querySelector('#s_note').value };
    if (!payload.name) return toast('请填写姓名');
    await api('/api/admin/students', { method: 'POST', body: payload });
    close(); toast('已保存'); renderStudents();
  };
}
async function reconcileModal(s) {
  const r = await api('/api/admin/finance/reconcile/' + s.id);
  const body = el(`<div>
    <div class="card" style="background:#eef2ff">
      <div class="row"><span>累计已收</span><b>${money(r.summary.totalRecv)}</b></div>
      <div class="row"><span>累计应收</span><b>${money(r.summary.totalDue)}</b></div>
      <div class="row"><span>差额</span><b style="color:${r.summary.diff >= 0 ? 'var(--ok)' : 'var(--warn)'}">${money(r.summary.diff)} ${r.summary.diff >= 0 ? '(余)' : '(欠)'}</b></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>科目</th><th>已上</th><th>应收</th><th>已收</th><th>结论</th></tr></thead><tbody>
    ${r.courses.map((c) => `<tr><td>${esc(c.subject)}</td><td>${c.present_count}</td><td>${money(c.due)}</td><td>${money(c.received)}</td>
      <td style="color:${c.diff >= 0 ? 'var(--ok)' : 'var(--warn)'}">${esc(c.status)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="btn-row mt"><button class="btn secondary" id="goRecharge">为该生充值/退款</button></div>
  </div>`);
  openModal(`多退少补 · ${s.name}`, body);
  body.querySelector('#goRecharge').onclick = () => txnModal(s);
}

/* ================= 教师 ================= */
async function renderTeachers() {
  const teachers = await api('/api/admin/teachers');
  cache.teachers = teachers;
  view.innerHTML = `
    <div class="flex-between"><b>教师管理</b><button class="btn sm" id="addT">➕ 新增教师</button></div>
    <div class="table-wrap mt"><table><thead><tr><th>姓名</th><th>擅长科目</th><th>课时费</th><th></th></tr></thead><tbody id="ttb"></tbody></table></div>`;
  document.getElementById('addT').onclick = () => teacherModal();
  const tb = document.getElementById('ttb');
  teachers.forEach((t) => {
    const tr = el(`<tr><td>${esc(t.name)}</td><td>${esc(t.subjects || '-')}</td><td>${money(t.hourly_fee)}/节</td>
      <td><button class="btn sm ghost">编辑</button></td></tr>`);
    tr.querySelector('button').onclick = () => teacherModal(t);
    tb.appendChild(tr);
  });
}
function teacherModal(t = {}) {
  const body = el(`<div>
    <label>姓名</label><input id="t_name" value="${esc(t.name || '')}" />
    <label>联系方式</label><input id="t_phone" value="${esc(t.phone || '')}" />
    <label>擅长科目</label><input id="t_subj" value="${esc(t.subjects || '')}" placeholder="如 数学,物理" />
    <label>单节课时费(元)</label><input id="t_fee" type="number" value="${t.hourly_fee ?? 300}" />
    <div class="btn-row mt"><button class="btn" id="saveT">保存</button></div>
  </div>`);
  const { close } = openModal(t.id ? '编辑教师' : '新增教师', body);
  body.querySelector('#saveT').onclick = async () => {
    const payload = { id: t.id, name: body.querySelector('#t_name').value.trim(), phone: body.querySelector('#t_phone').value,
      subjects: body.querySelector('#t_subj').value, hourly_fee: Number(body.querySelector('#t_fee').value) || 0 };
    if (!payload.name) return toast('请填写姓名');
    await api('/api/admin/teachers', { method: 'POST', body: payload });
    close(); toast('已保存'); await loadRefs(); renderTeachers();
  };
}

/* ================= 财务 ================= */
let finTab = 'txn';
async function renderFinance() {
  view.innerHTML = `
    <div class="seg" id="finSeg">
      <button data-f="txn" class="${finTab === 'txn' ? 'active' : ''}">收退款</button>
      <button data-f="teacher" class="${finTab === 'teacher' ? 'active' : ''}">教师结算</button>
      <button data-f="summary" class="${finTab === 'summary' ? 'active' : ''}">总账/分红</button>
    </div>
    <div id="finBody"></div>`;
  document.getElementById('finSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; finTab = b.dataset.f; renderFinance(); };
  if (finTab === 'txn') return finTxn();
  if (finTab === 'teacher') return finTeacher();
  if (finTab === 'summary') return finSummary();
}

async function finTxn() {
  const box = document.getElementById('finBody');
  const txns = await api('/api/admin/finance/transactions');
  box.innerHTML = `
    <button class="btn" id="newTxn">➕ 收款 / 退款登记</button>
    <div class="table-wrap mt"><table><thead><tr><th>时间</th><th>学生</th><th>科目</th><th>类型</th><th>金额</th><th>方式</th><th>经手</th></tr></thead><tbody>
    ${txns.map((t) => `<tr><td class="small">${esc((t.created_at || '').slice(5, 16))}</td><td>${esc(t.student_name)}</td><td>${esc(t.subject || '整体')}</td>
      <td>${t.type === 'recharge' ? '<span class="badge ok">充值</span>' : '<span class="badge warn">退款</span>'}</td>
      <td>${money(t.amount)}</td><td class="small">${esc(t.method || '-')}</td><td class="small">${esc(t.operator || '-')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">暂无流水</td></tr>'}
    </tbody></table></div>`;
  box.querySelector('#newTxn').onclick = () => txnModal();
}

async function txnModal(preStudent) {
  const students = await api('/api/admin/students');
  const body = el(`<div>
    <label>学生</label><select id="x_stu">${students.map((s) => `<option value="${s.id}" ${preStudent && preStudent.id === s.id ? 'selected' : ''}>${esc(s.name)} (${esc(s.grade)})</option>`).join('')}</select>
    <label>课程（可选，整体充值留空）</label><select id="x_course"><option value="">整体账户</option></select>
    <label>类型</label><select id="x_type"><option value="recharge">充值 / 收款</option><option value="refund">退款</option></select>
    <label>收款方式</label><select id="x_method"><option value="prestore">预存充值</option><option value="package">打包报名(套餐)</option><option value="refund">退款</option></select>
    <div id="pkgBox" class="hidden"><label>套餐总课时（用于折算单价）</label><input id="x_pkg" type="number" placeholder="如 30" /></div>
    <label>金额(元)</label><input id="x_amount" type="number" placeholder="如 3000" />
    <label>经手人</label><input id="x_op" value="admin" />
    <label>备注</label><input id="x_note" />
    <div class="btn-row mt"><button class="btn" id="saveTxn">提交</button></div>
  </div>`);
  const { close } = openModal('收款 / 退款登记', body);
  const stuSel = body.querySelector('#x_stu'), courseSel = body.querySelector('#x_course');
  async function loadCourses() {
    const rows = await api('/api/admin/students'); // ensure list
    const enr = await api('/api/admin/finance/reconcile/' + stuSel.value).catch(() => ({ courses: [] }));
    courseSel.innerHTML = '<option value="">整体账户</option>' + enr.courses.map((c) => `<option value="${c.course_id}">${esc(c.subject)}</option>`).join('');
  }
  loadCourses();
  stuSel.onchange = loadCourses;
  body.querySelector('#x_method').onchange = (e) => body.querySelector('#pkgBox').classList.toggle('hidden', e.target.value !== 'package');
  body.querySelector('#x_type').onchange = (e) => { if (e.target.value === 'refund') { body.querySelector('#x_method').value = 'refund'; } };
  body.querySelector('#saveTxn').onclick = async () => {
    const payload = { student_id: Number(stuSel.value), course_id: courseSel.value ? Number(courseSel.value) : null,
      amount: Number(body.querySelector('#x_amount').value), type: body.querySelector('#x_type').value,
      method: body.querySelector('#x_method').value, operator: body.querySelector('#x_op').value,
      note: body.querySelector('#x_note').value, package_sessions: Number(body.querySelector('#x_pkg').value) || null };
    if (!payload.amount || payload.amount <= 0) return toast('请输入正确金额');
    try { await api('/api/admin/finance/transaction', { method: 'POST', body: payload }); close(); toast('已登记'); if (finTab === 'txn') finTxn(); }
    catch (e) { toast(e.message); }
  };
}

async function finTeacher() {
  const box = document.getElementById('finBody');
  const period = today.slice(0, 7);
  const { rows } = await api('/api/admin/finance/teacher-fees?period=' + period);
  box.innerHTML = `<p class="muted small">结算月份：${period}（按实际有签到的课次计算）</p>
    <div class="table-wrap"><table><thead><tr><th>教师</th><th>课时费</th><th>实际课次</th><th>应付</th><th>状态</th></tr></thead><tbody id="tf"></tbody></table></div>`;
  const tb = box.querySelector('#tf');
  rows.forEach((r) => {
    const tr = el(`<tr><td>${esc(r.name)}</td><td>${money(r.hourly_fee)}</td><td>${r.sessions}</td><td>${money(r.amount)}</td>
      <td>${r.paid ? '<span class="badge ok">已付</span>' : (r.amount > 0 ? '<button class="btn sm">标记已付</button>' : '<span class="muted small">无</span>')}</td></tr>`);
    const btn = tr.querySelector('button');
    if (btn) btn.onclick = async () => {
      await api('/api/admin/finance/teacher-fees/pay', { method: 'POST', body: { teacher_id: r.teacher_id, period, sessions: r.sessions, amount: r.amount } });
      toast('已标记'); finTeacher();
    };
    tb.appendChild(tr);
  });
}

async function finSummary() {
  const box = document.getElementById('finBody');
  const from = today.slice(0, 7) + '-01', to = today;
  box.innerHTML = `
    <div class="flex mt"><input type="date" id="sfrom" value="${from}" /><span>至</span><input type="date" id="sto" value="${to}" /><button class="btn sm" id="q">查询</button></div>
    <div id="sumBody" class="mt"></div>
    <div class="card mt"><div class="flex-between"><b>成本录入（场地/耗材等）</b></div>
      <div class="flex mt"><input id="cn" placeholder="成本名称" style="flex:1" /><input id="ca" type="number" placeholder="金额" style="width:110px" /><button class="btn sm" id="addCost">录入</button></div>
    </div>`;
  const run = async () => {
    const f = box.querySelector('#sfrom').value, t = box.querySelector('#sto').value;
    const d = await api(`/api/admin/finance/summary?from=${f}&to=${t}`);
    box.querySelector('#sumBody').innerHTML = `<div class="card">
      <div class="row"><span>总收入</span><b style="color:var(--ok)">${money(d.income)}</b></div>
      <div class="row"><span>教师课时费</span><span>${money(d.teacherFee)}</span></div>
      <div class="row"><span>其他成本</span><span>${money(d.otherCost)}</span></div>
      <div class="row"><span>总支出</span><b style="color:var(--warn)">${money(d.totalCost)}</b></div>
      <div class="row"><span>可分红金额</span><b style="color:var(--brand);font-size:18px">${money(d.dividable)}</b></div>
    </div>
    <div class="card"><b>分红明细</b>${d.partners.length ? d.partners.map((p) => `<div class="row"><span>${esc(p.name)} (${(p.ratio * 100).toFixed(0)}%)</span><b>${money(p.share)}</b></div>`).join('') : '<div class="muted small mt">未配置负责人，请到「设置」添加</div>'}</div>`;
  };
  box.querySelector('#q').onclick = run; run();
  box.querySelector('#addCost').onclick = async () => {
    const name = box.querySelector('#cn').value.trim(), amount = Number(box.querySelector('#ca').value);
    if (!name || !amount) return toast('请填写成本名称与金额');
    await api('/api/admin/finance/costs', { method: 'POST', body: { name, amount } });
    toast('已录入'); run();
  };
}

/* ================= 日志 ================= */
async function renderLogs() {
  const logs = await api('/api/admin/logs');
  view.innerHTML = `<h2 style="font-size:16px">操作日志</h2>
    <div class="table-wrap"><table><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th></tr></thead><tbody>
    ${logs.map((l) => `<tr><td class="small">${esc((l.created_at || '').slice(5, 16))}</td><td>${esc(l.actor || '-')}</td><td>${esc(l.action)}</td>
      <td class="small">${esc(l.entity)}#${esc(l.entity_id)}</td><td class="small muted">${esc(l.detail || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">暂无日志</td></tr>'}
    </tbody></table></div>`;
}

/* ================= 设置 ================= */
async function renderSettings() {
  const [settings, classrooms, partners] = await Promise.all([
    api('/api/admin/settings'), api('/api/admin/classrooms'), api('/api/admin/partners')
  ]);
  view.innerHTML = `
    <div class="card"><b>业务规则</b>
      <label>旷课是否扣费</label><select id="set_absent"><option value="1" ${settings.absent_charge === '1' ? 'selected' : ''}>扣费（默认）</option><option value="0" ${settings.absent_charge === '0' ? 'selected' : ''}>不扣费</option></select>
      <label>请假需提前小时数</label><input id="set_lead" type="number" value="${settings.leave_lead_hours || 2}" />
      <label>修改管理员密码（留空不改）</label><input id="set_pw" type="password" placeholder="新密码" />
      <div class="btn-row mt"><button class="btn" id="saveSet">保存规则</button></div>
    </div>
    <div class="card"><b>教室管理（4 间可增删）</b>
      <div id="roomList" class="mt"></div>
      <div class="flex mt"><input id="newRoom" placeholder="新教室名称" style="flex:1" /><button class="btn sm" id="addRoom">添加</button></div>
    </div>
    <div class="card"><b>分红负责人比例</b>
      <div id="partnerList" class="mt"></div>
      <div class="flex mt"><input id="pName" placeholder="姓名" style="flex:1" /><input id="pRatio" type="number" step="0.05" placeholder="比例 如 0.5" style="width:120px" /><button class="btn sm" id="addPartner">添加</button></div>
      <p class="small muted mt">提示：各负责人比例之和建议为 1（100%）。</p>
    </div>`;

  document.getElementById('saveSet').onclick = async () => {
    const body = { absent_charge: document.getElementById('set_absent').value, leave_lead_hours: document.getElementById('set_lead').value };
    const pw = document.getElementById('set_pw').value; if (pw) body.admin_password = pw;
    await api('/api/admin/settings', { method: 'POST', body }); toast('已保存');
  };

  const roomList = document.getElementById('roomList');
  roomList.innerHTML = classrooms.map((r) => `<div class="flex-between" style="padding:5px 0"><span>${esc(r.name)}</span><button class="btn sm danger" data-id="${r.id}">删除</button></div>`).join('') || '<span class="muted small">暂无教室</span>';
  roomList.querySelectorAll('button').forEach((b) => b.onclick = async () => { await api('/api/admin/classrooms/' + b.dataset.id, { method: 'DELETE' }); await loadRefs(); renderSettings(); });
  document.getElementById('addRoom').onclick = async () => {
    const name = document.getElementById('newRoom').value.trim(); if (!name) return;
    await api('/api/admin/classrooms', { method: 'POST', body: { name } }); await loadRefs(); renderSettings();
  };

  const pl = document.getElementById('partnerList');
  pl.innerHTML = partners.map((p) => `<div class="flex-between" style="padding:5px 0"><span>${esc(p.name)} · ${(p.ratio * 100).toFixed(0)}%</span><button class="btn sm danger" data-id="${p.id}">删除</button></div>`).join('') || '<span class="muted small">暂无</span>';
  pl.querySelectorAll('button').forEach((b) => b.onclick = async () => { await api('/api/admin/partners/' + b.dataset.id, { method: 'DELETE' }); renderSettings(); });
  document.getElementById('addPartner').onclick = async () => {
    const name = document.getElementById('pName').value.trim(), ratio = Number(document.getElementById('pRatio').value);
    if (!name) return toast('请填写姓名');
    await api('/api/admin/partners', { method: 'POST', body: { name, ratio } }); renderSettings();
  };
}

/* 启动 */
(async () => { await loadRefs(); render('dashboard'); })();
