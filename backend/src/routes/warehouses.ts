import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/warehouses
router.get('/', async (_req: Request, res: Response) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: { stocks: true },
      orderBy: { id: 'asc' }
    });
    return res.json(warehouses);
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/warehouses (Create or Update)
router.post('/', async (req: Request, res: Response) => {
  const { id, name, is_active, latitude, longitude } = req.body;
  console.log('Save Warehouse Body:', req.body);
  
  const parseCoord = (v: any) => {
    if (v === undefined || v === null || v === '') return null;
    const p = parseFloat(v);
    return isNaN(p) ? null : p;
  };

  const parsedId = id ? parseInt(String(id)) : null;

  try {
    let warehouse;

    if (parsedId) {
      // UPDATE existing warehouse
      warehouse = await prisma.warehouse.update({
        where: { id: parsedId },
        data: { 
          name: String(name || '').trim(), 
          latitude: parseCoord(latitude),
          longitude: parseCoord(longitude),
          is_active: is_active !== undefined ? Boolean(is_active) : true 
        },
      });
    } else {
      // CREATE new warehouse
      warehouse = await prisma.warehouse.create({
        data: { 
          name: String(name || '').trim(), 
          latitude: parseCoord(latitude),
          longitude: parseCoord(longitude),
          is_active: is_active !== undefined ? Boolean(is_active) : true 
        },
      });
    }

    return res.json({ status: 'success', warehouse });
  } catch (err: any) {
    console.error('Save Warehouse Error:', err.code, err.message);
    return res.json({ status: 'error', message: err.message });
  }
});

// DELETE /api/warehouses/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const targetId = parseInt(String(req.params.id || ''));
  
  if (isNaN(targetId)) {
    return res.json({ status: 'error', message: 'Invalid ID' });
  }

  try {
    // 1. Find the Main Warehouse ID from settings
    const mainWhSetting = await prisma.systemSetting.findUnique({
      where: { key: 'MAIN_WAREHOUSE_ID' }
    });

    const mainWhId = mainWhSetting ? parseInt(mainWhSetting.value) : null;

    if (!mainWhId || mainWhId === targetId) {
       // If no main warehouse set, or trying to delete the main warehouse
       // Fallback: use the first available warehouse that is NOT the target
       const fallbackWh = await prisma.warehouse.findFirst({
         where: { id: { not: targetId } }
       });
       
       if (!fallbackWh) {
         return res.json({ status: 'error', message: 'ไม่สามารถลบคลังสุดท้ายของระบบได้' });
       }
       // If we're deleting the one that WAS the main, we should probably warn or auto-reassign
       // For now, let's just proceed with fallback
    }

    const migrationId = mainWhId && mainWhId !== targetId ? mainWhId : (await prisma.warehouse.findFirst({ where: { id: { not: targetId } } }))?.id;

    if (!migrationId) {
        return res.json({ status: 'error', message: 'ไม่พบคลังปลายทางสำหรับย้ายสินค้า' });
    }

    // 2. Perform Migration in a Transaction
    await prisma.$transaction(async (tx) => {
      // 2.1 Migrate Transactions (both origin and target)
      await tx.transaction.updateMany({
        where: { warehouse_id: targetId },
        data: { warehouse_id: migrationId }
      });
      await tx.transaction.updateMany({
        where: { to_warehouse_id: targetId },
        data: { to_warehouse_id: migrationId }
      });

      // 2.2 Migrate Jobs
      await tx.job.updateMany({
        where: { warehouse_id: targetId },
        data: { warehouse_id: migrationId }
      });

      // 2.3 Handle Warehouse Stocks
      const stocksToDelete = await tx.warehouseStock.findMany({
        where: { warehouse_id: targetId }
      });

      for (const stock of stocksToDelete) {
        // Find if main warehouse already has this item
        const existingMainStock = await tx.warehouseStock.findUnique({
          where: {
            item_id_warehouse_id: {
              item_id: stock.item_id,
              warehouse_id: migrationId
            }
          }
        });

        if (existingMainStock) {
          // Merge quantities
          await tx.warehouseStock.update({
            where: { id: existingMainStock.id },
            data: {
              stock_qty: { increment: stock.stock_qty },
              repair_qty: { increment: stock.repair_qty },
              scrap_qty: { increment: stock.scrap_qty },
              lost_qty: { increment: stock.lost_qty },
              quarantine_qty: { increment: stock.quarantine_qty },
              transit_qty: { increment: stock.transit_qty },
            }
          });
        } else {
          // Create new entry in main warehouse
          await tx.warehouseStock.create({
            data: {
              item_id: stock.item_id,
              warehouse_id: migrationId,
              stock_qty: stock.stock_qty,
              repair_qty: stock.repair_qty,
              scrap_qty: stock.scrap_qty,
              lost_qty: stock.lost_qty,
              quarantine_qty: stock.quarantine_qty,
              transit_qty: stock.transit_qty,
            }
          });
        }
      }

      // 3. Delete the warehouse and its individual stocks
      await tx.warehouseStock.deleteMany({ where: { warehouse_id: targetId } });
      await tx.warehouse.delete({ where: { id: targetId } });
      
      // 4. Update Main Warehouse Setting if the deleted one was the main
      if (mainWhId === targetId) {
        await tx.systemSetting.upsert({
          where: { key: 'MAIN_WAREHOUSE_ID' },
          update: { value: String(migrationId) },
          create: { key: 'MAIN_WAREHOUSE_ID', value: String(migrationId) }
        });
      }
    });

    return res.json({ status: 'success', message: 'ลบคลังและโอนย้ายสินค้าเรียบร้อยแล้ว' });
  } catch (err: any) {
    console.error('Delete Warehouse Error:', err);
    return res.json({ status: 'error', message: err.message });
  }
});

export default router;
