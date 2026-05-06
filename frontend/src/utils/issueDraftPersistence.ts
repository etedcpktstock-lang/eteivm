export type IssueDraftStep = 'form' | 'summary' | 'success';

/** Centralized schema for all issue draft field names — use instead of hardcoded strings */
export const ISSUE_DRAFT_FIELDS = {
  step: 'step',
  savedTxn: 'saved-txn',
  selectedJobId: 'selectedJobId',
  selectedJobOriginator: 'selectedJobOriginator',
  cv: 'cv',
  deliveryBy: 'deliveryBy',
  deliveryDate: 'deliveryDate',
  deliveryTime: 'deliveryTime',
  workzone: 'workzone',
  note: 'note',
  notifier: 'notifier',
  notificationDate: 'notificationDate',
  returnReason: 'returnReason',
  cabinetCondition: 'cabinetCondition',
  warehouseId: 'warehouseId',
} as const;

export type IssueDraftStorageKeys = {
  cartKey: string;
  logisticsKey: string;
  timestampKey: string;
};

export const createIssueDraftStorageKeys = (operatorName: string): IssueDraftStorageKeys => ({
  cartKey: `ete-cart-${operatorName}-issue`,
  logisticsKey: `ete-logistics-${operatorName}-issue`,
  timestampKey: `ete-ts-${operatorName}-issue`,
});

export const getIssueDraftFieldKey = (logisticsKey: string, field: string) => `${logisticsKey}-${field}`;

export const isIssueDraftExpired = (timestampKey: string, now = Date.now()) => {
  const ts = localStorage.getItem(timestampKey);
  if (!ts) return false;
  const diff = now - parseInt(ts, 10);
  return diff > 30 * 60 * 1000;
};

export const readStoredIssueDraftStep = (logisticsKey: string) =>
  localStorage.getItem(getIssueDraftFieldKey(logisticsKey, ISSUE_DRAFT_FIELDS.step)) as IssueDraftStep | null;

export const writeStoredIssueDraftStep = (logisticsKey: string, step: IssueDraftStep) => {
  localStorage.setItem(getIssueDraftFieldKey(logisticsKey, ISSUE_DRAFT_FIELDS.step), step);
};

export const getIssueDraftSuccessCleanupKeys = (
  keys: IssueDraftStorageKeys,
  options?: {
    includeStep?: boolean;
    includeSavedTxn?: boolean;
    includeSelectedJob?: boolean;
    includeSelectedJobOriginator?: boolean;
  },
) => {
  const F = ISSUE_DRAFT_FIELDS;
  const L = keys.logisticsKey;
  const cleanupKeys = [
    keys.cartKey,
    keys.timestampKey,
    getIssueDraftFieldKey(L, F.workzone),
    getIssueDraftFieldKey(L, F.cv),
    getIssueDraftFieldKey(L, F.deliveryBy),
    getIssueDraftFieldKey(L, F.deliveryDate),
    getIssueDraftFieldKey(L, F.deliveryTime),
    getIssueDraftFieldKey(L, F.note),
    getIssueDraftFieldKey(L, F.notifier),
    getIssueDraftFieldKey(L, F.notificationDate),
    getIssueDraftFieldKey(L, F.returnReason),
    getIssueDraftFieldKey(L, F.cabinetCondition),
    getIssueDraftFieldKey(L, F.warehouseId),
  ];

  if (options?.includeStep) cleanupKeys.push(getIssueDraftFieldKey(L, F.step));
  if (options?.includeSavedTxn) cleanupKeys.push(getIssueDraftFieldKey(L, F.savedTxn));
  if (options?.includeSelectedJob) cleanupKeys.push(getIssueDraftFieldKey(L, F.selectedJobId));
  if (options?.includeSelectedJobOriginator) cleanupKeys.push(getIssueDraftFieldKey(L, F.selectedJobOriginator));

  return cleanupKeys;
};

export const clearIssueDraftKeys = (targetKeys: string[]) => {
  targetKeys.forEach((key) => localStorage.removeItem(key));
};

export const clearAllIssueDraftStorageForOperator = (keys: IssueDraftStorageKeys) => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes(keys.logisticsKey) || key.includes(keys.cartKey) || key.includes(keys.timestampKey))) {
      localStorage.removeItem(key);
      i -= 1;
    }
  }
};
