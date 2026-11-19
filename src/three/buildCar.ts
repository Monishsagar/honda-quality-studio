import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CarSpec } from './carSpecs';
import { MatKey } from './materials';

/**
 * Procedural car. The body is lofted through cross sections along the length (the
 * station-loft method from airsup-lab, MIT) and every quad is classified into a panel,
 * so each inspectable component is its own group. Around it: a full cabin, an engine
 * with moving internals, the e:HEV or CVT driveline, chassis, fluids and wiring, all
 * with handles the simulation animates.
 *
 * Frame: +z forward, +y up, x across (driver on -x, right-hand drive), tyres touch y = 0.
 */

export interface PartData {
  compId: string | null;
  explode: THREE.Vector3;
  base: THREE.Vector3;
  domain: 'exterior' | 'interior' | 'engine' | 'undercarriage' | 'electrical' | 'shell';
}

export interface Corner {
  front: boolean;
  side: number;
  hub: THREE.Group;
  steer: THREE.Group;
  spin: THREE.Group;
  bhub: THREE.Group;
  bsteer: THREE.Group;
  disc: THREE.Mesh;
  spring: THREE.Object3D;
  springLen: number;
  pos: THREE.Vector3;
}

export interface ShutLine { id: string; compId: string | null; label: string; pts: THREE.Vector3[]; part: string }

export interface BuiltCar {
  root: THREE.Group;
  sprung: THREE.Group;
  parts: THREE.Group[];
  corners: Corner[];
  hoodPivot: THREE.Group;
  engine: { crank: THREE.Object3D; pistons: THREE.Object3D[]; rods: THREE.Object3D[]; cams: THREE.Object3D[]; valves: THREE.Object3D[]; sparks: THREE.Mesh[]; pulleys: THREE.Object3D[]; fan: THREE.Object3D; turbo: THREE.Object3D | null; rotor: THREE.Object3D | null; crankY: number; stroke: number; rod: number; pinY: number };
  steeringWheel: THREE.Object3D;
  rack: THREE.Object3D;
  anchors: Record<string, THREE.Object3D>;
  shutLines: ShutLine[];
  vents: { pos: THREE.Vector3; dir: THREE.Vector3 }[];
  dims: {
    L: number; W: number; zA1: number; zA2: number; track: number; R: number; b0: number; tyreW: number;
    cowlZ: number; beltY: number; roofY: number; eye: THREE.Vector3; rearEye: THREE.Vector3; seatZ: number; hoodHinge: THREE.Vector3; engine: THREE.Vector3;
  };
  surface: { top: (t: number) => number; zOf: (t: number) => number };
}

type P2 = [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Monotone cubic (Fritsch–Carlson) through [x, y] points. */
function mono(pts: P2[]) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (n === 1) return () => ys[0];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** Bake every static mesh under a part group into one mesh per (material, sidedness). Animated subtrees stay as they are. */
function mergePart(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const buckets = new Map<string, { mk: string; double: boolean; cast: boolean; geos: THREE.BufferGeometry[] }>();
  const remove: THREE.Mesh[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== g && o.userData.anim) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.body && !m.userData.flow && !m.userData.keep) {
      const key = `${m.userData.mk}|${m.userData.double ? 1 : 0}|${m.userData.casing ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mk: m.userData.mk, double: !!m.userData.double, cast: false, geos: [] }));
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      b.geos.push(geo);
      b.cast = b.cast || m.castShadow;
      (b as unknown as { casing?: boolean }).casing = !!m.userData.casing;
      remove.push(m);
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(g);
  for (const m of remove) { m.parent?.remove(m); m.geometry.dispose(); }
  const empties: THREE.Object3D[] = [];
  g.traverse((o) => { if (o !== g && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !o.userData.anchor && !o.userData.anim) empties.push(o); });
  for (const e of empties) e.parent?.remove(e);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged);
    mesh.userData.mk = b.mk;
    mesh.userData.double = b.double;
    mesh.userData.casing = (b as unknown as { casing?: boolean }).casing;
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
}

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private r: number, private h: number, private turns: number) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

const SIDE_S = [0, 0.1, 0.11, 0.2, 0.32, 0.45, 0.58, 0.68, 0.72, 0.76, 0.84, 0.93, 1];
const HALF = 42;
const RING = HALF * 2 - 2;

export function buildCar(spec: CarSpec, opts: { hybrid: boolean; turbo: boolean; manual: boolean }): BuiltCar {
  const S = spec;
  const L = S.L, hw = S.W / 2;
  const top = mono(S.top);
  const beltSpec = mono(S.belt);
  const zOf = (t: number) => L / 2 - t * L;
  const tOf = (z: number) => (L / 2 - z) / L;
  const zA1 = L / 2 - S.frontOverhang;
  const zA2 = zA1 - S.wheelbase;
  const R = S.wheelR;
  const archR = R + 0.05;
  const tA1 = S.frontOverhang / L, tA2 = (S.frontOverhang + S.wheelbase) / L, archT = archR / L;
  const wIn = S.track / 2 - S.tyreW / 2 - 0.05;
  const b0 = S.clearance;

  const bottom = (t: number) => {
    let y = b0;
    if (t < 0.08) y += 0.11 * Math.pow((0.08 - t) / 0.08, 1.6);
    if (t > 0.9) y += 0.14 * Math.pow((t - 0.9) / 0.1, 1.6);
    return y;
  };
  /** plan-view half-width factor; `mul` sharpens (>1) or rounds (<1) the corners, so the bumper stands proud and the upper nose recedes */
  const planN = (t: number, mul: number) => {
    const flat = 0.42;
    const u = Math.max(0, (Math.abs(t - 0.5) - 0.5 * flat) / (0.5 * (1 - flat)));
    const n = (t < 0.5 ? S.planFront : S.planRear) * mul;
    return Math.pow(Math.max(0, 1 - Math.pow(u, n)), 1 / n);
  };
  const nMul = (hf: number) => (hf < 0.5 ? lerp(1.35, 1.0, hf / 0.5) : lerp(1.0, 0.72, clamp01((hf - 0.5) / 0.5)));
  const archY = (z: number) => {
    let y = -1;
    for (const za of [zA1, zA2]) {
      const dz = Math.abs(z - za);
      if (dz < archR) y = Math.max(y, R + 0.02 + Math.sqrt(archR * archR - dz * dz));
    }
    return y;
  };
  /** side section: tucked rocker, full door surface, a crisp shoulder crease, gentle tumble to the belt */
  const sideFactor = (hf: number) => {
    const h = clamp01(hf);
    if (h < 0.1) { const k = h / 0.1; return 0.925 + 0.05 * (1 - (1 - k) * (1 - k)); }
    if (h < 0.7) return 0.975 + 0.025 * Math.sin(((h - 0.1) / 0.6) * Math.PI * 0.5);
    if (h < 0.76) return 1 - 0.007 * ((h - 0.7) / 0.06);
    return 0.993 - 0.026 * Math.pow((h - 0.76) / 0.24, 1.25);
  };

  interface Sec { pts: P2[]; b: number; e: number; tp: number; lowY: number; xs: number; xBelt: number }
  const section = (t: number): Sec => {
    const z = zOf(t);
    const b = bottom(t), tp = top(t);
    const e = Math.min(beltSpec(t), tp - 0.055);
    const xs = hw * planN(t, 1);
    const o = Math.min(1, xs / 0.4);
    let lowY = Math.max(b, archY(z));
    lowY = Math.max(b, Math.min(lowY, e - 0.08));
    const xb = hw * planN(t, 1.35);
    const wI = Math.min(wIn, xb * 0.86);
    const sx = (y: number) => {
      const hf = (y - b) / Math.max(1e-4, e - b);
      return hw * planN(t, nMul(hf)) * sideFactor(hf);
    };
    const pts: P2[] = [[0, b], [wI * 0.5, b], [wI, b]];
    for (let k = 1; k <= 3; k++) pts.push([wI, b + ((lowY - b) * k) / 3]);
    const xo = sx(lowY);
    for (let k = 1; k <= 3; k++) pts.push([wI + ((xo - wI) * k) / 3, lowY]);
    for (const s of SIDE_S) {
      const y = lowY + (e - 0.006 - lowY) * s;
      pts.push([sx(y), y]);
    }
    const xBelt = sx(e);
    const g = smooth(0.05, 0.35, tp - e);
    const rh = hw * planN(t, 0.72) * S.roofHalf;
    const xTE = Math.max(0, lerp(xBelt - 0.085 * o, rh - 0.085 * o, g));
    const cx = Math.max(0, lerp(xBelt - 0.004 * o, rh + 0.025 * o, g));
    for (let k = 0; k < 12; k++) {
      const u = k / 11;
      const x = (1 - u) * (1 - u) * xBelt + 2 * (1 - u) * u * cx + u * u * xTE;
      const y = (1 - u) * (1 - u) * e + 2 * (1 - u) * u * tp + u * u * tp;
      pts.push([x, y]);
    }
    const crown = 0.016 + 0.034 * g;
    for (let k = 1; k <= 8; k++) {
      const x = xTE * (1 - k / 8);
      const q = xTE > 1e-5 ? x / xTE : 0;
      pts.push([x, tp + crown * (1 - q * q)]);
    }
    return { pts, b, e, tp, lowY, xs, xBelt };
  };

  // ------------------------------------------------------------ stations and panel boundaries
  const tHoodF = 0.035;
  const tbF = tA1 - archT * 0.25;
  const tDF = Math.max(tA1 + archT + 0.008, S.tCowl - 0.015);
  const tB = S.tB;
  const tRD = tA2 - archT * 0.55;
  const tbR = Math.min(0.975, tA2 + archT + 0.03);
  const tTrunk = S.kind === 'sedan' ? S.tDeck + 0.01 : S.tRoofR + 0.004;

  type ColCls = 'under' | 'rocker' | 'rockerGap' | 'side' | 'belt' | 'shoulder' | 'top';
  const colCls = (c: number): ColCls =>
    c <= 8 ? 'under' : c === 9 ? 'rocker' : c === 10 ? 'rockerGap' : c <= 20 ? 'side' : c === 21 ? 'belt' : c <= 33 ? 'shoulder' : 'top';
  const isSide = (k: ColCls) => k === 'side' || k === 'rocker' || k === 'rockerGap';

  const gapW = 0.0032 / L;
  interface Boundary { id: string; t: number; on: (k: ColCls) => boolean }
  const bounds: Boundary[] = [
    { id: 'hoodF', t: tHoodF, on: (k) => k === 'shoulder' || k === 'top' || k === 'belt' },
    { id: 'cowl', t: S.tCowl, on: (k) => k === 'top' },
    { id: 'bumperF', t: tbF, on: (k) => isSide(k) },
    { id: 'doorF', t: tDF, on: (k) => k === 'side' || k === 'belt' || k === 'rockerGap' },
    { id: 'doorB', t: tB, on: (k) => k === 'side' || k === 'belt' || k === 'shoulder' || k === 'rockerGap' },
    { id: 'doorR', t: tRD, on: (k) => k === 'side' || k === 'belt' || k === 'shoulder' || k === 'rockerGap' },
    { id: 'bumperR', t: tbR, on: (k) => isSide(k) },
    { id: 'trunk', t: tTrunk, on: (k) => k === 'top' },
  ];
  const base: number[] = [];
  const N = 200;
  for (let i = 0; i <= N; i++) base.push(0.5 - 0.5 * Math.cos((Math.PI * i) / N));
  const stations: { t: number; gap: Boundary | null }[] = base
    .filter((t) => !bounds.some((bd) => Math.abs(t - bd.t) < gapW * 1.6))
    .map((t) => ({ t, gap: null as Boundary | null }));
  for (const bd of bounds) {
    stations.push({ t: bd.t - gapW, gap: bd });
    stations.push({ t: bd.t + gapW, gap: null });
  }
  stations.sort((a, b) => a.t - b.t);
  const NS = stations.length;

  // ------------------------------------------------------------ vertices
  const pos = new Float32Array(NS * RING * 3);
  const secs: Sec[] = [];
  for (let k = 0; k < NS; k++) {
    const sec = section(stations[k].t);
    secs.push(sec);
    const z = zOf(stations[k].t);
    for (let r = 0; r < RING; r++) {
      const i = r < HALF ? r : RING - r;
      const sgn = r < HALF ? 1 : -1;
      const p = sec.pts[i];
      const o = (k * RING + r) * 3;
      pos[o] = p[0] * sgn;
      pos[o + 1] = p[1];
      pos[o + 2] = z;
    }
  }
  const V = (k: number, r: number) => k * RING + (r % RING);
  const quads: [number, number, number, number][] = [];
  for (let k = 0; k < NS - 1; k++)
    for (let r = 0; r < RING; r++) quads.push([V(k, r), V(k + 1, r), V(k + 1, r + 1), V(k, r + 1)]);
  let vol = 0;
  {
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    for (const q of quads) {
      va.fromArray(pos, q[0] * 3); vb.fromArray(pos, q[1] * 3); vc.fromArray(pos, q[2] * 3);
      vol += va.dot(vb.clone().cross(vc)) / 6;
      vb.fromArray(pos, q[3] * 3);
      vol += va.dot(vc.clone().cross(vb)) / 6;
    }
  }
  const flip = vol < 0;
  const tri = (q: [number, number, number, number], out: number[], inward = false) => {
    const f = inward ? !flip : flip;
    if (f) out.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    else out.push(q[0], q[1], q[2], q[0], q[2], q[3]);
  };
  const full = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  full.setAttribute('position', posAttr);
  const fi: number[] = [];
  for (const q of quads) tri(q, fi);
  full.setIndex(fi);
  full.computeVertexNormals();
  const nrm = full.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) {
    const x = nrm.getX(i), y = nrm.getY(i), z = nrm.getZ(i);
    if (!(x * x + y * y + z * z > 1e-8)) {
      const s = pos[i * 3 + 2] >= 0 ? 1 : -1;
      const l = Math.hypot(0.2, 1);
      nrm.setXYZ(i, 0, 0.2 / l, s / l);
    }
  }
  const uv = new Float32Array(NS * RING * 2);
  for (let i = 0; i < NS * RING; i++) { uv[i * 2] = pos[i * 3 + 2] * 0.5; uv[i * 2 + 1] = pos[i * 3 + 1] * 0.5 + pos[i * 3] * 0.3; }
  const uvAttr = new THREE.BufferAttribute(uv, 2);

  // ------------------------------------------------------------ classification
  const A = (h: number) => lerp(S.tCowl, S.tRoofF, h);
  const Cl = (h: number) => lerp(Math.min(tRD, S.tDeck - 0.03), S.tRoofR - 0.01, h);
  const Q = (h: number) => lerp(S.tDeck - 0.03, S.tRoofR - 0.02, h);
  const yHL1 = top(0.06) - 0.05, yHL0 = yHL1 - S.headlampH;
  const yTL1 = top(0.975) - 0.03;
  const sedanFace = S.kind === 'sedan';

  type Cls = { part: string; mk: MatKey } | null;
  const door = (front: boolean, side: number) => (front ? (side < 0 ? 'comp-front-left-door' : 'comp-front-right-door') : side < 0 ? 'rearDoorL' : 'rearDoorR');

  const classify = (tm: number, c: number, side: number, p: THREE.Vector3, n: THREE.Vector3, sec: Sec): Cls => {
    const k = colCls(c);
    const ax = Math.abs(p.x);
    if (tm < 0.05 && n.z > 0.45) {
      if (ax < hw * 0.36 && p.y > yHL1 - 0.016 && p.y < yHL1 + 0.012) return { part: 'comp-front-bumper', mk: sedanFace ? 'chrome' : 'trimBlack' };
      if (ax < hw * 0.36 && p.y > yHL0 - 0.06 && p.y <= yHL1 - 0.016) return { part: 'comp-front-bumper', mk: 'grille' };
      if (ax < hw * 0.62 && p.y > b0 + 0.05 && p.y < b0 + 0.2) return { part: 'comp-front-bumper', mk: 'grilleLow' };
    }
    if (tm > 0.93 && n.z < -0.3 && p.y < b0 + 0.16) return { part: 'rearBumper', mk: 'cladding' };
    const lowBlack = (S.cladding && (p.y < b0 + 0.17 || (sec.lowY > sec.b + 0.01 && p.y < sec.lowY + 0.075))) || p.y < b0 + 0.045;
    const bodyMk: MatKey = lowBlack && k !== 'under' ? 'cladding' : 'paint';
    if (k === 'under') return { part: tm < tbF ? 'comp-front-bumper' : tm > tbR ? 'rearBumper' : 'shell', mk: 'under' };
    if (isSide(k)) {
      if (tm < tbF) return { part: 'comp-front-bumper', mk: bodyMk };
      if (tm > tbR) return { part: 'rearBumper', mk: bodyMk };
      if (tm >= tDF && tm < tRD) {
        if (k === 'rockerGap') return null;
        if (k === 'rocker') return { part: 'shell', mk: S.cladding || S.wing ? 'cladding' : 'paint' };
        return { part: door(tm < tB, side), mk: bodyMk };
      }
      return { part: 'shell', mk: k === 'rocker' && (S.cladding || S.wing) ? 'cladding' : bodyMk };
    }
    if (k === 'belt') {
      if (tm < tHoodF) return { part: 'comp-front-bumper', mk: 'paint' };
      if (tm < S.tCowl) return null;
      if (tm >= tDF && tm < tRD) return { part: door(tm < tB, side), mk: 'paint' };
      return { part: 'shell', mk: 'paint' };
    }
    if (k === 'shoulder') {
      const h = clamp01((c - 22 + 0.5) / 12);
      if (tm < tHoodF) return { part: 'comp-front-bumper', mk: 'paint' };
      if (tm < S.tCowl) return { part: 'comp-hood', mk: 'paint' };
      if (tm < S.tDeck) {
        const roofEdge = h > 0.9;
        if (tm < A(h) + 0.01) return { part: 'shell', mk: S.blackRoof && h > 0.5 ? 'trimBlack' : 'paint' };
        if (tm < tB) {
          if (tm > A(h) + 0.022 && tm < tB - 0.014 && h > 0.05 && !roofEdge) return { part: door(true, side), mk: 'glass' };
          return { part: tm < tDF ? 'shell' : door(true, side), mk: Math.abs(tm - tB) < 0.014 || !roofEdge ? 'trimBlack' : 'paint' };
        }
        if (tm < tRD) {
          const lim = S.kind === 'sedan' ? Math.min(tRD - 0.012, Cl(h)) : tRD - 0.012;
          if (tm > tB + 0.014 && tm < lim && h > 0.05 && !roofEdge) return { part: door(false, side), mk: 'glass' };
          return { part: door(false, side), mk: tm < tB + 0.014 ? 'trimBlack' : roofEdge || tm > lim + 0.01 ? (S.blackRoof && h > 0.5 ? 'trimBlack' : 'paint') : 'trimBlack' };
        }
        if (S.kind !== 'sedan' && tm > tRD + 0.012 && tm < Q(h) && h > 0.05 && !roofEdge) return { part: 'shell', mk: 'glass' };
        return { part: 'shell', mk: S.blackRoof && h > 0.5 ? 'trimBlack' : 'paint' };
      }
      return { part: 'shell', mk: 'paint' };
    }
    if (tm < tHoodF) return { part: 'comp-front-bumper', mk: 'paint' };
    if (tm < S.tCowl) return { part: 'comp-hood', mk: 'paint' };
    if (tm < S.tRoofF) return { part: 'comp-windshield', mk: 'glass' };
    if (tm < S.tRoofR) return { part: 'comp-roof', mk: 'roofPaint' };
    if (S.kind === 'sedan') {
      if (tm < S.tDeck) return { part: 'shell', mk: 'glass' };
      return { part: tm < 0.975 ? 'trunk' : 'rearBumper', mk: 'paint' };
    }
    if (tm < S.tDeck) return { part: 'tailgate', mk: 'glass' };
    return { part: tm < 0.975 ? 'tailgate' : 'rearBumper', mk: 'paint' };
  };

  const buckets = new Map<string, Map<MatKey, number[]>>();
  const innerBy = new Map<string, number[]>();
  const inner = (key: string, q: [number, number, number, number]) => { let a = innerBy.get(key); if (!a) innerBy.set(key, (a = [])); tri(q, a); };
  // cabin trim surfaces taken from the body itself, offset inward and facing the cabin
  const cabinQ = new Map<string, { mk: MatKey; off: number; q: [number, number, number, number][] }>();
  const addCabin = (key: string, mk: MatKey, off: number, q: [number, number, number, number]) => {
    let e = cabinQ.get(key);
    if (!e) cabinQ.set(key, (e = { mk, off, q: [] }));
    e.q.push(q);
  };
  const pc = new THREE.Vector3(), nc = new THREE.Vector3(), tmp = new THREE.Vector3();
  let qi = 0;
  for (let k = 0; k < NS - 1; k++) {
    const tm = (stations[k].t + stations[k + 1].t) / 2;
    const gapB = stations[k].gap;
    for (let r = 0; r < RING; r++, qi++) {
      const q = quads[qi];
      const ia = r < HALF ? r : RING - r;
      const ib = (r + 1) % RING < HALF ? (r + 1) % RING : RING - ((r + 1) % RING);
      const c = Math.min(ia, ib);
      pc.set(0, 0, 0); nc.set(0, 0, 0);
      for (const v of q) { pc.add(tmp.fromBufferAttribute(posAttr, v)); nc.add(tmp.fromBufferAttribute(nrm, v)); }
      pc.multiplyScalar(0.25); nc.normalize();
      const side = pc.x < 0 ? -1 : 1;
      const kc = colCls(c);
      // cabin lining
      if (tm > S.tCowl + 0.01 && tm < (S.kind === 'sedan' ? S.tDeck - 0.01 : S.tDeck)) {
        const h = clamp01((c - 22 + 0.5) / 12);
        if (kc === 'top' && tm > S.tRoofF - 0.005 && tm < S.tRoofR + 0.005) addCabin('headliner', 'headliner', 0.035, q);
        else if (kc === 'shoulder' && h > 0.86 && tm > S.tRoofF - 0.02 && tm < S.tRoofR + 0.02) addCabin('headliner', 'headliner', 0.035, q);
        if ((kc === 'side' || kc === 'belt') && tm > tDF && tm < tRD && c >= 13) {
          const dk = door(tm < tB, side);
          addCabin(dk + ':card', c >= 18 ? 'trim' : 'interiorDark', c >= 18 ? 0.07 : 0.085, q);
        }
      }
      let cls: Cls;
      if (gapB && gapB.on(kc)) cls = null;
      else cls = classify(tm, c, side, pc, nc, secs[k]);
      if (!cls) { inner('shell', q); continue; }
      if (cls.mk !== 'glass') inner(cls.part, q);
      else if (kc === 'shoulder' && tm > S.tCowl) {
        // pillar trims: the black frame quads around the side glass get a cabin-side lining
      }
      if (kc === 'shoulder' && cls.mk !== 'glass' && tm > S.tRoofF - 0.04 && tm < S.tDeck - 0.01) addCabin('pillars', 'trim', 0.03, q);
      let m = buckets.get(cls.part);
      if (!m) buckets.set(cls.part, (m = new Map()));
      let list = m.get(cls.mk);
      if (!list) m.set(cls.mk, (list = []));
      tri(q, list);
    }
  }

  // ------------------------------------------------------------ groups
  const root = new THREE.Group();
  root.name = 'car';
  const sprung = new THREE.Group();
  sprung.name = 'sprung';
  root.add(sprung);
  const partGroups = new Map<string, THREE.Group>();
  const UNSPRUNG = new Set(['wheelsL', 'wheelsR', 'brakes', 'suspension']);
  const part = (key: string, compId: string | null, explode: [number, number, number], domain: PartData['domain']) => {
    let g = partGroups.get(key);
    if (g) return g;
    g = new THREE.Group();
    g.name = key;
    const data: PartData = { compId, explode: new THREE.Vector3(...explode), base: new THREE.Vector3(), domain };
    g.userData = data as unknown as Record<string, unknown>;
    partGroups.set(key, g);
    (UNSPRUNG.has(key) ? root : sprung).add(g);
    return g;
  };
  const mesh = (geo: THREE.BufferGeometry, mk: MatKey, cast = true) => {
    const m = new THREE.Mesh(geo);
    m.userData.mk = mk;
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const anchors: Record<string, THREE.Object3D> = {};
  const anchor = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    o.userData.anchor = true;
    parent.add(o);
    anchors[name] = o;
    return o;
  };

  const PARTS: Record<string, [string | null, [number, number, number], PartData['domain']]> = {
    shell: [null, [0, 0, 0], 'shell'],
    'comp-front-bumper': ['comp-front-bumper', [0, 0, 0.85], 'exterior'],
    'comp-hood': ['comp-hood', [0, 0.85, 0.3], 'exterior'],
    'comp-front-left-door': ['comp-front-left-door', [-0.8, 0, 0.05], 'exterior'],
    'comp-front-right-door': ['comp-front-right-door', [0.8, 0, 0.05], 'exterior'],
    rearDoorL: [null, [-0.8, 0, -0.1], 'shell'],
    rearDoorR: [null, [0.8, 0, -0.1], 'shell'],
    'comp-windshield': ['comp-windshield', [0, 0.6, 0.45], 'exterior'],
    'comp-roof': ['comp-roof', [0, 1.0, 0], 'exterior'],
    'comp-headlights': ['comp-headlights', [0, 0.2, 1.25], 'exterior'],
    trunk: [null, [0, 0.6, -0.55], 'shell'],
    tailgate: [null, [0, 0.6, -0.65], 'shell'],
    rearBumper: [null, [0, 0, -0.85], 'shell'],
  };
  const P = (key: string) => {
    const d = PARTS[key];
    return part(key, d[0], d[1], d[2]);
  };

  for (const [key, mats] of buckets) {
    const g = P(key);
    for (const [mk, idx] of mats) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', posAttr);
      geo.setAttribute('normal', nrm);
      geo.setAttribute('uv', uvAttr);
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const m = mesh(geo, mk, mk !== 'glass');
      m.userData.body = true;
      g.add(m);
    }
  }
  const offsetPositions = (off: number) => {
    const ip = new Float32Array(pos.length);
    for (let i = 0; i < pos.length / 3; i++) {
      ip[i * 3] = pos[i * 3] - nrm.getX(i) * off;
      ip[i * 3 + 1] = pos[i * 3 + 1] - nrm.getY(i) * off;
      ip[i * 3 + 2] = pos[i * 3 + 2] - nrm.getZ(i) * off;
    }
    return ip;
  };
  {
    const ip = new THREE.BufferAttribute(offsetPositions(0.012), 3);
    for (const [key, idx] of innerBy) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', ip);
      geo.setAttribute('normal', nrm);
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const m = mesh(geo, 'inner', false);
      m.userData.xrayHide = true;
      m.userData.body = true;
      P(key).add(m);
    }
  }
  // cabin lining meshes (inward facing)
  {
    const cache = new Map<number, THREE.BufferAttribute>();
    for (const [key, e] of cabinQ) {
      let pa = cache.get(e.off);
      if (!pa) cache.set(e.off, (pa = new THREE.BufferAttribute(offsetPositions(e.off), 3)));
      const idx: number[] = [];
      for (const q of e.q) tri(q, idx, true);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', pa);
      geo.setAttribute('uv', uvAttr);
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = mesh(geo, e.mk, false);
      m.userData.body = true;
      m.userData.cabin = true;
      const target = key.endsWith(':card') ? P(key.split(':')[0]) : P('shell');
      target.add(m);
    }
  }

  // ------------------------------------------------------------ helpers
  const rbox = (w: number, h: number, d: number, r = 0.01, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
  const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    return o;
  };
  const between = (a: THREE.Vector3, b: THREE.Vector3, r: number, mk: MatKey, seg = 14) => {
    const d = b.clone().sub(a);
    const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mk);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  const curve = (pts: [number, number, number][]) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const tube = (pts: [number, number, number][], r: number, mk: MatKey, seg = 64) => mesh(new THREE.TubeGeometry(curve(pts), seg, r, 10, false), mk);
  /** a glowing flow line: the tube the fluid / energy / data runs in */
  const flow = (name: string, pts: [number, number, number][], r: number) => {
    const c = curve(pts);
    const m = mesh(new THREE.TubeGeometry(c, Math.max(24, Math.round(c.getLength() * 40)), r, 8, false), 'cable', false);
    m.userData.flow = name;
    m.userData.len = c.getLength();
    return m;
  };
  const surfX = (t: number, y: number) => {
    const s = section(t);
    const hf = (y - s.b) / Math.max(1e-4, s.e - s.b);
    return hw * planN(t, nMul(hf)) * sideFactor(hf);
  };
  /** extrude a side profile given in (z, y) across x, centred */
  const profileX = (pts: P2[], width: number, bevel = 0.015) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, width - bevel * 2), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 8 });
    g.rotateY(-Math.PI / 2);
    g.translate((width - bevel * 2) / 2, 0, 0);
    return g;
  };
  const roundedProfile = (pts: P2[], r: number, seg = 6): P2[] => {
    // fillet every corner of a closed polygon
    const out: P2[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const d0: P2 = [p0[0] - p1[0], p0[1] - p1[1]], d1: P2 = [p2[0] - p1[0], p2[1] - p1[1]];
      const l0 = Math.hypot(...d0), l1 = Math.hypot(...d1);
      const rr = Math.min(r, l0 * 0.45, l1 * 0.45);
      const a: P2 = [p1[0] + (d0[0] / l0) * rr, p1[1] + (d0[1] / l0) * rr];
      const b: P2 = [p1[0] + (d1[0] / l1) * rr, p1[1] + (d1[1] / l1) * rr];
      for (let k = 0; k <= seg; k++) {
        const t = k / seg;
        out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1]]);
      }
    }
    return out;
  };

  const zc = zOf(S.tCowl);
  const cowl = section(S.tCowl + 0.04);
  const eBelt = cowl.e;
  const sy = b0 + 0.36; // seat cushion height
  const seatZ = zOf(tB) + 0.12;
  const engZ = zA1 + 0.02;
  const hoodY = top(tOf(engZ));
  const ey = Math.min(R + 0.24, hoodY - 0.4);

  // ------------------------------------------------------------ lamps projected onto the body
  {
    const ray = new THREE.Raycaster();
    const srcMesh = (tLo: number, tHi: number) => {
      const idx: number[] = [];
      let q = 0;
      for (let k = 0; k < NS - 1; k++)
        for (let r = 0; r < RING; r++, q++) {
          const tm = (stations[k].t + stations[k + 1].t) / 2;
          const c = Math.min(r < HALF ? r : RING - r, (r + 1) % RING < HALF ? (r + 1) % RING : RING - ((r + 1) % RING));
          if (tm >= tLo && tm <= tHi && c > 8) tri(quads[q], idx);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', posAttr);
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    };
    const strip = (src: THREE.Mesh, z0: number, fwd: number, th0: number, th1: number, yLo: (u: number) => number, yHi: (u: number) => number, nu = 28, nv = 5, off = 0.004) => {
      const pts: number[] = [];
      const last = new THREE.Vector3();
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, th = lerp(th0, th1, u);
        for (let j = 0; j <= nv; j++) {
          const y = lerp(yLo(u), yHi(u), j / nv);
          ray.set(new THREE.Vector3(0, y, z0), new THREE.Vector3(Math.sin(th), 0, Math.cos(th) * fwd));
          const hit = ray.intersectObject(src, false)[0];
          if (hit) {
            const nn = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, fwd);
            if (nn.dot(ray.ray.direction) < 0) nn.negate();
            last.copy(hit.point).addScaledVector(nn, off);
          }
          pts.push(last.x, last.y, last.z);
        }
      }
      const idx: number[] = [];
      const W = nv + 1;
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) { const a = i * W + j, b2 = a + W; idx.push(a, b2, a + 1, a + 1, b2, b2 + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    const dbl = (geo: THREE.BufferGeometry, mk: MatKey) => { const m = mesh(geo, mk, false); m.userData.double = true; return m; };
    const front = srcMesh(0, tA1);
    const zF = zA1 - 0.25;
    const H = S.headlampH;
    const yMid = (yHL0 + yHL1) / 2;
    const hl = P('comp-headlights');
    for (const sd of [-1, 1]) {
      const th0 = sd * 0.2, th1 = sd * 0.8;
      const h = (u: number) => H * (1 - 0.6 * u * u);
      const ym = (u: number) => yMid + 0.045 * u;
      hl.add(dbl(strip(front, zF, 1, th0, th1, (u) => ym(u) - h(u) / 2, (u) => ym(u) + h(u) / 2 - 0.016), 'lamp'));
      hl.add(dbl(strip(front, zF, 1, th0, th1, (u) => ym(u) + h(u) / 2 - 0.016, (u) => ym(u) + h(u) / 2, 28, 1, 0.006), 'drl'));
      for (const k of [0.22, 0.42, 0.6]) {
        const th = lerp(th0, th1, k);
        ray.set(new THREE.Vector3(0, ym(k) - 0.01, zF), new THREE.Vector3(Math.sin(th), 0, Math.cos(th)));
        const hit = ray.intersectObject(front, false)[0];
        if (hit) {
          const dir = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
          const eye = mesh(new THREE.CylinderGeometry(H * 0.2, H * 0.24, 0.02, 24), 'chrome', false);
          eye.position.copy(hit.point).addScaledVector(dir, 0.003);
          eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          hl.add(eye);
          const lens = mesh(new THREE.SphereGeometry(H * 0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'drl', false);
          lens.position.copy(hit.point).addScaledVector(dir, 0.006);
          lens.quaternion.copy(eye.quaternion);
          hl.add(lens);
        }
      }
      anchor(sd < 0 ? 'headlightL' : 'headlightR', hl, sd * hw * 0.72, yMid, zOf(0.03));
    }
    front.geometry.dispose();
    const rear = srcMesh(tA2, 1);
    const zR = zA2 + 0.25;
    const tailPart = P(S.kind === 'sedan' ? 'trunk' : 'tailgate');
    for (const sd of [-1, 1]) {
      const h = (u: number) => 0.085 * (1 - 0.55 * u * u);
      const ym = (u: number) => yTL1 - 0.05 + 0.02 * u;
      const tl = dbl(strip(rear, zR, -1, sd * 0.24, sd * 0.85, (u) => ym(u) - h(u) / 2, (u) => ym(u) + h(u) / 2), 'tail');
      tl.userData.keep = true;
      tailPart.add(tl);
    }
    if (S.connectedTail) {
      const bar = dbl(strip(rear, zR, -1, -0.25, 0.25, () => yTL1 - 0.03, () => yTL1 - 0.015, 20, 1), 'tail');
      bar.userData.keep = true;
      tailPart.add(bar);
    }
    rear.geometry.dispose();
  }

  // ------------------------------------------------------------ exterior details
  {
    // wheel-arch lips give the openings a finished edge
    for (const za of [zA1, zA2])
      for (const sd of [-1, 1]) {
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 28; i++) {
          const a = lerp(Math.PI * 1.06, -Math.PI * 0.06, i / 28);
          const z = za + Math.cos(a) * (archR + 0.006);
          const y = R + 0.02 + Math.sin(a) * (archR + 0.006);
          const t = tOf(z);
          const s = section(t);
          const yy = Math.max(y, s.b + 0.01);
          pts.push([sd * (surfX(t, Math.min(yy, s.e - 0.01)) + 0.004), yy, z]);
        }
        const lip = tube(pts, S.cladding ? 0.03 : 0.014, S.cladding ? 'cladding' : 'paint', 56);
        lip.scale.set(1, 1, 1);
        P(za === zA1 ? 'comp-front-bumper' : 'shell').add(lip);
      }
    // mirrors, handles
    const sec = section(tDF + 0.05);
    for (const sd of [-1, 1]) {
      const g = P(sd < 0 ? 'comp-front-left-door' : 'comp-front-right-door');
      const z = zOf(tDF + 0.045);
      const mx = sd * (sec.xBelt + 0.13), my = sec.e + 0.07;
      const capProf = roundedProfile([[0.05, -0.055], [-0.07, -0.05], [-0.075, 0.05], [0.04, 0.06]], 0.035);
      const cap = mesh(profileX(capProf, 0.2, 0.02), S.wing || S.blackRoof ? 'trimBlack' : 'paint');
      g.add(at(cap, mx, my, z, 0, sd * 0.12, 0));
      g.add(at(mesh(new THREE.PlaneGeometry(0.17, 0.085), 'chrome'), mx, my, z - 0.072, 0, Math.PI + sd * 0.12, 0));
      g.add(at(mesh(rbox(0.1, 0.035, 0.05, 0.012), 'trimBlack'), sd * (sec.xBelt + 0.04), sec.e + 0.03, z + 0.01));
      g.add(at(mesh(rbox(0.07, 0.012, 0.02, 0.005), 'drl'), mx + sd * 0.05, my - 0.045, z + 0.04));
      for (const [tt, key] of [[tB - 0.065, sd < 0 ? 'comp-front-left-door' : 'comp-front-right-door'], [tRD - 0.06, sd < 0 ? 'rearDoorL' : 'rearDoorR']] as const) {
        const s2 = section(tt);
        const y = s2.e - 0.09;
        const hx = surfX(tt, y) + 0.008;
        P(key).add(at(mesh(rbox(0.025, 0.028, 0.15, 0.012), S.kind === 'sedan' ? 'chrome' : 'paint'), sd * hx, y, zOf(tt)));
      }
      anchor(sd < 0 ? 'doorL' : 'doorR', g, sd * (sec.xBelt + 0.02), sec.e - 0.2, zOf((tDF + tB) / 2));
    }
    // wipers
    for (const x of [-0.35, 0.25]) P('shell').add(at(mesh(rbox(0.6, 0.012, 0.025, 0.005), 'trimBlack'), x, cowl.tp + 0.015, zOf(S.tCowl + 0.012), 0, 0.12, 0.05));
    // shark fin
    {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(0.19, 0); sh.quadraticCurveTo(0.05, 0.02, 0.02, 0.065); sh.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3 });
      geo.translate(0, 0, -0.02);
      geo.rotateY(Math.PI / 2);
      const t = S.tRoofR - 0.04;
      P('comp-roof').add(at(mesh(geo, S.blackRoof ? 'trimBlack' : 'paint'), 0, top(t) + 0.04, zOf(t) + 0.12));
    }
    if (S.roofRails) {
      for (const sd of [-1, 1]) {
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 10; i++) {
          const t = lerp(S.tRoofF + 0.02, S.tRoofR + 0.01, i / 10);
          pts.push([sd * (hw * planN(t, 0.72) * S.roofHalf - 0.09), top(t) + 0.05 + (i === 0 || i === 10 ? -0.03 : 0), zOf(t)]);
        }
        P('comp-roof').add(tube(pts, 0.016, 'alu', 48));
      }
    }
    P('comp-front-bumper').add(at(mesh(new THREE.PlaneGeometry(0.42, 0.095), 'plate', false), 0, b0 + 0.25, L / 2 + 0.006));
    {
      const ry = S.kind === 'sedan' ? top(0.99) - 0.17 : b0 + 0.36;
      const rz = zOf(S.kind === 'sedan' ? 0.995 : 0.998) - 0.012;
      P(S.kind === 'sedan' ? 'trunk' : 'rearBumper').add(at(mesh(new THREE.PlaneGeometry(0.42, 0.095), 'plate', false), 0, ry, rz, 0, Math.PI, 0));
    }
    if (S.wing) {
      const foil = new THREE.Shape();
      foil.moveTo(0, 0); foil.quadraticCurveTo(0.12, 0.05, 0.3, 0.015); foil.lineTo(0.3, 0); foil.quadraticCurveTo(0.12, 0.012, 0, 0);
      const geo = new THREE.ExtrudeGeometry(foil, { depth: 1.42, bevelEnabled: false });
      geo.translate(-0.15, 0, -0.71);
      geo.rotateY(Math.PI / 2);
      const t = 0.965;
      const wy = top(t) + 0.26;
      P('tailgate').add(at(mesh(geo, 'carbon'), 0, wy, zOf(t) + 0.02));
      for (const sd of [-1, 1]) {
        P('tailgate').add(at(mesh(rbox(0.012, 0.13, 0.32, 0.004), 'trimBlack'), sd * 0.715, wy + 0.01, zOf(t) + 0.02));
        P('tailgate').add(at(mesh(rbox(0.03, 0.27, 0.12, 0.01), 'trimBlack'), sd * 0.36, wy - 0.12, zOf(t) + 0.05, -0.2, 0, 0));
        P('shell').add(at(mesh(rbox(0.06, 0.05, (tRD - tDF) * L + 0.3, 0.02), 'carbon'), sd * (hw - 0.03), b0 + 0.02, zOf((tDF + tRD) / 2)));
      }
    }
    anchor('hood', P('comp-hood'), 0, top(tOf(engZ)) + 0.02, engZ);
    anchor('roof', P('comp-roof'), 0, top((S.tRoofF + S.tRoofR) / 2) + 0.03, zOf((S.tRoofF + S.tRoofR) / 2));
    anchor('windshield', P('comp-windshield'), 0, top((S.tCowl + S.tRoofF) / 2), zOf((S.tCowl + S.tRoofF) / 2));
    anchor('bumper', P('comp-front-bumper'), 0, b0 + 0.3, L / 2);
  }

  // ------------------------------------------------------------ wheels, brakes, corners
  const corners: Corner[] = [];
  const makeWheel = () => {
    const g = new THREE.Group();
    g.rotation.z = Math.PI / 2;
    const w = S.tyreW, rr = S.rimR;
    const tp: P2[] = [
      [rr + 0.012, -w / 2 + 0.018], [R - 0.07, -w / 2 - 0.006], [R - 0.022, -w / 2 + 0.006], [R - 0.004, -w / 2 + 0.03],
      [R, -w / 2 + 0.06], [R, w / 2 - 0.06], [R - 0.004, w / 2 - 0.03], [R - 0.022, w / 2 - 0.006], [R - 0.07, w / 2 + 0.006], [rr + 0.012, w / 2 - 0.018],
    ];
    g.add(mesh(new THREE.LatheGeometry(tp.map(([a, b]) => new THREE.Vector2(a, b)), 72), 'rubber'));
    for (const a of [-0.3, 0, 0.3]) g.add(at(mesh(new THREE.TorusGeometry(R - 0.002, 0.0035, 6, 72), 'rimDark', false), 0, a * w, 0, Math.PI / 2, 0, 0));
    const barrel: P2[] = [[rr + 0.006, w / 2 - 0.012], [rr - 0.004, w / 2 - 0.022], [rr - 0.016, w / 2 - 0.04], [rr - 0.016, -w / 2 + 0.03], [rr, -w / 2 + 0.02]];
    const bm = mesh(new THREE.LatheGeometry(barrel.map(([a, b]) => new THREE.Vector2(a, b)), 64), 'rim');
    bm.userData.double = true;
    g.add(bm);
    const faceY = w / 2 - 0.045;
    g.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 32), 'rim'), 0, faceY - 0.02, 0));
    g.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), 'chrome'), 0, faceY + 0.008, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(at(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 6), 'chrome'), Math.cos(a) * 0.05, faceY + 0.004, Math.sin(a) * 0.05));
    }
    const len = rr - 0.075 - 0.012;
    const spoke = (angle: number, width: number, depth: number, twist = 0) => {
      const geo = rbox(width, depth, len, 0.006, 2);
      geo.translate(0, 0, 0.075 + len / 2);
      const m = mesh(geo, 'rim');
      m.rotation.set(0, angle, twist);
      m.position.y = faceY - 0.012;
      g.add(m);
    };
    const n = S.spokes;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (S.spokeStyle === 'twin') { spoke(a - 0.09, 0.024, 0.028); spoke(a + 0.09, 0.024, 0.028); }
      else if (S.spokeStyle === 'blade') spoke(a, 0.03, 0.03, 0.35);
      else { spoke(a - 0.12, 0.018, 0.03); spoke(a + 0.12, 0.018, 0.03); spoke(a, 0.03, 0.032); }
    }
    g.add(at(mesh(new THREE.TorusGeometry(rr - 0.004, 0.009, 8, 72), 'rim'), 0, faceY + 0.012, 0, Math.PI / 2, 0, 0));
    // merge the wheel into a few meshes so the spinning group stays cheap
    const holder = new THREE.Group();
    holder.add(g);
    mergePart(holder as unknown as THREE.Group);
    return holder;
  };
  const makeBrake = (front: boolean) => {
    const g = new THREE.Group();
    g.rotation.z = Math.PI / 2;
    const rd = S.rimR - 0.04;
    const disc = mesh(new THREE.CylinderGeometry(rd, rd, 0.026, 56), 'disc');
    disc.userData.keep = true;
    g.add(at(disc, 0, -0.01, 0));
    g.add(at(mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.05, 32), 'steel'), 0, 0.012, 0));
    const ca = 2.3;
    g.add(at(mesh(rbox(front ? 0.075 : 0.06, 0.07, front ? 0.17 : 0.13, 0.022), 'caliper'), Math.cos(ca) * (rd - 0.035), -0.01, Math.sin(ca) * (rd - 0.035), 0, -ca + Math.PI / 2, 0));
    return { g, disc };
  };
  const wheelsL = part('wheelsL', 'comp-wheels-tyres', [-0.7, 0, 0], 'exterior');
  const wheelsR = part('wheelsR', 'comp-wheels-tyres', [0.7, 0, 0], 'exterior');
  const brakes = part('brakes', 'comp-brakes-front', [0, -0.05, 0.35], 'undercarriage');
  const sus = part('suspension', 'comp-suspension-front', [0, -0.25, 0.15], 'undercarriage');
  const rearBrakes = part('rearBrakes', null, [0, 0, 0], 'undercarriage');
  root.add(rearBrakes);
  for (const [za, front] of [[zA1, true], [zA2, false]] as const)
    for (const sd of [-1, 1]) {
      const x = sd * (S.track / 2);
      const hub = new THREE.Group(); hub.position.set(x, R, za); hub.userData.anim = true;
      const steer = new THREE.Group(); hub.add(steer);
      const spin = new THREE.Group(); spin.rotation.y = sd > 0 ? Math.PI : 0; steer.add(spin);
      spin.add(makeWheel());
      (sd < 0 ? wheelsL : wheelsR).add(hub);
      const bhub = new THREE.Group(); bhub.position.set(x - sd * 0.035, R, za); bhub.userData.anim = true;
      const bsteer = new THREE.Group(); bhub.add(bsteer);
      const { g: bg, disc } = makeBrake(front);
      const bo = new THREE.Group(); bo.rotation.y = sd > 0 ? Math.PI : 0; bo.add(bg); bsteer.add(bo);
      (front ? brakes : rearBrakes).add(bhub);
      // springs
      const sp = new THREE.Group(); sp.userData.anim = true;
      let springLen = 0.26;
      if (front) {
        const kx = sd * (S.track / 2 - S.tyreW / 2 - 0.06);
        const knuckle = new THREE.Vector3(kx, R + 0.06, za - 0.02);
        const tower = new THREE.Vector3(sd * (S.track / 2 - 0.27), R + 0.52, za - 0.07);
        const dir = tower.clone().sub(knuckle);
        springLen = dir.length() * 0.55;
        sp.position.copy(tower).addScaledVector(dir, -0.07);
        sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize().negate());
        const coil = mesh(new THREE.TubeGeometry(new Helix(0.062, springLen, 6.5), 160, 0.009, 8, false), 'spring');
        coil.rotation.x = Math.PI;
        sp.add(coil);
        sp.add(at(mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.014, 28), 'engineBlack'), 0, 0, 0));
        sus.add(sp);
        sus.add(between(knuckle, tower, 0.022, 'steel'));
        sus.add(between(knuckle, knuckle.clone().addScaledVector(dir, 0.45), 0.032, 'damper'));
        const kb = new THREE.Vector3(kx, R - 0.1, za);
        sus.add(between(knuckle, kb, 0.03, 'alu'));
        sus.add(between(kb, new THREE.Vector3(sd * 0.36, R - 0.12, za + 0.14), 0.022, 'engineBlack'));
        sus.add(between(kb, new THREE.Vector3(sd * 0.36, R - 0.12, za - 0.22), 0.022, 'engineBlack'));
        anchor(sd < 0 ? 'springL' : 'springR', sus, tower.x, (tower.y + knuckle.y) / 2, tower.z);
      } else {
        const sx = sd * (S.track / 2 - 0.26);
        sp.position.set(sx, R + 0.3, za + 0.05);
        springLen = 0.22;
        const coil = mesh(new THREE.TubeGeometry(new Helix(0.06, springLen, 5.5), 140, 0.0095, 8, false), 'spring');
        coil.rotation.x = Math.PI;
        sp.add(coil);
        P('shell').add(sp);
        P('shell').add(between(new THREE.Vector3(sx + sd * 0.08, R - 0.02, za - 0.05), new THREE.Vector3(sx + sd * 0.08, R + 0.32, za - 0.1), 0.028, 'damper'));
      }
      corners.push({ front, side: sd, hub, steer, spin, bhub, bsteer, disc, spring: sp, springLen, pos: new THREE.Vector3(x, R, za) });
      if (front) anchor(sd < 0 ? 'discL' : 'discR', brakes, x - sd * 0.06, R + 0.1, za);
    }
  corners.sort((a, b) => (a.front === b.front ? a.side - b.side : a.front ? -1 : 1));

  // ------------------------------------------------------------ chassis & underbody
  const rack = new THREE.Group(); rack.userData.anim = true;
  {
    const sh = P('shell');
    sh.add(at(mesh(new THREE.BoxGeometry(cowl.xs * 1.8, cowl.e - b0 - 0.05, 0.03), 'interiorDark'), 0, (cowl.e + b0) / 2, zc - 0.03));
    for (const za of [zA1, zA2])
      for (const sd of [-1, 1]) {
        const liner = mesh(new THREE.CylinderGeometry(archR - 0.005, archR - 0.005, S.tyreW + 0.08, 32, 1, true, Math.PI / 2, Math.PI), 'under', false);
        liner.userData.double = true;
        sh.add(at(liner, sd * (S.track / 2), R + 0.02, za, 0, 0, Math.PI / 2));
      }
    // crash structure: bumper beams and crash cans
    sh.add(at(mesh(rbox(S.W - 0.25, 0.1, 0.08, 0.02), 'alu'), 0, b0 + 0.3, L / 2 - 0.16));
    sh.add(at(mesh(rbox(S.W - 0.3, 0.09, 0.07, 0.02), 'alu'), 0, b0 + 0.28, -L / 2 + 0.17));
    for (const sd of [-1, 1]) {
      sh.add(at(mesh(rbox(0.08, 0.08, 0.28, 0.012), 'steel'), sd * 0.5, b0 + 0.3, L / 2 - 0.34));
      // side sills / rocker reinforcement
      sh.add(at(mesh(rbox(0.1, 0.12, (tRD - tDF) * L + 0.25, 0.02), 'steel'), sd * (hw - 0.12), b0 + 0.08, zOf((tDF + tRD) / 2)));
      // front rails
      sh.add(between(new THREE.Vector3(sd * 0.5, b0 + 0.28, L / 2 - 0.45), new THREE.Vector3(sd * 0.42, b0 + 0.12, zc - 0.2), 0.04, 'steel'));
    }
    // floor tunnel and crossmembers
    sh.add(at(mesh(rbox(0.24, 0.12, zc - zA2 - 0.6, 0.03), 'steel'), 0, b0 + 0.08, (zc + zA2 + 0.6) / 2));
    for (const z of [zc - 0.55, seatZ - 0.15]) sh.add(at(mesh(rbox(S.W - 0.3, 0.05, 0.08, 0.015), 'steel'), 0, b0 + 0.08, z));
    // rear torsion beam
    sh.add(between(new THREE.Vector3(-S.track / 2 + 0.12, R + 0.02, zA2 + 0.02), new THREE.Vector3(S.track / 2 - 0.12, R + 0.02, zA2 + 0.02), 0.04, 'engineBlack'));
    for (const sd of [-1, 1]) sh.add(between(new THREE.Vector3(sd * (S.track / 2 - 0.15), R, zA2), new THREE.Vector3(sd * 0.55, R - 0.02, zA2 + 0.5), 0.03, 'engineBlack'));
    // fuel tank under the rear seat
    const tank = mesh(rbox(0.85, 0.2, 0.5, 0.06), 'tank');
    sh.add(at(tank, 0.05, b0 + 0.1, zA2 + 0.6));
    anchor('tank', sh, 0.05, b0 + 0.2, zA2 + 0.6);
    // underbody aero panels
    sh.add(at(mesh(new THREE.BoxGeometry(S.W - 0.4, 0.008, zc - zA2 - 0.3), 'under'), 0, b0 + 0.004, (zc + zA2) / 2));
    // steering rack
    rack.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 16), 'alu'), 0, 0, 0, 0, 0, Math.PI / 2));
    for (const sd of [-1, 1]) rack.add(between(new THREE.Vector3(sd * 0.36, 0, 0), new THREE.Vector3(sd * (S.track / 2 - 0.16), 0, 0.05), 0.012, 'steel'));
    rack.position.set(0, R + 0.05, zA1 - 0.18);
    sus.add(rack);
    sus.add(tube([[-0.55, R - 0.05, zA1 - 0.15], [-0.3, R - 0.1, zA1 - 0.25], [0.3, R - 0.1, zA1 - 0.25], [0.55, R - 0.05, zA1 - 0.15]], 0.013, 'engineBlack', 40));
    sus.add(at(mesh(rbox(0.75, 0.06, 0.32, 0.02), 'engineBlack'), 0, R - 0.12, zA1 - 0.05));
    anchor('rack', sus, 0, R + 0.05, zA1 - 0.18);
  }

  // ------------------------------------------------------------ exhaust
  {
    const ex = part('exhaust', 'comp-exhaust-system', [0, -0.35, 0], 'undercarriage');
    const eyy = b0 - 0.005;
    const tipZ = zOf(0.995) - 0.02;
    const path: [number, number, number][] = [[0.1, ey - 0.06, engZ - 0.2], [0.12, eyy + 0.07, engZ - 0.42], [0.13, eyy, engZ - 0.75], [0.1, eyy, zA2 + 0.95], [0.18, eyy + 0.03, zA2 + 0.2], [S.exhaust === 'triple' ? 0 : 0.3, eyy + 0.05, zA2 - 0.45]];
    ex.add(tube(path, 0.026, 'steel', 90));
    ex.add(flow('exhaust', path, 0.02));
    ex.add(at(mesh(new THREE.CapsuleGeometry(0.075, 0.3, 6, 16), 'steel'), 0.13, eyy + 0.005, engZ - 0.8, Math.PI / 2, 0, 0));
    ex.add(at(mesh(new THREE.CapsuleGeometry(0.06, 0.35, 6, 16), 'steel'), 0.1, eyy, (zA1 + zA2) / 2 - 0.1, Math.PI / 2, 0, 0));
    ex.add(at(mesh(rbox(0.6, 0.2, 0.36, 0.08), 'steel'), S.exhaust === 'triple' ? 0 : 0.3, eyy + 0.05, zA2 - 0.45));
    // heat shield
    ex.add(at(mesh(rbox(0.3, 0.01, 0.6, 0.004), 'alu'), 0.13, eyy + 0.1, engZ - 0.8));
    const tips: number[] = S.exhaust === 'triple' ? [-0.11, 0, 0.11] : S.exhaust === 'single' ? [0.42] : [0.3];
    for (const x of tips) {
      const big = S.exhaust === 'triple' && x !== 0;
      const r0 = big ? 0.045 : S.exhaust === 'triple' ? 0.03 : 0.035;
      const tip = mesh(new THREE.CylinderGeometry(r0, r0, (zA2 - 0.45) - tipZ, 24, 1, true), 'chrome');
      tip.userData.double = true;
      ex.add(at(tip, x, S.exhaust === 'triple' ? b0 + 0.13 : eyy + 0.04, ((zA2 - 0.45) + tipZ) / 2, Math.PI / 2, 0, 0));
    }
    anchor('cat', ex, 0.13, eyy + 0.05, engZ - 0.8);
    anchor('muffler', ex, S.exhaust === 'triple' ? 0 : 0.3, eyy + 0.12, zA2 - 0.45);
  }

  // ------------------------------------------------------------ engine with moving internals
  const engineCore = { crank: new THREE.Group(), pistons: [] as THREE.Object3D[], rods: [] as THREE.Object3D[], cams: [] as THREE.Object3D[], valves: [] as THREE.Object3D[], sparks: [] as THREE.Mesh[], pulleys: [] as THREE.Object3D[], fan: new THREE.Group(), turbo: null as THREE.Object3D | null, rotor: null as THREE.Object3D | null, crankY: 0, stroke: 0.09, rod: 0.14, pinY: 0 };
  {
    const eng = part('engine', 'comp-engine-block', [0, 0.95, 0.15], 'engine');
    const ex0 = 0.08;
    const crankY = ey - 0.1;
    engineCore.crankY = crankY;
    const bore = 0.074, pitchX = 0.088, r = 0.045, rodL = 0.14;
    engineCore.stroke = r * 2; engineCore.rod = rodL;
    const xs = [-1.5, -0.5, 0.5, 1.5].map((k) => ex0 + k * pitchX);
    // casing (translucent in the powertrain view so the internals read)
    const casing = (geo: THREE.BufferGeometry, mk: MatKey, x: number, y: number, z: number) => { const m = mesh(geo, mk); m.userData.casing = true; eng.add(at(m, x, y, z)); return m; };
    casing(rbox(0.46, 0.22, 0.3, 0.03), 'alu', ex0, ey - 0.02, engZ);
    casing(rbox(0.5, 0.14, 0.32, 0.03), 'alu', ex0, crankY - 0.04, engZ);
    casing(rbox(0.46, 0.09, 0.27, 0.025), 'alu', ex0, ey + 0.135, engZ - 0.01);
    casing(rbox(0.48, 0.055, 0.27, 0.025, 4), S.wing ? 'engineAccent' : 'engineBlack', ex0, ey + 0.205, engZ - 0.01);
    casing(rbox(0.5, 0.08, 0.3, 0.02), 'engineBlack', ex0, crankY - 0.13, engZ);
    for (let i = 0; i < 4; i++) eng.add(at(mesh(rbox(0.06, 0.02, 0.06, 0.008), 'engineBlack'), xs[i], ey + 0.24, engZ - 0.01));
    // intake: plenum + runners at the front, throttle body
    for (let i = 0; i < 4; i++) eng.add(tube([[xs[i], ey + 0.12, engZ + 0.15], [xs[i], ey + 0.2, engZ + 0.24], [xs[i], ey + 0.1, engZ + 0.32]], 0.02, 'engineBlack', 20));
    eng.add(at(mesh(rbox(0.44, 0.09, 0.1, 0.03), 'engineBlack'), ex0, ey + 0.08, engZ + 0.34));
    eng.add(between(new THREE.Vector3(ex0 + 0.22, ey + 0.08, engZ + 0.34), new THREE.Vector3(ex0 + 0.36, ey + 0.12, engZ + 0.38), 0.042, 'alu'));
    // exhaust manifold at the back
    for (let i = 0; i < 4; i++) eng.add(tube([[xs[i], ey + 0.08, engZ - 0.15], [xs[i], ey, engZ - 0.22], [0.1, ey - 0.06, engZ - 0.2]], 0.017, 'steel', 20));
    // accessories
    eng.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), 'alu'), ex0 + 0.33, ey - 0.02, engZ + 0.1, 0, 0, Math.PI / 2));
    anchor('engine', eng, ex0, ey + 0.25, engZ);
    // ---- moving parts
    const core = new THREE.Group();
    core.userData.anim = true;
    eng.add(core);
    const crank = engineCore.crank;
    crank.position.set(0, crankY, engZ);
    core.add(crank);
    crank.add(at(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 16), 'steel'), ex0, 0, 0, 0, 0, Math.PI / 2));
    const phase = [0, Math.PI, Math.PI, 0];
    for (let i = 0; i < 4; i++) {
      const web = new THREE.Group();
      web.position.x = xs[i];
      web.rotation.x = phase[i];
      crank.add(web);
      web.add(at(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 14), 'steel'), 0, r, 0, 0, 0, Math.PI / 2));
      for (const s2 of [-1, 1]) {
        const cw = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24, 1, false, Math.PI * 0.6, Math.PI * 0.8), 'steel');
        web.add(at(cw, s2 * 0.022, -0.005, 0, 0, 0, Math.PI / 2));
        web.add(at(mesh(new THREE.BoxGeometry(0.012, r + 0.02, 0.04), 'steel'), s2 * 0.022, r / 2, 0));
      }
      const piston = new THREE.Group();
      piston.position.set(xs[i], crankY + rodL + r, engZ);
      piston.add(mesh(new THREE.CylinderGeometry(bore / 2 - 0.002, bore / 2 - 0.002, 0.05, 24), 'piston'));
      for (const ry of [0.012, 0.004]) piston.add(at(mesh(new THREE.TorusGeometry(bore / 2 - 0.0015, 0.0015, 4, 24), 'steel'), 0, ry, 0, Math.PI / 2, 0, 0));
      core.add(piston);
      engineCore.pistons.push(piston);
      const rod = new THREE.Group();
      const rodMesh = mesh(new THREE.BoxGeometry(0.014, rodL, 0.022), 'steel');
      rodMesh.position.y = rodL / 2;
      rod.add(rodMesh);
      rod.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 16).rotateZ(Math.PI / 2), 'steel'));
      core.add(rod);
      engineCore.rods.push(rod);
      // chamber spark
      const spark = mesh(new THREE.SphereGeometry(0.02, 12, 8), 'spark', false);
      spark.position.set(xs[i], ey + 0.11, engZ);
      core.add(spark);
      engineCore.sparks.push(spark);
      // valves: two intake (front), two exhaust (rear)
      for (const [vz, kind] of [[0.03, 0], [-0.03, 1]] as const) {
        const valve = new THREE.Group();
        valve.position.set(xs[i], ey + 0.12, engZ + vz);
        valve.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), 'steel'), 0, 0.035, 0));
        valve.add(mesh(new THREE.CylinderGeometry(0.014, 0.008, 0.006, 16), 'steel'));
        valve.userData.kind = kind;
        valve.userData.cyl = i;
        core.add(valve);
        engineCore.valves.push(valve);
      }
    }
    engineCore.pinY = crankY;
    for (const [cz, kind] of [[0.03, 0], [-0.03, 1]] as const) {
      const cam = new THREE.Group();
      cam.position.set(0, ey + 0.2, engZ + cz);
      cam.add(at(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 10), 'steel'), ex0, 0, 0, 0, 0, Math.PI / 2));
      for (let i = 0; i < 4; i++) {
        const lobe = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 3, 1).rotateZ(Math.PI / 2), 'steel');
        lobe.position.x = xs[i];
        lobe.rotation.x = phase[i] + kind * 1.6;
        cam.add(lobe);
      }
      cam.userData.kind = kind;
      core.add(cam);
      engineCore.cams.push(cam);
    }
    // timing pulleys and belt on the end of the engine
    const pz = ex0 + 0.25;
    for (const [py, pr, pzz] of [[crankY, 0.055, engZ], [ey + 0.2, 0.05, engZ + 0.03], [ey + 0.2, 0.05, engZ - 0.03]] as const) {
      const pul = new THREE.Group();
      pul.position.set(pz, py, pzz);
      pul.add(at(mesh(new THREE.CylinderGeometry(pr, pr, 0.018, 24), 'alu'), 0, 0, 0, 0, 0, Math.PI / 2));
      pul.add(at(mesh(new THREE.BoxGeometry(0.02, 0.012, pr * 1.6), 'engineBlack'), 0.004, 0, 0));
      core.add(pul);
      engineCore.pulleys.push(pul);
    }
    eng.add(tube([[pz, crankY - 0.06, engZ], [pz, ey + 0.26, engZ + 0.06], [pz, ey + 0.26, engZ - 0.06], [pz, crankY - 0.06, engZ - 0.01]], 0.005, 'engineBlack', 40));

    // ---- transmission / hybrid unit on the -x side
    const tr = part('cvt', 'comp-turbocharger', [-0.75, 0.55, 0], 'engine');
    const tx = ex0 - 0.42;
    const housing = mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.3, 36), 'alu');
    housing.userData.casing = true;
    tr.add(at(housing, tx, crankY + 0.05, engZ, 0, 0, Math.PI / 2));
    const rotor = new THREE.Group();
    rotor.userData.anim = true;
    rotor.position.set(tx, crankY + 0.05, engZ);
    if (opts.hybrid) {
      // traction motor + generator: stator windings and spinning rotors
      for (const [dx, rr] of [[-0.07, 0.14], [0.08, 0.12]] as const) {
        tr.add(at(mesh(new THREE.TorusGeometry(rr, 0.03, 10, 36), 'copper'), tx + dx, crankY + 0.05, engZ, 0, Math.PI / 2, 0));
        const rot = mesh(new THREE.CylinderGeometry(rr - 0.045, rr - 0.045, 0.1, 24), 'steel');
        rot.rotation.z = Math.PI / 2;
        rot.position.x = dx;
        rotor.add(rot);
        rotor.add(at(mesh(new THREE.BoxGeometry(0.09, 0.012, (rr - 0.045) * 2.02), 'magnet'), dx, 0, 0));
      }
      const pcu = mesh(rbox(0.36, 0.1, 0.26, 0.02), 'alu');
      tr.add(at(pcu, tx + 0.02, ey + 0.16, engZ - 0.02));
      tr.add(at(mesh(rbox(0.3, 0.012, 0.2, 0.004), 'cableHV'), tx + 0.02, ey + 0.215, engZ - 0.02));
      anchor('pcu', tr, tx + 0.02, ey + 0.22, engZ - 0.02);
      anchor('motor', tr, tx - 0.07, crankY + 0.2, engZ);
    } else if (opts.manual) {
      tr.add(at(mesh(rbox(0.22, 0.24, 0.28, 0.04), 'alu'), tx - 0.15, crankY + 0.02, engZ - 0.04));
      for (let i = 0; i < 3; i++) {
        const gear = mesh(new THREE.CylinderGeometry(0.05 + i * 0.02, 0.05 + i * 0.02, 0.02, 18), 'steel');
        gear.rotation.z = Math.PI / 2;
        gear.position.x = -0.05 + i * 0.05;
        rotor.add(gear);
      }
      anchor('motor', tr, tx, crankY + 0.2, engZ);
    } else {
      // CVT: two variable pulleys and the steel belt
      for (const [dz, rr] of [[0.07, 0.07], [-0.08, 0.09]] as const) {
        const cone = mesh(new THREE.ConeGeometry(rr, 0.08, 24), 'steel');
        cone.rotation.z = Math.PI / 2;
        cone.position.set(0, 0, dz);
        rotor.add(cone);
        const cone2 = cone.clone();
        cone2.rotation.z = -Math.PI / 2;
        cone2.position.x = 0.06;
        rotor.add(cone2);
      }
      rotor.add(at(mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 40), 'steel'), 0.03, 0, -0.005, 0, Math.PI / 2, 0));
      anchor('motor', tr, tx, crankY + 0.2, engZ);
    }
    tr.add(rotor);
    engineCore.rotor = rotor;
    // drive shafts to the front wheels
    for (const sd of [-1, 1])
      tr.add(between(new THREE.Vector3(sd < 0 ? tx - 0.12 : ex0 + 0.1, R, zA1), new THREE.Vector3(sd * (S.track / 2 - 0.12), R, zA1), 0.02, 'steel'));

    // turbo (Type R)
    if (opts.turbo) {
      const tb = new THREE.Group();
      tb.position.set(0.18, ey - 0.02, engZ - 0.26);
      tr.add(tb);
      const snail = mesh(new THREE.TorusGeometry(0.06, 0.035, 12, 24), 'steel');
      tb.add(snail);
      const wheel = new THREE.Group();
      wheel.userData.anim = true;
      for (let i = 0; i < 9; i++) wheel.add(at(mesh(new THREE.BoxGeometry(0.004, 0.05, 0.02), 'alu'), 0, 0, 0, 0, 0, (i / 9) * Math.PI * 2));
      tb.add(wheel);
      engineCore.turbo = wheel;
      tr.add(tube([[0.24, ey - 0.02, engZ - 0.26], [0.38, ey + 0.05, engZ + 0.1], [0.3, b0 + 0.25, L / 2 - 0.28], [0, b0 + 0.25, L / 2 - 0.25]], 0.03, 'engineBlack', 50));
      anchor('turbo', tr, 0.18, ey + 0.05, engZ - 0.26);
    }

    // ---- radiator, fan, coolant loop
    const rad = part('radiator', 'comp-radiator', [0, 0.35, 0.9], 'engine');
    const rz = zA1 + 0.42;
    const rh = Math.min(0.42, top(tOf(rz)) - b0 - 0.25);
    const rcy = b0 + 0.16 + rh / 2;
    rad.add(at(mesh(new THREE.BoxGeometry(0.68, rh, 0.035), 'radiator'), 0, rcy, rz));
    for (const s2 of [-1, 1]) rad.add(at(mesh(rbox(0.05, rh + 0.06, 0.06, 0.015), 'engineBlack'), s2 * 0.36, rcy, rz));
    const shroud = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 32, 1, true), 'engineBlack');
    shroud.userData.double = true;
    rad.add(at(shroud, 0.12, rcy, rz - 0.05, Math.PI / 2, 0, 0));
    const fan = engineCore.fan;
    fan.userData.anim = true;
    fan.position.set(0.12, rcy, rz - 0.05);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      fan.add(at(mesh(rbox(0.05, 0.13, 0.008, 0.004), 'engineBlack'), Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0, 0.4, 0, a + Math.PI / 2));
    }
    rad.add(fan);
    anchor('radiator', rad, 0, rcy + rh / 2, rz);
    const coolA: [number, number, number][] = [[0.3, rcy + rh / 2 - 0.04, rz - 0.02], [0.32, ey + 0.16, engZ + 0.3], [0.22, ey + 0.12, engZ + 0.18]];
    const coolB: [number, number, number][] = [[-0.12, ey - 0.08, engZ + 0.16], [-0.3, rcy - rh / 2 + 0.05, rz - 0.15], [-0.3, rcy - rh / 2 + 0.04, rz - 0.02]];
    rad.add(tube(coolA, 0.017, 'hose', 32), tube(coolB, 0.017, 'hose', 32));
    rad.add(flow('coolant', [...coolA], 0.012), flow('coolant', [...coolB].reverse(), 0.012));

    // ---- fuel: tank → line along the tunnel → rail
    const fuel: [number, number, number][] = [[0.35, b0 + 0.12, zA2 + 0.6], [0.18, b0 + 0.1, zA2 + 1.1], [0.15, b0 + 0.1, zc - 0.2], [0.2, ey + 0.05, engZ - 0.05], [ex0, ey + 0.15, engZ + 0.1]];
    eng.add(tube(fuel, 0.006, 'steel', 80));
    eng.add(flow('fuel', fuel, 0.008));
    anchor('fuelRail', eng, ex0, ey + 0.16, engZ + 0.1);
  }

  // ------------------------------------------------------------ high-voltage system (e:HEV)
  if (opts.hybrid) {
    const hv = part('battery', 'comp-battery-pack', [0, 0.6, -0.4], 'engine');
    const bz = seatZ - 0.75;
    const pack = mesh(rbox(0.9, 0.2, 0.42, 0.03), 'alu');
    pack.userData.casing = true;
    hv.add(at(pack, 0, b0 + 0.2, bz));
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 2; j++) hv.add(at(mesh(rbox(0.12, 0.13, 0.17, 0.01), 'cells'), -0.35 + i * 0.14, b0 + 0.2, bz - 0.095 + j * 0.19));
    hv.add(at(mesh(rbox(0.3, 0.06, 0.14, 0.01), 'engineBlack'), 0.3, b0 + 0.33, bz));
    anchor('battery', hv, 0, b0 + 0.35, bz);
    const hvPath: [number, number, number][] = [[-0.3, b0 + 0.2, bz + 0.22], [-0.18, b0 + 0.08, bz + 0.6], [-0.15, b0 + 0.08, zc - 0.2], [-0.3, ey + 0.1, engZ - 0.15], [-0.34, ey + 0.2, engZ - 0.02]];
    hv.add(tube(hvPath, 0.014, 'cableHV', 80));
    hv.add(flow('hv', hvPath, 0.011));
  }

  // ------------------------------------------------------------ electrics, ECU, ADAS, brake lines
  {
    const ecu = part('ecu', 'comp-ecu', [0.55, 0.65, 0], 'electrical');
    const ecuPos = new THREE.Vector3(0.5, ey + 0.14, zc + 0.16);
    ecu.add(at(mesh(rbox(0.2, 0.05, 0.16, 0.012), 'alu'), ecuPos.x, ecuPos.y, ecuPos.z));
    for (let i = 0; i < 6; i++) ecu.add(at(mesh(new THREE.BoxGeometry(0.19, 0.012, 0.006), 'alu'), ecuPos.x, ecuPos.y + 0.03, ecuPos.z - 0.06 + i * 0.024));
    ecu.add(at(mesh(rbox(0.06, 0.035, 0.04, 0.008), 'engineBlack'), ecuPos.x - 0.11, ecuPos.y, ecuPos.z));
    const led = mesh(new THREE.SphereGeometry(0.007, 8, 6), 'led', false);
    led.userData.keep = true;
    ecu.add(at(led, ecuPos.x + 0.06, ecuPos.y + 0.03, ecuPos.z + 0.07));
    anchor('ecu', ecu, ecuPos.x, ecuPos.y + 0.05, ecuPos.z);
    // 12 V battery
    P('shell').add(at(mesh(rbox(0.24, 0.19, 0.17, 0.015), 'engineBlack'), -0.48, ey + 0.08, zc + 0.24));
    // ABS / ESC modulator on the firewall
    const esc = mesh(rbox(0.12, 0.1, 0.1, 0.012), 'alu');
    P('shell').add(at(esc, 0.38, ey + 0.02, zc + 0.08));
    anchor('esc', P('shell'), 0.38, ey + 0.08, zc + 0.08);
    // brake lines from the modulator to each corner
    const bl = part('brakeLines', null, [0, 0, 0], 'undercarriage');
    for (const c of corners) {
      const p: [number, number, number][] = [[0.38, ey, zc + 0.06], [c.side * 0.3, b0 + 0.12, c.front ? zc : zA2 + 0.3], [c.pos.x - c.side * 0.14, R + 0.08, c.pos.z]];
      bl.add(tube(p, 0.004, 'steel', 50));
      bl.add(flow('brake', p, 0.006));
    }
    const harness = part('harness', 'comp-wiring-harness', [0, 0.45, -0.15], 'electrical');
    const hb: [number, number, number] = [ecuPos.x - 0.11, ecuPos.y, ecuPos.z];
    const hlz = zOf(0.03), hly = yHL0 + 0.02;
    const runs: [number, number, number][][] = [
      [hb, [0.2, ey + 0.32, zc + 0.12], [0.05, ey + 0.34, engZ - 0.12], [-0.15, ey + 0.3, engZ - 0.1]],
      [hb, [0.3, ey + 0.1, zc + 0.04], [0.1, b0 + 0.25, zc - 0.05], [0.05, b0 + 0.12, zc - 0.6], [0.0, b0 + 0.12, zA2 + 0.2], [0, yTL1 - 0.1, -L / 2 + 0.2]],
      [hb, [0.38, ey + 0.04, zc + 0.08]],
      [hb, [0.25, ey + 0.2, zc + 0.02], [0, top(S.tRoofF - 0.025) - 0.08, zOf(S.tRoofF - 0.025) - 0.04]],
      [hb, [0.45, ey + 0.2, engZ + 0.1], [0.05, b0 + 0.32, L / 2 - 0.1]],
    ];
    for (const sd of [-1, 1]) runs.push([hb, [0.45, ey + 0.2, engZ + 0.1], [sd * 0.5, ey + 0.18, zA1 + 0.4], [sd * (hw - 0.2), hly, hlz - 0.1]]);
    for (const r of runs) { harness.add(tube(r, 0.009, 'cable', 60)); harness.add(flow('can', r, 0.007)); }
    anchor('harness', harness, 0.2, ey + 0.32, zc + 0.12);
    const adas = part('adas', 'comp-adas-sensors', [0, 0.35, 0.6], 'electrical');
    const tc = S.tRoofF - 0.025;
    adas.add(at(mesh(rbox(0.13, 0.06, 0.09, 0.015), 'sensor'), 0, top(tc) - 0.07, zOf(tc) - 0.02, -0.5, 0, 0));
    adas.add(at(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), 'lens'), 0, top(tc) - 0.085, zOf(tc) + 0.03, Math.PI / 2 - 0.5, 0, 0));
    adas.add(at(mesh(rbox(0.12, 0.09, 0.03, 0.01), 'sensor'), 0, b0 + 0.3, L / 2 - 0.06));
    anchor('camera', adas, 0, top(tc) - 0.07, zOf(tc));
    anchor('radar', adas, 0, b0 + 0.3, L / 2 - 0.04);
  }

  // ------------------------------------------------------------ cabin
  const vents: { pos: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const steeringWheel = new THREE.Group();
  {
    const e = eBelt;
    const dashW = cowl.xs * 2 - 0.14;
    const dash = part('dashboard', 'comp-dashboard', [0, 0.5, 0.35], 'interior');
    const d0 = zc - 0.12;
    // upper pad: a sculpted soft-touch profile from the windshield base to the cabin
    const pad = roundedProfile([[d0 + 0.06, e - 0.02], [d0 - 0.18, e + 0.035], [d0 - 0.44, e + 0.01], [d0 - 0.52, e - 0.06], [d0 - 0.5, e - 0.11], [d0 - 0.2, e - 0.12], [d0 + 0.04, e - 0.1]], 0.04);
    dash.add(mesh(profileX(pad, dashW, 0.025), 'interiorDark'));
    // mid band: the trim strip with the full-width honeycomb vent
    const mid = roundedProfile([[d0 - 0.5, e - 0.11], [d0 - 0.56, e - 0.13], [d0 - 0.56, e - 0.22], [d0 - 0.48, e - 0.24], [d0 - 0.2, e - 0.24], [d0 - 0.2, e - 0.11]], 0.02);
    dash.add(mesh(profileX(mid, dashW - 0.02, 0.012), 'interior'));
    dash.add(at(mesh(new THREE.BoxGeometry(dashW - 0.12, 0.045, 0.01), 'grille'), 0, e - 0.165, d0 - 0.567));
    dash.add(at(mesh(new THREE.BoxGeometry(dashW - 0.1, 0.006, 0.012), 'chrome'), 0, e - 0.137, d0 - 0.566));
    // lower dash and knee bolsters
    const low = roundedProfile([[d0 - 0.48, e - 0.24], [d0 - 0.42, e - 0.42], [d0 - 0.18, e - 0.45], [d0 - 0.2, e - 0.24]], 0.03);
    dash.add(mesh(profileX(low, dashW - 0.04, 0.02), 'interiorDark'));
    // driver binnacle hood
    const bin = roundedProfile([[d0 - 0.3, e + 0.02], [d0 - 0.36, e + 0.1], [d0 - 0.5, e + 0.11], [d0 - 0.52, e + 0.02]], 0.03);
    const binG = profileX(bin, 0.36, 0.015);
    dash.add(at(mesh(binG, 'interiorDark'), -0.37, 0, 0));
    const cl = mesh(new THREE.PlaneGeometry(0.3, 0.1), 'cluster', false);
    cl.userData.keep = true;
    dash.add(at(cl, -0.37, e + 0.05, d0 - 0.505, -0.18, Math.PI, 0));
    // centre stack and glovebox seam
    dash.add(at(mesh(rbox(0.26, 0.22, 0.12, 0.02), 'interiorDark'), 0, e - 0.34, d0 - 0.42));
    for (let i = 0; i < 5; i++) dash.add(at(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), 'alu'), -0.08 + i * 0.04, e - 0.3, d0 - 0.485, Math.PI / 2, 0, 0));
    dash.add(at(mesh(new THREE.BoxGeometry(0.45, 0.003, 0.004), 'trimBlack'), 0.38, e - 0.3, d0 - 0.475));
    // ambient light line
    const amb = mesh(new THREE.BoxGeometry(dashW - 0.14, 0.004, 0.004), 'ambient', false);
    amb.userData.keep = true;
    dash.add(at(amb, 0, e - 0.115, d0 - 0.505));
    for (const x of [-0.6, -0.12, 0.12, 0.6]) vents.push({ pos: new THREE.Vector3(x, e - 0.165, d0 - 0.58), dir: new THREE.Vector3(x * 0.15, 0.08, -1).normalize() });
    anchor('dashboard', dash, 0.3, e + 0.04, d0 - 0.3);

    const info = part('infotainment', 'comp-infotainment', [0, 0.3, -0.45], 'interior');
    info.add(at(mesh(rbox(0.3, 0.19, 0.022, 0.012), 'interiorDark'), 0.03, e + 0.1, d0 - 0.45, -0.14, 0, 0));
    const scr = mesh(new THREE.PlaneGeometry(0.28, 0.17), 'info', false);
    scr.userData.keep = true;
    info.add(at(scr, 0.03, e + 0.1, d0 - 0.462, -0.14, Math.PI, 0));
    anchor('screen', info, 0.03, e + 0.2, d0 - 0.45);

    // steering wheel
    const sw = part('steering', 'comp-steering-wheel', [0, 0.25, -0.5], 'interior');
    const swc = new THREE.Vector3(-0.37, e - 0.04, d0 - 0.72);
    steeringWheel.position.copy(swc);
    steeringWheel.rotation.x = -0.36;
    steeringWheel.userData.anim = true;
    const swInner = new THREE.Group();
    steeringWheel.add(swInner);
    swInner.add(mesh(new THREE.TorusGeometry(0.185, 0.02, 16, 64), 'leather'));
    swInner.add(at(mesh(rbox(0.13, 0.1, 0.05, 0.03, 4), 'interiorDark'), 0, -0.01, 0.02));
    swInner.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24), 'chrome'), 0, -0.005, 0.047, Math.PI / 2, 0, 0));
    for (const a of [0, Math.PI, -Math.PI / 2]) {
      const sp = mesh(rbox(0.12, 0.034, 0.02, 0.01), 'interiorDark');
      sp.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11 - 0.01, 0.01);
      sp.rotation.z = a;
      swInner.add(sp);
    }
    for (const sd of [-1, 1]) {
      swInner.add(at(mesh(rbox(0.03, 0.05, 0.008, 0.004), 'alu'), sd * 0.075, 0.0, 0.035));
      swInner.add(at(mesh(rbox(0.05, 0.07, 0.006, 0.004), 'alu'), sd * 0.14, 0.04, -0.035));
    }
    sw.add(steeringWheel);
    sw.add(between(swc, new THREE.Vector3(-0.37, e - 0.18, d0 - 0.46), 0.032, 'interiorDark'));
    sw.add(at(mesh(rbox(0.12, 0.07, 0.16, 0.025), 'interiorDark'), -0.37, e - 0.13, d0 - 0.56, -0.36, 0, 0));
    anchor('steering', sw, -0.37, e + 0.12, d0 - 0.72);

    // seats: lofted cushions with bolsters, two-tone with a perforated insert
    const seats = part('seats', 'comp-front-seats', [0, 0.7, -0.4], 'interior');
    const makeSeat = (parent: THREE.Object3D, x: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, sy, z);
      parent.add(g);
      const cushion = roundedProfile([[0.27, -0.06], [0.29, 0.05], [0.2, 0.08], [-0.2, 0.06], [-0.24, -0.06]], 0.04);
      g.add(mesh(profileX(cushion, 0.36, 0.03), 'leatherInsert'));
      for (const s2 of [-1, 1]) g.add(at(mesh(profileX(roundedProfile([[0.25, -0.06], [0.25, 0.1], [-0.22, 0.1], [-0.24, -0.06]], 0.04), 0.08, 0.025), 'leather'), s2 * 0.22, 0, 0));
      const back = new THREE.Group();
      back.position.set(0, 0.05, -0.22);
      back.rotation.x = -0.2;
      g.add(back);
      back.add(mesh(profileX(roundedProfile([[0.02, 0], [0.05, 0.3], [0.03, 0.6], [-0.06, 0.62], [-0.08, 0.3], [-0.06, 0]], 0.03), 0.36, 0.025), 'leatherInsert'));
      for (const s2 of [-1, 1]) back.add(at(mesh(profileX(roundedProfile([[0.06, 0], [0.09, 0.32], [0.05, 0.6], [-0.08, 0.6], [-0.1, 0.3], [-0.08, 0]], 0.035), 0.08, 0.025), 'leather'), s2 * 0.22, 0, 0, 0, -s2 * 0.12, 0));
      back.add(at(mesh(rbox(0.26, 0.16, 0.09, 0.04, 4), 'leather'), 0, 0.72, -0.03));
      for (const s2 of [-1, 1]) back.add(at(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8), 'chrome'), s2 * 0.08, 0.63, -0.03));
      g.add(at(mesh(rbox(0.06, 0.06, 0.5, 0.02), 'interiorDark'), 0, -0.12, 0));
      g.add(at(mesh(rbox(0.38, 0.05, 0.46, 0.02), 'interiorDark'), 0, -0.09, 0));
    };
    makeSeat(seats, -0.37, seatZ);
    makeSeat(seats, 0.37, seatZ);
    anchor('seat', seats, -0.37, sy + 0.75, seatZ - 0.25);

    // centre console, selector, cupholders, armrest
    const sh = P('shell');
    const cz0 = d0 - 0.62, cz1 = seatZ - 0.3;
    sh.add(at(mesh(rbox(0.22, 0.24, cz0 - cz1, 0.05, 4), 'interiorDark'), 0, b0 + 0.3, (cz0 + cz1) / 2));
    sh.add(at(mesh(rbox(0.2, 0.012, cz0 - cz1 - 0.06, 0.006), 'trim'), 0, b0 + 0.425, (cz0 + cz1) / 2));
    sh.add(at(mesh(rbox(0.2, 0.08, 0.3, 0.04, 4), 'leather'), 0, b0 + 0.46, cz1 + 0.18));
    for (const dz of [0.05, 0.14]) sh.add(at(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.01, 24), 'trimBlack'), 0, b0 + 0.428, cz0 - 0.14 - dz));
    if (opts.manual) {
      sh.add(at(mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 10), 'alu'), 0, b0 + 0.5, cz0 - 0.05));
      sh.add(at(mesh(new THREE.SphereGeometry(0.03, 20, 14), 'alu'), 0, b0 + 0.58, cz0 - 0.05));
    } else {
      sh.add(at(mesh(rbox(0.05, 0.08, 0.1, 0.02), 'interiorDark'), 0, b0 + 0.465, cz0 - 0.06));
      sh.add(at(mesh(rbox(0.054, 0.012, 0.104, 0.004), 'chrome'), 0, b0 + 0.508, cz0 - 0.06));
    }
    // pedals
    for (const [x, w] of [[-0.48, 0.05], [-0.38, 0.09]] as const) sh.add(at(mesh(rbox(w, 0.08, 0.012, 0.004), 'alu'), x, b0 + 0.2, d0 - 0.36, -0.5, 0, 0));
    // carpet
    sh.add(at(mesh(new THREE.BoxGeometry(S.W - 0.3, 0.02, zc - zA2 - 0.65), 'carpet'), 0, b0 + 0.12, (zc + zA2 + 0.6) / 2 - 0.05));
    // rear bench
    const rz = zOf(tRD) + 0.32;
    for (const x of [-0.42, 0, 0.42]) {
      sh.add(at(mesh(profileX(roundedProfile([[0.25, -0.06], [0.26, 0.06], [-0.2, 0.08], [-0.22, -0.06]], 0.045), 0.42, 0.03), 'leatherInsert'), x, sy + 0.02, rz));
      const bk = new THREE.Group();
      bk.position.set(x, sy + 0.08, rz - 0.22);
      bk.rotation.x = -0.24;
      bk.add(mesh(profileX(roundedProfile([[0.02, 0], [0.05, 0.3], [0.03, 0.55], [-0.08, 0.56], [-0.09, 0]], 0.035), 0.42, 0.03), 'leatherInsert'));
      bk.add(at(mesh(rbox(0.22, 0.13, 0.08, 0.035, 4), 'leather'), 0, 0.64, -0.03));
      sh.add(bk);
    }
    // parcel shelf / boot floor
    if (S.kind === 'sedan') sh.add(at(mesh(new THREE.BoxGeometry(S.W - 0.3, 0.015, 0.35), 'interiorDark'), 0, top(S.tDeck - 0.02) - 0.08, zOf(S.tDeck - 0.04)));
    // door cards: armrests, pulls, speakers on every door
    for (const [tt, key] of [[(tDF + tB) / 2, 'F'], [(tB + tRD) / 2, 'R']] as const)
      for (const sd of [-1, 1]) {
        const dk = key === 'F' ? (sd < 0 ? 'comp-front-left-door' : 'comp-front-right-door') : sd < 0 ? 'rearDoorL' : 'rearDoorR';
        const dg = P(dk);
        const ya = e - 0.13, ys = b0 + 0.3;
        const xa = sd * (surfX(tt, ya) - 0.11), xs2 = sd * (surfX(tt, ys) - 0.1);
        const len = (key === 'F' ? tB - tDF : tRD - tB) * L * 0.6;
        dg.add(at(mesh(rbox(0.07, 0.05, len, 0.02), 'leather'), xa, ya, zOf(tt)));
        dg.add(at(mesh(rbox(0.02, 0.03, 0.12, 0.008), 'chrome'), xa - sd * 0.01, ya + 0.08, zOf(tt) + len * 0.35));
        dg.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 28), 'grille'), xs2, ys, zOf(tt) + len * 0.25, 0, 0, Math.PI / 2));
        const ambD = mesh(new THREE.BoxGeometry(0.004, 0.004, len * 1.1), 'ambient', false);
        ambD.userData.keep = true;
        dg.add(at(ambD, xa, ya + 0.04, zOf(tt)));
      }
  }

  // hood hinge pivot
  const hoodPivot = new THREE.Group();
  hoodPivot.userData.anim = true;
  const hinge = new THREE.Vector3(0, top(S.tCowl) + 0.01, zc + 0.02);
  hoodPivot.position.copy(hinge);
  sprung.add(hoodPivot);
  const hoodG = partGroups.get('comp-hood')!;
  hoodPivot.add(hoodG);
  hoodG.position.set(-hinge.x, -hinge.y, -hinge.z);

  // merge statics and record explode bases
  const parts = [...partGroups.values()];
  for (const g of parts) mergePart(g);
  for (const g of parts) (g.userData as unknown as PartData).base.copy(g.position);

  // gap metrology lines along each shut line, just proud of the paint
  const shutLines: ShutLine[] = [];
  {
    const line = (id: string, compId: string | null, label: string, partKey: string, t: number, cFrom: number, cTo: number, side: number) => {
      const s = section(t);
      const pts: THREE.Vector3[] = [];
      for (let c = cFrom; c <= cTo; c++) {
        const p = s.pts[c];
        pts.push(new THREE.Vector3(side * (p[0] + 0.006), p[1], zOf(t)));
      }
      shutLines.push({ id, compId, label, pts, part: partKey });
    };
    for (const sd of [-1, 1]) {
      const fd = sd < 0 ? 'comp-front-left-door' : 'comp-front-right-door';
      const sideName = sd < 0 ? 'LH' : 'RH';
      line(`doorF${sd}`, fd, `Front door / fender ${sideName}`, fd, tDF, 11, 21, sd);
      line(`doorB${sd}`, fd, `B-pillar shut line ${sideName}`, fd, tB, 11, 30, sd);
      line(`doorR${sd}`, null, `Rear door / quarter ${sideName}`, 'shell', tRD, 11, 28, sd);
      // hood edge runs along the length at the belt column
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = lerp(tHoodF + 0.01, S.tCowl - 0.01, i / 16);
        const s = section(t);
        const p = s.pts[22];
        pts.push(new THREE.Vector3(sd * (p[0] + 0.004), p[1] + 0.004, zOf(t)));
      }
      shutLines.push({ id: `hood${sd}`, compId: 'comp-hood', label: `Hood / fender ${sideName}`, pts, part: 'comp-hood' });
    }
    {
      const s = section(tTrunk);
      const pts: THREE.Vector3[] = [];
      for (let c = 34; c <= 41; c++) pts.push(new THREE.Vector3(s.pts[c][0], s.pts[c][1] + 0.005, zOf(tTrunk)));
      for (let c = 40; c >= 34; c--) pts.unshift(new THREE.Vector3(-s.pts[c][0], s.pts[c][1] + 0.005, zOf(tTrunk)));
      shutLines.push({ id: 'trunk', compId: null, label: S.kind === 'sedan' ? 'Boot lid' : 'Tailgate', pts, part: S.kind === 'sedan' ? 'trunk' : 'tailgate' });
    }
  }

  const eyeY = sy + 0.78;
  return {
    root, sprung, parts, corners, hoodPivot,
    engine: engineCore,
    steeringWheel,
    rack,
    anchors,
    shutLines,
    vents,
    dims: {
      L, W: S.W, zA1, zA2, track: S.track, R, b0, tyreW: S.tyreW, cowlZ: zc, beltY: eBelt, roofY: top((S.tRoofF + S.tRoofR) / 2),
      eye: new THREE.Vector3(-0.37, eyeY, seatZ - 0.22), rearEye: new THREE.Vector3(0.3, eyeY - 0.02, zOf(tRD) + 0.12), seatZ, hoodHinge: hinge, engine: new THREE.Vector3(0.08, ey, engZ),
    },
    surface: { top, zOf },
  };
}
