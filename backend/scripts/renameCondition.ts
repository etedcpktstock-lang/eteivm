import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 กำลังเปลี่ยนชื่อสภาพ "ตู้ใหม่" / "ผู้ใหม่" ให้เป็น "ใหม่" ตามมาตรฐาน...');

    // 1. Update MasterItem
    const updatedItems = await prisma.masterItem.updateMany({
        where: {
            condition: { in: ['ตู้ใหม่', 'ผู้ใหม่'] }
        },
        data: {
            condition: 'ใหม่'
        }
    });
    console.log(`✅ อัปเดต MasterItem ไปแล้ว ${updatedItems.count} รายการ`);

    // 2. (Optional) Update Transactions just for consistency
    const updatedTxns = await prisma.transaction.updateMany({
        where: {
            cabinet_status: { in: ['ตู้ใหม่', 'ผู้ใหม่'] }
        },
        data: {
            cabinet_status: 'ใหม่'
        }
    });
    console.log(`✅ อัปเดต Transaction (cabinet_status) ไปแล้ว ${updatedTxns.count} รายการ`);

    console.log('\n🎉 เรียบร้อย!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
