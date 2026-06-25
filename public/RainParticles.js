import * as THREE from 'three';

const kMaxAnimationFrames = 15;
const kAnimationSpeed = 2.0;
const DEBUG_SINGLE = false;
// const DEBUG_SINGLE = true;

function clamp(x, a, b) {
  return Math.min(Math.max(x, a), b);
}

export class RainParticles extends THREE.Object3D {
  constructor() {
    super();
    // Sets the number of particles and defines the range of the raindrop
    // effect.
    this.particleCount = DEBUG_SINGLE ? 1 : 2400;
    this.RANGE = 8;
    this.raycaster = new THREE.Raycaster();

    // Initializes arrays for fall speeds, animation weights, and visibility
    // states of each particle.
    this.velocities = new Float32Array(this.particleCount);
    this.particleWeights = new Float32Array(this.particleCount);
    this.particleVisibility = new Float32Array(this.particleCount);

    // Placeholder for the InstancedMesh representing the raindrop particles.
    this.raindropMesh = null;
  }

  /**
   * Initializes raindrop particles with a shader material and instanced
   * geometry. Loads the texture and sets up the particle mesh and instanced
   * attributes.
   */
  init() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    textureLoader.load(
        'https://cdn.jsdelivr.net/gh/google/xrblocks@main/demos/rain/textures/rain_sprite_sheet.png',
      (raindropTexture) => {
        // Creates a custom shader material for the raindrop particles.
        const raindropMaterial = this.createRaindropMaterial(raindropTexture);

        // Creates a simple plane geometry for each raindrop particle.
        const raindropGeometry = new THREE.PlaneGeometry(0.1, 0.1);

        // Initializes an InstancedMesh with the defined geometry and material.
        this.raindropMesh = new THREE.InstancedMesh(
          raindropGeometry,
          raindropMaterial,
          this.particleCount
        );
        this.raindropMesh.frustumCulled = false; // Disable frustum culling so turning head doesn't hide rain!

        // Populates the particle mesh with initial positions and properties.
        this.initializeParticles();

        // Adds instanced attributes for weight and visibility to control raindrop
        // animation and rendering.
        this.raindropMesh.geometry.setAttribute(
          'aWeight',
          new THREE.InstancedBufferAttribute(this.particleWeights, 1).setUsage(
            THREE.DynamicDrawUsage
          )
        );
        this.raindropMesh.geometry.setAttribute(
          'aVisibility',
          new THREE.InstancedBufferAttribute(this.particleVisibility, 1).setUsage(
            THREE.DynamicDrawUsage
          )
        );

        // Flags the instance matrix for an initial update and adds the raindrop
        // mesh to the scene.
        this.raindropMesh.instanceMatrix.needsUpdate = true;
        this.add(this.raindropMesh);
      },
      undefined,
      (err) => {
        console.error('Failed to load rain texture:', err);
      }
    );
  }

  /**
   * Creates and returns a custom shader material for the raindrop particles.
   * Uses a texture and sets up uniforms for the camera position to handle
   * billboard rotation.
   */
  createRaindropMaterial(texture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: {value: texture},
        uCameraPosition: {value: new THREE.Vector3()},
        uCameraRotationMatrix: {value: new THREE.Matrix4()},
        uTint: {value: new THREE.Vector3(1.0, 1.0, 1.0)},
        uAscend: {value: 0.0}
      },
      vertexShader: `
        attribute float aWeight;
        attribute float aVisibility;
        varying float vWeight;
        varying float vVisibility;
        varying vec2 vUv;
        uniform vec3 uCameraPosition;
        uniform mat4 uCameraRotationMatrix;

        const float PI = 3.14159265359;


        void main() {
          vUv = uv;
          vWeight = aWeight;
          vVisibility = aVisibility;

          // Get the world position of the instance using modelMatrix and instanceMatrix
          vec4 worldPosition = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

          vec3 rotatedPosition;

          if (vWeight < 1.5) {
            // Compute vector from particle to camera, projected onto XZ plane
            vec3 toCamera = uCameraPosition - worldPosition.xyz;
            toCamera.y = 0.0; // Ignore vertical component
            toCamera = normalize(toCamera);

            // Compute the angle to rotate around Y-axis
            float angle = atan(toCamera.x, toCamera.z);

            // Create rotation matrix around Y-axis
            mat3 rotationMatrix = mat3(
              cos(angle), 0.0, -sin(angle),
              0.0,        1.0,  0.0,
              sin(angle), 0.0,  cos(angle)
            );

            // Apply rotation to vertex position
            rotatedPosition = rotationMatrix * position;
          } else {
            // Rotate the particle to face positive Y-axis
            // This is a rotation of -90 degrees around X-axis
            float angle = 0.5 * PI; // -90 degrees in radians

            // Create rotation matrix around X-axis
            mat3 rotationMatrix = mat3(
              1.0,       0.0,        0.0,
              0.0, cos(angle), -sin(angle),
              0.0, sin(angle),  cos(angle)
            );

            // Apply rotation to vertex position
            rotatedPosition = rotationMatrix * position;
          }

          // Apply instance and model transformations
          vec4 finalPosition = modelMatrix * instanceMatrix * vec4(rotatedPosition, 1.0);

          // Transform to clip space
          gl_Position = projectionMatrix * viewMatrix * finalPosition;
        }

      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uTint;
        varying vec2 vUv;
        varying float vWeight;
        varying float vVisibility;

        void main() {
          const float kAnimationSpeed = 2.0;
          vec2 uv = vUv * 0.25;  // Assumes a 4x4 texture grid.
          float frame = floor(vWeight / kAnimationSpeed);
          float xIndex = mod(frame, 4.0);
          float yIndex = floor(frame / 4.0);
          uv += vec2(xIndex, 3.0 - yIndex) * 0.25;  // Maps frame index to UV coordinates.
          vec4 texColor = texture2D(uTexture, uv);
          
          vec3 finalColor = pow(texColor.rgb, vec3(0.5)) * uTint;
          gl_FragColor = vec4(finalColor, texColor.a * vVisibility * 1.2);  // Keep rain fully visible with excellent alpha level
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending // Makes it more magical when tinted
    });
  }

  setTheme(theme) {
    if (!this.raindropMesh) return;
    
    if (theme === 'greek') {
       this.raindropMesh.material.uniforms.uTint.value.set(2.0, 0.4, 0.1); // Fiery embers
       this.raindropMesh.material.uniforms.uAscend.value = 1.0;
    } else if (theme === 'temple') {
       this.raindropMesh.material.uniforms.uTint.value.set(0.1, 0.8, 2.0); // Cyan mist
       this.raindropMesh.material.uniforms.uAscend.value = 0.5;
    } else {
       this.raindropMesh.material.uniforms.uTint.value.set(1.0, 1.0, 1.0); // Normal rain
       this.raindropMesh.material.uniforms.uAscend.value = 0.0;
       this.raindropMesh.material.blending = THREE.NormalBlending; // Reset blend mode for normal rain
    }
    
    if(theme !== null) {
       this.raindropMesh.material.blending = THREE.AdditiveBlending;
    }
  }

  /**
   * Initializes the positions and properties for each particle.
   * Assigns random positions, fall speeds, and visibility states to each
   * particle instance.
   */
  initializeParticles() {
    const dummy = new THREE.Object3D();
    
    // Find initial camera coordinates if available to center the rain immediately around the cockpit
    const camPos = new THREE.Vector3(0, 1.6, 0);
    if (typeof window !== 'undefined' && window.xrblocks && window.xrblocks.core && window.xrblocks.core.camera) {
      window.xrblocks.core.camera.getWorldPosition(camPos);
    }

    for (let i = 0; i < this.particleCount; i++) {
      // Assigns random initial position within the defined range centered around the camera's position.
      dummy.position.set(
        (Math.random() * this.RANGE * 2 - this.RANGE) + camPos.x,
        (Math.random() * this.RANGE * 2) + camPos.y - 1.0,
        (Math.random() * this.RANGE * 2 - this.RANGE) + camPos.z
      );

      if (DEBUG_SINGLE) {
        dummy.position.set(camPos.x, camPos.y + 1.2, camPos.z - 1.0);
      }

      // Updates the instance matrix with the dummy object's position.
      dummy.updateMatrix();
      this.raindropMesh.setMatrixAt(i, dummy.matrix);

      // Sets random fall speed and initial visibility for each particle.
      this.velocities[i] = Math.random() * 0.05 + 0.2;
      this.particleWeights[i] = 0;
      this.particleVisibility[i] = 1;
    }
  }

  /**
   * Updates particle positions and visibility on each frame.
   * Adjusts particle weights, visibility, and repositions particles as they
   * "fall."
   */
  update(camera, xrDepth) {
    if (!this.raindropMesh) return;
    const depthMesh = xrDepth ? xrDepth.depthMesh : null;

    const dummy = new THREE.Object3D();
    const particleWeightsAttribute =
      this.raindropMesh.geometry.attributes.aWeight;
    const particleVisibilityAttribute =
      this.raindropMesh.geometry.attributes.aVisibility;

    // Compute the camera's rotation excluding Y-axis rotation (yaw)
    const cameraEuler = new THREE.Euler().setFromQuaternion(
      camera.quaternion,
      'YXZ'
    );
    const cameraEulerNoYaw = new THREE.Euler(
      cameraEuler.x, // pitch
      0, // yaw
      cameraEuler.z, // roll
      'YXZ'
    );
    const cameraRotationMatrix = new THREE.Matrix4().makeRotationFromEuler(
      cameraEulerNoYaw
    );
    const inverseCameraRotationMatrix = cameraRotationMatrix.clone().invert();

    // Update the uniform with the inverse rotation matrix
    this.raindropMesh.material.uniforms.uCameraRotationMatrix.value.copy(
      inverseCameraRotationMatrix
    );

    // Grab the camera's true world-space position to handle any nested camera rigging or cockpit positioning offsets
    const cameraWorldPos = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPos);

    for (let i = 0; i < this.raindropMesh.count; ++i) {
      // Gets the current transformation matrix of the particle instance.
      this.raindropMesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      // Proceeds the raindrop.
      const ascendVal = this.raindropMesh.material.uniforms.uAscend.value;
      if (this.particleWeights[i] < 0.5) {
        if (ascendVal > 0.0) {
           dummy.position.y += this.velocities[i] * ascendVal;
        } else {
           dummy.position.y -= this.velocities[i];
        }
      }

      // Compute camera space transform to check viewing limits directly in linear units (meters)
      const pointInCameraSpace = dummy.position
        .clone()
        .applyMatrix4(camera.matrixWorldInverse);
      const distanceToCameraPlane = -pointInCameraSpace.z;

      // Computes screen position and depth for visibility checks.
      const screenPos = dummy.position.clone().project(camera);

      // WebGL/Three.js projection check. Safely fallback to true if screen coordinate matrices are still initializing
      let isWithinFoV = true;
      if (!isNaN(screenPos.x) && !isNaN(screenPos.y)) {
        isWithinFoV =
          distanceToCameraPlane > -0.1 && // Allow slight behind camera
          distanceToCameraPlane < 60.0 && // Within maximum rain render distance
          screenPos.x >= -3.0 &&
          screenPos.x <= 3.0 &&
          screenPos.y >= -3.0 &&
          screenPos.y <= 3.0;
      }

      let isOccluded = false;
      let maxVisibility = 1.0;
      let deltaDepth = 0.0;

      const isHigh = dummy.position.y > (cameraWorldPos.y + 1.5);

      if (isWithinFoV && xrDepth && depthMesh) {
        // Prevent out-of-bounds depth read
        let uvX = (screenPos.x + 1) / 2;
        let uvY = (screenPos.y + 1) / 2;
        if (uvX >= 0.0 && uvX <= 1.0 && uvY >= 0.0 && uvY <= 1.0) {
          const depth = xrDepth.getDepth(uvX, uvY);
          
          if (depth > 0) {
            isOccluded = depth < distanceToCameraPlane;
            deltaDepth = Math.abs(distanceToCameraPlane - depth);

            if (
              this.particleWeights[i] == 0 &&
              this.particleVisibility[i] > 0.5 &&
              isOccluded &&
              !isHigh
            ) {
              this.particleWeights[i] = 1;

              if (depth < 0.3) {
                maxVisibility = 0.0;
              } else if (depth > 2.0) {
                maxVisibility *= 0.5 + (4.0 - depth) / 4.0;
              }
            }
          }
        }
      }

      if (isWithinFoV) {
        this.particleVisibility[i] =
          isOccluded && !isHigh
            ? clamp(0.6 - deltaDepth, 0.0, 0.6)
            : maxVisibility;
      } else {
        this.particleVisibility[i] = 0.0;
      }

      let doHit = false;
      if (ascendVal > 0.0) {
         if (dummy.position.y > (cameraWorldPos.y + 4.0)) {
            dummy.position.y = cameraWorldPos.y + 4.0;
            doHit = true;
         }
      } else {
         if (dummy.position.y < 0) {
            dummy.position.y = 0;
            doHit = true;
         }
      }

      if (doHit) {
        if (this.particleWeights[i] < 0.5) {
          this.particleWeights[i] = 1;
        }

        this.particleVisibility[i] =
          isOccluded && !isHigh ? 0.0 : maxVisibility;
      }

      if (this.particleWeights[i] > 0) {
        this.particleWeights[i] += 1;
      }

      // Remove fragile Global minimum test that made rain invisible
      // if (depthMesh && depthMesh.minDepth !== undefined && depthMesh.minDepth < 0.1) {
      //   this.particleVisibility[i] = 0.0;
      // }

      if (this.particleWeights[i] > kMaxAnimationFrames * kAnimationSpeed) {
        this.respawnPrticle(dummy, i, camera, depthMesh);
      }

      // Updates weight attribute for the shader.
      particleVisibilityAttribute.setX(i, this.particleVisibility[i]);
      particleWeightsAttribute.setX(i, this.particleWeights[i]);
      dummy.updateMatrix();
      this.raindropMesh.setMatrixAt(i, dummy.matrix);
    }

    // Marks mesh attributes for update and updates camera position uniform.
    this.raindropMesh.instanceMatrix.needsUpdate = true;
    particleWeightsAttribute.needsUpdate = true;
    particleVisibilityAttribute.needsUpdate = true;
    this.raindropMesh.material.uniforms.uCameraPosition.value.copy(cameraWorldPos);
  }

  /**
   * Resets a particle's position and animation weight upon reaching the ground.
   */
  respawnPrticle(dummy, index, camera, depthMesh) {
    let u = Math.random();
    let v = Math.random();
    const half = Math.random();
    let vertex;
    let inited = false;
    let threshold = 0.1;

    if (depthMesh && Math.random() < threshold) {
      u = u * 0.8 + 0.1;
      v = v * 0.8 + 0.1;
      this.raycaster.setFromCamera(
        {x: u * 2.0 - 1.0, y: v * 2.0 - 1.0},
        camera
      );
      const intersections = this.raycaster.intersectObject(depthMesh);
      if (intersections.length > 0) {
        vertex = intersections[0].point;
        inited = true;
      }
    }

    if (!inited) {
      const theta = u * 2 * Math.PI;
      let radius = Math.sqrt(v) * this.RANGE + 0.2;
      if (half < 0.5) {
        radius = Math.sqrt(v) * 0.7 + 0.3;
      } else if (half < 0.7) {
        radius = Math.sqrt(v) * 1.5 + 0.3;
      }

      // Capture current camera world coordinates
      const camWorldPos = new THREE.Vector3();
      if (camera) {
        camera.getWorldPosition(camWorldPos);
      }
      const camX = camera ? camWorldPos.x : 0;
      const camY = camera ? camWorldPos.y : 1.6;
      const camZ = camera ? camWorldPos.z : 0;

      let ascendVal = 0.0;
      if (this.raindropMesh && this.raindropMesh.material.uniforms) {
         ascendVal = this.raindropMesh.material.uniforms.uAscend.value;
      }
      
      let spawnY = Math.max(camY + 3.0, 4.0);
      if (ascendVal > 0.0) {
         spawnY = Math.max(camY - 3.0, 0.0);
      }

      vertex = {
        x: radius * Math.cos(theta) + camX,
        z: radius * Math.sin(theta) + camZ,
        y: spawnY,
      };
    }

    vertex = DEBUG_SINGLE ? new THREE.Vector3(-1, 4, -1) : vertex;

    dummy.position.set(vertex.x, vertex.y, vertex.z);
    dummy.rotation.set(0, 0, 0);
    this.particleWeights[index] = inited ? 1.0 : 0.0;
  }
}
