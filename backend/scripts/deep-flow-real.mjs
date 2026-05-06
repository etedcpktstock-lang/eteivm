import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'ete-dc-pkt-secret-2026';
const runId = process.env.DEEP_FLOW_RUN_ID || `E2E-DEEP-${Date.now()}`;

const results = [];
function assert(condition, message, details = undefined) {
  if (!condition) {
    const err = new Error(message);
    err.details = details;
    throw err;
  }
  results.push(`✅ ${message}`);
}

function sum(rows, pred) {
  return rows.filter(pred).reduce((acc, row) => acc + Number(row.จำนวน ?? row.quantity ?? 0), 0);
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${globalThis.token}`,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${text}`);
  if (data?.status === 'error') throw new Error(`${path}: ${data.message}`);
  return data;
}

async function getWs(itemId, warehouseId) {
  return prisma.warehouseStock.findUnique({
    where: { item_id_warehouse_id: { item_id: itemId, warehouse_id: warehouseId } }
  });
}

function itemPayload(item) {
  return {
    id: item.id,
    rowIndex: item.id,
    ประเภท: item.category,
    ยี่ห้อหรือรูปแบบ: item.brand || '',
    รายการ: item.item_name || item.category,
    สภาพ: item.condition || '',
    รายละเอียด: item.details || '',
    ขนาด: item.size || '',
    tracking_type: item.tracking_type || 'BATCH'
  };
}

async function assertInitialDataPage({ warehouseId, deliveryItemId, returnItemId, cv }, expected, label) {
  const initial = await api(`/initialData?t=${Date.now()}`);
  const delivery = initial.items.find(i => Number(i.rowIndex) === deliveryItemId);
  const returned = initial.items.find(i => Number(i.rowIndex) === returnItemId);
  const customer = initial.customers.find(c => c.cv === cv);
  const wh = initial.warehouses.find(w => Number(w.id) === warehouseId);
  const whDelivery = wh?.stocks?.find(s => Number(s.itemId) === deliveryItemId);
  const whReturn = wh?.stocks?.find(s => Number(s.itemId) === returnItemId);

  assert(Boolean(delivery), `${label}: หน้า Inventory/รายงานมีรายการส่ง`, { deliveryItemId });
  assert(Boolean(returned), `${label}: หน้า Inventory/รายงานมีรายการรับคืน`, { returnItemId });
  assert(Number(delivery.จำนวน) === expected.delivery.stock, `${label}: จำนวนพร้อมใช้รายการส่งถูกต้อง = ${expected.delivery.stock}`, delivery);
  assert(Number(delivery.transit_qty || 0) === expected.delivery.transit, `${label}: จำนวนระหว่างทางรายการส่งถูกต้อง = ${expected.delivery.transit}`, delivery);
  assert(Number(returned.quarantine_qty || 0) === expected.returnItem.quarantine, `${label}: จำนวนรอตรวจรายการรับคืนถูกต้อง = ${expected.returnItem.quarantine}`, returned);
  assert(Number(returned.transit_qty || 0) === expected.returnItem.transit, `${label}: จำนวนระหว่างทางรายการรับคืนถูกต้อง = ${expected.returnItem.transit}`, returned);
  assert(Number(whDelivery?.stock || 0) === expected.delivery.stock, `${label}: หน้าคลังย่อย stock รายการส่งถูกต้อง`, whDelivery);
  assert(Number(whDelivery?.transit || 0) === expected.delivery.transit, `${label}: หน้าคลังย่อย transit รายการส่งถูกต้อง`, whDelivery);
  assert(Number(whReturn?.quarantine || 0) === expected.returnItem.quarantine, `${label}: หน้าคลังย่อย quarantine รายการรับคืนถูกต้อง`, whReturn);
  assert(Number(whReturn?.transit || 0) === expected.returnItem.transit, `${label}: หน้าคลังย่อย transit รายการรับคืนถูกต้อง`, whReturn);
  const deliveryInv = customer?.inventory?.find(i => Number(i.itemId) === deliveryItemId);
  const returnInv = customer?.inventory?.find(i => Number(i.itemId) === returnItemId);
  assert(Number(deliveryInv?.qty || 0) === expected.customer.delivery, `${label}: หน้าลูกค้าถือครองรายการส่งถูกต้อง = ${expected.customer.delivery}`, deliveryInv);
  assert(Number(returnInv?.qty || 0) === expected.customer.returnItem, `${label}: หน้าลูกค้าถือครองรายการรับคืนถูกต้อง = ${expected.customer.returnItem}`, returnInv);
}

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
  assert(user, 'พบผู้ใช้งานสำหรับสร้าง token ทดสอบ');
  globalThis.token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });

  await api('/initialData');
  assert(true, `เชื่อมต่อ API ได้: ${API_BASE}`);

  const warehouse = await prisma.warehouse.create({
    data: { name: `${runId}-WH`, is_active: true }
  });
  const customer = await prisma.customer.create({
    data: {
      cv: `T${String(Date.now()).slice(-8)}`,
      name: `${runId} ลูกค้าทดสอบ`,
      phone: '0800000000',
      address: 'ที่อยู่ทดสอบ deep flow',
      province: 'ภูเก็ต'
    }
  });
  const deliveryItem = await prisma.masterItem.create({
    data: {
      category: `${runId} ตู้แช่`,
      brand: 'E2E',
      item_name: `${runId} ส่งของ`,
      condition: 'สต็อก',
      size: 'S',
      stock_qty: 5
    }
  });
  const returnItem = await prisma.masterItem.create({
    data: {
      category: `${runId} ตู้แช่`,
      brand: 'E2E',
      item_name: `${runId} รับคืน`,
      condition: 'สต็อก',
      size: 'R',
      stock_qty: 0
    }
  });
  await prisma.warehouseStock.create({ data: { item_id: deliveryItem.id, warehouse_id: warehouse.id, stock_qty: 5 } });
  await prisma.warehouseStock.create({ data: { item_id: returnItem.id, warehouse_id: warehouse.id, stock_qty: 0 } });
  await prisma.customerInventory.create({ data: { customer_cv: customer.cv, item_id: returnItem.id, quantity: 1 } });
  assert(true, `สร้างข้อมูลทดสอบแยกชุด: ${runId}`);

  const context = { warehouseId: warehouse.id, deliveryItemId: deliveryItem.id, returnItemId: returnItem.id, cv: customer.cv };
  await assertInitialDataPage(context, {
    delivery: { stock: 5, transit: 0 },
    returnItem: { transit: 0, quarantine: 0 },
    customer: { delivery: 0, returnItem: 1 }
  }, 'ก่อนเริ่ม');

  const jobReq = await api('/transactions/jobRequest', {
    method: 'POST',
    body: JSON.stringify({
      cv: customer.cv,
      operator: user.name,
      notifier: user.name,
      notificationDate: new Date().toISOString(),
      appointmentDate: new Date(Date.now() + 86400000).toISOString(),
      warehouseId: warehouse.id,
      note: runId,
      deliveryItems: [{ item: itemPayload(deliveryItem), quantity: 2, deliveryBy: user.name }],
      returnItems: [{ item: itemPayload(returnItem), quantity: 1, returnReason: 'ทดสอบรับคืน', status: 'ปกติ' }]
    })
  });
  const jobId = jobReq.jobId;
  assert(Boolean(jobId), 'แจ้งงานสำเร็จและได้เลข JOB', jobReq);

  const jobRequests = await api(`/transactions/jobRequests?cv=${customer.cv}`);
  const jobPage = jobRequests.find(j => j.jobId === jobId);
  assert(Boolean(jobPage), 'หน้าแจ้งงานพบ JOB ใหม่', { jobId });
  assert(sum(jobPage.items, i => i.action_type === 'แจ้งส่ง' && Number(i.rowIndex) === deliveryItem.id) === 2, 'หน้าแจ้งงานมีรายการแจ้งส่ง 2 ชิ้น', jobPage.items);
  assert(sum(jobPage.items, i => i.action_type === 'แจ้งคืน' && Number(i.rowIndex) === returnItem.id) === 1, 'หน้าแจ้งงานมีรายการแจ้งคืน 1 ชิ้น', jobPage.items);
  await assertInitialDataPage(context, {
    delivery: { stock: 5, transit: 0 },
    returnItem: { transit: 0, quarantine: 0 },
    customer: { delivery: 0, returnItem: 1 }
  }, 'หลังแจ้งงาน');

  await api('/transactions/processBatch', {
    method: 'POST',
    body: JSON.stringify({
      action: 'processBatch', subAction: 'issue', status: 'เบิกออก', jobId, cv: customer.cv,
      operator: user.name, deliveryBy: user.name, warehouseId: warehouse.id, note: runId,
      items: [{ item: itemPayload(deliveryItem), quantity: 2 }]
    })
  });
  let wsDelivery = await getWs(deliveryItem.id, warehouse.id);
  assert(wsDelivery.stock_qty === 3 && wsDelivery.transit_qty === 2, 'หลังเบิก: DB stock 3 / transit 2', wsDelivery);
  await assertInitialDataPage(context, {
    delivery: { stock: 3, transit: 2 },
    returnItem: { transit: 0, quarantine: 0 },
    customer: { delivery: 0, returnItem: 1 }
  }, 'หลังเบิก');

  await api('/transactions/processBatch', {
    method: 'POST',
    body: JSON.stringify({
      action: 'processBatch', subAction: 'status_only', status: 'กำลังขนส่ง', jobId, cv: customer.cv,
      operator: user.name, warehouseId: warehouse.id, note: runId,
      items: []
    })
  });
  const logisticsActive = await api('/transactions/logistics/jobs');
  const logisticsJob = logisticsActive.find(j => j.jobId === jobId);
  assert(logisticsJob?.status === 'กำลังขนส่ง', 'หน้าขนส่งแสดงสถานะกำลังขนส่ง', logisticsJob);

  await api('/transactions/processBatch', {
    method: 'POST',
    body: JSON.stringify({
      action: 'processBatch', subAction: 'fulfill', status: 'ส่งมอบเรียบร้อย', jobId, cv: customer.cv,
      operator: user.name, deliveryBy: user.name, warehouseId: warehouse.id, note: runId,
      items: [{ item: itemPayload(deliveryItem), quantity: 2, status: 'ส่งมอบเรียบร้อย' }]
    })
  });
  wsDelivery = await getWs(deliveryItem.id, warehouse.id);
  assert(wsDelivery.stock_qty === 3 && wsDelivery.transit_qty === 0, 'หลังส่งมอบ: DB stock 3 / transit 0', wsDelivery);
  await assertInitialDataPage(context, {
    delivery: { stock: 3, transit: 0 },
    returnItem: { transit: 0, quarantine: 0 },
    customer: { delivery: 2, returnItem: 1 }
  }, 'หลังส่งมอบ');

  await api('/transactions/processBatch', {
    method: 'POST',
    body: JSON.stringify({
      action: 'processBatch', subAction: 'fulfill', status: 'รับคืนจากร้าน', jobId, cv: customer.cv,
      operator: user.name, deliveryBy: user.name, warehouseId: warehouse.id, note: runId,
      items: [{ item: itemPayload(returnItem), quantity: 1, status: 'รับคืนจากร้าน', returnReason: 'ทดสอบรับคืน' }]
    })
  });
  let wsReturn = await getWs(returnItem.id, warehouse.id);
  assert(wsReturn.transit_qty === 1 && wsReturn.quarantine_qty === 0, 'หลังรับคืนจากร้าน: DB return transit 1 / quarantine 0', wsReturn);
  await assertInitialDataPage(context, {
    delivery: { stock: 3, transit: 0 },
    returnItem: { transit: 1, quarantine: 0 },
    customer: { delivery: 2, returnItem: 1 }
  }, 'หลังขนส่งรับคืนจากร้าน');

  await api('/transactions/processBatch', {
    method: 'POST',
    body: JSON.stringify({
      action: 'processBatch', subAction: 'fulfill', status: 'ถึงออฟฟิศแล้ว', jobId, cv: customer.cv,
      operator: user.name, deliveryBy: user.name, warehouseId: warehouse.id, note: runId,
      items: [{ item: itemPayload(returnItem), quantity: 1, status: 'รอตรวจสอบ', returnReason: 'ทดสอบรับคืน' }]
    })
  });
  wsReturn = await getWs(returnItem.id, warehouse.id);
  assert(wsReturn.transit_qty === 0 && wsReturn.quarantine_qty === 1, 'หลังรับคืนเข้าออฟฟิศ: DB return transit 0 / quarantine 1', wsReturn);
  await assertInitialDataPage(context, {
    delivery: { stock: 3, transit: 0 },
    returnItem: { transit: 0, quarantine: 1 },
    customer: { delivery: 2, returnItem: 0 }
  }, 'หลังรับคืนเข้าออฟฟิศ');

  const txPage = await api('/transactions');
  assert(sum(txPage, t => t.job_id === jobId && t.สถานะ === 'แจ้งส่ง' && Number(t.item_id) === deliveryItem.id) === 2, 'หน้าประวัติ/รายงานมีแจ้งส่ง 2', txPage.filter(t => t.job_id === jobId));
  assert(sum(txPage, t => t.job_id === jobId && t.สถานะ === 'เบิกออก' && Number(t.item_id) === deliveryItem.id) === 2, 'หน้าประวัติ/รายงานมีเบิกออก 2', txPage.filter(t => t.job_id === jobId));
  assert(sum(txPage, t => t.job_id === jobId && t.สถานะ === 'ส่งมอบเรียบร้อย' && Number(t.item_id) === deliveryItem.id) === 2, 'หน้าประวัติ/รายงานมีส่งมอบเรียบร้อย 2', txPage.filter(t => t.job_id === jobId));
  assert(sum(txPage, t => t.job_id === jobId && String(t.สถานะ).includes('รับคืน') && Number(t.item_id) === returnItem.id) === 1, 'หน้าประวัติ/รายงานมีรับคืนจากร้าน 1', txPage.filter(t => t.job_id === jobId));
  assert(sum(txPage, t => t.job_id === jobId && String(t.สถานะ).includes('รอตรวจ') && Number(t.item_id) === returnItem.id) === 1, 'หน้าจัดการพัสดุรับคืน/รอตรวจมีรายการ 1', txPage.filter(t => t.job_id === jobId));

  const finalJob = await prisma.job.findUnique({ where: { job_id: jobId }, include: { transactions: true } });
  assert(finalJob?.status === 'ถึงออฟฟิศแล้ว', 'สถานะ JOB ปลายทาง = ถึงออฟฟิศแล้ว', finalJob);
  assert(finalJob.transactions.length === 9, 'จำนวน transaction แยกรายชิ้นครบ 9 แถว (แจ้ง 3 + เบิก 2 + ส่ง 2 + รับคืน 1 + รอตรวจ 1)', finalJob.transactions.map(t => ({ action: t.action_type, qty: t.quantity, item: t.item_id })));

  console.log('\n=== DEEP FLOW REAL TRANSACTION TEST PASSED ===');
  console.log(`Run ID: ${runId}`);
  console.log(`Job ID: ${jobId}`);
  console.log(results.join('\n'));
}

main()
  .catch((err) => {
    console.error('\n=== DEEP FLOW REAL TRANSACTION TEST FAILED ===');
    console.error(err.message);
    if (err.details) console.error(JSON.stringify(err.details, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
