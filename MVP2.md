# Simulator MVP Phase 2 - Ideation & Scope

## 1. XR Physical Environment Detection & Splashes
**Objective:** Ground the simulator directly into the user's real-world environment by allowing interactions (such as paint splashes or particle collisions) to physically mark or react to their room.

*   **Current State:** 
    *   The app currently utilizes WebXR Hit Testing (`xr.requestHitTestSource`) purely for a central reticle, pinning simple objects (like target boxes) onto physical planes. 
    *   We also integrate WebXR Depth (`xb.core.depth`) for occlusion logic on raining particles.
*   **Implementation Strategy:**
    *   **Controller/Hand-tracked Raycasting:** Add a transient hit test or raycast tied to the controller (or hand) pinch-to-shoot action. 
    *   **Persistent Splash Decals:** Once a hit collision registers on the physical wall or floor, leverage the `PaintSplash.js` class (`splatFromIntersection()`) to project paint onto the tracked planes.
    *   **Depth Mesh Painting (Advanced):** Instead of only firing against simple plane proxies, we can perform intersects directly against the generated WebXR Depth mesh (`xb.core.depth.mesh`), allowing paint to conform precisely to couches, walls, and curved physical objects in real-time.

---

## 2. Drone Design Overhaul
**Objective:** Migrate away from rudimentary programmatic primitive boxes towards a high-fidelity, realistically animated drone entity.

*   **Current State:** Defined explicitly via `initObjectPools` and `createDrone` utilizing grouped `THREE.BoxGeometry` and `CylinderGeometry` with basic gray/dark grey `MeshStandardMaterial` shaders. 
*   **Implementation Strategy:**
    *   **Physically Based Model (GLTF):** Load a fully detailed GLTF drone asset.
    *   **Kinetic Animation System:** Implement proper banking and pitching equations. When the drone flies forward, the model should naturally pitch down into the acceleration vector rather than simply translating abruptly. 
    *   **VFX Enhancements:** Add motion-blurred textures for the spinning rotors, dynamic glowing emission LEDs (changing color based on lock-on states or battery telemetry), and minor hover/bobbing noise.

---

## 3. Interactive Rain VFX
**Objective:** Improve the ambient atmospheric effects to react realistically rather than just serving as a background overlay.

*   **Current State:** Rain drops fall in parallel. Occlusion occurs mathematically if they are behind a depth threshold.
*   **Implementation Strategy:**
    *   **Surface Splashes:** When a raindrop's Y vector crosses a detected physical plane (or a bounding box of the drone), kill the falling raindrop and trigger a tiny ripple/splash animation frame.
    *   **Camera Lens Effects:** Draw a refractive droplet filter overlay when rain drops hit the camera clipping bounds, simulating droplets on a lens. 

---

## Action Plan for Next Session:

1.  Integrate a drone GLTF model (using `GLTFLoader`).
2.  Hook up the shooting mechanism (using `PaintSplash` and the existing WebXR Hit Test logic or Depth Mesh intersection) so that clicking places decals on physical planes.
3.  Add procedural tilts to the drone's velocity vectors.
