import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ========== ZONES ==========

// GET /api/zones
router.get('/', async (_req: Request, res: Response) => {
  try {
    const zones = await prisma.zone.findMany({ orderBy: { name: 'asc' } });
    
    // แปลงให้ตรงกับ format เดิม
    const mapped = zones.map(z => ({
      name: z.name,
      description: z.details ?? '',
      rowIndex: z.name, // ใช้ name เป็น ID ชั่วคราวแทน rowIndex
    }));
    
    return res.json(mapped);
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/zones
router.post('/', async (req: Request, res: Response) => {
  const { zone } = req.body;
  if (!zone || !zone.name) return res.json({ status: 'error', message: 'No zone data provided' });

  try {
    // Upsert zone
    const result = await prisma.zone.upsert({
      where: { name: zone.name }, // เดิมอาจจะใช้ rowIndex แก้ไขชื่อ แต่เอาชัวร์ใช้ name
      update: { details: zone.description || null },
      create: { name: zone.name, details: zone.description || null },
    });

    return res.json({ status: 'success', zone: { ...result, rowIndex: result.name } });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// DELETE /api/zones/:name
router.delete('/:name', async (req: Request, res: Response) => {
  const name = String(req.params.name || '');
  try {
    await prisma.zone.delete({ where: { name } });
    return res.json({ status: 'success' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

export default router;
