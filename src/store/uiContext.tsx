import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ActiveTool, SimulationMode } from '@/types';

interface UIContextValue {
  darkMode: boolean;
  toggleDarkMode: () => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  simulationMode: SimulationMode;
  setSimulationMode: (mode: SimulationMode) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  showImportExport: boolean;
  setShowImportExport: (v: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('state');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(d => !d);

  return (
    <UIContext.Provider value={{
      darkMode, toggleDarkMode,
      activeTool, setActiveTool,
      simulationMode, setSimulationMode,
      selectedNodeId, setSelectedNodeId,
      selectedEdgeId, setSelectedEdgeId,
      showImportExport, setShowImportExport,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
