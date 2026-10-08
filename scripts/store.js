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
  async upsert(tab, keyField, obj) {
    delete this.cache[tab];
    const rows = await this._rows(tab);
    if (rows.find(r => String(r[keyField]) === String(obj[keyField]))) return this.update(tab, keyField, obj[keyField], obj);
    return this.append(tab, obj);
  }
}

function createStore(cfg) {
  if (cfg.storage === 'sheets') {
    if (!cfg.sheetId) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID');
    return new SheetsStore(cfg.sheetId, cfg.keyFile, cfg.keyJson);
  }
  return new LocalStore(cfg.localFile);
}

module.exports = { createStore, SCHEMA };
