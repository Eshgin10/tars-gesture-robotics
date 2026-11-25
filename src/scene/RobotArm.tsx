import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '../core/engine';
import { ROBOT } from '../core/robot/config';

const { h1, L2, L3 } = ROBOT;
const HALF_PI = Math.PI / 2;

/** Shared materials (created once). */
function useMaterials() {
  return useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ color: '#e9e9e6', metalness: 0.15, roughness: 0.38 }),
      shellDark: new THREE.MeshStandardMaterial({ color: '#bdbdba', metalness: 0.2, roughness: 0.45 }),
      joint: new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.45, roughness: 0.38 }),
      steel: new THREE.MeshStandardMaterial({ color: '#a7a7a2', metalness: 0.75, roughness: 0.3 }),
      accent: new THREE.MeshStandardMaterial({ color: '#86d7f2', metalness: 0.1, roughness: 0.4, emissive: '#86d7f2', emissiveIntensity: 0.35 }),
      pad: new THREE.MeshStandardMaterial({ color: '#1a1c20', metalness: 0.1, roughness: 0.9 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#62d39b', emissive: '#62d39b', emissiveIntensity: 1.4, toneMapped: false }),
    }),
    [],
  );
}

/** Joint housing: a cylinder whose axis is the local Z axis (pitch joints). */
function PitchHousing({ r, len, mat, cap }: { r: number; len: number; mat: THREE.Material; cap: THREE.Material }) {
  return (
    <group rotation={[HALF_PI, 0, 0]}>
      <mesh material={mat} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, len, 40]} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[0, (s * len) / 2, 0]} material={cap} castShadow>
            <cylinderGeometry args={[r * 0.62, r * 0.62, 0.008, 40]} />
          </mesh>
          <mesh position={[0, s * (len / 2 + 0.002), 0]} material={mat}>
            <cylinderGeometry args={[r * 0.35, r * 0.35, 0.01, 24]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Cylinder whose axis is the local X axis. */
function XCyl({ r0, r1 = r0, x0, x1, mat, seg = 32 }: { r0: number; r1?: number; x0: number; x1: number; mat: THREE.Material; seg?: number }) {
  return (
    <mesh position={[(x0 + x1) / 2, 0, 0]} rotation={[0, 0, -HALF_PI]} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[r1, r0, x1 - x0, seg]} />
    </mesh>
  );
}

/**
 * Articulated 6-DOF arm. The group hierarchy mirrors the kinematic chain in
 * core/robot/kinematics.ts exactly; joint angles are read from the simulator
 * every frame (no React re-render).
 */
export function RobotArm() {
  const m = useMaterials();
  const j1 = useRef<THREE.Group>(null!);
  const j2 = useRef<THREE.Group>(null!);
  const j3 = useRef<THREE.Group>(null!);
  const j4 = useRef<THREE.Group>(null!);
  const j5 = useRef<THREE.Group>(null!);
  const j6 = useRef<THREE.Group>(null!);
  const fL = useRef<THREE.Group>(null!);
  const fR = useRef<THREE.Group>(null!);
  const lampMat = m.lamp;
  const accent = m.accent;

  useFrame(({ clock }) => {
    const r = engine.robot;
    const q = r.q;
    j1.current.rotation.y = q[0] - HALF_PI;
    j2.current.rotation.z = q[1];
    j3.current.rotation.z = q[2];
    j4.current.rotation.x = q[3];
    j5.current.rotation.z = q[4];
    j6.current.rotation.x = q[5];
    fL.current.position.z = r.fingers.left;
    fR.current.position.z = -r.fingers.right;
    // status lamp + accent rings reflect the safety state
    const phase = r.phase;
    const t = clock.elapsedTime;
    let c = '#62d39b';
    let pulse = 1.6;
    if (phase === 'ESTOP') {
      c = '#ff4b3e';
      pulse = 1.2 + Math.sin(t * 10) * 0.9;
    } else if (phase === 'PAUSED') {
      c = '#86d7f2';
      pulse = 1.2 + Math.sin(t * 5) * 0.6;
    } else if (phase === 'STANDBY') c = '#8fb0ff';
    else if (r.isMoving) {
      c = '#86d7f2';
      pulse = 1.4 + Math.sin(t * 8) * 0.4;
    }
    lampMat.color.set(c);
    lampMat.emissive.set(c);
    lampMat.emissiveIntensity = pulse;
    accent.emissive.set(phase === 'ESTOP' ? '#ff4b3e' : '#86d7f2');
    accent.color.set(phase === 'ESTOP' ? '#ff4b3e' : '#86d7f2');
    accent.emissiveIntensity = phase === 'ESTOP' ? 0.5 + Math.sin(t * 10) * 0.4 : 0.35;
  });

  return (
    <group>
      {/* fixed base plate + anchor bolts */}
      <mesh position={[0, 0.01, 0]} material={m.joint} receiveShadow castShadow>
        <cylinderGeometry args={[0.15, 0.16, 0.02, 48]} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 0.13, 0.024, Math.sin((i / 6) * Math.PI * 2) * 0.13]} material={m.steel}>
          <cylinderGeometry args={[0.008, 0.008, 0.01, 12]} />
        </mesh>
      ))}

      {/* J1 — base yaw */}
      <group ref={j1}>
        <mesh position={[0, 0.095, 0]} material={m.shell} castShadow receiveShadow>
          <cylinderGeometry args={[0.1, 0.115, 0.15, 48]} />
        </mesh>
        <mesh position={[0, 0.172, 0]} material={accent}>
          <cylinderGeometry args={[0.101, 0.101, 0.006, 48]} />
        </mesh>
        <mesh position={[0, 0.215, 0]} material={m.shellDark} castShadow>
          <cylinderGeometry args={[0.078, 0.095, 0.08, 40]} />
        </mesh>
        {/* status lamp */}
        <group position={[-0.085, 0.13, 0]}>
          <mesh material={m.joint}>
            <boxGeometry args={[0.02, 0.05, 0.035]} />
          </mesh>
          <mesh position={[-0.011, 0, 0]} material={lampMat}>
            <boxGeometry args={[0.004, 0.035, 0.022]} />
          </mesh>
        </group>
        {/* shoulder yoke */}
        {[1, -1].map((s) => (
          <RoundedBox key={s} args={[0.11, 0.13, 0.026]} radius={0.01} position={[0, h1 - 0.035, s * 0.085]} material={m.shell} castShadow />
        ))}

        {/* J2 — shoulder pitch */}
        <group ref={j2} position={[0, h1, 0]}>
          <PitchHousing r={0.072} len={0.15} mat={m.joint} cap={accent} />
          <RoundedBox args={[L2 - 0.03, 0.085, 0.1]} radius={0.03} smoothness={4} position={[L2 / 2, 0, 0]} material={m.shell} castShadow receiveShadow />
          <mesh position={[L2 / 2, 0.0436, 0]} material={m.shellDark}>
            <boxGeometry args={[L2 * 0.55, 0.002, 0.05]} />
          </mesh>

          {/* J3 — elbow pitch */}
          <group ref={j3} position={[L2, 0, 0]}>
            <PitchHousing r={0.058} len={0.12} mat={m.joint} cap={accent} />
            {/* J4 — forearm roll */}
            <group ref={j4}>
              <XCyl r0={0.05} r1={0.05} x0={0.045} x1={0.085} mat={m.joint} />
              <XCyl r0={0.052} x0={0.083} x1={0.09} mat={accent} />
              <XCyl r0={0.046} r1={0.036} x0={0.09} x1={L3 - 0.04} mat={m.shell} seg={40} />
              <XCyl r0={0.036} x0={L3 - 0.045} x1={L3 - 0.03} mat={m.shellDark} />

              {/* J5 — wrist pitch */}
              <group ref={j5} position={[L3, 0, 0]}>
                <PitchHousing r={0.04} len={0.085} mat={m.joint} cap={accent} />
                <XCyl r0={0.032} x0={0.02} x1={0.07} mat={m.shell} />

                {/* J6 — tool roll */}
                <group ref={j6}>
                  <XCyl r0={0.038} x0={0.07} x1={0.08} mat={accent} />
                  <XCyl r0={0.034} x0={0.08} x1={0.092} mat={m.steel} />
                  <RoundedBox args={[0.045, 0.05, 0.13]} radius={0.008} position={[0.114, 0, 0]} material={m.joint} castShadow />
                  {/* linear guide rail */}
                  <mesh position={[0.139, 0, 0]} material={m.steel}>
                    <boxGeometry args={[0.006, 0.03, 0.125]} />
                  </mesh>
                  {/* fingers — actuated independently */}
                  {[fL, fR].map((ref, i) => (
                    <group key={i} ref={ref} position={[0, 0, (i ? -1 : 1) * ROBOT.gripperMaxGap / 2]}>
                      <mesh position={[0.144, 0, (i ? -1 : 1) * 0.009]} material={m.shellDark} castShadow>
                        <boxGeometry args={[0.012, 0.034, 0.024]} />
                      </mesh>
                      <mesh position={[0.178, 0, (i ? -1 : 1) * 0.007]} material={m.steel} castShadow>
                        <boxGeometry args={[0.06, 0.026, 0.01]} />
                      </mesh>
                      <mesh position={[0.188, 0, (i ? -1 : 1) * 0.0012]} material={m.pad}>
                        <boxGeometry args={[0.036, 0.024, 0.0025]} />
                      </mesh>
                    </group>
                  ))}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
