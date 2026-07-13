import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, createXRStore, useXR } from '@react-three/xr';
import { Physics, RigidBody } from '@react-three/rapier';
import { Sky, Environment, Text, ContactShadows, useCursor, Stars, Sparkles, Float, Billboard } from '@react-three/drei';
import type { RapierRigidBody } from '@react-three/rapier';
import SciFiTerrain from './Terrain';
import * as THREE from 'three';

// Configure XR Store for the application
const store = createXRStore();

// Simple singleton for drone audio synthesis
class DroneAudioEngine {
  ctx: AudioContext | null = null;
  humOsc: OscillatorNode | null = null;
  humGain: GainNode | null = null;
  windGain: GainNode | null = null;
  klaxonOsc: OscillatorNode | null = null;
  klaxonGain: GainNode | null = null;
  
  init() {
    if (this.ctx) return; // already initialized
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    
    // Thruster Hum
    this.humOsc = this.ctx.createOscillator();
    this.humGain = this.ctx.createGain();
    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.value = 100;
    this.humGain.gain.value = 0;
    
    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 800;

    this.humOsc.connect(humFilter);
    humFilter.connect(this.humGain);
    this.humGain.connect(this.ctx.destination);
    this.humOsc.start();
    
    // Wind Noise (White Noise Buffer)
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = buffer;
    windNoise.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    windNoise.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    windNoise.start();
    
    // Battery Klaxon
    this.klaxonOsc = this.ctx.createOscillator();
    this.klaxonGain = this.ctx.createGain();
    this.klaxonOsc.type = 'square';
    this.klaxonOsc.frequency.value = 600;
    this.klaxonGain.gain.value = 0;
    this.klaxonOsc.connect(this.klaxonGain);
    this.klaxonGain.connect(this.ctx.destination);
    this.klaxonOsc.start();
  }

  update(speed: number, battery: number, isDepleted: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    if (isDepleted) {
      this.humGain?.gain.setTargetAtTime(0, t, 0.1);
      this.windGain?.gain.setTargetAtTime(0, t, 0.1);
      this.klaxonGain?.gain.setTargetAtTime(0, t, 0.1);
      return;
    }

    // Thruster pitch/volume
    if (this.humOsc && this.humGain) {
      this.humOsc.frequency.setTargetAtTime(100 + speed * 15, t, 0.1);
      this.humGain.gain.setTargetAtTime(0.05 + Math.min(speed * 0.015, 0.15), t, 0.1);
    }
    
    // Wind noise
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(Math.min(speed * 0.01, 0.2), t, 0.2);
    }
    
    // Klaxon (pulsing if battery < 20)
    if (this.klaxonGain) {
      if (battery < 20) {
        const isPulse = Math.floor(t * 5) % 2 === 0;
        this.klaxonGain.gain.setTargetAtTime(isPulse ? 0.05 : 0, t, 0.02);
      } else {
        this.klaxonGain.gain.setTargetAtTime(0, t, 0.1);
      }
    }
  }
}

const droneAudio = new DroneAudioEngine();

// Custom falling neon rain particles component
function FallingRain({ count = 1200 }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30; // X
      pos[i * 3 + 1] = Math.random() * 15;      // Y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30; // Z
      vel[i] = 3.0 + Math.random() * 5.0;       // Speed falling down
    }
    return [pos, vel];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    if (!posAttr) return;

    const actualDelta = Math.min(delta, 0.1); // Cap delta to prevent teleports
    for (let i = 0; i < count; i++) {
      let y = posAttr.getY(i);
      y -= velocities[i] * actualDelta;
      if (y < -1) {
        y = 15 + Math.random() * 5;
        posAttr.setX(i, (Math.random() - 0.5) * 30);
        posAttr.setZ(i, (Math.random() - 0.5) * 30);
      }
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00f3ff"
        size={0.08}
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function RainEffect() {
  const mode = useXR((state) => state.mode);
  
  // Rain is enabled ONLY in XR/AR mode (immersive-ar). Completely disabled in Portal (immersive-vr)
  if (mode !== 'immersive-ar') return null;

  return <FallingRain count={1500} />;
}

function ModeSwitcher() {
  const mode = useXR((state) => state.mode);
  const inputSourceStates = useXR((state) => state.inputSourceStates);
  const lastState = useRef<Record<string, string>>({});

  const toggleMode = async () => {
    const session = store.getState().session;
    if (session) {
      try {
        await session.end();
      } catch (e) {
        console.error("Error ending session:", e);
      }
      
      setTimeout(() => {
        if (mode === 'immersive-ar') {
          store.enterVR();
        } else if (mode === 'immersive-vr') {
          store.enterAR();
        }
      }, 400); 
    }
  };

  useFrame(() => {
    for (const state of inputSourceStates) {
      if (state.type === 'controller' && state.gamepad) {
        const handedness = state.inputSource.handedness;
        const trigger = state.gamepad['trigger']?.state;
        const aButton = state.gamepad['a-button']?.state;
        const xButton = state.gamepad['x-button']?.state;

        const checkButton = (btnName: string, stateValue: string | undefined) => {
          const key = `${handedness}-${btnName}`;
          if (stateValue === 'pressed' && lastState.current[key] !== 'pressed') {
            toggleMode();
          }
          lastState.current[key] = stateValue || 'default';
        };

        checkButton('trigger', trigger);
        checkButton('a-button', aButton);
        checkButton('x-button', xButton);
      }
    }
  });

  return null;
}

function InteractiveBox({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  const [hovered, setHover] = useState(false);
  const bodyRef = useRef<RapierRigidBody>(null!);
  useCursor(hovered);

  const handleInteract = () => {
    bodyRef.current?.applyImpulse({ x: (Math.random() - 0.5) * 3, y: 6 * scale, z: (Math.random() - 0.5) * 3 }, true);
    bodyRef.current?.applyTorqueImpulse({ x: Math.random() * 2, y: Math.random() * 2, z: Math.random() * 2 }, true);
  };

  return (
    <RigidBody ref={bodyRef} colliders="cuboid" position={position} restitution={0.8}>
      <mesh
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onPointerDown={handleInteract}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.4 * scale, 0.4 * scale, 0.4 * scale]} />
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : color} 
          roughness={0.1} 
          metalness={0.8} 
          emissive={color}
          emissiveIntensity={hovered ? 0.9 : 0.2}
        />
      </mesh>
    </RigidBody>
  );
}

function FloatingMonolith({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.5}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 6, 1]} />
          <meshStandardMaterial color="#111111" roughness={0.2} metalness={0.9} />
          {/* Glowing neon edge */}
          <mesh position={[0, 0, 0.51]}>
            <planeGeometry args={[0.1, 5]} />
            <meshBasicMaterial color="#00ffc8" />
          </mesh>
        </mesh>
      </Float>
    </RigidBody>
  );
}

import { useMissionStore } from '../store/missionStore';

function HUDOverlay() {
  const { gl, camera } = useThree();
  const hudRef = useRef<THREE.Group>(null!);
  
  const textAltitudeRef = useRef<any>(null!);
  const textBatteryRef = useRef<any>(null!);
  const barBatteryRef = useRef<THREE.Mesh>(null!);
  const barBatteryMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const threatMatRef = useRef<THREE.MeshBasicMaterial>(null!);
  const altIndicatorRef = useRef<THREE.Mesh>(null!);
  
  const batteryRef = useRef(100);
  
  const lastVelocityRef = useRef(new THREE.Vector3());
  const lastPositionRef = useRef(new THREE.Vector3());
  const textGForceRef = useRef<any>(null!);
  
  const horizonRef = useRef<THREE.Group>(null!);
  const radarBlipsRef = useRef<THREE.Group>(null!);
  const waypointsData = useMissionStore(s => s.waypoints);

  const { showGForce, addLog, addDistance, updateMaxSpeed, addFlightTime, setBatteryDepleted, batteryDepleted } = useMissionStore();

  const loggedBatteryLow = useRef(false);
  const loggedProximity = useRef(0);

  useFrame((state, delta) => {
    if (hudRef.current) {
      // Use WebXR camera if presenting, otherwise use standard camera
      const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
      hudRef.current.position.copy(activeCamera.position);
      hudRef.current.quaternion.copy(activeCamera.quaternion);

      // --- Altitude Gauge ---
      const alt = Math.max(0, activeCamera.position.y);
      if (textAltitudeRef.current) {
        textAltitudeRef.current.text = `ALT\n${alt.toFixed(1)}m`;
      }
      if (altIndicatorRef.current) {
        // Map altitude 0-5m to gauge -0.1 to 0.1
        const mappedY = THREE.MathUtils.clamp((alt / 5.0) * 0.2 - 0.1, -0.1, 0.1);
        altIndicatorRef.current.position.y = mappedY;
      }

      if (!batteryDepleted) {
        addFlightTime(delta);
        
        // --- Battery Status ---
        batteryRef.current = Math.max(0, batteryRef.current - delta * 1.5); // Deplete 1.5% per second
        
        if (batteryRef.current <= 0) {
          setBatteryDepleted(true);
          addLog("SYSTEM FAILURE: Battery depleted.");
        } else if (batteryRef.current < 20 && !loggedBatteryLow.current) {
          loggedBatteryLow.current = true;
          addLog("WARNING: Low battery power detected.");
        }
      }

      if (textBatteryRef.current) {
        textBatteryRef.current.text = `PWR: ${batteryRef.current.toFixed(0)}%`;
      }

      if (barBatteryRef.current) {
        // Bar is 0.1 wide. scale x based on battery percentage.
        const scaleX = batteryRef.current / 100;
        barBatteryRef.current.scale.x = scaleX;
        // Position it so it shrinks towards the left
        barBatteryRef.current.position.x = 0.15 - (0.1 * (1 - scaleX)) / 2;
      }

      if (barBatteryMatRef.current) {
        if (batteryRef.current < 20) {
          // Blink red
          const isBlink = Math.floor(state.clock.elapsedTime * 5) % 2 === 0;
          barBatteryMatRef.current.color.setHex(isBlink ? 0xff0044 : 0x550000);
        } else {
          barBatteryMatRef.current.color.setHex(0x00ffc8); // normal green
        }
      }

      // --- Threat Proximity Indicator ---
      // Simulate proximity based on altitude (closer to ground = higher threat)
      let threatLevel = 0; // 0 (safe) to 1 (danger)
      if (alt < 1.0) {
        threatLevel = 1.0 - alt; // danger increases as we approach 0
      } else {
        // Also add some oscillation based on time to simulate scanning
        threatLevel = (Math.sin(state.clock.elapsedTime * 2) * 0.5 + 0.5) * 0.2; 
      }
      
      if (threatLevel > 0.8 && state.clock.elapsedTime - loggedProximity.current > 5) {
        loggedProximity.current = state.clock.elapsedTime;
        addLog(`CRITICAL: Proximity alert triggered. Altitude: ${alt.toFixed(1)}m`);
      }
      
      // Interpolate color from green to red
      if (threatMatRef.current) {
        const colorSafe = new THREE.Color(0x00ffc8);
        const colorDanger = new THREE.Color(0xff0044);
        threatMatRef.current.color.lerpColors(colorSafe, colorDanger, threatLevel);
      }

      // --- G-Force & Stats ---
      if (delta > 0 && delta < 0.1 && !batteryDepleted) { // Avoid huge spikes on lag
        const currentPos = activeCamera.position;
        // Velocity = change in position / time
        const currentVel = new THREE.Vector3().subVectors(currentPos, lastPositionRef.current).divideScalar(delta);
        const speed = currentVel.length();
        updateMaxSpeed(speed);
        addDistance(speed * delta);
        
        // Acceleration = change in velocity / time
        const currentAcc = new THREE.Vector3().subVectors(currentVel, lastVelocityRef.current).divideScalar(delta);

        // Calculate local axes relative to camera
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(activeCamera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(activeCamera.quaternion);
        
        // Assume 1G = 9.81 units/s^2. Add 1.0G to vertical to account for gravity.
        const verticalG = currentAcc.dot(up) / 9.81 + 1.0;
        const lateralG = currentAcc.dot(right) / 9.81;

        if (textGForceRef.current && showGForce) {
          textGForceRef.current.text = `G-FRC\nLAT: ${lateralG.toFixed(1)}G\nVERT: ${verticalG.toFixed(1)}G`;
        } else if (textGForceRef.current && !showGForce) {
          textGForceRef.current.text = '';
        }

        // Detect high-G maneuvers to log
        if (Math.abs(verticalG) > 3.0 || Math.abs(lateralG) > 3.0) {
          // Prevent log spamming by tracking time in a ref
          // For simplicity we just add it to a local variable and only log occasionally, or use the proximity cooldown approach
          // Let's add a quick hack to only log occasionally
          if (state.clock.elapsedTime - (hudRef.current.userData.lastHighGLog || 0) > 3) {
            hudRef.current.userData.lastHighGLog = state.clock.elapsedTime;
            addLog(`High-G Maneuver: ${Math.max(Math.abs(verticalG), Math.abs(lateralG)).toFixed(1)}G`);
          }
        }

        lastVelocityRef.current.copy(currentVel);
        lastPositionRef.current.copy(currentPos);
      }
      
      const currentSpeed = lastVelocityRef.current.length();
      droneAudio.update(currentSpeed, batteryRef.current, batteryDepleted);

      // --- Artificial Horizon ---
      if (horizonRef.current) {
        // euler.x = pitch, euler.y = yaw, euler.z = roll
        const euler = new THREE.Euler().setFromQuaternion(activeCamera.quaternion, 'YXZ');
        horizonRef.current.rotation.z = -euler.z; // counter roll
        // counter pitch, limit motion so it doesn't go off screen
        horizonRef.current.position.y = Math.max(-0.15, Math.min(0.15, euler.x * 0.2)); 
      }

      // --- 3D Radar Mini-map ---
      if (radarBlipsRef.current) {
        // Drone heading (yaw)
        const droneEuler = new THREE.Euler().setFromQuaternion(activeCamera.quaternion, 'YXZ');
        const droneYaw = droneEuler.y;

        waypointsData.forEach((wp, index) => {
          const blip = radarBlipsRef.current.children[index];
          if (blip) {
            // Relative position in world space
            const dx = wp.x - activeCamera.position.x;
            const dz = wp.z - activeCamera.position.z;
            
            // Rotate around Y axis to align with drone's forward direction
            // In Three.js, positive Z is backward, so -dz is forward.
            // Using 2D rotation matrix for yaw:
            const cosY = Math.cos(droneYaw);
            const sinY = Math.sin(droneYaw);
            const localX = dx * cosY - dz * sinY;
            const localZ = dx * sinY + dz * cosY;
            
            // Map to radar scale (e.g. max range 100m maps to radius 0.05m)
            const radarScale = 0.05 / 100;
            let blipX = localX * radarScale;
            let blipY = -localZ * radarScale; // -localZ so that forward is UP on the radar

            // Clamp to radar radius
            const dist = Math.sqrt(blipX * blipX + blipY * blipY);
            if (dist > 0.05) {
               blipX = (blipX / dist) * 0.05;
               blipY = (blipY / dist) * 0.05;
            }

            blip.position.set(blipX, blipY, 0);
          }
        });
      }
    }
  });

  return (
    <group ref={hudRef}>
      {/* Positioned slightly in front of the camera */}
      <group position={[0, 0, -1]}>
        {/* Reticle Inner Ring */}
        <mesh>
          <ringGeometry args={[0.02, 0.025, 32]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.6} side={THREE.DoubleSide} depthTest={false} />
        </mesh>

        {/* Reticle Outer Dashed Ring (Approximated with a slightly larger ring) */}
        <mesh>
          <ringGeometry args={[0.04, 0.042, 32, 1, 0, Math.PI * 2]} />
          <meshBasicMaterial color="#ff0044" transparent opacity={0.3} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
        
        {/* Status text Left */}
        <Text position={[-0.2, 0.1, 0]} fontSize={0.02} color="#00ffc8" anchorX="left" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
          SYS_ONLINE
        </Text>
        <Text position={[-0.2, 0.07, 0]} fontSize={0.015} color="#00f3ff" anchorX="left" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
          TGT_LOCK: ACTIVE
        </Text>

        {/* Threat Proximity Indicator */}
        <Text position={[-0.2, 0.04, 0]} fontSize={0.012} color="#ffffff" anchorX="left" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
          PROXIMITY WRN
        </Text>
        <mesh position={[-0.16, 0.025, 0]}>
          <planeGeometry args={[0.08, 0.008]} />
          <meshBasicMaterial ref={threatMatRef} color="#00ffc8" transparent opacity={0.8} depthTest={false} />
        </mesh>

        {/* G-Force Meter */}
        <Text ref={textGForceRef} position={[-0.2, 0.0, 0]} fontSize={0.012} color="#00ffc8" anchorX="left" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
          G-FRC
        </Text>
        
        {/* Status text Right */}
        <Text position={[0.2, 0.1, 0]} fontSize={0.02} color="#00ffc8" anchorX="right" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
          DRONE_01
        </Text>
        <Text ref={textBatteryRef} position={[0.2, 0.07, 0]} fontSize={0.015} color="#00f3ff" anchorX="right" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
          PWR: 100%
        </Text>

        {/* Battery Bar Background */}
        <mesh position={[0.15, 0.05, 0]}>
           <planeGeometry args={[0.1, 0.008]} />
           <meshBasicMaterial color="#333333" transparent opacity={0.6} depthTest={false} />
        </mesh>
        {/* Battery Bar Foreground */}
        <mesh ref={barBatteryRef} position={[0.15, 0.05, 0]}>
           <planeGeometry args={[0.1, 0.008]} />
           <meshBasicMaterial ref={barBatteryMatRef} color="#00ffc8" transparent opacity={0.8} depthTest={false} />
        </mesh>

        {/* Altitude Vertical Gauge (Right Side) */}
        <group position={[0.28, 0, 0]}>
          {/* Gauge Background Line */}
          <mesh position={[0, 0, 0]}>
             <planeGeometry args={[0.005, 0.2]} />
             <meshBasicMaterial color="#333333" transparent opacity={0.6} depthTest={false} />
          </mesh>
          {/* Gauge Indicator Dash */}
          <mesh ref={altIndicatorRef} position={[0, 0, 0]}>
             <planeGeometry args={[0.015, 0.005]} />
             <meshBasicMaterial color="#00ffc8" transparent opacity={0.8} depthTest={false} />
          </mesh>
          {/* Gauge Ticks */}
          {[-0.1, -0.05, 0, 0.05, 0.1].map((y, i) => (
            <mesh key={i} position={[-0.005, y, 0]}>
               <planeGeometry args={[0.005, 0.002]} />
               <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
            </mesh>
          ))}
          <Text ref={textAltitudeRef} position={[-0.02, 0, 0]} fontSize={0.012} color="#00ffc8" anchorX="right" anchorY="middle" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
            ALT
          </Text>
        </group>
        
        {/* HUD Frame Corners */}
        {/* Top Left */}
        <mesh position={[-0.3, 0.2, 0]}>
          <planeGeometry args={[0.05, 0.005]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        <mesh position={[-0.3225, 0.1775, 0]}>
          <planeGeometry args={[0.005, 0.05]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        {/* Top Right */}
        <mesh position={[0.3, 0.2, 0]}>
          <planeGeometry args={[0.05, 0.005]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        <mesh position={[0.3225, 0.1775, 0]}>
          <planeGeometry args={[0.005, 0.05]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        {/* Bottom Left */}
        <mesh position={[-0.3, -0.2, 0]}>
          <planeGeometry args={[0.05, 0.005]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        <mesh position={[-0.3225, -0.1775, 0]}>
          <planeGeometry args={[0.005, 0.05]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        {/* Bottom Right */}
        <mesh position={[0.3, -0.2, 0]}>
          <planeGeometry args={[0.05, 0.005]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>
        <mesh position={[0.3225, -0.1775, 0]}>
          <planeGeometry args={[0.005, 0.05]} />
          <meshBasicMaterial color="#00ffc8" transparent opacity={0.4} depthTest={false} />
        </mesh>

        {/* Artificial Horizon Reticle */}
        <group ref={horizonRef}>
          {/* Left Wing */}
          <mesh position={[-0.08, 0, 0]}>
            <planeGeometry args={[0.06, 0.002]} />
            <meshBasicMaterial color="#00ffc8" transparent opacity={0.8} depthTest={false} />
          </mesh>
          <mesh position={[-0.11, -0.01, 0]}>
            <planeGeometry args={[0.002, 0.02]} />
            <meshBasicMaterial color="#00ffc8" transparent opacity={0.8} depthTest={false} />
          </mesh>
          {/* Right Wing */}
          <mesh position={[0.08, 0, 0]}>
            <planeGeometry args={[0.06, 0.002]} />
            <meshBasicMaterial color="#00ffc8" transparent opacity={0.8} depthTest={false} />
          </mesh>
          <mesh position={[0.11, -0.01, 0]}>
            <planeGeometry args={[0.002, 0.02]} />
            <meshBasicMaterial color="#00ffc8" transparent opacity={0.8} depthTest={false} />
          </mesh>
          {/* Center Dot */}
          <mesh>
            <circleGeometry args={[0.002, 8]} />
            <meshBasicMaterial color="#ff0044" transparent opacity={0.8} depthTest={false} />
          </mesh>
        </group>

        {/* 3D Radar Mini-map */}
        <group position={[-0.24, -0.14, 0]}>
          {/* Radar Background */}
          <mesh>
            <circleGeometry args={[0.05, 32]} />
            <meshBasicMaterial color="#001100" transparent opacity={0.6} depthTest={false} />
          </mesh>
          {/* Radar Rings */}
          <mesh>
            <ringGeometry args={[0.024, 0.025, 32]} />
            <meshBasicMaterial color="#00ffc8" transparent opacity={0.3} depthTest={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.049, 0.05, 32]} />
            <meshBasicMaterial color="#00ffc8" transparent opacity={0.5} depthTest={false} />
          </mesh>
          {/* Drone (Center) */}
          <mesh>
            <circleGeometry args={[0.002, 8]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} />
          </mesh>
          {/* Blips */}
          <group ref={radarBlipsRef}>
            {waypointsData.map((_, i) => (
              <mesh key={i}>
                <circleGeometry args={[0.003, 8]} />
                <meshBasicMaterial color="#00ffc8" transparent opacity={0.8} depthTest={false} />
              </mesh>
            ))}
          </group>
          <Text position={[0, -0.06, 0]} fontSize={0.01} color="#00ffc8" anchorX="center" font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff" material-depthTest={false}>
            RADAR 100M
          </Text>
        </group>
      </group>
    </group>
  );
}

function Waypoints() {
  const { gl, camera } = useThree();
  const waypointsData = useMissionStore(s => s.waypoints);
  
  // List of waypoint positions
  const waypoints = useMemo(() => waypointsData.map(w => new THREE.Vector3(w.x, w.y, w.z)), [waypointsData]);

  // Calculate distance from active camera to each waypoint
  const textRefs = useRef<any[]>([]);

  useFrame(() => {
    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    waypoints.forEach((wp, index) => {
      if (textRefs.current[index]) {
        const distance = activeCamera.position.distanceTo(wp);
        textRefs.current[index].text = `WP-0${index + 1}\n${distance.toFixed(1)}m`;
      }
    });
  });

  return (
    <>
      {waypoints.map((wp, index) => (
        <group key={index} position={wp}>
          {/* A floating diamond indicator */}
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <mesh>
              <octahedronGeometry args={[0.5, 0]} />
              <meshBasicMaterial color="#00ffc8" wireframe />
            </mesh>
            <mesh>
              <octahedronGeometry args={[0.2, 0]} />
              <meshBasicMaterial color="#00ffc8" transparent opacity={0.6} />
            </mesh>
            
            {/* The distance text always faces the camera */}
            <Billboard position={[0, 1.2, 0]}>
              <Text 
                ref={(el) => textRefs.current[index] = el}
                fontSize={0.4} 
                color="#00f3ff" 
                font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOVNp.woff"
                anchorX="center"
                anchorY="middle"
                textAlign="center"
              >
                {`WP-0${index + 1}\n---m`}
              </Text>
            </Billboard>
          </Float>
        </group>
      ))}
    </>
  );
}

// Scene rendering environment that changes based on AR or VR mode
function ImmersiveEnvironment() {
  const mode = useXR((state) => state.mode);

  // If in AR mode, we want a transparent background so the camera feed is visible
  if (mode === 'immersive-ar') {
    return (
      <Sparkles count={50} scale={15} size={1} speed={0.2} opacity={0.15} color="#00ff99" position={[0, 1.5, 0]} />
    );
  }

  // For VR mode or standard 2D screen view, show the immersive dark cosmic environment
  return (
    <>
      <color attach="background" args={['#020205']} />
      <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Sparkles count={200} scale={20} size={2} speed={0.4} opacity={0.2} color="#00ffc8" position={[0, 2, 0]} />
    </>
  );
}

function MissionUIOverlay() {
  const { showGForce, toggleGForce, logs, batteryDepleted } = useMissionStore();

  if (batteryDepleted) return null; // hide HUD during summary

  return (
    <div className="absolute top-4 left-4 z-20 w-64 pointer-events-none">
      {/* Logs */}
      <div className="bg-black/60 border border-white/10 rounded-xl p-4 backdrop-blur-md mb-4 h-48 overflow-y-auto pointer-events-auto flex flex-col-reverse shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-2">
          {logs.length === 0 ? (
            <div className="text-gray-500 font-mono text-[10px]">AWAITING TELEMETRY...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="text-neon-cyan font-mono text-[10px] opacity-80 border-l border-neon-cyan/30 pl-2">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Toggles */}
      <div className="pointer-events-auto flex gap-2">
        <button 
          onClick={toggleGForce}
          className={`flex-1 py-2 rounded-md font-mono text-[10px] tracking-wider transition-colors ${showGForce ? 'bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan' : 'bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10'}`}
        >
          {showGForce ? 'G-FORCE: ON' : 'G-FORCE: OFF'}
        </button>
      </div>
    </div>
  );
}

function MissionSummaryModal() {
  const { batteryDepleted, distanceTraveled, maxSpeed, flightTime, resetMission } = useMissionStore();

  if (!batteryDepleted) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-neon-orange/30 p-8 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(255,100,0,0.2)]">
        <h2 className="font-display font-bold text-2xl text-white mb-2 tracking-tight">Mission Terminated</h2>
        <div className="text-neon-orange font-mono text-xs tracking-widest mb-6">BATTERY DEPLETED</div>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400 font-mono text-xs">Total Flight Time</span>
            <span className="text-white font-mono">{flightTime.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400 font-mono text-xs">Distance Traveled</span>
            <span className="text-white font-mono">{distanceTraveled.toFixed(1)}m</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400 font-mono text-xs">Max Velocity</span>
            <span className="text-white font-mono">{maxSpeed.toFixed(1)}m/s</span>
          </div>
        </div>
        
        <button
          onClick={resetMission}
          className="w-full bg-white text-black py-3 rounded-xl font-bold font-display hover:bg-gray-200 transition-colors"
        >
          RESTART SIMULATION
        </button>
      </div>
    </div>
  );
}

export default function VRWorld() {
  return (
    <div className="w-full h-[600px] relative rounded-3xl overflow-hidden border border-white/10 bg-black/80 backdrop-blur-md shadow-[0_0_50px_rgba(0,255,200,0.1)]">
      <MissionUIOverlay />
      <MissionSummaryModal />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-4">
        <button
          onClick={() => { droneAudio.init(); store.enterAR(); }}
          className="bg-purple-600 text-white px-6 py-3 rounded-full font-bold font-mono tracking-widest hover:scale-105 transition-all hover:shadow-[0_0_30px_rgba(147,51,234,0.6)]"
        >
          ENTER XR (AR)
        </button>
        <button
          onClick={() => { droneAudio.init(); store.enterVR(); }}
          className="bg-neon-cyan text-black px-6 py-3 rounded-full font-bold font-mono tracking-widest hover:scale-105 transition-all hover:shadow-[0_0_30px_rgba(0,255,200,0.6)] animate-pulse"
        >
          ENTER VR (PORTAL)
        </button>
      </div>

      <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 60 }}>
        <XR store={store}>
          <ModeSwitcher />
          <HUDOverlay />
          <Waypoints />
          <ImmersiveEnvironment />
          
          <Physics debug={false}>
            {/* Dark Cyberpunk Lighting */}
            <ambientLight intensity={0.25} />
            <directionalLight 
              position={[10, 20, -10]} 
              intensity={2.0} 
              color="#4a00e0"
              castShadow 
              shadow-mapSize={[1024, 1024]} 
              shadow-camera-left={-15}
              shadow-camera-right={15}
              shadow-camera-top={15}
              shadow-camera-bottom={-15}
            />
            <pointLight position={[-5, 5, 5]} intensity={1.5} color="#00ffc8" />
            <Environment preset="night" />

            <RainEffect />

            {/* Instruction Sign */}
            <Text 
              position={[0, 3.5, -4]} 
              fontSize={0.5} 
              color="white" 
              anchorX="center" 
              anchorY="middle"
              font="https://fonts.gstatic.com/s/spacegrotesk/v15/V8mQoQDjQSkGpu8pnHXFAA7sjZtx.woff"
              outlineWidth={0.02}
              outlineColor="#4a00e0"
            >
              NEXUS SECTOR 01
            </Text>
            <Text 
              position={[0, 2.8, -4]} 
              fontSize={0.15} 
              color="#00ffc8" 
              anchorX="center" 
              anchorY="middle"
              font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOV.woff"
              maxWidth={3}
              textAlign="center"
            >
              Laser Point & Click to interact with physics nodes.&#10;Press A/X or pull trigger to toggle XR/VR Portal.
            </Text>

            {/* Physical Test Objects (Interactive) */}
            <InteractiveBox position={[-1.5, 2, -2]} color="#00ffc8" scale={1.2} />
            <InteractiveBox position={[0, 3, -1.5]} color="#ff00aa" scale={0.8} />
            <InteractiveBox position={[1.5, 2.5, -2]} color="#9d4edd" scale={1.5} />
            
            <InteractiveBox position={[-0.8, 5, -3]} color="#ff4100" scale={1} />
            <InteractiveBox position={[0.8, 6, -3]} color="#ffea00" scale={0.9} />

            {/* Generative Sci-Fi Terrain */}
            <SciFiTerrain />

            {/* Floating Environment Structures */}
            <FloatingMonolith position={[-8, 3, -10]} />
            <FloatingMonolith position={[8, 4, -8]} />
            <FloatingMonolith position={[0, 5, -15]} />
            <FloatingMonolith position={[-12, 1, 0]} />
            <FloatingMonolith position={[12, 2, 2]} />

            {/* Boundaries */}
            <RigidBody type="fixed">
               <mesh position={[0, 10, -12]} renderOrder={-1} visible={false}>
                  <boxGeometry args={[24, 20, 1]} />
               </mesh>
            </RigidBody>
            <RigidBody type="fixed">
               <mesh position={[-12, 10, 0]} rotation={[0, Math.PI/2, 0]} renderOrder={-1} visible={false}>
                  <boxGeometry args={[24, 20, 1]} />
               </mesh>
            </RigidBody>
             <RigidBody type="fixed">
               <mesh position={[12, 10, 0]} rotation={[0, Math.PI/2, 0]} renderOrder={-1} visible={false}>
                  <boxGeometry args={[24, 20, 1]} />
               </mesh>
            </RigidBody>
            <RigidBody type="fixed">
               <mesh position={[0, 10, 12]} renderOrder={-1} visible={false}>
                  <boxGeometry args={[24, 20, 1]} />
               </mesh>
            </RigidBody>

          </Physics>
        </XR>
      </Canvas>
    </div>
  );
}
