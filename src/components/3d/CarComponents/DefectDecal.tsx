import React from 'react';
import * as THREE from 'three';
import { Defect } from '../../../types/vehicle';

interface DefectDecalProps {
  defect: Defect;
  parentOffset?: [number, number, number];
}

export function DefectDecal({ defect, parentOffset = [0, 0, 0] }: DefectDecalProps) {
  const [ox, oy, oz] = parentOffset;
  const [dx, dy, dz] = defect.visualPosition || [0, 0.25, 0];

  const pos: [number, number, number] = [dx - ox, dy - oy, dz - oz];

  return (
    <group position={pos}>
      {/* ---------------- 3D HIGH-VISIBILITY RED DEFECT LOCATOR BEACON ---------------- */}
      {/* Floating Red Warning Marker Pin */}
      <group position={[0, 0.18, 0]}>
        {/* Pulsing Red Sphere Marker */}
        <mesh>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color="#ff0033" />
        </mesh>
        {/* Vertical Target Pointer Stalk */}
        <mesh position={[0, -0.09, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.16, 8]} />
          <meshBasicMaterial color="#ff0033" />
        </mesh>
      </group>

      {/* Ground/Surface Concentric Red Pulsing Radar Rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.08, 0.14, 24]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.16, 0.22, 24]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Specific Defect Geometry - ALL Styled in Vivid Inspection Red */}
      {defect.type === 'scratch' && (
        <group position={[0, 0.015, 0]} rotation={[0, 0, Math.PI / 4]}>
          <mesh>
            <boxGeometry args={[0.3, 0.014, 0.008]} />
            <meshBasicMaterial color="#ff1744" />
          </mesh>
        </group>
      )}

      {defect.type === 'dent' && (
        <group position={[0, 0.005, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 24]} />
            <meshBasicMaterial color="#b91c1c" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[0.08, 0.12, 24]} />
            <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {defect.type === 'crack' && (
        <group position={[0, 0.015, 0]}>
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[0.32, 0.012, 0.008]} />
            <meshBasicMaterial color="#ff0033" />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 3]}>
            <boxGeometry args={[0.24, 0.01, 0.008]} />
            <meshBasicMaterial color="#ff0033" />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 3]}>
            <boxGeometry args={[0.26, 0.01, 0.008]} />
            <meshBasicMaterial color="#ff0033" />
          </mesh>
        </group>
      )}

      {defect.type === 'corrosion' && (
        <group position={[0, 0.015, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 16]} />
            <meshBasicMaterial color="#991b1b" />
          </mesh>
          <mesh position={[0.03, 0.02, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        </group>
      )}

      {defect.type === 'leak' && (
        <group position={[0, 0.015, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.15, 24]} />
            <meshBasicMaterial color="#7f1d1d" />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      )}

      {defect.type === 'wear' && (
        <group position={[0, 0.015, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.12, 0.24, 24]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {defect.type === 'misalignment' && (
        <group position={[0, 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <boxGeometry args={[0.35, 0.025, 0.01]} />
            <meshBasicMaterial color="#dc2626" />
          </mesh>
        </group>
      )}
    </group>
  );
}
