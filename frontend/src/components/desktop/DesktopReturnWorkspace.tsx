import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { ClipboardCheck, PackageSearch, RefreshCw, ScanLine, ImagePlus, RotateCcw, MapPinned, PackagePlus } from 'lucide-react';
import { getCustomers, getZones, getJobRequests } from '../../api';
import type { MaterialItem, Zone } from '../../types';
import { Button, Icon, LoadingOverlay } from '../shared/CommonUI';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';

const ItemSelector = lazy(() => import('../mobile/ItemSelector'));
const LogisticsSummary = lazy(() => import('../mobile/LogisticsSummary'));
const BarcodeScanner = lazy(() => import('../mobile/BarcodeScanner'));

interface DesktopReturnWorkspaceProps {
  items: MaterialItem[];
  onSuccess: () => void;
  onClose?: () => void;
  operatorName: string;
  thaiAddressData: any[];
  transactions?: any[];
  warehouses?: any[];
  initialJobId?: string;
  setActiveTab?: (tab: any) => void;
  setLogisticsSubTab?: (tab: 'waiting' | 'active' | 'history') => void;
}

async function resizeAndCompressImage(base64Image: string, coords: string | null, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = (err) => {
      console.error('Image loading error:', err);
      reject(new Error('ไม่สามารถโหลดข้อมูลรูปภาพได้'));
    };
    img.onload = () => {
      try {
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        let newWidth = originalWidth;
        let newHeight = originalHeight;
        if (originalWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = Math.floor(originalHeight * (maxWidth / originalWidth));
        }
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Image);
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        const now = new Date();
        const dateStr = now.toLocaleDateString('th-TH') + ' ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';
        let watermarkText = `📅 ${dateStr}`;
        if (coords) watermarkText += ` | 📍 ${coords}`;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        const textWidth = ctx.measureText(watermarkText).width;
        ctx.fillRect(0, newHeight - 35, textWidth + 30, 35);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(watermarkText, 15, newHeight - 10);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        console.error('Canvas processing error:', err);
        resolve(base64Image);
      }
    };
    img.src = base64Image;
  });
}

const getCoordinates = (): Promise<string | null> => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
  );
});

const mapReturnReason = (text: string): string => {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  const options = [
    { key: 'ปิดการขาย (Sales Closed)', keywords: ['ปิดการขาย', 'Sales Closed', 'เลิกกิจการ', 'ปิดร้าน'] },
    { key: 'ไม่มีออเดอร์ (No Orders)', keywords: ['ไม่มีออเดอร์', 'No Orders', 'ไม่อยู่', 'ไม่ออเดอร์'] },
    { key: 'ของเสีย/ชำรุด (Broken/Damaged)', keywords: ['ของเสีย', 'ชำรุด', 'Broken', 'Damaged', 'เสีย', 'พัง'] },
    { key: 'เพิ่มพัสดุ (Add Item)', keywords: ['เพิ่มพัสดุ', 'Add Item', 'เพิ่ม'] },
    { key: 'เปลี่ยนพัสดุ (Exchange)', keywords: ['เปลี่ยนพัสดุ', 'Exchange', 'เปลี่ยน', 'Upgrade', 'Downgrade'] },
    { key: 'อื่นๆ', keywords: ['อื่นๆ', 'Other', 'อื่น'] },
  ];
  for (const opt of options) {
    if (opt.keywords.some((k) => normalized.includes(k))) return opt.key;
  }
  return normalized;
};

export default function DesktopReturnWorkspace({
  items,
  onSuccess,
  onClose,
  operatorName,
  transactions = [],
  warehouses = [],
  initialJobId,
  setActiveTab,
  setLogisticsSubTab,
}: DesktopReturnWorkspaceProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [cv, setCv] = useState('');
  const [deliveryBy, setDeliveryBy] = useState(operatorName);
  const now = new Date();
  const defaultDate = now.toLocaleDateString('en-CA');
  const defaultTime = '00:00';
  const [deliveryDate, setDeliveryDate] = useState<string>(defaultDate);
  const [deliveryTime, setDeliveryTime] = useState(defaultTime);
  const [workZone, setWorkZone] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [savedTxnNo, setSavedTxnNo] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [fetchingJobs, setFetchingJobs] = useState(false);
  const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId || null);
  const [selectedJobOriginator, setSelectedJobOriginator] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScannerItemId, setActiveScannerItemId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [notifier, setNotifier] = useState(operatorName);
  const [notificationDate, setNotificationDate] = useState<string>(defaultDate);
  const [cabinetCondition, setCabinetCondition] = useState('ปกติ(รอตรวจ)');
  const [warehouseId, setWarehouseId] = useState<number>(1);

  useEffect(() => {
    getCustomers().then(setCustomers);
    getZones().then(setZones);
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setFetchingJobs(true);
    try {
      const jobs = await getJobRequests();
      setPendingJobs(jobs);
      setHasFetchedJobs(true);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setFetchingJobs(false);
    }
  };

  const importJob = useCallback((jobId?: string | null) => {
    const job = pendingJobs.find((j) => String(j.jobId) === String(jobId));
    if (!job) return;
    const finalItems = (job.items || [])
      .filter((ji: any) => {
        const aType = String(ji.action_type || ji.action || '').toUpperCase();
        return ['แจ้งคืน', 'RETURN', 'RECEIVE'].some((k) => aType.includes(k));
      })
      .flatMap((ji: any) => {
        const tQty = Number(ji.quantity || ji.จำนวน || 1);
        const r = mapReturnReason(ji.returnReason || ji.return_reason || ji.สาเหตุ || ji.reason || job.returnReason || job.return_reason || job.สาเหตุ || job.reason || '');
        const category = String(ji.ประเภท || '').trim();
        const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));
        if (!isTrackedUnit) {
          return [{
            id: `job_bulk_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
            action: 'receive',
            item: { ...ji, rowIndex: ji.item?.rowIndex || ji.rowIndex || ji.id, สภาพ: 'มือสอง' },
            quantity: tQty,
            status: ji.cabinet_status || ji.status || 'ปกติ',
            returnReason: r,
            serialNumber: (ji.serialNumber || ji.sn || '').trim(),
            assetTag: (ji.assetTag || ji.asset_tag || '').trim(),
            displayString: [ji.ประเภท, ji.ยี่ห้อหรือรูปแบบ, ji.รายการ].filter(Boolean).join(' '),
            isFromJob: true,
          }];
        }
        return Array.from({ length: tQty }).map((_, i) => ({
          id: `job_${Math.random().toString(36).slice(2, 9)}_${i}_${Date.now()}`,
          action: 'receive',
          item: { ...ji, rowIndex: ji.item?.rowIndex || ji.rowIndex || ji.id, สภาพ: 'มือสอง' },
          quantity: 1,
          status: ji.cabinet_status || ji.status || 'ปกติ',
          returnReason: r,
          serialNumber: (ji.serialNumber || ji.sn || '').trim(),
          assetTag: (ji.assetTag || ji.asset_tag || '').trim(),
          displayString: [ji.ประเภท, ji.ยี่ห้อหรือรูปแบบ, ji.รายการ].filter(Boolean).join(' '),
          isFromJob: true,
        }));
      });

    if (finalItems.length === 0) {
      setError('ไม่พบรายการรับคืน');
      return;
    }
    setCart(finalItems);
    setCv(job.cv || '');
    setNote(job.note || '');
    setReturnReason(mapReturnReason(job.returnReason || job.return_reason || job.สาเหตุ || job.reason || ''));
    if (job.operator) {
      setNotifier(job.operator);
      setSelectedJobOriginator(job.operator);
    }
    const wId = job.warehouse_id || job.warehouseId;
    if (wId) setWarehouseId(Number(wId));
    setSelectedJobId(job.jobId);
    setError(null);
  }, [pendingJobs]);

  useEffect(() => {
    if (initialJobId && hasFetchedJobs && pendingJobs.length > 0) importJob(initialJobId);
  }, [initialJobId, hasFetchedJobs, pendingJobs, importJob]);

  const filteredJobs = useMemo(() => pendingJobs.filter((j) => {
    const status = String(j.status || '').toUpperCase();
    return status === 'PENDING' || status === 'รออนุมัติ' || status === 'WAITING';
  }), [pendingJobs]);

  const matchedCustomer = useMemo(() => customers.find((c) => String(c.cv || c.CV || '').trim() === String(cv).trim()), [customers, cv]);
  const matchedJob = useMemo(() => pendingJobs.find((j) => String(j.jobId) === String(selectedJobId)), [pendingJobs, selectedJobId]);
  const selectedWarehouse = useMemo(() => warehouses.find((w: any) => Number(w.id) === Number(warehouseId)), [warehouses, warehouseId]);

  const handleAddToCart = useCallback((item: any, quantity: number) => {
    setCart((prev) => {
      const category = String(item.ประเภท || '').trim();
      const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));
      if (!isTrackedUnit) {
        const existingIdx = prev.findIndex((c) => c.item?.รายการ === item.รายการ && c.item?.ประเภท === item.ประเภท && !c.isFromJob);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
          return updated;
        }
        return [...prev, {
          id: `manual_bulk_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`,
          item,
          quantity,
          action: 'receive',
          status: 'รอตรวจ',
          returnReason: item.returnReason || '',
          serialNumber: '',
          assetTag: '',
          displayString: [item.ประเภท, item.ยี่ห้อหรือรูปแบบ, item.รายการ].filter(Boolean).join(' '),
          isFromJob: false,
        }];
      }
      const newEntries = Array.from({ length: quantity }).map((_, i) => ({
        id: `manual_${Math.random().toString(36).slice(2, 11)}_${Date.now()}_${i}`,
        item,
        quantity: 1,
        action: 'receive',
        status: 'รอตรวจ',
        returnReason: item.returnReason || '',
        serialNumber: '',
        assetTag: '',
        displayString: [item.ประเภท, item.ยี่ห้อหรือรูปแบบ, item.รายการ].filter(Boolean).join(' '),
        isFromJob: false,
      }));
      return [...prev, ...newEntries];
    });
    setIsAddingExtra(false);
  }, []);

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const resetAll = () => {
    setCart([]);
    setCv('');
    setNote('');
    setPhotos([]);
    setSavedTxnNo(null);
    setStep('form');
    setResetKey((prev) => prev + 1);
    setSelectedJobId(null);
    setSelectedJobOriginator('');
    setError(null);
    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  const updateStep = (newStep: 'form' | 'success') => {
    setStep(newStep);
    if (newStep === 'success') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const captureScreenshot = async () => {
    const el = document.getElementById('desktop-return-success-receipt');
    if (!el) return;
    try {
      document.body.style.cursor = 'wait';
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: '#f8fafc' });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `receipt-${savedTxnNo || 'return'}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        document.body.style.cursor = 'default';
      }, 100);
    } catch (err) {
      console.error('Screenshot error:', err);
      document.body.style.cursor = 'default';
      alert('ไม่สามารถบันทึกภาพได้');
    }
  };

  const totalQty = useMemo(() => cart.reduce((sum, c) => sum + Number(c.quantity || 0), 0), [cart]);
  const issueItemsFromJob = useMemo(() => (matchedJob?.items || []).filter((ji: any) => {
    const aType = String(ji.action_type || ji.action || '').toUpperCase();
    return aType === 'ISSUE' || aType === 'DELIVERY' || aType.includes('ส่ง');
  }), [matchedJob]);

  if (step === 'success') {
    return (
      <div className="desktop-page">
        <div id="desktop-return-success-receipt" className="plain-card" style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ background: '#16a34a', color: '#fff', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check_circle" size="md" className="text-white" />
            </div>
            <h2 className="plain-page-title" style={{ color: '#fff' }}>บันทึกรับคืนสำเร็จ</h2>
            <p style={{ marginTop: 6, color: 'rgba(255,255,255,0.85)' }}>เลขอ้างอิง: {savedTxnNo || 'TXN-PENDING'}</p>
          </div>
          <div className="desktop-panel-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">เลขใบงาน</div><div style={{ fontWeight: 700 }}>{selectedJobId || '-'}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">ลูกค้า / CV</div><div style={{ fontWeight: 700 }}>{matchedCustomer?.name || cv || '-'}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">ผู้ดำเนินการ</div><div style={{ fontWeight: 700 }}>{operatorName}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">เขตงาน</div><div style={{ fontWeight: 700 }}>{workZone || '-'}</div></div>
            </div>
            {issueItemsFromJob.length > 0 && (
              <div className="plain-card" style={{ marginTop: 0 }}>
                <div className="plain-card-header">รายการส่งออกในใบงาน ({issueItemsFromJob.length})</div>
                <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
                  {issueItemsFromJob.map((c: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                      <div style={{ fontWeight: 700 }}>[{c.ประเภท || c.type || 'พัสดุ'}] {c.ยี่ห้อหรือรูปแบบ || c.brand} {c.รายการ || c.name}</div>
                      <div className="plain-badge">x{c.quantity || 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="plain-card" style={{ marginTop: 0 }}>
              <div className="plain-card-header">รายการรับคืน ({cart.length})</div>
              <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
                {cart.map((c, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>[{c.item?.ประเภท || c.item?.type || 'พัสดุ'}] {c.item?.ยี่ห้อหรือรูปแบบ || c.item?.brand} {c.item?.รายการ || c.item?.name}</div>
                      <div className="plain-subtitle">S/N: {c.serialNumber || '-'} • Asset: {c.assetTag || '-'} • สาเหตุ: {c.returnReason || '-'}</div>
                    </div>
                    <div className="plain-badge">x{c.quantity || 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 980, margin: '12px auto 0', display: 'grid', gap: 10 }}>
          <Button variant="secondary" size="lg" className="w-full" onClick={captureScreenshot} leftIcon="screenshot_region">Cap หน้าจอเก็บหลักฐาน</Button>
          <Button variant="primary" size="lg" className="w-full" onClick={resetAll}>ตกลง</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-page">
      {(loading || processingPhoto) && <LoadingOverlay message="กำลังบันทึกรายการรับคืน..." />}
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">รับคืนพัสดุ</h2>
          <p className="plain-subtitle">Desktop return workspace สำหรับโหลดรายการคืนจากใบงาน, ตรวจเหตุผลและสถานะพัสดุ, แนบรูปหลักฐาน, และยืนยัน routing ต่อจาก desktop จอเดียว</p>
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
        <div className="plain-kpi"><div className="plain-kpi-label">รายการรับคืน</div><div className="plain-kpi-value">{cart.length.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">จำนวนรวม</div><div className="plain-kpi-value">{totalQty.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">เลขใบงาน</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{selectedJobId || '-'}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">ลูกค้า / CV</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{matchedCustomer?.name || cv || '-'}</div></div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--receive-workspace">
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackageSearch size={15} /> โหลดงานรับคืน
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <button className="plain-logout" style={{ width: '100%', height: 42 }} onClick={fetchJobs} disabled={fetchingJobs}>
                {fetchingJobs ? 'กำลังดึงข้อมูล...' : `${filteredJobs.length} รายการที่รอรับคืน`}
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 42px', gap: 8, alignItems: 'center' }}>
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
                  <option value="">-- เลือกเลขนัดหมาย (JobID) --</option>
                  {filteredJobs.map((job) => <option key={job.jobId} value={job.jobId}>{job.jobId} | {job.cv}</option>)}
                </select>
                <button className="plain-logout" style={{ width: '100%' }} onClick={() => importJob(selectedJobId)} disabled={!selectedJobId || fetchingJobs || cart.some((c) => c.isFromJob)}>ดึงงาน</button>
                {cart.some((c) => c.isFromJob)
                  ? <button className="plain-icon-btn" onClick={() => { setSelectedJobId(null); setCart([]); setCv(''); setNote(''); }} title="ยกเลิกงาน"><Icon name="link_off" size="sm" /></button>
                  : <button className="plain-icon-btn" onClick={() => { setActiveScannerItemId('return-scan'); setIsScannerOpen(true); }} title="สแกนบาร์โค้ด"><ScanLine size={16} /></button>}
              </div>
            </div>
          </div>

          {(cv || selectedJobId) && (
            <div className="plain-card">
              <div className="plain-card-header">บริบทลูกค้าและใบงาน</div>
              <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="plain-badge">{selectedJobId ? `JOB ${selectedJobId}` : 'MANUAL'}</span>
                      {selectedJobOriginator && <span className="plain-badge">ผู้สั่งงาน: {selectedJobOriginator}</span>}
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700, fontSize: 16 }}>{matchedCustomer?.name || 'ไม่พบข้อมูลชื่อลูกค้า'}</div>
                    <div className="plain-subtitle">CV: {cv || '-'} {matchedCustomer?.phone ? `• โทร: ${matchedCustomer.phone}` : ''}</div>
                  </div>
                  <button className="plain-icon-btn" onClick={() => {
                    if (matchedCustomer) {
                      const query = matchedCustomer.latitude || matchedCustomer.lat ? `${matchedCustomer.latitude || matchedCustomer.lat},${matchedCustomer.longitude || matchedCustomer.lng}` : matchedCustomer.address;
                      if (query) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                    }
                  }} title="เปิดแผนที่"><MapPinned size={16} /></button>
                </div>
                <div><strong>ที่อยู่:</strong> {[matchedCustomer?.address, matchedCustomer?.subdistrict || matchedCustomer?.sub_district, matchedCustomer?.district, matchedCustomer?.province].filter(Boolean).join(' ') || '-'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">คลังปลายทาง</div><div style={{ fontWeight: 700, fontSize: 13 }}>{selectedWarehouse?.name || '-'}</div></div>
                  <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">เวลานัดหมาย</div><div style={{ fontWeight: 700, fontSize: 13 }}>{matchedJob?.appointmentDate || matchedJob?.appointment_date || matchedJob?.timestamp ? formatThaiDateTime(matchedJob?.appointmentDate || matchedJob?.appointment_date || matchedJob?.timestamp) : '-'}</div></div>
                  <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">สาเหตุหลัก</div><div style={{ fontWeight: 700, fontSize: 13 }}>{returnReason || '-'}</div></div>
                </div>
              </div>
            </div>
          )}

          {selectedJobId && (
            <div className="plain-card">
              <div className="plain-card-header">เพิ่มพัสดุนอกใบงาน</div>
              <div className="desktop-panel-body">
                <button className="plain-logout" style={{ width: '100%', height: 44 }} onClick={() => setIsAddingExtra((v) => !v)}>
                  <PackagePlus size={14} style={{ marginRight: 6, display: 'inline' }} /> {isAddingExtra ? 'ปิดหน้าต่างเพิ่มพัสดุ' : '+ เพิ่มพัสดุนอกใบงาน (เก็บกลับเพิ่ม)'}
                </button>
              </div>
            </div>
          )}

          {(!selectedJobId || isAddingExtra) && (
            <div className="plain-card">
              <div className="plain-card-header">เลือกรายการพัสดุรับคืน</div>
              <div className="desktop-panel-body plain-scope" style={{ paddingTop: 0 }}>
                <Suspense fallback={<div className="desktop-empty">กำลังโหลดรายการสินค้า...</div>}>
                  <ItemSelector
                    key={resetKey}
                    items={items}
                    action="receive"
                    cart={cart}
                    tempSubItems={[]}
                    onAddToCart={(it, qty) => handleAddToCart({ ...it, returnReason: selectedJobId ? 'เพิ่มพัสดุ (Add Item)' : '' }, qty)}
                    onAddSubItem={() => {}}
                    onRemoveSubItem={() => {}}
                    onUpdateSubItemQty={() => {}}
                    setError={setError}
                    error={error}
                    fixedCondition="มือสอง"
                  />
                </Suspense>
              </div>
            </div>
          )}

          <div className="plain-card">
            <div className="plain-card-header">รายการคัดกรองพัสดุ ({cart.length})</div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              {cart.length === 0 && <div className="desktop-empty" style={{ padding: 0 }}>ยังไม่มีรายการรับคืน</div>}
              {cart.map((c, idx) => {
                const category = String(c.item?.ประเภท || '').trim();
                const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));
                return (
                  <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="plain-badge">UNIT {idx + 1}</span>
                          {c.isFromJob && <span className="plain-badge">JOB</span>}
                          {c.quantity > 1 && <span className="plain-badge">x{c.quantity}</span>}
                        </div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{c.item?.ประเภท || 'พัสดุ'} {c.item?.ยี่ห้อหรือรูปแบบ || ''}</div>
                        <div className="plain-subtitle">{c.item?.รายการ || '-'} {c.item?.ขนาด ? `(${c.item.ขนาด})` : ''}</div>
                      </div>
                      <button className="plain-logout" style={{ width: 40 }} onClick={() => removeFromCart(c.id)}><Icon name="delete" size="sm" /></button>
                    </div>
                    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                      {isTrackedUnit && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 42px', gap: 8, alignItems: 'end' }}>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="plain-subtitle" style={{ marginTop: 0 }}>Serial Number (S/N)</span>
                            <input type="text" placeholder="ระบุ S/N..." value={c.serialNumber || ''} onChange={(e) => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, serialNumber: e.target.value } : item))} style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                          </label>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="plain-subtitle" style={{ marginTop: 0 }}>Asset Tag</span>
                            <input type="text" placeholder="ระบุ Asset Tag..." value={c.assetTag || ''} onChange={(e) => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, assetTag: e.target.value } : item))} style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                          </label>
                          <button className="plain-icon-btn" onClick={() => { setActiveScannerItemId(c.id); setIsScannerOpen(true); }} title="สแกนบาร์โค้ด"><ScanLine size={16} /></button>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="plain-subtitle" style={{ marginTop: 0 }}>สาเหตุการรับกลับ</span>
                          <select value={c.returnReason || ''} disabled={c.isFromJob} onChange={(e) => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, returnReason: e.target.value } : item))} style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }}>
                            <option value="">-- เลือกสาเหตุ --</option>
                            <option value="ปิดการขาย (Sales Closed)">ปิดการขาย (Sales Closed)</option>
                            <option value="ไม่มีออเดอร์ (No Orders)">ไม่มีออเดอร์ (No Orders)</option>
                            <option value="ของเสีย/ชำรุด (Broken/Damaged)">ของเสีย/ชำรุด (Broken/Damaged)</option>
                            <option value="เพิ่มพัสดุ (Add Item)">เพิ่มพัสดุ (Add Item)</option>
                            <option value="เปลี่ยนพัสดุ (Exchange)">เปลี่ยนพัสดุ (Exchange)</option>
                            <option value="อื่นๆ">อื่นๆ</option>
                          </select>
                        </label>
                        <div style={{ display: 'grid', gap: 6 }}>
                          <span className="plain-subtitle" style={{ marginTop: 0 }}>สถานะรับคืน</span>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                            {['ปกติ', 'รอซ่อม', 'สูญหาย', 'ชำรุดหนัก/ซาก'].map((opt) => (
                              <button key={opt} onClick={() => setCart((prev) => prev.map((item) => item.id === c.id ? { ...item, status: opt } : item))} className={c.status === opt ? 'plain-logout' : 'plain-icon-btn'} style={{ width: '100%', height: 40 }}>{opt}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="desktop-receive-panel-stack">
          <div className="plain-card">
            <div className="plain-card-header"><ClipboardCheck size={15} style={{ display: 'inline', marginRight: 8 }} />บริบทการรับคืน</div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              <div><strong>คลังปลายทาง:</strong> {selectedWarehouse?.name || '-'}</div>
              <div><strong>เลขใบงาน:</strong> {selectedJobId || '-'}</div>
              <div><strong>ผู้สั่งงาน:</strong> {selectedJobOriginator || '-'}</div>
              <div><strong>ลูกค้า / CV:</strong> {matchedCustomer?.name || cv || '-'}</div>
              <div><strong>เขตงาน:</strong> {workZone || '-'}</div>
              <div><strong>เวลานัดหมาย:</strong> {matchedJob?.appointmentDate || matchedJob?.appointment_date || matchedJob?.timestamp ? formatThaiDateTime(matchedJob?.appointmentDate || matchedJob?.appointment_date || matchedJob?.timestamp) : '-'}</div>
              <div><strong>สาเหตุหลัก:</strong> {returnReason || '-'}</div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header"><ImagePlus size={15} style={{ display: 'inline', marginRight: 8 }} />รูปประกอบ ({photos.length}/6)</div>
            <div className="desktop-panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {photos.slice(0, 6).map((p, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <img src={p} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button className="plain-icon-btn" style={{ position: 'absolute', top: 6, right: 6 }} onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}><Icon name="close" size="xs" /></button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <label style={{ aspectRatio: '1 / 1', border: '2px dashed #cbd5e1', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff' }}>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setProcessingPhoto(true);
                      try {
                        const coords = await getCoordinates();
                        const reader = new FileReader();
                        const base64 = await new Promise<string>((res) => { reader.onloadend = () => res(reader.result as string); reader.readAsDataURL(file); });
                        const compressed = await resizeAndCompressImage(base64, coords);
                        setPhotos((prev) => [...prev, compressed]);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setProcessingPhoto(false);
                      }
                    }} />
                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                      <ImagePlus size={22} style={{ margin: '0 auto 6px' }} />
                      <div style={{ fontSize: 12, fontWeight: 700 }}>เพิ่มรูป</div>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header"><RotateCcw size={15} style={{ display: 'inline', marginRight: 8 }} />สรุปก่อนบันทึก</div>
            <div className="desktop-panel-body plain-scope" style={{ paddingTop: 0 }}>
              <Suspense fallback={<div className="desktop-empty">กำลังโหลดสรุปรายการ...</div>}>
                <LogisticsSummary
                  cart={cart.map((c) => ({ ...c, cabinetCondition: c.status }))}
                  action="return"
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
                  onSuccess={(txnNo) => setSavedTxnNo(txnNo)}
                  setStep={updateStep}
                  operatorName={operatorName}
                  loading={loading || processingPhoto}
                  photos={photos}
                  setLoading={setLoading}
                  setError={setError}
                  error={error}
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
                  matchedJob={matchedJob}
                  warehouses={warehouses}
                  warehouseId={warehouseId}
                  setWarehouseId={setWarehouseId}
                  onEditCustomer={() => {}}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        {isScannerOpen && (
          <BarcodeScanner
            onScan={(code) => {
              if (activeScannerItemId === 'return-scan') {
                const job = pendingJobs.find((j) => String(j.jobId) === code || String(j.cv || '') === code);
                if (job) {
                  setSelectedJobId(job.jobId);
                  setSelectedJobOriginator(job.operator || '');
                  setCv(job.cv || '');
                  setError(null);
                } else {
                  setError('ไม่พบข้อมูลใบงานหรือ CV ที่สแกน: ' + code);
                }
              } else {
                setCart((prev) => prev.map((item) => item.id === activeScannerItemId ? { ...item, serialNumber: code, assetTag: item.assetTag || code } : item));
              }
              setIsScannerOpen(false);
            }}
            onClose={() => setIsScannerOpen(false)}
            isOpen={isScannerOpen}
          />
        )}
      </Suspense>
    </div>
  );
}
