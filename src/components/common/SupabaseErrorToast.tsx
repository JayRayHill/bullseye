// Listens for `bullseye:supabase-error` window events and shows a toast
// with the underlying error message. Keeps the data-layer contexts free
// of any toast-provider coupling — they just fire events; this component
// translates events into UI.
//
// Without this, Supabase failures were silent at the UI level (only
// visible in DevTools console). For a multi-rep team app where the
// backend can break for everyone at once, silence is the wrong default.

import { useEffect } from 'react';
import { useToast } from './ToastProvider';

interface SupabaseErrorDetail {
  op: string;
  message: string;
}

export function SupabaseErrorToast() {
  const toast = useToast();
  useEffect(() => {
    const onErr = (e: Event) => {
      const detail = (e as CustomEvent<SupabaseErrorDetail>).detail;
      // Friendlier prefix instead of dumping raw op names. The detailed
      // op + message stays in the console for debugging; the toast is
      // for the rep.
      toast.show(
        'error',
        `Sync error: ${detail.message}. Your action may not have saved across the team.`
      );
    };
    window.addEventListener('bullseye:supabase-error', onErr as EventListener);
    return () => window.removeEventListener('bullseye:supabase-error', onErr as EventListener);
  }, [toast]);
  return null;
}
