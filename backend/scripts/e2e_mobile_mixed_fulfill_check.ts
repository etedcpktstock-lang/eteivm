import { PrismaClient, TrackingType, AssetUnitStatus } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';
const now = Date.now();
const smokeKey = `MOBILE-MIXED-${now}`;
const customerCv = `MIXED-CV-${now}`;
const deliveryAssetTags = [`MIXED-DEL-${now}-1`, `MIXED-DEL-${now}-2`];
const pickupAssetTag = `MIXED-PICK-${now}-1`;

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
        address: 'ที่อยู่ทดสอบ Mobile Mixed Fulfill',
        province: 'ภูเก็ต',
        phone: '0900000000'
      }
    });

    const item = await prisma.masterItem.create({
      data: {
        category: 'ตู้แช่',
        brand: 'MOBILE-MIXED',
        item_name: `MOBILE MIXED TEST ${smokeKey}`,
        condition: 'สต็อก',
        details: 'mobile mixed fulfill integrity test',
        size: '1 ประตู',
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
    createdItemId = item.id;

    await prisma.assetUnit.create({
      data: {
        master_item_id: item.id,
        asset_tag: pickupAssetTag,
        status: AssetUnitStatus.with_customer,
        current_warehouse_id: null,
        holder_customer_cv: customerCv,
        note: `preseed pickup ${smokeKey}`
      }
    });

    await prisma.customerInventory.create({
      data: {
        customer_cv: customerCv,
        item_id: item.id,
        quantity: 1
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
      ยี่ห้อหรือรูปแบบ: 'MOBILE-MIXED',
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
          quantity: 2,
          assetTags: deliveryAssetTags,
          tracking_type: 'SERIALIZED',
          type: 'DELIVERY'
        }],
        returnItems: [{
          item: itemPayload,
          quantity: 1,
          assetTag: pickupAssetTag,
          tracking_type: 'SERIALIZED',
          type: 'RETURN',
          returnReason: `pickup mixed ${smokeKey}`,
          status: 'ปกติ'
        }],
        operator: operatorName,
        note: `mobile mixed fulfill ${smokeKey}`,
        returnReason: `pickup mixed ${smokeKey}`,
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
          quantity: 2,
          จำนวน: 2,
          assetTags: deliveryAssetTags,
          tracking_type: 'SERIALIZED',
          status: 'กำลังเดินทาง'
        }],
        cv: customerCv,
        jobId,
        txnNo: jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `issue mixed ${smokeKey}`
      })
    }, token);
    assert(issue.body?.status === 'success', `issue failed: ${JSON.stringify(issue.body)}`);

    const afterIssueStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    assert(afterIssueStock.stock_qty === 0, `หลัง issue stock_qty ควรเป็น 0 แต่ได้ ${afterIssueStock.stock_qty}`);
    assert(afterIssueStock.transit_qty === 2, `หลัง issue transit_qty ควรเป็น 2 แต่ได้ ${afterIssueStock.transit_qty}`);

    const mobileMixedItems = [
      ...deliveryAssetTags.map((tag, idx) => ({
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
      })),
      {
        item: itemPayload,
        id: item.id,
        rowIndex: item.id,
        quantity: 1,
        จำนวน: 1,
        serialNumber: pickupAssetTag,
        assetTag: pickupAssetTag,
        assetTags: [pickupAssetTag],
        tracking_type: 'SERIALIZED',
        status: 'รับคืนจากร้าน',
        cabinetCondition: 'ปกติ',
        returnReason: `pickup mixed ${smokeKey}`,
        _mobilePickup: true
      }
    ];

    const fulfill = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'fulfill',
        status: 'รับคืนจากร้าน - กำลังเดินทางกลับ',
        items: mobileMixedItems,
        cv: customerCv,
        jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `mobile mixed fulfill ${smokeKey}`
      })
    }, token);
    assert(fulfill.body?.status === 'success', `mixed fulfill failed: ${JSON.stringify(fulfill.body)}`);

    const finalStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouse.id } }
    });
    const finalInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: item.id } }
    });
    const finalUnits = await prisma.assetUnit.findMany({
      where: { asset_tag: { in: [...deliveryAssetTags, pickupAssetTag] } },
      orderBy: { asset_tag: 'asc' }
    });

    const deliveredUnits = finalUnits.filter((u) => deliveryAssetTags.includes(u.asset_tag));
    const pickupUnit = finalUnits.find((u) => u.asset_tag === pickupAssetTag);

    assert(finalStock.transit_qty === 1, `หลัง mixed fulfill transit_qty ควรเป็น 1 แต่ได้ ${finalStock.transit_qty}`);
    assert(finalStock.stock_qty === 0, `หลัง mixed fulfill stock_qty ควรเป็น 0 แต่ได้ ${finalStock.stock_qty}`);
    assert(finalInventory?.quantity === 2, `หลัง mixed fulfill customer inventory ควรเป็น 2 แต่ได้ ${finalInventory?.quantity}`);
    assert(deliveredUnits.length === 2, `ควรมี delivered units 2 รายการ แต่ได้ ${deliveredUnits.length}`);
    assert(deliveredUnits.every((u) => u.status === 'with_customer' && u.holder_customer_cv === customerCv), `มี delivered units สถานะไม่ถูกต้อง: ${JSON.stringify(deliveredUnits)}`);
    assert(pickupUnit?.status === 'in_transit', `pickup unit ควรเป็น in_transit แต่ได้ ${pickupUnit?.status}`);
    assert(pickupUnit?.holder_customer_cv === null, `pickup unit holder ควรเป็น null แต่ได้ ${pickupUnit?.holder_customer_cv}`);
    assert(pickupUnit?.current_warehouse_id === warehouse.id, `pickup unit current_warehouse_id ควรเป็น ${warehouse.id} แต่ได้ ${pickupUnit?.current_warehouse_id}`);

    console.log(JSON.stringify({
      ok: true,
      smokeKey,
      warehouseId,
      customerCv,
      itemId: item.id,
      checks: {
        afterIssue: {
          stock_qty: afterIssueStock.stock_qty,
          transit_qty: afterIssueStock.transit_qty
        },
        afterMixedFulfill: {
          stock_qty: finalStock.stock_qty,
          transit_qty: finalStock.transit_qty,
          customer_inventory: finalInventory?.quantity || 0,
          delivered_units: deliveredUnits.map((u) => ({
            asset_tag: u.asset_tag,
            status: u.status,
            holder_customer_cv: u.holder_customer_cv
          })),
          pickup_unit: pickupUnit ? {
            asset_tag: pickupUnit.asset_tag,
            status: pickupUnit.status,
            holder_customer_cv: pickupUnit.holder_customer_cv,
            current_warehouse_id: pickupUnit.current_warehouse_id
          } : null
        }
      }
    }, null, 2));
  } finally {
    await prisma.$transaction(async (tx) => {
      if (createdJobIds.length > 0) await tx.transaction.deleteMany({ where: { job_id: { in: createdJobIds } } });
      await tx.transaction.deleteMany({ where: { asset_tag: { in: [...deliveryAssetTags, pickupAssetTag] } } });
      await tx.customerInventory.deleteMany({ where: { customer_cv: customerCv } });
      await tx.assetUnit.deleteMany({ where: { asset_tag: { in: [...deliveryAssetTags, pickupAssetTag] } } });
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
