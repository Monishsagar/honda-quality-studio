import { useEffect, useState } from 'react';
import { Settings, ShieldCheck } from 'lucide-react';
import { useShowroomStore } from '../store/useShowroomStore';
import { sound } from '../utils/audioEffects';

export function ShowroomUI() {
  const { viewMode, vehicles, activeVehicleId, setActiveVehicle, setViewMode, setSettingsModalOpen, setTQMPillarsModalOpen, player, getOverallVehicleScore } = useShowroomStore();
  if (viewMode !== 'showroom') return null;
  const near = vehicles.find((v) => v.id === player.nearbyVehicleId);
  const inspect = (id: string) => { sound.playClick(); setActiveVehicle(id); setViewMode('inspection'); };
  return (
    <div className="lab">
      <div className="brand glass fade-in">
        <div className="mark">H</div>
        <div><b>Honda quality studio</b><i>Showroom and TQM inspection</i></div>
      </div>
      <div className="corner">
        <div className="glass" style={{ display: 'flex', padding: 2 }}>
          <button className="icon" title="TQM standards" onClick={() => setTQMPillarsModalOpen(true)}><ShieldCheck size={16} /></button>
          <button className="icon" title="Settings" onClick={() => setSettingsModalOpen(true)}><Settings size={16} /></button>
        </div>
      </div>
      {near && (
        <div className="alert fcw fade-in" style={{ background: 'rgba(243,244,245,.95)', color: '#101114', top: 'auto', bottom: 92 }}>
          {near.name} · press <kbd style={{ fontFamily: 'var(--mono)', padding: '1px 6px', border: '1px solid #c9ccd1', borderRadius: 3 }}>E</kbd> to inspect
        </div>
      )}
      <div className="hint glass">
        <span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> walk</span>
        <span><kbd>Shift</kbd> faster</span>
        <span>click to look</span>
        <span><kbd>Esc</kbd> release</span>
      </div>
      <div className="domains glass">
        {vehicles.map((v) => {
          const s = getOverallVehicleScore(v.id);
          return (
            <button key={v.id} className={activeVehicleId === v.id ? 'on' : ''} onClick={() => inspect(v.id)}>
              <span className="dot" style={{ background: s >= 90 ? 'var(--pass)' : s >= 75 ? 'var(--warn)' : 'var(--fail)' }} />
              <span><b>{v.name.replace('Honda ', '')}</b><i>{v.categoryLabel} · {s}/100</i></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Minimal loader shown while the cars are built and shaders compile. */
export function Loader() {
  const [p, setP] = useState(0.1);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('Building the cars');
  useEffect(() => {
    const ready = () => { setP(1); setMsg('Ready'); setTimeout(() => setDone(true), 350); };
    window.addEventListener('scene-ready', ready);
    const id = setInterval(() => setP((x) => { const n = Math.min(0.9, x + (0.9 - x) * 0.12); if (n > 0.5) setMsg('Compiling shaders'); return n; }), 200);
    return () => { window.removeEventListener('scene-ready', ready); clearInterval(id); };
  }, []);
  return (
    <div className={`loader ${done ? 'done' : ''}`}>
      <div className="box">
        <div className="logo"><span style={{ width: 24, height: 24, borderRadius: 4, background: '#e60012', display: 'grid', placeItems: 'center', fontSize: 14, color: '#fff' }}>H</span>Honda quality studio</div>
        <div className="bar"><span style={{ width: `${p * 100}%` }} /></div>
        <div className="msg">{msg}</div>
      </div>
    </div>
  );
}
