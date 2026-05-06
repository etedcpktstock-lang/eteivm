import React from 'react';
import { InlineSpinner } from '../shared/CommonUI';

interface Props {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string;
 itemDisplay?: React.ReactNode;
 confirmText?: string;
 cancelText?: string;
 isLoading?: boolean;
}

export default function ConfirmationModal({
 isOpen,
 onClose,
 onConfirm,
 title,
 message,
 itemDisplay,
 confirmText ="ยืนยันดำเนินการ",
 cancelText ="ยกเลิก",
 isLoading = false
}: Props) {
 if (!isOpen) return null;

 const isDelete = title.includes('ลบ') || title.includes('ยกเลิก');

 return (
 <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
 <div 
 className="absolute inset-0 bg-black/50"
 onClick={onClose}
 ></div>

 <div className="relative w-full max-w-[400px] rounded-3xl border border-base-300 bg-base-100 p-6 text-center flex flex-col items-center shadow-none">
 <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-base-300 ${isDelete ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
 <span className="material-symbols-outlined text-[32px]">
 info
 </span>
 </div>

 <div className="space-y-2 mb-6">
 <h3 className="text-[20px] font-bold text-base-content leading-tight tracking-tight">{title}</h3>
 <p className="text-base-content/60 font-medium text-[13px] leading-relaxed px-2">{message}</p>
 </div>
 
 {itemDisplay && (
 <div className="w-full mb-6 bg-base-200 rounded-2xl p-4 border border-base-300">
 {typeof itemDisplay === 'string' ? (
 <div className="text-base-content text-center font-semibold text-[18px]">"{itemDisplay}"</div>
 ) : itemDisplay}
 </div>
 )}
 
 <div className="flex flex-col gap-3 w-full items-center">
 <button
 disabled={isLoading}
 onClick={onConfirm}
 className={`btn no-animation w-full h-12 rounded-xl font-semibold text-[14px] flex items-center justify-center ${ isLoading ? 'btn-disabled' : isDelete ? 'btn-error text-white' : 'btn-primary text-white' }`}
 >
 {isLoading ? (
 <InlineSpinner className="text-white" />
 ) : (
 confirmText
 )}
 </button>
 
 <button
 onClick={onClose}
 className="btn btn-outline no-animation w-full h-12 rounded-xl font-semibold text-[14px]"
 >
 {cancelText}
 </button>
 </div>
 </div>
 </div>
 );
}
