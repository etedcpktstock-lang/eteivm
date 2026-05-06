import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import nodemailer from 'nodemailer';
import { requireRole } from '../middleware/permissions';

const router = Router();

// All settings routes require ADMIN+
router.use(requireRole('ADMIN'));

// GET /api/settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    const settingsRows = await prisma.systemSetting.findMany();
    const settingsObject: Record<string, string> = {};
    settingsRows.forEach(s => {
      settingsObject[s.key] = s.value;
    });

    // แนบ initial data อื่นๆ ทับไปด้วยเพื่อ compatibility กับ Frontend เดิม (getInitialData)
    // แต่เพื่อความ clean ในระยะยาวควรแยก
    return res.json({ status: 'success', ...settingsObject });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/settings
router.post('/', async (req: Request, res: Response) => {
  const { settings } = req.body; // ต้องเป็น object แบบ { KEY: VALUE }
  try {
    for (const [key, value] of Object.entries(settings)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    return res.json({ status: 'success' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// GET /api/settings/users
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, access_level: true }
    });
    // แมปให้มี rowIndex คืนค่าให้ Frontend ที่อาจเรียกใช้
    const mapped = users.map(u => ({ ...u, rowIndex: u.id }));
    return res.json(mapped);
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/settings/users — create or update user
router.post('/users', requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  try {
    const payload = req.body?.user && typeof req.body.user === 'object' ? req.body.user : req.body;
    const { id, username, name, role, access_level, password } = payload || {};

    if (id) {
      // Update existing user
      const updateData: any = { name, role };
      if (access_level !== undefined) updateData.access_level = access_level;
      if (password && String(password).trim()) {
        const bcrypt = await import('bcryptjs');
        updateData.password = await bcrypt.hash(String(password), 10);
      }
      await prisma.user.update({ where: { id: Number(id) }, data: updateData });
      return res.json({ status: 'success', message: 'อัปเดตผู้ใช้แล้ว' });
    } else {
      // Create new user
      if (!username || !password) {
        return res.json({ status: 'error', message: 'กรุณากรอก username และ password' });
      }
      const bcrypt = await import('bcryptjs');
      const hashed = await bcrypt.hash(String(password), 10);
      await prisma.user.create({
        data: {
          username: String(username),
          password: hashed,
          name: name || username,
          role: role || 'STAFF',
          access_level: access_level || 1,
        }
      });
      return res.json({ status: 'success', message: 'สร้างผู้ใช้แล้ว' });
    }
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// DELETE /api/settings/users/:id
router.delete('/users/:id', requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.json({ status: 'error', message: 'ไม่พบผู้ใช้' });
    }
    if (user.role === 'SUPER_ADMIN') {
      return res.json({ status: 'error', message: 'ไม่สามารถลบ SUPER_ADMIN ได้' });
    }
    await prisma.user.delete({ where: { id } });
    return res.json({ status: 'success', message: 'ลบผู้ใช้แล้ว' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/settings/testTelegram
router.post('/testTelegram', async (_req: Request, res: Response) => {
  try {
    const settingsRows = await prisma.systemSetting.findMany();
    const settingsMap = new Map(settingsRows.map(s => [s.key, s.value]));

    const botToken = settingsMap.get('TG_BOT_TOKEN');
    const chatId = settingsMap.get('TG_CHAT_ID');

    if (!botToken || !chatId) {
      return res.json({ status: 'error', message: 'กรุณาตั้งค่า Bot Token และ Chat ID ในหน้า ระบบ หรือ แจ้งเตือน ก่อนทดสอบ' });
    }

    const baseUrl = `https://api.telegram.org/bot${botToken}`;
    const message = `🧪 *ETEIVM — ทดสอบระบบแจ้งเตือน*\\n\\nหากคุณได้รับข้อความนี้ แสดงว่าการตั้งค่า Telegram Bot ทำงานถูกต้องแล้ว\\n\\nส่งเมื่อ: ${new Date().toLocaleString('th-TH')}`;

    const axios = (await import('axios')).default;
    const resp = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });

    if (!resp.data?.ok) {
      return res.json({ status: 'error', message: resp.data?.description || 'ส่งข้อความไม่สำเร็จ' });
    }

    return res.json({ status: 'success', message: 'ส่งข้อความทดสอบสำเร็จ — กรุณาตรวจสอบ Telegram' });
  } catch (err: any) {
    console.error('testTelegram error:', err);
    return res.json({ status: 'error', message: err.response?.data?.description || err.message || 'ส่งข้อความไม่สำเร็จ' });
  }
});

// POST /api/settings/relinkTelegram
router.post('/relinkTelegram', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    // relinkTelegram เดิมใช้สำหรับ Google Apps Script webhook
    // ตอนนี้ backend ใช้ Express โดยตรง — เก็บไว้เป็น placeholder
    return res.json({ status: 'success', message: 'ระบบใช้ Backend โดยตรง ไม่ต้อง relink แล้ว' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/settings/testEmail
router.post('/testEmail', async (_req: Request, res: Response) => {
  try {
    const settingsRows = await prisma.systemSetting.findMany();
    const settingsMap = new Map(settingsRows.map(s => [s.key, s.value]));

    const host = settingsMap.get('EMAIL_HOST') || 'smtp.gmail.com';
    const port = parseInt(settingsMap.get('EMAIL_PORT') || '587');
    const user = settingsMap.get('EMAIL_USER');
    const pass = settingsMap.get('EMAIL_PASS');
    const to = settingsMap.get('EMAIL_TO') || user;
    const from = settingsMap.get('EMAIL_FROM') || settingsMap.get('CORP_NAME') || 'ETEIVM';

    if (!user || !pass) {
      return res.json({ status: 'error', message: 'กรุณาตั้งค่า Gmail และ App Password ในหน้า ระบบ ก่อนทดสอบ' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"${from}" <${user}>`,
      to,
      subject: '🧪 ETEIVM — ทดสอบระบบส่งอีเมล',
      text: `สวัสดี! นี่คืออีเมลทดสอบจากระบบ ETEIVM\n\nหากคุณได้รับอีเมลนี้ แสดงว่าการตั้งค่า Email (Gmail) ทำงานถูกต้องแล้ว\n\nส่งเมื่อ: ${new Date().toLocaleString('th-TH')}`,
    });

    return res.json({ status: 'success', message: 'ส่งอีเมลทดสอบสำเร็จ — กรุณาตรวจสอบ Inbox' });
  } catch (err: any) {
    console.error('testEmail error:', err);
    return res.json({ status: 'error', message: err.message || 'ส่งอีเมลไม่สำเร็จ' });
  }
});

export default router;
