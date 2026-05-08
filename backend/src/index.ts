import express from 'express';
import http from 'http';
import cors from 'cors';
import { initSocket } from './lib/socket';
import dotenv from 'dotenv';
import prisma from './lib/prisma'; // Initialize prisma here globally

import { authenticateToken } from './middleware/auth';
import { requireRole } from './middleware/permissions';
import authRoutes from './routes/auth';
import itemsRoutes from './routes/items';
import transactionsRoutes from './routes/transactions';
import customersRoutes from './routes/customers';
import zonesRoutes from './routes/zones';
import settingsRoutes from './routes/settings';
import warehousesRoutes from './routes/warehouses';
import uploadRoutes from './routes/upload';
import itemMergeRoutes from './routes/itemMerge';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost and common LAN IPs (192.168.x, 10.x, 172.x) for development
    const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$/;
    if (allowed.test(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));
app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(express.json({ limit: '10mb' })); // Support base64 image payload
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Routes
app.use((req, _res, next) => {
  console.log(`📢 ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/items', authenticateToken, itemsRoutes);
app.use('/api/transactions', authenticateToken, transactionsRoutes);
app.use('/api/customers', authenticateToken, customersRoutes);
app.use('/api/zones', authenticateToken, zonesRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/warehouses', authenticateToken, warehousesRoutes);

app.use('/api/upload', uploadRoutes);
app.use('/api/items', authenticateToken, itemMergeRoutes); // merge-duplicates, find-duplicates
// Compatibility fallback for Frontend initial data load logic that maps to multiple things
app.get('/api/initialData', authenticateToken, async (_req, res) => {
    try {
        const [items, transactions, customers, zones, settingsList, permissionsList, warehouses] = await Promise.all([
          prisma.masterItem.findMany({ include: { warehouse_stocks: true } }),
          prisma.transaction.findMany({ include: { item: true, job: { include: { customer: true } }, operator: true }, orderBy: { created_at: 'desc' }, take: 500 }),
          prisma.customer.findMany({ include: { inventory: { include: { item: true } } } }),
          prisma.zone.findMany(),
          prisma.systemSetting.findMany(),
          prisma.rolePermission.findMany(),
          prisma.warehouse.findMany({ include: { stocks: true } })
        ]);

        
        let settings: any = {};
        settingsList.forEach((s: any) => settings[s.key] = s.value);

        let permissions: any = {};
        permissionsList.forEach((p: any) => permissions[p.role] = p.permissions);

        // Map items exactly same as frontend expectation
        const mappedItems = items.map((i: any) => {
             // Calculate totals from warehouse stocks
             const totalStock = i.warehouse_stocks.reduce((acc: number, cur: any) => acc + cur.stock_qty, 0);
             const totalRepair = i.warehouse_stocks.reduce((acc: number, cur: any) => acc + cur.repair_qty, 0);
             const totalScrap = i.warehouse_stocks.reduce((acc: number, cur: any) => acc + cur.scrap_qty, 0);
             const totalLost = i.warehouse_stocks.reduce((acc: number, cur: any) => acc + cur.lost_qty, 0);
             const totalQuarantine = i.warehouse_stocks.reduce((acc: number, cur: any) => acc + (cur.quarantine_qty || 0), 0);
             const totalTransit = i.warehouse_stocks.reduce((acc: number, cur: any) => acc + (cur.transit_qty || 0), 0);

             return {
              id: i.id, // Primary ID
              rowIndex: i.id, 
              ประเภท: i.category, 
              ยี่ห้อหรือรูปแบบ: i.brand ?? '', 
              รายการ: (i.item_name && i.item_name.trim()) ? i.item_name : i.category, 
              สภาพ: i.condition ?? '', 
              รายละเอียด: i.details ?? '', 
              ขนาด: i.size ?? '', 
              tracking_type: i.tracking_type || 'BATCH',
              จำนวน: totalStock,
              available_stock: totalStock,
              repair_qty: totalRepair,
              scrap_qty: totalScrap,
              lost_qty: totalLost,
              quarantine_qty: totalQuarantine,
              transit_qty: totalTransit,
              warehouse_stocks: i.warehouse_stocks.map((ws: any) => ({
                warehouseId: ws.warehouse_id,
                stock: ws.stock_qty,
                repair: ws.repair_qty,
                scrap: ws.scrap_qty,
                lost: ws.lost_qty,
                quarantine: ws.quarantine_qty || 0,
                transit: ws.transit_qty || 0
              }))
             };
        });

        

        // Map txns 
        const mappedTxns = transactions.map((t: any) => {
            const cv = t.job?.customer?.cv ?? t.job?.customer_cv ?? t.job?.cv ?? '';
            
            return {
              id: t.id.toString(), 
              item_id: t.item_id, // 👈 Added for frontend matching
              job_id: t.job_id || '',
              เลขที่รายการ: t.job_id ?? `TXN-${t.id}`, 
              "วัน-เวลา": t.created_at.toISOString(), 
              ผู้ทำรายการ: t.operator?.name ?? t.delivery_by ?? 'Unknown', 
              สถานะ: t.action_type, 
              ประเภท: t.item?.category ?? 'งานบริการ (กิจกรรม)', 
              "ยี่ห้อ/รูปแบบ": t.item?.brand ?? t.activity_name ?? '', 
              รายการ: (t.item?.item_name && t.item?.item_name.trim()) ? t.item?.item_name : (t.item?.category ?? t.activity_name ?? 'งานบริการ'), 
              สภาพ: t.item?.condition ?? 'ปกติ', 
              รายละเอียด: t.item?.details ?? '', 
              ขนาด: t.item?.size ?? '', 
              จำนวน: t.quantity, 
              CV: cv,
              "สาเหตุการคืน": t.return_reason ?? '', 
              "สภาพตู้": t.cabinet_status ?? '', 
              "เหตุผลการยกเลิก": t.cancel_reason ?? '',
              serial_number: t.serial_number ?? '',
              asset_tag: t.asset_tag ?? '',
              tracking_type: t.item?.tracking_type || 'BATCH',
              "ผู้แจ้ง": t.job?.notifier || t.operator?.name || '',
              "วันที่แจ้ง": t.job?.notification_date ? t.job.notification_date.toISOString() : '',
              "กำหนดส่ง": t.job?.created_at ? t.job.created_at.toISOString() : '',
              "เวลานัดหมาย": t.job?.appointment_date ? t.job.appointment_date.toISOString() : '',
              "จัดส่งโดย": t.job?.delivery_by ?? t.delivery_by ?? 'N/A',
              "เขตการทำงาน": t.zone_name ?? '',
              "รูปภาพประกอบ": t.image_url ?? '',
              lat: t.lat ?? '',
              lng: t.lng ?? '',
              distance_warning: t.distance_warning ?? '',
              หมายเหตุ: t.job?.note ?? t.return_reason ?? ''
            };
        });

        const mappedCustomers = customers.map((c: any) => ({
             rowIndex: c.cv, 
             cv: c.cv, 
             name: c.name, 
             phone: c.phone ?? '', 
             address: c.address ?? '', 
             subdistrict: c.sub_district ?? '', 
             district: c.district ?? '', 
             province: c.province ?? '', 
             zipcode: c.zipcode ?? '', 
             lat: String(c.latitude ?? ''), 
             lng: String(c.longitude ?? ''),
             image_url: c.image_url ?? '',
             inventory: (c.inventory || []).map((inv: any) => ({
                id: inv.id,
                itemId: inv.item_id,
                name: inv.item?.item_name || inv.item?.category || 'พัสดุ',
                brand: inv.item?.brand || '',
                size: inv.item?.size || '',
                detail: inv.item?.details || '',
                qty: inv.quantity,
                lastUpdate: inv.last_updated
             }))
        }));

        return res.json({
            status: 'success',
            items: mappedItems,
            transactions: mappedTxns,
            customers: mappedCustomers,
            zones: zones.map((z: any) => ({ name: z.name, rowIndex: z.name })),
            warehouses: warehouses.map((w: any) => ({ 
              id: w.id, 
              name: w.name, 
              stocks: w.stocks.map((s: any) => ({
                itemId: s.item_id,
                stock: s.stock_qty,
                repair: s.repair_qty,
                scrap: s.scrap_qty,
                quarantine: s.quarantine_qty,
                lost: s.lost_qty,
                transit: s.transit_qty
              }))
            })),
            settings,
            permissions
        });

    } catch (err: any) {
        console.error(err);
        return res.json({ status: 'error', message: err.message });
    }
});

// Start Server
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT as number, '0.0.0.0', () => {
  console.log(`🚀 API Server running on http://0.0.0.0:${PORT}`);
});
