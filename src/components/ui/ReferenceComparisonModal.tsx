import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { CarModel } from '../3d/CarModel';
import { useShowroomStore } from '../../store/useShowroomStore';
import { VehicleData } from '../../types/vehicle';
import { sound } from '../../utils/audioEffects';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  Scale
} from 'lucide-react';

export function ReferenceComparisonModal() {
  const {
    isComparisonModalOpen,
    setComparisonModalOpen,
    getActiveVehicle,
    selectedComponentId,
    setSelectedComponent,
    resetComponentToDefectFree
  } = useShowroomStore();

  const vehicle = getActiveVehicle();
  const currentComp = vehicle.components.find(c => c.id === selectedComponentId) || vehicle.components[0];

  const [activeCompId, setActiveCompId] = useState(currentComp.id);

  if (!isComparisonModalOpen) return null;

  const activeComp = vehicle.components.find(c => c.id === activeCompId) || vehicle.components[0];

  // Golden master pristine vehicle data
  const referenceVehicle: VehicleData = {
    ...vehicle,
    components: vehicle.components.map(c => ({
      ...c,
      currentScore: 100,
      currentDefects: [],
      status: 'passed' as const
    }))
  };

  const handleRemediate = () => {
    sound.playPass();
    resetComponentToDefectFree(activeComp.id);
  };

  const renderComponentIsolated = (veh: VehicleData, isRef: boolean) => (
    <group position={[0, -0.35, 0]}>
      <CarModel vehicle={veh} isReferenceModel={isRef} isolateId={activeComp.id} />
    </group>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-[#0b0f17] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d131f]/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  TQM REFERENCE BENCHMARK COMPARISON
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  {vehicle.name}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Synchronized dual-viewport delta analysis: Golden Master vs Inspected Component
              </p>
            </div>
          </div>

          {/* Component Quick Selector */}
          <div className="flex items-center gap-4">
            <select
              value={activeComp.id}
              onChange={(e) => {
                setActiveCompId(e.target.value);
                setSelectedComponent(e.target.value);
                sound.playClick();
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {vehicle.components.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.domain.toUpperCase()}] {c.name} ({c.currentScore}/100)
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                sound.playClick();
                setComparisonModalOpen(false);
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dual 3D Viewports Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-3 flex-1 min-h-[340px]">
          {/* Left Viewport: Golden Master Reference Model */}
          <div className="relative rounded-xl overflow-hidden border border-emerald-500/30 bg-gradient-to-b from-[#061412] to-[#040a09] flex flex-col">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 backdrop-blur">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-bold text-emerald-300 tracking-wider">REFERENCE MODEL</span>
                <span className="ml-2 text-[10px] text-emerald-400 font-mono">100/100 (NOMINAL)</span>
              </div>
            </div>
            <div className="absolute bottom-3 left-3 z-10 text-[10px] text-slate-400 font-mono bg-black/60 px-2 py-1 rounded">
              Controls: Drag to rotate | Scroll to zoom
            </div>

            <Canvas camera={{ position: [2.5, 1.5, 2.5], fov: 45 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[5, 8, 5]} intensity={1.5} />
              <directionalLight position={[-5, 4, -5]} intensity={0.8} color="#93c5fd" />
              <pointLight position={[0, 2, 0]} intensity={2.0} color="#10b981" />
              <Environment resolution={256} frames={1}>
                <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
                <Lightformer form="rect" intensity={1.5} position={[5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 3, 1]} />
                <Lightformer form="rect" intensity={1.5} position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
              </Environment>
              {renderComponentIsolated(referenceVehicle, true)}
              <OrbitControls enableDamping dampingFactor={0.05} autoRotate autoRotateSpeed={1.0} />
            </Canvas>
          </div>

          {/* Right Viewport: Inspected Current Model */}
          <div className={`relative rounded-xl overflow-hidden border ${activeComp.currentScore < 60 ? 'border-red-500/40 bg-gradient-to-b from-[#180a0a] to-[#090404]' : activeComp.currentScore < 85 ? 'border-amber-500/40 bg-gradient-to-b from-[#181206] to-[#090602]' : 'border-sky-500/30 bg-gradient-to-b from-[#081324] to-[#040812]'} flex flex-col`}>
            <div className="absolute top-3 left-3 z-10 flex items-center justify-between right-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 backdrop-blur">
                <AlertTriangle className={`w-4 h-4 ${activeComp.currentScore < 60 ? 'text-red-400' : activeComp.currentScore < 85 ? 'text-amber-400' : 'text-sky-400'}`} />
                <div>
                  <span className="text-xs font-bold text-white tracking-wider">INSPECTED MODEL</span>
                  <span className={`ml-2 text-[10px] font-mono font-bold ${activeComp.currentScore < 60 ? 'text-red-400' : activeComp.currentScore < 85 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeComp.currentScore}/100 {activeComp.currentScore < 100 && `(Δ -${100 - activeComp.currentScore})`}
                  </span>
                </div>
              </div>

              {activeComp.currentScore < 100 && (
                <button
                  onClick={handleRemediate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Restore Golden Master
                </button>
              )}
            </div>
            <div className="absolute bottom-3 left-3 z-10 text-[10px] text-slate-400 font-mono bg-black/60 px-2 py-1 rounded">
              Controls: Drag to rotate | Scroll to zoom
            </div>

            <Canvas camera={{ position: [2.5, 1.5, 2.5], fov: 45 }}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[5, 8, 5]} intensity={1.5} />
              <directionalLight position={[-5, 4, -5]} intensity={0.8} color="#93c5fd" />
              {activeComp.currentScore < 60 && (
                <pointLight position={[0, 1.5, 0]} intensity={3.0} color="#ef4444" />
              )}
              <Environment resolution={256} frames={1}>
                <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
                <Lightformer form="rect" intensity={1.5} position={[5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 3, 1]} />
                <Lightformer form="rect" intensity={1.5} position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
              </Environment>
              {renderComponentIsolated(vehicle, false)}
              <OrbitControls enableDamping dampingFactor={0.05} autoRotate autoRotateSpeed={1.0} />
            </Canvas>
          </div>
        </div>

        {/* Comparison Table Section */}
        <div className="h-64 border-t border-slate-800 bg-[#080d16] p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Detailed Parameter Comparison Ledger: {activeComp.name}
            </h3>
            <span className="text-[11px] text-slate-400">
              Tolerance Band Mandate: ISO 9001 / IATF 16949 Metrology Standard
            </span>
          </div>

          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-[10px] uppercase font-mono bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Inspection Parameter</th>
                <th className="py-2.5 px-3">Reference Model (Standard)</th>
                <th className="py-2.5 px-3">Inspected Model (Current)</th>
                <th className="py-2.5 px-3">Tolerance Band</th>
                <th className="py-2.5 px-3">TQM Weight</th>
                <th className="py-2.5 px-3 text-right">Verification Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {activeComp.inspectionParameters.map((param) => {
                const isPass = param.result === 'pass';
                const isWarn = param.result === 'warning';

                return (
                  <tr key={param.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-white flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-sky-400" />
                      {param.name}
                    </td>
                    <td className="py-2 px-3 text-emerald-400 font-mono font-medium">
                      {param.nominalValue}
                    </td>
                    <td className={`py-2 px-3 font-mono font-medium ${isPass ? 'text-emerald-400' : isWarn ? 'text-amber-400' : 'text-red-400'}`}>
                      {param.inspectedValue}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {param.tolerance}
                    </td>
                    <td className="py-2 px-3 text-slate-400 font-mono">
                      {(param.weight * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-3 text-right">
                      {isPass && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> PASS
                        </span>
                      )}
                      {isWarn && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" /> WARNING
                        </span>
                      )}
                      {!isPass && !isWarn && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          <XCircle className="w-3 h-3" /> FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
