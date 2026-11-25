import { ReactNode, useState } from 'react';
import { useBridge } from '../state/store';
import { ConcaveFillet } from './ConcaveFillet';
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

const STEPS: [string, StepVisualKind, string, string][] = [
  ['01', 'move', 'Move', 'Left, right, up and down in the camera frame moves the arm across the bench and lifts it.'],
  ['02', 'reach', 'Reach', 'Bring your hand closer to the camera to reach forward. Pull it back to retract.'],
  ['03', 'pinch', 'Pinch', 'Close your thumb and index finger to grab a part, and open them to drop it.'],
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
  ['React Three Fiber', 'Renders the workcell, articulated arm and objects in the browser.'],
  ['MediaPipe Hand Landmarker', 'Tracks your hand locally on your device with no video uploaded.'],
  ['Analytical inverse kinematics', 'Turns each hand position into smooth joint angles in real time.'],
  ['Optional ROS 2 bridge', 'Publishes joint states and commands for experiments with hardware.'],
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
            <div className="flex items-center rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-3 md:col-start-1 md:row-span-2 md:row-start-1 md:rounded-none md:rounded-bl-[24px] md:rounded-tl-[24px] md:p-11">
              <h1 className="text-[42px] font-medium leading-[1.02] tracking-[-0.04em] md:text-[56px] lg:text-[62px]">
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
            <div className="hidden bg-[#ecece8] md:col-start-4 md:row-start-1 md:block md:min-h-[128px] md:rounded-tr-[24px]" />

            {/* Top-right dark callout: Col 5, Row 1 */}
            <div className="relative flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-5 md:row-start-1 md:min-h-[128px] md:rounded-none">
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
              className="group hidden items-end justify-end rounded-[24px] bg-signal p-5 text-[#0a0a0b] transition-colors hover:bg-[#ff6240] active:scale-[0.98] md:col-start-6 md:row-start-1 md:flex md:min-h-[128px]"
            >
              <span className="text-[26px] leading-none transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden>
                ↗
              </span>
            </button>

            {/* Central dark rounded visual window: Col 4, Row 2 */}
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
            <div className="hidden bg-[#ecece8] md:col-start-5 md:row-start-2 md:block md:min-h-[128px] md:rounded-r-[24px]" />

            {/* Bottom-left dark cutout: Col 1, Rows 3-4 */}
            <div className="relative flex flex-col justify-between rounded-[20px] p-3 pt-4 md:col-start-1 md:row-span-2 md:row-start-3 md:rounded-none md:p-6 md:pr-8">
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
            <div className="hidden bg-[#ecece8] md:col-start-2 md:row-start-3 md:block md:min-h-[128px] md:rounded-b-[24px]" />

            {/* Middle dark cutout: Col 3, Rows 3-4 */}
            <div className="relative hidden md:col-start-3 md:row-span-2 md:row-start-3 md:block">
              <ConcaveFillet corner="tl" size={22} />
              <ConcaveFillet corner="tr" size={22} />
            </div>

            {/* Lower-center white lobe: Col 4, Row 3 */}
            <div className="hidden bg-[#ecece8] md:col-start-4 md:row-start-3 md:block md:min-h-[128px] md:rounded-bl-[24px]" />

            {/* Middle-right dark cutout bridging diagonal kiss: Col 5, Row 3 */}
            <div className="relative hidden md:col-start-5 md:row-start-3 md:block md:min-h-[128px]">
              <ConcaveFillet corner="tl" size={22} />
              <ConcaveFillet corner="bl" size={22} />
            </div>

            {/* Bottom-center dark callout bridging diagonal kiss: Col 4, Row 4 */}
            <div className="relative flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-4 md:row-start-4 md:min-h-[128px] md:rounded-none">
              <ConcaveFillet corner="tr" size={22} className="hidden md:block" />
              <span className="font-mono text-[15px] leading-none text-signal">+</span>
              <div className="mt-4">
                <div className="text-[13px] font-medium text-[#ecece8]">Kinematics</div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Follows your reach, tilt and grip naturally.</p>
              </div>
            </div>

            {/* Bottom-right white lobe: Col 5, Row 4 */}
            <div className="hidden bg-[#ecece8] md:col-start-5 md:row-start-4 md:block md:min-h-[128px] md:rounded-b-[24px] md:rounded-tr-[24px]" />

            {/* Bottom-right dark callout: Col 6, Rows 3-4 */}
            <div className="flex flex-col justify-between rounded-[20px] p-5 text-white md:col-start-6 md:row-span-2 md:row-start-3 md:rounded-none">
              <svg width="18" height="18" viewBox="0 0 18 18" className="text-signal" fill="none" aria-hidden>
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

        {/* ---------------- Technical Specification & Architecture ---------------- */}
        <Reveal>
          <section id="specs" className="mt-28 rounded-[32px] border border-white/[0.06] bg-[#0b0b0c] p-7 md:mt-36 md:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
              <div className="flex flex-col justify-between">
                <div>
                  <SectionEyebrow>Specs</SectionEyebrow>
                  <h2 className="mt-2 text-[30px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[36px]">
                    Meet the TARS arm
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
