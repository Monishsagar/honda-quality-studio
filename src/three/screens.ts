import type { Screen } from './materials';
import type { Live } from '../sim/sim';
import type { SimSpec } from '../sim/specs';

const FONT = '"Outfit", "Helvetica Neue", Arial, sans-serif';
const MONO = '"DM Mono", ui-monospace, monospace';

/** Driver's instrument cluster: speed, power meter (hybrid) or tachometer, mode and gear. */
export function drawCluster(s: Screen, L: Live, spec: SimSpec) {
  const g = s.ctx, W = s.canvas.width, H = s.canvas.height;
  g.fillStyle = '#040608';
  g.fillRect(0, 0, W, H);
  const arc = (cx: number, cy: number, r: number, f: number, col: string, base = '#1b2430') => {
    g.lineCap = 'round';
    g.lineWidth = 9;
    g.strokeStyle = base;
    g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
    g.strokeStyle = col;
    g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, f))); g.stroke();
  };
  // left: power meter or tach
  if (spec.hybrid) {
    const p = (L.motorKW + (L.mode === 'ENGINE DRIVE' ? L.engineKW : 0)) / (spec.motorKW || 1);
    arc(95, 95, 62, Math.abs(p), p < 0 ? '#4ade80' : '#38bdf8');
    g.fillStyle = '#8fa3b8'; g.font = `500 15px ${FONT}`; g.textAlign = 'center';
    g.fillText(p < 0 ? 'CHARGE' : 'POWER', 95, 100);
  } else {
    const f = L.rpm / spec.redline;
    arc(95, 95, 62, f, f > 0.9 ? '#ef4444' : '#e5e7eb');
    g.fillStyle = '#e5e7eb'; g.font = `500 26px ${MONO}`; g.textAlign = 'center';
    g.fillText((L.rpm / 1000).toFixed(1), 95, 102);
    g.fillStyle = '#6b7c8f'; g.font = `500 12px ${FONT}`;
    g.fillText('x1000 rpm', 95, 122);
  }
  // centre: speed
  g.textAlign = 'center';
  g.fillStyle = '#ffffff'; g.font = `600 64px ${FONT}`;
  g.fillText(String(Math.round(L.kmh)), W / 2, 98);
  g.fillStyle = '#7d8ea3'; g.font = `500 15px ${FONT}`;
  g.fillText('km/h', W / 2, 122);
  // right: mode / gear / warning
  g.textAlign = 'left';
  const warn = L.adas === 'FCW' || L.adas === 'AEB';
  g.fillStyle = warn ? (Math.floor(L.t * 6) % 2 ? '#f59e0b' : '#ef4444') : '#9fb3c8';
  g.font = `600 17px ${FONT}`;
  g.fillText(warn ? (L.adas === 'AEB' ? 'BRAKE!' : 'BRAKE') : spec.hybrid ? L.mode.replace(' DRIVE', '') : spec.manual ? `GEAR ${L.gear}` : 'D', 360, 70);
  g.fillStyle = '#5b6b7d'; g.font = `500 13px ${MONO}`;
  g.fillText(spec.hybrid ? `SOC ${Math.round(L.soc * 100)}%` : `${Math.round(L.coolant)}°C`, 360, 98);
  g.fillText(`${L.fuelLh.toFixed(1)} L/h`, 360, 120);
  s.tex.needsUpdate = true;
}

/** Centre screen: energy flow, the Honda Sensing view or climate, depending on what is being inspected. */
export function drawInfo(s: Screen, L: Live, spec: SimSpec, page: 'energy' | 'adas' | 'climate', climateT: number) {
  const g = s.ctx, W = s.canvas.width, H = s.canvas.height;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0a1622');
  grd.addColorStop(1, '#06101a');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#7f95ab'; g.font = `500 16px ${FONT}`; g.textAlign = 'left';
  if (page === 'energy') {
    g.fillText(spec.hybrid ? 'e:HEV energy flow' : 'Engine', 22, 32);
    const box = (x: number, y: number, label: string, on: boolean) => {
      g.fillStyle = on ? '#123248' : '#0d1823'; g.strokeStyle = on ? '#38bdf8' : '#23384a'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(x - 52, y - 24, 104, 48, 8); g.fill(); g.stroke();
      g.fillStyle = on ? '#e6f4ff' : '#5d7286'; g.font = `600 15px ${FONT}`; g.textAlign = 'center'; g.fillText(label, x, y + 5);
    };
    const t = L.t;
    const flowLine = (x0: number, y0: number, x1: number, y1: number, on: boolean, col: string, rev = false) => {
      g.strokeStyle = on ? col : '#1d2d3b'; g.lineWidth = 4; g.setLineDash(on ? [10, 10] : []); g.lineDashOffset = rev ? t * 40 : -t * 40;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
    };
    if (spec.hybrid) {
      const ev = L.mode === 'EV DRIVE', hy = L.mode === 'HYBRID DRIVE', en = L.mode === 'ENGINE DRIVE', rg = L.mode === 'REGEN';
      flowLine(150, 110, 360, 110, hy || en, '#f59e0b');
      flowLine(150, 230, 256, 170, ev || hy || rg, rg ? '#4ade80' : '#38bdf8', rg);
      flowLine(256, 170, 360, 230, ev || hy || rg, rg ? '#4ade80' : '#38bdf8', rg);
      box(110, 110, 'Engine', L.engineOn);
      box(400, 110, en ? 'Wheels' : 'Generator', hy || en);
      box(110, 230, 'Battery', ev || hy || rg);
      box(400, 230, 'Motor', ev || hy || rg);
      g.fillStyle = '#e6f4ff'; g.font = `600 18px ${FONT}`; g.textAlign = 'center';
      g.fillText(L.mode, W / 2, 285);
    } else {
      flowLine(160, 160, 350, 160, L.engineOn, '#f59e0b');
      box(110, 160, 'Engine', L.engineOn);
      box(400, 160, 'Wheels', L.v > 0.5);
      g.fillStyle = '#e6f4ff'; g.font = `600 18px ${MONO}`; g.textAlign = 'center';
      g.fillText(`${Math.round(L.engineKW)} kW · ${Math.round(L.rpm)} rpm`, W / 2, 260);
    }
  } else if (page === 'adas') {
    g.fillText('Honda Sensing', 22, 32);
    // lanes in perspective
    g.strokeStyle = '#2b4a63'; g.lineWidth = 3;
    const lane = (k: number) => { g.beginPath(); g.moveTo(W / 2 + k * 200, H); g.lineTo(W / 2 + k * 28, 70); g.stroke(); };
    lane(-1); lane(1);
    const col = L.adas === 'AEB' ? '#ef4444' : L.adas === 'FCW' ? '#f59e0b' : '#38bdf8';
    if (L.detected) {
      const d = Math.min(1, L.targetDist / 80);
      const y = H - 40 - (1 - Math.pow(1 - d, 2)) * (H - 140);
      const w = 120 * (1 - d * 0.75);
      g.fillStyle = col; g.globalAlpha = 0.85;
      g.beginPath(); g.roundRect(W / 2 - w / 2 + L.targetLat * 18, y - w * 0.35, w, w * 0.5, 6); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#e6f4ff'; g.font = `600 16px ${MONO}`; g.textAlign = 'center';
      g.fillText(`${L.targetDist.toFixed(1)} m`, W / 2, y - w * 0.45);
    }
    g.fillStyle = '#e6f4ff'; g.font = `600 22px ${FONT}`; g.textAlign = 'left';
    g.fillText(L.adas, 22, H - 22);
  } else {
    g.fillText('Climate', 22, 32);
    g.fillStyle = '#ffffff'; g.font = `600 70px ${FONT}`; g.textAlign = 'center';
    g.fillText(`${climateT.toFixed(1)}°`, W / 2, 150);
    g.fillStyle = '#7f95ab'; g.font = `500 18px ${MONO}`;
    g.fillText(`cabin ${L.cabinT.toFixed(1)}°C   vent ${L.ventT.toFixed(0)}°C`, W / 2, 200);
    for (let i = 0; i < 5; i++) { g.fillStyle = i < 3 ? '#38bdf8' : '#1d3346'; g.fillRect(W / 2 - 90 + i * 38, 235, 30, 10); }
  }
  s.tex.needsUpdate = true;
}
