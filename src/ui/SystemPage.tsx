import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../core/engine';
import { GESTURE_INFO, GestureName } from '../core/gestures/types';
import { LogCategory } from '../core/log';
import { ROBOT } from '../core/robot/config';
import { Settings } from '../core/settings';
import { SystemTab, useBridge } from '../state/store';
import { GESTURE_ORDER } from './CameraPanel';
import { HandGlyph } from './HandGlyph';
import { Button, COLORS, Card, Corners, Dot, Kbd, Label, Logo, Meter, PHASE_STYLE, Segmented, cx } from './kit';
import { EStopButton } from './Workspace';

const TABS: { id: SystemTab; label: string; hint: string }[] = [
  { id: 'overview', label: 'Robot', hint: 'State & telemetry' },
  { id: 'gestures', label: 'Gestures', hint: 'Recognition & vocabulary' },
  { id: 'log', label: 'Activity', hint: 'Event log' },
  { id: 'preferences', label: 'Preferences', hint: 'Sensitivity, camera, safety' },
  { id: 'integration', label: 'Integration', hint: 'ROS 2 bridge' },
  { id: 'help', label: 'Help', hint: 'Shortcuts & safety' },
];

const R2D = 180 / Math.PI;

function Section({ title, children, className, aside }: { title: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <Card className={cx('p-5', className)}>
      <div className="mb-4 flex items-center gap-3">
        <Label>{title}</Label>
        <span className="h-px flex-1 bg-line" />
        {aside}
      </div>
      {children}
    </Card>
  );
}

/* ------------------------------ Robot ------------------------------ */
function Overview() {
  const t = useBridge((s) => s.telemetry);
  const ph = PHASE_STYLE[t.phase];
  const sel = t.selection ? engine.world.get(t.selection) : null;
  const reach = sel ? engine.robot.checkReachable(sel) : null;
  const mm = (v: number) => (v * 1000).toFixed(0);
  return (
    <div className="grid grid-cols-12 gap-3">
      <Card dark className="col-span-12 p-6 lg:col-span-5">
        <Corners color="#fff" opacity={0.3} />
        <Label className="!text-inv/50">Robot state</Label>
        <div className="mt-3 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full" style={{ background: ph.color }} />
          <span className="display text-[30px] uppercase leading-none">{ph.label}</span>
        </div>
        <div className="mono mt-5 space-y-1 text-[11.5px] uppercase tracking-[0.1em] text-inv/55">
          <div>Control: <span className="text-inv">{t.armed ? 'Armed' : 'Disarmed'}</span></div>
          <div>Command: <span className="text-inv">{t.activeCommand}</span></div>
          <div>Step: <span className="text-inv">{t.stepLabel ?? '—'}</span></div>
          <div>Input: <span className="text-inv">{t.input === 'camera' ? 'Webcam' : t.input === 'simulated' ? 'Simulated hand' : 'Keyboard / mouse'}</span></div>
          {t.paused && <div>Paused: <span className="text-accent">{t.paused}</span></div>}
        </div>
        {t.lastCommand && (
          <div className="mt-5 rounded-xl bg-inv/[0.06] px-3 py-2 text-[12.5px]">
            <span className="text-inv/50">Last command </span>
            <span className={t.lastCommand.accepted ? 'text-inv' : 'text-accent'}>{t.lastCommand.type}</span>
            <span className="text-inv/50"> from {t.lastCommand.source}</span>
            {!t.lastCommand.accepted && t.lastCommand.message && <div className="text-inv/60">{t.lastCommand.message}</div>}
          </div>
        )}
      </Card>

      <Section title="Tool centre point · base frame" className="col-span-12 lg:col-span-7">
        <div className="grid grid-cols-3 gap-2">
          {(['x', 'y', 'z'] as const).map((k) => (
            <div key={k} className="rounded-2xl border border-hair bg-paper px-4 py-3">
              <Label>{k} · mm</Label>
              <div className="tnum mt-1 text-[34px] font-light leading-none tracking-tight">{mm(t.ee[k])}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <Row k="Gripper opening" v={`${(t.gripperGap * 1000).toFixed(1)} mm`} />
          <Row k="Payload" v={t.held ?? '—'} />
          <Row k="Selected" v={sel ? `${sel.name}${reach?.ok ? '' : ' · unreachable'}` : '—'} warn={!!sel && !reach?.ok} />
          <Row k="Target" v={t.target ? `${mm(t.target.x)}, ${mm(t.target.y)}, ${mm(t.target.z)}` : '—'} warn={t.targetClamped} />
          <Row k="Speed limit" v={`${Math.round(engine.robot.speedScale * 100)} %`} />
          <Row k="Pending" v={t.pending?.label ?? '—'} />
        </div>
      </Section>

      <Section title="Joint space" className="col-span-12">
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 md:grid-cols-2">
          {t.q.map((q, i) => {
            const [lo, hi] = ROBOT.limits[i];
            const pos = (q - lo) / (hi - lo);
            const moving = Math.abs(t.qd[i]) > 0.01;
            return (
              <div key={i} className="grid grid-cols-[96px_1fr_70px_64px] items-center gap-3">
                <span className="text-[13px]">{ROBOT.jointNames[i]}</span>
                <div className="relative h-[3px] rounded-full bg-white/[0.08]">
                  <span className="absolute top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-sm" style={{ left: `calc(${pos * 100}% - 1px)`, background: pos < 0.05 || pos > 0.95 ? COLORS.stop : moving ? COLORS.accent : COLORS.ink }} />
                </div>
                <span className="mono tnum text-right text-[13px]">{(q * R2D).toFixed(1)}°</span>
                <span className="mono tnum text-right text-[11px]" style={{ color: moving ? COLORS.accent : COLORS.faint }}>
                  {(t.qd[i] * R2D).toFixed(0)}°/s
                </span>
              </div>
            );
          })}
        </div>
        <div className="mono mt-4 text-[11px] text-mute">
          Limits · {ROBOT.limits.map((l, i) => `J${i + 1} ${Math.round(l[0] * R2D)}…${Math.round(l[1] * R2D)}°`).join('  ·  ')}
        </div>
      </Section>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hair pb-1.5">
      <span className="text-mute">{k}</span>
      <span className={cx('mono tnum truncate text-right text-[12.5px]', warn && 'text-stop')}>{v}</span>
    </div>
  );
}

/* ----------------------------- Gestures ----------------------------- */
const GESTURE_HELP: Record<string, string> = {
  OPEN_PALM: 'Any time, either hand. Highest priority: halts motion and cancels pending commands.',
  POINT: 'Aim the ray. Hold still on a part to select it; while holding a part, on a zone to set a target.',
  PINCH: 'With a part selected: grab. Otherwise: steer the arm (clutch). Hand toward the screen lowers, away raises. Hover over a part, relax, pinch again to grab.',
  VICTORY: 'While holding a part: lower and release it. Deliberately distinct from the stop palm.',
  THUMBS_UP: 'Confirm: arm the robot, accept a target or placement. Hold 1 s to reset an emergency stop.',
  FIST: 'Neutral. Disengages the clutch; the robot holds its position.',
};

function Gestures() {
  const p = useBridge((s) => s.telemetry.perception);
  return (
    <div className="grid grid-cols-12 gap-3">
      <Section title="Live recognition" className="col-span-12 lg:col-span-5">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-ink">
            <HandGlyph gesture={p.gesture} size={52} color={p.gesture === 'OPEN_PALM' ? COLORS.stop : COLORS.inv} strokeWidth={1.5} />
          </div>
          <div>
            <div className="display text-[20px] uppercase leading-tight">{p.gesture === 'NONE' ? (p.handCount ? 'No gesture' : 'No hand') : GESTURE_INFO[p.gesture].label}</div>
            <div className="mono text-[11.5px] text-mute">
              {p.handedness ? `${p.handedness} hand · ` : ''}conf {Math.round(p.confidence * 100)}% · {p.visionFps.toFixed(0)} fps{p.inferenceMs ? ` · ${p.inferenceMs.toFixed(1)} ms` : ''}
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {GESTURE_ORDER.map((g) => {
            const on = p.gesture === g;
            return (
              <div key={g} className="grid grid-cols-[22px_80px_1fr_40px] items-center gap-2.5">
                <HandGlyph gesture={g} size={18} color={on ? COLORS.ink : COLORS.faint} />
                <span className={cx('mono text-[10.5px] uppercase tracking-wider', on ? 'text-ink' : 'text-mute')}>{GESTURE_INFO[g].short}</span>
                <Meter value={p.scores?.[g] ?? 0} color={on ? (g === 'OPEN_PALM' ? COLORS.stop : COLORS.accent) : COLORS.faint} />
                <span className="mono tnum text-right text-[11px] text-mute">{Math.round((p.scores?.[g] ?? 0) * 100)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[12px] text-mute">Raw per-frame scores. A gesture becomes active once it stays above the confidence threshold for the activation delay.</p>
      </Section>
      <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-7">
        {GESTURE_ORDER.map((g) => (
          <Card key={g} className="p-4" dark={g === 'OPEN_PALM'}>
            <div className="flex items-start justify-between">
              <HandGlyph gesture={g as GestureName} size={36} color={g === 'OPEN_PALM' ? COLORS.stop : COLORS.ink} strokeWidth={1.4} />
              <span className={cx('mono rounded-full border px-2 py-0.5 text-[10px] tracking-wider', g === 'OPEN_PALM' ? 'border-inv/25 text-inv/80' : 'border-line text-sub')}>{GESTURE_INFO[g].short}</span>
            </div>
            <div className="mt-3 text-[16px] font-medium">{GESTURE_INFO[g].label}</div>
            <p className={cx('mt-1 text-[12.5px] leading-snug', g === 'OPEN_PALM' ? 'text-inv/65' : 'text-mute')}>{GESTURE_HELP[g]}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Activity ----------------------------- */
const LEVEL: Record<string, string> = { info: COLORS.faint, success: COLORS.ok, warn: COLORS.accent, error: COLORS.stop, safety: COLORS.stop };
function Activity() {
  const logs = useBridge((s) => s.logs);
  const clear = useBridge((s) => s.clearLogs);
  const [filter, setFilter] = useState<'all' | LogCategory>('all');
  const box = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => (filter === 'all' ? logs : logs.filter((l) => l.category === filter)), [logs, filter]);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown]);
  const exportLog = () => {
    const blob = new Blob([JSON.stringify(engine.log.entries, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tars-activity-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-hair px-5 py-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'safety', label: 'Safety' },
            { value: 'robot', label: 'Robot' },
            { value: 'command', label: 'Commands' },
            { value: 'gesture', label: 'Gestures' },
            { value: 'vision', label: 'Vision' },
          ]}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={exportLog}>
            Export JSON
          </Button>
          <Button size="sm" tone="ghost" onClick={clear}>
            Clear
          </Button>
        </div>
      </div>
      <div ref={box} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {shown.length === 0 && <div className="py-6 text-[13px] text-mute">No events.</div>}
        {shown.map((e) => (
          <div key={e.id} className="grid grid-cols-[96px_80px_1fr] items-baseline gap-3 border-b border-hair py-1.5 text-[13px]">
            <span className="mono tnum text-[11px] text-mute">
              {new Date(e.t).toLocaleTimeString([], { hour12: false })}.{String(new Date(e.t).getMilliseconds()).padStart(3, '0')}
            </span>
            <span className="label">{e.category}</span>
            <span className="flex items-baseline gap-2">
              <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: LEVEL[e.level] }} />
              <span className={e.level === 'safety' ? 'font-medium text-stop' : e.level === 'warn' ? 'text-accent' : ''}>{e.message}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------- Preferences --------------------------- */
function Slider({ label, hint, value, min, max, step, fmt, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="block py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13.5px]">{label}</span>
        <span className="mono tnum text-[12px]">{fmt(value)}</span>
      </div>
      <input type="range" className="mt-1.5 w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint && <div className="text-[11.5px] text-mute">{hint}</div>}
    </label>
  );
}
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-start justify-between gap-4 py-2 text-left">
      <span>
        <span className="block text-[13.5px]">{label}</span>
        {hint && <span className="block text-[11.5px] text-mute">{hint}</span>}
      </span>
      <span className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', value ? 'bg-ink' : 'bg-white/15')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full transition-all', value ? 'left-[18px] bg-canvas' : 'left-0.5 bg-sub')} />
      </span>
    </button>
  );
}
function Select({ label, value, options, onChange, hint }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block py-2">
      <span className="text-[13.5px]">{label}</span>
      <select className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-ink" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o, i) => (
          <option key={`${i}:${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-[11.5px] text-mute">{hint}</span>}
    </label>
  );
}

function Preferences() {
  const s = useBridge((st) => st.settings);
  const set = useBridge((st) => st.setSettings);
  const reset = useBridge((st) => st.resetSettings);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    engine.camera.listDevices().then(setDevices);
  }, []);
  const upd = (p: Partial<Settings>) => set(p);
  return (
    <div className="grid grid-cols-12 gap-3">
      <Section title="Gesture recognition" className="col-span-12 lg:col-span-6" aside={<Button size="sm" tone="ghost" onClick={reset}>Restore defaults</Button>}>
        <Slider label="Confidence threshold" hint="Higher means fewer false activations" value={s.confidenceThreshold} min={0.4} max={0.9} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd({ confidenceThreshold: v })} />
        <Slider label="Pinch sensitivity" hint="Thumb–index distance counted as a pinch (palm widths)" value={s.pinchThreshold} min={0.12} max={0.45} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => upd({ pinchThreshold: v })} />
        <Slider label="Activation delay" hint="Hold time before a gesture counts. Stop uses at most 140 ms." value={s.activationDelay} min={80} max={700} step={10} fmt={(v) => `${v} ms`} onChange={(v) => upd({ activationDelay: v })} />
        <Slider label="Pointing dwell" hint="Hold time to select a part or set a target" value={s.dwellMs} min={300} max={1800} step={50} fmt={(v) => `${v} ms`} onChange={(v) => upd({ dwellMs: v })} />
        <Slider label="Pointer smoothing" hint="Jitter vs. lag (One-Euro filter)" value={s.pointerSmoothing} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd({ pointerSmoothing: v })} />
      </Section>
      <div className="col-span-12 space-y-3 lg:col-span-6">
        <Section title="Motion">
          <Slider label="Movement sensitivity" hint="Robot travel per full-frame hand movement" value={s.moveSensitivity} min={0.3} max={2.5} step={0.05} fmt={(v) => `${v.toFixed(2)} m`} onChange={(v) => upd({ moveSensitivity: v })} />
          <Slider
            label="Forward / back reach from hand distance"
            hint="Move your hand toward the camera to reach forward, pull back to retract. Up / down in the frame raises / lowers the arm. 0 = off."
            value={s.heightSensitivity ?? 0.9}
            min={0}
            max={1.8}
            step={0.05}
            fmt={(v) => (v === 0 ? 'Off' : `${v.toFixed(2)} m`)}
            onChange={(v) => upd({ heightSensitivity: v })}
          />
          <Slider label="Robot speed limit" value={s.robotSpeed} min={0.2} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd({ robotSpeed: v })} />
        </Section>
        <Section title="Camera">
          <Select
            label="Device"
            value={s.cameraDeviceId ?? ''}
            options={[{ value: '', label: 'Default camera' }, ...devices.filter((d) => d.deviceId).map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` }))]}
            onChange={async (v) => {
              upd({ cameraDeviceId: v || null });
              if (engine.input === 'camera') await engine.enableCamera();
            }}
          />
          <Select
            label="Control hand"
            value={s.preferredHand}
            hint="The stop gesture is accepted from either hand."
            options={[
              { value: 'auto', label: 'Automatic (first detected)' },
              { value: 'Right', label: 'Right hand' },
              { value: 'Left', label: 'Left hand' },
            ]}
            onChange={(v) => upd({ preferredHand: v as Settings['preferredHand'] })}
          />
          <Toggle label="Mirror view" hint="Selfie view: moving right moves the pointer right" value={s.mirror} onChange={(v) => upd({ mirror: v })} />
          <Toggle label="Show hand landmarks" value={s.showLandmarks} onChange={(v) => upd({ showLandmarks: v })} />
        </Section>
        <Section title="Safety">
          <Toggle label="Pause on tracking loss" hint="Halt motion when the hand leaves the view for more than 250 ms" value={s.pauseOnTrackingLoss} onChange={(v) => upd({ pauseOnTrackingLoss: v })} />
          <Toggle label="Confirm placements outside zones" hint="Require a thumbs-up before setting a part down elsewhere" value={s.requirePlaceConfirm} onChange={(v) => upd({ requirePlaceConfirm: v })} />
          <p className="mt-2 text-[11.5px] text-mute">Always on: stop priority, joint and workspace limits, speed limits, collision floor, duplicate-command suppression.</p>
        </Section>
      </div>
    </div>
  );
}

/* --------------------------- Integration --------------------------- */
function Integration() {
  const s = useBridge((st) => st.settings);
  const set = useBridge((st) => st.setSettings);
  const [url, setUrl] = useState(s.rosUrl);
  return (
    <div className="grid grid-cols-12 gap-3">
      <Section title="ROS 2 · rosbridge" className="col-span-12 lg:col-span-6">
        <Toggle label="Publish to rosbridge" hint="Commands and joint states are streamed over WebSocket" value={s.rosEnabled} onChange={(v) => set({ rosEnabled: v, rosUrl: url })} />
        <label className="mt-2 block">
          <span className="text-[13.5px]">Server URL</span>
          <input className="mono mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] outline-none focus:border-ink" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => set({ rosUrl: url })} />
        </label>
        <div className="mt-3 flex items-center gap-2 text-[12.5px]">
          <Dot color={engine.ros?.status === 'connected' ? COLORS.ok : s.rosEnabled ? COLORS.accent : COLORS.faint} />
          {s.rosEnabled ? engine.ros?.status ?? 'connecting' : 'Disabled'}
        </div>
      </Section>
      <Section title="Topics" className="col-span-12 lg:col-span-6">
        <div className="mono space-y-2 text-[12.5px]">
          <div className="flex justify-between border-b border-hair pb-2">
            <span>/bridge/command</span>
            <span className="text-mute">std_msgs/String (JSON)</span>
          </div>
          <div className="flex justify-between border-b border-hair pb-2">
            <span>/bridge/joint_states</span>
            <span className="text-mute">sensor_msgs/JointState</span>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-mute">
          Start a bridge with <span className="mono text-ink">ros2 launch rosbridge_server rosbridge_websocket_launch.xml</span>. Commands are plain serialisable objects, so a ROS 2 node can
          execute them on a real controller in place of the simulator.
        </p>
      </Section>
    </div>
  );
}

/* ------------------------------ Help ------------------------------ */
const KEYS: [string, string][] = [
  ['Space', 'Emergency stop'],
  ['Enter', 'Confirm · arm · reset stop'],
  ['Esc', 'Cancel pending action'],
  ['G', 'Grab selected part'],
  ['R', 'Release part'],
  ['H', 'Move home'],
  ['N', 'Select next part'],
  ['W A S D', 'Jog (view-relative)'],
  ['Q / E', 'Jog down / up'],
  ['1–6, 0', 'Simulated hand gesture'],
  ['Scroll', 'Simulated hand closer / farther'],
  ['T', 'Simulated hand in / out of view'],
  ['?', 'Open this page'],
];
function Help() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <Section title="Keyboard" className="col-span-12 lg:col-span-6">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-hair py-2 text-[13px]">
              <span className="text-sub">{v}</span>
              <Kbd>{k}</Kbd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-mute">Mouse: click a part to select it, double-click to grab. While holding, click the bench or a zone to send the arm there. Drag to orbit, scroll to zoom.</p>
      </Section>
      <div className="col-span-12 space-y-3 lg:col-span-6">
        <Card dark className="p-5">
          <Label className="!text-inv/50">Safety notice</Label>
          <p className="mt-2 text-[13.5px] leading-relaxed text-inv/80">
            TARS is a simulation. The stop, tracking-loss hold, workspace limits and speed limits are simulated. It is <span className="text-inv">not</span> a certified safety system and must not
            be used to operate physical industrial robots.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */
export function SystemPage() {
  const tab = useBridge((s) => s.systemTab);
  const set = useBridge((s) => s.set);
  const phase = useBridge((s) => s.telemetry.phase);
  const ph = PHASE_STYLE[phase];
  const current = TABS.find((x) => x.id === tab)!;
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="label">System</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-1 flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5">
            <Dot color={ph.color} />
            <span className="label !text-ink">{ph.label}</span>
          </div>
          <Button tone="dark" onClick={() => set({ view: 'workspace' })}>
            ← Workspace
          </Button>
          <EStopButton />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] gap-3 px-3 pb-3">
        <nav className="flex flex-col rounded-card border border-hair bg-card p-2">
          {TABS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => set({ systemTab: x.id })}
              className={cx('flex items-baseline gap-3 rounded-2xl px-3 py-3 text-left transition-colors', tab === x.id ? 'bg-ink text-inv' : 'hover:bg-white/[0.04]')}
            >
              <span className={cx('mono text-[10.5px]', tab === x.id ? 'text-inv/50' : 'text-faint')}>{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="block text-[14px] font-medium">{x.label}</span>
                <span className={cx('block text-[11.5px]', tab === x.id ? 'text-inv/55' : 'text-mute')}>{x.hint}</span>
              </span>
            </button>
          ))}
          <div className="mt-auto p-3 text-[11px] leading-snug text-mute">Simulation · not safety-certified</div>
        </nav>
        <main className="scroll-thin flex min-h-0 flex-col overflow-y-auto">
          <div className="px-1 pb-5 pt-2">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="display text-[12px] uppercase tracking-[0.2em]">System overview</span>
              <span className="display text-[12px] tracking-[0.2em]">{String(TABS.findIndex((x) => x.id === tab) + 1).padStart(2, '0')}</span>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <h1 className="display text-[38px] uppercase leading-none">{current.label}</h1>
              <span className="label pb-1">{current.hint}</span>
            </div>
          </div>
          <div className={cx('min-h-0', tab === 'log' && 'flex-1')}>
            {tab === 'overview' && <Overview />}
            {tab === 'gestures' && <Gestures />}
            {tab === 'log' && <Activity />}
            {tab === 'preferences' && <Preferences />}
            {tab === 'integration' && <Integration />}
            {tab === 'help' && <Help />}
          </div>
        </main>
      </div>
    </div>
  );
}
