import { beforeEach, describe, expect, it } from 'vitest';
import { CommandBus } from '../commands/commandBus';
import { CommandBody } from '../commands/commands';
import { GestureRecognizer } from '../gestures/recognizer';
import { GestureName } from '../gestures/types';
import { GestureInterpreter } from '../interpreter/interpreter';
import { EventLog } from '../log';
import { RobotController } from '../robot/controller';
import { SimulatedHand } from '../simulatedHand';
import { fallbackViewport } from '../viewport';
import { WorldModel } from '../world/world';

/** Headless replica of the engine loop (no DOM, no rendering). */
function rig() {
  const log = new EventLog();
  const world = new WorldModel();
  const robot = new RobotController(world, log);
  const bus = new CommandBus(robot, log);
  const rec = new GestureRecognizer();
  const interp = new GestureInterpreter({ moveSensitivity: 1.5, heightSensitivity: 1.0, liftSensitivity: 1.0 });
  const view = fallbackViewport(world);
  const hand = new SimulatedHand();
  hand.noise = 0.001;
  const sent: CommandBody[] = [];
  let t = 0;
  const step = (ms: number) => {
    const end = t + ms;
    while (t < end) {
      t += 33;
      const p = rec.process(hand.frame(t), t);
      const cmds = interp.update(
        p,
        {
          phase: robot.phase,
          armed: robot.armed,
          estop: robot.estop,
          held: robot.held,
          selection: robot.selection,
          pending: robot.pending?.kind ?? null,
          ee: robot.ee,
        },
        view,
        t,
      );
      cmds.forEach((c) => {
        sent.push(c);
        bus.send(c, 'gesture', t);
      });
      bus.flush();
      robot.update(0.033);
      world.update(0.033);
    }
  };
  const gesture = (g: GestureName, ms: number) => {
    hand.gesture = g;
    step(ms);
  };
  const until = (cond: () => boolean, maxMs = 20000) => {
    let waited = 0;
    while (!cond() && waited < maxMs) {
      step(33);
      waited += 33;
    }
    return cond();
  };
  return { log, world, robot, bus, interp, hand, sent, step, gesture, until, types: () => sent.map((c) => c.type) };
}

describe('robot controller', () => {
  let r: ReturnType<typeof rig>;
  beforeEach(() => (r = rig()));

  it('starts in STANDBY and arms only on confirmation', () => {
    expect(r.robot.phase).toBe('STANDBY');
    expect(r.bus.send({ type: 'GRAB', objectId: 'red' }, 'keyboard')).toBeNull();
    r.bus.flush();
    expect(r.robot.sequence).toBeNull();
    r.bus.send({ type: 'CONFIRM' }, 'ui');
    r.bus.flush();
    expect(r.robot.phase).toBe('HOMING');
    expect(r.until(() => r.robot.phase === 'IDLE')).toBe(true);
  });

  it('rejects grasping an object outside the reachable workspace with an explanation', () => {
    r.robot.armed = true;
    r.bus.send({ type: 'SELECT_OBJECT', objectId: 'violet' }, 'mouse');
    r.bus.send({ type: 'GRAB' }, 'keyboard');
    r.bus.flush();
    expect(r.robot.sequence).toBeNull();
    const last = r.bus.history[r.bus.history.length - 1];
    expect(last.result.accepted).toBe(false);
    expect(last.result.message).toMatch(/unreachable/);
  });

  it('executes pick and place via keyboard commands', () => {
    r.robot.armed = true;
    r.bus.send({ type: 'SELECT_OBJECT', objectId: 'blue' }, 'mouse');
    r.bus.send({ type: 'GRAB' }, 'keyboard');
    r.bus.flush();
    expect(r.until(() => r.robot.phase === 'CARRYING')).toBe(true);
    expect(r.robot.held).toBe('blue');
    r.bus.send({ type: 'MOVE_TO', target: { x: 0.28, y: 0.24, z: 0.58 }, mode: 'goto' }, 'mouse');
    r.bus.flush();
    expect(r.until(() => r.robot.phase === 'CARRYING' && !r.robot.isMoving)).toBe(true);
    r.bus.send({ type: 'RELEASE' }, 'keyboard');
    r.bus.flush();
    expect(r.until(() => r.robot.phase === 'IDLE' && r.world.get('blue')!.state === 'resting')).toBe(true);
    const blue = r.world.get('blue')!;
    expect(r.world.zoneAt(blue.position.x, blue.position.z)?.id).toBe('B');
    expect(blue.position.y).toBeCloseTo(0.012 + blue.height / 2, 3);
  });

  it('E-STOP halts motion immediately and clears the plan', () => {
    r.robot.armed = true;
    r.bus.send({ type: 'SELECT_OBJECT', objectId: 'red' }, 'mouse');
    r.bus.send({ type: 'GRAB' }, 'keyboard');
    r.bus.flush();
    r.step(600);
    expect(r.robot.isMoving).toBe(true);
    r.bus.send({ type: 'STOP' }, 'keyboard');
    expect(r.robot.estop).toBe(true);
    expect(r.robot.sequence).toBeNull();
    // motion commands are rejected while stopped
    r.bus.send({ type: 'MOVE_TO', target: { x: 0.3, y: 0.3, z: 0.3 }, mode: 'goto' }, 'mouse');
    r.bus.flush();
    expect(r.robot.sequence).toBeNull();
    r.bus.send({ type: 'CONFIRM' }, 'ui');
    r.bus.flush();
    expect(r.robot.estop).toBe(false);
    expect(r.robot.phase).toBe('IDLE');
  });

  it('suppresses accidental duplicate commands', () => {
    r.robot.armed = true;
    r.bus.send({ type: 'RESET' }, 'keyboard', 0);
    r.bus.send({ type: 'RESET' }, 'keyboard', 10);
    r.bus.flush();
    expect(r.bus.history.length).toBe(1);
  });

  it('keeps teleoperation targets inside the workspace and above surfaces', () => {
    r.robot.armed = true;
    r.hand.visible = false;
    r.bus.send({ type: 'MOVE_TO', target: { x: 0, y: -1, z: 3 }, mode: 'teleop' }, 'keyboard');
    r.bus.flush();
    for (let i = 0; i < 120; i++) r.robot.update(0.033);
    expect(r.robot.ee.y).toBeGreaterThan(0.02);
    expect(Math.hypot(r.robot.ee.x, r.robot.ee.z)).toBeLessThan(0.8);
    expect(r.robot.targetClamped).toBe(true);
  });
});

describe('direct hand & finger control', () => {
  it('arm → move hand to cube → lower → close fingers to grab → carry to zone → open fingers to drop', () => {
    const r = rig();
    // operator appears with open hand, arms the robot with a thumbs-up
    r.gesture('OPEN_PALM', 600);
    r.gesture('THUMBS_UP', 900);
    expect(r.types()).toContain('CONFIRM');
    expect(r.until(() => r.robot.phase === 'IDLE')).toBe(true);

    // open hand engages direct hand control
    r.gesture('OPEN_PALM', 600);
    expect(r.interp.state.clutch).toBe(true);

    const red = r.world.get('red')!;
    const ee0 = { ...r.robot.ee };
    const c0 = { ...r.hand.center };
    const s0 = r.hand.scale;
    // move hand sideways toward red.x, forward/back via scale toward red.z, and down toward the bench
    const dx = (red.position.x - ee0.x) / 1.5;
    const dy = (ee0.y - 0.03) / 1.0;
    const dz = red.position.z - ee0.z; // fallbackViewport: back.z = +1, so reach = -dz
    const targetScale = s0 * Math.exp(-(dz / 1.0));
    for (let i = 1; i <= 30; i++) {
      const k = i / 30;
      r.hand.center = { x: c0.x + dx * k, y: c0.y + dy * k };
      r.hand.scale = s0 + (targetScale - s0) * k;
      r.step(66);
    }
    r.step(1500);
    expect(Math.hypot(r.robot.ee.x - red.position.x, r.robot.ee.z - red.position.z)).toBeLessThan(0.02);
    expect(r.robot.ee.y).toBeLessThan(red.position.y + 0.02);

    // close thumb + index (PINCH) → holders close around the red cube and grab it
    r.gesture('PINCH', 900);
    expect(r.robot.held).toBe('red');
    expect(r.robot.phase).toBe('CARRYING');

    // raise hand and move sideways / forward-back over Zone A (0.42, 0.30)
    const cGrab = { ...r.hand.center };
    const target = { x: 0.42, z: 0.3 };
    const dxA = (target.x - ee0.x) / 1.5;
    const dyLift = (ee0.y - 0.26) / 1.0;
    const dzA = target.z - ee0.z;
    const scaleA = s0 * Math.exp(-(dzA / 1.0) - 0.04 * Math.sign(dzA));
    for (let i = 1; i <= 35; i++) {
      const k = i / 35;
      r.hand.center = { x: cGrab.x + (c0.x + dxA - cGrab.x) * k, y: cGrab.y + (c0.y + dyLift - cGrab.y) * k };
      r.hand.scale = r.hand.scale + (scaleA - r.hand.scale) * 0.2;
      r.step(66);
    }
    r.step(2000);
    expect(Math.hypot(r.robot.ee.x - target.x, r.robot.ee.z - target.z)).toBeLessThan(0.04);

    // open thumb + index (OPEN_PALM) → holders open and drop the cube into Zone A
    r.gesture('OPEN_PALM', 800);
    expect(r.robot.held).toBeNull();
    expect(r.until(() => r.world.get('red')!.state === 'resting')).toBe(true);
    expect(r.world.zoneAt(red.position.x, red.position.z)?.id).toBe('A');
    expect(r.log.entries.some((e) => e.event === 'placed_zone')).toBe(true);
  });

  it('pauses on tracking loss and resumes when the hand returns', () => {
    const r = rig();
    r.robot.armed = true;
    r.gesture('OPEN_PALM', 600);
    expect(r.interp.state.clutch).toBe(true);
    r.hand.visible = false;
    r.step(400);
    expect(r.robot.phase).toBe('PAUSED');
    const q = [...r.robot.q];
    r.step(1000);
    expect(r.robot.q).toEqual(q);
    r.hand.visible = true;
    r.gesture('OPEN_PALM', 800);
    expect(r.robot.phase).toBe('IDLE');
  });
});

describe('reaching parts on the bench (regression: invisible floor)', () => {
  it('an open gripper can be lowered around a part down to grasp height', () => {
    const r = rig();
    r.robot.armed = true;
    const red = r.world.get('red')!;
    for (let i = 0; i < 200; i++) {
      r.bus.send({ type: 'MOVE_TO', target: { x: red.position.x + 0.02, y: 0, z: red.position.z - 0.015 }, mode: 'teleop' }, 'keyboard', i * 33);
      r.bus.flush();
      r.robot.update(0.033);
    }
    // alignment assist centred the fingers over the part …
    expect(Math.hypot(r.robot.ee.x - red.position.x, r.robot.ee.z - red.position.z)).toBeLessThan(0.005);
    // … and the grip centre got below the part's top face (fingers around it)
    expect(r.robot.ee.y).toBeLessThan(red.position.y + 0.01);
    expect(r.robot.ee.y).toBeGreaterThan(0.018); // fingertips still above the bench
    expect(r.robot.selection).toBe('red');
    // grabbing from here aligns in place instead of lifting away and re-approaching
    r.bus.send({ type: 'GRAB' }, 'keyboard', 99999);
    r.bus.flush();
    r.robot.update(0.033);
    expect(r.robot.stepLabel).toMatch(/Align fingers/);
    expect(r.until(() => r.robot.phase === 'CARRYING')).toBe(true);
    expect(r.robot.held).toBe('red');
  });

  it('closed fingers still cannot be pushed through a part', () => {
    const r = rig();
    r.robot.armed = true;
    r.robot.fingers = { left: 0.003, right: 0.003 };
    r.robot.fingerTarget = { left: 0.003, right: 0.003 };
    const red = r.world.get('red')!;
    for (let i = 0; i < 200; i++) {
      r.bus.send({ type: 'MOVE_TO', target: { x: red.position.x, y: 0, z: red.position.z }, mode: 'teleop' }, 'keyboard', i * 33);
      r.bus.flush();
      r.robot.update(0.033);
    }
    expect(r.robot.ee.y).toBeGreaterThan(red.position.y + red.height / 2 + 0.015);
  });
});
