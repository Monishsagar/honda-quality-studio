# Honda Quality Studio — 3D Showroom & TQM Inspection

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 (allow ~5–8 s for the cars to build and shaders to compile; use Chrome with hardware acceleration on).

## How to use

- **Showroom:** click a car's tag (or the car bar at the bottom) to inspect it; or click the view, walk with WASD and press E near a car.
- **Inspection domains** (bottom bar): each one is a live test, not just a camera angle.
  - **Exterior** — Paint µm thickness map, Surface (zebra stripe dent test), Gaps (shut lines vs 3.5 ± 0.5 mm with Cpk).
  - **Interior** — Driver view (live cluster + screen, drag to look), Roof off cabin view, Climate airflow.
  - **Powertrain** — hood opens on a dyno; moving pistons/valves; e:HEV EV / Hybrid / Engine / Regen modes; Cruise, 0–100, Regen; energy, fuel, coolant and exhaust flows.
  - **Chassis** — Lift (underbody), 4-post shaker rig with road profiles, 100–0 brake test with disc heating.
  - **Electronics** — Honda Sensing scenarios: ACC, forward collision warning, auto emergency braking, pedestrian, lane keep; CAN bus traffic.
- **View** (top right): Solid, X-ray (scan sweep), Section cut, Exploded.
- Click any part for its tolerances, golden-master comparison, rework or defect injection. TQM report, PDCA and defect tools are top left.

Everything is procedural Three.js (React Three Fiber); no model files.

---

## Original project notes

A photorealistic, fully interactive 3D Honda automobile dealership showroom and engineering-grade Vehicle Quality Inspection System built upon **Total Quality Management (TQM)**, **Honda Monozukuri**, **IATF 16949**, and **ISO 9001** principles.

---

## 🌟 Key Architecture & Capabilities

### 1. Bright, High-Key 3D Honda Dealership Showroom
- **Clean Architectural Showroom**: 56m × 50m open pavilion with bright white architectural walls, reflective white porcelain flooring, natural overhead daylight skylights, and focused warm LED spotlights.
- **Iconic Honda Brand Pavilion**: Features the illuminated Honda red emblem, architectural wall branding, and bright white display platforms with red LED edge lighting.
- **5 Real Honda Vehicle Models**:
  1. **Honda City e:HEV** — Premium Executive Sedan (Platinum White Pearl, 1.5L Atkinson Cycle i-VTEC + Dual Electric Motors e:CVT)
  2. **Honda Elevate** — Modern Mid-Size Urban SUV (Phoenix Orange Pearl, 1.5L DOHC i-VTEC, 121 PS)
  3. **Honda ZR-V e:HEV** — Premium Sport Crossover (Nordic Forest Pearl, 2.0L Direct-Injection e:HEV AWD, 184 PS)
  4. **Honda Amaze** — Premium Compact Sedan (Radiant Red Metallic, 1.2L i-VTEC 4-Cylinder, 90 PS)
  5. **Honda Civic Type R (FL5)** — High-Performance Hot Hatchback (Championship White, 2.0L VTEC Turbo K20C1, 329 PS, Aero Wing Spoiler)
- **Interactive Proximity Detection**: Dynamic distance calculation displays `"Press [E] to Inspect Vehicle"` when approaching within 4.2m of any car platform.
- **Showroom Radar Minimap**: Real-time 2D radar overlay tracking player coordinates, heading angle, and all 5 car display platforms.

### 2. First-Person Walkthrough System
- **Controls**:
  - `W` `A` `S` `D` / Arrow Keys: Move forward, backward, strafe
  - `Mouse`: Free 360° human eye-level look around (Pointer Lock)
  - `Shift`: Sprint accelerator
  - `E`: Select / Enter dedicated 3D Vehicle Inspection mode
  - `ESC`: Unlock mouse cursor
- **Physics & Collision Boundary**: Realistic eye height (1.65m), walking head-bob dampening, and collision prevention with showroom walls and vehicle platforms.
- **Settings Panel**: Configurable walk speed (2.0–8.0 m/s), mouse sensitivity, inverted Y-axis, FOV, and sound effects.

### 3. Dedicated 5-Domain Vehicle Quality Inspection
When inspecting any vehicle, smoothly transitions between 5 dedicated metrology domains:
1. **Exterior**: Front & rear bumpers, hood/bonnet, doors, acoustic windshield, roof, matrix LED headlights with DRL eyebrows, Honda Solid Wing face, alloy wheels & performance tyres.
2. **Interior**: Ergonomic Honda digital cockpit dashboard, sport multi-function steering wheel with paddle shifters, Honda Sensing ADAS controls, front & rear seats, touchscreen infotainment, center console.
3. **Engine & Powertrain**: VTEC engine block / e:HEV electric drive motor, aluminum radiator cooling pack, air intake box, transmission gearbox, fluid reservoirs.
4. **Undercarriage & Chassis**: Subframe rails, MacPherson strut / multi-link suspension, brake discs, calipers, exhaust catalytic system, underfloor aero panels.
5. **Electrical & ADAS Electronics**: Central Powertrain ECU, Honda Sensing ADAS monocular camera & millimeter-wave radar, high-density wiring harness loom, 12V / high-voltage traction battery.

### 4. Interactive Exploded View & Cutaway Visualization
- **Exploded View Slider**: Smooth multi-axis mechanical separation from 0% to 100% with one-click assembly restore.
- **Visual Render Modes**:
  - `SOLID`: High-gloss automotive clearcoat with realistic reflective environmental lighting.
  - `X-RAY`: Semi-transparent glass cutaway to inspect internal engine, chassis, and electronics in-situ.
  - `WIREFRAME`: Precision CAD engineering holographic wireframe.
- **Component Isolation**: Isolate any single part in neutral turntable view while ghosting the vehicle assembly.

### 5. Metrology Guidance & Defect Detection (Red Highlighted Defect Parts)
- **High-Visibility Defect Identification**: Defective components automatically render in **high-contrast RED**, accompanied by 3D red surface defect beacons for instant visual quality audits.
- **Metrology Tolerance Verification**:
  - Nominal value, inspected measurement, tolerance band, verification result: **PASS / WARNING / FAIL**.
  - Crosby Zero-Defect expected Golden Master baseline.
  - Real-time weighted scoring formula (0–100).
- **Mode 1: Preconfigured Quality Audit Scenarios**:
  - *Pristine Zero-Defect Baseline* (100/100 Class A)
  - *Factory PDI Delivery Audit* (Door clearcoat scratch, Brake rotor oxidation)
  - *Fleet High-Duty Stress Audit* (Tyre shoulder wear, Valve cover seepage, Bumper compression dent)
- **Mode 2: Live Component Defect Injection**:
  - Inject scratches, dents, fissures/cracks, galvanic corrosion, fluid leaks, or high-duty wear onto any component.
  - Visual 3D defect decals and red component highlighting rendered directly on the 3D model.

### 6. Golden Master Benchmark Comparison
- Side-by-side synchronized 3D comparison between the inspected vehicle part and the pristine factory reference benchmark model.
- Numerical tolerance variance table (Δ Delta mm / µm / bar) highlighting deviations outside statistical process control (SPC) limits.

### 7. Total Quality Management (TQM) Framework
- **TQM Core Pillars**: Customer Focus, Process Continuous Improvement, Employee Total Involvement, Data-Driven Decision Making.
- **Deming PDCA Cycle Execution**: Plan-Do-Check-Act workflow with real-time root-cause analysis (Ishikawa Fishbone & 5-Whys methodology).
- **ISO / IATF Audit-Grade PDF Report Generation**: One-click generation of multi-page technical audit certificates formatted with Honda corporate identity, component-by-component checklists, Ishikawa findings, and Kaizen corrective action plans.

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build
```

---

## 🛠️ Technology Stack
- **Three.js** & **@react-three/fiber** / **@react-three/drei** — 3D scene rendering, lighting, camera controls
- **React 18** & **TypeScript** — Component architecture and strict type safety
- **Tailwind CSS** — Modern light-themed glassmorphism interface with Honda Red branding
- **Zustand** — Reactive store for showroom state, player telemetry, and inspection metrics
- **jsPDF** & **jspdf-autotable** — Client-side vector PDF quality audit report generation
- **Web Audio API** — Synthetic auditory feedback (clicks, camera zooms, quality pass chimes, defect alerts)
