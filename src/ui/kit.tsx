import { ReactNode, useEffect, useRef, useState } from 'react';
import { RobotPhase } from '../core/robot/controller';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export const COLORS = {
  ink: '#ecece8',
  inv: '#0a0a0b',
  sub: '#b2b2ad',
  mute: '#7a7a7d',
  faint: '#4b4b50',
  accent: '#86d7f2',
  ok: '#62d39b',
  stop: '#ff4b3e',
  info: '#8fb0ff',
};

/** Surface — dark panel with a hairline frame; `dark` renders the inverted (light) emphasis panel. */
export function Card({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={cx('relative overflow-hidden rounded-card border', dark ? 'border-ink bg-ink text-inv' : 'border-hair bg-card', className)}>
      {children}
    </div>
  );
}

/** Technical crop-mark corners. */
export function Corners({ color = '#ecece8', size = 10, inset = 10, opacity = 0.3 }: { color?: string; size?: number; inset?: number; opacity?: number }) {
  const s = { position: 'absolute' as const, width: size, height: size, opacity, borderColor: color };
  return (
    <div className="pointer-events-none absolute inset-0">
      <span style={{ ...s, left: inset, top: inset, borderLeftWidth: 1, borderTopWidth: 1 }} />
      <span style={{ ...s, right: inset, top: inset, borderRightWidth: 1, borderTopWidth: 1 }} />
      <span style={{ ...s, left: inset, bottom: inset, borderLeftWidth: 1, borderBottomWidth: 1 }} />
      <span style={{ ...s, right: inset, bottom: inset, borderRightWidth: 1, borderBottomWidth: 1 }} />
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('label', className)}>{children}</span>;
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return <span className={cx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', pulse && 'animate-pulseSoft')} style={{ background: color }} />;
}

type Tone = 'dark' | 'outline' | 'ghost' | 'accent' | 'stop' | 'soft' | 'ok';
export function Button({
  children,
  onClick,
  tone = 'outline',
  size = 'md',
  disabled,
  title,
  className,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  className?: string;
  active?: boolean;
}) {
  const tones: Record<Tone, string> = {
    dark: 'bg-ink text-inv border-ink hover:bg-white',
    outline: 'bg-transparent text-ink border-ink/20 hover:border-ink/60',
    ghost: 'bg-transparent text-sub border-transparent hover:text-ink hover:bg-white/[0.04]',
    accent: 'bg-accent text-inv border-accent hover:bg-[#a3e3f7]',
    stop: 'bg-stop text-white border-stop hover:bg-[#ff6257]',
    soft: 'bg-paper text-ink border-line hover:border-ink/40',
    ok: 'bg-ok text-inv border-ok hover:bg-[#7fe0b0]',
  };
  const sizes = { sm: 'h-7 px-3 text-[12px]', md: 'h-9 px-4 text-[13px]', lg: 'h-11 px-5 text-[14px]' };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        sizes[size],
        active ? 'border-ink bg-ink text-inv' : tones[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('mono h-6 rounded-full px-2.5 text-[10.5px] uppercase tracking-wider transition-colors', value === o.value ? 'bg-ink text-inv' : 'text-mute hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, color = COLORS.ink, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx('relative h-[3px] overflow-hidden rounded-full bg-white/[0.08]', className)}>
      <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function Kbd({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <kbd className={cx('mono inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1 text-[10px]', dark ? 'border-inv/30 text-inv/80' : 'border-line bg-paper text-sub')}>
      {children}
    </kbd>
  );
}

export const PHASE_STYLE: Record<RobotPhase, { label: string; color: string }> = {
  STANDBY: { label: 'Standby', color: COLORS.info },
  HOMING: { label: 'Homing', color: COLORS.accent },
  IDLE: { label: 'Ready', color: COLORS.ok },
  PICKING: { label: 'Grasping', color: COLORS.accent },
  CARRYING: { label: 'Holding part', color: COLORS.ok },
  PLACING: { label: 'Placing', color: COLORS.accent },
  MOVING: { label: 'Moving', color: COLORS.accent },
  PAUSED: { label: 'Paused', color: COLORS.accent },
  ESTOP: { label: 'Emergency stop', color: COLORS.stop },
};

/** Lightweight popover menu anchored to its trigger; closes on outside click / Esc. */
export function Popover({
  trigger,
  children,
  align = 'left',
  side = 'top',
  width = 320,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right' | 'center';
  side?: 'top' | 'bottom';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative min-w-0" {...(open ? { 'data-popover-open': '' } : {})}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          className={cx(
            'absolute z-40 animate-fadeUp rounded-card border border-line bg-paper p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2',
          )}
          style={{ width }}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

/**
 * TARS mark — a stepped "T": framed top bar with a slot, two side blocks and a stem.
 * Geometry traced from the brand image (120 × 116 units).
 */
export function TarsMark({ size = 22, color = COLORS.ink, wing }: { size?: number; color?: string; wing?: string }) {
  return (
    <svg width={size} height={(size * 116) / 120} viewBox="0 0 120 116" aria-hidden>
      {/* top bar: rounded frame with an inner slot */}
      <path
        fillRule="evenodd"
        fill={color}
        d="M9 0H111a9 9 0 0 1 9 9V38H0V9a9 9 0 0 1 9-9ZM12 7H108a4 4 0 0 1 4 4V31a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z"
      />
      {/* side blocks (slightly toned, as in the brand mark) */}
      <path fill={wing ?? color} fillOpacity={wing ? 1 : 0.93} d="M0 37H40V78H6a6 6 0 0 1-6-6ZM80 37H120V72a6 6 0 0 1-6 6H80Z" />
      {/* stem */}
      <path fill={color} d="M40 37H80V108a7 7 0 0 1-7 7H47a7 7 0 0 1-7-7Z" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="TARS logo" width={30} height={30} className="h-[30px] w-[30px] rounded-lg ring-1 ring-white/10" draggable={false} />
      <span className="display text-[15px] tracking-[0.32em]">TARS</span>
    </div>
  );
}

/** Hairline rule with optional leading label and trailing index (reference: "INFOGRAPHICS ——— 04"). */
export function Rule({ label, index, className }: { label?: ReactNode; index?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center gap-3', className)}>
      {label && <span className="label whitespace-nowrap">{label}</span>}
      <span className="h-px flex-1 bg-line" />
      {index && <span className="mono text-[10.5px] text-mute">{index}</span>}
    </div>
  );
}

/** Technical-overview figure: label over a hairline, large numeral, muted unit and secondary value. */
export function Stat({ label, value, unit, secondary, className, tone }: { label: string; value: ReactNode; unit?: string; secondary?: ReactNode; className?: string; tone?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="label mb-1.5 border-b border-line pb-1.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-[24px] font-light leading-none tracking-tight" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
        {unit && <span className="mono text-[10.5px] text-mute">{unit}</span>}
      </div>
      {secondary !== undefined && <div className="mono tnum mt-1 text-[11px] text-faint">{secondary}</div>}
    </div>
  );
}
