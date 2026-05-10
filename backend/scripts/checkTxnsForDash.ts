import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const txns = await prisma.transaction.findMany({
        take: 5,
        orderBy: { created_at: 'desc' }
    });
    console.log(JSON.stringify(txns, null, 2));
}

main().finally(() => prisma.$disconnect());
