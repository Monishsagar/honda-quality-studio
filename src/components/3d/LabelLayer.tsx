import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShowroomStore } from '../../store/useShowroomStore';
import { useControls } from '../../sim/controls';
import { simSpecFor } from '../../sim/specs';
import { live } from '../../sim/sim';
import { carRegistry } from '../../three/registry';
import { gapReadings, paintSpots } from '../../three/metrology';
import { paintThickness } from '../../three/materials';
import { laneZ } from './TestRig';

interface Def { id: string; text: string; cls?: string; sub?: () => string; at: () => THREE.Vector3 | null }
const f0 = (x: number) => Math.round(x).toLocaleString('en-US');

/** Pills pinned to parts of the inspected car, with live values. */
export function LabelLayer() {
  const { viewMode, activeVehicleId, inspectionDomain, getActiveVehicle, selectedComponentId } = useShowroomStore();
  const c = useControls();
  const v = getActiveVehicle();
  const defs = useMemo((): Def[] => {
    const car = carRegistry.get(activeVehicleId);
    if (!car || viewMode !== 'inspection' || selectedComponentId || c.view === 'exploded') return [];
    const spec = simSpecFor(activeVehicleId);
    const tmp = new THREE.Vector3();
    const A = (name: string) => () => { const o = car.anchors[name]; return o ? o.getWorldPosition(tmp).clone() : null; };
    const local = (p: THREE.Vector3) => () => { const par = car.root.parent; return par ? p.clone().applyMatrix4(par.matrixWorld) : null; };
    const L = live;
    const out: Def[] = [];
    const add = (d: Def) => out.push(d);
    switch (inspectionDomain) {
      case 'exterior':
        if (c.exterior === 'gaps') {
          for (const g of gapReadings(car, v)) if (g.id === 'trunk' || (g.id.endsWith('1') && !g.id.endsWith('-1')))
            add({ id: g.id, text: g.label.replace(' RH', ''), cls: g.status, sub: () => `${g.gap.toFixed(2)} mm · flush ${g.flush.toFixed(1)}`, at: local(g.at) });
        } else if (c.exterior === 'paint') {
          paintSpots(v).forEach((s, i) => add({ id: `p${i}`, text: 'Film', cls: 'fail', sub: () => `${f0(paintThickness(s.pos, paintSpots(v)))} µm`, at: local(s.pos.clone().add(new THREE.Vector3(0, 0.05, 0))) }));
        }
        break;
      case 'interior':
        if (c.interior === 'cabin') {
          add({ id: 'dash', text: 'Dashboard', at: A('dashboard') });
          add({ id: 'scr', text: 'Display audio', at: A('screen') });
          add({ id: 'sw', text: 'Steering wheel', at: A('steering') });
          add({ id: 'seat', text: 'Front seats', at: A('seat') });
        }
        break;
      case 'engine':
        add({ id: 'eng', text: spec.hybrid ? 'Engine' : spec.engineName.split(' ').slice(0, 2).join(' ') + ' engine', cls: 'heat', sub: () => (L.rpm > 100 ? `${f0(L.rpm / 10) }0 rpm` : 'off'), at: A('engine') });
        if (spec.hybrid) {
          add({ id: 'mot', text: 'Traction motor', cls: 'elec', sub: () => `${f0(L.motorKW)} kW`, at: A('motor') });
          add({ id: 'bat', text: 'IPU battery', cls: 'elec', sub: () => `${f0(L.soc * 100)}% · ${f0(L.batteryKW)} kW`, at: A('battery') });
          add({ id: 'pcu', text: 'Power control unit', cls: 'elec', at: A('pcu') });
        } else add({ id: 'tr', text: spec.manual ? '6-speed gearbox' : 'CVT', sub: () => (spec.manual ? `gear ${L.gear}` : `ratio ${L.ratio.toFixed(2)}`), at: A('motor') });
        add({ id: 'rad', text: 'Radiator', cls: 'cool', sub: () => `${f0(L.coolant)} °C`, at: A('radiator') });
        add({ id: 'fuel', text: 'Fuel rail', cls: 'fuel', sub: () => `${L.fuelLh.toFixed(1)} L/h`, at: A('fuelRail') });
        if (spec.turbo) add({ id: 'tb', text: 'Turbocharger', cls: 'heat', sub: () => `${L.boost.toFixed(2)} bar`, at: A('turbo') });
        break;
      case 'undercarriage':
        if (c.chassis === 'hoist') {
          add({ id: 'cat', text: 'Catalytic converter', cls: 'heat', sub: () => `${f0(L.exhaust)} °C`, at: A('cat') });
          add({ id: 'muf', text: 'Silencer', at: A('muffler') });
          add({ id: 'tank', text: 'Fuel tank', cls: 'fuel', at: A('tank') });
          add({ id: 'rack', text: 'Steering rack', at: A('rack') });
          add({ id: 'sp', text: 'MacPherson strut', at: A('springR') });
        } else if (c.chassis === 'shaker') {
          add({ id: 'spR', text: 'Front right', sub: () => `${f0((L.zs[1] - L.zu[1]) * 1000)} mm · ${f0(L.tyreLoad[1] * 100)}% load`, cls: 'pass', at: A('springR') });
          add({ id: 'spL', text: 'Front left', sub: () => `${f0((L.zs[0] - L.zu[0]) * 1000)} mm · ${f0(L.tyreLoad[0] * 100)}% load`, cls: 'pass', at: A('springL') });
        } else {
          add({ id: 'disc', text: 'Front disc', cls: 'heat', sub: () => `${f0(L.disc[1])} °C`, at: A('discR') });
          add({ id: 'esc', text: 'ABS modulator', cls: 'fail', sub: () => `${f0(L.brakeBar)} bar`, at: A('esc') });
        }
        break;
      case 'electrical':
        add({ id: 'radar', text: 'Radar', cls: 'elec', sub: () => (L.radarHit ? `${L.targetDist.toFixed(1)} m` : 'scanning'), at: A('radar') });
        add({ id: 'cam', text: 'Camera', cls: 'can', sub: () => (L.camHit ? 'tracking' : 'scanning'), at: A('camera') });
        add({ id: 'ecu', text: 'ECU', cls: 'can', sub: () => `CAN ${L.adas === 'AEB' ? 82 : 41}% load`, at: A('ecu') });
        add({ id: 'tgt', text: 'Target', cls: L.adas === 'AEB' ? 'fail' : 'warn', sub: () => (L.detected ? `${L.targetDist.toFixed(1)} m · TTC ${Number.isFinite(L.ttc) ? L.ttc.toFixed(1) + ' s' : '—'}` : '—'), at: () => (L.detected ? local(new THREE.Vector3(L.pedestrian ? L.targetLat * 0.8 : 0, L.pedestrian ? 2 : 1.75, car.dims.L / 2 + laneZ(L.targetDist) + (L.pedestrian ? 0 : 2)))() : null) });
        break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeVehicleId, inspectionDomain, c.exterior, c.interior, c.chassis, c.view, v, selectedComponentId]);
  return <>{defs.map((d) => <Label key={d.id} def={d} />)}</>;
}

function Label({ def }: { def: Def }) {
  const g = useRef<THREE.Group>(null);
  const sub = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const n = useRef(0);
  useFrame(() => {
    const p = def.at();
    if (!g.current) return;
    if (box.current) box.current.style.opacity = p ? '1' : '0';
    if (p) g.current.position.copy(p);
    if (def.sub && sub.current && n.current++ % 6 === 0) sub.current.textContent = def.sub();
  });
  return (
    <group ref={g}>
      <Html zIndexRange={[15, 10]} style={{ pointerEvents: 'none' }}>
        <div ref={box} className={`lbl ${def.cls ?? ''}`}><i /><span>{def.text}</span>{def.sub && <em ref={sub} />}</div>
      </Html>
    </group>
  );
}
