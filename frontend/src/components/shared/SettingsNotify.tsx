import React from 'react';
import { API_URL } from '../../api';

interface SettingsNotifyProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  tokens: string[];
  setTokens: React.Dispatch<React.SetStateAction<string[]>>;
  channels: any[];
  setChannels: React.Dispatch<React.SetStateAction<any[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  showSuccess: (msg: string) => void;
  setError: (msg: string) => void;
  onSave: () => Promise<void>;
  testTelegram: () => Promise<any>;
  relinkTelegram: (url: string) => Promise<any>;
  testEmail?: () => Promise<any>;
}

const NOTIFY_TYPES = [
  { id: 'NOTIFY_RECEIVE', label: 'รับเข้า', icon: 'move_item', color: 'emerald' },
  { id: 'NOTIFY_ISSUE', label: 'เบิกออก', icon: 'package_2', color: 'amber' },
  { id: 'NOTIFY_RETURN', label: 'รับคืน', icon: 'assignment_return', color: 'purple' },
  { id: 'NOTIFY_JOB_REQUEST', label: 'แจ้งงานใหม่', icon: 'note_add', color: 'sky' },
  { id: 'NOTIFY_VOID', label: 'ยกเลิก', icon: 'cancel', color: 'rose' },
] as const;

const WEEK_DAYS = [
  { id: 'MON', label: 'จ' }, { id: 'TUE', label: 'อ' }, { id: 'WED', label: 'พ' },
  { id: 'THU', label: 'พฤ' }, { id: 'FRI', label: 'ศ' }, { id: 'SAT', label: 'ส' }, { id: 'SUN', label: 'อา' },
] as const;

const REPORT_CONTENTS = [
  { id: 'RPT_ISSUE', label: 'ยอดเบิกออก' },
  { id: 'RPT_RECEIVE', label: 'ยอดรับเข้า' },
  { id: 'RPT_VOID', label: 'ยอดคืนคลัง (ยกเลิก)', color: 'text-rose-600' },
  { id: 'RPT_LOW_STOCK', label: 'ยอดคงเหลือต่ำ' },
  { id: 'RPT_ALL', label: 'ยอดคงเหลือทั้งหมด', isBold: true },
] as const;

const REPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel', icon: 'table', color: 'emerald' },
  { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf', color: 'rose' },
] as const;

function SettingsNotify({
  settings, setSettings, tokens, setTokens,
  loading, setLoading, showSuccess, setError,
  onSave, testTelegram, relinkTelegram, testEmail,
}: SettingsNotifyProps) {
  const [showToken, setShowToken] = React.useState(false);
  const [showEmailPass, setShowEmailPass] = React.useState(false);

  const toggleSetting = (key: string) => {
    setSettings({ ...settings, [key]: settings[key] === 'true' ? '' : 'true' });
  };

  const toggleBoolean = (key: string) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const currentRptDays: string[] = (settings.RPT_DAYS || '').split(',').filter(Boolean);

  const toggleDay = (dayId: string) => {
    let nextDays;
    if (currentRptDays.includes(dayId)) {
      nextDays = currentRptDays.filter((d: string) => d !== dayId);
    } else {
      nextDays = [...currentRptDays, dayId];
    }
    setSettings({ ...settings, RPT_DAYS: nextDays.join(',') });
  };

  const enabledNotifyCount = NOTIFY_TYPES.filter((t) => settings[t.id] !== '').length;
  const reportFormat = settings.REPORT_FORMAT || 'xlsx';

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto font-bold space-y-6 pb-32 text-left">

      {/* ================================================================ */}
      {/* SECTION 1: TELEGRAM — Real-time Movement Alerts */}
      {/* ================================================================ */}
      <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">send</span>
          </div>
          <div>
            <h3 className="text-[16px] font-black text-slate-900 leading-none">Telegram — แจ้งเตือนความเคลื่อนไหว</h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-wider">แจ้งเตือนทันทีเมื่อมีการรับเข้า/เบิกออก/รับคืน</p>
          </div>
        </div>

        {/* Bot Token + Chat ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">BOT TOKEN</label>
            <div className="relative group overflow-hidden rounded-2xl border border-slate-200">
              <input
                title="Bot Token"
                type={showToken ? 'text' : 'password'}
                value={settings.TG_BOT_TOKEN || ''}
                onChange={e => setSettings({ ...settings, TG_BOT_TOKEN: e.target.value })}
                className="w-full bg-slate-50 border-none h-[50px] rounded-2xl px-5 pr-12 font-bold text-slate-700 focus:bg-white text-[13px]"
                placeholder="Bot Token จาก @BotFather"
              />
              <button
                type="button"
                title="Toggle Token Visibility"
                onClick={() => setShowToken(!showToken)}
                className="absolute top-1/2 -translate-y-1/2 right-2 w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">{showToken ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">CHAT ID</label>
            <input
              title="Chat ID"
              value={settings.TG_CHAT_ID || ''}
              onChange={e => setSettings({ ...settings, TG_CHAT_ID: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 h-[50px] rounded-2xl px-5 font-bold text-slate-700 focus:bg-white text-[13px]"
              placeholder="-1001234567890"
            />
          </div>
        </div>

        {/* Test + Relink */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={async () => {
              try { setLoading(true); const r = await testTelegram(); showSuccess(r.message); }
              catch (e: any) { setError(e.message); } finally { setLoading(false); }
            }}
            className="h-11 bg-sky-50 text-sky-700 rounded-xl text-[12px] font-black uppercase flex items-center justify-center gap-2 border border-sky-100"
          >
            <span className="material-symbols-outlined text-[18px]">send_and_archive</span> ทดลองส่ง
          </button>
          <button
            onClick={async () => {
              const n = window.prompt("API URL:", API_URL);
              if (n) {
                try { setLoading(true); const r = await relinkTelegram(n); showSuccess(r.message); }
                catch (e: any) { setError(e.message); } finally { setLoading(false); }
              }
            }}
            className="h-11 bg-slate-50 text-slate-500 rounded-xl text-[12px] font-black uppercase flex items-center justify-center gap-2 border border-slate-100"
          >
            <span className="material-symbols-outlined text-[18px]">link</span> อัปเดตลิงก์
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Notification Type Toggles */}
        <div>
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">
            ประเภทที่แจ้งผ่าน Telegram: <span className="text-sky-600">{enabledNotifyCount}/{NOTIFY_TYPES.length}</span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {NOTIFY_TYPES.map(ntype => {
              const active = settings[ntype.id] !== '';
              return (
                <button
                  key={ntype.id}
                  onClick={() => toggleSetting(ntype.id)}
                  className={`flex flex-col items-center justify-center gap-1 h-[64px] rounded-2xl border transition-colors ${
                    active
                      ? `bg-${ntype.color}-50 border-${ntype.color}-200 text-${ntype.color}-700`
                      : 'bg-slate-50 border-slate-100 text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{ntype.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider">{ntype.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              title="Toggle Low Stock Notify"
              onClick={() => toggleBoolean('ENABLE_LOW_STOCK_NOTIFY')}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors ${
                settings.ENABLE_LOW_STOCK_NOTIFY === 'true'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-slate-300 border-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
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
              title="Threshold"
              type="number"
              value={settings.LOW_STOCK_THRESHOLD || 3}
              onChange={e => setSettings({ ...settings, LOW_STOCK_THRESHOLD: String(parseInt(e.target.value) || 0) })}
              className="w-12 h-9 bg-slate-50 border-none rounded-lg text-center font-black text-rose-600 text-[15px]"
            />
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* SECTION 2: EMAIL — Report Delivery */}
      {/* ================================================================ */}
      <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">mail</span>
          </div>
          <div>
            <h3 className="text-[16px] font-black text-slate-900 leading-none">Email — ส่งรายงานทางอีเมล</h3>
            <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase tracking-wider">ส่งรายงานสรุปพร้อมไฟล์แนบ Excel / PDF</p>
          </div>
        </div>

        {/* SMTP Config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SMTP Host</label>
            <input
              title="SMTP Host"
              value={settings.EMAIL_HOST || 'smtp.gmail.com'}
              onChange={e => setSettings({ ...settings, EMAIL_HOST: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 h-[50px] rounded-2xl px-5 font-bold text-slate-700 focus:bg-white text-[13px]"
              placeholder="smtp.gmail.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SMTP Port</label>
            <input
              title="SMTP Port"
              type="number"
              value={settings.EMAIL_PORT || 587}
              onChange={e => setSettings({ ...settings, EMAIL_PORT: String(parseInt(e.target.value) || 587) })}
              className="w-full bg-slate-50 border border-slate-200 h-[50px] rounded-2xl px-5 font-bold text-slate-700 focus:bg-white text-[13px]"
              placeholder="587"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Gmail</label>
            <input
              title="Email User"
              value={settings.EMAIL_USER || ''}
              onChange={e => setSettings({ ...settings, EMAIL_USER: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 h-[50px] rounded-2xl px-5 font-bold text-slate-700 focus:bg-white text-[13px]"
              placeholder="your@gmail.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">App Password</label>
            <div className="relative group overflow-hidden rounded-2xl border border-slate-200">
              <input
                title="Email Password"
                type={showEmailPass ? 'text' : 'password'}
                value={settings.EMAIL_PASS || ''}
                onChange={e => setSettings({ ...settings, EMAIL_PASS: e.target.value })}
                className="w-full bg-slate-50 border-none h-[50px] rounded-2xl px-5 pr-12 font-bold text-slate-700 focus:bg-white text-[13px]"
                placeholder="App Password (16 ตัว)"
              />
              <button
                type="button"
                onClick={() => setShowEmailPass(!showEmailPass)}
                className="absolute top-1/2 -translate-y-1/2 right-2 w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">{showEmailPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">From Name</label>
            <input
              title="From Name"
              value={settings.EMAIL_FROM || 'ETEIVM'}
              onChange={e => setSettings({ ...settings, EMAIL_FROM: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 h-[50px] rounded-2xl px-5 font-bold text-slate-700 focus:bg-white text-[13px]"
              placeholder="ETEIVM"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ผู้รับอีเมล (To)</label>
          <input
            title="Email To"
            value={settings.EMAIL_TO || ''}
            onChange={e => setSettings({ ...settings, EMAIL_TO: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 h-[50px] rounded-2xl px-5 font-bold text-slate-700 focus:bg-white text-[13px]"
            placeholder="a@example.com, b@example.com (เว้นว่าง = ส่งให้ตัวเอง)"
          />
        </div>

        {/* Test Email button */}
        {testEmail && (
          <button
            onClick={async () => {
              try { setLoading(true); const r = await testEmail(); showSuccess(r.message); }
              catch (e: any) { setError(e.message); } finally { setLoading(false); }
            }}
            className="h-11 px-5 rounded-xl bg-rose-600 text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            ทดลองส่งอีเมล
          </button>
        )}

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Daily Report */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                title="Toggle Daily Report"
                onClick={() => toggleBoolean('ENABLE_DAILY_REPORT')}
                className={`w-12 h-6.5 rounded-full relative transition-colors ${
                  settings.ENABLE_DAILY_REPORT === 'true' ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <div className={`absolute top-0.5 w-5.5 h-5.5 bg-white rounded-full shadow transition-all ${
                  settings.ENABLE_DAILY_REPORT === 'true' ? 'left-6' : 'left-0.5'
                }`} />
              </button>
              <div>
                <h4 className="text-[14px] font-black text-slate-900 leading-tight">ส่งรายงานสรุปประจำวัน</h4>
                <p className="text-[11px] text-slate-500 font-bold mt-0.5">ส่งรายงานผ่านอีเมลตามวันที่และเวลาที่กำหนด</p>
              </div>
            </div>
          </div>

          {settings.ENABLE_DAILY_REPORT === 'true' && (
            <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100">
              {/* Day selection */}
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                  วันที่ส่งรายงาน:
                  <span className="text-indigo-600">{currentRptDays.length} วัน</span>
                </label>
                <div className="mt-2 flex gap-1.5 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                  {WEEK_DAYS.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => toggleDay(d.id)}
                      className={`flex-1 h-10 rounded-xl text-[12px] font-black transition-colors ${
                        currentRptDays.includes(d.id) ? 'bg-indigo-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Time */}
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">เวลาส่ง:</label>
                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-fit">
                    <input
                      title="Hour"
                      type="number" placeholder="00" min={0} max={23}
                      value={settings.RPT_DAILY_TIME_H || ''}
                      onChange={e => setSettings({ ...settings, RPT_DAILY_TIME_H: e.target.value })}
                      className="w-12 h-10 bg-white border-none rounded-xl text-center font-black text-slate-700 text-[16px]"
                    />
                    <span className="text-slate-300 font-black text-lg">:</span>
                    <input
                      title="Minute"
                      type="number" placeholder="00" min={0} max={59}
                      value={settings.RPT_DAILY_TIME_M || ''}
                      onChange={e => setSettings({ ...settings, RPT_DAILY_TIME_M: e.target.value })}
                      className="w-12 h-10 bg-white border-none rounded-xl text-center font-black text-slate-700 text-[16px]"
                    />
                  </div>
                </div>

                {/* Report contents */}
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">เนื้อหารายงาน:</label>
                  <div className="grid grid-cols-1 gap-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {REPORT_CONTENTS.map(rpt => (
                      <button
                        key={rpt.id}
                        onClick={() => toggleSetting(rpt.id)}
                        className="flex items-center gap-3 w-full text-left py-1"
                      >
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                          settings[rpt.id] === 'true'
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-transparent'
                        }`}>
                          <span className="material-symbols-outlined text-[12px] font-black">check</span>
                        </div>
                        <span className={`text-[13px] leading-tight ${(rpt as any).isBold ? 'font-black text-slate-800' : 'font-bold text-slate-500'} ${(rpt as any).color || ''}`}>
                          {rpt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Report format */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 block mb-2">
                  รูปแบบไฟล์แนบ:
                </label>
                <div className="flex gap-3">
                  {REPORT_FORMATS.map(fmt => {
                    const active = reportFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        onClick={() => setSettings({ ...settings, REPORT_FORMAT: fmt.id })}
                        className={`h-[50px] px-5 rounded-2xl border flex items-center gap-2.5 text-[13px] font-black transition-colors ${
                          active
                            ? fmt.id === 'xlsx'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{fmt.icon}</span>
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={loading}
          className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 text-[14px] uppercase tracking-widest disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span className="material-symbols-outlined text-[22px]">save</span>
              บันทึกการตั้งค่าทั้งหมด
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default React.memo(SettingsNotify);
