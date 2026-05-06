import React from 'react';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import type { Transaction } from '../../types';

interface Props {
 history: Transaction[];
}

/**
 * 📜 CustomerSurveyHistory Component
 * Renders the audit log for a specific customer.
 */
export const CustomerSurveyHistory: React.FC<Props> = ({ history }) => {
 if (!history || history.length === 0) {
 return (
 <div className="py-6 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
 <span className="material-symbols-outlined text-[48px] mb-3 opacity-20">history_toggle_off</span>
 <span className="text-[10px] font-black uppercase tracking-[0.2em]">ยังไม่มีประวัติรายการในระบบ</span>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {history.map((t, idx) => (
 <div key={idx} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 flex items-start gap-4 group">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${ t.สถานะ === 'Survey' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400' }`}>
 <span className="material-symbols-outlined text-[24px]">
 {t.สถานะ === 'Survey' ? 'fact_check' : 'history'}
 </span>
 </div>
 <div className="flex-1 min-w-0 text-left">
 <div className="flex justify-between items-start mb-1">
 <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md">{t.สถานะ}</span>
 <span className="text-[10px] text-slate-300 font-bold">{formatThaiDateTime(t["วัน-เวลา"])}</span>
 </div>
 <h4 className="text-[13px] font-black text-slate-800 leading-tight">
 {t.รายการ} {t.ขนาด &&`ขนาด ${t.ขนาด}`}
 </h4>
 <p className="text-[11px] text-slate-400 font-bold mt-1 line-clamp-2">
 {t.หมายเหตุ || 'ไม่มีหมายเหตุ'}
 </p>
 <div className="flex items-center gap-2 mt-2">
 <div className="w-5 h-5 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
 <span className="material-symbols-outlined text-[12px] text-slate-400">person</span>
 </div>
 <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{t.ผู้ทำรายการ}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 );
};
