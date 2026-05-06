
/**
 * 🎯 Logistics Utility Functions
 * Centralized logic for classification, naming, and aggregation.
 */

export const SEND_KEYWORDS = ['ISSUE', 'DELIVERY', 'BORROW', 'TRANSFER_OUT', 'แจ้งส่ง', 'ส่ง', 'สำเร็จ', 'เรียบร้อย', 'ส่งแล้ว', 'เบิกออก', 'ดำเนิน', 'ดำเนินการ'];
export const RETURN_KEYWORDS = ['RETURN', 'RECEIVE', 'แจ้งคืน', 'รับคืน', 'คืน', 'รอตรวจ', 'ชำรุด', 'สูญหาย', 'รอซ่อม', 'ซาก', 'พบว่าเสีย', 'ส่งซ่อม', 'CHECKED', 'รับคืนจากร้าน'];
export const SKIP_KEYWORDS = ['ยกเลิก', 'กำลังเดินทาง', 'เดินทาง', 'รับงาน', 'ACCEPTED', 'TRANSIT', 'กำลังไปส่ง', 'รอดำเนินการ'];

export type ItemCategory = 'SEND' | 'RETURN' | 'OTHER';

/**
 * 🚩 Status Groups for Job Classification
 */
export const WAITING_STATUSES = ['PENDING', 'รอรับงาน', 'รอส่ง', 'รอเครื่อง', 'รอรับคืน'];
export const HISTORY_STATUSES = ['เสร็จสิ้น', 'ตรวจสอบแล้ว', 'ปิดงาน', 'คืนของแล้ว', 'คืนแล้ว', 'สำเร็จ', 'SUCCESS', 'CLOSED'];
export const TRANSIT_KEYWORDS = ['กำลังเดินทาง', 'เดินทาง', 'รับงาน', 'ACCEPTED', 'TRANSIT', 'กำลังไปส่ง', 'รอดำเนินการ'];

/**
 * Classifies a transaction item into SEND or RETURN category.
 */
export const classifyLogisticsItem = (actionType: string, jobStatus?: string): ItemCategory => {
  const at = String(actionType || '').toUpperCase();
  const js = String(jobStatus || '').toUpperCase();
  const isInspected = at.includes('ตรวจสอบแล้ว') || at.includes('อนุมัติ') || at.includes('CHECKED');
  
  // Return checked/done always RETURN
  if (isInspected) return 'RETURN';

  // 🚩 Strict Intent Check (Keywords in Action Type)
  if (at.includes('แจ้งส่ง') || at.includes('ISSUE') || at.includes('DELIVERY') || at.includes('ส่งแล้ว')) return 'SEND';
  if (at.includes('แจ้งคืน') || at.includes('RETURN') || at.includes('RECEIVE') || at.includes('รอตรวจ')) return 'RETURN';

  // Specific Keyword Group Check
  if (RETURN_KEYWORDS.some(k => at.includes(k.toUpperCase()))) return 'RETURN';
  if (SEND_KEYWORDS.some(k => at.includes(k.toUpperCase()))) return 'SEND';
  
  // Contextual fallback ONLY if totally ambiguous (e.g. just "กำลังดำเนินการ")
  if (at.includes('ดำเนิน') && (js.includes('เสร็จ') || js.includes('สำเร็จ'))) {
     return 'SEND'; // General assumption for finished jobs
  }

  return 'OTHER';
};

/**
 * Promotes status labels based on the current job stage.
 * If the job is in the return leg or finished, items should show finalized statuses.
 */
export const promoteItemStatus = (category: ItemCategory, originalStatus: string, jobStatus?: string) => {
   const js = String(jobStatus || '').toUpperCase();
   const isFinalLeg = (
      js.includes('คืน') || 
      js.includes('กลับ') || 
      js.includes('เสร็จ') || 
      js.includes('สำเร็จ') || 
      js.includes('ออฟฟิศ') || 
      js.includes('ตรวจสอบ') ||
      js.includes('CHECK')
   );
   
   if (!isFinalLeg) return originalStatus;
   
   if (category === 'SEND') return 'ส่งเสร็จแล้ว';
   
   if (category === 'RETURN') {
      // If job has been verified/inspected → items are verified too
      const isVerified = js.includes('ตรวจสอบแล้ว') || js.includes('VERIFIED') || js.includes('CHECKED');
      return isVerified ? 'ตรวจสอบแล้ว' : 'รอตรวจสอบ';
   }
   
   return originalStatus;
};

/**
 * Formats the item name following the premium specification.
 * Format: [ประเภท] [ยี่ห้อ] [รายการ] [รายละเอียด] ขนาด [ขนาด] สภาพ [สภาพ]
 */
export const formatItemName = (it: any, options?: { hideCondition?: boolean }) => {
  const mainPart = `${it.ประเภท || ''} ${it.ยี่ห้อหรือรูปแบบ || it.brand || ''} ${it.รายการ || it.item_name || ''} ${it.รายละเอียด || it.details || ''}`.replace(/\s+/g, ' ').trim();
  const metaPart = `${it.ขนาด ? `ขนาด ${it.ขนาด}` : ''} ${!options?.hideCondition && it.สภาพ ? `สภาพ ${it.สภาพ}` : ''}`.replace(/\s+/g, ' ').trim();
  
  return { 
    main: mainPart || it.รายการ || 'พัสดุอุปกรณ์', 
    meta: metaPart || '-' 
  };
};

/**
 * 📦 Calculate Customer Inventory (Unified Logic)
 * Shared between usePossession (Dashboard) and FulfillmentForm (Driver App)
 */
export const calculateCustomerInventory = (
  transactions: any[], 
  customerCv: string | undefined, 
  logisticsJobs: any[] = [],
  masterItems: any[] = []
): any[] => {
  const targetCv = String(customerCv || '').trim();
  if (!targetCv) return [];

  const map: Record<string, any> = {};
  const processedJobIds = new Set<string>();

  const normalizeCv = (val: any) => String(val || '').trim().toUpperCase();
  const normalizedTargetCv = normalizeCv(targetCv);
  const normalizedTargetCvNoA = normalizedTargetCv.replace(/^A/, '');

  const checkCvMatch = (raw: any) => {
    const n = normalizeCv(raw);
    return n === normalizedTargetCv || n === normalizedTargetCvNoA || n.replace(/^A/, '') === normalizedTargetCvNoA;
  };

  const getJobId = (it: any) => {
    const id = it.jobId || it.job_id || it.JobID || it.txnNo || it.txn_no || it.TxnNo || it.ref || it.id || '';
    return String(id).trim();
  };

  const enrichItem = (it: any) => {
    const itemId = it.item_id || it.rowIndex || it.rowIndexMaster || null;
    if (!itemId) return it;

    const master = masterItems.find(m => 
      String(m.id) === String(itemId) || 
      String(m.rowIndex) === String(itemId) || 
      String(m.item_id) === String(itemId)
    );

    if (master) {
      return {
        ...it,
        ประเภท: it.ประเภท || master.ประเภท || master.category || '',
        ยี่ห้อหรือรูปแบบ: it.ยี่ห้อหรือรูปแบบ || it.brand || master.ยี่ห้อหรือรูปแบบ || master.brand || '',
        รายการ: it.รายการ || it.item_name || master.รายการ || master.item_name || '',
        ขนาด: it.ขนาด || it.size || master.ขนาด || master.size || '',
        สภาพ: it.สภาพ || it.condition || it.Condition || master.สภาพ || master.condition || 'ปกติ'
      };
    }
    return it;
  };

  const generateKey = (it: any) => {
    const { main, meta } = formatItemName(it);
    const cond = String(it.สภาพ || it.condition || 'ปกติ').trim();
    return `${main}|${meta}|${cond}`;
  };

  const addToMap = (enriched: any, qty: number, status?: string, date?: string) => {
    const itemKey = generateKey(enriched);
    if (!map[itemKey]) {
      const { main, meta } = formatItemName(enriched);
      map[itemKey] = { 
        name: main,
        meta: meta,
        type: enriched.ประเภท || '',
        detail: enriched.รายละเอียด || enriched.details || '',
        size: enriched.ขนาด || '',
        condition: enriched.สภาพ || 'ปกติ',
        qty: 0 
      };
    }
    map[itemKey].qty += qty;
    if (status) map[itemKey].lastStatus = status;
    if (date) map[itemKey].lastDate = date;
  };

  const subtractFromMap = (enriched: any, qty: number) => {
    const itemKey = generateKey(enriched);
    if (map[itemKey]) {
      map[itemKey].qty -= qty;
    } else {
      const { main } = formatItemName(enriched);
      const match = Object.values(map).find((v: any) => v.name === main && v.size === enriched.ขนาด);
      if (match) (match as any).qty -= qty;
    }
  };

  // 1️⃣ Historical Transactions
  const sortedTransactions = [...(transactions || [])].sort((a, b) => {
    const da = new Date(a["วัน-เวลา"] || a.Date || 0).getTime();
    const db = new Date(b["วัน-เวลา"] || b.Date || 0).getTime();
    return da - db;
  });

  sortedTransactions.forEach(t => {
    if (!checkCvMatch(t.CV || t.cv || t.CustomerID)) return;
    const tId = getJobId(t);
    if (tId && processedJobIds.has(tId)) return;
    if (tId) processedJobIds.add(tId);

    const status = String(t.สถานะ || t.Status || '').toUpperCase();
    if (status.includes('ยกเลิก')) return;

    const enriched = enrichItem(t);
    const category = classifyLogisticsItem(status);
    const qty = Number(t.จำนวน || t.qty || t.Quantity || 0);

    if (status.includes('ส่ง') || category === 'SEND') {
      addToMap(enriched, qty, t.สถานะ, t["วัน-เวลา"]);
    } else if (status.includes('คืน') || category === 'RETURN') {
      subtractFromMap(enriched, qty);
    }
  });

  // 2️⃣ Logistics Jobs
  const sortedJobs = [...(logisticsJobs || [])].sort((a, b) => {
    const da = new Date(a.completion_date || a.deliveryDate || a.updated_at || 0).getTime();
    const db = new Date(b.completion_date || b.deliveryDate || b.updated_at || 0).getTime();
    return da - db;
  });

  sortedJobs.forEach(job => {
    if (!checkCvMatch(job.cv || job.CV || job.CustomerID)) return;
    const jId = getJobId(job);
    if (jId && processedJobIds.has(jId)) return;
    if (jId) processedJobIds.add(jId);

    const js = String(job.status || '').toUpperCase();
    const isConfirmed = [
      'เสร็จ', 'สำเร็จ', 'SUCCESS', 'CLOSED', 'ตรวจสอบแล้ว',
      'คืน', 'กลับ', 'RETURN', 'TRANSIT_BACK', 'ARRIVED_OFFICE',
      'ARRIVED', 'DELIVERED', 'ส่งมอบ', 'เรียบร้อย'
    ].some(k => js.includes(k.toUpperCase()));

    if (!isConfirmed) return;

    const { allAggregated } = aggregateJobItems(job.items || [], job.status);
    allAggregated.forEach(agg => {
      const enriched = enrichItem(agg.it);
      if (agg.category === 'SEND') {
        addToMap(enriched, agg.totalQty, job.status, job.completion_date || job.deliveryDate);
      } else if (agg.category === 'RETURN') {
        subtractFromMap(enriched, agg.totalQty);
      }
    });
  });

  return Object.values(map).filter(it => it.qty !== 0);
};

/**
 * Aggregates job items into logical unique entities with correct quantities.
 * Handles the Plan -> Action -> Result deduplication.
 */
export const aggregateJobItems = (rawItems: any[] = [], jobStatus?: string) => {
  // 📍 1. Define Intents (Plans) and Results (Actions)
  const plans = rawItems.filter(it => String(it.action_type || it.action || '').toUpperCase().includes('แจ้ง'));
  const rawResults = rawItems.filter(it => !String(it.action_type || it.action || '').toUpperCase().includes('แจ้ง') && !SKIP_KEYWORDS.some(k => String(it.action_type || it.action || '').toUpperCase().includes(k.toUpperCase())));

  // 📍 2. Deduplicate Results: The Ultimate Physical Snapshot
  const uniqueResultsMap: Record<string, any> = {};
  const sortedRawResults = [...rawResults].sort((a, b) => (a.id || 0) - (b.id || 0));

  sortedRawResults.forEach(res => {
    const identity = (res.serial_number && String(res.serial_number).trim() !== '') 
      ? `SN_${res.serial_number}` 
      : (res.rowIndex ? `ROW_${res.rowIndex}` : `TX_${res.id}`);
    uniqueResultsMap[identity] = res;
  });
  const results = Object.values(uniqueResultsMap);

  // 📍 3. Reconcile: Spread Results over Plans (Quantity Allocation)
  const resolvedSlots: any[] = [];
  const consumedPlans = new Set<string>();
  
  const planRemainingQty: Record<string, number> = {};
  plans.forEach(p => {
    planRemainingQty[p.id] = Number(p.จำนวน || p.quantity || p.qty || 1);
  });

  const sortedResults = [...results].sort((a, b) => (b.id || 0) - (a.id || 0));

  sortedResults.forEach(res => {
    let unallocatedResQty = Number(res.จำนวน || res.quantity || res.qty || 1);

    while (unallocatedResQty > 0) {
      const availablePlans = plans.filter(p => !consumedPlans.has(String(p.id)) && planRemainingQty[p.id] > 0);
      let match: any = null;

      // Rule A: Strict Row Index
      if (res.rowIndex && !match) {
        match = availablePlans.find(p => String(p.rowIndex) === String(res.rowIndex));
      }
      
      // Rule B: Exact Master Item ID
      if (res.item_id && !match) {
        match = availablePlans.find(p => String(p.item_id) === String(res.item_id));
      }

      // Rule C: Category + "ตู้" Keyword
      if (!match) {
         const resCat = classifyLogisticsItem(res.action_type || res.action, jobStatus);
         match = availablePlans.find(p => {
            const pCat = classifyLogisticsItem(p.action_type || p.action, jobStatus);
            if (resCat !== pCat) return false;
            // Freezers without SN can be substituted for any freezer plan of the same category
            if (String(res.รายการ || '').includes('ตู้') && String(p.รายการ || '').includes('ตู้')) return true;
            return res.รายการ === p.รายการ;
         });
      }

      if (!match) {
        break; // No more plans to fulfill for this result
      }

      const planAvailable = planRemainingQty[match.id];
      const quantityToConsume = Math.min(planAvailable, unallocatedResQty);
      
      unallocatedResQty -= quantityToConsume;
      planRemainingQty[match.id] -= quantityToConsume;

      if (planRemainingQty[match.id] <= 0) {
        consumedPlans.add(String(match.id));
      }

      const resCat = classifyLogisticsItem(res.action_type || res.action, jobStatus);
      resolvedSlots.push({
        ...match,
        ...res,
        action_type: promoteItemStatus(resCat, res.action_type || res.action, jobStatus),
        จำนวน: quantityToConsume, 
        originalPlan: match,
        isReconciled: true
      });
    }

    // Any overflow result quantity becomes an orphan item line
    if (unallocatedResQty > 0) {
      const resCat = classifyLogisticsItem(res.action_type || res.action, jobStatus);
      resolvedSlots.push({ 
        ...res, 
        action_type: promoteItemStatus(resCat, res.action_type || res.action, jobStatus),
        จำนวน: unallocatedResQty,
        isReconciled: false 
      });
    }
  });

  // 📍 4. Add remaining partial/unfulfilled plans
  plans.forEach(p => {
    const remain = planRemainingQty[p.id];
    if (remain > 0) {
      const pCat = classifyLogisticsItem(p.action_type || p.action, jobStatus);
      resolvedSlots.push({ 
        ...p, 
        action_type: promoteItemStatus(pCat, p.action_type || p.action, jobStatus),
        จำนวน: remain, 
        isReconciled: false 
      });
    }
  });

  // 📍 5. Calculate Totals
  let totalSend = 0;
  let totalReturn = 0;

  const allAggregated = resolvedSlots.map(slot => {
    const category = classifyLogisticsItem(slot.action_type || slot.action, jobStatus);
    const qtyCount = Number(slot.จำนวน || slot.quantity || slot.qty || 1);
    
    if (category === 'SEND') totalSend += qtyCount;
    if (category === 'RETURN') totalReturn += qtyCount;

    return {
      it: slot,
      action_type: slot.action_type || slot.action,
      category,
      totalQty: qtyCount,
      // Pass these for legacy UI compatibility
      plan: slot.isReconciled ? qtyCount : (slot.originalPlan ? qtyCount : 0),
      action: slot.isReconciled ? qtyCount : (slot.originalPlan ? 0 : qtyCount),
      detailsList: [slot]
    };
  });

  return {
    totalSend,
    totalReturn,
    sendItems: allAggregated.filter(v => v.category === 'SEND'),
    returnItems: allAggregated.filter(v => v.category === 'RETURN'),
    allAggregated
  };
};

/**
 * Checks if a job is in the 'Waiting' tab.
 */
export const checkIsWaitingJob = (job: any) => {
  const jId = String(job.jobId || job.job_id || job.txnNo || job.txn_no || '').toUpperCase();
  if (jId.startsWith('TXN-')) return false;

  const s = String(job.status || '').toUpperCase();
  const hasHandedOverItems = job.items?.some((it: any) =>
    String(it.action_type || '').includes('รอตรวจ') ||
    String(it.action_type || '').includes('ตรวจสอบ')
  );
  if (hasHandedOverItems) return false;

  return WAITING_STATUSES.some(k => s.includes(k.toUpperCase()));
};

/**
 * Checks if a job is in the 'Active' tab.
 */
export const checkIsActiveJob = (job: any) => {
  const jId = String(job.jobId || job.job_id || job.txnNo || job.txn_no || '').toUpperCase();
  if (jId.startsWith('TXN-')) return false;

  if (checkIsWaitingJob(job)) return false;

  const s = String(job.status || '').toUpperCase();
  const isDoneStatus = HISTORY_STATUSES.some(k => s.includes(k.toUpperCase())) || s.includes('กำลังเดินทางกลับ') || s.includes('รับคืนจากร้าน');

  const hasHandedOver = job.items?.some((it: any) =>
    String(it.action_type || it.status || "").toUpperCase().includes('รอตรวจ') ||
    String(it.action_type || it.status || "").toUpperCase().includes('ตรวจสอบ')
  );

  if (isDoneStatus || hasHandedOver) return false;

  const hasPendingActions = job.items?.some((it: any) => {
    const at = String(it.action_type || it.status || "").toUpperCase();
    return !['รอตรวจ', 'ตรวจสอบ', 'สำเร็จ', 'เรียบร้อย'].some(k => at.includes(k));
  });

  if (hasPendingActions) return true;

  return TRANSIT_KEYWORDS.some(k => s.includes(k.toUpperCase())) && !isDoneStatus && !hasHandedOver;
};

/**
 * Checks if a job is in the 'History' tab.
 */
export const checkIsHistoryJob = (job: any) => {
  const jId = String(job.jobId || job.job_id || job.txnNo || job.txn_no || '').toUpperCase();
  if (jId.startsWith('TXN-')) return false;

  const s = String(job.status || '').toUpperCase();
  const hasHandedOver = job.items?.some((it: any) =>
    String(it.action_type || it.status || "").toUpperCase().includes('รอตรวจ') ||
    String(it.action_type || it.status || "").toUpperCase().includes('ตรวจสอบ')
  );

  const isDone = HISTORY_STATUSES.some(k => s.includes(k.toUpperCase())) || s.includes('กำลังเดินทางกลับ') || s.includes('รับคืนจากร้าน');

  return isDone || hasHandedOver;
};
