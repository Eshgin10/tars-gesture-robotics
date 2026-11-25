type Corner = 'tl' | 'tr' | 'bl' | 'br';

const POS: Record<Corner, string> = {
  tl: 'top-0 left-0',
  tr: 'top-0 right-0',
  bl: 'bottom-0 left-0',
  br: 'bottom-0 right-0',
};

function filletPath(corner: Corner, r: number): string {
  switch (corner) {
    case 'tl':
      return `M0 0 H${r} A${r} ${r} 0 0 0 0 ${r} Z`;
    case 'tr':
      return `M${r} 0 H0 A${r} ${r} 0 0 1 ${r} ${r} Z`;
    case 'bl':
      return `M0 ${r} V0 A${r} ${r} 0 0 0 ${r} ${r} Z`;
    case 'br':
      return `M${r} ${r} V0 A${r} ${r} 0 0 1 0 ${r} Z`;
  }
}

/**
 * Quarter-circle inverse radius wedge placed in the corner of a dark cutout cell
 * to create a seamless tangent fillet between two orthogonal light attached blocks.
 */
export function ConcaveFillet({
  corner,
  size = 26,
  color = '#ecece8',
  className = '',
}: {
  corner: Corner;
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`pointer-events-none absolute ${POS[corner]} ${className}`}
      aria-hidden
    >
      <path d={filletPath(corner, size)} fill={color} />
    </svg>
  );
}
