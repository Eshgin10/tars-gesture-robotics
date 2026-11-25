import { Vec3 } from '../math';

/**
 * Standardised, transport-agnostic robot command set.
 * Commands are plain serialisable objects so they can be forwarded to other
 * executors (e.g. a ROS 2 node via rosbridge) without change.
 */
export type CommandSource = 'gesture' | 'keyboard' | 'mouse' | 'ui' | 'system' | 'remote';

export type CommandBody =
  | { type: 'STOP'; reason?: string }
  | { type: 'SELECT_OBJECT'; objectId: string }
  | { type: 'DESELECT' }
  | { type: 'GRAB'; objectId?: string }
  | { type: 'MOVE_TO'; target: Vec3; mode: 'teleop' | 'goto' }
  | { type: 'PROPOSE_TARGET'; target: Vec3; label?: string }
  | { type: 'JOG'; delta: Vec3 }
  /** direct hand-driven gripper opening: 0 = closed, 1 = fully open */
  | { type: 'GRIPPER'; aperture: number }
  | { type: 'RELEASE' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RESET' }
  | { type: 'HOME' }
  | { type: 'HOLD'; reason: string }
  | { type: 'RESUME' };

export type CommandType = CommandBody['type'];
export type Command = CommandBody & { id: number; source: CommandSource; t: number };

export interface CommandResult {
  accepted: boolean;
  message?: string;
  /** suppress the default log line (e.g. high-rate teleop streaming) */
  silent?: boolean;
}

/** Commands that stream at frame rate and are not individually logged. */
export const STREAMING: ReadonlySet<CommandType> = new Set(['MOVE_TO', 'JOG', 'GRIPPER']);

/**
 * Priority within one control tick: safety commands pre-empt everything,
 * all other commands keep their arrival order (FIFO).
 */
export const PRIORITY: Record<CommandType, number> = {
  STOP: 0,
  HOLD: 1,
  CONFIRM: 5,
  CANCEL: 5,
  RESET: 5,
  RESUME: 5,
  HOME: 5,
  RELEASE: 5,
  GRAB: 5,
  SELECT_OBJECT: 5,
  DESELECT: 5,
  PROPOSE_TARGET: 5,
  MOVE_TO: 5,
  JOG: 5,
  GRIPPER: 5,
};
