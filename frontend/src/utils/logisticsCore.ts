export interface TransactionResult {
   id?: string;
   item_id?: string | null;
   rowIndex?: number | string | null;
   action_type?: string;
   action?: string;
   quantity?: number;
   จำนวน?: number;
   item?: any; // the actual item detail
   serialNumber?: string;
   serial_number?: string;
   returnReason?: string;
   return_reason?: string;
   cabinetCondition?: string;
   cabinet_status?: string;
   [key: string]: any;
}

export interface JobState {
   pendingItems: { plan: TransactionResult; remainingQty: number; category: 'SEND' | 'RETURN' }[];
   completedItems: { result: TransactionResult; matchedPlan: TransactionResult | null; category: 'SEND' | 'RETURN'; matchedId: string }[];
   allAggregated: {
      it: TransactionResult;
      totalQty: number;
      category: 'SEND' | 'RETURN';
      action_type: string;
      plan: number;
      action: number;
      detailsList: TransactionResult[];
      isReconciled: boolean;
   }[];
   totalPlanQty: number;
   totalFulfilledQty: number;
   progressPercent: number;
   isAllFulfilled: boolean;
}

export function reconcileTransactions(transactions: TransactionResult[]): JobState {
   if (!transactions || !Array.isArray(transactions)) {
      return { pendingItems: [], completedItems: [], allAggregated: [], totalPlanQty: 0, totalFulfilledQty: 0, progressPercent: 0, isAllFulfilled: true };
   }

   const isPlanType = (action: string) => ['แจ้งส่ง', 'แจ้งคืน', 'ISSUE_REQUEST', 'RETURN_REQUEST'].includes(String(action).toUpperCase());

   const getCategory = (action: string) => {
      const act = String(action).toUpperCase();
      if (act.includes('คืน') || ['RETURN', 'RECEIVE', 'รอตรวจ', 'ชำรุด', 'สูญหาย', 'ซาก'].some(k => act.includes(k))) {
         return 'RETURN';
      }
      return 'SEND';
   };

   const getIdentifier = (t: TransactionResult) => {
      if (t.serial_number || t.serialNumber) return `SN_${String(t.serial_number || t.serialNumber)}`;
      if (t.rowIndex) return `ROW_${String(t.rowIndex)}`;
      if (t.id) return `TX_${String(t.id)}`;

      // Stable random fallback per-instance if everything else fails
      if (!t._internalId) {
         t._internalId = `TEMP_${Math.random().toString(36).substr(2, 9)}`;
      }
      return t._internalId;
   };

   const ignoredTransitActions = ['รับงาน', 'ACCEPTED', 'TRANSIT', 'กำลังเดินทาง', 'กำลังไปส่ง', 'ถึงหน้าร้าน', 'ARRIVED'];

   // Admin review follow-up records should NOT be counted as separate items
   const isAdminReviewRecord = (act: string) => {
      const upper = act.toUpperCase();
      return upper.includes('CHECKED') || upper.includes('ตรวจสอบแล้ว') || upper.includes('อนุมัติ') ||
         upper.includes('ซ่อมเสร็จ') || upper.includes('(OUT)');
   };

   const plans = transactions.filter(t => isPlanType(t.action_type || t.action || ''));
   const rawResults = transactions.filter(t => {
      const act = String(t.action_type || t.action || '').toUpperCase();
      return !isPlanType(act) &&
         !['ยกเลิก', 'VOID'].includes(act) &&
         !ignoredTransitActions.some(ignored => act.includes(ignored)) &&
         !isAdminReviewRecord(act);
   });

   const pendingItems: JobState['pendingItems'] = [];
   const completedItemsMap = new Map<string, JobState['completedItems'][0]>();

   const planRemaining = new Map<string, number>();
   const originalPlanConfig = new Map<string, TransactionResult>();
   const planInitialSum = new Map<string, number>();

   plans.forEach(p => {
      const id = getIdentifier(p);
      p._internalId = id;
      const qty = Number(p.quantity || p.จำนวน || 1);
      planRemaining.set(id, (planRemaining.get(id) || 0) + qty);
      planInitialSum.set(id, (planInitialSum.get(id) || 0) + qty);
      if (!originalPlanConfig.has(id)) originalPlanConfig.set(id, p);
   });

   let totalPlanQty = 0;
   let totalFulfilledQty = 0;

   rawResults.forEach(res => {
      const qty = Number(res.quantity || res.จำนวน || 1);
      const resId = getIdentifier(res);
      const matchedPlan = plans.find(p => p._internalId === resId);

      if (matchedPlan) {
         const remain = planRemaining.get(resId) || 0;
         const used = Math.min(remain, qty);
         planRemaining.set(resId, remain - used);
      }

      const cat = getCategory(res.action_type || res.action || (matchedPlan ? (matchedPlan.action_type || '') : ''));

      const existingCompleted = completedItemsMap.get(resId);
      if (existingCompleted) {
         existingCompleted.result.quantity = (Number(existingCompleted.result.quantity) || 0) + qty;
         existingCompleted.result.จำนวน = existingCompleted.result.quantity;
         existingCompleted.result.action_type = res.action_type || existingCompleted.result.action_type;
      } else {
         completedItemsMap.set(resId, {
            result: { ...res, quantity: qty, จำนวน: qty },
            matchedPlan: matchedPlan || null,
            category: cat,
            matchedId: resId
         });
      }
      totalFulfilledQty += qty;
   });

   plans.forEach(p => {
      const remain = planRemaining.get(p._internalId) || 0;
      const cat = getCategory(p.action_type || p.action || '');
      const planQty = Number(p.quantity || p.จำนวน || 1);
      totalPlanQty += planQty;

      if (remain > 0) {
         const existingPending = pendingItems.find(pi => pi.plan._internalId === p._internalId);
         if (!existingPending) {
            pendingItems.push({ plan: p, remainingQty: remain, category: cat });
         }
      }
   });

   const completedItems = Array.from(completedItemsMap.values());
   const progressPercent = totalPlanQty === 0 ? (totalFulfilledQty > 0 ? 100 : 0) : Math.min(100, Math.round((totalFulfilledQty / totalPlanQty) * 100));
   const isAllFulfilled = totalPlanQty > 0 && Array.from(planRemaining.values()).every(v => v <= 0);

   // 🧬 Create Legacy Compatible allAggregated Array
   const allAggregated: JobState['allAggregated'] = [];

   // Group by ID to unify Plan and Result into one line
   const allIds = new Set([...originalPlanConfig.keys(), ...completedItemsMap.keys()]);

   allIds.forEach(id => {
      const planObj = originalPlanConfig.get(id);
      const resultObj = completedItemsMap.get(id);

      const it = resultObj ? resultObj.result : planObj!;
      const category = resultObj ? resultObj.category : (planObj ? getCategory(planObj.action_type || '') : 'SEND');
      const planQty = planObj ? (planInitialSum.get(id) || 0) : 0;
      const actionQty = resultObj ? Number(resultObj.result.quantity || resultObj.result.จำนวน || 0) : 0;

      allAggregated.push({
         it,
         category,
         action_type: resultObj ? (resultObj.result.action_type || resultObj.result.action || '') : (planObj ? (planObj.action_type || planObj.action || '') : ''),
         totalQty: Math.max(planQty, actionQty),
         plan: planQty,
         action: actionQty,
         detailsList: resultObj ? [resultObj.result] : (planObj ? [planObj] : []),
         isReconciled: !!resultObj && !!planObj
      });
   });

   return {
      pendingItems,
      completedItems,
      allAggregated,
      totalPlanQty,
      totalFulfilledQty,
      progressPercent,
      isAllFulfilled
   };
}
