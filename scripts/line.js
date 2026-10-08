// LINE Messaging API (LINE Notify ปิดบริการแล้วตั้งแต่ 31 มี.ค. 2025 จึงใช้ Messaging API แทน)
const crypto = require('crypto');

class Line {
  constructor({ token, secret, groupId }) { this.token = token; this.secret = secret; this.groupId = groupId; }
  get ready() { return !!(this.token && this.groupId); }

  async _post(path, body) {
    const res = await fetch('https://api.line.me/v2/bot/message/' + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LINE ${res.status}: ${await res.text()}`);
    return true;
  }
  /** ส่งเข้ากลุ่ม (นับโควตาข้อความ = จำนวนสมาชิกในกลุ่ม) */
  push(text, to = this.groupId) {
    if (!this.token || !to) throw new Error('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_GROUP_ID');
    return this._post('push', { to, messages: [{ type: 'text', text }] });
  }
  /** ตอบกลับคำสั่งในกลุ่ม (ไม่นับโควตา) */
  reply(replyToken, text) { return this._post('reply', { replyToken, messages: [{ type: 'text', text }] }); }

  verify(rawBody, signature) {
    if (!this.secret) return true;
    const h = crypto.createHmac('sha256', this.secret).update(rawBody).digest('base64');
    if (!signature || signature.length !== h.length) return false;
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(signature));
  }
}
module.exports = Line;
