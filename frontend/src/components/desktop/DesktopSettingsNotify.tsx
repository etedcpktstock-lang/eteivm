import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../api';
import { Bell, Mail, MessageCircleMore, Send, ShieldCheck, AlertTriangle, FileSpreadsheet, FileText } from 'lucide-react';

interface Props {
  user?: any;
  onRefresh?: () => void;
}

const NOTIFY_TYPES = [
  { id: 'NOTIFY_RECEIVE', label: 'รับเข้า', icon: '📥', color: 'emerald' },
  { id: 'NOTIFY_ISSUE', label: 'เบิกออก', icon: '📤', color: 'amber' },
  { id: 'NOTIFY_RETURN', label: 'รับคืน', icon: '🔄', color: 'purple' },
  { id: 'NOTIFY_JOB_REQUEST', label: 'แจ้งงานใหม่', icon: '📝', color: 'sky' },
  { id: 'NOTIFY_VOID', label: 'ยกเลิก', icon: '🚫', color: 'rose' },
] as const;

const WEEK_DAYS = [
  { id: 'MON', label: 'จ' },
  { id: 'TUE', label: 'อ' },
  { id: 'WED', label: 'พ' },
  { id: 'THU', label: 'พฤ' },
  { id: 'FRI', label: 'ศ' },
  { id: 'SAT', label: 'ส' },
  { id: 'SUN', label: 'อา' },
] as const;

const REPORT_CONTENTS = [
  { id: 'RPT_ISSUE', label: 'ยอดเบิกออก' },
  { id: 'RPT_RECEIVE', label: 'ยอดรับเข้า' },
  { id: 'RPT_VOID', label: 'ยอดคืนคลัง (ยกเลิก)', extraClass: 'text-rose-600' },
  { id: 'RPT_LOW_STOCK', label: 'ยอดคงเหลือต่ำ' },
  { id: 'RPT_ALL', label: 'ยอดคงเหลือทั้งหมด', bold: true },
] as const;

const REPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { id: 'pdf', label: 'PDF', icon: FileText },
] as const;

const DesktopSettingsNotify: React.FC<Props> = ({ user, onRefresh }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [msg, setMsg] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showEmailPass, setShowEmailPass] = useState(false);

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
      }
    } catch {
      showMessage('โหลดการตั้งค่าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        TG_BOT_TOKEN: settings.TG_BOT_TOKEN || '',
        TG_CHAT_ID: settings.TG_CHAT_ID || '',
        EMAIL_HOST: settings.EMAIL_HOST || 'smtp.gmail.com',
        EMAIL_PORT: settings.EMAIL_PORT || '587',
        EMAIL_USER: settings.EMAIL_USER || '',
        EMAIL_PASS: settings.EMAIL_PASS || '',
        EMAIL_TO: settings.EMAIL_TO || '',
        EMAIL_FROM: settings.EMAIL_FROM || 'ETEIVM',
        // Telegram movement alerts
        NOTIFY_RECEIVE: settings.NOTIFY_RECEIVE || 'true',
        NOTIFY_ISSUE: settings.NOTIFY_ISSUE || 'true',
        NOTIFY_RETURN: settings.NOTIFY_RETURN || 'true',
        NOTIFY_JOB_REQUEST: settings.NOTIFY_JOB_REQUEST || 'true',
        NOTIFY_VOID: settings.NOTIFY_VOID || 'true',
        // Low stock alert (sent via Telegram)
        ENABLE_LOW_STOCK_NOTIFY: settings.ENABLE_LOW_STOCK_NOTIFY || '',
        LOW_STOCK_THRESHOLD: settings.LOW_STOCK_THRESHOLD || '3',
        // Email daily report
        ENABLE_DAILY_REPORT: settings.ENABLE_DAILY_REPORT || '',
        RPT_DAYS: settings.RPT_DAYS || '',
        RPT_DAILY_TIME_H: settings.RPT_DAILY_TIME_H || '',
        RPT_DAILY_TIME_M: settings.RPT_DAILY_TIME_M || '',
        RPT_ISSUE: settings.RPT_ISSUE || '',
        RPT_RECEIVE: settings.RPT_RECEIVE || '',
        RPT_VOID: settings.RPT_VOID || '',
        RPT_LOW_STOCK: settings.RPT_LOW_STOCK || '',
        RPT_ALL: settings.RPT_ALL || '',
        // Email report format
        REPORT_FORMAT: settings.REPORT_FORMAT || 'xlsx',
      };

      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: payload }),
      });

      showMessage('บันทึกการตั้งค่าแจ้งเตือนเรียบร้อย');
      onRefresh?.();
    } catch {
      showMessage('บันทึกการตั้งค่าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    try {
      const res = await fetch(`${API_URL}/settings/testTelegram`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showMessage(data.message || 'ส่งข้อความทดสอบแล้ว');
    } catch {
      showMessage('ส่งข้อความ Telegram ไม่สำเร็จ');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await fetch(`${API_URL}/settings/testEmail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showMessage(data.message || 'ส่งอีเมลทดสอบแล้ว');
    } catch {
      showMessage('ส่งอีเมลทดสอบไม่สำเร็จ');
    } finally {
      setTestingEmail(false);
    }
  };

  const toggleSetting = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: prev[key] === 'true' ? '' : 'true' }));
  };

  const enabledNotifyCount = NOTIFY_TYPES.filter((t) => settings[t.id] !== '').length;
  const currentRptDays: string[] = (settings.RPT_DAYS || '').split(',').filter(Boolean);
  const reportFormat = settings.REPORT_FORMAT || 'xlsx';

  const toggleDay = (dayId: string) => {
    let nextDays: string[];
    if (currentRptDays.includes(dayId)) {
      nextDays = currentRptDays.filter((d) => d !== dayId);
    } else {
      nextDays = [...currentRptDays, dayId];
    }
    setSettings((prev) => ({ ...prev, RPT_DAYS: nextDays.join(',') }));
  };

  return (
    <div className="desktop-page">
      {/* Toolbar — actions only, no duplicate header (tab pill already shows tab name) */}
      <div className="flex items-center justify-end gap-3 px-6 pt-4">
        {msg && <span className="text-[11px] font-bold text-emerald-600">{msg}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-rose-600 text-white text-[12px] font-black uppercase tracking-widest disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* ================================================================ */}
          {/* SECTION 1: TELEGRAM — แจ้งเตือนความเคลื่อนไหว (Movement Alerts) */}
          {/* ================================================================ */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <Send size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-slate-900 leading-none">Telegram — แจ้งเตือนความเคลื่อนไหว</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    แจ้งเตือนทันทีเมื่อมีการ รับเข้า / เบิกออก / รับคืน / แจ้งงาน / ยกเลิก
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-sky-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-sky-700">
                Real‑time
              </div>
            </div>

            {/* Telegram config inputs */}
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Bot Token</label>
                <div className="mt-1.5 relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={settings.TG_BOT_TOKEN || ''}
                    onChange={(e) => setSettings((prev) => ({ ...prev, TG_BOT_TOKEN: e.target.value }))}
                    placeholder="กรอก Bot Token จาก @BotFather"
                    className="w-full h-[50px] px-5 pr-12 text-[13px] font-bold text-slate-700 bg-transparent outline-none border-0"
                  />
                  <button
                    onClick={() => setShowToken((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white text-slate-400 flex items-center justify-center border border-slate-100"
                  >
                    <span className="material-symbols-outlined text-[18px]">{showToken ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chat ID</label>
                <input
                  type="text"
                  value={settings.TG_CHAT_ID || ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, TG_CHAT_ID: e.target.value }))}
                  placeholder="กรอก Chat ID เช่น -1001234567890"
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none focus:border-sky-300"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-5" />

            {/* Notification type toggles */}
            <div className="mb-1">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">
                ประเภทที่ต้องการให้ Telegram แจ้งเตือน: <span className="text-sky-600">{enabledNotifyCount}/{NOTIFY_TYPES.length} รายการ</span>
              </label>
              <div className="grid grid-cols-5 gap-3">
                {NOTIFY_TYPES.map((ntype) => {
                  const active = settings[ntype.id] !== '';
                  return (
                    <button
                      key={ntype.id}
                      onClick={() => toggleSetting(ntype.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-2xl border transition-colors ${
                        active
                          ? `bg-${ntype.color}-50 border-${ntype.color}-200 text-${ntype.color}-700`
                          : 'bg-slate-50 border-slate-100 text-slate-300'
                      }`}
                    >
                      <span className="text-[22px]">{ntype.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider">{ntype.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-5" />

            {/* Low Stock Alert — stays under Telegram */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 mb-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleSetting('ENABLE_LOW_STOCK_NOTIFY')}
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-colors ${
                      settings.ENABLE_LOW_STOCK_NOTIFY === 'true'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-300 border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {settings.ENABLE_LOW_STOCK_NOTIFY === 'true' ? 'notifications_active' : 'notifications_off'}
                    </span>
                  </button>
                  <div>
                    <h4 className="text-[14px] font-black text-slate-900 leading-tight">เตือนสต็อกใกล้หมด</h4>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">แจ้งเตือนผ่าน Telegram เมื่อสต็อกต่ำกว่าเกณฑ์</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-black text-slate-300 uppercase ml-2 tracking-tighter">ต่ำกว่า ≤</span>
                  <input
                    type="number"
                    value={settings.LOW_STOCK_THRESHOLD || 3}
                    onChange={(e) => setSettings((prev) => ({ ...prev, LOW_STOCK_THRESHOLD: String(parseInt(e.target.value) || 0) }))}
                    className="w-[50px] h-9 bg-slate-50 border-none rounded-lg text-center font-black text-rose-600 text-[15px] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tips + Test */}
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 flex items-start gap-3 flex-1">
                <div className="w-9 h-9 rounded-xl bg-white text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                  <ShieldCheck size={17} strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-[12px] font-black text-sky-800">คำแนะนำ</p>
                  <p className="text-[11px] text-sky-700 mt-1 leading-relaxed">ใช้ Bot Token จาก @BotFather และ Chat ID ของกลุ่ม จากนั้นกดทดลองส่งเพื่อตรวจสอบก่อนใช้งานจริง</p>
                </div>
              </div>
              <button
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="h-11 px-5 rounded-xl bg-sky-600 text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0 disabled:opacity-60"
              >
                <Send size={15} strokeWidth={2.4} />
                {testingTelegram ? 'กำลังส่ง...' : 'ทดลองส่ง'}
              </button>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 2: EMAIL — รายงานทางอีเมล (Report Delivery) */}
          {/* ================================================================ */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Mail size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-slate-900 leading-none">Email — ส่งรายงานทางอีเมล</h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                    ส่งรายงานสรุปประจำวัน/สัปดาห์ พร้อมไฟล์แนบ Excel หรือ PDF
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700">
                Report
              </div>
            </div>

            {/* SMTP Config */}
            <div className="mb-5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">ตั้งค่า SMTP (Gmail)</label>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SMTP Host</label>
                  <input
                    type="text"
                    value={settings.EMAIL_HOST || 'smtp.gmail.com'}
                    onChange={(e) => setSettings((prev) => ({ ...prev, EMAIL_HOST: e.target.value }))}
                    className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SMTP Port</label>
                  <input
                    type="text"
                    value={settings.EMAIL_PORT || '587'}
                    onChange={(e) => setSettings((prev) => ({ ...prev, EMAIL_PORT: e.target.value }))}
                    className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mb-5">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Gmail</label>
                <input
                  type="text"
                  value={settings.EMAIL_USER || ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, EMAIL_USER: e.target.value }))}
                  placeholder="your@gmail.com"
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">App Password</label>
                <div className="mt-1.5 relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                  <input
                    type={showEmailPass ? 'text' : 'password'}
                    value={settings.EMAIL_PASS || ''}
                    onChange={(e) => setSettings((prev) => ({ ...prev, EMAIL_PASS: e.target.value }))}
                    placeholder="App Password (16 ตัวอักษร)"
                    className="w-full h-[50px] px-5 pr-12 text-[13px] font-bold text-slate-700 bg-transparent outline-none border-0"
                  />
                  <button
                    onClick={() => setShowEmailPass((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-white text-slate-400 flex items-center justify-center border border-slate-100"
                  >
                    <span className="material-symbols-outlined text-[18px]">{showEmailPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">From Name</label>
                <input
                  type="text"
                  value={settings.EMAIL_FROM || 'ETEIVM'}
                  onChange={(e) => setSettings((prev) => ({ ...prev, EMAIL_FROM: e.target.value }))}
                  className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ผู้รับอีเมล (To)</label>
              <input
                type="text"
                value={settings.EMAIL_TO || ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, EMAIL_TO: e.target.value }))}
                placeholder="a@example.com, b@example.com (เว้นว่าง = ส่งให้ตัวเอง)"
                className="w-full mt-1.5 h-[50px] rounded-2xl px-5 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 outline-none"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-5" />

            {/* Daily Report */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 mb-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleSetting('ENABLE_DAILY_REPORT')}
                    className={`w-12 h-6.5 rounded-full relative transition-colors ${
                      settings.ENABLE_DAILY_REPORT === 'true' ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5.5 h-5.5 bg-white rounded-full shadow transition-all ${
                        settings.ENABLE_DAILY_REPORT === 'true' ? 'left-6' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <div>
                    <h4 className="text-[14px] font-black text-slate-900 leading-tight">ส่งรายงานสรุปประจำวัน</h4>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">ส่งรายงานสรุปผ่านอีเมลตามวันที่และเวลาที่กำหนด</p>
                  </div>
                </div>
              </div>

              {settings.ENABLE_DAILY_REPORT === 'true' && (
                <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100">
                  {/* Day selection */}
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      วันที่ส่งรายงาน: <span className="text-indigo-600">{currentRptDays.length} วัน</span>
                    </label>
                    <div className="mt-2 flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                      {WEEK_DAYS.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => toggleDay(d.id)}
                          className={`flex-1 h-10 rounded-xl text-[12px] font-black transition-colors ${
                            currentRptDays.includes(d.id)
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-300 hover:text-slate-500'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Time */}
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">เวลาส่ง:</label>
                      <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-fit">
                        <input
                          type="number"
                          placeholder="00"
                          min={0}
                          max={23}
                          value={settings.RPT_DAILY_TIME_H || ''}
                          onChange={(e) => setSettings((prev) => ({ ...prev, RPT_DAILY_TIME_H: e.target.value }))}
                          className="w-[52px] h-10 bg-white border-none rounded-xl text-center font-black text-slate-700 text-[16px] outline-none"
                        />
                        <span className="text-slate-300 font-black text-lg">:</span>
                        <input
                          type="number"
                          placeholder="00"
                          min={0}
                          max={59}
                          value={settings.RPT_DAILY_TIME_M || ''}
                          onChange={(e) => setSettings((prev) => ({ ...prev, RPT_DAILY_TIME_M: e.target.value }))}
                          className="w-[52px] h-10 bg-white border-none rounded-xl text-center font-black text-slate-700 text-[16px] outline-none"
                        />
                      </div>
                    </div>

                    {/* Report contents */}
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">เนื้อหารายงาน:</label>
                      <div className="grid grid-cols-1 gap-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        {REPORT_CONTENTS.map((rpt) => (
                          <button
                            key={rpt.id}
                            onClick={() => toggleSetting(rpt.id)}
                            className="flex items-center gap-3 w-full text-left py-1"
                          >
                            <div
                              className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                                settings[rpt.id] === 'true'
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white border-slate-200 text-transparent'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] font-black">check</span>
                            </div>
                            <span
                              className={`text-[13px] leading-tight ${(rpt as any).bold ? 'font-black text-slate-800' : 'font-bold text-slate-500'} ${(rpt as any).extraClass || ''}`}
                            >
                              {rpt.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Report format — Excel / PDF */}
                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">
                      รูปแบบไฟล์แนบ:
                    </label>
                    <div className="flex gap-3">
                      {REPORT_FORMATS.map((fmt) => {
                        const Icon = fmt.icon;
                        const active = reportFormat === fmt.id;
                        return (
                          <button
                            key={fmt.id}
                            onClick={() => setSettings((prev) => ({ ...prev, REPORT_FORMAT: fmt.id }))}
                            className={`h-[50px] px-5 rounded-2xl border flex items-center gap-2.5 text-[13px] font-black transition-colors ${
                              active
                                ? fmt.id === 'xlsx'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            <Icon size={18} strokeWidth={2.4} />
                            {fmt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test email button */}
            <button
              onClick={handleTestEmail}
              disabled={testingEmail}
              className="h-11 px-5 rounded-xl bg-rose-600 text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60"
            >
              <Mail size={15} strokeWidth={2.4} />
              {testingEmail ? 'กำลังส่ง...' : 'ทดลองส่งอีเมล'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

export default DesktopSettingsNotify;
