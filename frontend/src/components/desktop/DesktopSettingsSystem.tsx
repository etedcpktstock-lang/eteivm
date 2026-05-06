import React, { useEffect, useState } from 'react';
import { API_URL } from '../../api';
import {
  Filter, MapPinned, Settings2, ShieldCheck, Sparkles,
  Store, Globe, Clock, Hash, Trash2, Monitor, Database,
  Package, Box, Building2, Truck, ShoppingBag, Archive, Container
} from 'lucide-react';

interface Props {
  user?: any;
  onRefresh?: () => void;
}

const REGIONS = [
  { key: 'CENTRAL', label: 'ภาคกลาง', desc: 'กรุงเทพฯ และปริมณฑล / ตอนกลาง' },
  { key: 'NORTH', label: 'ภาคเหนือ', desc: 'พื้นที่ภาคเหนือทั้งหมด' },
  { key: 'NORTHEAST', label: 'ภาคอีสาน', desc: 'พื้นที่ภาคตะวันออกเฉียงเหนือ' },
  { key: 'EAST', label: 'ภาคตะวันออก', desc: 'โซนตะวันออกและชายฝั่ง' },
  { key: 'WEST', label: 'ภาคตะวันตก', desc: 'พื้นที่ตะวันตก' },
  { key: 'SOUTH', label: 'ภาคใต้', desc: 'พื้นที่ภาคใต้ทั้งหมด' },
];

const APP_ICONS: { id: string; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: 'Package', label: 'กล่องพัสดุ', Icon: Package },
  { id: 'Box', label: 'กล่อง', Icon: Box },
  { id: 'Store', label: 'ร้านค้า', Icon: Store },
  { id: 'Building2', label: 'อาคาร', Icon: Building2 },
  { id: 'Truck', label: 'รถขนส่ง', Icon: Truck },
  { id: 'ShoppingBag', label: 'ถุงช้อปปิ้ง', Icon: ShoppingBag },
  { id: 'Archive', label: 'คลังเก็บ', Icon: Archive },
  { id: 'Container', label: 'ตู้คอนเทนเนอร์', Icon: Container },
];

const TIMEZONES = [
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (UTC+9)' },
  { value: 'UTC', label: 'UTC' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY พ.ศ.', label: '31/12/2568 (พ.ศ.)' },
  { value: 'DD/MM/YYYY', label: '31/12/2025 (ค.ศ.)' },
  { value: 'MM/DD/YYYY', label: '12/31/2025' },
  { value: 'YYYY-MM-DD', label: '2025-12-31 (ISO)' },
];

const DesktopSettingsSystem: React.FC<Props> = ({ user, onRefresh }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [areaFilterOn, setAreaFilterOn] = useState(false);
  const [activeRegions, setActiveRegions] = useState<Record<string, boolean>>({});
  const [clearingCache, setClearingCache] = useState(false);

  const token = user?.token || '';

  useEffect(() => {
    loadSettings();
  }, []);

  const showMessage = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') {
        const next: Record<string, string> = {};
        Object.keys(data)
          .filter((key) => key !== 'status')
          .forEach((key) => {
            next[key] = String(data[key] || '');
          });
        setSettings(next);
        setAreaFilterOn(next.ENABLE_AREA_FILTER === 'true');
        const regionState: Record<string, boolean> = {};
        REGIONS.forEach((region) => {
          regionState[region.key] = next[`FILTER_REG_${region.key}`] !== 'false';
        });
        setActiveRegions(regionState);
      }
    } catch {
      showMessage('โหลดการตั้งค่าระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        ...settings,
        ENABLE_AREA_FILTER: areaFilterOn ? 'true' : 'false',
      };
      REGIONS.forEach((region) => {
        payload[`FILTER_REG_${region.key}`] = activeRegions[region.key] ? 'true' : 'false';
      });

      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: payload }),
      });

      showMessage('บันทึกการตั้งค่าระบบเรียบร้อย');
      onRefresh?.();
    } catch {
      showMessage('บันทึกการตั้งค่าระบบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = () => {
    setClearingCache(true);
    try {
      // Keep auth token, clear everything else
      const keysToKeep = ['token', 'authToken', 'ete-auth-token'];
      const keptValues: Record<string, string> = {};
      keysToKeep.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val) keptValues[key] = val;
      });
      localStorage.clear();
      Object.entries(keptValues).forEach(([key, val]) => localStorage.setItem(key, val));
      showMessage('ล้างแคชเรียบร้อย');
    } catch {
      showMessage('ล้างแคชไม่สำเร็จ');
    } finally {
      setClearingCache(false);
    }
  };

  const activeCount = Object.values(activeRegions).filter(Boolean).length;
  const appName = settings.APP_NAME || 'ETE DC';
  const appIcon = settings.APP_ICON || 'Package';
  const selectedIcon = APP_ICONS.find((i) => i.id === appIcon) || APP_ICONS[0];
  const PreviewIcon = selectedIcon.Icon;

  return (
    <div className="desktop-page">
      {/* Toolbar — actions only */}
      <div className="flex items-center justify-end gap-3 px-6 pt-4">
        {msg && <span className="text-[11px] font-bold text-emerald-600">{msg}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-indigo-600 text-white text-[12px] font-black uppercase tracking-widest disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-6 space-y-6">

          {/* ================================================================ */}
          {/* SECTION 1: แบรนด์ & เอกลักษณ์องค์กร */}
          {/* ================================================================ */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Store size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-slate-900 leading-none">แบรนด์ & เอกลักษณ์องค์กร</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">ชื่อแอป / ไอคอน / แท็บ Browser</p>
                </div>
              </div>
              {/* Live preview */}
              <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl border border-slate-100 px-4 py-2.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <PreviewIcon size={14} />
                </div>
                <span className="text-[13px] font-black text-slate-700">{appName}</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* App Name */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อแอป</label>
                <input
                  type="text"
                  value={settings.APP_NAME || ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, APP_NAME: e.target.value }))}
                  placeholder="ETE DC"
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-violet-300"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">แสดงใน Sidebar และหน้าจอหลัก</p>
              </div>

              {/* App Subtitle */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อรอง (Subtitle)</label>
                <input
                  type="text"
                  value={settings.APP_SUBTITLE || ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, APP_SUBTITLE: e.target.value }))}
                  placeholder="Desktop Admin Workspace"
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-violet-300"
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">ข้อความบรรทัดรองใต้ชื่อแอป</p>
              </div>
            </div>

            {/* Icon picker */}
            <div className="mt-5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">
                ไอคอน Sidebar
              </label>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {APP_ICONS.map((item) => {
                  const IconComp = item.Icon;
                  const active = appIcon === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSettings((prev) => ({ ...prev, APP_ICON: item.id }))}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                        active
                          ? 'bg-violet-50 border-violet-200 text-violet-700'
                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600'
                      }`}
                    >
                      <IconComp size={20} />
                      <span className="text-[9px] font-bold leading-tight text-center">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Browser tab title */}
            <div className="mt-5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อแท็บ Browser</label>
              <input
                type="text"
                value={settings.APP_TITLE || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, APP_TITLE: e.target.value }))}
                placeholder="ETE DC — Admin Workspace"
                className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-violet-300"
              />
              <p className="text-[10px] text-slate-400 mt-1 ml-1">ข้อความที่แสดงบนแท็บ Browser (document.title)</p>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 2: เวลา & ภูมิภาค */}
          {/* ================================================================ */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Globe size={18} strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="text-[16px] font-black text-slate-900 leading-none">เวลา & ภูมิภาค</h3>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Timezone / รูปแบบวันที่</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Timezone */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Timezone</label>
                <select
                  value={settings.TIMEZONE || 'Asia/Bangkok'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, TIMEZONE: e.target.value }))}
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-amber-300"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">ใช้สำหรับการส่งรายงานตามเวลาและบันทึกประวัติ</p>
              </div>

              {/* Date format */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">รูปแบบวันที่</label>
                <select
                  value={settings.DATE_FORMAT || 'DD/MM/YYYY พ.ศ.'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, DATE_FORMAT: e.target.value }))}
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-amber-300"
                >
                  {DATE_FORMATS.map((df) => (
                    <option key={df.value} value={df.value}>{df.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">รูปแบบการแสดงผลวันที่ในรายงานและหน้าจอ</p>
              </div>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 3: ตัวกรองข้อมูลพื้นที่ (existing, kept intact) */}
          {/* ================================================================ */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <MapPinned size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-slate-900 leading-none">ตัวกรองข้อมูลพื้นที่</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">กำหนดภาคที่ระบบอนุญาตให้ใช้งานข้อมูลลูกค้า/พื้นที่</p>
                </div>
              </div>

              <button
                onClick={() => setAreaFilterOn((prev) => !prev)}
                className={`h-11 px-5 rounded-xl text-[12px] font-black uppercase tracking-widest ${
                  areaFilterOn ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {areaFilterOn ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </button>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-white text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <ShieldCheck size={17} strokeWidth={2.4} />
              </div>
              <div>
                <p className="text-[12px] font-black text-emerald-800">แนวทางการใช้งาน</p>
                <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                  ถ้าเปิดใช้งาน ระบบจะกรองจังหวัด/พื้นที่ตามภาคที่เลือกด้านล่างทันที เหมาะสำหรับจำกัดขอบเขตการทำงานของแต่ละศูนย์หรือทีม
                </p>
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <span className={`inline-flex items-center rounded-full px-3 py-1 ${areaFilterOn ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {areaFilterOn ? `${activeCount}/6 ภาคที่ใช้งาน` : 'ปิดใช้งานอยู่'}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {REGIONS.map((region) => {
                const active = !!activeRegions[region.key];
                return (
                  <button
                    key={region.key}
                    onClick={() => areaFilterOn && setActiveRegions((prev) => ({ ...prev, [region.key]: !prev[region.key] }))}
                    disabled={!areaFilterOn}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      !areaFilterOn
                        ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                        : active
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-black leading-none">{region.label}</p>
                        <p className={`mt-2 text-[11px] leading-relaxed ${active && areaFilterOn ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {region.desc}
                        </p>
                      </div>
                      {active && areaFilterOn ? (
                        <div className="w-8 h-8 rounded-xl bg-white text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 4: ข้อมูลระบบ & บำรุงรักษา */}
          {/* ================================================================ */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                <Monitor size={18} strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="text-[16px] font-black text-slate-900 leading-none">ข้อมูลระบบ & บำรุงรักษา</h3>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">Client Version / Clear Cache</p>
              </div>
            </div>

            {/* Version info cards */}
            <div className="grid gap-3 md:grid-cols-3 mb-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash size={14} strokeWidth={2.4} className="text-slate-400" />
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Client Version</p>
                </div>
                <p className="text-[16px] font-black text-slate-900">{settings.APP_VERSION || '—'}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database size={14} strokeWidth={2.4} className="text-slate-400" />
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Database</p>
                </div>
                <p className="text-[16px] font-black text-slate-900">PostgreSQL 16</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} strokeWidth={2.4} className="text-slate-400" />
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Timezone</p>
                </div>
                <p className="text-[16px] font-black text-slate-900">{settings.TIMEZONE || 'Asia/Bangkok'}</p>
              </div>
            </div>

            {/* Clear cache */}
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-[14px] font-black text-rose-700 leading-tight">ล้างแคชเบราว์เซอร์</h4>
                <p className="text-[11px] text-rose-600 font-bold mt-0.5">
                  ลบข้อมูลชั่วคราวในเบราว์เซอร์ (draft, form state, cache) — ไม่กระทบบัญชี
                </p>
              </div>
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="h-11 px-5 rounded-xl bg-white border border-rose-200 text-rose-600 text-[12px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0 hover:bg-rose-50 disabled:opacity-60"
              >
                <Trash2 size={15} strokeWidth={2.4} />
                {clearingCache ? 'กำลังล้าง...' : 'ล้างแคช'}
              </button>
            </div>
          </section>

        </div>
      )}
    </div>
  );
};

export default DesktopSettingsSystem;
