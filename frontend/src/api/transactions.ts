/**
 * Transactions API — Transaction operations, batch processing, asset units
 */
import type { MaterialItem, Transaction } from '../types';
import { API_URL, safeFetch, normalizeApiErrorMessage, invalidateCache, initialDataCache, normalizeTransactionLines } from './client';

export const getTransactions = async (forceRefetch = false): Promise<Transaction[]> => {
  if (!API_URL) return [];
  if (!forceRefetch && initialDataCache?.transactions) return initialDataCache.transactions;
  const res = await safeFetch(`${API_URL}/transactions?t=${Date.now()}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  const data = await res.json();
  if (initialDataCache) initialDataCache.transactions = data;
  return data;
};

export const getNextTxnNo = async (): Promise<string> => {
  if (!API_URL) return '000000';
  const res = await safeFetch(`${API_URL}/transactions/next-txn-no`);
  if (!res.ok) return '000000';
  const data = await res.json();
  return data.txnNo || '000000';
};

export const processTransaction = async (
  action: 'receive' | 'issue', item: MaterialItem, quantity: number, cv: string,
  deliveryBy: string, deliveryDate: string, txnNo: string, operator: string,
  note?: string, workZone?: string, notifier?: string, notificationDate?: string,
  returnReason?: string, cabinetCondition?: string, photos?: string[]
): Promise<any> => {
  if (!API_URL) throw new Error("API URL is not configured.");
  const payload = { action, item, quantity, cv, deliveryBy, deliveryDate, txnNo, operator, note, workZone, notifier, notificationDate, returnReason, cabinetCondition, photos };
  const res = await safeFetch(`${API_URL}/transactions/single`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Transaction failed");
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  invalidateCache(); return data;
};

export interface BatchTransactionParams {
  action: 'receive' | 'issue' | 'return' | 'survey' | 'transfer' | 'fulfill';
  items: { item?: MaterialItem; quantity: number; [key: string]: any }[];
  cv?: string; deliveryBy?: string; deliveryDate?: string; txnNo?: string; operator: string;
  note?: string; workZone?: string; notifier?: string; notificationDate?: string;
  returnReason?: string; cabinetCondition?: string; photos?: string[];
  jobId?: string; status?: string; lat?: string; lng?: string;
  warehouseId?: number; toWarehouseId?: number;
}

export const processBatchTransaction = async (params: BatchTransactionParams): Promise<any> => {
  if (!API_URL) return { status: 'error', message: 'API URL not configured' };
  const { action, items, cv, deliveryBy, deliveryDate, txnNo, operator, note, workZone, notifier, notificationDate, returnReason, cabinetCondition, photos, jobId, status, lat, lng, warehouseId, toWarehouseId } = params;
  const finalStatus = status || (action === 'return' ? 'รับคืนแล้ว' : (action === 'receive' ? 'รับเข้า' : 'เบิกออก'));
  const normalizedItems = normalizeTransactionLines(items || []);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  try {
    const payload = { action: 'processBatch', subAction: action, status: finalStatus, items: normalizedItems, cv, deliveryBy, deliveryDate, txnNo, operator, note, workZone, notifier, notificationDate, returnReason, cabinetCondition, photos, jobId, lat, lng, warehouseId, toWarehouseId };
    const res = await safeFetch(`${API_URL}/transactions/processBatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Batch transaction failed");
    const data = await res.json();
    if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
    invalidateCache(); return data;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error("ส่งข้อมูลล่าช้าเกิน 45 วินาที (Timeout)");
    throw err;
  }
};

export const searchAssetUnits = async (params?: { q?: string; status?: string; warehouseId?: number; customerCv?: string; limit?: number }): Promise<any[]> => {
  if (!API_URL) return [];
  const query = new URLSearchParams();
  if (params?.q) query.set('q', String(params.q));
  if (params?.status) query.set('status', String(params.status));
  if (params?.warehouseId) query.set('warehouseId', String(params.warehouseId));
  if (params?.customerCv) query.set('customerCv', String(params.customerCv));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  const res = await safeFetch(`${API_URL}/transactions/asset-units${qs ? `?${qs}` : ''}`);
  const data = await res.json();
  if (data?.status === 'error') throw new Error(data.message || 'ค้นหา Asset Unit ไม่สำเร็จ');
  return data.items || [];
};

export const getAssetUnitByTag = async (assetTag: string): Promise<any | null> => {
  if (!API_URL || !assetTag?.trim()) return null;
  const res = await safeFetch(`${API_URL}/transactions/asset-units/${encodeURIComponent(assetTag.trim())}`);
  const data = await res.json();
  if (data?.status === 'error') throw new Error(data.message || 'ค้นหา Asset Tag ไม่สำเร็จ');
  return data.item || null;
};

export const cancelTransaction = async (txnNo: string, operator: string, reason?: string): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/transactions/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txnNo, operator, reason }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

export const clearTransactions = async (): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/transactions/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

export const saveJobRequest = async (payload: { cv: string; deliveryItems: any[]; returnItems: any[]; operator: string; note: string; returnReason?: string; appointmentDate?: string; warehouseId?: number; photos?: string[] }): Promise<any> => {
  if (!API_URL) throw new Error("API URL is not configured.");
  const normalizedPayload = { ...payload, deliveryItems: normalizeTransactionLines(payload.deliveryItems || []), returnItems: normalizeTransactionLines(payload.returnItems || []) };
  const res = await safeFetch(`${API_URL}/transactions/jobRequest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalizedPayload) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

export const getJobRequests = async (cv?: string): Promise<any[]> => {
  if (!API_URL) return [];
  const res = await safeFetch(`${API_URL}/transactions/jobRequests${cv ? `?cv=${cv}` : ''}`);
  return res.json();
};

export const getLogisticsJobs = async (): Promise<any[]> => {
  if (!API_URL) return [];
  const res = await safeFetch(`${API_URL}/transactions/logistics/jobs`);
  if (!res.ok) throw new Error("Failed to fetch logistics jobs");
  const data = await res.json();
  if (data?.status === 'error') throw new Error(normalizeApiErrorMessage(data.message || 'ไม่สามารถโหลดงานโลจิสติกส์ได้'));
  return data;
};
