// ===== ตั้งค่าหน้าเว็บ (แก้ไฟล์นี้ไฟล์เดียว) =====
// ลำดับฐานข้อมูลที่ใช้: SUPABASE (หลัก) → APPS_SCRIPT_URL (สำรองเดิม) → โหมดทดลอง
window.APP_CONFIG = {
  APP_NAME: 'เช็คลิสต์งานทีม',
  SHEET_ID: '1ZA8Z3uRxkn6-IbvlZN-C1QHCBpMkwlKOQjC9vQ3gRwk',// ID ของ Google Sheet (ระหว่าง /d/ กับ /edit ใน URL)
  CLIENT_ID: '654520233814-ebv4k0453l6bsp7cbpnio3b5b8d93bhc.apps.googleusercontent.com',// OAuth Client ID (xxxx.apps.googleusercontent.com)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzs7SLGcqVhlA46NbWyZSmHsd_m0xdVxgki0NjsmiLPDG1Ay50CO7GATYooVG4ckZQt/exec', // ลิงก์ Web app ของ Apps Script (…/exec) — ถ้าใส่: เปิดดูได้ไม่ต้องล็อกอิน แก้ไขใช้ PIN
  SUPABASE_URL: 'https://kcvpansogqxknmirlvqu.supabase.co',  // https://xxxx.supabase.co — ถ้าใส่ จะใช้ Supabase เป็นฐานข้อมูลหลัก (เร็ว + เรียลไทม์)
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdnBhbnNvZ3F4a25taXJsdnF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODcxNzUsImV4cCI6MjEwNzA2MzE3NX0.LDGkKrEGyqb6BUJzDEKhi0shh8qwBdpQSbXd1LGqgDA',  // anon / publishable key (คีย์สาธารณะ ใส่ในเว็บได้)
  WORK_DAYS: '1-6',  // วันทำงาน 0=อา 1=จ ... 6=ส  (ต้องตรงกับ WORK_DAYS ใน GitHub)
  TARGET: 80,        // เป้าหมาย KPI (%)
};
