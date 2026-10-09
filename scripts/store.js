// ชั้นจัดเก็บข้อมูล: Google Sheets (ใช้งานจริง) หรือไฟล์ JSON ในเครื่อง (ทดลอง)
const fs = require('fs');
const path = require('path');

const { SCHEMA } = require('../docs/logic');

// ---------------------------------------------------------------- Local JSON
class LocalStore {
  constructor(file) {
    this.file = file;
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ Tasks: [], Logs: [], Snapshots: [], Meta: [] }, null, 2));
    }
  }
  async init() {}
  _load() { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }
  _save(d) { fs.writeFileSync(this.file, JSON.stringify(d, null, 2)); }
  async all(tab) { return this._load()[tab] || []; }
  _tab(d, tab) { return (d[tab] = d[tab] || []); }
  async append(tab, obj) { const d = this._load(); this._tab(d, tab).push(normalize(tab, obj)); this._save(d); return obj; }
  async update(tab, keyField, key, patch) {
    const d = this._load();
    const row = d[tab].find(r => String(r[keyField]) === String(key));
    if (!row) throw new Error('ไม่พบข้อมูล ' + key);
    Object.assign(row, patch); this._save(d); return row;
  }
  async upsert(tab, keyField, obj) {
    const d = this._load();
    const i = this._tab(d, tab).findIndex(r => String(r[keyField]) === String(obj[keyField]));
    if (i >= 0) d[tab][i] = normalize(tab, obj); else d[tab].push(normalize(tab, obj));
    this._save(d);
  }
}

function normalize(tab, obj) {
  const o = {};
  for (const h of SCHEMA[tab]) o[h] = obj[h] === undefined || obj[h] === null ? '' : String(obj[h]);
  return o;
}

// ---------------------------------------------------------------- Google Sheets
class SheetsStore {
  constructor(sheetId, keyFile, keyJson) {
    const { GoogleAuth } = require('google-auth-library');
    this.sheetId = sheetId;
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
    // บน GitHub Actions ใส่ JSON ทั้งก้อนไว้ใน Secret ชื่อ GOOGLE_SA_JSON
    this.auth = keyJson ? new GoogleAuth({ credentials: JSON.parse(keyJson), scopes }) : new GoogleAuth({ keyFile, scopes });
    this.base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    this.cache = {}; // tab -> {at, rows}
    this.queue = Promise.resolve(); // เขียนทีละคำสั่ง ป้องกันข้อมูลชนกัน
  }
  async _req(url, opts = {}) {
    const client = await this.auth.getClient();
    const { token } = await client.getAccessToken();
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${await res.text()}`);
    return res.json();
  }
  _serial(fn) { const p = this.queue.then(fn, fn); this.queue = p.catch(() => {}); return p; }

  async init() {
    const meta = await this._req(`${this.base}?fields=sheets.properties.title`);
    const have = meta.sheets.map(s => s.properties.title);
    const missing = Object.keys(SCHEMA).filter(t => !have.includes(t));
    if (missing.length) {
      await this._req(`${this.base}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }) });
    }
    for (const tab of Object.keys(SCHEMA)) {
      const r = await this._req(`${this.base}/values/${tab}!1:1`);
      if (!r.values || !r.values[0] || !r.values[0].length) {
        await this._req(`${this.base}/values/${tab}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [SCHEMA[tab]] }) });
      }
    }
    console.log('✔ Google Sheet พร้อมใช้งาน (แท็บ: ' + Object.keys(SCHEMA).join(', ') + ')');
  }

  async _rows(tab) {
    const c = this.cache[tab];
    if (c && Date.now() - c.at < 5000) return c.rows;
    const r = await this._req(`${this.base}/values/${tab}!A:Z?valueRenderOption=FORMATTED_VALUE`);
    const vals = r.values || [];
    const head = vals[0] || SCHEMA[tab];
    const rows = vals.slice(1).map((v, i) => {
      const o = { _row: i + 2 };
      head.forEach((h, j) => (o[h] = v[j] === undefined ? '' : String(v[j])));
      return o;
    });
    this.cache[tab] = { at: Date.now(), rows };
    return rows;
  }
  async all(tab) { return (await this._rows(tab)).map(({ _row, ...o }) => o); }
  async append(tab, obj) {
    return this._serial(async () => {
      const row = SCHEMA[tab].map(h => (obj[h] === undefined || obj[h] === null ? '' : String(obj[h])));
      await this._req(`${this.base}/values/${tab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [row] }) });
      delete this.cache[tab];
      return obj;
    });
  }
  async update(tab, keyField, key, patch) {
    return this._serial(async () => {
      delete this.cache[tab];
      const rows = await this._rows(tab);
      const row = rows.find(r => String(r[keyField]) === String(key));
      if (!row) throw new Error('ไม่พบข้อมูล ' + key);
      const merged = { ...row, ...patch };
      const values = [SCHEMA[tab].map(h => (merged[h] === undefined ? '' : String(merged[h])))];
      await this._req(`${this.base}/values/${tab}!A${row._row}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values }) });
      delete this.cache[tab];
      return merged;
    });
  }
  // สำรองข้อมูล: เขียนทับทั้งแท็บ
  async replaceAll(tab, rows) {
    const head = SCHEMA[tab];
    const values = [head, ...rows.map(r => head.map(h => (r[h] === undefined || r[h] === null ? '' : String(r[h]))))];
    await this._req(`${this.base}/values/${tab}!A:Z:clear`, { method: 'POST', body: '{}' });
    await this._req(`${this.base}/values/${tab}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values }) });
    delete this.cache[tab];
  }
  async upsert(tab, keyField, obj) {
    delete this.cache[tab];
    const rows = await this._rows(tab);
    if (rows.find(r => String(r[keyField]) === String(obj[keyField]))) return this.update(tab, keyField, obj[keyField], obj);
    return this.append(tab, obj);
  }
}

// ---------------------------------------------------------------- Supabase (ฐานข้อมูลหลักตั้งแต่ ต.ค. 2569)
const T = { Tasks: 'tasks', Logs: 'logs', Snapshots: 'snapshots', Meta: 'meta', People: 'people', Categories: 'categories' };
class SupabaseStore {
  constructor(url, key) {
    this.url = url.replace(/\/+$/, '');
    this.h = { apikey: key, 'Content-Type': 'application/json', ...(key.startsWith('eyJ') ? { Authorization: 'Bearer ' + key } : {}) };
  }
  async _req(path, opts = {}) {
    for (let i = 0; ; i++) {
      const res = await fetch(this.url + path, { ...opts, headers: { ...this.h, ...(opts.headers || {}) } });
      if (res.ok) { const t = await res.text(); return t ? JSON.parse(t) : null; }
      const msg = `Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (res.status < 500 || i >= 2) throw new Error(msg);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  async init() { await this._req('/rest/v1/meta?select=key&limit=1'); console.log('✔ เชื่อมต่อ Supabase แล้ว'); }
  async all(tab, filter = '') {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = await this._req(`/rest/v1/${T[tab]}?select=*${filter}`, { headers: { Range: `${from}-${from + 999}` } });
      out.push(...rows); if (rows.length < 1000) break;
    }
    return out.map(r => { const o = {}; for (const k in r) o[k] = r[k] == null ? '' : String(r[k]); return o; });
  }
  _clean(tab, obj) { const o = {}; for (const h of SCHEMA[tab]) if (obj[h] !== undefined) o[h] = obj[h] === null ? '' : String(obj[h]); return o; }
  async append(tab, obj) { await this._req(`/rest/v1/${T[tab]}`, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(this._clean(tab, obj)) }); return obj; }
  async update(tab, keyField, key, patch) {
    const rows = await this._req(`/rest/v1/${T[tab]}?${keyField}=eq.${encodeURIComponent(key)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(this._clean(tab, patch)) });
    if (!rows || !rows.length) throw new Error('ไม่พบข้อมูล ' + key);
    return rows[0];
  }
  async upsert(tab, keyField, obj) {
    await this._req(`/rest/v1/${T[tab]}?on_conflict=${keyField}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(this._clean(tab, obj)) });
  }
}

function createStore(cfg) {
  if (cfg.storage === 'supabase') {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SECRET_KEY');
    return new SupabaseStore(cfg.supabaseUrl, cfg.supabaseKey);
  }
  if (cfg.storage === 'sheets') {
    if (!cfg.sheetId) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID');
    return new SheetsStore(cfg.sheetId, cfg.keyFile, cfg.keyJson);
  }
  return new LocalStore(cfg.localFile);
}

module.exports = { createStore, SCHEMA, SheetsStore, SupabaseStore };
