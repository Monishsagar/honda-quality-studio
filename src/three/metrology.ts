import * as THREE from 'three';
import { VehicleData } from '../types/vehicle';
import type { BuiltCar } from './buildCar';
import { Hotspot, paintThickness } from './materials';

/** Deterministic pseudo-random in [0,1) from a string seed. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export const GAP_NOMINAL = 3.5, GAP_TOL = 0.5;

export interface GapReading { id: string; label: string; compId: string | null; gap: number; flush: number; status: 'pass' | 'warning' | 'fail'; samples: number[]; at: THREE.Vector3 }

/** Gap and flush per shut line. A door with a recorded misalignment defect reads its real values. */
export function gapReadings(car: BuiltCar, v: VehicleData): GapReading[] {
  const defective = new Set(v.components.filter((c) => c.currentDefects.some((d) => d.type === 'misalignment' || d.type === 'dent')).map((c) => c.id));
  return car.shutLines.map((sl) => {
    const bad = sl.compId !== null && defective.has(sl.compId);
    const samples: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = hash(`${v.id}:${sl.id}:${i}`) - 0.5;
      const k = i / 11;
      samples.push(bad ? 3.2 + k * 2.0 + r * 0.15 : GAP_NOMINAL + (hash(`${v.id}:${sl.id}`) - 0.5) * 0.4 + r * 0.22);
    }
    const gap = samples.reduce((a, b) => a + b, 0) / samples.length;
    const flush = bad ? 1.4 : (hash(`${v.id}:${sl.id}:f`) - 0.5) * 0.6;
    const worst = Math.max(...samples.map((s) => Math.abs(s - GAP_NOMINAL)));
    const status = worst > GAP_TOL * 2 ? 'fail' : worst > GAP_TOL ? 'warning' : 'pass';
    const at = sl.pts[Math.floor(sl.pts.length / 2)].clone();
    return { id: sl.id, label: sl.label, compId: sl.compId, gap, flush, status, samples, at };
  });
}

/** Process capability of all gap samples against the 3.5 ± 0.5 mm spec. */
export function cpk(readings: GapReading[]) {
  const all = readings.flatMap((r) => r.samples);
  const mu = all.reduce((a, b) => a + b, 0) / all.length;
  const sd = Math.sqrt(all.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (all.length - 1));
  const usl = GAP_NOMINAL + GAP_TOL, lsl = GAP_NOMINAL - GAP_TOL;
  return { mu, sd, cpk: Math.min(usl - mu, mu - lsl) / (3 * sd) };
}

/** Paint hot spots from recorded defects (scratches thin the film locally). */
export function paintSpots(v: VehicleData): Hotspot[] {
  const out: Hotspot[] = [];
  for (const c of v.components)
    for (const d of c.currentDefects)
      if (d.visualPosition && c.domain === 'exterior') out.push({ pos: new THREE.Vector3(...d.visualPosition), r: d.type === 'dent' ? 0.16 : 0.12, k: d.type === 'scratch' ? 28 : d.type === 'dent' ? 14 : 20 });
  return out.slice(0, 4);
}

/** Film thickness statistics sampled over the painted body. */
export function paintStats(car: BuiltCar, spots: Hotspot[]) {
  const vals: number[] = [];
  const p = new THREE.Vector3();
  for (const g of car.parts)
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m.userData.mk !== 'paint' && m.userData.mk !== 'roofPaint')) return;
      const pos = m.geometry.getAttribute('position');
      const idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 97) {
        p.fromBufferAttribute(pos, idx ? idx.getX(i) : i);
        vals.push(paintThickness(p, spots));
      }
    });
  vals.sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, vals.length - 1));
  return { mean, sd, min: vals[0] ?? 0, max: vals[vals.length - 1] ?? 0, n: vals.length, below: vals.filter((x) => x < 120).length };
}
