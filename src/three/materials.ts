import * as THREE from 'three';

/** Material keys that geometry is tagged with (mesh.userData.mk). */
export type MatKey =
  | 'paint' | 'roofPaint' | 'glass' | 'chrome' | 'trimBlack' | 'cladding' | 'under' | 'inner'
  | 'lamp' | 'drl' | 'tail' | 'grille' | 'grilleLow' | 'rubber' | 'rim' | 'rimDark' | 'disc' | 'caliper'
  | 'interior' | 'interiorDark' | 'leather' | 'leatherInsert' | 'headliner' | 'trim' | 'carpet' | 'ambient' | 'cluster' | 'info'
  | 'alu' | 'engineBlack' | 'engineAccent' | 'piston' | 'spark' | 'magnet' | 'cells' | 'hose' | 'tank' | 'spring' | 'damper'
  | 'radiator' | 'copper' | 'cable' | 'cableHV' | 'steel' | 'carbon' | 'plate' | 'sensor' | 'lens' | 'led';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

let shared: Record<string, THREE.Material> | null = null;

function sharedMaterials(): Record<string, THREE.Material> {
  if (shared) return shared;
  const honeycomb = canvasTex(64, 64, (g) => {
    g.fillStyle = '#050608';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#2b2f36';
    g.lineWidth = 3;
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++) {
        const cx = x * 32 + (y % 2) * 16, cy = y * 28;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          g.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
        }
        g.closePath();
        g.stroke();
      }
  }, [18, 5]);
  const fins = canvasTex(64, 64, (g) => {
    g.fillStyle = '#6b7178';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3a3f45';
    for (let x = 0; x < 64; x += 4) g.fillRect(x, 0, 2, 64);
    g.fillStyle = '#8a9097';
    for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 3);
  }, [10, 4]);
  const carbon = canvasTex(32, 32, (g) => {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? '#15171b' : '#272a30';
        g.fillRect(x * 8, y * 8, 8, 8);
      }
  }, [30, 30]);
  const fabric = canvasTex(64, 64, (g) => {
    g.fillStyle = '#d9d6cf';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
      g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
  }, [20, 20]);
  const carpet = canvasTex(64, 64, (g) => {
    g.fillStyle = '#1d1e21';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)';
      g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
  }, [12, 12]);
  const cells = canvasTex(64, 64, (g) => {
    g.fillStyle = '#3a6b8f';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#21445e';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 2, 64);
    g.fillStyle = '#d6dde3';
    g.fillRect(0, 0, 64, 6);
  });
  const plate = canvasTex(256, 56, (g) => {
    g.fillStyle = '#f4f4f0';
    g.fillRect(0, 0, 256, 56);
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    g.strokeRect(3, 3, 250, 50);
    g.fillStyle = '#111';
    g.font = 'bold 34px monospace';
    g.textAlign = 'center';
    g.fillText('TQM 2026', 128, 40);
  });

  shared = {
    glass: new THREE.MeshPhysicalMaterial({ color: '#05080c', metalness: 0.35, roughness: 0.02, transparent: true, opacity: 0.72, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e8ecef', metalness: 1, roughness: 0.06, envMapIntensity: 1.6 }),
    trimBlack: new THREE.MeshPhysicalMaterial({ color: '#07080a', metalness: 0.3, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    cladding: new THREE.MeshStandardMaterial({ color: '#16181b', metalness: 0, roughness: 0.78 }),
    under: new THREE.MeshStandardMaterial({ color: '#1b1d20', metalness: 0.2, roughness: 0.85 }),
    inner: new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    lamp: new THREE.MeshPhysicalMaterial({ color: '#dfe6ec', metalness: 0.55, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.2, emissive: '#9fb4c8', emissiveIntensity: 0.15 }),
    drl: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f4ff', emissiveIntensity: 4 }),
    tail: new THREE.MeshPhysicalMaterial({ color: '#5a0006', emissive: '#ff1428', emissiveIntensity: 1.6, roughness: 0.1, clearcoat: 1 }),
    grille: new THREE.MeshStandardMaterial({ color: '#ffffff', map: honeycomb, metalness: 0.4, roughness: 0.35 }),
    grilleLow: new THREE.MeshStandardMaterial({ color: '#0c0d10', metalness: 0.1, roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#141518', metalness: 0, roughness: 0.92, side: THREE.DoubleSide }),
    disc: new THREE.MeshStandardMaterial({ color: '#8d9298', metalness: 0.9, roughness: 0.38 }),
    interiorDark: new THREE.MeshStandardMaterial({ color: '#1a1b1e', metalness: 0.05, roughness: 0.62 }),
    headliner: new THREE.MeshStandardMaterial({ color: '#ffffff', map: fabric, roughness: 0.95, side: THREE.DoubleSide }),
    carpet: new THREE.MeshStandardMaterial({ color: '#ffffff', map: carpet, roughness: 1 }),
    ambient: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffb066', emissiveIntensity: 5, toneMapped: false }),
    alu: new THREE.MeshStandardMaterial({ color: '#a7adb3', metalness: 0.85, roughness: 0.42 }),
    engineBlack: new THREE.MeshStandardMaterial({ color: '#1a1b1e', metalness: 0.4, roughness: 0.55 }),
    piston: new THREE.MeshStandardMaterial({ color: '#c9ced3', metalness: 0.9, roughness: 0.3 }),
    spark: new THREE.MeshBasicMaterial({ color: '#ffd29a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    magnet: new THREE.MeshStandardMaterial({ color: '#6a8cff', metalness: 0.6, roughness: 0.3 }),
    cells: new THREE.MeshStandardMaterial({ color: '#ffffff', map: cells, metalness: 0.3, roughness: 0.5 }),
    hose: new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.7 }),
    tank: new THREE.MeshStandardMaterial({ color: '#2c2f34', metalness: 0.3, roughness: 0.6 }),
    spring: new THREE.MeshPhysicalMaterial({ color: '#c8102e', metalness: 0.4, roughness: 0.35, clearcoat: 1 }),
    damper: new THREE.MeshStandardMaterial({ color: '#d9b334', metalness: 0.6, roughness: 0.35 }),
    radiator: new THREE.MeshStandardMaterial({ color: '#ffffff', map: fins, metalness: 0.6, roughness: 0.5 }),
    copper: new THREE.MeshStandardMaterial({ color: '#b87333', metalness: 1, roughness: 0.3 }),
    cable: new THREE.MeshStandardMaterial({ color: '#1c1d20', metalness: 0, roughness: 0.6 }),
    cableHV: new THREE.MeshStandardMaterial({ color: '#f97316', metalness: 0, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c3c7cb', metalness: 1, roughness: 0.22 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: carbon, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    plate: new THREE.MeshStandardMaterial({ color: '#ffffff', map: plate, roughness: 0.5 }),
    sensor: new THREE.MeshPhysicalMaterial({ color: '#0d0f12', metalness: 0.5, roughness: 0.15, clearcoat: 1 }),
    lens: new THREE.MeshPhysicalMaterial({ color: '#10243a', metalness: 0.2, roughness: 0.02, clearcoat: 1 }),
    led: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#4ade80', emissiveIntensity: 4, toneMapped: false }),
  };
  for (const [k, m] of Object.entries(shared)) m.name = k;
  return shared;
}

export interface CarColors {
  bodyColor: string;
  rimColor: string;
  caliperColor: string;
  interiorColor: string;
}

export interface Screen { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }
function screen(w: number, h: number): Screen {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas, ctx, tex };
}

/** Materials for one car: shared library plus this car's paint, rims, calipers, cabin and live screens. */
export function makeCarMaterials(c: CarColors, metallic: number, blackRoof: boolean) {
  const s = sharedMaterials();
  const paint = new THREE.MeshPhysicalMaterial({
    color: c.bodyColor, metalness: metallic, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: 1.35, name: 'paint',
  });
  const light = new THREE.Color(c.interiorColor).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
  const perf = canvasTex(64, 64, (g) => {
    g.fillStyle = c.interiorColor;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)';
    for (let y = 2; y < 64; y += 6) for (let x = (y % 12) ? 2 : 5; x < 64; x += 6) { g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); }
  }, [8, 8]);
  const rimLight = new THREE.Color(c.rimColor).getHSL({ h: 0, s: 0, l: 0 }).l > 0.35;
  const cluster = screen(512, 170);
  const info = screen(512, 310);
  const m: Record<string, THREE.Material> = {
    ...s,
    paint,
    roofPaint: blackRoof ? s.trimBlack : paint,
    rim: new THREE.MeshPhysicalMaterial({ color: c.rimColor, metalness: rimLight ? 0.95 : 0.6, roughness: rimLight ? 0.18 : 0.35, clearcoat: 1, clearcoatRoughness: 0.1, name: 'rim' }),
    rimDark: new THREE.MeshStandardMaterial({ color: '#2a2d31', metalness: 0.7, roughness: 0.4 }),
    caliper: new THREE.MeshPhysicalMaterial({ color: c.caliperColor, metalness: 0.2, roughness: 0.35, clearcoat: 1, name: 'caliper' }),
    interior: new THREE.MeshStandardMaterial({ color: c.interiorColor, metalness: 0, roughness: 0.7, name: 'interior' }),
    trim: new THREE.MeshStandardMaterial({ color: light ? c.interiorColor : '#2a2b2f', metalness: 0, roughness: 0.75, side: THREE.DoubleSide, name: 'trim' }),
    leather: new THREE.MeshPhysicalMaterial({ color: light ? c.interiorColor : '#1d1e21', metalness: 0, roughness: 0.5, sheen: 0.4, sheenColor: '#ffffff', name: 'leather' }),
    leatherInsert: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: perf, metalness: 0, roughness: 0.62, sheen: 0.3, sheenColor: '#ffffff', name: 'leatherInsert' }),
    engineAccent: new THREE.MeshPhysicalMaterial({ color: '#b3121b', metalness: 0.3, roughness: 0.3, clearcoat: 1 }),
    cluster: new THREE.MeshBasicMaterial({ map: cluster.tex, toneMapped: false }),
    info: new THREE.MeshBasicMaterial({ map: info.tex, toneMapped: false }),
  };
  return { mats: m as Record<MatKey, THREE.Material>, screens: { cluster, info } };
}

// ------------------------------------------------------------------ special shaders

/** Dashes that run along a tube: energy, fuel, coolant, exhaust gas, brake fluid, CAN frames. */
export function makeFlowMaterial(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uSpeed: { value: 1 }, uOn: { value: 0 }, uLen: { value: 1 }, uDash: { value: 0.12 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime, uSpeed, uOn, uLen, uDash; varying vec2 vUv;
      void main(){
        float s = vUv.x * uLen / uDash - uTime * uSpeed / uDash;
        float d = fract(s);
        float pulse = smoothstep(0.0, 0.15, d) * smoothstep(0.75, 0.35, d);
        float a = (0.18 + pulse * 0.82) * uOn;
        gl_FragColor = vec4(uColor * (1.2 + pulse * 3.0), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * Section-cut variant of a material: double sided, clipped by the plane, and back faces
 * (where the plane opens a solid) shade as a flat hatched cap, like a technical drawing.
 */
export function cutVariant(src: THREE.Material, planes: THREE.Plane[], cap: THREE.Color): THREE.Material {
  const m = src.clone();
  m.side = THREE.DoubleSide;
  m.clippingPlanes = planes;
  m.clipShadows = true;
  const capU = { value: cap };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCap = capU;
    sh.fragmentShader = 'uniform vec3 uCap;\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (!gl_FrontFacing) {
        float hatch = step(0.82, fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0));
        gl_FragColor = vec4(uCap * (1.0 - hatch * 0.35), 1.0);
      }`,
    );
  };
  m.customProgramCacheKey = () => 'cut-' + src.uuid;
  return m;
}

export interface Hotspot { pos: THREE.Vector3; r: number; k: number }

/** Paint film thickness map (µm): the same field drives the shader and the statistics. */
export function paintThickness(p: THREE.Vector3, spots: Hotspot[]) {
  const n = Math.sin(p.x * 3.1 + p.z * 1.7) * 0.5 + Math.sin(p.y * 7.3 - p.z * 2.9) * 0.35 + Math.sin(p.x * 11.0 + p.y * 5.0 + p.z * 4.0) * 0.15;
  let t = 134 + n * 6 + (p.y < 0.5 ? -3 : 0);
  for (const s of spots) {
    const d = p.distanceTo(s.pos);
    if (d < s.r) t -= s.k * (1 - d / s.r) * (1 - d / s.r);
  }
  return t;
}

export function paintMapMaterial(spots: Hotspot[]) {
  const arr = new Array(4).fill(0).map((_, i) => (spots[i] ? new THREE.Vector4(spots[i].pos.x, spots[i].pos.y, spots[i].pos.z, spots[i].r) : new THREE.Vector4(0, -9, 0, 0.001)));
  const ks = new Array(4).fill(0).map((_, i) => (spots[i] ? spots[i].k : 0));
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSpots = { value: arr };
    sh.uniforms.uK = { value: ks };
    sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = `varying vec3 vP; uniform vec4 uSpots[4]; uniform float uK[4];
      vec3 ramp(float x){ x = clamp(x,0.0,1.0);
        vec3 a = vec3(0.12,0.32,0.95), b = vec3(0.1,0.78,0.9), c = vec3(0.25,0.85,0.35), d = vec3(0.98,0.82,0.2), e = vec3(0.95,0.22,0.18);
        if (x < 0.25) return mix(a,b,x/0.25); if (x < 0.5) return mix(b,c,(x-0.25)/0.25); if (x < 0.75) return mix(c,d,(x-0.5)/0.25); return mix(d,e,(x-0.75)/0.25); }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float n = sin(vP.x*3.1 + vP.z*1.7)*0.5 + sin(vP.y*7.3 - vP.z*2.9)*0.35 + sin(vP.x*11.0 + vP.y*5.0 + vP.z*4.0)*0.15;
        float th = 134.0 + n*6.0 + (vP.y < 0.5 ? -3.0 : 0.0);
        for (int i = 0; i < 4; i++) { float d = distance(vP, uSpots[i].xyz); if (d < uSpots[i].w) { float f = 1.0 - d/uSpots[i].w; th -= uK[i]*f*f; } }
        float x = (th - 105.0) / 45.0;
        vec3 col = ramp(x);
        float iso = abs(fract(th / 4.0) - 0.5);
        col *= 0.78 + 0.22 * smoothstep(0.0, 0.08, iso);
        diffuseColor.rgb = col;`);
  };
  m.customProgramCacheKey = () => 'paintmap';
  return m;
}

/** Zebra stripes: a surface-quality check — reflections of straight light bars must stay smooth; a dent kinks them. */
export function zebraMaterial(spots: Hotspot[]) {
  const arr = new Array(4).fill(0).map((_, i) => (spots[i] ? new THREE.Vector4(spots[i].pos.x, spots[i].pos.y, spots[i].pos.z, spots[i].r) : new THREE.Vector4(0, -9, 0, 0.001)));
  return new THREE.ShaderMaterial({
    uniforms: { uSpots: { value: arr } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vP = position; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform vec4 uSpots[4];
      void main(){
        vec3 n = normalize(vN);
        for (int i = 0; i < 4; i++) { vec3 d = vP - uSpots[i].xyz; float l = length(d); if (l < uSpots[i].w) { float f = 1.0 - l/uSpots[i].w; n = normalize(n + normalize(d + 1e-4) * f * f * 0.9); } }
        vec3 r = reflect(-normalize(vV), n);
        float s = sin(r.y * 26.0 + r.x * 4.0);
        float band = smoothstep(-0.12, 0.12, s);
        float fres = pow(1.0 - abs(dot(n, normalize(vV))), 3.0);
        vec3 col = mix(vec3(0.04), vec3(0.96), band) * (0.85 + fres * 0.2);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
