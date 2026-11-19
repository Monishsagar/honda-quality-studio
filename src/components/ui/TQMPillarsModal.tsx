import React, { useState } from 'react';
import { TQM_PILLARS, TQM_STANDARDS_CATALOG } from '../../data/tqmStandards';
import { sound } from '../../utils/audioEffects';
import {
  X,
  ShieldCheck,
  Award,
  Layers,
  FileCheck2,
  CheckCircle2,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface TQMPillarsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TQMPillarsModal({ isOpen, onClose }: TQMPillarsModalProps) {
  const [activeTab, setActiveTab] = useState<'pillars' | 'standards'>('pillars');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0b0f17] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                TOTAL QUALITY MANAGEMENT (TQM) FRAMEWORK
              </h2>
              <p className="text-xs text-slate-400">
                Automotive metrology principles, zero-defect engineering & regulatory compliance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-black/40 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('pillars');
                }}
                className={`px-3 py-1 rounded-md font-medium transition-all ${activeTab === 'pillars' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                8 TQM Pillars
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('standards');
                }}
                className={`px-3 py-1 rounded-md font-medium transition-all ${activeTab === 'standards' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Automotive Standards
              </button>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'pillars' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TQM_PILLARS.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">{p.title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400">
                      {p.shortDesc}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {TQM_STANDARDS_CATALOG.map((std) => (
                <div key={std.code} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-400 font-mono">{std.code}</span>
                    <span className="text-[10px] text-slate-500">{std.issuingBody}</span>
                  </div>
                  <div className="text-xs font-semibold text-white">{std.title}</div>
                  <p className="text-xs text-slate-400">{std.scope}</p>
                  <div className="text-[11px] text-sky-300 font-mono pt-1 border-t border-slate-800/60">
                    Mandate: {std.complianceMandate}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
