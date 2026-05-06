import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, Save, CheckCircle2, X, Camera } from 'lucide-react';
import { processBatchTransaction, getNextTxnNo } from '../../api';

interface WorkstationProps {
  mode: 'receive' | 'issue' | 'return';
  items: any[];
  operatorName: string;
  onSuccess: () => void;
  transactions?: any[];
  customers: any[];
  warehouses?: any[];
}

const DesktopTransactionWorkstation: React.FC<WorkstationProps> = ({
  mode,
  items,
  operatorName,
  onSuccess,
  customers,
  warehouses = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTxn, setSuccessTxn] = useState<string | null>(null);

  const [cv, setCv] = useState('');
  const [deliveryBy, setDeliveryBy] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryTime, setDeliveryTime] = useState(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [note, setNote] = useState('');
  const [workZone, setWorkZone] = useState('');
  const [warehouseId, setWarehouseId] = useState<number>(Number(warehouses?.[0]?.id || 1));
  const [notifier, setNotifier] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [cabinetCondition, setCabinetCondition] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const REASON_OPTIONS = [
    'อะไหล่ผิดสเปค / ผิดรุ่น',
    'จบโครงการ / ปิดไซด์งาน',
    'วัสดุชำรุดจากการขนส่ง',
    'วัสดุชำรุดจากการใช้งาน',
    'ยกเลิกการสั่งซื้อ',
    'อื่นๆ (ระบุ)'
  ];

  const selectedCustomer = useMemo(
    () => customers.find(c => String(c.cv || c.CV || '') === cv),
    [customers, cv]
  );

  const getWarehouseReadyQty = (item: any) => {
    return Number(item?.available_stock ?? 0);
  };

  const filteredItems = useMemo(() => {
    const baseItems = !searchTerm
      ? items.slice(0, 80)
      : items.filter(it =>
          `${it.ประเภท || ''} ${it.รายการ || ''} ${it['ยี่ห้อหรือรูปแบบ'] || ''} ${it.ขนาด || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
        );

    return baseItems.map(item => ({
      ...item,
      จำนวน: getWarehouseReadyQty(item)
    }));
  }, [items, searchTerm, warehouseId, mode]);

  const modeLabel =
    mode === 'receive' ? 'รับพัสดุเข้าคลัง' : mode === 'issue' ? 'เบิกพัสดุออกหน้างาน' : 'รับคืนพัสดุ';

  useEffect(() => {
    if (!warehouses?.length) return;
    const hasCurrent = warehouses.some((w: any) => Number(w.id) === Number(warehouseId));
    if (!hasCurrent) setWarehouseId(Number(warehouses[0].id));
  }, [warehouses, warehouseId]);

  const addToCart = (item: any) => {
    const availableQty = getWarehouseReadyQty(item);
    if (mode === 'issue' && availableQty <= 0) {
      setError(`รายการ ${item.รายการ || '-'} ไม่มีสต็อกพร้อมใช้ในคลังที่เลือก`);
      return;
    }

    setCart(prev => {
      const id = item.rowIndex ?? item.id;
      const existing = prev.find(c => (c.rowIndex ?? c.id) === id);
      if (existing) {
        if (mode === 'issue' && existing.qty >= availableQty) return prev;
        return prev.map(c => ((c.rowIndex ?? c.id) === id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: any) => setCart(prev => prev.filter(c => (c.rowIndex ?? c.id) !== id));

  const updateQty = (id: any, delta: number) => {
    setCart(prev =>
      prev.map(c => {
        if ((c.rowIndex ?? c.id) !== id) return c;
        const nextQty = Math.max(1, c.qty + delta);
        if (mode === 'issue') {
          const maxQty = getWarehouseReadyQty(c);
          return { ...c, qty: Math.min(nextQty, Math.max(1, maxQty)) };
        }
        return { ...c, qty: nextQty };
      })
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string].slice(0, 6));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return setError('กรุณาเลือกรายการพัสดุ');
    if (!cv && mode !== 'receive') return setError('กรุณาระบุรหัสลูกค้า (CV)');
    if (mode === 'return' && (!notifier || !returnReason)) return setError('กรุณาระบุข้อมูลการคืนให้ครบ');

    setLoading(true);
    setError(null);
    try {
      const txnNo = await getNextTxnNo();
      const batchItems = cart.map(c => ({ item: c, quantity: c.qty, isSub: false, subType: '' }));

      await processBatchTransaction({
        action: mode,
        items: batchItems,
        cv,
        deliveryBy,
        deliveryDate: `${deliveryDate}T${deliveryTime}`,
        txnNo,
        operator: operatorName,
        note,
        workZone,
        notifier,
        notificationDate: new Date().toLocaleDateString('th-TH'),
        returnReason: returnReason === 'อื่นๆ (ระบุ)' ? customReason : returnReason,
        cabinetCondition,
        photos,
        warehouseId
      });

      setSuccessTxn(txnNo);
      setCart([]);
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'บันทึกรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (successTxn) {
    return (
      <div className="plain-card" style={{ padding: 24, textAlign: 'center' }}>
        <CheckCircle2 size={54} color="#06c167" style={{ margin: '0 auto' }} />
        <h2 className="plain-page-title" style={{ marginTop: 8 }}>ทำรายการสำเร็จ</h2>
        <p className="plain-subtitle">เลขที่รายการ: {successTxn}</p>
        <button className="plain-logout" style={{ width: 180, marginTop: 12 }} onClick={() => setSuccessTxn(null)}>ทำรายการต่อ</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 12 }}>
      <div className="plain-card">
        <div className="plain-card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <strong>{modeLabel}</strong>
            <div className="plain-subtitle">
              {mode === 'issue' ? 'เลือกพัสดุและเพิ่มลงตะกร้าโดยอิงสต็อกพร้อมใช้ของคลังที่เลือก' : 'เลือกพัสดุและเพิ่มลงตะกร้า'}
            </div>
          </div>
          <div style={{ position: 'relative', minWidth: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
            <input className="plain-search" style={{ width: '100%' }} placeholder="ค้นหาพัสดุ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div style={{ maxHeight: '68vh', overflow: 'auto' }}>
          <table className="plain-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>คงเหลือ</th>
                <th>เพิ่ม</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.รายการ}</div>
                    <div style={{ color: '#6b7280', fontSize: 11 }}>{item.ประเภท} • {item['ยี่ห้อหรือรูปแบบ'] || '-'}</div>
                    {mode === 'issue' && (
                      <div style={{ color: '#6b7280', fontSize: 11 }}>พร้อมใช้ในคลังที่เลือก: {Number(item.จำนวน || 0).toLocaleString()}</div>
                    )}
                  </td>
                  <td>{Number(item.จำนวน || 0).toLocaleString()}</td>
                  <td>
                    <button className="plain-logout" style={{ width: 36, opacity: mode === 'issue' && Number(item.จำนวน || 0) <= 0 ? 0.5 : 1 }} onClick={() => addToCart(item)} disabled={mode === 'issue' && Number(item.จำนวน || 0) <= 0}><Plus size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="plain-card">
        <div className="plain-card-header">ตะกร้ารายการ ({cart.length})</div>
        <div style={{ padding: 12, display: 'grid', gap: 8 }}>
          <input className="plain-search" placeholder="CV ลูกค้า" value={cv} onChange={e => setCv(e.target.value)} />
          {warehouses.length > 0 && (
            <>
              <select className="plain-search" value={warehouseId} onChange={e => setWarehouseId(Number(e.target.value))}>
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              {mode === 'issue' && <div className="plain-subtitle">จำนวนที่แสดงจะอิงสต็อกพร้อมใช้ของคลังที่เลือก</div>}
            </>
          )}
          {selectedCustomer && <div className="plain-subtitle">ลูกค้า: {selectedCustomer.name || selectedCustomer.shop_name || '-'}</div>}
          <input className="plain-search" placeholder="ผู้จัดส่ง" value={deliveryBy} onChange={e => setDeliveryBy(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input className="plain-search" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            <input className="plain-search" type="time" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} />
          </div>
          <input className="plain-search" placeholder="เขตงาน" value={workZone} onChange={e => setWorkZone(e.target.value)} />

          {mode === 'return' && (
            <>
              <input className="plain-search" placeholder="ผู้แจ้งคืน" value={notifier} onChange={e => setNotifier(e.target.value)} />
              <select className="plain-search" value={returnReason} onChange={e => setReturnReason(e.target.value)}>
                <option value="">เลือกสาเหตุการคืน</option>
                {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {returnReason === 'อื่นๆ (ระบุ)' && (
                <input className="plain-search" placeholder="ระบุเหตุผล" value={customReason} onChange={e => setCustomReason(e.target.value)} />
              )}
              <input className="plain-search" placeholder="สภาพตู้" value={cabinetCondition} onChange={e => setCabinetCondition(e.target.value)} />
              <label className="plain-logout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <Camera size={14} /> เพิ่มรูป
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
              {photos.length > 0 && <div className="plain-subtitle">แนบรูปแล้ว {photos.length} รูป</div>}
            </>
          )}

          <textarea className="plain-search" style={{ height: 80, paddingTop: 8 }} placeholder="หมายเหตุ" value={note} onChange={e => setNote(e.target.value)} />

          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            {cart.map(c => {
              const id = c.rowIndex ?? c.id;
              return (
                <div key={id} style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.รายการ}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="plain-logout" style={{ width: 32 }} onClick={() => updateQty(id, -1)}><Minus size={12} /></button>
                    <div className="plain-logout" style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.qty}</div>
                    <button className="plain-logout" style={{ width: 32 }} onClick={() => updateQty(id, 1)}><Plus size={12} /></button>
                    <button className="plain-logout" style={{ width: 32 }} onClick={() => removeFromCart(id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && <div style={{ padding: 10, color: '#6b7280', fontSize: 12 }}>ยังไม่มีรายการในตะกร้า</div>}
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}

          <button className="plain-logout" style={{ width: '100%', background: '#06c167', color: '#fff', borderColor: '#06c167' }} onClick={handleSubmit} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : <><Save size={14} style={{ marginRight: 6 }} />บันทึกรายการ</>}
          </button>
          <button className="plain-logout" style={{ width: '100%' }} onClick={() => { setCart([]); setError(null); }}>
            <X size={14} style={{ marginRight: 6 }} />ล้างตะกร้า
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesktopTransactionWorkstation;
