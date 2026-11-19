import React, { useState } from 'react';
import { useShowroomStore } from '../../store/useShowroomStore';
import { PDCATask } from '../../types/tqm';
import { sound } from '../../utils/audioEffects';
import {
  X,
  RotateCw,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  ClipboardList,
  Target,
  Wrench,
  SearchCheck,
  CheckSquare
} from 'lucide-react';

export function PDCACycleModal() {
  const {
    isPDCAModalOpen,
    setPDCAModalOpen,
    pdcaTasks,
    addPDCATask,
    updatePDCATaskStatus,
    getActiveVehicle
  } = useShowroomStore();

  const vehicle = getActiveVehicle();
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStage, setNewStage] = useState<'Plan' | 'Do' | 'Check' | 'Act'>('Plan');
  const [newRole, setNewRole] = useState('Quality Engineer');

  if (!isPDCAModalOpen) return null;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    sound.playClick();
    addPDCATask({
      stage: newStage,
      title: newTitle,
      description: newDesc || 'Automotive quality countermeasure logged.',
      componentId: vehicle.components[0].id,
      assignedRole: newRole,
      status: 'in_progress'
    });

    setNewTitle('');
    setNewDesc('');
  };

  const stages: { key: 'Plan' | 'Do' | 'Check' | 'Act'; label: string; icon: any; color: string; desc: string }[] = [
    { key: 'Plan', label: '1. PLAN', icon: Target, color: 'text-sky-400 border-sky-500/40 bg-sky-950/20', desc: 'Identify root-causes and define tolerances' },
    { key: 'Do', label: '2. DO', icon: Wrench, color: 'text-amber-400 border-amber-500/40 bg-amber-950/20', desc: 'Implement pilot engineering countermeasures' },
    { key: 'Check', label: '3. CHECK', icon: SearchCheck, color: 'text-purple-400 border-purple-500/40 bg-purple-950/20', desc: 'Verify score delta & metrology compliance' },
    { key: 'Act', label: '4. ACT', icon: CheckSquare, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20', desc: 'Standardize into production SOPs' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f17] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                TQM PDCA CONTINUOUS IMPROVEMENT ENGINE
              </h2>
              <p className="text-xs text-slate-400">
                Deming Cycle: Plan - Do - Check - Act closed-loop quality management
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              setPDCAModalOpen(false);
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Stage Columns Grid */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stages.map((st) => {
              const Icon = st.icon;
              const tasks = pdcaTasks.filter(t => t.stage === st.key);

              return (
                <div key={st.key} className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4 min-h-[320px]">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-slate-300" />
                    <span className="text-xs font-bold text-white tracking-wide">{st.label}</span>
                    <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {tasks.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-3">{st.desc}</p>

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {tasks.map((task) => (
                      <div key={task.id} className="p-3 rounded-lg bg-black/40 border border-slate-800/80 text-xs space-y-1.5">
                        <div className="font-semibold text-white leading-tight">{task.title}</div>
                        <p className="text-[11px] text-slate-400">{task.description}</p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                          <span>{task.assignedRole}</span>
                          <button
                            onClick={() => {
                              sound.playPass();
                              const nextStatus = task.status === 'completed' ? 'in_progress' : 'completed';
                              updatePDCATaskStatus(task.id, nextStatus);
                            }}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {task.status === 'completed' ? 'Done' : 'Active'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Task Creation Form */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-sky-400" />
              Add Quality Corrective Countermeasure to PDCA Workflow
            </h4>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <input
                type="text"
                placeholder="Countermeasure Title (e.g. Calibrate Jig)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                required
              />
              <input
                type="text"
                placeholder="Description of Quality Action"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="Plan">Stage: 1. Plan</option>
                <option value="Do">Stage: 2. Do</option>
                <option value="Check">Stage: 3. Check</option>
                <option value="Act">Stage: 4. Act</option>
              </select>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow transition-colors"
              >
                <Plus className="w-4 h-4" /> Add to PDCA Cycle
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
