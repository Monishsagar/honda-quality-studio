import { Defect, VehicleComponent, VehicleData } from './vehicle';

export type QualityGrade = 'excellent' | 'good' | 'needs_improvement' | 'poor';

export interface DomainScore {
  domain: string;
  label: string;
  score: number;
  weight: number;
  totalComponents: number;
  inspectedComponents: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
}

export interface TQMReport {
  id: string;
  reportNumber: string;
  timestamp: string;
  inspectorName: string;
  inspectorRole: string;
  facility: string;
  vehicle: {
    id: string;
    name: string;
    brand: string;
    model: string;
    year: number;
    vin: string;
    category: string;
  };
  overallScore: number;
  overallGrade: QualityGrade;
  domainScores: DomainScore[];
  totalComponentsCount: number;
  inspectedComponentsCount: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  detectedDefects: Defect[];
  kaizenRecommendations: {
    componentName: string;
    defect: string;
    severity: string;
    recommendation: string;
    pdcaStage: 'Plan' | 'Do' | 'Check' | 'Act';
  }[];
  standardsComplied: string[];
  certificateHash: string;
}

export interface PDCATask {
  id: string;
  stage: 'Plan' | 'Do' | 'Check' | 'Act';
  title: string;
  description: string;
  componentId: string;
  assignedRole: string;
  status: 'pending' | 'in_progress' | 'completed';
  timestamp: string;
}
