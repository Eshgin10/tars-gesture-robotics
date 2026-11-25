import { Vec3, copy3 } from '../math';

export type ObjectShape = 'box' | 'cylinder';
export type ObjectState = 'resting' | 'held' | 'falling';

export interface WorldObject {
  id: string;
  name: string;
  color: string;
  shape: ObjectShape;
  /** box: edge length; cylinder: diameter */
  size: number;
  height: number;
  position: Vec3; // centre
  yaw: number;
  state: ObjectState;
  velocityY: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  center: Vec3; // on the bench (y = 0)
  halfSize: { x: number; z: number };
  platformHeight: number;
  kind: 'source' | 'destination';
}

export const BENCH = { minX: -0.95, maxX: 0.95, minZ: -0.45, maxZ: 0.95, height: 0 };

const INITIAL_OBJECTS: Omit<WorldObject, 'state' | 'velocityY'>[] = [
  { id: 'red', name: 'Red cube', color: '#e5484d', shape: 'box', size: 0.055, height: 0.055, position: { x: -0.36, y: 0.0275, z: 0.42 }, yaw: 0.25 },
  { id: 'blue', name: 'Blue cube', color: '#3e8ef7', shape: 'box', size: 0.055, height: 0.055, position: { x: -0.5, y: 0.0275, z: 0.22 }, yaw: -0.4 },
  { id: 'amber', name: 'Amber cylinder', color: '#f5a524', shape: 'cylinder', size: 0.05, height: 0.07, position: { x: -0.22, y: 0.035, z: 0.6 }, yaw: 0 },
  { id: 'green', name: 'Green cube', color: '#30a46c', shape: 'box', size: 0.05, height: 0.05, position: { x: -0.52, y: 0.025, z: 0.48 }, yaw: 0.7 },
  { id: 'violet', name: 'Violet cube', color: '#8e4ec6', shape: 'box', size: 0.055, height: 0.055, position: { x: -0.78, y: 0.0275, z: 0.72 }, yaw: 0.1 },
];

export const ZONES: Zone[] = [
  { id: 'pick', name: 'Pick area', color: '#6b7280', center: { x: -0.42, y: 0, z: 0.45 }, halfSize: { x: 0.25, z: 0.3 }, platformHeight: 0, kind: 'source' },
  { id: 'A', name: 'Zone A', color: '#86d7f2', center: { x: 0.42, y: 0, z: 0.3 }, halfSize: { x: 0.1, z: 0.1 }, platformHeight: 0.012, kind: 'destination' },
  { id: 'B', name: 'Zone B', color: '#ecece8', center: { x: 0.28, y: 0, z: 0.58 }, halfSize: { x: 0.1, z: 0.1 }, platformHeight: 0.012, kind: 'destination' },
];

/** Object management: bench, objects, zones, support surfaces and settling. */
export class WorldModel {
  objects: WorldObject[] = [];
  zones = ZONES;
  listeners = new Set<(e: { type: 'settled'; object: WorldObject; zone: Zone | null }) => void>();

  constructor() {
    this.reset();
  }

  reset() {
    this.objects = INITIAL_OBJECTS.map((o) => ({ ...o, position: copy3(o.position), state: 'resting', velocityY: 0 }));
  }

  get(id: string | null | undefined) {
    return id ? this.objects.find((o) => o.id === id) : undefined;
  }

  /** Horizontal footprint radius (conservative). */
  footprint(o: WorldObject) {
    return o.shape === 'box' ? (o.size / 2) * Math.SQRT2 : o.size / 2;
  }

  zoneAt(x: number, z: number, kind?: Zone['kind']): Zone | null {
    for (const zn of this.zones) {
      if (kind && zn.kind !== kind) continue;
      if (Math.abs(x - zn.center.x) <= zn.halfSize.x && Math.abs(z - zn.center.z) <= zn.halfSize.z) return zn;
    }
    return null;
  }

  /** Height of the highest support surface under (x,z) within `radius`. */
  supportHeightAt(x: number, z: number, radius = 0, excludeId?: string, includeObjects = true) {
    let h = BENCH.height;
    const zn = this.zoneAt(x, z, 'destination');
    if (zn) h = Math.max(h, zn.platformHeight);
    if (!includeObjects) return h;
    for (const o of this.objects) {
      if (o.id === excludeId || o.state === 'held') continue;
      const d = Math.hypot(o.position.x - x, o.position.z - z);
      if (d < this.footprint(o) + radius) h = Math.max(h, o.position.y + o.height / 2);
    }
    return h;
  }

  /** Nearest graspable object to a point on the bench plane. */
  nearestObject(x: number, z: number, maxDist: number) {
    let best: WorldObject | null = null;
    let bd = maxDist;
    for (const o of this.objects) {
      if (o.state === 'held') continue;
      const d = Math.hypot(o.position.x - x, o.position.z - z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  release(o: WorldObject) {
    o.state = 'falling';
    o.velocityY = 0;
  }

  /** Simple gravity settle for released objects. */
  update(dt: number) {
    for (const o of this.objects) {
      if (o.state !== 'falling') continue;
      const support = this.supportHeightAt(o.position.x, o.position.z, this.footprint(o) * 0.6, o.id);
      const rest = support + o.height / 2;
      o.velocityY -= 9.81 * dt;
      o.position.y += o.velocityY * dt;
      if (o.position.y <= rest) {
        o.position.y = rest;
        o.velocityY = 0;
        o.state = 'resting';
        const zone = this.zoneAt(o.position.x, o.position.z, 'destination');
        this.listeners.forEach((l) => l({ type: 'settled', object: o, zone }));
      }
    }
  }
}
