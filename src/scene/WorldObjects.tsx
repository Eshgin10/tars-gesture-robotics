import { Html } from '@react-three/drei';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '../core/engine';
import { WorldObject, ZONES } from '../core/world/world';
import { useBridge } from '../state/store';

function ObjectMesh({ id }: { id: string }) {
  const proto = engine.world.get(id)!;
  const group = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: proto.color, metalness: 0.1, roughness: 0.45, emissive: proto.color, emissiveIntensity: 0 }),
    [proto.color],
  );
  const setHover = (v: string | null) => useBridge.getState().set({ hoverObject: v });

  useFrame(({ clock }) => {
    const o = engine.world.get(id);
    if (!o) return;
    group.current.position.set(o.position.x, o.position.y, o.position.z);
    group.current.rotation.y = o.yaw;
    const r = engine.robot;
    const aim = engine.interpreter.state.aim;
    const selected = r.selection === id;
    const hovered = (aim.active && aim.mode === 'select' && aim.objectId === id) || useBridge.getState().hoverObject === id;
    const t = clock.elapsedTime;
    mat.emissiveIntensity = selected ? 0.35 + Math.sin(t * 4) * 0.12 : hovered ? 0.25 : o.state === 'held' ? 0.08 : 0;
    // ground ring under selected / hovered objects
    const showRing = (selected || hovered) && o.state !== 'held';
    ring.current.visible = showRing;
    if (showRing) {
      ring.current.position.set(o.position.x, 0.0015, o.position.z);
      const reach = r.checkReachable(o);
      ringMat.current.color.set(!reach.ok ? '#ff4b3e' : selected ? '#86d7f2' : '#ecece8');
      ringMat.current.opacity = selected ? 0.95 : 0.45;
      const s = selected ? 1 + Math.sin(t * 4) * 0.05 : 1;
      ring.current.scale.set(s, s, s);
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    engine.send({ type: 'SELECT_OBJECT', objectId: id }, 'mouse');
  };
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    engine.send({ type: 'GRAB', objectId: id }, 'mouse');
  };

  return (
    <>
      <group ref={group}>
        <mesh
          material={mat}
          castShadow
          receiveShadow
          onClick={onClick}
          onDoubleClick={onDouble}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHover(null);
            document.body.style.cursor = '';
          }}
        >
          {proto.shape === 'box' ? (
            <boxGeometry args={[proto.size, proto.height, proto.size]} />
          ) : (
            <cylinderGeometry args={[proto.size / 2, proto.size / 2, proto.height, 36]} />
          )}
        </mesh>
        {/* subtle edge lines for a crisp, technical look */}
        {proto.shape === 'box' && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(proto.size, proto.height, proto.size)]} />
            <lineBasicMaterial color="#000" transparent opacity={0.35} />
          </lineSegments>
        )}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[proto.size * 0.85, proto.size * 0.85 + 0.008, 48]} />
        <meshBasicMaterial ref={ringMat} transparent depthWrite={false} />
      </mesh>
    </>
  );
}

export function WorldObjects() {
  const ids = useMemo(() => engine.world.objects.map((o: WorldObject) => o.id), []);
  return (
    <>
      {ids.map((id) => (
        <ObjectMesh key={id} id={id} />
      ))}
    </>
  );
}

/** Pick area + destination zones drawn on the bench. */
export function Zones() {
  const refs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    const aim = engine.interpreter.state.aim;
    const held = engine.robot.heldObject();
    ZONES.forEach((z, i) => {
      const m = refs.current[i];
      if (!m) return;
      const over = held && Math.abs(held.position.x - z.center.x) <= z.halfSize.x && Math.abs(held.position.z - z.center.z) <= z.halfSize.z;
      const aimed = aim.active && aim.zoneId === z.id;
      m.opacity = z.kind === 'source' ? 0 : over || aimed ? 0.35 + Math.sin(clock.elapsedTime * 6) * 0.08 : 0.1;
    });
  });
  return (
    <>
      {ZONES.map((z, i) => {
        const w = z.halfSize.x * 2;
        const d = z.halfSize.z * 2;
        const edge = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d));
        return (
          <group key={z.id} position={[z.center.x, 0, z.center.z]}>
            {z.platformHeight > 0 && (
              <mesh position={[0, z.platformHeight / 2, 0]} receiveShadow castShadow>
                <boxGeometry args={[w, z.platformHeight, d]} />
                <meshStandardMaterial color="#17171a" metalness={0.4} roughness={0.5} />
              </mesh>
            )}
            <mesh position={[0, z.platformHeight + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial ref={(m) => (refs.current[i] = m)} color={z.color} transparent opacity={0.14} depthWrite={false} />
            </mesh>
            <lineSegments position={[0, z.platformHeight + 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={edge}>
              <lineBasicMaterial color={z.kind === 'source' ? '#5a5a60' : z.color} transparent opacity={z.kind === 'source' ? 0.6 : 0.95} />
            </lineSegments>
            <Html position={[0, 0.002, d / 2 + 0.025]} center transform={false} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className="zone-label" style={{ color: z.kind === 'source' ? '#7a7a7d' : z.color }}>
                {z.name.toUpperCase()}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
