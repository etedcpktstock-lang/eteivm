import React, { createContext, useReducer, useContext } from 'react';
import type { User } from '../types';

interface AppState {
  user: User | null;
  settings: any;
  loading: boolean;
  onlineCount: number;
  latency: number | null;
  activeTab: string;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SETTINGS'; payload: any }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ONLINE_COUNT'; payload: number }
  | { type: 'SET_LATENCY'; payload: number | null }
  | { type: 'SET_ACTIVE_TAB'; payload: string };

const initialState: AppState = {
  user: null,
  settings: {},
  loading: false,
  onlineCount: 0,
  latency: null,
  activeTab: typeof window !== 'undefined' ? localStorage.getItem('ete-active-tab') || 'welcome' : 'welcome',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ONLINE_COUNT':
      return { ...state, onlineCount: action.payload };
    case 'SET_LATENCY':
      return { ...state, latency: action.payload };
    case 'SET_ACTIVE_TAB':
      if (typeof window !== 'undefined') localStorage.setItem('ete-active-tab', action.payload);
      return { ...state, activeTab: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
