import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ========== ITEMS (Master Inventory) ==========

// GET /api/items
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.masterItem.findMany({
      include: { warehouse_stocks: true },
      orderBy: { id: 'asc' }
    });
    // แปลงให้ตรงกับ format เดิมที่ Frontend คาดหวัง (Thai field names)
    // สต็อกจริงต้องมาจาก WarehouseStock ต่อคลังเท่านั้น; MasterItem.stock_qty เป็น cache/legacy
    const mapped = items.map(i => {
      const totalStock = i.warehouse_stocks.reduce((sum, ws) => sum + Number(ws.stock_qty || 0), 0);
      const totalRepair = i.warehouse_stocks.reduce((sum, ws) => sum + Number(ws.repair_qty || 0), 0);
      const totalScrap = i.warehouse_stocks.reduce((sum, ws) => sum + Number(ws.scrap_qty || 0), 0);
      const totalLost = i.warehouse_stocks.reduce((sum, ws) => sum + Number(ws.lost_qty || 0), 0);
      const totalQuarantine = i.warehouse_stocks.reduce((sum, ws) => sum + Number(ws.quarantine_qty || 0), 0);
      const totalTransit = i.warehouse_stocks.reduce((sum, ws) => sum + Number(ws.transit_qty || 0), 0);
      return {
        id: i.id,
        rowIndex: i.id,
        ประเภท: i.category,
        ยี่ห้อหรือรูปแบบ: i.brand ?? '',
        รายการ: i.item_name ?? '',
        สภาพ: i.condition ?? '',
        รายละเอียด: i.details ?? '',
        ขนาด: i.size ?? '',
        tracking_type: i.tracking_type || 'BATCH',
        จำนวน: totalStock,
        available_stock: totalStock,
        repair_qty: totalRepair,
        scrap_qty: totalScrap,
        lost_qty: totalLost,
        quarantine_qty: totalQuarantine,
        transit_qty: totalTransit,
        warehouse_stocks: i.warehouse_stocks.map(ws => ({
          warehouseId: ws.warehouse_id,
          stock: ws.stock_qty,
          repair: ws.repair_qty,
          scrap: ws.scrap_qty,
          lost: ws.lost_qty,
          quarantine: ws.quarantine_qty || 0,
          transit: ws.transit_qty || 0
        }))
      };
    });
    return res.json(mapped);
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/items — upsert single item
router.post('/', async (req: Request, res: Response) => {
  const { item } = req.body;
  if (!item) return res.json({ status: 'error', message: 'No item provided' });

  try {
    const warehouseId = item.warehouseId ? Number(item.warehouseId) : null;
    const data = {
      category: item.ประเภท || item.category || '',
      brand: item.ยี่ห้อหรือรูปแบบ || item.brand || null,
      item_name: item.รายการ || item.item_name || null,
      condition: item.สภาพ || item.condition || null,
      details: item.รายละเอียด || item.details || null,
      size: item.ขนาด || item.size || null,
      stock_qty: Number(item.จำนวน ?? item.stock_qty ?? 0),
    };

    const result = await prisma.$transaction(async (tx) => {
      let masterItem;
      if (item.rowIndex) {
        masterItem = await tx.masterItem.update({ where: { id: item.rowIndex }, data });
      } else {
        masterItem = await tx.masterItem.create({ data });
      }

      if (warehouseId) {
        await tx.warehouseStock.upsert({
          where: {
            item_id_warehouse_id: {
              item_id: masterItem.id,
              warehouse_id: warehouseId
            }
          },
          update: { stock_qty: data.stock_qty },
          create: { warehouse_id: warehouseId, item_id: masterItem.id, stock_qty: data.stock_qty }
        });
      }
      return masterItem;
    });

    return res.json({ status: 'success', item: { ...result, rowIndex: result.id } });
  } catch (err: any) {
    console.error('Save Item Error:', err);
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/items/batch — upsert multiple items
router.post('/batch', async (req: Request, res: Response) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.json({ status: 'error', message: 'items must be an array' });

  try {
    const created: any[] = [];
    const warehouseIdInput = req.body.warehouseId ? Number(req.body.warehouseId) : null;
    
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const warehouseId = warehouseIdInput || (item.warehouseId ? Number(item.warehouseId) : null);
        const data = {
          category: item.ประเภท || item.category || '',
          brand: item.ยี่ห้อหรือรูปแบบ || item.brand || null,
          item_name: item.รายการ || item.item_name || null,
          condition: item.สภาพ || item.condition || null,
          details: item.รายละเอียด || item.details || null,
          size: item.ขนาด || item.size || null,
          stock_qty: Number(item.จำนวน ?? item.stock_qty ?? 0),
        };

        let masterItem;
        if (item.rowIndex) {
          masterItem = await tx.masterItem.update({ where: { id: item.rowIndex }, data });
        } else {
          masterItem = await tx.masterItem.create({ data });
        }

        if (warehouseId) {
          await tx.warehouseStock.upsert({
            where: {
              item_id_warehouse_id: {
                item_id: masterItem.id,
                warehouse_id: warehouseId
              }
            },
            update: { stock_qty: data.stock_qty },
            create: { warehouse_id: warehouseId, item_id: masterItem.id, stock_qty: data.stock_qty }
          });
        }
        created.push({ ...masterItem, rowIndex: masterItem.id });
      }
    });

    return res.json({ status: 'success', items: created });
  } catch (err: any) {
    console.error('Batch Item Error:', err);
    return res.json({ status: 'error', message: err.message });
  }
});

// DELETE /api/items/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await prisma.masterItem.delete({ where: { id } });
    return res.json({ status: 'success' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

export default router;
