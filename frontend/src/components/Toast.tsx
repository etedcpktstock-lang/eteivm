import React, { useState, useCallback, createContext, useContext } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const alertType = {
    success: 'alert-success',
    error: 'alert-error',
    info: 'alert-info',
    warning: 'alert-warning',
  };

  const iconType = {
    success: 'done_all',
    error: 'error',
    info: 'info',
    warning: 'warning',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-md">
          <div className={`alert ${alertType[toast.type]} border border-base-300 rounded-xl text-sm font-medium`}>
            <span className="material-symbols-outlined text-[20px] shrink-0">{iconType[toast.type]}</span>
            <span className="flex-1 leading-5">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
