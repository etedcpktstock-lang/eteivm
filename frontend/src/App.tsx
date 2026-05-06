import React, { useState, useEffect, Suspense, Fragment, lazy, useMemo, useRef } from 'react';
import {
ArrowDownCircle,
ArrowUpCircle,
RotateCcw,
History,
Settings as SettingsIcon,
Search,
LayoutDashboard,
Calendar,
Package,
RefreshCw,
LogOut,
Bell,
XCircle,
Menu,
Clock
} from 'lucide-react';

// 🕰️ Utilities & API
import { safeParseDate } from './utils/dateTimeUtils';
import { API_URL, getInitialData, getLogisticsJobs } from './api';
import { getClientSocket } from './lib/socket';
import {
  clearPersistedPreselectedLogisticsContext,
  readPersistedPreselectedLogisticsContext,
  writePersistedPreselectedLogisticsContext,
  type PersistedPreselectedLogisticsContext,
  type PreselectedLogisticsSubTab,
} from './utils/preselectedLogisticsContext';
import {
  createIssueDraftStorageKeys,
  clearAllIssueDraftStorageForOperator,
} from './utils/issueDraftPersistence';

// 🌍 External Assets/Fonts
import './index.css';

// 🧱 Common UI
import { LoadingOverlay, Toast } from './components/shared/CommonUI';

// 🚀 Lazy Load Components
const Welcome = lazy(() => import('./components/mobile/Welcome'));
const Login = lazy(() => import('./components/mobile/Login'));
const ReceiveForm = lazy(() => import('./components/mobile/ReceiveForm'));
const IssueForm = lazy(() => import('./components/mobile/IssueForm'));
const ReturnForm = lazy(() => import('./components/mobile/ReturnForm'));
const CalendarView = lazy(() => import('./components/mobile/CalendarView'));
const Dashboard = lazy(() => import('./components/mobile/Dashboard'));
const HistoryView = lazy(() => import('./components/mobile/History'));
const JobRequestForm = lazy(() => import('./components/mobile/JobRequestForm'));
const Reports = lazy(() => import('./components/mobile/Reports'));
const MobileDashboard = lazy(() => import('./components/mobile/MobileDashboard'));
const VoidForm = lazy(() => import('./components/mobile/VoidForm'));
const RepairManagement = lazy(() => import('./components/mobile/RepairManagement'));
const LogisticsTasks = lazy(() => import('./components/mobile/LogisticsTasks'));
const LogisticsDashboard = lazy(() => import('./components/mobile/LogisticsDashboard'));
const AuditLog = lazy(() => import('./components/mobile/AuditLog'));
const CustomerSurvey = lazy(() => import('./components/mobile/CustomerSurvey'));
const TransferForm = lazy(() => import('./components/mobile/TransferForm'));
const Settings = lazy(() => import('./components/mobile/Settings'));


// 🖥️ Desktop Components
const DesktopLayout = lazy(() => import('./components/desktop/DesktopLayout'));
const DesktopDashboard = lazy(() => import('./components/desktop/DesktopDashboard'));
const DesktopInventory = lazy(() => import('./components/desktop/DesktopInventory'));
const DesktopHistory = lazy(() => import('./components/desktop/DesktopHistory'));
const DesktopCalendar = lazy(() => import('./components/desktop/DesktopCalendar'));
const DesktopReports = lazy(() => import('./components/desktop/DesktopReports'));
const DesktopLogisticsBoard = lazy(() => import('./components/desktop/DesktopLogisticsBoard'));
const DesktopReviewBoard = lazy(() => import('./components/desktop/DesktopReviewBoard'));
const DesktopScopedPage = lazy(() => import('./components/desktop/DesktopScopedPage'));
const DesktopReceiveWorkspace = lazy(() => import('./components/desktop/DesktopReceiveWorkspace'));
const DesktopJobRequestWorkspace = lazy(() => import('./components/desktop/DesktopJobRequestWorkspace'));
const DesktopIssueWorkspace = lazy(() => import('./components/desktop/DesktopIssueWorkspace'));
const DesktopReturnWorkspace = lazy(() => import('./components/desktop/DesktopReturnWorkspace'));
const DesktopUserAccess = lazy(() => import('./components/desktop/DesktopUserAccess'));

// 📦 Types
import type { MaterialItem, Transaction, User, Customer } from './types';

// ⚙️ Configurations (Defined locally to avoid missing file errors)
const CURRENT_APP_VERSION = "1.1.0";
const APP_CONFIG = {
API_URL: API_URL
};

type RegionKey = 'CENTRAL' | 'NORTH' | 'NORTHEAST' | 'EAST' | 'WEST' | 'SOUTH';

const REGION_PROVINCES: Record<RegionKey, string[]> = {
  CENTRAL: [
    'กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา', 'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท',
    'สระบุรี', 'นครนายก', 'สมุทรปราการ', 'สมุทรสาคร', 'สมุทรสงคราม', 'นครปฐม', 'สุพรรณบุรี', 'อุทัยธานี'
  ],
  NORTH: [
    'เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่', 'อุตรดิตถ์',
    'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'กำแพงเพชร', 'เพชรบูรณ์', 'นครสวรรค์', 'อุตรดิตถ์'
  ],
  NORTHEAST: [
    'กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์', 'มหาสารคาม',
    'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'สกลนคร', 'สุรินทร์', 'ศรีสะเกษ', 'หนองคาย', 'หนองบัวลำภู',
    'อำนาจเจริญ', 'อุดรธานี', 'อุบลราชธานี'
  ],
  EAST: [
    'ฉะเชิงเทรา', 'ชลบุรี', 'จันทบุรี', 'ตราด', 'ปราจีนบุรี', 'ระยอง', 'สระแก้ว'
  ],
  WEST: [
    'กาญจนบุรี', 'ราชบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์'
  ],
  SOUTH: [
    'กระบี่', 'ชุมพร', 'ตรัง', 'นครศรีธรรมราช', 'นราธิวาส', 'ปัตตานี', 'พังงา', 'พัทลุง', 'ภูเก็ต',
    'ยะลา', 'ระนอง', 'สงขลา', 'สตูล', 'สุราษฎร์ธานี'
  ]
};

type AppTab = 'welcome' | 'dashboard' | 'receive' | 'issue' | 'return' | 'history' | 'reports' | 'calendar' | 'settings' | 'void' | 'inventory' | 'repair' | 'logistics' | 'job-request' | 'audit' | 'transfer' | 'survey';
type LogisticsSubTab = PreselectedLogisticsSubTab;

/**
* 📱 Mobile Header Component
*/
const MobileHeader: React.FC<{
activeTab: string;
operatorName: string;
onRefresh: () => void;
permissions: string[];
loading: boolean;
}> = ({ activeTab, operatorName, onRefresh, loading }) => (
<header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
<div className="flex items-center gap-4">
<div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center ">
<Package className="text-white" size={20} />
</div>
<div>
<h1 className="text-[17px] font-black tracking-tight text-slate-800 leading-none">ETE DC</h1>
<p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-1">{operatorName}</p>
</div>
</div>
<div className="flex items-center gap-3">
<button
onClick={onRefresh}
className={`btn no-animation w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 ${loading ? '' : ''}`}
>
<RefreshCw size={18} />
</button>
<div className="relative">
<button className="btn no-animation w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
<Bell size={18} />
<span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
</button>
</div>
</div>
</header>
);

function App() {
const initialPreselectedLogisticsContextRef = useRef<PersistedPreselectedLogisticsContext | null>(readPersistedPreselectedLogisticsContext());
const initialPreselectedLogisticsContext = initialPreselectedLogisticsContextRef.current;

const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<MaterialItem[]>([]);
const [transactions, setTransactions] = useState<Transaction[]>([]);
const [logisticsJobs, setLogisticsJobs] = useState<any[]>([]);
const [activeTab, setActiveTab] = useState<AppTab>(initialPreselectedLogisticsContext?.activeTab || 'welcome');

const [loading, setLoading] = useState(false);
const [onlineCount, _setOnlineCount] = useState(1);
const [latency, setLatency] = useState(0);
const [voidTxnId, setVoidTxnId] = useState<string | null>(null);
const [preSelectedLogisticsJobId, setPreSelectedLogisticsJobId] = useState<string | null>(initialPreselectedLogisticsContext?.jobId || null);
const [permissions, _setPermissions] = useState<string[]>(['read', 'write', 'admin']);
const [logisticsSubTab, setLogisticsSubTab] = useState<LogisticsSubTab>(initialPreselectedLogisticsContext?.logisticsSubTab || 'waiting');
const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
const [isOutdated, setIsOutdated] = useState(false);
const [customers, setCustomers] = useState<Customer[]>([]);
const [warehouses, setWarehouses] = useState<any[]>([]);
const [settings, setSettings] = useState<any>({ APP_VERSION: CURRENT_APP_VERSION, ANNOUNCEMENT: '' });
const [thaiAddressData, setThaiAddressData] = useState<any[]>([]);

const filteredThaiAddressData = useMemo(() => {
  if (String(settings?.ENABLE_AREA_FILTER) !== 'true') return thaiAddressData;

  const activeRegions = (Object.keys(REGION_PROVINCES) as RegionKey[]).filter(
    (regionKey) => String(settings?.[`FILTER_REG_${regionKey}`]) !== 'false'
  );

  const allowedProvinceSet = new Set(
    activeRegions.flatMap((regionKey) => REGION_PROVINCES[regionKey] || [])
  );

  return thaiAddressData.filter((province: any) => allowedProvinceSet.has(String(province?.name_th || '')));
}, [settings, thaiAddressData]);

useEffect(() => {
if (toast) {
const timer = setTimeout(() => setToast(null), 3000);
return () => clearTimeout(timer);
}
}, [toast]);

useEffect(() => {
if (!user) {
clearPersistedPreselectedLogisticsContext();
return;
}

if ((activeTab === 'issue' || activeTab === 'return') && preSelectedLogisticsJobId) {
writePersistedPreselectedLogisticsContext({
activeTab,
jobId: preSelectedLogisticsJobId,
logisticsSubTab
});
return;
}

clearPersistedPreselectedLogisticsContext();
}, [user, activeTab, preSelectedLogisticsJobId, logisticsSubTab]);

// Update browser tab title from settings
useEffect(() => {
  document.title = settings?.APP_TITLE || 'ETE DC — Admin Workspace';
}, [settings?.APP_TITLE]);

useEffect(() => {
let mounted = true;
import('./data/thai_address_all.json')
.then((module) => {
if (!mounted) return;
setThaiAddressData((module.default || []) as any[]);
})
.catch(() => {
if (!mounted) return;
setThaiAddressData([]);
});
return () => {
mounted = false;
};
}, []);

// Cleanup issue draft keys whenever leaving the issue workspace
useEffect(() => {
  if (activeTab !== 'issue' && user) {
    const keys = createIssueDraftStorageKeys(user.name);
    clearAllIssueDraftStorageForOperator(keys);
  }
}, [activeTab, user]);

const playSuccessSound = () => { try { new Audio('/success.mp3').play(); } catch (e) { } };

const clearPreselectedLogisticsSelection = () => {
clearPersistedPreselectedLogisticsContext();
setPreSelectedLogisticsJobId(null);
};

const handleTransactionSuccess = () => {
fetchData(false);
playSuccessSound();
// NOTE: Do NOT clear preselected logistics context here.
// The context is still needed for the "ทำรายการรับคืนต่อทันที" CTA
// button on the success screen. It will be cleared when the user
// navigates away, clicks "ตกลง", or logs out.
};

const handleLogin = (authenticatedUser: User) => {
setUser(authenticatedUser);
localStorage.setItem('user', JSON.stringify(authenticatedUser));
fetchData(true);
};

const handleLogout = () => {
setUser(null);
localStorage.removeItem('user');
clearPreselectedLogisticsSelection();
setActiveTab('welcome');
};

const fetchData = async (showLoading = true) => {
if (showLoading) setLoading(true);
const start = Date.now();
try {
const data = await getInitialData();
const shouldFetchLogistics = !isMobile || activeTab === 'logistics' || activeTab === 'issue';
const logisticsData = shouldFetchLogistics ? await getLogisticsJobs().catch(() => []) : null;

setItems(data.items || []);
setTransactions(data.transactions || []);
if (logisticsData) setLogisticsJobs(logisticsData || []);
setCustomers(data.customers || []);
setWarehouses(data.warehouses || []);
setSettings(data.settings || { APP_VERSION: CURRENT_APP_VERSION });


if (data.settings?.APP_VERSION && data.settings.APP_VERSION !== CURRENT_APP_VERSION) {
setIsOutdated(true);
}

setLatency(Date.now() - start);
} catch (error) {
console.error('Fetch error:', error);
const rawMessage = error instanceof Error ? error.message : '';
const message = /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(rawMessage)
? 'ไม่สามารถติดต่อฐานข้อมูลได้ กรุณาแจ้งผู้ดูแลระบบ'
: (rawMessage || 'ไม่สามารถติดต่อฐานข้อมูลได้ กรุณาแจ้งผู้ดูแลระบบ');
setToast({ type: 'error', message });
} finally {
if (showLoading) setLoading(false);
}
};

useEffect(() => {
const savedUser = localStorage.getItem('user');
if (savedUser && !user) {
setUser(JSON.parse(savedUser));
fetchData(true);
}

const handleResize = () => setIsMobile(window.innerWidth < 1024);
window.addEventListener('resize', handleResize);
return () => window.removeEventListener('resize', handleResize);
}, [user]);

// 📡 Real-time Updates via WebSocket
useEffect(() => {
if (!user) return;

const socket = getClientSocket();

const handleDataUpdated = (payload: any) => {
console.log('📡 [WebSocket] Received update:', payload);
// Show notification toast
if (payload?.message) {
setToast({ type: 'success', message: payload.message });
playSuccessSound();
}

// Fetch fresh data in the background
fetchData(false);
};

socket.on('DATA_UPDATED', handleDataUpdated);

// Occasional fallback poll just in case of silent disconnects
const fallbackPollMs = isMobile ? 300000 : 120000;
const fallbackPoll = setInterval(() => fetchData(false), fallbackPollMs);

return () => {
socket.off('DATA_UPDATED', handleDataUpdated);
clearInterval(fallbackPoll);
};
}, [user, isMobile]);

const updateLocalTransactions = (updated: Transaction[]) => {
setTransactions(updated);
};

const handleVoidFromHistory = (txnNo: string) => {
setVoidTxnId(txnNo);
clearPreselectedLogisticsSelection();
setActiveTab('void');
};

const handleNavigateToJobForm = (tab: 'issue' | 'return', jobId: string) => {
writePersistedPreselectedLogisticsContext({
activeTab: tab,
jobId,
logisticsSubTab: 'active'
});
setPreSelectedLogisticsJobId(jobId);
setLogisticsSubTab('active');
setActiveTab(tab);
};

const handleNavigateById = (tabId: string) => {
  const nextTab = tabId as AppTab;
  if (nextTab !== 'issue' && nextTab !== 'return') {
    clearPreselectedLogisticsSelection();
  }
  // Clear issue draft keys when leaving the issue workspace
  if (activeTab === 'issue' && nextTab !== 'issue' && user) {
    const keys = createIssueDraftStorageKeys(user.name);
    clearAllIssueDraftStorageForOperator(keys);
  }
  setActiveTab(nextTab);
};

const stats = useMemo(() => {
const today = new Date().toLocaleDateString('th-TH');
return {
todayCount: transactions.filter(t => new Date(t['วัน-เวลา']).toLocaleDateString('th-TH') === today).length,
allIn: transactions.filter(t => t.สถานะ === 'รับเข้า').reduce((s, t) => s + (t.จำนวน || 0), 0),
allOut: transactions.filter(t => t.สถานะ === 'เบิกออก').reduce((s, t) => s + Math.abs(t.จำนวน || 0), 0),
allVoid: transactions.filter(t => (t.สถานะ || '').includes('ยกเลิก')).length,
allRepair: items.reduce((s, it) => s + (it.repair_qty || 0), 0),
allScrap: items.reduce((s, it) => s + (it.scrap_qty || 0), 0),
allLost: items.reduce((s, it) => s + (it.lost_qty || 0), 0),
allTransit: items.reduce((s, it) => s + (it.transit_qty || 0), 0),
allQuarantine: items.reduce((s, it) => s + (it.quarantine_qty || 0), 0)
};
}, [transactions, items]);

const navItems = useMemo(() => {
if (!user) return [];
const itemsList = [
{ id: 'welcome', icon: 'home', label: 'หน้าแรก', desktopIcon: 'dashboard_customize', color: 'text-blue-600' },
{ id: 'dashboard', icon: 'inventory_2', label: 'สต็อก', desktopIcon: 'inventory_2', color: 'text-rose-600' },
{ id: 'receive', icon: 'input', label: 'รับเข้า', desktopIcon: 'input', color: 'text-emerald-600' },
{ id: 'job-request', icon: 'assignment', label: 'แจ้งงาน', desktopIcon: 'assignment', color: 'text-indigo-600' },
{ id: 'issue', icon: 'output', label: 'เบิกออก', desktopIcon: 'output', color: 'text-amber-600' },
{ id: 'return', icon: 'assignment_return', label: 'รับคืน', desktopIcon: 'assignment_return', color: 'text-purple-600' },
{ id: 'history', icon: 'history', label: 'ประวัติ', desktopIcon: 'history', color: 'text-indigo-600' },
{ id: 'reports', icon: 'analytics', label: 'รายงาน', desktopIcon: 'analytics', color: 'text-cyan-600' },
{ id: 'audit', icon: 'shield_person', label: 'Audit Log', desktopIcon: 'admin_panel_settings', color: 'text-rose-600' },
{ id: 'repair', icon: 'engineering', label: 'จัดการพัสดุรับคืน', desktopIcon: 'engineering', color: 'text-rose-600' },

{ id: 'calendar', icon: 'calendar_month', label: 'ปฏิทิน', desktopIcon: 'calendar_month', color: 'text-violet-600' },
{ id: 'settings', icon: 'settings', label: 'ตั้งค่า', desktopIcon: 'settings', color: 'text-slate-600' },
{ id: 'logistics', icon: 'local_shipping', label: 'งานส่งของ', desktopIcon: 'local_shipping', color: 'text-indigo-600' },
{ id: 'transfer', icon: 'swap_horiz', label: 'ย้ายพัสดุ', desktopIcon: 'swap_horiz', color: 'text-sky-600' },
{ id: 'survey', icon: 'person_search', label: 'สำรวจลูกค้า', desktopIcon: 'person_search', color: 'text-emerald-600' },
];


return itemsList.filter(nav => {
// มือถือ: เน้นเมนูงานหน้างานที่ต้องใช้บ่อยและกดง่าย
if (isMobile) {
const mobilePrimaryTabs = new Set(['welcome', 'receive', 'issue', 'return', 'repair', 'transfer', 'history', 'reports', 'job-request', 'logistics']);
if (!mobilePrimaryTabs.has(nav.id)) return false;
}

const role = user.role || '';
if (role.toLowerCase().includes('manager') || role.toLowerCase().includes('admin')) return true;
const rolePerms = permissions[role] || {};
const mapping: Record<string, string> = {
'welcome': 'nav_home', 'dashboard': 'nav_inventory', 'job-request': 'nav_job_request', 'receive': 'nav_receive', 'issue': 'nav_issue', 'return': 'nav_return', 'history': 'nav_history', 'reports': 'nav_history', 'calendar': 'nav_calendar', 'settings': 'nav_settings', 'repair': 'nav_repair', 'logistics': 'nav_logistics', 'audit': 'nav_settings', 'survey': 'nav_home', 'transfer': 'nav_transfer'
};
// only admins/managers can see audit log anyway, handled above. But we fallback to nav_settings perms if they manually grant.
const permKey = mapping[nav.id];
if (permKey) return nav.id === 'reports' ? true : (rolePerms[permKey] === true || (permKey === 'nav_home' && rolePerms[permKey] !== false));
return false;
});
}, [user, isMobile, permissions]);

return (
<div className="mobile-app-shell">
<Suspense fallback={<LoadingOverlay message="กำลังเปิดแอปพลิเคชัน..." />}>
{!user ? (
<Login onLogin={handleLogin} />
) : (
<Fragment>
{/* Mobile View */}
<div className="md:hidden mobile-plain-scope">
<header className="bg-white border-b border-slate-200 px-4 py-4">
<div className="flex items-start justify-between gap-3">
<div className="flex items-center gap-3">
  {(() => {
    const iconKey = settings?.APP_ICON || 'Package';
    const brandIcons: Record<string, string> = {
      Package: 'inventory_2', Box: 'inventory_2', Store: 'store', Building2: 'apartment',
      Truck: 'local_shipping', ShoppingBag: 'shopping_bag', Archive: 'archive', Container: 'warehouse'
    };
    return (
      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
        <span className="material-symbols-outlined text-[20px]">{brandIcons[iconKey] || 'inventory_2'}</span>
      </div>
    );
  })()}
  <div>
    <h1 className="text-[16px] font-black text-slate-900 leading-none">{settings?.APP_NAME || 'ETE DC'}</h1>
    <p className="text-[11px] text-slate-500 font-bold mt-1">{settings?.APP_SUBTITLE || 'Desktop Admin Workspace'}</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
        <span className={`h-2 w-2 rounded-full ${latency < 1000 ? 'bg-emerald-500' : (latency < 2000 ? 'bg-amber-500' : 'bg-rose-500')}`}></span>
        {latency}ms
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
        ออนไลน์ {onlineCount}
      </span>
    </div>
  </div>
</div>
<div className="flex items-center gap-2 shrink-0">
<button onClick={() => fetchData(true)} disabled={loading} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
{loading ? <span className="app-spinner-sm" aria-hidden="true"></span> : <span className="material-symbols-outlined text-[18px]">refresh</span>}
</button>
{activeTab !== 'welcome' && (
<button
onClick={() => setActiveTab('welcome')}
className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200"
>
<span className="material-symbols-outlined text-[20px]">home</span>
</button>
)}
</div>
</div>
</header>

<nav className="px-4 py-3 border-b border-slate-200 bg-white">
<div className="flex gap-2 overflow-x-auto no-scrollbar">
{navItems.map((nav) => (
<button
key={nav.id}
onClick={() => setActiveTab(nav.id as typeof activeTab)}
className={`shrink-0 rounded-xl border px-3 py-2 text-[12px] font-bold flex items-center gap-2 transition-colors ${
  activeTab === nav.id 
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
}`}
>
<span className="material-symbols-outlined text-[16px]">{nav.icon}</span>
<span>{nav.label}</span>
</button>
))}
</div>
</nav>

<main className="flex-1 px-4 py-4 pb-10 overflow-y-auto">
<div className="relative h-full">
{loading && activeTab !== 'logistics' && <LoadingOverlay message="กำลังซิงค์ข้อมูลล่าสุด..." />}
<Suspense fallback={<LoadingOverlay message="กำลังโหลดหน้าจอ..." />}>
<Fragment>
{activeTab === 'welcome' && <Welcome user={user} stats={stats} announcement={settings.ANNOUNCEMENT || ''} currentVersion={CURRENT_APP_VERSION} latestVersion={settings.APP_VERSION || ''} onLogout={handleLogout} setActiveTab={setActiveTab} permissions={permissions} settings={settings} />}
{activeTab === 'dashboard' && <Dashboard items={items} warehouses={warehouses} onRefresh={() => fetchData(true)} loading={loading} onNavigate={handleNavigateById} />}
{activeTab === 'inventory' && <Dashboard items={items} warehouses={warehouses} onRefresh={() => fetchData(true)} loading={loading} onNavigate={handleNavigateById} />}

{activeTab === 'history' && <HistoryView transactions={transactions} user={user} customers={customers} onRefresh={fetchData} onVoid={handleVoidFromHistory} />}
{activeTab === 'reports' && <Reports transactions={transactions} />}
{activeTab === 'receive' && <ReceiveForm items={items} warehouses={warehouses} operatorName={user.name} transactions={transactions} thaiAddressData={thaiAddressData} onSuccess={() => { fetchData(false); playSuccessSound(); }} />}
{activeTab === 'issue' && <IssueForm key={preSelectedLogisticsJobId || 'issue-default'} items={items} warehouses={warehouses} transactions={transactions} operatorName={user.name} thaiAddressData={thaiAddressData} initialJobId={preSelectedLogisticsJobId || undefined} onSuccess={handleTransactionSuccess} setActiveTab={setActiveTab} setLogisticsSubTab={setLogisticsSubTab} setPreSelectedLogisticsJobId={setPreSelectedLogisticsJobId} />}
{activeTab === 'return' && <ReturnForm key={preSelectedLogisticsJobId || 'return-default'} items={items} warehouses={warehouses} operatorName={user.name} transactions={transactions} thaiAddressData={thaiAddressData} initialJobId={preSelectedLogisticsJobId || undefined} onSuccess={handleTransactionSuccess} setActiveTab={setActiveTab} setLogisticsSubTab={setLogisticsSubTab} />}

{activeTab === 'settings' && <Settings onRefresh={fetchData} user={user} transactions={transactions} logisticsJobs={logisticsJobs} FULL_ADDRESS_LIST={thaiAddressData} FILTERED_ADDRESS_LIST={filteredThaiAddressData} permissions={permissions} clientVersion={CURRENT_APP_VERSION} />}
{activeTab === 'void' && <VoidForm transactions={transactions} user={user} customers={customers} onRefresh={() => { fetchData(false); playSuccessSound(); }} onUpdateTransactions={updateLocalTransactions} initialTxnNo={voidTxnId || undefined} setActiveTab={setActiveTab} />}
{activeTab === 'calendar' && <CalendarView transactions={transactions} items={items} />}

{activeTab === 'job-request' && <JobRequestForm items={items} warehouses={warehouses} customers={customers} operatorName={user.name} thaiAddressData={thaiAddressData} transactions={transactions} logisticsJobs={logisticsJobs} onSuccess={() => { fetchData(true); }} onClose={() => setActiveTab('welcome')} />}

{activeTab === 'repair' && <RepairManagement items={items} transactions={transactions} customers={customers} operatorName={user.name} onSuccess={() => fetchData(true)} onClose={() => setActiveTab('welcome')} loading={loading} />}
{activeTab === 'logistics' && <div className="plain-page-frame plain-scope"><LogisticsDashboard items={items} customers={customers} operatorName={user.name} onNavigateToTab={handleNavigateToJobForm} onSuccess={() => fetchData(true)} initialTab={logisticsSubTab} transactions={transactions} loading={loading} /></div>}
{activeTab === 'transfer' && <TransferForm items={items} warehouses={warehouses} operatorName={user.name} transactions={transactions} thaiAddressData={thaiAddressData} onSuccess={() => { fetchData(false); playSuccessSound(); }} />}
{activeTab === 'audit' && <div className="plain-page-frame plain-scope"><AuditLog transactions={transactions} user={user} /></div>}
{activeTab === 'survey' && <div className="plain-page-frame plain-scope"><CustomerSurvey items={items} customers={customers} transactions={transactions} logisticsJobs={logisticsJobs} operatorName={user.name} onRefresh={() => fetchData(true)} onClose={() => setActiveTab('welcome')} thaiAddressData={thaiAddressData} /></div>}

</Fragment>
</Suspense>
</div>
</main>

{/* 📱 Mobile Bottom Navigation removed to prevent overlap with action buttons */}
</div>

{/* Desktop View */}
<div className="hidden md:block">
<DesktopLayout
activeTab={activeTab === 'welcome' ? 'dashboard' : activeTab}
setActiveTab={setActiveTab}
user={user}
onLogout={handleLogout}
onRefresh={() => fetchData(true)}
loading={loading}
onlineCount={onlineCount}
latency={latency}
version={CURRENT_APP_VERSION}
permissions={permissions}
settings={settings}
>
{loading && activeTab !== 'logistics' && <LoadingOverlay message="กำลังซิงค์ข้อมูลล่าสุด..." />}

{isOutdated && (
<div className="mb-8 p-6 bg-emerald-600 rounded-3xl text-white flex items-center justify-between ">
<div className="flex items-center gap-4">
<RefreshCw size={32} />
<div>
<h3 className="text-lg font-bold">พบรุ่นล่าสุด v{settings.APP_VERSION}</h3>
<p className="text-emerald-50/70 text-sm">กรุณาอัปเดตเพื่อรับฟีเจอร์ Desktop ใหม่ล่าสุด</p>
</div>
</div>
<button
onClick={() => { localStorage.clear(); window.location.reload(); }}
className="bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold "
>
อัปเดตทันที
</button>
</div>
)}

<Suspense fallback={<div className="flex items-center justify-center p-20 opacity-50 font-bold text-slate-400">กำลังโหลดข้อมูล...</div>}>
<Fragment>
{(activeTab === 'welcome' || activeTab === 'dashboard') && <DesktopDashboard items={items} transactions={transactions} warehouses={warehouses} user={user} onRefresh={() => fetchData(true)} setActiveTab={setActiveTab} allRepair={stats.allRepair} allScrap={stats.allScrap} allLost={stats.allLost} />}
{activeTab === 'history' && <DesktopHistory transactions={transactions} user={user} customers={customers} onRefresh={fetchData} onVoid={handleVoidFromHistory} />}
{activeTab === 'reports' && <DesktopReports transactions={transactions} />}
{activeTab === 'receive' && <DesktopReceiveWorkspace items={items} warehouses={warehouses} operatorName={user.name} transactions={transactions} thaiAddressData={thaiAddressData} onSuccess={() => { fetchData(false); playSuccessSound(); }} />}
{activeTab === 'issue' && <DesktopIssueWorkspace key={preSelectedLogisticsJobId || 'issue-default'} items={items} warehouses={warehouses} transactions={transactions} operatorName={user.name} thaiAddressData={thaiAddressData} initialJobId={preSelectedLogisticsJobId || undefined} onSuccess={handleTransactionSuccess} setActiveTab={setActiveTab} setLogisticsSubTab={setLogisticsSubTab} setPreSelectedLogisticsJobId={setPreSelectedLogisticsJobId} />}
{activeTab === 'return' && <DesktopReturnWorkspace key={preSelectedLogisticsJobId || 'return-default'} items={items} warehouses={warehouses} operatorName={user.name} transactions={transactions} thaiAddressData={thaiAddressData} initialJobId={preSelectedLogisticsJobId || undefined} onSuccess={handleTransactionSuccess} setActiveTab={setActiveTab} setLogisticsSubTab={setLogisticsSubTab} />}
{activeTab === 'settings' && <DesktopUserAccess onRefresh={() => fetchData(true)} user={user} transactions={transactions} logisticsJobs={logisticsJobs} FULL_ADDRESS_LIST={thaiAddressData} FILTERED_ADDRESS_LIST={filteredThaiAddressData} permissions={permissions} clientVersion={CURRENT_APP_VERSION} items={items} warehouses={warehouses} settings={settings} setSettings={setSettings} />}
{activeTab === 'void' && <VoidForm transactions={transactions} user={user} customers={customers} onRefresh={() => { fetchData(false); playSuccessSound(); }} onUpdateTransactions={updateLocalTransactions} initialTxnNo={voidTxnId || undefined} setActiveTab={setActiveTab} />}
{activeTab === 'calendar' && <DesktopCalendar transactions={transactions} items={items} />}
{activeTab === 'inventory' && <DesktopInventory items={items} warehouses={warehouses} transactions={transactions} customers={customers} onRefresh={() => fetchData(true)} loading={loading} onNavigate={handleNavigateById} />}
{activeTab === 'survey' && <DesktopScopedPage title="สำรวจลูกค้า" subtitle="พื้นที่ทำงานสำหรับติดตามข้อมูลจุดติดตั้งและข้อมูลลูกค้าฝั่ง desktop"><CustomerSurvey items={items} customers={customers} transactions={transactions} logisticsJobs={logisticsJobs} operatorName={user.name} onRefresh={() => fetchData(true)} onClose={() => setActiveTab('welcome')} thaiAddressData={thaiAddressData} /></DesktopScopedPage>}
{activeTab === 'job-request' && <DesktopJobRequestWorkspace items={items} warehouses={warehouses} customers={customers} operatorName={user.name} thaiAddressData={thaiAddressData} onSuccess={() => fetchData(true)} />}
{activeTab === 'repair' && <DesktopReviewBoard items={items} transactions={transactions} customers={customers} operatorName={user.name} onSuccess={() => fetchData(true)} loading={loading} />}
{activeTab === 'logistics' && <DesktopLogisticsBoard items={items} customers={customers} operatorName={user.name} onNavigateToTab={handleNavigateToJobForm} initialTab={logisticsSubTab} transactions={transactions} loading={loading} />}
{activeTab === 'transfer' && <TransferForm items={items} warehouses={warehouses} operatorName={user.name} transactions={transactions} thaiAddressData={thaiAddressData} onSuccess={() => { fetchData(false); playSuccessSound(); }} />}
{activeTab === 'audit' && <DesktopScopedPage title="บันทึกระบบ" subtitle="ตรวจสอบกิจกรรมและประวัติการใช้งานในระบบ"><AuditLog transactions={transactions} user={user} /></DesktopScopedPage>}
</Fragment>
</Suspense>
</DesktopLayout>
</div>
</Fragment>
)}
</Suspense>

{toast && (
<div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-md pointer-events-none">
<div className="pointer-events-auto">
<Toast
type={toast.type === 'warning' ? 'warning' : (toast.type as 'success' | 'error')}
message={toast.message}
onClose={() => setToast(null)}
/>
</div>
</div>
)}
</div>
);
}

export default App;
