import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const types = await prisma.transaction.groupBy({
        by: ['action_type']
    });
    console.log(JSON.stringify(types, null, 2));
}

main().finally(() => prisma.$disconnect());
