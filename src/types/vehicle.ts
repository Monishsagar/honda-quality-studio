export type VehicleCategory = 'sedan' | 'sports' | 'suv' | 'ev' | 'hatchback';

export type InspectionDomain = 
  | 'exterior' 
  | 'interior' 
  | 'engine' 
  | 'undercarriage' 
  | 'electrical';

export type DefectSeverity = 'minor' | 'major' | 'critical';

export type DefectType = 
  | 'scratch' 
  | 'dent' 
  | 'crack' 
  | 'corrosion' 
  | 'paint_defect' 
  | 'misalignment' 
  | 'wear' 
  | 'leak' 
  | 'electrical_fault'
  | 'loose_fastener';

export interface Defect {
  id: string;
  name: string;
  type: DefectType;
  severity: DefectSeverity;
  description: string;
  scoreDeduction: number;
  simulated: boolean;
  affectedParameter: string;
  visualPosition?: [number, number, number];
}

export interface InspectionParameter {
  id: string;
  name: string;
  weight: number; // e.g. 0.25 (25%)
  unit?: string;
  nominalValue: string;
  inspectedValue: string;
  tolerance: string;
  result: 'pass' | 'warning' | 'fail';
  description: string;
}

export interface VehicleComponent {
  id: string;
  name: string;
  domain: InspectionDomain;
  category: string;
  purpose: string;
  meshName: string; // Three.js mesh identifier
  cameraTargetOffset: [number, number, number];
  cameraPositionOffset: [number, number, number];
  explodedVector: [number, number, number]; // Vector to displace during exploded view
  referenceScore: number; // Always 100
  currentScore: number;
  inspectionParameters: InspectionParameter[];
  possibleDefects: Defect[];
  currentDefects: Defect[];
  referenceCondition: string;
  inspectedCondition: string;
  kaizenRecommendation: string;
  status: 'passed' | 'warning' | 'failed' | 'uninspected';
}

export interface VehicleSpecifications {
  powertrain: string;
  power: string;
  torque: string;
  acceleration: string;
  topSpeed: string;
  transmission: string;
  drivetrain: string;
  weight: string;
  dimensions: string;
  batteryCapacity?: string;
  electricRange?: string;
}

export interface VehicleData {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  vin: string;
  category: VehicleCategory;
  categoryLabel: string;
  subtitle: string;
  description: string;
  price: string;
  showroomPosition: [number, number, number];
  showroomRotation: [number, number, number];
  platformRadius: number;
  platformName: string;
  bodyColor: string;
  caliperColor: string;
  rimColor: string;
  interiorColor: string;
  specs: VehicleSpecifications;
  components: VehicleComponent[];
}
