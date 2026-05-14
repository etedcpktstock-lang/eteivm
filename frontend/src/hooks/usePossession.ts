import { useMemo } from 'react';
import { TRANSACTION_STATUSES, POSSESSION_ACTIONS } from '../constants/logisticsConstants';
import { classifyLogisticsItem, aggregateJobItems, formatItemName, calculateCustomerInventory } from '../utils/logisticsUtils';
import type { Transaction } from '../types';

/**
 * 📦 usePossession Hook
 * Calculates the current stock in a customer's possession.
 * Priority: Uses preCalculatedInventory if provided, otherwise falls back to dynamic calculation.
 */
export function usePossession(
   transactions: Transaction[], 
   customerCv: string | undefined, 
   logisticsJobs: any[] = [],
   masterItems: any[] = [],
   preCalculatedInventory?: any[]
) {
   const possessionList = useMemo(() => {
      let rawGrouped = preCalculatedInventory || calculateCustomerInventory(transactions, customerCv, logisticsJobs, masterItems);
      const grouped = (rawGrouped || []).filter((it: any) => (it.qty || it.quantity || 0) > 0);
      const result: any[] = [];

      grouped.forEach(item => {
         const nameLower = String(item.name || '').toLowerCase();
         const typeLower = String(item.type || '').toLowerCase();
         
         const isFreezer = (
            nameLower.includes('ตู้แช่') || 
            nameLower.includes('liebherr') || 
            nameLower.includes('sanyo') ||
            nameLower.includes('the cool') ||
            nameLower.includes('sands') ||
            typeLower.includes('ตู้แช่')
         ) && (
            !nameLower.includes('กุญแจ') && 
            !nameLower.includes('สติกเกอร์') && 
            !nameLower.includes('สติ๊กเกอร์') && 
            !nameLower.includes('ตะกร้า') && 
            !nameLower.includes('อุปกรณ์')
         );
         
         if (isFreezer) {
            for (let i = 0; i < item.qty; i++) {
               result.push({ ...item, qty: 1 });
            }
         } else {
            result.push(item);
         }
      });

      return result;
   }, [transactions, customerCv, logisticsJobs, masterItems]);

   return possessionList;
}
