import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'ete-dc-pkt-secret-2026';
function assert(ok, msg, detail){ if(!ok){ console.error('FAIL:', msg, detail || ''); process.exit(1); } console.log('✅', msg); }
async function api(path, body){ const user=await prisma.user.findFirst({orderBy:{id:'asc'}}); const token=jwt.sign({id:user.id, username:user.username, role:user.role}, JWT_SECRET, {expiresIn:'2h'}); const res=await fetch(`${API_BASE}${path}`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(body)}); const data=await res.json(); if(data?.status==='error') throw new Error(data.message); return data; }
const runId = process.env.REPAIR_RUN_ID || 'E2E-DEEP-1777266489361';
const job = await prisma.job.findFirst({ where:{ note: runId }, include:{ transactions:{ orderBy:{created_at:'desc'} } } });
assert(job, `พบ job ทดสอบ ${runId}`);
const q = job.transactions.find(t => t.action_type.includes('รอตรวจ'));
assert(q, 'พบ transaction รอตรวจสำหรับส่งซ่อม');
const before = await prisma.warehouseStock.findUnique({ where:{ item_id_warehouse_id:{ item_id:q.item_id, warehouse_id:q.warehouse_id || job.warehouse_id || 1 } } });
assert(before.quarantine_qty >= 1, `ก่อน action quarantine >= 1 (${before.quarantine_qty})`);
await api('/transactions/confirm-repair', { action:'quarantine_to_repair', itemId:q.item_id, originalTxnIds:[Number(q.id)], operatorName:'ผู้ดูแลระบบ', quantity:1, warehouseId:q.warehouse_id || job.warehouse_id || 1 });
const after = await prisma.warehouseStock.findUnique({ where:{ item_id_warehouse_id:{ item_id:q.item_id, warehouse_id:q.warehouse_id || job.warehouse_id || 1 } } });
assert(after.quarantine_qty === before.quarantine_qty - 1, `หลังส่งซ่อม quarantine ลด 1 (${before.quarantine_qty}->${after.quarantine_qty})`);
assert(after.repair_qty === before.repair_qty + 1, `หลังส่งซ่อม repair เพิ่ม 1 (${before.repair_qty}->${after.repair_qty})`);
const updated = await prisma.transaction.findUnique({ where:{ id:q.id } });
assert(updated.action_type.includes('ตรวจสอบแล้ว') && updated.cabinet_status.includes('ส่งซ่อม'), 'transaction ถูก mark ตรวจสอบแล้ว/ส่งซ่อม');
await prisma.$disconnect();
