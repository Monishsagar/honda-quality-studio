import { useEffect, useState } from 'react';
import { live, Live } from '../sim/sim';

/** Re-render at a fixed rate with a snapshot of the live simulation. */
export function useLive(hz = 8): Live {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return live;
}

export const fmt = (x: number, d = 0) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
