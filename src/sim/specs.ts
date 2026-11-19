/**
 * Powertrain and chassis figures per model, from published Honda data where it exists
 * (power, torque, mass, battery) and textbook values for the rest.
 */
export interface SimSpec {
  hybrid: boolean;
  turbo: boolean;
  manual: boolean;
  mass: number; // kg
  cdA: number; // m²
  crr: number;
  engineKW: number;
  engineNm: number;
  motorKW: number;
  motorNm: number;
  batteryKWh: number;
  wheelR: number;
  idle: number;
  redline: number;
  finalDrive: number;
  gears: number[];
  displacement: string;
  engineName: string;
  transmission: string;
  springF: number; // N/m per corner
  springR: number;
  damper: number; // N·s/m
  discMass: number; // kg per front disc
}

const base = { crr: 0.011, idle: 850, finalDrive: 4.1, gears: [] as number[], springF: 26000, springR: 23000, damper: 2100, discMass: 6.5 };

export const SIM_SPECS: Record<string, SimSpec> = {
  'honda-city': {
    ...base, hybrid: true, turbo: false, manual: false, mass: 1280, cdA: 0.62, engineKW: 72, engineNm: 127, motorKW: 80, motorNm: 253,
    batteryKWh: 0.75, wheelR: 0.305, redline: 6200, displacement: '1.5 L', engineName: '1.5 L Atkinson i-VTEC', transmission: 'e-CVT, fixed gear',
  },
  'honda-elevate': {
    ...base, hybrid: false, turbo: false, manual: false, mass: 1250, cdA: 0.78, engineKW: 89, engineNm: 145, motorKW: 0, motorNm: 0,
    batteryKWh: 0, wheelR: 0.335, redline: 6600, displacement: '1.5 L', engineName: '1.5 L DOHC i-VTEC', transmission: 'CVT', springF: 28000, springR: 25000,
  },
  'honda-zr-v': {
    ...base, hybrid: true, turbo: false, manual: false, mass: 1580, cdA: 0.74, engineKW: 104, engineNm: 182, motorKW: 135, motorNm: 315,
    batteryKWh: 1.06, wheelR: 0.35, redline: 6300, displacement: '2.0 L', engineName: '2.0 L direct-injection i-VTEC', transmission: 'e-CVT, fixed gear',
    springF: 30000, springR: 27000, damper: 2400, discMass: 7.5,
  },
  'honda-amaze': {
    ...base, hybrid: false, turbo: false, manual: false, mass: 1010, cdA: 0.6, engineKW: 66, engineNm: 110, motorKW: 0, motorNm: 0,
    batteryKWh: 0, wheelR: 0.3, redline: 6500, displacement: '1.2 L', engineName: '1.2 L i-VTEC', transmission: 'CVT', springF: 23000, springR: 20000, discMass: 5.5,
  },
  'honda-civic': {
    ...base, hybrid: false, turbo: true, manual: true, mass: 1430, cdA: 0.66, engineKW: 235, engineNm: 420, motorKW: 0, motorNm: 0,
    batteryKWh: 0, wheelR: 0.335, redline: 7000, finalDrive: 4.11, gears: [3.63, 2.12, 1.53, 1.13, 0.97, 0.81], displacement: '2.0 L',
    engineName: '2.0 L VTEC Turbo K20C1', transmission: '6-speed manual', springF: 38000, springR: 34000, damper: 3100, discMass: 9,
  },
};

export const simSpecFor = (id: string) => SIM_SPECS[id] ?? SIM_SPECS['honda-city'];
