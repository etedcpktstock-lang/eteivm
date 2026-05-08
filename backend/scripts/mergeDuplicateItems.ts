/**
 * One-shot script: Merge duplicate MasterItem records
 * รันด้วย: npx ts-node scripts/mergeDuplicateItems.ts
 *
 * จะ:
 * 1. หาทุก MasterItem ที่มี category+brand+item_name+size+details ตรงกันแต่ condition ต่างกัน
 * 2. Merge WarehouseStock และ Transaction ทั้งหมดให้ชี้ไปยังรายการ 'สต๊อก' (หรือรายการที่มีมากสุด)
 * 3. ลบรายการที่ซ้ำออก
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 กำลังค้นหารายการซ้ำ...\n');

    const allItems = await prisma.masterItem.findMany({
        include: { warehouse_stocks: true }
    });

    console.log(`พบ MasterItem ทั้งหมด ${allItems.length} รายการ`);

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

    const duplicateGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
    console.log(`\n⚠️  พบกลุ่มที่ซ้ำกัน ${duplicateGroups.length} กลุ่ม:\n`);

    for (const [key, group] of duplicateGroups) {
        const names = group.map(i => `  - id=${i.id} condition="${i.condition}" stock_qty=${i.stock_qty}`).join('\n');
        console.log(`📦 ${key}\n${names}`);
    }

    if (duplicateGroups.length === 0) {
        console.log('✅ ไม่มีรายการซ้ำ ออกจากโปรแกรมแล้ว');
        return;
    }

    console.log('\n🔄 เริ่ม Merge...\n');
    let mergedCount = 0;
    let deletedCount = 0;

    for (const [key, group] of duplicateGroups) {
        // Survivor = 'สต๊อก' ถ้าไม่มีให้ใช้ตัวที่มี stock_qty มากที่สุด
        const stockItem = group.find(i => i.condition === 'สต๊อก');
        const survivor = stockItem || group.reduce((a, b) => (a.stock_qty > b.stock_qty ? a : b));
        const duplicates = group.filter(i => i.id !== survivor.id);

        console.log(`\n  Survivor: id=${survivor.id} (${survivor.condition}) stock=${survivor.stock_qty}`);
        console.log(`  Duplicates: ${duplicates.map(d => `id=${d.id}(${d.condition}) stock=${d.stock_qty}`).join(', ')}`);

        await prisma.$transaction(async (tx) => {
            // 1. รวม stock_qty เข้า survivor
            const totalExtra = duplicates.reduce((sum, d) => sum + (d.stock_qty || 0), 0);
            if (totalExtra > 0) {
                await tx.masterItem.update({
                    where: { id: survivor.id },
                    data: { stock_qty: { increment: totalExtra } }
                });
                console.log(`    ✅ บวก stock_qty +${totalExtra} เข้า survivor`);
            }

            // 2. Merge WarehouseStock
            for (const dup of duplicates) {
                for (const ds of dup.warehouse_stocks) {
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
                    await tx.warehouseStock.deleteMany({
                        where: { item_id: dup.id, warehouse_id: ds.warehouse_id }
                    });
                }
                console.log(`    ✅ Merge WarehouseStock จาก id=${dup.id} เรียบร้อย`);

                // 3. ย้าย Transactions
                const updated = await tx.transaction.updateMany({
                    where: { item_id: dup.id },
                    data: { item_id: survivor.id }
                });
                console.log(`    ✅ ย้าย ${updated.count} Transactions จาก id=${dup.id} → ${survivor.id}`);

                // 4. ลบ MasterItem ซ้ำ
                await tx.masterItem.delete({ where: { id: dup.id } });
                console.log(`    🗑️  ลบ MasterItem id=${dup.id} (${dup.condition}) แล้ว`);
                deletedCount++;
            }
            mergedCount++;
        });
    }

    console.log(`\n🎉 เสร็จสิ้น! Merge ${mergedCount} กลุ่ม, ลบ ${deletedCount} รายการซ้ำ`);
}

main()
    .catch(e => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
