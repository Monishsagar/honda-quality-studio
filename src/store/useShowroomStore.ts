import { create } from 'zustand';
import { vehiclesList, simulationDefectTemplates } from '../data/vehiclesData';
import { VehicleData, VehicleComponent, Defect, InspectionDomain } from '../types/vehicle';
import { AppViewMode, CameraControlMode, VisualRenderMode, UserSettings, PlayerState } from '../types/showroom';
import { TQMReport, PDCATask } from '../types/tqm';
import { INITIAL_PDCA_TASKS } from '../data/tqmStandards';

interface ShowroomStore {
  vehicles: VehicleData[];
  activeVehicleId: string;
  viewMode: AppViewMode;
  inspectionDomain: InspectionDomain;
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  visualRenderMode: VisualRenderMode;
  explodedFactor: number;
  cameraControlMode: CameraControlMode;
  isolatedComponentId: string | null;
  
  // Player state for showroom walkthrough
  player: PlayerState;
  
  // Settings
  settings: UserSettings;
  
  // Modals
  isComparisonModalOpen: boolean;
  isDefectSimulationModalOpen: boolean;
  isPDCAModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isTQMReportModalOpen: boolean;
  isInspectionHistoryOpen: boolean;
  isTQMPillarsModalOpen: boolean;
  
  // PDCA Tasks
  pdcaTasks: PDCATask[];
  
  // Getters
  getActiveVehicle: () => VehicleData;
  getSelectedComponent: () => VehicleComponent | null;
  getDomainComponents: (domain?: InspectionDomain) => VehicleComponent[];
  getOverallVehicleScore: (vehicleId?: string) => number;
  
  // Actions
  setActiveVehicle: (id: string) => void;
  setViewMode: (mode: AppViewMode) => void;
  setInspectionDomain: (domain: InspectionDomain) => void;
  setSelectedComponent: (id: string | null) => void;
  setHoveredComponent: (id: string | null) => void;
  setVisualRenderMode: (mode: VisualRenderMode) => void;
  setExplodedFactor: (factor: number) => void;
  setCameraControlMode: (mode: CameraControlMode) => void;
  setIsolatedComponent: (id: string | null) => void;
  updatePlayer: (updates: Partial<PlayerState>) => void;
  updateSettings: (updates: Partial<UserSettings>) => void;
  
  // Defect & TQM operations
  applyDefectToComponent: (componentId: string, defect: Defect) => void;
  removeDefectFromComponent: (componentId: string, defectId: string) => void;
  resetComponentToDefectFree: (componentId: string) => void;
  resetAllVehicleComponents: (vehicleId: string) => void;
  loadPreconfiguredScenario: (vehicleId: string, scenarioId: 'pristine' | 'factory_audit' | 'fleet_audit') => void;
  
  // Modals
  setComparisonModalOpen: (open: boolean) => void;
  setDefectSimulationModalOpen: (open: boolean) => void;
  setPDCAModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setTQMReportModalOpen: (open: boolean) => void;
  setInspectionHistoryOpen: (open: boolean) => void;
  setTQMPillarsModalOpen: (open: boolean) => void;
  
  // PDCA Actions
  addPDCATask: (task: Omit<PDCATask, 'id' | 'timestamp'>) => void;
  updatePDCATaskStatus: (id: string, status: PDCATask['status']) => void;
  
  // Report generation
  generateTQMReport: () => TQMReport;
}

export const useShowroomStore = create<ShowroomStore>((set, get) => ({
  vehicles: vehiclesList,
  activeVehicleId: 'honda-city',
  viewMode: 'showroom',
  inspectionDomain: 'exterior',
  selectedComponentId: null,
  hoveredComponentId: null,
  visualRenderMode: 'solid',
  explodedFactor: 0,
  cameraControlMode: 'fps',
  isolatedComponentId: null,

  player: {
    position: [0, 1.65, 8],
    rotation: [0, 0, 0],
    isWalking: false,
    isSprinting: false,
    isPointerLocked: false,
    nearbyVehicleId: null
  },

  settings: {
    walkSpeed: 4.5,
    mouseSensitivity: 0.0022,
    invertY: false,
    fieldOfView: 65,
    soundEffects: true,
    showMinimap: true,
    highQualityShadows: true,
    autoRotateShowroom: true
  },

  isComparisonModalOpen: false,
  isDefectSimulationModalOpen: false,
  isPDCAModalOpen: false,
  isSettingsModalOpen: false,
  isTQMReportModalOpen: false,
  isInspectionHistoryOpen: false,
  isTQMPillarsModalOpen: false,

  pdcaTasks: INITIAL_PDCA_TASKS,

  getActiveVehicle: () => {
    const { vehicles, activeVehicleId } = get();
    return vehicles.find(v => v.id === activeVehicleId) || vehicles[0];
  },

  getSelectedComponent: () => {
    const { getActiveVehicle, selectedComponentId } = get();
    if (!selectedComponentId) return null;
    const vehicle = getActiveVehicle();
    return vehicle.components.find(c => c.id === selectedComponentId) || null;
  },

  getDomainComponents: (domain) => {
    const vehicle = get().getActiveVehicle();
    const targetDomain = domain || get().inspectionDomain;
    return vehicle.components.filter(c => c.domain === targetDomain);
  },

  getOverallVehicleScore: (vehicleId) => {
    const { vehicles, activeVehicleId } = get();
    const targetId = vehicleId || activeVehicleId;
    const vehicle = vehicles.find(v => v.id === targetId) || vehicles[0];
    
    if (vehicle.components.length === 0) return 100;
    
    // Domain weights
    const domainWeights: Record<InspectionDomain, number> = {
      exterior: 0.25,
      interior: 0.20,
      engine: 0.30,
      undercarriage: 0.15,
      electrical: 0.10
    };

    let totalWeightedScore = 0;
    let totalWeightApplied = 0;

    (['exterior', 'interior', 'engine', 'undercarriage', 'electrical'] as InspectionDomain[]).forEach(d => {
      const comps = vehicle.components.filter(c => c.domain === d);
      if (comps.length > 0) {
        const domainAverage = comps.reduce((sum, c) => sum + c.currentScore, 0) / comps.length;
        totalWeightedScore += domainAverage * domainWeights[d];
        totalWeightApplied += domainWeights[d];
      }
    });

    return Math.round(totalWeightApplied > 0 ? totalWeightedScore / totalWeightApplied : 100);
  },

  setActiveVehicle: (id: string) => {
    set({
      activeVehicleId: id,
      selectedComponentId: null,
      isolatedComponentId: null,
      explodedFactor: 0
    });
  },

  setViewMode: (mode: AppViewMode) => {
    set({ 
      viewMode: mode,
      // If entering showroom, return to fps controls
      cameraControlMode: mode === 'showroom' ? 'fps' : 'orbit'
    });
  },

  setInspectionDomain: (domain: InspectionDomain) => {
    set({ 
      inspectionDomain: domain,
      selectedComponentId: null,
      isolatedComponentId: null
    });
  },

  setSelectedComponent: (id: string | null) => {
    set({ selectedComponentId: id });
  },

  setHoveredComponent: (id: string | null) => {
    set({ hoveredComponentId: id });
  },

  setVisualRenderMode: (mode: VisualRenderMode) => {
    set({ visualRenderMode: mode });
  },

  setExplodedFactor: (factor: number) => {
    set({ 
      explodedFactor: Math.max(0, Math.min(1, factor)),
      visualRenderMode: factor > 0 ? 'exploded' : 'solid'
    });
  },

  setCameraControlMode: (mode: CameraControlMode) => {
    set({ cameraControlMode: mode });
  },

  setIsolatedComponent: (id: string | null) => {
    set({ isolatedComponentId: id });
  },

  updatePlayer: (updates: Partial<PlayerState>) => {
    set(state => ({
      player: { ...state.player, ...updates }
    }));
  },

  updateSettings: (updates: Partial<UserSettings>) => {
    set(state => ({
      settings: { ...state.settings, ...updates }
    }));
  },

  applyDefectToComponent: (componentId: string, defect: Defect) => {
    set(state => {
      const activeVehicle = state.getActiveVehicle();
      const updatedVehicles = state.vehicles.map(v => {
        if (v.id !== activeVehicle.id) return v;

        const updatedComponents = v.components.map(comp => {
          if (comp.id !== componentId) return comp;

          // Check if defect already exists
          if (comp.currentDefects.some(d => d.id === defect.id)) return comp;

          const newDefects = [...comp.currentDefects, defect];
          const totalDeductions = newDefects.reduce((acc, d) => acc + d.scoreDeduction, 0);
          const newScore = Math.max(10, 100 - totalDeductions);

          let newStatus: VehicleComponent['status'] = 'passed';
          if (newScore < 60) newStatus = 'failed';
          else if (newScore < 85) newStatus = 'warning';

          const updatedParameters = comp.inspectionParameters.map(p => {
            if (p.name.toLowerCase().includes(defect.affectedParameter.toLowerCase()) ||
                defect.affectedParameter.toLowerCase().includes(p.name.toLowerCase())) {
              return {
                ...p,
                result: (defect.severity === 'critical' ? 'fail' : 'warning') as 'fail' | 'warning',
                inspectedValue: `Deviated (${defect.name})`
              };
            }
            return p;
          });

          return {
            ...comp,
            currentScore: newScore,
            currentDefects: newDefects,
            status: newStatus,
            inspectionParameters: updatedParameters,
            inspectedCondition: `Non-conformance detected: ${newDefects.map(d => d.name).join(', ')}`,
            kaizenRecommendation: `Immediate TQM countermeasure: Remediate ${defect.name}. Audit upstream jig/feeder process.`
          };
        });

        return { ...v, components: updatedComponents };
      });

      return { vehicles: updatedVehicles };
    });
  },

  removeDefectFromComponent: (componentId: string, defectId: string) => {
    set(state => {
      const activeVehicle = state.getActiveVehicle();
      const updatedVehicles = state.vehicles.map(v => {
        if (v.id !== activeVehicle.id) return v;

        const updatedComponents = v.components.map(comp => {
          if (comp.id !== componentId) return comp;

          const newDefects = comp.currentDefects.filter(d => d.id !== defectId);
          const totalDeductions = newDefects.reduce((acc, d) => acc + d.scoreDeduction, 0);
          const newScore = Math.max(10, 100 - totalDeductions);

          let newStatus: VehicleComponent['status'] = 'passed';
          if (newScore < 60) newStatus = 'failed';
          else if (newScore < 85) newStatus = 'warning';

          return {
            ...comp,
            currentScore: newScore,
            currentDefects: newDefects,
            status: newStatus,
            inspectedCondition: newDefects.length > 0 
              ? `Remaining issues: ${newDefects.map(d => d.name).join(', ')}`
              : 'Compliant with TQM Zero-Defect Baseline. All tolerances verified within nominal standard.'
          };
        });

        return { ...v, components: updatedComponents };
      });

      return { vehicles: updatedVehicles };
    });
  },

  resetComponentToDefectFree: (componentId: string) => {
    set(state => {
      const activeVehicle = state.getActiveVehicle();
      const updatedVehicles = state.vehicles.map(v => {
        if (v.id !== activeVehicle.id) return v;

        const updatedComponents = v.components.map(comp => {
          if (comp.id !== componentId) return comp;

          const restoredParams = comp.inspectionParameters.map(p => ({
            ...p,
            inspectedValue: p.nominalValue,
            result: 'pass' as const
          }));

          return {
            ...comp,
            currentScore: 100,
            currentDefects: [],
            status: 'passed' as const,
            inspectionParameters: restoredParams,
            inspectedCondition: 'Compliant with TQM Zero-Defect Baseline. Restored to 100/100 nominal state.',
            kaizenRecommendation: 'Standard preventative maintenance cycle maintained.'
          };
        });

        return { ...v, components: updatedComponents };
      });

      return { vehicles: updatedVehicles };
    });
  },

  resetAllVehicleComponents: (vehicleId: string) => {
    set(state => {
      const updatedVehicles = state.vehicles.map(v => {
        if (v.id !== vehicleId) return v;

        const updatedComponents = v.components.map(comp => ({
          ...comp,
          currentScore: 100,
          currentDefects: [],
          status: 'passed' as const,
          inspectionParameters: comp.inspectionParameters.map(p => ({
            ...p,
            inspectedValue: p.nominalValue,
            result: 'pass' as const
          })),
          inspectedCondition: 'Compliant with TQM Zero-Defect Baseline. Restored to 100/100 nominal state.'
        }));

        return { ...v, components: updatedComponents };
      });

      return { vehicles: updatedVehicles };
    });
  },

  loadPreconfiguredScenario: (vehicleId: string, scenarioId: 'pristine' | 'factory_audit' | 'fleet_audit') => {
    const store = get();
    if (scenarioId === 'pristine') {
      store.resetAllVehicleComponents(vehicleId);
      return;
    }
    
    // Reset first
    store.resetAllVehicleComponents(vehicleId);

    const vehicle = store.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    if (scenarioId === 'factory_audit') {
      // Minor factory PDI non-conformances
      const compDoor = vehicle.components.find(c => c.domain === 'exterior');
      const compBrakes = vehicle.components.find(c => c.domain === 'undercarriage');
      if (compDoor) {
        store.applyDefectToComponent(compDoor.id, simulationDefectTemplates[0]); // scratch
      }
      if (compBrakes) {
        store.applyDefectToComponent(compBrakes.id, simulationDefectTemplates[3]); // corrosion
      }
    } else if (scenarioId === 'fleet_audit') {
      // Multiple heavier wear items
      const compTyres = vehicle.components.find(c => c.name.toLowerCase().includes('tyre') || c.name.toLowerCase().includes('wheel'));
      const compEngine = vehicle.components.find(c => c.domain === 'engine');
      const compFrontBumper = vehicle.components.find(c => c.name.toLowerCase().includes('bumper'));
      if (compTyres) {
        store.applyDefectToComponent(compTyres.id, simulationDefectTemplates[5]); // wear
      }
      if (compEngine) {
        store.applyDefectToComponent(compEngine.id, simulationDefectTemplates[4]); // leak
      }
      if (compFrontBumper) {
        store.applyDefectToComponent(compFrontBumper.id, simulationDefectTemplates[1]); // dent
      }
    }
  },

  setComparisonModalOpen: (open: boolean) => set({ isComparisonModalOpen: open }),
  setDefectSimulationModalOpen: (open: boolean) => set({ isDefectSimulationModalOpen: open }),
  setPDCAModalOpen: (open: boolean) => set({ isPDCAModalOpen: open }),
  setSettingsModalOpen: (open: boolean) => set({ isSettingsModalOpen: open }),
  setTQMReportModalOpen: (open: boolean) => set({ isTQMReportModalOpen: open }),
  setInspectionHistoryOpen: (open: boolean) => set({ isInspectionHistoryOpen: open }),
  setTQMPillarsModalOpen: (open: boolean) => set({ isTQMPillarsModalOpen: open }),

  addPDCATask: (taskData) => {
    const newTask: PDCATask = {
      ...taskData,
      id: `pdca-${Date.now()}`,
      timestamp: new Date().toISOString().split('T')[0]
    };
    set(state => ({
      pdcaTasks: [newTask, ...state.pdcaTasks]
    }));
  },

  updatePDCATaskStatus: (id: string, status: PDCATask['status']) => {
    set(state => ({
      pdcaTasks: state.pdcaTasks.map(t => t.id === id ? { ...t, status } : t)
    }));
  },

  generateTQMReport: () => {
    const state = get();
    const vehicle = state.getActiveVehicle();
    const overallScore = state.getOverallVehicleScore(vehicle.id);
    
    let overallGrade: TQMReport['overallGrade'] = 'excellent';
    if (overallScore < 60) overallGrade = 'poor';
    else if (overallScore < 75) overallGrade = 'needs_improvement';
    else if (overallScore < 90) overallGrade = 'good';

    const domains: InspectionDomain[] = ['exterior', 'interior', 'engine', 'undercarriage', 'electrical'];
    const domainLabels: Record<InspectionDomain, string> = {
      exterior: 'Exterior & Aerodynamics',
      interior: 'Cockpit & Interior Trim',
      engine: 'Powertrain & Thermal Systems',
      undercarriage: 'Chassis, Suspension & Brakes',
      electrical: 'High-Voltage & ADAS Electronics'
    };
    const domainWeights: Record<InspectionDomain, number> = {
      exterior: 0.25,
      interior: 0.20,
      engine: 0.30,
      undercarriage: 0.15,
      electrical: 0.10
    };

    const domainScores = domains.map(d => {
      const comps = vehicle.components.filter(c => c.domain === d);
      const score = comps.length > 0 
        ? Math.round(comps.reduce((acc, c) => acc + c.currentScore, 0) / comps.length) 
        : 100;
      const passedCount = comps.filter(c => c.status === 'passed').length;
      const warningCount = comps.filter(c => c.status === 'warning').length;
      const failedCount = comps.filter(c => c.status === 'failed').length;

      return {
        domain: d,
        label: domainLabels[d],
        score,
        weight: domainWeights[d],
        totalComponents: comps.length,
        inspectedComponents: comps.length,
        passedCount,
        warningCount,
        failedCount
      };
    });

    const detectedDefects: Defect[] = [];
    vehicle.components.forEach(c => {
      c.currentDefects.forEach(d => {
        detectedDefects.push(d);
      });
    });

    const kaizenRecommendations = vehicle.components
      .filter(c => c.currentDefects.length > 0)
      .map(c => ({
        componentName: c.name,
        defect: c.currentDefects.map(d => d.name).join(', '),
        severity: c.currentDefects[0].severity,
        recommendation: c.kaizenRecommendation,
        pdcaStage: (c.status === 'failed' ? 'Plan' : 'Do') as 'Plan' | 'Do'
      }));

    return {
      id: `rep-${vehicle.id}-${Date.now()}`,
      reportNumber: `TQM-CERT-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      inspectorName: 'Kenji Takahashi, CQE',
      inspectorRole: 'Lead Honda Metrology & PDI Quality Auditor',
      facility: 'Honda Advanced Quality Metrology Center',
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        category: vehicle.categoryLabel
      },
      overallScore,
      overallGrade,
      domainScores,
      totalComponentsCount: vehicle.components.length,
      inspectedComponentsCount: vehicle.components.length,
      passedCount: vehicle.components.filter(c => c.status === 'passed').length,
      warningCount: vehicle.components.filter(c => c.status === 'warning').length,
      failedCount: vehicle.components.filter(c => c.status === 'failed').length,
      detectedDefects,
      kaizenRecommendations,
      standardsComplied: [
        'IATF 16949:2016 - Section 8.6 Release of Products and Services',
        'ISO 9001:2015 - Clause 9.1 Monitoring, Measurement, Analysis',
        'VDA 6.3 - Process Audit Rating Grade A',
        'ECE R43 - Safety Glazing Automotive Regulation',
        'DIN EN ISO 898-1 - High Tensile Fastener Specification'
      ],
      certificateHash: `SHA256:7e9a8f2c5d1b...${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    };
  }
}));
