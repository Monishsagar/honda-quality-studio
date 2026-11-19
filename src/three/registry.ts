import type { BuiltCar } from './buildCar';

/** Built cars by vehicle id, so the camera director, labels and rigs can reach the active car's parts. */
export const carRegistry = new Map<string, BuiltCar>();
