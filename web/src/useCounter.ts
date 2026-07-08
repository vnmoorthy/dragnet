import { useEffect, useRef, useState } from 'react';

// requestAnimationFrame count-up with easeOutCubic. Cancels on unmount / dep change.
export function useCounter(target: number, duration = 600, deps: unknown[] = []) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    let start = 0;
    const from = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(tick);
    // guarantee the final value even if rAF is throttled (e.g. background tab)
    const guard = window.setTimeout(() => setValue(target), duration + 80);
    return () => { cancelAnimationFrame(raf.current); clearTimeout(guard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps]);

  return value;
}
