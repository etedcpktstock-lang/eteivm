import { Router } from 'express';
import { AssetUnitStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { Notifier, type NotificationPayload } from '../lib/notifier';
import { ITEM_STATUS, JOB_STATUS, statusMatches } from '../lib/constants';
import { getDistance } from '../lib/location';

const router = Router();

// POST /api/transactions/processBatch
router.post('/processBatch', async (req, res) => {
    const { subAction, action, status, items, cv, jobId, txnNo, operator, note, workZone, returnReason, cabinetCondition, photos, deliveryBy, notifier, notificationDate, lat, lng, warehouseId, toWarehouseId } = req.body;
    try {
        const incomingItems = Array.isArray(items) ? items as any[] : [];
        const uniqueItems = incomingItems.reduce<Array<any & { _key: string }>>((acc, it, idx) => {
            const mid = Number(it.item?.rowIndex || it.item?.id || it.rowIndex || it.id);
            const sn = it.serialNumber || it.serial_number || null;
            const assetTag = it.assetTag || it.asset_tag || null;
            const cond = it.cabinetCondition || it.cabinet_status || null;
            const key = `${mid}-${sn}-${assetTag}-${cond}-${idx}`;
            const existing = acc.find((x: any) => x._key === key);
            if (!existing) { acc.push({ ...it, _key: key }); }
            else { existing.quantity = (Number(existing.quantity) || 0) + (Number(it.quantity) || 1); }
            return acc;
        }, []);

        const user = await prisma.user.findFirst({ where: { name: operator } }) || await prisma.user.findFirst();
        if (!user) throw new Error("Operator user not found in DB");
        const customer = cv ? await prisma.customer.findUnique({ where: { cv } }) : null;
        const effectiveTopAction = String(subAction || action || '').toLowerCase();
        const requiresCustomer = ['issue', 'return', 'fulfill'].includes(effectiveTopAction);
        if (requiresCustomer) {
            if (!cv || !String(cv).trim()) throw new Error('กรุณาระบุ CV ลูกค้าก่อนบันทึกรายการ');
            if (!customer) throw new Error('ไม่พบข้อมูลลูกค้าในระบบ กรุณาตรวจสอบ CV ก่อนบันทึก');
            const missingCustomerInfo = !String(customer.name || '').trim() || !String(customer.address || '').trim();
            if (missingCustomerInfo) throw new Error('ข้อมูลลูกค้าไม่ครบ (ต้องมีชื่อและที่อยู่) กรุณาแก้ข้อมูลลูกค้าก่อนบันทึก');
        }

        // Geofencing
        let distanceWarning = null;
        let geofenceEnforcement = "WARN";
        const geofenceSetting = await prisma.systemSetting.findUnique({ where: { key: 'GEOFENCE_ENFORCEMENT' } });
        if (geofenceSetting) geofenceEnforcement = geofenceSetting.value;
        if (customer && lat && lng && customer.latitude && customer.longitude) {
            const dist = getDistance(Number(lat), Number(lng), customer.latitude, customer.longitude);
            if (dist > 500) {
                const warning = `⚠️ ห่างจากจุดร้านค้า ${(dist / 1000).toFixed(2)} กม.`;
                if (geofenceEnforcement === 'BLOCK') throw new Error(`ไม่อนุญาตให้ทำรายการนอกพื้นที่ร้านค้า (${warning}) กรุณาตรวจสอบพิกัด GPS ของท่าน`);
                distanceWarning = warning;
            }
        }

        const finalJobId = jobId || txnNo || `JOB-${Date.now()}`;
        await prisma.$transaction(async (tx) => {
            const jobRecord = await tx.job.upsert({
                where: { job_id: finalJobId },
                update: { status, delivery_by: deliveryBy || undefined, notifier: notifier || undefined, notification_date: notificationDate ? new Date(notificationDate) : undefined, warehouse_id: warehouseId ? Number(warehouseId) : undefined },
                create: { job_id: finalJobId, customer_cv: (cv === 'ADMIN_REVIEW' || !customer) ? null : cv, job_type: String(subAction || action || "RETURN").toUpperCase(), operator_id: user.id, status, note: note || null, delivery_by: deliveryBy || null, notifier: notifier || null, notification_date: notificationDate ? new Date(notificationDate) : null, warehouse_id: warehouseId ? Number(warehouseId) : 1 }
            });
            const resolvedWarehouseId = Number(warehouseId || jobRecord.warehouse_id || 1);
            const resolvedToWarehouseId = Number(toWarehouseId || 0);

            // Batch-level idempotency check
            if (finalJobId && txnNo) {
                const batchAlreadyProcessed = await tx.transaction.findFirst({ where: { job_id: finalJobId, txn_no: txnNo } });
                if (batchAlreadyProcessed) { console.log(`[IDEMPOTENCY] Batch ${txnNo} already processed for Job ${finalJobId}. Skipping.`); return; }
            }

            for (const reqItem of uniqueItems) {
                const qty = Number(reqItem.quantity || 1);
                let itemStatus = reqItem.status || status || 'ปกติ';
                const effectiveAction = (subAction || action || '').toLowerCase();
                const isSurveyJob = jobRecord?.job_type === 'SURVEY' || effectiveAction === 'survey';
                const isStatusOnly = effectiveAction === 'status_only' || effectiveAction === 'status_update';

                if (effectiveAction === 'return' || effectiveAction === 'receive' || (effectiveAction === 'fulfill' && itemStatus.includes('รอตรวจ'))) {
                    if (itemStatus.includes('รอตรวจ') || effectiveAction === 'return') itemStatus = 'รอตรวจสอบ';
                }

                const sn = reqItem.serialNumber || reqItem.serial_number || null;
                const requestedAssetTag = reqItem.assetTag || reqItem.asset_tag || null;
                const masterItemId = Number(reqItem.item?.rowIndex || reqItem.item?.id || reqItem.rowIndex || reqItem.id);
                const activityName = reqItem.activity_name || (isSurveyJob ? 'งานสำรวจลูกค้า' : null);
                if (!activityName && isNaN(masterItemId)) throw new Error(`ข้อมูลพัสดุไม่ถูกต้อง (Invalid Item ID: ${masterItemId})`);

                const itemMeta = !isNaN(masterItemId) ? await tx.masterItem.findUnique({ where: { id: masterItemId }, select: { tracking_type: true } }) : null;
                const trackingType = itemMeta?.tracking_type || 'BATCH';
                if (trackingType === 'SERIALIZED' && qty > 1 && !Array.isArray(reqItem.assetTags))
                    throw new Error('สินค้ารายชิ้น (SERIALIZED) ต้องบันทึกทีละชิ้น หรือส่ง assetTags[] ให้ครบตามจำนวน');

                // Status matching
                const isNormalReturn = statusMatches(itemStatus, ITEM_STATUS.NORMAL);
                const isRepairStatus = statusMatches(itemStatus, ITEM_STATUS.REPAIR);
                const isScrapStatus = statusMatches(itemStatus, ITEM_STATUS.SCRAP);
                const isLostStatus = statusMatches(itemStatus, ITEM_STATUS.LOST);
                const isQuarantineStatus = statusMatches(itemStatus, ITEM_STATUS.QUARANTINE);
                const isTransitStatus = statusMatches(itemStatus, ITEM_STATUS.TRANSIT);
                const globalStatus = status || '';

                const isIssuingToDriver = effectiveAction === 'issue' && (isTransitStatus || statusMatches(globalStatus, JOB_STATUS.TRANSIT_ACTIVES)) && !statusMatches(itemStatus, JOB_STATUS.COMPLETED);
                const isFulfillReturnToBaseItem = effectiveAction === 'fulfill' && (itemStatus.includes('รอตรวจ') || statusMatches(itemStatus, ITEM_STATUS.QUARANTINE));
                const isFulfillPickupReturnItem = effectiveAction === 'fulfill' && !isFulfillReturnToBaseItem && Boolean(reqItem.returnReason || returnReason || statusMatches(itemStatus, JOB_STATUS.PICKUP));
                const isFulfillReturnItem = isFulfillReturnToBaseItem || isFulfillPickupReturnItem;
                const isFulfillDeliveryItem = effectiveAction === 'fulfill' && !isFulfillReturnItem && statusMatches(itemStatus, JOB_STATUS.COMPLETED);
                const isFulfillingDelivery = (effectiveAction === 'issue' && (statusMatches(itemStatus, JOB_STATUS.COMPLETED) || statusMatches(globalStatus, JOB_STATUS.COMPLETED))) || isFulfillDeliveryItem;
                const isReturningToBase = (
                    (effectiveAction !== 'fulfill' && (effectiveAction === 'return' || effectiveAction === 'receive') && (statusMatches(globalStatus, JOB_STATUS.RETURNED_TO_BASE) || itemStatus.includes('รอตรวจ')))
                    || isFulfillReturnToBaseItem
                );
                const isPickingUpToTransit = !isReturningToBase && ((effectiveAction === 'return' && statusMatches(globalStatus, JOB_STATUS.PICKUP)) || isFulfillPickupReturnItem);

                let stockChange = 0, repairChange = 0, scrapChange = 0, lostChange = 0, quarantineChange = 0, transitChange = 0;
                if (!isStatusOnly && !isSurveyJob) {
                    if (isReturningToBase) { transitChange = -qty; quarantineChange = qty; }
                    else if (isIssuingToDriver) { stockChange = -qty; transitChange = qty; }
                    else if (isFulfillingDelivery) { transitChange = -qty; }
                    else if (isPickingUpToTransit) { transitChange = qty; }
                    else if (effectiveAction === 'transfer') {
                        if (!resolvedToWarehouseId || isNaN(resolvedToWarehouseId)) throw new Error("กรุณาเลือกคลังปลายทาง");
                        if (resolvedWarehouseId === resolvedToWarehouseId) throw new Error("คลังต้นทางและปลายทางต้องไม่เป็นคลังเดียวกัน");
                        stockChange = -qty;
                    } else {
                        const shouldIncStock = subAction === 'receive' && isNormalReturn;
                        const shouldIncRepair = subAction === 'receive' && isRepairStatus;
                        const shouldIncScrap = subAction === 'receive' && isScrapStatus;
                        const shouldIncLost = subAction === 'receive' && isLostStatus;
                        const shouldIncQuarantine = subAction === 'receive' && isQuarantineStatus;
                        const shouldDecStock = subAction === 'issue' && (isNormalReturn || !isRepairStatus && !isScrapStatus && !isLostStatus && !isQuarantineStatus);
                        const shouldDecRepair = subAction === 'issue' && isRepairStatus;
                        const shouldDecScrap = subAction === 'issue' && isScrapStatus;
                        const shouldDecLost = subAction === 'issue' && isLostStatus;
                        const shouldDecQuarantine = subAction === 'issue' && isQuarantineStatus;
                        stockChange = shouldIncStock ? qty : (shouldDecStock ? -qty : 0);
                        repairChange = shouldIncRepair ? qty : (shouldDecRepair ? -qty : 0);
                        scrapChange = shouldIncScrap ? qty : (shouldDecScrap ? -qty : 0);
                        lostChange = shouldIncLost ? qty : (shouldDecLost ? -qty : 0);
                        quarantineChange = shouldIncQuarantine ? qty : (shouldDecQuarantine ? -qty : 0);
                    }
                }

                // Admin Review bucket transfers
                if (cv === 'ADMIN_REVIEW' || cv === 'QUARANTINE_REVIEW' || subAction === 'review') {
                    if (subAction === 'receive' || action === 'receive') {
                        const isComingFromRepair = itemStatus.includes('ซ่อมเสร็จ') || status?.includes('ซ่อมเสร็จ');
                        if (isComingFromRepair) { repairChange = -qty; stockChange = qty; }
                        else {
                            quarantineChange = -qty;
                            if (isNormalReturn || itemStatus.includes('ปกติ')) stockChange = qty;
                            else if (isRepairStatus) repairChange = qty;
                            else if (isScrapStatus) scrapChange = qty;
                            else if (isLostStatus) lostChange = qty;
                            else stockChange = qty;
                        }
                    }
                }

                if (!isSurveyJob && (stockChange !== 0 || repairChange !== 0 || scrapChange !== 0 || lostChange !== 0 || quarantineChange !== 0 || transitChange !== 0)) {
                    const itemInDB = await tx.masterItem.findUnique({ where: { id: masterItemId }, select: { stock_qty: true, item_name: true, category: true, brand: true, size: true } });
                    if (!itemInDB) throw new Error(`ไม่พบพัสดุรหัส ${masterItemId} ในระบบ`);
                    const whStock = await tx.warehouseStock.findUnique({ where: { item_id_warehouse_id: { item_id: masterItemId, warehouse_id: resolvedWarehouseId } } });
                    const currentWhStock = whStock?.stock_qty || 0;
                    const currentWhTransit = whStock?.transit_qty || 0;

                    if (stockChange < 0 && currentWhStock < qty) {
                        const displayName = itemInDB.item_name || [itemInDB.category, itemInDB.brand, itemInDB.size].filter(Boolean).join(' ') || `รหัสพัสดุ ${masterItemId}`;
                        const whName = await tx.warehouse.findUnique({ where: { id: resolvedWarehouseId } }).then(w => w?.name || 'รหัส ' + resolvedWarehouseId);
                        throw new Error(`สต๊อกคลังพัสดุ "${whName}" ไม่พอสำหรับรายการ "${displayName}" (เหลือ ${currentWhStock} แต่ต้องการเบิก ${qty})`);
                    }
                    if (transitChange < 0 && isReturningToBase) { transitChange = Math.max(-currentWhTransit, transitChange); }
                    else if (transitChange < 0 && currentWhTransit < qty) {
                        const displayName = itemInDB.item_name || [itemInDB.category, itemInDB.brand, itemInDB.size].filter(Boolean).join(' ') || `รหัสพัสดุ ${masterItemId}`;
                        throw new Error(`สต๊อก 'ระหว่างส่ง' ในคลังที่เลือกไม่พอกำหรับรายการ "${displayName}" (เหลือ ${currentWhTransit} แต่ต้องการตัดส่งมอบ ${qty})`);
                    }

                    if (effectiveAction !== 'transfer') {
                        await tx.masterItem.update({ where: { id: masterItemId }, data: { stock_qty: { increment: stockChange } } });
                    }
                    await tx.warehouseStock.upsert({
                        where: { item_id_warehouse_id: { item_id: masterItemId, warehouse_id: resolvedWarehouseId } },
                        update: { stock_qty: { increment: stockChange }, repair_qty: { increment: repairChange }, scrap_qty: { increment: scrapChange }, lost_qty: { increment: lostChange }, quarantine_qty: { increment: quarantineChange }, transit_qty: { increment: transitChange } },
                        create: { item_id: masterItemId, warehouse_id: resolvedWarehouseId, stock_qty: stockChange > 0 ? stockChange : 0, repair_qty: repairChange > 0 ? repairChange : 0, scrap_qty: scrapChange > 0 ? scrapChange : 0, lost_qty: lostChange > 0 ? lostChange : 0, quarantine_qty: quarantineChange > 0 ? quarantineChange : 0, transit_qty: transitChange > 0 ? transitChange : 0 }
                    });

                    if (effectiveAction === 'transfer' && stockChange < 0 && resolvedToWarehouseId > 0) {
                        await tx.warehouseStock.upsert({
                            where: { item_id_warehouse_id: { item_id: masterItemId, warehouse_id: resolvedToWarehouseId } },
                            update: { stock_qty: { increment: qty } },
                            create: { item_id: masterItemId, warehouse_id: resolvedToWarehouseId, stock_qty: qty, repair_qty: 0, scrap_qty: 0, lost_qty: 0, quarantine_qty: 0, transit_qty: 0 }
                        });
                    }

                    // Customer inventory
                    if (cv && cv !== 'ADMIN_REVIEW' && cv !== 'QUARANTINE_REVIEW' && !isSurveyJob && !isStatusOnly) {
                        let customerQtyChange = 0;
                        if (isFulfillingDelivery) customerQtyChange = qty;
                        else if (isPickingUpToTransit) customerQtyChange = -qty;
                        if (customerQtyChange < 0) {
                            const existing = await tx.customerInventory.findUnique({ where: { customer_cv_item_id: { customer_cv: cv, item_id: masterItemId } } });
                            if (!existing || existing.quantity <= 0) customerQtyChange = 0;
                            else if (existing.quantity + customerQtyChange < 0) customerQtyChange = -existing.quantity;
                        }
                        if (customerQtyChange !== 0) {
                            await tx.customerInventory.upsert({
                                where: { customer_cv_item_id: { customer_cv: cv, item_id: masterItemId } },
                                update: { quantity: { increment: customerQtyChange } },
                                create: { customer_cv: cv, item_id: masterItemId, quantity: Math.max(0, customerQtyChange) }
                            });
                        }
                    }
                }

                // Determine DB action type label
                let dbActionType = itemStatus;
                if (effectiveAction === 'transfer') dbActionType = 'ย้ายพัสดุ';
                else if (quarantineChange > 0 || effectiveAction === 'return' || effectiveAction === 'receive' || (effectiveAction === 'fulfill' && itemStatus.includes('รอตรวจ'))) dbActionType = 'รอตรวจสอบ';
                else if (effectiveAction === 'fulfill' && (statusMatches(itemStatus, JOB_STATUS.COMPLETED) || statusMatches(globalStatus, JOB_STATUS.COMPLETED))) dbActionType = 'ส่งมอบเรียบร้อย';

                const totalQty = Math.max(1, Math.floor(qty));
                const validZones = await tx.zone.findMany({ select: { name: true } }).then(zs => zs.map(z => z.name));
                const rawZone = (workZone === 'ADMIN_OFFICE' ? null : (workZone || null));
                const effectiveZone = validZones.includes(rawZone) ? rawZone : null;

                for (let i = 0; i < totalQty; i++) {
                    const perItemTagFromArray = Array.isArray(reqItem.assetTags) ? reqItem.assetTags[i] : null;
                    const txAssetTag = trackingType === 'SERIALIZED' ? (perItemTagFromArray || requestedAssetTag || sn || `AST-${masterItemId}-${Date.now()}-${i + 1}`) : null;
                    await tx.transaction.create({
                        data: {
                            job_id: jobRecord.job_id, item_id: isNaN(masterItemId) ? null : masterItemId, activity_name: activityName,
                            operator_id: user.id, action_type: dbActionType, quantity: 1, zone_name: effectiveZone,
                            delivery_by: deliveryBy || null, return_reason: reqItem.returnReason || returnReason || null,
                            cabinet_status: reqItem.cabinetCondition || (effectiveAction === 'issue' || effectiveAction === 'fulfill' ? 'ปกติ' : (reqItem.status || cabinetCondition || null)),
                            image_url: photos && photos.length > 0 ? photos.join('\n') : null,
                            serial_number: sn, asset_tag: txAssetTag,
                            lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null,
                            distance_warning: distanceWarning, note: reqItem.note || note || null,
                            txn_no: txnNo || null,
                            to_warehouse_id: effectiveAction === 'transfer' ? resolvedToWarehouseId : null,
                            warehouse_id: resolvedWarehouseId
                        }
                    });
                    // Asset unit tracking for SERIALIZED items
                    if (trackingType === 'SERIALIZED' && txAssetTag && !isNaN(masterItemId)) {
                        let nextAssetStatus: AssetUnitStatus = AssetUnitStatus.stock;
                        let nextWarehouseId: number | null = resolvedWarehouseId;
                        let nextCustomerCv: string | null = null;
                        if (isFulfillingDelivery) { nextAssetStatus = AssetUnitStatus.with_customer; nextWarehouseId = null; nextCustomerCv = cv || null; }
                        else if (isReturningToBase || quarantineChange > 0) { nextAssetStatus = AssetUnitStatus.quarantine; nextCustomerCv = null; }
                        else if (isIssuingToDriver || isPickingUpToTransit || transitChange > 0) { nextAssetStatus = AssetUnitStatus.in_transit; nextCustomerCv = null; }
                        else if (repairChange > 0) nextAssetStatus = AssetUnitStatus.repair;
                        else if (scrapChange > 0) nextAssetStatus = AssetUnitStatus.scrap;
                        else if (lostChange > 0) nextAssetStatus = AssetUnitStatus.lost;
                        else if (effectiveAction === 'transfer') { nextWarehouseId = resolvedToWarehouseId || resolvedWarehouseId; nextCustomerCv = null; }
                        await tx.assetUnit.upsert({
                            where: { asset_tag: txAssetTag },
                            update: { master_item_id: masterItemId, serial_number: sn, status: nextAssetStatus, current_warehouse_id: nextWarehouseId, holder_customer_cv: nextCustomerCv, note: reqItem.note || note || null },
                            create: { master_item_id: masterItemId, asset_tag: txAssetTag, serial_number: sn, status: nextAssetStatus, current_warehouse_id: nextWarehouseId, holder_customer_cv: nextCustomerCv, note: reqItem.note || note || null }
                        });
                    }
                }
            }
            // Final job status for RETURN jobs
            const isStatusOnly = subAction === 'status_only' || subAction === 'status_update';
            if (jobRecord.job_type === 'RETURN' && !isStatusOnly) {
                const allTxns = await tx.transaction.findMany({ where: { job_id: finalJobId } });
                const totalRequested = allTxns.filter(t => t.action_type === 'แจ้งคืน').reduce((sum, t) => sum + t.quantity, 0);
                const processKeywords = ['รอตรวจ', 'รับคืน', 'สูญหาย', 'ชำรุดหนัก', 'ชำรุดหนัก/ซาก', 'รอตรวจสอบ'];
                const totalProcessed = allTxns.filter(t => processKeywords.some(k => (t.action_type || '').includes(k))).reduce((sum, t) => sum + t.quantity, 0);
                const hasLoss = allTxns.some(t => ['สูญหาย', 'ชำรุดหนัก', 'ชำรุดหนัก/ซาก'].includes(t.action_type));
                let finalStatus = status;
                if (totalProcessed === 0) {
                    const isInProgress = (status || '').toLowerCase().includes('transit') || (status || '').includes('เดินทาง') || (status || '').includes('ร้าน') || (status || '').toUpperCase().includes('ACCEPTED') || (status || '').includes('รับงาน') || (status || '').includes('เบิก') || (status || '').includes('กำลังไปส่ง');
                    if (!isInProgress) finalStatus = 'รอรับคืน';
                } else if (totalProcessed < totalRequested) { finalStatus = 'คืนบางส่วน'; }
                else { finalStatus = hasLoss ? 'ปิดงาน (มีพัสดุสูญหาย/ซาก)' : 'คืนของแล้ว'; }
                await tx.job.update({ where: { job_id: finalJobId }, data: { status: finalStatus } });
            }
        }, { maxWait: 10000, timeout: 20000 });

        // Notify
        const notificationType: NotificationPayload['type'] = effectiveTopAction === 'receive' ? 'RECEIVE' : effectiveTopAction === 'issue' || effectiveTopAction === 'transfer' ? 'ISSUE' : 'RETURN';
        Notifier.notify({
            type: notificationType, txnNo: finalJobId, operator, customer: customer?.name, cv,
            items: items.map((i: any) => ({ name: i.item ? `${i.item.รายการ || ''} ${i.item.ขนาด || ''}`.trim() : (i.activity_name || 'งานบริการ/กิจกรรม'), quantity: i.quantity })),
            note, photos
        });
        return res.json({ status: 'success', message: 'ทำรายการสำเร็จ', jobId: finalJobId });
    } catch (err: any) {
        console.error("Batch Transaction Error:", err);
        return res.json({ status: 'error', message: err.message });
    }
});

export default router;
