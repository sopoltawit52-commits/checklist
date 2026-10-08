// หน้าเว็บเช็คลิสต์ — ทำงานในเบราว์เซอร์ทั้งหมด (GitHub Pages)
const CFG = window.APP_CONFIG || {};
const TARGET = +CFG.TARGET || 80;
L.setWorkDays(CFG.WORK_DAYS || '1-6');
const store = createBrowserStore(CFG);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let ME = ls.get('me') || '', ownerSel = 'ทั้งหมด', histDays = 14, mStatus = 'open', DATA = null, inited = false;
document.querySelectorAll('.tgt').forEach(e => (e.textContent = TARGET));
$('#appName').textContent = CFG.APP_NAME || 'เช็คลิสต์งานทีม';
document.title = CFG.APP_NAME || document.title;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400); }
const colorFor = p => (p >= TARGET ? 'var(--brand)' : p >= 50 ? 'var(--warn)' : 'var(--bad)');
const thDate = (d, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(d + 'T00:00:00').toLocaleDateString('th-TH', o);
const fmtDue = d => (d ? thDate(L.normDate(d), { day: 'numeric', month: 'short' }) : '');
const nowMin = () => L.toMin(L.nowParts().time);

async function refresh() {
  if (!inited) { await store.init(); inited = true; }
  DATA = await store.loadAll();
  return DATA;
}

function ring(p) {
  const r = 58, c = 2 * Math.PI * r, off = c * (1 - p / 100);
  return `<svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="KPI ${p}%">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--bg)" stroke-width="14"/>
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="${colorFor(p)}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset .5s"/>
    <text x="70" y="70" text-anchor="middle" font-size="30" font-weight="700" fill="var(--ink)">${p}%</text>
    <text x="70" y="94" text-anchor="middle" font-size="12" fill="var(--muted)">สำเร็จ</text></svg>`;
}

function taskRow(t, mode) {
  const tags = [];
  if (t.time) tags.push(`<span class="tag time">🕐 ${esc(t.time)}${t.remind_before && t.remind_before !== 'none' ? ' 🔔' : ''}</span>`);
  if (t.overdue) tags.push(`<span class="tag over">เกินกำหนด ${fmtDue(t.due_date)}</span>`);
  else if (t.type === 'once' && t.due_date) tags.push(`<span class="tag">${t.today ? 'วันนี้' : 'กำหนด ' + fmtDue(t.due_date)}</span>`);
  tags.push(t.type === 'daily' ? '<span class="tag daily">ประจำวัน</span>' : '<span class="tag">ครั้งเดียว</span>');
  if (t.priority === 'สูง') tags.push('<span class="tag high">สำคัญสูง</span>');
  if (t.owner) tags.push(`<span>👤 ${esc(t.owner)}</span>`);
  if (t.category) tags.push(`<span>· ${esc(t.category)}</span>`);
  if (mode === 'done') tags.push(`<span class="tag ok">✓ ${esc(t.done_time || '')}${t.done_by ? ' โดย ' + esc(t.done_by) : ''}</span>`);
  const cb = mode === 'up' ? '' : `<button class="cb" aria-label="${mode === 'done' ? 'ยกเลิกเสร็จ' : 'ทำเสร็จ'}" data-id="${t.id}" data-act="${mode === 'done' ? 'undo' : 'done'}"></button>`;
  return `<div class="task ${mode === 'done' ? 'done' : ''}">${cb}<div class="body"><div class="title">${esc(t.title)}</div><div class="meta">${tags.join('')}</div>${t.note ? `<div class="meta">📝 ${esc(t.note)}</div>` : ''}</div></div>`;
}

// ---------------------------------------------------------------- วันนี้
async function loadToday() {
  const { Tasks, Logs } = await refresh();
  const d = L.buildDay(Tasks, Logs, L.today());
  $('#todayLabel').textContent = thDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#ring').innerHTML = ring(d.pct);
  $('#sPlan').textContent = d.planned; $('#sDone').textContent = d.done; $('#sLeft').textContent = d.remaining; $('#sOver').textContent = d.overdue;

  // นัดหมายวันนี้ (งานที่มีเวลา)
  const appts = [...d.todo, ...d.completed].filter(t => t.time && t.today).sort((a, b) => a.time.localeCompare(b.time));
  $('#apptCard').classList.toggle('hidden', !appts.length);
  $('#apptCount').textContent = `${appts.length} รายการ`;
  const nm = nowMin();
  $('#apptList').innerHTML = appts.map(t => {
    const diff = L.toMin(t.time) - nm;
    const st = t.done ? 'done' : diff < 0 ? 'past' : '';
    const sub = t.done ? 'เสร็จแล้ว' : diff < 0 ? 'เลยเวลา' : diff < 60 ? `อีก ${diff} นาที` : `อีก ${Math.floor(diff / 60)} ชม.`;
    return `<div class="appt ${st}"><div class="clock">${esc(t.time)}<small>${sub}</small></div><div class="body"><div class="title">${esc(t.title)}</div><div class="meta">${t.owner ? `<span>👤 ${esc(t.owner)}</span>` : ''}${t.remind_before && t.remind_before !== 'none' ? `<span>🔔 เตือน ${t.remind_before === '0' ? 'ตรงเวลา' : t.remind_before + ' นาทีก่อน'}</span>` : ''}${t.note ? `<span>📝 ${esc(t.note)}</span>` : ''}</div></div></div>`;
  }).join('');

  $('#ownerCard').classList.toggle('hidden', !d.byOwner.length);
  $('#owners').innerHTML = d.byOwner.map(o => `<div class="owner"><span>${esc(o.owner)}</span><div class="track"><div class="fill" style="width:${o.pct}%;background:${colorFor(o.pct)}"></div></div><span class="num">${o.done}/${o.planned} · ${o.pct}%</span></div>`).join('');
  const owners = ['ทั้งหมด', ...new Set([...d.todo, ...d.completed, ...d.upcoming].map(t => t.owner || 'ไม่ระบุ'))];
  if (!owners.includes(ownerSel)) ownerSel = 'ทั้งหมด';
  $('#ownerFilter').innerHTML = owners.map(o => `<button class="chip ${o === ownerSel ? 'on' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('');
  const f = list => (ownerSel === 'ทั้งหมด' ? list : list.filter(t => (t.owner || 'ไม่ระบุ') === ownerSel));
  const todo = f(d.todo), done = f(d.completed), up = f(d.upcoming);
  $('#leftCount').textContent = `${todo.length} รายการ`;
  $('#doneCount').textContent = `${done.length} รายการ`;
  $('#todoList').innerHTML = todo.length ? todo.map(t => taskRow(t, 'todo')).join('') : '<div class="empty">🎉 ไม่มีงานค้าง</div>';
  $('#doneList').innerHTML = done.length ? done.map(t => taskRow(t, 'done')).join('') : '<div class="empty">ยังไม่มีงานที่ทำเสร็จวันนี้</div>';
  $('#upWrap').classList.toggle('hidden', !up.length); $('#upCount').textContent = up.length;
  $('#upList').innerHTML = up.map(t => taskRow(t, 'up')).join('');
}

async function markDone(id) {
  const { Tasks, Logs } = await refresh();
  const t = Tasks.find(x => x.id === id); if (!t) throw new Error('ไม่พบงาน');
  const n = L.nowParts();
  if (Logs.some(l => l.task_id === id && L.normDate(l.date) === n.date && l.void !== 'Y')) return;
  await store.append('Logs', { log_id: L.newId('L'), date: n.date, time: n.time.slice(0, 5), task_id: id, title: t.title, owner: t.owner, done_by: ME, type: t.type, note: '', void: '' });
  if (t.type === 'once') await store.update('Tasks', 'id', id, { status: 'done', done_at: `${n.date} ${n.time}` });
}
async function undoDone(id) {
  const { Tasks, Logs } = await refresh();
  const t = Tasks.find(x => x.id === id); if (!t) throw new Error('ไม่พบงาน');
  const log = Logs.find(l => l.task_id === id && L.normDate(l.date) === L.today() && l.void !== 'Y');
  if (log) await store.update('Logs', 'log_id', log.log_id, { void: 'Y' });
  if (t.type === 'once') await store.update('Tasks', 'id', id, { status: 'open', done_at: '' });
}

// ---------------------------------------------------------------- ประวัติ
async function loadHistory() {
  const { Tasks, Logs, Snapshots } = await refresh();
  const to = L.today(), from = L.addDays(to, -histDays + 1);
  const h = L.buildHistory(Tasks, Logs, Snapshots, from, to);
  const days = [...h.days].reverse();
  $('#hAvg').textContent = h.avgPct + '%'; $('#hDone').textContent = h.totalDone;
  $('#hHit').textContent = `${days.filter(d => d.planned && d.pct >= TARGET).length}/${days.filter(d => d.planned).length}`;
  const showLbl = days.length <= 31;
  $('#hBars').innerHTML = `<div class="target" style="bottom:${TARGET}%"><em>เป้า ${TARGET}%</em></div>` + days.map(d =>
    `<div class="b" title="${thDate(d.date)}: ${d.done}/${d.planned} (${d.pct}%)">${showLbl && d.planned ? `<small>${d.pct}</small>` : ''}<i style="height:${d.planned ? Math.max(d.pct, 2) : 0}%;background:${colorFor(d.pct)}"></i></div>`).join('');
  const step = Math.ceil(days.length / 15);
  $('#hX').innerHTML = days.map((d, i) => `<span>${i % step === 0 ? new Date(d.date + 'T00:00:00').getDate() : ''}</span>`).join('');
  $('#hDays').innerHTML = h.days.map(d => `<div class="day"><div class="hd"><b>${thDate(d.date, { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })}</b>
    <span class="tag ${d.pct >= TARGET ? 'ok' : d.planned ? 'high' : ''}">${d.planned ? `${d.done}/${d.planned} · ${d.pct}%` : 'ไม่มีแผน'}</span><span style="color:var(--muted);font-size:13px">${d.items.length} งาน ▾</span></div>
    <ul class="hidden">${d.items.length ? d.items.map(i => `<li><span class="t">${esc(i.time)}</span>${esc(i.title)} <span style="color:var(--muted)">— ${esc(i.done_by || i.owner || '-')}</span></li>`).join('') : '<li style="color:var(--muted)">ไม่มีรายการ</li>'}</ul></div>`).join('');
}

// ---------------------------------------------------------------- เพิ่ม / แก้ไข
function fillLists(Tasks) {
  $('#ownerList').innerHTML = [...new Set(Tasks.map(t => t.owner).filter(Boolean))].map(o => `<option value="${esc(o)}">`).join('');
  $('#catList').innerHTML = [...new Set(Tasks.map(t => t.category).filter(Boolean))].map(o => `<option value="${esc(o)}">`).join('');
}
async function loadAdd() { fillLists((await refresh()).Tasks); }
function resetForm() {
  const f = $('#addForm'); f.reset(); f.elements['task_id'].value = '';
  $('#formTitle').textContent = '➕ เพิ่มรายการงาน'; $('#saveBtn').textContent = 'บันทึกงาน';
  $('#cancelEdit').classList.add('hidden'); $('#dueWrap').classList.remove('hidden');
  f.elements['due_date'].value = L.today();
}
function editTask(id) {
  const t = DATA.Tasks.find(x => x.id === id); if (!t) return;
  show('add', true);
  const f = $('#addForm');
  f.elements['task_id'].value = t.id; f.elements['title'].value = t.title; f.elements['owner'].value = t.owner; f.elements['category'].value = t.category; f.elements['priority'].value = t.priority || 'กลาง';
  f.querySelector(`[name=type][value=${t.type === 'daily' ? 'daily' : 'once'}]`).checked = true;
  f.elements['due_date'].value = L.normDate(t.due_date); f.elements['time'].value = L.normTime(t.time); f.elements['remind_before'].value = t.remind_before || '30'; f.elements['note'].value = t.note;
  $('#dueWrap').classList.toggle('hidden', t.type === 'daily');
  $('#formTitle').textContent = '✏️ แก้ไขงาน'; $('#saveBtn').textContent = 'บันทึกการแก้ไข'; $('#cancelEdit').classList.remove('hidden');
}
$('#cancelEdit').onclick = () => { resetForm(); show('manage'); };
$('#addForm').addEventListener('change', e => { if (e.target.name === 'type') $('#dueWrap').classList.toggle('hidden', e.target.value === 'daily'); });
$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  const btn = $('#saveBtn'); btn.disabled = true;
  const data = {
    title: fd.title.trim(), owner: (fd.owner || '').trim(), category: (fd.category || '').trim(), priority: fd.priority,
    type: fd.type, due_date: fd.type === 'daily' ? '' : fd.due_date, time: fd.time || '', remind_before: fd.time ? fd.remind_before : '', note: fd.note || '',
  };
  try {
    if (fd.task_id) {
      const old = DATA.Tasks.find(x => x.id === fd.task_id);
      const changedTime = old && (L.normDate(old.due_date) !== data.due_date || L.normTime(old.time) !== data.time || old.remind_before !== data.remind_before);
      await store.update('Tasks', 'id', fd.task_id, { ...data, ...(changedTime ? { reminded: '' } : {}) });
      toast('✔ บันทึกการแก้ไขแล้ว'); resetForm(); show('manage');
    } else {
      const n = L.nowParts();
      await store.append('Tasks', { id: L.newId('T'), ...data, status: 'open', created_at: `${n.date} ${n.time}`, created_by: ME, done_at: '', reminded: '' });
      toast('✔ เพิ่มงานแล้ว'); resetForm(); loadAdd();
    }
  } catch (err) { toast('ผิดพลาด: ' + err.message); }
  btn.disabled = false;
});

// ---------------------------------------------------------------- จัดการ
async function loadManage() {
  const { Tasks, Logs } = await refresh();
  fillLists(Tasks);
  const list = Tasks.filter(t => (t.status || 'open') === mStatus)
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'daily' ? -1 : 1) || String(L.normDate(a.due_date) || '9').localeCompare(String(L.normDate(b.due_date) || '9')) || L.normTime(a.time).localeCompare(L.normTime(b.time)));
  $('#mBody').innerHTML = list.length ? list.map(t => `<tr><td><b>${esc(t.title)}</b><div class="meta"><span class="tag ${t.type === 'daily' ? 'daily' : ''}">${t.type === 'daily' ? 'ประจำวัน' : 'ครั้งเดียว'}</span>${t.time ? `<span class="tag time">🕐 ${esc(L.normTime(t.time))}</span>` : ''}${t.owner ? `<span>👤 ${esc(t.owner)}</span>` : ''}${t.due_date ? `<span>กำหนด ${fmtDue(t.due_date)}</span>` : ''}${t.done_at ? `<span>เสร็จ ${fmtDue(t.done_at)}</span>` : ''}</div></td>
    <td><button class="btn ghost sm" data-edit="${t.id}">แก้ไข</button> ${mStatus === 'open' ? `<button class="btn danger sm" data-ms="cancel" data-id="${t.id}">ยกเลิก</button>` : `<button class="btn ghost sm" data-ms="open" data-id="${t.id}">เปิดใหม่</button>`}</td></tr>`).join('') : '<tr><td class="empty">ไม่มีรายการ</td></tr>';
  $('#preview').textContent = L.morningMessage(Tasks, Logs, location.href.split('#')[0], { includeDaily: false });
}

// ---------------------------------------------------------------- คลิก
document.addEventListener('click', async e => {
  const cb = e.target.closest('.cb');
  if (cb) {
    cb.disabled = true;
    if (cb.dataset.act === 'done' && !ME) askName();
    try { if (cb.dataset.act === 'done') await markDone(cb.dataset.id); else await undoDone(cb.dataset.id); toast(cb.dataset.act === 'done' ? '✔ บันทึกงานเสร็จแล้ว' : 'ยกเลิกสถานะเสร็จแล้ว'); await loadToday(); }
    catch (err) { toast('ผิดพลาด: ' + err.message); cb.disabled = false; }
    return;
  }
  const chip = e.target.closest('#ownerFilter .chip'); if (chip) { ownerSel = chip.dataset.o; loadToday(); }
  const rc = e.target.closest('#rangeChips .chip'); if (rc) { histDays = +rc.dataset.d; document.querySelectorAll('#rangeChips .chip').forEach(c => c.classList.toggle('on', c === rc)); loadHistory(); }
  const mc = e.target.closest('#mFilter .chip'); if (mc) { mStatus = mc.dataset.s; document.querySelectorAll('#mFilter .chip').forEach(c => c.classList.toggle('on', c === mc)); loadManage(); }
  const hd = e.target.closest('.day .hd'); if (hd) hd.parentElement.querySelector('ul')?.classList.toggle('hidden');
  const ed = e.target.closest('[data-edit]'); if (ed) editTask(ed.dataset.edit);
  const ms = e.target.closest('[data-ms]');
  if (ms) {
    if (ms.dataset.ms === 'cancel' && !confirm('ยกเลิกงานนี้? (ประวัติเดิมยังอยู่ เปิดใหม่ได้)')) return;
    try { await store.update('Tasks', 'id', ms.dataset.id, { status: ms.dataset.ms, ...(ms.dataset.ms === 'open' ? { done_at: '' } : {}) }); toast('อัปเดตแล้ว'); loadManage(); } catch (err) { toast(err.message); }
  }
});

// ---------------------------------------------------------------- ทั่วไป
function askName() { const n = prompt('ชื่อของคุณ (ใช้บันทึกว่าใครเป็นคนทำงาน)', ME); if (n !== null) { ME = n.trim(); ls.set('me', ME); $('#meName').textContent = ME || 'ตั้งชื่อ'; } }
$('#meBtn').onclick = askName; $('#meName').textContent = ME || 'ตั้งชื่อ';
const views = { today: loadToday, history: loadHistory, add: loadAdd, manage: loadManage };
function show(v, keepForm) {
  if (!store.signedIn) return showSignin();
  if (v === 'add' && !keepForm) resetForm();
  $('#nav').classList.remove('hidden');
  document.querySelectorAll('main>section').forEach(s => s.classList.toggle('hidden', s.id !== 'v-' + v));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  ls.set('view', v);
  views[v]().catch(err => { toast('โหลดไม่สำเร็จ: ' + err.message); if (!store.signedIn) showSignin(); });
}
function showSignin() {
  document.querySelectorAll('main>section').forEach(s => s.classList.toggle('hidden', s.id !== 'v-signin'));
  $('#nav').classList.add('hidden');
}
$('#signinBtn').onclick = async () => {
  $('#signinErr').textContent = '';
  try { await store.signIn('consent'); show(ls.get('view') || 'today'); } catch (err) { $('#signinErr').textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + err.message; }
};
document.querySelectorAll('nav button').forEach(b => (b.onclick = () => show(b.dataset.v)));
$('#demoBanner').classList.toggle('hidden', !store.demo);
show(ls.get('view') || 'today');
setInterval(() => { if (!$('#v-today').classList.contains('hidden') && store.signedIn) loadToday().catch(() => {}); }, 60000);
