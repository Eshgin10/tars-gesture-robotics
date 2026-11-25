import { DEG } from '../math';

/**
 * Geometry of the simulated 6-DOF arm (metres / radians).
 *
 * Kinematic chain (matches the rendered hierarchy exactly):
 *   T = Ry(q1 − π/2) · T(0,h1,0) · Rz(q2) · T(L2,0,0) · Rz(q3) · Rx(q4)
 *       · T(L3,0,0) · Rz(q5) · Rx(q6) · T(Lt,0,0)
 * J1 base yaw, J2 shoulder pitch, J3 elbow pitch, J4 forearm roll,
 * J5 wrist pitch, J6 tool roll. q1 = 0 points the arm toward +Z (the operator).
 */
export const ROBOT = {
  h1: 0.32, // shoulder height above the bench
  L2: 0.42, // upper arm
  L3: 0.38, // forearm
  Lt: 0.19, // wrist-pitch axis → grip centre (between the finger pads)
  fingerTip: 0.018, // fingertips extend this far beyond the grip centre
  bodyClearance: 0.05, // gripper body underside sits this far above the grip centre
  gripperMaxGap: 0.095,
  jointNames: ['J1 Base', 'J2 Shoulder', 'J3 Elbow', 'J4 Forearm', 'J5 Wrist', 'J6 Tool'],
  limits: [
    [-165 * DEG, 165 * DEG],
    [-35 * DEG, 155 * DEG],
    [-165 * DEG, 60 * DEG],
    [-180 * DEG, 180 * DEG],
    [-135 * DEG, 135 * DEG],
    [-200 * DEG, 200 * DEG],
  ] as [number, number][],
  /** max joint speeds (rad/s) at 100 % speed scaling */
  maxVel: [1.3, 1.1, 1.3, 2.0, 2.0, 2.6],
  maxAcc: [3.5, 3.0, 3.5, 6, 6, 8],
  /** cartesian speed limits (m/s) */
  linearSpeed: 0.22,
  teleopSpeed: 0.38,
  gripperSpeed: 0.12, // m/s per finger
} as const;

/** Reachable workspace for the grip centre (top-down grasp orientation). */
export const WORKSPACE = {
  rMin: 0.2,
  reachMargin: 0.97, // fraction of L2+L3 usable for the wrist centre
  yMin: 0.02,
  yMax: 0.55,
  yawLimit: 160 * DEG,
  carryHeight: 0.24,
  approachClearance: 0.11,
};

export const HOME_TARGET = { x: 0, y: 0.32, z: 0.4 };
export const REST_TARGET = { x: 0, y: 0.46, z: 0.22 };
