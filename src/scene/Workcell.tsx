import { Grid } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { engine } from '../core/engine';
import { BENCH } from '../core/world/world';

const BENCH_W = BENCH.maxX - BENCH.minX;
const BENCH_D = BENCH.maxZ - BENCH.minZ;
const BENCH_CX = (BENCH.maxX + BENCH.minX) / 2;
const BENCH_CZ = (BENCH.maxZ + BENCH.minZ) / 2;
const FLOOR_Y = -0.86;

export function Workcell() {
  const benchTop = useMemo(() => new THREE.MeshStandardMaterial({ color: '#101012', metalness: 0.3, roughness: 0.55 }), []);
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3a3f', metalness: 0.7, roughness: 0.35 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.3, roughness: 0.5 }), []);

  // clicking the bench while carrying sends the robot to that point (mouse fallback)
  const onBenchClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    const r = engine.robot;
    const p = e.point;
    if (r.held && (r.phase === 'CARRYING')) {
      engine.send({ type: 'MOVE_TO', target: { x: p.x, y: 0.24, z: p.z }, mode: 'goto' }, 'mouse');
    } else if (r.selection && !r.held) {
      engine.send({ type: 'DESELECT' }, 'mouse');
    }
  };

  return (
    <group>
      {/* floor */}
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#060607" roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        position={[0, FLOOR_Y + 0.001, 0]}
        args={[30, 30]}
        cellSize={0.25}
        cellThickness={0.6}
        cellColor="#15151a"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#202027"
        fadeDistance={14}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* bench */}
      <mesh position={[BENCH_CX, -0.02, BENCH_CZ]} material={benchTop} receiveShadow castShadow onClick={onBenchClick}>
        <boxGeometry args={[BENCH_W, 0.04, BENCH_D]} />
      </mesh>
      {/* bench edge trim */}
      <mesh position={[BENCH_CX, -0.02, BENCH.maxZ + 0.006]} material={frame}>
        <boxGeometry args={[BENCH_W + 0.012, 0.042, 0.012]} />
      </mesh>
      {/* bench grid lines (5 cm) */}
      <Grid
        position={[BENCH_CX, 0.0006, BENCH_CZ]}
        args={[BENCH_W, BENCH_D]}
        cellSize={0.05}
        cellThickness={0.5}
        cellColor="#1d1d22"
        sectionSize={0.25}
        sectionThickness={0.9}
        sectionColor="#2c2c33"
        fadeDistance={6}
        fadeStrength={0}
      />
      {/* legs + cross members */}
      {[
        [BENCH.minX + 0.06, BENCH.minZ + 0.06],
        [BENCH.maxX - 0.06, BENCH.minZ + 0.06],
        [BENCH.minX + 0.06, BENCH.maxZ - 0.06],
        [BENCH.maxX - 0.06, BENCH.maxZ - 0.06],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, (FLOOR_Y - 0.04) / 2, z]} material={frame} castShadow>
          <boxGeometry args={[0.05, -FLOOR_Y - 0.04, 0.05]} />
        </mesh>
      ))}
      <mesh position={[BENCH_CX, FLOOR_Y + 0.15, BENCH.minZ + 0.06]} material={frame}>
        <boxGeometry args={[BENCH_W - 0.12, 0.04, 0.03]} />
      </mesh>
      <mesh position={[BENCH_CX, FLOOR_Y + 0.15, BENCH.maxZ - 0.06]} material={frame}>
        <boxGeometry args={[BENCH_W - 0.12, 0.04, 0.03]} />
      </mesh>

      {/* controller cabinet */}
      <group position={[1.35, FLOOR_Y, -0.55]}>
        <mesh position={[0, 0.55, 0]} material={dark} castShadow receiveShadow>
          <boxGeometry args={[0.5, 1.1, 0.4]} />
        </mesh>
        <mesh position={[0, 0.85, 0.201]}>
          <planeGeometry args={[0.3, 0.16]} />
          <meshStandardMaterial color="#0a0a0b" emissive="#86d7f2" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0.15, 0.62, 0.205]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.012, 24]} />
          <meshStandardMaterial color="#e2312b" emissive="#e2312b" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* light-curtain posts at the operator side */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.05, FLOOR_Y, 1.1]}>
          <mesh position={[0, 0.7, 0]} material={dark} castShadow>
            <boxGeometry args={[0.04, 1.4, 0.04]} />
          </mesh>
          <mesh position={[-s * 0.021, 0.7, 0]}>
            <boxGeometry args={[0.002, 1.25, 0.02]} />
            <meshStandardMaterial color="#ff4b3e" emissive="#ff4b3e" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
