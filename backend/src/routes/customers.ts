import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ========== CUSTOMERS ==========

// GET /api/customers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({ 
      include: { 
        inventory: { 
          include: { item: true } 
        } 
      },
      orderBy: { cv: 'asc' } 
    });
    
    // แปลงให้ตรงกับ format เดิม (ถ้ามี field พิเศษที่ Frontend คาดหวัง)
    const mapped = customers.map(c => ({
      cv: c.cv,
      name: c.name,
      phone: c.phone ?? '',
      address: c.address ?? '',
      subdistrict: c.sub_district ?? '',
      district: c.district ?? '',
      province: c.province ?? '',
      zipcode: c.zipcode ?? '',
      lat: c.latitude ? String(c.latitude) : '',
      lng: c.longitude ? String(c.longitude) : '',
      image_url: c.image_url ?? '',
      rowIndex: c.cv, 
      inventory: (c.inventory || []).map((inv: any) => ({
        id: inv.id,
        itemId: inv.item_id,
        name: inv.item?.item_name || inv.item?.category || 'พัสดุ',
        brand: inv.item?.brand || '',
        size: inv.item?.size || '',
        detail: inv.item?.details || '',
        qty: inv.quantity,
        lastUpdate: inv.last_updated
      }))
    }));
    
    return res.json(mapped);
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/customers
router.post('/', async (req: Request, res: Response) => {
  const { customer } = req.body;
  
  if (!customer || !customer.cv) {
    return res.json({ status: 'error', message: 'No customer data or CV provided' });
  }

  try {
    const data = {
      name: customer.name ?? '',
      phone: customer.phone || null,
      address: customer.address || null,
      sub_district: customer.subdistrict || null,
      district: customer.district || null,
      province: customer.province || null,
      zipcode: customer.zipcode || null,
      latitude: customer.lat ? parseFloat(String(customer.lat)) : null,
      longitude: customer.lng ? parseFloat(String(customer.lng)) : null,
      image_url: customer.image_url || null,
    };

    // ใช้ method ใหม่อาจจะเป็น upsert เพราะ Frontend เดิมส่งเป็นเซฟทับ หรือสร้างใหม่
    const result = await prisma.customer.upsert({
      where: { cv: customer.cv },
      update: data,
      create: {
        cv: customer.cv,
        ...data
      }
    });

    return res.json({ status: 'success', customer: { ...customer, rowIndex: result.cv } });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// DELETE /api/customers/:cv
router.delete('/:cv', async (req: Request, res: Response) => {
  const cv = String(req.params.cv || '');
  try {
    await prisma.customer.delete({ where: { cv } });
    return res.json({ status: 'success' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/customers/import — batch upsert
router.post('/import', async (req: Request, res: Response) => {
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0) {
    return res.json({ status: 'error', message: 'ไม่มีข้อมูลลูกค้าสำหรับนำเข้า' });
  }

  try {
    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const c of customers) {
      if (!c.cv) { errors.push(`ข้าม: ไม่มี CV`); continue; }
      try {
        const data = {
          name: c.name ?? '',
          phone: c.phone || null,
          address: c.address || null,
          sub_district: c.subdistrict || null,
          district: c.district || null,
          province: c.province || null,
          zipcode: c.zipcode || null,
          latitude: c.lat ? parseFloat(String(c.lat)) : null,
          longitude: c.lng ? parseFloat(String(c.lng)) : null,
          image_url: c.image_url || null,
        };

        const existing = await prisma.customer.findUnique({ where: { cv: String(c.cv) } });
        if (existing) {
          await prisma.customer.update({ where: { cv: String(c.cv) }, data });
          updated++;
        } else {
          await prisma.customer.create({ data: { cv: String(c.cv), ...data } });
          created++;
        }
      } catch (err: any) {
        errors.push(`CV ${c.cv}: ${err.message}`);
      }
    }

    return res.json({
      status: 'success',
      message: `นำเข้าสำเร็จ: สร้างใหม่ ${created}, อัปเดต ${updated}${errors.length ? `, ข้าม ${errors.length} รายการ` : ''}`,
      created,
      updated,
      errors: errors.slice(0, 10), // limit error messages
    });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// GET /api/customers/next-cv
router.get('/next-cv', async (_req: Request, res: Response) => {
  try {
    // หาเลข CV ล่าสุดที่ขึ้นต้นด้วย A (ตามกฎ: เลขรันต้องเป็นรูปแบบ A100009 เท่านั้น)
    const lastCustomer = await prisma.customer.findFirst({
      where: { cv: { startsWith: 'A' } },
      orderBy: { cv: 'desc' }
    });

    let nextCv = 'A100001';
    if (lastCustomer && lastCustomer.cv) {
      const match = lastCustomer.cv.match(/A(\d+)/);
      if (match && match[1]) {
        const nextNum = parseInt(match[1], 10) + 1;
        // บังคับรูปแบบ A ตามด้วยตัวเลขเดิม
        nextCv = `A${nextNum}`;
      } else {
        // กรณีมี A แต่ไม่ใช่ตัวเลขล้วน ให้พยายามดึงเลขออกมา
        const numericPart = lastCustomer.cv.replace(/\D/g, '');
        if (numericPart) {
          nextCv = `A${parseInt(numericPart, 10) + 1}`;
        }
      }
    }
    
    return res.json({ cv: nextCv });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message, cv: 'A100001' });
  }
});

export default router;
