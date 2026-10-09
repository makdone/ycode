import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copy a string to the clipboard and expose a transient `copied` flag for
 * button feedback. Resets after `resetMs`.
 */
export function useCopyToClipboard(resetMs: number = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), resetMs);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [resetMs]);

  return { copied, copy };
}
