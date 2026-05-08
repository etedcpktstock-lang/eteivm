import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const items = await prisma.masterItem.findMany({
        where: { brand: { contains: 'LIEBHERR' } },
        include: { warehouse_stocks: true }
    });
    console.log(`พบ LIEBHERR ${items.length} รายการ:`);
    items.forEach(i => {
        console.log(`  id=${i.id} | ${i.size} | condition="${i.condition}" | stock_qty=${i.stock_qty}`);
    });
}

main().finally(() => prisma.$disconnect());
