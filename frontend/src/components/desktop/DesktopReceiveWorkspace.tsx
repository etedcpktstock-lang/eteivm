import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { PackagePlus, ClipboardList, Building2, UserRound, Camera, RefreshCw } from 'lucide-react';
import { getCustomers, getZones, processBatchTransaction, getNextTxnNo } from '../../api';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import type { MaterialItem } from '../../types';
import { Button, Icon, LoadingOverlay } from '../shared/CommonUI';

const ItemSelector = lazy(() => import('../mobile/ItemSelector'));
const LogisticsSummary = lazy(() => import('../mobile/LogisticsSummary'));
const CustomerQuickEdit = lazy(() => import('../shared/CustomerQuickEdit'));

const isValidCartItem = (c: any): boolean =>
  c && c.item && typeof c.item === 'object' && !Array.isArray(c.item) && typeof c.item.ประเภท !== 'undefined';

interface DesktopReceiveWorkspaceProps {
  items: MaterialItem[];
  onSuccess: () => void;
  operatorName: string;
  transactions?: any[];
  thaiAddressData?: any[];
  warehouses?: any[];
}

export default function DesktopReceiveWorkspace({
  items,
  onSuccess,
  operatorName,
  transactions = [],
  thaiAddressData = [],
  warehouses = [],
}: DesktopReceiveWorkspaceProps) {
  const action = 'receive';
  const CART_KEY = `ete-cart-${operatorName}-receive`;
  const LOGISTICS_KEY = `ete-logistics-${operatorName}-receive`;
  const TS_KEY = `ete-ts-${operatorName}-receive`;

  const [step, setStep] = useState<'form' | 'success'>(() => {
    const saved = localStorage.getItem(`${LOGISTICS_KEY}-step`) as any;
    const savedCart = localStorage.getItem(CART_KEY);
    const hasCart = savedCart && savedCart !== '[]';
    if (saved === 'success' && !hasCart) return 'form';
    return saved || 'form';
  });

  const updateStep = (newStep: 'form' | 'success') => {
    setStep(newStep);
    localStorage.setItem(`${LOGISTICS_KEY}-step`, newStep);
  };

  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem(CART_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(isValidCartItem) : [];
    } catch {
      return [];
    }
  });

  const now = new Date();
  const defaultDate = now.toLocaleDateString('en-CA');
  const defaultTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

  const [cv, setCv] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-cv`) || '');
  const [deliveryBy, setDeliveryBy] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryBy`) || '');
  const [deliveryDate, setDeliveryDate] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryDate`) || defaultDate);
  const [deliveryTime, setDeliveryTime] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-deliveryTime`) || defaultTime);
  const [workZone, setWorkZone] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-workzone`) || '');
  const [note, setNote] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-note`) || '');
  const [savedTxnNo, setSavedTxnNo] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-saved-txn`) || '');

  const [notifier, setNotifier] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-notifier`) || '');
  const [notificationDate, setNotificationDate] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-notif-date`) || '');
  const [returnReason, setReturnReason] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-reason`) || '');
  const [cabinetCondition, setCabinetCondition] = useState(() => localStorage.getItem(`${LOGISTICS_KEY}-condition`) || '');
  const [warehouseId, setWarehouseId] = useState<number>(() => {
    const saved = localStorage.getItem(`${LOGISTICS_KEY}-warehouseId`);
    return saved ? parseInt(saved) : (warehouses[0]?.id || 1);
  });

  useEffect(() => {
    localStorage.setItem(`${LOGISTICS_KEY}-warehouseId`, warehouseId.toString());
  }, [warehouseId]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(Date.now());
  const [tempSubItems, setTempSubItems] = useState<any[]>([]);

  useEffect(() => {
    if (step === 'success') return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    localStorage.setItem(TS_KEY, Date.now().toString());
  }, [cart, step]);

  useEffect(() => {
    if (step === 'success') {
      [
        CART_KEY,
        TS_KEY,
        `${LOGISTICS_KEY}-cv`,
        `${LOGISTICS_KEY}-deliveryBy`,
        `${LOGISTICS_KEY}-deliveryDate`,
        `${LOGISTICS_KEY}-deliveryTime`,
        `${LOGISTICS_KEY}-workzone`,
        `${LOGISTICS_KEY}-note`,
        `${LOGISTICS_KEY}-notifier`,
        `${LOGISTICS_KEY}-notif-date`,
        `${LOGISTICS_KEY}-reason`,
        `${LOGISTICS_KEY}-condition`,
        `${LOGISTICS_KEY}-saved-txn`,
        `${LOGISTICS_KEY}-step`,
      ].forEach((k) => localStorage.removeItem(k));
      return;
    }

    const data: Record<string, string> = {
      [`${LOGISTICS_KEY}-cv`]: cv,
      [`${LOGISTICS_KEY}-deliveryBy`]: deliveryBy,
      [`${LOGISTICS_KEY}-deliveryDate`]: deliveryDate,
      [`${LOGISTICS_KEY}-deliveryTime`]: deliveryTime,
      [`${LOGISTICS_KEY}-workzone`]: workZone,
      [`${LOGISTICS_KEY}-note`]: note,
      [`${LOGISTICS_KEY}-notifier`]: notifier,
      [`${LOGISTICS_KEY}-notif-date`]: notificationDate,
      [`${LOGISTICS_KEY}-reason`]: returnReason,
      [`${LOGISTICS_KEY}-condition`]: cabinetCondition,
      [`${LOGISTICS_KEY}-saved-txn`]: savedTxnNo,
    };
    Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
  }, [
    cv,
    deliveryBy,
    deliveryDate,
    deliveryTime,
    workZone,
    note,
    notifier,
    notificationDate,
    returnReason,
    cabinetCondition,
    savedTxnNo,
    step,
    CART_KEY,
    TS_KEY,
  ]);

  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error);
    getZones().then(setZones).catch(console.error);
  }, []);

  const handleAddToCart = useCallback((item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => {
    setCart((prev) => {
      if (!serialNumber) {
        const existingIdx = prev.findIndex((c) => c.item.rowIndex === item.rowIndex && c.displayString === displayString && !c.serialNumber);
        if (existingIdx !== -1) {
          return prev.map((c, idx) => (idx === existingIdx ? { ...c, quantity: c.quantity + quantity } : c));
        }
      }
      return [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          item,
          quantity,
          displayString,
          action,
          serialNumber,
          subItems: tempSubItems.length > 0 ? [...tempSubItems] : undefined,
        },
      ];
    });
    setTempSubItems([]);
  }, [tempSubItems]);

  const handleAddSubItem = useCallback((item: MaterialItem, quantity: number, type: 'accessory' | 'sticker') => {
    const display = [item.ยี่ห้อหรือรูปแบบ, item.สภาพ, item.ขนาด, item.รายการ, item.รายละเอียด].filter((v) => v !== '-').join(' ');
    setTempSubItems((prev) => [...prev, { item, quantity, displayString: display, type }]);
  }, []);

  const handleRemoveSubItem = (idx: number) => setTempSubItems((prev) => prev.filter((_, i) => i !== idx));
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.id !== id));

  const resetAll = () => {
    setCart([]);
    setNote('');
    updateStep('form');
    setCv('');
    setDeliveryBy('');
    setDeliveryDate('');
    setDeliveryTime('00:00');
    setWorkZone('');
    setNotifier('');
    setNotificationDate('');
    setReturnReason('');
    setCabinetCondition('');
    setSavedTxnNo('');

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes(LOGISTICS_KEY) || k.includes(CART_KEY))) {
        localStorage.removeItem(k);
        i--;
      }
    }
    setResetKey(Date.now());
  };

  const handleFinalSubmit = async () => {
    if (cart.length === 0) {
      setError('ไม่พบรายการในตะกร้า');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const txnNo = await getNextTxnNo();
      setSavedTxnNo(txnNo);

      const batchItems = cart.filter((c) => c && c.item).flatMap((c) => [
        {
          item: c.item,
          quantity: c.quantity,
          isSub: false,
          subType: '',
          serialNumber: c.serialNumber,
          assetTag: c.assetTag || c.asset_tag || c.serialNumber || '',
        },
        ...((c.subItems || []).map((s: any) => ({ item: s.item, quantity: s.quantity, isSub: true, subType: s.type }))),
      ]);

      await processBatchTransaction({
        action,
        items: batchItems,
        cv,
        deliveryBy,
        deliveryDate: deliveryDate ? `${deliveryDate}T${deliveryTime}` : '',
        txnNo,
        operator: operatorName,
        note,
        workZone,
        notifier,
        notificationDate,
        returnReason,
        cabinetCondition,
      });

      onSuccess();
      updateStep('success');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const captureScreenshot = async () => {
    const element = document.getElementById('receive-receipt');
    if (!element) return;
    try {
      document.body.style.cursor = 'wait';
      const html2canvas = (await import('html2canvas')).default;
      element.scrollIntoView({ behavior: 'auto', block: 'start' });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('receive-receipt');
          if (clonedEl) {
            clonedEl.style.width = '760px';
            clonedEl.style.height = 'auto';
            clonedEl.style.animation = 'none';
            clonedEl.style.transition = 'none';
            clonedEl.querySelectorAll('*').forEach((subEl: any) => {
              subEl.style.animation = 'none';
              subEl.style.transition = 'none';
              subEl.style.opacity = '1';
            });
          }
        },
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = image;
      link.download = `ETE-RECEIVE-${savedTxnNo || Date.now()}.png`;
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

  const matchedCustomer = useMemo(() => customers.find((c) => String(c.cv || c.CV || '') === String(cv)), [customers, cv]);
  const selectedWarehouse = useMemo(() => warehouses.find((w: any) => Number(w.id) === Number(warehouseId)), [warehouses, warehouseId]);
  const totalQty = useMemo(() => cart.reduce((sum, c) => sum + Number(c.quantity || 0), 0), [cart]);

  if (step === 'success') {
    return (
      <div className="desktop-page">
        <div id="receive-receipt" className="plain-card" style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ background: '#059669', color: '#fff', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check_circle" size="md" className="text-white" />
            </div>
            <h2 className="plain-page-title" style={{ color: '#fff' }}>บันทึกรับเข้าพัสดุสำเร็จ</h2>
            <p style={{ marginTop: 6, color: 'rgba(255,255,255,0.85)' }}>เลขที่รายการ: {savedTxnNo || 'TXN-NEW'}</p>
          </div>

          <div className="desktop-panel-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div className="plain-kpi" style={{ padding: 12 }}>
                <div className="plain-kpi-label">ผู้ทำรายการ</div>
                <div style={{ fontWeight: 700 }}>{operatorName}</div>
              </div>
              <div className="plain-kpi" style={{ padding: 12 }}>
                <div className="plain-kpi-label">วันที่ / เวลา</div>
                <div style={{ fontWeight: 700 }}>{formatThaiDateTime(new Date())}</div>
              </div>
              <div className="plain-kpi" style={{ padding: 12 }}>
                <div className="plain-kpi-label">คลังปลายทาง</div>
                <div style={{ fontWeight: 700 }}>{selectedWarehouse?.name || '-'}</div>
              </div>
            </div>

            <div className="plain-card" style={{ marginTop: 0 }}>
              <div className="plain-card-header">รายการพัสดุที่รับเข้า</div>
              <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
                {cart.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>{c.item?.ประเภท || 'พัสดุ'}</div>
                      <div style={{ fontWeight: 700 }}>
                        {[c.item?.ยี่ห้อหรือรูปแบบ, c.item?.สภาพ, c.item?.ขนาด, c.item?.รายการ, c.item?.รายละเอียด]
                          .filter((v) => v && v !== '-')
                          .join(' ') || c.displayString || '-'}
                      </div>
                    </div>
                    <div className="plain-badge">x{c.quantity}</div>
                  </div>
                ))}
              </div>
            </div>

            {note && (
              <div className="plain-card" style={{ marginTop: 0 }}>
                <div className="plain-card-header">หมายเหตุ</div>
                <div className="desktop-panel-body">{note}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 880, margin: '12px auto 0', display: 'grid', gap: 10 }}>
          <Button variant="secondary" size="lg" className="w-full" onClick={captureScreenshot} leftIcon="screenshot_region">
            Cap หน้าจอเก็บหลักฐาน
          </Button>
          <Button variant="primary" size="lg" className="w-full" onClick={resetAll}>
            ทำรายการต่อ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-page">
      {loading && <LoadingOverlay message="กำลังบันทึกรายการรับเข้าคลัง..." />}

      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">รับพัสดุเข้าคลัง</h2>
          <p className="plain-subtitle">Desktop receive workspace สำหรับคุมการรับเข้า, ตรวจ draft, และบันทึกรายการจากจอเดียว</p>
        </div>
        <div className="plain-topbar-actions">
          <button className="plain-logout" style={{ width: 120 }} onClick={resetAll}>
            <RefreshCw size={14} style={{ marginRight: 6 }} /> ล้าง draft
          </button>
        </div>
      </div>

      <div className="desktop-stat-grid">
        <div className="plain-kpi"><div className="plain-kpi-label">รายการในตะกร้า</div><div className="plain-kpi-value">{cart.length.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">จำนวนรวม</div><div className="plain-kpi-value">{totalQty.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">คลังปลายทาง</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{selectedWarehouse?.name || '-'}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">ลูกค้า / CV</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{matchedCustomer?.name || cv || '-'}</div></div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--receive-workspace">
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackagePlus size={15} /> เลือกรายการพัสดุ
            </div>
            <div className="desktop-panel-body plain-scope" style={{ paddingTop: 0 }}>
              <Suspense fallback={<div className="desktop-empty">กำลังโหลดรายการสินค้า...</div>}>
                <ItemSelector
                  key={`receive-picker-${resetKey}`}
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
        </div>

        <div className="desktop-receive-panel-stack">
          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={15} /> ร่างรายการรับเข้า ({cart.length})
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              {cart.length === 0 && <div className="desktop-empty" style={{ padding: 0 }}>ยังไม่มีรายการในตะกร้า</div>}
              {cart.map((c) => (
                <div key={c.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{c.item?.ประเภท} {c.displayString}</div>
                      <div className="plain-subtitle">ยี่ห้อ: {c.item?.ยี่ห้อหรือรูปแบบ || '-'} • ขนาด: {c.item?.ขนาด || '-'} {c.serialNumber ? `• SN: ${c.serialNumber}` : ''}</div>
                    </div>
                    <button className="plain-logout" style={{ width: 40 }} onClick={() => removeFromCart(c.id)}>
                      <Icon name="delete" size="sm" />
                    </button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="plain-badge">x{c.quantity}</span>
                    {!!c.subItems?.length && <span className="plain-subtitle">มี sub-items {c.subItems.length} รายการ</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={15} /> บริบทการรับเข้า
            </div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 8 }}>
              <div><strong>คลัง:</strong> {selectedWarehouse?.name || '-'}</div>
              <div><strong>ผู้นำส่ง / รับโดย:</strong> {deliveryBy || '-'}</div>
              <div><strong>กำหนดวันที่:</strong> {deliveryDate ? formatThaiDateTime(`${deliveryDate}T${deliveryTime}`) : '-'}</div>
              <div><strong>เขตงาน:</strong> {workZone || '-'}</div>
              <div><strong>CV:</strong> {cv || '-'}</div>
              <div><strong>ลูกค้า:</strong> {matchedCustomer?.name || '-'}</div>
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
                  action="receive"
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
                  onSuccess={onSuccess}
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
                  customSubmit={handleFinalSubmit}
                  customSubmitText="บันทึกรับเข้าคลังทั้งหมด"
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
          customer={customers.find((c) => String(c.cv || c.CV || '') === cv) || { cv, name: '', phone: '', address: '', subdistrict: '', district: '', province: '', zipcode: '', lat: '', lng: '' }}
          onSave={async () => {
            const d = await getCustomers();
            setCustomers(d);
          }}
          thaiAddressData={thaiAddressData}
          customers={customers}
        />
      </Suspense>
    </div>
  );
}
