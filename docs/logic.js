// ตรรกะกลาง ใช้ร่วมกันทั้งหน้าเว็บ (GitHub Pages) และสคริปต์แจ้งเตือน (GitHub Actions)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.L = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TZ = 'Asia/Bangkok';
  let WORK_DAYS = new Set([1, 2, 3, 4, 5, 6]);

  const SCHEMA = {
    Tasks: ['id', 'title', 'owner', 'category', 'priority', 'type', 'due_date', 'time', 'remind_before', 'status', 'created_at', 'created_by', 'done_at', 'reminded', 'note', 'start_date', 'postpone_log'],
    Logs: ['log_id', 'date', 'time', 'task_id', 'title', 'owner', 'done_by', 'type', 'note', 'void'],
    Snapshots: ['date', 'planned', 'done', 'pct', 'by_owner_json'],
    Meta: ['key', 'value'],
    People: ['id', 'name', 'position', 'phone', 'note', 'active', 'created_at'],
    Categories: ['id', 'name', 'color', 'note', 'active', 'created_at'],
  };

  // ---------------------------------------------------------------- วันที่ / เวลา (เวลาไทยเสมอ)
  function nowParts(d = new Date()) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}` };
  }
  const today = () => nowParts().date;
  function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function normDate(s) {
    if (!s) return '';
    s = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) { let y = +m[3]; if (y > 2400) y -= 543; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return s;
  }
  function normTime(s) {
    const m = String(s || '').trim().match(/^(\d{1,2})[:.](\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  }
  const toMin = t => { const [h, m] = normTime(t).split(':').map(Number); return h * 60 + m; };
  const fromMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  function parseDays(spec) {
    const set = new Set();
    String(spec || '1-6').split(',').forEach(part => { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (isNaN(b) ? a : b); i++) set.add(i % 7); });
    return set;
  }
  const setWorkDays = spec => { WORK_DAYS = parseDays(spec); };
  const isWorkDay = dateStr => WORK_DAYS.has(new Date(dateStr + 'T00:00:00Z').getUTCDay());
  const newId = p => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(16).slice(2, 6).toUpperCase();
  const PRIO_RANK = { 'สูง': 0, 'กลาง': 1, 'ต่ำ': 2 };
  // ผู้รับผิดชอบหลายคน เก็บเป็น "ชื่อ1, ชื่อ2"
  const owners = t => String((t && t.owner) || '').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
  // ประวัติการเลื่อนวัน เก็บใน tasks.postpone_log เป็น JSON [{at, by, from, to, reason}]
  function postpones(t) { try { const a = JSON.parse((t && t.postpone_log) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
  const TYPE_LABEL = { daily: 'ประจำวัน', once: 'ครั้งเดียว', backlog: 'รายการค้าง', plan: 'งานตามแผน' };
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

  // ---------------------------------------------------------------- งานตามแผน (มีวันเริ่ม–วันสิ้นสุด)
  // state: wait=ยังไม่เริ่ม doing=กำลังทำ over=เกินระยะเวลา ontime=เสร็จตามเวลา late=เสร็จช้า
  const PLAN_LABEL = { wait: 'ยังไม่เริ่ม', doing: 'กำลังดำเนินการ', over: 'เกินระยะเวลา', ontime: 'เสร็จตามเวลา', late: 'เสร็จช้ากว่ากำหนด' };
  function planInfo(raw, date = today()) {
    const start = raw.type === 'once' ? (normDate(raw.due_date) || date) : (normDate(raw.start_date) || normDate(raw.created_at) || date);
    const end = normDate(raw.due_date) || start;
    const doneDate = raw.status === 'done' ? (normDate(raw.done_at) || date) : '';
    const total = Math.max(dayDiff(start, end) + 1, 1);
    let state;
    if (doneDate) state = doneDate > end ? 'late' : 'ontime';
    else if (date < start) state = 'wait';
    else if (date <= end) state = 'doing';
    else state = 'over';
    const elapsed = Math.min(Math.max(dayDiff(start, date) + 1, 0), total);
    return {
      start, end, doneDate, state, label: PLAN_LABEL[state], totalDays: total,
      timePct: Math.round((elapsed / total) * 100),
      daysLeft: dayDiff(date, end), // ติดลบ = เลยมาแล้ว
      daysLate: state === 'over' ? dayDiff(end, date) : state === 'late' ? dayDiff(end, doneDate) : 0,
    };
  }
  function buildSchedule(tasks, date = today()) {
    const items = tasks.filter(t => (t.type === 'plan' || (t.type === 'once' && normDate(t.due_date))) && t.status !== 'cancel').map(t => ({ ...t, ...planInfo(t, date), due_date: normDate(t.due_date), start_date: normDate(t.start_date) }));
    const ORDER = { over: 0, doing: 1, wait: 2, late: 3, ontime: 4 };
    items.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.end.localeCompare(b.end) || a.start.localeCompare(b.start));
    const c = s => items.filter(i => i.state === s).length;
    const finished = c('ontime') + c('late');
    return { date, items, total: items.length, wait: c('wait'), doing: c('doing'), over: c('over'), ontime: c('ontime'), late: c('late'), onTimePct: finished ? Math.round((c('ontime') / finished) * 100) : null };
  }

  // ---------------------------------------------------------------- ภาพรวมของวัน
  function buildDay(tasks, logs, date) {
    const workDay = isWorkDay(date);
    const dayLogs = logs.filter(l => normDate(l.date) === date && l.void !== 'Y');
    const doneIds = new Map(dayLogs.map(l => [l.task_id, l]));
    const items = [], backlog = [], backlogDone = [], plans = [], plansDone = [];
    for (const raw of tasks) {
      const t = { ...raw, time: normTime(raw.time), due_date: normDate(raw.due_date) };
      const created = normDate(t.created_at);
      if (created && created > date) continue;
      if (t.status === 'cancel') continue;
      const due = t.due_date;
      if (t.type === 'plan') { // งานตามแผน — แสดงแยก ไม่นับเข้า KPI รายวัน
        const info = planInfo(t, date);
        if (t.status === 'done') {
          if (info.doneDate === date) { const log = doneIds.get(t.id); plansDone.push({ ...t, ...info, done: true, done_time: log ? log.time : '', done_by: log ? log.done_by : '' }); }
          continue;
        }
        if (info.state !== 'wait') plans.push({ ...t, ...info, done: false });
        continue;
      }
      if (t.type === 'backlog') { // รายการค้าง ไม่มีกำหนดวัน — ไม่นับเข้า KPI รายวัน
        const doneDate = normDate(t.done_at);
        if (t.status === 'done') {
          if (doneDate === date) { const log = doneIds.get(t.id); backlogDone.push({ ...t, done: true, done_time: log ? log.time : '', done_by: log ? log.done_by : '' }); }
          continue;
        }
        backlog.push({ ...t, done: false });
        continue;
      }
      if (t.type === 'daily') {
        const log = doneIds.get(t.id);
        if (!workDay && !log) continue;
        items.push({ ...t, done: !!log, done_time: log ? log.time : '', done_by: log ? log.done_by : '', overdue: false, today: true });
        continue;
      }
      const doneDate = normDate(t.done_at);
      if (t.status === 'done' && (!doneDate || doneDate < date)) continue;
      if (t.status === 'done' && doneDate === date) {
        const log = doneIds.get(t.id);
        items.push({ ...t, done: true, done_time: log ? log.time : '', done_by: log ? log.done_by : '', overdue: false, today: due === date });
        continue;
      }
      if (!due || due <= date) {
        if (!workDay && due !== date) continue;
        items.push({ ...t, done: false, overdue: !!due && due < date, today: due === date });
      } else items.push({ ...t, done: false, upcoming: true });
    }
    const planned = items.filter(i => !i.upcoming);
    const done = planned.filter(i => i.done).length;
    const byOwner = {};
    for (const i of planned) {
      for (const o of (owners(i).length ? owners(i) : ['ไม่ระบุ'])) {
        byOwner[o] = byOwner[o] || { owner: o, planned: 0, done: 0 };
        byOwner[o].planned++; if (i.done) byOwner[o].done++;
      }
    }
    Object.values(byOwner).forEach(o => (o.pct = o.planned ? Math.round((o.done / o.planned) * 100) : 0));
    const sort = (a, b) => (b.overdue - a.overdue) || (a.time || '99').localeCompare(b.time || '99') || ((PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1)) || String(a.due_date || '9').localeCompare(String(b.due_date || '9'));
    return {
      date, planned: planned.length, done, remaining: planned.length - done,
      overdue: planned.filter(i => i.overdue && !i.done).length,
      pct: planned.length ? Math.round((done / planned.length) * 100) : 0,
      byOwner: Object.values(byOwner).sort((a, b) => b.pct - a.pct),
      todo: planned.filter(i => !i.done).sort(sort),
      completed: planned.filter(i => i.done).sort((a, b) => String(a.done_time).localeCompare(String(b.done_time))),
      upcoming: items.filter(i => i.upcoming).sort(sort),
      backlog: backlog.sort((a, b) => ((PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1)) || String(a.created_at).localeCompare(String(b.created_at))),
      backlogDone,
      plans: plans.sort((a, b) => (b.state === 'over') - (a.state === 'over') || a.end.localeCompare(b.end)),
      plansDone,
      planOver: plans.filter(p => p.state === 'over').length,
    };
  }

  function buildHistory(tasks, logs, snapshots, from, to) {
    const snap = new Map(snapshots.map(s => [normDate(s.date), s]));
    const days = [];
    for (let d = to; d >= from; d = addDays(d, -1)) {
      const dayLogs = logs.filter(l => normDate(l.date) === d && l.void !== 'Y');
      const s = snap.get(d);
      let planned, done, pct;
      if (s && d !== today()) { planned = +s.planned; done = +s.done; pct = +s.pct; }
      else { const b = buildDay(tasks, logs, d); planned = b.planned; done = b.done; pct = b.pct; }
      days.push({ date: d, planned, done, pct, items: dayLogs.sort((a, b) => String(a.time).localeCompare(String(b.time))) });
    }
    const withPlan = days.filter(x => x.planned > 0);
    return { from, to, avgPct: withPlan.length ? Math.round(withPlan.reduce((s, x) => s + x.pct, 0) / withPlan.length) : 0, totalDone: days.reduce((s, x) => s + x.items.length, 0), days };
  }

  // ---------------------------------------------------------------- แจ้งเตือนตามเวลา
  /** งานที่ถึงเวลาเตือน ณ ตอนนี้ (ยังไม่เคยเตือนวันนี้, ยังไม่เสร็จ, ไม่เลยเวลานัดเกิน grace นาที) */
  function dueReminders(tasks, logs, now = nowParts(), graceMin = 60) {
    const day = buildDay(tasks, logs, now.date);
    const nowMin = toMin(now.time);
    return day.todo.filter(t => {
      if (!t.time || !t.today) return false;
      if (t.remind_before === 'none') return false;
      if (normDate(t.reminded) === now.date) return false;
      const before = t.remind_before === '' || t.remind_before == null ? 30 : +t.remind_before;
      const at = toMin(t.time) - before;
      return nowMin >= at && nowMin <= toMin(t.time) + graceMin;
    }).map(t => ({ ...t, minutesLeft: toMin(t.time) - nowMin }));
  }

  // ---------------------------------------------------------------- ข้อความ LINE
  const shortDate = d => new Date(d + 'T00:00:00+07:00').toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short' });
  const longDate = d => new Date(d + 'T00:00:00+07:00').toLocaleDateString('th-TH', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  // ผู้รับผิดชอบขึ้นบรรทัดใหม่ + หมายเหตุการเลื่อนวัน (ถ้ามี)
  const IND = '      ';
  const who = t => {
    let s = t.owner ? `\n${IND}👤 ${owners(t).join(', ')}` : '';
    const pp = postpones(t);
    if (pp.length) { const l = pp[pp.length - 1]; s += `\n${IND}↪️ เลื่อน${pp.length > 1 ? ` (ครั้งที่ ${pp.length})` : ''}${l.reason ? ': ' + l.reason : ''}`; }
    return s;
  };
  const daysLate = (due, date) => Math.round((new Date(date) - new Date(due)) / 86400000);

  function morningMessage(tasks, logs, appUrl, opt = {}) {
    const d = opt.date || today();
    const day = buildDay(tasks, logs, d);
    const appts = day.todo.filter(t => t.type === 'once' && t.today);
    const daily = day.todo.filter(t => t.type === 'daily');
    const pending = day.todo.filter(t => t.type === 'once' && !t.today);
    const L = [`☀️ งานวันนี้ — ${longDate(d)}`];

    L.push('', `📅 นัดหมาย / กำหนดเสร็จวันนี้ (${appts.length})`);
    if (appts.length) appts.forEach(t => L.push(`${t.time ? `🕐 ${t.time} น.` : '▫️'} ${t.title}${who(t)}`));
    else L.push('— ไม่มี —');

    if (opt.includeDaily !== false && daily.length) {
      L.push('', `🔁 งานประจำวัน (${daily.length})`);
      daily.forEach(t => L.push(`${t.time ? `🕐 ${t.time}` : '▫️'} ${t.title}${who(t)}`));
    }

    L.push('', `⏳ งานค้าง (${pending.length})`);
    if (pending.length) {
      pending.slice(0, 30).forEach(t => {
        const tag = t.overdue ? `🔴 [เลยกำหนด ${daysLate(t.due_date, d)} วัน]` : '▫️';
        L.push(`${tag} ${t.title}${who(t)}`);
      });
      if (pending.length > 30) L.push(`…และอีก ${pending.length - 30} รายการ`);
    } else L.push('✅ ไม่มีงานค้าง');

    const late = day.plans.filter(p => p.state === 'over');
    if (late.length && opt.includePlan !== false) {
      L.push('', `🔴 งานเกินระยะเวลา (${late.length})`);
      late.slice(0, 30).forEach(t => L.push(`▫️ ${t.title}\n${IND}📆 ${shortDate(t.start)}–${shortDate(t.end)} · เกิน ${t.daysLate} วัน${who(t)}`));
      if (late.length > 30) L.push(`…และอีก ${late.length - 30} รายการ`);
    }

    if (day.backlog.length && opt.includeBacklog !== false) {
      L.push('', `📝 รายการค้างทำ (${day.backlog.length})`);
      day.backlog.slice(0, 30).forEach(t => L.push(`${t.priority === 'สูง' ? '🟠' : '▫️'} ${t.title}${who(t)}`));
      if (day.backlog.length > 30) L.push(`…และอีก ${day.backlog.length - 30} รายการ`);
    }

    if (day.upcoming.length && opt.includeUpcoming !== false) {
      const soon = day.upcoming.filter(t => t.due_date <= addDays(d, 3));
      if (soon.length) { L.push('', `🗓️ ใกล้ถึงกำหนด (3 วัน)`); soon.forEach(t => L.push(`▫️ ${shortDate(t.due_date)}${t.time ? ' ' + t.time : ''} ${t.title}${who(t)}`)); }
    }
    if (appUrl) L.push('', `🔗 ${appUrl}`);
    let msg = L.join('\n');
    if (msg.length > 4900) msg = msg.slice(0, 4880) + '\n…(ดูต่อในเว็บ)';
    return msg;
  }

  function reminderMessage(items) {
    const L = ['⏰ แจ้งเตือนนัดหมาย'];
    items.sort((a, b) => a.time.localeCompare(b.time)).forEach(t => {
      const left = t.minutesLeft > 0 ? `อีก ${t.minutesLeft} นาที` : t.minutesLeft === 0 ? 'ถึงเวลาแล้ว' : `เลยมา ${-t.minutesLeft} นาที`;
      L.push('', `🕐 ${t.time} น. (${left})`, `📌 ${t.title}`);
      if (t.owner) L.push(`👤 ${t.owner}`);
      if (t.note) L.push(`📝 ${t.note}`);
    });
    return L.join('\n');
  }

  return { owners, postpones, TYPE_LABEL, PLAN_LABEL, planInfo, buildSchedule, dayDiff, SCHEMA, TZ, nowParts, today, addDays, normDate, normTime, toMin, fromMin, setWorkDays, isWorkDay, newId, buildDay, buildHistory, dueReminders, morningMessage, reminderMessage };
});
