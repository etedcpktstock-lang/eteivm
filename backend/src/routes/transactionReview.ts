import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// POST /api/transactions/confirm-repair (Admin Review Actions)
router.post('/confirm-repair', async (req, res) => {
    const { action, itemId, serialNumber, originalTxnId, originalTxnIds, operatorName, note, quantity } = req.body;
    const qty = Number(quantity || 1);
    const txnIds = Array.isArray(originalTxnIds)
        ? originalTxnIds.map(id => Number(id))
        : (originalTxnId ? [Number(originalTxnId)] : []);
    try {
        const user = await prisma.user.findFirst({ where: { name: operatorName } }) || await prisma.user.findFirst();
        if (!user) throw new Error("ไม่พบข้อมูลผู้ดำเนินการในระบบ");
        const result = await prisma.$transaction(async (tx) => {
            const refTxnId = txnIds[0];
            const originalTxn = refTxnId ? await tx.transaction.findUnique({ where: { id: refTxnId }, include: { job: true } }) : null;
            const warehouseId = Number(req.body.warehouseId || originalTxn?.warehouse_id || 1);
            const item = await tx.masterItem.findUnique({ where: { id: Number(itemId) } });
            if (!item) throw new Error("ไม่พบข้อมูลพัสดุ");
            let targetItem = item;

            if (['quarantine_approve', 'repair_done', 'available'].includes(action)) {
                const conditionStr = String(item.condition || '').trim();
                
                if (conditionStr === 'สต๊อก') {
                    targetItem = item;
                } else {
                    const newCategory = item.category || "ETC";
                    const newBrand = item.brand || "-";
                    const newItemName = item.item_name || "-";
                    const newSize = item.size || "-";
                    const newDetails = item.details || "";

                    const found = await tx.masterItem.findFirst({
                        where: { category: newCategory, brand: newBrand, item_name: newItemName, size: newSize, details: newDetails, condition: 'สต๊อก' }
                    });
                    
                    if (found) { 
                        targetItem = found; 
                    } else {
                        targetItem = await tx.masterItem.create({
                            data: { category: newCategory, brand: newBrand, item_name: newItemName, size: newSize, condition: 'สต๊อก', details: newDetails, stock_qty: 0 }
                        });
                    }
                }
            }

            let repairChange = 0, stockChange = 0, scrapChange = 0, lostChange = 0, quarantineChange = 0;
            let statusLabel = '';
            if (action === 'repair_done') { repairChange = -qty; stockChange = qty; statusLabel = 'ซ่อมเสร็จ (พร้อมใช้งาน) (Checked)'; }
            else if (action === 'to_scrap') { repairChange = -qty; scrapChange = qty; statusLabel = 'จำหน่ายซาก (รอจำหน่าย) (Checked)'; }
            else if (action === 'scrap_sold') { scrapChange = -qty; statusLabel = 'อนุมัติจำหน่ายซากเรียบร้อย (out)'; }
            else if (action === 'confirm_loss') { lostChange = -qty; statusLabel = 'ยืนยันสูญหาย (out)'; }
            else if (action === 'quarantine_approve') { quarantineChange = -qty; stockChange = qty; statusLabel = 'ปกติ (พร้อมใช้งาน) (Checked)'; }
            else if (action === 'quarantine_to_repair') { quarantineChange = -qty; repairChange = qty; statusLabel = 'พบว่าเสีย (ส่งซ่อม) (Checked)'; }
            else if (action === 'quarantine_to_scrap') { quarantineChange = -qty; scrapChange = qty; statusLabel = 'พบว่าเป็นซาก (Checked)'; }
            else if (action === 'quarantine_to_lost') { quarantineChange = -qty; lostChange = qty; statusLabel = 'พบว่าสูญหาย (Checked)'; }

            const physicalCondition = (action === 'quarantine_approve' || action === 'repair_done') ? 'ปกติ' :
                (action === 'quarantine_to_repair') ? 'ส่งซ่อม' :
                    (action === 'quarantine_to_scrap' || action === 'to_scrap') ? 'ตีซาก' :
                        (action === 'quarantine_to_lost' || action === 'confirm_loss') ? 'สูญหาย' : 'ปกติ';

            if (stockChange > 0) {
                await tx.masterItem.update({ where: { id: targetItem.id }, data: { stock_qty: { increment: stockChange } } });
            }

            // Decrement source warehouse
            const sourceStock = await tx.warehouseStock.findUnique({ where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouseId } } });
            let sourceRepairDec = repairChange < 0 ? repairChange : 0;
            let sourceQuarantineDec = quarantineChange < 0 ? quarantineChange : 0;
            let sourceTransitDec = 0;
            const sourceScrapDec = (action === 'scrap_sold') ? -qty : 0;
            const sourceLostDec = (action === 'confirm_loss') ? -qty : 0;
            if (sourceQuarantineDec < 0 && Math.abs(sourceQuarantineDec) > (sourceStock?.quarantine_qty || 0)) {
                if ((sourceStock?.transit_qty || 0) >= Math.abs(sourceQuarantineDec)) {
                    sourceTransitDec = sourceQuarantineDec; sourceQuarantineDec = 0;
                } else {
                    throw new Error('รายการนี้ยังไม่มีจำนวนในคลังกักกัน/ระหว่างส่งเพียงพอสำหรับตรวจสภาพ กรุณาตรวจสอบการรับคืนก่อน');
                }
            }
            await tx.warehouseStock.upsert({
                where: { item_id_warehouse_id: { item_id: item.id, warehouse_id: warehouseId } },
                update: { repair_qty: { increment: sourceRepairDec }, quarantine_qty: { increment: sourceQuarantineDec }, transit_qty: { increment: sourceTransitDec }, scrap_qty: { increment: sourceScrapDec }, lost_qty: { increment: sourceLostDec } },
                create: { item_id: item.id, warehouse_id: warehouseId, stock_qty: 0, repair_qty: 0, quarantine_qty: 0, transit_qty: 0, scrap_qty: 0, lost_qty: 0 }
            });
            // Increment target warehouse
            await tx.warehouseStock.upsert({
                where: { item_id_warehouse_id: { item_id: targetItem.id, warehouse_id: warehouseId } },
                update: {
                    stock_qty: { increment: stockChange > 0 ? stockChange : 0 },
                    repair_qty: { increment: repairChange > 0 ? repairChange : 0 },
                    scrap_qty: { increment: (action === 'quarantine_to_scrap' || action === 'to_scrap') ? qty : 0 },
                    lost_qty: { increment: (action === 'quarantine_to_lost') ? qty : 0 }
                },
                create: {
                    item_id: targetItem.id, warehouse_id: warehouseId,
                    stock_qty: stockChange > 0 ? stockChange : 0, repair_qty: repairChange > 0 ? repairChange : 0,
                    scrap_qty: (action === 'quarantine_to_scrap' || action === 'to_scrap') ? qty : 0,
                    lost_qty: (action === 'quarantine_to_lost') ? qty : 0, quarantine_qty: 0
                }
            });
            // Update existing transactions IN-PLACE
            if (txnIds.length > 0) {
                await tx.transaction.updateMany({
                    where: { id: { in: txnIds } },
                    data: { action_type: `ตรวจสอบแล้ว: ${statusLabel}`, cabinet_status: physicalCondition, item_id: targetItem.id, note: `[Admin Check: ${note || statusLabel}] by ${operatorName}` }
                });
            }
            // Reconcile original job status
            if (originalTxn?.job_id) {
                const allJobTxns = await tx.transaction.findMany({ where: { job_id: originalTxn.job_id } });
                const hasUninspected = allJobTxns.some(t => t.action_type === 'รอรับคืน' || t.action_type.includes('รอตรวจ') || t.action_type.includes('คลังกักกัน'));
                await tx.job.update({
                    where: { job_id: originalTxn.job_id },
                    data: { status: hasUninspected ? 'ดำเนินการ (อยู่ระหว่างตรวจสอบ)' : 'เสร็จสิ้น (ตรวจสอบแล้ว)' }
                });
            }
            return { targetJobId: originalTxn?.job_id || 'REVIEW' };
        });
        return res.json({ status: 'success', message: 'ดำเนินการสำเร็จ', jobId: result.targetJobId });
    } catch (err: any) {
        console.error("Confirm Repair Error:", err);
        return res.json({ status: 'error', message: err.message });
    }
});

// 🧹 Wipe all logistics queues
router.post('/wipe-queues', async (_req, res) => {
    try {
        await prisma.$transaction([
            prisma.warehouseStock.updateMany({ data: { quarantine_qty: 0, repair_qty: 0, scrap_qty: 0, lost_qty: 0, transit_qty: 0 } }),
            prisma.transaction.updateMany({
                where: {
                    OR: [
                        { action_type: { contains: 'รอตรวจ' } }, { action_type: { contains: 'รับคืน' } },
                        { action_type: { contains: 'ซ่อม' } }, { action_type: { contains: 'ซาก' } },
                        { action_type: { contains: 'หาย' } }
                    ],
                    NOT: { action_type: { contains: '(out)' } }
                },
                data: { action_type: { set: 'ยกเลิกรายการ (ล้างกระดาน) (out)' } }
            })
        ]);
        return res.json({ status: 'success', message: 'ล้างคิวงานทั้งหมดเรียบร้อยแล้ว' });
    } catch (err: any) {
        console.error(err);
        return res.json({ status: 'error', message: err.message });
    }
});

export default router;
