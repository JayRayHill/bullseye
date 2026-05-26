// Tweens an integer from 0 → target over `duration` ms using rAF and an
// easeOutCubic curve so the count decelerates as it lands — feels more
// natural than a linear ramp. Cancels cleanly on unmount or target change.
//
// Used by the StatsStrip chips so the header numbers animate up on data
// load instead of popping in fully formed (the "first impression" moment
// when a rep opens the app with a persisted dataset).

import { useEffect, useRef, useState } from 'react';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  // We track the most recent target so a re-trigger mid-animation reads
  // the correct end value from inside the rAF closure.
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    // If the target is 0 (or negative), skip the animation — nothing to
    // count to, and showing 0 → 0 is a wasted rAF cycle.
    if (target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const v = Math.round(easeOutCubic(t) * targetRef.current);
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
