/* eslint-disable no-console */
require('dotenv').config({ path: '.env' });

const path = require('path');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require(path.resolve(__dirname, '../../frontend/node_modules/exceljs'));

const prisma = new PrismaClient();

const inputFile = process.argv[2] || '/mnt/c/Users/Rocket Star/Desktop/ETEIVM/LABTEST_Data_ete_pk_dc_ims.xlsx';

function v(row, idx) {
  const raw = row.getCell(idx).value;
  if (raw == null) return '';
  if (typeof raw === 'object') {
    if (raw.text != null) return String(raw.text).trim();
    if (raw.result != null) return String(raw.result).trim();
    if (raw.richText && Array.isArray(raw.richText)) return raw.richText.map((x) => x.text || '').join('').trim();
  }
  return String(raw).trim();
}

function num(row, idx, def = 0) {
  const s = v(row, idx).replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

function dt(row, idx) {
  const raw = row.getCell(idx).value;
  if (raw instanceof Date) return raw;
  const s = v(row, idx);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nz(s) {
  const t = String(s || '').trim();
  return t.length ? t : null;
}

function itemKey(category, brand, itemName, condition, details, size) {
  return [category || '', brand || '', itemName || '', condition || '', details || '', size || '']
    .map((x) => String(x).trim().toLowerCase())
    .join('||');
}

function inferJobType(actionType) {
  const s = String(actionType || '');
  if (s.includes('คืน')) return 'RETURN';
  if (s.includes('ส่ง') || s.includes('เบิก')) return 'DELIVERY';
  return 'MIXED';
}

function inferJobStatus(actionType) {
  const s = String(actionType || '');
  if (s.includes('ยกเลิก')) return 'CANCELLED';
  return 'COMPLETED';
}

async function main() {
  console.log('📥 Import file:', inputFile);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inputFile);

  const wsUsers = wb.getWorksheet('Users');
  const wsPerms = wb.getWorksheet('Permissions');
  const wsSettings = wb.getWorksheet('Settings');
  const wsZones = wb.getWorksheet('Zones');
  const wsCustomers = wb.getWorksheet('Customers');
  const wsData = wb.getWorksheet('data');
  const wsTx = wb.getWorksheet('Transactions');

  if (!wsData) throw new Error('ไม่พบชีต data');

  console.log('🧹 Clearing old data...');
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.job.deleteMany();
  await prisma.customerInventory.deleteMany();
  await prisma.warehouseStock.deleteMany();
  await prisma.masterItem.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.warehouse.deleteMany();

  const warehouse = await prisma.warehouse.create({
    data: { name: 'คลังหลัก', is_active: true }
  });

  // Users
  const users = [];
  if (wsUsers) {
    for (let r = 2; r <= wsUsers.rowCount; r++) {
      const row = wsUsers.getRow(r);
      const username = v(row, 1);
      if (!username) continue;
      users.push({
        username,
        password: v(row, 2) || '1234',
        name: v(row, 3) || username,
        role: (v(row, 4) || 'staff').toLowerCase()
      });
    }
  }

  const adminIdx = users.findIndex((u) => u.username === 'admin');
  if (adminIdx === -1) {
    users.unshift({ username: 'admin', password: 'admin123', name: 'ผู้ดูแลระบบ', role: 'admin' });
  } else {
    users[adminIdx] = { ...users[adminIdx], password: 'admin123', name: users[adminIdx].name || 'ผู้ดูแลระบบ', role: 'admin' };
  }

  const seenUsers = new Set();
  for (const u of users) {
    if (seenUsers.has(u.username)) continue;
    seenUsers.add(u.username);
    await prisma.user.upsert({
      where: { username: u.username },
      create: u,
      update: { password: u.password, name: u.name, role: u.role }
    });
  }

  const allUsers = await prisma.user.findMany();
  const userByUsername = new Map(allUsers.map((u) => [u.username, u]));
  const userByName = new Map(allUsers.map((u) => [u.name, u]));
  const adminUser = userByUsername.get('admin') || allUsers[0];

  // Permissions
  if (wsPerms) {
    for (let r = 2; r <= wsPerms.rowCount; r++) {
      const row = wsPerms.getRow(r);
      const role = v(row, 1);
      const jsonText = v(row, 2);
      if (!role) continue;
      let permissions = {};
      try { permissions = jsonText ? JSON.parse(jsonText) : {}; } catch { permissions = {}; }
      const roleKey = role.toLowerCase();
      await prisma.rolePermission.upsert({
        where: { role: roleKey },
        create: { role: roleKey, permissions },
        update: { permissions }
      });
    }
  }

  // Settings
  if (wsSettings) {
    for (let r = 2; r <= wsSettings.rowCount; r++) {
      const row = wsSettings.getRow(r);
      const key = v(row, 1);
      const value = v(row, 2);
      if (!key) continue;
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: value || '' },
        update: { value: value || '' }
      });
    }
  }

  // Zones
  const zoneSet = new Set();
  if (wsZones) {
    for (let r = 2; r <= wsZones.rowCount; r++) {
      const row = wsZones.getRow(r);
      const name = v(row, 1);
      if (!name || zoneSet.has(name)) continue;
      zoneSet.add(name);
      await prisma.zone.create({ data: { name, details: nz(v(row, 2)) } });
    }
  }

  // Customers
  if (wsCustomers) {
    for (let r = 2; r <= wsCustomers.rowCount; r++) {
      const row = wsCustomers.getRow(r);
      const cv = v(row, 1);
      if (!cv) continue;
      await prisma.customer.upsert({
        where: { cv },
        create: {
          cv,
          name: v(row, 2) || cv,
          phone: nz(v(row, 3)),
          address: nz(v(row, 4)),
          sub_district: nz(v(row, 5)),
          district: nz(v(row, 6)),
          province: nz(v(row, 7)),
          zipcode: nz(v(row, 8)),
          latitude: Number.isFinite(Number(v(row, 9))) ? Number(v(row, 9)) : null,
          longitude: Number.isFinite(Number(v(row, 10))) ? Number(v(row, 10)) : null
        },
        update: {
          name: v(row, 2) || cv,
          phone: nz(v(row, 3)),
          address: nz(v(row, 4)),
          sub_district: nz(v(row, 5)),
          district: nz(v(row, 6)),
          province: nz(v(row, 7)),
          zipcode: nz(v(row, 8)),
          latitude: Number.isFinite(Number(v(row, 9))) ? Number(v(row, 9)) : null,
          longitude: Number.isFinite(Number(v(row, 10))) ? Number(v(row, 10)) : null
        }
      });
    }
  }

  // Master Items + Warehouse Stock
  const itemMap = new Map();
  for (let r = 2; r <= wsData.rowCount; r++) {
    const row = wsData.getRow(r);
    const category = v(row, 1);
    if (!category) continue;
    const brand = v(row, 2);
    const itemName = v(row, 3) || category;
    const condition = v(row, 4);
    const details = v(row, 5);
    const size = v(row, 6);
    const qty = Math.max(0, Math.floor(num(row, 7, 0)));

    const key = itemKey(category, brand, itemName, condition, details, size);
    if (itemMap.has(key)) {
      const prev = itemMap.get(key);
      prev.qty += qty;
      await prisma.masterItem.update({
        where: { id: prev.id },
        data: { stock_qty: { increment: qty } }
      });
      await prisma.warehouseStock.update({
        where: { item_id_warehouse_id: { item_id: prev.id, warehouse_id: warehouse.id } },
        data: { stock_qty: { increment: qty } }
      });
      continue;
    }

    const created = await prisma.masterItem.create({
      data: {
        category,
        brand: nz(brand),
        item_name: nz(itemName),
        condition: nz(condition),
        details: nz(details),
        size: nz(size),
        stock_qty: qty
      }
    });

    await prisma.warehouseStock.create({
      data: {
        item_id: created.id,
        warehouse_id: warehouse.id,
        stock_qty: qty,
        repair_qty: 0,
        scrap_qty: 0,
        lost_qty: 0,
        quarantine_qty: 0,
        transit_qty: 0
      }
    });

    itemMap.set(key, { id: created.id, qty });
  }

  // Transactions + Jobs (legacy history)
  const existingCustomer = new Set((await prisma.customer.findMany({ select: { cv: true } })).map((c) => c.cv));
  const existingZones = new Set((await prisma.zone.findMany({ select: { name: true } })).map((z) => z.name));
  const jobCache = new Set();

  if (wsTx) {
    for (let r = 2; r <= wsTx.rowCount; r++) {
      const row = wsTx.getRow(r);
      const txnNo = v(row, 1);
      const createdAt = dt(row, 2) || new Date();
      const operatorName = v(row, 3);
      const actionType = v(row, 4) || 'เบิกออก';

      const category = v(row, 5);
      const brand = v(row, 6);
      const itemName = v(row, 7) || category;
      const condition = v(row, 8);
      const details = v(row, 9);
      const size = v(row, 10);
      const qty = Math.abs(Math.floor(num(row, 11, 0))) || 1;

      const cv = v(row, 12);
      const deliveryBy = v(row, 13);
      const note = v(row, 15);
      const zoneName = v(row, 16);
      const notifier = v(row, 17);
      const notificationDate = dt(row, 18);
      const returnReason = v(row, 19);
      const cabinetStatus = v(row, 20);

      const key = itemKey(category, brand, itemName, condition, details, size);
      const mappedItem = itemMap.get(key);

      const op = userByName.get(operatorName) || userByUsername.get(operatorName) || adminUser;

      let jobId = txnNo || null;
      if (jobId && !jobCache.has(jobId)) {
        await prisma.job.create({
          data: {
            job_id: jobId,
            customer_cv: existingCustomer.has(cv) ? cv : null,
            job_type: inferJobType(actionType),
            operator_id: op.id,
            status: inferJobStatus(actionType),
            note: nz(note),
            created_at: createdAt,
            delivery_by: nz(deliveryBy),
            notifier: nz(notifier),
            notification_date: notificationDate,
            appointment_date: null,
            warehouse_id: warehouse.id
          }
        });
        jobCache.add(jobId);
      }

      await prisma.transaction.create({
        data: {
          job_id: jobId,
          item_id: mappedItem ? mappedItem.id : null,
          operator_id: op.id,
          action_type: actionType,
          quantity: qty,
          zone_name: existingZones.has(zoneName) ? zoneName : null,
          return_reason: nz(returnReason),
          cabinet_status: nz(cabinetStatus),
          note: nz(note),
          created_at: createdAt,
          delivery_by: nz(deliveryBy),
          warehouse_id: warehouse.id
        }
      });
    }
  }

  const [userCount, customerCount, itemCount, stockCount, zoneCount, settingCount, permCount, jobCount, txnCount] = await Promise.all([
    prisma.user.count(),
    prisma.customer.count(),
    prisma.masterItem.count(),
    prisma.warehouseStock.count(),
    prisma.zone.count(),
    prisma.systemSetting.count(),
    prisma.rolePermission.count(),
    prisma.job.count(),
    prisma.transaction.count()
  ]);

  console.log('✅ Import completed');
  console.log({ userCount, customerCount, itemCount, stockCount, zoneCount, settingCount, permCount, jobCount, txnCount });
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
