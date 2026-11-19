import { Live } from '../sim/sim';
import { SimSpec } from '../sim/specs';
import { useControls } from '../sim/controls';
import { VehicleData, InspectionDomain } from '../types/vehicle';
import { fmt } from './useLive';
import { cpk, GapReading } from '../three/metrology';

export interface Chip { k: string; v: string; u?: string; cls?: 'pass' | 'warn' | 'fail' }

type Ctl = ReturnType<typeof useControls.getState>;
interface Ctx { L: Live; spec: SimSpec; v: VehicleData; c: Ctl; gaps: GapReading[]; paint: { mean: number; sd: number; min: number; max: number; below: number }; score: number }

export function chipsFor(d: InspectionDomain, x: Ctx): Chip[] {
  const { L, spec, c, v } = x;
  const defects = v.components.reduce((n, cc) => n + cc.currentDefects.length, 0);
  if (d === 'exterior') {
    const g = cpk(x.gaps);
    const out = x.gaps.filter((r) => r.status !== 'pass').length;
    if (c.exterior === 'paint') return [
      { k: 'Mean film', v: fmt(x.paint.mean), u: 'µm' }, { k: 'Std dev', v: fmt(x.paint.sd, 1), u: 'µm' },
      { k: 'Min', v: fmt(x.paint.min), u: 'µm', cls: x.paint.min < 110 ? 'fail' : x.paint.min < 120 ? 'warn' : 'pass' }, { k: 'Below 120 µm', v: fmt(x.paint.below), u: 'pts', cls: x.paint.below ? 'warn' : 'pass' },
    ];
    if (c.exterior === 'gaps') return [
      { k: 'Mean gap', v: fmt(g.mu, 2), u: 'mm' }, { k: 'Std dev', v: fmt(g.sd, 2), u: 'mm' },
      { k: 'Cpk', v: fmt(g.cpk, 2), cls: g.cpk >= 1.33 ? 'pass' : g.cpk >= 1 ? 'warn' : 'fail' }, { k: 'Out of tol.', v: `${out}/${x.gaps.length}`, cls: out ? 'fail' : 'pass' },
    ];
    return [
      { k: 'TQM score', v: fmt(x.score), u: '/100', cls: x.score >= 90 ? 'pass' : x.score >= 75 ? 'warn' : 'fail' }, { k: 'Open defects', v: fmt(defects), cls: defects ? 'warn' : 'pass' },
      { k: 'Paint mean', v: fmt(x.paint.mean), u: 'µm' }, { k: 'Gap Cpk', v: fmt(g.cpk, 2), cls: g.cpk >= 1.33 ? 'pass' : g.cpk >= 1 ? 'warn' : 'fail' },
    ];
  }
  if (d === 'interior') return [
    { k: 'Cabin', v: fmt(L.cabinT, 1), u: '°C' }, { k: 'Vent', v: fmt(L.ventT), u: '°C' },
    { k: 'Noise', v: fmt(L.dB), u: 'dB(A)', cls: L.dB > 70 ? 'warn' : undefined }, { k: 'Speed', v: fmt(L.kmh), u: 'km/h' },
  ];
  if (d === 'engine') return [
    { k: 'Speed', v: fmt(L.kmh), u: 'km/h' },
    { k: 'Engine', v: L.rpm > 100 ? fmt(Math.round(L.rpm / 10) * 10) : 'off', u: L.rpm > 100 ? 'rpm' : '' },
    spec.hybrid ? { k: 'Motor', v: fmt(L.motorKW), u: 'kW', cls: L.motorKW < -0.5 ? 'pass' : undefined } : { k: 'Power', v: fmt(L.engineKW), u: 'kW' },
    spec.hybrid ? { k: 'Battery', v: fmt(L.soc * 100), u: '%' } : spec.turbo ? { k: 'Boost', v: fmt(L.boost, 2), u: 'bar' } : { k: 'Fuel', v: fmt(L.fuelLh, 1), u: 'L/h' },
  ];
  if (d === 'undercarriage') {
    if (c.chassis === 'shaker') return [
      { k: 'Body accel.', v: fmt(L.comfort, 2), u: 'm/s²', cls: L.comfort > 2.5 ? 'warn' : 'pass' },
      { k: 'Travel FL', v: fmt((L.zs[0] - L.zu[0]) * 1000, 0), u: 'mm' },
      { k: 'Damper FL', v: fmt(Math.abs(L.damperV[0]), 2), u: 'm/s' },
      { k: 'Tyre load FL', v: fmt(L.tyreLoad[0] * 100), u: '%', cls: L.tyreLoad[0] < 0.3 ? 'fail' : undefined },
    ];
    if (c.chassis === 'brakes') return [
      { k: 'Speed', v: fmt(L.kmh), u: 'km/h' }, { k: 'Decel.', v: fmt(L.decelG, 2), u: 'g' },
      { k: 'Front disc', v: fmt(L.disc[0]), u: '°C', cls: L.disc[0] > 550 ? 'fail' : L.disc[0] > 350 ? 'warn' : undefined },
      { k: '100–0 km/h', v: L.stopDist !== null ? fmt(L.stopDist, 1) : '…', u: 'm' },
    ];
    return [
      { k: 'Lift height', v: '1.75', u: 'm' }, { k: 'Springs F/R', v: `${fmt(spec.springF / 1000)}/${fmt(spec.springR / 1000)}`, u: 'kN/m' },
      { k: 'Exhaust', v: fmt(L.exhaust), u: '°C' }, { k: 'Clearance', v: fmt(v.id === 'honda-elevate' ? 220 : v.id === 'honda-civic' ? 120 : 170), u: 'mm' },
    ];
  }
  return [
    { k: 'System', v: L.adas, cls: L.adas === 'AEB' ? 'fail' : L.adas === 'FCW' ? 'warn' : 'pass' },
    { k: 'Target', v: L.detected ? fmt(L.targetDist, 1) : '—', u: L.detected ? 'm' : '' },
    { k: 'Time to collision', v: Number.isFinite(L.ttc) ? fmt(L.ttc, 1) : '—', u: Number.isFinite(L.ttc) ? 's' : '', cls: L.ttc < 1.7 ? 'fail' : L.ttc < 2.8 ? 'warn' : undefined },
    { k: 'Speed', v: fmt(L.kmh), u: 'km/h' },
  ];
}

export function cardFor(d: InspectionDomain, x: Ctx): string {
  const { L, spec, c, v } = x;
  if (c.view === 'exploded') return 'Pulled apart along each part’s assembly path: panels lift off their hinges and fixings, the <b>wheels</b> slide out on their hubs, the <b>engine</b> rises out of the bay. Click any part to read its tolerances.';
  if (c.view === 'cut') return 'A <b>section cut</b> through the car on a plane you can sweep. Every solid shows as a hatched face where the plane passes through it, the way an engineering drawing does: panel skins, the engine block, the seats.';
  if (d === 'exterior') {
    if (c.exterior === 'paint') return `Paint film thickness over every painted panel, measured on the same model a coating gauge uses. <span class="pass">Green</span> is on spec around <b>135 µm</b>, <span class="elec">blue</span> is thin, <span class="fail">red</span> is heavy. Mean <b>${fmt(x.paint.mean)} µm</b>; thin spots mark where the clearcoat was cut by a scratch.`;
    if (c.exterior === 'zebra') return 'Zebra test: the body reflects straight black and white light bars. On a good panel the stripes flow smoothly across seams; a <b>dent</b> or wavy panel kinks and pinches them. It is how paint shops find defects the eye misses.';
    if (c.exterior === 'gaps') {
      const g = cpk(x.gaps);
      const worst = [...x.gaps].sort((a, b) => Math.abs(b.gap - 3.5) - Math.abs(a.gap - 3.5))[0];
      return `Every shut line gauged at 12 points against <b>3.5 ± 0.5 mm</b>. Process capability <b>Cpk ${fmt(g.cpk, 2)}</b>${g.cpk < 1.33 ? ', below the 1.33 automotive target' : ''}. ${worst ? `Worst: <span class="${worst.status === 'pass' ? 'pass' : worst.status === 'warning' ? 'warn' : 'fail'}">${worst.label}</span>, ${fmt(worst.gap, 2)} mm.` : ''}`;
    }
    return `The finished car as it leaves the line. Open defects show <span class="fail">red</span> on the part and pinned where they were found. Switch to <b>Paint</b>, <b>Surface</b> or <b>Gaps</b> to measure the body the way a quality audit does.`;
  }
  if (d === 'interior') {
    if (c.interior === 'climate') return `Air leaves the dash vents at <b>${fmt(L.ventT)} °C</b> to bring the cabin from ${fmt(L.cabinT, 1)} °C toward the <b>${fmt(c.climateTemp, 1)} °C</b> set point. ${L.ventT < L.cabinT ? '<span class="elec">Cold air</span> is dense, so it sinks toward the floor as it spreads.' : '<span class="heat">Warm air</span> rises along the glass and headliner.'}`;
    if (c.interior === 'cabin') return 'The roof taken off at the beltline: dashboard, centre console and selector, front seats with side bolsters, the rear bench, door trims with armrests and speakers. Click a part to inspect it.';
    return `From the driver’s seat at ${fmt(L.kmh)} km/h. The cluster and centre screen are live. Cabin noise is <b>${fmt(L.dB)} dB(A)</b>${L.dB > 68 ? ', mostly wind and tyre noise' : ''}. Drag to look around.`;
  }
  if (d === 'engine') {
    if (c.drive === 'launch' && L.t100 !== null) return `Zero to 100 km/h in <b>${fmt(L.t100, 1)} s</b> on the dyno rollers. ${spec.hybrid ? 'The traction motor delivers full torque from standstill; the engine starts and turns the generator once demand passes what the battery can give.' : spec.turbo ? `Boost peaks at <b>${fmt(L.boost, 2)} bar</b>; each upshift drops the revs back into the torque plateau.` : 'The CVT holds the engine near peak power while the ratio sweeps.'}`;
    if (spec.hybrid) {
      const m = L.mode;
      if (m === 'EV DRIVE') return `<b>EV drive.</b> The engine is off; the <span class="elec">battery</span> feeds the traction motor alone, <b>${fmt(L.motorKW)} kW</b>. Honda’s e:HEV drives on electricity whenever demand is light.`;
      if (m === 'HYBRID DRIVE') return `<b>Hybrid drive.</b> The engine runs at ${fmt(Math.round(L.rpm / 10) * 10)} rpm only to turn the <b>generator</b>; the motor drives the wheels with <b>${fmt(L.motorKW)} kW</b>. ${L.batteryKW > 1 ? 'The battery adds the rest.' : 'Spare power tops up the battery.'}`;
      if (m === 'ENGINE DRIVE') return `<b>Engine drive.</b> At steady cruise a clutch locks the engine straight to the wheels through one fixed gear, the most efficient path at speed. <span class="fuel">${fmt(L.fuelLh, 1)} L/h</span>.`;
      if (m === 'REGEN') return `<b>Regenerating.</b> Lifting off turns the traction motor into a generator: <span class="pass">${fmt(-L.motorKW)} kW</span> flows back into the battery, now at ${fmt(L.soc * 100)}%. The friction brakes barely work.`;
      return 'The car is stopped on the dyno, engine off. Choose <b>Cruise</b>, <b>Launch</b> or <b>Regen</b> to drive it and watch the e:HEV switch between its three modes.';
    }
    if (L.rpm < 100) return 'Engine off. Choose a drive mode to start it.';
    return `${spec.engineName}: <b>${fmt(Math.round(L.rpm / 10) * 10)} rpm</b>, <b>${fmt(L.engineKW)} kW</b> to the ${spec.transmission}${spec.manual ? `, gear ${L.gear}` : ''}. Pistons, cams and valves are shown 60× slower. <span class="fuel">Fuel</span> ${fmt(L.fuelLh, 1)} L/h, <span class="cool">coolant</span> ${fmt(L.coolant)} °C, <span class="heat">exhaust</span> ${fmt(L.exhaust)} °C.`;
  }
  if (d === 'undercarriage') {
    if (c.chassis === 'hoist') return `On the lift: the underbody is open for inspection. Front <b>MacPherson struts</b> and the <b>steering rack</b>, the rear torsion beam, the fuel tank, <span class="heat">exhaust</span> with its catalytic converter and silencer, brake lines to every corner. ${v.components.find((cc) => cc.id === 'comp-suspension-front')?.currentDefects.length ? '<span class="fail">Front subframe bolts read under torque.</span>' : ''}`;
    if (c.chassis === 'shaker') return `Four-post rig: each post replays the <b>${c.road}</b> road at ${fmt(c.roadSpeed)} km/h under its wheel. Springs (${fmt(spec.springF / 1000)} kN/m front) and dampers isolate the body; body acceleration <b>${fmt(L.comfort, 2)} m/s²</b> is the ride-comfort figure. ${L.tyreLoad.some((t) => t < 0.3) ? '<span class="fail">A tyre is going light: grip is lost over the hit.</span>' : ''}`;
    return L.phase === 'stop' ? `Full stop from 100 km/h at <b>${fmt(L.decelG, 2)} g</b>. Friction turns ${fmt(L.brakeKW)} kW into heat; the front discs reach <span class="heat">${fmt(L.disc[0])} °C</span>.` : L.stopDist !== null ? `Stopped in <b>${fmt(L.stopDist, 1)} m</b> from 100 km/h. ${v.components.find((cc) => cc.id === 'comp-brakes-front')?.currentDefects.length ? '<span class="fail">Rotor oxidation on file: re-test after machining the discs.</span>' : 'Within the 38 m Honda target.'} The discs now cool.` : 'Brake test on the rollers: accelerate to 100 km/h, then a full ABS stop. Watch the discs heat.';
  }
  if (L.adas === 'AEB') return `<span class="fail">Collision Mitigation Braking.</span> Time to collision fell below 1.7 s, so the car brakes itself at full force: <b>${fmt(L.decelG, 2)} g</b>. Brake commands travel the <span class="can">CAN bus</span> from the camera and radar ECU to the ABS modulator.`;
  if (L.adas === 'FCW') return `<span class="warn">Forward collision warning.</span> ${fmt(L.targetDist, 1)} m to the ${L.pedestrian ? 'pedestrian' : 'vehicle'} and closing at ${fmt(-L.relV * 3.6)} km/h. The driver is alerted and the brakes pre-fill.`;
  if (L.adas === 'STOPPED') return '<span class="pass">Stopped short.</span> The system brought the car to rest before the impact. The scenario restarts.';
  if (c.adas === 'lanekeep') return `Lane Keeping Assist: the camera tracks the lane lines and the electric power steering adds <b>${fmt(Math.abs(L.lkasNm), 1)} Nm</b> to bring the car back to centre.`;
  return `Honda Sensing fuses the <span class="elec">millimetre-wave radar</span> in the grille (long range) with the <span class="can">camera</span> behind the windscreen (wide field, recognises pedestrians). ${L.detected ? `Target at <b>${fmt(L.targetDist, 1)} m</b>.` : 'Nothing in path.'}`;
}
