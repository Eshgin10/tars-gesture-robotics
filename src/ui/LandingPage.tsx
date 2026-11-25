import { ReactNode, useState } from 'react';
import { useBridge } from '../state/store';
import { ConcaveFillet } from './ConcaveFillet';
import { HandGlyph } from './HandGlyph';
import { Reveal } from './Reveal';
import { StepPixelVisual, StepVisualKind } from './StepPixelVisual';

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

const STEPS: [string, StepVisualKind, string, string, string][] = [
  ['01', 'move', 'Move', 'Left, right, up and down in the camera frame moves the arm across the bench and lifts it.', 'X/Y PLANAR TRANSLATION'],
  ['02', 'reach', 'Reach', 'Bring your hand closer to the camera to reach forward. Pull it back to retract.', 'Z-AXIS DEPTH · CLUTCH'],
  ['03', 'pinch', 'Pinch', 'Close your thumb and index finger to grab a part, and open them to drop it.', '0–95 MM PROPORTIONAL GRIP'],
];

const SPECS: [string, string, string][] = [
  ['J1 · Base', 'Yaw', '±165°'],
  ['J2 · Shoulder', 'Pitch', '−35° to 155°'],
  ['J3 · Elbow', 'Pitch', '−165° to 60°'],
  ['J4 · Forearm', 'Roll', '±180°'],
  ['J5 · Wrist', 'Pitch', '±135°'],
  ['J6 · Tool', 'Roll', '±200°'],
  ['Gripper', 'Parallel', '0 – 95 mm'],
];

const STACK: [string, string][] = [
  ['React Three Fiber', 'Workcell, 6-DOF arm and parts rendered with soft shadows and filmic tone mapping.'],
  ['MediaPipe WASM', '21 hand landmarks per frame extracted locally through WebAssembly and GPU delegate.'],
  ['Analytical 6-DOF IK', 'Closed-form solver converts each hand pose into joint angles every animation frame.'],
  ['ROS 2 rosbridge v2', 'Optional WebSocket transport publishes joint states and commands to physical hardware.'],
];

const FAQ: [string, string][] = [
  ['Do I need special hardware?', 'No. Any ordinary webcam works. If you don’t have one, a simulated hand lets you drive the same pipeline with your mouse.'],
  ['How does grabbing work?', 'The gap between your thumb and index finger sets the gripper opening. Close them around a part to grab it, and open them to drop it.'],
  ['Does my video leave the computer?', 'No. Hand tracking runs entirely in your browser. No frames are uploaded anywhere.'],
  ['Can it drive real hardware?', 'Yes. Enable the built-in rosbridge v2 WebSocket client in Settings to publish joint states and commands to a ROS 2 node.'],
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const set = useBridge((s) => s.set);
  const [faq, setFaq] = useState<number | null>(0);

  const enter = () => set({ user: { name: 'Operator', email: '' }, view: 'workspace' });

  return (
    <div className="min-h-screen w-full bg-[#050506] font-sans text-[#ecece8] antialiased selection:bg-signal selection:text-[#0a0a0b]">
      <main className="mx-auto max-w-[1200px] px-3 pt-3 md:px-5 md:pt-5">
        {/* ---------------- Hero panel (enclosed nav + 6x4 stepped grid) ---------------- */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0b0b0c] p-4 md:p-7">
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
          <div className="anim-hero-up mt-5 grid grid-cols-1 gap-3 md:mt-7 md:grid-cols-[1.85fr_0.9fr_0.85fr_1.45fr_1fr_1fr] md:gap-0">
            {/* Main headline canvas: Cols 1-3, Rows 1-2 */}
            <div className="rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-3 md:col-start-1 md:row-span-2 md:row-start-1 md:rounded-none md:rounded-bl-[24px] md:rounded-tl-[24px] md:p-11">
              <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-black/50">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" aria-hidden />
                <span>TARS · 6-DOF Teleoperation</span>
              </div>
              <h1 className="mt-5 text-[42px] font-medium leading-[1.02] tracking-[-0.04em] md:text-[58px] lg:text-[62px]">
                Your hand
                <br />
                is the
                <br />
                controller.
                <br />
                Zero hardware.
              </h1>
            </div>

            {/* Upper-center white extension: Col 4, Row 1 */}
            <div className="hidden flex-col justify-between bg-[#ecece8] p-5 text-[#0a0a0b] md:col-start-4 md:row-start-1 md:flex md:rounded-tr-[24px]">
              <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] text-black/45">60 FPS</div>
              <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] text-black/45">WebGL · WASM</div>
            </div>

            {/* Top-right dark callout: Col 5, Row 1 */}
            <div className="relative flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-5 md:row-start-1 md:rounded-none">
              <ConcaveFillet corner="bl" size={22} className="hidden md:block" />
              <span className="font-mono text-[15px] leading-none text-signal">+</span>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Vision</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">21 3D hand landmarks tracked locally at 60 fps.</p>
              </div>
            </div>

            {/* Top-right detached counterbalance square: Col 6, Row 1 */}
            <div className="flex flex-col justify-between rounded-[24px] bg-signal p-5 text-[#0a0a0b] md:col-start-6 md:row-start-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-black/65">05 · Arm</span>
                <HandGlyph gesture="THUMBS_UP" size={24} color="#0a0a0b" strokeWidth={1.75} />
              </div>
              <div className="mt-5">
                <div className="text-[14px] font-semibold tracking-[-0.01em]">Arm</div>
                <div className="font-mono text-[10.5px] text-black/70">1s Thumbs-up</div>
              </div>
            </div>

            {/* Central dark rounded-square visual window: Col 4, Row 2 */}
            <div className="rounded-[20px] bg-[#ecece8] p-2 md:col-start-4 md:row-start-2 md:rounded-none">
              <div className="anim-hero-media relative aspect-[5/4] h-full w-full overflow-hidden rounded-[20px] bg-[#060607] ring-1 ring-black/10">
                <Img
                  src="/img/hero-keyboard.jpg"
                  fallback="/img/hero-arm.jpg"
                  alt="Human and robotic hands side by side on a matte black keyboard"
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>

            {/* Middle-right white lobe: Col 5, Row 2 */}
            <div className="flex flex-col justify-between rounded-[20px] bg-[#ecece8] p-5 text-[#0a0a0b] md:col-start-5 md:row-start-2 md:rounded-none md:rounded-r-[24px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-black/45">02</span>
                <HandGlyph gesture="PINCH" size={24} color="#0a0a0b" strokeWidth={1.75} />
              </div>
              <div className="mt-5">
                <div className="text-[14px] font-medium tracking-[-0.01em]">Pinch</div>
                <div className="font-mono text-[10.5px] text-black/55">Grab &amp; carry</div>
              </div>
            </div>

            {/* Bottom-left dark cutout: Col 1, Rows 3-4 */}
            <div className="relative flex flex-col justify-between rounded-[20px] p-3 pt-4 md:col-start-1 md:row-span-2 md:row-start-3 md:rounded-none md:p-6 md:pr-8">
              <ConcaveFillet corner="tr" size={22} className="hidden md:block" />
              <p className="max-w-[260px] text-[13px] leading-relaxed text-white/60">
                Drive a six-axis industrial arm in real time using your webcam or the built-in simulated hand.
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
            <div className="flex flex-col justify-between rounded-[20px] bg-[#ecece8] p-5 text-[#0a0a0b] md:col-start-2 md:row-start-3 md:rounded-none md:rounded-b-[24px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-black/45">01</span>
                <HandGlyph gesture="POINT" size={24} color="#0a0a0b" strokeWidth={1.75} />
              </div>
              <div className="mt-5">
                <div className="text-[14px] font-medium tracking-[-0.01em]">Point</div>
                <div className="font-mono text-[10.5px] text-black/55">Select target</div>
              </div>
            </div>

            {/* Middle dark cutout: Col 3, Rows 3-4 */}
            <div className="relative hidden md:col-start-3 md:row-span-2 md:row-start-3 md:block">
              <ConcaveFillet corner="tl" size={22} />
              <ConcaveFillet corner="tr" size={22} />
            </div>

            {/* Lower-center white lobe: Col 4, Row 3 */}
            <div className="flex flex-col justify-between rounded-[20px] bg-[#ecece8] p-5 text-[#0a0a0b] md:col-start-4 md:row-start-3 md:rounded-none md:rounded-bl-[24px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-black/45">03</span>
                <HandGlyph gesture="VICTORY" size={24} color="#0a0a0b" strokeWidth={1.75} />
              </div>
              <div className="mt-5">
                <div className="text-[14px] font-medium tracking-[-0.01em]">V-Sign</div>
                <div className="font-mono text-[10.5px] text-black/55">Release part</div>
              </div>
            </div>

            {/* Middle-right dark cutout bridging diagonal kiss: Col 5, Row 3 */}
            <div className="relative hidden md:col-start-5 md:row-start-3 md:block">
              <ConcaveFillet corner="tl" size={22} />
              <ConcaveFillet corner="bl" size={22} />
            </div>

            {/* Bottom-center dark callout bridging diagonal kiss: Col 4, Row 4 */}
            <div className="relative flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-4 md:row-start-4 md:rounded-none">
              <ConcaveFillet corner="tr" size={22} className="hidden md:block" />
              <span className="font-mono text-[15px] leading-none text-signal">+</span>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Kinematics</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Closed-form 6-DOF solver maps hand pose to joints.</p>
              </div>
            </div>

            {/* Bottom-right white lobe: Col 5, Row 4 */}
            <div className="flex flex-col justify-between rounded-[20px] bg-[#ecece8] p-5 text-[#0a0a0b] md:col-start-5 md:row-start-4 md:rounded-none md:rounded-b-[24px] md:rounded-tr-[24px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-black/45">04</span>
                <HandGlyph gesture="OPEN_PALM" size={24} color="#0a0a0b" strokeWidth={1.75} />
              </div>
              <div className="mt-5">
                <div className="text-[14px] font-medium tracking-[-0.01em]">Palm</div>
                <div className="font-mono text-[10.5px] text-black/55">Instant E-stop</div>
              </div>
            </div>

            {/* Bottom-right dark callout: Col 6, Rows 3-4 */}
            <div className="flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-6 md:row-span-2 md:row-start-3 md:rounded-none">
              <svg width="18" height="18" viewBox="0 0 18 18" className="text-signal" fill="none" aria-hidden>
                <path d="M9 1V17M1 9H17M3.3 3.3L14.7 14.7M14.7 3.3L3.3 14.7" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Safety</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Open-palm E-stop in ≤140 ms with clutch hold.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Control Vocabulary ---------------- */}
        <section id="how" className="pt-28 md:pt-36">
          <Reveal>
            <div className="flex flex-col justify-between gap-4 px-2 md:flex-row md:items-end">
              <div>
                <SectionEyebrow>01 · Control vocabulary</SectionEyebrow>
                <h2 className="mt-2 text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Three gestures drive the arm</h2>
              </div>
              <p className="max-w-[360px] text-[13.5px] leading-relaxed text-white/50">
                No wearables or controllers. Relative clutch mapping prevents jumps when you re-engage.
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {STEPS.map(([n, kind, t, d, spec], idx) => (
              <Reveal key={n} delay={idx * 90}>
                <div className="group flex h-full flex-col justify-between rounded-[24px] border border-white/[0.06] bg-[#0b0b0c] p-7 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-[#111114]">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="font-mono text-[11px] text-white/35">{n}</div>
                      <StepPixelVisual kind={kind} size={36} />
                    </div>
                    <div className="mt-5 text-[20px] font-medium tracking-[-0.02em]">{t}</div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">{d}</p>
                  </div>
                  <div className="mt-5 border-t border-white/[0.06] pt-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/35">
                    {spec}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- Workcell & Vision ---------------- */}
        <section id="features" className="pt-28 md:pt-36">
          <Reveal>
            <div className="px-2">
              <SectionEyebrow>02 · Workcell</SectionEyebrow>
              <h2 className="mt-2 text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Built for real-time manipulation</h2>
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
                <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
                  <span>Parallel gripper</span>
                </div>
                <div className="mt-2 text-[22px] font-medium tracking-[-0.02em]">Proportional finger control</div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                  The gripper jaws mirror your thumb-to-index aperture, stop on part contact, and hold payload until an explicit release.
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
                  <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/65">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal transition-transform duration-300 group-hover:scale-125" aria-hidden />
                    <span>On-device vision</span>
                  </div>
                  <div className="mt-2 text-[19px] font-medium tracking-[-0.015em]">21 3D hand landmarks</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                    Extracted locally in WebAssembly with One-Euro temporal filtering. Zero video frames leave your computer.
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
                  <div className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/65">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal transition-transform duration-300 group-hover:scale-125" aria-hidden />
                    <span>State machine</span>
                  </div>
                  <div className="mt-2 text-[19px] font-medium tracking-[-0.015em]">Deterministic command bus</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                    Dwell-to-select, clutch transport, duplicate suppression, and highest-priority open-palm emergency stop.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Technical Specification & Architecture ---------------- */}
        <Reveal>
          <section id="specs" className="mt-28 rounded-[32px] border border-white/[0.06] bg-[#0b0b0c] p-7 md:mt-36 md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
              {/* Left column: Envelope metrics + 2x2 architecture stack */}
              <div className="flex flex-col justify-between">
                <div>
                  <SectionEyebrow>03 · Specification</SectionEyebrow>
                  <h2 className="mt-2 text-[30px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[36px]">
                    Kinematic chain &amp; runtime
                  </h2>

                  <div className="mt-7 grid grid-cols-3 gap-4 border-y border-white/[0.06] py-5">
                    {[
                      ['Axes', '6'],
                      ['Reach', '78.8 cm'],
                      ['Stroke', '95 mm'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="mb-2 h-0.5 w-5 bg-signal" aria-hidden />
                        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">{k}</div>
                        <div className="mt-1 text-[24px] font-medium tracking-[-0.03em] md:text-[28px]">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {STACK.map(([t, d], i) => (
                    <div key={t} className="rounded-2xl border border-white/[0.06] bg-[#111114] p-4">
                      <div className="font-mono text-[10.5px] text-white/35">0{i + 1}</div>
                      <div className="mt-3 text-[14.5px] font-medium tracking-[-0.01em]">{t}</div>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/45">{d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: Joint specification table */}
              <div className="flex flex-col justify-center rounded-2xl border border-white/[0.06] bg-[#111114] p-6 md:p-8">
                <div className="grid grid-cols-3 border-b border-white/[0.08] pb-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/35">
                  <span>Joint</span>
                  <span>Axis</span>
                  <span className="text-right">Limits</span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {SPECS.map(([j, type, range]) => (
                    <div key={j} className="grid grid-cols-3 rounded px-1 py-3.5 text-[13.5px] transition-colors duration-200 hover:bg-white/[0.025]">
                      <span className="text-[#ecece8]">{j}</span>
                      <span className="text-white/45">{type}</span>
                      <span className="tnum text-right font-mono text-[12.5px] text-white/75">{range}</span>
                    </div>
                  ))}
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
                <div className="flex items-center gap-2.5">
                  <Mark className="h-7 w-7 rounded-md" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">Workspace</span>
                </div>
                <h2 className="mt-6 max-w-[460px] text-[32px] font-medium leading-[1.06] tracking-[-0.035em] md:text-[48px]">
                  Ready to operate?
                </h2>
                <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-black/60">
                  Enable your webcam or drive the procedural hand with your mouse and keyboard.
                </p>
              </div>

              {/* Top-right dark cutout */}
              <div className="relative hidden flex-col justify-between p-8 text-white md:col-span-4 md:col-start-9 md:row-start-1 md:flex">
                <ConcaveFillet corner="bl" size={26} className="hidden md:block" />
                <span className="font-mono text-[14px] text-signal">+</span>
                <div>
                  <div className="text-[14px] font-medium text-[#ecece8]">Keyboard fallback</div>
                  <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-white/45">
                    Space E-stop · WASD jog · G grab · R release
                  </p>
                </div>
              </div>

              {/* Bottom-left dark cutout */}
              <div className="relative flex flex-col justify-between rounded-[24px] p-5 md:col-span-4 md:col-start-1 md:row-start-2 md:rounded-none md:p-8">
                <ConcaveFillet corner="tr" size={26} className="hidden md:block" />
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">Zero setup</div>
                <p className="mt-4 text-[12.5px] leading-relaxed text-white/50">
                  Runs directly in Chromium or Firefox over HTTPS/localhost.
                </p>
              </div>

              {/* Bottom-middle attached light bridge */}
              <div className="flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-4 md:col-start-5 md:row-start-2 md:rounded-none md:rounded-bl-[26px] md:p-8">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">01 · Workspace</div>
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={enter}
                    className="group inline-flex h-10 items-center gap-2 rounded-full bg-signal px-5 text-[13px] font-medium text-[#0a0a0b] transition-all duration-200 hover:bg-[#ff6240] active:scale-[0.98]"
                  >
                    Launch simulator{' '}
                    <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                      ↗
                    </span>
                  </button>
                </div>
              </div>

              {/* Bottom-right attached light wing */}
              <div className="flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-4 md:col-start-9 md:row-start-2 md:rounded-none md:rounded-br-[26px] md:rounded-tr-[26px] md:p-8">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">02 · Safety</span>
                  <HandGlyph gesture="THUMBS_UP" size={28} color="#0a0a0b" strokeWidth={1.8} />
                </div>
                <div className="mt-6">
                  <div className="text-[15px] font-medium tracking-[-0.01em]">Thumbs-up to arm</div>
                  <p className="mt-1 text-[12px] text-black/55">Hold for 1 s anytime to reset an E-stop.</p>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="mx-auto mt-16 flex max-w-[1200px] flex-col items-center justify-between gap-3 px-8 pb-10 text-[12px] text-white/35 sm:flex-row">
        <div className="flex items-center gap-2">
          <Mark className="h-5 w-5 rounded" />
          <span>TARS: gesture-controlled 6-DOF simulation</span>
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
