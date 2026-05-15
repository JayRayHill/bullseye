// SelectionContext holds purely ephemeral UI state: which customer is "active"
// (panel open, leads visible) and which is being hovered. We deliberately do not
// persist this — hover state writing to IndexedDB on every mouse-move would be
// absurd, and resuming with a pre-selected customer is more confusing than helpful.

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface SelectionContextValue {
  activeCustomerId: string | null;
  hoveredId: string | null;
  setActive: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextValue | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const setActive = useCallback((id: string | null) => setActiveCustomerId(id), []);
  const setHovered = useCallback((id: string | null) => setHoveredId(id), []);
  const clearSelection = useCallback(() => {
    setActiveCustomerId(null);
    setHoveredId(null);
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({ activeCustomerId, hoveredId, setActive, setHovered, clearSelection }),
    [activeCustomerId, hoveredId, setActive, setHovered, clearSelection]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider');
  return ctx;
}
