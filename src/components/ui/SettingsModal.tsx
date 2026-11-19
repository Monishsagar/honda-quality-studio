import React from 'react';
import { useShowroomStore } from '../../store/useShowroomStore';
import { sound } from '../../utils/audioEffects';
import {
  X,
  Settings,
  Volume2,
  VolumeX,
  Gauge,
  Eye,
  Sliders,
  MapPin,
  Sparkles
} from 'lucide-react';

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    setSettingsModalOpen,
    settings,
    updateSettings
  } = useShowroomStore();

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0b0f17] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                SHOWROOM & SIMULATION SETTINGS
              </h2>
              <p className="text-xs text-slate-400">
                Configure first-person walkthrough, graphics, and controls
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              setSettingsModalOpen(false);
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {/* Walk Speed */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="font-semibold text-white flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-sky-400" /> Walk Speed
              </span>
              <span className="font-mono text-sky-400">{settings.walkSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min="2.0"
              max="8.0"
              step="0.5"
              value={settings.walkSpeed}
              onChange={(e) => updateSettings({ walkSpeed: parseFloat(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>

          {/* Mouse Sensitivity */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="font-semibold text-white flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-sky-400" /> Mouse Look Sensitivity
              </span>
              <span className="font-mono text-sky-400">{(settings.mouseSensitivity * 1000).toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.0010"
              max="0.0050"
              step="0.0002"
              value={settings.mouseSensitivity}
              onChange={(e) => updateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>

          {/* Invert Y */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <div className="font-semibold text-white">Invert Vertical Look (Pitch)</div>
              <div className="text-[11px] text-slate-400">Reverses up/down mouse movement in first-person mode</div>
            </div>
            <input
              type="checkbox"
              checked={settings.invertY}
              onChange={(e) => updateSettings({ invertY: e.target.checked })}
              className="w-4 h-4 accent-sky-500"
            />
          </div>

          {/* Sound Effects */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <div className="font-semibold text-white flex items-center gap-2">
                {settings.soundEffects ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                Interactive Audio Feedback
              </div>
              <div className="text-[11px] text-slate-400">Synthesizer chimes on inspection, pass/fail, and component hover</div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEffects}
              onChange={(e) => {
                sound.enabled = e.target.checked;
                updateSettings({ soundEffects: e.target.checked });
              }}
              className="w-4 h-4 accent-sky-500"
            />
          </div>

          {/* Show Minimap */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <div className="font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" /> Showroom Radar Minimap
              </div>
              <div className="text-[11px] text-slate-400">Display mini 2D radar overlay with car platform positions</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showMinimap}
              onChange={(e) => updateSettings({ showMinimap: e.target.checked })}
              className="w-4 h-4 accent-sky-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
