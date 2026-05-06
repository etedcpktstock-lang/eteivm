import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { ClipboardList, Package, RefreshCw, UserRound, Truck, ScanLine, FileStack, MapPinned } from 'lucide-react';
import { getCustomers, getZones, getJobRequests } from '../../api';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import type { MaterialItem, Transaction, Zone } from '../../types';
import {
  createIssueDraftStorageKeys,
  clearAllIssueDraftStorageForOperator,
  clearIssueDraftKeys,
  getIssueDraftFieldKey,
  getIssueDraftSuccessCleanupKeys,
  isIssueDraftExpired,
  readStoredIssueDraftStep,
  writeStoredIssueDraftStep,
} from '../../utils/issueDraftPersistence';
import { Button, Icon, LoadingOverlay } from '../shared/CommonUI';

const ItemSelector = lazy(() => import('../mobile/ItemSelector'));
const LogisticsSummary = lazy(() => import('../mobile/LogisticsSummary'));
const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));
import BarcodeScanner from '../mobile/BarcodeScanner';

interface DesktopIssueWorkspaceProps {
  items: MaterialItem[];
  transactions: Transaction[];
  onSuccess: () => void;
  operatorName: string;
  thaiAddressData: any[];
  warehouses?: any[];
  initialJobId?: string;
  setActiveTab?: (tab: any) => void;
  setLogisticsSubTab?: (tab: 'waiting' | 'active' | 'history') => void;
  setPreSelectedLogisticsJobId?: (jobId: string | null) => void;
}

function getWarehouseReadyStock(item: any, whId?: number | string | null): number {
  return Number(item?.available_stock ?? 0);
}

export default function DesktopIssueWorkspace({
  items,
  transactions,
  onSuccess,
  operatorName,
  thaiAddressData,
  warehouses = [],
  initialJobId,
  setActiveTab,
  setLogisticsSubTab,
  setPreSelectedLogisticsJobId,
}: DesktopIssueWorkspaceProps) {
  const action = 'issue';
  const { cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY } = createIssueDraftStorageKeys(operatorName);

  const isExpired = () => {
    return isIssueDraftExpired(TS_KEY);
  };

  const now = new Date();
  const defaultDate = now.toLocaleDateString('en-CA');
  const defaultTime = '00:00';

  const [step, setStep] = useState<'form' | 'summary' | 'success'>(() => {
    const saved = readStoredIssueDraftStep(LOGISTICS_KEY);
    const savedCart = localStorage.getItem(CART_KEY);
    const hasCart = savedCart && savedCart !== '[]';
    if ((saved === 'summary' || saved === 'success') && !hasCart) return 'form';
    return saved || 'form';
  });
  const updateStep = (newStep: 'form' | 'summary' | 'success') => {
    setStep(newStep);
    writeStoredIssueDraftStep(LOGISTICS_KEY, newStep);
  };

  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem(CART_KEY);
    if (isExpired()) {
      localStorage.removeItem(CART_KEY);
      return [];
    }
    if (!saved) return [];
    try { return JSON.parse(saved); } catch { return []; }
  });

  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTxnNo, setSavedTxnNo] = useState<string>(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'saved-txn')) || '');
  const [resetKey, setResetKey] = useState(Date.now());
  const [tempSubItems, setTempSubItems] = useState<any[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScannerItemId, setActiveScannerItemId] = useState<string | null>(null);

  const [cv, setCv] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cv')) || '');
  const [deliveryBy, setDeliveryBy] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryBy')) || '');
  const [deliveryDate, setDeliveryDate] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryDate')) || defaultDate);
  const [deliveryTime, setDeliveryTime] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryTime')) || defaultTime);
  const [workZone, setWorkZone] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'workzone')) || '');
  const [note, setNote] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'note')) || '');
  const [notifier, setNotifier] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notifier')) || '');
  const [notificationDate, setNotificationDate] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notificationDate')) || defaultDate);
  const [returnReason, setReturnReason] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'returnReason')) || '');
  const [cabinetCondition, setCabinetCondition] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cabinetCondition')) || '');
  const [warehouseId, setWarehouseId] = useState<number>(() => {
    const saved = localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'warehouseId'));
    return saved ? parseInt(saved, 10) : (warehouses[0]?.id || 1);
  });

  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [fetchingJobs, setFetchingJobs] = useState(false);
  const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => initialJobId || localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobId')) || null);
  const [selectedJobOriginator, setSelectedJobOriginator] = useState(() => localStorage.getItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobOriginator')) || '');
  const isResettingDraftRef = useRef(false);

  useEffect(() => {
    if (initialJobId && initialJobId !== selectedJobId) setSelectedJobId(initialJobId);
  }, [initialJobId, selectedJobId]);

  const filteredJobs = useMemo(() => {
    if (!cv) return pendingJobs;
    return pendingJobs.filter((j) => String(j.cv || j.CV) === String(cv));
  }, [pendingJobs, cv]);

  useEffect(() => {
    if (isResettingDraftRef.current) return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cv'), cv);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryBy'), deliveryBy);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryDate'), deliveryDate);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'deliveryTime'), deliveryTime);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'workzone'), workZone);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'note'), note);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notifier'), notifier);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'notificationDate'), notificationDate);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'returnReason'), returnReason);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'cabinetCondition'), cabinetCondition);
    localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'warehouseId'), warehouseId.toString());
    if (selectedJobId) localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobId'), selectedJobId);
    else localStorage.removeItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobId'));
    if (selectedJobOriginator) localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobOriginator'), selectedJobOriginator);
    else localStorage.removeItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'selectedJobOriginator'));
    localStorage.setItem(TS_KEY, Date.now().toString());
  }, [cart, cv, deliveryBy, deliveryDate, deliveryTime, workZone, note, notifier, notificationDate, returnReason, cabinetCondition, warehouseId, selectedJobId, selectedJobOriginator, CART_KEY, LOGISTICS_KEY, TS_KEY]);

  useEffect(() => {
    if (step === 'success') {
      clearIssueDraftKeys(getIssueDraftSuccessCleanupKeys(
        { cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY },
        { includeStep: true, includeSavedTxn: true, includeSelectedJob: true, includeSelectedJobOriginator: true },
      ));
    }
  }, [step, CART_KEY, LOGISTICS_KEY, TS_KEY]);

  // 🔒 Safety: clear all draft keys on unmount when handoff/navigation was triggered
  useLayoutEffect(() => {
    return () => {
      if (isResettingDraftRef.current) {
        clearAllIssueDraftStorageForOperator({ cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY });
      }
    };
  }, [CART_KEY, LOGISTICS_KEY, TS_KEY]);

  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error);
    getZones().then(setZones).catch(console.error);
  }, []);

  const matchedCustomer = useMemo(() => customers.find((c) => {
    const customerCv = String(c.cv || c.CV || c['เลข CV'] || c['เลขCV'] || '');
    return customerCv === String(cv);
  }), [customers, cv]);

  const selectedWarehouse = useMemo(() => warehouses.find((w: any) => Number(w.id) === Number(warehouseId)), [warehouses, warehouseId]);
  const selectedJob = useMemo(() => pendingJobs.find((j) => String(j.jobId) === String(selectedJobId)), [pendingJobs, selectedJobId]);
  const totalQty = useMemo(() => cart.reduce((sum, c) => sum + Number(c.quantity || 0), 0), [cart]);

  const fetchJobs = useCallback(() => {
    setFetchingJobs(true);
    getJobRequests()
      .then((jobs) => {
        const deliveryJobs = jobs.filter((j: any) => {
          const type = String(j.type || '').toUpperCase();
          const rawStatus = String(j.status || '');
          const status = rawStatus.toUpperCase();
          const isTransit = status.includes('TRANSIT') || rawStatus.includes('เดินทาง');
          const isAccepted = status === 'ACCEPTED' || rawStatus.includes('รับงาน');
          const isAlreadyDone = rawStatus.includes('เบิกออก') || rawStatus.includes('เสร็จ');
          return (type === 'DELIVERY' || type === 'MIXED') && (status === 'PENDING' || isAccepted || isTransit) && !isAlreadyDone && rawStatus !== 'รอรับคืน' && rawStatus !== 'รับคืนแล้ว';
        });
        setPendingJobs(deliveryJobs);
        setHasFetchedJobs(true);
      })
      .catch((err) => {
        console.error('Fetch jobs failed:', err);
        setError('โหลดข้อมูลแจ้งงานไม่สำเร็จ');
      })
      .finally(() => setFetchingJobs(false));
  }, []);

  const importJobToCart = useCallback((jobId: string | null | undefined) => {
    try {
      const job = pendingJobs.find((j) => String(j.jobId) === String(jobId));
      if (!job) {
        setError('ไม่พบข้อมูลใบงาน');
        return;
      }
      if (!Array.isArray(job.items)) {
        setError('ข้อมูลใบงานไม่สมบูรณ์ (Missing items)');
        return;
      }

      let shortageFound = false;
      const rawDeliveryItems = job.items.filter((ji: any) => {
        const aType = String(ji.action_type || ji.action || '').toUpperCase();
        return aType === 'แจ้งส่ง' || aType === 'DELIVERY' || aType === 'ISSUE' || aType.includes('ส่ง');
      });

      if (rawDeliveryItems.length === 0) {
        setError("ไม่พบรายการ 'ส่ง' ในใบงานนี้");
        return;
      }

      const cabinets = rawDeliveryItems.filter((ji: any) => ji.ประเภท === 'ตู้แช่');
      const tempAccessories = rawDeliveryItems.filter((ji: any) => ji.ประเภท !== 'ตู้แช่');
      const deliveryItemsOnly = cabinets.length > 0
        ? cabinets.map((cab: any, idx: number) => idx === 0 ? { ...cab, subItems: tempAccessories } : cab)
        : tempAccessories;

      const effectiveImportWarehouseId = Number(job.warehouse_id || warehouseId || 0);
      const imported = deliveryItemsOnly.map((jobItem: any) => {
        const requiredCond = String(jobItem.item?.['สภาพ'] || jobItem['สภาพ'] || '').trim();
        const jobItemBrand = String(jobItem.item?.['ยี่ห้อหรือรูปแบบ'] || jobItem['ยี่ห้อหรือรูปแบบ'] || '').trim();
        const jobItemSize = String(jobItem.item?.['ขนาด'] || jobItem['ขนาด'] || '').trim();
        const jobItemName = String(jobItem.item?.['รายการ'] || jobItem['รายการ'] || '').trim();
        const jobItemType = String(jobItem.item?.['ประเภท'] || jobItem['ประเภท'] || '').trim();

        const masterMatch = (items || []).find((m: any) =>
          String(m['รายการ'] || '').trim() === jobItemName &&
          String(m['ประเภท'] || '').trim() === jobItemType &&
          String(m['ยี่ห้อหรือรูปแบบ'] || '').trim() === jobItemBrand &&
          String(m['ขนาด'] || '').trim() === jobItemSize &&
          (!requiredCond || String(m['สภาพ'] || '').trim() === requiredCond)
        );

        const currentStock = masterMatch ? getWarehouseReadyStock(masterMatch, effectiveImportWarehouseId) : 0;
        if (currentStock < Number(jobItem.quantity || jobItem.จำนวน || 1)) shortageFound = true;

        const mappedSubItems = (jobItem.subItems || []).map((si: any) => {
          const siBrand = String(si.item?.['ยี่ห้อหรือรูปแบบ'] || si['ยี่ห้อหรือรูปแบบ'] || '').trim();
          const siSize = String(si.item?.['ขนาด'] || si['ขนาด'] || '').trim();
          const siType = String(si.item?.['ประเภท'] || si['ประเภท'] || '').trim();
          const siName = String(si.item?.['รายการ'] || si['รายการ'] || '').trim();
          const siCond = String(si.item?.['สภาพ'] || si['สภาพ'] || 'ใหม่').trim();

          const siMasterMatch = (items || []).find((m: any) =>
            String(m['รายการ'] || '').trim() === siName &&
            String(m['ประเภท'] || '').trim() === siType &&
            String(m['ยี่ห้อหรือรูปแบบ'] || '').trim() === siBrand &&
            String(m['ขนาด'] || '').trim() === siSize &&
            (!siCond || String(m['สภาพ'] || '').trim() === siCond)
          );

          return {
            ...si,
            item: siMasterMatch || si.item || si,
            quantity: Number(si.quantity || si.จำนวน || 1),
            displayString: siMasterMatch
              ? [siMasterMatch['ยี่ห้อหรือรูปแบบ'], siMasterMatch['สภาพ'], siMasterMatch['ขนาด'], siMasterMatch['รายการ'], siMasterMatch['รายละเอียด']].filter((v) => v && v !== '-').join(' ')
              : [si.ประเภท || si.item?.ประเภท, si['ยี่ห้อหรือรูปแบบ'] || si.item?.['ยี่ห้อหรือรูปแบบ'], si['รายการ'] || si.item?.['รายการ'], si['ขนาด'] || si.item?.['ขนาด'], si['รายละเอียด'] || si.item?.['รายละเอียด']].filter((v) => v && v !== '-').join(' ') || 'อุปกรณ์เสริม',
          };
        });

        return {
          id: Math.random().toString(36).slice(7),
          action: 'issue',
          item: masterMatch || { ...jobItem.item, ...jobItem },
          quantity: Number(jobItem.quantity || jobItem.จำนวน || 1),
          subItems: mappedSubItems,
          displayString: masterMatch
            ? [masterMatch['ยี่ห้อหรือรูปแบบ'], masterMatch['สภาพ'], masterMatch['ขนาด'], masterMatch['รายการ'], masterMatch['รายละเอียด']].filter((v) => v && v !== '-').join(' ')
            : [jobItem['ยี่ห้อหรือรูปแบบ'], jobItem['สภาพ'], jobItem['ขนาด'], jobItem['รายการ'], jobItem['รายละเอียด']].filter((v) => v && v !== '-').join(' ') || jobItem.displayString || 'พัสดุเบิกออก',
          isFromJob: true,
        };
      });

      setCart(imported);
      setNote(job.note || '');
      setCv(job.cv || job.CV || job['เลข CV'] || '');
      if (job.operator) setNotifier(job.operator);
      if (job.operator) setSelectedJobOriginator(job.operator);
      const jobWhId = Number(job.warehouse_id || job.warehouseId || job.items?.find((it: any) => it?.warehouse_id || it?.warehouseId)?.warehouse_id || job.items?.find((it: any) => it?.warehouse_id || it?.warehouseId)?.warehouseId || 0);
      if (jobWhId > 0) setWarehouseId(jobWhId);
      if (job.timestamp) {
        const d = new Date(job.timestamp);
        if (!isNaN(d.getTime())) setNotificationDate(d.toISOString().split('T')[0]);
      }
      setSelectedJobId(job.jobId);
      setError(shortageFound ? '⚠️ มีพัสดุบางรายการในใบงานที่มีสต็อกไม่พอกรุณาตรวจสอบ' : null);
    } catch (err: any) {
      console.error('Critical error in Issue import:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูล:' + err.message);
    }
  }, [pendingJobs, items, warehouseId]);

  useEffect(() => {
    if (initialJobId && !hasFetchedJobs && !fetchingJobs) fetchJobs();
  }, [initialJobId, hasFetchedJobs, fetchingJobs, fetchJobs]);

  useEffect(() => {
    if (initialJobId && hasFetchedJobs && pendingJobs.length > 0 && cart.length === 0) {
      importJobToCart(initialJobId);
    }
  }, [initialJobId, hasFetchedJobs, pendingJobs, cart.length, importJobToCart]);

  const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
    setCart((prev) => {
      if (!serialNumber) {
        const existingIdx = prev.findIndex((c) => c.action === action && c.item.rowIndex === item.rowIndex && c.displayString === displayString && !c.serialNumber);
        if (existingIdx !== -1) {
          const updatedCart = [...prev];
          updatedCart[existingIdx] = { ...updatedCart[existingIdx], quantity: updatedCart[existingIdx].quantity + quantity };
          return updatedCart;
        }
      }
      return [...prev, {
        id: Math.random().toString(36).substring(7),
        item,
        quantity,
        displayString,
        action,
        serialNumber,
        subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined,
      }];
    });
    setTempSubItems([]);
  }, [tempSubItems]);

  const handleAddSubItem = useCallback((item: MaterialItem, quantity: number, type: 'accessory' | 'sticker') => {
    let display = [item.ยี่ห้อหรือรูปแบบ, item.สภาพ, item.ขนาด, item.รายการ, item.รายละเอียด].filter((v) => v && v !== '-').join(' ');
    display = display.replace(/อุปกรณ์ตู้|สติกเกอร์ตู้|สติ๊กเกอร์ตู้|อะไหล่ตู้/g, '').trim();
    setTempSubItems((prev) => {
      const existingIdx = prev.findIndex((si) => si.item.rowIndex === item.rowIndex && si.type === type);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
        return updated;
      }
      return [...prev, { item, quantity, displayString: display, type }];
    });
  }, []);

  const handleRemoveSubItem = useCallback((idx: number) => {
    setTempSubItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const resetAll = () => {
    isResettingDraftRef.current = true;
    setCart([]);
    setTempSubItems([]);
    updateStep('form');
    setCv('');
    setDeliveryBy('');
    setDeliveryDate(new Date().toLocaleDateString('en-CA'));
    setDeliveryTime('00:00');
    setWorkZone('');
    setNote('');
    setNotifier('');
    setNotificationDate('');
    setReturnReason('');
    setCabinetCondition('');
    setWarehouseId(warehouses[0]?.id || 1);
    setError(null);
    clearAllIssueDraftStorageForOperator({ cartKey: CART_KEY, logisticsKey: LOGISTICS_KEY, timestampKey: TS_KEY });
    if (selectedJobId && setActiveTab) {
      if (setLogisticsSubTab) setLogisticsSubTab('active');
      setActiveTab('logistics');
    }
    setSelectedJobId(null);
    setSelectedJobOriginator('');
    setResetKey(Date.now());
    window.setTimeout(() => {
      isResettingDraftRef.current = false;
    }, 300);
  };

  const captureScreenshot = async () => {
    const element = document.getElementById('desktop-issue-success-receipt');
    if (!element) return;
    try {
      document.body.style.cursor = 'wait';
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `ETE-ISSUE-${savedTxnNo || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        document.body.style.cursor = 'default';
      }, 100);
    } catch (err) {
      console.error(err);
      document.body.style.cursor = 'default';
      alert('ไม่สามารถบันทึกภาพได้ในขณะนี้');
    }
  };

  const hasPendingReturns = selectedJob?.items?.some((it: any) => {
    const at = String(it.action_type || it.action || '').toUpperCase();
    const isReturn = at.includes('คืน') || at.includes('RETURN') || at.includes('RECEIVE');
    const isDone = at.includes('แล้ว') || at.includes('ตรวจสอบ') || at.includes('รอตรวจ');
    return isReturn && !isDone;
  });

  if (step === 'success') {
    return (
      <div className="desktop-page">
        <div id="desktop-issue-success-receipt" className="plain-card" style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ background: '#d97706', color: '#fff', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="verified" size="md" className="text-white" />
            </div>
            <h2 className="plain-page-title" style={{ color: '#fff' }}>บันทึกเบิกสินค้าสำเร็จ</h2>
            <p style={{ marginTop: 6, color: 'rgba(255,255,255,0.85)' }}>เลขอ้างอิง: {savedTxnNo || 'TXN-PENDING'}</p>
          </div>
          <div className="desktop-panel-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">เลขใบงาน</div><div style={{ fontWeight: 700 }}>{selectedJobId ? `#${selectedJobId}` : '-'}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">ผู้ดำเนินการ</div><div style={{ fontWeight: 700 }}>{operatorName}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">ลูกค้า / CV</div><div style={{ fontWeight: 700 }}>{matchedCustomer?.name || cv || '-'}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">คลังต้นทาง</div><div style={{ fontWeight: 700 }}>{selectedWarehouse?.name || '-'}</div></div>
            </div>
            <div className="plain-card" style={{ marginTop: 0 }}>
              <div className="plain-card-header">พัสดุที่เบิกออก ({cart.length})</div>
              <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
                {cart.map((c, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>{c.item?.ประเภท || 'พัสดุ'}</div>
                      <div style={{ fontWeight: 700 }}>{c.displayString || c.item?.รายการ || '-'}</div>
                    </div>
                    <div className="plain-badge">x{c.quantity || 1}</div>
                  </div>
                ))}
              </div>
            </div>
            {(deliveryBy || note) && (
              <div className="plain-card" style={{ marginTop: 0 }}>
                <div className="plain-card-header">ข้อมูลประกอบ</div>
                <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
                  {deliveryBy && <div><strong>ผู้ส่งมอบ:</strong> {deliveryBy}</div>}
                  {note && <div><strong>หมายเหตุ:</strong> {note}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 960, margin: '12px auto 0', display: 'grid', gap: 10 }}>
          {hasPendingReturns && (
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                if (setActiveTab && setPreSelectedLogisticsJobId) {
                  isResettingDraftRef.current = true;
                  // First pass: clear immediately
                  Object.keys(localStorage).forEach((k) => {
                    if (k.includes(LOGISTICS_KEY) || k.includes(CART_KEY) || k.includes(TS_KEY)) {
                      localStorage.removeItem(k);
                    }
                  });
                  setPreSelectedLogisticsJobId(selectedJobId || null);
                  setActiveTab('return');
                  // Second pass: clear again after navigation settles (beats any late effect rewrite)
                  const lk = LOGISTICS_KEY, ck = CART_KEY, tk = TS_KEY;
                  setTimeout(() => {
                    Object.keys(localStorage).forEach((k) => {
                      if (k.includes(lk) || k.includes(ck) || k.includes(tk)) {
                        localStorage.removeItem(k);
                      }
                    });
                  }, 200);
                }
              }}
              leftIcon="assignment_return"
            >
              ทำรายการรับคืนต่อทันที
            </Button>
          )}
          <Button variant="secondary" size="lg" className="w-full" onClick={captureScreenshot} leftIcon="screenshot_region">
            Cap หน้าจอเก็บหลักฐาน
          </Button>
          <Button variant="primary" size="lg" className="w-full" onClick={resetAll}>
            ตกลง
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-page">
      {loading && <LoadingOverlay message="กำลังบันทึกการเบิกพัสดุ..." />}

      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">เบิกพัสดุออกหน้างาน</h2>
          <p className="plain-subtitle">Desktop issue workspace สำหรับผูกใบงาน, คัดกรองพัสดุจากคลัง, ตรวจลูกค้า/สต็อก, และยืนยันการเบิกจากจอเดียว</p>
        </div>
        <div className="plain-topbar-actions">
          <button className="plain-logout" style={{ width: 120 }} onClick={resetAll}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> ล้าง draft
          </button>
        </div>
      </div>

      {error && (
        <div className="plain-card" style={{ borderColor: '#fecaca', background: '#fff1f2' }}>
          <div className="desktop-panel-body" style={{ color: '#be123c', fontWeight: 700 }}>{error}</div>
        </div>
      )}

      <div className="desktop-stat-grid">
        <div className="plain-kpi"><div className="plain-kpi-label">รายการในตะกร้า</div><div className="plain-kpi-value">{cart.length.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">จำนวนรวม</div><div className="plain-kpi-value">{totalQty.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">เลขใบงาน</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{selectedJobId ? `#${selectedJobId}` : '-'}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">ลูกค้า / CV</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{matchedCustomer?.name || cv || '-'}</div></div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--receive-workspace">
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileStack size={15} /> โหลดแผนงาน / ใบแจ้งงาน
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <button className="plain-logout" style={{ width: '100%', height: 42 }} onClick={fetchJobs} disabled={fetchingJobs}>
                {fetchingJobs ? 'กำลังดึงข้อมูล...' : hasFetchedJobs ? `${filteredJobs.length} รายการที่รอเบิก` : 'โหลดแผนงานค้างอยู่'}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 42px 110px', gap: 8, alignItems: 'center' }}>
                <select
                  value={selectedJobId || ''}
                  onFocus={() => { if (!hasFetchedJobs) fetchJobs(); }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedJobId(val || null);
                    const job = pendingJobs.find((j) => String(j.jobId) === String(val));
                    if (job) setSelectedJobOriginator(job.operator || '');
                  }}
                  disabled={cart.some((c) => c.isFromJob) || fetchingJobs}
                  style={{ height: 42, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }}
                >
                  {!hasFetchedJobs && !fetchingJobs ? (
                    <option value="">-- คลิกที่นี่เพื่อโหลดแผนงาน --</option>
                  ) : (
                    <>
                      <option value="">{filteredJobs.length === 0 && !fetchingJobs ? '-- ไม่มีแผนงานค้างอยู่ --' : '-- เลือกเลขนัดหมาย (JobID) --'}</option>
                      {filteredJobs.map((job) => (
                        <option key={job.jobId} value={job.jobId}>
                          {job.jobId} | {customers.find((c) => String(c.cv || c.CV) === String(job.cv || job.CV))?.name || job.cv || job.CV}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {!cart.some((c) => c.isFromJob) ? (
                  <button className="plain-icon-btn" onClick={() => { setActiveScannerItemId('job-search'); setIsScannerOpen(true); }} title="สแกนเลขใบงาน">
                    <ScanLine size={16} />
                  </button>
                ) : (
                  <button className="plain-icon-btn" onClick={() => { setSelectedJobId(null); setSelectedJobOriginator(''); setCart([]); setCv(''); setNote(''); setError('ยกเลิกการเชื่อมโยงงานแล้ว'); }} title="ยกเลิกงานนี้">
                    <Icon name="link_off" size="sm" />
                  </button>
                )}
                <button className="plain-logout" style={{ width: '100%' }} onClick={() => importJobToCart(selectedJobId)} disabled={!selectedJobId || cart.some((c) => c.isFromJob)}>
                  ดึงงาน
                </button>
              </div>
            </div>
          </div>

          {(cv || selectedJobId) && (
            <div className="plain-card">
              <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserRound size={15} /> ลูกค้าและบริบทใบงาน
              </div>
              <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="plain-badge">{selectedJobId ? `JOB #${selectedJobId}` : 'MANUAL'}</span>
                      {selectedJobOriginator && <span className="plain-badge">ผู้สั่งงาน: {selectedJobOriginator}</span>}
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16 }}>{matchedCustomer?.name || 'กำลังโหลดข้อมูลลูกค้า...'}</div>
                    <div className="plain-subtitle">CV: {cv || '-'} {matchedCustomer?.phone ? `• โทร: ${matchedCustomer.phone}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="plain-icon-btn" onClick={() => setIsCustomerModalOpen(true)} title="แก้ข้อมูลลูกค้า"><Icon name="edit" size="sm" /></button>
                    <button className="plain-icon-btn" onClick={() => {
                      const query = matchedCustomer?.lat && matchedCustomer?.lng ? `${matchedCustomer.lat},${matchedCustomer.lng}` : (matchedCustomer?.address || cv);
                      if (query) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                    }} title="เปิดแผนที่"><MapPinned size={16} /></button>
                  </div>
                </div>
                <div><strong>ที่อยู่:</strong> {[matchedCustomer?.address, matchedCustomer?.subdistrict, matchedCustomer?.district, matchedCustomer?.province, matchedCustomer?.zipcode].filter(Boolean).join(' ') || '-'}</div>
                {selectedJob?.note && <div><strong>หมายเหตุสั่งการ:</strong> {selectedJob.note}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">นัดหมาย</div><div style={{ fontWeight: 700, fontSize: 13 }}>{selectedJob?.appointmentDate || selectedJob?.appointment_date || selectedJob?.timestamp ? formatThaiDateTime(selectedJob?.appointmentDate || selectedJob?.appointment_date || selectedJob?.timestamp) : '-'}</div></div>
                  <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">คลังต้นทาง</div><div style={{ fontWeight: 700, fontSize: 13 }}>{selectedWarehouse?.name || '-'}</div></div>
                  <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">ผู้นำส่ง</div><div style={{ fontWeight: 700, fontSize: 13 }}>{deliveryBy || notifier || '-'}</div></div>
                </div>
              </div>
            </div>
          )}

          {!selectedJobId && (
            <div className="plain-card">
              <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={15} /> เลือกรายการพัสดุ
              </div>
              <div className="desktop-panel-body plain-scope" style={{ paddingTop: 0 }}>
                <Suspense fallback={<div className="desktop-empty">กำลังโหลดรายการสินค้า...</div>}>
                  <ItemSelector
                    key={`issue-picker-${resetKey}`}
                    items={items}
                    action={action}
                    cart={cart}
                    tempSubItems={tempSubItems}
                    onAddToCart={handleAddToCart}
                    onAddSubItem={handleAddSubItem}
                    onRemoveSubItem={handleRemoveSubItem}
                    onUpdateSubItemQty={() => {}}
                    setError={setError}
                    error={error}
                    persistenceKey={`${LOGISTICS_KEY}-picker`}
                    warehouseId={warehouseId}
                  />
                </Suspense>
              </div>
            </div>
          )}

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={15} /> รายการคัดกรองพัสดุเบิกออก ({cart.length})
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              {cart.length === 0 && <div className="desktop-empty" style={{ padding: 0 }}>ยังไม่มีรายการในตะกร้า</div>}
              {cart.map((c, idx) => {
                let master = items.find((m: any) => Number(m.rowIndex || m.id || 0) === Number(c.item?.rowIndex || c.item?.id || c.item?.item_id || 0));
                if (!master) {
                  const sn = String(c.item?.['รายการ'] || c.item?.name || '').trim();
                  const st = String(c.item?.['ประเภท'] || c.item?.type || '').trim();
                  const sb = String(c.item?.['ยี่ห้อหรือรูปแบบ'] || c.item?.brand || '').trim();
                  const ss = String(c.item?.['ขนาด'] || c.item?.size || '').trim();
                  const sc = String(c.item?.['สภาพ'] || c.item?.condition || '').trim();
                  master = items.find((m: any) =>
                    String(m['รายการ']).trim() === sn &&
                    String(m['ประเภท']).trim() === st &&
                    String(m['ยี่ห้อหรือรูปแบบ']).trim() === sb &&
                    String(m['ขนาด']).trim() === ss &&
                    (!sc || String(m['สภาพ']).trim() === sc)
                  );
                }
                const stock = getWarehouseReadyStock(master || c.item, warehouseId);
                return (
                  <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="plain-badge">UNIT {idx + 1}</span>
                          {c.isFromJob && <span className="plain-badge">JOB</span>}
                          {c.quantity > 1 && <span className="plain-badge">x{c.quantity}</span>}
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{(c.item?.['ประเภท'] || c.item?.type || 'พัสดุ')} {(c.item?.['ยี่ห้อหรือรูปแบบ'] || c.item?.brand || c.displayString || '')}</div>
                        <div className="plain-subtitle">{(c.item?.['รายการ'] || c.item?.name || '-')} {(c.item?.['ขนาด'] || c.item?.size) ? `(${c.item?.['ขนาด'] || c.item?.size})` : ''}</div>
                        {stock < c.quantity && <div style={{ marginTop: 8, color: '#be123c', fontWeight: 700 }}>สต็อกไม่พอ • คงเหลือ {stock}</div>}
                      </div>
                      <button className="plain-logout" style={{ width: 40 }} onClick={() => removeFromCart(c.id)}><Icon name="delete" size="sm" /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr 1fr 42px', gap: 8, marginTop: 10, alignItems: 'end' }}>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="plain-subtitle" style={{ marginTop: 0 }}>จำนวน</span>
                        <input type="number" min={1} value={c.quantity || 1} onChange={(e) => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, quantity: Math.max(1, Number(e.target.value || 1)) } : item))} style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="plain-subtitle" style={{ marginTop: 0 }}>Serial Number (S/N)</span>
                        <input type="text" value={c.serialNumber || ''} onChange={(e) => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, serialNumber: e.target.value } : item))} placeholder="ระบุ S/N (ถ้ามี)..." style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="plain-subtitle" style={{ marginTop: 0 }}>Asset Tag</span>
                        <input type="text" value={c.assetTag || ''} onChange={(e) => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, assetTag: e.target.value } : item))} placeholder="ระบุ Asset Tag (ถ้ามี)..." style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                      </label>
                      <button className="plain-icon-btn" onClick={() => { setActiveScannerItemId(c.id); setIsScannerOpen(true); }} title="สแกนบาร์โค้ด">
                        <ScanLine size={16} />
                      </button>
                    </div>
                    {!!c.subItems?.length && (
                      <div style={{ marginTop: 10, display: 'grid', gap: 6, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                        {c.subItems.map((si: any, sIdx: number) => (
                          <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span className="plain-subtitle">• {si.displayString || si.item?.['รายการ'] || 'อุปกรณ์เสริม'}</span>
                            <span className="plain-badge">x{si.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="desktop-receive-panel-stack">
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={15} /> บริบทการเบิก
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              <div><strong>คลังต้นทาง:</strong> {selectedWarehouse?.name || '-'}</div>
              <div><strong>เลขใบงาน:</strong> {selectedJobId ? `#${selectedJobId}` : '-'}</div>
              <div><strong>ผู้สั่งงาน:</strong> {selectedJobOriginator || '-'}</div>
              <div><strong>ผู้นำส่ง:</strong> {deliveryBy || '-'}</div>
              <div><strong>ลูกค้า / CV:</strong> {matchedCustomer?.name || cv || '-'}</div>
              <div><strong>เขตงาน:</strong> {workZone || '-'}</div>
              <div><strong>กำหนดส่ง:</strong> {deliveryDate ? formatThaiDateTime(`${deliveryDate}T${deliveryTime}`) : '-'}</div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserRound size={15} /> ข้อมูลส่งบันทึก / ตรวจสอบก่อนยืนยัน
            </div>
            <div className="desktop-panel-body plain-scope" style={{ paddingTop: 0 }}>
              <Suspense fallback={<div className="desktop-empty">กำลังโหลดสรุปรายการ...</div>}>
                <LogisticsSummary
                  cart={cart}
                  action={action}
                  cv={cv}
                  setCv={setCv}
                  deliveryBy={deliveryBy}
                  setDeliveryBy={setDeliveryBy}
                  deliveryDate={deliveryDate}
                  setDeliveryDate={setDeliveryDate}
                  deliveryTime={deliveryTime}
                  setDeliveryTime={setDeliveryTime}
                  workZone={workZone}
                  setWorkZone={setWorkZone}
                  note={note}
                  setNote={setNote}
                  onSuccess={(txnNo: string) => {
                    if (txnNo) {
                      setSavedTxnNo(txnNo);
                      localStorage.setItem(getIssueDraftFieldKey(LOGISTICS_KEY, 'saved-txn'), txnNo);
                    }
                    onSuccess();
                  }}
                  setStep={updateStep}
                  operatorName={operatorName}
                  loading={loading}
                  setLoading={setLoading}
                  setError={setError}
                  error={error}
                  onEditCustomer={() => setIsCustomerModalOpen(true)}
                  customers={customers}
                  zones={zones}
                  transactions={transactions}
                  notifier={notifier}
                  setNotifier={setNotifier}
                  notificationDate={notificationDate}
                  setNotificationDate={setNotificationDate}
                  returnReason={returnReason}
                  setReturnReason={setReturnReason}
                  cabinetCondition={cabinetCondition}
                  setCabinetCondition={setCabinetCondition}
                  jobId={selectedJobId}
                  warehouses={warehouses}
                  warehouseId={warehouseId}
                  setWarehouseId={setWarehouseId}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <CustomerQuickEdit
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          customer={customers.find((c) => String(c.cv || c.CV || c['เลข CV'] || c['เลขCV'] || '') === String(cv)) || { cv, name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' }}
          onSave={async () => {
            const data = await getCustomers();
            setCustomers(data);
          }}
          thaiAddressData={thaiAddressData}
          customers={customers}
        />
      </Suspense>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          if (activeScannerItemId === 'job-search') {
            const matchedJob = pendingJobs.find((j) => String(j.jobId) === code || String(j.cv || j.CV) === code);
            if (matchedJob) {
              setSelectedJobId(matchedJob.jobId);
              setSelectedJobOriginator(matchedJob.operator || '');
              setError(null);
            } else {
              setError('ไม่พบข้อมูลใบงานหรือ CV ที่สแกน:' + code);
            }
          } else {
            setCart((prev) => prev.map((item) => item.id === activeScannerItemId ? { ...item, serialNumber: code, assetTag: item.assetTag || code } : item));
          }
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
}
