// หน้าเว็บเช็คลิสต์ — ทำงานในเบราว์เซอร์ทั้งหมด (GitHub Pages)
const CFG = window.APP_CONFIG || {};
const TARGET = +CFG.TARGET || 80;
L.setWorkDays(CFG.WORK_DAYS || '1-6');
const store = createBrowserStore(CFG);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
let ME = ls.get('me') || '', ownerSel = 'ทั้งหมด', histDays = 14, gFilter = 'active', gType = 'all', gRange = 31, gOwner = 'ทั้งหมด', mStatus = 'open', DATA = null, inited = false;
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

// ---------------------------------------------------------------- โหลดข้อมูล: แสดงของที่มีทันที แล้วอัปเดตเบื้องหลัง
const CACHE_KEY = 'data-cache-v1', STALE_MS = 15000;
let loadedAt = 0, inflight = null, curView = '', syncErr = '';
function setSync() {
  const el = $('#sync'); if (!el) return;
  if (inflight) { el.textContent = '⟳ กำลังอัปเดต…'; el.className = 'sync'; }
  else if (syncErr) { el.textContent = '⚠ ' + syncErr; el.className = 'sync err'; el.title = 'กดเพื่อลองใหม่'; }
  else el.className = 'sync hidden';
}
function setData(d) {
  DATA = d; loadedAt = Date.now(); syncErr = '';
  if (!store.demo) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {} }
  setSync();
}
if (!store.demo) { try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.Tasks) DATA = c; } catch {} }
function fetchData(fresh) {
  if (!inflight) {
    inflight = (async () => {
      if (!inited) { await store.init(); inited = true; }
      const d = await store.loadAll(fresh);
      setData(d); return d;
    })().catch(e => { syncErr = DATA ? 'เชื่อมต่อไม่ได้ — แสดงข้อมูลล่าสุดที่มี' : ''; throw e; })
      .finally(() => { inflight = null; setSync(); });
    setSync();
  }
  return inflight;
}
function rerender() { if (curView && curView !== 'add' && views[curView]) views[curView]().catch(() => {}); }
async function refresh(force) {
  if (DATA && !force) {
    if (Date.now() - loadedAt > STALE_MS) fetchData().then(rerender).catch(() => {});
    return DATA;
  }
  return fetchData(force === 'fresh');
}
// เขียนหลายคำสั่งในครั้งเดียว แล้วใช้ข้อมูลล่าสุดที่เซิร์ฟเวอร์ส่งกลับ (ไม่ต้องโหลดซ้ำ)
// แสดงผลทันที (แก้ข้อมูลในเครื่องก่อน) แล้วค่อยบันทึกจริง — ถ้าบันทึกไม่สำเร็จจะโหลดข้อมูลจริงกลับมา
function applyLocal(ops) {
  if (!DATA) return;
  const D = { ...DATA };
  for (const o of ops) {
    const rows = D[o.tab] = [...(D[o.tab] || [])];
    if (o.action === 'append') { const k = Object.keys(o.obj)[0]; if (!rows.some(r => r[k] === o.obj[k])) rows.push({ ...o.obj }); }
    else { const i = rows.findIndex(r => String(r[o.keyField]) === String(o.key)); if (i >= 0) rows[i] = { ...rows[i], ...o.patch }; }
  }
  DATA = D; loadedAt = Date.now();
}
async function write(ops) {
  if (store.canEdit === false && !(await store.askPin())) throw new Error('ต้องใส่ PIN ก่อนแก้ไข');
  const before = DATA;
  applyLocal(ops); rerender();
  setSyncBusy(true);
  try {
    store.lastData = null;
    const row = await store.batch(ops);
    if (store.lastData) setData(store.lastData); else await fetchData(true).catch(() => {});
    return row;
  } catch (e) { DATA = before; fetchData(true).then(rerender).catch(() => {}); rerender(); throw e; }
  finally { setSyncBusy(false); }
}
function setSyncBusy(b) { const el = $('#sync'); if (!el) return; if (b) { el.textContent = '⟳ กำลังบันทึก…'; el.className = 'sync'; } else setSync(); }

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
  if (t.type === 'plan') {
    const p = t.state ? t : L.planInfo(t);
    tags.push(`<span class="tag st st-${p.state}">${p.state === 'over' ? `⚠ เกินระยะเวลา ${p.daysLate} วัน` : p.state === 'late' ? `เสร็จช้า ${p.daysLate} วัน` : p.state === 'doing' ? (p.daysLeft === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${p.daysLeft} วัน`) : p.label}</span>`);
    tags.push(`<span class="tag">📆 ${fmtDue(p.start)} – ${fmtDue(p.end)}</span>`);
  }
  if (t.overdue) tags.push(`<span class="tag over">เกินกำหนด ${fmtDue(t.due_date)}</span>`);
  else if (t.type === 'once' && t.due_date) tags.push(`<span class="tag">${t.today ? 'วันนี้' : 'กำหนด ' + fmtDue(t.due_date)}</span>`);
  if (t.quota) tags.push(`<span class="tag ${t.quota.done >= t.quota.times ? 'ok' : 'high'}">สัปดาห์นี้ ${t.quota.done}/${t.quota.times}</span>`);
  tags.push(t.type === 'daily' ? `<span class="tag daily">🔁 ${esc(L.repeatLabel(t))}</span>` : t.type === 'backlog' ? '<span class="tag backlog">รายการค้าง</span>' : t.type === 'plan' ? '<span class="tag plan">งานตามแผน</span>' : '<span class="tag">ครั้งเดียว</span>');
  if (t.priority === 'สูง') tags.push('<span class="tag high">สำคัญสูง</span>');
  if (t.owner) tags.push(`<span>👤 ${esc(L.owners(t).join(', '))}</span>`);
  if (t.category) tags.push(`<span>${catDot(t.category)}${esc(t.category)}</span>`);
  const pp = L.postpones(t);
  if (pp.length) tags.push(`<span class="tag pp" title="${esc(pp.map(x => `${x.from} → ${x.to}: ${x.reason}`).join('\n'))}">↪️ เลื่อน ${pp.length} ครั้ง${pp[pp.length - 1].reason ? ': ' + esc(pp[pp.length - 1].reason) : ''}</span>`);
  if (mode === 'done') tags.push(`<span class="tag ok">✓ ${esc(t.done_time || '')}${t.done_by ? ' โดย ' + esc(t.done_by) : ''}</span>`);
  const cb = mode === 'up' ? '' : `<button class="cb" aria-label="${mode === 'done' ? 'ยกเลิกเสร็จ' : 'ทำเสร็จ'}" data-id="${t.id}" data-act="${mode === 'done' ? 'undo' : 'done'}"></button>`;
  const prog = t.type === 'plan' && mode !== 'done' && t.state ? `<div class="prog st-${t.state}" title="ใช้เวลาไปแล้ว ${t.timePct}% ของระยะเวลา"><i style="width:${t.timePct}%"></i></div>` : '';
  const ppb = mode !== 'done' && (t.type === 'once' || t.type === 'plan') ? `<button class="ppbtn" data-pp="${t.id}" title="เลื่อนวัน">⏭️ เลื่อน</button>` : '';
  return `<div class="task ${mode === 'done' ? 'done' : ''}">${cb}<div class="body"><div class="title">${esc(t.title)}</div><div class="meta">${tags.join('')}</div>${prog}${t.note ? `<div class="meta">📝 ${esc(t.note)}</div>` : ''}</div>${ppb}</div>`;
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
  const owners = ['ทั้งหมด', ...new Set([...d.todo, ...d.completed, ...d.upcoming, ...d.backlog, ...d.plans].flatMap(t => L.owners(t).length ? L.owners(t) : ['ไม่ระบุ']))];
  if (!owners.includes(ownerSel)) ownerSel = 'ทั้งหมด';
  $('#ownerFilter').innerHTML = owners.map(o => `<button class="chip ${o === ownerSel ? 'on' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('');
  const f = list => (ownerSel === 'ทั้งหมด' ? list : list.filter(t => (L.owners(t).length ? L.owners(t) : ['ไม่ระบุ']).includes(ownerSel)));
  const todo = f(d.todo), done = f([...d.completed, ...d.backlogDone, ...d.plansDone]), up = f(d.upcoming), bl = f(d.backlog), pl = f(d.plans);
  $('#planCard').classList.toggle('hidden', !d.plans.length);
  $('#planCount').innerHTML = `${pl.length} รายการ${d.planOver ? ` · <b style="color:var(--bad)">เกิน ${d.planOver}</b>` : ''}`;
  $('#planList').innerHTML = pl.length ? pl.map(t => taskRow(t, 'todo')).join('') : '<div class="empty">ไม่มีงานตามแผนของคนนี้</div>';
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
  const { Tasks, Logs } = DATA || (await refresh());
  const t = Tasks.find(x => x.id === id); if (!t) throw new Error('ไม่พบงาน');
  const n = L.nowParts();
  if (Logs.some(l => l.task_id === id && L.normDate(l.date) === n.date && l.void !== 'Y')) return;
  const ops = [{ action: 'append', tab: 'Logs', obj: { log_id: L.newId('L'), date: n.date, time: n.time.slice(0, 5), task_id: id, title: t.title, owner: t.owner, done_by: ME, type: t.type, note: '', void: '' } }];
  if (t.type !== 'daily') ops.push({ action: 'update', tab: 'Tasks', keyField: 'id', key: id, patch: { status: 'done', done_at: `${n.date} ${n.time}` } });
  await write(ops);
}
async function undoDone(id) {
  const { Tasks, Logs } = DATA || (await refresh());
  const t = Tasks.find(x => x.id === id); if (!t) throw new Error('ไม่พบงาน');
  const ops = [];
  const log = Logs.find(l => l.task_id === id && L.normDate(l.date) === L.today() && l.void !== 'Y');
  if (log) ops.push({ action: 'update', tab: 'Logs', keyField: 'log_id', key: log.log_id, patch: { void: 'Y' } });
  if (t.type !== 'daily') ops.push({ action: 'update', tab: 'Tasks', keyField: 'id', key: id, patch: { status: 'open', done_at: '' } });
  if (ops.length) await write(ops);
}

// ---------------------------------------------------------------- สเก็ตดูล (Gantt)
async function loadSchedule() {
  const { Tasks } = await refresh();
  const td = L.today(), sc = L.buildSchedule(Tasks, td);
  $('#gDate').textContent = 'วันนี้ ' + fmtDue(td);
  $('#gDoing').textContent = sc.doing; $('#gOver').textContent = sc.over; $('#gWait').textContent = sc.wait;
  $('#gOnTime').textContent = sc.onTimePct === null ? '-' : sc.onTimePct + '%';
  const owners = ['ทั้งหมด', ...new Set(sc.items.flatMap(t => (L.owners(t).length ? L.owners(t) : ['ไม่ระบุ'])))];
  if (!owners.includes(gOwner)) gOwner = 'ทั้งหมด';
  $('#gOwner').innerHTML = owners.length > 2 ? owners.map(o => `<button class="chip ${o === gOwner ? 'on' : ''}" data-go="${esc(o)}">${esc(o)}</button>`).join('') : '';
  const pick = { active: i => ['over', 'doing', 'wait'].includes(i.state), over: i => i.state === 'over', done: i => ['ontime', 'late'].includes(i.state), all: () => true }[gFilter];
  const list = sc.items.filter(pick).filter(t => gType === 'all' || t.type === gType).filter(t => gOwner === 'ทั้งหมด' || (L.owners(t).length ? L.owners(t) : ['ไม่ระบุ']).includes(gOwner));
  // ช่วงเวลาที่แสดง: เริ่มก่อนวันนี้เล็กน้อย
  const from = L.addDays(td, -Math.round(gRange * 0.25)), to = L.addDays(from, gRange - 1), span = gRange;
  const x = d => (L.dayDiff(from, d) / span) * 100;
  const clamp = v => Math.min(Math.max(v, 0), 100);
  const ticks = [];
  const step = gRange <= 14 ? 2 : gRange <= 31 ? 7 : 14;
  for (let i = 0; i < span; i += step) ticks.push(L.addDays(from, i));
  const grid = ticks.map(d => `<i class="g-wk" style="left:${x(d)}%"></i>`).join('');
  $('#gAxis').innerHTML = ticks.map(d => `<span style="left:${clamp(x(d) + 50 / span)}%">${fmtDue(d)}</span>`).join('');
  const todayX = (L.dayDiff(from, td) + 0.5) / span * 100;
  $('#gRows').innerHTML = list.length ? list.map(t => {
    const endShown = t.doneDate && t.doneDate > t.end ? t.doneDate : t.state === 'over' ? td : t.end;
    const a = x(t.start), b = x(L.addDays(t.end, 1));
    const l = clamp(a), r = clamp(b);
    const late = (t.state === 'over' || t.state === 'late') ? `<i class="g-late" style="left:${clamp(b)}%;width:${clamp(x(L.addDays(endShown, 1))) - clamp(b)}%"></i>` : '';
    const bar = r > l ? `<i class="g-bar ${a < 0 ? 'cut-l' : ''} ${b > 100 ? 'cut-r' : ''}" style="left:${l}%;width:${r - l}%"></i>` : '';
    const out = b <= 0 && !late ? '<span class="muted" style="position:absolute;left:4px;top:0">◀ ก่อนช่วงที่แสดง</span>' : a >= 100 ? '<span class="muted" style="position:absolute;right:4px;top:0">ถัดไป ▶</span>' : '';
    const cb = ['ontime', 'late'].includes(t.state) ? '' : `<button class="cb" style="width:22px;height:22px" aria-label="ทำเสร็จ" data-id="${t.id}" data-act="done" data-from="schedule"></button>`;
    return `<div class="g-row st-${t.state}"><div class="g-head">${cb}<div class="title">${esc(t.title)}</div>${['ontime', 'late'].includes(t.state) ? '' : `<button class="ppbtn" data-pp="${t.id}">⏭️ เลื่อน</button>`}<button class="btn ghost sm" data-edit="${t.id}">แก้ไข</button></div>
      <div class="meta"><span class="tag st">${t.state === 'over' ? `⚠ เกินระยะเวลา ${t.daysLate} วัน` : t.state === 'late' ? `เสร็จช้า ${t.daysLate} วัน` : t.state === 'doing' ? (t.daysLeft === 0 ? 'ครบกำหนดวันนี้' : `กำลังดำเนินการ · เหลือ ${t.daysLeft} วัน`) : t.state === 'wait' ? (t.type === 'once' ? `อีก ${L.dayDiff(td, t.start)} วัน` : `เริ่มอีก ${L.dayDiff(td, t.start)} วัน`) : 'เสร็จตามเวลา'}</span>
      ${t.type === 'once' ? '<span class="tag">📅 นัด/ครั้งเดียว</span>' : '<span class="tag plan">งานตามแผน</span>'}<span>📆 ${t.type === 'once' ? fmtDue(t.end) + (t.time ? ' ' + esc(L.normTime(t.time)) + ' น.' : '') : `${fmtDue(t.start)} – ${fmtDue(t.end)} (${t.totalDays} วัน)`}</span>${t.doneDate ? `<span>✓ เสร็จ ${fmtDue(t.doneDate)}</span>` : ''}${t.owner ? `<span>👤 ${esc(L.owners(t).join(', '))}</span>` : ''}${t.category ? `<span>${catDot(t.category)}${esc(t.category)}</span>` : ''}</div>
      <div class="g-track">${grid}${bar}${late}${out}${todayX >= 0 && todayX <= 100 ? `<i class="g-today" style="left:${todayX}%"></i>` : ''}</div></div>`;
  }).join('') : `<div class="empty">ไม่มีงาน${gFilter !== 'all' || gType !== 'all' ? 'ในตัวกรองนี้' : 'ที่มีกำหนดวัน'} — เพิ่มได้ที่ "เพิ่มงาน" (นัดหมาย หรือ งานตามแผน)</div>`;
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
  f.elements['due_date'].value = L.today(); f.elements['start_date'].value = L.today(); f.elements['end_date'].value = L.addDays(L.today(), 7);
  fillRepeat(f, {});
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
  const ty = ['daily', 'backlog', 'plan'].includes(t.type) ? t.type : 'once';
  f.elements['start_date'].value = L.normDate(t.start_date) || L.normDate(t.created_at); f.elements['end_date'].value = L.normDate(t.due_date);
  f.querySelector(`[name=type][value=${ty}]`).checked = true;
  f.elements['due_date'].value = L.normDate(t.due_date); f.elements['time'].value = L.normTime(t.time); f.elements['remind_before'].value = t.remind_before || '30'; f.elements['note'].value = t.note;
  applyType(ty); fillRepeat(f, t);
  $('#formTitle').textContent = '✏️ แก้ไขงาน'; $('#saveBtn').textContent = 'บันทึกการแก้ไข'; $('#cancelEdit').classList.remove('hidden');
}
$('#cancelEdit').onclick = () => { resetForm(); show('manage'); };
// ---- ตั้งค่ารอบการทำซ้ำ
(function initRepeat() {
  $('#rDays').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="rday" value="${d}">${L.DOW_TH[d]}</label>`).join('');
  $('#addForm').elements['rmday'].innerHTML = Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('');
})();
function applyRepeat() {
  const f = $('#addForm'), m = f.querySelector('[name=rmode]:checked')?.value || 'workdays';
  f.querySelectorAll('.rp-sub').forEach(el => el.classList.toggle('on', el.dataset.for === m));
  f.querySelector('.rp-anchor').style.display = f.elements['revery'].value === '1' ? 'none' : '';
}
function readRepeat(f) {
  const m = f.querySelector('[name=rmode]:checked')?.value || 'workdays';
  if (m === 'weekly') {
    const days = [...f.querySelectorAll('[name=rday]:checked')].map(i => +i.value);
    if (!days.length) throw new Error('เลือกวันในสัปดาห์อย่างน้อย 1 วัน');
    const every = +f.elements['revery'].value;
    return JSON.stringify({ mode: 'weekly', days, every, ...(every > 1 ? { anchor: f.elements['ranchor'].value || L.today() } : {}) });
  }
  if (m === 'monthly') return JSON.stringify(f.querySelector('[name=rmkind]:checked').value === 'nth' ? { mode: 'monthly', nth: +f.elements['rnth'].value, dow: +f.elements['rdow'].value } : { mode: 'monthly', day: +f.elements['rmday'].value });
  if (m === 'quota') return JSON.stringify({ mode: 'quota', times: +f.elements['rtimes'].value });
  return '';
}
function fillRepeat(f, t) {
  const r = L.repeatOf(t);
  f.querySelector(`[name=rmode][value=${r.mode}]`).checked = true;
  f.querySelectorAll('[name=rday]').forEach(i => (i.checked = (r.days || []).map(Number).includes(+i.value)));
  f.elements['revery'].value = String(r.every || 1); f.elements['ranchor'].value = L.normDate(r.anchor) || L.today();
  f.querySelector(`[name=rmkind][value=${r.nth ? 'nth' : 'day'}]`).checked = true;
  f.elements['rmday'].value = String(r.day || 1); f.elements['rnth'].value = String(r.nth || 1); f.elements['rdow'].value = String(r.dow ?? 1);
  f.elements['rtimes'].value = String(r.times || 2);
  applyRepeat();
}
$('#addForm').addEventListener('change', e => { if (['rmode', 'revery'].includes(e.target.name)) applyRepeat(); if (e.target.name === 'rday') { const f = $('#addForm'); f.querySelector('[name=rmode][value=weekly]').checked = true; applyRepeat(); } });
function applyType(ty) {
  $('#repeatWrap').classList.toggle('hidden', ty !== 'daily');
  $('#dueWrap').classList.toggle('hidden', ty !== 'once');
  $('#timeWrap').classList.toggle('hidden', ty === 'backlog' || ty === 'plan');
  $('#remindWrap').classList.toggle('hidden', ty === 'backlog' || ty === 'plan');
  $('#planStartWrap').classList.toggle('hidden', ty !== 'plan');
  $('#planEndWrap').classList.toggle('hidden', ty !== 'plan');
}
$('#addForm').addEventListener('change', e => { if (e.target.name === 'type') applyType(e.target.value); });
$('#addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(e.target));
  fd.owner = [...e.target.querySelectorAll('[name=owner_pick]:checked')].map(i => i.value).join(', ');
  const isPlan = fd.type === 'plan';
  if (isPlan && (!fd.start_date || !fd.end_date)) return toast('กรุณาใส่วันเริ่มและวันสิ้นสุด');
  if (isPlan && fd.end_date < fd.start_date) return toast('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
  let repeat = '';
  if (fd.type === 'daily') { try { repeat = readRepeat(e.target); } catch (err) { return toast(err.message); } }
  const btn = $('#saveBtn'); btn.disabled = true;
  const noTime = fd.type === 'backlog' || isPlan;
  const data = {
    title: fd.title.trim(), owner: (fd.owner || '').trim(), category: (fd.category || '').trim(), priority: fd.priority,
    type: fd.type, due_date: fd.type === 'once' ? fd.due_date : isPlan ? fd.end_date : '', start_date: isPlan ? fd.start_date : '',
    time: noTime ? '' : (fd.time || ''), remind_before: !noTime && fd.time ? fd.remind_before : '', note: fd.note || '', repeat,
  };
  try {
    if (fd.task_id) {
      const old = DATA.Tasks.find(x => x.id === fd.task_id);
      const changedTime = old && (L.normDate(old.due_date) !== data.due_date || L.normTime(old.time) !== data.time || old.remind_before !== data.remind_before);
      await write([{ action: 'update', tab: 'Tasks', keyField: 'id', key: fd.task_id, patch: { ...data, ...(changedTime ? { reminded: '' } : {}) } }]);
      toast('✔ บันทึกการแก้ไขแล้ว'); resetForm(); show('manage');
    } else {
      const n = L.nowParts();
      await write([{ action: 'append', tab: 'Tasks', obj: { id: L.newId('T'), ...data, status: 'open', created_at: `${n.date} ${n.time}`, created_by: ME, done_at: '', reminded: '' } }]);
      toast('✔ เพิ่มงานแล้ว'); resetForm(); loadAdd();
    }
  } catch (err) { toast('ผิดพลาด: ' + err.message); }
  btn.disabled = false;
});

// ---------------------------------------------------------------- จัดการ
async function loadManage() {
  const { Tasks, Logs } = await refresh();
  const list = Tasks.filter(t => (t.status || 'open') === mStatus)
    .sort((a, b) => ({ daily: 0, once: 1, plan: 2, backlog: 3 }[a.type] ?? 1) - ({ daily: 0, once: 1, plan: 2, backlog: 3 }[b.type] ?? 1) || String(L.normDate(a.due_date) || '9').localeCompare(String(L.normDate(b.due_date) || '9')) || L.normTime(a.time).localeCompare(L.normTime(b.time)));
  $('#mBody').innerHTML = list.length ? list.map(t => `<tr><td><b>${esc(t.title)}</b><div class="meta"><span class="tag ${t.type === 'once' ? '' : t.type}">${t.type === 'daily' ? '🔁 ' + esc(L.repeatLabel(t)) : (L.TYPE_LABEL[t.type] || 'ครั้งเดียว')}</span>${t.time ? `<span class="tag time">🕐 ${esc(L.normTime(t.time))}</span>` : ''}${t.owner ? `<span>👤 ${esc(L.owners(t).join(', '))}</span>` : ''}${t.type === 'plan' ? `<span>📆 ${fmtDue(t.start_date || t.created_at)} – ${fmtDue(t.due_date)}</span><span class="tag st st-${L.planInfo(t).state}">${L.planInfo(t).label}</span>` : t.due_date ? `<span>กำหนด ${fmtDue(t.due_date)}</span>` : ''}${t.done_at ? `<span>เสร็จ ${fmtDue(t.done_at)}</span>` : ''}</div></td>
    <td><button class="btn ghost sm" data-edit="${t.id}">แก้ไข</button> ${mStatus === 'open' ? `<button class="btn danger sm" data-ms="cancel" data-id="${t.id}">ยกเลิก</button>` : `<button class="btn ghost sm" data-ms="open" data-id="${t.id}">เปิดใหม่</button>`}</td></tr>`).join('') : '<tr><td class="empty">ไม่มีรายการ</td></tr>';
  $('#preview').textContent = L.morningMessage(Tasks, Logs, location.href.split('#')[0], { includeDaily: false });
}

// ---------------------------------------------------------------- คลิก
document.addEventListener('click', async e => {
  const cb = e.target.closest('.cb');
  if (cb) {
    cb.disabled = true;
    const row = cb.closest('.task, .g-row'); row && row.classList.toggle('done', cb.dataset.act === 'done'); row && (row.style.opacity = '.6');
    if (cb.dataset.act === 'done' && !ME) askName();
    try { if (cb.dataset.act === 'done') await markDone(cb.dataset.id); else await undoDone(cb.dataset.id); toast(cb.dataset.act === 'done' ? '✔ บันทึกงานเสร็จแล้ว' : 'ยกเลิกสถานะเสร็จแล้ว'); await (cb.dataset.from === 'schedule' ? loadSchedule() : loadToday()); }
    catch (err) { toast('ผิดพลาด: ' + err.message); cb.disabled = false; if (row) { row.classList.toggle('done', cb.dataset.act !== 'done'); row.style.opacity = ''; } }
    return;
  }
  const chip = e.target.closest('#ownerFilter .chip'); if (chip) { ownerSel = chip.dataset.o; loadToday(); }
  const gt = e.target.closest('#gType .chip'); if (gt) { gType = gt.dataset.t; document.querySelectorAll('#gType .chip').forEach(c => c.classList.toggle('on', c === gt)); loadSchedule(); }
  const gf = e.target.closest('#gFilter .chip'); if (gf) { gFilter = gf.dataset.g; document.querySelectorAll('#gFilter .chip').forEach(c => c.classList.toggle('on', c === gf)); loadSchedule(); }
  const gr = e.target.closest('#gRange .chip'); if (gr) { gRange = +gr.dataset.r; document.querySelectorAll('#gRange .chip').forEach(c => c.classList.toggle('on', c === gr)); loadSchedule(); }
  const go = e.target.closest('#gOwner .chip'); if (go) { gOwner = go.dataset.go; loadSchedule(); }
  const rc = e.target.closest('#rangeChips .chip'); if (rc) { histDays = +rc.dataset.d; document.querySelectorAll('#rangeChips .chip').forEach(c => c.classList.toggle('on', c === rc)); loadHistory(); }
  const mc = e.target.closest('#mFilter .chip'); if (mc) { mStatus = mc.dataset.s; document.querySelectorAll('#mFilter .chip').forEach(c => c.classList.toggle('on', c === mc)); loadManage(); }
  const hd = e.target.closest('.day .hd'); if (hd) hd.parentElement.querySelector('ul')?.classList.toggle('hidden');
  const ed = e.target.closest('[data-edit]'); if (ed) editTask(ed.dataset.edit);
  const ms = e.target.closest('[data-ms]');
  if (ms) {
    if (ms.dataset.ms === 'cancel' && !confirm('ยกเลิกงานนี้? (ประวัติเดิมยังอยู่ เปิดใหม่ได้)')) return;
    ms.disabled = true;
    try { await write([{ action: 'update', tab: 'Tasks', keyField: 'id', key: ms.dataset.id, patch: { status: ms.dataset.ms, ...(ms.dataset.ms === 'open' ? { done_at: '' } : {}) } }]); toast('อัปเดตแล้ว'); loadManage(); } catch (err) { toast(err.message); ms.disabled = false; }
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
      const dup = activeRows(DATA[m.tab]).find(r => r.name === name && r.id !== fd.rid);
      if (dup) throw new Error(`มี "${name}" อยู่แล้ว`);
      const data = k === 'p' ? { name, position: (fd.position || '').trim(), phone: (fd.phone || '').trim() } : { name, note: (fd.note || '').trim(), color: fd.color };
      if (fd.rid) {
        const oldName = (DATA[m.tab].find(r => r.id === fd.rid) || {}).name;
        const affected = oldName && oldName !== name ? DATA.Tasks.filter(t => hasVal(t, m.field, oldName)) : [];
        const ops = [{ action: 'update', tab: m.tab, keyField: 'id', key: fd.rid, patch: data }];
        if (affected.length && confirm(`เปลี่ยนชื่อในงานที่ใช้ "${oldName}" อยู่ ${affected.length} รายการ เป็น "${name}" ด้วยไหม?`))
          for (const t of affected) ops.push({ action: 'update', tab: 'Tasks', keyField: 'id', key: t.id, patch: { [m.field]: m.field === 'owner' ? L.owners(t).map(x => (x === oldName ? name : x)).join(', ') : name } });
        await write(ops);
        toast('✔ บันทึกการแก้ไขแล้ว');
      } else {
        const n = L.nowParts();
        await write([{ action: 'append', tab: m.tab, obj: { id: L.newId(m.idp), ...data, active: 'Y', created_at: `${n.date} ${n.time}` } }]);
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
  await write(list.map((name, i) => ({ action: 'append', tab: m.tab, obj: k === 'p' ? { id: L.newId('P'), name, position: '', phone: '', note: '', active: 'Y', created_at: `${n.date} ${n.time}` }
      : { id: L.newId('C'), name, color: COLORS[i % COLORS.length], note: '', active: 'Y', created_at: `${n.date} ${n.time}` } })));
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
    try { await write([{ action: 'update', tab: m.tab, keyField: 'id', key: id, patch: { active: 'N' } }]); toast('ลบแล้ว'); loadMaster(); } catch (err) { toast(err.message); }
    return;
  }
  const rs = e.target.closest('[data-mrestore]');
  if (rs) {
    const [k, id] = rs.dataset.mrestore.split(':');
    try { await write([{ action: 'update', tab: MASTER[k].tab, keyField: 'id', key: id, patch: { active: 'Y' } }]); toast('กู้คืนแล้ว'); loadMaster(); } catch (err) { toast(err.message); }
  }
});

// ---------------------------------------------------------------- ทั่วไป
function askName() { const n = prompt('ชื่อของคุณ (ใช้บันทึกว่าใครเป็นคนทำงาน)', ME); if (n !== null) { ME = n.trim(); ls.set('me', ME); $('#meName').textContent = ME || 'ตั้งชื่อ'; } }
$('#meBtn').onclick = askName; $('#meName').textContent = ME || 'ตั้งชื่อ';
const views = { today: loadToday, schedule: loadSchedule, history: loadHistory, add: loadAdd, manage: loadManage, master: loadMaster };
function show(v, keepForm) {
  if (!store.signedIn) return showSignin();
  if (v === 'add' && !keepForm) resetForm();
  $('#nav').classList.remove('hidden');
  document.querySelectorAll('main>section').forEach(s => s.classList.toggle('hidden', s.id !== 'v-' + v));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  ls.set('view', v); curView = v;
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
function renderPin() {
  if (!('canEdit' in store)) return;
  const b = $('#pinBtn'); b.classList.remove('hidden');
  b.textContent = store.canEdit ? '🔓 แก้ไขได้' : '🔒 ดูอย่างเดียว';
  b.title = store.canEdit ? 'กดเพื่อออกจากโหมดแก้ไข' : 'กดเพื่อใส่ PIN';
}
$('#pinBtn').onclick = async () => {
  if (store.canEdit) { if (confirm('ออกจากโหมดแก้ไข (ลบ PIN ที่จำไว้ในเครื่องนี้)?')) store.logout(); }
  else { try { if (await store.askPin(true)) toast('🔓 แก้ไขได้แล้ว'); } catch (e) { toast(e.message); } }
};
window.addEventListener('pinchange', renderPin);
renderPin();
show(ls.get('view') || 'today');
// ---------------------------------------------------------------- เลื่อนวัน + เหตุผล
let ppTask = null;
function openPostpone(id) {
  const t = (DATA.Tasks || []).find(x => x.id === id); if (!t) return;
  ppTask = t;
  const f = $('#ppForm'); f.reset();
  const cur = L.normDate(t.due_date) || L.today();
  $('#ppTitle').textContent = t.title;
  $('#ppFrom').textContent = (t.type === 'plan' ? `${fmtDue(L.normDate(t.start_date) || L.normDate(t.created_at))} – ` : '') + fmtDue(cur) + (t.time ? ' ' + L.normTime(t.time) + ' น.' : '');
  const base = cur < L.today() ? L.today() : cur;
  f.elements['to'].value = L.addDays(base, 1); f.elements['to'].min = L.today();
  $('#ppShiftWrap').classList.toggle('hidden', t.type !== 'plan');
  const hist = L.postpones(t);
  $('#ppHist').innerHTML = hist.length ? `<div class="pp-hist"><b>ประวัติการเลื่อน (${hist.length})</b>${hist.map(h => `<div>• ${fmtDue(h.from)} → ${fmtDue(h.to)} — ${esc(h.reason)}${h.by ? ` <span class="muted">(${esc(h.by)})</span>` : ''}</div>`).join('')}</div>` : '';
  $('#ppDlg').showModal();
}
$('#ppQuick').addEventListener('click', e => { const b = e.target.closest('[data-add]'); if (!b || !ppTask) return; const cur = L.normDate(ppTask.due_date) || L.today(); const base = cur < L.today() ? L.today() : cur; $('#ppForm').elements['to'].value = L.addDays(base, +b.dataset.add); });
$('#ppReasons').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; const ta = $('#ppForm').elements['reason']; ta.value = ta.value.trim() ? ta.value.trim() + ', ' + b.textContent : b.textContent; ta.focus(); });
$('#ppCancel').onclick = () => $('#ppDlg').close();
$('#ppForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, t = ppTask; if (!t) return;
  const to = f.elements['to'].value, reason = f.elements['reason'].value.trim();
  if (!to || !reason) return toast('กรุณาใส่วันที่และเหตุผล');
  const from = L.normDate(t.due_date);
  if (to === from) return toast('วันที่ใหม่ต้องไม่ใช่วันเดิม');
  if (!ME) askName();
  const n = L.nowParts();
  const log = [...L.postpones(t), { at: `${n.date} ${n.time.slice(0, 5)}`, by: ME, from, to, reason }];
  const patch = { due_date: to, reminded: '', postpone_log: JSON.stringify(log) };
  if (t.type === 'plan') {
    const st = L.normDate(t.start_date) || L.normDate(t.created_at);
    if (f.elements['shift'].checked && from) patch.start_date = L.addDays(st, L.dayDiff(from, to));
    else if (st && to < st) patch.start_date = to;
  }
  const btn = $('#ppSave'); btn.disabled = true;
  try { await write([{ action: 'update', tab: 'Tasks', keyField: 'id', key: t.id, patch }]); $('#ppDlg').close(); toast(`✔ เลื่อนไป ${fmtDue(to)} แล้ว`); rerender(); }
  catch (err) { toast('ผิดพลาด: ' + err.message); }
  btn.disabled = false;
});
document.addEventListener('click', e => { const b = e.target.closest('[data-pp]'); if (b) { e.preventDefault(); openPostpone(b.dataset.pp); } });

// ปุ่มบังคับส่งเข้า LINE (มีเฉพาะเมื่อใช้ Supabase)
document.querySelectorAll('.lineRow').forEach(el => el.classList.toggle('hidden', !store.sendLine));
document.addEventListener('click', async e => {
  const b = e.target.closest('.sendLine'); if (!b) return;
  if (!confirm('ส่งสรุปงานวันนี้เข้า LINE ตอนนี้เลยไหม?')) return;
  const label = b.textContent; b.disabled = true; b.textContent = '⏳ กำลังส่ง…';
  try { await store.sendLine(ME); toast('✔ ส่งเข้า LINE แล้ว'); }
  catch (err) { toast('ส่งไม่สำเร็จ: ' + err.message); }
  b.disabled = false; b.textContent = label;
});
// เรียลไทม์: มีคนแก้ข้อมูลที่เครื่องอื่น → โหลดใหม่ทันที (รวบหลายเหตุการณ์เป็นครั้งเดียว)
let rtTimer = null;
if (store.subscribe) store.subscribe(() => { clearTimeout(rtTimer); rtTimer = setTimeout(() => fetchData(true).then(rerender).catch(() => {}), 400); });
// อัปเดตอัตโนมัติทุก 2 นาที (เฉพาะตอนเปิดหน้าอยู่) และทันทีเมื่อกลับมาที่หน้านี้
setInterval(() => { if (document.visibilityState === 'visible' && !inflight) fetchData().then(rerender).catch(() => {}); }, 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt > STALE_MS && !inflight) fetchData().then(rerender).catch(() => {}); });
$('#sync').onclick = () => { if (!inflight) fetchData('fresh').then(rerender).catch(e => toast(e.message)); };
