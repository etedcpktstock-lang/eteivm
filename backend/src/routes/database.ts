import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/permissions';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const router = Router();

// Only SUPER_ADMIN can manage database
router.use(requireRole('SUPER_ADMIN'));

// GET /api/database/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const [userCount, customerCount, jobCount, txnCount, itemCount] = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.job.count(),
      prisma.transaction.count(),
      prisma.masterItem.count(),
    ]);

    return res.json({
      status: 'success',
      counts: {
        users: userCount,
        customers: customerCount,
        jobs: jobCount,
        transactions: txnCount,
        items: itemCount,
      },
      db_url: process.env.DATABASE_URL ? 'Connected (Hidden)' : 'Not Set',
    });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/database/test-connection
router.post('/test-connection', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.json({ status: 'error', message: 'กรุณาระบุ Connection URL' });

  const testPrisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    await testPrisma.$connect();
    // Try a simple query
    await testPrisma.user.count();
    return res.json({ status: 'success', message: 'เชื่อมต่อสำเร็จ!' });
  } catch (err: any) {
    return res.json({ status: 'error', message: `เชื่อมต่อไม่สำเร็จ: ${err.message}` });
  } finally {
    await testPrisma.$disconnect();
  }
});

// POST /api/database/backup
router.post('/backup', async (_req: Request, res: Response) => {
  try {
    const [
      users, permissions, customers, warehouses, items, 
      stocks, inventories, assets, jobs, transactions, 
      zones, settings
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.rolePermission.findMany(),
      prisma.customer.findMany(),
      prisma.warehouse.findMany(),
      prisma.masterItem.findMany(),
      prisma.warehouseStock.findMany(),
      prisma.customerInventory.findMany(),
      prisma.assetUnit.findMany(),
      prisma.job.findMany(),
      prisma.transaction.findMany(),
      prisma.zone.findMany(),
      prisma.systemSetting.findMany(),
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        users, permissions, customers, warehouses, items,
        stocks, inventories, assets, jobs, transactions,
        zones, settings
      }
    };

    return res.json({
      status: 'success',
      filename: `eteivm_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      payload: backupData
    });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/database/import
router.post('/import', async (req: Request, res: Response) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.data) {
    return res.json({ status: 'error', message: 'ไฟล์ข้อมูลไม่ถูกต้อง' });
  }

  const { data } = backupData;

  try {
    await prisma.$transaction(async (tx) => {
      // Clear existing data (DANGEROUS)
      await tx.auditLog.deleteMany();
      await tx.transaction.deleteMany();
      await tx.job.deleteMany();
      await tx.assetUnit.deleteMany();
      await tx.customerInventory.deleteMany();
      await tx.warehouseStock.deleteMany();
      await tx.masterItem.deleteMany();
      await tx.warehouse.deleteMany();
      await tx.customer.deleteMany();
      await tx.zone.deleteMany();
      await tx.user.deleteMany();
      await tx.rolePermission.deleteMany();
      await tx.systemSetting.deleteMany();

      // Restore
      if (data.settings?.length) await tx.systemSetting.createMany({ data: data.settings });
      if (data.permissions?.length) await tx.rolePermission.createMany({ data: data.permissions });
      if (data.users?.length) await tx.user.createMany({ data: data.users });
      if (data.zones?.length) await tx.zone.createMany({ data: data.zones });
      if (data.customers?.length) await tx.customer.createMany({ data: data.customers });
      if (data.warehouses?.length) await tx.warehouse.createMany({ data: data.warehouses });
      if (data.items?.length) await tx.masterItem.createMany({ data: data.items });
      if (data.stocks?.length) await tx.warehouseStock.createMany({ data: data.stocks });
      if (data.inventories?.length) await tx.customerInventory.createMany({ data: data.inventories });
      if (data.assets?.length) await tx.assetUnit.createMany({ data: data.assets });
      if (data.jobs?.length) await tx.job.createMany({ data: data.jobs });
      if (data.transactions?.length) await tx.transaction.createMany({ data: data.transactions });
    });

    return res.json({ status: 'success', message: 'นำเข้าข้อมูลเรียบร้อยแล้ว' });
  } catch (err: any) {
    return res.json({ status: 'error', message: `นำเข้าไม่สำเร็จ: ${err.message}` });
  }
});

// POST /api/database/reset
router.post('/reset', async (_req: Request, res: Response) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Delete everything except Users and Basic settings
      await tx.auditLog.deleteMany();
      await tx.transaction.deleteMany();
      await tx.job.deleteMany();
      await tx.assetUnit.deleteMany();
      await tx.customerInventory.deleteMany();
      await tx.warehouseStock.deleteMany();
      await tx.masterItem.deleteMany();
      await tx.warehouse.deleteMany();
      await tx.customer.deleteMany();
      await tx.zone.deleteMany();
      
      // Optionally reset some settings but keep basic ones
      // Keep: APP_NAME, APP_ICON, etc.
    });

    return res.json({ status: 'success', message: 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว' });
  } catch (err: any) {
    return res.json({ status: 'error', message: err.message });
  }
});

// POST /api/database/save-connection
router.post('/save-connection', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.json({ status: 'error', message: 'กรุณาระบุ Connection URL' });

  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const regex = /^DATABASE_URL=.*$/m;
    const newLine = `DATABASE_URL="${url}"`;

    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, newLine);
    } else {
      envContent += `\n${newLine}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({ 
      status: 'success', 
      message: 'บันทึก Connection เรียบร้อยแล้ว ระบบอาจต้องรีสตาร์ทเพื่อใช้ค่าใหม่' 
    });
  } catch (err: any) {
    return res.json({ status: 'error', message: `บันทึกไม่สำเร็จ: ${err.message}` });
  }
});

export default router;
