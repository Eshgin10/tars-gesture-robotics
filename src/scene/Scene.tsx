import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { engine } from '../core/engine';
import { hitTestBench } from '../core/viewport';
import { Overlays3D } from './Overlays3D';
import { RobotArm } from './RobotArm';
import { Workcell } from './Workcell';
import { WorldObjects, Zones } from './WorldObjects';

/**
 * Registers the live camera with the engine so pointing rays and hand-motion
 * deltas are interpreted relative to what the operator actually sees.
 */
function ViewportBridge() {
  const { camera } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const right = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    engine.view = {
      pointerToWorld(nx, ny) {
        ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), camera);
        const p = ray.ray.intersectPlane(plane, hit);
        if (!p) return hitTestBench(engine.world, null);
        return hitTestBench(engine.world, { x: p.x, y: 0, z: p.z });
      },
      screenDeltaToWorld(dx, dy) {
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
        fwd.normalize();
        right.set(-fwd.z, 0, fwd.x); // fwd × up
        return { x: right.x * dx - fwd.x * dy, y: 0, z: right.z * dx - fwd.z * dy };
      },
    };
  }, [camera]);
  return null;
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0.85, 1.6, 2.55], fov: 36, near: 0.05, far: 60 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => gl.setClearColor('#070708')}
    >
      <fog attach="fog" args={['#070708', 4, 11]} />
      <hemisphereLight args={['#dfe7ff', '#050506', 0.35]} />
      <directionalLight
        position={[1.6, 3.2, 1.9]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-1.4}
        shadow-camera-near={0.5}
        shadow-camera-far={8}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <spotLight position={[-1.8, 2.4, 0.6]} angle={0.5} penumbra={0.9} intensity={18} color="#cfe9ff" />
      <pointLight position={[0, 1.6, -1.2]} intensity={4} color="#86d7f2" distance={3.5} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-4, 1.5, 1]} rotation-y={Math.PI / 2} scale={[4, 1, 1]} color="#9fc2ff" />
        <Lightformer form="rect" intensity={0.8} position={[4, 1.2, -1]} rotation-y={-Math.PI / 2} scale={[4, 1, 1]} color="#ffd9a0" />
      </Environment>

      <Workcell />
      <Zones />
      <RobotArm />
      <WorldObjects />
      <Overlays3D />

      <OrbitControls
        makeDefault
        target={[-0.04, 0.26, 0.24]}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.6}
        maxDistance={4.5}
        maxPolarAngle={Math.PI * 0.49}
      />
      <ViewportBridge />
    </Canvas>
  );
}
