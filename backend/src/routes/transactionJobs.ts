import { Router } from 'express';
import prisma from '../lib/prisma';
import { format } from 'date-fns';
import { Notifier } from '../lib/notifier';
import { ITEM_STATUS, JOB_STATUS, statusMatches } from '../lib/constants';
import { requireRole } from '../middleware/permissions';

const router = Router();

// POST /api/transactions/cancel (ยกเลิกรายการทั้งหมดในใบงาน) — OFFICER+
router.post('/cancel', requireRole('OFFICER'), async (req, res) => {
    const { txnNo, reason, operator } = req.body;
    if (!txnNo)
        return res.json({ status: 'error', message: 'Missing Transaction No (job_id)' });
    try {
        const user = await prisma.user.findFirst({ where: { name: operator } }) || await prisma.user.findFirst();
        const result = await prisma.$transaction(async (tx) => {
            const job = await tx.job.findUnique({
                where: { job_id: txnNo },
                include: {
                    transactions: { include: { item: true } },
                    customer: true
                }
            });
            if (!job)
                throw new Error(`ไม่พบเลขที่รายการ "${txnNo}"`);
            if (job.status === 'ยกเลิก' || job.status.includes('ยกเลิก'))
                throw new Error('รายการนี้ถูกยกเลิกไปแล้ว');
            for (const txn of job.transactions) {
                let stockChange = 0;
                let repairChange = 0;
                let scrapChange = 0;
                let lostChange = 0;
                let quarantineChange = 0;
                let transitChange = 0;
                const action = txn.action_type || '';
                const isIssue = action.includes('เบิกออก') || action.includes('BORROW') || action.includes('ISSUE');
                const isReturn = action.includes('รับคืน') || action.includes('RECEIVE') || action.includes('RETURN');
                const isQuarantine = action.includes('รอตรวจ') || action.includes('รอตรวจสอบ');
                if (isIssue) {
                    transitChange = -txn.quantity;
                    if (statusMatches(action, ITEM_STATUS.REPAIR)) {
                        repairChange = txn.quantity;
                    } else if (statusMatches(action, ITEM_STATUS.SCRAP)) {
                        scrapChange = txn.quantity;
                    } else if (statusMatches(action, ITEM_STATUS.LOST)) {
                        lostChange = txn.quantity;
                    } else if (statusMatches(action, ITEM_STATUS.QUARANTINE)) {
                        quarantineChange = txn.quantity;
                    } else {
                        stockChange = txn.quantity;
                    }
                } else if (isReturn || isQuarantine) {
                    if (action.includes('เดินทางกลับ') || action.includes('PICKUP')) {
                        transitChange = -txn.quantity;
                    } else {
                        quarantineChange = -txn.quantity;
                    }
                } else if (action === 'รับเข้า') {
                    stockChange = -txn.quantity;
                }
                if (stockChange !== 0 || repairChange !== 0 || scrapChange !== 0 || lostChange !== 0 || quarantineChange !== 0 || transitChange !== 0) {
                    const itemId = txn.item_id;
                    const warehouseId = job.warehouse_id;
                    if (itemId && stockChange !== 0) {
                        await tx.masterItem.update({
                            where: { id: itemId },
                            data: { stock_qty: { increment: stockChange } }
                        });
                    }
                    if (itemId && warehouseId) {
                        await tx.warehouseStock.upsert({
                            where: { item_id_warehouse_id: { item_id: itemId, warehouse_id: warehouseId } },
                            update: {
                                stock_qty: { increment: stockChange },
                                repair_qty: { increment: repairChange },
                                scrap_qty: { increment: scrapChange },
                                lost_qty: { increment: lostChange },
                                quarantine_qty: { increment: quarantineChange },
                                transit_qty: { increment: transitChange }
                            },
                            create: {
                                item_id: itemId, warehouse_id: warehouseId,
                                stock_qty: Math.max(0, stockChange), repair_qty: Math.max(0, repairChange),
                                scrap_qty: Math.max(0, scrapChange), lost_qty: Math.max(0, lostChange),
                                quarantine_qty: Math.max(0, quarantineChange), transit_qty: Math.max(0, transitChange)
                            }
                        }).catch(e => console.error("WH Revert Error:", e));
                    }
                }
                await tx.transaction.update({
                    where: { id: txn.id },
                    data: { cancel_reason: reason || 'ยกเลิกโดยผู้ใช้', action_type: 'ยกเลิก' }
                });
            }
            await tx.job.update({ where: { job_id: txnNo }, data: { status: 'ยกเลิกคงคลังแล้ว' } });
            await tx.auditLog.create({ data: { user_id: user?.id, action: `CANCEL_JOB: ${txnNo} (Reason: ${reason})` } });
            return job;
        });
        Notifier.notify({
            type: 'VOID', txnNo, operator: operator || 'System',
            customer: result.customer?.name, cv: result.customer_cv || undefined,
            items: result.transactions.map(t => ({ name: t.item?.item_name || t.activity_name || 'พัสดุ/กิจกรรม', quantity: t.quantity })),
            note: reason
        });
        return res.json({ status: 'success', message: 'ยกเลิกรายการสำเร็จ' });
    } catch (err: any) {
        console.error("Cancel Error:", err);
        return res.json({ status: 'error', message: err.message });
    }
});

// POST /api/transactions/jobRequest (แจ้งงานใหม่)
router.post('/jobRequest', async (req, res) => {
    const { cv, deliveryItems, returnItems, operator, note, returnReason, notifier, notificationDate, appointmentDate, warehouseId, photos } = req.body;
    try {
        let user = await prisma.user.findFirst({ where: { name: { contains: operator || '', mode: 'insensitive' } } });
        if (!user) user = await prisma.user.findFirst();
        if (!user) throw new Error("ไม่พบข้อมูลพนักงานในระบบ กรุณาตรวจสอบการตั้งค่าผู้ใช้งาน");
        const customer = cv ? await prisma.customer.findUnique({ where: { cv } }) : null;
        const resolvedWarehouseId = Number(warehouseId || 1);
        if (!cv || !String(cv).trim()) throw new Error('กรุณาระบุ CV ลูกค้าก่อนบันทึกใบแจ้งงาน');
        if (!customer) throw new Error('ไม่พบข้อมูลลูกค้าในระบบ กรุณาตรวจสอบ CV ก่อนบันทึกใบแจ้งงาน');
        const missingCustomerInfo = !String(customer.name || '').trim() || !String(customer.address || '').trim();
        if (missingCustomerInfo) throw new Error('ข้อมูลลูกค้าไม่ครบ (ต้องมีชื่อและที่อยู่) กรุณาแก้ข้อมูลลูกค้าก่อนบันทึกใบแจ้งงาน');
        if ((!deliveryItems || deliveryItems.length === 0) && (!returnItems || returnItems.length === 0))
            throw new Error('กรุณาเพิ่มรายการพัสดุก่อนบันทึกใบแจ้งงาน');

        // 🔒 Backend stock check for delivery items
        if (Array.isArray(deliveryItems) && deliveryItems.length > 0) {
            const requiredByItemId = new Map<number, number>();
            const pushRequired = (raw: any, qtyRaw: any) => {
                const rawId = raw?.item?.id || raw?.item?.rowIndex || raw?.rowIndex || raw?.item_id || raw?.id;
                const itemId = Number(rawId);
                if (!rawId || isNaN(itemId)) throw new Error('พบรายการพัสดุที่ไม่มีรหัสสินค้า (Item ID) กรุณาเลือกสินค้าใหม่อีกครั้ง');
                const qty = Math.max(0, Math.floor(Number(qtyRaw || raw?.quantity || 1)));
                if (qty <= 0) return;
                requiredByItemId.set(itemId, (requiredByItemId.get(itemId) || 0) + qty);
            };
            for (const it of deliveryItems) {
                pushRequired(it, it?.quantity);
                if (Array.isArray(it?.subItems)) {
                    for (const sub of it.subItems) pushRequired(sub, sub?.quantity);
                }
            }
            const itemIds = Array.from(requiredByItemId.keys());
            if (itemIds.length > 0) {
                const [stockRows, itemRows, warehouse] = await Promise.all([
                    prisma.warehouseStock.findMany({ where: { warehouse_id: resolvedWarehouseId, item_id: { in: itemIds } }, select: { item_id: true, stock_qty: true } }),
                    prisma.masterItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, item_name: true, category: true, brand: true, size: true } }),
                    prisma.warehouse.findUnique({ where: { id: resolvedWarehouseId }, select: { name: true } })
                ]);
                const stockMap = new Map(stockRows.map(s => [s.item_id, Number(s.stock_qty || 0)]));
                const itemMap = new Map(itemRows.map(i => [i.id, i]));
                for (const [itemId, requiredQty] of requiredByItemId.entries()) {
                    const availableQty = Number(stockMap.get(itemId) || 0);
                    if (requiredQty > availableQty) {
                        const itemMeta = itemMap.get(itemId);
                        const label = itemMeta?.item_name || [itemMeta?.category, itemMeta?.brand, itemMeta?.size].filter(Boolean).join(' ') || `รหัสพัสดุ ${itemId}`;
                        throw new Error(`สต็อกคลัง "${warehouse?.name || resolvedWarehouseId}" ไม่พอสำหรับรายการ "${label}" (เหลือ ${availableQty} แต่ต้องการ ${requiredQty})`);
                    }
                }
            }
        }

        const datePrefix = format(new Date(), 'yyyyMMdd');
        const timestamp = Date.now().toString().slice(-4);
        const jobId = `JOB-${datePrefix}-${timestamp}`;
        const jobType = deliveryItems && deliveryItems.length > 0 ? 'DELIVERY' : 'RETURN';

        await prisma.$transaction(async (tx) => {
            await tx.job.create({
                data: {
                    job_id: jobId, customer_cv: customer ? cv : null, job_type: jobType,
                    operator_id: user.id, status: jobType === 'RETURN' ? 'รอรับคืน' : 'PENDING',
                    note: note || null, notifier: notifier || null,
                    notification_date: notificationDate ? new Date(notificationDate) : null,
                    appointment_date: appointmentDate ? new Date(appointmentDate) : null,
                    warehouse_id: warehouseId ? Number(warehouseId) : 1
                }
            });
            const allReqItems = [
                ...(deliveryItems || []).map((i: any) => ({ ...i, _type: 'DELIVERY' })),
                ...(returnItems || []).map((i: any) => ({ ...i, _type: 'RETURN' }))
            ];
            const validZones = await tx.zone.findMany({ select: { name: true } }).then(zs => zs.map(z => z.name));
            let savedCount = 0;
            for (const it of allReqItems) {
                const rawId = it.item?.id || it.item?.rowIndex || it.rowIndex || it.item_id || it.id;
                const itemId = Number(rawId);
                if (!rawId || isNaN(itemId)) continue;
                const mainQty = Math.max(1, Math.floor(Number(it.quantity || 1)));
                const rawZone = it.zone_name || it.workZone || customer?.province || null;
                const effectiveZone = validZones.includes(rawZone) ? rawZone : null;
                for (let i = 0; i < mainQty; i++) {
                    await tx.transaction.create({
                        data: {
                            job_id: jobId, item_id: itemId, operator_id: user.id,
                            action_type: it._type === 'DELIVERY' ? 'แจ้งส่ง' : 'แจ้งคืน',
                            quantity: 1, serial_number: it.serialNumber || null, zone_name: effectiveZone,
                            delivery_by: it.deliveryBy || operator || user?.name || null,
                            warehouse_id: warehouseId ? Number(warehouseId) : 1,
                            return_reason: it._type === 'RETURN' ? (it.returnReasons?.[0] || it.returnReason || returnReason || null) : null,
                            cabinet_status: it.cabinetCondition || (it._type === 'DELIVERY' ? 'ปกติ' : (it.status || it.cabinet_status || null)),
                            image_url: photos && photos.length > 0 ? photos.join('\n') : null,
                            note: it._type === 'RETURN' && it.status && it.status !== 'ปกติ' ? `[RIDER CLAIM: ${it.status}]` : it.note || null
                        }
                    });
                    savedCount++;
                }
                if (it.subItems && Array.isArray(it.subItems)) {
                    for (const sub of it.subItems) {
                        const subRawId = sub.item?.id || sub.item?.rowIndex || sub.rowIndex || sub.item_id || sub.id;
                        const subItemId = Number(subRawId);
                        if (!subRawId || isNaN(subItemId)) continue;
                        const subQty = Math.max(1, Math.floor(Number(sub.quantity || 1)));
                        const subRawZone = it.zone_name || it.workZone || customer?.province || null;
                        const subEffectiveZone = validZones.includes(subRawZone) ? subRawZone : null;
                        for (let i = 0; i < subQty; i++) {
                            await tx.transaction.create({
                                data: {
                                    job_id: jobId, item_id: subItemId, operator_id: user.id,
                                    action_type: it._type === 'DELIVERY' ? 'แจ้งส่ง' : 'แจ้งคืน',
                                    quantity: 1, zone_name: subEffectiveZone,
                                    delivery_by: it.deliveryBy || operator || user?.name || null,
                                    warehouse_id: warehouseId ? Number(warehouseId) : 1,
                                    image_url: photos && photos.length > 0 ? photos.join('\n') : null,
                                    return_reason: it._type === 'RETURN' ? (sub.returnReason || it.returnReason || returnReason || 'แจ้งงานขอเก็บคืน') : null
                                }
                            });
                            savedCount++;
                        }
                    }
                }
            }
            if (savedCount === 0 && allReqItems.length > 0)
                throw new Error("ไม่สามารถบันทึกรายการพัสดุได้ (ตรวจสอบ ID สินค้าไม่พบ) กรุณาลองใหม่อีกครั้งครับ");
        });

        const allItems = [
            ...(deliveryItems || []).map((i: any) => ({ name: `[แจ้งส่ง] ${i.item?.รายการ || 'พัสดุ'}`, quantity: i.quantity })),
            ...(returnItems || []).map((i: any) => ({ name: `[แจ้งคืน] ${i.item?.รายการ || 'พัสดุ'}`, quantity: i.quantity }))
        ];
        Notifier.notify({ type: 'JOB_REQUEST', txnNo: jobId, operator: operator || user.name, customer: customer?.name, cv, items: allItems, note, photos });
        return res.json({ status: 'success', jobId });
    } catch (err: any) {
        console.error("JobRequest Error:", err);
        return res.json({ status: 'error', message: err.message });
    }
});

// POST /api/transactions/logistics/rider-cancel
router.post('/logistics/rider-cancel', async (req, res) => {
    const { jobId, reason, operatorName } = req.body;
    if (!jobId || !reason)
        return res.json({ status: 'error', message: 'Missing jobId or reason' });
    try {
        const result = await prisma.$transaction(async (tx) => {
            const job = await tx.job.findUnique({
                where: { job_id: jobId },
                include: { customer: true, transactions: { include: { item: true } } }
            });
            if (!job) throw new Error('Job not found');
            for (const t of job.transactions) {
                const action = String(t.action_type || '').toUpperCase();
                const isDelivery = ['ISSUE', 'DELIVERY', 'BORROW', 'เบิก'].some(k => action.includes(k));
                if (isDelivery && t.item_id) {
                    await tx.masterItem.update({ where: { id: t.item_id }, data: { transit_qty: { decrement: t.quantity }, quarantine_qty: { increment: t.quantity } } });
                    await tx.warehouseStock.updateMany({ where: { item_id: t.item_id, transit_qty: { gte: t.quantity } }, data: { transit_qty: { decrement: t.quantity }, quarantine_qty: { increment: t.quantity } } });
                    const cancelQty = Math.max(1, Math.floor(Number(t.quantity || 1)));
                    const validZones = await tx.zone.findMany({ select: { name: true } }).then(zs => zs.map(z => z.name));
                    for (let i = 0; i < cancelQty; i++) {
                        const rawZone = t.zone_name || job.customer?.province || null;
                        const effectiveZone = rawZone && validZones.includes(rawZone) ? rawZone : null;
                        await tx.transaction.create({
                            data: {
                                job_id: jobId, item_id: t.item_id, operator_id: job.operator_id,
                                action_type: `คลังกักกัน: ยกเลิกการส่ง (รอตรวจคืน)`, quantity: 1,
                                serial_number: t.serial_number, zone_name: effectiveZone,
                                delivery_by: operatorName || t.delivery_by || job.delivery_by || 'Rider',
                                warehouse_id: t.warehouse_id || job.warehouse_id || 1,
                                return_reason: `Rider ยกเลิก: ${reason}`, note: `ยกเลิกโดย ${operatorName || 'Rider'}`
                            }
                        });
                    }
                }
            }
            const updatedJob = await tx.job.update({
                where: { job_id: jobId },
                data: { status: `ยกเลิก (${reason})`, note: `ยกเลิกโดย ${operatorName || 'Rider'}: ${reason} (เมื่อ ${format(new Date(), 'HH:mm')})` }
            });
            return updatedJob;
        });
        return res.json({ status: 'success', data: result });
    } catch (err: any) {
        console.error("Rider Cancel Error:", err);
        return res.json({ status: 'error', message: err.message });
    }
});

export default router;
