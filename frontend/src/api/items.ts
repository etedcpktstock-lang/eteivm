/**
 * Items API — Master item CRUD
 */
import type { MaterialItem } from '../types';
import { API_URL, safeFetch, normalizeApiErrorMessage, getCurrentUser, initialDataCache } from './client';

export const getItems = async (forceRefetch = false): Promise<MaterialItem[]> => {
  if (!API_URL) return [];
  if (!forceRefetch && initialDataCache?.items) return initialDataCache.items;
  const res = await safeFetch(`${API_URL}/items?t=${Date.now()}`);
  if (!res.ok) throw new Error("Failed to fetch items");
  const data = await res.json();
  if (initialDataCache) initialDataCache.items = data;
  return data;
};

export const getMaterials = getItems;

export const saveMasterItem = async (item: MaterialItem): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const currentUser = getCurrentUser();
  const itemWithOperator = { ...item, operator: currentUser?.name || 'Unknown' };
  const res = await safeFetch(`${API_URL}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item: itemWithOperator }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache && initialDataCache.items) {
    const idx = initialDataCache.items.findIndex((it: any) => it.rowIndex === item.rowIndex);
    if (idx !== -1) initialDataCache.items[idx] = item;
    else initialDataCache.items.push(item);
  }
  return data;
};

export const saveMasterItems = async (items: MaterialItem[]): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const currentUser = getCurrentUser();
  const operator = currentUser?.name || 'Unknown';
  const itemsWithOperator = items.map(it => ({ ...it, operator }));
  const res = await safeFetch(`${API_URL}/items/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: itemsWithOperator }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache) initialDataCache.items = items;
  return data;
};

export const deleteMasterItem = async (rowIndex: number): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/items/${rowIndex}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};
