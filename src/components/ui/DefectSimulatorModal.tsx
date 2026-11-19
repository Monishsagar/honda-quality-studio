import React, { useState } from 'react';
import { useShowroomStore } from '../../store/useShowroomStore';
import { simulationDefectTemplates, sampleDefects } from '../../data/vehiclesData';
import { Defect } from '../../types/vehicle';
import { sound } from '../../utils/audioEffects';
import {
  X,
  Bug,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';

export function DefectSimulatorModal() {
  const {
    isDefectSimulationModalOpen,
    setDefectSimulationModalOpen,
    getActiveVehicle,
    selectedComponentId,
    applyDefectToComponent,
    removeDefectFromComponent,
    resetAllVehicleComponents,
    loadPreconfiguredScenario
  } = useShowroomStore();

  const vehicle = getActiveVehicle();
  const [selectedCompId, setSelectedCompId] = useState<string>(selectedComponentId || vehicle.components[0].id);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

  if (!isDefectSimulationModalOpen) return null;

  const targetComponent = vehicle.components.find(c => c.id === selectedCompId) || vehicle.components[0];
  const template = simulationDefectTemplates[selectedTemplateIndex];

  const handleApplyDefect = () => {
    sound.playDefectApplied();
    const newDefect: Defect = {
      ...template,
      id: `sim-${Date.now()}`
    };
    applyDefectToComponent(targetComponent.id, newDefect);
  };

  const handleRemoveDefect = (defectId: string) => {
    sound.playClick();
    removeDefectFromComponent(targetComponent.id, defectId);
  };

  const handleResetVehicle = () => {
    sound.playPass();
    resetAllVehicleComponents(vehicle.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0b0f17] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                DEFECT INJECTION & QUALITY SIMULATION LAB
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  TQM TRAINING
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Simulate non-conformances on 3D geometry to evaluate tolerance sensitivity and automated scoring.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              setDefectSimulationModalOpen(false);
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Preconfigured TQM Scenarios */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-sky-400" />
              Mode 1: Preconfigured Quality Audit Scenarios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  sound.playPass();
                  loadPreconfiguredScenario(vehicle.id, 'pristine');
                }}
                className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-300">Pristine Zero-Defect</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">100/100</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Golden Master standard. All components verify at 100% nominal tolerance compliance.
                </p>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  loadPreconfiguredScenario(vehicle.id, 'factory_audit');
                }}
                className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-300">Factory PDI Delivery Audit</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">82/100</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Clearcoat micro-scratch on driver door and localized brake rotor surface oxidation.
                </p>
              </button>

              <button
                onClick={() => {
                  sound.playDefectApplied();
                  loadPreconfiguredScenario(vehicle.id, 'fleet_audit');
                }}
                className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-950/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-red-300">Fleet High-Duty Audit</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">64/100</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Depleted tyre shoulder wear, engine gasket fluid seepage, and front bumper compression dent.
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: Interactive Defect Simulation */}
          <div className="border-t border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Mode 2: Live Component Defect Injection
              </h3>
              <button
                onClick={handleResetVehicle}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Components
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              {/* Left Column: Target Component Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Select Target Component:
                </label>
                <select
                  value={selectedCompId}
                  onChange={(e) => {
                    setSelectedCompId(e.target.value);
                    sound.playClick();
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {vehicle.components.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.domain.toUpperCase()}] {c.name} — Current Score: {c.currentScore}/100
                    </option>
                  ))}
                </select>

                {/* Target Component Info Card */}
                <div className="mt-3 p-3 rounded-lg bg-black/40 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{targetComponent.name}</span>
                    <span className={`text-xs font-mono font-bold ${targetComponent.currentScore >= 90 ? 'text-emerald-400' : targetComponent.currentScore >= 75 ? 'text-sky-400' : targetComponent.currentScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {targetComponent.currentScore}/100
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {targetComponent.purpose}
                  </p>
                </div>

                {/* Active Defects on Target Component */}
                <div className="mt-3">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Current Active Non-Conformances ({targetComponent.currentDefects.length}):
                  </span>
                  {targetComponent.currentDefects.length === 0 ? (
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> No defects applied. Component is nominal.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {targetComponent.currentDefects.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-2 rounded bg-slate-800/60 border border-slate-700/60 text-xs">
                          <div>
                            <span className="font-medium text-white">{d.name}</span>
                            <span className="ml-2 font-mono text-[10px] text-red-400">-{d.scoreDeduction} pts</span>
                          </div>
                          <button
                            onClick={() => handleRemoveDefect(d.id)}
                            className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Defect Template Selection & Injection */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Select Defect Type to Simulate:
                </label>
                <div className="space-y-2">
                  {simulationDefectTemplates.map((tmpl, idx) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setSelectedTemplateIndex(idx);
                        sound.playClick();
                      }}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between text-xs ${selectedTemplateIndex === idx ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'}`}
                    >
                      <div>
                        <div className="font-semibold">{tmpl.name}</div>
                        <div className="text-[10px] text-slate-400">{tmpl.affectedParameter}</div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-red-400 font-bold">-{tmpl.scoreDeduction} pts</span>
                        <div className="text-[9px] uppercase text-slate-500">{tmpl.severity}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleApplyDefect}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-lg shadow-lg text-xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Inject Simulated Defect onto 3D Model
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
