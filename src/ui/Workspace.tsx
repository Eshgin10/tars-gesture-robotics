import { engine } from '../core/engine';
import { ROBOT } from '../core/robot/config';
import { Scene } from '../scene/Scene';
import { useBridge } from '../state/store';
import { CameraView } from './CameraPanel';
import { HandGlyph } from './HandGlyph';
import { Button, COLORS, Card, Dot, Kbd, Label, Logo, Meter, PHASE_STYLE, Popover, Stat, cx } from './kit';

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
export function EStopButton() {
  const estop = useBridge((s) => s.telemetry.estop);
  return estop ? (
    <Button tone="ok" className="w-[132px]" onClick={() => engine.send({ type: 'CONFIRM' }, 'ui')}>
      Reset stop <Kbd dark>↵</Kbd>
    </Button>
  ) : (
    <Button tone="stop" className="w-[132px] tracking-wide" onClick={() => engine.send({ type: 'STOP', reason: 'E-STOP button' }, 'ui')} title="Emergency stop (Space)">
      <span className="h-2 w-2 rounded-[2px] bg-white" /> E-STOP
    </Button>
  );
}

function Header() {
  const t = useBridge((s) => s.telemetry);
  const setView = useBridge((s) => s.set);
  const user = useBridge((s) => s.user);
  const openSystem = useBridge((s) => s.openSystem);
  const ph = PHASE_STYLE[t.phase];
  return (
    <header className="mx-5 flex h-14 shrink-0 items-center justify-between border-b border-line">
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => setView({ view: 'landing' })}
          className="transition-opacity hover:opacity-80"
          title="Return to Home / Landing"
        >
          <Logo />
        </button>
        {user && (
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-mono text-white/60 md:inline-block">
            {user.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <Dot color={ph.color} pulse={t.phase === 'ESTOP' || t.phase === 'PAUSED'} />
        <span className="display text-[11px] uppercase tracking-[0.18em]">{ph.label}</span>
        <span className="label">{t.armed || t.phase === 'ESTOP' ? '· armed' : '· disarmed'}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button tone="ghost" size="sm" onClick={() => setView({ view: 'landing' })}>
          Exit
        </Button>
        <Button tone="outline" onClick={() => openSystem('overview')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <path d="M2 4h7M12 4h2M2 12h2M7 12h7" />
            <circle cx="10.5" cy="4" r="1.6" />
            <circle cx="5.5" cy="12" r="1.6" />
          </svg>
          System
        </Button>
        <EStopButton />
      </div>
    </header>
  );
}

function Banners() {
  const t = useBridge((s) => s.telemetry);
  const prog = t.perception.gesture === 'THUMBS_UP' ? t.perception.confirmProgress : 0;
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 flex w-[420px] max-w-[60%] -translate-x-1/2 flex-col gap-2">
      {t.warning && !t.estop && <div className="animate-fadeUp rounded-2xl border border-line bg-paper/95 px-4 py-2.5 text-[13px] text-ink backdrop-blur"><span className="mr-2 text-accent">●</span>{t.warning}</div>}
      {t.phase === 'PAUSED' && (
        <div className="pointer-events-auto animate-fadeUp rounded-2xl border border-line bg-paper/95 px-4 py-3 backdrop-blur">
          <Label className="!text-accent">Motion paused</Label>
          <div className="mt-0.5 text-[13.5px]">{t.paused} — show your hand to resume.</div>
          <Button size="sm" className="mt-2" onClick={() => engine.send({ type: 'RESUME' }, 'ui')}>
            Resume
          </Button>
        </div>
      )}
      {t.pending && !t.estop && (
        <div className="pointer-events-auto animate-fadeUp rounded-2xl bg-ink px-4 py-3 text-inv">
          <Label className="!text-inv/60">Confirm</Label>
          <div className="mt-0.5 text-[14px]">{t.pending.label}</div>
          <div className="mt-2.5 flex items-center gap-2">
            <Button size="sm" tone="accent" onClick={() => engine.send({ type: 'CONFIRM' }, 'ui')}>
              Confirm <Kbd dark>↵</Kbd>
            </Button>
            <Button size="sm" tone="ghost" className="!text-inv/70 hover:!bg-inv/10" onClick={() => engine.send({ type: 'CANCEL' }, 'ui')}>
              Cancel
            </Button>
            {prog > 0 && <Meter className="flex-1 !bg-inv/20" value={prog} color={COLORS.accent} />}
          </div>
        </div>
      )}
    </div>
  );
}

function EStopOverlay() {
  const t = useBridge((s) => s.telemetry);
  if (!t.estop) return null;
  const prog = t.perception.gesture === 'THUMBS_UP' ? t.perception.confirmProgress : 0;
  return (
    <div className="estop-frame absolute inset-0 flex items-center justify-center rounded-card bg-stop/[0.04]">
      <div className="w-[360px] animate-fadeUp rounded-2xl bg-paper p-5 text-center shadow-[0_24px_60px_-24px_rgba(0,0,0,0.4)]">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stop">
          <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
        </div>
        <div className="display text-[18px] uppercase">Emergency stop</div>
        <p className="mt-1 text-[13px] text-sub">Motion halted. Pending commands cancelled. Grip maintained.</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-mute">
          <HandGlyph gesture="THUMBS_UP" size={18} color={COLORS.ink} /> Hold a thumbs-up for 1 s, or
        </div>
        {prog > 0 && <Meter className="mx-auto mt-2 w-40" value={prog} color={COLORS.ok} />}
        <Button tone="dark" className="mt-3" onClick={() => engine.send({ type: 'CONFIRM' }, 'ui')}>
          Reset emergency stop
        </Button>
      </div>
    </div>
  );
}

function ViewportCard() {
  return (
    <Card className="h-full">
      <Scene />
      <Banners />
      <EStopOverlay />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Dock — everything secondary lives in popovers                       */
/* ------------------------------------------------------------------ */
function PrimaryAction() {
  const t = useBridge((s) => s.telemetry);
  const send = (c: Parameters<typeof engine.send>[0]) => engine.send(c, 'ui');
  if (t.estop) return null;
  if (!t.armed)
    return (
      <Button tone="dark" onClick={() => send({ type: 'CONFIRM' })}>
        Arm robot <Kbd dark>↵</Kbd>
      </Button>
    );
  if (t.phase === 'IDLE' && t.selection)
    return (
      <Button tone="dark" onClick={() => send({ type: 'GRAB' })}>
        Grab <Kbd dark>G</Kbd>
      </Button>
    );
  if (t.phase === 'CARRYING')
    return (
      <Button tone="dark" onClick={() => send({ type: 'RELEASE' })}>
        Release <Kbd dark>R</Kbd>
      </Button>
    );
  return null;
}

function ControlsMenu() {
  const t = useBridge((s) => s.telemetry);
  const send = (c: Parameters<typeof engine.send>[0]) => engine.send(c, 'ui');
  const idle = t.phase === 'IDLE' || t.phase === 'CARRYING';
  const items: { label: string; key?: string; disabled?: boolean; run: () => void }[] = [
    { label: 'Grab selected part', key: 'G', disabled: !t.armed || t.phase !== 'IDLE' || !t.selection, run: () => send({ type: 'GRAB' }) },
    { label: 'Release part', key: 'R', disabled: t.phase !== 'CARRYING', run: () => send({ type: 'RELEASE' }) },
    {
      label: 'Select next part',
      key: 'N',
      disabled: !!t.held,
      run: () => {
        const objs = engine.world.objects.filter((o) => o.state === 'resting');
        const i = objs.findIndex((o) => o.id === engine.robot.selection);
        if (objs.length) send({ type: 'SELECT_OBJECT', objectId: objs[(i + 1) % objs.length].id });
      },
    },
    { label: 'Move home', key: 'H', disabled: !t.armed || !idle, run: () => send({ type: 'HOME' }) },
    { label: 'Reset workcell…', run: () => send({ type: 'RESET' }) },
  ];
  return (
    <Popover
      align="center"
      width={280}
      trigger={(open, toggle) => (
        <Button tone="outline" active={open} onClick={toggle}>
          Controls
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 6.5 5 3.5 8 6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
        </Button>
      )}
    >
      {(close) => (
        <div className="space-y-0.5">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                it.run();
                close();
              }}
              className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {it.label}
              {it.key && <Kbd>{it.key}</Kbd>}
            </button>
          ))}
          <div className="mt-1 border-t border-hair px-2.5 pt-2 text-[11.5px] leading-snug text-mute">
            Mouse: click a part to select, double-click to grab, click the bench to move while holding. WASD / Q E to jog.
          </div>
        </div>
      )}
    </Popover>
  );
}

function TelemetryMenu() {
  const t = useBridge((s) => s.telemetry);
  const openSystem = useBridge((s) => s.openSystem);
  const mm = (v: number) => (v * 1000).toFixed(0);
  return (
    <Popover
      align="right"
      width={340}
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} title="Live telemetry" className={cx('grid grid-cols-3 gap-5 text-left transition-opacity xl:grid-cols-5', open ? 'opacity-100' : 'opacity-90 hover:opacity-100')}>
          <Stat label="TCP X" value={mm(t.ee.x)} unit="mm" />
          <Stat label="TCP Y" value={mm(t.ee.y)} unit="mm" />
          <Stat label="TCP Z" value={mm(t.ee.z)} unit="mm" />
          <Stat className="hidden xl:block" label="Gripper" value={(t.gripperGap * 1000).toFixed(0)} unit="mm" />
          <Stat className="hidden xl:block" label="Speed" value={Math.round(engine.robot.speedScale * 100)} unit="%" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between">
            <Label>Live telemetry</Label>
            <button
              type="button"
              className="mono text-[11px] uppercase tracking-wider text-sub hover:text-ink"
              onClick={() => {
                close();
                openSystem('overview');
              }}
            >
              Details →
            </button>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {t.q.map((q, i) => {
              const [lo, hi] = ROBOT.limits[i];
              return (
                <div key={i} className="grid grid-cols-[74px_1fr_56px] items-center gap-2">
                  <span className="text-[12px] text-sub">{ROBOT.jointNames[i]}</span>
                  <Meter value={(q - lo) / (hi - lo)} color={Math.abs(t.qd[i]) > 0.01 ? COLORS.accent : COLORS.ink} />
                  <span className="mono tnum text-right text-[11.5px]">{((q * 180) / Math.PI).toFixed(1)}°</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-hair pt-2.5 text-[12px]">
            <div>
              <Label>Gripper</Label>
              <div className="mono tnum">{(t.gripperGap * 1000).toFixed(1)} mm</div>
            </div>
            <div>
              <Label>Target</Label>
              <div className={cx('mono tnum', t.targetClamped && 'text-stop')}>{t.target ? `${mm(t.target.x)}, ${mm(t.target.y)}, ${mm(t.target.z)}` : '—'}</div>
            </div>
          </div>
        </>
      )}
    </Popover>
  );
}

/** Bottom strip in the style of a "technical overview" table: event · actions · figures. */
function Dock() {
  return (
    <div className="mx-5 flex h-[72px] shrink-0 items-center justify-between gap-6 border-t border-line/40">
      <div className="flex items-center gap-3">
        <PrimaryAction />
        <ControlsMenu />
      </div>
      <TelemetryMenu />
    </div>
  );
}

export function Workspace() {
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] gap-4 px-5 pt-4">
        <ViewportCard />
        <CameraView />
      </div>
      <Dock />
    </div>
  );
}
