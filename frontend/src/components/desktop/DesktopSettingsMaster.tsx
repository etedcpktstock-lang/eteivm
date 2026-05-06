import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, RefreshCw, RotateCcw, Package, Layers, Boxes, Tag, Warehouse, ChevronRight } from 'lucide-react';
import { saveMasterItems } from '../../api';
import type { MaterialItem } from '../../types';
import ConfirmationModal from '../mobile/ConfirmationModal';
import { exportJsonToExcel, importFirstSheetToJson } from '../../utils/excel';

interface DesktopSettingsMasterProps {
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

const DesktopSettingsMaster: React.FC<DesktopSettingsMasterProps> = ({ 
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
  const [quickPreset, setQuickPreset] = useState<'all' | 'low-stock' | 'out-of-stock' | 'with-repair' | 'in-warehouse'>('all');
  const [sortOrder, setSortOrder] = useState<'default' | 'name-asc' | 'stock-asc' | 'stock-desc'>('default');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

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

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!sentinelRef.current) return;
      const rect = sentinelRef.current.getBoundingClientRect();
      setShowStickyBar(rect.top < 0);
    };
    // Find scrollable ancestor by computed style, not just class
    let container: Element | null = el.parentElement;
    while (container) {
      const style = window.getComputedStyle(container);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      container = container.parentElement;
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    if (container) container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (container) container.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
 const qty = Number(i.จำนวน) || 0;
 const repairQty = Number(i.repair_qty) || 0;
 const matchQty = !qtyLimit || qty <= parseInt(qtyLimit);
 
 const term = debouncedSearchValue.toLowerCase();
 const matchSearch = !term || (
 (i.ประเภท || '').toLowerCase().includes(term) ||
 (i.ยี่ห้อหรือรูปแบบ || '').toLowerCase().includes(term) ||
 (i.รายการ || '').toLowerCase().includes(term) ||
 (i.สภาพ || '').toLowerCase().includes(term) ||
 (i.รายละเอียด || '').toLowerCase().includes(term)
 );

 const matchPreset = quickPreset === 'all'
   ? true
   : quickPreset === 'low-stock'
     ? qty > 0 && qty <= 5
     : quickPreset === 'out-of-stock'
       ? qty <= 0
       : quickPreset === 'with-repair'
         ? repairQty > 0
         : (i.warehouse_stocks || []).some((s: any) => Number(s.stock) > 0);
 
 return matchType && matchBrand && matchName && matchCond && matchDet && matchQty && matchSearch && matchPreset;
 });
 }, [masterItems, filterType, filterBrand, filterName, filterCondition, filterDetail, qtyLimit, debouncedSearchValue, quickPreset]);

  const filteredDisplayItems = useMemo(() => {
    if (!isBatchEditing) return filteredItems;
    return filteredItems.map(fItem => {
      const bItem = batchItems.find(b => b.rowIndex === fItem.rowIndex);
      return bItem || fItem;
    });
  }, [isBatchEditing, filteredItems, batchItems]);

  const sortedItems = useMemo(() => {
    const items = [...filteredDisplayItems];
    if (sortOrder === 'name-asc') {
      items.sort((a, b) => (String(a.รายการ || '')).localeCompare(String(b.รายการ || ''), 'th'));
    } else if (sortOrder === 'stock-asc') {
      items.sort((a, b) => (Number(a.จำนวน) || 0) - (Number(b.จำนวน) || 0));
    } else if (sortOrder === 'stock-desc') {
      items.sort((a, b) => (Number(b.จำนวน) || 0) - (Number(a.จำนวน) || 0));
    }
    return items;
  }, [filteredDisplayItems, sortOrder]);

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

  const desktopSignals = useMemo(() => {
    const lowStockCount = filteredDisplayItems.filter(i => (Number(i.จำนวน) || 0) <= 5).length;
    const zeroStockCount = filteredDisplayItems.filter(i => (Number(i.จำนวน) || 0) <= 0).length;
    const warehouseCoverage = filteredDisplayItems.filter(i => (i.warehouse_stocks || []).some((s: any) => Number(s.stock) > 0)).length;
    return { lowStockCount, zeroStockCount, warehouseCoverage };
  }, [filteredDisplayItems]);

  const presetCounts = useMemo(() => ({
    all: masterItems.length,
    lowStock: masterItems.filter(i => { const qty = Number(i.จำนวน) || 0; return qty > 0 && qty <= 5; }).length,
    outOfStock: masterItems.filter(i => (Number(i.จำนวน) || 0) <= 0).length,
    withRepair: masterItems.filter(i => (Number(i.repair_qty) || 0) > 0).length,
    inWarehouse: masterItems.filter(i => (i.warehouse_stocks || []).some((s: any) => Number(s.stock) > 0)).length,
  }), [masterItems]);

  const applyQuickPreset = (preset: 'all' | 'low-stock' | 'out-of-stock' | 'with-repair' | 'in-warehouse') => {
    setQuickPreset(preset);
    if (preset === 'low-stock') setQtyLimit('5');
    if (preset === 'out-of-stock') setQtyLimit('0');
    if (preset !== 'low-stock' && preset !== 'out-of-stock') setQtyLimit('');
  };

 return (
    <div className="p-2 md:p-3 space-y-4 w-full max-w-none desktop-settings-master">

    {/* ── Sticky compact bar (visible when scrolled past Zone 3) ── */}
    <div className={`hidden lg:block sticky top-0 z-30 transition-all duration-200 ${
      showStickyBar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
    }`}>
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm -mx-3 px-3 py-2 flex items-center justify-between gap-3 rounded-b-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Filters:</span>
          {quickPreset !== 'all' ? (
            <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold">
              {quickPreset === 'low-stock' ? 'ใกล้หมด' : quickPreset === 'out-of-stock' ? 'ของหมด' : quickPreset === 'with-repair' ? 'มีซ่อม' : 'มี stock ในคลัง'}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">ทั้งหมด</span>
          )}
          {sortOrder !== 'default' && (
            <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-[11px] font-bold">
              {sortOrder === 'name-asc' ? 'A → Z' : sortOrder === 'stock-asc' ? 'Stock ↑' : 'Stock ↓'}
            </span>
          )}
          {!!qtyLimit && (
            <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-bold">
              stock ≤ {qtyLimit}
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-500 ml-1">
            {filteredDisplayItems.length}/{masterStats.total} SKU
          </span>
        </div>
        <button 
          onClick={() => { setSearchTerm(''); setQtyLimit(''); setFilterType('ทั้งหมด'); setFilterBrand('ทั้งหมด'); setFilterName('ทั้งหมด'); setFilterCondition('ทั้งหมด'); setFilterDetail('ทั้งหมด'); setQuickPreset('all'); setSortOrder('default'); }}
          className="h-8 px-3 bg-white text-slate-500 rounded-lg border border-slate-100 flex items-center gap-1.5 text-[11px] font-bold hover:border-rose-200 hover:text-rose-500 shrink-0"
        >
          <RotateCcw size={13} /> ล้าง
        </button>
      </div>
    </div>
    <div className="hidden lg:flex items-center justify-between gap-3 px-1">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Desktop Master Workspace</p>
        <p className="text-[12px] font-semibold text-slate-500 mt-1">แยก component ฝั่ง desktop แล้ว เพื่อจูน layout พัสดุหลักต่อได้โดยไม่กระทบ mobile</p>
      </div>
      <div className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700 whitespace-nowrap">
        Desktop only
      </div>
    </div>
    <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.7fr)_360px] gap-4 items-stretch">
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
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Zone 1 · Command</p>
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

    <div className="hidden lg:flex flex-col rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Zone 2 · Signals</p>
          <p className="text-[12px] font-semibold text-slate-600 mt-1">สรุปสัญญาณที่ควรเห็นก่อนลงไปที่ลิสต์</p>
        </div>
        <div className="inline-flex items-center h-8 px-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700">Desktop only</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">ผลลัพธ์ปัจจุบัน</p>
          <p className="text-xl font-black text-slate-800 mt-1">{filteredDisplayItems.length.toLocaleString()}</p>
          <p className="text-[10px] font-medium text-slate-500 mt-1">จากทั้งหมด {masterStats.total.toLocaleString()} SKU</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-rose-400">ใกล้หมด / หมด</p>
          <p className="text-xl font-black text-rose-600 mt-1">{desktopSignals.lowStockCount.toLocaleString()}</p>
          <p className="text-[10px] font-medium text-rose-500 mt-1">หมดจริง {desktopSignals.zeroStockCount.toLocaleString()} SKU</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-500">พร้อมใช้</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{masterStats.activeStock.toLocaleString()}</p>
          <p className="text-[10px] font-medium text-emerald-600 mt-1">สต็อกพร้อมจ่าย</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-500">ครอบคลุมคลัง</p>
          <p className="text-xl font-black text-sky-600 mt-1">{desktopSignals.warehouseCoverage.toLocaleString()}</p>
          <p className="text-[10px] font-medium text-sky-600 mt-1">SKU ที่มี stock ในคลัง</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">แนวทางใช้งาน</p>
        <p className="text-[11px] font-medium text-slate-600 mt-1 leading-relaxed">เริ่มจากกรองประเภท / ยี่ห้อ / รายการ แล้วใช้ stock ≤ เพื่อหาของน้อยหรือของหมด จากนั้นค่อยเลื่อนลงไปจัดการที่การ์ดรายการด้านล่าง</p>
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
 <div ref={sentinelRef} className="h-px w-full" />
 <div className="mobile-toolbar-card space-y-4">
 <div className="hidden lg:flex items-center justify-between gap-3">
   <div>
     <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Zone 3 · Filters</p>
     <p className="text-[12px] font-semibold text-slate-500 mt-1">คุมขอบเขตข้อมูลก่อนลงไปที่รายการ</p>
   </div>
   <div className="inline-flex items-center h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-600">
     Active {filteredDisplayItems.length.toLocaleString()} / {masterStats.total.toLocaleString()} SKU
   </div>
 </div>
 <div className="hidden lg:flex flex-wrap items-center gap-2">
   {[
     { id: 'all', label: 'ทั้งหมด', count: presetCounts.all },
     { id: 'low-stock', label: 'ใกล้หมด', count: presetCounts.lowStock },
     { id: 'out-of-stock', label: 'ของหมด', count: presetCounts.outOfStock },
     { id: 'with-repair', label: 'มีซ่อม', count: presetCounts.withRepair },
     { id: 'in-warehouse', label: 'มี stock ในคลัง', count: presetCounts.inWarehouse },
   ].map((preset) => (
     <button
       key={preset.id}
       type="button"
       onClick={() => applyQuickPreset(preset.id as 'all' | 'low-stock' | 'out-of-stock' | 'with-repair' | 'in-warehouse')}
       className={`h-8 px-3 rounded-lg border text-[11px] font-bold inline-flex items-center gap-2 ${quickPreset === preset.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200'}`}
     >
       {preset.label}
       <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md text-[10px] font-black ${quickPreset === preset.id ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-500'}`}>{preset.count}</span>
     </button>
   ))}
 </div>
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
  {quickPreset !== 'all' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold">preset: {quickPreset === 'low-stock' ? 'ใกล้หมด' : quickPreset === 'out-of-stock' ? 'ของหมด' : quickPreset === 'with-repair' ? 'มีซ่อม' : 'มี stock ในคลัง'}</span>}
  {sortOrder !== 'default' && <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 font-bold">sort: {sortOrder === 'name-asc' ? 'A → Z' : sortOrder === 'stock-asc' ? 'Stock ↑' : 'Stock ↓'}</span>}
  {filterType === 'ทั้งหมด' && filterBrand === 'ทั้งหมด' && filterName === 'ทั้งหมด' && filterCondition === 'ทั้งหมด' && filterDetail === 'ทั้งหมด' && !qtyLimit && !searchTerm && quickPreset === 'all' && sortOrder === 'default' && (
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
 onClick={() => { setSearchTerm(''); setQtyLimit(''); setFilterType('ทั้งหมด'); setFilterBrand('ทั้งหมด'); setFilterName('ทั้งหมด'); setFilterCondition('ทั้งหมด'); setFilterDetail('ทั้งหมด'); setQuickPreset('all'); setSortOrder('default'); }}
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
    <div className="hidden lg:flex items-center justify-between gap-3 px-1 pt-1">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Results Zone</p>
        <p className="text-[12px] font-semibold text-slate-500 mt-1">รายการที่พร้อมให้แก้ไข/ตรวจ stock ต่อทันที</p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as 'default' | 'name-asc' | 'stock-asc' | 'stock-desc')}
          className="h-8 bg-white border border-slate-100 rounded-lg px-2.5 text-[10px] font-bold text-slate-600 focus:border-indigo-300 outline-none appearance-none cursor-pointer"
        >
          <option value="default">เรียง: ค่าเริ่มต้น</option>
          <option value="name-asc">A → Z</option>
          <option value="stock-asc">Stock น้อย → มาก</option>
          <option value="stock-desc">Stock มาก → น้อย</option>
        </select>
        <div className="hidden lg:flex items-center h-8 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden">
          <button
            onClick={() => setViewMode('card')}
            className={`h-8 px-2.5 text-[10px] font-bold ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >การ์ด</button>
          <button
            onClick={() => setViewMode('table')}
            className={`h-8 px-2.5 text-[10px] font-bold border-l border-slate-100 ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >ตาราง</button>
        </div>
        <div className="inline-flex items-center h-8 px-2.5 rounded-lg bg-white border border-slate-100 text-[10px] font-bold text-slate-600">
          {viewMode === 'card' ? 'Cards' : 'Rows'} {filteredDisplayItems.length.toLocaleString()}
        </div>
      </div>
    </div>
    {viewMode === 'card' ? (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 pb-20">
    {sortedItems.map((item, idx) => {
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
    ) : (
    <div className="hidden lg:block overflow-x-auto pb-20">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-200 text-left sticky top-0 z-10">
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">SKU#</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">ประเภท</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">รายการ</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">ยี่ห้อ</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">สภาพ</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] text-right">Stock</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] text-right">พร้อมใช้</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">คลัง</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">สถานะ</th>
            <th className="px-3 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] w-24"></th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, idx) => {
            const t = Number(item.จำนวน) || 0;
            const rp = Number(item.repair_qty) || 0;
            const ls = Number(item.lost_qty) || 0;
            const sc = Number(item.scrap_qty) || 0;
            const qu = Number(item.quarantine_qty) || 0;
            const tr = Number(item.transit_qty) || 0;
            const av = Math.max(t - rp - ls - sc - qu - tr, 0);
            const sc2 = t <= 0 ? 'text-rose-500' : 'text-emerald-500';
            const ws = (item.warehouse_stocks || []).filter((s: any) => s.stock > 0);
            const wn: Record<number, string> = {};
            (warehouses || []).forEach((w: any) => { wn[w.id] = w.name; });
            const hasIssue = rp > 0 || qu > 0 || tr > 0 || ls > 0 || sc > 0;
            return (
              <tr key={idx} className="border-b border-slate-100 hover:bg-indigo-50/20 transition-colors">
                <td className="px-3 py-2 text-[10px] font-bold text-slate-400 whitespace-nowrap">#{item.rowIndex ?? idx + 1}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase">{item.ประเภท}</span>
                </td>
                <td className="px-3 py-2 text-[12px] font-bold text-slate-800 max-w-[180px] truncate">{item.รายการ}</td>
                <td className="px-3 py-2 text-[11px] text-slate-500 max-w-[120px] truncate">{item['ยี่ห้อหรือรูปแบบ'] || '-'}</td>
                <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">{item.สภาพ || 'ปกติ'}</td>
                <td className={`px-3 py-2 text-right text-[12px] font-black whitespace-nowrap ${sc2}`}>{t.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-[12px] font-bold text-emerald-600 whitespace-nowrap">{av.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {ws.slice(0, 2).map((s: any) => (
                      <span key={s.warehouseId} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 whitespace-nowrap">
                        <Warehouse size={9} className="text-slate-300" />
                        {wn[s.warehouseId] || `#${s.warehouseId}`} <span className="text-indigo-500">{s.stock}</span>
                      </span>
                    ))}
                    {ws.length > 2 && <span className="text-[9px] text-slate-300 font-medium">+{ws.length - 2}</span>}
                    {ws.length === 0 && <span className="text-[9px] text-slate-300 italic">-</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {hasIssue ? (
                      <>
                        {rp > 0 && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold">ซ่อม {rp}</span>}
                        {qu > 0 && <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded text-[9px] font-bold">กัก {qu}</span>}
                        {tr > 0 && <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-100 rounded text-[9px] font-bold">โอน {tr}</span>}
                        {ls > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-bold">หาย {ls}</span>}
                        {sc > 0 && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-bold">scrap {sc}</span>}
                      </>
                    ) : (
                      <span className="text-emerald-500 text-[11px] font-bold">✓</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEditItem(item)} className="h-7 px-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600 border border-transparent hover:border-slate-100">แก้ไข</button>
                    <button onClick={() => onDeleteItem(item.rowIndex!)} className="h-7 px-2 hover:bg-rose-50 rounded-lg text-[10px] font-bold text-slate-400 hover:text-rose-500 border border-transparent hover:border-rose-100">ลบ</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    )} 

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

export default React.memo(DesktopSettingsMaster);
