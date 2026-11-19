import { create } from 'zustand';

export type ViewMode = 'solid' | 'xray' | 'cut' | 'exploded';
export type ExteriorView = 'finish' | 'paint' | 'zebra' | 'gaps';
export type InteriorView = 'driver' | 'cabin' | 'climate';
export type DriveMode = 'idle' | 'cruise' | 'launch' | 'regen';
export type Follow = 'all' | 'energy' | 'engine' | 'fluids';
export type ChassisMode = 'hoist' | 'shaker' | 'brakes';
export type Road = 'smooth' | 'cobbles' | 'pothole' | 'bump';
export type AdasScenario = 'follow' | 'hardbrake' | 'stopped' | 'pedestrian' | 'lanekeep';

interface Controls {
  view: ViewMode;
  cut: number; // section plane position, -1..1 across the car
  explode: number;
  exterior: ExteriorView;
  interior: InteriorView;
  climateTemp: number;
  ambient: boolean;
  drive: DriveMode;
  speed: number; // km/h target in cruise
  follow: Follow;
  chassis: ChassisMode;
  road: Road;
  roadSpeed: number;
  adas: AdasScenario;
  adasSpeed: number;
  sensors: boolean;
  /** bumps when a run should restart (launch, brake test, scenario) */
  runId: number;
  set: (p: Partial<Omit<Controls, 'set' | 'restart'>>) => void;
  restart: () => void;
}

export const useControls = create<Controls>((set) => ({
  view: 'solid',
  cut: 0,
  explode: 0.7,
  exterior: 'finish',
  interior: 'driver',
  climateTemp: 21,
  ambient: true,
  drive: 'cruise',
  speed: 60,
  follow: 'all',
  chassis: 'hoist',
  road: 'cobbles',
  roadSpeed: 30,
  adas: 'stopped',
  adasSpeed: 50,
  sensors: true,
  runId: 0,
  set: (p) => set((s) => ({ ...s, ...p, runId: 'drive' in p || 'chassis' in p || 'adas' in p ? s.runId + 1 : s.runId })),
  restart: () => set((s) => ({ runId: s.runId + 1 })),
}));
