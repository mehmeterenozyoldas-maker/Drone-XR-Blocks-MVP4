import * as THREE from "three";

export class VRWorldManager {
  constructor(scene, synth) {
    this.scene = scene;
    this.app = scene;
    this.synth = synth;
    this.activeWorld = null;

    // Skybox with custom starry shader
    const skyboxVertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const skyboxFragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      uniform float opacity;
      uniform float time;
      varying vec3 vWorldPosition;

      // Basic noise for stars
      float hash(vec3 p) {
          p = fract(p * 0.3183099 + .1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 col = mix(bottomColor, topColor, max(pow(max(h + 0.1, 0.0), exponent), 0.0));
        
        // Stars
        vec3 dir = normalize(vWorldPosition);
        float starVal = hash(dir * 150.0);
        float starIntensity = step(0.995, starVal) * (0.3 + 0.7 * sin(time * 2.0 + starVal * 10.0));
        col += vec3(starIntensity);
        
        gl_FragColor = vec4(col, opacity);
      }
    `;

    this.skyboxGeo = new THREE.SphereGeometry(200, 60, 40);
    this.skyboxMat = new THREE.ShaderMaterial({
      vertexShader: skyboxVertexShader,
      fragmentShader: skyboxFragmentShader,
      uniforms: {
        topColor: { value: new THREE.Color(0x050510) },
        bottomColor: { value: new THREE.Color(0x000000) },
        exponent: { value: 0.6 },
        opacity: { value: 0 },
        time: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide
    });
    this.skybox = new THREE.Mesh(this.skyboxGeo, this.skyboxMat);
    this.skybox.visible = false;
    this.scene.add(this.skybox);

    // Initial Fog setup
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0);

    this.greekGroup = new THREE.Group();
    this.greekGroup.visible = false;
    this.scene.add(this.greekGroup);
    this.buildGreekWorld();

    this.templeGroup = new THREE.Group();
    this.templeGroup.visible = false;
    this.scene.add(this.templeGroup);
    this.buildTempleWorld();

    // Portals will be created after loading
    this.portals = [];
    
    this.escapeButton = null;
    this.createEscapeUI();

    this.initLoadingManager();
  }

  initLoadingManager() {
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        console.log(`Loading VR Assets: ${itemsLoaded} / ${itemsTotal}`);
    };
    
    this.loadingManager.onLoad = () => {
        console.log('VR World Assets fully loaded.');
        this.createPortal("greek", new THREE.Vector3(-3, 1.5, -4), 0xff4400, "Greek Techno");
        this.createPortal("temple", new THREE.Vector3(3, 1.5, -4), 0x00ffff, "Holy Temple");
    };

    // Simulate loading external assets (PBR textures, models)
    const textureLoader = new THREE.TextureLoader(this.loadingManager);
    
    // Provide a valid dummy data URI for a tiny 1x1 black texture so it triggers loading manager without hitting network
    const dummyTex = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    
    textureLoader.load(dummyTex);
    textureLoader.load(dummyTex);
  }

  buildGreekWorld() {
    this.greekPillars = [];
    this.waypoints = this.waypoints || [];
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.8,
      metalness: 0.1
    });

    const baseGeo = new THREE.BoxGeometry(2, 0.5, 2);
    const capitalGeo = new THREE.BoxGeometry(2.2, 0.4, 2.2);

    for (let i = 0; i < 12; i++) {
        const pillarGroup = new THREE.Group();
        
        // Central column
        const columnGeo = new THREE.CylinderGeometry(0.7, 0.7, 20, 32);
        const column = new THREE.Mesh(columnGeo, pillarMat);
        column.castShadow = true;
        column.receiveShadow = true;
        pillarGroup.add(column);

        // Flutes (small engraved cylinders)
        for(let f=0; f<8; f++) {
          const fluteAngle = (f / 8) * Math.PI * 2;
          const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 20, 8), pillarMat);
          flute.castShadow = true;
          flute.receiveShadow = true;
          flute.position.set(Math.cos(fluteAngle) * 0.7, 0, Math.sin(fluteAngle) * 0.7);
          pillarGroup.add(flute);
        }

        // Base & Capital
        const base = new THREE.Mesh(baseGeo, pillarMat);
        base.castShadow = true;
        base.receiveShadow = true;
        base.position.y = -10;
        const capital = new THREE.Mesh(capitalGeo, pillarMat);
        capital.castShadow = true;
        capital.receiveShadow = true;
        capital.position.y = 10;
        pillarGroup.add(base);
        pillarGroup.add(capital);

        // Glowing Vines
        const curvePoints = [];
        for (let t = -10; t <= 10; t += 0.5) {
            const r = 0.85 + Math.random() * 0.1;
            curvePoints.push(new THREE.Vector3(
                Math.cos(t * 2) * r,
                t,
                Math.sin(t * 2) * r
            ));
        }
        const vineCurve = new THREE.CatmullRomCurve3(curvePoints);
        const vineGeo = new THREE.TubeGeometry(vineCurve, 64, 0.05, 8, false);
        const vineMat = new THREE.MeshStandardMaterial({
             color: 0x00ff77, emissive: 0x00ff77, emissiveIntensity: 0.8
        });
        const vine = new THREE.Mesh(vineGeo, vineMat);
        pillarGroup.add(vine);

        let angle = (i / 12) * Math.PI * 2;
        pillarGroup.position.set(Math.cos(angle) * 15, 10, Math.sin(angle) * 15);
        this.greekGroup.add(pillarGroup);
        this.greekPillars.push(pillarGroup);
        
        // Add a waypoint near some pillars
        if (i % 3 === 0) {
            this.createWaypoint(
                new THREE.Vector3(Math.cos(angle) * 12, 5, Math.sin(angle) * 12),
                0xff4400,
                this.greekGroup,
                'greek',
                'drop_bass'
            );
        }
    }

    // Floor
    let floorGeo = new THREE.PlaneGeometry(100, 100);
    let floorMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a, 
        roughness: 0.9, 
        metalness: 0.1,
    });
    let floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    this.greekGroup.add(floor);

    let grid = new THREE.GridHelper(100, 100, 0xff4400, 0x441100);
    grid.position.y = 0.05;
    this.greekGroup.add(grid);

    // Greek Lights
    const ambient = new THREE.AmbientLight(0xffaa55, 0.4);
    this.greekGroup.add(ambient);
    const pointLight = new THREE.PointLight(0xff4400, 2, 50);
    pointLight.position.set(0, 15, 0);
    pointLight.castShadow = true;
    this.greekGroup.add(pointLight);

    const spotLight = new THREE.SpotLight(0xff6600, 4, 80, Math.PI / 3, 0.5, 1);
    spotLight.position.set(0, 30, 0);
    spotLight.target.position.set(0, 0, 0);
    spotLight.castShadow = true;
    this.greekGroup.add(spotLight);
    this.greekGroup.add(spotLight.target);
  }

  buildTempleWorld() {
    this.templeArchPositions = [];
    this.waypoints = this.waypoints || [];
    
    const archMat = new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const runeMat = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 1.5
    });

    for (let i = 0; i < 15; i++) {
        const archGroup = new THREE.Group();

        // Main Arch
        let archGeo = new THREE.TorusGeometry(8, 0.8, 32, 100, Math.PI);
        let arch = new THREE.Mesh(archGeo, archMat);
        arch.castShadow = true;
        arch.receiveShadow = true;
        archGroup.add(arch);

        // Inner glowing ring
        let innerGeo = new THREE.TorusGeometry(7, 0.1, 16, 100, Math.PI);
        let innerArch = new THREE.Mesh(innerGeo, runeMat);
        archGroup.add(innerArch);

        // floating runes (octahedrons)
        for (let r = 0; r < 5; r++) {
             const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), runeMat);
             const rAngle = (r / 5) * Math.PI;
             rune.position.set(Math.cos(rAngle)*9, Math.sin(rAngle)*9, 0);
             archGroup.add(rune);
        }

        let archPos = new THREE.Vector3(0, 0, -i * 12 + 10);
        archGroup.position.copy(archPos);
        this.templeArchPositions.push(archPos);
        this.templeGroup.add(archGroup);

        // Add a waypoint to some of the arches
        if (i % 4 === 2) {
             this.createWaypoint(
                 new THREE.Vector3(0, 4, archPos.z), 
                 0x00ffff, 
                 this.templeGroup, 
                 'temple', 
                 'add_arps'
             );
        }
    }

    // Reflective Obsidian Floor
    let floorGeo = new THREE.PlaneGeometry(100, 300);
    let floorMat = new THREE.MeshPhysicalMaterial({
        color: 0x050510,
        metalness: 0.9,
        roughness: 0.05,
        clearcoat: 1.0
    });
    let floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -50;
    this.templeGroup.add(floor);

    // Ambient light spheres
    for (let i = 0; i < 60; i++) {
        let sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 16),
            runeMat
        );
        sphere.position.set((Math.random() - 0.5) * 50, Math.random() * 20 + 2, (Math.random() - 0.5) * 150 - 30);
        sphere.userData.baseY = sphere.position.y;
        this.templeGroup.add(sphere);
    }

    // Temple Lights
    this.templeGroup.add(new THREE.AmbientLight(0x004455, 0.5));
    const dirLight = new THREE.DirectionalLight(0x00ffff, 1);
    dirLight.position.set(0, 50, 50);
    dirLight.castShadow = true;
    this.templeGroup.add(dirLight);

    const templePointLight = new THREE.PointLight(0x00aaff, 2, 80);
    templePointLight.position.set(0, 10, -20);
    templePointLight.castShadow = true;
    this.templeGroup.add(templePointLight);

    const templeSpotLight = new THREE.SpotLight(0x00ffff, 3, 100, Math.PI / 4, 0.8, 1);
    templeSpotLight.position.set(0, 40, -40);
    templeSpotLight.target.position.set(0, 0, -40);
    templeSpotLight.castShadow = true;
    this.templeGroup.add(templeSpotLight);
    this.templeGroup.add(templeSpotLight.target);
  }

  createWaypoint(pos, color, groupToAddTo, worldId, effect) {
      let group = new THREE.Group();
      group.position.copy(pos);
      
      let core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5, 0),
          new THREE.MeshStandardMaterial({color: color, emissive: color, emissiveIntensity: 2})
      );
      group.add(core);

      let outerRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.8, 0.05, 16, 32),
          new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.5})
      );
      group.add(outerRing);
      
      let pointLight = new THREE.PointLight(color, 2, 10);
      group.add(pointLight);

      groupToAddTo.add(group);
      
      this.waypoints.push({
          position: pos,
          group: group,
          active: true,
          worldId: worldId,
          effect: effect,
          outerRing: outerRing,
          core: core
      });
  }

  triggerWaypoint(wp) {
      wp.active = false;
      wp.group.visible = false;
      console.log('Triggered waypoint! Effect:', wp.effect);
      if (this.synth) {
          if (wp.effect === 'drop_bass') {
              this.synth.bassScale = [32.7, 36.71, 41.2, 49.0]; // Drop an octave
              if (this.synth.globalFilter) {
                  this.synth.globalFilter.frequency.setValueAtTime(300, this.synth.ctx.currentTime);
                  this.synth.globalFilter.frequency.exponentialRampToValueAtTime(3000, this.synth.ctx.currentTime + 2.0);
              }
              this.synth.glitchFactor = 0.8;
          } else if (wp.effect === 'add_arps') {
              this.synth.glitchFactor = 1.0;
              if (this.synth.globalFilter) {
                  this.synth.globalFilter.frequency.setValueAtTime(8000, this.synth.ctx.currentTime);
              }
              this.synth.bpm = 160;
          }
      }
      
      // Respawn timer
      setTimeout(() => {
          wp.active = true;
          wp.group.visible = true;
          if (this.synth) {
             // Reset slightly
             this.synth.glitchFactor = 0.0;
          }
      }, 5000);
  }

  createPortal(id, pos, color, labelText) {
     let group = new THREE.Group();
     group.position.copy(pos);
     
     const isGreek = id === "greek";
     const particleCount = isGreek ? 200 : 150;
     const geo = new THREE.BufferGeometry();
     const posArr = new Float32Array(particleCount * 3);
     const angles = new Float32Array(particleCount);
     const radii = new Float32Array(particleCount);
     const speeds = new Float32Array(particleCount);
     const yOffsets = new Float32Array(particleCount);
     
     for(let i=0; i<particleCount; i++) {
         let a = Math.random() * Math.PI * 2;
         let r = isGreek ? (Math.random() * 0.8 + 0.4) : (Math.random() * 1.5 + 0.2);
         let y = (Math.random() - 0.5) * 4;
         
         posArr[i*3] = Math.cos(a) * r;
         posArr[i*3+1] = y;
         posArr[i*3+2] = Math.sin(a) * r;
         
         angles[i] = a;
         radii[i] = r;
         speeds[i] = (Math.random() * 2 + 1) * (isGreek ? 1 : 0.5);
         yOffsets[i] = y;
     }
     
     geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
     geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
     geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
     geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
     geo.setAttribute('aYOffset', new THREE.BufferAttribute(yOffsets, 1));
     
     
     const shaderMat = new THREE.ShaderMaterial({
         uniforms: {
             time: { value: 0 },
             color: { value: new THREE.Color(color) }
         },
         vertexShader: `
             uniform float time;
             attribute float aAngle;
             attribute float aRadius;
             attribute float aSpeed;
             attribute float aYOffset;
             
             varying float vAlpha;
             
             void main() {
                 float currentAngle = aAngle + time * aSpeed;
                 // Add swirling vortex effect
                 float dynamicRadius = aRadius + sin(time * 2.0 + aYOffset) * 0.2;
                 float y = aYOffset + mod(time * aSpeed, 4.0) - 2.0;
                 
                 vec3 newPos = vec3(cos(currentAngle) * dynamicRadius, y, sin(currentAngle) * dynamicRadius);
                 
                 // calculate alpha based on Y
                 vAlpha = 1.0 - smoothstep(1.0, 2.0, abs(y));
                 
                 vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
                 
                 ${isGreek ? "gl_PointSize = abs(y) * 4.0 + 2.0;" : "gl_PointSize = 6.0;"}
                 gl_Position = projectionMatrix * mvPosition;
             }
         `,
         fragmentShader: `
             uniform vec3 color;
             varying float vAlpha;
             void main() {
                 // Circular particle
                 vec2 coord = gl_PointCoord - vec2(0.5);
                 if (length(coord) > 0.5) discard;
                 
                 gl_FragColor = vec4(color, vAlpha * 0.8);
             }
         `,
         transparent: true,
         depthWrite: false,
         blending: THREE.AdditiveBlending
     });
     
     let particles = new THREE.Points(geo, shaderMat);
     group.add(particles);
     
     this.scene.add(group);
     this.portals.push({id, pos, group, color, particleMat: shaderMat});
  }

  createEscapeUI() {
    const btn = document.createElement("button");
    btn.innerText = "EXIT VR (RETURN TO AR)";
    btn.style.position = "fixed";
    btn.style.bottom = "30px";
    btn.style.left = "50%";
    btn.style.transform = "translateX(-50%)";
    btn.style.padding = "16px 32px";
    btn.style.background = "rgba(0, 255, 200, 0.2)";
    btn.style.color = "#00ffc8";
    btn.style.border = "1px solid #00ffc8";
    btn.style.borderRadius = "8px";
    btn.style.fontFamily = "monospace";
    btn.style.fontWeight = "bold";
    btn.style.zIndex = "99999";
    btn.style.display = "none";
    btn.style.backdropFilter = "blur(10px)";
    btn.style.cursor = "pointer";
    btn.onclick = () => this.exitWorld();
    document.body.appendChild(btn);
    this.escapeButton = btn;
  }

  checkIntersections(dronePos, velocity) {
     if (!this.activeWorld) {
       for(let portal of this.portals) {
         // Check if drone intersects the portal ring
         if (portal.pos.distanceTo(dronePos) < 1.2) {
            this.enterWorld(portal.id);
         }
       }
       return;
     }

     // Collision & Waypoint logic for active worlds
     if (this.activeWorld === 'greek') {
         // Check pillars (Cylinder collisions)
         for (let pillar of this.greekPillars) {
             let dx = dronePos.x - pillar.position.x;
             let dz = dronePos.z - pillar.position.z;
             let distSq = dx*dx + dz*dz;
             let radiusSq = 2.0 * 2.0; // Drone ~0.5m radius + Pillar ~1.5m
             if (distSq < radiusSq) {
                 // Push out
                 let dist = Math.sqrt(distSq);
                 let pushDist = 2.0 - dist;
                 let pushX = (dx / dist) * pushDist;
                 let pushZ = (dz / dist) * pushDist;
                 dronePos.x += pushX;
                 dronePos.z += pushZ;
                 if (velocity) {
                     velocity.x *= -0.5;
                     velocity.z *= -0.5;
                 }
             }
         }
         // Greek world waypoints
         for (let wp of this.waypoints) {
             if (wp.active && wp.group.visible && wp.position.distanceTo(dronePos) < 1.5) {
                 this.triggerWaypoint(wp);
             }
         }
     } else if (this.activeWorld === 'temple') {
         // Arch colliders (simple AABB or spheres around arch bases)
         for (let archPos of this.templeArchPositions) {
             // The arches are primarily on left/right edges of z-axis
             let dx = dronePos.x - archPos.x;
             let dz = dronePos.z - archPos.z;
             let distSq = dx*dx + dz*dz;
             if (distSq < 16.0) { // Near an arch
                 // Specifically check the torus volume (approximation)
                 let dy = dronePos.y - archPos.y;
                 let distFromCenter = Math.sqrt(dx*dx + dy*dy);
                 if (Math.abs(distFromCenter - 8.0) < 1.5 && Math.abs(dz) < 1.0) {
                     // hit the arch ring!
                     dronePos.z += Math.sign(dz) * (1.0 - Math.abs(dz));
                     if (velocity) velocity.z *= -0.5;
                 }
             }
         }
         for (let wp of this.waypoints) {
             if (wp.active && wp.group.visible && wp.position.distanceTo(dronePos) < 1.5) {
                 this.triggerWaypoint(wp);
             }
         }
     }
  }

  enterWorld(id) {
     this.activeWorld = id;
     this.skybox.visible = true;
     this.skybox.material.uniforms.opacity.value = 1.0;
     this.escapeButton.style.display = "block";
     
     for(let p of this.portals) p.group.visible = false;

     if(this.synth) {
       this.synth.soundMode = id; // Set active world sound mode
       this.synth.glitchFactor = 0.5; // increase intensity
     }

     if (id === "greek") {
        this.greekGroup.visible = true;
        this.skybox.material.uniforms.bottomColor.value.setHex(0x1a0500);
        this.skybox.material.uniforms.topColor.value.setHex(0x0a0000);
        this.scene.fog.color.setHex(0x1a0500);
        this.scene.fog.density = 0.02;
        
        if (this.app && this.app.droneLED_Orange && this.app.droneLED_Green) {
           this.app.droneLED_Orange.color.setHex(0xff0000);
           this.app.droneLED_Orange.emissive.setHex(0xff0000);
           this.app.droneLED_Green.color.setHex(0xff5500);
           this.app.droneLED_Green.emissive.setHex(0xff5500);
        }
        
        if (this.app && this.app.rainParticles) {
           this.app.rainParticles.setTheme('greek');
        }
        
        if (this.app && this.app.cloud) {
           this.app.cloud.mesh.material.uniforms.base.value.setHex(0xaa0000); // Blood red
        }
        
        // Shift synth to Phrygian / Heavy Bass
        if(this.synth) {
           this.synth.bpm = 132;
           this.synth.bassScale = [65.41, 69.30, 77.78, 87.31, 98.0];
           if(this.synth.globalFilter) this.synth.globalFilter.frequency.value = 1200;
        }
     } else {
        this.templeGroup.visible = true;
        this.skybox.material.uniforms.bottomColor.value.setHex(0x00111a);
        this.skybox.material.uniforms.topColor.value.setHex(0x050510);
        this.scene.fog.color.setHex(0x00111a);
        this.scene.fog.density = 0.015;
        
        if (this.app && this.app.droneLED_Orange && this.app.droneLED_Green) {
           this.app.droneLED_Orange.color.setHex(0x00ffff);
           this.app.droneLED_Orange.emissive.setHex(0x00ffff);
           this.app.droneLED_Green.color.setHex(0x0088ff);
           this.app.droneLED_Green.emissive.setHex(0x0088ff);
        }
        
        if (this.app && this.app.rainParticles) {
           this.app.rainParticles.setTheme('temple');
        }
        
        if (this.app && this.app.cloud) {
           this.app.cloud.mesh.material.uniforms.base.value.setHex(0x4b0082); // Deep purple
        }
        
        // Shift synth to Ethereal / High BPM Arps
        if(this.synth) {
           this.synth.bpm = 145;
           this.synth.bassScale = [65.41, 73.42, 82.41, 98.0, 110.0];
           if(this.synth.globalFilter) this.synth.globalFilter.frequency.value = 3000;
        }
     }
  }

  exitWorld() {
     this.activeWorld = null;
     this.skybox.visible = false;
     this.scene.fog.density = 0.0;
     this.greekGroup.visible = false;
     this.templeGroup.visible = false;
     this.escapeButton.style.display = "none";
     for(let p of this.portals) p.group.visible = true;
     
     if (this.app && this.app.droneLED_Orange && this.app.droneLED_Green) {
        this.app.droneLED_Orange.color.setHex(0xff3b00);
        this.app.droneLED_Orange.emissive.setHex(0xff3b00);
        this.app.droneLED_Green.color.setHex(0x39ff14);
        this.app.droneLED_Green.emissive.setHex(0x39ff14);
     }
     
     if (this.app && this.app.rainParticles) {
        this.app.rainParticles.setTheme(null);
     }
     
     if (this.app && this.app.cloud) {
        this.app.cloud.mesh.material.uniforms.base.value.setHex(0x4f5c6e); // Default color
     }
     
     // Reset Synth
     if(this.synth) {
         this.synth.soundMode = "xr"; // Reset to default XR mode
         this.synth.bpm = 110;
         this.synth.bassScale = [65.41, 77.78, 87.31, 98.0, 116.54];
         this.synth.glitchFactor = 0.0;
         if(this.synth.globalFilter) this.synth.globalFilter.frequency.value = 20000;
     }
  }

  update(time) {
     if (this.skybox && this.skybox.material.uniforms) {
       this.skybox.material.uniforms.time.value = time;
     }
     for(let p of this.portals) {
        p.group.rotation.y = time * 0.8;
     }
     if(this.activeWorld === "temple") {
        this.templeGroup.children.forEach((c, i) => {
           if(c.geometry && c.geometry.type === 'SphereGeometry') {
              c.position.y = c.userData.baseY + Math.sin(time * 2 + i) * 0.5;
           }
        });
     }
  }
}
