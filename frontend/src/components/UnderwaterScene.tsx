import { memo, useEffect, useRef } from 'react';
import type { Density } from '../hooks/useDensity';

type Bubble = { x: number; y: number; radius: number; speed: number; drift: number };

const particlesByDensity: Record<Density, number> = {
  compact: 12,
  comfortable: 20,
  relaxed: 30,
};

function UnderwaterScene({ density, reducedMotion }: { density: Density; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let paused = false;
    let bubbles: Bubble[] = [];

    const createBubble = (): Bubble => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1 + Math.random() * 4,
      speed: 0.2 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.4,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      bubbles = Array.from({ length: particlesByDensity[density] }, createBubble);
    };

    const drawFrame = () => {
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#03132d');
      gradient.addColorStop(0.55, '#041f3d');
      gradient.addColorStop(1, '#020916');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.14;
      context.fillStyle = '#67e8f9';
      context.beginPath();
      context.ellipse(width * 0.2, height * 0.15, width * 0.32, 90, 0, 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 1;
      for (const bubble of bubbles) {
        context.beginPath();
        context.fillStyle = 'rgba(186,230,253,0.42)';
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.fill();

        if (!reducedMotion) {
          bubble.y -= bubble.speed;
          bubble.x += bubble.drift;

          if (bubble.y + bubble.radius < 0 || bubble.x < -20 || bubble.x > width + 20) {
            bubble.x = Math.random() * width;
            bubble.y = height + 8;
          }
        }
      }

      if (!reducedMotion && !paused) {
        frameId = window.requestAnimationFrame(drawFrame);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        paused = true;
        window.cancelAnimationFrame(frameId);
      } else {
        paused = false;
        if (!reducedMotion) {
          frameId = window.requestAnimationFrame(drawFrame);
        }
      }
    };

    resize();
    drawFrame();

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion || paused) drawFrame();
    });
    observer.observe(document.documentElement);

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [density, reducedMotion]);

  return <canvas ref={canvasRef} className="underwater-canvas" aria-hidden="true" />;
}

export default memo(UnderwaterScene);
