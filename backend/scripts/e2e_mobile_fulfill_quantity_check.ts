import { PrismaClient, TrackingType } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';
const now = Date.now();
const smokeKey = `MOBILE-FULFILL-${now}`;
const customerCv = `MOBILE-CV-${now}`;
const assetTags = [`AT-${now}-1`, `AT-${now}-2`, `AT-${now}-3`];

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
  let createdItemId: number | null = null;
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
        address: 'ที่อยู่ทดสอบ Mobile Fulfill',
        province: 'ภูเก็ต',
        phone: '0900000000'
      }
    });

    const item = await prisma.masterItem.create({
      data: {
        category: 'ตู้แช่',
        brand: 'MOBILE-QA',
        item_name: `MOBILE FULFILL TEST ${smokeKey}`,
        condition: 'สต็อก',
        details: 'mobile fulfill qty integrity test',
        size: '1 ประตู',
        tracking_type: TrackingType.SERIALIZED,
        stock_qty: 3,
        warehouse_stocks: {
          create: {
            warehouse_id: warehouse.id,
            stock_qty: 3,
            repair_qty: 0,
            scrap_qty: 0,
            lost_qty: 0,
            quarantine_qty: 0,
            transit_qty: 0
          }
        }
      }
    });
    createdItemId = item.id;

    const login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert(login.status === 200 && login.body?.status === 'success', `login failed: ${JSON.stringify(login.body)}`);
    const token = login.body.user?.token as string;
    assert(token, 'ไม่พบ token หลัง login');
    const operatorName = login.body.user?.name || 'ผู้ดูแลระบบ';

    const itemPayload = {
      id: item.id,
      rowIndex: item.id,
      ประเภท: 'ตู้แช่',
      ยี่ห้อหรือรูปแบบ: 'MOBILE-QA',
      รายการ: item.item_name,
      สภาพ: 'สต็อก',
      รายละเอียด: item.details,
      ขนาด: item.size,
      tracking_type: 'SERIALIZED'
    };

    const jobRequest = await request('/transactions/jobRequest', {
      method: 'POST',
      body: JSON.stringify({
        cv: customerCv,
        deliveryItems: [{
          item: itemPayload,
          quantity: 3,
          assetTags,
          tracking_type: 'SERIALIZED',
          type: 'DELIVERY'
        }],
        returnItems: [],
        operator: operatorName,
        note: `mobile fulfill qty check ${smokeKey}`,
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
        items: [{
          item: itemPayload,
          id: item.id,
          rowIndex: item.id,
          quantity: 3,
          จำนวน: 3,
          assetTags,
          tracking_type: 'SERIALIZED',
          status: 'กำลังเดินทาง'
        }],
        cv: customerCv,
        jobId,
        txnNo: jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `issue ${smokeKey}`
      })
    }, token);
    assert(issue.body?.status === 'success', `issue failed: ${JSON.stringify(issue.body)}`);

    const afterIssueStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    assert(afterIssueStock.stock_qty === 0, `หลัง issue stock_qty ควรเป็น 0 แต่ได้ ${afterIssueStock.stock_qty}`);
    assert(afterIssueStock.transit_qty === 3, `หลัง issue transit_qty ควรเป็น 3 แต่ได้ ${afterIssueStock.transit_qty}`);

    // จำลอง payload แบบเดียวกับ mobile/FulfillmentForm.tsx หลัง fix: 1 แถวต่อ 1 asset tag
    const mobileFulfillItems = assetTags.map((tag, idx) => ({
      item: itemPayload,
      id: item.id,
      rowIndex: item.id,
      quantity: 1,
      จำนวน: 1,
      serialNumber: tag,
      assetTag: tag,
      assetTags: [tag],
      tracking_type: 'SERIALIZED',
      status: 'ส่งมอบเรียบร้อย',
      cabinetCondition: 'ปกติ',
      _mobileRow: idx + 1
    }));

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
        note: `mobile fulfill ${smokeKey}`
      })
    }, token);
    assert(fulfill.body?.status === 'success', `fulfill failed: ${JSON.stringify(fulfill.body)}`);

    const afterFulfillStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const customerInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } }
    });
    const units = await prisma.assetUnit.findMany({
      where: { asset_tag: { in: assetTags } },
      orderBy: { asset_tag: 'asc' }
    });
    const history = await request('/transactions', { method: 'GET' }, token);
    const historyRows = Array.isArray(history.body)
      ? history.body.filter((row: any) => row.job_id === jobId || assetTags.includes(row.asset_tag || row.assetTag))
      : [];

    assert(afterFulfillStock.transit_qty === 0, `หลัง fulfill transit_qty ควรเป็น 0 แต่ได้ ${afterFulfillStock.transit_qty}`);
    assert(customerInventory?.quantity === 3, `หลัง fulfill customer inventory ควรเป็น 3 แต่ได้ ${customerInventory?.quantity}`);
    assert(units.length === 3, `ควรมี asset units 3 รายการ แต่ได้ ${units.length}`);
    const wrongUnits = units.filter((u) => u.status !== 'with_customer' || u.holder_customer_cv !== customerCv);
    assert(wrongUnits.length === 0, `มี asset units ที่ยังไม่ถึงลูกค้าครบ: ${JSON.stringify(wrongUnits)}`);

    console.log(JSON.stringify({
      ok: true,
      smokeKey,
      warehouseId,
      customerCv,
      itemId: item.id,
      assetTags,
      checks: {
        afterIssue: {
          stock_qty: afterIssueStock.stock_qty,
          transit_qty: afterIssueStock.transit_qty
        },
        afterFulfill: {
          transit_qty: afterFulfillStock.transit_qty,
          customer_inventory: customerInventory?.quantity || 0,
          units: units.map((u) => ({
            asset_tag: u.asset_tag,
            status: u.status,
            holder_customer_cv: u.holder_customer_cv
          })),
          history_rows: historyRows.length
        }
      }
    }, null, 2));
  } finally {
    await prisma.$transaction(async (tx) => {
      if (createdJobIds.length > 0) await tx.transaction.deleteMany({ where: { job_id: { in: createdJobIds } } });
      await tx.transaction.deleteMany({ where: { asset_tag: { in: assetTags } } });
      await tx.customerInventory.deleteMany({ where: { customer_cv: customerCv } });
      await tx.assetUnit.deleteMany({ where: { asset_tag: { in: assetTags } } });
      if (createdItemId) await tx.warehouseStock.deleteMany({ where: { item_id: createdItemId } });
      if (createdItemId) await tx.masterItem.deleteMany({ where: { id: createdItemId } });
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
