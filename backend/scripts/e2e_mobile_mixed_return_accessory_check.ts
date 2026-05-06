import { PrismaClient, TrackingType, AssetUnitStatus } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';
const now = Date.now();
const smokeKey = `MOBILE-RETURN-MIX-${now}`;
const customerCv = `RETURN-MIX-CV-${now}`;
const freezerAssetTag = `RETURN-MIX-FRZ-${now}`;

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

  try {
    const warehouse = await prisma.warehouse.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } });
    assert(warehouse, 'ไม่พบคลังสำหรับทดสอบ');

    await prisma.customer.create({
      data: {
        cv: customerCv,
        name: `ลูกค้าทดสอบ ${smokeKey}`,
        address: 'ที่อยู่ทดสอบ Mobile Mixed Return + Accessory',
        province: 'ภูเก็ต',
        phone: '0900000000'
      }
    });

    const freezerItem = await prisma.masterItem.create({
      data: {
        category: 'ตู้แช่',
        brand: 'MOBILE-RETURN-MIX',
        item_name: `MOBILE RETURN FREEZER ${smokeKey}`,
        condition: 'สต็อก',
        details: 'mobile mixed return serialized item test',
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
            transit_qty: 0
          }
        }
      }
    });
    freezerItemId = freezerItem.id;

    const accessoryItem = await prisma.masterItem.create({
      data: {
        category: 'อุปกรณ์',
        brand: 'MOBILE-RETURN-MIX',
        item_name: `ตะกร้า ${smokeKey}`,
        condition: 'สต็อก',
        details: 'mobile mixed return accessory batch item test',
        size: '-',
        tracking_type: TrackingType.BATCH,
        stock_qty: 0,
        warehouse_stocks: {
          create: {
            warehouse_id: warehouse.id,
            stock_qty: 0,
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

    await prisma.assetUnit.create({
      data: {
        master_item_id: freezerItem.id,
        asset_tag: freezerAssetTag,
        status: AssetUnitStatus.with_customer,
        current_warehouse_id: null,
        holder_customer_cv: customerCv,
        note: `preseed customer freezer ${smokeKey}`
      }
    });

    await prisma.customerInventory.createMany({
      data: [
        { customer_cv: customerCv, item_id: freezerItem.id, quantity: 1 },
        { customer_cv: customerCv, item_id: accessoryItem.id, quantity: 3 }
      ]
    });

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
      ยี่ห้อหรือรูปแบบ: 'MOBILE-RETURN-MIX',
      รายการ: freezerItem.item_name,
      สภาพ: 'รอตรวจ',
      รายละเอียด: freezerItem.details,
      ขนาด: freezerItem.size,
      tracking_type: 'SERIALIZED'
    };

    const accessoryPayload = {
      id: accessoryItem.id,
      rowIndex: accessoryItem.id,
      ประเภท: 'อุปกรณ์',
      ยี่ห้อหรือรูปแบบ: 'MOBILE-RETURN-MIX',
      รายการ: accessoryItem.item_name,
      สภาพ: 'รอตรวจ',
      รายละเอียด: accessoryItem.details,
      ขนาด: accessoryItem.size,
      tracking_type: 'BATCH'
    };

    const returnJobRequest = await request('/transactions/jobRequest', {
      method: 'POST',
      body: JSON.stringify({
        cv: customerCv,
        deliveryItems: [],
        returnItems: [
          {
            item: freezerPayload,
            quantity: 1,
            assetTag: freezerAssetTag,
            serialNumber: freezerAssetTag,
            tracking_type: 'SERIALIZED',
            type: 'RETURN',
            returnReason: `mixed return ${smokeKey}`,
            status: 'ปกติ'
          },
          {
            item: accessoryPayload,
            quantity: 3,
            tracking_type: 'BATCH',
            type: 'RETURN',
            returnReason: `mixed return ${smokeKey}`,
            status: 'ปกติ'
          }
        ],
        operator: operatorName,
        note: `mobile mixed return accessory ${smokeKey}`,
        returnReason: `mixed return ${smokeKey}`,
        warehouseId: warehouse.id
      })
    }, token);
    assert(returnJobRequest.body?.status === 'success', `return jobRequest failed: ${JSON.stringify(returnJobRequest.body)}`);
    const jobId = returnJobRequest.body.jobId as string;
    createdJobIds.push(jobId);
    assert(jobId, 'return jobRequest ไม่คืน jobId');

    const pickupItems = [
      {
        item: freezerPayload,
        id: freezerItem.id,
        rowIndex: freezerItem.id,
        quantity: 1,
        จำนวน: 1,
        serialNumber: freezerAssetTag,
        assetTag: freezerAssetTag,
        assetTags: [freezerAssetTag],
        tracking_type: 'SERIALIZED',
        status: 'รับคืนจากร้าน',
        cabinetCondition: 'ปกติ',
        returnReason: `mixed return ${smokeKey}`
      },
      {
        item: accessoryPayload,
        id: accessoryItem.id,
        rowIndex: accessoryItem.id,
        quantity: 3,
        จำนวน: 3,
        tracking_type: 'BATCH',
        status: 'รับคืนจากร้าน',
        cabinetCondition: 'ปกติ',
        returnReason: `mixed return ${smokeKey}`
      }
    ];

    const pickup = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'fulfill',
        status: 'รับคืนจากร้าน - กำลังเดินทางกลับ',
        items: pickupItems,
        cv: customerCv,
        jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `pickup mixed return ${smokeKey}`
      })
    }, token);
    assert(pickup.body?.status === 'success', `pickup mixed return failed: ${JSON.stringify(pickup.body)}`);

    const afterPickupFreezerStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: freezerItem.id, warehouse_id: warehouse.id } }
    });
    const afterPickupAccessoryStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: accessoryItem.id, warehouse_id: warehouse.id } }
    });
    const afterPickupFreezerInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: freezerItem.id } }
    });
    const afterPickupAccessoryInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: accessoryItem.id } }
    });
    const afterPickupUnit = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: freezerAssetTag } });

    assert(afterPickupFreezerStock.transit_qty === 1, `หลัง pickup freezer transit_qty ควรเป็น 1 แต่ได้ ${afterPickupFreezerStock.transit_qty}`);
    assert(afterPickupAccessoryStock.transit_qty === 3, `หลัง pickup accessory transit_qty ควรเป็น 3 แต่ได้ ${afterPickupAccessoryStock.transit_qty}`);
    assert((afterPickupFreezerInventory?.quantity || 0) === 0, `หลัง pickup freezer customer inventory ควรเป็น 0 แต่ได้ ${afterPickupFreezerInventory?.quantity}`);
    assert((afterPickupAccessoryInventory?.quantity || 0) === 0, `หลัง pickup accessory customer inventory ควรเป็น 0 แต่ได้ ${afterPickupAccessoryInventory?.quantity}`);
    assert(afterPickupUnit.status === 'in_transit', `หลัง pickup freezer asset status ควรเป็น in_transit แต่ได้ ${afterPickupUnit.status}`);
    assert(afterPickupUnit.holder_customer_cv === null, `หลัง pickup freezer holder ควรเป็น null แต่ได้ ${afterPickupUnit.holder_customer_cv}`);

    const receiveItems = [
      {
        item: freezerPayload,
        id: freezerItem.id,
        rowIndex: freezerItem.id,
        quantity: 1,
        จำนวน: 1,
        serialNumber: freezerAssetTag,
        assetTag: freezerAssetTag,
        assetTags: [freezerAssetTag],
        tracking_type: 'SERIALIZED',
        status: 'รอตรวจสอบ',
        cabinetCondition: 'ปกติ(รอตรวจ)'
      },
      {
        item: accessoryPayload,
        id: accessoryItem.id,
        rowIndex: accessoryItem.id,
        quantity: 3,
        จำนวน: 3,
        tracking_type: 'BATCH',
        status: 'รอตรวจสอบ',
        cabinetCondition: 'ปกติ(รอตรวจ)'
      }
    ];

    const receiveBack = await request('/transactions/processBatch', {
      method: 'POST',
      body: JSON.stringify({
        action: 'processBatch',
        subAction: 'receive',
        status: 'รอตรวจสอบ',
        items: receiveItems,
        cv: customerCv,
        jobId,
        operator: operatorName,
        warehouseId: warehouse.id,
        note: `receive mixed return ${smokeKey}`
      })
    }, token);
    assert(receiveBack.body?.status === 'success', `receive mixed return failed: ${JSON.stringify(receiveBack.body)}`);

    const finalFreezerStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: freezerItem.id, warehouse_id: warehouse.id } }
    });
    const finalAccessoryStock = await prisma.warehouseStock.findUniqueOrThrow({
      where: { item_id_warehouse_id: { item_id: accessoryItem.id, warehouse_id: warehouse.id } }
    });
    const finalFreezerInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: freezerItem.id } }
    });
    const finalAccessoryInventory = await prisma.customerInventory.findUnique({
      where: { customer_cv_item_id: { customer_cv: customerCv, item_id: accessoryItem.id } }
    });
    const finalUnit = await prisma.assetUnit.findUniqueOrThrow({ where: { asset_tag: freezerAssetTag } });

    assert(finalFreezerStock.transit_qty === 0, `หลัง receive freezer transit_qty ควรเป็น 0 แต่ได้ ${finalFreezerStock.transit_qty}`);
    assert(finalFreezerStock.quarantine_qty === 1, `หลัง receive freezer quarantine_qty ควรเป็น 1 แต่ได้ ${finalFreezerStock.quarantine_qty}`);
    assert(finalAccessoryStock.transit_qty === 0, `หลัง receive accessory transit_qty ควรเป็น 0 แต่ได้ ${finalAccessoryStock.transit_qty}`);
    assert(finalAccessoryStock.quarantine_qty === 3, `หลัง receive accessory quarantine_qty ควรเป็น 3 แต่ได้ ${finalAccessoryStock.quarantine_qty}`);
    assert((finalFreezerInventory?.quantity || 0) === 0, `หลัง receive freezer customer inventory ควรเป็น 0 แต่ได้ ${finalFreezerInventory?.quantity}`);
    assert((finalAccessoryInventory?.quantity || 0) === 0, `หลัง receive accessory customer inventory ควรเป็น 0 แต่ได้ ${finalAccessoryInventory?.quantity}`);
    assert(finalUnit.status === 'quarantine', `หลัง receive freezer asset status ควรเป็น quarantine แต่ได้ ${finalUnit.status}`);
    assert(finalUnit.holder_customer_cv === null, `หลัง receive freezer holder ควรเป็น null แต่ได้ ${finalUnit.holder_customer_cv}`);

    console.log(JSON.stringify({
      ok: true,
      smokeKey,
      customerCv,
      freezerItemId: freezerItem.id,
      accessoryItemId: accessoryItem.id,
      assetTag: freezerAssetTag,
      checks: {
        afterPickup: {
          freezer: {
            transit_qty: afterPickupFreezerStock.transit_qty,
            customer_inventory: afterPickupFreezerInventory?.quantity || 0,
            asset_status: afterPickupUnit.status
          },
          accessory: {
            transit_qty: afterPickupAccessoryStock.transit_qty,
            customer_inventory: afterPickupAccessoryInventory?.quantity || 0
          }
        },
        afterReceive: {
          freezer: {
            transit_qty: finalFreezerStock.transit_qty,
            quarantine_qty: finalFreezerStock.quarantine_qty,
            customer_inventory: finalFreezerInventory?.quantity || 0,
            asset_status: finalUnit.status
          },
          accessory: {
            transit_qty: finalAccessoryStock.transit_qty,
            quarantine_qty: finalAccessoryStock.quarantine_qty,
            customer_inventory: finalAccessoryInventory?.quantity || 0
          }
        }
      }
    }, null, 2));
  } finally {
    await prisma.$transaction(async (tx) => {
      if (createdJobIds.length > 0) await tx.transaction.deleteMany({ where: { job_id: { in: createdJobIds } } });
      await tx.transaction.deleteMany({ where: { asset_tag: freezerAssetTag } });
      await tx.customerInventory.deleteMany({ where: { customer_cv: customerCv } });
      await tx.assetUnit.deleteMany({ where: { asset_tag: freezerAssetTag } });
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
