// ข้อมูลตัวอย่าง (ใช้ตอนยังไม่ได้ตั้งค่า Google — โหมดทดลอง)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./logic'));
  else root.makeDemoData = factory(root.L);
})(typeof self !== 'undefined' ? self : this, function (L) {
  return function makeDemoData() {
    const d = L.today();
    const start = L.addDays(d, -14);
    const T = [];
    const add = (title, owner, category, priority, type, due = '', time = '', created = start, remind = '') =>
      T.push({ id: 'T-' + String(T.length + 1).padStart(3, '0'), title, owner, category, priority, type, due_date: due, time, remind_before: remind, status: 'open', created_at: created + ' 08:00:00', created_by: 'admin', done_at: '', reminded: '', note: '' });

    add('ประชุม Toolbox Talk ก่อนเริ่มงาน', 'อรุณ', 'ความปลอดภัย', 'กลาง', 'daily', '', '07:45', start, '15');
    add('ตรวจแรงดันลมคอมเพรสเซอร์ + ระบายน้ำถังลม', 'สมชาย', 'ซ่อมบำรุง', 'สูง', 'daily');
    add('เช็คระดับน้ำมันไฮดรอลิกเครื่อง Extruder', 'สมชาย', 'ซ่อมบำรุง', 'สูง', 'daily');
    add('ตรวจ Alarm ที่หน้าจอ HMI และบันทึก', 'วิชัย', 'ระบบควบคุม', 'กลาง', 'daily');
    add('จดมิเตอร์ไฟฟ้า MDB โรงงาน 1', 'วิชัย', 'พลังงาน', 'กลาง', 'daily', '', '16:30', start, '30');
    add('สุ่มตรวจขนาดแผ่นพื้น (QC)', 'นภา', 'คุณภาพ', 'สูง', 'daily');

    add('นัดช่าง Siemens ตรวจ Inverter ไลน์ 2', 'วิชัย', 'ระบบควบคุม', 'สูง', 'once', d, '10:30', L.addDays(d, -3), '30');
    add('ประชุมผู้รับเหมา Solar Rooftop หน้างาน', 'อรุณ, วิชัย', 'โครงการ', 'สูง', 'once', d, '13:00', L.addDays(d, -2), '60');
    add('ส่งรายงานตรวจรับเครน', 'นภา', 'เอกสาร', 'กลาง', 'once', d, '', L.addDays(d, -2));
    add('เปลี่ยนสายพานมอเตอร์ปั๊มน้ำ P-02', 'สมชาย', 'ซ่อมบำรุง', 'สูง', 'once', L.addDays(d, -2), '', L.addDays(d, -5));
    add('สั่งซื้อลูกปืน 6205 สำรอง 10 ตัว', 'สมชาย', 'จัดซื้อ', 'ต่ำ', 'backlog', '', '', L.addDays(d, -1));
    add('ทาสีราวบันไดทางเดินโรงงาน 1', 'สมชาย, วิชัย', 'ซ่อมบำรุง', 'กลาง', 'backlog', '', '', L.addDays(d, -6));
    add('จัดระเบียบตู้อะไหล่ไฟฟ้า', 'วิชัย', 'ระบบควบคุม', 'สูง', 'backlog', '', '', L.addDays(d, -3));
    add('Backup โปรแกรม PLC S7-1200 ไลน์ 2', 'วิชัย', 'ระบบควบคุม', 'กลาง', 'once', L.addDays(d, 2), '09:00', L.addDays(d, -2), '30');
    add('ปรับปรุง WI ล้างแบบหล่อ (TH/EN)', 'นภา', 'เอกสาร', 'กลาง', 'once', L.addDays(d, 6), '', L.addDays(d, -1));

    const plan = (title, owner, category, priority, startOff, endOff, doneOff) => {
      T.push({ id: 'T-' + String(T.length + 1).padStart(3, '0'), title, owner, category, priority, type: 'plan', start_date: L.addDays(d, startOff), due_date: L.addDays(d, endOff), time: '', remind_before: '', status: doneOff === undefined ? 'open' : 'done', created_at: L.addDays(d, startOff - 2) + ' 08:00:00', created_by: 'admin', done_at: doneOff === undefined ? '' : L.addDays(d, doneOff) + ' 15:00:00', reminded: '', note: '' });
    };
    plan('ติดตั้งแผง Solar Rooftop โรงงาน 1', 'อรุณ, วิชัย', 'โครงการ', 'สูง', -10, 12);
    plan('Overhaul เครื่อง Extruder ไลน์ 1', 'สมชาย', 'ซ่อมบำรุง', 'สูง', -9, -3);
    plan('อัปเกรด HMI ไลน์ 2 เป็น TIA Portal', 'วิชัย', 'ระบบควบคุม', 'กลาง', -5, 2);
    plan('จัดทำ WI ชุดใหม่ 10 ฉบับ (TH/EN)', 'นภา', 'เอกสาร', 'กลาง', 3, 20);
    plan('ตรวจสอบระบบดับเพลิงประจำปี', 'อรุณ', 'ความปลอดภัย', 'สูง', -20, -12, -13);
    plan('ย้ายตู้ MDB ย่อย อาคาร 3', 'วิชัย, สมชาย', 'พลังงาน', 'กลาง', -18, -8, -5);

    const logs = [];
    let s = 11; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 14; i >= 1; i--) {
      const day = L.addDays(d, -i);
      if (!L.isWorkDay(day)) continue;
      const rate = 0.6 + rnd() * 0.4;
      T.filter(t => t.type === 'daily').forEach((t, k) => {
        if (rnd() < rate) logs.push({ log_id: `L-${day}-${k}`, date: day, time: `${String(7 + Math.floor(rnd() * 9)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`, task_id: t.id, title: t.title, owner: t.owner, done_by: t.owner, type: 'daily', note: '', void: '' });
      });
    }
    ['T-001', 'T-002', 'T-004'].forEach((id, k) => { const t = T.find(x => x.id === id); logs.push({ log_id: `L-today-${k}`, date: d, time: `0${7 + k}:5${k}`, task_id: id, title: t.title, owner: t.owner, done_by: t.owner, type: 'daily', note: '', void: '' }); });
    const ts = start + ' 08:00:00';
    const People = [['สมชาย', 'ช่างซ่อมบำรุง'], ['วิชัย', 'ช่างไฟฟ้า/PLC'], ['นภา', 'QC'], ['อรุณ', 'หัวหน้างาน']]
      .map(([name, position], i) => ({ id: 'P-' + (i + 1), name, position, phone: '', note: '', active: 'Y', created_at: ts }));
    const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569'];
    const Categories = [...new Set(T.map(t => t.category).filter(Boolean))].map((name, i) => ({ id: 'C-' + (i + 1), name, color: COLORS[i % COLORS.length], note: '', active: 'Y', created_at: ts }));
    return { Tasks: T, Logs: logs, Snapshots: [], Meta: [], People, Categories };
  };
});
