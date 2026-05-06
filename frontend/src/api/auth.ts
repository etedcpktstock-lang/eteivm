/**
 * Auth API — Login, logout, ping, permissions
 */
import { API_URL, safeFetch, normalizeApiErrorMessage } from './client';

export const login = async (username: string, password: string, deviceInfo?: any): Promise<any> => {
  if (!API_URL) throw new Error("API URL is not configured.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  try {
    const payload = { action: 'login', username, password, deviceInfo };
    const res = await safeFetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    if (data.status === 'error') {
      const normalized = normalizeApiErrorMessage(data.message);
      if (normalized !== String(data.message || '').trim()) throw new Error(normalized);
    }
    if (data.status === 'success' && data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
      if (deviceInfo) localStorage.setItem('device-info', JSON.stringify(deviceInfo));
    }
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error("การเชื่อมต่อหมดเวลา (Timeout)");
    throw err;
  }
};

export const pingStatus = async (username: string, name: string): Promise<any> => {
  if (!API_URL || !username) return { count: 0 };
  const infoRaw = localStorage.getItem('device-info');
  const info = infoRaw ? JSON.parse(infoRaw) : {};
  const payload = { action: 'pingStatus', username, name, ip: info.ip || '', loc: info.loc || '' };
  const res = await safeFetch(`${API_URL}/auth/ping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
};

export const getOnlineCount = async (): Promise<number> => {
  if (!API_URL) return 0;
  const res = await safeFetch(`${API_URL}/auth/onlineCount`);
  const data = await res.json();
  return data.count || 0;
};

export const logoutData = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('device-info');
  localStorage.removeItem('ete-active-tab');
};

export const getPermissions = async (): Promise<any> => {
  const { initialDataCache } = await import('./client');
  if (initialDataCache?.permissions) return initialDataCache.permissions;
  if (!API_URL) return {};
  const res = await safeFetch(`${API_URL}/auth/permissions`);
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  return data;
};

export const savePermissions = async (permissions: any): Promise<any> => {
  const { initialDataCache } = await import('./client');
  if (!API_URL) throw new Error("API URL not configured");
  const res = await safeFetch(`${API_URL}/auth/permissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions }) });
  const data = await res.json();
  if (data.status === "error") throw new Error(normalizeApiErrorMessage(data.message));
  if (initialDataCache) initialDataCache.permissions = permissions;
  return data;
};
