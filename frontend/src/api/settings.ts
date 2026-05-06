/**
 * Settings API — Settings, zones, warehouses, customers, users, notifications
 */
import { API_URL, safeFetch, normalizeApiErrorMessage, getCurrentUser, initialDataCache } from './client';

export const getInitialData = async (): Promise<any> => {
  if (!API_URL) throw new Error("API URL is not configured. Please start backend server.");
  const res = await safeFetch(`${API_URL}/initialData?t=${Date.now()}`);
  if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลเริ่มต้นได้ (Network Error)");
  const data = await res.json();
  if (data?.status === 'error') throw new Error(normalizeApiErrorMessage(data.message || 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้'));
  const { initialDataCache: cache } = await import('./client');
  if (cache !== null) Object.assign(cache, data);
  else { const mod = await import('./client'); (mod as any).initialDataCache = data; }
  return data;
};

// --- Users ---
export const getUsers = async (): Promise<any[]> => {
  if (!API_URL) return [];
  const res = await safeFetch(`${API_URL}/settings/users`);
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};
export const saveUser = async (user: any): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const currentUser = getCurrentUser();
  const res = await safeFetch(`${API_URL}/settings/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: { ...user, currentOperator: currentUser?.name || 'Unknown' } }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};
export const deleteUser = async (rowIndex: number): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/settings/users/${rowIndex}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

// --- Settings ---
export const getSettings = async (forceRefetch = false): Promise<any> => {
  if (!forceRefetch && initialDataCache?.settings) return initialDataCache.settings;
  if (!API_URL) return {};
  const res = await safeFetch(`${API_URL}/settings`);
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache) initialDataCache.settings = data;
  return data;
};
export const saveSettings = async (settings: any): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache) initialDataCache.settings = settings;
  return data;
};

// --- Notifications ---
export const setupTrigger = async (): Promise<any> => ({ status: 'success', message: 'Not needed in Node.js backend' });
export const testDailyReport = async (): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/settings/testDailyReport`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};
export const testTelegram = async (): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/settings/testTelegram`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};
export const relinkTelegram = async (webhookUrl: string): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/settings/relinkTelegram`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: webhookUrl }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};
export const testEmail = async (): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/settings/testEmail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

// --- Zones ---
export const getZones = async (forceRefetch = false): Promise<any[]> => {
  if (!forceRefetch && initialDataCache?.zones) return initialDataCache.zones;
  if (!API_URL) return [];
  const res = await safeFetch(`${API_URL}/zones`);
  const data = await res.json();
  if (initialDataCache) initialDataCache.zones = data;
  return data;
};
export const saveZone = async (zone: any): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/zones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zone }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache?.zones) {
    const idx = initialDataCache.zones.findIndex((z: any) => z.rowIndex === zone.rowIndex);
    if (idx !== -1) initialDataCache.zones[idx] = zone; else initialDataCache.zones.push(zone);
  }
  return data;
};
export const deleteZone = async (rowIndex: string): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/zones/${rowIndex}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

// --- Customers ---
export const getNextCustomerCv = async (): Promise<string> => {
  if (!API_URL) return "A100001";
  const res = await safeFetch(`${API_URL}/customers/next-cv`);
  const data = await res.json();
  return data.cv || "A100001";
};
export const getCustomers = async (forceRefetch = false): Promise<any[]> => {
  if (!forceRefetch && initialDataCache?.customers) return initialDataCache.customers;
  if (!API_URL) return [];
  const res = await safeFetch(`${API_URL}/customers`);
  const data = await res.json();
  if (initialDataCache) initialDataCache.customers = data;
  return data;
};
export const saveCustomer = async (customer: any): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache?.customers) {
    const idx = initialDataCache.customers.findIndex((c: any) => c.rowIndex === customer.rowIndex);
    if (idx !== -1) initialDataCache.customers[idx] = customer; else initialDataCache.customers.push(customer);
  }
  return data;
};
export const deleteCustomer = async (rowIndex: string): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/customers/${rowIndex}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

// --- Warehouses ---
export const getWarehouses = async (forceRefetch = false): Promise<any[]> => {
  if (!forceRefetch && initialDataCache?.warehouses) return initialDataCache.warehouses;
  if (!API_URL) return [];
  const res = await safeFetch(`${API_URL}/warehouses`);
  const data = await res.json();
  if (initialDataCache) initialDataCache.warehouses = data;
  return data;
};
export const saveWarehouse = async (warehouse: any): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/warehouses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(warehouse) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache) {
    if (!initialDataCache.warehouses) initialDataCache.warehouses = [];
    const idx = initialDataCache.warehouses.findIndex((w: any) => w.id === data.warehouse?.id);
    if (idx !== -1) initialDataCache.warehouses[idx] = data.warehouse; else initialDataCache.warehouses.push(data.warehouse);
  }
  return data;
};
export const deleteWarehouse = async (id: number): Promise<any> => {
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/warehouses/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache) delete initialDataCache.warehouses;
  return data;
};
