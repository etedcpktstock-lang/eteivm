/**
 * API Client — Core HTTP utilities, caching, and error normalization
 */

export let API_URL = import.meta.env.VITE_API_URL || `/api`;

// Force clear storage to prevent ghost connections
localStorage.removeItem('ete_app_script_url');

export const updateApiUrl = (newUrl: string) => {
  API_URL = newUrl || import.meta.env.VITE_API_URL || `/api`;
};

export const resetApiUrl = () => {
  API_URL = import.meta.env.VITE_API_URL || `/api`;
  localStorage.removeItem('ete_app_script_url');
};

export let initialDataCache: any = null;
export const setInitialDataCache = (data: any) => { initialDataCache = data; };
export const invalidateCache = () => { initialDataCache = null; };

const DB_CONNECTION_ALERT = 'ไม่สามารถติดต่อฐานข้อมูลได้ กรุณาแจ้งผู้ดูแลระบบ';

export const normalizeApiErrorMessage = (message?: string): string => {
  const raw = String(message || '').trim();
  if (!raw) return DB_CONNECTION_ALERT;
  if (/P1001|P1002|Can't reach database server|database server|PrismaClientInitializationError|connect ECONNREFUSED|ECONNREFUSED|Connection terminated|connection error/i.test(raw)) {
    return `${DB_CONNECTION_ALERT} (${raw})`;
  }
  return raw;
};

export const normalizeTrackingType = (raw: any): 'BATCH' | 'SERIALIZED' => {
  return String(raw || 'BATCH').trim().toUpperCase() === 'SERIALIZED' ? 'SERIALIZED' : 'BATCH';
};

const normalizeAssetTags = (raw: any): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((tag) => String(tag || '').trim()).filter(Boolean);
};

export const normalizeTransactionLine = (it: any) => {
  const serial = String(it?.serialNumber || it?.serial_number || '').trim();
  const tag = String(it?.assetTag || it?.asset_tag || '').trim();
  const trackingType = normalizeTrackingType(it?.item?.tracking_type || it?.tracking_type);
  const resolvedAssetTag = tag || (trackingType === 'SERIALIZED' ? serial : '');
  const assetTags = normalizeAssetTags(it?.assetTags || it?.asset_tags);
  const normalizedAssetTags = assetTags.length > 0
    ? assetTags
    : (trackingType === 'SERIALIZED' && resolvedAssetTag ? [resolvedAssetTag] : []);
  return {
    ...it,
    item: it?.item ? { ...it.item, tracking_type: trackingType } : it?.item,
    serialNumber: serial, serial_number: serial,
    assetTag: resolvedAssetTag, asset_tag: resolvedAssetTag,
    assetTags: normalizedAssetTags, asset_tags: normalizedAssetTags,
    tracking_type: trackingType
  };
};

export const normalizeTransactionLines = (items: any[] = []) => {
  return (items || []).map(normalizeTransactionLine);
};

export const safeFetch = async (url: string, options: any = {}, retries = 2): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);

  let token = null;
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) { const user = JSON.parse(userStr); token = user.token || null; }
  } catch (e) { }

  const headers: Record<string, string> = {
    ...options.headers,
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const finalOptions = { ...options, signal: options.signal || controller.signal, cache: 'no-store', headers };
  try {
    const res = await fetch(url, finalOptions);
    clearTimeout(id);
    if (!res.ok && retries > 0) { await new Promise(r => setTimeout(r, 1000)); return safeFetch(url, options, retries - 1); }
    return res;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError' && retries > 0) {
      if (!options.signal || !options.signal.aborted) return safeFetch(url, options, retries - 1);
    } else if (retries > 0) { await new Promise(r => setTimeout(r, 1000)); return safeFetch(url, options, retries - 1); }
    throw err;
  }
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};
