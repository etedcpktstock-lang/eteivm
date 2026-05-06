import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { Search, RefreshCw, ClipboardList, Truck, Undo2, Camera, MapPinned, UserRound, CalendarClock, Warehouse } from 'lucide-react';
import type { MaterialItem, Customer } from '../../types';
import { Button, Icon, LoadingOverlay } from '../shared/CommonUI';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import { getCustomers, saveJobRequest } from '../../api';

const JobRequestItemSelector = lazy(() => import('../mobile/JobRequestItemSelector'));
const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));
const BarcodeScanner = lazy(() => import('../mobile/BarcodeScanner'));

interface DesktopJobRequestWorkspaceProps {
  items: MaterialItem[];
  customers: Customer[];
  operatorName: string;
  onSuccess: () => void;
  thaiAddressData?: any[];
  warehouses?: any[];
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

const getCoordinates = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};

const RETURN_REASONS = [
  'ปิดการขาย (Sales Closed)',
  'ไม่มีออเดอร์ (No Orders)',
  'ของเสีย/ชำรุด (Broken/Damaged)',
  'อื่นๆ',
];

const RETURN_STATUSES = ['ปกติ', 'รอซ่อม', 'สูญหาย', 'ชำรุดหนัก/ซาก'];

export default function DesktopJobRequestWorkspace({
  items,
  customers: initialCustomers,
  operatorName,
  onSuccess,
  thaiAddressData = [],
  warehouses = [],
}: DesktopJobRequestWorkspaceProps) {
  const PREFIX = `ete-job-request-${operatorName}`;

  const now = new Date();
  const defaultDate = now.toLocaleDateString('en-CA');
  const defaultTime = '00:00';

  const [cv, setCv] = useState(() => localStorage.getItem(`${PREFIX}-cv`) || '');
  const [note, setNote] = useState(() => localStorage.getItem(`${PREFIX}-note`) || '');
  const [returnReason, setReturnReason] = useState(() => localStorage.getItem(`${PREFIX}-returnReason`) || '');
  const [appointmentDate, setAppointmentDate] = useState(() => localStorage.getItem(`${PREFIX}-appointmentDate`) || defaultDate);
  const [appointmentTime, setAppointmentTime] = useState(() => localStorage.getItem(`${PREFIX}-appointmentTime`) || defaultTime);
  const [step, setStep] = useState<'form' | 'success'>(() => (localStorage.getItem(`${PREFIX}-step`) as 'form' | 'success') || 'form');
  const [jobId, setJobId] = useState(() => localStorage.getItem(`${PREFIX}-jobid`) || '');
  const [warehouseId, setWarehouseId] = useState<number>(() => {
    const saved = localStorage.getItem(`${PREFIX}-warehouseId`);
    return saved ? parseInt(saved, 10) : (warehouses?.[0]?.id || 1);
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || []);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScanTarget, setActiveScanTarget] = useState<{ id: string; index: number } | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(Date.now());

  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem(`${PREFIX}-cart`);
    if (!saved) return [];
    try { return JSON.parse(saved); } catch { return []; }
  });

  const [returnCart, setReturnCart] = useState<any[]>(() => {
    const saved = localStorage.getItem(`${PREFIX}-return-cart`);
    if (!saved) return [];
    try { return JSON.parse(saved); } catch { return []; }
  });

  const [tempSubItems, setTempSubItems] = useState<any[]>(() => {
    const saved = localStorage.getItem(`${PREFIX}-temp-sub`);
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  const [tempReturnSubItems, setTempReturnSubItems] = useState<any[]>(() => {
    const saved = localStorage.getItem(`${PREFIX}-temp-return-sub`);
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  const updateStep = (newStep: 'form' | 'success') => {
    setStep(newStep);
    localStorage.setItem(`${PREFIX}-step`, newStep);
  };

  useEffect(() => {
    localStorage.setItem(`${PREFIX}-cv`, cv);
    localStorage.setItem(`${PREFIX}-note`, note);
    localStorage.setItem(`${PREFIX}-returnReason`, returnReason);
    localStorage.setItem(`${PREFIX}-appointmentDate`, appointmentDate);
    localStorage.setItem(`${PREFIX}-appointmentTime`, appointmentTime);
    localStorage.setItem(`${PREFIX}-cart`, JSON.stringify(cart));
    localStorage.setItem(`${PREFIX}-return-cart`, JSON.stringify(returnCart));
    localStorage.setItem(`${PREFIX}-temp-sub`, JSON.stringify(tempSubItems));
    localStorage.setItem(`${PREFIX}-temp-return-sub`, JSON.stringify(tempReturnSubItems));
    localStorage.setItem(`${PREFIX}-warehouseId`, warehouseId.toString());
    localStorage.setItem(`${PREFIX}-step`, step);
    localStorage.setItem(`${PREFIX}-jobid`, jobId);
  }, [cv, note, returnReason, appointmentDate, appointmentTime, cart, returnCart, tempSubItems, tempReturnSubItems, warehouseId, step, jobId, PREFIX]);

  const matchedCustomer = useMemo(() => {
    return (customers || []).find((c) => String(c.cv || c.CV || '') === String(cv));
  }, [customers, cv]);

  const selectedWarehouse = useMemo(() => warehouses.find((w: any) => Number(w.id) === Number(warehouseId)), [warehouses, warehouseId]);
  const totalDeliveryQty = useMemo(() => cart.reduce((sum, c) => sum + Number(c.quantity || 0), 0), [cart]);
  const totalReturnQty = useMemo(() => returnCart.reduce((sum, c) => sum + Number(c.quantity || 0), 0), [returnCart]);

  const handleSearch = async () => {
    const search = cv.trim().toLowerCase();
    if (!search) {
      setError('กรุณาระบุชื่อ หรือ เลข CV เพื่อค้นหา');
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      let hits = (customers || []).filter((c) => {
        const customerCv = String(c.cv || c.CV || '').toLowerCase();
        const customerName = String(c.name || '').toLowerCase();
        return customerCv.includes(search) || customerName.includes(search);
      }).slice(0, 50);
      if (hits.length === 0) {
        const freshData = await getCustomers(true);
        setCustomers(freshData);
        hits = freshData.filter((c: any) => {
          const customerCv = String(c.cv || c.CV || '').toLowerCase();
          const customerName = String(c.name || '').toLowerCase();
          return customerCv.includes(search) || customerName.includes(search);
        }).slice(0, 50);
      }
      if (hits.length === 0) {
        setError('ไม่พบข้อมูลลูกค้า');
        setSearchResults([]);
      } else {
        setSearchResults(hits);
      }
    } catch (err: any) {
      setError(`เกิดข้อผิดพลาดในการค้นหา:${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
    setCart((prev) => {
      const category = (item.ประเภท || '').trim();
      const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

      if (!isTrackedUnit || serialNumber) {
        const existingIdx = prev.findIndex((c) =>
          c.item?.รายการ === item.รายการ &&
          c.item?.ประเภท === item.ประเภท &&
          c.item?.ขนาด === item.ขนาด &&
          c.displayString === displayString &&
          !c.serialNumber &&
          !serialNumber
        );

        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
          return updated;
        }

        return [...prev, {
          id: `delivery_${Math.random().toString(36).substring(7)}_${Date.now()}`,
          item,
          quantity,
          displayString,
          serialNumber,
          assetTag: '',
          subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined,
        }];
      }

      const newEntries = Array.from({ length: quantity }).map((_, i) => ({
        id: `delivery_${Math.random().toString(36).substring(7)}_${i}_${Date.now()}`,
        item,
        quantity: 1,
        displayString,
        serialNumber,
        assetTag: '',
        subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined,
      }));
      return [...prev, ...newEntries];
    });
    setTempSubItems([]);
  }, [tempSubItems]);

  const handleAddToReturnCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
    setReturnCart((prev) => {
      const category = (item.ประเภท || '').trim();
      const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));

      if (!isTrackedUnit || serialNumber) {
        const existingIdx = prev.findIndex((c) =>
          c.item?.รายการ === item.รายการ &&
          c.item?.ประเภท === item.ประเภท &&
          c.item?.ขนาด === item.ขนาด &&
          c.displayString === displayString &&
          !c.serialNumber &&
          !serialNumber
        );

        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
          return updated;
        }

        return [...prev, {
          id: `return_${Math.random().toString(36).substring(7)}_${Date.now()}`,
          item,
          quantity,
          displayString,
          serialNumber,
          assetTag: '',
          status: 'ปกติ',
          subItems: tempReturnSubItems.length > 0 ? [...tempReturnSubItems] : undefined,
        }];
      }

      const newEntries = Array.from({ length: quantity }).map((_, i) => ({
        id: `return_${Math.random().toString(36).substring(7)}_${i}_${Date.now()}`,
        item,
        quantity: 1,
        displayString,
        serialNumber,
        assetTag: '',
        status: 'ปกติ',
        subItems: tempReturnSubItems.length > 0 ? [...tempReturnSubItems] : undefined,
      }));
      return [...prev, ...newEntries];
    });
    setTempReturnSubItems([]);
  }, [tempReturnSubItems]);

  const handleScan = (decodedText: string) => {
    if (activeScanTarget !== null) {
      setReturnCart((prev) => prev.map((item) => item.id === activeScanTarget.id ? { ...item, serialNumber: decodedText, assetTag: item.assetTag || decodedText } : item));
    }
    setIsScannerOpen(false);
    setActiveScanTarget(null);
  };

  const handleAddSubItem = useCallback((item: MaterialItem, quantity: number, type: 'accessory' | 'sticker', isReturn: boolean = false) => {
    const setter = isReturn ? setTempReturnSubItems : setTempSubItems;
    const category = item.ประเภท || (type === 'sticker' ? 'สติกเกอร์' : 'อุปกรณ์');
    const displayString = `${category}: ${item.รายการ}`;
    setter((prev) => {
      const existingIdx = prev.findIndex((si) => si.item.rowIndex === item.rowIndex && si.type === type);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + quantity };
        return updated;
      }
      return [...prev, { item, quantity, displayString, type }];
    });
  }, []);

  const updateTempSubItemQty = (idx: number, delta: number, isReturn: boolean = false) => {
    const setter = isReturn ? setTempReturnSubItems : setTempSubItems;
    setter((prev) => {
      const updated = [...prev];
      if (updated[idx]) updated[idx] = { ...updated[idx], quantity: Math.max(1, updated[idx].quantity + delta) };
      return updated;
    });
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));
  const removeFromReturnCart = (id: string) => setReturnCart((prev) => prev.filter((c) => c.id !== id));

  const resetAll = () => {
    setCart([]);
    setReturnCart([]);
    setTempSubItems([]);
    setTempReturnSubItems([]);
    updateStep('form');
    setCv('');
    setNote('');
    setReturnReason('');
    setAppointmentDate(defaultDate);
    setAppointmentTime(defaultTime);
    setJobId('');
    setSearchResults([]);
    setPhotos([]);
    setError(null);
    [
      `${PREFIX}-cv`, `${PREFIX}-cart`, `${PREFIX}-return-cart`, `${PREFIX}-note`, `${PREFIX}-returnReason`,
      `${PREFIX}-appointmentDate`, `${PREFIX}-appointmentTime`, `${PREFIX}-step`, `${PREFIX}-jobid`,
      `${PREFIX}-temp-sub`, `${PREFIX}-temp-return-sub`, `${PREFIX}-warehouseId`
    ].forEach((k) => localStorage.removeItem(k));
    setResetKey(Date.now());
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setProcessingPhoto(true);
    setError(null);

    try {
      const coords = await getCoordinates();
      const newImages: string[] = [];
      const incomingFiles = Array.from(files);

      for (const file of incomingFiles) {
        if (photos.length + newImages.length >= 6) break;
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        const compressed = await resizeAndCompressImage(base64, coords);
        newImages.push(compressed);
      }
      setPhotos((prev) => [...prev, ...newImages].slice(0, 6));
    } catch (err: any) {
      setError(`ไม่สามารถอัปโหลดรูปภาพได้:${err.message}`);
    } finally {
      setProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!cv) {
      setError('กรุณาระบุเป้าหมาย / ลูกค้า');
      return;
    }
    if (cart.length === 0 && returnCart.length === 0) {
      setError('กรุณาระบุรายการพัสดุ');
      return;
    }

    const customer = matchedCustomer;
    if (!customer) {
      setError('ไม่พบข้อมูลลูกค้าในระบบ กรุณาเลือก CV ที่มีอยู่จริงก่อนกดสั่งงาน');
      return;
    }
    const missingCustomerInfo = !String(customer.name || '').trim() || !String(customer.address || '').trim();
    if (missingCustomerInfo) {
      setError('ข้อมูลลูกค้าไม่ครบ (ต้องมีชื่อและที่อยู่) กรุณาแก้ข้อมูลลูกค้าก่อนกดสั่งงาน');
      return;
    }

    if (returnCart.length > 0) {
      const missingReason = returnCart.some((c) => !c.returnReason || c.returnReason.trim() === '');
      if (missingReason) {
        setError('กรุณาระบุสาเหตุที่เก็บกลับ');
        return;
      }
    }

    const selectedWarehouseId = Number(warehouseId || 1);
    const requiredByItem = new Map<string, { label: string; required: number; available: number }>();
    const addRequired = (rawItem: any, qtyRaw: number) => {
      const qty = Number(qtyRaw || 0);
      if (qty <= 0 || !rawItem) return;
      const itemId = Number(rawItem.id || rawItem.rowIndex || rawItem.item_id || 0);
      const key = itemId > 0
        ? `id:${itemId}`
        : `k:${String(rawItem.ประเภท || '')}|${String(rawItem.ยี่ห้อหรือรูปแบบ || '')}|${String(rawItem.รายการ || '')}|${String(rawItem.ขนาด || '')}|${String(rawItem.สภาพ || '')}`;
      const label = `${rawItem.ประเภท || ''} ${rawItem.ยี่ห้อหรือรูปแบบ || ''} ${rawItem.รายการ || ''} ${rawItem.ขนาด || ''}`.replace(/\s+/g, ' ').trim() || 'พัสดุ';
      let available = Number(rawItem?.available_stock ?? 0);
      const prev = requiredByItem.get(key);
      if (prev) prev.required += qty;
      else requiredByItem.set(key, { label, required: qty, available });
    };

    cart.forEach((c: any) => {
      addRequired(c.item || c, Number(c.quantity || 1));
      (c.subItems || []).forEach((s: any) => addRequired(s.item || s, Number(s.quantity || 1)));
    });

    const shortages = Array.from(requiredByItem.values()).filter((v) => v.required > v.available);
    if (shortages.length > 0) {
      const first = shortages[0];
      setError(`สต็อกไม่พอสำหรับการสั่งงาน: ${first.label} (เหลือ ${first.available} แต่ต้องการ ${first.required})`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await saveJobRequest({
        cv,
        deliveryItems: cart.map((c) => ({ ...c, type: 'DELIVERY' })),
        returnItems: returnCart.map((c) => ({ ...c, type: 'RETURN' })),
        operator: operatorName,
        note,
        returnReason,
        appointmentDate: appointmentDate ? `${appointmentDate}T${appointmentTime}` : undefined,
        warehouseId,
        photos,
      });
      if (res.status === 'error') throw new Error(res.message);
      setJobId(res.jobId || '-');
      updateStep('success');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const captureScreenshot = async () => {
    const el = document.getElementById('desktop-job-success-receipt');
    if (!el) return;
    try {
      document.body.style.cursor = 'wait';
      const html2canvas = (await import('html2canvas')).default;
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `ETE-JOB-${jobId || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        document.body.style.cursor = 'default';
      }, 100);
    } catch (e) {
      console.error(e);
      alert('ไม่สามารถบันทึกภาพได้');
      document.body.style.cursor = 'default';
    }
  };

  if (step === 'success') {
    return (
      <div className="desktop-page">
        <div id="desktop-job-success-receipt" className="plain-card" style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ background: '#4f46e5', color: '#fff', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="assignment_turned_in" size="md" className="text-white" />
            </div>
            <h2 className="plain-page-title" style={{ color: '#fff' }}>บันทึกแจ้งงานสำเร็จ</h2>
            <p style={{ marginTop: 6, color: 'rgba(255,255,255,0.88)' }}>เลขที่ใบงาน: {jobId || '-'}</p>
          </div>

          <div className="desktop-panel-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">ผู้เปิดใบงาน</div><div style={{ fontWeight: 700 }}>{operatorName}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">นัดหมาย</div><div style={{ fontWeight: 700 }}>{appointmentDate ? formatThaiDateTime(`${appointmentDate}T${appointmentTime}`) : '-'}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">คลังต้นทาง</div><div style={{ fontWeight: 700 }}>{selectedWarehouse?.name || '-'}</div></div>
              <div className="plain-kpi" style={{ padding: 12 }}><div className="plain-kpi-label">ลูกค้า / CV</div><div style={{ fontWeight: 700 }}>{matchedCustomer?.name || cv || '-'}</div></div>
            </div>

            {cart.length > 0 && (
              <div className="plain-card" style={{ marginTop: 0 }}>
                <div className="plain-card-header">รายการสั่งนำส่ง ({cart.length})</div>
                <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
                  {cart.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>{c.item?.ประเภท || 'พัสดุ'}</div>
                        <div style={{ fontWeight: 700 }}>{c.displayString || c.item?.รายการ || '-'}</div>
                      </div>
                      <div className="plain-badge">x{c.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {returnCart.length > 0 && (
              <div className="plain-card" style={{ marginTop: 0 }}>
                <div className="plain-card-header">รายการสั่งเก็บกลับ ({returnCart.length})</div>
                <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
                  {returnCart.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #fecdd3', borderRadius: 10, background: '#fff1f2' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#e11d48', fontWeight: 700 }}>{c.item?.ประเภท || 'พัสดุ'}</div>
                        <div style={{ fontWeight: 700 }}>{c.displayString || c.item?.รายการ || '-'}</div>
                        <div className="plain-subtitle">สาเหตุ: {c.returnReason || '-'}</div>
                      </div>
                      <div className="plain-badge">x{c.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {note && (
              <div className="plain-card" style={{ marginTop: 0 }}>
                <div className="plain-card-header">หมายเหตุ</div>
                <div className="desktop-panel-body">{note}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 980, margin: '12px auto 0', display: 'grid', gap: 10 }}>
          <Button variant="secondary" size="lg" className="w-full" onClick={captureScreenshot} leftIcon="screenshot_region">
            Cap หน้าจอเก็บหลักฐาน
          </Button>
          <Button variant="primary" size="lg" className="w-full" onClick={resetAll}>
            เปิดใบงานใหม่
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-page">
      {(loading || processingPhoto) && <LoadingOverlay message={loading ? 'กำลังบันทึกใบแจ้งงาน...' : 'กำลังประมวลผลรูปภาพ...'} />}

      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">แจ้งงาน / เบิกพัสดุ</h2>
          <p className="plain-subtitle">Desktop job-request workspace สำหรับค้นหาลูกค้า, จัดของนำส่ง/เก็บกลับ, และตรวจบริบทก่อนเปิดใบงานจากจอเดียว</p>
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
        <div className="plain-kpi"><div className="plain-kpi-label">รายการนำส่ง</div><div className="plain-kpi-value">{cart.length.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">รายการเก็บกลับ</div><div className="plain-kpi-value">{returnCart.length.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">จำนวนรวม</div><div className="plain-kpi-value">{(totalDeliveryQty + totalReturnQty).toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">ลูกค้า / CV</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{matchedCustomer?.name || cv || '-'}</div></div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--receive-workspace">
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserRound size={15} /> ค้นหาและยืนยันลูกค้า
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={cv}
                    onChange={(e) => setCv(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="ระบุชื่อ หรือ เลข CV..."
                    style={{ width: '100%', height: 44, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 40px 0 12px', fontWeight: 700 }}
                  />
                  <Search size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
                <button className="plain-logout" style={{ width: 110 }} onClick={handleSearch} disabled={isSearching}>ค้นหา</button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {searchResults.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => { setCv(String(c.cv || '')); setSearchResults([]); setError(null); }}
                      style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}
                    >
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div className="plain-subtitle">CV: {c.cv} • {c.province || '-'}</div>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ border: '1px solid #e0e7ff', borderRadius: 10, background: '#eef2ff', padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{matchedCustomer?.name || 'ยังไม่ได้เลือกลูกค้า'}</div>
                    <div className="plain-subtitle">CV: {matchedCustomer?.cv || cv || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="plain-icon-btn" onClick={() => setIsCustomerModalOpen(true)} title="แก้ข้อมูลลูกค้า">
                      <Icon name="edit" size="sm" />
                    </button>
                    <button
                      className="plain-icon-btn"
                      onClick={() => {
                        const query = matchedCustomer?.lat && matchedCustomer?.lng
                          ? `${matchedCustomer.lat},${matchedCustomer.lng}`
                          : matchedCustomer?.address || matchedCustomer?.cv || cv;
                        if (query) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                      }}
                      title="เปิดแผนที่"
                    >
                      <MapPinned size={16} />
                    </button>
                  </div>
                </div>
                <div><strong>โทร:</strong> {matchedCustomer?.phone || '-'}</div>
                <div><strong>ที่อยู่:</strong> {[matchedCustomer?.address, matchedCustomer?.subdistrict, matchedCustomer?.district, matchedCustomer?.province, matchedCustomer?.zipcode].filter(Boolean).join(' ') || '-'}</div>
              </div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Warehouse size={15} /> คลังต้นทางและนัดหมาย
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 160px', gap: 10, alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="plain-subtitle" style={{ marginTop: 0 }}>คลังพัสดุต้นทาง</span>
                <select value={warehouseId} onChange={(e) => setWarehouseId(parseInt(e.target.value, 10))} style={{ height: 42, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }}>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="plain-subtitle" style={{ marginTop: 0 }}>วันที่นัดหมาย</span>
                <input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} style={{ height: 42, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="plain-subtitle" style={{ marginTop: 0 }}>เวลา</span>
                <input type="text" maxLength={5} value={appointmentTime} onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9:]/g, '');
                  if (val.length === 2 && !val.includes(':')) val += ':';
                  setAppointmentTime(val);
                }} placeholder="14:30" style={{ height: 42, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700, textAlign: 'center' }} />
              </label>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={15} /> พัสดุที่ต้องนำส่ง ({cart.length})
            </div>
            <div className="desktop-panel-body plain-scope" style={{ display: 'grid', gap: 12, paddingTop: 0 }}>
              <Suspense fallback={<div className="desktop-empty">กำลังโหลดตัวเลือกพัสดุนำส่ง...</div>}>
                <JobRequestItemSelector
                  key={`job-delivery-${resetKey}`}
                  items={items}
                  cart={cart}
                  tempSubItems={tempSubItems}
                  action="issue"
                  onAddToCart={handleAddToCart}
                  onAddSubItem={(it, qt, ty) => handleAddSubItem(it, qt, ty, false)}
                  onRemoveSubItem={(idx) => setTempSubItems((prev) => prev.filter((_, i) => i !== idx))}
                  onUpdateSubItemQty={(idx, delta) => updateTempSubItemQty(idx, delta, false)}
                  setError={setError}
                  error={error}
                  warehouseId={warehouseId}
                />
              </Suspense>
              <div style={{ display: 'grid', gap: 8 }}>
                {cart.length === 0 && <div className="desktop-empty" style={{ padding: 0 }}>ยังไม่มีรายการนำส่ง</div>}
                {cart.map((c) => (
                  <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{c.item?.ประเภท || 'พัสดุ'} {c.item?.รายการ || ''}</div>
                        <div className="plain-subtitle">ยี่ห้อ: {c.item?.ยี่ห้อหรือรูปแบบ || '-'} • ขนาด: {c.item?.ขนาด || '-'} {c.serialNumber ? `• SN: ${c.serialNumber}` : ''}</div>
                      </div>
                      <button className="plain-logout" style={{ width: 40 }} onClick={() => removeFromCart(c.id)}><Icon name="delete" size="sm" /></button>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="plain-badge">x{c.quantity}</span>
                      {!!c.subItems?.length && <span className="plain-subtitle">มี sub-items {c.subItems.length} รายการ</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Undo2 size={15} /> พัสดุที่ต้องเก็บกลับ ({returnCart.length})
            </div>
            <div className="desktop-panel-body plain-scope" style={{ display: 'grid', gap: 12, paddingTop: 0 }}>
              <Suspense fallback={<div className="desktop-empty">กำลังโหลดตัวเลือกพัสดุเก็บกลับ...</div>}>
                <JobRequestItemSelector
                  key={`job-return-${resetKey}`}
                  items={items}
                  cart={returnCart}
                  tempSubItems={tempReturnSubItems}
                  action="return"
                  onAddToCart={handleAddToReturnCart}
                  onAddSubItem={(it, qt, ty) => handleAddSubItem(it, qt, ty, true)}
                  onRemoveSubItem={(idx) => setTempReturnSubItems((prev) => prev.filter((_, i) => i !== idx))}
                  onUpdateSubItemQty={(idx, delta) => updateTempSubItemQty(idx, delta, true)}
                  setError={setError}
                  error={error}
                  warehouseId={warehouseId}
                />
              </Suspense>
              <div style={{ display: 'grid', gap: 10 }}>
                {returnCart.length === 0 && <div className="desktop-empty" style={{ padding: 0 }}>ยังไม่มีรายการเก็บกลับ</div>}
                {returnCart.map((c, idx) => {
                  const category = (c.item?.ประเภท || '').trim();
                  const isTrackedUnit = category === 'ตู้แช่' || (category.includes('ตู้') && !category.includes('อุปกรณ์') && !category.includes('อะไหล่'));
                  return (
                    <div key={c.id} style={{ border: '1px solid #fecdd3', borderRadius: 10, padding: 12, background: '#fff1f2', display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="plain-badge">UNIT {idx + 1}</span>
                            <strong>{c.item?.ประเภท || 'พัสดุ'} {c.item?.รายการ || ''}</strong>
                          </div>
                          <div className="plain-subtitle">ยี่ห้อ: {c.item?.ยี่ห้อหรือรูปแบบ || '-'} • ขนาด: {c.item?.ขนาด || '-'} • จำนวน x{c.quantity}</div>
                        </div>
                        <button className="plain-logout" style={{ width: 40 }} onClick={() => removeFromReturnCart(c.id)}><Icon name="delete" size="sm" /></button>
                      </div>

                      {isTrackedUnit && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 46px', gap: 8, alignItems: 'end' }}>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="plain-subtitle" style={{ marginTop: 0 }}>Serial Number (S/N)</span>
                            <input type="text" value={c.serialNumber || ''} onChange={(e) => setReturnCart((prev) => prev.map((it) => it.id === c.id ? { ...it, serialNumber: e.target.value } : it))} placeholder="ระบุ S/N (ถ้ามี)..." style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                          </label>
                          <label style={{ display: 'grid', gap: 6 }}>
                            <span className="plain-subtitle" style={{ marginTop: 0 }}>Asset Tag</span>
                            <input type="text" value={c.assetTag || ''} onChange={(e) => setReturnCart((prev) => prev.map((it) => it.id === c.id ? { ...it, assetTag: e.target.value } : it))} placeholder="ระบุ Asset Tag (ถ้ามี)..." style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }} />
                          </label>
                          <button className="plain-icon-btn" onClick={() => { setActiveScanTarget({ id: c.id, index: 0 }); setIsScannerOpen(true); }} title="สแกนบาร์โค้ด">
                            <Icon name="barcode_scanner" size="sm" />
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <select value={c.returnReason || ''} onChange={(e) => setReturnCart((prev) => prev.map((it) => it.id === c.id ? { ...it, returnReason: e.target.value } : it))} style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }}>
                          <option value="">-- ระบุสาเหตุที่เก็บกลับ --</option>
                          {RETURN_REASONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                          {RETURN_STATUSES.map((opt) => (
                            <button key={opt} onClick={() => setReturnCart((prev) => prev.map((it) => it.id === c.id ? { ...it, status: opt } : it))} style={{ height: 36, borderRadius: 10, border: c.status === opt ? '1px solid #0f172a' : '1px solid #e2e8f0', background: c.status === opt ? '#0f172a' : '#fff', color: c.status === opt ? '#fff' : '#475569', fontWeight: 700, fontSize: 12 }}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="desktop-receive-panel-stack">
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={15} /> บริบทใบงาน
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              <div><strong>ลูกค้า:</strong> {matchedCustomer?.name || '-'}</div>
              <div><strong>CV:</strong> {cv || '-'}</div>
              <div><strong>คลังต้นทาง:</strong> {selectedWarehouse?.name || '-'}</div>
              <div><strong>นัดหมาย:</strong> {appointmentDate ? formatThaiDateTime(`${appointmentDate}T${appointmentTime}`) : '-'}</div>
              <div><strong>ผู้เปิดใบงาน:</strong> {operatorName}</div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarClock size={15} /> ข้อมูลประกอบใบงาน
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="plain-subtitle" style={{ marginTop: 0 }}>สาเหตุที่เก็บกลับ (แบบภาพรวม)</span>
                <select value={returnReason} onChange={(e) => {
                  const val = e.target.value;
                  setReturnReason(val);
                  if (val) setReturnCart((prev) => prev.map((item) => ({ ...item, returnReason: val })));
                }} style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontWeight: 700 }}>
                  <option value="">-- ระบุสาเหตุที่เก็บกลับ (เปลี่ยนทุกชิ้น) --</option>
                  {RETURN_REASONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="plain-subtitle" style={{ marginTop: 0 }}>หมายเหตุ</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ระบุรายละเอียดเพิ่มเติม..." style={{ minHeight: 120, border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, fontWeight: 700, resize: 'vertical' }} />
              </label>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={15} /> แนบรูปภาพเพิ่มเติม ({photos.length}/6)
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="plain-subtitle" style={{ marginTop: 0 }}>แนบรูปได้สูงสุด 6 รูป พร้อม watermark เวลา/พิกัด</span>
                {photos.length < 6 && (
                  <label className="plain-logout" style={{ width: 120, cursor: 'pointer', textAlign: 'center' }}>
                    เพิ่มรูป
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <img src={p} alt="job request" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} className="plain-icon-btn" style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28 }}>
                      <Icon name="close" size="xs" />
                    </button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <label style={{ aspectRatio: '1 / 1', borderRadius: 10, border: '2px dashed #cbd5e1', display: 'grid', placeItems: 'center', cursor: 'pointer', background: '#f8fafc', color: '#64748b', fontWeight: 700 }}>
                    + เพิ่มรูป
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header">ตรวจสอบก่อนบันทึก</div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              <div>• ลูกค้าในระบบ: <strong>{matchedCustomer ? 'พร้อม' : 'ยังไม่ครบ'}</strong></div>
              <div>• พัสดุนำส่ง: <strong>{cart.length > 0 ? `${cart.length} รายการ` : 'ไม่มี'}</strong></div>
              <div>• พัสดุเก็บกลับ: <strong>{returnCart.length > 0 ? `${returnCart.length} รายการ` : 'ไม่มี'}</strong></div>
              <div>• รูปภาพแนบ: <strong>{photos.length} รูป</strong></div>
              <Button variant="primary" size="lg" className="w-full" onClick={handleSubmit}>
                บันทึกแจ้งงาน
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <CustomerQuickEdit
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          customer={customers.find((c) => String(c.cv || c.CV || '') === cv) || { cv, name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' }}
          onSave={async () => {
            const d = await getCustomers();
            setCustomers(d);
          }}
          thaiAddressData={thaiAddressData}
          customers={customers}
        />
      </Suspense>

      <Suspense fallback={null}>
        {isScannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} isOpen={isScannerOpen} />}
      </Suspense>
    </div>
  );
}
