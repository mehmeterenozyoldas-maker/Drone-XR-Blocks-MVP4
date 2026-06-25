import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';

export default function SciFiTerrain() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const noise2D = createNoise2D();

  // Create geometry once
  const { geometry, positions } = useMemo(() => {
    const size = 100;
    const segments = 100;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2); // Lay flat
    
    const pos = geo.attributes.position;
    const vertexArr = [];

    // Apply simplex noise to Y axis (up)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      
      // Create hills and valleys, mostly staying low in the center
      const distanceToCenter = Math.sqrt(x*x + z*z);
      const centerFlatness = Math.max(0, Math.min(1, (distanceToCenter - 10) / 20)); // Flat within 10 units
      
      const y = noise2D(x * 0.05, z * 0.05) * 4 * centerFlatness;
      pos.setY(i, y);
      
      vertexArr.push(x, y, z);
    }
    
    geo.computeVertexNormals();

    return { 
      geometry: geo,
      positions: new Float32Array(vertexArr)
    };
  }, []);

  return (
    <group>
      {/* Physics Collider for the terrain */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh ref={meshRef} geometry={geometry} receiveShadow>
          <meshStandardMaterial 
            color="#090914" 
            roughness={0.8} 
            metalness={0.2}
            wireframe={false}
          />
        </mesh>
      </RigidBody>

      {/* Wireframe overlay for the sci-fi look */}
      <mesh geometry={geometry} position={[0, 0.01, 0]}>
        <meshBasicMaterial 
          color="#00ffc8" 
          wireframe={true} 
          transparent 
          opacity={0.15} 
        />
      </mesh>
    </group>
  );
}
