# Phase 2: Technical Architecture & Implementation Blueprints

To bring the next-level XR features from our roadmap into reality, we need to upgrade the simulator's underlying technical stack. This document provides the engineering blueprints for developing these advanced interactions.

## 1. Interaction Engine: Bimanual Telekinesis & Haptics

### 1.1 Kinetic Flight Mode (Telekinesis)
We will bypass traditional RC Euler angle thrusting and implement a **Proportional-Integral-Derivative (PID) Controller** for 6DOF magnetic hand tracking.

**Implementation Logic:**
1. **Pinch & Hold:** When the user pinches their right hand in `KINETIC` mode, save the initial hand position and initial drone position.
2. **Translation Matrix:** Calculate the delta vector of the hand moving in real-time. Multiply this vector by a spatial scalar (e.g., `3.0x`) to create the `TargetAnchor` for the drone.
3. **PID Physics:** Instead of instantly moving the drone to the `TargetAnchor`, apply force towards the anchor point:
   ```javascript
   // Pseudo-code for Kinetic Update Loop
   const distance = targetAnchor.distanceTo(drone.position);
   const direction = targetAnchor.clone().sub(drone.position).normalize();
   
   // Spring physics (P-controller)
   const forceMagnitude = distance * SPRING_CONSTANT;
   const springForce = direction.multiplyScalar(forceMagnitude);
   
   // Apply damping (D-controller)
   const dampingForce = drone.velocity.clone().multiplyScalar(-DAMPING_CONSTANT);
   
   drone.applyForce(springForce.add(dampingForce));
   ```

### 1.2 Velocity-Based Haptics
Instead of static pulse vibrations, haptic intensity will map dynamically to physical events:
* **Audio-Reactive Haptics:** Pipe the `TechnoDroneSynth.analyser` low-frequency (bass drum) data directly into the WebXR Gamepad Haptic API, making the controller throb to the techno beat.
* **Proximity Haptics:** As the drone gets closer to a real-world object (via WebXR hit test), increase the baseline vibration frequency.

## 2. Advanced Vision & AI: Gemini Multimodal Live

To achieve the "Conversational Co-Pilot", we will move beyond the current REST API `generateContent` calls and implement a WebRTC connection to the Gemini Realtime/Live API.

### 2.1 WebRTC Audio/Video Pipeline
1. **Camera Stream Extraction:** Utilize `navigator.mediaDevices.getUserMedia` to grab the passthrough video track.
2. **Microphone Stream:** Capture user audio for natural language commands.
3. **WebRTC to Gemini:** Send 1 frame per second + continuous audio via WebRTC.
4. **Function Calling (Tools):** Define executable tools for Gemini:
   * `set_drone_mode(mode: "hover" | "follow" | "explore")`
   * `adjust_synth(parameter: "filter" | "bpm" | "wave", value: number)`
5. **Execution:** When the user says *"Drone, circle that table and drop the bass"*, Gemini streams back a function call that executes the automated flight path and alters the Web Audio API filter cutoff.

## 3. Spatial Audio: 3D Ambisonics

The current audio system is stereo. We will upgrade the `TechnoDroneSynth` to use true positional audio localized to the drone's physical coordinates.

### 3.1 Web Audio PannerNode Integration
```javascript
// Spatial Audio Setup
this.panner = this.ctx.createPanner();
this.panner.panningModel = 'HRTF'; // Head-Related Transfer Function
this.panner.distanceModel = 'inverse';
this.panner.refDistance = 1;
this.panner.maxDistance = 10000;
this.panner.rolloffFactor = 1.5;

// Connect Master Gain -> Panner -> Destination
this.masterGain.disconnect();
this.masterGain.connect(this.panner);
this.panner.connect(this.ctx.destination);
```
**Update Loop Sync:** Every frame, map `xb.core.camera.position` to the AudioContext Listener, and map `drone.position` to the PannerNode position.

## 4. Environment: Scene Understanding (WebXR Depth API)

To implement physical wind, bouncing, and safety forcefields, we need environmental geometry, not just single-point hit testing.

1. **WebXR Mesh API:** Request the `'mesh-detection'` or `'depth-sensing'` features during XR session initialization.
2. **Invisible Colliders:** Generate invisible Three.js physics bodies (Ammo.js or Cannon.js) from the XR Mesh data.
3. **Collision Callbacks:** If `drone.boundingBox.intersects(xrMesh)`, trigger a spark particle effect, play a physical collision sound, and invert the drone's velocity vector with an elasticity coefficient (bouncing).

---
**Next Step:** Would you like to begin by implementing the **Kinetic Flight (Telekinesis) Mode** in the simulator, or wire up the **Web Audio Spatial Panner** for realistic 3D sound?
