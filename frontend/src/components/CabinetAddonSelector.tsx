import React, { useState, useMemo } from 'react';
import type { MaterialItem } from '../types';

interface CabinetAddonSelectorProps {
 items: MaterialItem[];
 show: boolean;
 onAddSubItem: (item: MaterialItem, quantity: number, type: 'accessory' | 'sticker') => void;
 setError: (msg: string) => void;
}

const CabinetAddonSelector: React.FC<CabinetAddonSelectorProps> = ({ items, show, onAddSubItem, setError }) => {
 const [selectedType, setSelectedType] = useState<'accessory' | 'sticker' | ''>('');
 const [selectedIndex, setSelectedIndex] = useState<string>('');
 const [qty, setQty] = useState(1);

 const accOptions = useMemo(() => items.filter(i => {
 const p = i.ประเภท || '';
 return p.includes('อุปกรณ์') || p.includes('อะไหล่') || p.includes('ส่วนประกอบ');
 }), [items]);

 const stkOptions = useMemo(() => items.filter(i => {
 const p = i.ประเภท || '';
 return p.includes('สติกเกอร์') || p.includes('สติ๊กเกอร์') || p.includes('Sticker');
 }), [items]);

 if (!show) return null;

 const currentOptions = selectedType === 'accessory' ? accOptions : stkOptions;

 const handleAdd = () => {
 if (!selectedIndex) return;
 const item = currentOptions[parseInt(selectedIndex)];
 if (!item) return;

 if (item.จำนวน < qty) {
 setError(`สต็อก (${item.รายการ}) ไม่พอ (คงเหลือ ${item.จำนวน} ชิ้น)`);
 return;
 }

 onAddSubItem(item, qty, selectedType as any);
 setSelectedIndex('');
 setQty(1);
 };

 const selectClass = "w-full bg-white border border-yellow-500/20 rounded-2xl px-5 py-3.5 text-[14px] font-medium outline-none";

 return (
 <div className="mt-4 -mx-6 px-6 py-8 bg-yellow-500/10 border-y border-yellow-500/20 space-y-6 ">
 <div className="flex items-center gap-2 mb-2">
 <span className="material-symbols-outlined text-yellow-600">widgets</span>
 <h4 className="text-[13px] font-black text-yellow-800 uppercase tracking-widest">ส่วนประกอบตู้ (เบิกเพิ่มเติม)</h4>
 </div>

 <div className="flex flex-col gap-5">
 <div className="grid grid-cols-2 gap-4">
 <button onClick={() => { setSelectedType('accessory'); setSelectedIndex(''); }} className={`py-4 rounded-2xl text-[12px] font-black uppercase flex items-center justify-center gap-2 ${selectedType === 'accessory' ? 'bg-yellow-500 text-on-surface scale-[1.02]' : 'bg-white/60 text-yellow-800 border border-yellow-500/10'}`}>
 <span className="material-symbols-outlined text-[18px]">conveyor_belt</span>อุปกรณ์ / อะไหล่
 </button>
 <button onClick={() => { setSelectedType('sticker'); setSelectedIndex(''); }} className={`py-4 rounded-2xl text-[12px] font-black uppercase flex items-center justify-center gap-2 ${selectedType === 'sticker' ? 'bg-yellow-500 text-on-surface scale-[1.02]' : 'bg-white/60 text-yellow-800 border border-yellow-500/10'}`}>
 <span className="material-symbols-outlined text-[18px]">label</span>สติ๊กเกอร์ตู้
 </button>
 </div>

 {selectedType && (
 <div className="space-y-4 p-5 bg-white/50 rounded-3xl border border-yellow-600/10 ">
 <div>
 <label className="block text-[10px] font-black text-yellow-700/70 mb-1.5 uppercase ml-2">ระบุพัสดุ</label>
 <select className={selectClass} value={selectedIndex} onChange={e => setSelectedIndex(e.target.value)} title="รายการเสริม">
 <option value="">-- เลือกรายการ --</option>
 {currentOptions.map((item, idx) => (
 <option key={idx} value={idx}>{item.รายการ} {item.ขนาด && item.ขนาด !== '-' ? `(${item.ขนาด})` : ''} - เหลือ {item.จำนวน}</option>
 ))}
 </select>
 </div>
 
 <div className="flex flex-col gap-4">
 <div className="w-full">
 <label className="block text-[10px] font-black text-yellow-700/70 mb-1.5 uppercase ml-2">จำนวน</label>
 <div className="grid grid-cols-[48px_1fr_48px] gap-3 items-center">
 <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold">−</button>
 <input type="number" readOnly className="w-full text-center bg-white border-none rounded-xl h-10 text-lg font-bold " value={qty} title="จำนวนเสริม" />
 <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold">+</button>
 </div>
 </div>
 <button onClick={handleAdd} disabled={!selectedIndex} className="w-full h-12 bg-yellow-500 text-on-surface font-black rounded-2xl text-[14px] disabled:opacity-50 ">เพิ่มรายการเสริม</button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default React.memo(CabinetAddonSelector);
