/**
 * Restore "ตู้ใหม่" / "ผู้ใหม่" from screenshot data
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const manualRestores = [
        { brand: 'SANYO', size: '75 cm', condition: 'ผู้ใหม่', qty: 3 },
        { brand: 'LIEBHERR', size: '75 cm', condition: 'ผู้ใหม่', qty: 8 },
        { brand: 'LIEBHERR', size: '84 cm', condition: 'ผู้ใหม่', qty: 19 },
        { brand: 'LIEBHERR', size: '105 cm', condition: 'ผู้ใหม่', qty: 18 },
        { brand: 'LIEBHERR', size: '126 cm', condition: 'ตู้ใหม่', qty: 9 },
        { brand: 'LIEBHERR', size: '170 cm', condition: 'ตู้ใหม่', qty: 0 },
        { brand: 'LIEBHERR', size: '56 cm', condition: 'ตู้ใหม่', qty: 20 },
    ];

    console.log('🔄 เริ่ม Restore รายการจาก Screenshot...');

    for (const data of manualRestores) {
        // หาตัว Survivor (สต๊อก) ที่มีแบรนด์และขนาดตรงกัน
        const survivor = await prisma.masterItem.findFirst({
            where: {
                category: { contains: 'ตู้แช่' },
                brand: { contains: data.brand },
                size: { contains: data.size },
                condition: 'สต๊อก'
            },
            include: { warehouse_stocks: true }
        });

        if (survivor) {
            console.log(`\nเจอ Survivor: id=${survivor.id} | ${survivor.brand} ${survivor.size} | stock=${survivor.stock_qty}`);
            
            // เช็คว่าสร้างไปแล้วหรือยัง
            const existing = await prisma.masterItem.findFirst({
                where: {
                    category: survivor.category,
                    brand: survivor.brand,
                    size: survivor.size,
                    condition: data.condition
                }
            });

            if (existing) {
                console.log(`  -> มี ${data.condition} อยู่แล้ว (id=${existing.id}) ข้าม...`);
                continue;
            }

            await prisma.$transaction(async (tx) => {
                // 1. ลด stock_qty ของ survivor ลงเท่ากับจำนวนตู้ใหม่ (ถ้า survivor มีพอลด)
                const deduct = Math.min(survivor.stock_qty, data.qty);
                if (deduct > 0) {
                    await tx.masterItem.update({
                        where: { id: survivor.id },
                        data: { stock_qty: { decrement: deduct } }
                    });
                }

                // 2. สร้างตู้ใหม่
                const restored = await tx.masterItem.create({
                    data: {
                        category: survivor.category,
                        brand: survivor.brand,
                        item_name: survivor.item_name,
                        size: survivor.size,
                        condition: data.condition, // ใช้ตู้ใหม่ หรือ ผู้ใหม่
                        details: survivor.details || '',
                        stock_qty: data.qty,
                    }
                });
                console.log(`  -> ✅ สร้าง ${data.condition} สำเร็จ (id=${restored.id}) | ยอด=${data.qty}`);

                // 3. ย้าย stock ใน warehouse_stocks
                if (data.qty > 0) {
                    let remainingToMove = deduct; // ย้ายได้เท่าที่ deduct ได้จริง
                    for (const ws of survivor.warehouse_stocks) {
                        if (remainingToMove <= 0) break;
                        const moveQty = Math.min(ws.stock_qty, remainingToMove);
                        if (moveQty > 0) {
                            await tx.warehouseStock.create({
                                data: {
                                    item_id: restored.id,
                                    warehouse_id: ws.warehouse_id,
                                    stock_qty: moveQty,
                                    transit_qty: 0, quarantine_qty: 0, repair_qty: 0, scrap_qty: 0, lost_qty: 0
                                }
                            });
                            await tx.warehouseStock.update({
                                where: { item_id_warehouse_id: { item_id: survivor.id, warehouse_id: ws.warehouse_id } },
                                data: { stock_qty: { decrement: moveQty } }
                            });
                            remainingToMove -= moveQty;
                            console.log(`  -> ✅ ดึงยอด ${moveQty} ชิ้น จากคลัง ${ws.warehouse_id}`);
                        }
                    }
                }
            });
        } else {
            console.log(`\n❌ ไม่เจอ Survivor สำหรับ ${data.brand} ${data.size}`);
        }
    }
    
    // สำรอง: สร้างสภาพ "ตู้ใหม่" เปล่าๆ (ยอด 0) ให้กับตู้แช่ทุกรุ่นที่ยังไม่มี
    const allFreezers = await prisma.masterItem.findMany({
        where: { category: { contains: 'ตู้แช่' }, condition: 'สต๊อก' }
    });
    
    let createdEmptyCount = 0;
    for (const freezer of allFreezers) {
        const hasNew = await prisma.masterItem.findFirst({
            where: {
                category: freezer.category,
                brand: freezer.brand,
                item_name: freezer.item_name,
                size: freezer.size,
                condition: { in: ['ใหม่', 'ตู้ใหม่', 'ผู้ใหม่'] }
            }
        });
        
        if (!hasNew) {
            await prisma.masterItem.create({
                data: {
                    category: freezer.category,
                    brand: freezer.brand,
                    item_name: freezer.item_name,
                    size: freezer.size,
                    condition: 'ตู้ใหม่',
                    details: freezer.details || '',
                    stock_qty: 0,
                }
            });
            createdEmptyCount++;
        }
    }
    console.log(`\n✅ สร้างสภาพ 'ตู้ใหม่' สำรองเพิ่มอีก ${createdEmptyCount} รุ่น`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
