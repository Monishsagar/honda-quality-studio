import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { VehicleData } from '../../types/vehicle';
import { useShowroomStore } from '../../store/useShowroomStore';
import { buildCar, PartData, BuiltCar } from '../../three/buildCar';
import { specFor } from '../../three/carSpecs';
import { makeCarMaterials, MatKey, makeFlowMaterial, cutVariant, paintMapMaterial, zebraMaterial } from '../../three/materials';
import { carRegistry } from '../../three/registry';
import { gapReadings, paintSpots } from '../../three/metrology';
import { drawCluster, drawInfo } from '../../three/screens';
import { simSpecFor } from '../../sim/specs';
import { live, stepSim } from '../../sim/sim';
import { useControls } from '../../sim/controls';
import { DefectDecal } from './CarComponents/DefectDecal';
import { TestRig } from './TestRig';
import { sound } from '../../utils/audioEffects';

interface CarModelProps {
  vehicle: VehicleData;
  isReferenceModel?: boolean;
  /** Show only this component, centred at the origin (benchmark comparison view). */
  isolateId?: string;
}

// ---------------------------------------------------------------- x-ray ghost shader
const GHOST_VERT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  #include <begin_vertex>
  vec4 w = modelMatrix * vec4(transformed, 1.0);
  vec4 mvPosition = viewMatrix * w;
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
  vW = w.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const GHOST_FRAG = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform float uTime; uniform float uK;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  #include <clipping_planes_fragment>
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(f, 2.6);
  float lines = smoothstep(0.92, 1.0, abs(sin(vW.y * 60.0))) * 0.08;
  float a = clamp((0.035 + rim * 0.75 + lines * rim) * uK, 0.0, 1.0);
  gl_FragColor = vec4(uColor, a);
}`;
function ghost(color: string, k = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: GHOST_VERT, fragmentShader: GHOST_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uK: { value: k } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, clipping: true,
  });
}
const CASING = new THREE.MeshPhysicalMaterial({ color: '#c9d6e3', metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const SHUT = { pass: new THREE.MeshBasicMaterial({ color: '#22c55e', toneMapped: false }), warning: new THREE.MeshBasicMaterial({ color: '#f59e0b', toneMapped: false }), fail: new THREE.MeshBasicMaterial({ color: '#ef4444', toneMapped: false }) };
const FLOW_COLORS: Record<string, string> = { hv: '#5fd0ff', fuel: '#ffae4a', coolant: '#3ee0c8', exhaust: '#ff7a3c', brake: '#ff4d6d', can: '#a3e635' };
const CAP_GREY = new THREE.Color('#8b9197');
const DEFECT = new THREE.MeshPhysicalMaterial({ color: '#dc2626', metalness: 0.3, roughness: 0.25, clearcoat: 1, emissive: '#b91c1c', emissiveIntensity: 0.6 });
const NON_OUTER = new Set(['interiorDark', 'leather', 'leatherInsert', 'carpet', 'trim', 'headliner', 'engineBlack', 'tank', 'spring', 'damper', 'steel', 'alu', 'cable', 'cableHV', 'hose', 'ambient', 'rubber', 'rim', 'rimDark', 'disc', 'caliper', 'cluster', 'info']);

type MeshInfo = { mesh: THREE.Mesh; part: PartData; outer: boolean };
const HIDE = (new URLSearchParams(window.location.search).get('hide') ?? '').split(',').filter(Boolean);

export function CarModel({ vehicle, isReferenceModel = false, isolateId }: CarModelProps) {
  const {
    viewMode, activeVehicleId, inspectionDomain, selectedComponentId, hoveredComponentId, isolatedComponentId,
    setSelectedComponent, setHoveredComponent,
  } = useShowroomStore();
  const ctl = useControls();

  const spec = specFor(vehicle.id);
  const sim = simSpecFor(vehicle.id);
  const car: BuiltCar = useMemo(() => buildCar(spec, { hybrid: sim.hybrid, turbo: sim.turbo, manual: sim.manual }), [spec, sim]);
  const { mats, screens } = useMemo(() => {
    const r = makeCarMaterials({ bodyColor: vehicle.bodyColor, rimColor: vehicle.rimColor, caliperColor: vehicle.caliperColor, interiorColor: vehicle.interiorColor }, spec.metallic, spec.blackRoof);
    for (const k of ['tail', 'ambient', 'led', 'spark'] as const) r.mats[k] = r.mats[k].clone();
    return r;
  }, [vehicle.bodyColor, vehicle.rimColor, vehicle.caliperColor, vehicle.interiorColor, spec]);

  const isActive = !isReferenceModel && !isolateId && viewMode === 'inspection' && activeVehicleId === vehicle.id;
  if (!isReferenceModel && !isolateId) carRegistry.set(vehicle.id, car);

  const meshes = useMemo(() => {
    const list: MeshInfo[] = [];
    for (const g of car.parts) {
      const part = g.userData as unknown as PartData;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.userData.ghostTwin) return;
        m.userData.part = part;
        const outer = (part.domain === 'exterior' || part.domain === 'shell') && part.compId !== 'comp-wheels-tyres' && !m.userData.cabin
          && g.name !== 'brakeLines' && g.name !== 'rearBrakes' && !m.userData.flow && !NON_OUTER.has(m.userData.mk);
        list.push({ mesh: m, part, outer });
      });
    }
    return list;
  }, [car]);
  const special = useMemo(() => {
    const discs = car.corners.map(() => { const m = (mats.disc as THREE.MeshStandardMaterial).clone(); m.emissive = new THREE.Color('#000000'); return m; });
    const sparks = car.engine.sparks.map(() => (mats.spark as THREE.MeshBasicMaterial).clone());
    const flows: THREE.ShaderMaterial[] = [];
    const flowMeshes: THREE.Object3D[] = [];
    for (const g of car.parts) g.traverse((o) => {
      if (o.userData.flow) {
        const m = makeFlowMaterial(FLOW_COLORS[o.userData.flow] ?? '#ffffff');
        m.uniforms.uLen.value = o.userData.len;
        m.userData.flow = o.userData.flow;
        o.userData.ownMat = m;
        flows.push(m);
        flowMeshes.push(o);
      }
    });
    return { discs, sparks, flows, flowMeshes };
  }, [car, mats]);

  const defectIds = useMemo(() => {
    const s = new Set<string>();
    if (isReferenceModel) return s;
    // only the parts that belong to the domain under inspection show red
    for (const c of vehicle.components) if (c.currentDefects.length > 0 && (isolateId || c.domain === inspectionDomain)) s.add(c.id);
    return s;
  }, [vehicle, isReferenceModel, inspectionDomain, isolateId]);
  const showDefects = isActive || (!!isolateId && !isReferenceModel);
  const spots = useMemo(() => paintSpots(vehicle), [vehicle]);
  const paintMat = useMemo(() => paintMapMaterial(spots), [spots]);
  const zebraMat = useMemo(() => zebraMaterial(spots), [spots]);
  const gaps = useMemo(() => gapReadings(car, vehicle), [car, vehicle]);

  // ---------------------------------------------------------------- clipping planes (car local → world each frame)
  const planes = useMemo(() => ({
    scanSolid: { local: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), world: new THREE.Plane() },
    scanGhost: { local: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), world: new THREE.Plane() },
    cut: { local: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), world: new THREE.Plane() },
    cabin: { local: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1), world: new THREE.Plane() },
  }), []);
  const variants = useRef(new Map<string, THREE.Material>());
  useEffect(() => { variants.current.clear(); }, [mats]);
  const variant = (key: string, make: () => THREE.Material) => {
    let m = variants.current.get(key);
    if (!m) { m = make(); variants.current.set(key, m); }
    return m;
  };
  const baseMat = (mk: MatKey, double: boolean) => {
    const src = mats[mk] ?? mats.paint;
    if (!double) return src;
    return variant(`${mk}|d`, () => { const m = src.clone(); m.side = THREE.DoubleSide; return m; });
  };
  const tinted = (src: THREE.Material, state: 'sel' | 'hov') => variant(`${state}|${src.uuid}`, () => {
    const m = src.clone() as THREE.MeshStandardMaterial;
    if (m.emissive) { m.emissive = new THREE.Color(state === 'sel' ? '#0284c7' : '#38bdf8'); m.emissiveIntensity = state === 'sel' ? 0.55 : 0.25; m.emissiveMap = null; }
    return m;
  });
  const clipped = (src: THREE.Material, which: 'scanSolid' | 'cut' | 'cabin', capColor: THREE.Color) =>
    variant(`${which}|${src.uuid}`, () => {
      if (which === 'scanSolid') { const m = src.clone(); m.clippingPlanes = [planes.scanSolid.world]; return m; }
      return cutVariant(src, [planes[which].world], capColor);
    });
  const capFor = (mk: string) => (mk === 'paint' || mk === 'roofPaint' ? new THREE.Color(vehicle.bodyColor).multiplyScalar(0.55) : mk.startsWith('leather') || mk === 'interior' ? new THREE.Color(vehicle.interiorColor).multiplyScalar(0.7) : CAP_GREY);

  const ghostMats = useMemo(() => {
    const g = { base: ghost('#1f6fb2', 1.1), sel: ghost('#0ea5e9', 1.6), defect: ghost('#ef4444', 1.7) };
    for (const gm of Object.values(g)) gm.clippingPlanes = [planes.scanGhost.world];
    return g;
  }, [planes]);
  const ghostTwins = useRef<THREE.Mesh[] | null>(null);
  const ensureTwins = () => {
    if (ghostTwins.current) return ghostTwins.current;
    const list: THREE.Mesh[] = [];
    for (const mi of meshes) {
      if (!mi.outer || mi.mesh.userData.xrayHide) continue;
      const t = new THREE.Mesh(mi.mesh.geometry, ghostMats.base);
      t.position.copy(mi.mesh.position); t.quaternion.copy(mi.mesh.quaternion); t.scale.copy(mi.mesh.scale);
      t.userData.ghostTwin = true;
      t.userData.part = mi.part;
      t.renderOrder = 3;
      t.visible = false;
      t.raycast = () => null;
      mi.mesh.parent!.add(t);
      mi.mesh.userData.twin = t;
      list.push(t);
    }
    ghostTwins.current = list;
    return list;
  };

  // ---------------------------------------------------------------- material / visibility pass
  const xr = useRef(0);
  const mode = isActive ? ctl.view : 'solid';
  const domain = inspectionDomain;
  useEffect(() => {
    const iso = isolateId ?? (isActive ? isolatedComponentId : null);
    const exteriorView = isActive && domain === 'exterior' && mode === 'solid' ? ctl.exterior : 'finish';
    const cabinCut = isActive && domain === 'interior' && ctl.interior === 'cabin';
    const casingOn = isActive && (domain === 'engine' || mode === 'xray');
    if (mode === 'xray') ensureTwins();
    for (const mi of meshes) {
      const { mesh, part } = mi;
      const mk = mesh.userData.mk as MatKey;
      const comp = part.compId;
      const defect = showDefects && !!comp && defectIds.has(comp);
      const sel = isActive && !!comp && comp === selectedComponentId;
      const hov = isActive && !!comp && comp === hoveredComponentId && !sel;
      let visible = iso ? comp === iso : true;
      mesh.castShadow = mk !== 'glass' && mk !== 'inner' && !mesh.userData.flow;
      if (mesh.userData.flow) { mesh.material = mesh.userData.ownMat; continue; }
      let m: THREE.Material = baseMat(mk, !!mesh.userData.double);
      if (mesh.userData.casing && casingOn) m = CASING;
      if (exteriorView === 'paint' && (mk === 'paint' || (mk === 'roofPaint' && !spec.blackRoof))) m = paintMat;
      if (exteriorView === 'zebra' && (mk === 'paint' || mk === 'roofPaint' || mk === 'trimBlack')) m = zebraMat;
      if (defect && mk !== 'glass' && exteriorView === 'finish') m = DEFECT;
      else if (sel) m = tinted(m, 'sel');
      else if (hov) m = tinted(m, 'hov');
      if (mode === 'cut') {
        if (mk === 'inner') visible = false;
        m = mk === 'glass' ? variant('glasscut', () => { const g = mats.glass.clone(); g.clippingPlanes = [planes.cut.world]; return g; }) : clipped(m, 'cut', capFor(mk));
      }
      if (cabinCut && mi.outer) {
        if (mk === 'glass' || mk === 'inner') visible = false;
        else m = clipped(m, 'cabin', capFor(mk));
      }
      if (cabinCut && mk === 'headliner') visible = false;
      if (HIDE.length && (HIDE.includes(mesh.parent?.name ?? '') || HIDE.includes((mesh.userData.mk as string) ?? '') || HIDE.some((h) => mesh.parent?.parent?.name === h))) visible = false;
      mesh.userData.solidMat = m;
      mesh.userData.wantVisible = visible;
      mesh.material = m;
      mesh.visible = visible;
      const twin = mesh.userData.twin as THREE.Mesh | undefined;
      if (twin) twin.material = defect ? ghostMats.defect : sel || hov ? ghostMats.sel : ghostMats.base;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshes, isActive, mode, domain, ctl.exterior, ctl.interior, selectedComponentId, hoveredComponentId, isolatedComponentId, isolateId, defectIds, showDefects, mats]);

  // centre the isolated component for the benchmark view
  useEffect(() => {
    if (!isolateId) return;
    car.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const g of car.parts) if ((g.userData as unknown as PartData).compId === isolateId) box.expandByObject(g);
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3());
      car.root.position.set(-c.x, -box.min.y, -c.z);
    }
  }, [car, isolateId]);

  // ---------------------------------------------------------------- per-frame: simulation → scene
  const explodeCur = useRef(0);
  const hood = useRef(0);
  const lift = useRef(0);
  const screenT = useRef(0);
  const pistonX = useMemo(() => car.engine.pistons.map((p) => p.position.x), [car]);
  const valveY = useMemo(() => car.engine.valves.map((v) => v.position.y), [car]);
  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const c = useControls.getState();
    const t = state.clock.elapsedTime;
    if (isActive) stepSim(dt, sim, vehicle.id, domain, true);
    const L = live;
    const run = isActive;

    const exT = run && c.view === 'exploded' ? c.explode : 0;
    explodeCur.current += (exT - explodeCur.current) * Math.min(1, dt * 5);
    const f = explodeCur.current;
    for (const g of car.parts) { const p = g.userData as unknown as PartData; g.position.copy(p.base).addScaledVector(p.explode, f); }

    const hoodT = run && domain === 'engine' && c.view !== 'exploded' ? 1 : 0;
    hood.current += (hoodT - hood.current) * Math.min(1, dt * 2.5);
    const hs = hood.current;
    car.hoodPivot.rotation.x = -0.95 * hs * hs * (3 - 2 * hs);

    const liftT = run && domain === 'undercarriage' ? (c.chassis === 'hoist' ? 1.75 : c.chassis === 'shaker' ? 0.14 : 0) : 0;
    lift.current += (liftT - lift.current) * Math.min(1, dt * 1.6);
    if (!isolateId) car.root.position.y = lift.current;

    car.sprung.position.y = run ? L.heave : 0;
    car.sprung.rotation.x = run ? L.pitch : 0;
    car.sprung.rotation.z = run ? L.roll : 0;
    car.corners.forEach((cn, i) => {
      const zu = run ? L.zu[i] : 0;
      cn.hub.position.y = car.dims.R + zu;
      cn.bhub.position.y = car.dims.R + zu;
      const st = cn.front && run ? L.steer : 0;
      cn.steer.rotation.y = st;
      cn.bsteer.rotation.y = st;
      cn.spin.rotation.x = run ? L.wheel * (cn.side > 0 ? -1 : 1) : 0;
      const comp = run ? L.zs[i] - L.zu[i] : 0;
      cn.spring.scale.y = Math.max(0.55, (cn.springLen + comp * 1.6) / cn.springLen);
      const m = special.discs[i];
      const T = run ? L.disc[i] : 24;
      const k = Math.max(0, (T - 180) / 520);
      m.emissive.setRGB(1, 0.18 + k * 0.45, 0.02 + k * 0.1);
      m.emissiveIntensity = Math.pow(k, 1.4) * 4;
      if (cn.disc.material !== DEFECT) cn.disc.material = m;
    });
    car.rack.position.x = run ? L.steer * 0.06 : 0;
    const sw = car.steeringWheel.children[0];
    if (sw) sw.rotation.z = run ? -L.steer * 12 : 0;

    // engine internals
    const e = car.engine;
    const crank = run ? L.crank : 0;
    const r = e.stroke / 2;
    e.crank.rotation.x = crank;
    const phase = [0, Math.PI, Math.PI, 0];
    const firing = [0, 3, 1, 2];
    e.pistons.forEach((p, i) => {
      const a = crank + phase[i];
      const pinY = e.crankY + r * Math.cos(a), pinZ = e.crank.position.z + r * Math.sin(a);
      const dy = Math.sqrt(e.rod * e.rod - (r * Math.sin(a)) ** 2);
      p.position.set(pistonX[i], pinY + dy, e.crank.position.z);
      const rod = e.rods[i];
      rod.position.set(pistonX[i], pinY, pinZ);
      rod.rotation.x = Math.atan2(-r * Math.sin(a), dy);
      const sm = special.sparks[i];
      sm.opacity = run && L.engineOn ? Math.pow(Math.max(0, Math.cos(crank / 2 - (firing[i] * Math.PI) / 2)), 40) : 0;
      e.sparks[i].material = sm;
    });
    e.valves.forEach((v, i) => {
      const cyl = v.userData.cyl as number, kind = v.userData.kind as number;
      const l2 = Math.pow(Math.max(0, Math.sin(crank / 2 - (firing[cyl] * Math.PI) / 2 + (kind ? 2.4 : 0.8))), 3) * 0.009;
      v.position.y = valveY[i] - (run && L.engineOn ? l2 : 0);
    });
    for (const cam of e.cams) cam.rotation.x = crank / 2;
    e.pulleys.forEach((p, i) => { p.rotation.x = i === 0 ? crank : crank / 2; });
    if (e.rotor) e.rotor.rotation.x = run ? L.wheel * 2.5 : 0;
    if (e.turbo) e.turbo.rotation.x += run ? L.turboRpm * dt * 0.00003 : 0;
    e.fan.rotation.z += run && L.engineOn ? dt * 9 : 0;

    // lights
    (mats.tail as THREE.MeshPhysicalMaterial).emissiveIntensity = 1.6 + (run && L.brake > 0.08 ? 4 : 0);
    (mats.ambient as THREE.MeshStandardMaterial).emissiveIntensity = isActive ? (c.ambient ? 2.2 : 0) : 1.2;
    (mats.led as THREE.MeshStandardMaterial).emissiveIntensity = run && Math.floor(t * (domain === 'electrical' ? 12 : 2)) % 2 ? 6 : 0.5;

    // flows
    for (const fm of special.flows) {
      const name = fm.userData.flow as string;
      let on = 0, speed = 1;
      if (run) {
        const follow = c.follow;
        if (domain === 'engine') {
          const sel = follow === 'all' ? ['hv', 'fuel', 'coolant', 'exhaust'] : follow === 'energy' ? ['hv', 'fuel'] : follow === 'engine' ? ['fuel', 'exhaust'] : ['coolant', 'fuel', 'exhaust'];
          if (sel.includes(name)) on = 1;
        } else if (domain === 'undercarriage') { if (name === 'brake' && c.chassis === 'brakes') on = 1; if (name === 'exhaust' && c.chassis !== 'shaker') on = 0.8; }
        else if (domain === 'electrical') { if (name === 'can') on = 1; if (name === 'brake') on = L.brake > 0.1 ? 1 : 0.15; }
        else if (c.view === 'xray') on = 0.6;
        if (name === 'hv') { const p = L.batteryKW; on *= Math.abs(p) > 0.5 ? 1 : 0.15; speed = Math.sign(p || 1) * (0.4 + Math.min(1.5, Math.abs(p) / 30)); }
        if (name === 'fuel') { on *= L.engineOn ? 1 : 0.1; speed = 0.2 + L.fuelLh * 0.04; }
        if (name === 'exhaust') { on *= L.engineOn ? 1 : 0.1; speed = 0.6 + L.rpm / 2000; }
        if (name === 'coolant') { on *= L.engineOn ? 1 : 0.15; speed = 0.4 + L.load; }
        if (name === 'brake') { speed = 0.6 + L.brake * 2; if (domain !== 'electrical') on *= L.brake > 0.05 ? 1 : 0.2; }
        if (name === 'can') speed = 1.4;
      }
      fm.uniforms.uOn.value += (on - fm.uniforms.uOn.value) * Math.min(1, dt * 5);
      fm.uniforms.uTime.value += dt;
      fm.uniforms.uSpeed.value = speed;
    }
    for (const o of special.flowMeshes) o.visible = (o.userData.ownMat as THREE.ShaderMaterial).uniforms.uOn.value > 0.01;

    // x-ray scan sweep nose → tail
    const xrT = run && c.view === 'xray' ? 1 : 0;
    const xprev = xr.current;
    xr.current += Math.sign(xrT - xr.current) * Math.min(Math.abs(xrT - xr.current), Math.min(dtRaw, 0.25) / 1.3);
    if (ghostTwins.current && (xr.current > 0 || xprev > 0)) {
      const s = car.dims.L / 2 + 0.05 - xr.current * (car.dims.L + 0.1);
      car.root.updateMatrixWorld();
      planes.scanSolid.local.constant = s;
      planes.scanGhost.local.constant = -s;
      planes.scanSolid.world.copy(planes.scanSolid.local).applyMatrix4(car.root.matrixWorld);
      planes.scanGhost.world.copy(planes.scanGhost.local).applyMatrix4(car.root.matrixWorld);
      const scanning = xr.current > 0 && xr.current < 1;
      for (const mi of meshes) {
        if (!mi.outer) continue;
        const tw = mi.mesh.userData.twin as THREE.Mesh | undefined;
        const want = mi.mesh.userData.solidMat as THREE.Material | undefined;
        const wv = mi.mesh.userData.wantVisible !== false;
        if (xr.current >= 1) { mi.mesh.visible = false; if (tw) tw.visible = wv; }
        else if (scanning) { mi.mesh.visible = wv; if (want) mi.mesh.material = clipped(want, 'scanSolid', CAP_GREY); if (tw) tw.visible = wv; }
        else { if (want) mi.mesh.material = want; mi.mesh.visible = wv; if (tw) tw.visible = false; }
      }
      const clip = xr.current >= 1 ? [] : [planes.scanGhost.world];
      for (const gm of Object.values(ghostMats)) gm.clippingPlanes = clip;
    }
    if (mode === 'cut' || (isActive && domain === 'interior' && c.interior === 'cabin')) {
      car.root.updateMatrixWorld();
      planes.cut.local.constant = c.cut * car.dims.W * 0.5;
      planes.cut.world.copy(planes.cut.local).applyMatrix4(car.root.matrixWorld);
      planes.cabin.local.constant = car.dims.beltY + 0.04;
      planes.cabin.world.copy(planes.cabin.local).applyMatrix4(car.root.matrixWorld);
    }
    for (const gm of Object.values(ghostMats)) gm.uniforms.uTime.value = t;
    DEFECT.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.3;

    if (isActive && (domain === 'interior' || domain === 'engine' || domain === 'electrical')) {
      screenT.current += dt;
      if (screenT.current > 0.08) {
        screenT.current = 0;
        drawCluster(screens.cluster, L, sim);
        drawInfo(screens.info, L, sim, domain === 'electrical' ? 'adas' : domain === 'interior' && c.interior === 'climate' ? 'climate' : 'energy', c.climateTemp);
      }
    }
  });

  // ---------------------------------------------------------------- picking
  const compOf = (o: THREE.Object3D | null): string | null => {
    while (o) {
      const p = o.userData.part as PartData | undefined;
      if (p) return p.compId;
      o = o.parent;
    }
    return null;
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isActive || e.delta > 4) return;
    const id = compOf(e.object);
    if (!id) return;
    e.stopPropagation();
    sound.playClick();
    setSelectedComponent(id);
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!isActive) return;
    const id = compOf(e.object);
    if (!id) return;
    e.stopPropagation();
    if (id !== hoveredComponentId) setHoveredComponent(id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    if (!isActive) return;
    setHoveredComponent(null);
    document.body.style.cursor = '';
  };

  const decals = isActive && !isolateId && domain === 'exterior' && ctl.exterior === 'finish' && ctl.view === 'solid'
    ? vehicle.components.filter((c) => (!isolatedComponentId || c.id === isolatedComponentId) && c.domain === 'exterior').flatMap((c) => c.currentDefects.filter((d) => d.visualPosition).map((d) => ({ d, key: `${c.id}-${d.id}` })))
    : [];
  const showGaps = isActive && domain === 'exterior' && ctl.exterior === 'gaps' && ctl.view === 'solid';

  return (
    <group>
      <primitive object={car.root} onClick={onClick} onPointerMove={onOver} onPointerOut={onOut} />
      {decals.map(({ d, key }) => <DefectDecal key={key} defect={d} />)}
      {showGaps && <ShutLines car={car} gaps={gaps} />}
      {isActive && <TestRig car={car} vehicle={vehicle} />}
    </group>
  );
}

function ShutLines({ car, gaps }: { car: BuiltCar; gaps: ReturnType<typeof gapReadings> }) {
  const lines = useMemo(() => car.shutLines.map((sl) => {
    const g = gaps.find((x) => x.id === sl.id)!;
    const c = new THREE.CatmullRomCurve3(sl.pts);
    return { key: sl.id, geo: new THREE.TubeGeometry(c, Math.max(8, sl.pts.length * 3), 0.0045, 6, false), mat: SHUT[g.status] };
  }), [car, gaps]);
  return <group>{lines.map((l) => <mesh key={l.key} geometry={l.geo} material={l.mat} renderOrder={4} />)}</group>;
}
