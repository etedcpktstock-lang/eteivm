import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

/**
 * POST /api/items/merge-duplicates
 * รวม MasterItem ที่มีข้อมูลเดียวกัน (category, brand, item_name, size, details)
 * แต่ Condition ต่างกัน ให้ stockQty รวมกัน
 * โดยจะ:
 * 1. จัดกลุ่มตาม (category+brand+item_name+size+details)
 * 2. ถ้ากลุ่มไหนมีหลาย condition → merge WarehouseStock และ Transactions
 *    ให้หุบเข้าหา 'สต๊อก' (เป็นตัว survivor หลัก) หรือตัวที่มี stock_qty มากที่สุด
 * 3. ลบรายการซ้ำออก
 */
router.post('/merge-duplicates', async (req, res) => {
    try {
        const allItems = await prisma.masterItem.findMany({
            include: { warehouse_stocks: true }
        });

        // จัดกลุ่มตาม composite key (ไม่รวม condition)
        const groups: Map<string, typeof allItems> = new Map();
        for (const item of allItems) {
            const key = [
                (item.category || '').trim().toLowerCase(),
                (item.brand || '').trim().toLowerCase(),
                (item.item_name || '').trim().toLowerCase(),
                (item.size || '').trim().toLowerCase(),
                (item.details || '').trim().toLowerCase(),
            ].join('||');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        }

        let mergedCount = 0;
        let deletedCount = 0;
        const mergeLog: string[] = [];

        for (const [key, group] of groups.entries()) {
            if (group.length <= 1) continue; // ไม่มีซ้ำ

            // เลือก survivor: ให้ 'สต๊อก' เป็นหลัก ถ้าไม่มีให้ใช้ตัวที่ stock_qty มากสุด
            const stockItem = group.find(i => i.condition === 'สต๊อก');
            const survivor = stockItem || group.reduce((a, b) => (a.stock_qty > b.stock_qty ? a : b));
            const duplicates = group.filter(i => i.id !== survivor.id);

            mergeLog.push(`Merging group "${key}": survivor=${survivor.id}(${survivor.condition}), removing=${duplicates.map(d => `${d.id}(${d.condition})`).join(',')}`);

            await prisma.$transaction(async (tx) => {
                // 1. รวม stock_qty เข้า survivor
                const totalExtra = duplicates.reduce((sum, d) => sum + (d.stock_qty || 0), 0);
                if (totalExtra > 0) {
                    await tx.masterItem.update({
                        where: { id: survivor.id },
                        data: { stock_qty: { increment: totalExtra } }
                    });
                }

                // 2. Merge WarehouseStock - รวมยอดคลังทั้งหมด
                for (const dup of duplicates) {
                    const dupStocks = dup.warehouse_stocks;
                    for (const ds of dupStocks) {
                        await tx.warehouseStock.upsert({
                            where: { item_id_warehouse_id: { item_id: survivor.id, warehouse_id: ds.warehouse_id } },
                            update: {
                                stock_qty: { increment: ds.stock_qty || 0 },
                                transit_qty: { increment: ds.transit_qty || 0 },
                                quarantine_qty: { increment: ds.quarantine_qty || 0 },
                                repair_qty: { increment: ds.repair_qty || 0 },
                                scrap_qty: { increment: ds.scrap_qty || 0 },
                                lost_qty: { increment: ds.lost_qty || 0 },
                            },
                            create: {
                                item_id: survivor.id,
                                warehouse_id: ds.warehouse_id,
                                stock_qty: ds.stock_qty || 0,
                                transit_qty: ds.transit_qty || 0,
                                quarantine_qty: ds.quarantine_qty || 0,
                                repair_qty: ds.repair_qty || 0,
                                scrap_qty: ds.scrap_qty || 0,
                                lost_qty: ds.lost_qty || 0,
                            }
                        });
                        // ลบ WarehouseStock ของ dup นี้ออก
                        await tx.warehouseStock.deleteMany({
                            where: { item_id: dup.id, warehouse_id: ds.warehouse_id }
                        });
                    }

                    // 3. ย้าย Transactions ทั้งหมดที่ชี้ไป dup ให้ชี้มา survivor
                    await tx.transaction.updateMany({
                        where: { item_id: dup.id },
                        data: { item_id: survivor.id }
                    });

                    // 4. ลบ MasterItem ที่ซ้ำออก
                    await tx.masterItem.delete({ where: { id: dup.id } });
                    deletedCount++;
                }

                mergedCount++;
            });
        }

        return res.json({
            status: 'success',
            message: `Merge เสร็จสิ้น: รวม ${mergedCount} กลุ่ม, ลบ ${deletedCount} รายการซ้ำ`,
            log: mergeLog
        });
    } catch (err: any) {
        console.error('Merge Duplicates Error:', err);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/items/find-duplicates
 * ดูรายการที่ซ้ำก่อน (Dry Run ไม่แก้ข้อมูล)
 */
router.get('/find-duplicates', async (_req, res) => {
    try {
        const allItems = await prisma.masterItem.findMany({
            include: { warehouse_stocks: true }
        });

        const groups: Map<string, typeof allItems> = new Map();
        for (const item of allItems) {
            const key = [
                (item.category || '').trim().toLowerCase(),
                (item.brand || '').trim().toLowerCase(),
                (item.item_name || '').trim().toLowerCase(),
                (item.size || '').trim().toLowerCase(),
                (item.details || '').trim().toLowerCase(),
            ].join('||');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(item);
        }

        const duplicates = [];
        for (const [key, group] of groups.entries()) {
            if (group.length <= 1) continue;
            duplicates.push({
                key,
                count: group.length,
                items: group.map(i => ({
                    id: i.id,
                    condition: i.condition,
                    stock_qty: i.stock_qty,
                    totalWarehouseStock: i.warehouse_stocks.reduce((s, w) => s + (w.stock_qty || 0), 0)
                }))
            });
        }

        return res.json({ status: 'success', duplicateGroups: duplicates.length, data: duplicates });
    } catch (err: any) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

export default router;
