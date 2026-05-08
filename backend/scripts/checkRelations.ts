import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const custInvCount = await prisma.customerInventory.count();
    const assetUnitCount = await prisma.assetUnit.count();
    console.log(`CustomerInventory count: ${custInvCount}`);
    console.log(`AssetUnit count: ${assetUnitCount}`);
}

main().finally(() => prisma.$disconnect());
