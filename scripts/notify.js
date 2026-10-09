// สคริปต์แจ้งเตือน LINE — GitHub Actions เรียกทุก 15 นาที
//   node scripts/notify.js            โหมดอัตโนมัติ: เตือนนัดหมาย + สรุปเช้า (ครั้งเดียวต่อวัน) + บันทึก KPI เมื่อวาน
//   node scripts/notify.js morning    ส่งสรุปเช้าทันที (บังคับ)
//   node scripts/notify.js preview    แสดงข้อความ ไม่ส่ง
// ตัวแปรทดสอบ: DRY_RUN=1 (ไม่ส่งจริง), NOW="2026-10-08 12:35" (จำลองเวลา), STORAGE=local
const path = require('path');
const L = require('../docs/logic');
const { createStore } = require('./store');
const Line = require('./line');

const env = process.env;
L.setWorkDays(env.WORK_DAYS || '1-6');
const MORNING_TIME = L.normTime(env.MORNING_TIME || '06:00');
const GRACE = +(env.REMIND_GRACE_MIN || 60);
const DRY = !!env.DRY_RUN;
const APP_URL = env.APP_URL || '';
const OPTS = { includeDaily: env.INCLUDE_DAILY === 'true', includeUpcoming: env.INCLUDE_UPCOMING !== 'false' };

const USE_SB = !!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
const store = createStore({
  storage: env.STORAGE || (USE_SB ? 'supabase' : 'sheets'),
  supabaseUrl: env.SUPABASE_URL,
  supabaseKey: env.SUPABASE_SECRET_KEY,
  sheetId: env.SHEET_ID,
  keyJson: env.GOOGLE_SA_JSON,
  keyFile: path.resolve(env.GOOGLE_KEY_FILE || 'service-account.json'),
  localFile: path.resolve(env.LOCAL_FILE || 'data/local.json'),
});
const line = new Line({ token: env.LINE_CHANNEL_ACCESS_TOKEN, groupId: env.LINE_GROUP_ID });

function now() {
  if (env.NOW) { const [date, time] = env.NOW.split(/[ T]/); return { date, time: L.normTime(time) + ':00' }; }
  return L.nowParts();
}
async function send(text) {
  if (DRY) { console.log('----- [DRY_RUN] ข้อความที่จะส่ง -----\n' + text + '\n-------------------------------------'); return; }
  await line.push(text);
}
async function getMeta(key) { const m = (await store.all('Meta')).find(r => r.key === key); return m ? m.value : ''; }
const setMeta = (key, value) => store.upsert('Meta', 'key', { key, value });

async function main() {
  const mode = process.argv[2] || 'auto';
  await store.init();
  const n = now();
  if (mode === 'backup') { await backup(n); return; }
  const [tasks, logs] = await Promise.all([store.all('Tasks'), store.all('Logs')]);
  console.log(`เวลาไทย ${n.date} ${n.time} | โหมด ${mode} | งาน ${tasks.length} รายการ`);

  if (mode === 'preview') { console.log(L.morningMessage(tasks, logs, APP_URL, { ...OPTS, date: n.date })); return; }
  if (mode === 'morning') { await send(L.morningMessage(tasks, logs, APP_URL, { ...OPTS, date: n.date })); await setMeta('last_morning', n.date); return; }

  // 1) เตือนนัดหมายตามเวลา
  const due = L.dueReminders(tasks, logs, n, GRACE);
  if (due.length) {
    await send(L.reminderMessage(due));
    for (const t of due) await store.update('Tasks', 'id', t.id, { reminded: n.date });
    console.log(`✔ เตือนนัดหมาย ${due.length} รายการ: ${due.map(t => t.time + ' ' + t.title).join(', ')}`);
  } else console.log('· ไม่มีนัดหมายที่ถึงเวลาเตือน');

  // 2) สรุปเช้า (ครั้งเดียวต่อวัน — ถ้า Actions ส่งช้า ก็ยังส่งได้จนถึง 12:00)
  const t = n.time.slice(0, 5);
  if (L.isWorkDay(n.date) && t >= MORNING_TIME && t < '12:00' && (await getMeta('last_morning')) !== n.date) {
    await send(L.morningMessage(tasks, logs, APP_URL, { ...OPTS, date: n.date }));
    await setMeta('last_morning', n.date);
    console.log('✔ ส่งสรุปเช้าแล้ว');
  }

  // 3) บันทึก KPI ของเมื่อวาน (ครั้งเดียว)
  const y = L.addDays(n.date, -1);
  const snaps = await store.all('Snapshots');
  if (!snaps.some(s => L.normDate(s.date) === y)) {
    const d = L.buildDay(tasks, logs, y);
    await store.upsert('Snapshots', 'date', { date: y, planned: d.planned, done: d.done, pct: d.pct, by_owner_json: JSON.stringify(d.byOwner) });
    console.log(`✔ บันทึก KPI ${y}: ${d.done}/${d.planned} (${d.pct}%)`);
  }

  // 4) สำรองข้อมูลลง Google Sheet วันละครั้ง (หลัง 19:00 น.)
  if (USE_SB && env.SHEET_ID && t >= (env.BACKUP_TIME || '19:00') && (await getMeta('last_backup')) !== n.date) await backup(n);
}

async function backup(n) {
  if (!USE_SB || !env.SHEET_ID) { console.log('· ข้ามการสำรอง (ยังไม่ได้ตั้งค่า Supabase หรือ SHEET_ID)'); return; }
  const sheet = createStore({ storage: 'sheets', sheetId: env.SHEET_ID, keyJson: env.GOOGLE_SA_JSON, keyFile: path.resolve(env.GOOGLE_KEY_FILE || 'service-account.json') });
  const counts = [];
  for (const tab of ['Tasks', 'Logs', 'Snapshots', 'Meta', 'People', 'Categories']) {
    const rows = await store.all(tab);
    await sheet.replaceAll(tab, rows); counts.push(`${tab} ${rows.length}`);
  }
  await setMeta('last_backup', n.date);
  console.log('✔ สำรองลง Google Sheet แล้ว: ' + counts.join(', '));
}
main().catch(e => { console.error('✖', e.message); process.exit(1); });
