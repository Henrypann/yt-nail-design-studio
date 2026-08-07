/** Lazy module boundary for the Starfish Bloom browser preview. */
import * as THREE from 'three';

// Referencing the runtime revision keeps Three.js behind this dynamic boundary.
export const rendererRuntimeRevision = THREE.REVISION;
export const rendererId = 'three-pbr/starfish-bloom-1' as const;
export const engine = 'three' as const;
export const evidence = 'SIMULATED' as const;
