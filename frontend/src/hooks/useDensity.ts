import { useEffect, useState } from 'react';

export type Density = 'compact' | 'comfortable' | 'relaxed';

function computeDensity(width: number, height: number): Density {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  if (coarsePointer || width < 740 || height < 760) {
    return 'compact';
  }

  if (width > 1500 && height > 920) {
    return 'relaxed';
  }

  return 'comfortable';
}

export function useDensity(): Density {
  const [density, setDensity] = useState<Density>(() =>
    computeDensity(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setDensity(computeDensity(window.innerWidth, window.innerHeight));
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return density;
}
