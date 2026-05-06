import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'ete-dc-pkt-secret-2026';
const tag = `SOT-${Date.now()}`;

function assert(ok, msg, detail) {
  if (!ok) {
    const err = new Error(msg);
    err.detail = detail;
    throw err;
  }
  console.log('✅', msg);
}

async function api(path) {
  const user = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
  assert(user, 'มี user สำหรับออก token');
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok || data?.status === 'error') {
    const err = new Error(`API error ${res.status}`);
    err.detail = data;
    throw err;
  }
  return data;
}

try {
  const wh = await prisma.warehouse.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } }) || await prisma.warehouse.findFirst({ orderBy: { id: 'asc' } });
  assert(wh, 'มีคลังสำหรับทดสอบ');

  const item = await prisma.masterItem.create({
    data: {
      category: 'SOT_TEST',
      brand: tag,
      item_name: tag,
      condition: 'สต็อก',
      details: 'source-of-truth regression',
      size: 'TEST',
      stock_qty: 999,
    }
  });
  await prisma.warehouseStock.create({
    data: {
      item_id: item.id,
      warehouse_id: wh.id,
      stock_qty: 7,
      repair_qty: 2,
      scrap_qty: 1,
      lost_qty: 0,
      quarantine_qty: 3,
      transit_qty: 4,
    }
  });

  const items = await api(`/items?t=${Date.now()}`);
  const got = items.find(i => Number(i.rowIndex) === item.id);
  assert(got, '/api/items คืนรายการทดสอบ');
  assert(Number(got.จำนวน) === 7, '/api/items จำนวนต้องมาจาก SUM(WarehouseStock.stock_qty), ไม่ใช่ MasterItem.stock_qty', got);
  assert(Number(got.repair_qty) === 2, '/api/items repair_qty มาจาก WarehouseStock', got);
  assert(Number(got.quarantine_qty) === 3, '/api/items quarantine_qty มาจาก WarehouseStock', got);
  assert(Number(got.transit_qty) === 4, '/api/items transit_qty มาจาก WarehouseStock', got);
  const row = got.warehouse_stocks?.find(s => Number(s.warehouseId) === wh.id);
  assert(row && Number(row.stock) === 7, '/api/items มี warehouse_stocks ต่อคลังถูกต้อง', got.warehouse_stocks);

  console.log('PASS stock source of truth');
} finally {
  await prisma.warehouseStock.deleteMany({ where: { item: { brand: tag } } }).catch(() => {});
  await prisma.masterItem.deleteMany({ where: { brand: tag } }).catch(() => {});
  await prisma.$disconnect();
}
