import { CommandBody } from '../commands/commands';
import { Perception } from '../gestures/recognizer';
import { GestureName } from '../gestures/types';
import { Vec3, clamp } from '../math';
import { RobotPhase } from '../robot/controller';

/** Read-only view of the robot needed to interpret gestures. */
export interface RobotView {
  phase: RobotPhase;
  armed: boolean;
  estop: boolean;
  held: string | null;
  selection: string | null;
  pending: string | null;
  ee: Vec3;
}

/** Spatial queries provided by the 3-D viewport (or a fallback). */
export interface ViewportQuery {
  /** normalised screen point → hit on the bench plane */
  pointerToWorld(nx: number, ny: number): { point: Vec3 | null; objectId: string | null; zoneId: string | null; zoneCenter: Vec3 | null };
  /** normalised screen delta → planar world displacement (metres per unit) */
  screenDeltaToWorld(dx: number, dy: number): Vec3;
}

export interface InterpreterParams {
  dwellMs: number; // (legacy) pointing dwell — kept for settings compatibility
  confirmHoldMs: number; // thumbs-up hold for confirmations
  resumeHoldMs: number; // thumbs-up hold to reset an E-STOP
  trackingLossMs: number; // hand absent → HOLD
  reacquireMs: number; // hand present again → RESUME
  moveSensitivity: number; // metres of sideways travel per full-frame hand movement
  /** metres of forward / back reach per e-fold change in apparent hand size (hand toward / away from the camera); 0 disables */
  heightSensitivity: number;
  /** metres of arm height per full-frame vertical hand movement */
  liftSensitivity: number;
  /** thumb–index distance (palm units) at or below which the gripper is fully closed */
  gripClosed: number;
  /** thumb–index distance (palm units) at or above which the gripper is fully open */
  gripOpen: number;
  pointerBox: { minX: number; maxX: number; minY: number; maxY: number };
}

export const DEFAULT_INTERPRETER: InterpreterParams = {
  dwellMs: 750,
  confirmHoldMs: 350,
  resumeHoldMs: 1000,
  trackingLossMs: 250,
  reacquireMs: 500,
  moveSensitivity: 1.3,
  heightSensitivity: 0.9,
  liftSensitivity: 0.9,
  gripClosed: 0.3,
  gripOpen: 0.85,
  pointerBox: { minX: 0.12, maxX: 0.88, minY: 0.12, maxY: 0.88 },
};

export interface AimState {
  active: boolean;
  screen: { x: number; y: number } | null; // mapped pointer (0..1)
  point: Vec3 | null;
  objectId: string | null;
  zoneId: string | null;
  dwell: number; // 0..1
  mode: 'select' | 'target';
}

export interface InterpreterState {
  aim: AimState;
  /** true while the operator's hand is directly driving the arm */
  clutch: boolean;
  /** gripper opening commanded by the thumb–index gap: 0 = closed … 1 = fully open */
  grip: number;
  confirmProgress: number; // 0..1 thumbs-up hold progress
  trackingLost: boolean;
  pausedByTracking: boolean;
  gesture: GestureName;
}

const IDLE_AIM: AimState = { active: false, screen: null, point: null, objectId: null, zoneId: null, dwell: 0, mode: 'select' };

/**
 * Direct hand control ("the arm is your hand"):
 *   - hand left / right   → arm moves sideways (as seen in the 3-D view)
 *   - hand up / down      → arm rises / lowers
 *   - hand toward / away from the camera → arm reaches forward / pulls back
 *   - thumb + index gap   → gripper opening; closing on a part grabs it, opening drops it
 * Motion is relative to where the hand was when control engaged, so there is no jump.
 * Thumbs-up arms the robot, resets an E-STOP and confirms pending prompts.
 */
export class GestureInterpreter {
  params: InterpreterParams;
  state: InterpreterState = {
    aim: { ...IDLE_AIM },
    clutch: false,
    grip: 1,
    confirmProgress: 0,
    trackingLost: true, // no operator hand seen yet
    pausedByTracking: false,
    gesture: 'NONE',
  };
  private confirmLatched = false;
  private lostSince: number | null = null;
  private presentSince: number | null = null;
  private anchorPalm = { x: 0, y: 0 };
  private anchorEE: Vec3 = { x: 0, y: 0, z: 0 };
  private anchorScale = 1;
  /** gripper follows the hand only once the hand matches the gripper (avoids dropping a part on engage) */
  private gripSynced = false;
  private gripFiltered: number | null = null;

  constructor(params: Partial<InterpreterParams> = {}) {
    this.params = { ...DEFAULT_INTERPRETER, ...params };
  }

  mapPointer(p: { x: number; y: number }) {
    const b = this.params.pointerBox;
    return {
      x: clamp((p.x - b.minX) / Math.max(0.05, b.maxX - b.minX), 0, 1),
      y: clamp((p.y - b.minY) / Math.max(0.05, b.maxY - b.minY), 0, 1),
    };
  }

  /** Thumb–index distance (palm units) → gripper opening 0..1. */
  gripFromPinch(pinchDist: number) {
    const { gripClosed: lo, gripOpen: hi } = this.params;
    return clamp((pinchDist - lo) / Math.max(0.05, hi - lo), 0, 1);
  }

  private disengage() {
    this.state.clutch = false;
    this.gripSynced = false;
  }

  update(p: Perception, robot: RobotView, view: ViewportQuery, now: number): CommandBody[] {
    const out: CommandBody[] = [];
    const s = this.state;
    s.aim = { ...IDLE_AIM };

    // 1 — tracking loss → HOLD; reacquire → RESUME
    const hand = p.primary;
    if (!hand) {
      if (this.lostSince === null) this.lostSince = now;
      this.presentSince = null;
      this.gripFiltered = null;
      if (now - this.lostSince >= this.params.trackingLossMs) {
        if (!s.trackingLost) {
          s.trackingLost = true;
          this.disengage();
          const active = ['PICKING', 'PLACING', 'MOVING', 'HOMING', 'IDLE', 'CARRYING'].includes(robot.phase);
          if (active) {
            out.push({ type: 'HOLD', reason: 'operator hand lost from camera view' });
            s.pausedByTracking = true;
          }
        }
      }
      s.gesture = 'NONE';
      s.confirmProgress = 0;
      return out;
    }
    this.lostSince = null;
    if (this.presentSince === null) this.presentSince = now;
    if (s.trackingLost && now - this.presentSince >= this.params.reacquireMs) {
      s.trackingLost = false;
      if (s.pausedByTracking) {
        out.push({ type: 'RESUME' });
        s.pausedByTracking = false;
      }
    }

    const g = hand.stable.gesture;
    const heldFor = now - hand.stable.since;
    s.gesture = g;
    if (g !== 'THUMBS_UP') this.confirmLatched = false;
    s.confirmProgress = 0;

    // smoothed gripper opening from the thumb–index gap
    const rawGrip = this.gripFromPinch(hand.features.pinchDist);
    this.gripFiltered = this.gripFiltered === null ? rawGrip : this.gripFiltered + (rawGrip - this.gripFiltered) * 0.45;
    s.grip = this.gripFiltered;

    // 2 — THUMBS UP: arm / reset E-STOP / confirm (only when there is something to confirm)
    const confirmRelevant = robot.estop || !robot.armed || !!robot.pending;
    if (g === 'THUMBS_UP' && confirmRelevant) {
      this.disengage();
      const needed = robot.estop ? this.params.resumeHoldMs : this.params.confirmHoldMs;
      if (!this.confirmLatched) {
        s.confirmProgress = clamp(heldFor / needed, 0, 1);
        if (heldFor >= needed) {
          out.push({ type: 'CONFIRM' });
          this.confirmLatched = true;
          s.confirmProgress = 1;
        }
      }
      return out;
    }

    // 3 — direct hand control (only while the robot is free to follow)
    const canDrive = robot.armed && !robot.estop && !s.trackingLost && (robot.phase === 'IDLE' || robot.phase === 'CARRYING');
    if (!canDrive) {
      this.disengage();
      return out;
    }
    if (!s.clutch) {
      s.clutch = true;
      this.anchorPalm = { ...hand.palm };
      this.anchorEE = { ...robot.ee };
      this.anchorScale = hand.scale;
      // holding a part with an open hand? wait until the hand closes before the gripper follows
      this.gripSynced = !robot.held || s.grip < 0.35;
    }

    const dx = hand.palm.x - this.anchorPalm.x;
    const dy = hand.palm.y - this.anchorPalm.y;
    // view-relative axes: `right` across the screen, `fwd` into the scene (away from the viewer)
    const right = view.screenDeltaToWorld(1, 0);
    const back = view.screenDeltaToWorld(0, 1);
    let reach = 0;
    if (this.params.heightSensitivity > 0 && this.anchorScale > 1e-4) {
      // hand looks bigger → closer to the camera → reach forward into the scene
      const k = clamp(Math.log(hand.scale / this.anchorScale), -0.9, 0.9);
      const dead = 0.04;
      reach = (Math.abs(k) < dead ? 0 : k - Math.sign(k) * dead) * this.params.heightSensitivity;
    }
    const side = dx * this.params.moveSensitivity;
    const target: Vec3 = {
      x: this.anchorEE.x + right.x * side - back.x * reach,
      y: this.anchorEE.y - dy * this.params.liftSensitivity,
      z: this.anchorEE.z + right.z * side - back.z * reach,
    };
    out.push({ type: 'MOVE_TO', target, mode: 'teleop' });

    if (!this.gripSynced && s.grip < 0.35) this.gripSynced = true;
    if (this.gripSynced) out.push({ type: 'GRIPPER', aperture: s.grip });
    return out;
  }
}
