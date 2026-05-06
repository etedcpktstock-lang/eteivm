/**
 * API Barrel — Re-exports all API modules for backward compatibility
 * 
 * Import from here: import { login, getItems, ... } from './api'
 * Or import from specific modules: import { login } from './api/auth'
 */

// Core
export { API_URL, updateApiUrl, resetApiUrl, safeFetch, initialDataCache, invalidateCache, getCurrentUser } from './client';

// Auth
export { login, pingStatus, getOnlineCount, logoutData, getPermissions, savePermissions } from './auth';

// Items
export { getItems, getMaterials, saveMasterItem, saveMasterItems, deleteMasterItem } from './items';

// Transactions
export {
  getTransactions, getNextTxnNo, processTransaction,
  processBatchTransaction, searchAssetUnits, getAssetUnitByTag,
  cancelTransaction, clearTransactions, saveJobRequest,
  getJobRequests, getLogisticsJobs
} from './transactions';
export type { BatchTransactionParams } from './transactions';

// Settings, Users, Zones, Customers, Warehouses
export {
  getInitialData, getUsers, saveUser, deleteUser,
  getSettings, saveSettings,
  setupTrigger, testDailyReport, testTelegram, relinkTelegram, testEmail,
  getZones, saveZone, deleteZone,
  getNextCustomerCv, getCustomers, saveCustomer, deleteCustomer,
  getWarehouses, saveWarehouse, deleteWarehouse
} from './settings';
