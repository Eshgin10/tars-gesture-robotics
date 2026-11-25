import { useEffect, useState } from 'react';

export type StepVisualKind = 'move' | 'reach' | 'pinch';

/**
 * 3-frame animated 11x11 pixel-art sequences for the "How it works" cards.
 * '.' = transparent, '1' = dim, '2' = mid, '3' = primary ink (#ecece8), '4' = signal orange (#ff4f28)
 */
const PIXEL_FRAMES: Record<StepVisualKind, string[][]> = {
  move: [
    [
      '.....3.....',
      '....333....',
      '...3.2.3...',
      '.....2.....',
      '.3.......3.',
      '3322.4.2233',
      '.3.......3.',
      '.....2.....',
      '...3.2.3...',
      '....333....',
      '.....3.....',
    ],
    [
      '.....4.....',
      '....444....',
      '...4.2.4...',
      '.....2.....',
      '.3....4..4.',
      '3322...2244',
      '.3.......4.',
      '.....2.....',
      '...3.2.3...',
      '....333....',
      '.....3.....',
    ],
    [
      '.....3.....',
      '....333....',
      '...3.2.3...',
      '.....2.....',
      '.4.......3.',
      '4422...2233',
      '.4..4....3.',
      '.....2.....',
      '...4.2.4...',
      '....444....',
      '.....4.....',
    ],
  ],
  reach: [
    [
      '3333.......',
      '3..3.......',
      '3..3.......',
      '33341......',
      '...12......',
      '.....222222',
      '.....2....2',
      '.....2.22.2',
      '.....2.22.2',
      '.....2....2',
      '.....222222',
    ],
    [
      '2222.......',
      '2..2.......',
      '2..2.......',
      '22221......',
      '...14......',
      '.....333333',
      '.....3....3',
      '.....3.44.3',
      '.....3.44.3',
      '.....3....3',
      '.....333333',
    ],
    [
      '1111.......',
      '1..1.......',
      '1..1.......',
      '11111......',
      '...12......',
      '.....333333',
      '.....344443',
      '.....342243',
      '.....342243',
      '.....344443',
      '.....333333',
    ],
  ],
  pinch: [
    [
      '...33333...',
      '..3.....3..',
      '.22....222.',
      '...........',
      '232....444.',
      '232....444.',
      '232....444.',
      '...........',
      '.22....222.',
      '..3.....3..',
      '...33333...',
    ],
    [
      '...........',
      '...33333...',
      '..3.....3..',
      '.22....222.',
      '232....444.',
      '232....444.',
      '232....444.',
      '.22....222.',
      '..3.....3..',
      '...33333...',
      '...........',
    ],
    [
      '...........',
      '...33333...',
      '..3.....3..',
      '.22....444.',
      '232....444.',
      '232....444.',
      '232....444.',
      '.22....444.',
      '..3.....3..',
      '...33333...',
      '...........',
    ],
  ],
};

const CELL_FILL: Record<string, string> = {
  '1': 'rgba(255,255,255,0.22)',
  '2': 'rgba(255,255,255,0.48)',
  '3': '#ecece8',
  '4': '#ff4f28',
};

const GRID = 11;
const CELL = 2.6;
const GAP = 0.6;
const STRIDE = CELL + GAP;
const VIEW = GRID * STRIDE - GAP;

export function StepPixelVisual({ kind, size = 36 }: { kind: StepVisualKind; size?: number }) {
  const frames = PIXEL_FRAMES[kind];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 480);
    return () => window.clearInterval(id);
  }, [frames.length]);

  const rows = frames[frame];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="shrink-0 opacity-90 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:opacity-100"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {rows.map((row, y) =>
        Array.from(row).map((ch, x) => {
          const fill = CELL_FILL[ch];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x * STRIDE} y={y * STRIDE} width={CELL} height={CELL} fill={fill} />;
        }),
      )}
    </svg>
  );
}
