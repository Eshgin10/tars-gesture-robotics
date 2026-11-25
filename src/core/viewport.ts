import { ViewportQuery } from './interpreter/interpreter';
import { Vec3 } from './math';
import { WorldModel } from './world/world';

/** Shared bench-plane hit test: object (with snapping radius) and zone under a point. */
export function hitTestBench(world: WorldModel, point: Vec3 | null, snap = 0.075) {
  if (!point) return { point: null, objectId: null, zoneId: null, zoneCenter: null };
  const obj = world.nearestObject(point.x, point.z, snap);
  const zone = world.zoneAt(point.x, point.z, 'destination');
  return {
    point,
    objectId: obj?.id ?? null,
    zoneId: zone?.id ?? null,
    zoneCenter: zone ? { x: zone.center.x, y: 0, z: zone.center.z } : null,
  };
}

/**
 * Fallback viewport mapping (used before the 3-D view is mounted and in tests):
 * a fixed operator-side view, screen x → world +X, screen up → away from operator.
 */
export function fallbackViewport(world: WorldModel): ViewportQuery {
  return {
    pointerToWorld(nx, ny) {
      const point = { x: -0.9 + nx * 1.8, y: 0, z: -0.2 + ny * 1.15 };
      return hitTestBench(world, point);
    },
    screenDeltaToWorld(dx, dy) {
      return { x: dx, y: 0, z: dy };
    },
  };
}
