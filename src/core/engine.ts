import { CameraManager } from '../vision/camera';
import { HandTracker } from '../vision/handTracker';
import { CommandBus } from './commands/commandBus';
import { CommandBody, CommandSource } from './commands/commands';
import { GestureScores } from './gestures/classifier';
import { GestureRecognizer, Perception } from './gestures/recognizer';
import { GestureName, HandFrame } from './gestures/types';
import { AimState, GestureInterpreter, RobotView, ViewportQuery } from './interpreter/interpreter';
import { EventLog } from './log';
import { Vec3 } from './math';
import { RobotController, RobotPhase } from './robot/controller';
import { DEFAULT_SETTINGS, Settings } from './settings';
import { SimulatedHand } from './simulatedHand';
import { RosBridgeTransport } from './transport/rosbridge';
import { fallbackViewport } from './viewport';
import { WorldModel } from './world/world';

export type InputMode = 'none' | 'camera' | 'simulated';

export interface Telemetry {
  phase: RobotPhase;
  armed: boolean;
  estop: boolean;
  paused: string | null;
  q: number[];
  qd: number[];
  ee: Vec3;
  gripperGap: number;
  fingers: { left: number; right: number };
  held: string | null;
  selection: string | null;
  target: Vec3 | null;
  targetClamped: boolean;
  activeCommand: string;
  stepLabel: string | null;
  pending: { kind: string; label: string } | null;
  warning: string | null;
  lastCommand: { type: string; source: string; accepted: boolean; message?: string } | null;
  input: InputMode;
  dryRun: boolean;
  perception: {
    handCount: number;
    handedness: string | null;
    gesture: GestureName;
    confidence: number;
    candidate: GestureName;
    progress: number;
    rawGesture: GestureName;
    rawConfidence: number;
    scores: GestureScores | null;
    trackingLost: boolean;
    clutch: boolean;
    grip: number;
    confirmProgress: number;
    aim: AimState;
    latencyMs: number;
    inferenceMs: number;
    visionFps: number;
  };
  fps: number;
}

/**
 * Orchestrates the pipeline every animation frame:
 *   camera/simulated hand → recognizer → interpreter → command bus → robot sim → world
 * All modules are independent; the engine only wires them together.
 */
export class BridgeEngine {
  log = new EventLog();
  world = new WorldModel();
  robot = new RobotController(this.world, this.log);
  bus = new CommandBus(this.robot, this.log);
  recognizer = new GestureRecognizer();
  interpreter = new GestureInterpreter();
  camera = new CameraManager();
  tracker = new HandTracker();
  sim = new SimulatedHand();
  view: ViewportQuery = fallbackViewport(this.world);
  ros: RosBridgeTransport | null = null;

  input: InputMode = 'none';
  /** calibration / gesture-test mode: commands are evaluated but not sent */
  dryRun = false;
  settings: Settings = { ...DEFAULT_SETTINGS };
  perception: Perception | null = null;
  frame: HandFrame | null = null;

  private raf = 0;
  private last = 0;
  private lastEmit = 0;
  private lastRos = 0;
  private fpsAcc = { frames: 0, t: 0, fps: 0 };
  private visionAcc = { frames: 0, t: 0, fps: 0, lastFrameT: -1 };
  private prevHandCount = 0;
  private prevGesture: GestureName = 'NONE';
  private telemetryListeners = new Set<(t: Telemetry) => void>();
  private frameListeners = new Set<(e: BridgeEngine) => void>();

  constructor() {
    this.applySettings(this.settings);
    this.log.push('info', 'system', 'TARS initialised — simulation mode (not a certified safety system)');
  }

  /* ---------------- lifecycle ---------------- */
  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t: number) => {
      this.tick(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  onTelemetry(fn: (t: Telemetry) => void) {
    this.telemetryListeners.add(fn);
    fn(this.telemetry());
    return () => {
      this.telemetryListeners.delete(fn);
    };
  }

  onFrame(fn: (e: BridgeEngine) => void) {
    this.frameListeners.add(fn);
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  /* ---------------- configuration ---------------- */
  applySettings(s: Settings) {
    this.settings = s;
    const r = this.recognizer.params;
    r.classifier.pinchThreshold = s.pinchThreshold;
    r.stabilizer.confidenceThreshold = s.confidenceThreshold;
    r.stabilizer.activationDelay = s.activationDelay;
    r.stabilizer.stopDelay = Math.min(140, s.activationDelay);
    r.preferredHand = s.preferredHand;
    r.filterMinCutoff = 3.2 - s.pointerSmoothing * 2.8;
    r.filterBeta = 0.6 - s.pointerSmoothing * 0.5;
    const ip = this.interpreter.params;
    ip.dwellMs = s.dwellMs;
    ip.moveSensitivity = s.moveSensitivity;
    ip.heightSensitivity = s.heightSensitivity ?? 0.9;
    ip.gripClosed = s.pinchThreshold;
    ip.pointerBox = s.pointerBox;
    ip.trackingLossMs = s.pauseOnTrackingLoss ? 250 : Number.POSITIVE_INFINITY;
    this.robot.speedScale = s.robotSpeed;
    this.robot.requirePlaceConfirmOutsideZones = s.requirePlaceConfirm;
    this.setRos(s.rosEnabled, s.rosUrl);
  }

  private setRos(enabled: boolean, url: string) {
    if (!enabled) {
      if (this.ros) {
        this.ros.disconnect();
        this.bus.transports.delete(this.ros);
        this.ros = null;
        this.log.push('info', 'system', 'ROS 2 bridge disconnected');
      }
      return;
    }
    if (this.ros && this.ros.url === url) return;
    if (this.ros) {
      this.ros.disconnect();
      this.bus.transports.delete(this.ros);
    }
    this.ros = new RosBridgeTransport(url);
    this.ros.onStatus = (st) => this.log.push(st === 'error' ? 'warn' : 'info', 'system', `ROS 2 bridge ${st} (${url})`);
    this.bus.transports.add(this.ros);
    this.ros.connect();
  }

  async enableCamera(): Promise<boolean> {
    const ok = await this.camera.start(this.settings.cameraDeviceId);
    if (!ok) {
      this.log.push('warn', 'vision', `Camera unavailable — ${this.camera.error || this.camera.status}`);
      return false;
    }
    this.log.push('success', 'vision', 'Camera stream active', 'camera_on');
    this.setInput('camera');
    if (this.tracker.status !== 'ready') {
      this.log.push('info', 'vision', 'Loading MediaPipe Hand Landmarker …');
      await this.tracker.init();
      if ((this.tracker.status as string) === 'ready') this.log.push('success', 'vision', `Hand tracking ready (${this.tracker.delegate} delegate)`);
      else this.log.push('error', 'vision', `Hand tracking failed to load — ${this.tracker.error}`);
    }
    return this.tracker.status === 'ready';
  }

  disableCamera() {
    this.camera.stop();
    if (this.input === 'camera') this.setInput('none');
  }

  setInput(mode: InputMode) {
    if (mode === this.input) return;
    if (mode !== 'camera' && this.input === 'camera') this.camera.stop();
    this.input = mode;
    this.recognizer.reset();
    this.interpreter = new GestureInterpreter(this.interpreter.params);
    this.log.push('info', 'system', `Input source: ${mode === 'none' ? 'keyboard & mouse only' : mode === 'camera' ? 'webcam hand tracking' : 'simulated hand'}`);
  }

  /** Commands from keyboard / mouse / UI go through the same bus and validation. */
  send(cmd: CommandBody, source: CommandSource) {
    return this.bus.send(cmd, source);
  }

  robotView(): RobotView {
    const r = this.robot;
    return { phase: r.phase, armed: r.armed, estop: r.estop, held: r.held, selection: r.selection, pending: r.pending?.kind ?? null, ee: r.ee };
  }

  /* ---------------- main loop ---------------- */
  tick(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    // 1. perception
    let frame: HandFrame | null = null;
    if (this.input === 'camera' && this.camera.status === 'active') frame = this.tracker.detect(this.camera.video, this.settings.mirror, now);
    else if (this.input === 'simulated') frame = this.sim.frame(now);
    if (frame && frame.t !== this.visionAcc.lastFrameT) {
      this.visionAcc.lastFrameT = frame.t;
      this.visionAcc.frames++;
    }
    this.frame = frame;
    const p = this.recognizer.process(frame, now);
    this.perception = p;
    this.logPerception(p);

    // 2. interpretation → commands
    if (this.input !== 'none') {
      const cmds = this.interpreter.update(p, this.robotView(), this.view, now);
      for (const c of cmds) {
        if (this.dryRun) {
          // during calibration only a STOP may pass, and only if the robot is moving
          if (c.type === 'STOP' && (this.robot.isMoving || this.robot.sequence)) this.bus.send(c, 'gesture', now);
          continue;
        }
        this.bus.send(c, 'gesture', now);
      }
    }
    this.bus.flush();

    // 3. simulation
    this.robot.update(dt);
    this.world.update(dt);

    // 4. outputs
    this.fpsAcc.frames++;
    this.fpsAcc.t += dt;
    if (this.fpsAcc.t >= 0.5) {
      this.fpsAcc.fps = this.fpsAcc.frames / this.fpsAcc.t;
      this.visionAcc.fps = this.visionAcc.frames / this.fpsAcc.t;
      this.fpsAcc.frames = 0;
      this.fpsAcc.t = 0;
      this.visionAcc.frames = 0;
    }
    this.frameListeners.forEach((f) => f(this));
    if (now - this.lastEmit > 80) {
      this.lastEmit = now;
      const t = this.telemetry();
      this.telemetryListeners.forEach((f) => f(t));
    }
    if (this.ros?.status === 'connected' && now - this.lastRos > 100) {
      this.lastRos = now;
      this.ros.publishJointState(this.robot.q, this.robot.gripperGap);
    }
  }

  private logPerception(p: Perception) {
    if (this.input === 'none') return;
    if (p.handCount > 0 && this.prevHandCount === 0) {
      const h = p.primary;
      this.log.push('info', 'vision', `Hand detected${h ? ` (${h.handedness.toLowerCase()})` : ''}`, 'hand_detected');
    } else if (p.handCount === 0 && this.prevHandCount > 0) {
      this.log.push('warn', 'vision', 'Hand lost from view', 'hand_lost');
    }
    this.prevHandCount = p.handCount;
    const g = p.stopGesture ? 'OPEN_PALM' : p.primary?.stable.gesture ?? 'NONE';
    if (g !== this.prevGesture) {
      if (g !== 'NONE') {
        const conf = p.stopGesture
          ? p.hands.find((h) => h.stable.gesture === 'OPEN_PALM')?.stable.confidence ?? 1
          : p.primary?.stable.confidence ?? 0;
        this.log.push('info', 'gesture', `Gesture ${g.replace('_', ' ')} (${Math.round(conf * 100)}%)${this.dryRun ? ' · test mode' : ''}`, `gesture_${g}`);
      }
      this.prevGesture = g;
    }
  }

  telemetry(): Telemetry {
    const r = this.robot;
    const p = this.perception;
    const h = p?.primary;
    const is = this.interpreter.state;
    const name = (id: string | null) => (id ? this.world.get(id)?.name ?? id : null);
    const lc = this.bus.lastCommand;
    return {
      phase: r.phase,
      armed: r.armed,
      estop: r.estop,
      paused: r.paused,
      q: [...r.q],
      qd: [...r.qd],
      ee: { ...r.ee },
      gripperGap: r.gripperGap,
      fingers: { ...r.fingers },
      held: name(r.held),
      selection: r.selection,
      target: r.currentTarget ? { ...r.currentTarget } : null,
      targetClamped: r.targetClamped && r.teleop.active,
      activeCommand: r.activeCommand,
      stepLabel: r.stepLabel,
      pending: r.pending ? { kind: r.pending.kind, label: r.pending.label } : null,
      warning: r.warning?.text ?? null,
      lastCommand: lc ? { type: lc.cmd.type, source: lc.cmd.source, accepted: lc.result.accepted, message: lc.result.message } : null,
      input: this.input,
      dryRun: this.dryRun,
      perception: {
        handCount: p?.handCount ?? 0,
        handedness: h?.handedness ?? null,
        gesture: p?.stopGesture ? 'OPEN_PALM' : h?.stable.gesture ?? 'NONE',
        confidence: p?.stopGesture ? 1 : h?.stable.confidence ?? 0,
        candidate: h?.stable.candidate ?? 'NONE',
        progress: h?.stable.progress ?? 0,
        rawGesture: h?.raw.gesture ?? 'NONE',
        rawConfidence: h?.raw.confidence ?? 0,
        scores: h?.raw.scores ?? null,
        trackingLost: is.trackingLost,
        clutch: is.clutch,
        grip: is.grip,
        confirmProgress: is.confirmProgress,
        aim: { ...is.aim },
        latencyMs: p?.latencyMs ?? 0,
        inferenceMs: this.input === 'camera' ? this.tracker.inferenceMs : 0,
        visionFps: this.visionAcc.fps,
      },
      fps: this.fpsAcc.fps,
    };
  }
}

export const engine = new BridgeEngine();
