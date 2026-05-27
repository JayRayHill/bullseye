// CampaignContext is ephemeral selection state: which leads are checked,
// which template is active, and any in-drawer edits to the subject/body.
// Nothing here is persisted — campaigns are session-scoped.
//
// We also expose a `drawerOpen` flag so the "Build campaign (N selected)" bar
// in the DetailPanel can open the drawer without prop-drilling through Shell.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { EMAIL_TEMPLATES } from '../lib/email/templates';

interface CampaignContextValue {
  selectedLeadIds: Set<string>;
  activeTemplateId: string;
  customizedSubject: string | null;
  customizedBody: string | null;
  drawerOpen: boolean;
  /** Optional explicit anchor — set by the per-lead "Send email" flow when
   *  the active customer IS the recipient lead (not a closed customer) and
   *  the rep needs a separate proof-point anchor. The drawer prefers this
   *  over the active customer when resolving its anchor.
   *  Cleared automatically when the drawer closes. */
  overrideAnchorId: string | null;

  toggleLead: (id: string) => void;
  selectLeads: (ids: string[], selected: boolean) => void;
  clearSelection: () => void;

  setActiveTemplate: (id: string) => void;
  setCustomizedSubject: (next: string | null) => void;
  setCustomizedBody: (next: string | null) => void;
  resetCustomizations: () => void;

  openDrawer: () => void;
  /** Open the drawer with a single specific lead + an explicit anchor.
   *  Replaces any existing selection. Used by the "Send email" button on
   *  open-lead detail cards, where the rep wants to email this one lead
   *  using a previously-viewed (or auto-picked nearest) closed customer
   *  as the proof point. */
  openDrawerForLead: (leadId: string, anchorId: string) => void;
  closeDrawer: () => void;
}

const CampaignContext = createContext<CampaignContextValue | undefined>(undefined);

export function CampaignProvider({
  defaultTemplateId,
  children,
}: {
  defaultTemplateId: string;
  children: ReactNode;
}) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [activeTemplateId, setActiveTemplateIdState] = useState(
    () => EMAIL_TEMPLATES.find((t) => t.id === defaultTemplateId)?.id ?? EMAIL_TEMPLATES[0].id
  );
  const [customizedSubject, setCustomizedSubjectState] = useState<string | null>(null);
  const [customizedBody, setCustomizedBodyState] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overrideAnchorId, setOverrideAnchorId] = useState<string | null>(null);

  const toggleLead = useCallback((id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectLeads = useCallback((ids: string[], selected: boolean) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLeadIds(new Set());
    setCustomizedSubjectState(null);
    setCustomizedBodyState(null);
  }, []);

  const setActiveTemplate = useCallback((id: string) => {
    setActiveTemplateIdState(id);
    // Switching templates discards any edits — surprising otherwise.
    setCustomizedSubjectState(null);
    setCustomizedBodyState(null);
  }, []);

  const resetCustomizations = useCallback(() => {
    setCustomizedSubjectState(null);
    setCustomizedBodyState(null);
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const openDrawerForLead = useCallback((leadId: string, anchorId: string) => {
    // Replace any prior selection — this entry point is "email THIS one
    // lead," not "add to existing batch."
    setSelectedLeadIds(new Set([leadId]));
    setOverrideAnchorId(anchorId);
    // Reset any in-drawer customizations from a previous campaign so the
    // new flow opens with a fresh template state.
    setCustomizedSubjectState(null);
    setCustomizedBodyState(null);
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Clear the override on close so the next normal "Build campaign"
    // flow doesn't accidentally inherit the override.
    setOverrideAnchorId(null);
  }, []);

  const value = useMemo<CampaignContextValue>(
    () => ({
      selectedLeadIds,
      activeTemplateId,
      customizedSubject,
      customizedBody,
      drawerOpen,
      overrideAnchorId,
      toggleLead,
      selectLeads,
      clearSelection,
      setActiveTemplate,
      setCustomizedSubject: setCustomizedSubjectState,
      setCustomizedBody: setCustomizedBodyState,
      resetCustomizations,
      openDrawer,
      openDrawerForLead,
      closeDrawer,
    }),
    [
      selectedLeadIds,
      activeTemplateId,
      customizedSubject,
      customizedBody,
      drawerOpen,
      overrideAnchorId,
      toggleLead,
      selectLeads,
      clearSelection,
      setActiveTemplate,
      resetCustomizations,
      openDrawer,
      openDrawerForLead,
      closeDrawer,
    ]
  );

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaign must be used inside CampaignProvider');
  return ctx;
}
