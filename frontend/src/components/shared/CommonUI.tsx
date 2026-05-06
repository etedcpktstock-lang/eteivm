import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- BUTTONS ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
 isLoading?: boolean;
 leftIcon?: string;
 rightIcon?: string;
 size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Button: React.FC<ButtonProps> = ({
 variant = 'primary',
 isLoading = false,
 leftIcon,
 rightIcon,
 size = 'md',
 children,
 className = '',
 disabled,
 ...props
}) => {
 const baseStyles = "btn no-animation normal-case tracking-normal font-semibold border border-base-300 disabled:opacity-50 disabled:pointer-events-none";

 const sizeStyles = {
 xs: "btn-xs min-h-8",
 sm: "btn-sm min-h-9",
 md: "btn-md min-h-11",
 lg: "btn-lg min-h-12",
 xl: "btn-lg min-h-14 px-8"
 };

 const variants = {
 primary: "btn-primary text-white",
 secondary: "btn-neutral text-white",
 success: "btn-success text-white",
 danger: "btn-error text-white",
 ghost: "btn-ghost text-base-content",
 outline: "btn-outline border-base-300 text-base-content"
 };

 return (
 <button
 className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className}`}
 disabled={disabled || isLoading}
 {...props}
 >
  {isLoading ? (
  <span className="app-spinner-sm" aria-hidden="true"></span>
  ) : (
<>
 {leftIcon && <span className="material-symbols-outlined text-[20px]">{leftIcon}</span>}
 {children}
 {rightIcon && <span className="material-symbols-outlined text-[20px]">{rightIcon}</span>}
 </>
 )}
 </button>
 );
};

// --- ICONS ---
export const Icon: React.FC<{ name: string; className?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }> = ({ name, className = '', size = 'md' }) => {
 const sizes = {
 xs: "text-[14px]",
 sm: "text-[18px]",
 md: "text-[24px]",
 lg: "text-[32px]",
 xl: "text-[48px]"
 };
 return (
 <span className={`material-symbols-outlined ${sizes[size]} ${className}`}>
 {name}
 </span>
 );
};

// --- LOADING ---

export const LoadingOverlay: React.FC<{ message?: string }> = ({ message = "กำลังโหลดข้อมูล..." }) => (
 <div className="fixed inset-0 bg-black/30 z-[9999] flex items-center justify-center p-6">
 <div className="card bg-base-100 border border-base-300 p-6 w-full max-w-sm shadow-none">
 <div className="flex items-center gap-3">
 <span className="app-spinner" aria-hidden="true"></span>
 <div>
 <p className="text-sm font-semibold text-base-content">{message}</p>
 <p className="text-xs text-base-content/60">กรุณารอสักครู่</p>
 </div>
 </div>
 </div>
 </div>
);

export const InlineSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
 <span className={`app-spinner-sm ${className}`} aria-hidden="true"></span>
);

// --- NOTIFICATIONS (TOAST) ---
export const Toast: React.FC<{
 type?: 'success' | 'error' | 'info' | 'warning';
 message: string;
 onClose?: () => void
}> = ({ type = 'info', message, onClose }) => {
 const alertType = {
 success: 'alert-success',
 error: 'alert-error',
 info: 'alert-info',
 warning: 'alert-warning'
 };

 const icons = {
 success: 'check_circle',
 error: 'error',
 info: 'info',
 warning: 'warning'
 };

 return (
 <div className={`alert ${alertType[type]} border border-base-300 rounded-xl text-sm font-medium max-w-md`}>
 <span className="material-symbols-outlined text-[20px] shrink-0">{icons[type]}</span>
 <span className="flex-1 leading-5">{message}</span>
 {onClose && (
 <button onClick={onClose} className="btn btn-ghost btn-xs no-animation" aria-label="close toast">
 <span className="material-symbols-outlined text-[18px]">close</span>
 </button>
 )}
 </div>
 );
};

// --- INPUTS & SELECTS ---
export const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }> = ({ label, error, className = '', id, ...props }) => {
 const generatedId = id || Math.random().toString(36).substr(2, 9);
 return (
 <div className="space-y-2 w-full">
 {label && <label htmlFor={generatedId} className="text-[12px] font-semibold text-base-content/70">{label}</label>}
 <div className="relative">
 <input
 id={generatedId}
 className={`input input-bordered w-full h-11 rounded-xl text-[14px] font-medium ${error ? 'input-error' : ''} ${className}`}
 {...props}
 />
 </div>
 {error && <p className="text-[11px] font-medium text-error">{error}</p>}
 </div>
 );
};

export const FormCheckbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, className = '', id, ...props }) => {
 const generatedId = id || Math.random().toString(36).substr(2, 9);
 return (
 <label htmlFor={generatedId} className={`flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-100 ${className}`}>
 <input
 id={generatedId}
 type="checkbox"
 className="checkbox checkbox-sm checkbox-primary"
 {...props}
 />
 <span className="text-[14px] font-medium text-base-content">{label}</span>
 </label>
 );
};

export const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }> = ({ label, error, className = '', id, children, ...props }) => {
 const generatedId = id || Math.random().toString(36).substr(2, 9);
 return (
 <div className="space-y-2 w-full">
 {label && <label htmlFor={generatedId} className="text-[12px] font-semibold text-base-content/70">{label}</label>}
 <div className="relative">
 <select
 id={generatedId}
 className={`select select-bordered w-full h-11 rounded-xl text-[14px] font-medium ${error ? 'select-error' : ''} ${className}`}
 {...props}
 >
 {children}
 </select>
 </div>
 {error && <p className="text-[11px] font-medium text-error">{error}</p>}
 </div>
 );
};

// --- IMAGE LIGHTBOX (FULLSCREEN VIEW) ---
export const ImageLightbox: React.FC<{
 isOpen: boolean;
 imageUrl: string;
 onClose: () => void;
}> = ({ isOpen, imageUrl, onClose }) => {
 return (
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4 md:p-12 cursor-pointer"
 onClick={onClose}
 >
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.8, opacity: 0 }}
 transition={{ type: "spring", damping: 25, stiffness: 200 }}
 className="relative max-w-full max-h-full flex items-center justify-center"
 onClick={(e) => e.stopPropagation()}
 >
 <img 
 src={imageUrl} 
 alt="Preview" 
 className="max-w-full max-h-[90vh] object-contain rounded-2xl border border-white/10"
 />
 
 <button
 onClick={onClose}
 className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center border border-white/20 "
 >
 <span className="material-symbols-outlined text-[32px]">close</span>
 </button>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
};
