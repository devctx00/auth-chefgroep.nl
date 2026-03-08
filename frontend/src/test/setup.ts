import '@testing-library/jest-dom/vitest';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
    writable: true,
  });
}

HTMLCanvasElement.prototype.getContext = () =>
  ({
    setTransform: () => undefined,
    createLinearGradient: () => ({
      addColorStop: () => undefined,
    }),
    fillRect: () => undefined,
    beginPath: () => undefined,
    ellipse: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    fillStyle: '#000',
    globalAlpha: 1,
  }) as unknown as CanvasRenderingContext2D;
