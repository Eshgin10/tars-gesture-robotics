import { ReactNode, useEffect, useRef, useState } from 'react';
import { useBridge } from '../state/store';
import { ConcaveFillet } from './ConcaveFillet';
import { Reveal } from './Reveal';
import { StepPixelVisual, StepVisualKind } from './StepPixelVisual';

function useCountUp(target: number, active: boolean, duration = 1100, decimals = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, duration, target]);
  return decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

/** Image with a fallback (generated renders live in /img, older crops act as backup). */
function Img({ src, fallback, alt, className }: { src: string; fallback: string; alt: string; className?: string }) {
  const [s, setS] = useState(asset(src));
  const fb = asset(fallback);
  return <img src={s} alt={alt} onError={() => s !== fb && setS(fb)} className={className} draggable={false} />;
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
      <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function Mark({ className = '' }: { className?: string }) {
  return <img src={asset('logo.png')} alt="" className={`h-7 w-7 rounded-md ${className}`} draggable={false} />;
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const STEPS: [string, StepVisualKind, string, string][] = [
  ['01', 'move', 'Move', 'Left, right, up and down in the camera frame moves the arm across the bench and lifts it.'],
  ['02', 'reach', 'Reach', 'Bring your hand closer to the camera to reach forward. Pull it back to retract.'],
  ['03', 'pinch', 'Pinch', 'Close your thumb and index finger to grab a part, and open them to drop it.'],
];

const JOINT_TICKERS = [
  'J1 · ±165°',
  'J2 · −35/155°',
  'J3 · −165/60°',
  'J4 · ±180°',
  'J5 · ±135°',
  'J6 · ±200°',
];

const JOINT_BARS = [
  { id: 'J1', role: 'BASE', range: '±165°', span: 330, h: 66 },
  { id: 'J2', role: 'SHOULDER', range: '−35°..155°', span: 190, h: 38 },
  { id: 'J3', role: 'ELBOW', range: '−165°..60°', span: 225, h: 45 },
  { id: 'J4', role: 'FOREARM', range: '±180°', span: 360, h: 72 },
  { id: 'J5', role: 'WRIST', range: '±135°', span: 270, h: 54 },
  { id: 'J6', role: 'TOOL', range: '±200°', span: 400, h: 84 },
];

const LINK_SEGMENTS = [
  ['L1', '0.32m'],
  ['L2', '0.42m'],
  ['L3', '0.38m'],
  ['L4', '0.19m'],
];

const FAQ: [string, string][] = [
  ['Do I need special hardware?', 'No. Any ordinary webcam works. If you don’t have one, a simulated hand lets you drive the same pipeline with your mouse.'],
  ['How does grabbing work?', 'The gap between your thumb and index finger sets the gripper opening. Close them around a part to grab it, and open them to drop it.'],
  ['Does my video leave the computer?', 'No. Hand tracking runs entirely in your browser. No frames are uploaded anywhere.'],
  ['Can it drive real hardware?', 'Yes. Enable the built-in rosbridge client in Settings to publish joint states and commands to a ROS 2 node.'],
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const set = useBridge((s) => s.set);
  const [faq, setFaq] = useState<number | null>(0);
  const [activeJoint, setActiveJoint] = useState(5);
  const [chartHovered, setChartHovered] = useState(false);
  const [specsInView, setSpecsInView] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const specsRef = useRef<HTMLElement>(null);
  const selectedJoint = JOINT_BARS[activeJoint];

  useEffect(() => {
    const el = specsRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSpecsInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSpecsInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!specsInView || chartHovered) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveJoint((j) => (j + 1) % JOINT_BARS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [specsInView, chartHovered]);

  const axesCount = useCountUp(6, specsInView, 850);
  const landmarksCount = useCountUp(21, specsInView, 1000);
  const strokeCount = useCountUp(95, specsInView, 1100);
  const chainCount = useCountUp(1.31, specsInView, 1150, 2);
  const speedCount = useCountUp(45, specsInView, 1100);
  const reachCount = useCountUp(0.79, specsInView, 1200, 2);

  const enter = () => set({ user: { name: 'Operator', email: '' }, view: 'workspace' });

  return (
    <div className="min-h-screen w-full bg-[#050506] font-sans text-[#ecece8] antialiased selection:bg-signal selection:text-[#0a0a0b]">
      <main className="mx-auto max-w-[1200px] px-3 pt-3 md:px-5 md:pt-5">
        {/* ---------------- Hero panel (enclosed nav + 6x4 stepped grid) ---------------- */}
        <section
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMouse({
              x: ((e.clientX - r.left) / r.width - 0.5) * 2,
              y: ((e.clientY - r.top) / r.height - 0.5) * 2,
            });
          }}
          onMouseLeave={() => setMouse({ x: 0, y: 0 })}
          className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0b0b0c] p-4 md:p-7"
        >
          {/* Enclosed pill navbar */}
          <header className="flex h-12 items-center justify-between rounded-full border border-white/15 bg-[#050506]/60 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2.5">
              <Mark className="h-6 w-6" />
              <span className="text-[14px] font-semibold tracking-tight">TARS</span>
            </div>
            <nav className="hidden items-center gap-8 text-[12.5px] text-white/60 md:flex">
              <a href="#how" className="transition-colors hover:text-[#ecece8]">Control</a>
              <a href="#features" className="transition-colors hover:text-[#ecece8]">Workcell</a>
              <a href="#specs" className="transition-colors hover:text-[#ecece8]">Specs</a>
              <a href="#faq" className="transition-colors hover:text-[#ecece8]">FAQ</a>
            </nav>
            <button
              type="button"
              onClick={enter}
              className="inline-flex h-7 items-center gap-1.5 border-l border-white/15 pl-4 text-[12.5px] font-medium text-[#ecece8] transition-colors hover:text-signal md:pl-5"
            >
              Open workcell <span aria-hidden>↗</span>
            </button>
          </header>

          {/* 6-column x 4-row stepped architectural grid */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:mt-7 md:grid-cols-[1.85fr_0.9fr_0.85fr_1.45fr_1fr_1fr] md:gap-0">
            {/* Main headline canvas: Cols 1-3, Rows 1-2 */}
            <div className="flex items-center rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-3 md:col-start-1 md:row-span-2 md:row-start-1 md:rounded-none md:rounded-bl-[24px] md:rounded-tl-[24px] md:p-11">
              <h1 className="text-[42px] font-medium leading-[1.02] tracking-[-0.04em] md:text-[56px] lg:text-[62px]">
                {['Your hand', 'is the', 'controller.', 'Zero hardware.'].map((line, i) => (
                  <span key={line} className="block overflow-hidden pb-[0.04em]">
                    <span className="anim-line-mask block" style={{ animationDelay: `${i * 85}ms` }}>
                      {line}
                    </span>
                  </span>
                ))}
              </h1>
            </div>

            {/* Upper-center white extension: Col 4, Row 1 */}
            <div
              className="anim-lobe-x hidden bg-[#ecece8] md:col-start-4 md:row-start-1 md:block md:min-h-[128px] md:rounded-tr-[24px]"
              style={{ animationDelay: '180ms' }}
            />

            {/* Top-right dark callout: Col 5, Row 1 */}
            <div className="anim-hero-up relative flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-5 md:row-start-1 md:min-h-[128px] md:rounded-none" style={{ animationDelay: '220ms' }}>
              <ConcaveFillet corner="bl" size={22} className="hidden md:block" />
              <span className="font-mono text-[15px] leading-none text-signal">+</span>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Vision</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Tracks your hand movements directly in the browser.</p>
              </div>
            </div>

            {/* Top-right detached accent launch square: Col 6, Row 1 */}
            <button
              type="button"
              onClick={enter}
              aria-label="Open workcell"
              style={{ animationDelay: '280ms' }}
              className="anim-hero-up group hidden items-end justify-end rounded-[24px] bg-signal p-5 text-[#0a0a0b] transition-colors hover:bg-[#ff6240] active:scale-[0.98] md:col-start-6 md:row-start-1 md:flex md:min-h-[128px]"
            >
              <span className="text-[26px] leading-none transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                ↗
              </span>
            </button>

            {/* Central dark rounded visual window: Col 4, Row 2 */}
            <div className="rounded-[20px] bg-[#ecece8] p-2 md:col-start-4 md:row-start-2 md:rounded-none">
              <div className="anim-hero-media relative aspect-[5/4] h-full w-full overflow-hidden rounded-[20px] bg-[#060607] ring-1 ring-black/10">
                <div
                  style={{ transform: `translate3d(${mouse.x * 8}px, ${mouse.y * 8}px, 0) scale(1.06)` }}
                  className="h-full w-full transition-transform duration-300 ease-out"
                >
                  <Img
                    src="/img/hero-keyboard.jpg"
                    fallback="/img/hero-arm.jpg"
                    alt="Human and robotic hands side by side on a matte black keyboard"
                    className="h-full w-full object-cover object-center"
                  />
                </div>
                {/* Vision HUD scanline & tracking reticles */}
                <div
                  aria-hidden
                  className="anim-scanline pointer-events-none absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-signal/80 to-transparent"
                />
                <span
                  aria-hidden
                  style={{ transform: `translate3d(${mouse.x * -5}px, ${mouse.y * -5}px, 0)` }}
                  className="pointer-events-none absolute left-[28%] top-[56%] flex h-3 w-3 items-center justify-center transition-transform duration-300 ease-out"
                >
                  <span className="absolute h-3 w-3 animate-ping rounded-full bg-signal/40" />
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                </span>
                <span
                  aria-hidden
                  style={{ transform: `translate3d(${mouse.x * -5}px, ${mouse.y * -5}px, 0)` }}
                  className="pointer-events-none absolute left-[64%] top-[54%] flex h-3 w-3 items-center justify-center transition-transform duration-300 ease-out"
                >
                  <span className="absolute h-3 w-3 animate-ping rounded-full bg-[#ecece8]/30" style={{ animationDelay: '700ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ecece8]" />
                </span>
                <div aria-hidden className="pointer-events-none absolute inset-2.5">
                  <span className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-white/30" />
                  <span className="absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-white/30" />
                  <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-white/30" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-white/30" />
                </div>
              </div>
            </div>

            {/* Middle-right white lobe: Col 5, Row 2 */}
            <div
              className="anim-lobe-x hidden bg-[#ecece8] md:col-start-5 md:row-start-2 md:block md:min-h-[128px] md:rounded-r-[24px]"
              style={{ animationDelay: '260ms' }}
            />

            {/* Bottom-left dark cutout: Col 1, Rows 3-4 */}
            <div className="anim-hero-up relative flex flex-col justify-between rounded-[20px] p-3 pt-4 md:col-start-1 md:row-span-2 md:row-start-3 md:rounded-none md:p-6 md:pr-8" style={{ animationDelay: '300ms' }}>
              <ConcaveFillet corner="tr" size={22} className="hidden md:block" />
              <p className="max-w-[270px] text-[13px] leading-relaxed text-white/60">
                Control a simulated robotic arm in real time using your webcam or mouse. No controllers and no setup.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={enter}
                  className="group inline-flex items-center gap-3 border-b border-signal pb-1.5 text-[13.5px] font-medium text-[#ecece8] transition-colors hover:text-white"
                >
                  <span>Open workcell</span>
                  <span className="text-signal transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                    ↗
                  </span>
                </button>
              </div>
            </div>

            {/* Left downward white tooth: Col 2, Row 3 */}
            <div
              className="anim-lobe-y hidden bg-[#ecece8] md:col-start-2 md:row-start-3 md:block md:min-h-[128px] md:rounded-b-[24px]"
              style={{ animationDelay: '340ms' }}
            />

            {/* Middle dark cutout: Col 3, Rows 3-4 */}
            <div className="relative hidden md:col-start-3 md:row-span-2 md:row-start-3 md:block">
              <ConcaveFillet corner="tl" size={22} />
              <ConcaveFillet corner="tr" size={22} />
            </div>

            {/* Lower-center white lobe: Col 4, Row 3 */}
            <div
              className="anim-lobe-y hidden bg-[#ecece8] md:col-start-4 md:row-start-3 md:block md:min-h-[128px] md:rounded-bl-[24px]"
              style={{ animationDelay: '420ms' }}
            />

            {/* Middle-right dark cutout bridging diagonal kiss: Col 5, Row 3 */}
            <div className="relative hidden md:col-start-5 md:row-start-3 md:block md:min-h-[128px]">
              <ConcaveFillet corner="tl" size={22} />
              <ConcaveFillet corner="bl" size={22} />
            </div>

            {/* Bottom-center dark callout bridging diagonal kiss: Col 4, Row 4 */}
            <div className="anim-hero-up relative flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-4 md:row-start-4 md:min-h-[128px] md:rounded-none" style={{ animationDelay: '460ms' }}>
              <ConcaveFillet corner="tr" size={22} className="hidden md:block" />
              <span className="font-mono text-[15px] leading-none text-signal">+</span>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Kinematics</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Follows your reach, tilt and grip naturally.</p>
              </div>
            </div>

            {/* Bottom-right white lobe: Col 5, Row 4 */}
            <div
              className="anim-lobe-y hidden bg-[#ecece8] md:col-start-5 md:row-start-4 md:block md:min-h-[128px] md:rounded-b-[24px] md:rounded-tr-[24px]"
              style={{ animationDelay: '500ms' }}
            />

            {/* Bottom-right dark callout: Col 6, Rows 3-4 */}
            <div className="anim-hero-up flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-6 md:row-span-2 md:row-start-3 md:rounded-none" style={{ animationDelay: '520ms' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" className="anim-spin-slow text-signal" fill="none" aria-hidden>
                <path d="M9 1V17M1 9H17M3.3 3.3L14.7 14.7M14.7 3.3L3.3 14.7" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Safety</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Open your palm anytime to stop the arm immediately.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Control ---------------- */}
        <section id="how" className="pt-28 md:pt-36">
          <Reveal>
            <div className="flex flex-col justify-between gap-4 px-2 md:flex-row md:items-end">
              <div>
                <SectionEyebrow>How it works</SectionEyebrow>
                <h2 className="mt-2 text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Three gestures drive the arm</h2>
              </div>
              <p className="max-w-[360px] text-[13.5px] leading-relaxed text-white/50">
                No wearables or controllers. Move your hand, pinch to grab and let go to place.
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {STEPS.map(([n, kind, t, d], idx) => (
              <Reveal key={n} delay={idx * 90}>
                <div className="group h-full rounded-[24px] border border-white/[0.06] bg-[#0b0b0c] p-7 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-[#111114]">
                  <div className="flex items-start justify-between">
                    <div className="font-mono text-[11px] text-white/35">{n}</div>
                    <StepPixelVisual kind={kind} size={36} />
                  </div>
                  <div className="mt-5 text-[20px] font-medium tracking-[-0.02em]">{t}</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- Workcell ---------------- */}
        <section id="features" className="pt-28 md:pt-36">
          <Reveal>
            <div className="px-2">
              <SectionEyebrow>Workcell</SectionEyebrow>
              <h2 className="mt-2 text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Built for natural manipulation</h2>
            </div>
          </Reveal>

          <Reveal className="mt-8">
            <div className="group relative overflow-hidden rounded-[24px] border border-white/[0.06]">
              <Img
                src="/img/workbench.jpg"
                fallback="/dexterity.jpg"
                alt="Arm picking a cube"
                className="aspect-[16/7] w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 max-w-[390px] p-6 md:p-9">
                <div className="text-[22px] font-medium tracking-[-0.02em]">Human-like dexterity</div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                  The gripper follows the gap between your thumb and index finger, stops on contact and holds on until you let go.
                </p>
              </div>
            </div>
          </Reveal>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Reveal delay={80}>
              <div className="group relative h-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0b0b0c]">
                <Img
                  src="/img/hand.jpg"
                  fallback="/ai-hand.jpg"
                  alt="Hand and gripper"
                  className="aspect-[16/10] h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 max-w-[420px] p-6 md:p-7">
                  <div className="mb-2 h-1.5 w-1.5 rounded-full bg-signal transition-transform duration-300 group-hover:scale-125" aria-hidden />
                  <div className="text-[19px] font-medium tracking-[-0.015em]">On-device vision</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                    Hand tracking runs locally in your browser. No video ever leaves your computer.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div className="group relative h-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0b0b0c]">
                <Img
                  src="/img/gripper.jpg"
                  fallback="/hero-robot.jpg"
                  alt="Gripper close-up"
                  className="aspect-[16/10] h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute bottom-0 left-0 max-w-[420px] p-6 md:p-7">
                  <div className="mb-2 h-1.5 w-1.5 rounded-full bg-signal transition-transform duration-300 group-hover:scale-125" aria-hidden />
                  <div className="text-[19px] font-medium tracking-[-0.015em]">Six degrees of freedom</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                    Smooth articulated motion with workspace limits and instant open-palm stop.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Visual Telemetry & Specs Bento ---------------- */}
        <Reveal>
          <section
            id="specs"
            ref={specsRef}
            className="mt-28 rounded-[28px] border border-white/[0.08] bg-[#0b0b0c] p-3 md:mt-36 md:p-5"
          >
            {/* Top telemetry ticker bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-3 pb-3.5 pt-1 font-mono text-[10.5px] uppercase tracking-[0.1em]">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-white/55">
                <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 text-white/75" fill="currentColor" aria-hidden>
                  {[0, 5, 10].flatMap((y) => [0, 5, 10].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" rx="0.5" />))}
                </svg>
                {JOINT_TICKERS.map((item, i) => (
                  <span key={item} className={`tnum transition-colors duration-300 ${i === activeJoint ? 'text-signal' : ''}`}>
                    {item}
                  </span>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 text-white/70">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" aria-hidden />
                <span>Simulator · Ready</span>
              </div>
            </div>

            {/* Upper bento row */}
            <div className="mt-3 grid gap-2.5 md:grid-cols-12">
              {/* Col 1-3: Stacked 2 tiles */}
              <div className="flex flex-col gap-2.5 md:col-span-3">
                <div className="flex flex-1 flex-col justify-between rounded-xl bg-signal p-5 text-[#0a0a0b]">
                  <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-black/75">
                    <span>Active axes</span>
                    <span>:</span>
                  </div>
                  <div className="mt-6 flex items-baseline justify-between">
                    <span className="tnum font-mono text-[40px] font-medium leading-none">{axesCount}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-black/70">/ 6 DOF</span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between rounded-xl border border-white/[0.06] bg-[#141417] p-5">
                  <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/55">
                    <span>Hand landmarks</span>
                    <span>:</span>
                  </div>
                  <div className="mt-6 flex items-baseline justify-between">
                    <span className="tnum font-mono text-[40px] font-medium leading-none text-[#ecece8]">{landmarksCount}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">/ Frame</span>
                  </div>
                </div>
              </div>

              {/* Col 4-6: Tall fraction & total tile */}
              <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#141417] p-5 md:col-span-3">
                <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/55">
                  <span>Gripper stroke</span>
                  <span>:</span>
                </div>
                <div className="mt-10">
                  <div className="flex items-baseline justify-between">
                    <span className="tnum font-mono text-[44px] font-medium leading-none text-[#ecece8]">{strokeCount}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">/ 95 mm</span>
                  </div>
                  <div className="my-3.5 border-t border-white/[0.08]" />
                  <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.08em]">
                    <span className="text-white/40">Parallel</span>
                    <span className="tnum text-white/75">0 – 95 mm</span>
                  </div>
                </div>
              </div>

              {/* Col 7-12: Wide bar-chart tile */}
              <div
                onMouseEnter={() => setChartHovered(true)}
                onMouseLeave={() => setChartHovered(false)}
                className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#141417] p-5 md:col-span-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/55">Joint range (deg)</span>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    {JOINT_BARS.map((j, i) => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => setActiveJoint(i)}
                        className={`rounded px-1.5 py-0.5 transition-colors ${
                          activeJoint === i ? 'bg-white/10 text-[#ecece8]' : 'text-white/35 hover:text-white/70'
                        }`}
                      >
                        {j.id}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                  <div>
                    <div className="tnum font-mono text-[40px] font-medium leading-none text-[#ecece8]">{selectedJoint.span}°</div>
                    <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/45">
                      Max span ({selectedJoint.id})
                    </div>
                  </div>

                  <div className="flex items-end gap-2.5 self-end sm:gap-3">
                    {JOINT_BARS.map((j, i) => {
                      const active = activeJoint === i;
                      return (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => setActiveJoint(i)}
                          aria-label={`${j.id} ${j.role} ${j.range}`}
                          className="group relative flex flex-col items-center focus:outline-none"
                        >
                          {active && (
                            <div className="mb-2 whitespace-nowrap text-center font-mono text-[9.5px] leading-tight">
                              <div className="text-[#ecece8]">{j.range}</div>
                              <div className="text-white/45">
                                {j.id} {j.role}
                              </div>
                            </div>
                          )}
                          <div
                            style={{
                              height: specsInView ? `${j.h}px` : '0px',
                              transitionDelay: `${i * 55}ms`,
                            }}
                            className={`w-7 rounded-t-sm transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:w-8 ${
                              active ? 'bg-signal' : 'bg-[#ecece8]/75 group-hover:bg-[#ecece8]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Lower bento row */}
            <div className="mt-2.5 grid gap-2.5 md:grid-cols-12">
              {/* Col 1-3: Link lengths */}
              <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#141417] p-5 md:col-span-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/55">Link lengths</span>
                  <button
                    type="button"
                    onClick={enter}
                    aria-label="Open workcell"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ecece8] text-[12px] text-[#0a0a0b] transition-transform hover:scale-105"
                  >
                    ↗
                  </button>
                </div>

                <div className="mt-6">
                  <div className="flex items-baseline justify-between">
                    <span className="tnum font-mono text-[38px] font-medium leading-none text-[#ecece8]">{chainCount}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">/ M chain</span>
                  </div>
                  <div className="my-3.5 border-t border-white/[0.08]" />
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[10.5px]">
                    {LINK_SEGMENTS.map(([seg, len]) => (
                      <div key={seg} className="flex items-center justify-between rounded border border-white/[0.06] bg-[#0b0b0c] px-2.5 py-1.5">
                        <span className="text-white/45">{seg}</span>
                        <span className="tnum text-[#ecece8]">{len}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Col 4-6: Geometric wireframe card */}
              <div className="relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-xl border border-white/[0.08] bg-[#1a1a1f] p-5 md:col-span-3">
                <svg
                  width="124"
                  height="124"
                  viewBox="0 0 124 124"
                  fill="none"
                  className="pointer-events-none absolute -right-4 -top-4"
                  aria-hidden
                >
                  <circle cx="68" cy="56" r="46" stroke="rgba(236,236,232,0.22)" strokeWidth="1" />
                  <g className="anim-ik-arm">
                    <path d="M24 38 L68 56 L112 24 M68 56 L92 102" stroke="rgba(236,236,232,0.3)" strokeWidth="1.2" />
                    <circle cx="112" cy="24" r="2" fill="#ecece8" />
                  </g>
                  <circle cx="68" cy="56" r="2.8" fill="#ff4f28" />
                </svg>

                <div className="h-10" aria-hidden />
                <div>
                  <div className="font-mono text-[15px] uppercase leading-tight tracking-[0.04em] text-[#ecece8]">
                    Closed-form
                    <br />
                    IK solver
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-white/50">
                    Analytical top-down wrist solver with bench collision floor.
                  </p>
                  <div className="mt-4 flex items-center gap-1.5" aria-hidden>
                    {[0, 1, 2, 3].map((dot) => (
                      <span
                        key={dot}
                        className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                          activeJoint % 4 === dot ? 'bg-signal' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Col 7-12: 2 top metric tiles + wide ivory banner */}
              <div className="flex flex-col gap-2.5 md:col-span-6">
                <div className="grid flex-1 gap-2.5 sm:grid-cols-2">
                  {/* Progress bar stat */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#141417] p-5">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/55">Safe home speed</div>
                    <div className="mt-6">
                      <div className="flex items-baseline justify-between">
                        <span className="tnum font-mono text-[36px] font-medium leading-none text-[#ecece8]">{speedCount}%</span>
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">/ 100% max</span>
                      </div>
                      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          style={{ width: specsInView ? '45%' : '0%' }}
                          className="h-full rounded-full bg-signal transition-all duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Circular ring gauge */}
                  <div className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-[#141417] p-5">
                    <div className="relative flex h-[148px] w-[148px] items-center justify-center">
                      <svg width="148" height="148" viewBox="0 0 148 148" className="-rotate-[120deg]" aria-hidden>
                        <circle cx="74" cy="74" r="58" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                        <circle
                          cx="74"
                          cy="74"
                          r="58"
                          fill="none"
                          stroke="#ff4f28"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={specsInView ? '275 364' : '0 364'}
                          className="transition-all duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="tnum font-mono text-[26px] font-medium leading-none text-[#ecece8]">{reachCount}m</span>
                        <span className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/45">Bench reach</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wide warm-ivory bottom banner */}
                <div className="flex min-h-[110px] flex-col justify-between rounded-xl bg-[#ecece8] p-5 text-[#0a0a0b]">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={enter}
                      aria-label="Open workcell"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0a0a0b] text-[13px] text-[#ecece8] transition-transform hover:scale-105"
                    >
                      ↗
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                    <div className="font-mono text-[15px] font-medium uppercase leading-tight tracking-[0.04em]">
                      WebGL + WASM
                      <br />
                      Runtime stack
                    </div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-black/65">
                      Three.js · MediaPipe · ROS 2
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* ---------------- FAQ ---------------- */}
        <Reveal>
          <section id="faq" className="mx-auto max-w-[760px] px-3 pt-28 md:pt-36">
            <h2 className="text-center text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Questions</h2>
            <div className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {FAQ.map(([q, a], i) => (
                <div key={q}>
                  <button type="button" onClick={() => setFaq(faq === i ? null : i)} className="group flex w-full items-center justify-between py-5 text-left">
                    <span className="text-[15px] font-medium transition-colors duration-200 group-hover:text-white/80">{q}</span>
                    <span
                      className={`text-[18px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        faq === i ? 'rotate-45 text-signal' : 'text-white/40'
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${faq === i ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <p className="overflow-hidden pr-8 text-[13.5px] leading-relaxed text-white/50">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ---------------- CTA ---------------- */}
        <Reveal>
          <section className="mt-28 rounded-[32px] border border-white/[0.06] bg-[#0b0b0c] p-4 md:mt-36 md:p-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-0">
              {/* Top-left light attached block */}
              <div className="rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-8 md:col-start-1 md:row-start-1 md:rounded-none md:rounded-bl-[26px] md:rounded-tl-[26px] md:rounded-tr-[26px] md:p-10 md:pb-12">
                <Mark className="h-7 w-7 rounded-md" />
                <h2 className="mt-6 max-w-[460px] text-[32px] font-medium leading-[1.06] tracking-[-0.035em] md:text-[48px]">
                  Ready to try it?
                </h2>
                <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-black/60">
                  Allow camera access, raise your hand and start moving parts.
                </p>
              </div>

              {/* Top-right dark cutout */}
              <div className="relative hidden flex-col justify-between p-8 text-white md:col-span-4 md:col-start-9 md:row-start-1 md:flex">
                <ConcaveFillet corner="bl" size={26} className="hidden md:block" />
                <span className="font-mono text-[14px] text-signal">+</span>
                <div>
                  <div className="text-[14px] font-medium text-[#ecece8]">Webcam or mouse</div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
                    Works with your camera or the built-in simulated hand.
                  </p>
                </div>
              </div>

              {/* Bottom-left dark cutout */}
              <div className="relative flex flex-col justify-between rounded-[24px] p-5 md:col-span-4 md:col-start-1 md:row-start-2 md:rounded-none md:p-8">
                <ConcaveFillet corner="tr" size={26} className="hidden md:block" />
                <p className="text-[12.5px] leading-relaxed text-white/45">Runs directly in your browser with no setup.</p>
              </div>

              {/* Bottom-middle attached light bridge */}
              <div className="flex flex-col justify-end rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-4 md:col-start-5 md:row-start-2 md:rounded-none md:rounded-bl-[26px] md:p-8">
                <button
                  type="button"
                  onClick={enter}
                  className="group inline-flex h-10 w-fit items-center gap-2 rounded-full bg-signal px-5 text-[13px] font-medium text-[#0a0a0b] transition-all duration-200 hover:bg-[#ff6240] active:scale-[0.98]"
                >
                  Open workcell{' '}
                  <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                    ↗
                  </span>
                </button>
              </div>

              {/* Bottom-right attached light architectural wing */}
              <div className="hidden rounded-[24px] bg-[#ecece8] md:col-span-4 md:col-start-9 md:row-start-2 md:block md:min-h-[120px] md:rounded-none md:rounded-br-[26px] md:rounded-tr-[26px]" />
            </div>
          </section>
        </Reveal>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="mx-auto mt-16 flex max-w-[1200px] flex-col items-center justify-between gap-3 px-8 pb-10 text-[12px] text-white/35 sm:flex-row">
        <div className="flex items-center gap-2">
          <Mark className="h-5 w-5 rounded" />
          <span>TARS</span>
        </div>
        <div className="flex gap-6">
          <a href="#how" className="hover:text-[#ecece8]">Control</a>
          <a href="#features" className="hover:text-[#ecece8]">Workcell</a>
          <a href="#specs" className="hover:text-[#ecece8]">Specs</a>
          <a href="#faq" className="hover:text-[#ecece8]">FAQ</a>
        </div>
      </footer>
    </div>
  );
}
