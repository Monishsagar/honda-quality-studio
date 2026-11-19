import React from 'react';
import { useShowroomStore } from '../../store/useShowroomStore';
import { exportTQMReportPDF } from '../../utils/reportPdfGenerator';
import { sound } from '../../utils/audioEffects';
import {
  X,
  Download,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Activity
} from 'lucide-react';

export function TQMReportModal() {
  const {
    isTQMReportModalOpen,
    setTQMReportModalOpen,
    generateTQMReport,
    setSelectedComponent,
    setInspectionDomain,
    setViewMode
  } = useShowroomStore();

  if (!isTQMReportModalOpen) return null;

  const report = generateTQMReport();

  const handleDownloadPDF = () => {
    sound.playPass();
    exportTQMReportPDF(report);
  };

  const handleRevisitComponent = (componentName: string) => {
    sound.playClick();
    const vehicle = useShowroomStore.getState().getActiveVehicle();
    const comp = vehicle.components.find(c => c.name.toLowerCase().includes(componentName.toLowerCase()) || componentName.toLowerCase().includes(c.name.toLowerCase()));
    if (comp) {
      setTQMReportModalOpen(false);
      setViewMode('inspection');
      setInspectionDomain(comp.domain);
      setSelectedComponent(comp.id);
    }
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'excellent':
        return { label: 'CLASS A — EXCELLENT (APPROVED FOR DELIVERY)', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'good':
        return { label: 'CLASS B — GOOD (MINOR VARIATIONS NOTED)', bg: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
      case 'needs_improvement':
        return { label: 'CLASS C — NEEDS IMPROVEMENT (CORRECTIVE ACTION REQUIRED)', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      default:
        return { label: 'CLASS D — CRITICAL NON-CONFORMANCE (QUALITY HOLD)', bg: 'bg-red-500/20 text-red-400 border-red-500/30' };
    }
  };

  const badge = getGradeBadge(report.overallGrade);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f17] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  TQM COMPREHENSIVE VEHICLE QUALITY AUDIT
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                  {report.reportNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Audited to IATF 16949 / ISO 9001 Total Quality Management Standards
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-semibold text-xs rounded-lg shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              Download Official PDF Certificate
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setTQMReportModalOpen(false);
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Executive Summary Card */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{report.vehicle.name}</h3>
                <span className="text-xs text-slate-400 font-mono">VIN: {report.vehicle.vin}</span>
              </div>
              <p className="text-xs text-slate-400 max-w-xl">
                Audited at {report.facility} by {report.inspectorName} ({report.inspectorRole}) on {report.timestamp}.
              </p>
              <div className={`inline-block px-3 py-1 rounded-md text-xs font-bold font-mono border ${badge.bg}`}>
                {badge.label}
              </div>
            </div>

            {/* Overall Score Dial */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-black/40 border border-slate-800/80 min-w-[160px]">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Overall Score</span>
              <span className={`text-4xl font-extrabold font-mono mt-1 ${report.overallScore >= 90 ? 'text-emerald-400' : report.overallScore >= 75 ? 'text-sky-400' : report.overallScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {report.overallScore}
                <span className="text-sm text-slate-500 font-normal">/100</span>
              </span>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                <span className="text-emerald-400 font-bold">{report.passedCount}P</span> / 
                <span className="text-amber-400 font-bold">{report.warningCount}W</span> / 
                <span className="text-red-400 font-bold">{report.failedCount}F</span>
              </div>
            </div>
          </div>

          {/* 5-Domain TQM Breakdown */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Domain-Level Quality Breakdown
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {report.domainScores.map(d => (
                <div key={d.domain} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-300 truncate">{d.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono">Weight: {(d.weight * 100).toFixed(0)}%</div>
                  <div className={`text-2xl font-extrabold font-mono mt-2 ${d.score >= 90 ? 'text-emerald-400' : d.score >= 75 ? 'text-sky-400' : d.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {d.score}
                    <span className="text-[10px] text-slate-500">/100</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {d.passedCount} Pass, {d.warningCount} Warn, {d.failedCount} Fail
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detected Defects / Non-conformances */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Detected Non-conformances & Defect Log ({report.detectedDefects.length})
            </h4>

            {report.detectedDefects.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Zero defects identified. Vehicle completely conforms to Golden Master standard.
              </div>
            ) : (
              <div className="space-y-2">
                {report.detectedDefects.map((def, idx) => (
                  <div key={`${def.id}-${idx}`} className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{def.name}</span>
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded ${def.severity === 'critical' ? 'bg-red-500/20 text-red-400' : def.severity === 'major' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {def.severity}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Parameter: {def.affectedParameter}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{def.description}</p>
                    </div>
                    <div className="font-mono text-red-400 font-bold ml-4">
                      -{def.scoreDeduction} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kaizen Continuous Improvement & Corrective Countermeasures */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Continuous Improvement (Kaizen) Recommendations
            </h4>

            <div className="space-y-2">
              {report.kaizenRecommendations.map((k, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{k.componentName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                        PDCA: {k.pdcaStage}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">{k.recommendation}</p>
                  </div>
                  <button
                    onClick={() => handleRevisitComponent(k.componentName)}
                    className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded-lg border border-sky-500/30 hover:bg-sky-500/10 transition-colors ml-4 whitespace-nowrap"
                  >
                    Revisit Component <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
