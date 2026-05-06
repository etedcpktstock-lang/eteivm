import { Router } from 'express';
import { AssetUnitStatus } from '@prisma/client';
import prisma from '../lib/prisma';

const router = Router();

// ========== GET /api/transactions ==========
router.get('/', async (_req, res) => {
    try {
        const txns = await prisma.transaction.findMany({
            include: {
                item: true,
                job: { include: { customer: true } },
                operator: true,
            },
            orderBy: { created_at: 'desc' },
            take: 500, // Limit for performance
        });
        const mapped = txns.map(t => {
            // Reconstruct CV or name
            const cv = t.job?.customer?.cv ?? '';
            return {
                id: t.id.toString(), // Send ID as backup string
                เลขที่รายการ: t.job_id ?? `TXN-${t.id}`,
                "วัน-เวลา": t.created_at.toISOString(),
                ผู้ทำรายการ: t.operator?.name ?? t.delivery_by ?? 'Unknown',
                สถานะ: t.action_type,
                ประเภท: t.item?.category ?? 'งานบริการ (กิจกรรม)',
                "ยี่ห้อ/รูปแบบ": t.item?.brand ?? t.activity_name ?? '',
                รายการ: t.item?.item_name ?? t.activity_name ?? '',
                สภาพ: t.item?.condition ?? 'ปกติ',
                รายละเอียด: t.item?.details ?? '',
                ขนาด: t.item?.size ?? '',
                จำนวน: t.quantity,
                CV: cv || t.job?.customer_cv || '',
                เขตการทำงาน: t.zone_name ?? '',
                จัดส่งโดย: t.delivery_by || t.job?.delivery_by || 'N/A',
                ผู้แจ้ง: t.job?.notifier || t.operator?.name || '',
                วันที่แจ้ง: t.job?.notification_date?.toISOString() || '',
                กำหนดส่ง: t.job?.created_at.toISOString() || '',
                เวลานัดหมาย: t.job?.appointment_date?.toISOString() || '',
                "หมายเหตุแจ้งงาน": t.job?.note || '',
                "หมายเหตุเพิ่มเติม": t.note || '',
                หมายเหตุ: t.job?.note || t.note || t.return_reason || '',
                "สาเหตุการคืน": t.return_reason ?? '',
                "สภาพตู้": t.cabinet_status ?? '',
                "เหตุผลการยกเลิก": t.cancel_reason ?? '',
                "ยกเลิกโดย": t.action_type === 'ยกเลิก' ? (t.operator?.name ?? 'Unknown') : '',
                // 🚀 New Hardening Fields
                item_id: t.item_id,
                job_id: t.job_id || '',
                serial_number: t.serial_number || '',
                asset_tag: t.asset_tag || '',
                distance_warning: t.distance_warning || '',
                lat: t.lat,
                lng: t.lng,
                "รูปภาพประกอบ": t.image_url || '',
            };
        });
        return res.json(mapped);
    }
    catch (err: any) {
        return res.json({ status: 'error', message: err.message });
    }
});

// GET /api/transactions/asset-units
router.get('/asset-units', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const status = String(req.query.status || '').trim();
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const customerCv = String(req.query.customerCv || '').trim();
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
        const assetStatus = (Object.values(AssetUnitStatus) as string[]).includes(status)
            ? status as AssetUnitStatus
            : undefined;
        const units = await prisma.assetUnit.findMany({
            where: {
                ...(q
                    ? {
                        OR: [
                            { asset_tag: { contains: q, mode: 'insensitive' } },
                            { serial_number: { contains: q, mode: 'insensitive' } }
                        ]
                    }
                    : {}),
                ...(assetStatus ? { status: assetStatus } : {}),
                ...(warehouseId ? { current_warehouse_id: warehouseId } : {}),
                ...(customerCv ? { holder_customer_cv: customerCv } : {})
            },
            include: {
                item: true,
                current_warehouse: true,
                holder_customer: true
            },
            orderBy: { updated_at: 'desc' },
            take: limit
        });
        return res.json({
            status: 'success',
            items: units.map((u) => ({
                id: u.id,
                assetTag: u.asset_tag,
                serialNumber: u.serial_number || '',
                trackingType: u.item?.tracking_type || 'SERIALIZED',
                itemId: u.master_item_id,
                itemName: u.item?.item_name || u.item?.category || 'พัสดุ',
                category: u.item?.category || '',
                status: u.status,
                warehouseId: u.current_warehouse_id,
                warehouseName: u.current_warehouse?.name || '',
                holderCustomerCv: u.holder_customer_cv,
                holderCustomerName: u.holder_customer?.name || '',
                note: u.note || '',
                updatedAt: u.updated_at
            }))
        });
    }
    catch (err: any) {
        return res.json({ status: 'error', message: err.message });
    }
});

// GET /api/transactions/asset-units/:assetTag
router.get('/asset-units/:assetTag', async (req, res) => {
    try {
        const assetTag = String(req.params.assetTag || '').trim();
        if (!assetTag)
            return res.json({ status: 'error', message: 'Missing assetTag' });
        const unit = await prisma.assetUnit.findUnique({
            where: { asset_tag: assetTag },
            include: {
                item: true,
                current_warehouse: true,
                holder_customer: true
            }
        });
        if (!unit)
            return res.json({ status: 'error', message: 'ไม่พบรหัส Asset Tag นี้' });
        return res.json({
            status: 'success',
            item: {
                id: unit.id,
                assetTag: unit.asset_tag,
                serialNumber: unit.serial_number || '',
                trackingType: unit.item?.tracking_type || 'SERIALIZED',
                itemId: unit.master_item_id,
                itemName: unit.item?.item_name || unit.item?.category || 'พัสดุ',
                category: unit.item?.category || '',
                status: unit.status,
                warehouseId: unit.current_warehouse_id,
                warehouseName: unit.current_warehouse?.name || '',
                holderCustomerCv: unit.holder_customer_cv,
                holderCustomerName: unit.holder_customer?.name || '',
                note: unit.note || '',
                updatedAt: unit.updated_at
            }
        });
    }
    catch (err: any) {
        return res.json({ status: 'error', message: err.message });
    }
});

// GET /api/transactions/jobRequests (ใบแจ้งงาน)
router.get('/jobRequests', async (req, res) => {
    const { cv } = req.query;
    try {
        const jobs = await prisma.job.findMany({
            where: {
                ...(cv ? { customer_cv: String(cv) } : {}),
            },
            include: {
                customer: true,
                transactions: { include: { item: true } },
                operator: true,
                warehouse: true
            },
            orderBy: { created_at: 'desc' },
            take: 100
        });
        const mapped = jobs.map(j => ({
            jobId: j.job_id,
            cv: j.customer_cv,
            customerName: j.customer?.name ?? '',
            type: j.job_type,
            status: j.status,
            note: j.note,
            operator: j.operator?.name ?? 'SYSTEM',
            createdAt: j.created_at.toISOString(),
            appointmentDate: j.appointment_date,
            warehouse: j.warehouse?.name || '',
            warehouseId: j.warehouse_id,
            warehouse_id: j.warehouse_id,
            returnReason: j.transactions.find(t => t.return_reason)?.return_reason || '',
            items: j.transactions.map(t => ({
                item_id: t.item_id,
                warehouse_id: t.warehouse_id || j.warehouse_id,
                ประเภท: t.item?.category || 'งานบริการ',
                ยี่ห้อหรือรูปแบบ: t.item?.brand ?? t.activity_name ?? '',
                รายการ: t.item?.item_name ?? t.activity_name ?? '',
                ขนาด: t.item?.size ?? '',
                สภาพ: t.item?.condition ?? 'ปกติ',
                จำนวน: t.quantity,
                rowIndex: t.item?.id,
                tracking_type: t.item?.tracking_type || 'BATCH',
                action_type: t.action_type,
                return_reason: t.return_reason || '',
                cabinet_status: t.cabinet_status || '',
                serial_number: t.serial_number || '',
                serialNumber: t.serial_number || '',
                asset_tag: t.asset_tag || '',
                assetTag: t.asset_tag || ''
            }))
        }));
        return res.json(mapped);
    }
    catch (err: any) {
        return res.json({ status: 'error', message: err.message });
    }
});

// GET /api/transactions/logistics/jobs (สำหรับพนักงานขนส่งโดยเฉพาะ)
router.get('/logistics/jobs', async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            where: {
                status: {
                    notIn: ['ยกเลิก', 'ยกเลิกคงคลังแล้ว']
                },
                job_type: {
                    not: 'SURVEY'
                }
            },
            include: {
                customer: true,
                transactions: { include: { item: true } },
                operator: true,
                warehouse: true
            },
            orderBy: { created_at: 'desc' },
            take: 200
        });
        const mapped = jobs.map(j => ({
            jobId: j.job_id,
            cv: j.customer_cv,
            customerName: j.customer?.name ?? '',
            type: j.job_type,
            status: j.status,
            note: j.note,
            operator: j.operator?.name ?? 'SYSTEM',
            createdAt: j.created_at.toISOString(),
            appointmentDate: j.appointment_date,
            warehouse: j.warehouse?.name || 'Phuket',
            warehouseId: j.warehouse_id,
            items: j.transactions.map(t => ({
                id: t.id,
                รายการ: t.item?.item_name || t.item?.category || 'พัสดุ',
                ขนาด: t.item?.size || '',
                จำนวน: t.quantity,
                action_type: t.action_type,
                tracking_type: t.item?.tracking_type || 'BATCH',
                rowIndex: t.item_id,
                serialNumber: t.serial_number || '',
                assetTag: t.asset_tag || '',
                cabinet_status: t.cabinet_status || ''
            }))
        }));
        return res.json(mapped);
    }
    catch (err: any) {
        return res.json({ status: 'error', message: err.message });
    }
});

// GET /api/transactions/next-txn-no
router.get('/next-txn-no', async (_req, res) => {
    const { format } = await import('date-fns');
    try {
        const datePrefix = format(new Date(), 'yyMMdd');
        const lastJob = await prisma.job.findFirst({
            where: { job_id: { startsWith: `TXN-${datePrefix}` } },
            orderBy: { job_id: 'desc' }
        });
        let nextNum = 1;
        if (lastJob) {
            const parts = lastJob.job_id.split('-');
            if (parts.length === 3) {
                const currentNum = parseInt(parts[2], 10);
                if (!isNaN(currentNum))
                    nextNum = currentNum + 1;
            }
        }
        const nextTxnNo = `TXN-${datePrefix}-${String(nextNum).padStart(4, '0')}`;
        return res.json({ txnNo: nextTxnNo });
    }
    catch (error) {
        return res.json({ txnNo: `TXN-${format(new Date(), 'yyMMdd')}-0001` });
    }
});

export default router;
