import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export type MountingHole = { x: number; y: number; diameter: number };

/** Flat PCB body. With mounting holes it is an extruded outline with real through-holes. */
export function PcbBoard({ dimensions, color, roughness = 0.72, holes, radius }: { dimensions: [number, number, number]; color: string; roughness?: number; holes?: MountingHole[]; radius?: number }) {
  const [w, h, t] = dimensions;
  const geometry = useMemo(() => {
    if (!holes?.length) return undefined;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
    for (const hole of holes) {
      const path = new THREE.Path();
      path.absarc(hole.x, hole.y, hole.diameter / 2, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 24 });
    g.translate(0, 0, -t / 2);
    return g;
  }, [w, h, t, holes]);
  if (!geometry) return <RoundedBox args={dimensions} radius={radius ?? Math.min(1, t / 3)}><meshStandardMaterial color={color} roughness={roughness} /></RoundedBox>;
  return <mesh geometry={geometry}><meshStandardMaterial color={color} roughness={roughness} /></mesh>;
}
