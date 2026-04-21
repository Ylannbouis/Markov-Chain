import { useEffect, useRef } from 'react';
import { useSimulation } from '@/store/simulationContext';

interface Props {
  count: number;
  darkMode: boolean;
  isEnsemble: boolean;
}

export function ParticleLayer({ count, darkMode, isEnsemble }: Props) {
  const { particlesRef, particleLayerRef, running } = useSimulation();
  const gRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    particleLayerRef.current = gRef.current;
  });

  // Ensure correct number of <circle> elements match current particle count
  const circles = [];
  for (let i = 0; i < count; i++) {
    const p = particlesRef.current[i];
    circles.push(
      <circle
        key={i}
        cx={p?.x ?? 0}
        cy={p?.y ?? 0}
        r={isEnsemble ? 4 : 8}
        fill={isEnsemble
          ? (darkMode ? '#a78bfa' : '#7c3aed')
          : (darkMode ? '#fbbf24' : '#d97706')
        }
        opacity={running ? 0.9 : 0.6}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  return <g ref={gRef}>{circles}</g>;
}
