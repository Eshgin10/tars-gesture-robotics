import {
  Mat4, Vec3, axisX, axisZ, clamp, mul, position, rotX, rotY, rotZ, trans, wrapAngle,
} from '../math';
import { ROBOT, WORKSPACE } from './config';

export type JointVector = [number, number, number, number, number, number];

export interface FKResult {
  /** world transform of every joint frame (J1..J6) plus the tool (index 6) */
  frames: Mat4[];
  tool: Mat4;
  position: Vec3;
  toolAxis: Vec3; // approach direction (gripper pointing direction)
  fingerAxis: Vec3; // direction along which the fingers open/close
}

/** Forward kinematics — identical chain to the rendered robot. */
export function forwardKinematics(q: readonly number[]): FKResult {
  const { h1, L2, L3, Lt } = ROBOT;
  const f1 = rotY(q[0] - Math.PI / 2);
  const f2 = mul(f1, mul(trans(0, h1, 0), rotZ(q[1])));
  const f3 = mul(f2, mul(trans(L2, 0, 0), rotZ(q[2])));
  const f4 = mul(f3, rotX(q[3]));
  const f5 = mul(f4, mul(trans(L3, 0, 0), rotZ(q[4])));
  const f6 = mul(f5, rotX(q[5]));
  const tool = mul(f6, trans(Lt, 0, 0));
  return {
    frames: [f1, f2, f3, f4, f5, f6, tool],
    tool,
    position: position(tool),
    toolAxis: axisX(tool),
    fingerAxis: axisZ(tool),
  };
}

export type IKFailure =
  | 'TOO_CLOSE'
  | 'TOO_FAR'
  | 'TOO_LOW'
  | 'TOO_HIGH'
  | 'BEHIND_BASE'
  | 'JOINT_LIMIT'
  | 'LINK_COLLISION';

export interface IKResult {
  ok: boolean;
  q?: JointVector;
  reason?: IKFailure;
  detail?: string;
}

export const maxWristReach = () => (ROBOT.L2 + ROBOT.L3) * WORKSPACE.reachMargin;

/** Maximum horizontal radius of the grip centre at a given height. */
export function maxRadiusAt(y: number) {
  const dz = y + ROBOT.Lt - ROBOT.h1;
  const d = maxWristReach();
  return dz * dz >= d * d ? 0 : Math.sqrt(d * d - dz * dz);
}

/**
 * Analytic inverse kinematics for a top-down grasp (tool axis = −Y).
 * The approach constraint fixes the wrist centre directly above the target,
 * reducing J1–J3 to a planar two-link problem; J5 keeps the tool vertical,
 * J6 aligns the fingers with the requested yaw (mod 90° for box symmetry
 * when `symmetric` is set). J4 is kept at 0 (redundancy resolution).
 */
export function inverseKinematics(
  target: Vec3,
  yaw = 0,
  opts: { symmetric?: boolean; preferQ6?: number } = {},
): IKResult {
  const { h1, L2, L3, Lt, limits } = ROBOT;
  const r = Math.hypot(target.x, target.z);
  if (target.y < WORKSPACE.yMin - 1e-9)
    return fail('TOO_LOW', `Target height ${(target.y * 100).toFixed(1)} cm is below the bench safety plane`);
  if (target.y > WORKSPACE.yMax + 1e-9)
    return fail('TOO_HIGH', `Target height ${(target.y * 100).toFixed(1)} cm exceeds the ${WORKSPACE.yMax * 100} cm ceiling`);
  if (r < WORKSPACE.rMin - 1e-9)
    return fail('TOO_CLOSE', `Target is ${(r * 100).toFixed(1)} cm from the base axis (min ${WORKSPACE.rMin * 100} cm) — collision with the robot base`);

  const q1 = Math.atan2(target.x, target.z);
  if (Math.abs(q1) > WORKSPACE.yawLimit)
    return fail('BEHIND_BASE', 'Target lies behind the robot, outside the J1 operating range');

  const wy = target.y + Lt - h1; // wrist centre relative to shoulder (vertical)
  const d = Math.hypot(r, wy);
  if (d > maxWristReach() + 1e-9)
    return fail('TOO_FAR', `Target is ${(r * 100).toFixed(1)} cm away; max reach at this height is ${(maxRadiusAt(target.y) * 100).toFixed(1)} cm`);

  const c3 = clamp((d * d - L2 * L2 - L3 * L3) / (2 * L2 * L3), -1, 1);
  const q3 = -Math.acos(c3); // elbow-up branch
  const q2 = Math.atan2(wy, r) - Math.atan2(L3 * Math.sin(q3), L2 + L3 * Math.cos(q3));
  const q5 = -Math.PI / 2 - q2 - q3;

  // J6: finger axis yaw. With the tool vertical, finger axis = Ry(q1 − π/2 − q6)·Ẑ.
  // A box with yaw ψ has face normals Ry(ψ + k·π/2)·Ẑ.
  let q6 = wrapAngle(q1 - Math.PI / 2 - yaw);
  if (opts.symmetric) {
    const quarter = Math.PI / 2;
    q6 = q6 - Math.round(q6 / quarter) * quarter;
  } else if (opts.preferQ6 !== undefined) {
    // choose the 2π-equivalent closest to the preferred value
    q6 = q6 + Math.round((opts.preferQ6 - q6) / (2 * Math.PI)) * 2 * Math.PI;
  }

  const q: JointVector = [q1, q2, q3, 0, q5, q6];
  for (let i = 0; i < 6; i++) {
    if (q[i] < limits[i][0] - 1e-9 || q[i] > limits[i][1] + 1e-9)
      return fail('JOINT_LIMIT', `${ROBOT.jointNames[i]} would need ${(q[i] * 57.2958).toFixed(1)}°, outside its limit`);
  }
  // link-vs-bench collision: elbow and wrist must stay above the bench
  const fk = forwardKinematics(q);
  const elbow = position(fk.frames[2]);
  const wrist = position(fk.frames[4]);
  if (elbow.y < 0.04 || wrist.y < 0.06)
    return fail('LINK_COLLISION', 'Arm links would collide with the bench');
  return { ok: true, q };
}

function fail(reason: IKFailure, detail: string): IKResult {
  return { ok: false, reason, detail };
}

/** Project any point onto the reachable (top-down) workspace. Always IK-solvable. */
export function clampToWorkspace(p: Vec3): { point: Vec3; clamped: boolean } {
  const y = clamp(p.y, WORKSPACE.yMin, WORKSPACE.yMax);
  let r = Math.hypot(p.x, p.z);
  let ang = r < 1e-6 ? 0 : Math.atan2(p.x, p.z);
  const lim = WORKSPACE.yawLimit - 0.01;
  ang = clamp(ang, -lim, lim);
  const rMax = maxRadiusAt(y) * 0.999;
  r = clamp(r, WORKSPACE.rMin + 1e-4, rMax);
  const point = { x: Math.sin(ang) * r, y, z: Math.cos(ang) * r };
  const clamped = Math.abs(point.x - p.x) + Math.abs(point.y - p.y) + Math.abs(point.z - p.z) > 1e-4;
  return { point, clamped };
}

export function withinLimits(q: readonly number[]) {
  return q.every((v, i) => v >= ROBOT.limits[i][0] - 1e-9 && v <= ROBOT.limits[i][1] + 1e-9);
}
