# TARS — Gesture-Controlled Robotic Arm

**Humans and Robots hackathon project.** TARS turns an ordinary webcam into a natural, camera-based robot controller.
You point at a part, pinch to grab it, move your hand to carry it, show a V-sign to set it down, and open your palm to stop
everything. A simulated 6-axis industrial arm validates each command and executes it with real kinematics.

> ⚠ **Simulation only.** The safety mechanisms here (E-stop, tracking-loss hold, workspace/joint/speed limits) are
> simulated. They are **not** a certified safety system and must not be used to operate physical industrial robots.

---

## Quick start

```bash
npm install          # also copies the MediaPipe WASM runtime into public/
npm run setup:assets # optional: downloads the hand model (7.8 MB) for fully offline use
npm run dev          # http://localhost:5173
```

```bash
npm test             # 30 automated tests (kinematics, gestures, interpreter, full pipeline)
npm run build        # type-check + production build into dist/
```

Requirements: Node 18+ and a Chromium-based browser or Firefox. Webcam access requires `localhost` or HTTPS.
If the local model file is missing, the app loads it from Google's CDN.

---

## The demo in 60 seconds

1. Open the app → **Get started** → **Enable webcam** (or **Use simulated hand** if you have no camera).
2. Show your hand. The app calibrates your reach and lets you test each gesture. **Robot commands are disabled during calibration.**
3. **Thumbs-up** arms the robot. It homes at reduced speed.
4. **Point** at the red cube and hold still until the ring fills → the cube is selected.
5. **Pinch** → the arm plans approach → descend → close → lift. Keep pinching; when the cube is lifted you take control.
6. **Move your pinched hand** → the arm carries the cube. Relax into a fist to hold position, then pinch again to continue (clutch).
7. Over **Zone A**, show a **V-sign** → the arm lowers, opens the gripper, and the cube settles in the zone.
8. Start another motion and show an **open palm** → immediate E-stop. Hold a **thumbs-up for 1 s** to reset it.

The **Demo checklist** in the viewport ticks off each step, and the **Activity log** records the full operation (exportable as JSON).

### Gesture vocabulary

| Gesture | Command | Notes |
|---|---|---|
| Open palm (5 fingers, spread) | `STOP` | Highest priority. Works from **either** hand. Fastest activation (≤140 ms). |
| Point (index only) | aim → `SELECT_OBJECT` / `PROPOSE_TARGET` | Dwell selects an object. While carrying, dwell on a zone proposes a target. |
| Pinch (thumb + index) | `GRAB`, then `MOVE_TO` (clutch) | Relative "clutch" mapping, so the arm never jumps when you re-pinch. |
| V-sign (index + middle) | `RELEASE` | Deliberately different from the E-stop palm. |
| Thumbs-up | `CONFIRM` | Arms the robot, accepts targets and placements. A 1 s hold resets an E-stop. |
| Fist | — (neutral) | Disengages the clutch; the robot holds position. |

### Keyboard and mouse fallback (works without a webcam)

`Space` E-stop · `Enter` confirm/arm/reset · `Esc` cancel · `G` grab · `R` release · `H` home · `N` next object ·
`WASD`/arrows jog (view-relative) · `Q`/`E` down/up · `?` help.
With the simulated hand: `1` point, `2` pinch, `3` V-sign, `4` thumbs-up, `5` fist, `6` palm, `0` relaxed, `T` hand in/out of view.
Mouse: click an object to select it, double-click to grab it, and while holding a part, click the bench or a zone to send the arm there.

---

## Architecture

```
 webcam ─► CameraManager ─► HandTracker (MediaPipe, WASM/GPU)  ┐
                                                               ├─► HandFrame (21 landmarks / hand)
 mouse  ─► SimulatedHand (procedural landmarks)                ┘
                         │
                         ▼
          GestureRecognizer  = features → rule classifier → temporal stabiliser (+ One-Euro filtering)
                         │  Perception (stable gesture, confidence, pointer, palm)
                         ▼
          GestureInterpreter (state machine: latching, dwell, hold-to-confirm, clutch, tracking loss)
                         │  Commands {STOP, SELECT_OBJECT, GRAB, MOVE_TO, RELEASE, CONFIRM, RESET, HOLD, …}
 keyboard / mouse / UI ─►│
                         ▼
          CommandBus  (stamping, STOP pre-emption, duplicate suppression, logging, transports ─► ROS 2)
                         ▼
          RobotController (validation, IK planning, trajectories, limits, gripper, attachment)
                         ▼
          WorldModel (objects, zones, support surfaces, settling)
                         ▼
          React Three Fiber scene (reads state every frame)   +   React dashboard (zustand, ~12 Hz telemetry)
```

| Module | Path | Responsibility |
|---|---|---|
| Math / transforms | `src/core/math.ts` | Vectors, 4×4 transforms (no rendering dependency) |
| Kinematics | `src/core/robot/kinematics.ts` | FK, analytic IK (top-down grasp), reachability, workspace clamping |
| Robot simulation | `src/core/robot/controller.ts` | Command execution, pick/place sequencing, trapezoidal joint and linear moves, speed limits, gripper and attachment |
| Objects | `src/core/world/world.ts` | Parts, zones, support heights, gravity settling |
| Gesture engine | `src/core/gestures/*` | Features, classifier, stabiliser, recognizer, synthetic hand |
| Command interpretation | `src/core/interpreter/interpreter.ts` | Gesture → command state machine |
| Command layer | `src/core/commands/*` | Command schema, bus, priorities, transports |
| ROS 2 bridge | `src/core/transport/rosbridge.ts` | rosbridge v2 JSON: `/bridge/command`, `/bridge/joint_states` |
| Orchestration | `src/core/engine.ts` | Per-frame pipeline loop |
| Vision | `src/vision/*` | Webcam lifecycle, MediaPipe Hand Landmarker |
| 3-D rendering | `src/scene/*` | Articulated arm, workcell, objects, zones, rays, trajectories |
| UI | `src/ui/*`, `src/state/store.ts` | Dashboard, onboarding/calibration, settings, log |

**Robot model.** A 6-DOF chain: J1 base yaw, J2 shoulder, J3 elbow, J4 forearm roll, J5 wrist pitch, J6 tool roll.
The link lengths are 0.32 / 0.42 / 0.38 / 0.19 m, and the reach is about 0.79 m at bench height.
The rendered group hierarchy matches the FK chain exactly. IK uses the top-down approach constraint to put the wrist centre above the target,
which reduces J1–J3 to a planar two-link problem. J5 keeps the tool vertical, and J6 aligns the fingers with the part's faces (mod 90°).
Every solution is checked against joint limits and link-vs-bench collision. Unreachable targets are rejected with a reason, for example
*"Target is 106 cm away; max reach at this height is 78.8 cm"*. The violet cube is placed out of reach on purpose to show this.

**Safety behaviours (simulated).**
- E-stop has the highest priority: it runs synchronously on the bus, from either hand, the keyboard or the button. It halts all joints, clears the plan and keeps the grip. Only an explicit 1 s thumbs-up or the Reset button clears it.
- Tracking loss: if the hand is gone for more than 250 ms, motion pauses. It resumes only after the hand has been seen continuously for 500 ms.
- Confidence threshold, activation delay, hysteresis and one-shot latching on every discrete command.
- Duplicate-command suppression (350 ms).
- Joint limits, workspace envelope, a collision floor that keeps the fingers or payload above the bench, parts and zones, and joint plus Cartesian speed limits.
- Safe start: the robot boots disarmed in a rest pose. Arming homes it at 45 % speed. Reset requires confirmation.
- Placement outside a destination zone requires confirmation (configurable).

**ROS 2.** Enable *Settings → Integration* and run `ros2 launch rosbridge_server rosbridge_websocket_launch.xml`.
Each command is published as JSON on `/bridge/command` (`std_msgs/String`), and the simulated joints are published on `/bridge/joint_states`.
Because commands are plain serialisable objects, a ROS 2 node can execute them on a real controller instead of the simulator.

---

## Testing webcam interaction (manual)

1. `npm run dev`, open `http://localhost:5173` in Chrome, and allow the camera.
2. Sit 50–80 cm from the camera in good light. In the camera panel the skeleton overlay should track your hand at about 25–30 fps (inference time is shown).
3. In **Calibrate → Test each gesture**, each card turns green when its gesture is recognised. Nothing is sent to the robot in this mode.
4. If gestures flicker, raise *Activation delay* or *Confidence threshold* in Settings. If pinches are missed, raise *Pinch sensitivity*.
5. To check tracking loss, start a grasp and move your hand out of view. The robot shows *Motion paused* and resumes when your hand returns.

Without a webcam, choose **Simulated hand**. It generates MediaPipe-shaped landmarks, so the real classifier, stabiliser and interpreter all run.

## Automated tests

`npm test` covers:
- FK/IK round-trips over the workspace, gripper alignment, unreachable-target reasons, and workspace clamping that is always solvable.
- Gesture classification, including noise, scale, position and mirroring robustness, plus palm-vs-V separation.
- Stabiliser timing and flicker rejection, and E-stop detection on a secondary hand.
- Controller behaviour: arming, rejection of unreachable grabs, keyboard pick-and-place into Zone B, E-stop freeze, duplicate suppression and teleop clamping.
- **End-to-end gesture demo**: synthetic hand frames → recognizer → interpreter → bus → robot. This covers arm, select, grab, transport, release in Zone A, E-stop and resume, plus tracking-loss pause/resume and point + thumbs-up targeting.

## Known limitations

- Gesture recognition is rule-based on landmark geometry. It is robust for these six gestures but is not a learned model. Strong side-lighting or unusual hand poses can lower confidence.
- Depth is not used for control: hand motion maps to a plane relative to the 3-D view, and height is handled automatically (carry/approach heights) or with `Q`/`E`.
- The physics is simplified: objects are attached kinematically, settling is vertical only, and there are no friction or tipping dynamics. Collision handling covers the bench, parts, zones and the base keep-out, not full mesh-to-mesh contact.
- IK assumes a top-down grasp (J4 = 0), which is enough for pick-and-place but not for arbitrary 6-D poses.
- When the browser tab is hidden, the simulation pauses with it (requestAnimationFrame stops).

## Recommended next steps

1. Train a small landmark-based classifier (e.g. an MLP on the 63-D landmark vector) from data captured with the existing calibration flow, and keep the rule engine as a safety cross-check.
2. Add a two-handed mode: the second hand controls height or gripper yaw, and either hand can still trigger the E-stop.
3. Add a ROS 2 executor node plus MoveIt 2 planning for a real arm such as a UR or xArm, with a hardware E-stop wired independently of the vision pipeline.
4. Full collision checking with capsule link models, and speed-and-separation monitoring that uses the tracked hand position.
5. Record and replay of sessions and commands for training and auditability.
