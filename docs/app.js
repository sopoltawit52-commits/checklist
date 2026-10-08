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
const activeRows = rows => (rows || []).filter(r => r.active !== 'N');
const catDot = name => { const c = (DATA && activeRows(DATA.Categories).find(x => x.name === name)) || null; return c && c.color ? `<i class="dot" style="background:${esc(c.color)}"></i>` : '· '; };

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
  tags.push(t.type === 'daily' ? '<span class="tag daily">ประจำวัน</span>' : t.type === 'backlog' ? '<span class="tag backlog">รายการค้าง</span>' : '<span class="tag">ครั้งเดียว</span>');
  if (t.priority === 'สูง') tags.push('<span class="tag high">สำคัญสูง</span>');
  if (t.owner) tags.push(`<span>👤 ${esc(L.owners(t).join(', '))}</span>`);
  if (t.category) tags.push(`<span>${catDot(t.category)}${esc(t.category)}</span>`);
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
  const owners = ['ทั้งหมด', ...new Set([...d.todo, ...d.completed, ...d.upcoming, ...d.backlog].flatMap(t => L.owners(t).length ? L.owners(t) : ['ไม่ระบุ']))];
  if (!owners.includes(ownerSel)) ownerSel = 'ทั้งหมด';
  $('#ownerFilter').innerHTML = owners.map(o => `<button class="chip ${o === ownerSel ? 'on' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('');
  const f = list => (ownerSel === 'ทั้งหมด' ? list : list.filter(t => (L.owners(t).length ? L.owners(t) : ['ไม่ระบุ']).includes(ownerSel)));
  const todo = f(d.todo), done = f([...d.completed, ...d.backlogDone]), up = f(d.upcoming), bl = f(d.backlog);
  $('#backlogCard').classList.toggle('hidden', !d.backlog.length);
  $('#backlogCount').textContent = `${bl.length} รายการ`;
  $('#backlogList').innerHTML = bl.length ? bl.map(t => taskRow(t, 'todo')).join('') : '<div class="empty">ไม่มีรายการค้างของคนนี้</div>';
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
  if (t.type !== 'daily') await store.update('Tasks', 'id', id, { status: 'done', done_at: `${n.date} ${n.time}` });
}
async function undoDone(id) {
  const { Tasks, Logs } = await refresh();
  const t = Tasks.find(x => x.id === id); if (!t) throw new Error('ไม่พบงาน');
  const log = Logs.find(l => l.task_id === id && L.normDate(l.date) === L.today() && l.void !== 'Y');
  if (log) await store.update('Logs', 'log_id', log.log_id, { void: 'Y' });
  if (t.type !== 'daily') await store.update('Tasks', 'id', id, { status: 'open', done_at: '' });
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
function fillLists() {
  const people = activeRows(DATA.People).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const cats = activeRows(DATA.Categories).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const f = $('#addForm');
  const setOpts = (sel, items, empty, label) => {
    const cur = sel.value;
    sel.innerHTML = `<option value="">${empty}</option>` + items.map(i => `<option value="${esc(i.name)}">${esc(label(i))}</option>`).join('');
    if (cur && ![...sel.options].some(o => o.value === cur)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(cur)}">${esc(cur)} (ไม่อยู่ในรายชื่อ)</option>`);
    sel.value = cur;
  };
  const box = $('#ownerPick');
  const sel = new Set([...box.querySelectorAll('input:checked')].map(i => i.value));
  const extra = [...sel].filter(n => !people.some(p => p.name === n));
  box.innerHTML = people.length || extra.length
    ? [...people.map(p => ({ name: p.name, label: p.position ? `${p.name} (${p.position})` : p.name })), ...extra.map(n => ({ name: n, label: n + ' (ไม่อยู่ในรายชื่อ)' }))]
        .map(p => `<label><input type="checkbox" name="owner_pick" value="${esc(p.name)}" ${sel.has(p.name) ? 'checked' : ''}>${esc(p.label)}</label>`).join('')
    : '<span class="muted">ยังไม่มีรายชื่อ — กด "จัดการรายชื่อ" เพื่อเพิ่ม</span>';
  setOpts(f.elements['category'], cats, cats.length ? '— เลือกกลุ่มงาน —' : '— ยังไม่มีกลุ่มงาน (เพิ่มที่ ข้อมูลหลัก) —', c => c.name);
}
async function loadAdd() { await refresh(); fillLists(); }
function resetForm() {
  const f = $('#addForm'); f.reset(); f.elements['task_id'].value = '';
  $('#formTitle').textContent = '➕ เพิ่มรายการงาน'; $('#saveBtn').textContent = 'บันทึกงาน';
  $('#cancelEdit').classList.add('hidden'); applyType('once');
  $('#ownerPick').querySelectorAll('input').forEach(i => (i.checked = false));
  f.elements['due_date'].value = L.today();
}
function editTask(id) {
  const t = DATA.Tasks.find(x => x.id === id); if (!t) return;
  show('add', true);
  const f = $('#addForm');
  fillLists();
  { const sel = f.elements['category'], v = t.category; if (v && ![...sel.options].some(o => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`); }
  const box = $('#ownerPick'), want = L.owners(t);
  for (const n of want) if (![...box.querySelectorAll('input')].some(i => i.value === n)) box.insertAdjacentHTML('beforeend', `<label><input type="checkbox" name="owner_pick" value="${esc(n)}">${esc(n)}</label>`);
  box.querySelectorAll('input').forEach(i => (i.checked = want.includes(i.value)));
  f.elements['task_id'].value = t.id; f.elements['title'].value = t.title; f.elements['category'].value = t.category; f.elements['priority'].value = t.priority || 'กลาง';
  const ty = ['daily', 'backlog'].includes(t.type) ? t.type : 'once';
  f.querySelector(`[name=type][value=${ty}]`).checked = true;
  f.elements['due_date'].value = L.normDate(t.due_date); f.elements['time'].value = L.normTime(t.time); f.elements['remind_before'].value = t.remind_before || '30'; f.elements['note'].value = t.note;
  applyType(ty);
  $('#formTitle').textContent = '✏️ แก้ไขงาน'; $('#saveBtn').textContent = 'บันทึกการแก้ไข'; $('#cancelEdit').classList.remove('hidden');
}
$('#cancelEdit').onclick = () => { resetForm(); show('manage'); };
function applyType(ty) {
  $('#dueWrap').classList.toggle('hidden', ty !== 'once');
  $('#timeWrap').classList.toggle('hidden', ty === 'backlog');
  $('#remindWrap').classList.toggle('hidden', ty === 'backlog');
}
$('#addForm').addEventListener('change', e => { if (e.target.name === 'type') applyType(e.target.value); });
$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  fd.owner = [...e.target.querySelectorAll('[name=owner_pick]:checked')].map(i => i.value).join(', ');
  const btn = $('#saveBtn'); btn.disabled = true;
  const data = {
    title: fd.title.trim(), owner: (fd.owner || '').trim(), category: (fd.category || '').trim(), priority: fd.priority,
    type: fd.type, due_date: fd.type === 'once' ? fd.due_date : '', time: fd.type === 'backlog' ? '' : (fd.time || ''), remind_before: fd.type !== 'backlog' && fd.time ? fd.remind_before : '', note: fd.note || '',
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
  const list = Tasks.filter(t => (t.status || 'open') === mStatus)
    .sort((a, b) => ({ daily: 0, once: 1, backlog: 2 }[a.type] ?? 1) - ({ daily: 0, once: 1, backlog: 2 }[b.type] ?? 1) || String(L.normDate(a.due_date) || '9').localeCompare(String(L.normDate(b.due_date) || '9')) || L.normTime(a.time).localeCompare(L.normTime(b.time)));
  $('#mBody').innerHTML = list.length ? list.map(t => `<tr><td><b>${esc(t.title)}</b><div class="meta"><span class="tag ${t.type === 'once' ? '' : t.type}">${L.TYPE_LABEL[t.type] || 'ครั้งเดียว'}</span>${t.time ? `<span class="tag time">🕐 ${esc(L.normTime(t.time))}</span>` : ''}${t.owner ? `<span>👤 ${esc(L.owners(t).join(', '))}</span>` : ''}${t.due_date ? `<span>กำหนด ${fmtDue(t.due_date)}</span>` : ''}${t.done_at ? `<span>เสร็จ ${fmtDue(t.done_at)}</span>` : ''}</div></td>
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


// ---------------------------------------------------------------- ข้อมูลหลัก (รายชื่อ / กลุ่มงาน)
const MASTER = {
  p: { tab: 'People', field: 'owner', form: '#pForm', body: '#pBody', count: '#pCount', label: 'รายชื่อ', idp: 'P' },
  c: { tab: 'Categories', field: 'category', form: '#cForm', body: '#cBody', count: '#cCount', label: 'กลุ่มงาน', idp: 'C' },
};
const hasVal = (t, field, name) => field === 'owner' ? L.owners(t).includes(name) : t[field] === name;
const usage = (field, name) => DATA.Tasks.filter(t => hasVal(t, field, name) && t.status !== 'cancel').length;
async function loadMaster() {
  await refresh();
  for (const k of ['p', 'c']) {
    const m = MASTER[k];
    const rows = activeRows(DATA[m.tab]).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    $(m.count).textContent = `${rows.length} รายการ`;
    $(m.body).innerHTML = rows.length ? rows.map(r => `<tr><td>${k === 'c' ? `<i class="dot" style="background:${esc(r.color || '#999')}"></i>` : '👤 '}<b>${esc(r.name)}</b>
      <div class="meta">${k === 'p' ? `${r.position ? `<span>${esc(r.position)}</span>` : ''}${r.phone ? `<span>📞 ${esc(r.phone)}</span>` : ''}` : (r.note ? `<span>${esc(r.note)}</span>` : '')}<span class="muted">ใช้ในงาน ${usage(m.field, r.name)} รายการ</span></div></td>
      <td><button class="btn ghost sm" data-medit="${k}:${r.id}">แก้ไข</button> <button class="btn danger sm" data-mdel="${k}:${r.id}">ลบ</button></td></tr>`).join('')
      : `<tr><td class="empty">ยังไม่มี${m.label} — กรอกด้านบนแล้วกด "เพิ่ม"</td></tr>`;
    const names = new Set((DATA[m.tab] || []).map(r => r.name));
    const fromTasks = [...new Set(DATA.Tasks.flatMap(t => (m.field === 'owner' ? L.owners(t) : [t[m.field]])).filter(v => v && !names.has(v)))];
    $(k === 'p' ? '#importPeople' : '#importCats').classList.toggle('hidden', !fromTasks.length);
  }
  const del = ['p', 'c'].flatMap(k => (DATA[MASTER[k].tab] || []).filter(r => r.active === 'N').map(r => ({ k, r })));
  $('#deletedList').innerHTML = del.length ? del.map(({ k, r }) => `<div class="task"><div class="body">${k === 'p' ? '👤' : '🏷️'} ${esc(r.name)}</div><button class="btn ghost sm" data-mrestore="${k}:${r.id}">กู้คืน</button></div>`).join('') : '<div class="empty">ไม่มี</div>';
}
function resetMasterForm(k) {
  const f = $(MASTER[k].form); f.reset(); f.elements['rid'].value = '';
  f.querySelector('[type=submit]').textContent = 'เพิ่ม';
  f.querySelector(`[data-cancel=${k}]`).classList.add('hidden');
}
for (const k of ['p', 'c']) {
  $(MASTER[k].form).addEventListener('submit', async e => {
    e.preventDefault();
    const m = MASTER[k], f = e.target, fd = Object.fromEntries(new FormData(f));
    const name = (fd.name || '').trim();
    if (!name) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await refresh();
      const dup = activeRows(DATA[m.tab]).find(r => r.name === name && r.id !== fd.rid);
      if (dup) throw new Error(`มี "${name}" อยู่แล้ว`);
      const data = k === 'p' ? { name, position: (fd.position || '').trim(), phone: (fd.phone || '').trim() } : { name, note: (fd.note || '').trim(), color: fd.color };
      if (fd.rid) {
        const oldName = (DATA[m.tab].find(r => r.id === fd.rid) || {}).name;
        const affected = oldName && oldName !== name ? DATA.Tasks.filter(t => hasVal(t, m.field, oldName)) : [];
        await store.update(m.tab, 'id', fd.rid, data);
        if (affected.length) {
          if (confirm(`เปลี่ยนชื่อในงานที่ใช้ "${oldName}" อยู่ ${affected.length} รายการ เป็น "${name}" ด้วยไหม?`))
            for (const t of affected) await store.update('Tasks', 'id', t.id, { [m.field]: m.field === 'owner' ? L.owners(t).map(x => (x === oldName ? name : x)).join(', ') : name });
        }
        toast('✔ บันทึกการแก้ไขแล้ว');
      } else {
        const n = L.nowParts();
        await store.append(m.tab, { id: L.newId(m.idp), ...data, active: 'Y', created_at: `${n.date} ${n.time}` });
        toast(`✔ เพิ่ม${m.label}แล้ว`);
      }
      resetMasterForm(k); await loadMaster();
    } catch (err) { toast('ผิดพลาด: ' + err.message); }
    btn.disabled = false;
  });
}
async function importFromTasks(k) {
  const m = MASTER[k];
  await refresh();
  const names = new Set((DATA[m.tab] || []).map(r => r.name));
  const list = [...new Set(DATA.Tasks.flatMap(t => (m.field === 'owner' ? L.owners(t) : [t[m.field]])).filter(v => v && !names.has(v)))];
  if (!list.length || !confirm(`นำเข้า ${list.length} รายการ: ${list.join(', ')} ?`)) return;
  const n = L.nowParts(), COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
  for (const [i, name] of list.entries())
    await store.append(m.tab, k === 'p' ? { id: L.newId('P'), name, position: '', phone: '', note: '', active: 'Y', created_at: `${n.date} ${n.time}` }
      : { id: L.newId('C'), name, color: COLORS[i % COLORS.length], note: '', active: 'Y', created_at: `${n.date} ${n.time}` });
  toast(`✔ นำเข้า ${list.length} รายการแล้ว`); loadMaster();
}
$('#importPeople').onclick = () => importFromTasks('p').catch(e => toast(e.message));
$('#importCats').onclick = () => importFromTasks('c').catch(e => toast(e.message));
document.addEventListener('click', async e => {
  const go = e.target.closest('[data-goto]'); if (go) { e.preventDefault(); show(go.dataset.goto); return; }
  const cn = e.target.closest('[data-cancel]'); if (cn) { resetMasterForm(cn.dataset.cancel); return; }
  const ed = e.target.closest('[data-medit]');
  if (ed) {
    const [k, id] = ed.dataset.medit.split(':'), m = MASTER[k], r = DATA[m.tab].find(x => x.id === id), f = $(m.form);
    f.elements['rid'].value = r.id; f.elements['name'].value = r.name;
    if (k === 'p') { f.elements['position'].value = r.position || ''; f.elements['phone'].value = r.phone || ''; }
    else { f.elements['note'].value = r.note || ''; f.elements['color'].value = r.color || '#2563eb'; }
    f.querySelector('[type=submit]').textContent = 'บันทึก';
    f.querySelector(`[data-cancel=${k}]`).classList.remove('hidden');
    f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.elements['name'].focus();
    return;
  }
  const dl = e.target.closest('[data-mdel]');
  if (dl) {
    const [k, id] = dl.dataset.mdel.split(':'), m = MASTER[k], r = DATA[m.tab].find(x => x.id === id);
    const used = usage(m.field, r.name);
    if (!confirm(`ลบ "${r.name}"?${used ? `\n(มีงานที่ใช้อยู่ ${used} รายการ — งานเดิมยังคงชื่อนี้ไว้)` : ''}\nกู้คืนได้ที่ "แสดงรายการที่ลบแล้ว"`)) return;
    try { await store.update(m.tab, 'id', id, { active: 'N' }); toast('ลบแล้ว'); loadMaster(); } catch (err) { toast(err.message); }
    return;
  }
  const rs = e.target.closest('[data-mrestore]');
  if (rs) {
    const [k, id] = rs.dataset.mrestore.split(':');
    try { await store.update(MASTER[k].tab, 'id', id, { active: 'Y' }); toast('กู้คืนแล้ว'); loadMaster(); } catch (err) { toast(err.message); }
  }
});

// ---------------------------------------------------------------- ทั่วไป
function askName() { const n = prompt('ชื่อของคุณ (ใช้บันทึกว่าใครเป็นคนทำงาน)', ME); if (n !== null) { ME = n.trim(); ls.set('me', ME); $('#meName').textContent = ME || 'ตั้งชื่อ'; } }
$('#meBtn').onclick = askName; $('#meName').textContent = ME || 'ตั้งชื่อ';
const views = { today: loadToday, history: loadHistory, add: loadAdd, manage: loadManage, master: loadMaster };
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
