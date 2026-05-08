/**
 * Restore script: แยก "ตู้ใหม่" / "ใหม่" ออกจาก "สต๊อก" ที่ถูก Merge ผิดพลาด
 * แล้วรัน Merge ใหม่ที่ถูกต้อง (รวมเฉพาะ condition เดียวกัน)
 *
 * รัน: npx ts-node --skip-project scripts/fixMergeCondition.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 ตรวจสอบรายการ "สต๊อก" ที่อาจดูดรายการ "ใหม่" เข้าไปผิดพลาด...\n');

    // ดู WarehouseStock ของ id=90 (สต๊อก survivor ที่ดูด ตู้ใหม่ id=84 เข้าไป)
    const survivorItem = await prisma.masterItem.findUnique({
        where: { id: 90 },
        include: { warehouse_stocks: true }
    });

    if (!survivorItem) {
        console.log('ไม่พบ item id=90 ออกจากโปรแกรม');
        return;
    }

    console.log(`Survivor (id=90): condition="${survivorItem.condition}" stock_qty=${survivorItem.stock_qty}`);
    console.log('WarehouseStocks:', survivorItem.warehouse_stocks.map(w => `warehouse_id=${w.warehouse_id} stock=${w.stock_qty} transit=${w.transit_qty}`));

    // สร้าง "ตู้ใหม่" item ใหม่ขึ้นมา (เดิมคือ id=84 ที่ถูกลบไป)
    const newQty = 3; // stock_qty ดั้งเดิมของ ตู้ใหม่
    
    console.log(`\n🔄 กำลังสร้าง MasterItem "ตู้ใหม่" ขึ้นใหม่...`);

    await prisma.$transaction(async (tx) => {
        // 1. ลด stock_qty ของ survivor ลง 3 (ที่ถูก merge มาผิด)
        await tx.masterItem.update({
            where: { id: 90 },
            data: { stock_qty: { decrement: newQty } }
        });

        // 2. สร้าง MasterItem "ตู้ใหม่" ใหม่
        const restored = await tx.masterItem.create({
            data: {
                category: survivorItem.category,
                brand: survivorItem.brand,
                item_name: survivorItem.item_name,
                size: survivorItem.size,
                condition: 'ตู้ใหม่',
                details: survivorItem.details || '',
                stock_qty: newQty,
            }
        });
        console.log(`✅ สร้าง MasterItem ใหม่: id=${restored.id} condition="ตู้ใหม่" stock_qty=${newQty}`);

        // 3. แยก WarehouseStock คืน (เอา 3 ชิ้นออกจาก survivor คืนให้ restored)
        for (const ws of survivorItem.warehouse_stocks) {
            const splitStock = Math.min(newQty, ws.stock_qty); // เอาออกเท่าที่มี
            if (splitStock <= 0) continue;

            await tx.warehouseStock.upsert({
                where: { item_id_warehouse_id: { item_id: restored.id, warehouse_id: ws.warehouse_id } },
                update: { stock_qty: { increment: splitStock } },
                create: {
                    item_id: restored.id,
                    warehouse_id: ws.warehouse_id,
                    stock_qty: splitStock,
                    transit_qty: 0, quarantine_qty: 0, repair_qty: 0, scrap_qty: 0, lost_qty: 0,
                }
            });
            await tx.warehouseStock.update({
                where: { item_id_warehouse_id: { item_id: 90, warehouse_id: ws.warehouse_id } },
                data: { stock_qty: { decrement: splitStock } }
            });
            console.log(`✅ ย้าย stock ${splitStock} ชิ้น คืนให้ "ตู้ใหม่" (warehouse_id=${ws.warehouse_id})`);
        }
    });

    console.log('\n✅ Restore เสร็จสิ้น\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ━━━ ส่วนที่ 2: รัน Merge ที่ถูกต้อง (รวมเฉพาะ condition เดียวกัน) ━━━
    console.log('🔍 เริ่ม Merge ที่ถูกต้อง (รวมเฉพาะ สภาพ เดียวกัน)...\n');

    const allItems = await prisma.masterItem.findMany({ include: { warehouse_stocks: true } });
    console.log(`พบ MasterItem ทั้งหมด ${allItems.length} รายการ`);

    // กลุ่มรวม condition เข้าไปด้วย!
    const groups: Map<string, typeof allItems> = new Map();
    for (const item of allItems) {
        const key = [
            (item.category || '').trim().toLowerCase(),
            (item.brand || '').trim().toLowerCase(),
            (item.item_name || '').trim().toLowerCase(),
            (item.size || '').trim().toLowerCase(),
            (item.details || '').trim().toLowerCase(),
            (item.condition || '').trim().toLowerCase(), // ← รวม condition ด้วย!
        ].join('||');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
    }

    const duplicateGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
    console.log(`⚠️  พบกลุ่มที่ซ้ำกัน (condition เดียวกัน): ${duplicateGroups.length} กลุ่ม\n`);

    let mergedCount = 0, deletedCount = 0;

    for (const [, group] of duplicateGroups) {
        const survivor = group.reduce((a, b) => (a.stock_qty >= b.stock_qty ? a : b));
        const duplicates = group.filter(i => i.id !== survivor.id);

        console.log(`  Survivor: id=${survivor.id} (${survivor.condition}) stock=${survivor.stock_qty}`);

        await prisma.$transaction(async (tx) => {
            const totalExtra = duplicates.reduce((s, d) => s + (d.stock_qty || 0), 0);
            if (totalExtra > 0) {
                await tx.masterItem.update({ where: { id: survivor.id }, data: { stock_qty: { increment: totalExtra } } });
            }
            for (const dup of duplicates) {
                for (const ds of dup.warehouse_stocks) {
                    await tx.warehouseStock.upsert({
                        where: { item_id_warehouse_id: { item_id: survivor.id, warehouse_id: ds.warehouse_id } },
                        update: {
                            stock_qty: { increment: ds.stock_qty || 0 }, transit_qty: { increment: ds.transit_qty || 0 },
                            quarantine_qty: { increment: ds.quarantine_qty || 0 }, repair_qty: { increment: ds.repair_qty || 0 },
                            scrap_qty: { increment: ds.scrap_qty || 0 }, lost_qty: { increment: ds.lost_qty || 0 },
                        },
                        create: {
                            item_id: survivor.id, warehouse_id: ds.warehouse_id,
                            stock_qty: ds.stock_qty || 0, transit_qty: ds.transit_qty || 0,
                            quarantine_qty: ds.quarantine_qty || 0, repair_qty: ds.repair_qty || 0,
                            scrap_qty: ds.scrap_qty || 0, lost_qty: ds.lost_qty || 0,
                        }
                    });
                    await tx.warehouseStock.deleteMany({ where: { item_id: dup.id, warehouse_id: ds.warehouse_id } });
                }
                await tx.transaction.updateMany({ where: { item_id: dup.id }, data: { item_id: survivor.id } });
                await tx.masterItem.delete({ where: { id: dup.id } });
                console.log(`    🗑️  ลบ id=${dup.id} (${dup.condition})`);
                deletedCount++;
            }
            mergedCount++;
        });
    }

    console.log(`\n🎉 Merge เสร็จสิ้น: ${mergedCount} กลุ่ม, ลบ ${deletedCount} รายการ`);
}

main()
    .catch(e => { console.error('❌ Error:', e); })
    .finally(() => prisma.$disconnect());
