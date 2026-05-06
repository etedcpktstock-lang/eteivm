import React, { useState, useMemo, useEffect } from 'react';
import type { MaterialItem } from '../../types';
import { Button, FormSelect } from '../shared/CommonUI';

interface ItemSelectorProps {
 items: MaterialItem[];
 cart: any[];
 tempSubItems: any[];
 action: 'receive' | 'issue' | 'return';
 onAddToCart: (item: MaterialItem, quantity: number, displayString: string, serialNumber?: string) => void;
 onAddSubItem: (item: MaterialItem, quantity: number, type: 'accessory' | 'sticker') => void;
 onRemoveSubItem: (idx: number) => void;
 onUpdateSubItemQty: (idx: number, delta: number) => void;
 setError: (msg: string) => void;
 error: string | null;
 fixedCondition?: string; 
 persistenceKey?: string;
 warehouseId?: number;
 limitStock?: boolean;
}

const JobRequestItemSelector: React.FC<ItemSelectorProps> = ({
 items, cart, tempSubItems, action, onAddToCart, onAddSubItem, onRemoveSubItem: _onRemoveSubItem, onUpdateSubItemQty, setError, error, fixedCondition, persistenceKey, warehouseId, limitStock
}) => {
 const [type, setType] = useState('');
 const [brand, setBrand] = useState('');
 const [itemName, setItemName] = useState('');
 const [condition, setCondition] = useState(fixedCondition || '');
 const [detail, setDetail] = useState('');
 const [size, setSize] = useState('');
 const [quantity, setQuantity] = useState(1);
 const [receiveCondition, setReceiveCondition] = useState<string>(''); 

 const [selectedSubType, setSelectedSubType] = useState<'accessory' | 'sticker' | ''>('');
 const [selectedSubName, setSelectedSubName] = useState('');
 const [selectedSubBrand, setSelectedSubBrand] = useState('');
 const [selectedSubCondition, setSelectedSubCondition] = useState('');
 const [selectedSubSize, setSelectedSubSize] = useState('');
 const [selectedSubDetail, setSelectedSubDetail] = useState('');
 const [selectedSubQty, setSelectedSubQty] = useState(1);

 const virtualItems = useMemo(() => {
 if (action !== 'issue') return items;
 const v = items.map(i => ({ 
 ...i, 
 warehouse_stocks: i.warehouse_stocks ? i.warehouse_stocks.map(ws => ({ ...ws })) : [] 
 }));

 const deduct = (targetRowIndex: number, qty: number) => {
 const item = v.find(vi => vi.rowIndex === targetRowIndex);
 if (item) {
 item.จำนวน -= qty;
 if (warehouseId && item.warehouse_stocks) {
 const ws = item.warehouse_stocks.find(w => w.warehouseId === warehouseId);
 if (ws) ws.stock -= qty;
 }
 }
 };

 cart.forEach(c => {
 if (c.item?.rowIndex !== undefined) deduct(c.item.rowIndex, Number(c.quantity) || 0);
 (c.subItems || []).forEach((s: any) => {
 const targetItem = s.item || s; 
 if (targetItem?.rowIndex !== undefined) deduct(targetItem.rowIndex, Number(s.quantity) || 0);
 });
 });

 tempSubItems.forEach(si => {
 if (si.item?.rowIndex !== undefined) deduct(si.item.rowIndex, Number(si.quantity) || 0);
 });
 return v;
 }, [items, cart, tempSubItems, action, warehouseId]);

 const getItemStock = (item: MaterialItem) => {
   if (warehouseId && (item as any).warehouse_stocks) {
     const ws = (item as any).warehouse_stocks.find((w: any) => w.warehouseId === warehouseId);
     return ws ? Number(ws.stock || 0) : 0;
   }
   return Number((item as any)?.available_stock ?? 0);
 };

 const isSafeItem = (i: any): boolean => !!i && typeof i === 'object' && !Array.isArray(i) && typeof i.ประเภท !== 'undefined';

 const allTypes = useMemo(() => {
 const safe = virtualItems.filter(isSafeItem);
 const uniques = Array.from(new Set(safe.map(i => i.ประเภท || '-').filter(Boolean)));
 return uniques.map(name => {
 const stock = safe.filter(i => (i.ประเภท || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0);
 return { name, stock: isNaN(stock) ? 0 : Math.max(0, stock) };
 });
 }, [virtualItems, warehouseId]);

 const filteredByType = useMemo(() => virtualItems.filter(i => isSafeItem(i) && (i.ประเภท || '-') === (type || '-')), [virtualItems, type]);
 
 const brandOptions = useMemo(() => {
 const uniques = Array.from(new Set(filteredByType.map(i => i.ยี่ห้อหรือรูปแบบ || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, filteredByType.filter(i => (i.ยี่ห้อหรือรูปแบบ || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [filteredByType, warehouseId]);
 
 const filteredByBrand = useMemo(() => filteredByType.filter(i => !brand || (i.ยี่ห้อหรือรูปแบบ || '-') === (brand || '-')), [filteredByType, brand]);

 const itemNameOptions = useMemo(() => {
 const uniques = Array.from(new Set(filteredByBrand.map(i => i.รายการ || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, filteredByBrand.filter(i => (i.รายการ || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [filteredByBrand, warehouseId]);

 const filteredByItemName = useMemo(() => filteredByBrand.filter(i => !itemName || (i.รายการ || '-') === (itemName || '-')), [filteredByBrand, itemName]);

 const ignoreConditionFilter = !!fixedCondition || action === 'receive';

 const conditionOptions = useMemo(() => {
 const uniques = Array.from(new Set(filteredByItemName.map(i => i.สภาพ || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, filteredByItemName.filter(i => (i.สภาพ || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [filteredByItemName, warehouseId]);

 const filteredByCondition = useMemo(() => {
 if (ignoreConditionFilter) return filteredByItemName;
 return filteredByItemName.filter(i => !condition || (i.สภาพ || '-') === (condition || '-'));
 }, [filteredByItemName, condition, ignoreConditionFilter]);

 const sizeOptions = useMemo(() => {
 const uniques = Array.from(new Set(filteredByCondition.map(i => i.ขนาด || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, filteredByCondition.filter(i => (i.ขนาด || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [filteredByCondition, warehouseId]);

 const filteredBySize = useMemo(() => {
 return filteredByCondition.filter(i => !size || (i.ขนาด || '-') === (size || '-'));
 }, [filteredByCondition, size]);

 const detailOptions = useMemo(() => {
 const uniques = Array.from(new Set(filteredBySize.map(i => i.รายละเอียด || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, filteredBySize.filter(i => (i.รายละเอียด || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [filteredBySize, warehouseId]);

 const filteredByDetail = useMemo(() => filteredBySize.filter(i => !detail || (i.รายละเอียด || '-') === (detail || '-')), [filteredBySize, detail]);
 
 const totalStock = useMemo(() => {
 const res = filteredByDetail.filter(isSafeItem).reduce((sum, item) => sum + (getItemStock(item as any)), 0);
 return isNaN(res) ? 0 : Math.max(0, res);
 }, [filteredByDetail, warehouseId]);

 const accOptions = useMemo(() => virtualItems.filter(i => (i.ประเภท || '').includes('อุปกรณ์') || (i.ประเภท || '').includes('อะไหล่') || (i.ประเภท || '').includes('ส่วนประกอบ')), [virtualItems]);
 const stkOptions = useMemo(() => virtualItems.filter(i => (i.ประเภท || '').includes('สติกเกอร์') || (i.ประเภท || '').includes('สติ๊กเกอร์') || (i.ประเภท || '').includes('Sticker')), [virtualItems]);

 const subBaseList = useMemo(() => selectedSubType === 'accessory' ? accOptions : stkOptions, [selectedSubType, accOptions, stkOptions]);

 const subItemNames = useMemo(() => {
 const uniques = Array.from(new Set(subBaseList.map(i => i.รายการ || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, subBaseList.filter(i => (i.รายการ || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [subBaseList, warehouseId]);

 const subFilteredByName = useMemo(() => subBaseList.filter(i => (i.รายการ || '-') === (selectedSubName || '-')), [subBaseList, selectedSubName]);

 const subItemBrands = useMemo(() => {
 const uniques = Array.from(new Set(subFilteredByName.map(i => i.ยี่ห้อหรือรูปแบบ || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, subFilteredByName.filter(i => (i.ยี่ห้อหรือรูปแบบ || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [subFilteredByName, warehouseId]);

 const subFilteredByBrand = useMemo(() => subFilteredByName.filter(i => !selectedSubBrand || (i.ยี่ห้อหรือรูปแบบ || '-') === (selectedSubBrand || '-')), [subFilteredByName, selectedSubBrand]);

 const subItemConditions = useMemo(() => {
 const uniques = Array.from(new Set(subFilteredByBrand.map(i => i.สภาพ || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, subFilteredByBrand.filter(i => (i.สภาพ || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [subFilteredByBrand, warehouseId]);

 const subFilteredByCondition = useMemo(() => subFilteredByBrand.filter(i => !selectedSubCondition || (i.สภาพ || '-') === (selectedSubCondition || '-')), [subFilteredByBrand, selectedSubCondition]);

 const subItemSizes = useMemo(() => {
 const uniques = Array.from(new Set(subFilteredByCondition.map(i => i.ขนาด || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, subFilteredByCondition.filter(i => (i.ขนาด || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [subFilteredByCondition, warehouseId]);

 const subFilteredBySize = useMemo(() => subFilteredByCondition.filter(i => !selectedSubSize || (i.ขนาด || '-') === (selectedSubSize || '-')), [subFilteredByCondition, selectedSubSize]);

 const subItemDetails = useMemo(() => {
 const uniques = Array.from(new Set(subFilteredBySize.map(i => i.รายละเอียด || '-').filter(Boolean)));
 return uniques.map(name => ({ name, stock: Math.max(0, subFilteredBySize.filter(i => (i.รายละเอียด || '-') === name).reduce((sum, i) => sum + (getItemStock(i as any)), 0)) }));
 }, [subFilteredBySize, warehouseId]);

 const subFilteredByDetail = useMemo(() => subFilteredBySize.filter(i => !selectedSubDetail || (i.รายละเอียด || '-') === (selectedSubDetail || '-')), [subFilteredBySize, selectedSubDetail]);

 const finalSubItem = useMemo(() => {
 return subFilteredByDetail.length > 0 ? subFilteredByDetail[0] : null;
 }, [subFilteredByDetail]);

 const subItemTotalStock = useMemo(() => {
 if (!finalSubItem) return 0;
 return Math.max(0, getItemStock(finalSubItem));
 }, [finalSubItem, warehouseId]);

 // Auto-Select single options
 useEffect(() => {
 if (allTypes.length === 1 && !type) setType(allTypes[0].name);
 }, [allTypes.length, type]);

 useEffect(() => {
 if (brandOptions.length === 1 && !brand && type) setBrand(brandOptions[0].name);
 }, [brandOptions.length, brand, type]);

 useEffect(() => {
 if (itemNameOptions.length === 1 && !itemName && brand) setItemName(itemNameOptions[0].name);
 }, [itemNameOptions.length, itemName, brand]);

 useEffect(() => {
 if (sizeOptions.length === 1 && !size && condition) setSize(sizeOptions[0].name);
 }, [sizeOptions.length, size, condition]);

 useEffect(() => {
 if (subItemBrands.length === 1 && !selectedSubBrand && selectedSubName) setSelectedSubBrand(subItemBrands[0].name);
 }, [subItemBrands.length, selectedSubBrand, selectedSubName]);

 useEffect(() => {
 if (!selectedSubCondition && selectedSubName && subItemConditions.length > 0) {
 const hasNew = subItemConditions.find(c => c.name === 'ใหม่');
 if (hasNew) {
 setSelectedSubCondition('ใหม่');
 } else if (subItemConditions.length === 1) {
 setSelectedSubCondition(subItemConditions[0].name);
 }
 }
 }, [subItemConditions, selectedSubCondition, selectedSubName]);

 useEffect(() => {
 if (subItemSizes.length === 1 && !selectedSubSize && selectedSubName) setSelectedSubSize(subItemSizes[0].name);
 }, [subItemSizes.length, selectedSubSize, selectedSubName]);

 useEffect(() => {
 if (subItemDetails.length === 1 && !selectedSubDetail && selectedSubName) setSelectedSubDetail(subItemDetails[0].name);
 }, [subItemDetails.length, selectedSubDetail, selectedSubName]);

 const handleFinalAdd = () => {
 const hasRealOptions = (opts: any[]) => opts.length > 0 && !(opts.length === 1 && (opts[0].name === '-' || !opts[0].name));

 if (!type) { setError('กรุณาเลือกประเภทพัสดุ'); return; }
 if (hasRealOptions(brandOptions) && !brand) { setError('กรุณาเลือกยี่ห้อ'); return; }
 if (hasRealOptions(itemNameOptions) && !itemName) { setError('กรุณาเลือกชื่อรายการ'); return; }
 if (!fixedCondition && action !== 'return' && hasRealOptions(conditionOptions) && !condition) { setError('กรุณาเลือกสภาพ'); return; }
 if (hasRealOptions(sizeOptions) && !size) { setError('กรุณาเลือกขนาด'); return; }

 if ((action === 'issue' || limitStock) && quantity > totalStock) {
 setError('ยอดพัสดุสำหรับทำรายการไม่เพียงพอ');
 return;
 }

 let finalItemCandidate = filteredByDetail.length > 0 ? filteredByDetail[0] : (filteredByItemName.length > 0 ? filteredByItemName[0] : null);

 const targetCondition = fixedCondition || condition || receiveCondition;

 if (finalItemCandidate && targetCondition && finalItemCandidate.สภาพ !== targetCondition) {
 const matched = items.find(i => 
 isSafeItem(i) &&
 i.ประเภท === finalItemCandidate?.ประเภท &&
 i.ยี่ห้อหรือรูปแบบ === finalItemCandidate?.ยี่ห้อหรือรูปแบบ &&
 i.รายการ === finalItemCandidate?.รายการ &&
 i.ขนาด === finalItemCandidate?.ขนาด &&
 i.รายละเอียด === finalItemCandidate?.รายละเอียด &&
 i.สภาพ === targetCondition
 );
 
 if (matched) {
 finalItemCandidate = matched;
 } else {
 if (action !== 'issue') {
 // Allow
 } else {
 setError('ไม่พบรายการพัสดุในระบบ (Condition mismatch)');
 return;
 }
 }
 }

 if (!finalItemCandidate) {
 setError('ไม่พบพัสดุที่เลือก');
 return;
 }

 onAddToCart(finalItemCandidate, quantity,`${finalItemCandidate.รายการ} ${finalItemCandidate.ขนาด}`, undefined);
 
 // Clear selections
 setType('');
 setBrand('');
 setItemName('');
 setSize('');
 setDetail('');
 setCondition(fixedCondition || '');
 setQuantity(1);
 setError('');
 };

 const handleAddAddon = () => {
 if (!finalSubItem || !selectedSubType) return;
 onAddSubItem(finalSubItem, selectedSubQty, selectedSubType as 'accessory' | 'sticker');
 // Keep the selections (name, size, type) here
 // so the user can click"Add" again.
 setSelectedSubQty(1);
 };

 const inputLabelClass = "text-[12px] font-semibold text-slate-500 tracking-tight ml-2 mb-1 block";

 return (
 <div className="px-2 py-6 space-y-6">
 <div className="space-y-1">
 <label className={inputLabelClass}>ประเภทพัสดุ</label>
 <FormSelect value={type} onChange={e => { setType(e.target.value); setBrand(''); setCondition(fixedCondition || ''); setSize(''); setDetail(''); setItemName(''); setError(''); }}>
 <option value="">-- เลือกประเภท --</option>
 {allTypes.map(t => <option key={t.name} value={t.name}>{t.name} {(action !== 'return' || limitStock) && `(ครอบครอง/คงเหลือ: ${t.stock.toLocaleString()})`}</option>)}
 </FormSelect>
 </div>

 {type && (
 <div className="space-y-8">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {brandOptions.length > 0 && !(brandOptions.length === 1 && (brandOptions[0].name === '-' || !brandOptions[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>ยี่ห้อ</label>
 <FormSelect value={brand} onChange={e => { setBrand(e.target.value); setCondition(fixedCondition || ''); setSize(''); setDetail(''); setItemName(''); }}>
 <option value="">-- เลือกยี่ห้อ --</option>
 {brandOptions.map(b => <option key={b.name} value={b.name}>{b.name} {(action !== 'return' || limitStock) && `(${b.stock.toLocaleString()})`}</option>)}
 </FormSelect>
 </div>
 )}

 {itemNameOptions.length > 0 && !(itemNameOptions.length === 1 && (itemNameOptions[0].name === '-' || !itemNameOptions[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>รายการ</label>
 <FormSelect value={itemName} onChange={e => { setItemName(e.target.value); setCondition(fixedCondition || ''); setSize(''); setDetail(''); }}>
 <option value="">-- เลือกรายการ --</option>
 {itemNameOptions.map(n => <option key={n.name} value={n.name}>{n.name} {(action !== 'return' || limitStock) && `(${String(n.stock || 0)})`}</option>)}
 </FormSelect>
 </div>
 )}

 {!fixedCondition && action !== 'return' && conditionOptions.length > 0 && !(conditionOptions.length === 1 && (conditionOptions[0].name === '-' || !conditionOptions[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>สภาพ</label>
 <FormSelect value={condition} onChange={e => { setCondition(e.target.value); setSize(''); setDetail(''); }}>
 <option value="">-- เลือกสภาพ --</option>
 {conditionOptions.map(c => <option key={c.name} value={c.name}>{c.name} ({String(c.stock || 0)})</option>)}
 </FormSelect>
 </div>
 )}

 {sizeOptions.length > 0 && !(sizeOptions.length === 1 && (sizeOptions[0].name === '-' || !sizeOptions[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>ขนาด</label>
 <FormSelect value={size} onChange={e => { setSize(e.target.value); setDetail(''); }}>
 <option value="">-- เลือกขนาด --</option>
 {sizeOptions.map(s => <option key={s.name} value={s.name}>{s.name} {(action !== 'return' || limitStock) && `(${String(s.stock || 0)})`}</option>)}
 </FormSelect>
 </div>
 )}
 </div>

 {fixedCondition && (
 <div className="bg-slate-900/5 px-5 py-3 rounded-2xl border border-slate-100 flex items-center gap-3">
 <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-50">
 <span className="material-symbols-outlined text-[18px]">verified</span>
 </div>
 <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">สถานะ: <span className="text-slate-900">{fixedCondition}</span> อัตโนมัติ</span>
 </div>
 )}

 {detailOptions.length > 0 && !(detailOptions.length === 1 && (detailOptions[0].name === '-' || !detailOptions[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>รายละเอียดเพิ่มเติม</label>
 <FormSelect value={detail} onChange={e => setDetail(e.target.value)}>
 <option value="">-- เลือกรายละเอียด --</option>
 {detailOptions.map(d => <option key={d.name} value={d.name}>{d.name} {(action !== 'return' || limitStock) && `(${d.stock.toLocaleString()})`}</option>)}
 </FormSelect>
 </div>
 )}

 {type === 'ตู้แช่' && size && !fixedCondition && action !== 'return' && (
 <div className="bg-white px-4 py-6 rounded-xl border border-slate-100 space-y-6 relative overflow-hidden">
 
 <div className="flex flex-col items-center gap-1">
 <h4 className="text-[16px] font-bold text-slate-900 tracking-tight">อุปกรณ์เบิกเพิ่มเติม</h4>
 </div>
 
 <div className="grid grid-cols-2 gap-4 p-1 bg-slate-50 rounded-full border border-slate-100">
 <button 
 onClick={() => { setSelectedSubType('accessory'); setSelectedSubName(''); setSelectedSubSize(''); setSelectedSubBrand(''); setSelectedSubCondition(''); setSelectedSubDetail(''); }}
 className={`h-12 rounded-full font-black text-[13px] uppercase tracking-widest ${selectedSubType === 'accessory' ? 'bg-slate-900 text-white scale-[1.02]' : 'bg-transparent text-slate-400 '}`}
 >
 อุปกรณ์
 </button>
 <button 
 onClick={() => { setSelectedSubType('sticker'); setSelectedSubName(''); setSelectedSubSize(''); setSelectedSubBrand(''); setSelectedSubCondition(''); setSelectedSubDetail(''); }}
 className={`h-12 rounded-full font-black text-[13px] uppercase tracking-widest ${selectedSubType === 'sticker' ? 'bg-slate-900 text-white scale-[1.02]' : 'bg-transparent text-slate-400 '}`}
 >
 สติ๊กเกอร์
 </button>
 </div>

 {selectedSubType && (
 <div className="space-y-4 pt-2">
 <div className="space-y-1">
 <label className={inputLabelClass}>เลือกรายการ</label>
 <FormSelect 
 value={selectedSubName} 
 onChange={e => { setSelectedSubName(e.target.value); setSelectedSubBrand(''); setSelectedSubCondition(''); setSelectedSubSize(''); setSelectedSubDetail(''); }}
 >
 <option value="">-- เลือกรายการ --</option>
 {subItemNames.map(si => (
 <option key={si.name} value={si.name}>
 {(selectedSubType === 'sticker' ? 'สติ๊กเกอร์' : 'อุปกรณ์')}: {si.name} ({si.stock.toLocaleString()})
 </option>
 ))}
 </FormSelect>
 </div>
 
 {selectedSubName && subItemBrands.length > 0 && !(subItemBrands.length === 1 && (subItemBrands[0].name === '-' || !subItemBrands[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>เลือกยี่ห้อ</label>
 <FormSelect value={selectedSubBrand} onChange={e => { setSelectedSubBrand(e.target.value); setSelectedSubCondition(''); setSelectedSubSize(''); setSelectedSubDetail(''); }}>
 <option value="">-- เลือกยี่ห้อ --</option>
 {subItemBrands.map(b => (
 <option key={b.name} value={b.name}>
 {b.name} ({b.stock.toLocaleString()})
 </option>
 ))}
 </FormSelect>
 </div>
 )}

 {selectedSubName && subItemConditions.length > 0 && !(subItemConditions.length === 1 && (subItemConditions[0].name === '-' || !subItemConditions[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>เลือกสภาพ</label>
 <FormSelect value={selectedSubCondition} onChange={e => { setSelectedSubCondition(e.target.value); setSelectedSubSize(''); setSelectedSubDetail(''); }}>
 <option value="">-- เลือกสภาพ --</option>
 {subItemConditions.map(c => (
 <option key={c.name} value={c.name}>
 {c.name} ({c.stock.toLocaleString()})
 </option>
 ))}
 </FormSelect>
 </div>
 )}

 {selectedSubName && subItemSizes.length > 0 && !(subItemSizes.length === 1 && (subItemSizes[0].name === '-' || !subItemSizes[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>เลือกขนาด</label>
 <FormSelect value={selectedSubSize} onChange={e => { setSelectedSubSize(e.target.value); setSelectedSubDetail(''); }}>
 <option value="">-- เลือกขนาด --</option>
 {subItemSizes.map(sz => (
 <option key={sz.name} value={sz.name}>
 {sz.name} ({sz.stock.toLocaleString()})
 </option>
 ))}
 </FormSelect>
 </div>
 )}

 {selectedSubName && subItemDetails.length > 0 && !(subItemDetails.length === 1 && (subItemDetails[0].name === '-' || !subItemDetails[0].name)) && (
 <div className="space-y-1">
 <label className={inputLabelClass}>เลือกรายละเอียด</label>
 <FormSelect value={selectedSubDetail} onChange={e => setSelectedSubDetail(e.target.value)}>
 <option value="">-- เลือกรายละเอียด --</option>
 {subItemDetails.map(d => (
 <option key={d.name} value={d.name}>
 {d.name} ({d.stock.toLocaleString()})
 </option>
 ))}
 </FormSelect>
 </div>
 )}


 <div className="flex items-center gap-4 pt-2">
 <div className="flex-1 h-16 bg-slate-50 border border-slate-100 rounded-xl mobile-row flex items-center justify-between px-4">
 <button onClick={() => setSelectedSubQty(q => Math.max(1, q-1))} className="w-11 h-11 flex items-center justify-center text-slate-300 text-2xl font-black">-</button>
 <span className="font-black text-[20px] text-slate-900">{selectedSubQty}</span>
 <button onClick={() => setSelectedSubQty(q => q+1)} className="w-11 h-11 flex items-center justify-center text-slate-300 text-2xl font-black">+</button>
 </div>
 <button 
 onClick={handleAddAddon} 
 disabled={!finalSubItem}
 className="btn no-animation h-16 px-6 bg-slate-900 text-white rounded-xl font-black text-[15px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale"
 >
 เพิ่ม
 </button>
 </div>
 {finalSubItem && (
 <p className="text-center text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 py-2 rounded-xl border border-emerald-100">
 คงเหลือในคลัง: {subItemTotalStock.toLocaleString()}
 </p>
 )}
 </div>
 )}

 {tempSubItems.length > 0 && (
 <div className="space-y-3 mt-4 pt-6 border-t border-slate-100">
 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 ml-2">รายการที่เลือกไว้</p>
 {tempSubItems.map((si, idx) => (
 <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mobile-row flex items-center justify-between group">
 <div className="flex items-center gap-4 flex-1 min-w-0">
 <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-400 shrink-0 border border-slate-100">
 <span className="material-symbols-outlined text-[20px]">add</span>
 </div>
 <div className="min-w-0">
 <p className="text-[13px] font-black text-slate-800 truncate leading-tight uppercase">{si.displayString}</p>
 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">เพิ่มรายการแล้ว</p>
 </div>
 </div>
 
 <div className="flex items-center gap-4">
 <div className="flex items-center bg-white p-1 rounded-full border border-slate-100">
 <button 
 onClick={() => onUpdateSubItemQty(idx, -1)}
 className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-black"
 >
 -
 </button>
 <span className="w-8 text-center text-[14px] font-black text-slate-900">{si.quantity}</span>
 <button 
 onClick={() => onUpdateSubItemQty(idx, 1)}
 className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-black"
 >
 +
 </button>
 </div>
 
 <button 
 onClick={() => _onRemoveSubItem(idx)}
 className="w-10 h-10 rounded-full flex items-center justify-center text-slate-200"
 >
 <span className="material-symbols-outlined text-[18px]">close</span>
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 <div className="pt-10 pb-6 flex flex-col items-center gap-8 bg-slate-900/5 rounded-[3rem] px-5 py-6 relative">
 <div className="absolute top-6 left-1/2 -translate-x-1/2">
 <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wider ml-1">ระบุจำนวนที่ต้องการ</p>
 </div>
 
 <div className="flex items-center gap-14 mt-4">
 <button 
 type="button"
 onClick={(e) => { e.preventDefault(); setQuantity(q => Math.max(1, q - 1)); }} 
 className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl font-black text-slate-300"
 >
 -
 </button>
 <div className="flex flex-col items-center">
 <span className="text-7xl font-black text-slate-900 tabular-nums" key={quantity}>{quantity}</span>
 {(action !== 'return' || limitStock) && (
 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">ยอดครอบครอง/สต็อก: {totalStock.toLocaleString()}</p>
 )}
 </div>
 <button 
 type="button"
 onClick={(e) => { 
 e.preventDefault(); 
 if ((action === 'issue' || limitStock) && quantity >= totalStock) return;
 setQuantity(q => q + 1); 
 }} 
 disabled={(action === 'issue' || limitStock) && quantity >= totalStock}
 className={`w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl font-black ${(action === 'issue' || limitStock) && quantity >= totalStock ? 'opacity-20 cursor-not-allowed' : 'text-slate-300 '}`}
 >
 +
 </button>
 </div>

 {error && (
 <div className="p-4 bg-rose-50 text-rose-600 font-bold rounded-2xl flex items-center gap-3 border border-rose-100">
 <span className="material-symbols-outlined text-[22px]">error_outline</span>
 <span className="text-[14px]">{error}</span>
 </div>
 )}

 <button 
 type="button"
 onClick={(e) => { e.preventDefault(); handleFinalAdd(); }}
 className="w-full h-16 bg-slate-900 text-white rounded-full flex items-center justify-center gap-4 font-black text-[16px] uppercase tracking-[0.15em] outline-none"
 >
 <span className="material-symbols-outlined text-[24px]">shopping_cart</span>
 <span>เพิ่มลงตะกร้า</span>
 </button>
 </div>
 </div>
 )}
 </div>
 );
};

export default React.memo(JobRequestItemSelector);
