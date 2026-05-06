export const PRESELECTED_LOGISTICS_CONTEXT_STORAGE_KEY = 'eteivm:preselected-logistics-context';

export type PreselectedLogisticsTab = 'issue' | 'return';
export type PreselectedLogisticsSubTab = 'waiting' | 'active' | 'history';

export type PersistedPreselectedLogisticsContext = {
  activeTab: PreselectedLogisticsTab;
  jobId: string;
  logisticsSubTab: PreselectedLogisticsSubTab;
};

export const readPersistedPreselectedLogisticsContext = (): PersistedPreselectedLogisticsContext | null => {
  try {
    const raw = sessionStorage.getItem(PRESELECTED_LOGISTICS_CONTEXT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedPreselectedLogisticsContext>;
    const validTab = parsed.activeTab === 'issue' || parsed.activeTab === 'return';
    const validJobId = typeof parsed.jobId === 'string' && parsed.jobId.trim().length > 0;
    const validSubTab = parsed.logisticsSubTab === 'waiting' || parsed.logisticsSubTab === 'active' || parsed.logisticsSubTab === 'history';

    if (!validTab || !validJobId || !validSubTab) return null;

    return {
      activeTab: parsed.activeTab,
      jobId: parsed.jobId.trim(),
      logisticsSubTab: parsed.logisticsSubTab,
    };
  } catch {
    return null;
  }
};

export const writePersistedPreselectedLogisticsContext = (context: PersistedPreselectedLogisticsContext) => {
  try {
    sessionStorage.setItem(PRESELECTED_LOGISTICS_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // ignore storage errors
  }
};

export const clearPersistedPreselectedLogisticsContext = () => {
  try {
    sessionStorage.removeItem(PRESELECTED_LOGISTICS_CONTEXT_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};
