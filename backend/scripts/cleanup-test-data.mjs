import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const startsWithAny = (s, prefixes) => prefixes.some(p => String(s || '').startsWith(p));
const containsAny = (s, needles) => needles.some(n => String(s || '').includes(n));

const PREFIXES = ['E2E-DEEP-', 'SOT-', 'SMOKE-'];

async function collectTargets() {
  const [jobs, warehouses, customers, items, txns] = await Promise.all([
    prisma.job.findMany({ select: { job_id: true, note: true } }),
    prisma.warehouse.findMany({ select: { id: true, name: true } }),
    prisma.customer.findMany({ select: { cv: true, name: true, address: true } }),
    prisma.masterItem.findMany({ select: { id: true, category: true, brand: true, item_name: true, details: true } }),
    prisma.transaction.findMany({ select: { id: true, job_id: true, note: true, asset_tag: true } }),
  ]);

  const jobIds = jobs
    .filter(j => startsWithAny(j.note, PREFIXES) || containsAny(j.note, ['ทดสอบ', 'deep flow']))
    .map(j => j.job_id);

  const warehouseIds = warehouses
    .filter(w => startsWithAny(w.name, PREFIXES) || /E2E-DEEP-.*-WH/.test(String(w.name || '')))
    .map(w => w.id);

  const customerCvs = customers
    .filter(c => startsWithAny(c.name, PREFIXES) || containsAny(c.name, ['ลูกค้าทดสอบ']) || containsAny(c.address, ['deep flow', 'ทดสอบ']))
    .map(c => c.cv);

  const itemIds = items
    .filter(i =>
      startsWithAny(i.category, PREFIXES) ||
      startsWithAny(i.brand, PREFIXES) ||
      startsWithAny(i.item_name, PREFIXES) ||
      String(i.category || '') === 'SOT_TEST' ||
      String(i.brand || '') === 'SMOKE' ||
      containsAny(i.details, ['source-of-truth regression', 'ทดสอบ'])
    )
    .map(i => i.id);

  const txnIds = txns
    .filter(t =>
      (t.job_id && jobIds.includes(t.job_id)) ||
      startsWithAny(t.note, PREFIXES) ||
      startsWithAny(t.asset_tag, PREFIXES)
    )
    .map(t => t.id);

  return { jobIds, warehouseIds, customerCvs, itemIds, txnIds };
}

async function main() {
  const targets = await collectTargets();

  const summary = {
    jobs: targets.jobIds.length,
    warehouses: targets.warehouseIds.length,
    customers: targets.customerCvs.length,
    items: targets.itemIds.length,
    transactions: targets.txnIds.length,
  };

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', summary, targets }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const delTransactions = targets.txnIds.length
      ? await tx.transaction.deleteMany({ where: { id: { in: targets.txnIds } } })
      : { count: 0 };

    const delJobs = targets.jobIds.length
      ? await tx.job.deleteMany({ where: { job_id: { in: targets.jobIds } } })
      : { count: 0 };

    const delCustomerInventoryByCustomer = targets.customerCvs.length
      ? await tx.customerInventory.deleteMany({ where: { customer_cv: { in: targets.customerCvs } } })
      : { count: 0 };

    const delCustomerInventoryByItem = targets.itemIds.length
      ? await tx.customerInventory.deleteMany({ where: { item_id: { in: targets.itemIds } } })
      : { count: 0 };

    const delAssetUnitsByItem = targets.itemIds.length
      ? await tx.assetUnit.deleteMany({ where: { master_item_id: { in: targets.itemIds } } })
      : { count: 0 };

    const delAssetUnitsByTag = await tx.assetUnit.deleteMany({
      where: {
        OR: PREFIXES.map((p) => ({ asset_tag: { startsWith: p } })),
      },
    });

    const delWarehouseStocksByItem = targets.itemIds.length
      ? await tx.warehouseStock.deleteMany({ where: { item_id: { in: targets.itemIds } } })
      : { count: 0 };

    const delWarehouseStocksByWh = targets.warehouseIds.length
      ? await tx.warehouseStock.deleteMany({ where: { warehouse_id: { in: targets.warehouseIds } } })
      : { count: 0 };

    const delItems = targets.itemIds.length
      ? await tx.masterItem.deleteMany({ where: { id: { in: targets.itemIds } } })
      : { count: 0 };

    const delCustomers = targets.customerCvs.length
      ? await tx.customer.deleteMany({ where: { cv: { in: targets.customerCvs } } })
      : { count: 0 };

    const delWarehouses = targets.warehouseIds.length
      ? await tx.warehouse.deleteMany({ where: { id: { in: targets.warehouseIds } } })
      : { count: 0 };

    return {
      delTransactions: delTransactions.count,
      delJobs: delJobs.count,
      delCustomerInventoryByCustomer: delCustomerInventoryByCustomer.count,
      delCustomerInventoryByItem: delCustomerInventoryByItem.count,
      delAssetUnitsByItem: delAssetUnitsByItem.count,
      delAssetUnitsByTag: delAssetUnitsByTag.count,
      delWarehouseStocksByItem: delWarehouseStocksByItem.count,
      delWarehouseStocksByWh: delWarehouseStocksByWh.count,
      delItems: delItems.count,
      delCustomers: delCustomers.count,
      delWarehouses: delWarehouses.count,
    };
  });

  console.log(JSON.stringify({ mode: 'apply', summary, deleted: result }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
