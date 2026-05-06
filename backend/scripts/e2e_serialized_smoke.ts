import { PrismaClient, TrackingType } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';

const now = Date.now();
const smokeKey = `SMOKE-${now}`;
const customerCv = `SMOKE-CV-${now}`;
const serialNumber = `SN-${now}`;
const assetTag = `AT-${now}`;

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
  let deliveryJobId: string | null = null;
  let returnJobId: string | null = null;
  let warehouseId: number | null = null;

  try {
    const warehouse = await prisma.warehouse.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } });
    assert(warehouse, 'ไม่พบคลังสำหรับทดสอบ');
    warehouseId = warehouse.id;

    await prisma.customer.create({
      data: {
        cv: customerCv,
        name: `ลูกค้าทดสอบ ${smokeKey}`,
        address: 'ที่อยู่ทดสอบ Smoke',
        province: 'ภูเก็ต',
        phone: '0900000000'
      }
    });

    const item = await prisma.masterItem.create({
      data: {
        category: 'ตู้แช่',
        brand: 'SMOKE',
        item_name: `SERIALIZED TEST ${smokeKey}`,
        condition: 'สต็อก',
        details: 'temporary smoke test item',
        size: '1 ประตู',
        tracking_type: TrackingType.SERIALIZED,
        stock_qty: 1,
        warehouse_stocks: {
          create: {
            warehouse_id: warehouse.id,
            stock_qty: 1,
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
      ยี่ห้อหรือรูปแบบ: 'SMOKE',
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
          quantity: 1,
          serialNumber,
          assetTag,
          tracking_type: 'SERIALIZED',
          type: 'DELIVERY'
        }],
        returnItems: [],
        operator: operatorName,
        note: `serialized smoke ${smokeKey}`,
        warehouseId: warehouse.id
      })
    }, token);
    assert(jobRequest.body?.status === 'success', `jobRequest failed: ${JSON.stringify(jobRequest.body)}`);
    deliveryJobId = jobRequest.body.jobId;
    if (deliveryJobId) createdJobIds.push(deliveryJobId);
    assert(deliveryJobId, 'jobRequest ไม่คืน jobId');

    const issuePayload = {
      action: 'processBatch',
      subAction: 'issue',
      status: 'กำลังเดินทาง',
      items: [{
        item: itemPayload,
        id: item.id,
        rowIndex: item.id,
        quantity: 1,
        serialNumber,
        assetTag,
        assetTags: [assetTag],
        tracking_type: 'SERIALIZED',
        status: 'กำลังเดินทาง'
      }],
      cv: customerCv,
      jobId: deliveryJobId,
      txnNo: deliveryJobId,
      operator: operatorName,
      warehouseId: warehouse.id,
      note: `issue ${smokeKey}`
    };
    const issue = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify(issuePayload)
    }, token);
    assert(issue.body?.status === 'success', `issue failed: ${JSON.stringify(issue.body)}`);

    const afterIssueStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const afterIssueAsset = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: assetTag } });
    assert(afterIssueStock.stock_qty === 0, `หลัง issue stock_qty ควรเป็น 0 แต่ได้ ${afterIssueStock.stock_qty}`);
    assert(afterIssueStock.transit_qty === 1, `หลัง issue transit_qty ควรเป็น 1 แต่ได้ ${afterIssueStock.transit_qty}`);
    assert(afterIssueAsset.status === 'in_transit', `หลัง issue asset status ควรเป็น in_transit แต่ได้ ${afterIssueAsset.status}`);
    assert(afterIssueAsset.current_warehouse_id === warehouse.id, `หลัง issue current_warehouse_id ควรเป็น ${warehouse.id} แต่ได้ ${afterIssueAsset.current_warehouse_id}`);

    const fulfill = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'fulfill',
        status: 'ส่งมอบงานสำเร็จเรียบร้อย',
        items: [{
          item: itemPayload,
          id: item.id,
          rowIndex: item.id,
          quantity: 1,
          จำนวน: 1,
          serialNumber,
          assetTag,
          assetTags: [assetTag],
          tracking_type: 'SERIALIZED',
          status: 'ส่งมอบเรียบร้อย',
          cabinetCondition: 'ปกติ'
        }],
        cv: customerCv,
        jobId: deliveryJobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `fulfill ${smokeKey}`
      })
    }, token);
    assert(fulfill.body?.status === 'success', `fulfill failed: ${JSON.stringify(fulfill.body)}`);

    const afterFulfillStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const afterFulfillAsset = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: assetTag } });
    const afterFulfillCust = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } }
    });
    assert(afterFulfillStock.transit_qty === 0, `หลัง fulfill transit_qty ควรเป็น 0 แต่ได้ ${afterFulfillStock.transit_qty}`);
    assert(afterFulfillAsset.status === 'with_customer', `หลัง fulfill asset status ควรเป็น with_customer แต่ได้ ${afterFulfillAsset.status}`);
    assert(afterFulfillAsset.holder_customer_cv === customerCv, `หลัง fulfill holder_customer_cv ควรเป็น ${customerCv} แต่ได้ ${afterFulfillAsset.holder_customer_cv}`);
    assert(afterFulfillCust?.quantity === 1, `หลัง fulfill customer inventory ควรเป็น 1 แต่ได้ ${afterFulfillCust?.quantity}`);

    const returnJobRequest = await request('/transactions/jobRequest', {
      method: 'POST',
      body: JSON.stringify({
        cv: customerCv,
        deliveryItems: [],
        returnItems: [{
          item: itemPayload,
          quantity: 1,
          serialNumber,
          assetTag,
          tracking_type: 'SERIALIZED',
          type: 'RETURN',
          returnReason: `return request ${smokeKey}`,
          status: 'ปกติ'
        }],
        operator: operatorName,
        note: `return serialized smoke ${smokeKey}`,
        returnReason: `return request ${smokeKey}`,
        warehouseId: warehouse.id
      })
    }, token);
    assert(returnJobRequest.body?.status === 'success', `return jobRequest failed: ${JSON.stringify(returnJobRequest.body)}`);
    returnJobId = returnJobRequest.body.jobId;
    if (returnJobId) createdJobIds.push(returnJobId);
    assert(returnJobId, 'return jobRequest ไม่คืน jobId');

    const pickup = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'fulfill',
        status: 'รับคืนจากร้าน - กำลังเดินทางกลับ',
        items: [{
          item: itemPayload,
          id: item.id,
          rowIndex: item.id,
          quantity: 1,
          serialNumber,
          assetTag,
          assetTags: [assetTag],
          tracking_type: 'SERIALIZED',
          status: 'รับคืนจากร้าน',
          returnReason: `pickup ${smokeKey}`
        }],
        cv: customerCv,
        jobId: returnJobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `pickup ${smokeKey}`
      })
    }, token);
    assert(pickup.body?.status === 'success', `pickup failed: ${JSON.stringify(pickup.body)}`);

    const afterPickupStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const afterPickupAsset = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: assetTag } });
    const afterPickupCust = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } }
    });
    assert(afterPickupStock.transit_qty === 1, `หลัง pickup transit_qty ควรเป็น 1 แต่ได้ ${afterPickupStock.transit_qty}`);
    assert(afterPickupAsset.status === 'in_transit', `หลัง pickup asset status ควรเป็น in_transit แต่ได้ ${afterPickupAsset.status}`);
    assert((afterPickupCust?.quantity || 0) === 0, `หลัง pickup customer inventory ควรเป็น 0 แต่ได้ ${afterPickupCust?.quantity}`);

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
          serialNumber,
          assetTag,
          assetTags: [assetTag],
          tracking_type: 'SERIALIZED',
          status: 'รอตรวจสอบ',
          cabinetCondition: 'ปกติ'
        }],
        cv: customerCv,
        jobId: returnJobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `receive back ${smokeKey}`
      })
    }, token);
    assert(receiveBack.body?.status === 'success', `receive back failed: ${JSON.stringify(receiveBack.body)}`);

    const finalStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const finalAsset = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: assetTag } });
    assert(finalStock.transit_qty === 0, `หลัง receive transit_qty ควรเป็น 0 แต่ได้ ${finalStock.transit_qty}`);
    assert(finalStock.quarantine_qty === 1, `หลัง receive quarantine_qty ควรเป็น 1 แต่ได้ ${finalStock.quarantine_qty}`);
    assert(finalAsset.status === 'quarantine', `หลัง receive asset status ควรเป็น quarantine แต่ได้ ${finalAsset.status}`);
    assert(finalAsset.current_warehouse_id === warehouse.id, `หลัง receive current_warehouse_id ควรเป็น ${warehouse.id} แต่ได้ ${finalAsset.current_warehouse_id}`);

    const history = await request('/transactions', { method: 'GET' }, token);
    assert(Array.isArray(history.body), 'history API ไม่ได้คืน array');
    const historyRows = history.body.filter((row: any) => createdJobIds.includes(row.job_id) || row.asset_tag === assetTag || row.assetTag === assetTag);
    assert(historyRows.length > 0, 'history API ไม่พบแถวของ asset tag ทดสอบ');
    assert(historyRows.some((row: any) => row.asset_tag === assetTag || row.assetTag === assetTag), 'history API ยังไม่สะท้อน asset_tag');

    const assetLookup = await request(`/transactions/asset-units/${encodeURIComponent(assetTag)}`, { method: 'GET' }, token);
    assert(assetLookup.body?.status === 'success', `asset lookup failed: ${JSON.stringify(assetLookup.body)}`);
    assert(assetLookup.body?.item?.status === 'quarantine', `asset lookup ควรเห็น status=quarantine แต่ได้ ${assetLookup.body?.item?.status}`);

    console.log(JSON.stringify({
      ok: true,
      smokeKey,
      warehouseId,
      customerCv,
      itemId: item.id,
      assetTag,
      serialNumber,
      deliveryJobId,
      returnJobId,
      checks: {
        afterIssue: {
          stock_qty: afterIssueStock.stock_qty,
          transit_qty: afterIssueStock.transit_qty,
          asset_status: afterIssueAsset.status
        },
        afterFulfill: {
          transit_qty: afterFulfillStock.transit_qty,
          asset_status: afterFulfillAsset.status,
          customer_inventory: afterFulfillCust?.quantity || 0
        },
        afterPickup: {
          transit_qty: afterPickupStock.transit_qty,
          asset_status: afterPickupAsset.status,
          customer_inventory: afterPickupCust?.quantity || 0
        },
        final: {
          quarantine_qty: finalStock.quarantine_qty,
          transit_qty: finalStock.transit_qty,
          asset_status: finalAsset.status,
          asset_lookup_status: assetLookup.body?.item?.status,
          history_rows: historyRows.length
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
