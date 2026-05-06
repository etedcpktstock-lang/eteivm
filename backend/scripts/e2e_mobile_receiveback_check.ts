import { PrismaClient, TrackingType, AssetUnitStatus } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';
const now = Date.now();
const smokeKey = `MOBILE-RECEIVEBACK-${now}`;
const customerCv = `RECEIVEBACK-CV-${now}`;
const assetTag = `RECEIVEBACK-AT-${now}`;

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

  try {
    const warehouse = await prisma.warehouse.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } });
    assert(warehouse, 'ไม่พบคลังสำหรับทดสอบ');

    await prisma.customer.create({
      data: {
        cv: customerCv,
        name: `ลูกค้าทดสอบ ${smokeKey}`,
        address: 'ที่อยู่ทดสอบ Mobile ReceiveBack',
        province: 'ภูเก็ต',
        phone: '0900000000'
      }
    });

    const item = await prisma.masterItem.create({
      data: {
        category: 'ตู้แช่',
        brand: 'MOBILE-RECEIVE',
        item_name: `MOBILE RECEIVEBACK TEST ${smokeKey}`,
        condition: 'สต็อก',
        details: 'mobile receive-back integrity test',
        size: '1 ประตู',
        tracking_type: TrackingType.SERIALIZED,
        stock_qty: 0,
        warehouse_stocks: {
          create: {
            warehouse_id: warehouse.id,
            stock_qty: 0,
            repair_qty: 0,
            scrap_qty: 0,
            lost_qty: 0,
            quarantine_qty: 0,
            transit_qty: 1
          }
        }
      }
    });
    createdItemId = item.id;

    await prisma.assetUnit.create({
      data: {
        master_item_id: item.id,
        asset_tag: assetTag,
        status: AssetUnitStatus.in_transit,
        current_warehouse_id: warehouse.id,
        holder_customer_cv: null,
        note: `preseed transit ${smokeKey}`
      }
    });

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
      ยี่ห้อหรือรูปแบบ: 'MOBILE-RECEIVE',
      รายการ: item.item_name,
      สภาพ: 'รอตรวจ',
      รายละเอียด: item.details,
      ขนาด: item.size,
      tracking_type: 'SERIALIZED'
    };

    const returnJobRequest = await request('/transactions/jobRequest', {
      method: 'POST',
      body: JSON.stringify({
        cv: customerCv,
        deliveryItems: [],
        returnItems: [{
          item: itemPayload,
          quantity: 1,
          assetTag,
          serialNumber: assetTag,
          tracking_type: 'SERIALIZED',
          type: 'RETURN',
          returnReason: `receiveback ${smokeKey}`,
          status: 'ปกติ'
        }],
        operator: operatorName,
        note: `mobile receiveback ${smokeKey}`,
        returnReason: `receiveback ${smokeKey}`,
        warehouseId: warehouse.id
      })
    }, token);
    assert(returnJobRequest.body?.status === 'success', `return jobRequest failed: ${JSON.stringify(returnJobRequest.body)}`);
    const jobId = returnJobRequest.body.jobId as string;
    createdJobIds.push(jobId);
    assert(jobId, 'return jobRequest ไม่คืน jobId');

    // จำลอง state หลัง driver รับคืนจากร้านแล้ว อยู่ระหว่างทางกลับ
    await prisma.job.update({ where: { job_id: jobId }, data: { status: 'รับคืนจากร้าน - กำลังเดินทางกลับ' } });
    await prisma.customerInventory.upsert({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } },
      update: { quantity: 0 },
      create: { customer_cv: customerCv, item_id: item.id, quantity: 0 }
    });

    const beforeReceiveStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const beforeReceiveInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } }
    });

    const receiveBack = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'receive',
        status: 'รอตรวจสอบ',
        items: [{
          item: itemPayload,
          id: item.id,
          rowIndex: item.id,
          quantity: 1,
          จำนวน: 1,
          serialNumber: assetTag,
          assetTag,
          assetTags: [assetTag],
          tracking_type: 'SERIALIZED',
          status: 'รอตรวจสอบ',
          cabinetCondition: 'ปกติ(รอตรวจ)'
        }],
        cv: customerCv,
        jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `mobile receive back ${smokeKey}`
      })
    }, token);
    assert(receiveBack.body?.status === 'success', `receive back failed: ${JSON.stringify(receiveBack.body)}`);

    const finalStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const finalInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } }
    });
    const finalUnit = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: assetTag } });

    assert(beforeReceiveStock.transit_qty === 1, `ก่อน receive transit_qty ควรเป็น 1 แต่ได้ ${beforeReceiveStock.transit_qty}`);
    assert((beforeReceiveInventory?.quantity || 0) === 0, `ก่อน receive customer inventory ควรเป็น 0 แต่ได้ ${beforeReceiveInventory?.quantity}`);
    assert(finalStock.transit_qty === 0, `หลัง receive transit_qty ควรเป็น 0 แต่ได้ ${finalStock.transit_qty}`);
    assert(finalStock.quarantine_qty === 1, `หลัง receive quarantine_qty ควรเป็น 1 แต่ได้ ${finalStock.quarantine_qty}`);
    assert((finalInventory?.quantity || 0) === 0, `หลัง receive customer inventory ต้องไม่ถูกหักซ้ำ ควรเป็น 0 แต่ได้ ${finalInventory?.quantity}`);
    assert(finalUnit.status === 'quarantine', `หลัง receive asset status ควรเป็น quarantine แต่ได้ ${finalUnit.status}`);
    assert(finalUnit.holder_customer_cv === null, `หลัง receive holder_customer_cv ควรเป็น null แต่ได้ ${finalUnit.holder_customer_cv}`);

    console.log(JSON.stringify({
      ok: true,
      smokeKey,
      customerCv,
      itemId: item.id,
      assetTag,
      checks: {
        beforeReceive: {
          transit_qty: beforeReceiveStock.transit_qty,
          customer_inventory: beforeReceiveInventory?.quantity || 0
        },
        afterReceive: {
          transit_qty: finalStock.transit_qty,
          quarantine_qty: finalStock.quarantine_qty,
          customer_inventory: finalInventory?.quantity || 0,
          asset_status: finalUnit.status
        }
      }
    }, null, 2));
  } finally {
    await prisma.$transaction(async (tx) => {
      if (createdJobIds.length > 0) await tx.transaction.deleteMany({ where: { job_id: { in: createdJobIds } } });
      await tx.transaction.deleteMany({ where: { asset_tag: assetTag } });
      await tx.customerInventory.deleteMany({ where: { customer_cv: customerCv } });
      await tx.assetUnit.deleteMany({ where: { asset_tag: assetTag } });
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
