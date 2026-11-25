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
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050506]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-semibold tracking-tight">TARS</span>
            <span className="hidden rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-white/45 sm:inline-block">
              6-DOF · WEBGL
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-[13px] text-white/55 md:flex">
            <a href="#how" className="transition-colors hover:text-[#ecece8]">Control</a>
            <a href="#features" className="transition-colors hover:text-[#ecece8]">Workcell</a>
            <a href="#specs" className="transition-colors hover:text-[#ecece8]">Specs</a>
            <a href="#faq" className="transition-colors hover:text-[#ecece8]">FAQ</a>
          </nav>
          <button
            type="button"
            onClick={enter}
            className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-signal px-4 text-[13px] font-medium text-[#0a0a0b] transition-all hover:bg-[#ff6240] active:scale-[0.98]"
          >
            Launch simulator <span aria-hidden>↗</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-3 md:px-5">
        {/* ---------------- Hero panel ---------------- */}
        <section className="relative mt-3 overflow-hidden rounded-[32px] border border-white/[0.06] bg-[#0b0b0c]">
          <div className="anim-hero-up relative z-10 p-4 pt-5 md:p-6 md:pt-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-0">
              {/* Main attached light block */}
              <div className="rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-8 md:col-start-1 md:row-start-1 md:rounded-none md:rounded-bl-[26px] md:rounded-tl-[26px] md:rounded-tr-[26px] md:p-10">
                <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black/55">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" aria-hidden />
                  <span>TARS · Gesture Teleoperation</span>
                </div>
                <h1 className="mt-3 max-w-[600px] text-[42px] font-medium leading-[1.01] tracking-[-0.04em] md:text-[68px]">
                  Your hand is
                  <br />
                  the controller.
                </h1>
              </div>

              {/* Top-middle dark spec cell */}
              <div className="hidden flex-col justify-between p-6 text-white md:col-span-2 md:col-start-9 md:row-start-1 md:flex">
                <span className="font-mono text-[14px] text-signal">+</span>
                <div>
                  <div className="text-[13px] font-medium text-[#ecece8]">21 landmarks</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">On-device MediaPipe tracking via WebAssembly.</p>
                </div>
              </div>

              {/* Detached accent launch tile */}
              <button
                type="button"
                onClick={enter}
                className="group flex flex-col justify-between rounded-[24px] bg-signal p-6 text-left text-[#0a0a0b] transition-colors hover:bg-[#ff6240] active:scale-[0.99] md:col-span-2 md:col-start-11 md:row-start-1 md:rounded-[26px]"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/65">00 · Live</div>
                <div className="mt-6 flex items-end justify-between md:mt-0">
                  <span className="text-[16px] font-semibold tracking-[-0.01em]">Launch</span>
                  <span className="text-[20px] leading-none transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                    ↗
                  </span>
                </div>
              </button>

              {/* Bottom-left dark cutout */}
              <div className="relative flex flex-col justify-between rounded-[24px] p-3 pt-4 md:col-span-5 md:col-start-1 md:row-start-2 md:rounded-none md:p-6 md:pr-8">
                <ConcaveFillet corner="tr" size={26} className="hidden md:block" />
                <p className="max-w-[340px] text-[13px] leading-relaxed text-white/60">
                  Point to select, pinch to grasp, and move in 3D space. Closed-form inverse kinematics and safety limits run locally in your browser.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={enter}
                    className="group inline-flex h-9 items-center gap-2 rounded-full bg-[#ecece8] px-4 text-[13px] font-medium text-[#0a0a0b] transition-all hover:bg-white active:scale-[0.98]"
                  >
                    Open workcell
                    <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                      ↗
                    </span>
                  </button>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/40">60 FPS · Webcam or mouse</span>
                </div>
              </div>

              {/* Attached downward light lobe */}
              <div className="flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-6 text-[#0a0a0b] md:col-span-3 md:col-start-6 md:row-start-2 md:rounded-none md:rounded-b-[26px] md:p-7">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">01 · Solver</span>
                  <HandGlyph gesture="PINCH" size={28} color="#0a0a0b" strokeWidth={1.8} />
                </div>
                <div className="mt-6">
                  <div className="text-[15px] font-medium tracking-[-0.01em]">6-DOF Kinematics</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-black/55">0.79 m reach envelope with bench collision floor.</p>
                </div>
              </div>

              {/* Bottom-right dark spec cell */}
              <div className="hidden flex-col justify-between p-6 pl-8 text-white md:col-span-4 md:col-start-9 md:row-start-2 md:flex">
                <span className="font-mono text-[14px] text-signal">+</span>
                <div>
                  <div className="text-[13px] font-medium text-[#ecece8]">Simulated safety layer</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">
                    Open-palm E-stop (≤140 ms), joint limits, speed clamping and tracking-loss hold.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="anim-hero-media relative mt-4 md:mt-2">
            <Img
              src="/img/hero-keyboard.jpg"
              fallback="/img/hero-arm.jpg"
              alt="Human and robotic hands side by side on a matte black keyboard"
              className="mx-auto aspect-[16/9] w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0b0b0c] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0b0b0c] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0b0b0c] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0b0b0c] to-transparent" />
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
