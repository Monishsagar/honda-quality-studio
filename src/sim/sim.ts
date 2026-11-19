import { SimSpec } from './specs';
import { useControls, AdasScenario, Road } from './controls';
import { InspectionDomain } from '../types/vehicle';

/**
 * Vehicle simulation for the car under inspection. One fixed-step model drives every
 * domain: longitudinal dynamics on a chassis dyno, the engine / e:HEV hybrid system,
 * brake thermal load, a four-corner quarter-car suspension on a shaker rig and the
 * Honda Sensing collision-mitigation logic. The scene and the UI both read `live`.
 */
export type HybridMode = 'IDLE' | 'EV DRIVE' | 'HYBRID DRIVE' | 'ENGINE DRIVE' | 'REGEN' | 'ICE';
export type AdasState = 'STANDBY' | 'ACC' | 'FCW' | 'AEB' | 'STOPPED' | 'LKAS';

const G = 9.81, RHO = 1.2;

function freshLive() {
  return {
    t: 0,
    v: 0, kmh: 0, accel: 0, odo: 0,
    throttle: 0, brake: 0,
    rpm: 0, engineOn: false, engineNm: 0, engineKW: 0, load: 0,
    motorKW: 0, motorNm: 0, motorRpm: 0, genKW: 0, batteryKW: 0, soc: 0.62,
    mode: 'IDLE' as HybridMode,
    gear: 1, ratio: 2.5,
    fuelLh: 0, coolant: 24, oil: 24, exhaust: 24, boost: 0, turboRpm: 0,
    crank: 0, wheel: 0, roller: 0,
    // brakes
    brakeBar: 0, decelG: 0, disc: [24, 24, 24, 24], brakeKW: 0,
    // runs
    phase: '' as string, t100: null as number | null, runT: 0, stopDist: null as number | null, stopFrom: 0, stopStartOdo: 0,
    // suspension
    zr: [0, 0, 0, 0], zu: [0, 0, 0, 0], zs: [0, 0, 0, 0], vu: [0, 0, 0, 0], vs: [0, 0, 0, 0],
    heave: 0, pitch: 0, roll: 0, travel: [0, 0, 0, 0], damperV: [0, 0, 0, 0], tyreLoad: [1, 1, 1, 1], bodyAcc: 0, comfort: 0, roadS: 0,
    // adas
    adas: 'STANDBY' as AdasState, targetDist: 0, targetV: 0, relV: 0, ttc: Infinity, targetLat: 0, detected: false, radarHit: false, camHit: false,
    lane: 0, steer: 0, lkasNm: 0, scenarioT: 0, warnFlash: 0, laneScroll: 0, pedestrian: false,
    // cabin
    dB: 34, cabinT: 31, ventT: 31,
  };
}
export type Live = ReturnType<typeof freshLive>;
export const live: Live = freshLive();

let lastCar = '';
let lastRun = -1;
let lastKey = '';
let comfortAcc = 0, comfortN = 0;

function roadProfile(s: number, road: Road, side: number): number {
  if (road === 'smooth') return Math.sin(s * 1.7 + side) * 0.002 + Math.sin(s * 5.3 + side * 2) * 0.0008;
  if (road === 'cobbles') {
    const k = Math.floor(s / 0.14 + side * 0.37);
    const r = Math.sin(k * 127.1 + side * 311.7) * 43758.5453;
    const n = r - Math.floor(r);
    const f = (s / 0.14 + side * 0.37) % 1;
    return (n - 0.5) * 0.018 * Math.sin(Math.PI * f);
  }
  if (road === 'pothole') {
    const p = ((s % 9) + 9) % 9;
    const inHole = side < 0 ? p > 4 && p < 4.7 : p > 4.25 && p < 4.95;
    return inHole ? -0.055 * Math.sin(((p - (side < 0 ? 4 : 4.25)) / 0.7) * Math.PI) : 0;
  }
  const p = ((s % 8) + 8) % 8;
  return p > 3 && p < 3.9 ? 0.075 * Math.sin(((p - 3) / 0.9) * Math.PI) : 0;
}

/** Engine full-load torque curve, Nm, normalised shape scaled to the peak. */
function engineCurve(spec: SimSpec, rpm: number) {
  const x = rpm / spec.redline;
  const shape = spec.turbo ? Math.min(1, 0.55 + x * 2.2) * (x > 0.8 ? 1 - (x - 0.8) * 1.4 : 1) : 0.62 + 0.55 * Math.sin(Math.min(1, x * 1.15) * Math.PI * 0.82);
  return spec.engineNm * Math.max(0.2, Math.min(1, shape));
}

export function stepSim(dtIn: number, spec: SimSpec, carId: string, domain: InspectionDomain, active: boolean) {
  const c = useControls.getState();
  const L = live;
  const key = `${carId}|${domain}|${c.chassis}|${c.drive}|${c.adas}`;
  if (carId !== lastCar) { Object.assign(L, freshLive()); lastCar = carId; }
  if (c.runId !== lastRun || key !== lastKey) {
    lastRun = c.runId; lastKey = key;
    L.phase = ''; L.t100 = null; L.runT = 0; L.stopDist = null; L.scenarioT = 0;
    if (domain === 'electrical') { L.v = c.adasSpeed / 3.6; L.targetDist = 0; }
  }
  if (!active) return;
  const dt = Math.min(dtIn, 1 / 30);
  const steps = 6;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) step(h, spec, domain);
  L.t += dt;
}

function step(dt: number, spec: SimSpec, domain: InspectionDomain) {
  const c = useControls.getState();
  const L = live;
  const m = spec.mass;
  const v = L.v;
  let throttle = 0, brake = 0;
  let targetV: number | null = null;
  let steerTarget = 0;

  // ------------------------------------------------------------ driver / test sequence
  if (domain === 'engine') {
    if (c.drive === 'idle') { targetV = 0; }
    else if (c.drive === 'cruise') targetV = c.speed / 3.6;
    else if (c.drive === 'launch') {
      if (L.phase === '') { L.phase = 'stage'; L.runT = 0; }
      if (L.phase === 'stage') { brake = 1; if (v < 0.3) { L.runT += dt; if (L.runT > 1.2) { L.phase = 'go'; L.runT = 0; } } }
      else if (L.phase === 'go') {
        throttle = 1; L.runT += dt;
        if (L.t100 === null && v >= 100 / 3.6) L.t100 = L.runT;
        if (v >= 130 / 3.6) { L.phase = 'hold'; L.runT = 0; }
      } else if (L.phase === 'hold') { targetV = 120 / 3.6; L.runT += dt; if (L.runT > 2.5) { L.phase = 'stage'; L.runT = 0; } }
    } else if (c.drive === 'regen') {
      if (L.phase === '' || L.phase === 'up') { L.phase = 'up'; targetV = 90 / 3.6; if (v > 88 / 3.6) L.phase = 'down'; }
      else if (L.phase === 'down') { brake = 0.28; if (v < 8 / 3.6) L.phase = 'up'; }
    }
  } else if (domain === 'undercarriage' && c.chassis === 'brakes') {
    if (L.phase === '') L.phase = 'accel';
    if (L.phase === 'accel') { throttle = 1; if (v >= 100 / 3.6) { L.phase = 'stop'; L.stopFrom = v; L.stopStartOdo = L.odo; L.runT = 0; } }
    else if (L.phase === 'stop') { brake = 1; L.runT += dt; if (v < 0.05) { L.stopDist = L.odo - L.stopStartOdo; L.phase = 'cool'; L.runT = 0; } }
    else if (L.phase === 'cool') { brake = 0.3; L.runT += dt; if (L.runT > 4) L.phase = 'accel'; }
  } else if (domain === 'undercarriage' && c.chassis === 'shaker') {
    L.roadS += (c.roadSpeed / 3.6) * dt;
    targetV = 0;
  } else if (domain === 'electrical') {
    adasDriver(dt, c.adas, c.adasSpeed / 3.6);
    throttle = L.throttle; brake = L.brake; steerTarget = L.steer;
  } else if (domain === 'interior') {
    targetV = 50 / 3.6;
  } else targetV = 0;

  if (targetV !== null) {
    const e = targetV - v;
    if (e > 0.05) throttle = Math.min(1, e * 0.35 + (targetV > 1 ? 0.12 + targetV * 0.004 : 0));
    else if (e < -0.4) brake = Math.min(0.6, -e * 0.15);
    else throttle = targetV > 0.5 ? 0.1 + targetV * 0.004 : 0;
    if (targetV === 0 && v < 0.3) { brake = 0.2; throttle = 0; }
  }
  L.throttle += (throttle - L.throttle) * Math.min(1, dt * 8);
  L.brake += (brake - L.brake) * Math.min(1, dt * 12);
  L.steer += (steerTarget - L.steer) * Math.min(1, dt * 4);

  // ------------------------------------------------------------ powertrain
  const wheelRpm = (v / (2 * Math.PI * spec.wheelR)) * 60;
  const resist = 0.5 * RHO * spec.cdA * v * v + (v > 0.05 ? spec.crr * m * G : 0);
  const demandKW = Math.max(0, L.throttle) * (spec.engineKW + spec.motorKW * (spec.hybrid ? 0.85 : 0));
  let driveN = 0;
  let mode: HybridMode = 'ICE';
  let rpmTarget = spec.idle;
  L.engineKW = 0; L.motorKW = 0; L.genKW = 0;
  if (spec.hybrid) {
    const motorMaxN = Math.min((spec.motorNm * spec.finalDrive * 1.9) / spec.wheelR, (spec.motorKW * 1000) / Math.max(v, 1));
    const wantN = L.throttle * motorMaxN;
    if (L.brake > 0.02 && v > 0.5) {
      mode = 'REGEN';
      const regenN = Math.min(L.brake * m * 3.5, (spec.motorKW * 0.6 * 1000) / Math.max(v, 1));
      driveN = -regenN;
      L.motorKW = -(regenN * v) / 1000;
      L.batteryKW = L.motorKW * 0.9;
      rpmTarget = 0;
    } else if (v < 0.3 && L.throttle < 0.04) {
      mode = 'IDLE'; rpmTarget = L.soc < 0.35 ? 1300 : 0; L.batteryKW = 0.3;
    } else {
      driveN = wantN;
      const wheelKW = (wantN * Math.max(v, 0.5)) / 1000;
      if (wheelKW < 22 && L.soc > 0.38 && v < 75 / 3.6) {
        mode = 'EV DRIVE'; rpmTarget = 0; L.motorKW = wheelKW / 0.92; L.batteryKW = L.motorKW / 0.95;
      } else if (v > 72 / 3.6 && wheelKW < 38 && L.throttle < 0.55) {
        mode = 'ENGINE DRIVE'; rpmTarget = wheelRpm * spec.finalDrive * 0.83; L.engineKW = wheelKW / 0.95;
        L.batteryKW = L.soc < 0.6 ? -4 : 0; L.engineKW += Math.max(0, -L.batteryKW);
      } else {
        mode = 'HYBRID DRIVE';
        L.motorKW = wheelKW / 0.92;
        L.engineKW = Math.min(spec.engineKW, L.motorKW * 0.8 + (L.soc < 0.55 ? 6 : 0));
        L.genKW = L.engineKW * 0.94;
        L.batteryKW = L.motorKW - L.genKW;
        rpmTarget = 1250 + (L.engineKW / spec.engineKW) * (spec.redline * 0.82 - 1250);
      }
    }
    L.motorRpm = wheelRpm * spec.finalDrive * 1.9;
    L.motorNm = L.motorKW !== 0 ? (L.motorKW * 1000) / Math.max(1, (L.motorRpm * Math.PI) / 30) : 0;
    L.soc = Math.max(0.2, Math.min(0.85, L.soc - (L.batteryKW * dt) / (spec.batteryKWh * 3600)));
  } else {
    mode = 'ICE';
    let ratio: number;
    if (spec.manual) {
      const g = spec.gears;
      let gear = L.gear;
      const rpmIn = (gi: number) => wheelRpm * g[gi - 1] * spec.finalDrive;
      if (rpmIn(gear) > spec.redline * 0.93 && gear < g.length) gear++;
      if (gear > 1 && rpmIn(gear - 1) < spec.redline * 0.6 && L.throttle > 0.3) gear--;
      if (gear > 1 && rpmIn(gear) < 1300) gear--;
      L.gear = gear;
      ratio = g[gear - 1];
      rpmTarget = Math.max(spec.idle, rpmIn(gear));
      if (v < 2.5 && L.throttle > 0.1) rpmTarget = Math.max(rpmTarget, 2600 + L.throttle * 2200);
    } else {
      // CVT: hold the engine near its efficient speed for the demanded power
      const want = spec.idle + Math.pow(L.throttle, 0.85) * (spec.redline * 0.88 - spec.idle);
      rpmTarget = Math.max(spec.idle, want, wheelRpm * spec.finalDrive * 0.42);
      ratio = Math.max(0.42, Math.min(2.6, rpmTarget / Math.max(1, wheelRpm * spec.finalDrive)));
    }
    L.ratio = ratio;
    const tq = engineCurve(spec, Math.max(L.rpm, spec.idle)) * L.throttle;
    L.engineNm = tq;
    const boostK = spec.turbo ? Math.min(1, L.boost / 1.6) * 0.55 + 0.45 : 1;
    driveN = (tq * boostK * ratio * spec.finalDrive * 0.9) / spec.wheelR;
    if (v > 1) driveN = Math.min(driveN, (spec.engineKW * 1000 * L.throttle) / v);
    L.engineKW = Math.max(0, (driveN * Math.max(v, 0.5)) / 1000 / 0.9);
    if (v < 1) L.engineKW = (tq * boostK * L.rpm * Math.PI) / 30 / 1000 * 0.15;
  }
  L.mode = mode;
  L.engineOn = rpmTarget > 100;
  L.rpm += ((L.engineOn ? rpmTarget : 0) - L.rpm) * Math.min(1, dt * (L.engineOn ? 6 : 2.5));
  L.load = spec.engineKW > 0 ? Math.min(1, L.engineKW / spec.engineKW) : 0;
  if (spec.hybrid) L.engineNm = L.rpm > 200 ? (L.engineKW * 1000) / ((L.rpm * Math.PI) / 30) : 0;
  L.fuelLh = L.engineOn ? (L.engineKW * 245) / 745 + 0.6 : 0;
  if (spec.turbo) {
    const want = L.rpm > 1800 ? Math.min(1.6, L.throttle * (L.rpm / 3200)) : 0;
    L.boost += (want - L.boost) * Math.min(1, dt * 2.5);
    L.turboRpm = L.boost * 110000 + (L.rpm > 0 ? 18000 : 0);
  }

  // ------------------------------------------------------------ brakes and road load
  L.brakeBar = L.brake * 120;
  const mu = 1.05;
  const brakeN = Math.min(L.brake * m * G * mu * 1.15, m * G * mu);
  const friction = mode === 'REGEN' ? Math.max(0, brakeN - Math.abs(driveN)) : brakeN;
  let F = driveN - resist - (v > 0.02 ? friction : 0);
  if (domain === 'undercarriage' && useControls.getState().chassis === 'shaker') F = 0;
  const a = F / (m * 1.04);
  L.accel = a;
  L.v = Math.max(0, v + a * dt);
  if (L.v < 0.02 && F < 0) L.v = 0;
  L.kmh = L.v * 3.6;
  L.odo += L.v * dt;
  L.decelG = Math.max(0, -a / G);
  // disc temperatures: 70% of friction braking work to the front pair
  const brakeW = (v > 0.02 ? friction : 0) * v;
  L.brakeKW = brakeW / 1000;
  for (let i = 0; i < 4; i++) {
    const share = i < 2 ? 0.35 : 0.15;
    const cool = (L.disc[i] - 24) * (0.012 + v * 0.0016);
    L.disc[i] += ((brakeW * share) / (spec.discMass * 460) - cool) * dt;
  }

  // ------------------------------------------------------------ thermal and cabin
  const heat = L.engineOn ? 0.4 + L.load * 1.6 : 0;
  L.coolant += ((L.engineOn ? 88 + L.load * 8 : 30) - L.coolant) * dt * (L.engineOn ? 0.05 : 0.01) * (1 + heat);
  L.oil += (L.coolant + (L.engineOn ? 6 : 0) - L.oil) * dt * 0.04;
  L.exhaust += ((L.engineOn ? 280 + L.load * 560 + L.rpm * 0.02 : 30) - L.exhaust) * dt * 0.6;
  L.dB = 33 + (L.rpm > 100 ? 12 + 9 * Math.log10(1 + L.rpm / 800) + L.load * 4 : 0) + Math.min(28, L.v * L.v * 0.012) + (L.v > 0.5 ? 6 : 0);
  const ct = useControls.getState().climateTemp;
  L.ventT += ((ct < L.cabinT ? Math.max(8, ct - 9) : Math.min(55, ct + 14)) - L.ventT) * dt * 0.5;
  L.cabinT += (ct - L.cabinT) * dt * 0.035;

  // ------------------------------------------------------------ rotations (shown slowed so they read)
  L.crank += ((L.rpm / 60) * Math.PI * 2 * dt) / 60;
  L.wheel += (L.v / spec.wheelR) * dt * 0.35;
  L.roller += (L.v / 0.2) * dt * 0.35;

  // ------------------------------------------------------------ suspension: four quarter cars
  const cs = useControls.getState();
  const shaker = domain === 'undercarriage' && cs.chassis === 'shaker';
  const ms = m / 4, mu_ = 38, kt = 210000;
  const wb = 2.6;
  for (let i = 0; i < 4; i++) {
    const front = i < 2, side = i % 2 === 0 ? -1 : 1;
    const s = L.roadS - (front ? 0 : wb);
    const zr = shaker ? roadProfile(s, cs.road, side) : 0;
    L.zr[i] = zr;
    const k = front ? spec.springF : spec.springR;
    // pitch from longitudinal acceleration and roll from steering load transfer
    const dyn = (front ? -1 : 1) * (a * m * 0.55) / (2 * wb) - side * L.steer * L.v * L.v * m * 0.02;
    const fs = -k * (L.zs[i] - L.zu[i]) - spec.damper * (L.vs[i] - L.vu[i]);
    const ft = kt * (zr - L.zu[i]);
    const as = (fs + dyn) / ms;
    const au = (-fs + ft) / mu_;
    L.vs[i] += as * dt; L.vu[i] += au * dt;
    L.zs[i] += L.vs[i] * dt; L.zu[i] += L.vu[i] * dt;
    L.travel[i] = L.zs[i] - L.zu[i];
    L.damperV[i] = L.vs[i] - L.vu[i];
    L.tyreLoad[i] = Math.max(0, 1 + (kt * (zr - L.zu[i])) / (ms * G + mu_ * G));
  }
  L.heave = (L.zs[0] + L.zs[1] + L.zs[2] + L.zs[3]) / 4;
  L.pitch = ((L.zs[2] + L.zs[3]) - (L.zs[0] + L.zs[1])) / 2 / wb;
  L.roll = ((L.zs[1] + L.zs[3]) - (L.zs[0] + L.zs[2])) / 2 / 1.5;
  const acc = (L.vs[0] + L.vs[1] + L.vs[2] + L.vs[3]) / 4;
  L.bodyAcc = Math.abs(acc - (L as unknown as { _pv?: number })._pv! || 0) / dt;
  (L as unknown as { _pv?: number })._pv = acc;
  comfortAcc += L.bodyAcc * L.bodyAcc; comfortN++;
  if (comfortN > 240) { L.comfort = Math.sqrt(comfortAcc / comfortN); comfortAcc = 0; comfortN = 0; }
}

/** Honda Sensing: radar + camera fusion, ACC gap keeping, collision warning and mitigation braking. */
function adasDriver(dt: number, sc: AdasScenario, setV: number) {
  const L = live;
  L.scenarioT += dt;
  const T = L.scenarioT;
  let tv = 0;
  if (sc === 'lanekeep') {
    L.pedestrian = false;
    L.targetDist = 0; L.detected = false; L.radarHit = false; L.camHit = false;
    const drift = Math.sin(T * 0.45) * 0.55;
    L.lane = drift - L.steer * 0.8;
    const err = L.lane;
    L.lkasNm = Math.max(-3, Math.min(3, -err * 6));
    L.steer = Math.max(-0.35, Math.min(0.35, L.steer + (-err * 0.6 - L.steer) * dt * 2));
    L.adas = Math.abs(err) > 0.25 ? 'LKAS' : 'ACC';
    L.throttle = L.v < setV ? 0.25 : 0.05; L.brake = 0;
    L.laneScroll += L.v * dt;
    L.ttc = Infinity;
    if (T > 30) L.scenarioT = 0;
    return;
  }
  L.lkasNm = 0; L.lane *= 1 - dt;
  if (T < 0.02) {
    L.targetDist = sc === 'stopped' ? 70 : sc === 'pedestrian' ? 45 : 32;
    L.targetV = sc === 'stopped' || sc === 'pedestrian' ? 0 : setV;
    L.targetLat = sc === 'pedestrian' ? 4.2 : 0;
    L.v = setV;
    L.adas = 'ACC';
  }
  L.pedestrian = sc === 'pedestrian';
  if (sc === 'follow') tv = setV * (0.85 + 0.25 * Math.sin(T * 0.35));
  else if (sc === 'hardbrake') tv = T < 4 ? setV : Math.max(0, L.targetV - 7 * dt);
  else tv = 0;
  if (sc === 'hardbrake' && T >= 4) L.targetV = tv; else if (sc !== 'hardbrake') L.targetV = tv;
  if (sc === 'pedestrian') L.targetLat = Math.max(-3, L.targetLat - 1.4 * dt * (T > 1 ? 1 : 0));
  L.targetDist += (L.targetV - L.v) * dt;
  L.relV = L.targetV - L.v;
  L.laneScroll += L.v * dt;

  const inPath = Math.abs(L.targetLat) < 1.6;
  L.radarHit = L.targetDist > 0.5 && L.targetDist < 160 && Math.abs(Math.atan2(L.targetLat, L.targetDist)) < 0.18;
  L.camHit = L.targetDist > 0.5 && L.targetDist < 90 && Math.abs(Math.atan2(L.targetLat, L.targetDist)) < 0.45;
  L.detected = (L.radarHit || L.camHit) && (sc !== 'pedestrian' || L.camHit);
  const closing = -L.relV;
  L.ttc = closing > 0.1 && inPath && L.detected ? (L.targetDist - 2.5) / closing : Infinity;

  let thr = 0, brk = 0;
  if (L.adas === 'STOPPED') {
    brk = 0.6;
    if (T > 0) L.warnFlash = Math.max(0, L.warnFlash - dt);
    if ((L as unknown as { _stopT?: number })._stopT === undefined) (L as unknown as { _stopT?: number })._stopT = T;
    if (T - ((L as unknown as { _stopT?: number })._stopT ?? T) > 3.5) { L.scenarioT = 0; (L as unknown as { _stopT?: number })._stopT = undefined; }
  } else if (L.ttc < 1.7 || (L.adas === 'AEB' && L.v > 0.05)) {
    L.adas = 'AEB'; brk = 1; L.warnFlash = 1;
  } else if (L.ttc < 2.8) {
    L.adas = 'FCW'; brk = 0.12; L.warnFlash = 1;
  } else {
    L.adas = 'ACC';
    // ACC: hold a 1.8 s gap behind a moving target, otherwise the set speed
    const gapWant = Math.max(8, L.v * 1.8);
    let want = setV;
    if (L.detected && inPath && L.targetV > 0.5) want = Math.min(setV, L.targetV + (L.targetDist - gapWant) * 0.25);
    const e = want - L.v;
    thr = e > 0 ? Math.min(0.6, e * 0.3 + 0.1) : 0;
    brk = e < -0.5 ? Math.min(0.5, -e * 0.08) : 0;
    L.warnFlash = Math.max(0, L.warnFlash - dt * 2);
  }
  if (L.adas === 'AEB' && L.v < 0.05) { L.adas = 'STOPPED'; }
  L.throttle = thr; L.brake = brk;
  if (L.targetDist < 1 && sc !== 'follow') L.targetDist = 1;
  if (sc === 'follow' && T > 40) L.scenarioT = 0;
}
