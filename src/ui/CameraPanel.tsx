import { useEffect, useRef, useState } from 'react';
import { engine } from '../core/engine';
import { syntheticHand } from '../core/gestures/syntheticHand';
import { GESTURE_INFO, GestureName, HAND_CONNECTIONS, LM } from '../core/gestures/types';
import { useBridge } from '../state/store';
import { HandGlyph } from './HandGlyph';
import { Button, COLORS, Card, Dot, Meter, Segmented, cx } from './kit';

export const GESTURE_ORDER: GestureName[] = ['OPEN_PALM', 'POINT', 'PINCH', 'VICTORY', 'THUMBS_UP', 'FIST'];
export const SIM_KEYS: Record<string, GestureName> = { '1': 'POINT', '2': 'PINCH', '3': 'VICTORY', '4': 'THUMBS_UP', '5': 'FIST', '6': 'OPEN_PALM', '0': 'NONE' };
const KEY_OF = Object.fromEntries(Object.entries(SIM_KEYS).map(([k, g]) => [g, k])) as Record<GestureName, string>;

const TIP_OFFSET = (() => {
  const h = syntheticHand('POINT', { center: { x: 0.5, y: 0.5 } });
  return { x: h.image[LM.INDEX_TIP].x - 0.5, y: h.image[LM.INDEX_TIP].y - 0.5 };
})();

/** object-fit: cover mapping from normalised source coords to element pixels */
function coverMap(w: number, h: number, aspect: number) {
  const scale = Math.max(w / aspect, h);
  const dw = aspect * scale;
  const dh = scale;
  return { dw, dh, ox: (w - dw) / 2, oy: (h - dh) / 2 };
}

/** Hand skeleton, pointer and interaction-range overlay, drawn every frame outside React. */
function useOverlay(canvas: React.RefObject<HTMLCanvasElement>, mode: 'video' | 'sim') {
  useEffect(() => {
    const draw = () => {
      const c = canvas.current;
      if (!c) return;
      const w = c.clientWidth, h = c.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const s = useBridge.getState().settings;
      const m = coverMap(w, h, mode === 'video' ? engine.camera.aspect : 4 / 3);
      const X = (x: number) => m.ox + x * m.dw;
      const Y = (y: number) => m.oy + y * m.dh;
      const line = mode === 'video' ? 'rgba(255,255,255,0.9)' : COLORS.ink;

      const b = s.pointerBox;
      g.setLineDash([3, 5]);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      g.strokeRect(X(b.minX), Y(b.minY), (b.maxX - b.minX) * m.dw, (b.maxY - b.minY) * m.dh);
      g.setLineDash([]);
      if (!s.showLandmarks && mode === 'video') return;
      const p = engine.perception;
      if (!p) return;
      for (const hand of p.hands) {
        const pts = hand.observation.image;
        const primary = hand === p.primary;
        const gest = hand.stable.gesture;
        const col = gest === 'OPEN_PALM' ? COLORS.stop : primary ? line : mode === 'video' ? 'rgba(255,255,255,0.45)' : COLORS.faint;
        g.lineWidth = 1.6;
        g.strokeStyle = col;
        g.beginPath();
        for (const [a, bb] of HAND_CONNECTIONS) {
          g.moveTo(X(pts[a].x), Y(pts[a].y));
          g.lineTo(X(pts[bb].x), Y(pts[bb].y));
        }
        g.stroke();
        for (let i = 0; i < pts.length; i++) {
          const tip = [4, 8, 12, 16, 20].includes(i);
          g.fillStyle = tip ? COLORS.accent : col;
          g.beginPath();
          g.arc(X(pts[i].x), Y(pts[i].y), tip ? 3.2 : 2.2, 0, Math.PI * 2);
          g.fill();
        }
        if (primary) {
          const t4 = pts[LM.THUMB_TIP], t8 = pts[LM.INDEX_TIP];
          g.strokeStyle = COLORS.accent;
          g.lineWidth = 1.6;
          g.setLineDash([2, 3]);
          g.beginPath();
          g.moveTo(X(t4.x), Y(t4.y));
          g.lineTo(X(t8.x), Y(t8.y));
          g.stroke();
          g.setLineDash([]);
          if (gest === 'PINCH') {
            g.beginPath();
            g.arc(X((t4.x + t8.x) / 2), Y((t4.y + t8.y) / 2), 11, 0, Math.PI * 2);
            g.stroke();
          }
        }
        if (primary && gest === 'POINT') {
          const px = X(hand.pointer.x), py = Y(hand.pointer.y);
          g.strokeStyle = COLORS.accent;
          g.lineWidth = 1.5;
          g.beginPath();
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            g.moveTo(px + dx * 6, py + dy * 6);
            g.lineTo(px + dx * 14, py + dy * 14);
          }
          g.stroke();
        }
        // annotation callout (reference: technical labels next to the subject)
        const wr = pts[LM.WRIST];
        const label = `${hand.handedness.toUpperCase()} · ${GESTURE_INFO[gest].short}`;
        g.font = '500 10px "IBM Plex Mono", monospace';
        const tw = g.measureText(label).width;
        const lx = X(wr.x) - tw / 2 - 6, ly = Y(wr.y) + 12;
        g.fillStyle = 'rgba(10,10,11,0.82)';
        g.fillRect(lx, ly, tw + 12, 18);
        g.fillStyle = COLORS.ink;
        g.fillText(label, lx + 6, ly + 12.5);
      }
    };
    return engine.onFrame(draw);
  }, [canvas, mode]);
}

function VideoView() {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mirror = useBridge((s) => s.settings.mirror);
  useEffect(() => {
    holder.current?.prepend(engine.camera.video);
  }, []);
  useEffect(() => {
    engine.camera.video.style.transform = mirror ? 'scaleX(-1)' : '';
  }, [mirror]);
  useOverlay(canvas, 'video');
  return (
    <div ref={holder} className="absolute inset-0 bg-black">
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

function SimView() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useOverlay(canvas, 'sim');
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const m = coverMap(r.width, r.height, 4 / 3);
    const x = (e.clientX - r.left - m.ox) / m.dw;
    const y = (e.clientY - r.top - m.oy) / m.dh;
    if (engine.sim.gesture === 'POINT') engine.sim.moveTo(x - TIP_OFFSET.x, y - TIP_OFFSET.y);
    else engine.sim.moveTo(x, y);
  };
  const [depth, setDepth] = useState(engine.sim.scale);
  // mouse wheel = move the simulated hand toward (up) / away from (down) the camera
  const onWheel = (e: React.WheelEvent) => {
    const s = Math.min(2.2, Math.max(0.6, engine.sim.scale * Math.exp(-e.deltaY * 0.0015)));
    engine.sim.scale = s;
    setDepth(s);
  };
  return (
    <div className="grid-paper absolute inset-0 cursor-crosshair" onPointerMove={onMove} onWheel={onWheel}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <div className="mono pointer-events-none absolute right-4 top-14 text-right text-[10px] uppercase tracking-[0.1em] text-mute">
        Depth {depth >= 1 ? '+' : ''}
        {Math.round((depth - 1) * 100)}%<br />
        <span className="text-faint">scroll = closer / farther</span>
      </div>
    </div>
  );
}

function SimPicker() {
  const [, force] = useState(0);
  useBridge((s) => s.telemetry.perception.rawGesture); // re-render when recognition changes (keyboard 0–6)
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-paper/95 p-1 backdrop-blur">
      {(['NONE', ...GESTURE_ORDER] as GestureName[]).map((g) => (
        <button
          key={g}
          type="button"
          title={`${GESTURE_INFO[g].label} — ${GESTURE_INFO[g].action} (key ${KEY_OF[g]})`}
          onClick={() => {
            engine.sim.gesture = g;
            force((n) => n + 1);
          }}
          className={cx('flex h-8 w-8 items-center justify-center rounded-full transition-colors', engine.sim.gesture === g ? 'bg-ink text-inv' : 'text-sub hover:bg-white/5')}
        >
          <HandGlyph gesture={g} size={20} strokeWidth={1.4} />
        </button>
      ))}
    </div>
  );
}

function GestureReadout() {
  const t = useBridge((s) => s.telemetry);
  const p = t.perception;
  const input = t.input;
  const g = p.gesture;
  const confirming = p.confirmProgress > 0 && p.confirmProgress < 1;
  const pinching = p.grip < 0.25;
  const glyph: GestureName = confirming || (!t.armed && g === 'THUMBS_UP') ? 'THUMBS_UP' : pinching ? 'PINCH' : p.handCount ? 'OPEN_PALM' : 'NONE';
  const closePct = Math.round((1 - p.grip) * 100);
  const title = confirming
    ? 'Thumbs up — confirming'
    : !p.handCount
      ? input === 'none'
        ? 'Hand input off'
        : 'No hand in view'
      : !t.armed
        ? 'Show a thumbs-up to arm'
        : t.held
          ? `Holding ${t.held.toLowerCase()} — open fingers to drop`
          : pinching
            ? 'Holders closed (pinching)'
            : 'Direct hand control';
  const subtitle = confirming
    ? 'Keep holding thumbs-up…'
    : p.handCount
      ? 'Move hand: up/down · forward/back · left/right · thumb + index = holders'
      : 'Raise your hand in front of the camera';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper/95 px-3 py-2.5 backdrop-blur">
      <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', p.handCount ? 'bg-ink' : 'bg-white/[0.05]')}>
        <HandGlyph gesture={glyph} size={28} color={p.handCount ? COLORS.inv : COLORS.faint} strokeWidth={1.6} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium" style={{ color: p.handCount ? COLORS.ink : COLORS.mute }}>
            {title}
          </span>
          <span className="mono tnum shrink-0 text-[11px] text-mute">
            {p.handCount ? `Grip ${closePct}% · ${(t.gripperGap * 1000).toFixed(0)} mm` : ''}
          </span>
        </div>
        <div className="truncate text-[12px] text-mute">{subtitle}</div>
        <Meter className="mt-1.5" value={confirming ? p.confirmProgress : p.handCount ? 1 - p.grip : 0} color={confirming ? COLORS.ok : pinching ? COLORS.accent : COLORS.ink} />
      </div>
    </div>
  );
}

export function CameraView() {
  const input = useBridge((s) => s.telemetry.input);
  const p = useBridge((s) => s.telemetry.perception);
  const dry = useBridge((s) => s.telemetry.dryRun);
  const cam = useBridge((s) => s.cameraStatus);
  const camErr = useBridge((s) => s.cameraError);
  const tracker = useBridge((s) => s.trackerStatus);
  const trackerErr = useBridge((s) => s.trackerError);
  const [busy, setBusy] = useState(false);
  const enableCam = async () => {
    setBusy(true);
    await engine.enableCamera();
    setBusy(false);
  };
  const onVideo = input === 'camera' && cam === 'active';
  const status =
    input === 'none'
      ? 'Off'
      : input === 'camera' && tracker === 'loading'
        ? 'Loading model'
        : input === 'camera' && tracker === 'error'
          ? 'Model error'
          : p.handCount
            ? 'Tracking'
            : 'Searching';
  const dotColor = input === 'none' ? COLORS.faint : p.handCount ? COLORS.ok : COLORS.accent;

  return (
    <Card className="h-full">
      {onVideo ? (
        <VideoView />
      ) : input === 'simulated' ? (
        <SimView />
      ) : (
        <div className="grid-paper absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <HandGlyph gesture="OPEN_PALM" size={44} color={COLORS.faint} strokeWidth={1.4} />
          <div className="text-[17px] font-medium">{cam === 'requesting' ? 'Waiting for camera permission…' : 'Gesture input is off'}</div>
          <p className="max-w-[300px] text-[13px] text-mute">
            {cam === 'denied' || cam === 'unavailable' || cam === 'error'
              ? `${camErr} Try the simulated hand instead.`
              : 'Hand tracking runs locally on this device. No video leaves your computer.'}
          </p>
          <div className="mt-1 flex gap-2">
            <Button tone="dark" disabled={busy} onClick={enableCam}>
              {busy ? 'Starting…' : 'Enable webcam'}
            </Button>
            <Button onClick={() => engine.setInput('simulated')}>Simulated hand</Button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <div className={cx('flex items-center gap-2 rounded-full px-3 py-1.5', onVideo ? 'bg-ink/60 backdrop-blur' : 'bg-paper/90')}>
          <Dot color={dotColor} pulse={input !== 'none' && !p.handCount} />
          <span className={cx('label whitespace-nowrap', onVideo && '!text-inv/80')}>Vision · {status}</span>
          {input !== 'none' && <span className={cx('mono tnum text-[10.5px]', onVideo ? 'text-inv/60' : 'text-faint')}>{p.visionFps.toFixed(0)} fps</span>}
        </div>
        <Segmented
          value={input}
          onChange={(v) => (v === 'camera' ? void enableCam() : engine.setInput(v))}
          options={[
            { value: 'camera', label: 'Webcam' },
            { value: 'simulated', label: 'Sim' },
            { value: 'none', label: 'Off' },
          ]}
        />
      </div>
      {input === 'camera' && tracker === 'error' && <div className="absolute inset-x-4 top-16 rounded-xl bg-paper px-3 py-2 text-[12px] text-stop">{trackerErr}</div>}

      {input !== 'none' && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-2 p-4">
          {dry && <div className="self-start rounded-full bg-info px-3 py-1 text-[11px] font-medium text-inv">Test mode — gestures are not sent to the robot</div>}
          {input === 'simulated' && (
            <div className="flex justify-center">
              <SimPicker />
            </div>
          )}
          <GestureReadout />
        </div>
      )}
    </Card>
  );
}
