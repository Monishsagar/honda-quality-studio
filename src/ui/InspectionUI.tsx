import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Scale, FileText, Syringe, RefreshCcw, X, Crosshair, RotateCcw, Play } from 'lucide-react';
import { useShowroomStore } from '../store/useShowroomStore';
import { useControls, ViewMode } from '../sim/controls';
import { simSpecFor } from '../sim/specs';
import { useLive, fmt } from './useLive';
import { chipsFor, cardFor } from './narration';
import { carRegistry } from '../three/registry';
import { gapReadings, paintSpots, paintStats } from '../three/metrology';
import { InspectionDomain } from '../types/vehicle';
import { sound } from '../utils/audioEffects';

const DOMAINS: { key: InspectionDomain; label: string; sub: string }[] = [
  { key: 'exterior', label: 'Exterior', sub: 'Paint, surface, gaps' },
  { key: 'interior', label: 'Interior', sub: 'Cabin and climate' },
  { key: 'engine', label: 'Powertrain', sub: 'Engine and drive' },
  { key: 'undercarriage', label: 'Chassis', sub: 'Lift, rig, brakes' },
  { key: 'electrical', label: 'Electronics', sub: 'Sensing and CAN' },
];
const DEFAULT_VIEW: Record<InspectionDomain, ViewMode> = { exterior: 'solid', interior: 'solid', engine: 'solid', undercarriage: 'solid', electrical: 'xray' };

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; dot?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => { sound.playClick(); onChange(o.v); }}>
          {o.dot && <span className="dot" style={{ background: o.dot }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="group" style={{ flex: 1 }}>
      <div className="glabel">{label}<span className="val">{fmt(value, step < 1 ? 1 : 0)}{unit ? ` ${unit}` : ''}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ ['--p' as string]: `${p}%` }} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function ControlPanel({ domain }: { domain: InspectionDomain }) {
  const c = useControls();
  const spec = simSpecFor(useShowroomStore((s) => s.activeVehicleId));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--compTop', `${el.offsetTop + el.offsetHeight + 8}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [domain]);
  return (
    <div className="panel glass fade-in" key={domain} ref={ref}>
      <div className="group">
        <div className="glabel">View</div>
        <Seg<ViewMode> value={c.view} onChange={(view) => c.set({ view })} options={[{ v: 'solid', label: 'Solid' }, { v: 'xray', label: 'X-ray' }, { v: 'cut', label: 'Section' }, { v: 'exploded', label: 'Exploded' }]} />
      </div>
      {c.view === 'cut' && <Slider label="Section plane" value={c.cut} min={-1} max={1} step={0.02} onChange={(cut) => c.set({ cut })} />}
      {c.view === 'exploded' && <Slider label="Separation" value={c.explode} min={0} max={1} step={0.01} onChange={(explode) => c.set({ explode })} />}

      {domain === 'exterior' && (
        <div className="group">
          <div className="glabel">Measure</div>
          <Seg value={c.exterior} onChange={(exterior) => c.set({ exterior, view: 'solid' })} options={[{ v: 'finish', label: 'Finish' }, { v: 'paint', label: 'Paint µm' }, { v: 'zebra', label: 'Surface' }, { v: 'gaps', label: 'Gaps' }]} />
        </div>
      )}
      {domain === 'interior' && (
        <>
          <div className="group">
            <div className="glabel">Seat</div>
            <Seg value={c.interior} onChange={(interior) => c.set({ interior, view: 'solid' })} options={[{ v: 'driver', label: 'Driver view' }, { v: 'cabin', label: 'Roof off' }, { v: 'climate', label: 'Climate' }]} />
          </div>
          <div className="row">
            <Slider label="Climate set point" value={c.climateTemp} min={16} max={28} step={0.5} unit="°C" onChange={(climateTemp) => c.set({ climateTemp })} />
            <button className={`toggle ${c.ambient ? 'on' : ''}`} onClick={() => c.set({ ambient: !c.ambient })}>Ambient light</button>
          </div>
        </>
      )}
      {domain === 'engine' && (
        <>
          <div className="group">
            <div className="glabel">Drive<span className="val">{spec.engineName}</span></div>
            <Seg value={c.drive} onChange={(drive) => c.set({ drive })} options={[{ v: 'idle', label: 'Idle' }, { v: 'cruise', label: 'Cruise' }, { v: 'launch', label: '0–100' }, { v: 'regen', label: spec.hybrid ? 'Regen' : 'Coast' }]} />
          </div>
          {c.drive === 'cruise' && <Slider label="Speed" value={c.speed} min={0} max={140} unit="km/h" onChange={(speed) => c.set({ speed })} />}
          <div className="group">
            <div className="glabel">Follow</div>
            <Seg value={c.follow} onChange={(follow) => c.set({ follow })} options={[{ v: 'all', label: 'All' }, { v: 'energy', label: spec.hybrid ? 'Energy' : 'Fuel', dot: spec.hybrid ? '#5fd0ff' : '#ffae4a' }, { v: 'engine', label: 'Combustion', dot: '#ff8a4c' }, { v: 'fluids', label: 'Cooling', dot: '#3ee0c8' }]} />
          </div>
        </>
      )}
      {domain === 'undercarriage' && (
        <>
          <div className="group">
            <div className="glabel">Test</div>
            <Seg value={c.chassis} onChange={(chassis) => c.set({ chassis })} options={[{ v: 'hoist', label: 'Lift' }, { v: 'shaker', label: '4-post rig' }, { v: 'brakes', label: 'Brake test' }]} />
          </div>
          {c.chassis === 'shaker' && (
            <>
              <div className="group">
                <div className="glabel">Road</div>
                <Seg value={c.road} onChange={(road) => c.set({ road })} options={[{ v: 'smooth', label: 'Smooth' }, { v: 'cobbles', label: 'Cobbles' }, { v: 'pothole', label: 'Pothole' }, { v: 'bump', label: 'Speed bump' }]} />
              </div>
              <Slider label="Road speed" value={c.roadSpeed} min={10} max={80} unit="km/h" onChange={(roadSpeed) => c.set({ roadSpeed })} />
            </>
          )}
          {c.chassis === 'brakes' && <button className="toggle" style={{ alignSelf: 'flex-start' }} onClick={() => c.restart()}><RotateCcw size={13} />Run again</button>}
        </>
      )}
      {domain === 'electrical' && (
        <>
          <div className="group">
            <div className="glabel">Scenario</div>
            <Seg value={c.adas} onChange={(adas) => c.set({ adas })} options={[{ v: 'follow', label: 'Follow' }, { v: 'hardbrake', label: 'Lead brakes' }, { v: 'stopped', label: 'Stopped car' }, { v: 'pedestrian', label: 'Pedestrian' }, { v: 'lanekeep', label: 'Lane keep' }]} />
          </div>
          <div className="row">
            <Slider label="Set speed" value={c.adasSpeed} min={20} max={90} unit="km/h" onChange={(adasSpeed) => c.set({ adasSpeed })} />
            <button className={`toggle ${c.sensors ? 'on' : ''}`} onClick={() => c.set({ sensors: !c.sensors })}>Sensors</button>
            <button className="toggle" onClick={() => c.restart()}><Play size={12} />Restart</button>
          </div>
        </>
      )}
    </div>
  );
}

function Readout({ domain }: { domain: InspectionDomain }) {
  const L = useLive(8);
  const c = useControls();
  const { getActiveVehicle, getOverallVehicleScore } = useShowroomStore();
  const v = getActiveVehicle();
  const spec = simSpecFor(v.id);
  const car = carRegistry.get(v.id);
  const gaps = useMemo(() => (car ? gapReadings(car, v) : []), [car, v]);
  const paint = useMemo(() => (car ? paintStats(car, paintSpots(v)) : { mean: 0, sd: 0, min: 0, max: 0, n: 0, below: 0 }), [car, v]);
  const ctx = { L, spec, v, c, gaps, paint, score: getOverallVehicleScore(v.id) };
  const chips = chipsFor(domain, ctx);
  return (
    <div className="readout">
      <div className="chips">
        {chips.map((ch) => (
          <div key={ch.k} className={`chip glass ${ch.cls ?? ''}`}>
            <span className="k">{ch.k}</span>
            <span className="v">{ch.v}{ch.u && <small>{ch.u}</small>}</span>
          </div>
        ))}
      </div>
      <div className="card glass"><p dangerouslySetInnerHTML={{ __html: cardFor(domain, ctx) }} /></div>
    </div>
  );
}

function ComponentPanel() {
  const { getSelectedComponent, setSelectedComponent, isolatedComponentId, setIsolatedComponent, resetComponentToDefectFree, setComparisonModalOpen, setDefectSimulationModalOpen } = useShowroomStore();
  const comp = getSelectedComponent();
  if (!comp) return null;
  const col = comp.currentScore >= 85 ? 'var(--pass)' : comp.currentScore >= 60 ? 'var(--warn)' : 'var(--fail)';
  return (
    <div className="comp glass fade-in" key={comp.id} style={{ top: 'var(--compTop, 300px)' }}>
      <div className="head">
        <div>
          <div className="tag">{comp.domain === 'engine' ? 'powertrain' : comp.domain === 'undercarriage' ? 'chassis' : comp.domain} · {comp.category}</div>
          <h3>{comp.name}</h3>
        </div>
        <button className="x" onClick={() => setSelectedComponent(null)}><X size={15} /></button>
      </div>
      <div className="body">
        <div className="meter">
          <span className="num" style={{ color: col }}>{comp.currentScore}</span>
          <div className="bar"><span style={{ width: `${comp.currentScore}%`, background: col }} /></div>
          <span className={`status ${comp.status}`}>{comp.status}</span>
        </div>
        <div className="small">{comp.purpose}</div>
        {comp.currentDefects.map((d) => (
          <div key={d.id} className="defect"><b>{d.name} · −{d.scoreDeduction}</b>{d.description}</div>
        ))}
        <div className="actions">
          <button className="act" onClick={() => setComparisonModalOpen(true)}><Scale />Golden master</button>
          <button className="act" onClick={() => setIsolatedComponent(isolatedComponentId === comp.id ? null : comp.id)}><Crosshair />{isolatedComponentId === comp.id ? 'Show all' : 'Isolate'}</button>
          {comp.currentDefects.length > 0
            ? <button className="act" onClick={() => { sound.playPass(); resetComponentToDefectFree(comp.id); }}><RefreshCcw />Rework</button>
            : <button className="act" onClick={() => setDefectSimulationModalOpen(true)}><Syringe />Inject</button>}
        </div>
        {comp.inspectionParameters.map((p) => (
          <div key={p.id} className="param">
            <span className="n">{p.name}</span>
            <span className={`status ${p.result}`}>{p.result}</span>
            <span className="m"><span>nominal <em>{p.nominalValue}</em></span><span>measured <em>{p.inspectedValue}</em></span><span>tol <em>{p.tolerance}</em></span></span>
          </div>
        ))}
        <div className="small"><b style={{ color: '#fff' }}>Kaizen:</b> {comp.kaizenRecommendation}</div>
      </div>
    </div>
  );
}

function Alert() {
  const L = useLive(10);
  const domain = useShowroomStore((s) => s.inspectionDomain);
  if (domain !== 'electrical' || (L.adas !== 'FCW' && L.adas !== 'AEB')) return null;
  return <div className={`alert ${L.adas === 'AEB' ? 'aeb' : 'fcw'}`}>{L.adas === 'AEB' ? 'COLLISION MITIGATION BRAKING' : 'BRAKE — FORWARD COLLISION WARNING'}</div>;
}

export function InspectionUI() {
  const {
    viewMode, setViewMode, inspectionDomain, setInspectionDomain, getActiveVehicle, getOverallVehicleScore,
    setComparisonModalOpen, setTQMReportModalOpen, setDefectSimulationModalOpen, setPDCAModalOpen, setSelectedComponent,
  } = useShowroomStore();
  const set = useControls((s) => s.set);
  useEffect(() => { set({ view: DEFAULT_VIEW[inspectionDomain] }); }, [inspectionDomain, set]);
  if (viewMode !== 'inspection') return null;
  const v = getActiveVehicle();
  const score = getOverallVehicleScore(v.id);
  return (
    <div className="lab">
      <div className="title glass fade-in">
        <div className="row1">
          <button className="back" onClick={() => { sound.playClick(); setSelectedComponent(null); setViewMode('showroom'); }} title="Back to showroom"><ArrowLeft size={15} /></button>
          <div>
            <h1>{v.name}</h1>
            <div className="sub">{v.categoryLabel} · VIN {v.vin}</div>
          </div>
          <div className="score">
            <b style={{ color: score >= 90 ? 'var(--pass)' : score >= 75 ? 'var(--warn)' : 'var(--fail)' }}>{score}</b>
            <i>TQM score</i>
          </div>
        </div>
        <div className="actions">
          <button className="act" onClick={() => setComparisonModalOpen(true)}><Scale />Benchmark</button>
          <button className="act" onClick={() => setDefectSimulationModalOpen(true)}><Syringe />Defects</button>
          <button className="act" onClick={() => setPDCAModalOpen(true)}><RefreshCcw />PDCA</button>
          <button className="act" onClick={() => setTQMReportModalOpen(true)}><FileText />Report</button>
        </div>
      </div>
      <ControlPanel domain={inspectionDomain} />
      <ComponentPanel />
      <Readout domain={inspectionDomain} />
      <Alert />
      <div className="domains glass">
        {DOMAINS.map((d) => (
          <button key={d.key} className={inspectionDomain === d.key ? 'on' : ''} onClick={() => { sound.playClick(); setSelectedComponent(null); setInspectionDomain(d.key); }}>
            <span className="dot" />
            <span><b>{d.label}</b><i>{d.sub}</i></span>
          </button>
        ))}
      </div>
    </div>
  );
}
