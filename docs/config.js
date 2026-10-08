// ===== ตั้งค่าหน้าเว็บ (แก้ไฟล์นี้ไฟล์เดียว) =====
// ถ้า CLIENT_ID เว้นว่าง หน้าเว็บจะทำงานแบบ "โหมดทดลอง" (ข้อมูลตัวอย่าง เก็บในเบราว์เซอร์)
window.APP_CONFIG = {
  APP_NAME: 'เช็คลิสต์งานทีม',
  SHEET_ID: '',      // ID ของ Google Sheet (ระหว่าง /d/ กับ /edit ใน URL)
  CLIENT_ID: '',     // OAuth Client ID (xxxx.apps.googleusercontent.com)
  WORK_DAYS: '1-6',  // วันทำงาน 0=อา 1=จ ... 6=ส  (ต้องตรงกับ WORK_DAYS ใน GitHub)
  TARGET: 80,        // เป้าหมาย KPI (%)
};
