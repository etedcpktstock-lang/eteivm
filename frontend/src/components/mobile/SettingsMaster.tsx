import React, { useState, useMemo, useEffect } from 'react';
import { Search, RefreshCw, RotateCcw, Package, Layers, Boxes, Tag, Warehouse, ChevronRight } from 'lucide-react';
import { saveMasterItems } from '../../api';
import type { MaterialItem } from '../../types';
import ConfirmationModal from './ConfirmationModal';
import { exportJsonToExcel, importFirstSheetToJson } from '../../utils/excel';

interface SettingsMasterProps {
 masterItems: MaterialItem[];
 warehouses: any[];
 settings: any;
 onRefresh: () => void;
 onAddItem: () => void;
 onEditItem: (item: MaterialItem) => void;
 onDeleteItem: (rowIndex: number) => void;
 showSuccess: (msg: string) => void;
 setError: (msg: string) => void;
 setLoading: (loading: boolean) => void;
 loading: boolean;
}

const SettingsMaster: React.FC<SettingsMasterProps> = ({ 
 masterItems, warehouses, settings, onRefresh, onAddItem, onEditItem, onDeleteItem, 
 showSuccess, setError, setLoading, loading
}) => {
 const [filterType, setFilterType] = useState<string>('ทั้งหมด');
 const [filterBrand, setFilterBrand] = useState<string>('ทั้งหมด');
 const [filterName, setFilterName] = useState<string>('ทั้งหมด');
 const [filterCondition, setFilterCondition] = useState<string>('ทั้งหมด');
 const [filterDetail, setFilterDetail] = useState<string>('ทั้งหมด');
 const [qtyLimit, setQtyLimit] = useState<string>('');
 const [searchTerm, setSearchTerm] = useState('');
 const [debouncedSearchValue, setDebouncedSearchValue] = useState('');

 const [importData, setImportData] = useState<any[] | null>(null);
 const [isBatchEditing, setIsBatchEditing] = useState(false);
 const [batchItems, setBatchItems] = useState<MaterialItem[]>([]);
 const [expandedStockId, setExpandedStockId] = useState<number | null>(null);

 useEffect(() => {
 if (isBatchEditing) {
 setBatchItems([...masterItems]);
 }
 }, [isBatchEditing, masterItems]);

 useEffect(() => {
 const timer = setTimeout(() => {
 setDebouncedSearchValue(searchTerm);
 }, 300);
 return () => clearTimeout(timer);
 }, [searchTerm]);

 const types = useMemo(() => {
 const list = Array.from(new Set(masterItems.map(i => String(i.ประเภท || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th'));
 return ['ทั้งหมด', ...list];
 }, [masterItems]);

 const brands = useMemo(() => {
 const list = masterItems
 .filter(i => (filterType === 'ทั้งหมด' || i.ประเภท === filterType))
 .map(i => String(i.ยี่ห้อหรือรูปแบบ || '').trim())
 .filter(Boolean);
 const uniques = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'th'));
 return ['ทั้งหมด', ...uniques];
 }, [masterItems, filterType]);

 const names = useMemo(() => {
 const list = masterItems
 .filter(i => (filterType === 'ทั้งหมด' || i.ประเภท === filterType) && 
 (filterBrand === 'ทั้งหมด' || i.ยี่ห้อหรือรูปแบบ === filterBrand))
 .map(i => String(i.รายการ || '').trim())
 .filter(Boolean);
 const uniques = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'th'));
 return ['ทั้งหมด', ...uniques];
 }, [masterItems, filterType, filterBrand]);

 const conditions = useMemo(() => {
 const list = masterItems
 .filter(i => (filterType === 'ทั้งหมด' || i.ประเภท === filterType) && 
 (filterBrand === 'ทั้งหมด' || i.ยี่ห้อหรือรูปแบบ === filterBrand) &&
 (filterName === 'ทั้งหมด' || i.รายการ === filterName))
 .map(i => String(i.สภาพ || '').trim())
 .filter(Boolean);
 const uniques = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'th'));
 return ['ทั้งหมด', ...uniques];
 }, [masterItems, filterType, filterBrand, filterName]);

 const detailList = useMemo(() => {
 const list = masterItems
 .filter(i => (filterType === 'ทั้งหมด' || i.ประเภท === filterType) && 
 (filterBrand === 'ทั้งหมด' || i.ยี่ห้อหรือรูปแบบ === filterBrand) &&
 (filterName === 'ทั้งหมด' || i.รายการ === filterName) &&
 (filterCondition === 'ทั้งหมด' || i.สภาพ === filterCondition))
 .map(i => String(i.รายละเอียด || '').trim())
 .filter(Boolean);
 const uniques = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'th'));
 return ['ทั้งหมด', ...uniques];
 }, [masterItems, filterType, filterBrand, filterName, filterCondition]);

 const filteredItems = useMemo(() => {
 return masterItems.filter(i => {
 const matchType = filterType === 'ทั้งหมด' || String(i.ประเภท || '').trim() === filterType.trim();
 const matchBrand = filterBrand === 'ทั้งหมด' || String(i.ยี่ห้อหรือรูปแบบ || '').trim() === filterBrand.trim();
 const matchName = filterName === 'ทั้งหมด' || String(i.รายการ || '').trim() === filterName.trim();
 const matchCond = filterCondition === 'ทั้งหมด' || String(i.สภาพ || '').trim() === filterCondition.trim();
 const matchDet = filterDetail === 'ทั้งหมด' || String(i.รายละเอียด || '').trim() === filterDetail.trim();
 const matchQty = !qtyLimit || (i.จำนวน || 0) <= parseInt(qtyLimit);
 
 const term = debouncedSearchValue.toLowerCase();
 const matchSearch = !term || (
 (i.ประเภท || '').toLowerCase().includes(term) ||
 (i.ยี่ห้อหรือรูปแบบ || '').toLowerCase().includes(term) ||
 (i.รายการ || '').toLowerCase().includes(term) ||
 (i.สภาพ || '').toLowerCase().includes(term) ||
 (i.รายละเอียด || '').toLowerCase().includes(term)
 );
 
 return matchType && matchBrand && matchName && matchCond && matchDet && matchQty && matchSearch;
 });
 }, [masterItems, filterType, filterBrand, filterName, filterCondition, filterDetail, qtyLimit, debouncedSearchValue]);

 const filteredDisplayItems = useMemo(() => {
 if (!isBatchEditing) return filteredItems;
 return filteredItems.map(fItem => {
 const bItem = batchItems.find(b => b.rowIndex === fItem.rowIndex);
 return bItem || fItem;
 });
 }, [isBatchEditing, filteredItems, batchItems]);

 const handleBatchItemChange = (index: number, field: keyof MaterialItem, value: any) => {
 const updated = [...batchItems];
 const itemIdx = updated.findIndex(it => it.rowIndex === filteredItems[index].rowIndex);
 if (itemIdx !== -1) {
 (updated[itemIdx] as any)[field] = field === 'จำนวน' ? (parseInt(value) || 0) : value;
 setBatchItems(updated);
 }
 };

 const handleBatchSave = async () => {
 setLoading(true);
 try {
 await saveMasterItems(batchItems);
 showSuccess('บันทึกการแก้ไขพัสดุเป็นกลุ่มเรียบร้อยแล้ว');
 setIsBatchEditing(false);
 onRefresh();
 } catch (err: any) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 };

 const handleExportExcel = async () => {
 await exportJsonToExcel(masterItems as any[], 'MasterData', `MasterInventory_${new Date().getTime()}.xlsx`);
 };

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setLoading(true);

 importFirstSheetToJson(file)
 .then((data) => {
 if (data.length > 0) setImportData(data);
 else throw new Error("ไฟล์ไม่มีข้อมูล");
 })
 .catch((err: any) => setError(err.message))
 .finally(() => {
 setLoading(false);
 e.target.value = "";
 });
 };

 const confirmImport = async () => {
 if (!importData) return;
 setLoading(true);
 try {
 await saveMasterItems(importData);
 showSuccess('นำเข้าพัสดุหลักเรียบร้อยแล้ว');
 setImportData(null);
 onRefresh();
 } catch (err: any) { setError(err.message); }
 finally { setLoading(false); }
 };

 const mainWhId = settings?.MAIN_WAREHOUSE_ID ? parseInt(settings.MAIN_WAREHOUSE_ID) : -1;

  // 📊 Stats
  const masterStats = useMemo(() => {
    const totalStock = masterItems.reduce((sum, i) => sum + (Number(i.จำนวน) || 0), 0);
    const activeStock = masterItems.reduce((sum, i) => sum + ((Number(i.จำนวน) || 0) - (Number(i.repair_qty) || 0) - (Number(i.lost_qty) || 0) - (Number(i.scrap_qty) || 0)), 0);
    const typeCount = new Set(masterItems.map(i => String(i.ประเภท || '').trim()).filter(Boolean)).size;
    const brandCount = new Set(masterItems.map(i => String(i['ยี่ห้อหรือรูปแบบ'] || '').trim()).filter(Boolean)).size;
    return { total: masterItems.length, totalStock, activeStock, typeCount, brandCount, filtered: filteredItems.length };
  }, [masterItems, filteredItems]);

 return (
    <div className="p-2 md:p-3 space-y-4 w-full max-w-none">
    <div className="mobile-toolbar-card relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
    <span className="material-symbols-outlined text-[160px] text-indigo-600">database</span>
    </div>
 
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
    <div className="flex items-center gap-4">
    <div className="w-16 h-16 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
    <span className="material-symbols-outlined text-[32px]">inventory_2</span>
    </div>
    <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">ทะเบียนพัสดุหลัก (SKU)</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-3 flex items-center gap-2">
    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
    Inventory Intelligence System
    </p>
    </div>
    </div>
 
    <div className="flex flex-wrap gap-3 w-full md:w-auto">
    <button 
    onClick={onAddItem}
    className="btn no-animation flex-1 md:flex-none h-14 px-8 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 text-[13px] uppercase tracking-widest"
    >
    <span className="material-symbols-outlined text-[20px]">add_circle</span> เพิ่มพัสดุใหม่
    </button>
    <div className="flex gap-2 flex-1 md:flex-none">
    <button 
    onClick={handleExportExcel}
    className="btn no-animation flex-1 md:flex-none h-14 px-6 bg-white border border-slate-100 text-indigo-600 rounded-2xl font-black flex items-center justify-center gap-2 text-[12px] uppercase"
    >
    <span className="material-symbols-outlined text-[18px]">download</span> Export
    </button>
    <label className="flex-1 md:flex-none h-14 px-6 bg-white border border-slate-100 text-indigo-600 rounded-2xl font-black flex items-center justify-center gap-2 text-[12px] cursor-pointer uppercase">
    <span className="material-symbols-outlined text-[18px]">upload</span> Import
    <input type="file" hidden accept=".xlsx, .xls" onChange={handleFileChange} />
    </label>
    </div>
    </div>
    </div>
    </div>

    {/* 📊 Desktop Stat Bar */}
    <div className="hidden lg:grid grid-cols-5 gap-3">
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Package size={14} className="text-indigo-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">SKU ทั้งหมด</span>
        </div>
        <p className="text-2xl font-black text-slate-800">{masterStats.total}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
          {masterStats.filtered !== masterStats.total && `กำลังกรอง ${masterStats.filtered} รายการ`}
          {masterStats.filtered === masterStats.total && 'รายการทั้งหมด'}
        </p>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Tag size={14} className="text-amber-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">ประเภท</span>
        </div>
        <p className="text-2xl font-black text-slate-800">{masterStats.typeCount}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">ประเภทสินค้า</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={14} className="text-emerald-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">ยี่ห้อ/รูปแบบ</span>
        </div>
        <p className="text-2xl font-black text-slate-800">{masterStats.brandCount}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">ยี่ห้อทั้งหมด</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Boxes size={14} className="text-sky-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Stock รวม</span>
        </div>
        <p className="text-2xl font-black text-slate-800">{masterStats.totalStock.toLocaleString()}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">ชิ้นทั้งหมด</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Boxes size={14} className="text-emerald-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">พร้อมใช้งาน</span>
        </div>
        <p className="text-2xl font-black text-emerald-600">{masterStats.activeStock.toLocaleString()}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">หลังหัก ซ่อม/หาย/scrap</p>
      </div>
    </div>

 {/* 🔍 Compact Search & Filters */}
 <div className="mobile-toolbar-card space-y-4">
 <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
 {[
 { label: 'ประเภท', value: filterType, setter: setFilterType, options: types },
 { label: 'ยี่ห้อ', value: filterBrand, setter: setFilterBrand, options: brands },
 { label: 'รายการ', value: filterName, setter: setFilterName, options: names },
 { label: 'สภาพ', value: filterCondition, setter: setFilterCondition, options: conditions },
 { label: 'รายละเอียด', value: filterDetail, setter: setFilterDetail, options: detailList }
 ].map((f, i) => (
 <div key={i} className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{f.label}</label>
 <select 
 value={f.value}
 onChange={e => f.setter(e.target.value)}
 className="w-full bg-slate-50 border border-slate-100/60 rounded-xl px-3 h-10 text-[12px] font-bold text-slate-700 focus:bg-white focus:border-indigo-300 outline-none appearance-none"
 >
 {f.options.map(o => <option key={o} value={o}>{o}</option>)}
 </select>
 </div>
 ))}
 <div className="space-y-1">
   <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">stock ≤</label>
   <input
     type="number"
     inputMode="numeric"
     placeholder="เช่น 5"
     value={qtyLimit}
     onChange={e => setQtyLimit(e.target.value)}
     className="w-full h-10 bg-slate-50 border border-slate-100/60 rounded-xl px-3 text-[12px] font-bold text-slate-700 focus:bg-white focus:border-indigo-300 outline-none placeholder:text-slate-300"
   />
 </div>
 <div className="space-y-1 xl:col-span-1">
 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">ค้นหา</label>
 <div className="relative">
 <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
 <input 
 type="text"
 placeholder="ค้นหา SKU / รายการ"
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 className="w-full h-10 bg-white border border-slate-200 rounded-xl pl-9 pr-3 text-[12px] font-bold focus:border-indigo-500/20 outline-none placeholder:text-slate-300"
 />
 </div>
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
   {filterType !== 'ทั้งหมด' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold">ประเภท: {filterType}</span>}
   {filterBrand !== 'ทั้งหมด' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 font-bold">ยี่ห้อ: {filterBrand}</span>}
   {filterName !== 'ทั้งหมด' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold">รายการ: {filterName}</span>}
   {filterCondition !== 'ทั้งหมด' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold">สภาพ: {filterCondition}</span>}
   {filterDetail !== 'ทั้งหมด' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 font-bold">รายละเอียด: {filterDetail}</span>}
   {!!qtyLimit && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 font-bold">stock ≤ {qtyLimit}</span>}
   {!!searchTerm && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-violet-50 border border-violet-100 text-violet-700 font-bold">ค้นหา: {searchTerm}</span>}
   {filterType === 'ทั้งหมด' && filterBrand === 'ทั้งหมด' && filterName === 'ทั้งหมด' && filterCondition === 'ทั้งหมด' && filterDetail === 'ทั้งหมด' && !qtyLimit && !searchTerm && (
     <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 font-bold">กำลังแสดงทุกรายการ</span>
   )}
 </div>

 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-3 border-t border-slate-100">
 <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-fit">
 <span className={`text-[11px] font-semibold tracking-tight px-2 ${isBatchEditing ? 'text-indigo-600' : 'text-slate-500'}`}>
 แก้ไขหลายรายการ
 </span>
 <button 
 onClick={() => setIsBatchEditing(!isBatchEditing)}
 className={`w-11 h-5.5 rounded-full relative ${isBatchEditing ? 'bg-indigo-600' : 'bg-slate-200'}`}
 >
 <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full ${isBatchEditing ? 'left-6' : 'left-0.5'}`}></div>
 </button>
 </div>

 <div className="flex flex-wrap items-center gap-2 lg:justify-end">
   <span className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600">
     <Package size={13} className="text-indigo-500" />
     พบ {filteredDisplayItems.length.toLocaleString()} SKU
   </span>
   <span className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700">
     พร้อมใช้ {masterStats.activeStock.toLocaleString()}
   </span>
   <span className="hidden xl:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-amber-50 border border-amber-100 text-[11px] font-bold text-amber-700">
     {types.length - 1} ประเภท
   </span>

 {isBatchEditing ? (
 <button 
 onClick={handleBatchSave}
 className="btn no-animation h-9 px-6 bg-indigo-600 text-white rounded-xl font-black text-[12px] flex items-center gap-2 uppercase tracking-widest"
 >
 บันทึกกลุ่ม
 </button>
 ) : (
 <button 
 onClick={() => { setSearchTerm(''); setQtyLimit(''); setFilterType('ทั้งหมด'); setFilterBrand('ทั้งหมด'); setFilterName('ทั้งหมด'); setFilterCondition('ทั้งหมด'); setFilterDetail('ทั้งหมด'); }}
 className="btn no-animation h-9 px-3 bg-white text-slate-500 rounded-xl border border-slate-100 flex items-center justify-center gap-2 text-[11px] font-bold"
 title="ล้างตัวกรอง"
 >
 <RotateCcw size={15} /> ล้างตัวกรอง
 </button>
 )}
 </div>
 </div>
 </div>

{/* 📦 Item Cards & Breakdown */}
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 pb-20">
    {filteredDisplayItems.map((item, idx) => {
    const isExpanded = expandedStockId === item.rowIndex;
    const totalQty = Number(item.จำนวน) || 0;
    const repairQty = Number(item.repair_qty) || 0;
    const lostQty = Number(item.lost_qty) || 0;
    const scrapQty = Number(item.scrap_qty) || 0;
    const quarantineQty = Number(item.quarantine_qty) || 0;
    const transitQty = Number(item.transit_qty) || 0;
    const availableQty = Math.max(totalQty - repairQty - lostQty - scrapQty - quarantineQty - transitQty, 0);
    const statusColor = totalQty <= 0 ? 'text-rose-500' : 'text-emerald-500';
    const whStocks = (item.warehouse_stocks || []).filter((s: any) => s.stock > 0);
    const whShown = whStocks.slice(0, 3);
    const whMore = whStocks.length - whShown.length;
    const whNames: Record<number, string> = {};
    (warehouses || []).forEach((w: any) => { whNames[w.id] = w.name; });
    const issueBadges = [
      repairQty > 0 ? { label: 'ซ่อม', value: repairQty, tone: 'amber' } : null,
      quarantineQty > 0 ? { label: 'กัก', value: quarantineQty, tone: 'violet' } : null,
      transitQty > 0 ? { label: 'โอน', value: transitQty, tone: 'sky' } : null,
      lostQty > 0 ? { label: 'หาย', value: lostQty, tone: 'rose' } : null,
      scrapQty > 0 ? { label: 'scrap', value: scrapQty, tone: 'slate' } : null,
    ].filter(Boolean) as { label: string; value: number; tone: string }[];

    return (
    <div key={idx}>

    {/* ── DESKTOP CARD (lg:) ── */}
    <div className="hidden lg:flex bg-white border border-slate-100 rounded-xl overflow-hidden group/card hover:border-indigo-200 transition-colors">
      <div className="w-1.5 bg-indigo-500 shrink-0"></div>
      
      <div className="flex-1 min-w-0 p-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase tracking-wider whitespace-nowrap">
                {item.ประเภท}
              </span>
              <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-black rounded-full tracking-wide whitespace-nowrap">
                SKU #{item.rowIndex ?? idx + 1}
              </span>
              {item.tracking_type && (
                <span className="px-2 py-0.5 bg-sky-50 text-sky-600 text-[9px] font-black rounded-full uppercase tracking-wide whitespace-nowrap">
                  {item.tracking_type}
                </span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-slate-800 leading-tight truncate">{item.รายการ}</div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-1 flex-wrap">
                  <span>{item['ยี่ห้อหรือรูปแบบ'] || '-'}</span>
                  <span className="text-slate-200">·</span>
                  <span>{item.สภาพ || 'ปกติ'}</span>
                  {item.ขนาด && (<><span className="text-slate-200">·</span><span>{item.ขนาด}</span></>)}
                </div>
                {item.รายละเอียด && (
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                    {item.รายละเอียด}
                  </p>
                )}
              </div>

              <div className="text-right shrink-0 w-[92px]">
                <p className={`text-lg font-black ${statusColor}`}>
                  {totalQty.toLocaleString()}
                </p>
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-wider">stock รวม</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">พร้อมใช้ {availableQty.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 opacity-100 xl:opacity-0 xl:group-hover/card:opacity-100 transition-opacity">
            <button onClick={() => onEditItem(item)} className="h-8 px-2.5 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600 text-[11px] font-bold inline-flex items-center gap-1.5 border border-transparent hover:border-slate-100">
              <span className="material-symbols-outlined text-[16px]">edit</span>
              แก้ไข
            </button>
            <button onClick={() => onDeleteItem(item.rowIndex!)} className="h-8 px-2.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 text-[11px] font-bold inline-flex items-center gap-1.5 border border-transparent hover:border-rose-100">
              <span className="material-symbols-outlined text-[16px]">delete</span>
              ลบ
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-start justify-between gap-3">
          <div className="hidden lg:flex flex-wrap items-center gap-1.5 min-w-0">
            {whShown.map((s: any) => (
              <span key={s.warehouseId} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md text-[10px] font-bold text-slate-500 whitespace-nowrap">
                <Warehouse size={10} className="text-slate-300" />
                {whNames[s.warehouseId] || `#${s.warehouseId}`}
                <span className="text-indigo-500">{s.stock}</span>
              </span>
            ))}
            {whMore > 0 && (
              <span className="text-[10px] font-bold text-slate-300">+{whMore}</span>
            )}
            {whStocks.length === 0 && (
              <span className="text-[10px] text-slate-300 italic">ไม่มีสต็อก</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 whitespace-nowrap">
              พร้อมใช้ {availableQty.toLocaleString()}
            </span>
            {issueBadges.map((badge) => (
              <span
                key={badge.label}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${
                  badge.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  badge.tone === 'violet' ? 'bg-violet-50 text-violet-700 border-violet-100' :
                  badge.tone === 'sky' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                  badge.tone === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {badge.label} {badge.value.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── MOBILE CARD (default) ── */}
    <div className={`lg:hidden bg-white border ${isExpanded ? 'border-indigo-200' : 'border-slate-100'} p-4 rounded-2xl group relative flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase tracking-widest border border-indigo-100">
              {item.ประเภท}
            </span>
          </div>
          <h3 className="text-base font-black text-slate-800 leading-tight">{item.รายการ}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-medium">
            <span>{item['ยี่ห้อหรือรูปแบบ'] || 'No Brand'}</span>
            <span className="text-slate-200">·</span>
            <span>{item.สภาพ || 'ปกติ'}</span>
            {item.ขนาด && (<><span className="text-slate-200">·</span><span>{item.ขนาด}</span></>)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-black ${statusColor} tracking-tight`}>
            {Number(item.จำนวน || 0).toLocaleString()}
          </p>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">unit</p>
        </div>
      </div>

      {/* Mobile: inline warehouse */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {whShown.map((s: any) => (
          <span key={s.warehouseId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[10px] font-bold text-slate-500">
            <Warehouse size={10} className="text-slate-300" />
            {whNames[s.warehouseId] || `#${s.warehouseId}`}
            <span className="text-indigo-500">{s.stock}</span>
          </span>
        ))}
        {whMore > 0 && (
          <button onClick={() => setExpandedStockId(isExpanded ? null : item.rowIndex!)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700">
            +{whMore} เพิ่มเติม <ChevronRight size={10} className="inline" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => onEditItem(item)} className="flex-1 h-9 bg-white border border-slate-100 text-slate-500 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">edit</span> แก้ไข
        </button>
        <button onClick={() => onDeleteItem(item.rowIndex!)} className="flex-1 h-9 bg-white border border-rose-100 text-rose-500 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">delete</span> ลบ
        </button>
      </div>
    </div>

    </div>
    );
    })}
    </div>

 <ConfirmationModal 
 isOpen={!!importData}
 onClose={() => setImportData(null)}
 onConfirm={confirmImport}
 title="ยืนยันการนำเข้าพัสดุเป็นกลุ่ม"
 message="กรุณาตรวจสอบข้อมูลในไฟล์ Excel อีกครั้งก่อนยืนยัน เพื่อป้องกันความผิดพลาดของสต็อกรวม"
 confirmText="เริ่มนำเข้าข้อมูล"
 cancelText="ตรวจสอบใหม่"
 isLoading={loading}
 />
 </div>
 );
};

export default React.memo(SettingsMaster);
