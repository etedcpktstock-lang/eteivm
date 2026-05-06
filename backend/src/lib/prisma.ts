import { PrismaClient } from '@prisma/client';

// Singleton pattern สำหรับ PrismaClient
// ป้องกันการสร้าง Connection Pool ซ้ำระหว่าง Hot Reload

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
