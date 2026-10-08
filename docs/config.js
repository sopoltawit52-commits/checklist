// ===== ตั้งค่าหน้าเว็บ (แก้ไฟล์นี้ไฟล์เดียว) =====
// ถ้า CLIENT_ID เว้นว่าง หน้าเว็บจะทำงานแบบ "โหมดทดลอง" (ข้อมูลตัวอย่าง เก็บในเบราว์เซอร์)
window.APP_CONFIG = {
  APP_NAME: 'เช็คลิสต์งานทีม',
  SHEET_ID: '1ZA8Z3uRxkn6-IbvlZN-C1QHCBpMkwlKOQjC9vQ3gRwk',// ID ของ Google Sheet (ระหว่าง /d/ กับ /edit ใน URL)
  CLIENT_ID: '654520233814-ebv4k0453l6bsp7cbpnio3b5b8d93bhc.apps.googleusercontent.com',// OAuth Client ID (xxxx.apps.googleusercontent.com)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzs7SLGcqVhlA46NbWyZSmHsd_m0xdVxgki0NjsmiLPDG1Ay50CO7GATYooVG4ckZQt/exec', // ลิงก์ Web app ของ Apps Script (…/exec) — ถ้าใส่: เปิดดูได้ไม่ต้องล็อกอิน แก้ไขใช้ PIN
  WORK_DAYS: '1-6',  // วันทำงาน 0=อา 1=จ ... 6=ส  (ต้องตรงกับ WORK_DAYS ใน GitHub)
  TARGET: 80,        // เป้าหมาย KPI (%)
};
