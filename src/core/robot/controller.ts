import { Command, CommandResult } from '../commands/commands';
import { CommandExecutor } from '../commands/commandBus';
import { EventLog } from '../log';
import { Vec3, add, clamp, copy3, dist, dot, lerp3, sub, wrapAngle } from '../math';
import { WorldModel, WorldObject } from '../world/world';
import { HOME_TARGET, REST_TARGET, ROBOT, WORKSPACE } from './config';
import { JointVector, clampToWorkspace, forwardKinematics, inverseKinematics } from './kinematics';

export type RobotPhase =
  | 'STANDBY'
  | 'HOMING'
  | 'IDLE'
  | 'PICKING'
  | 'CARRYING'
  | 'PLACING'
  | 'MOVING'
  | 'PAUSED'
  | 'ESTOP';

type LinearStep = { kind: 'linear'; to: Vec3; speed: number; label: string; from?: Vec3; s?: number; v?: number };
type GripperStep = { kind: 'gripper'; action: 'open' | 'close'; label: string; objectId?: string; started?: boolean };
type Step =
  | { kind: 'joint'; q: JointVector; speed: number; label: string }
  | LinearStep
  | GripperStep;

interface Sequence {
  name: 'HOME' | 'PICK' | 'PLACE' | 'GOTO';
  steps: Step[];
  index: number;
  objectId?: string;
}

export type PendingKind = 'PLACE' | 'GOTO' | 'RESET';
export interface Pending {
  kind: PendingKind;
  label: string;
  target?: Vec3;
  expiresAt: number;
}

interface Teleop {
  active: boolean;
  target: Vec3;
  cmd: Vec3;
  q1Ref: number;
  q6Ref: number;
}

const ZERO6 = (): JointVector => [0, 0, 0, 0, 0, 0];
const HALF_GAP = ROBOT.gripperMaxGap / 2;

/**
 * Simulated robot controller. Validates and executes commands, plans
 * pick/place sequences with IK, enforces joint / workspace / speed limits,
 * animates the gripper fingers and manages object attachment.
 * Has no dependency on rendering or UI code.
 */
export class RobotController implements CommandExecutor {
  q: JointVector;
  qd: JointVector = ZERO6();
  fingers = { left: HALF_GAP, right: HALF_GAP };
  fingerTarget = { left: HALF_GAP, right: HALF_GAP };
  held: string | null = null;
  private heldOffset: Vec3 = { x: 0, y: 0, z: 0 }; // object centre expressed in the tool frame
  private heldYawOffset = 0;
  selection: string | null = null;
  armed = false;
  estop = false;
  paused: string | null = null;
  pending: Pending | null = null;
  sequence: Sequence | null = null;
  teleop: Teleop;
  speedScale = 0.8;
  requirePlaceConfirmOutsideZones = true;
  plannedPath: Vec3[] = [];
  currentTarget: Vec3 | null = null;
  targetClamped = false;
  activeCommand = '—';
  warning: { text: string; t: number } | null = null;
  ee: Vec3;
  time = 0;
  private lastClampWarn = -10;

  constructor(public world: WorldModel, private log: EventLog) {
    this.q = this.solveOrThrow(REST_TARGET);
    this.ee = forwardKinematics(this.q).position;
    this.teleop = { active: false, target: copy3(this.ee), cmd: copy3(this.ee), q1Ref: 0, q6Ref: 0 };
    world.listeners.add(({ object, zone }) => {
      if (zone) this.log.push('success', 'robot', `${object.name} placed in ${zone.name}`, 'placed_zone');
      else this.log.push('info', 'robot', `${object.name} set down on the bench`, 'placed_bench');
    });
  }

  private solveOrThrow(p: Vec3, yaw = 0): JointVector {
    const r = inverseKinematics(p, yaw, { symmetric: true });
    if (!r.ok || !r.q) throw new Error(`IK failed for preset: ${r.detail}`);
    return r.q;
  }

  /* ------------------------------------------------------------------ */
  /* State queries                                                       */
  /* ------------------------------------------------------------------ */
  get phase(): RobotPhase {
    if (this.estop) return 'ESTOP';
    if (!this.armed && !this.sequence) return 'STANDBY';
    if (this.paused) return 'PAUSED';
    if (this.sequence) {
      return ({ HOME: 'HOMING', PICK: 'PICKING', PLACE: 'PLACING', GOTO: 'MOVING' } as const)[this.sequence.name];
    }
    return this.held ? 'CARRYING' : 'IDLE';
  }

  get isMoving() {
    return this.qd.some((v) => Math.abs(v) > 0.01);
  }

  get gripperGap() {
    return this.fingers.left + this.fingers.right;
  }

  get stepLabel() {
    if (!this.sequence) return null;
    const s = this.sequence.steps[this.sequence.index];
    return s ? `${this.sequence.index + 1}/${this.sequence.steps.length} · ${s.label}` : null;
  }

  /** Validate that a pick of `o` is kinematically feasible. */
  checkReachable(o: WorldObject): { ok: true } | { ok: false; detail: string } {
    if (o.size > ROBOT.gripperMaxGap - 0.012) return { ok: false, detail: `${o.name} is wider than the gripper stroke` };
    const pts = this.pickPoints(o);
    for (const p of [pts.pre, pts.grasp, pts.lift]) {
      const r = inverseKinematics(p, o.yaw, { symmetric: true });
      if (!r.ok) return { ok: false, detail: r.detail ?? 'unreachable' };
    }
    return { ok: true };
  }

  private pickPoints(o: WorldObject) {
    const top = o.position.y + o.height / 2;
    const graspY = Math.max(WORKSPACE.yMin, o.position.y + Math.min(0.006, o.height * 0.1));
    return {
      pre: { x: o.position.x, y: top + WORKSPACE.approachClearance, z: o.position.z },
      grasp: { x: o.position.x, y: graspY, z: o.position.z },
      lift: { x: o.position.x, y: Math.max(WORKSPACE.carryHeight, top + 0.08), z: o.position.z },
    };
  }

  private warn(text: string) {
    this.warning = { text, t: this.time };
  }

  /* ------------------------------------------------------------------ */
  /* Command execution                                                   */
  /* ------------------------------------------------------------------ */
  execute(cmd: Command): CommandResult {
    // E-STOP gate: only STOP, CONFIRM (resume), CANCEL and selection pass.
    if (this.estop && !['STOP', 'CONFIRM', 'CANCEL', 'SELECT_OBJECT', 'DESELECT', 'HOLD', 'RESUME'].includes(cmd.type)) {
      return {
        accepted: false,
        message: 'E-STOP active — confirm to reset first',
        silent: cmd.type === 'MOVE_TO' || cmd.type === 'JOG' || cmd.type === 'GRIPPER',
      };
    }
    switch (cmd.type) {
      case 'STOP':
        return this.doStop(cmd.reason ?? `operator (${cmd.source})`);
      case 'CONFIRM':
        return this.doConfirm();
      case 'CANCEL':
        if (!this.pending) return { accepted: false, message: 'nothing to cancel', silent: true };
        this.log.push('info', 'robot', `Cancelled: ${this.pending.label}`);
        this.pending = null;
        this.currentTarget = null;
        return { accepted: true, silent: true };
      case 'SELECT_OBJECT':
        return this.doSelect(cmd.objectId);
      case 'DESELECT':
        if (!this.selection) return { accepted: false, silent: true };
        this.selection = null;
        return { accepted: true, silent: true };
      case 'GRAB':
        return this.doGrab(cmd.objectId ?? this.selection);
      case 'RELEASE':
        return this.doRelease(false);
      case 'MOVE_TO':
        return cmd.mode === 'teleop' ? this.doTeleop(cmd.target) : this.doGoto(cmd.target, false);
      case 'PROPOSE_TARGET':
        return this.doGoto(cmd.target, true, cmd.label);
      case 'JOG': {
        const base = this.teleop.active ? this.teleop.target : this.ee;
        return this.doTeleop(add(base, cmd.delta));
      }
      case 'GRIPPER':
        return this.doGripper(cmd.aperture);
      case 'HOME':
        return this.doHome();
      case 'RESET':
        if (cmd.source === 'system') {
          this.doReset();
          return { accepted: true };
        }
        this.pending = { kind: 'RESET', label: 'Reset workcell (robot home, objects restored)', expiresAt: this.time + 10 };
        return { accepted: true, message: 'awaiting confirmation' };
      case 'HOLD':
        if (this.paused || this.estop || !this.armed) return { accepted: false, silent: true };
        if (!this.sequence && !this.isMoving && !this.teleop.active) return { accepted: false, silent: true };
        this.paused = cmd.reason;
        this.qd = ZERO6();
        this.haltTeleop();
        this.log.push('safety', 'safety', `Motion paused — ${cmd.reason}`, 'paused');
        return { accepted: true, silent: true };
      case 'RESUME':
        if (!this.paused) return { accepted: false, silent: true };
        this.paused = null;
        this.log.push('info', 'safety', this.sequence ? 'Operator reacquired — resuming sequence' : 'Operator reacquired');
        return { accepted: true, silent: true };
    }
  }

  private haltTeleop() {
    this.teleop.active = false;
    this.teleop.target = copy3(this.ee);
    this.teleop.cmd = copy3(this.ee);
  }

  private doStop(reason: string): CommandResult {
    const wasMoving = this.isMoving || !!this.sequence || this.teleop.active;
    this.estop = true;
    this.sequence = null;
    this.pending = null;
    this.paused = null;
    this.haltTeleop();
    this.qd = ZERO6();
    this.fingerTarget = { ...this.fingers }; // freeze the gripper (keeps any grasp)
    this.plannedPath = [];
    this.currentTarget = null;
    this.activeCommand = 'STOP';
    this.log.push(
      'safety',
      'safety',
      `EMERGENCY STOP — ${reason}${wasMoving ? ' · motion halted, pending commands cancelled' : ''}`,
      wasMoving ? 'estop_motion' : 'estop',
    );
    return { accepted: true, silent: true };
  }

  private doConfirm(): CommandResult {
    if (this.estop) {
      this.estop = false;
      this.activeCommand = 'CONFIRM';
      this.log.push('success', 'safety', 'E-STOP reset by operator — robot ready', 'estop_reset');
      return { accepted: true, silent: true };
    }
    if (!this.armed) {
      this.armed = true;
      this.log.push('success', 'robot', 'Control armed — homing at reduced speed', 'armed');
      this.startSequence({
        name: 'HOME',
        index: 0,
        steps: [{ kind: 'joint', q: this.solveOrThrow(HOME_TARGET), speed: 0.45, label: 'Home' }],
      });
      return { accepted: true, silent: true };
    }
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      if (p.kind === 'RESET') {
        this.doReset();
        return { accepted: true, message: 'reset confirmed' };
      }
      if (p.kind === 'PLACE') return this.doRelease(true);
      if (p.kind === 'GOTO' && p.target) return this.doGoto(p.target, false, p.label.replace(/^Move to /, ''));
    }
    return { accepted: false, message: 'nothing to confirm', silent: true };
  }

  private doSelect(id: string): CommandResult {
    const o = this.world.get(id);
    if (!o) return { accepted: false, message: `unknown object "${id}"` };
    if (this.held) return { accepted: false, message: 'gripper occupied — release first' };
    if (o.state !== 'resting') return { accepted: false, message: `${o.name} is not at rest` };
    if (this.selection === id) return { accepted: false, silent: true };
    this.selection = id;
    const reach = this.checkReachable(o);
    if (reach.ok) {
      this.log.push('info', 'robot', `Selected ${o.name} — reachable`, 'selected');
    } else {
      this.log.push('warn', 'robot', `Selected ${o.name} — NOT reachable: ${reach.detail}`, 'selected_unreachable');
      this.warn(`${o.name} is out of reach — ${reach.detail}`);
    }
    return { accepted: true, silent: true };
  }

  private canStartMotion(): string | null {
    if (!this.armed) return 'control not armed — confirm to arm';
    if (this.paused) return 'motion paused';
    if (this.sequence) return `busy (${this.sequence.name})`;
    return null;
  }

  private doGrab(id: string | null): CommandResult {
    const busy = this.canStartMotion();
    if (busy) return { accepted: false, message: busy };
    if (this.held) return { accepted: false, message: 'already holding an object' };
    if (!id) return { accepted: false, message: 'no object selected — point at an object first' };
    const o = this.world.get(id);
    if (!o || o.state !== 'resting') return { accepted: false, message: 'object unavailable' };
    const reach = this.checkReachable(o);
    if (!reach.ok) {
      this.warn(`Cannot grasp ${o.name} — ${reach.detail}`);
      return { accepted: false, message: `unreachable — ${reach.detail}` };
    }
    const pts = this.pickPoints(o);
    const sym = { symmetric: o.shape === 'box' };
    // already hovering just above the part (hand-guided)? align in place instead of re-approaching
    const hover = Math.hypot(this.ee.x - o.position.x, this.ee.z - o.position.z) < 0.03 && this.ee.y <= pts.pre.y + 0.02 && this.ee.y >= pts.grasp.y - 0.025;
    const alignAt = hover ? { x: o.position.x, y: Math.max(this.ee.y, pts.grasp.y), z: o.position.z } : pts.pre;
    const alignIk = inverseKinematics(alignAt, o.yaw, sym);
    const qPre = (alignIk.ok ? alignIk : inverseKinematics(pts.pre, o.yaw, sym)).q!;
    this.selection = id;
    this.haltTeleop();
    this.startSequence({
      name: 'PICK',
      objectId: id,
      index: 0,
      steps: [
        { kind: 'gripper', action: 'open', label: 'Open gripper' },
        { kind: 'joint', q: qPre, speed: hover ? 0.5 : 1, label: hover ? 'Align fingers' : 'Approach' },
        { kind: 'linear', to: pts.grasp, speed: 0.6, label: 'Descend' },
        { kind: 'gripper', action: 'close', label: 'Close gripper', objectId: id },
        { kind: 'linear', to: pts.lift, speed: 0.75, label: 'Lift' },
      ],
    });
    this.log.push('info', 'robot', `Grasp planned for ${o.name}: ${hover ? 'align → close → lift' : 'approach → descend → close → lift'}`, 'grab_planned');
    return { accepted: true, silent: true };
  }

  heldObject() {
    return this.world.get(this.held);
  }

  private doRelease(confirmed: boolean): CommandResult {
    const busy = this.canStartMotion();
    if (busy) return { accepted: false, message: busy };
    const o = this.heldObject();
    if (!o) return { accepted: false, message: 'gripper is empty' };
    const x = this.ee.x;
    const z = this.ee.z;
    const zone = this.world.zoneAt(x, z, 'destination');
    if (!zone && this.requirePlaceConfirmOutsideZones && !confirmed) {
      this.pending = { kind: 'PLACE', label: `Place ${o.name} outside a destination zone`, expiresAt: this.time + 8 };
      this.log.push('warn', 'robot', 'Release requested outside a destination zone — awaiting confirmation');
      return { accepted: true, silent: true };
    }
    const support = this.world.supportHeightAt(x, z, this.world.footprint(o) * 0.8, o.id);
    const dy = o.position.y - this.ee.y;
    const place = { x, y: Math.max(WORKSPACE.yMin, support + o.height / 2 + 0.004 - dy), z };
    const ik = inverseKinematics(place, 0, { symmetric: true });
    if (!ik.ok) return { accepted: false, message: `cannot place here — ${ik.detail}` };
    const retreat = { x, y: Math.min(WORKSPACE.yMax, place.y + WORKSPACE.approachClearance), z };
    this.haltTeleop();
    this.startSequence({
      name: 'PLACE',
      objectId: o.id,
      index: 0,
      steps: [
        { kind: 'linear', to: place, speed: 0.6, label: 'Lower' },
        { kind: 'gripper', action: 'open', label: 'Open gripper' },
        { kind: 'linear', to: retreat, speed: 0.75, label: 'Retreat' },
      ],
    });
    this.log.push('info', 'robot', `Placing ${o.name}${zone ? ' in ' + zone.name : ' on the bench'}`, 'place_planned');
    return { accepted: true, silent: true };
  }

  private doGoto(raw: Vec3, propose: boolean, label?: string): CommandResult {
    const busy = this.canStartMotion();
    if (busy) return { accepted: false, message: busy };
    const y = this.held
      ? Math.max(WORKSPACE.carryHeight, this.ee.y)
      : Math.max(raw.y, this.minHeightAt(raw.x, raw.z));
    const tgt = { x: raw.x, y: Math.min(y, WORKSPACE.yMax), z: raw.z };
    const ik = inverseKinematics(tgt, 0, { preferQ6: this.q[5] });
    if (!ik.ok) {
      this.warn(`Target rejected — ${ik.detail}`);
      return { accepted: false, message: `target unreachable — ${ik.detail}` };
    }
    const zone = this.world.zoneAt(tgt.x, tgt.z, 'destination');
    const name = label ?? (zone ? zone.name : `(${tgt.x.toFixed(2)}, ${tgt.z.toFixed(2)})`);
    if (propose) {
      this.pending = { kind: 'GOTO', label: `Move to ${name}`, target: tgt, expiresAt: this.time + 8 };
      this.currentTarget = tgt;
      this.log.push('info', 'robot', `Target established: ${name} — awaiting confirmation`, 'target_proposed');
      return { accepted: true, silent: true };
    }
    const q = ik.q!;
    if (this.held) q[5] = this.q[5] + wrapAngle(q[0] - this.q[0]); // keep the payload's world yaw
    q[5] = clamp(q[5], ROBOT.limits[5][0], ROBOT.limits[5][1]);
    const steps: Step[] = [];
    if (this.held && this.ee.y < WORKSPACE.carryHeight - 0.01)
      steps.push({ kind: 'linear', to: { ...this.ee, y: WORKSPACE.carryHeight }, speed: 0.7, label: 'Raise' });
    steps.push({ kind: 'joint', q, speed: 0.9, label: `Transit → ${name}` });
    this.haltTeleop();
    this.startSequence({ name: 'GOTO', index: 0, steps });
    this.log.push('info', 'robot', `Moving to ${name}`, 'goto');
    return { accepted: true, silent: true };
  }

  private doHome(): CommandResult {
    const busy = this.canStartMotion();
    if (busy) return { accepted: false, message: busy };
    const tgt = this.held ? { ...HOME_TARGET, y: Math.max(HOME_TARGET.y, WORKSPACE.carryHeight) } : HOME_TARGET;
    const q = this.solveOrThrow(tgt);
    if (this.held) q[5] = clamp(this.q[5] + wrapAngle(q[0] - this.q[0]), ROBOT.limits[5][0], ROBOT.limits[5][1]);
    this.haltTeleop();
    this.startSequence({ name: 'HOME', index: 0, steps: [{ kind: 'joint', q, speed: 0.6, label: 'Home' }] });
    return { accepted: true };
  }

  private doReset() {
    this.sequence = null;
    this.pending = null;
    this.paused = null;
    this.held = null;
    this.selection = null;
    this.estop = false;
    this.haltTeleop();
    this.world.reset();
    this.fingerTarget = { left: HALF_GAP, right: HALF_GAP };
    this.log.push('info', 'system', 'Workcell reset — objects restored', 'reset');
    if (this.armed) {
      this.startSequence({
        name: 'HOME',
        index: 0,
        steps: [{ kind: 'joint', q: this.solveOrThrow(HOME_TARGET), speed: 0.6, label: 'Home' }],
      });
    }
  }

  /** Lowest allowed grip-centre height at (x,z): keeps fingers / payload above surfaces. */
  minHeightAt(x: number, z: number) {
    const o = this.heldObject();
    const radius = o ? this.world.footprint(o) : 0.03;
    const support = this.world.supportHeightAt(x, z, radius, o?.id);
    if (o) {
      const dy = o.position.y - this.ee.y;
      return Math.max(WORKSPACE.yMin, support + o.height / 2 + 0.012 - dy);
    }
    // Empty gripper: the bench / zone platforms are hard floors. A part only blocks the
    // fingertips if they would land on it; an open gripper centred over a part straddles
    // it and may descend until the gripper body nears the part's top face.
    let floor = this.world.supportHeightAt(x, z, 0.03, undefined, false) + ROBOT.fingerTip + 0.005;
    for (const p of this.world.objects) {
      if (p.state === 'held') continue;
      const d = Math.hypot(p.position.x - x, p.position.z - z);
      const top = p.position.y + p.height / 2;
      if (d > this.world.footprint(p) + 0.03) continue;
      const straddle = this.gripperGap - p.size > 0.012 && d < this.gripperGap / 2 - p.size / 2 - 0.004;
      floor = Math.max(floor, straddle ? top - ROBOT.bodyClearance + 0.006 : top + ROBOT.fingerTip + 0.008);
    }
    return Math.max(WORKSPACE.yMin, floor);
  }

  /** Part the empty gripper is hovering over (centred within a few cm, close above it). */
  partUnderGripper(radius = 0.045, above = 0.09) {
    let best: WorldObject | null = null;
    let bd = radius;
    for (const p of this.world.objects) {
      if (p.state !== 'resting') continue;
      const d = Math.hypot(p.position.x - this.ee.x, p.position.z - this.ee.z);
      if (d < bd && this.ee.y < p.position.y + p.height / 2 + above) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private doTeleop(raw: Vec3): CommandResult {
    if (!this.armed || this.paused || this.sequence) return { accepted: false, silent: true };
    let { point, clamped } = clampToWorkspace(raw);
    if (!this.held) point = this.alignAssist(point);
    const minY = this.minHeightAt(point.x, point.z);
    if (point.y < minY) {
      point = clampToWorkspace({ ...point, y: minY }).point;
      clamped = true;
    }
    if (!this.teleop.active) {
      this.teleop.active = true;
      this.teleop.cmd = copy3(this.ee);
      this.teleop.q1Ref = this.q[0];
      this.teleop.q6Ref = this.q[5];
      this.activeCommand = 'MOVE_TO';
    }
    this.pending = this.pending?.kind === 'GOTO' ? null : this.pending;
    this.teleop.target = point;
    this.targetClamped = clamped;
    this.currentTarget = point;
    if (clamped && this.time - this.lastClampWarn > 2.5) {
      this.lastClampWarn = this.time;
      this.warn('Target constrained to the reachable workspace / collision floor');
    }
    return { accepted: true, silent: true };
  }

  /**
   * Direct gripper drive (hand control). The fingers follow the commanded opening; closing on a
   * part between the pads stops at contact and grasps it, opening past the part lets it drop.
   */
  private doGripper(aperture: number): CommandResult {
    if (!this.armed || this.paused || this.sequence) return { accepted: false, silent: true };
    const want = Math.max(0.003, clamp(aperture, 0, 1) * HALF_GAP);
    const held = this.heldObject();
    if (held) {
      const contact = held.size / 2;
      if (want > contact + 0.006) {
        // fingers opened past the part: let go, it falls onto whatever is below
        this.held = null;
        this.world.release(held);
        this.fingerTarget = { left: want, right: want };
        this.log.push('success', 'robot', `Fingers opened — ${held.name} released`, 'released');
      } else {
        this.fingerTarget = { left: contact, right: contact }; // keep squeezing
      }
      return { accepted: true, silent: true };
    }
    let target = want;
    let part: WorldObject | null = null;
    for (const o of this.world.objects) {
      if (o.state !== 'resting') continue;
      const c = this.graspContact(o);
      if (c !== null && want < c) {
        target = c; // the pads stop on the part's faces
        part = o;
        break;
      }
    }
    this.fingerTarget = { left: target, right: target };
    if (part && want < target - 0.004 && Math.abs(this.fingers.left - target) < 0.001 && Math.abs(this.fingers.right - target) < 0.001) {
      this.attach(part);
      this.log.push('success', 'robot', `Fingers closed — ${part.name} grasped (${(this.gripperGap * 1000).toFixed(0)} mm)`, 'grasped');
    }
    return { accepted: true, silent: true };
  }

  /**
   * Alignment assist: when the empty gripper is lowered close above a part, the horizontal
   * target is drawn onto the part's centre so the open fingers straddle it cleanly.
   */
  private alignAssist(p: Vec3): Vec3 {
    for (const o of this.world.objects) {
      if (o.state !== 'resting') continue;
      const top = o.position.y + o.height / 2;
      const d = Math.hypot(o.position.x - p.x, o.position.z - p.z);
      if (d > 0.05 || p.y > top + 0.1) continue;
      // full snap close to the part, fading out with distance / height
      const k = Math.min(1, Math.max(0, (0.05 - d) / 0.025)) * Math.min(1, Math.max(0, (top + 0.1 - p.y) / 0.04));
      return { x: p.x + (o.position.x - p.x) * k, y: p.y, z: p.z + (o.position.z - p.z) * k };
    }
    return p;
  }

  /* ------------------------------------------------------------------ */
  /* Motion                                                              */
  /* ------------------------------------------------------------------ */
  private startSequence(seq: Sequence) {
    this.sequence = seq;
    this.activeCommand = seq.name;
    this.qd = ZERO6();
    this.updatePlannedPath();
  }

  private updatePlannedPath() {
    const pts: Vec3[] = [copy3(this.ee)];
    if (this.sequence) {
      for (let i = this.sequence.index; i < this.sequence.steps.length; i++) {
        const s = this.sequence.steps[i];
        if (s.kind === 'joint') pts.push(forwardKinematics(s.q).position);
        else if (s.kind === 'linear') pts.push(copy3(s.to));
      }
    }
    this.plannedPath = pts;
    this.currentTarget = pts.length > 1 ? pts[pts.length - 1] : null;
  }

  update(dt: number) {
    dt = Math.min(Math.max(dt, 1e-4), 0.05);
    this.time += dt;
    if (this.pending && this.time > this.pending.expiresAt) {
      this.log.push('info', 'robot', `Confirmation timed out: ${this.pending.label}`);
      this.pending = null;
      if (!this.sequence && !this.teleop.active) this.currentTarget = null;
    }
    if (this.warning && this.time - this.warning.t > 4) this.warning = null;
    if (this.estop || this.paused) {
      this.qd = ZERO6();
      this.syncHeld();
      return;
    }
    const prev = [...this.q];
    this.updateFingers(dt);
    if (this.sequence) this.stepSequence(dt);
    else if (this.teleop.active) this.stepTeleop(dt);
    for (let i = 0; i < 6; i++) this.qd[i] = (this.q[i] - prev[i]) / dt;
    this.ee = forwardKinematics(this.q).position;
    this.syncHeld();
  }

  private stepSequence(dt: number) {
    const seq = this.sequence!;
    const step = seq.steps[seq.index];
    if (!step) {
      this.finishSequence();
      return;
    }
    let done = false;
    if (step.kind === 'joint') done = this.stepJoint(step.q, step.speed, dt);
    else if (step.kind === 'linear') done = this.stepLinear(step, dt);
    else done = this.stepGripper(step);
    if (!this.sequence) return; // aborted inside the step
    if (done) {
      seq.index++;
      this.ee = forwardKinematics(this.q).position;
      this.updatePlannedPath();
      if (seq.index >= seq.steps.length) this.finishSequence();
    }
  }

  private finishSequence() {
    const seq = this.sequence!;
    this.sequence = null;
    this.plannedPath = [];
    this.currentTarget = null;
    this.haltTeleop();
    this.activeCommand = '—';
    if (seq.name === 'PICK') {
      const o = this.heldObject();
      if (o) this.log.push('success', 'robot', `${o.name} grasped and lifted — ready to transport`, 'grasped');
    } else if (seq.name === 'PLACE') {
      this.log.push('info', 'robot', 'Place sequence complete — gripper clear', 'place_done');
    } else if (seq.name === 'GOTO') {
      this.log.push('info', 'robot', 'Target reached', 'goto_done');
    } else if (seq.name === 'HOME') {
      this.log.push('info', 'robot', 'Robot at home position — ready', 'homed');
    }
  }

  /** Synchronised joint move with acceleration-limited trapezoidal profile. */
  private stepJoint(target: JointVector, speed: number, dt: number) {
    const s = speed * this.speedScale;
    let maxT = 0;
    for (let i = 0; i < 6; i++) maxT = Math.max(maxT, Math.abs(target[i] - this.q[i]) / (ROBOT.maxVel[i] * s));
    let settled = true;
    for (let i = 0; i < 6; i++) {
      const err = target[i] - this.q[i];
      if (Math.abs(err) < 2e-4) {
        this.q[i] = target[i];
        this.qd[i] = 0;
        continue;
      }
      settled = false;
      const vmax = maxT > 1e-6 ? Math.abs(err) / maxT : ROBOT.maxVel[i] * s; // all joints arrive together
      const a = ROBOT.maxAcc[i] * s;
      const vDes = Math.sign(err) * Math.min(Math.max(vmax, 0.02), Math.sqrt(2 * a * Math.abs(err)) + 0.01);
      const v = this.qd[i] + clamp(vDes - this.qd[i], -a * dt, a * dt);
      let step = v * dt;
      if (Math.sign(step) !== Math.sign(err)) step = Math.sign(err) * Math.min(Math.abs(err), 0.01 * dt);
      if (Math.abs(step) > Math.abs(err)) step = err;
      this.q[i] += step;
      this.qd[i] = step / dt;
    }
    return settled;
  }

  private stepLinear(step: LinearStep, dt: number) {
    if (!step.from) {
      step.from = copy3(this.ee);
      step.s = 0;
      step.v = 0;
    }
    const L = dist(step.from, step.to);
    if (L < 1e-5) return true;
    const vmax = ROBOT.linearSpeed * step.speed * this.speedScale;
    const acc = 0.8 * this.speedScale;
    const remaining = L - step.s!;
    const vDes = Math.min(vmax, Math.sqrt(2 * acc * Math.max(remaining, 0)) + 0.004);
    step.v = step.v! + clamp(vDes - step.v!, -acc * dt, acc * dt);
    step.s = Math.min(L, step.s! + Math.max(step.v, 0.002) * dt);
    const p = lerp3(step.from, step.to, step.s / L);
    const ik = inverseKinematics(p, 0, { symmetric: true });
    if (!ik.ok) {
      this.log.push('error', 'robot', `Linear move aborted — ${ik.detail}`);
      this.sequence = null;
      this.plannedPath = [];
      return false;
    }
    const q = ik.q!;
    q[5] = this.q[5]; // tool roll does not affect the grip-centre position
    this.q = q;
    return step.s >= L - 1e-6;
  }

  private stepGripper(step: GripperStep) {
    if (step.action === 'open') {
      if (!step.started) {
        step.started = true;
        const o = this.heldObject();
        if (o) {
          this.held = null;
          this.world.release(o);
          this.log.push('success', 'robot', `Gripper opened — ${o.name} released`, 'released');
        }
        this.fingerTarget = { left: HALF_GAP, right: HALF_GAP };
      }
      return this.fingers.left >= HALF_GAP - 1e-4 && this.fingers.right >= HALF_GAP - 1e-4;
    }
    const o = this.world.get(step.objectId);
    if (!step.started) {
      step.started = true;
      const contact = o ? this.graspContact(o) : null;
      // each finger stops independently at its contact point
      this.fingerTarget = contact !== null ? { left: contact, right: contact } : { left: 0.003, right: 0.003 };
    }
    const reached =
      Math.abs(this.fingers.left - this.fingerTarget.left) < 1e-4 &&
      Math.abs(this.fingers.right - this.fingerTarget.right) < 1e-4;
    if (!reached) return false;
    if (o && this.fingerTarget.left > 0.01 && this.graspContact(o) !== null) {
      this.attach(o);
      this.log.push('success', 'robot', `Gripper closed — contact on ${o.name} (${(this.gripperGap * 1000).toFixed(0)} mm)`, 'gripper_closed');
    } else {
      this.log.push('warn', 'robot', 'Grasp failed — no object between the fingers', 'grasp_failed');
    }
    return true;
  }

  /** Finger half-gap at contact, or null if the object is not between the pads. */
  private graspContact(o: WorldObject): number | null {
    const fk = forwardKinematics(this.q);
    const rel = sub(o.position, fk.position);
    const u = dot(rel, fk.fingerAxis);
    const w = dot(rel, fk.toolAxis);
    const lx = rel.x - fk.fingerAxis.x * u - fk.toolAxis.x * w;
    const ly = rel.y - fk.fingerAxis.y * u - fk.toolAxis.y * w;
    const lz = rel.z - fk.fingerAxis.z * u - fk.toolAxis.z * w;
    if (Math.abs(u) > 0.02 || Math.abs(w) > o.height / 2 + 0.01 || Math.hypot(lx, ly, lz) > o.size / 2) return null;
    return o.size / 2;
  }

  private attach(o: WorldObject) {
    const fk = forwardKinematics(this.q);
    // parallel-gripper self-centring: object is centred between the pads
    const rel = sub(o.position, fk.position);
    const u = dot(rel, fk.fingerAxis);
    o.position = sub(o.position, { x: fk.fingerAxis.x * u, y: fk.fingerAxis.y * u, z: fk.fingerAxis.z * u });
    const r2 = sub(o.position, fk.position);
    const ay = { x: fk.tool[4], y: fk.tool[5], z: fk.tool[6] };
    this.heldOffset = { x: dot(r2, fk.toolAxis), y: dot(r2, ay), z: dot(r2, fk.fingerAxis) };
    this.heldYawOffset = wrapAngle(o.yaw - Math.atan2(fk.fingerAxis.x, fk.fingerAxis.z));
    o.state = 'held';
    this.held = o.id;
    this.selection = null;
  }

  private syncHeld() {
    const o = this.heldObject();
    if (!o) return;
    const fk = forwardKinematics(this.q);
    const ax = fk.toolAxis;
    const ay = { x: fk.tool[4], y: fk.tool[5], z: fk.tool[6] };
    const az = fk.fingerAxis;
    const h = this.heldOffset;
    o.position = {
      x: fk.position.x + ax.x * h.x + ay.x * h.y + az.x * h.z,
      y: fk.position.y + ax.y * h.x + ay.y * h.y + az.y * h.z,
      z: fk.position.z + ax.z * h.x + ay.z * h.y + az.z * h.z,
    };
    o.yaw = wrapAngle(Math.atan2(az.x, az.z) + this.heldYawOffset);
  }

  private updateFingers(dt: number) {
    const v = ROBOT.gripperSpeed * dt * Math.max(0.5, this.speedScale);
    for (const k of ['left', 'right'] as const) {
      const e = this.fingerTarget[k] - this.fingers[k];
      const vk = k === 'left' ? v : v * 0.9; // independent actuators, slightly different response
      this.fingers[k] += clamp(e, -vk, vk);
    }
  }

  private stepTeleop(dt: number) {
    const t = this.teleop;
    const toGo = sub(t.target, t.cmd);
    const d = Math.hypot(toGo.x, toGo.y, toGo.z);
    const maxStep = ROBOT.teleopSpeed * this.speedScale * dt;
    if (d > 1e-6) {
      const k = Math.min(1, maxStep / d);
      t.cmd = add(t.cmd, { x: toGo.x * k, y: toGo.y * k, z: toGo.z * k });
    }
    const ik = inverseKinematics(t.cmd, 0, { symmetric: true });
    if (!ik.ok) {
      t.cmd = clampToWorkspace(t.cmd).point;
      return;
    }
    const q = ik.q!;
    q[5] = clamp(t.q6Ref + wrapAngle(q[0] - t.q1Ref), ROBOT.limits[5][0], ROBOT.limits[5][1]);
    for (let i = 0; i < 6; i++) {
      const lim = ROBOT.maxVel[i] * this.speedScale * dt;
      this.q[i] += clamp(q[i] - this.q[i], -lim, lim);
    }
    // hovering the empty gripper over a part targets it, so the next grab picks it directly
    if (!this.held) {
      const under = this.partUnderGripper(0.03, 0.07);
      if (under && under.id !== this.selection) {
        this.selection = under.id;
        this.log.push('info', 'robot', `Gripper over ${under.name} — close your fingers to grab`, 'selected');
      }
    }
  }
}
