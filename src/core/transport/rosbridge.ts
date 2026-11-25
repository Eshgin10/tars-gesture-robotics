import { Command, CommandResult } from '../commands/commands';
import { CommandTransport } from '../commands/commandBus';
import { ROBOT } from '../robot/config';

/**
 * Optional ROS 2 bridge using the rosbridge v2 JSON protocol
 * (rosbridge_server / foxglove-compatible). Publishes:
 *   /bridge/command      std_msgs/String   — every command + result as JSON
 *   /bridge/joint_states sensor_msgs/JointState — simulated joint positions
 * A ROS 2 node can subscribe to /bridge/command to drive a real controller.
 */
export class RosBridgeTransport implements CommandTransport {
  private ws: WebSocket | null = null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  onStatus?: (s: RosBridgeTransport['status']) => void;

  constructor(public url: string) {}

  connect() {
    this.disconnect();
    this.setStatus('connecting');
    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => {
        this.setStatus('connected');
        this.send({ op: 'advertise', topic: '/bridge/command', type: 'std_msgs/String' });
        this.send({ op: 'advertise', topic: '/bridge/joint_states', type: 'sensor_msgs/JointState' });
      };
      ws.onerror = () => this.setStatus('error');
      ws.onclose = () => {
        if (this.ws === ws) this.setStatus(this.status === 'error' ? 'error' : 'disconnected');
      };
    } catch {
      this.setStatus('error');
    }
  }

  disconnect() {
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
    this.setStatus('disconnected');
  }

  private setStatus(s: RosBridgeTransport['status']) {
    this.status = s;
    this.onStatus?.(s);
  }

  private send(msg: object) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  onCommand(cmd: Command, result: CommandResult) {
    if (cmd.type === 'MOVE_TO' || cmd.type === 'JOG' || cmd.type === 'GRIPPER') return; // streamed separately as joint states
    this.send({ op: 'publish', topic: '/bridge/command', msg: { data: JSON.stringify({ ...cmd, result }) } });
  }

  publishJointState(q: readonly number[], gripperGap: number) {
    const now = Date.now();
    this.send({
      op: 'publish',
      topic: '/bridge/joint_states',
      msg: {
        header: { stamp: { sec: Math.floor(now / 1000), nanosec: (now % 1000) * 1e6 }, frame_id: 'base_link' },
        name: [...ROBOT.jointNames.map((n) => n.split(' ')[0].toLowerCase()), 'gripper'],
        position: [...q, gripperGap],
        velocity: [],
        effort: [],
      },
    });
  }
}
