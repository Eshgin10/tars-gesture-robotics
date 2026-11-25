import { useMemo } from 'react';
import { syntheticHand } from '../core/gestures/syntheticHand';
import { GestureName, HAND_CONNECTIONS } from '../core/gestures/types';

/** Schematic hand skeleton for a gesture, rendered from the same procedural hand model used by the simulator. */
export function HandGlyph({ gesture, size = 28, color = 'currentColor', strokeWidth = 1.6 }: { gesture: GestureName; size?: number; color?: string; strokeWidth?: number }) {
  const pts = useMemo(() => {
    const h = syntheticHand(gesture, { center: { x: 0.5, y: 0.5 }, aspect: 1 });
    const xs = h.image.map((p) => p.x);
    const ys = h.image.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = 0.84 / Math.max(maxX - minX, maxY - minY);
    const ox = 0.5 - ((minX + maxX) / 2) * s;
    const oy = 0.5 - ((minY + maxY) / 2) * s;
    return h.image.map((p) => ({ x: (p.x * s + ox) * 100, y: (p.y * s + oy) * 100 }));
  }, [gesture]);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      {HAND_CONNECTIONS.map(([a, b], i) => (
        <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} stroke={color} strokeWidth={strokeWidth * (100 / size)} strokeLinecap="round" />
      ))}
      {[4, 8, 12, 16, 20].map((i) => (
        <circle key={i} cx={pts[i].x} cy={pts[i].y} r={2.2 * (100 / size) * (strokeWidth / 1.6)} fill={color} />
      ))}
    </svg>
  );
}
