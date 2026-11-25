import { ReactNode, useState } from 'react';
import { useBridge } from '../state/store';
import { ConcaveFillet } from './ConcaveFillet';
import { HandGlyph } from './HandGlyph';
import { Reveal } from './Reveal';
import { StepPixelVisual, StepVisualKind } from './StepPixelVisual';

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

/** Image with a fallback (generated renders live in /img, older crops act as backup). */
const asset = (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`;

function Img({ src, fallback, alt, className }: { src: string; fallback: string; alt: string; className?: string }) {
  const [s, setS] = useState(asset(src));
  const fb = asset(fallback);
  return <img src={s} alt={alt} onError={() => s !== fb && setS(fb)} className={className} draggable={false} />;
}

function Pill({ children, onClick, light = true, className = '' }: { children: ReactNode; onClick?: () => void; light?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-all active:scale-[0.98] ${
        light ? 'bg-white text-black hover:bg-white/85' : 'border border-white/15 text-white hover:bg-white/[0.06]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[12px] font-medium text-white/40">{children}</div>;
}

function Mark({ className = '' }: { className?: string }) {
  return <img src={asset('logo.png')} alt="" className={`h-7 w-7 rounded-md ${className}`} draggable={false} />;
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

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
  ['React + Three.js', 'The workcell, arm and parts are rendered with React Three Fiber, with soft shadows and filmic tone mapping.'],
  ['MediaPipe Hand Landmarker', '21 hand landmarks per frame, running locally through WebAssembly with the GPU delegate.'],
  ['Analytical inverse kinematics', 'A closed-form 6-DOF solver turns each hand position into joint angles every animation frame.'],
  ['Optional ROS 2 bridge', 'A rosbridge client can publish joint states and commands for experiments with real hardware.'],
];

const FAQ: [string, string][] = [
  ['Do I need special hardware?', 'No. Any ordinary webcam works. If you don’t have one, a simulated hand lets you drive the same pipeline with your mouse.'],
  ['How does grabbing work?', 'The gap between your thumb and index finger sets the gripper opening. Close them around a part to grab it, and open them to drop it.'],
  ['Does my video leave the computer?', 'No. Hand tracking runs entirely in your browser. No frames are uploaded anywhere.'],
  ['Is registration real?', 'Not yet. This is a personal project, and the sign-up form is a demo that only puts your name in the workspace header.'],
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const set = useBridge((s) => s.set);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [faq, setFaq] = useState<number | null>(0);

  const enter = (n?: string, e?: string) => set({ user: { name: n || 'Guest', email: e || '' }, view: 'workspace' });
  const openRegister = () => setModal(true);

  return (
    <div className="min-h-screen w-full bg-black font-sans text-white antialiased selection:bg-white selection:text-black">
      {/* ---------------- Nav ---------------- */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-semibold tracking-tight">TARS</span>
          </div>
          <nav className="hidden items-center gap-7 text-[13px] text-white/55 md:flex">
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#specs" className="transition-colors hover:text-white">Specs</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => enter()} className="hidden px-3 text-[13px] text-white/60 transition-colors hover:text-white sm:block">
              Try demo
            </button>
            <Pill onClick={openRegister}>Sign up</Pill>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-3 md:px-5">
        {/* ---------------- Hero panel ---------------- */}
        <section className="relative mt-3 overflow-hidden rounded-[32px] bg-[#0b0b0c]">
          <div className="anim-hero-up relative z-10 p-4 pt-5 md:p-6 md:pt-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-0">
              {/* Main attached light block */}
              <div className="rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-8 md:col-start-1 md:row-start-1 md:rounded-none md:rounded-bl-[26px] md:rounded-tl-[26px] md:rounded-tr-[26px] md:p-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">TARS · Gesture Robotics</div>
                <h1 className="mt-3 max-w-[600px] text-[42px] font-medium leading-[1.01] tracking-[-0.04em] md:text-[68px]">
                  Your hand is
                  <br />
                  the controller
                </h1>
              </div>

              {/* Top-right dark micro-spec */}
              <div className="hidden flex-col justify-between p-6 text-white md:col-span-2 md:col-start-9 md:row-start-1 md:flex">
                <span className="font-mono text-[14px] text-white/35">+</span>
                <div>
                  <div className="text-[13px] font-medium text-white/90">21-pt vision</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">Local MediaPipe hand tracking in the browser.</p>
                </div>
              </div>

              {/* Detached rounded action tile */}
              <button
                type="button"
                onClick={openRegister}
                className="group flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-6 text-left text-[#0a0a0b] transition-colors hover:bg-white md:col-span-2 md:col-start-11 md:row-start-1 md:rounded-[26px]"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">Launch</div>
                <div className="mt-6 flex items-end justify-between md:mt-0">
                  <span className="text-[15px] font-medium tracking-[-0.01em]">Enter app</span>
                  <span className="text-[20px] leading-none transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
                </div>
              </button>

              {/* Bottom-left dark cutout with inline register form */}
              <div className="relative flex flex-col justify-between rounded-[24px] p-3 pt-4 md:col-span-5 md:col-start-1 md:row-start-2 md:rounded-none md:p-6 md:pr-8">
                <ConcaveFillet corner="tr" size={26} className="hidden md:block" />
                <p className="max-w-[320px] text-[13px] leading-relaxed text-white/55">
                  No controller and no install. Point, pinch to grab, and release in real time.
                </p>
                <div className="mt-5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      openRegister();
                    }}
                    className="flex w-full max-w-[340px] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] p-1.5 pl-4"
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder-white/35 outline-none"
                    />
                    <button type="submit" className="h-8 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-white/85">
                      Register
                    </button>
                  </form>
                  <button type="button" onClick={() => enter()} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-white/55 transition-colors hover:text-white">
                    Try without an account <span>↗</span>
                  </button>
                </div>
              </div>

              {/* Attached downward light lobe */}
              <div className="flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-6 text-[#0a0a0b] md:col-span-3 md:col-start-6 md:row-start-2 md:rounded-none md:rounded-b-[26px] md:p-7">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">01 · Chain</span>
                  <HandGlyph gesture="PINCH" size={28} color="#0a0a0b" strokeWidth={1.8} />
                </div>
                <div className="mt-6">
                  <div className="text-[15px] font-medium tracking-[-0.01em]">6-DOF Kinematics</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-black/55">Closed-form analytical IK at 60 fps.</p>
                </div>
              </div>

              {/* Bottom-right dark micro-spec */}
              <div className="hidden flex-col justify-between p-6 pl-8 text-white md:col-span-4 md:col-start-9 md:row-start-2 md:flex">
                <span className="font-mono text-[14px] text-white/35">+</span>
                <div>
                  <div className="text-[13px] font-medium text-white/90">Safety simulated</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">
                    Open-palm E-stop, workspace envelope, speed limits and tracking-loss hold.
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

        {/* ---------------- Intro ---------------- */}
        <section id="how" className="px-6 pb-10 pt-28 text-center md:pt-36">
          <Reveal>
            <h2 className="text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Where your gestures meet the machine</h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[14px] leading-relaxed text-white/50">
              A webcam tracks your hand in the browser, and a simulated six-axis arm follows it in real time. There’s no controller and no
              install. Move, pinch and let go.
            </p>
            <div className="mt-6">
              <Pill onClick={openRegister}>Get started</Pill>
            </div>
          </Reveal>
        </section>

        {/* three control steps */}
        <section className="grid gap-3 md:grid-cols-3">
          {(
            [
              ['01', 'move', 'Move', 'Left, right, up and down in the camera frame moves the arm across the bench and lifts it.'],
              ['02', 'reach', 'Reach', 'Bring your hand closer to the camera to reach forward. Pull it back to retract.'],
              ['03', 'pinch', 'Pinch', 'Close your thumb and index finger to grab a part, and open them to drop it.'],
            ] as [string, StepVisualKind, string, string][]
          ).map(([n, kind, t, d], idx) => (
            <Reveal key={n} delay={idx * 90}>
              <div className="group h-full rounded-[24px] bg-[#0b0b0c] p-7 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-[#101012] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                <div className="flex items-start justify-between">
                  <div className="font-mono text-[11px] text-white/30">{n}</div>
                  <StepPixelVisual kind={kind} size={36} />
                </div>
                <div className="mt-5 text-[20px] font-medium tracking-[-0.02em]">{t}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">{d}</p>
              </div>
            </Reveal>
          ))}
        </section>

        {/* ---------------- Feature: big image card ---------------- */}
        <section id="features" className="pt-28 md:pt-36">
          <Reveal>
            <div className="group relative overflow-hidden rounded-[24px]">
              <Img src="/img/workbench.jpg" fallback="/dexterity.jpg" alt="Arm picking a cube" className="aspect-[16/7] w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 max-w-[360px] p-6 md:p-9">
                <div className="text-[22px] font-medium tracking-[-0.02em]">Human-like dexterity</div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/65">
                  The gripper fingers follow the gap between your thumb and index finger, stop when they touch a part and hold on until you let go.
                </p>
              </div>
            </div>
          </Reveal>

          {/* key features row */}
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
            <Reveal delay={60}>
              <div className="flex h-full flex-col justify-center rounded-[24px] p-6 md:p-8">
                <div className="text-[28px] font-medium tracking-[-0.025em]">Key features</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">
                  Local hand tracking, a real kinematic chain and simple physics, all running in one browser tab.
                </p>
                <div className="mt-5">
                  <Pill onClick={() => enter()}>Open demo</Pill>
                </div>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="group relative h-full overflow-hidden rounded-[24px] bg-[#0b0b0c]">
                <Img src="/img/hand.jpg" fallback="/ai-hand.jpg" alt="Hand and gripper" className="aspect-[4/3] h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-5 left-5">
                  <div className="mb-1.5 h-1.5 w-1.5 rounded-full bg-white transition-transform duration-300 group-hover:scale-125" />
                  <div className="text-[17px] font-medium">On-device vision</div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={220}>
              <div className="group relative h-full overflow-hidden rounded-[24px] bg-[#0b0b0c]">
                <Img src="/img/gripper.jpg" fallback="/hero-robot.jpg" alt="Gripper close-up" className="aspect-[4/3] h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-5 left-5">
                  <div className="mb-1.5 h-1.5 w-1.5 rounded-full bg-white transition-transform duration-300 group-hover:scale-125" />
                  <div className="text-[17px] font-medium">Six degrees of freedom</div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- Introducing panel ---------------- */}
        <Reveal>
          <section id="specs" className="mt-28 overflow-hidden rounded-[32px] bg-[#0b0b0c] md:mt-36">
            <div className="grid md:grid-cols-[1.15fr_1fr]">
              <div className="group relative min-h-[360px] overflow-hidden">
                <Img src="/img/gripper.jpg" fallback="/hero-robot.jpg" alt="Robot wrist" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.1s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0b0b0c] md:block" />
              </div>
              <div className="flex flex-col justify-center p-8 md:p-14">
                <h3 className="text-[30px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[36px]">
                  Meet the
                  <br />
                  TARS arm
                </h3>
                <p className="mt-4 max-w-[380px] text-[13.5px] leading-relaxed text-white/50">
                  A simulated industrial manipulator with joint limits, speed limits, collision floors and a parallel gripper. It’s built as a
                  sandbox for trying out natural, gesture-based control.
                </p>
                <div className="mt-8 grid grid-cols-3 gap-6">
                  {[
                    ['Axes', '6'],
                    ['Landmarks', '21'],
                    ['Stroke', '95mm'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[12px] text-white/40">{k}</div>
                      <div className="mt-1 text-[30px] font-medium tracking-[-0.03em]">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-8">
                  <Pill onClick={openRegister}>Enter the app</Pill>
                </div>
              </div>
            </div>

            {/* joint table */}
            <div className="border-t border-white/[0.06] px-6 py-8 md:px-14 md:py-10">
              <Eyebrow>Kinematic chain</Eyebrow>
              <div className="mt-4 divide-y divide-white/[0.06]">
                {SPECS.map(([j, type, range]) => (
                  <div key={j} className="grid grid-cols-3 rounded px-1 py-3 text-[13.5px] transition-colors duration-200 hover:bg-white/[0.025]">
                    <span className="text-white/85">{j}</span>
                    <span className="text-white/40">{type}</span>
                    <span className="text-right font-mono text-[12.5px] text-white/70">{range}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* ---------------- Stack ---------------- */}
        <section className="pt-28 md:pt-36">
          <Reveal>
            <div className="px-3 md:px-3">
              <Eyebrow>Under the hood</Eyebrow>
              <h2 className="mt-2 max-w-[520px] text-[30px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[40px]">Built entirely on the open web</h2>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STACK.map(([t, d], i) => (
              <Reveal key={t} delay={i * 75}>
                <div className="flex h-full flex-col rounded-[24px] bg-[#0b0b0c] p-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-[#101012] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                  <div className="font-mono text-[11px] text-white/30">0{i + 1}</div>
                  <div className="mt-8 text-[16px] font-medium tracking-[-0.01em]">{t}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/45">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <Reveal>
          <section id="faq" className="mx-auto max-w-[760px] px-3 pt-28 md:pt-36">
            <h2 className="text-center text-[30px] font-medium tracking-[-0.025em] md:text-[40px]">Questions</h2>
            <div className="mt-10 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {FAQ.map(([q, a], i) => (
                <div key={q}>
                  <button type="button" onClick={() => setFaq(faq === i ? null : i)} className="group flex w-full items-center justify-between py-5 text-left">
                    <span className="text-[15px] font-medium transition-colors duration-200 group-hover:text-white/80">{q}</span>
                    <span className={`text-[18px] text-white/40 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${faq === i ? 'rotate-45 text-white/75' : ''}`}>+</span>
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
          <section className="mt-28 rounded-[32px] bg-[#0b0b0c] p-4 md:mt-36 md:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-0">
            {/* Top-left light attached block */}
            <div className="rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-8 md:col-start-1 md:row-start-1 md:rounded-none md:rounded-bl-[26px] md:rounded-tl-[26px] md:rounded-tr-[26px] md:p-10 md:pb-12">
              <div className="flex items-center gap-2.5">
                <Mark className="h-7 w-7 rounded-md" />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">Ready to start</span>
              </div>
              <h2 className="mt-6 max-w-[460px] text-[32px] font-medium leading-[1.06] tracking-[-0.035em] md:text-[48px]">
                Ready to raise your hand?
              </h2>
              <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-black/60">
                Allow camera access, show a thumbs-up to arm the robot and start picking.
              </p>
            </div>

            {/* Top-right dark cutout */}
            <div className="relative hidden flex-col justify-between p-8 text-white md:col-span-4 md:col-start-9 md:row-start-1 md:flex">
              <ConcaveFillet corner="bl" size={26} className="hidden md:block" />
              <span className="font-mono text-[14px] text-white/35">+</span>
              <div>
                <div className="text-[14px] font-medium text-white/90">Webcam or mouse</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
                  Use any ordinary webcam or switch to the built-in simulated hand.
                </p>
              </div>
            </div>

            {/* Bottom-left dark cutout */}
            <div className="relative flex flex-col justify-between rounded-[24px] p-5 md:col-span-4 md:col-start-1 md:row-start-2 md:rounded-none md:p-8">
              <ConcaveFillet corner="tr" size={26} className="hidden md:block" />
              <div className="text-[12.5px] leading-relaxed text-white/45">Jump straight into the 3-D workcell without creating an account.</div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => enter()}
                  className="group inline-flex items-center gap-2 border-b border-white/25 pb-1 text-[13.5px] font-medium text-white transition-colors hover:border-white"
                >
                  Try demo <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
                </button>
              </div>
            </div>

            {/* Bottom-middle attached light bridge */}
            <div className="flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-4 md:col-start-5 md:row-start-2 md:rounded-none md:rounded-bl-[26px] md:p-8">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">01 · Access</div>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={openRegister}
                  className="group inline-flex h-10 items-center gap-2 rounded-full bg-[#0a0a0b] px-5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-black/80 active:scale-[0.98]"
                >
                  Sign up <span className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
                </button>
              </div>
            </div>

            {/* Bottom-right attached light wing */}
            <div className="flex flex-col justify-between rounded-[24px] bg-[#ecece8] p-7 text-[#0a0a0b] md:col-span-4 md:col-start-9 md:row-start-2 md:rounded-none md:rounded-br-[26px] md:rounded-tr-[26px] md:p-8">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-black/45">02 · Arm</span>
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
          <span>TARS: a gesture robotics side project</span>
        </div>
        <div className="flex gap-6">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#specs" className="hover:text-white">Specs</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </div>
      </footer>

      {/* ---------------- Register modal (demo) ---------------- */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm transition-opacity duration-200" onClick={() => setModal(false)}>
          <div className="anim-modal-in w-full max-w-[380px] rounded-[28px] border border-white/[0.08] bg-[#111112] p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <Mark className="h-9 w-9 rounded-lg" />
              <button type="button" onClick={() => setModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Close">
                ✕
              </button>
            </div>
            <h3 className="mt-5 text-[22px] font-medium tracking-[-0.02em]">Create your account</h3>
            <p className="mt-1 text-[13px] text-white/45">This is a demo. Nothing is stored or sent anywhere.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enter(name, email);
              }}
              className="mt-6 space-y-2.5"
            >
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-[14px] placeholder-white/30 outline-none transition-colors focus:border-white/30"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-[14px] placeholder-white/30 outline-none transition-colors focus:border-white/30"
              />
              <input
                type="password"
                placeholder="Password"
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-[14px] placeholder-white/30 outline-none transition-colors focus:border-white/30"
              />
              <button type="submit" className="mt-2 h-11 w-full rounded-xl bg-white text-[14px] font-medium text-black transition-colors hover:bg-white/85">
                Continue
              </button>
            </form>
            <button type="button" onClick={() => enter()} className="mt-4 w-full text-center text-[12.5px] text-white/40 transition-colors hover:text-white">
              Continue as guest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
