import axios from 'axios';
import FormData from 'form-data';
import prisma from './prisma';
import { broadcastUpdate } from './socket';

export interface NotificationPayload {
  type: 'RECEIVE' | 'ISSUE' | 'RETURN' | 'JOB_REQUEST' | 'VOID';
  txnNo: string;
  items: { name: string; quantity: number }[];
  operator: string;
  customer?: string;
  cv?: string;
  note?: string;
  photos?: string[]; // Array of base64 strings
}

/**
 * Utility to send notifications to Telegram and Line (placeholder)
 */
export class Notifier {
  
  /**
   * Main entry point to send notifications
   */
  /** ตรวจสอบว่าเปิด toggle แจ้งเตือนสำหรับ type ที่กำหนดหรือไม่ */
  private static isTypeEnabled(settingsMap: Map<string, string>, type: string): boolean {
    const key = `NOTIFY_${type}`;
    const val = settingsMap.get(key);
    // ถ้าไม่เคยตั้งค่าเลย (null/undefined) → ถือว่าเปิด (true) เพื่อ backward compatibility
    if (val === undefined || val === null) return true;
    return val === 'true';
  }

  static async notify(payload: NotificationPayload) {
    try {
      // 1. Get Settings from DB
      const settings = await prisma.systemSetting.findMany();
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      const botToken = settingsMap.get('TG_BOT_TOKEN');
      const chatId = settingsMap.get('TG_CHAT_ID');

      // 1.5 Emit to WebSocket UI clients immediately (independent of Telegram)
      broadcastUpdate('DATA_UPDATED', {
        type: payload.type,
        txnNo: payload.txnNo,
        message: `รายการใหม่: ${payload.txnNo} โดย ${payload.operator}`
      });

      if (!botToken || !chatId) {
        console.warn('Telegram settings missing (TG_BOT_TOKEN or TG_CHAT_ID). Skipping notification.');
        return;
      }

      // 1.6 Check notification type toggle — skip if disabled by user
      if (!this.isTypeEnabled(settingsMap, payload.type)) {
        console.log(`Notification skipped (${payload.type} disabled): ${payload.txnNo}`);
        return;
      }

      // 2. Format Message
      const message = this.formatThaiMessage(payload);

      // 3. Send to Telegram
      await this.sendToTelegram(botToken, chatId, message, payload.photos);

    } catch (err) {
      console.error('Notification Error:', err);
    }
  }

  private static formatThaiMessage(p: NotificationPayload): string {
    const title = p.type === 'RECEIVE' ? '📥 รับพัสดุเข้าคลัง' :
                  p.type === 'ISSUE' ? '📤 เบิกพัสดุออก' :
                  p.type === 'RETURN' ? '🔄 รับคืนพัสดุ' :
                  p.type === 'VOID' ? '🚫 ยกเลิกรายการ' : '📝 แจ้งงานใหม่';

    let msg = `📢 *${title}*\n`;
    msg += `━━━━━━━━━━━━━━\n`;
    msg += `🔢 *เลขที่:* ${p.txnNo}\n`;
    if (p.cv || p.customer) msg += `🏢 *ลูกค้า:* ${p.customer || ''} (${p.cv || '-'})\n`;
    msg += `👤 *ผู้ทำรายการ:* ${p.operator}\n`;
    msg += `📅 *เวลา:* ${new Date().toLocaleString('th-TH')}\n`;
    msg += `━━━━━━━━━━━━━━\n`;
    msg += `📦 *รายการพัสดุ:*\n`;
    
    p.items.forEach((it, idx) => {
      msg += `${idx + 1}. ${it.name} (x${it.quantity})\n`;
    });

    if (p.note) {
      msg += `━━━━━━━━━━━━━━\n`;
      msg += `📝 *หมายเหตุ:* ${p.note}\n`;
    }

    return msg;
  }

  private static async sendToTelegram(token: string, chatId: string, message: string, photos?: string[]) {
    const baseUrl = `https://api.telegram.org/bot${token}`;

    try {
      if (photos && photos.length > 0) {
        // Send first photo with caption
        const photo = photos[0];
        
        if (photo.startsWith('data:image')) {
          // It's a base64 string
          const base64Data = photo.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('photo', buffer, { filename: 'photo.jpg' });
          formData.append('caption', message);
          formData.append('parse_mode', 'Markdown');

          await axios.post(`${baseUrl}/sendPhoto`, formData, {
            headers: formData.getHeaders()
          });
        } else {
          // It's a URL
          await axios.post(`${baseUrl}/sendPhoto`, {
            chat_id: chatId,
            photo: photo,
            caption: message,
            parse_mode: 'Markdown'
          });
        }

        // Send remaining photos as media group (optional, keeping it simple for now)
      } else {
        // Send text only
        await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        });
      }
    } catch (err: any) {
      console.error('Telegram API Error:', err.response?.data || err.message);
    }
  }
}
