/**
 * Per-model body specifications, in metres.
 * Car frame: +z forward, +y up, x across (driver on -x, right-hand drive), ground at y = 0.
 * Profiles are given as [t, y] where t runs 0 (nose) → 1 (tail) along the body length.
 */
export type BodyKind = 'sedan' | 'hatch' | 'suv';

export interface CarSpec {
  kind: BodyKind;
  L: number;
  W: number;
  wheelbase: number;
  frontOverhang: number;
  wheelR: number;
  rimR: number;
  tyreW: number;
  track: number;
  clearance: number;
  top: [number, number][];
  belt: [number, number][];
  tCowl: number;
  tRoofF: number;
  tRoofR: number;
  tDeck: number;
  tB: number;
  roofHalf: number;
  planFront: number;
  planRear: number;
  headlampH: number;
  spokes: number;
  spokeStyle: 'twin' | 'blade' | 'mesh';
  cladding: boolean;
  roofRails: boolean;
  wing: boolean;
  blackRoof: boolean;
  connectedTail: boolean;
  exhaust: 'hidden' | 'single' | 'triple';
  metallic: number;
}

export const CAR_SPECS: Record<string, CarSpec> = {
  'honda-city': {
    kind: 'sedan', L: 4.58, W: 1.75, wheelbase: 2.6, frontOverhang: 0.93, wheelR: 0.305, rimR: 0.205, tyreW: 0.19, track: 1.5, clearance: 0.17,
    top: [[0, 0.66], [0.035, 0.76], [0.12, 0.83], [0.29, 0.9], [0.44, 1.43], [0.56, 1.49], [0.7, 1.4], [0.855, 1.06], [0.95, 1.04], [0.985, 0.99], [1, 0.9]],
    belt: [[0.29, 0.95], [0.6, 0.99], [0.86, 1.03]],
    tCowl: 0.29, tRoofF: 0.44, tRoofR: 0.7, tDeck: 0.855, tB: 0.54, roofHalf: 0.76, planFront: 2.9, planRear: 3.4, headlampH: 0.1,
    spokes: 5, spokeStyle: 'twin', cladding: false, roofRails: false, wing: false, blackRoof: false, connectedTail: true, exhaust: 'hidden', metallic: 0.25,
  },
  'honda-elevate': {
    kind: 'suv', L: 4.31, W: 1.79, wheelbase: 2.65, frontOverhang: 0.86, wheelR: 0.335, rimR: 0.215, tyreW: 0.215, track: 1.54, clearance: 0.22,
    top: [[0, 0.84], [0.035, 0.95], [0.12, 1.02], [0.27, 1.08], [0.4, 1.6], [0.52, 1.65], [0.86, 1.62], [0.93, 1.5], [0.965, 1.14], [1, 1.02]],
    belt: [[0.27, 1.12], [0.6, 1.16], [0.92, 1.2]],
    tCowl: 0.27, tRoofF: 0.4, tRoofR: 0.88, tDeck: 0.965, tB: 0.53, roofHalf: 0.8, planFront: 3.2, planRear: 4.2, headlampH: 0.09,
    spokes: 5, spokeStyle: 'twin', cladding: true, roofRails: true, wing: false, blackRoof: true, connectedTail: true, exhaust: 'hidden', metallic: 0.55,
  },
  'honda-zr-v': {
    kind: 'suv', L: 4.57, W: 1.84, wheelbase: 2.66, frontOverhang: 0.95, wheelR: 0.35, rimR: 0.23, tyreW: 0.225, track: 1.58, clearance: 0.2,
    top: [[0, 0.78], [0.035, 0.89], [0.12, 0.97], [0.28, 1.02], [0.42, 1.55], [0.55, 1.6], [0.78, 1.53], [0.9, 1.3], [0.955, 1.1], [1, 0.98]],
    belt: [[0.28, 1.06], [0.6, 1.09], [0.9, 1.12]],
    tCowl: 0.28, tRoofF: 0.42, tRoofR: 0.8, tDeck: 0.955, tB: 0.54, roofHalf: 0.75, planFront: 3.0, planRear: 3.6, headlampH: 0.07,
    spokes: 10, spokeStyle: 'blade', cladding: true, roofRails: false, wing: false, blackRoof: false, connectedTail: true, exhaust: 'single', metallic: 0.3,
  },
  'honda-amaze': {
    kind: 'sedan', L: 3.99, W: 1.73, wheelbase: 2.47, frontOverhang: 0.78, wheelR: 0.3, rimR: 0.2, tyreW: 0.185, track: 1.49, clearance: 0.17,
    top: [[0, 0.68], [0.04, 0.79], [0.13, 0.86], [0.29, 0.93], [0.45, 1.45], [0.58, 1.5], [0.71, 1.42], [0.85, 1.09], [0.95, 1.07], [0.985, 1.02], [1, 0.93]],
    belt: [[0.29, 0.98], [0.6, 1.01], [0.85, 1.05]],
    tCowl: 0.29, tRoofF: 0.45, tRoofR: 0.71, tDeck: 0.85, tB: 0.56, roofHalf: 0.77, planFront: 3.0, planRear: 3.4, headlampH: 0.1,
    spokes: 8, spokeStyle: 'blade', cladding: false, roofRails: false, wing: false, blackRoof: false, connectedTail: false, exhaust: 'hidden', metallic: 0.55,
  },
  'honda-civic': {
    kind: 'hatch', L: 4.59, W: 1.89, wheelbase: 2.74, frontOverhang: 0.95, wheelR: 0.335, rimR: 0.24, tyreW: 0.265, track: 1.62, clearance: 0.12,
    top: [[0, 0.6], [0.035, 0.7], [0.13, 0.78], [0.31, 0.85], [0.46, 1.36], [0.58, 1.41], [0.7, 1.33], [0.9, 1.0], [0.96, 0.98], [1, 0.86]],
    belt: [[0.31, 0.9], [0.6, 0.94], [0.88, 0.98]],
    tCowl: 0.31, tRoofF: 0.46, tRoofR: 0.66, tDeck: 0.9, tB: 0.58, roofHalf: 0.74, planFront: 2.8, planRear: 3.6, headlampH: 0.065,
    spokes: 5, spokeStyle: 'mesh', cladding: false, roofRails: false, wing: true, blackRoof: false, connectedTail: false, exhaust: 'triple', metallic: 0.5,
  },
};

export function specFor(id: string): CarSpec {
  return CAR_SPECS[id] ?? CAR_SPECS['honda-city'];
}
