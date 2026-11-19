import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BuiltCar, buildCar } from '../../three/buildCar';
import { specFor } from '../../three/carSpecs';
import { VehicleData } from '../../types/vehicle';
import { useShowroomStore } from '../../store/useShowroomStore';
import { useControls } from '../../sim/controls';
import { live } from '../../sim/sim';

const STEEL = new THREE.MeshStandardMaterial({ color: '#3a3e44', metalness: 0.7, roughness: 0.4 });
const YELLOW = new THREE.MeshStandardMaterial({ color: '#e0b21b', metalness: 0.3, roughness: 0.5 });
const ROLLER = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.9, roughness: 0.25 });
const PIT = new THREE.MeshStandardMaterial({ color: '#16181b', metalness: 0.4, roughness: 0.7 });
const RUBBER = new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.9 });

/** Visual distance on the test lane for a real distance, compressed so 100 m fits in the hall. */
export const laneZ = (d: number) => 1.2 + 14 * (1 - Math.exp(-Math.max(0, d) / 32));

export function TestRig({ car, vehicle }: { car: BuiltCar; vehicle: VehicleData }) {
  const domain = useShowroomStore((s) => s.inspectionDomain);
  const c = useControls();
  const rollers = domain === 'engine' || domain === 'interior' || domain === 'electrical' || (domain === 'undercarriage' && c.chassis === 'brakes');
  return (
    <group>
      {rollers && <Dyno car={car} />}
      {domain === 'undercarriage' && c.chassis === 'shaker' && <Shaker car={car} />}
      {domain === 'undercarriage' && c.chassis === 'hoist' && <Hoist car={car} />}
      {domain === 'electrical' && <AdasLane car={car} vehicle={vehicle} />}
      {domain === 'interior' && c.interior === 'climate' && <Climate car={car} />}
    </group>
  );
}

function Dyno({ car }: { car: BuiltCar }) {
  const rolls = useRef<THREE.Mesh[]>([]);
  const { track, zA1, zA2 } = car.dims;
  const len = track + 0.55;
  useFrame(() => { for (const r of rolls.current) r.rotation.x = -live.roller; });
  return (
    <group>
      {[zA1, zA2].map((za) => (
        <group key={za} position={[0, 0, za]}>
          <mesh position={[0, 0.004, 0]} receiveShadow>
            <boxGeometry args={[len + 0.2, 0.008, 0.95]} />
            <meshStandardMaterial color="#1c1e22" metalness={0.4} roughness={0.6} transparent opacity={0.92} />
          </mesh>
          {[-0.21, 0.21].map((dz, i) => (
            <mesh key={dz} ref={(m) => { if (m) rolls.current[(za === zA1 ? 0 : 2) + i] = m; }} position={[0, -0.12, dz]} rotation={[0, 0, Math.PI / 2]} material={ROLLER}>
              <cylinderGeometry args={[0.16, 0.16, len, 40]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (len / 2 + 0.1), 0.02, 0]} material={YELLOW}>
              <boxGeometry args={[0.06, 0.04, 0.95]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Shaker({ car }: { car: BuiltCar }) {
  const posts = useRef<THREE.Group[]>([]);
  useFrame(() => {
    car.corners.forEach((_, i) => {
      const p = posts.current[i];
      if (p) p.position.y = 0.14 + live.zr[i];
    });
  });
  return (
    <group>
      {car.corners.map((cn, i) => (
        <group key={i} position={[cn.pos.x, 0, cn.pos.z]}>
          <mesh position={[0, 0.03, 0]} material={STEEL}>
            <cylinderGeometry args={[0.26, 0.3, 0.06, 32]} />
          </mesh>
          <mesh position={[0, 0.08, 0]} material={YELLOW}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 20]} />
          </mesh>
          <group ref={(g) => { if (g) posts.current[i] = g; }}>
            <mesh position={[0, -0.02, 0]} material={STEEL}>
              <cylinderGeometry args={[0.2, 0.2, 0.04, 32]} />
            </mesh>
            <mesh position={[0, -0.002, 0]} material={RUBBER}>
              <cylinderGeometry args={[0.19, 0.19, 0.006, 32]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function Hoist({ car }: { car: BuiltCar }) {
  const arms = useRef<THREE.Group>(null);
  const { W, zA1, zA2, b0 } = car.dims;
  const px = W / 2 + 0.55;
  const zMid = (zA1 + zA2) / 2;
  useFrame(() => { if (arms.current) arms.current.position.y = car.root.position.y + b0 - 0.05; });
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * px, 0, zMid]}>
          <mesh position={[0, 1.6, 0]} material={STEEL} castShadow>
            <boxGeometry args={[0.22, 3.2, 0.28]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={STEEL}>
            <boxGeometry args={[0.6, 0.04, 0.7]} />
          </mesh>
          <mesh position={[s * 0.12, 1.6, 0]} material={YELLOW}>
            <boxGeometry args={[0.02, 3.0, 0.08]} />
          </mesh>
        </group>
      ))}
      <group ref={arms}>
        {[-1, 1].map((s) =>
          [zA1 - 0.55, zA2 + 0.5].map((z) => (
            <group key={`${s}${z}`}>
              <mesh position={[s * (px - (px - 0.55) / 2), -0.05, (zMid + z) / 2]} rotation={[0, Math.atan2(z - zMid, px - 0.55) * -s, 0]} material={YELLOW} castShadow>
                <boxGeometry args={[Math.hypot(px - 0.55, z - zMid), 0.07, 0.1]} />
              </mesh>
              <mesh position={[s * 0.55, 0, z]} material={RUBBER}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 20]} />
              </mesh>
            </group>
          )),
        )}
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ Honda Sensing test lane
const LANE_FRAG = /* glsl */ `
uniform float uScroll; varying vec2 vUv;
void main(){
  float x = abs(vUv.x - 0.5) * 2.0;
  float edge = smoothstep(0.93, 0.95, x) * (1.0 - smoothstep(0.985, 1.0, x));
  float dash = step(0.5, fract(vUv.y * 9.0 - uScroll)) * smoothstep(0.015, 0.0, abs(vUv.x - 0.5) - 0.006);
  float fade = smoothstep(1.0, 0.75, vUv.y) * smoothstep(0.0, 0.05, vUv.y);
  vec3 col = vec3(0.12, 0.13, 0.15);
  float line = max(edge, dash);
  col = mix(col, vec3(0.95), line);
  gl_FragColor = vec4(col, (0.55 + line * 0.45) * fade);
}`;
const SWEEP_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uK; varying vec2 vUv;
void main(){
  float r = vUv.y;
  float rings = smoothstep(0.9, 1.0, sin((r * 30.0 - uTime * 6.0)));
  float a = (0.16 + rings * 0.45) * (1.0 - r * 0.85) * uK;
  gl_FragColor = vec4(uColor, a);
}`;
const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const GHOST_TARGET = new THREE.MeshStandardMaterial({ color: '#2b4b6b', transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.4 });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: '#7cc4ff', transparent: true, opacity: 0.6 });

function AdasLane({ car }: { car: BuiltCar; vehicle: VehicleData }) {
  const L0 = car.dims.L / 2;
  const laneMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: LANE_FRAG, uniforms: { uScroll: { value: 0 } }, transparent: true, depthWrite: false }), []);
  const radarMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: SWEEP_FRAG, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#0284c7') }, uK: { value: 1.6 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }), []);
  const camMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: SWEEP_FRAG, uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#4d7c0f') }, uK: { value: 0.9 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }), []);
  // radar fan as a ring sector so vUv.y runs along the range
  const radarGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.05, 14, 48, 8, Math.PI / 2 - 0.17, 0.34);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, Math.hypot(p.getX(i), p.getY(i)) / 14);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const camGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.05, 11, 48, 8, Math.PI / 2 - 0.45, 0.9);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, Math.hypot(p.getX(i), p.getY(i)) / 11);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const target = useMemo(() => {
    const t = buildCar(specFor('honda-amaze'), { hybrid: false, turbo: false, manual: false });
    const g = new THREE.Group();
    t.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.userData.body || m.userData.mk === 'rubber') && m.userData.mk !== 'inner' && !m.userData.cabin) {
        const mm = new THREE.Mesh(m.geometry, GHOST_TARGET);
        m.updateWorldMatrix(true, false);
        mm.applyMatrix4(m.matrixWorld);
        g.add(mm);
      }
    });
    g.rotation.y = 0;
    return g;
  }, []);
  const ped = useMemo(() => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.0, 6, 12), GHOST_TARGET).translateY(0.75));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), GHOST_TARGET).translateY(1.55));
    return g;
  }, []);
  const box = useMemo(() => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.9, 1.55, 4.1)), new THREE.LineBasicMaterial({ color: '#38bdf8', toneMapped: false })), []);
  const tRef = useRef<THREE.Group>(null);
  const pRef = useRef<THREE.Group>(null);
  const bRef = useRef<THREE.Group>(null);
  const warn = useRef<THREE.Mesh>(null);
  const sensors = useControls((s) => s.sensors);
  useFrame((st, dt) => {
    const L = live;
    laneMat.uniforms.uScroll.value = L.laneScroll / 2.2;
    radarMat.uniforms.uTime.value += dt;
    camMat.uniforms.uTime.value += dt;
    const col = L.adas === 'AEB' ? '#ef4444' : L.adas === 'FCW' ? '#f59e0b' : '#38bdf8';
    radarMat.uniforms.uColor.value.set(L.adas === 'AEB' ? '#dc2626' : L.adas === 'FCW' ? '#d97706' : '#0284c7');
    const zt = L0 + laneZ(L.targetDist);
    const showT = L.targetDist > 0 && !L.pedestrian;
    if (tRef.current) { tRef.current.visible = showT; tRef.current.position.set(0, 0, zt + 2.0); }
    if (pRef.current) { pRef.current.visible = L.pedestrian; pRef.current.position.set(L.targetLat * 0.8, 0, zt); }
    if (bRef.current) {
      bRef.current.visible = L.detected && (showT || L.pedestrian);
      bRef.current.position.set(L.pedestrian ? L.targetLat * 0.8 : 0, L.pedestrian ? 0.85 : 0.78, L.pedestrian ? zt : zt + 2.0);
      bRef.current.scale.set(L.pedestrian ? 0.36 : 1, L.pedestrian ? 1.15 : 1, L.pedestrian ? 0.15 : 1);
      ((bRef.current.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).color.set(col);
    }
    if (warn.current) {
      const on = L.adas === 'AEB' || L.adas === 'FCW';
      const m = warn.current.material as THREE.MeshBasicMaterial;
      m.opacity = on ? 0.25 + Math.sin(st.clock.elapsedTime * 14) * 0.15 : 0;
      m.color.set(col);
    }
  });
  const lane = L.lane;
  return (
    <group>
      <mesh position={[lane * 0.3, 0.012, L0 + 7.5]} rotation={[-Math.PI / 2, 0, 0]} material={laneMat}>
        <planeGeometry args={[3.7, 19, 1, 1]} />
      </mesh>
      {sensors && (
        <>
          <mesh geometry={radarGeo} material={radarMat} position={[0, car.dims.b0 + 0.3, L0 - 0.02]} />
          <mesh geometry={camGeo} material={camMat} position={[0, car.dims.roofY - 0.1, L0 - 1.6]} />
        </>
      )}
      <group ref={tRef}>
        <primitive object={target} />
      </group>
      <group ref={pRef}><primitive object={ped} /></group>
      <group ref={bRef}><primitive object={box} /></group>
      <mesh ref={warn} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 3.0, 64]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
const L = live;

// ------------------------------------------------------------------ cabin airflow
function Climate({ car }: { car: BuiltCar }) {
  const N = 900;
  const pts = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(N), 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#5fd0ff') } },
      vertexShader: /* glsl */ `attribute float aLife; varying float vL; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = 22.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vL; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor, smoothstep(0.5, 0.1, d) * vL * 0.55); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }, []);
  const state = useMemo(() => ({ age: new Float32Array(N).map(() => Math.random() * 2.5), vel: new Float32Array(N * 3) }), []);
  useFrame((_, dt) => {
    const pos = pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    const life = pts.geometry.getAttribute('aLife') as THREE.BufferAttribute;
    const vents = car.vents;
    const cold = live.ventT < live.cabinT;
    (pts.material as THREE.ShaderMaterial).uniforms.uColor.value.set(cold ? '#5fd0ff' : '#ff9a4a');
    for (let i = 0; i < N; i++) {
      state.age[i] += dt;
      if (state.age[i] > 2.6) {
        state.age[i] = 0;
        const v = vents[i % vents.length];
        pos.setXYZ(i, v.pos.x + (Math.random() - 0.5) * 0.05, v.pos.y + (Math.random() - 0.5) * 0.02, v.pos.z);
        const sp = 0.9 + Math.random() * 0.5;
        state.vel[i * 3] = v.dir.x * sp + (Math.random() - 0.5) * 0.25;
        state.vel[i * 3 + 1] = v.dir.y * sp + (Math.random() - 0.5) * 0.15;
        state.vel[i * 3 + 2] = v.dir.z * sp;
      }
      // the stream slows, spreads and (cold) sinks or (warm) rises
      state.vel[i * 3] *= 1 - dt * 0.6; state.vel[i * 3 + 2] *= 1 - dt * 0.7;
      state.vel[i * 3 + 1] += (cold ? -0.25 : 0.2) * dt;
      pos.setXYZ(i, pos.getX(i) + state.vel[i * 3] * dt, pos.getY(i) + state.vel[i * 3 + 1] * dt, pos.getZ(i) + state.vel[i * 3 + 2] * dt);
      const a = state.age[i] / 2.6;
      life.setX(i, Math.sin(Math.PI * a));
    }
    pos.needsUpdate = true;
    life.needsUpdate = true;
  });
  return <primitive object={pts} />;
}
