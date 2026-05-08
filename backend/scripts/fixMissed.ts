import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    await prisma.$transaction(async (tx) => {
        // 105cm (id=102) -> id=231
        const item102 = await tx.masterItem.findUnique({ where: { id: 102 }, include: { warehouse_stocks: true } });
        if (item102 && item102.stock_qty >= 15) {
            await tx.masterItem.update({ where: { id: 102 }, data: { stock_qty: { decrement: 15 } } });
            await tx.masterItem.update({ where: { id: 231 }, data: { condition: 'ผู้ใหม่', stock_qty: { increment: 15 } } });
            
            // Transfer 15 warehouse stock (assuming warehouse 3 has it)
            const ws = item102.warehouse_stocks.find(w => w.stock_qty >= 15) || item102.warehouse_stocks[0];
            if (ws) {
                await tx.warehouseStock.update({ where: { item_id_warehouse_id: { item_id: 102, warehouse_id: ws.warehouse_id } }, data: { stock_qty: { decrement: 15 } } });
                await tx.warehouseStock.upsert({
                    where: { item_id_warehouse_id: { item_id: 231, warehouse_id: ws.warehouse_id } },
                    update: { stock_qty: { increment: 15 } },
                    create: { item_id: 231, warehouse_id: ws.warehouse_id, stock_qty: 15, transit_qty: 0, quarantine_qty: 0, repair_qty: 0, scrap_qty: 0, lost_qty: 0 }
                });
            }
            console.log('Restored 105cm');
        }

        // 126cm (id=103) -> id=232
        const item103 = await tx.masterItem.findUnique({ where: { id: 103 }, include: { warehouse_stocks: true } });
        if (item103 && item103.stock_qty >= 9) {
            await tx.masterItem.update({ where: { id: 103 }, data: { stock_qty: { decrement: 9 } } });
            await tx.masterItem.update({ where: { id: 232 }, data: { stock_qty: { increment: 9 } } });
            
            const ws = item103.warehouse_stocks.find(w => w.stock_qty >= 9) || item103.warehouse_stocks[0];
            if (ws) {
                await tx.warehouseStock.update({ where: { item_id_warehouse_id: { item_id: 103, warehouse_id: ws.warehouse_id } }, data: { stock_qty: { decrement: 9 } } });
                await tx.warehouseStock.upsert({
                    where: { item_id_warehouse_id: { item_id: 232, warehouse_id: ws.warehouse_id } },
                    update: { stock_qty: { increment: 9 } },
                    create: { item_id: 232, warehouse_id: ws.warehouse_id, stock_qty: 9, transit_qty: 0, quarantine_qty: 0, repair_qty: 0, scrap_qty: 0, lost_qty: 0 }
                });
            }
            console.log('Restored 126cm');
        }
    });
}

main().finally(() => prisma.$disconnect());
