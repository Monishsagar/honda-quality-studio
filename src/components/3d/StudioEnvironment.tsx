import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/**
 * Reflection environment for car paint and glass: a soft grey room with large
 * overhead softboxes, side strips and a ring light, prefiltered once with PMREM.
 */
export function buildStudioEnvScene(): THREE.Scene {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(60, 20, 56),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#9d9a94'), side: THREE.BackSide }),
  );
  room.position.y = 9;
  env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 56), new THREE.MeshBasicMaterial({ color: '#6f6b65' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  env.add(floor);
  const panel = (w: number, h: number, k: number, pos: [number, number, number], rot: [number, number, number], tint = '#ffffff') => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(...pos);
    p.rotation.set(...rot);
    env.add(p);
  };
  panel(40, 6, 3.2, [0, 9, 0], [Math.PI / 2, 0, 0]);
  panel(40, 3, 2.4, [0, 9, -10], [Math.PI / 2, 0, 0]);
  panel(40, 3, 2.4, [0, 9, 10], [Math.PI / 2, 0, 0]);
  panel(30, 3, 1.6, [-20, 4, 0], [0, Math.PI / 2, 0], '#fff1df');
  panel(30, 6, 2.2, [20, 4, 0], [0, -Math.PI / 2, 0], '#eaf3ff');
  panel(40, 4, 1.2, [0, 3, 20], [0, Math.PI, 0]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2) }));
  ring.position.y = 7;
  ring.rotation.x = Math.PI / 2;
  env.add(ring);
  return env;
}

export function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = buildStudioEnvScene();
    const rt = pmrem.fromScene(envScene, 0.03, 0.1, 100);
    const prev = scene.environment;
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.75;
    envScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    });
    pmrem.dispose();
    return () => {
      scene.environment = prev;
      rt.dispose();
    };
  }, [gl, scene]);
  return null;
}
