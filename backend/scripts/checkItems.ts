import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const items = await prisma.masterItem.findMany({
        where: { condition: { contains: 'ใหม่' } },
        include: { warehouse_stocks: true }
    });
    console.log(`พบ ${items.length} รายการที่มีสภาพ "ใหม่":`);
    items.forEach(i => {
        console.log(`  id=${i.id} | ${i.category} ${i.brand} ${i.item_name} ${i.size} | condition="${i.condition}" | stock_qty=${i.stock_qty}`);
        i.warehouse_stocks.forEach(w => {
            console.log(`    → warehouse_id=${w.warehouse_id} stock=${w.stock_qty} transit=${w.transit_qty} quarantine=${w.quarantine_qty}`);
        });
    });

    const allItems = await prisma.masterItem.findMany({ select: { id: true, condition: true, item_name: true, stock_qty: true } });
    console.log(`\nทั้งหมด ${allItems.length} รายการในระบบ:`);
    allItems.forEach(i => console.log(`  id=${i.id} | ${i.item_name} | condition="${i.condition}" | stock=${i.stock_qty}`));
}

main().finally(() => prisma.$disconnect());
