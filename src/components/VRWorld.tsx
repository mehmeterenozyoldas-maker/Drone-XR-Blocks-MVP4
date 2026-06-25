import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { XR, createXRStore, useXR } from '@react-three/xr';
import { Physics, RigidBody } from '@react-three/rapier';
import { Sky, Environment, Text, ContactShadows, useCursor, Stars, Sparkles, Float } from '@react-three/drei';
import type { RapierRigidBody } from '@react-three/rapier';
import SciFiTerrain from './Terrain';
import * as THREE from 'three';

// Configure XR Store for the application
const store = createXRStore();

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

export default function VRWorld() {
  return (
    <div className="w-full h-[600px] relative rounded-3xl overflow-hidden border border-white/10 bg-black/80 backdrop-blur-md shadow-[0_0_50px_rgba(0,255,200,0.1)]">
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-4">
        <button
          onClick={() => store.enterAR()}
          className="bg-purple-600 text-white px-6 py-3 rounded-full font-bold font-mono tracking-widest hover:scale-105 transition-all hover:shadow-[0_0_30px_rgba(147,51,234,0.6)]"
        >
          ENTER XR (AR)
        </button>
        <button
          onClick={() => store.enterVR()}
          className="bg-neon-cyan text-black px-6 py-3 rounded-full font-bold font-mono tracking-widest hover:scale-105 transition-all hover:shadow-[0_0_30px_rgba(0,255,200,0.6)] animate-pulse"
        >
          ENTER VR (PORTAL)
        </button>
      </div>

      <Canvas shadows camera={{ position: [0, 1.6, 4], fov: 60 }}>
        <XR store={store}>
          <ModeSwitcher />
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
