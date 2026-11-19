import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial, Html } from '@react-three/drei';
import { StudioEnvironment } from './StudioEnvironment';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useShowroomStore } from '../../store/useShowroomStore';
import { VehicleData } from '../../types/vehicle';
import { CarModel } from './CarModel';
import { specFor } from '../../three/carSpecs';

/** Height of the turntable deck the cars stand on. */
export const DECK_Y = 0.18;

// ------------------------------------------------------------------ textures
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function useFloorTexture() {
  return useMemo(() => {
    const t = canvasTexture(1024, 1024, (g) => {
      g.fillStyle = '#d8d5cf';
      g.fillRect(0, 0, 1024, 1024);
      const img = g.getImageData(0, 0, 1024, 1024);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 10;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      g.putImageData(img, 0, 0);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = Math.random() > 0.5 ? 'rgba(120,115,108,0.35)' : 'rgba(250,248,244,0.5)';
        const s = 1 + Math.random() * 3;
        g.fillRect(Math.random() * 1024, Math.random() * 1024, s, s);
      }
      g.strokeStyle = 'rgba(150,145,138,0.55)';
      g.lineWidth = 2;
      for (let x = 0; x <= 1024; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
      for (let y = 0; y <= 1024; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(12, 12);
    return t;
  }, []);
}

const blobTexture = canvasTexture(256, 256, (g) => {
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
});

const brandWallTexture = canvasTexture(2048, 560, (g) => {
  g.fillStyle = '#1d1f22';
  g.fillRect(0, 0, 2048, 560);
  const grd = g.createLinearGradient(0, 0, 0, 560);
  grd.addColorStop(0, 'rgba(255,255,255,0.05)');
  grd.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 2048, 560);
  const ls = g as unknown as { letterSpacing: string };
  g.fillStyle = '#e60012';
  g.font = '800 200px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  ls.letterSpacing = '38px';
  g.fillText('HONDA', 1024, 300);
  ls.letterSpacing = '14px';
  g.fillStyle = '#c9ccd1';
  g.font = '300 52px "Helvetica Neue", Arial, sans-serif';
  g.fillText('THE POWER OF DREAMS', 1024, 420);
  g.fillStyle = '#e60012';
  g.fillRect(824, 462, 400, 5);
});

function totemTexture(v: VehicleData) {
  return canvasTexture(400, 1100, (g) => {
    g.fillStyle = '#f6f5f2';
    g.fillRect(0, 0, 400, 1100);
    g.fillStyle = '#e60012';
    g.fillRect(40, 70, 70, 8);
    g.fillStyle = '#16181b';
    g.font = '700 46px "Helvetica Neue", Arial, sans-serif';
    const words = v.name.replace('Honda ', '').split(' ');
    let y = 160;
    let line = '';
    for (const w of words) {
      if ((line + ' ' + w).trim().length > 11) { g.fillText(line.trim(), 40, y); y += 56; line = w; }
      else line += ' ' + w;
    }
    g.fillText(line.trim(), 40, y);
    g.fillStyle = '#6b6f76';
    g.font = '400 24px "Helvetica Neue", Arial, sans-serif';
    g.fillText(v.categoryLabel.toUpperCase(), 40, y + 52);
    const rows: [string, string][] = [
      ['POWER', v.specs.power.split(' ').slice(0, 2).join(' ')],
      ['TORQUE', v.specs.torque.split(' ').slice(0, 2).join(' ')],
      ['0–100', v.specs.acceleration.replace('0-100 km/h in ', '')],
      ['TOP SPEED', v.specs.topSpeed],
    ];
    let ry = y + 150;
    for (const [k, val] of rows) {
      g.fillStyle = '#9a9ea5';
      g.font = '500 20px "Helvetica Neue", Arial, sans-serif';
      g.fillText(k, 40, ry);
      g.fillStyle = '#16181b';
      g.font = '600 36px "Helvetica Neue", Arial, sans-serif';
      g.fillText(val, 40, ry + 44);
      g.fillStyle = '#dedcd7';
      g.fillRect(40, ry + 66, 320, 2);
      ry += 120;
    }
    g.fillStyle = '#9a9ea5';
    g.font = '500 20px "Helvetica Neue", Arial, sans-serif';
    g.fillText('EX-SHOWROOM', 40, 978);
    g.fillStyle = '#16181b';
    g.font = '700 50px "Helvetica Neue", Arial, sans-serif';
    g.fillText(v.price, 40, 1030);
  });
}

// ------------------------------------------------------------------ light shafts + dust
const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const SHAFT_FRAG = /* glsl */ `
uniform float uK;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float fall = pow(vUv.y, 1.4);
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92), edge * fall * uK);
}`;

const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uH;
attribute float aSeed;
varying float vA;
void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.05 + aSeed * 0.08), uH);
  p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.25;
  p.z += cos(uTime * 0.25 + aSeed * 23.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(6.0, (14.0 + aSeed * 18.0) / -mv.z);
  vA = smoothstep(0.0, 1.2, p.y) * smoothstep(uH, uH - 2.0, p.y) * (0.35 + aSeed * 0.5) * smoothstep(1.5, 4.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(1.0, 0.98, 0.94, smoothstep(0.5, 0.0, d) * vA);
}`;

function LightShaft({ radius, height }: { radius: number; height: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, uniforms: { uK: { value: 0.05 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), []);
  const dust = useMemo(() => {
    const n = 220;
    const p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius * 0.85;
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = Math.random() * height; p[i * 3 + 2] = Math.sin(a) * r;
      s[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: { uTime: { value: 0 }, uH: { value: height } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }, [radius, height]);
  useFrame((s) => { (dust.material as THREE.ShaderMaterial).uniforms.uTime.value = s.clock.elapsedTime; });
  return (
    <group>
      <mesh position={[0, height / 2, 0]} material={mat} renderOrder={5} raycast={() => null}>
        <cylinderGeometry args={[0.35, radius, height, 48, 1, true]} />
      </mesh>
      <primitive object={dust} />
    </group>
  );
}

// ------------------------------------------------------------------ platform with turntable
function Platform({ v }: { v: VehicleData }) {
  const { viewMode, activeVehicleId, settings, inspectionDomain, setActiveVehicle, setViewMode, getOverallVehicleScore } = useShowroomStore();
  const spin = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  const angle = useRef(0);
  const spec = specFor(v.id);
  const focus = viewMode === 'inspection' && activeVehicleId === v.id;
  const totem = useMemo(() => totemTexture(v), [v.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const totemGeo = useMemo(() => new RoundedBoxGeometry(0.62, 2.2, 0.08, 3, 0.03), []);
  const R = v.platformRadius - 0.6;
  const warm = useMemo(() => new THREE.Color('#fff4e2'), []);
  const cool = useMemo(() => new THREE.Color('#7dd3fc'), []);

  useFrame((s, dt) => {
    if (focus) {
      // ADAS runs need a clear lane: front cars face the glass, rear cars face the back wall
      const want = inspectionDomain === 'electrical' ? (v.showroomPosition[2] >= 0 ? 0 : Math.PI) - v.showroomRotation[1] : 0;
      const d = Math.atan2(Math.sin(want - angle.current), Math.cos(want - angle.current));
      angle.current += d * Math.min(1, dt * 2.5);
    } else if (settings.autoRotateShowroom) angle.current += dt * 0.12;
    if (spin.current) spin.current.rotation.y = angle.current;
    if (ring.current) {
      const target = focus ? 5 : 2.4 + Math.sin(s.clock.elapsedTime * 1.4 + v.showroomPosition[0]) * 0.35;
      const k = Math.min(1, dt * 4);
      ring.current.emissiveIntensity += (target - ring.current.emissiveIntensity) * k;
      ring.current.emissive.lerp(focus ? cool : warm, k);
    }
  });

  return (
    <group position={v.showroomPosition}>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[R + 0.25, R + 0.32, 0.12, 96]} />
        <meshStandardMaterial color="#2a2c30" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[R + 0.05, R + 0.14, 128]} />
        <meshStandardMaterial ref={ring} color="#ffffff" emissive="#fff4e2" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <group ref={spin}>
        <mesh position={[0, 0.15, 0]} receiveShadow>
          <cylinderGeometry args={[R, R, 0.06, 96]} />
          <meshStandardMaterial color="#e9e8e4" metalness={0.15} roughness={0.42} />
        </mesh>
        {[0.35, 0.62, 0.86].map((k) => (
          <mesh key={k} position={[0, DECK_Y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[R * k - 0.006, R * k, 128]} />
            <meshBasicMaterial color="#c9c6bf" />
          </mesh>
        ))}
        <group position={[0, DECK_Y, 0]} rotation={v.showroomRotation}>
          <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} raycast={() => null}>
            <planeGeometry args={[spec.W + 0.9, spec.L + 1.0]} />
            <meshBasicMaterial map={blobTexture} transparent depthWrite={false} opacity={0.8} />
          </mesh>
          <CarModel vehicle={v} />
          {viewMode === 'showroom' && (
            <Html position={[0, 2.25, 0]} zIndexRange={[12, 5]}>
              <div className="spot" onClick={() => { setActiveVehicle(v.id); setViewMode('inspection'); }}>
                <b>{v.name.replace('Honda ', '')}<i>Inspect · {getOverallVehicleScore(v.id)}/100</i></b>
                <s />
              </div>
            </Html>
          )}
        </group>
      </group>

      <group position={[R + 1.15, 0, 0.9]} rotation={[0, -0.55, 0]} visible={!focus}>
        <mesh position={[0, 1.1, 0]} castShadow geometry={totemGeo}>
          <meshStandardMaterial color="#e7e5e0" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.15, 0.042]}>
          <planeGeometry args={[0.54, 1.48]} />
          <meshStandardMaterial map={totem} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.7, 0.04, 0.2]} />
          <meshStandardMaterial color="#2a2c30" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>

      <group position={[0, 8.2, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.05, 12, 96]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={focus ? 7 : 4} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.09, 12, 96]} />
          <meshStandardMaterial color="#2a2c30" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      <spotLight position={[0, 8, 0.01]} angle={0.62} penumbra={0.85} intensity={focus ? 90 : 60} decay={1.6} distance={20} color="#fff7ec" />
      <group position={[0, 0.1, 0]} visible={!focus}>
        <LightShaft radius={R + 0.2} height={8.1} />
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ architecture
const CHARCOAL = { color: '#2a2c30', metalness: 0.6, roughness: 0.35 } as const;

function Architecture({ reflect }: { reflect: boolean }) {
  const floorTex = useFloorTexture();
  const geos = useMemo(() => ({
    desk: new RoundedBoxGeometry(6.4, 1.1, 1.1, 4, 0.18),
    deskTop: new RoundedBoxGeometry(6.6, 0.07, 1.25, 3, 0.03),
    seat: new RoundedBoxGeometry(3.2, 0.4, 0.95, 4, 0.12),
    back: new RoundedBoxGeometry(3.2, 0.6, 0.22, 4, 0.1),
  }), []);
  const slats = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.07, 7.2, 0.12);
    const mat = new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.62 });
    const n = 150;
    const m = new THREE.InstancedMesh(geo, mat, n);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      o.position.set(-26.7, 4.4, -21 + i * 0.28);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.receiveShadow = true;
    return m;
  }, []);
  const slots = useMemo(() => {
    const geo = new THREE.BoxGeometry(46, 0.04, 0.18);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 3.2, toneMapped: false });
    const zs = [-18, -12, -6, 0, 6, 12, 18];
    const m = new THREE.InstancedMesh(geo, mat, zs.length);
    const o = new THREE.Object3D();
    zs.forEach((z, i) => { o.position.set(0, 9.48, z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    return m;
  }, []);
  const outside = useMemo(() => canvasTexture(16, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#cfe3f3');
    grd.addColorStop(0.55, '#eef4f7');
    grd.addColorStop(0.62, '#b9c6b4');
    grd.addColorStop(1, '#8e9a8a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 16, 256);
  }), []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[56, 48]} />
        {reflect ? (
          <MeshReflectorMaterial
            map={floorTex}
            blur={[400, 120]}
            resolution={1024}
            mixBlur={1}
            mixStrength={1.6}
            mirror={0.55}
            roughness={0.62}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            metalness={0.35}
            color="#ffffff"
          />
        ) : (
          <meshStandardMaterial map={floorTex} roughness={0.35} metalness={0.15} />
        )}
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 9.5, 0]}>
        <planeGeometry args={[56, 48]} />
        <meshStandardMaterial color="#f2f1ee" roughness={0.9} />
      </mesh>
      <primitive object={slots} />

      <mesh position={[0, 4.75, -24]} receiveShadow>
        <boxGeometry args={[56, 9.5, 0.4]} />
        <meshStandardMaterial color="#efeeea" roughness={0.85} />
      </mesh>
      <group position={[0, 5.2, -23.75]}>
        <mesh>
          <boxGeometry args={[20, 5.5, 0.12]} />
          <meshStandardMaterial color="#1d1f22" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <planeGeometry args={[19.6, 5.36]} />
          <meshStandardMaterial map={brandWallTexture} emissive="#ffffff" emissiveMap={brandWallTexture} emissiveIntensity={0.55} roughness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, s * 2.85, 0.02]}>
            <boxGeometry args={[20.4, 0.05, 0.05]} />
            <meshStandardMaterial color="#ffffff" emissive="#fff1dc" emissiveIntensity={4} toneMapped={false} />
          </mesh>
        ))}
      </group>

      <mesh position={[-27, 4.75, 0]} receiveShadow>
        <boxGeometry args={[0.4, 9.5, 48]} />
        <meshStandardMaterial color="#e9e6e0" roughness={0.9} />
      </mesh>
      <primitive object={slats} />

      {([
        { pos: [0, 4.75, 24] as [number, number, number], rot: 0, len: 56 },
        { pos: [28, 4.75, 0] as [number, number, number], rot: Math.PI / 2, len: 48 },
      ]).map((f, i) => (
        <group key={i} position={f.pos} rotation={[0, f.rot, 0]}>
          <mesh>
            <planeGeometry args={[f.len, 9.5]} />
            <meshPhysicalMaterial color="#dfe9ee" transparent opacity={0.18} roughness={0.05} metalness={0.1} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {Array.from({ length: Math.floor(f.len / 4) + 1 }, (_, k) => -f.len / 2 + k * 4).map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.12, 9.5, 0.2]} />
              <meshStandardMaterial color="#3a3d42" metalness={0.7} roughness={0.35} />
            </mesh>
          ))}
          <mesh position={[0, 3.2, 0]}>
            <boxGeometry args={[f.len, 0.12, 0.2]} />
            <meshStandardMaterial color="#3a3d42" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 2, 6]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[f.len + 30, 22]} />
            <meshBasicMaterial map={outside} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {[[-21.5, -16], [21.5, -16], [-21.5, 16], [21.5, 16]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 4.75, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.42, 9.5, 48]} />
            <meshStandardMaterial color="#f4f3f0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.06, 48]} />
            <meshStandardMaterial {...CHARCOAL} />
          </mesh>
          <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.54, 48]} />
            <meshStandardMaterial color="#ffffff" emissive="#fff1dc" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <group position={[12.5, 0, 18]} rotation={[0, -0.5, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow geometry={geos.desk}>
          <meshStandardMaterial color="#f4f3ef" roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.13, 0]} castShadow geometry={geos.deskTop}>
          <meshStandardMaterial color="#b98a5a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.12, -0.56]}>
          <boxGeometry args={[6.0, 0.03, 0.03]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff1dc" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>

      <group position={[-20, 0, 2]}>
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[3.2, 64]} />
          <meshStandardMaterial color="#cbc4b8" roughness={0.95} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * 1.9]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
            <mesh position={[0, 0.28, 0]} castShadow receiveShadow geometry={geos.seat}>
              <meshStandardMaterial color="#5b6670" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.62, -0.38]} castShadow geometry={geos.back}>
              <meshStandardMaterial color="#5b6670" roughness={0.85} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.8, 0.8, 0.06, 48]} />
          <meshStandardMaterial color="#b98a5a" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 0.2, 16]} />
          <meshStandardMaterial {...CHARCOAL} />
        </mesh>
        {[[-2.4, -0.2], [2.4, 0.3]].map(([x, z]) => (
          <group key={x} position={[x, 0, z]}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.2, 0.6, 24]} />
              <meshStandardMaterial color="#e7e3dc" roughness={0.7} />
            </mesh>
            {Array.from({ length: 9 }, (_, i) => i).map((i) => (
              <mesh key={i} position={[Math.cos(i * 2.4) * 0.22, 0.95 + (i % 3) * 0.28, Math.sin(i * 2.4) * 0.22]} castShadow>
                <icosahedronGeometry args={[0.24 - (i % 3) * 0.04, 0]} />
                <meshStandardMaterial color={i % 2 ? '#4f6b3f' : '#5f7d4a'} roughness={0.8} flatShading />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

const DBG = new URLSearchParams(window.location.search);

export function ShowroomScene() {
  const { vehicles, settings } = useShowroomStore();
  return (
    <group>
      {!DBG.has('noenv') && <StudioEnvironment />}

      <hemisphereLight args={['#ffffff', '#8f8a82', 0.25]} />
      <directionalLight
        position={[9, 18, 7]}
        intensity={1.3}
        color="#fff6ea"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-12, 10, -8]} intensity={0.5} color="#eaf1ff" />

      {!DBG.has('noarch') && <Architecture reflect={settings.highQualityShadows && !DBG.has('norefl')} />}
      {!DBG.has('nocars') && vehicles.map((v) => <Platform key={v.id} v={v} />)}
    </group>
  );
}
