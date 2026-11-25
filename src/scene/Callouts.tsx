import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { ReactNode, useRef } from 'react';
import * as THREE from 'three';
import { engine } from '../core/engine';
import { useBridge } from '../state/store';

/**
 * Infographic-style annotation: a dot on the 3-D anchor, a leader line with an elbow,
 * and a numbered mono label (reference: technical-drawing callouts "01 … 06").
 */
function Leader({ n, title, children, dir = 1, rise = 46, run = 34, color = '#ecece8' }: { n: string; title: string; children?: ReactNode; dir?: 1 | -1; rise?: number; run?: number; color?: string }) {
  const w = 150;
  const ex = dir * run;
  const ey = -rise;
  return (
    <div style={{ position: 'relative', width: 0, height: 0, pointerEvents: 'none' }}>
      <svg style={{ position: 'absolute', left: -w, top: -rise - 4, overflow: 'visible' }} width={w * 2} height={rise + 8}>
        <g transform={`translate(${w},${rise + 4})`}>
          <circle r={2.6} fill={color} />
          <circle r={6} fill="none" stroke={color} strokeOpacity={0.35} />
          <polyline points={`0,0 ${ex},${ey} ${ex + dir * 70},${ey}`} fill="none" stroke={color} strokeOpacity={0.65} strokeWidth={1} />
        </g>
      </svg>
      <div
        className="mono"
        style={{
          position: 'absolute',
          top: ey - 34,
          left: dir > 0 ? ex : undefined,
          right: dir < 0 ? -ex : undefined,
          width: 170,
          textAlign: dir > 0 ? 'left' : 'right',
          color,
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          lineHeight: 1.45,
          textShadow: '0 1px 3px #000',
          whiteSpace: 'nowrap',
        }}
      >
        <div>
          <span style={{ opacity: 0.55 }}>{n}</span>&nbsp;&nbsp;{title}
        </div>
        <div style={{ opacity: 0.6 }}>{children}</div>
      </div>
    </div>
  );
}

const mm = (v: number) => (v * 1000).toFixed(0);

export function Callouts() {
  const t = useBridge((s) => s.telemetry);
  const tcp = useRef<THREE.Group>(null!);
  const part = useRef<THREE.Group>(null!);
  const goal = useRef<THREE.Group>(null!);

  const aim = t.perception.aim;
  const partId = t.selection ?? (aim.active && aim.mode === 'select' ? aim.objectId : null);
  const obj = partId ? engine.world.get(partId) : null;
  const reach = obj ? engine.robot.checkReachable(obj) : null;
  const zone = t.target ? engine.world.zoneAt(t.target.x, t.target.z, 'destination') : null;
  const showGoal = !!t.target && (t.phase === 'MOVING' || t.phase === 'PLACING' || !!t.pending || t.perception.clutch);

  useFrame(() => {
    const r = engine.robot;
    tcp.current.position.set(r.ee.x, r.ee.y, r.ee.z);
    const o = partId ? engine.world.get(partId) : null;
    if (o && part.current) part.current.position.set(o.position.x, o.position.y + o.height / 2, o.position.z);
    if (r.currentTarget && goal.current) goal.current.position.set(r.currentTarget.x, r.currentTarget.y, r.currentTarget.z);
  });

  if (t.phase === 'ESTOP') return <group ref={tcp} />;
  return (
    <>
      <group ref={tcp}>
        <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <Leader n="01" title="Tool centre point" dir={1}>
            {mm(t.ee.x)} · {mm(t.ee.y)} · {mm(t.ee.z)} mm · grip {(t.gripperGap * 1000).toFixed(0)}
          </Leader>
        </Html>
      </group>
      {obj && obj.state !== 'held' && (
        <group ref={part}>
          <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
            <Leader n="02" title={obj.name} dir={-1} rise={38} color={reach?.ok ? '#86d7f2' : '#ff4b3e'}>
              {(obj.size * 1000).toFixed(0)} mm · {reach?.ok ? (t.selection === obj.id ? 'selected · reachable' : 'aiming') : 'out of reach'}
            </Leader>
          </Html>
        </group>
      )}
      {showGoal && (
        <group ref={goal}>
          <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
            <Leader n="03" title={zone ? zone.name : 'Target'} dir={1} rise={30} run={28} color={t.targetClamped ? '#ff4b3e' : '#ecece8'}>
              {t.targetClamped ? 'limited to workspace' : t.pending ? 'awaiting confirm' : 'commanded'}
            </Leader>
          </Html>
        </group>
      )}
    </>
  );
}
