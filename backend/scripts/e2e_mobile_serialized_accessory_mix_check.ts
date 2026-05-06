import { PrismaClient, TrackingType } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';
const now = Date.now();
const smokeKey = `MOBILE-MIX-ACC-${now}`;
const customerCv = `MIX-ACC-CV-${now}`;
const freezerAssetTags = [`MIX-ACC-AT-${now}-1`, `MIX-ACC-AT-${now}-2`];

const asJson = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (path: string, init: RequestInit = {}, token?: string) => {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await asJson(res);
  return { status: res.status, body };
};

const assert = (condition: any, message: string) => {
  if (!condition) throw new Error(message);
};

async function main() {
  let freezerItemId: number | null = null;
  let accessoryItemId: number | null = null;
  let createdJobIds: string[] = [];
  let warehouseId: number | null = null;

  try {
    const warehouse = await prisma.warehouse.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } });
    assert(warehouse, 'ไม่พบคลังสำหรับทดสอบ');
    warehouseId = warehouse.id;

    await prisma.customer.create({
      data: {
        cv: customerCv,
        name: `ลูกค้าทดสอบ ${smokeKey}`,
        address: 'ที่อยู่ทดสอบ Mobile Serialized + Accessory Mix',
        province: 'ภูเก็ต',
        phone: '0900000000'
      }
    });

    const freezerItem = await prisma.masterItem.create({
      data: {
        category: 'ตู้แช่',
        brand: 'MOBILE-MIX-ACC',
        item_name: `MOBILE FREEZER ${smokeKey}`,
        condition: 'สต็อก',
        details: 'mobile serialized + accessory mix test',
        size: '2 ประตู',
        tracking_type: TrackingType.SERIALIZED,
        stock_qty: 2,
        warehouse_stocks: {
          create: {
            warehouse_id: warehouse.id,
            stock_qty: 2,
            repair_qty: 0,
            scrap_qty: 0,
            lost_qty: 0,
            quarantine_qty: 0,
            transit_qty: 0
          }
        }
      }
    });
    freezerItemId = freezerItem.id;

    const accessoryItem = await prisma.masterItem.create({
      data: {
        category: 'อุปกรณ์',
        brand: 'MOBILE-MIX-ACC',
        item_name: `ตะกร้า ${smokeKey}`,
        condition: 'สต็อก',
        details: 'accessory batch item for mixed mobile flow',
        size: '-',
        tracking_type: TrackingType.BATCH,
        stock_qty: 5,
        warehouse_stocks: {
          create: {
            warehouse_id: warehouse.id,
            stock_qty: 5,
            repair_qty: 0,
            scrap_qty: 0,
            lost_qty: 0,
            quarantine_qty: 0,
            transit_qty: 0
          }
        }
      }
    });
    accessoryItemId = accessoryItem.id;

    const login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert(login.status === 200 && login.body?.status === 'success', `login failed: ${JSON.stringify(login.body)}`);
    const token = login.body.user?.token as string;
    assert(token, 'ไม่พบ token หลัง login');
    const operatorName = login.body.user?.name || 'ผู้ดูแลระบบ';

    const freezerPayload = {
      id: freezerItem.id,
      rowIndex: freezerItem.id,
      ประเภท: 'ตู้แช่',
      ยี่ห้อหรือรูปแบบ: 'MOBILE-MIX-ACC',
      รายการ: freezerItem.item_name,
      สภาพ: 'สต็อก',
      รายละเอียด: freezerItem.details,
      ขนาด: freezerItem.size,
      tracking_type: 'SERIALIZED'
    };

    const accessoryPayload = {
      id: accessoryItem.id,
      rowIndex: accessoryItem.id,
      ประเภท: 'อุปกรณ์',
      ยี่ห้อหรือรูปแบบ: 'MOBILE-MIX-ACC',
      รายการ: accessoryItem.item_name,
      สภาพ: 'สต็อก',
      รายละเอียด: accessoryItem.details,
      ขนาด: accessoryItem.size,
      tracking_type: 'BATCH'
    };

    const jobRequest = await request('/transactions/jobRequest', {
      method: 'POST',
      body: JSON.stringify({
        cv: customerCv,
        deliveryItems: [
          {
            item: freezerPayload,
            quantity: 2,
            assetTags: freezerAssetTags,
            tracking_type: 'SERIALIZED',
            type: 'DELIVERY'
          },
          {
            item: accessoryPayload,
            quantity: 3,
            tracking_type: 'BATCH',
            type: 'DELIVERY'
          }
        ],
        returnItems: [],
        operator: operatorName,
        note: `mobile serialized + accessory mix ${smokeKey}`,
        warehouseId: warehouse.id
      })
    }, token);
    assert(jobRequest.body?.status === 'success', `jobRequest failed: ${JSON.stringify(jobRequest.body)}`);
    const jobId = jobRequest.body.jobId as string;
    createdJobIds.push(jobId);
    assert(jobId, 'jobRequest ไม่คืน jobId');

    const issue = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'issue',
        status: 'กำลังเดินทาง',
        items: [
          {
            item: freezerPayload,
            id: freezerItem.id,
            rowIndex: freezerItem.id,
            quantity: 2,
            จำนวน: 2,
            assetTags: freezerAssetTags,
            tracking_type: 'SERIALIZED',
            status: 'กำลังเดินทาง'
          },
          {
            item: accessoryPayload,
            id: accessoryItem.id,
            rowIndex: accessoryItem.id,
            quantity: 3,
            จำนวน: 3,
            tracking_type: 'BATCH',
            status: 'กำลังเดินทาง'
          }
        ],
        cv: customerCv,
        jobId,
        txnNo: jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `issue mixed accessory ${smokeKey}`
      })
    }, token);
    assert(issue.body?.status === 'success', `issue failed: ${JSON.stringify(issue.body)}`);

    const freezerAfterIssue = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: freezerItem.id, warehouse_id: warehouse.id } }
    });
    const accessoryAfterIssue = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: accessoryItem.id, warehouse_id: warehouse.id } }
    });

    assert(freezerAfterIssue.stock_qty === 0, `freezer หลัง issue stock_qty ควรเป็น 0 แต่ได้ ${freezerAfterIssue.stock_qty}`);
    assert(freezerAfterIssue.transit_qty === 2, `freezer หลัง issue transit_qty ควรเป็น 2 แต่ได้ ${freezerAfterIssue.transit_qty}`);
    assert(accessoryAfterIssue.stock_qty === 2, `accessory หลัง issue stock_qty ควรเป็น 2 แต่ได้ ${accessoryAfterIssue.stock_qty}`);
    assert(accessoryAfterIssue.transit_qty === 3, `accessory หลัง issue transit_qty ควรเป็น 3 แต่ได้ ${accessoryAfterIssue.transit_qty}`);

    const mobileFulfillItems = [
      ...freezerAssetTags.map((tag, idx) => ({
        item: freezerPayload,
        id: freezerItem.id,
        rowIndex: freezerItem.id,
        quantity: 1,
        จำนวน: 1,
        serialNumber: tag,
        assetTag: tag,
        assetTags: [tag],
        tracking_type: 'SERIALIZED',
        status: 'ส่งมอบเรียบร้อย',
        cabinetCondition: 'ปกติ',
        _mobileRow: idx + 1
      })),
      {
        item: accessoryPayload,
        id: accessoryItem.id,
        rowIndex: accessoryItem.id,
        quantity: 3,
        จำนวน: 3,
        tracking_type: 'BATCH',
        status: 'ส่งมอบเรียบร้อย',
        cabinetCondition: 'ปกติ'
      }
    ];

    const fulfill = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'fulfill',
        status: 'ส่งมอบงานสำเร็จเรียบร้อย',
        items: mobileFulfillItems,
        cv: customerCv,
        jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `mobile fulfill mixed accessory ${smokeKey}`
      })
    }, token);
    assert(fulfill.body?.status === 'success', `fulfill failed: ${JSON.stringify(fulfill.body)}`);

    const freezerAfterFulfill = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: freezerItem.id, warehouse_id: warehouse.id } }
    });
    const accessoryAfterFulfill = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: accessoryItem.id, warehouse_id: warehouse.id } }
    });
    const freezerInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: freezerItem.id } }
    });
    const accessoryInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: accessoryItem.id } }
    });
    const freezerUnits = await prisma.assetUnit.findMany({
      where: { asset_tag: { in: freezerAssetTags } },
      orderBy: { asset_tag: 'asc' }
    });

    assert(freezerAfterFulfill.transit_qty === 0, `freezer หลัง fulfill transit_qty ควรเป็น 0 แต่ได้ ${freezerAfterFulfill.transit_qty}`);
    assert(accessoryAfterFulfill.transit_qty === 0, `accessory หลัง fulfill transit_qty ควรเป็น 0 แต่ได้ ${accessoryAfterFulfill.transit_qty}`);
    assert(freezerInventory?.quantity === 2, `freezer customer inventory ควรเป็น 2 แต่ได้ ${freezerInventory?.quantity}`);
    assert(accessoryInventory?.quantity === 3, `accessory customer inventory ควรเป็น 3 แต่ได้ ${accessoryInventory?.quantity}`);
    assert(freezerUnits.length === 2, `ควรมี freezer asset units 2 รายการ แต่ได้ ${freezerUnits.length}`);
    const wrongFreezerUnits = freezerUnits.filter((u) => u.status !== 'with_customer' || u.holder_customer_cv !== customerCv);
    assert(wrongFreezerUnits.length === 0, `มี freezer asset units ที่สถานะไม่ถูกต้อง: ${JSON.stringify(wrongFreezerUnits)}`);

    console.log(JSON.stringify({
      ok: true,
      smokeKey,
      warehouseId,
      customerCv,
      freezerItemId: freezerItem.id,
      accessoryItemId: accessoryItem.id,
      checks: {
        afterIssue: {
          freezer: {
            stock_qty: freezerAfterIssue.stock_qty,
            transit_qty: freezerAfterIssue.transit_qty
          },
          accessory: {
            stock_qty: accessoryAfterIssue.stock_qty,
            transit_qty: accessoryAfterIssue.transit_qty
          }
        },
        afterFulfill: {
          freezer: {
            transit_qty: freezerAfterFulfill.transit_qty,
            customer_inventory: freezerInventory?.quantity || 0,
            units: freezerUnits.map((u) => ({
              asset_tag: u.asset_tag,
              status: u.status,
              holder_customer_cv: u.holder_customer_cv
            }))
          },
          accessory: {
            transit_qty: accessoryAfterFulfill.transit_qty,
            customer_inventory: accessoryInventory?.quantity || 0
          }
        }
      }
    }, null, 2));
  } finally {
    await prisma.$transaction(async (tx) => {
      if (createdJobIds.length > 0) await tx.transaction.deleteMany({ where: { job_id: { in: createdJobIds } } });
      await tx.transaction.deleteMany({ where: { asset_tag: { in: freezerAssetTags } } });
      await tx.customerInventory.deleteMany({ where: { customer_cv: customerCv } });
      await tx.assetUnit.deleteMany({ where: { asset_tag: { in: freezerAssetTags } } });
      if (freezerItemId) await tx.warehouseStock.deleteMany({ where: { item_id: freezerItemId } });
      if (accessoryItemId) await tx.warehouseStock.deleteMany({ where: { item_id: accessoryItemId } });
      if (freezerItemId) await tx.masterItem.deleteMany({ where: { id: freezerItemId } });
      if (accessoryItemId) await tx.masterItem.deleteMany({ where: { id: accessoryItemId } });
      if (createdJobIds.length > 0) await tx.job.deleteMany({ where: { job_id: { in: createdJobIds } } });
      await tx.customer.deleteMany({ where: { cv: customerCv } });
    }).catch((cleanupErr) => {
      console.error('cleanup_failed', cleanupErr);
    });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
