import * as THREE from 'three';
import {SimpleDecalGeometry} from 'xrblocks/addons/objects/SimpleDecalGeometry.js';

const ASSETS_PATH = 'https://cdn.jsdelivr.net/gh/google/xrblocks@main/';

// Duration of fade out in ms.
const kFadeoutMs = 30000;
const textureLoader = new THREE.TextureLoader();
const decalDiffuse = textureLoader.load(
  './paintball_assets/decal-diffuse1.webp'
);
decalDiffuse.colorSpace = THREE.SRGBColorSpace; // Sets the color space for the decal diffuse texture.
const decalNormal = textureLoader.load('./paintball_assets/decal-normal1.webp');

let paintshotAudioBuffer; // Declares a variable to hold the audio buffer for
// the paint shot sound.
const audioLoader = new THREE.AudioLoader();
audioLoader.load(
  ASSETS_PATH + 'musicLibrary/PaintOneShot1.opus',
  function (buffer) {
    paintshotAudioBuffer = buffer; // Loads the paint shot audio and assigns it to the buffer.
  }
);

/**
 * PaintSplash class represents a 3D object for the paintball decal, including
 * the visual decal and optional sound.
 */
export class PaintSplash extends THREE.Object3D {
  /**
   * @param {THREE.AudioListener} listener The audio listener for spatial audio.
   * @param {THREE.Color} color The color of the paintball.
   */
  /**
   * Represents a paintball splash including the visual decal and optional sound.
   * Now integrates physical splatter droplets and vertical paint drips that run down walls!
   * @param {THREE.AudioListener} listener The audio listener for spatial audio.
   * @param {THREE.Color} color The color of the paintball.
   */
  constructor(listener, color) {
    super();
    // Adds positional audio to the paintball if a listener is provided.
    if (listener != null) {
      this.sound = new THREE.PositionalAudio(listener);
    }
    this.color = color; // Sets the paintball color.
    this.enableSound = true;
    this.splashList = [];
    this.drips = []; // List of active dripping trails
  }

  /**
   * Projects a splat onto a mesh from an intersection point, applying rotation
   * and scale.
   * @param {THREE.Intersection} intersection The intersection data.
   * @param {number} scale The scale of the splat.
   */
  splatFromIntersection(intersection, scale) {
    if (!intersection || !intersection.object) return;

    const objectRotation = new THREE.Quaternion();
    intersection.object.getWorldQuaternion(objectRotation); // Gets the world quaternion for rotation.

    // Ensure we have a valid starting normal
    let normal = intersection.normal ? intersection.normal.clone() : new THREE.Vector3(0, 1, 0);

    // Clones and rotates the intersection normal to align it with the mesh's
    // orientation.
    normal.applyQuaternion(objectRotation).normalize();

    // Prevent NaNs in calculations
    if (isNaN(normal.x) || isNaN(normal.y) || isNaN(normal.z)) {
      normal.set(0, 1, 0);
    }

    const originalNormal = new THREE.Vector3(0, 0, 1); // The original normal to face.
    const angle = originalNormal.angleTo(normal); // Calculates the angle between the normals.

    const crossVec = new THREE.Vector3().crossVectors(originalNormal, normal);
    let rotationAxis = crossVec.clone().normalize();

    // If originalNormal and normal are parallel or anti-parallel (cross product is near zero)
    if (crossVec.lengthSq() < 0.0001 || isNaN(rotationAxis.x) || isNaN(rotationAxis.y) || isNaN(rotationAxis.z)) {
      if (angle > 1.0) { // Opposite directions: rotate 180 degrees around x axis
        rotationAxis.set(1, 0, 0);
      } else { // Same direction: no rotation needed
        rotationAxis.set(0, 1, 0);
      }
    }

    // Applies a random rotation to the splat around the normal.
    const randomRotation = new THREE.Quaternion().setFromAxisAngle(
      normal,
      Math.random() * Math.PI * 2
    );

    // Rotates the splat to face the surface normal with a random rotation.
    const rotateFacingNormal = new THREE.Quaternion()
      .setFromAxisAngle(rotationAxis, angle)
      .premultiply(randomRotation);

    // Final safety validation to prevent any NaNs or Infinities
    if (isNaN(rotateFacingNormal.x) || isNaN(rotateFacingNormal.y) || isNaN(rotateFacingNormal.z) || isNaN(rotateFacingNormal.w) ||
        !isFinite(rotateFacingNormal.x) || !isFinite(rotateFacingNormal.y) || !isFinite(rotateFacingNormal.z) || !isFinite(rotateFacingNormal.w)) {
      rotateFacingNormal.set(0, 0, 0, 1);
    }

    // Projects the splat onto the mesh at the given position, orientation, and
    // scale.
    this.splatOnMesh(
      intersection.object,
      intersection.point,
      rotateFacingNormal,
      scale
    );
  }

  /**
   * Creates and applies a decal on the mesh at the specified position with the
   * given orientation and scale.
   * @param {THREE.Mesh} mesh The mesh where the splat will be applied.
   * @param {THREE.Vector3} position The world position of the splat.
   * @param {THREE.Quaternion} orientation The rotation of the splat.
   * @param {number} scale The scale of the splat.
   */
  /**
   * Creates and applies a decal on the mesh at the specified position with the
   * given orientation and scale.
   * Now generates surrounding splatter micro-dots and registers sliding wall drips.
   * @param {THREE.Mesh} mesh The mesh where the splat will be applied.
   * @param {THREE.Vector3} position The world position of the splat.
   * @param {THREE.Quaternion} orientation The rotation of the splat.
   * @param {number} scale The scale of the splat.
   */
  splatOnMesh(mesh, position, orientation, scale) {
    // Safety guards for position coordinate validation
    const safePosition = position ? position.clone() : new THREE.Vector3(0, 0, 0);
    if (isNaN(safePosition.x) || isNaN(safePosition.y) || isNaN(safePosition.z) ||
        !isFinite(safePosition.x) || !isFinite(safePosition.y) || !isFinite(safePosition.z)) {
      safePosition.set(0, 0, 0);
    }

    // Safety guards for orientation coordinate validation
    const safeOrientation = orientation ? orientation.clone() : new THREE.Quaternion(0, 0, 0, 1);
    if (isNaN(safeOrientation.x) || isNaN(safeOrientation.y) || isNaN(safeOrientation.z) || isNaN(safeOrientation.w) ||
        !isFinite(safeOrientation.x) || !isFinite(safeOrientation.y) || !isFinite(safeOrientation.z) || !isFinite(safeOrientation.w)) {
      safeOrientation.set(0, 0, 0, 1);
    }

    // Safety check for scale parameter
    const safeScale = (scale && scale > 0) ? scale : 0.16;

    // Creates a material for the decal using the specified color, textures, and
    // settings.
    const material = new THREE.MeshPhongMaterial({
      color: this.color,
      specular: 0x555555,
      map: decalDiffuse,
      normalMap: decalNormal,
      normalScale: new THREE.Vector2(1, 1),
      shininess: 30,
      transparent: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      alphaTest: 0.1,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });

    // Creates a scale vector for the decal geometry.
    const scaleVector3 = new THREE.Vector3(safeScale, safeScale, safeScale);

    // Extract surface normal from orientation (decal defaults to facing Z+)
    const normalVec = new THREE.Vector3(0, 0, 1).applyQuaternion(safeOrientation).normalize();

    // 1. Dual-Projection Setup: Try to project with SimpleDecalGeometry for realistic depth wrapping.
    // Wrap in try-catch to keep active splattered paint even on rotated/custom planes where projection might throw.
    if (mesh) {
      try {
        let isHeavy = false;
        if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position) {
          if (mesh.geometry.attributes.position.count > 1000) isHeavy = true;
        }
        
        if (!isHeavy) {
          const geometry = new SimpleDecalGeometry(
            mesh,
            safePosition,
            safeOrientation,
            scaleVector3
          );
          geometry.computeVertexNormals(); // Computes vertex normals for proper shading.

          // Creates a mesh for the decal and adds it to the scene.
          this.decalMesh = new THREE.Mesh(geometry, material);
          this.decalMesh.createdTime = performance.now();
          this.add(this.decalMesh);
        }
      } catch (projectionError) {
        console.warn("SimpleDecalGeometry projection ignored, using high-fidelity Plane fallback. Error:", projectionError);
      }
    }

    // 2. Guaranteed center splat plane fallback (offset slightly along normal to prevent z-fighting).
    // This is mathematically bulletproof on any surface shape, rotation, or composition.
    const centerGeo = new THREE.PlaneGeometry(safeScale, safeScale);
    const centerMesh = new THREE.Mesh(centerGeo, material.clone());
    centerMesh.position.copy(safePosition).addScaledVector(normalVec, 0.003);
    centerMesh.quaternion.copy(safeOrientation);
    centerMesh.createdTime = performance.now();
    this.add(centerMesh);
    this.splashList.push(centerMesh);

    // Spawn 5-8 surrounding splatter micro-dots for dynamic physical visual "juice"
    const numSplatters = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numSplatters; i++) {
      const angle = (i / numSplatters) * Math.PI * 2 + Math.random() * 0.4;
      const dist = safeScale * (0.35 + Math.random() * 1.0);
      const sScale = safeScale * (0.15 + Math.random() * 0.25);

      // Random offset in the plane of the decal
      const planeOffset = new THREE.Vector3(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        0.002 // offset slightly along Z to prevent z-fighting
      );
      planeOffset.applyQuaternion(safeOrientation);
      const scatterPos = safePosition.clone().add(planeOffset);

      const sGeo = new THREE.PlaneGeometry(sScale, sScale);
      const sMesh = new THREE.Mesh(sGeo, material.clone()); // separate material instance to fade independently
      sMesh.position.copy(scatterPos);
      sMesh.quaternion.copy(safeOrientation);
      sMesh.createdTime = performance.now() + (Math.random() * 300 - 150); // staggered fade times
      this.add(sMesh);
    }

    // Spawn vertical wall drips if the normal is horizontal (e.g. hitting a wall or column)
    if (Math.abs(normalVec.y) < 0.65) {
      const numDrips = Math.floor(Math.random() * 2) + 1; // 1 or 2 runs of drip paths
      for (let j = 0; j < numDrips; j++) {
        // Offset start slightly left/right from center
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * safeScale * 0.4,
          (Math.random() - 0.5) * safeScale * 0.4,
          0.004
        );
        offset.applyQuaternion(safeOrientation);
        const dripPos = safePosition.clone().add(offset);

        // Semi-realistic dripping sphere
        const dScale = safeScale * 0.08;
        const dripGeo = new THREE.SphereGeometry(dScale, 8, 8);
        const dripMat = new THREE.MeshPhongMaterial({
          color: this.color,
          shininess: 90,
          specular: 0x999999,
          transparent: true,
          opacity: 1.0,
        });

        const dMesh = new THREE.Mesh(dripGeo, dripMat);
        dMesh.position.copy(dripPos);
        this.add(dMesh);

        this.drips.push({
          mesh: dMesh,
          speed: 0.12 + Math.random() * 0.18, // m/s sliding down
          direction: new THREE.Vector3(0, -1, 0),
          normal: normalVec.clone(),
          parentMesh: mesh,
          orientation: safeOrientation.clone(),
          scale: safeScale,
          trailTimer: 0,
          active: true,
          age: 0,
          lifeLimit: 2500 + Math.random() * 2500, // dripper duration in ms
          createdTime: performance.now()
        });
      }
    }

    // Plays the paint shot sound if the audio buffer is loaded and sound is
    // enabled.
    if (
      this.enableSound &&
      this.sound != null &&
      paintshotAudioBuffer != null
    ) {
      this.sound.setBuffer(paintshotAudioBuffer);
      this.sound.setRefDistance(10);
      this.sound.play();
    }
  }

  update() {
    const currentTime = performance.now();
    const dt = 0.016; // Simulated physics step

    // Process dripping paint drops sliding down vertical walls
    this.drips.forEach((d) => {
      if (!d.active) return;

      d.age += dt * 1000;

      // Project gravity down along the surface plane
      const gravity = new THREE.Vector3(0, -1, 0);
      const normalPart = d.normal.clone().multiplyScalar(gravity.dot(d.normal));
      const slideDir = gravity.clone().sub(normalPart).normalize();

      d.mesh.position.addScaledVector(slideDir, d.speed * dt);

      // Periodically leave tiny static paint trail marks along its sliding slideDir path
      d.trailTimer += dt * 1000;
      if (d.trailTimer > 100) {
        d.trailTimer = 0;

        const tScale = d.scale * (0.35 + Math.random() * 0.25);
        const tGeo = new THREE.PlaneGeometry(tScale, tScale);
        
        // Re-use materials to avoid excessive draw calls
        const tMesh = new THREE.Mesh(tGeo, d.mesh.material);
        tMesh.position.copy(d.mesh.position).addScaledVector(d.normal, 0.002);
        tMesh.quaternion.copy(d.orientation);
        tMesh.createdTime = performance.now();
        this.add(tMesh);
      }

      // Deactivate dripper once it dries, times out, or reaches near floor level (y <= 0.05)
      if (d.age > d.lifeLimit || d.mesh.position.y < 0.05) {
        d.active = false;
        d.mesh.createdTime = performance.now() - kFadeoutMs; // mark child mesh to trigger automatic fadeout next loop
      }
    });

    // Iterate over all children of the Object3D instance to handle fading and cleanup
    this.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.createdTime !== undefined) {
        const timeElapsed = currentTime - child.createdTime;

        // Check if it's time to start fading out the mesh (after 2 seconds)
        if (timeElapsed > kFadeoutMs) {
          const timeSinceFadeStart = timeElapsed - kFadeoutMs; // Time since the start of fade

          // If within the fade duration, update opacity
          if (timeSinceFadeStart <= kFadeoutMs) {
            const newOpacity = 1.0 - timeSinceFadeStart / kFadeoutMs;
            child.material.opacity = Math.max(0.0, newOpacity); // Ensure opacity doesn't go below 0
            child.material.transparent = true; // Ensure transparency is enabled
          } else {
            // If the fade duration has passed, remove the mesh from the scene
            this.remove(child);
          }
        }
      }
    });
  }

  /**
   * Disposes of the paintball's decal mesh and its associated geometry and
   * material.
   */
  dispose() {
    if (this.decalMesh) {
      this.decalMesh.geometry.dispose(); // Disposes of the geometry.
      this.decalMesh.material.dispose(); // Disposes of the material.
    }
  }
}
