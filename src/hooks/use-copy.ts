import { useState } from 'react';

export function useCopy(timeout = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), timeout);
    } catch {
      setCopied(false);
    }
  };

  return { copied, copy };
}
