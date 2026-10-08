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
    add('ประชุมผู้รับเหมา Solar Rooftop หน้างาน', 'อรุณ', 'โครงการ', 'สูง', 'once', d, '13:00', L.addDays(d, -2), '60');
    add('ส่งรายงานตรวจรับเครน', 'นภา', 'เอกสาร', 'กลาง', 'once', d, '', L.addDays(d, -2));
    add('เปลี่ยนสายพานมอเตอร์ปั๊มน้ำ P-02', 'สมชาย', 'ซ่อมบำรุง', 'สูง', 'once', L.addDays(d, -2), '', L.addDays(d, -5));
    add('สั่งซื้อลูกปืน 6205 สำรอง 10 ตัว', 'สมชาย', 'จัดซื้อ', 'ต่ำ', 'once', '', '', L.addDays(d, -1));
    add('Backup โปรแกรม PLC S7-1200 ไลน์ 2', 'วิชัย', 'ระบบควบคุม', 'กลาง', 'once', L.addDays(d, 2), '09:00', L.addDays(d, -2), '30');
    add('ปรับปรุง WI ล้างแบบหล่อ (TH/EN)', 'นภา', 'เอกสาร', 'กลาง', 'once', L.addDays(d, 6), '', L.addDays(d, -1));

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
    return { Tasks: T, Logs: logs, Snapshots: [], Meta: [] };
  };
});
