// อ่าน-เขียน Google Sheets จากเบราว์เซอร์ (ล็อกอินด้วยบัญชี Google ที่ได้รับแชร์ชีท)
// หรือ DemoStore (โหมดทดลอง เก็บในเบราว์เซอร์)
(function () {
  const SCHEMA = L.SCHEMA;
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };

  class SheetsBrowser {
    constructor(sheetId, clientId) {
      this.sheetId = sheetId; this.clientId = clientId;
      this.base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
      this.token = null; this.exp = 0; this.cache = {};
      try { const t = JSON.parse(ss.get('gtoken') || 'null'); if (t && t.exp > Date.now()) { this.token = t.token; this.exp = t.exp; } } catch {}
    }
    get demo() { return false; }
    get signedIn() { return !!this.token && this.exp > Date.now(); }
    _client() {
      if (this.tc) return this.tc;
      if (!window.google || !google.accounts) throw new Error('โหลด Google Sign-In ไม่สำเร็จ ตรวจอินเทอร์เน็ต');
      this.tc = google.accounts.oauth2.initTokenClient({ client_id: this.clientId, scope: 'https://www.googleapis.com/auth/spreadsheets', callback: () => {} });
      return this.tc;
    }
    signIn(prompt = '') {
      return new Promise((resolve, reject) => {
        const tc = this._client();
        tc.callback = r => {
          if (r.error) return reject(new Error(r.error));
          this.token = r.access_token; this.exp = Date.now() + (r.expires_in - 60) * 1000;
          ss.set('gtoken', JSON.stringify({ token: this.token, exp: this.exp }));
          resolve();
        };
        tc.error_callback = e => reject(new Error(e.type || 'ยกเลิกการล็อกอิน'));
        tc.requestAccessToken({ prompt });
      });
    }
    async _req(url, opts = {}, retry = true) {
      if (!this.signedIn) await this.signIn();
      const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' } });
      if (res.status === 401 && retry) { this.token = null; await this.signIn(); return this._req(url, opts, false); }
      if (res.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์แก้ไข Google Sheet — ขอให้ผู้ดูแลแชร์ชีทให้ก่อน');
      if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res.json();
    }
    async init() {
      const meta = await this._req(`${this.base}?fields=sheets.properties.title`);
      const have = meta.sheets.map(s => s.properties.title);
      const missing = Object.keys(SCHEMA).filter(t => !have.includes(t));
      if (missing.length) await this._req(`${this.base}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }) });
      const heads = await this._req(`${this.base}/values:batchGet?${Object.keys(SCHEMA).map(t => 'ranges=' + t + '!1:1').join('&')}`);
      for (const [i, tab] of Object.keys(SCHEMA).entries()) {
        const cur = (heads.valueRanges[i].values || [[]])[0];
        if (cur.join('|') !== SCHEMA[tab].join('|') && SCHEMA[tab].some(h => !cur.includes(h))) {
          // เพิ่มหัวคอลัมน์ที่ยังไม่มี (ไม่ลบของเดิม)
          const merged = [...cur, ...SCHEMA[tab].filter(h => !cur.includes(h))];
          await this._req(`${this.base}/values/${tab}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [merged] }) });
        }
      }
    }
    async loadAll() {
      const tabs = Object.keys(SCHEMA).filter(t => t !== 'Meta');
      const r = await this._req(`${this.base}/values:batchGet?${tabs.map(t => 'ranges=' + t + '!A:Z').join('&')}`);
      const out = {};
      tabs.forEach((tab, i) => {
        const vals = r.valueRanges[i].values || [];
        const head = vals[0] || SCHEMA[tab];
        out[tab] = vals.slice(1).map((v, j) => { const o = { _row: j + 2 }; head.forEach((h, k) => (o[h] = v[k] === undefined ? '' : String(v[k]))); return o; });
        this.cache[tab] = { head, rows: out[tab] };
      });
      return out;
    }
    _rowValues(tab, obj) { const head = (this.cache[tab] && this.cache[tab].head) || SCHEMA[tab]; return head.map(h => (obj[h] === undefined || obj[h] === null ? '' : String(obj[h]))); }
    async append(tab, obj) {
      if (!this.cache[tab]) await this.loadAll();
      await this._req(`${this.base}/values/${tab}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [this._rowValues(tab, obj)] }) });
    }
    async update(tab, keyField, key, patch) {
      await this.loadAll(); // อ่านล่าสุดก่อนเขียน กันทับข้อมูลคนอื่น
      const row = this.cache[tab].rows.find(r => String(r[keyField]) === String(key));
      if (!row) throw new Error('ไม่พบข้อมูล ' + key);
      const merged = { ...row, ...patch };
      await this._req(`${this.base}/values/${tab}!A${row._row}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [this._rowValues(tab, merged)] }) });
      return merged;
    }
  }

  class DemoStore {
    constructor() { this.key = 'checklist-demo-v4'; }
    get demo() { return true; }
    get signedIn() { return true; }
    async signIn() {}
    async init() {}
    _load() {
      let d = null; try { d = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch {}
      if (!d || d._day !== L.today()) { d = makeDemoData(); d._day = L.today(); this._save(d); }
      return d;
    }
    _save(d) { this.mem = d; try { localStorage.setItem(this.key, JSON.stringify(d)); } catch {} }
    async loadAll() { const d = this.mem || this._load(); this.mem = d; d.People = d.People || []; d.Categories = d.Categories || []; return { Tasks: d.Tasks, Logs: d.Logs, Snapshots: d.Snapshots, People: d.People, Categories: d.Categories }; }
    async append(tab, obj) { const d = this.mem || this._load(); d[tab].push({ ...obj }); this._save(d); }
    async update(tab, keyField, key, patch) { const d = this.mem || this._load(); const r = d[tab].find(x => String(x[keyField]) === String(key)); Object.assign(r, patch); this._save(d); return r; }
  }


  // อ่านผ่าน Apps Script (ไม่ต้องล็อกอิน) — เขียนต้องใช้ PIN
  class AppsScriptStore {
    constructor(url) { this.url = url; this.pin = (() => { try { return localStorage.getItem('pin') || ''; } catch { return ''; } })(); }
    get demo() { return false; }
    get signedIn() { return true; }
    get canEdit() { return !!this.pin; }
    async signIn() {}
    async init() {}
    _savePin(p) { this.pin = p; try { p ? localStorage.setItem('pin', p) : localStorage.removeItem('pin'); } catch {} }
    async _call(body) {
      const res = await fetch(this.url, { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error('เชื่อมต่อไม่สำเร็จ (' + res.status + ')');
      return res.json();
    }
    async loadAll() {
      const res = await fetch(this.url + '?action=load&t=' + Date.now());
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'โหลดข้อมูลไม่สำเร็จ');
      const d = j.data; for (const t of ['Tasks', 'Logs', 'Snapshots', 'People', 'Categories']) d[t] = d[t] || [];
      return d;
    }
    async askPin(force) {
      if (this.pin && !force) return true;
      const p = prompt('ใส่รหัส PIN เพื่อแก้ไขข้อมูล');
      if (!p) return false;
      const j = await this._call({ action: 'checkPin', pin: p.trim() });
      if (!j.ok) { alert(j.error || 'PIN ไม่ถูกต้อง'); return false; }
      this._savePin(p.trim()); window.dispatchEvent(new Event('pinchange')); return true;
    }
    logout() { this._savePin(''); window.dispatchEvent(new Event('pinchange')); }
    async _write(body) {
      if (!(await this.askPin())) throw new Error('ต้องใส่ PIN ก่อนแก้ไข');
      let j = await this._call({ ...body, pin: this.pin });
      if (!j.ok && j.code === 401) { this._savePin(''); if (!(await this.askPin(true))) throw new Error('PIN ไม่ถูกต้อง'); j = await this._call({ ...body, pin: this.pin }); }
      if (!j.ok) throw new Error(j.error || 'บันทึกไม่สำเร็จ');
      return j;
    }
    async append(tab, obj) { await this._write({ action: 'append', tab, obj }); }
    async update(tab, keyField, key, patch) { return (await this._write({ action: 'update', tab, keyField, key, patch })).row; }
  }

  window.createBrowserStore = cfg => (cfg.APPS_SCRIPT_URL ? new AppsScriptStore(cfg.APPS_SCRIPT_URL) : cfg.CLIENT_ID && cfg.SHEET_ID ? new SheetsBrowser(cfg.SHEET_ID, cfg.CLIENT_ID) : new DemoStore());
})();
