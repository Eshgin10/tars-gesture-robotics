import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '../core/engine';
import { WORKSPACE } from '../core/robot/config';
import { maxRadiusAt } from '../core/robot/kinematics';

/** A line whose vertices are rewritten every frame (no React re-render). */
function useDynamicLine(max: number, color: string, opts: { dashed?: boolean; opacity?: number } = {}) {
  return useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setDrawRange(0, 0);
    const mat = opts.dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.018, gapSize: 0.012, transparent: true, opacity: opts.opacity ?? 1, depthTest: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: opts.opacity ?? 1, depthTest: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 10;
    line.frustumCulled = false;
    const set = (pts: { x: number; y: number; z: number }[]) => {
      const a = geo.attributes.position as THREE.BufferAttribute;
      const n = Math.min(max, pts.length);
      for (let i = 0; i < n; i++) a.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
      a.needsUpdate = true;
      geo.setDrawRange(0, n);
      if (opts.dashed && n > 1) line.computeLineDistances();
    };
    return { line, set, mat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const OPERATOR = { x: 0, y: 0.62, z: 1.45 }; // virtual origin of the pointing ray (operator side)

export function Overlays3D() {
  const trail = useDynamicLine(160, '#ecece8', { opacity: 0.28 });
  const plan = useDynamicLine(16, '#86d7f2', { dashed: true, opacity: 0.95 });
  const ray = useDynamicLine(2, '#86d7f2', { opacity: 0.75 });
  const drop = useDynamicLine(2, '#ecece8', { dashed: true, opacity: 0.4 });
  const trailPts = useRef<{ x: number; y: number; z: number }[]>([]);
  const lastTrail = useRef(0);

  const reticle = useRef<THREE.Group>(null!);
  const dwellRing = useRef<THREE.Mesh>(null!);
  const target = useRef<THREE.Group>(null!);
  const targetMat = useRef<THREE.MeshBasicMaterial>(null!);
  const envelope = useRef<THREE.Group>(null!);
  const envMat = useRef<THREE.MeshBasicMaterial>(null!);

  const rOuter = maxRadiusAt(0.03);
  const yaw = WORKSPACE.yawLimit;

  useFrame(({ clock }) => {
    const r = engine.robot;
    const t = clock.elapsedTime;
    // end-effector trail
    if (t - lastTrail.current > 0.03) {
      lastTrail.current = t;
      const pts = trailPts.current;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last.x - r.ee.x, last.y - r.ee.y, last.z - r.ee.z) > 0.002) {
        pts.push({ ...r.ee });
        if (pts.length > 160) pts.shift();
      }
      trail.set(pts);
    }
    // planned path (remaining waypoints)
    plan.set(r.plannedPath.length > 1 ? [r.ee, ...r.plannedPath.slice(1)] : []);

    // pointing ray + reticle with dwell progress
    const aim = engine.interpreter.state.aim;
    if (aim.active && aim.point) {
      ray.set([OPERATOR, aim.point]);
      reticle.current.visible = true;
      reticle.current.position.set(aim.point.x, 0.003, aim.point.z);
      const g = dwellRing.current.geometry as THREE.RingGeometry;
      const want = Math.max(0.001, aim.dwell) * Math.PI * 2;
      if (Math.abs((g.parameters?.thetaLength ?? 0) - want) > 0.01) {
        dwellRing.current.geometry.dispose();
        dwellRing.current.geometry = new THREE.RingGeometry(0.028, 0.036, 48, 1, Math.PI / 2, want);
      }
    } else {
      ray.set([]);
      reticle.current.visible = false;
    }

    // target marker
    const tg = r.currentTarget;
    if (tg) {
      target.current.visible = true;
      target.current.position.set(tg.x, tg.y, tg.z);
      target.current.rotation.y = t * 0.8;
      const bad = r.targetClamped && r.teleop.active;
      targetMat.current.color.set(r.pending ? '#86d7f2' : bad ? '#ff4b3e' : '#ecece8');
      drop.set([tg, { x: tg.x, y: 0.001, z: tg.z }]);
    } else {
      target.current.visible = false;
      drop.set([]);
    }

    // reach envelope highlights when a target is being clamped
    const warn = r.targetClamped && r.teleop.active;
    envMat.current.opacity = warn ? 0.45 + Math.sin(t * 8) * 0.15 : 0.35;
    envMat.current.color.set(warn ? '#ff4b3e' : '#5a5a60');
    envelope.current.visible = r.armed;
  });

  return (
    <group>
      <primitive object={trail.line} />
      <primitive object={plan.line} />
      <primitive object={ray.line} />
      <primitive object={drop.line} />

      <group ref={reticle} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
          <ringGeometry args={[0.018, 0.022, 32]} />
          <meshBasicMaterial color="#86d7f2" transparent opacity={0.9} depthTest={false} />
        </mesh>
        <mesh ref={dwellRing} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
          <ringGeometry args={[0.028, 0.036, 48, 1, Math.PI / 2, 0.001]} />
          <meshBasicMaterial color="#86d7f2" transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={target} visible={false}>
        <mesh renderOrder={12}>
          <octahedronGeometry args={[0.014, 0]} />
          <meshBasicMaterial ref={targetMat} color="#3ecf8e" wireframe depthTest={false} transparent />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[i === 0 ? Math.PI / 2 : 0, i === 1 ? Math.PI / 2 : 0, 0]} renderOrder={12}>
            <torusGeometry args={[0.028, 0.0012, 6, 40]} />
            <meshBasicMaterial color="#ecece8" transparent opacity={0.3} depthTest={false} />
          </mesh>
        ))}
      </group>

      {/* reachable workspace envelope on the bench (outer reach + base keep-out) */}
      <group ref={envelope}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0012, 0]}>
          <ringGeometry args={[rOuter - 0.004, rOuter, 96, 1, -Math.PI / 2 - yaw, yaw * 2]} />
          <meshBasicMaterial ref={envMat} color="#5a5a60" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0012, 0]}>
          <ringGeometry args={[WORKSPACE.rMin - 0.003, WORKSPACE.rMin, 64]} />
          <meshBasicMaterial color="#ff4b3e" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
