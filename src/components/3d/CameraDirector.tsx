import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useShowroomStore } from '../../store/useShowroomStore';
import { useControls } from '../../sim/controls';
import { carRegistry } from '../../three/registry';
import { PartData } from '../../three/buildCar';

interface Shot { pos: THREE.Vector3; target: THREE.Vector3; fov: number; look?: boolean; local?: boolean }

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Named camera shots per domain and test mode, in the car's own frame, with smooth
 * transitions. Picking a part frames its real bounds from a direction that suits it.
 */
export function CameraDirector() {
  const { camera, size } = useThree();
  const ctrl = useRef<OrbitControlsImpl>(null);
  const { activeVehicleId, inspectionDomain, selectedComponentId, getSelectedComponent } = useShowroomStore();
  const c = useControls();

  const shot = useMemo((): Shot | null => {
    const car = carRegistry.get(activeVehicleId);
    if (!car) return null;
    const d = car.dims;
    const sel = getSelectedComponent();
    if (sel) {
      // frame the selected part's bounds
      car.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const g of car.parts) if ((g.userData as unknown as PartData).compId === sel.id) box.expandByObject(g);
      if (!box.isEmpty()) {
        const parent = car.root.parent!;
        const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        const b = box.clone().applyMatrix4(inv);
        const centre = b.getCenter(new THREE.Vector3());
        const radius = Math.max(0.18, b.getSize(new THREE.Vector3()).length() / 2);
        const dir = new THREE.Vector3(...sel.cameraPositionOffset).sub(new THREE.Vector3(...sel.cameraTargetOffset));
        if (dir.lengthSq() < 1e-4) dir.set(1, 0.6, 1);
        dir.normalize();
        if (sel.domain === 'interior') dir.set(0.25, 0.55, -1).normalize();
        const fov = 34;
        const dist = (radius / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.05;
        return { pos: centre.clone().addScaledVector(dir, dist), target: centre, fov, local: true };
      }
    }
    const lift = inspectionDomain === 'undercarriage' && c.chassis === 'hoist' ? 1.75 : 0;
    switch (inspectionDomain) {
      case 'exterior':
        if (c.exterior === 'paint') return { pos: v(5.6, 1.7, 0.9), target: v(0, 0.7, 0), fov: 34, local: true };
        if (c.exterior === 'zebra') return { pos: v(4.4, 1.25, 2.6), target: v(0, 0.75, 0.2), fov: 32, local: true };
        if (c.exterior === 'gaps') return { pos: v(3.4, 1.45, 1.5), target: v(0.2, 0.8, 0.1), fov: 36, local: true };
        if (c.view === 'cut') return { pos: v(4.6, 2.1, 2.4), target: v(0, 0.6, 0), fov: 36, local: true };
        return { pos: v(4.2, 1.5, 4.9), target: v(0, 0.62, 0.15), fov: 32, local: true };
      case 'interior':
        if (c.interior === 'cabin') return { pos: v(1.9, 3.3, -1.9), target: v(0, 0.75, 0.15), fov: 40, local: true };
        if (c.interior === 'climate') return { pos: d.rearEye.clone(), target: d.rearEye.clone().add(v(-0.25, -0.2, 1).normalize().multiplyScalar(0.05)), fov: 64, look: true, local: true };
        return { pos: d.eye.clone(), target: d.eye.clone().add(v(0.08, -0.16, 1).normalize().multiplyScalar(0.05)), fov: 62, look: true, local: true };
      case 'engine':
        if (c.view === 'xray' || c.follow === 'energy' || c.follow === 'fluids') return { pos: v(4.9, 1.85, 1.2), target: v(0, 0.55, 0.15), fov: 36, local: true };
        return { pos: v(1.25, 2.55, d.engine.z + 1.65), target: v(0.0, d.engine.y + 0.02, d.engine.z - 0.05), fov: 34, local: true };
      case 'undercarriage':
        if (c.chassis === 'hoist') return { pos: v(3.0, 0.65, 3.4), target: v(0, lift + 0.2, 0.3), fov: 46, local: true };
        if (c.chassis === 'brakes') return { pos: v(d.track / 2 + 1.5, 0.62, d.zA1 + 1.4), target: v(d.track / 2 - 0.05, d.R, d.zA1), fov: 34, local: true };
        return { pos: v(3.7, 0.7, 4.2), target: v(0, 0.48, 0.2), fov: 34, local: true };
      case 'electrical':
        return { pos: v(-2.0, 3.3, -d.L / 2 - 4.2), target: v(0, 0.5, d.L / 2 + 4.5), fov: 44, local: true };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVehicleId, inspectionDomain, selectedComponentId, c.exterior, c.interior, c.view, c.follow, c.chassis, size.width]);

  // tween state
  const tw = useRef<{ from: Shot; to: Shot; t: number } | null>(null);
  useEffect(() => {
    if (!shot || !ctrl.current) return;
    const cam = camera as THREE.PerspectiveCamera;
    tw.current = { from: { pos: cam.position.clone(), target: ctrl.current.target.clone(), fov: cam.fov }, to: shot, t: 0 };
  }, [shot, camera]);

  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const ct = ctrl.current;
    if (!ct || !tw.current) return;
    const car = carRegistry.get(activeVehicleId);
    if (!car || !car.root.parent) return;
    const tr = tw.current;
    tr.t = Math.min(1, tr.t + dt / 1.5);
    const k = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - Math.pow(-2 * tr.t + 2, 3) / 2;
    const parent = car.root.parent;
    parent.updateMatrixWorld();
    const toPos = tr.to.local ? tr.to.pos.clone().applyMatrix4(parent.matrixWorld) : tr.to.pos;
    const toTgt = tr.to.local ? tr.to.target.clone().applyMatrix4(parent.matrixWorld) : tr.to.target;
    // arc the move up and around rather than cutting through the car
    const p = tr.from.pos.clone().lerp(toPos, k);
    const lift = Math.sin(Math.PI * k) * Math.min(1.2, tr.from.pos.distanceTo(toPos) * 0.15) * (tr.to.look ? 0 : 1);
    p.y += lift;
    cam.position.copy(p);
    ct.target.copy(tr.from.target.clone().lerp(toTgt, k));
    cam.fov = THREE.MathUtils.lerp(tr.from.fov, tr.to.fov, k);
    cam.updateProjectionMatrix();
    ct.update();
    if (tr.t >= 1) tw.current = null;
  });

  const look = !!shot?.look;
  return (
    <OrbitControls
      ref={ctrl}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={look ? -0.35 : 0.6}
      zoomSpeed={0.7}
      enablePan={!look}
      enableZoom={!look}
      minDistance={look ? 0.04 : 0.35}
      maxDistance={look ? 0.06 : 14}
      maxPolarAngle={inspectionDomain === 'undercarriage' ? Math.PI * 0.62 : Math.PI * 0.53}
      target={[0, 0.8, 0]}
    />
  );
}
