import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ete-dc-pkt-secret-2026';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password, deviceInfo } = req.body;

  if (!username || !password) {
    return res.json({ status: 'error', message: 'กรุณากรอก Username และ Password' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: String(username) }
    });

    if (!user) {
      return res.json({ status: 'error', message: 'ไม่พบผู้ใช้งานในระบบ' });
    }

    // เช็ครหัสผ่าน — รองรับทั้ง plain text (seed) และ bcrypt hash
    const isMatch = user.password === String(password) || await bcrypt.compare(String(password), user.password);
    if (!isMatch) {
      return res.json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // อัพเดต last_seen และ device info
    await prisma.user.update({
      where: { username: user.username },
      data: {
        last_seen: new Date(),
        ip_address: deviceInfo?.ip || req.ip,
        location: deviceInfo?.loc || null,
      }
    });

    // ดึง permissions จาก role
    const rolePermission = await prisma.rolePermission.findUnique({
      where: { role: user.role }
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, access_level: user.access_level },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      status: 'success',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        access_level: user.access_level,
        permissions: rolePermission?.permissions ?? {},
        token,
      }
    });
  } catch (err: any) {
    console.error('[Login Error]', err);
    return res.json({ status: 'error', message: err.message });
  }
});

// GET /api/auth/permissions — SUPER_ADMIN only
router.get('/permissions', authenticateToken, requireRole('SUPER_ADMIN'), async (_req: Request, res: Response) => {
  try {
    const roles = await prisma.rolePermission.findMany();
    // แปลงเป็น Object keyed by role เหมือนเดิม { admin: {...}, staff: {...} }
    const result: Record<string, any> = {};
    roles.forEach(r => { result[r.role] = r.permissions; });
    return res.json(result);
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/auth/permissions — SUPER_ADMIN only
router.post('/permissions', authenticateToken, requireRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const { permissions } = req.body; // { admin: {...}, staff: {...} }
  try {
    for (const [role, perms] of Object.entries(permissions)) {
      await prisma.rolePermission.upsert({
        where: { role },
        update: { permissions: perms as any },
        create: { role, permissions: perms as any },
      });
    }
    return res.json({ status: 'success' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

export default router;
