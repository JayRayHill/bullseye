// SelectionContext holds purely ephemeral UI state: which customer is "active"
// (panel open, leads visible) and which is being hovered. We deliberately do not
// persist this — hover state writing to IndexedDB on every mouse-move would be
// absurd, and resuming with a pre-selected customer is more confusing than helpful.
//
// `lastAnchorId` is a separate piece of state from `activeCustomerId`: it tracks
// the most recent CLOSED customer the rep viewed. Used to preserve the "I came
// from Lone Star Foods" context when the rep drills from a closed customer into
// one of its nearby open leads. Without it, the campaign drawer would lose the
// proof-point anchor as soon as the rep clicked into a specific lead.

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

interface SelectionContextValue {
  activeCustomerId: string | null;
  hoveredId: string | null;
  /** The most recent CLOSED customer the rep viewed in this session. Carries
   *  proof-point context across drill-downs into open leads. Null until the
   *  rep has activated at least one closed customer. Cleared by Reset. */
  lastAnchorId: string | null;
  setActive: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  /** Called by an effect in Shell that watches activeCustomerId + dataset:
   *  whenever the active customer turns out to be a closed customer, the
   *  effect calls this to record them as the latest anchor. Kept as a
   *  separate setter (rather than auto-derived inside SelectionContext)
   *  because SelectionContext doesn't have access to the Customer dataset. */
  setLastAnchor: (id: string | null) => void;
  clearSelection: () => void;
}

const SelectionContext = createContext<SelectionContextValue | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lastAnchorId, setLastAnchorIdState] = useState<string | null>(null);

  const setActive = useCallback((id: string | null) => setActiveCustomerId(id), []);
  const setHovered = useCallback((id: string | null) => setHoveredId(id), []);
  const setLastAnchor = useCallback((id: string | null) => setLastAnchorIdState(id), []);
  const clearSelection = useCallback(() => {
    setActiveCustomerId(null);
    setHoveredId(null);
    // Reset clears the anchor too — explicit "clean slate" semantics, so
    // the next open-lead click falls back to nearest-closed instead of
    // surfacing a stale anchor the rep was no longer thinking about.
    setLastAnchorIdState(null);
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({
      activeCustomerId,
      hoveredId,
      lastAnchorId,
      setActive,
      setHovered,
      setLastAnchor,
      clearSelection,
    }),
    [activeCustomerId, hoveredId, lastAnchorId, setActive, setHovered, setLastAnchor, clearSelection]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used inside SelectionProvider');
  return ctx;
}
