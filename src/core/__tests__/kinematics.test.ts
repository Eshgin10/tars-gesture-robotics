import { describe, expect, it } from 'vitest';
import { DEG, dist, dot } from '../math';
import { ROBOT, WORKSPACE } from '../robot/config';
import { clampToWorkspace, forwardKinematics, inverseKinematics, maxRadiusAt, withinLimits } from '../robot/kinematics';

describe('forward kinematics', () => {
  it('zero pose stretches the arm toward +Z (operator side)', () => {
    const fk = forwardKinematics([0, 0, 0, 0, 0, 0]);
    expect(fk.position.x).toBeCloseTo(0, 6);
    expect(fk.position.y).toBeCloseTo(ROBOT.h1, 6);
    expect(fk.position.z).toBeCloseTo(ROBOT.L2 + ROBOT.L3 + ROBOT.Lt, 6);
  });

  it('J1 rotates about the vertical axis toward +X', () => {
    const fk = forwardKinematics([90 * DEG, 0, 0, 0, 0, 0]);
    expect(fk.position.x).toBeCloseTo(ROBOT.L2 + ROBOT.L3 + ROBOT.Lt, 6);
    expect(fk.position.z).toBeCloseTo(0, 6);
  });

  it('J2 = 90° points the upper arm straight up', () => {
    const fk = forwardKinematics([0, 90 * DEG, 0, 0, 0, 0]);
    expect(fk.position.y).toBeCloseTo(ROBOT.h1 + ROBOT.L2 + ROBOT.L3 + ROBOT.Lt, 6);
  });
});

describe('inverse kinematics (top-down grasp)', () => {
  it('round-trips through FK across the workspace', () => {
    let n = 0;
    for (let y = 0.03; y <= 0.5; y += 0.06)
      for (let r = 0.22; r <= 0.78; r += 0.07)
        for (let a = -140; a <= 140; a += 35) {
          const p = { x: Math.sin(a * DEG) * r, y, z: Math.cos(a * DEG) * r };
          const ik = inverseKinematics(p, 0.3);
          if (!ik.ok) continue;
          n++;
          const fk = forwardKinematics(ik.q!);
          expect(dist(fk.position, p)).toBeLessThan(1e-6);
          expect(fk.toolAxis.y).toBeCloseTo(-1, 6); // gripper points straight down
          expect(withinLimits(ik.q!)).toBe(true);
        }
    expect(n).toBeGreaterThan(200);
  });

  it('aligns the fingers with a box face (yaw mod 90°)', () => {
    for (const yaw of [-1.2, -0.4, 0, 0.25, 0.7, 1.4]) {
      const ik = inverseKinematics({ x: -0.36, y: 0.03, z: 0.42 }, yaw, { symmetric: true });
      expect(ik.ok).toBe(true);
      const fk = forwardKinematics(ik.q!);
      const n1 = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
      const n2 = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
      const align = Math.max(Math.abs(dot(fk.fingerAxis, n1)), Math.abs(dot(fk.fingerAxis, n2)));
      expect(align).toBeCloseTo(1, 6);
      expect(Math.abs(ik.q![5])).toBeLessThanOrEqual(Math.PI / 4 + 1e-9);
    }
  });

  it('rejects unreachable targets with an explanation', () => {
    expect(inverseKinematics({ x: 0, y: 0.03, z: 1.2 }).reason).toBe('TOO_FAR');
    expect(inverseKinematics({ x: 0.05, y: 0.1, z: 0.05 }).reason).toBe('TOO_CLOSE');
    expect(inverseKinematics({ x: 0, y: -0.05, z: 0.5 }).reason).toBe('TOO_LOW');
    expect(inverseKinematics({ x: 0, y: 0.9, z: 0.4 }).reason).toBe('TOO_HIGH');
    expect(inverseKinematics({ x: 0.01, y: 0.2, z: -0.5 }).reason).toBe('BEHIND_BASE');
    const r = inverseKinematics({ x: -0.78, y: 0.0275, z: 0.72 });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/max reach/);
  });

  it('clampToWorkspace always yields a solvable target', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const p = { x: (rnd() - 0.5) * 3, y: (rnd() - 0.3) * 1.2, z: (rnd() - 0.5) * 3 };
      const c = clampToWorkspace(p);
      const ik = inverseKinematics(c.point);
      expect(ik.ok, JSON.stringify({ p, c, ik })).toBe(true);
    }
  });

  it('reports reach envelope consistent with geometry', () => {
    expect(maxRadiusAt(0.03)).toBeGreaterThan(0.75);
    expect(maxRadiusAt(0.03)).toBeLessThan((ROBOT.L2 + ROBOT.L3) * WORKSPACE.reachMargin);
  });
});
