import { useEffect } from 'react';
import { engine } from '../core/engine';
import { useBridge } from '../state/store';
import { SIM_KEYS } from './CameraPanel';

const JOG_SPEED = 0.22; // m/s

/** Keyboard fallback controls. All actions go through the same command bus as gestures. */
export function useKeyboard() {
  useEffect(() => {
    const held = new Set<string>();
    const isField = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
    };
    const down = (e: KeyboardEvent) => {
      if (isField(e)) return;
      const k = e.key.toLowerCase();
      const st = useBridge.getState();
      if (k === ' ') {
        e.preventDefault();
        engine.send({ type: 'STOP', reason: 'keyboard (Space)' }, 'keyboard');
        return;
      }
      if (k === 'enter') {
        e.preventDefault();
        engine.send({ type: 'CONFIRM' }, 'keyboard');
        return;
      }
      if (k === 'escape') {
        if (document.querySelector('[data-popover-open]')) return; // popovers close themselves
        if (st.view === 'system') st.set({ view: 'workspace' });
        else engine.send({ type: 'CANCEL' }, 'keyboard');
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === '?') {
        if (st.view === 'system' && st.systemTab === 'help') st.set({ view: 'workspace' });
        else st.openSystem('help');
        return;
      }
      if (engine.input === 'simulated' && SIM_KEYS[k] !== undefined) {
        engine.sim.gesture = SIM_KEYS[k];
        return;
      }
      if (k === 't' && engine.input === 'simulated') {
        engine.sim.visible = !engine.sim.visible;
        return;
      }
      if (k === 'g') engine.send({ type: 'GRAB' }, 'keyboard');
      else if (k === 'r') engine.send({ type: 'RELEASE' }, 'keyboard');
      else if (k === 'h') engine.send({ type: 'HOME' }, 'keyboard');
      else if (k === 'n') {
        const objs = engine.world.objects.filter((o) => o.state === 'resting');
        if (!objs.length) return;
        const i = objs.findIndex((o) => o.id === engine.robot.selection);
        engine.send({ type: 'SELECT_OBJECT', objectId: objs[(i + 1) % objs.length].id }, 'keyboard');
      } else if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        held.add(k);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    const blur = () => held.clear();

    let last = performance.now();
    const off = engine.onFrame(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!held.size) return;
      let sx = 0, sy = 0, h = 0;
      if (held.has('a') || held.has('arrowleft')) sx -= 1;
      if (held.has('d') || held.has('arrowright')) sx += 1;
      if (held.has('w') || held.has('arrowup')) sy -= 1;
      if (held.has('s') || held.has('arrowdown')) sy += 1;
      if (held.has('q')) h -= 1;
      if (held.has('e')) h += 1;
      const d = engine.view.screenDeltaToWorld(sx, sy);
      const n = Math.hypot(d.x, d.z) || 1;
      const step = JOG_SPEED * dt;
      engine.send({ type: 'JOG', delta: { x: (d.x / n) * step * Math.min(1, Math.abs(sx) + Math.abs(sy)), y: h * step, z: (d.z / n) * step * Math.min(1, Math.abs(sx) + Math.abs(sy)) } }, 'keyboard');
    });

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      off();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}
