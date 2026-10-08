# เช็คลิสต์งานทีม — GitHub Pages + Google Sheets + LINE

ไม่ต้องมีเซิร์ฟเวอร์ ไม่ต้องเปิดคอมทิ้งไว้ ใช้ฟรีทั้งหมด

```
 ผู้ดูแลไม่กี่คน ──► หน้าเว็บ (GitHub Pages) ──► Google Sheets ◄── GitHub Actions (ทุก 15 นาที)
  เพิ่ม/แก้/ติ๊กงาน     ล็อกอินด้วย Google         ฐานข้อมูล            │
                                                                    ▼
                                                     กลุ่ม LINE ของทีม
                                     • 06:00  สรุปงานวันนี้ + งานค้าง
                                     • ก่อนเวลานัด  ⏰ เด้งเตือนนัดหมาย
```

## ข้อความที่ส่งเข้า LINE

**ทุกเช้าวันทำงาน (ค่าเริ่มต้น 06:00 จ.–ส.)**
```
☀️ งานวันนี้ — วันพฤหัสบดีที่ 8 ต.ค. 2569

📅 นัดหมาย / กำหนดเสร็จวันนี้ (3)
🕐 10:30 น. นัดช่าง Siemens ตรวจ Inverter ไลน์ 2 — วิชัย
🕐 13:00 น. ประชุมผู้รับเหมา Solar Rooftop หน้างาน — อรุณ
▫️ ส่งรายงานตรวจรับเครน — นภา

⏳ งานค้าง (2)
🔴 [เลยกำหนด 2 วัน] เปลี่ยนสายพานมอเตอร์ปั๊มน้ำ P-02 — สมชาย
▫️ สั่งซื้อลูกปืน 6205 สำรอง 10 ตัว — สมชาย

🗓️ ใกล้ถึงกำหนด (3 วัน)
▫️ 10 ต.ค. 09:00 Backup โปรแกรม PLC S7-1200 ไลน์ 2 — วิชัย
```

**เตือนตามเวลานัด** (งานที่ใส่ "เวลา" — เลือกเตือนตรงเวลา / 15 / 30 / 60 / 120 นาทีก่อน)
```
⏰ แจ้งเตือนนัดหมาย

🕐 13:00 น. (อีก 28 นาที)
📌 ประชุมผู้รับเหมา Solar Rooftop หน้างาน
👤 อรุณ
📝 จุดนัด: หลังคาโรงงาน 2
```
- งานที่กดเสร็จไปแล้วจะไม่เตือน, เตือนครั้งเดียวต่อวัน, งานประจำวันที่มีเวลา (เช่น Toolbox Talk 07:45) เตือนทุกวันทำงาน

> ⚠️ **เรื่องเวลา:** ตัวตั้งเวลาของ GitHub มักช้ากว่ากำหนด 5–20 นาที (บางช่วงอาจมากกว่า)
> แนะนำตั้งเตือน **30 นาทีก่อน** ขึ้นไป เพื่อให้ข้อความถึงก่อนเวลานัดแน่นอน

---

## ติดตั้ง (ครั้งเดียว ~30–45 นาที)

### 1) Google Sheet + Service Account (ให้ GitHub อ่าน/เขียนชีท)
1. สร้าง Google Sheet เปล่า → คัดลอก **SHEET_ID** จาก URL `docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`
2. https://console.cloud.google.com → สร้างโปรเจกต์ → **APIs & Services → Library → Google Sheets API → Enable**
3. **Credentials → Create credentials → Service account** → สร้าง → แท็บ **Keys → Add key → JSON** (ได้ไฟล์ .json เก็บไว้)
4. แชร์ Google Sheet ให้อีเมล Service account (`…@….iam.gserviceaccount.com`) สิทธิ์ **ผู้แก้ไข**

### 2) OAuth Client ID (ให้ผู้ดูแลล็อกอินหน้าเว็บ)
1. โปรเจกต์เดิม → **APIs & Services → OAuth consent screen**
   - บัญชีบริษัทเป็น Google Workspace → เลือก **Internal**
   - ใช้ Gmail ทั่วไป → เลือก **External** แล้วเพิ่มอีเมลผู้ดูแลใน **Test users** (สูงสุด 100 คน)
2. **Credentials → Create credentials → OAuth client ID → Web application**
   - **Authorized JavaScript origins:** `https://<ชื่อผู้ใช้ GitHub>.github.io`
3. คัดลอก **Client ID**
4. แชร์ Google Sheet ให้อีเมลผู้ดูแลแต่ละคน สิทธิ์ **ผู้แก้ไข**
5. เปิดไฟล์ `docs/config.js` ใส่ `SHEET_ID` และ `CLIENT_ID`

> ถ้าเจอหน้าจอ "Google hasn't verified this app" (แบบ External) ให้กด *Advanced → Go to …* — เป็นปกติของแอปภายในที่ไม่ได้ขอตรวจสอบ

### 3) LINE Official Account + Messaging API
1. สร้าง LINE OA ที่ https://manager.line.biz → **ตั้งค่า → Messaging API → เปิดใช้งาน**
2. **ตั้งค่าบัญชี** → เปิด **"อนุญาตให้บัญชีเข้าร่วมแชทกลุ่ม"** / **ตั้งค่าการตอบกลับ** → ปิดข้อความตอบกลับอัตโนมัติ
3. https://developers.line.biz/console → Channel → แท็บ **Messaging API → Channel access token (long-lived) → Issue** → คัดลอก
4. **หา Group ID (ครั้งเดียว):**
   - เปิด https://webhook.site → คัดลอก URL ส่วนตัวที่ได้
   - LINE Developers → Messaging API → **Webhook URL** = URL นั้น → เปิด **Use webhook**
   - เชิญบอทเข้ากลุ่ม LINE ของทีม แล้วพิมพ์ข้อความอะไรก็ได้ในกลุ่ม
   - ที่ webhook.site จะเห็น `"groupId": "Cxxxxxxxx…"` → คัดลอกเก็บไว้
   - ลบ Webhook URL ออก / ปิด Use webhook (ไม่ใช้แล้ว)

### 4) GitHub
1. สร้างบัญชี/ล็อกอิน https://github.com → **New repository** → ตั้งชื่อเช่น `checklist` → **Public** → Create
   *(GitHub Pages แบบฟรีต้องเป็น Public — โค้ดเห็นได้ แต่ข้อมูลงานอยู่ใน Google Sheet และรหัสลับอยู่ใน Secrets ไม่มีใครเห็น)*
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้: **Add file → Upload files** → ลากทุกไฟล์และโฟลเดอร์ (รวม `.github`) → Commit
   *(ถ้าลากโฟลเดอร์ `.github` ไม่ขึ้น ใช้ GitHub Desktop หรือสร้างไฟล์ `.github/workflows/line-notify.yml` ด้วยปุ่ม Add file → Create new file แล้ววางเนื้อหา)*
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / โฟลเดอร์ `/docs` → Save
   → ได้ลิงก์ `https://<ชื่อ>.github.io/checklist/`
4. **Settings → Secrets and variables → Actions**
   - แท็บ **Secrets** → New repository secret:

     | ชื่อ | ค่า |
     |---|---|
     | `SHEET_ID` | ID ของชีท |
     | `GOOGLE_SA_JSON` | เปิดไฟล์ .json ของ Service account แล้ว **วางทั้งก้อน** |
     | `LINE_CHANNEL_ACCESS_TOKEN` | token จากข้อ 3 |
     | `LINE_GROUP_ID` | Group ID (`C…`) |

   - แท็บ **Variables** (ไม่บังคับ):

     | ชื่อ | ค่าเริ่มต้น | ความหมาย |
     |---|---|---|
     | `APP_URL` | – | ลิงก์หน้าเว็บ แนบท้ายข้อความเช้า |
     | `MORNING_TIME` | `06:00` | เวลาส่งสรุปเช้า |
     | `WORK_DAYS` | `1-6` | วันทำงาน (0=อา … 6=ส) — แก้ใน `docs/config.js` ให้ตรงกันด้วย |
     | `INCLUDE_DAILY` | `false` | ใส่งานประจำวันในข้อความเช้าหรือไม่ |

5. ทดสอบ: แท็บ **Actions → LINE แจ้งเตือนงาน → Run workflow**
   - `preview` = ดูข้อความใน log (ไม่ส่ง) • `morning` = ส่งสรุปเช้าเข้ากลุ่มทันที

เสร็จแล้ว — ระบบจะรันเองทุก 15 นาที (05:00–20:00 น.)

---

## การใช้งานประจำวัน
- **เพิ่มนัดหมาย:** เพิ่มงาน → ครั้งเดียว/นัดหมาย → เลือกวันที่ + เวลา + เตือนล่วงหน้า
- **งานทำทุกวัน:** เลือก "ประจำวัน" (ใส่เวลาได้ถ้าต้องการเตือนทุกวัน)
- **ติ๊กเสร็จ:** หน้า "วันนี้" → กดช่องสี่เหลี่ยม (บันทึกเวลา + ชื่อคนทำ ลงแท็บ Logs)
- **แก้ไข/ยกเลิก:** หน้า "จัดการ" (ถ้าเปลี่ยนวัน/เวลา ระบบจะเตือนใหม่ให้)
- แก้ข้อมูลใน Google Sheet โดยตรงก็ได้ — `type` = `daily`/`once`, `status` = `open`/`done`/`cancel`, `time` = `13:00`, `remind_before` = นาที หรือ `none`

## หมายเหตุสำคัญ
- **โควตา LINE:** ข้อความ push เข้ากลุ่มนับตาม **จำนวนสมาชิกในกลุ่ม** (เช่น กลุ่ม 15 คน, วันละ ~3 ข้อความ ≈ 1,200 ข้อความ/เดือน) แพ็กเกจฟรีมีโควตาจำกัด — ตรวจดูใน LINE OA Manager และเลือกแพ็กเกจให้พอ
- **ตัวตั้งเวลาไม่ถูกปิด:** workflow มีขั้นตอน keepalive กัน GitHub ปิดตัวตั้งเวลาเองเมื่อ repo ไม่มีการแก้ไข 60 วัน — ถ้ายังได้อีเมลเตือนจาก GitHub ให้กด *Enable workflow*
- **ทดลองก่อนตั้งค่า:** เปิด `docs/index.html` ผ่าน GitHub Pages ตอนยังไม่ใส่ CLIENT_ID จะเป็นโหมดทดลอง (ข้อมูลตัวอย่าง)

## ทดสอบสคริปต์บนเครื่อง (สำหรับผู้ดูแลระบบ)
```bash
npm install
STORAGE=local DRY_RUN=1 NOW="2026-10-08 12:30" node scripts/notify.js   # จำลองเวลา ไม่ส่งจริง
```

## โครงสร้างไฟล์
```
docs/                 หน้าเว็บ (GitHub Pages)
  index.html, app.js    หน้าจอ + การทำงาน
  config.js             ← ตั้งค่า SHEET_ID / CLIENT_ID
  logic.js              ตรรกะกลาง (ใช้ร่วมกับสคริปต์แจ้งเตือน)
  store-browser.js      เชื่อม Google Sheets จากเบราว์เซอร์
scripts/notify.js     สคริปต์แจ้งเตือน (รันบน GitHub Actions)
.github/workflows/line-notify.yml   ตัวตั้งเวลา
```
