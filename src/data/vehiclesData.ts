import { VehicleData, VehicleComponent, Defect } from '../types/vehicle';

function createComponent(
  id: string,
  name: string,
  domain: VehicleComponent['domain'],
  category: string,
  purpose: string,
  meshName: string,
  explodedVector: [number, number, number],
  cameraPos: [number, number, number],
  targetPos: [number, number, number],
  referenceCondition: string,
  nominalParams: { name: string; nominal: string; inspected: string; tol: string; weight: number; result: 'pass' | 'warning' | 'fail'; desc: string }[],
  possibleDefects: Defect[],
  initialDefects: Defect[] = []
): VehicleComponent {
  const currentDefects = [...initialDefects];
  
  // Calculate initial score based on defect deductions
  let totalDeduction = 0;
  currentDefects.forEach(d => {
    totalDeduction += d.scoreDeduction;
  });
  const currentScore = Math.max(20, 100 - totalDeduction);

  let status: VehicleComponent['status'] = 'passed';
  if (currentScore < 60) status = 'failed';
  else if (currentScore < 85) status = 'warning';

  const inspectionParameters = nominalParams.map((p, idx) => ({
    id: `${id}-param-${idx}`,
    name: p.name,
    weight: p.weight,
    nominalValue: p.nominal,
    inspectedValue: currentDefects.length > 0 && p.result !== 'pass' ? p.inspected : p.nominal,
    tolerance: p.tol,
    result: currentDefects.length > 0 ? p.result : 'pass',
    description: p.desc
  }));

  return {
    id,
    name,
    domain,
    category,
    purpose,
    meshName,
    cameraPositionOffset: cameraPos,
    cameraTargetOffset: targetPos,
    explodedVector,
    referenceScore: 100,
    currentScore,
    inspectionParameters,
    possibleDefects,
    currentDefects,
    referenceCondition,
    inspectedCondition: currentDefects.length > 0 
      ? `Non-conformance detected: ${currentDefects.map(d => d.name).join(', ')}` 
      : 'Compliant with Honda TQM Zero-Defect Baseline. All tolerances verified within nominal standard.',
    kaizenRecommendation: currentDefects.length > 0
      ? `Apply Honda Quality Circle countermeasure for ${currentDefects[0].name}: Calibrate installation torque, refinish with factory-grade clearcoat, and re-audit.`
      : 'Maintain scheduled preventative maintenance and standard Honda PDI protocol.',
    status
  };
}

export const sampleDefects: Record<string, Defect> = {
  doorScratch: {
    id: 'def-scratch-1',
    name: 'Clearcoat Micro-scratch',
    type: 'scratch',
    severity: 'minor',
    description: '18mm linear superficial scratch penetrating outer clearcoat layer. Paint depth gauge indicates 112µm (nominal 135µm).',
    scoreDeduction: 12,
    simulated: false,
    affectedParameter: 'Surface condition',
    visualPosition: [-0.95, 0.75, 0.2]
  },
  bumperDent: {
    id: 'def-dent-1',
    name: 'Front Bumper Fascia Dent',
    type: 'dent',
    severity: 'major',
    description: 'Localized compression deformation (3.2mm depth, 35mm diameter) near lower air dam.',
    scoreDeduction: 22,
    simulated: false,
    affectedParameter: 'Structural condition',
    visualPosition: [0, 0.45, 2.3]
  },
  windshieldCrack: {
    id: 'def-crack-1',
    name: 'Laminated Glass Impact Fissure',
    type: 'crack',
    severity: 'critical',
    description: 'Acoustic laminated windshield displays a 38mm radial impact stress crack on driver sightline.',
    scoreDeduction: 40,
    simulated: false,
    affectedParameter: 'Structural condition',
    visualPosition: [-0.25, 1.25, 0.45]
  },
  corrosionBrake: {
    id: 'def-corr-1',
    name: 'Brake Disc Surface Oxidation',
    type: 'corrosion',
    severity: 'major',
    description: 'Localized ferric oxide crystallization and micro-pitting exceeding 15% of friction ring surface.',
    scoreDeduction: 25,
    simulated: false,
    affectedParameter: 'Surface condition',
    visualPosition: [0.92, 0.35, 1.35]
  },
  tyreWear: {
    id: 'def-wear-1',
    name: 'Asymmetric Shoulder Tread Wear',
    type: 'wear',
    severity: 'major',
    description: 'Inner shoulder tread depth depleted to 2.1mm (critical threshold 3.0mm) due to camber misalignment.',
    scoreDeduction: 28,
    simulated: false,
    affectedParameter: 'Tread depth',
    visualPosition: [0.95, 0.32, 1.35]
  },
  oilLeak: {
    id: 'def-leak-1',
    name: 'i-VTEC Valve Cover Seepage',
    type: 'leak',
    severity: 'major',
    description: 'Engine oil mist sweating and droplet formation around cylinder head mating perimeter.',
    scoreDeduction: 30,
    simulated: false,
    affectedParameter: 'Hermetic seal integrity',
    visualPosition: [0, 0.72, 1.45]
  },
  doorMisalignment: {
    id: 'def-misalign-1',
    name: 'Door Shut-line Gap Deviation',
    type: 'misalignment',
    severity: 'minor',
    description: 'B-pillar margin measures 5.2mm at top vs 3.2mm at bottom (Honda factory tolerance: 3.5 ±0.5mm).',
    scoreDeduction: 15,
    simulated: false,
    affectedParameter: 'Alignment & gap consistency',
    visualPosition: [-0.98, 0.85, -0.4]
  },
  looseFastener: {
    id: 'def-fasten-1',
    name: 'Suspension Subframe Torque Non-conformance',
    type: 'loose_fastener',
    severity: 'critical',
    description: 'Lower control arm anchor bolt torqued to 78 Nm (specified Honda engineering standard: 115 Nm ±5).',
    scoreDeduction: 35,
    simulated: false,
    affectedParameter: 'Fastener torque verification',
    visualPosition: [0.65, 0.22, 1.35]
  },
  ecuFault: {
    id: 'def-ecu-1',
    name: 'Honda Sensing CAN-Bus Jitter',
    type: 'electrical_fault',
    severity: 'minor',
    description: 'Intermittent signal latency (42ms packet delay) on ADAS camera telemetry node.',
    scoreDeduction: 14,
    simulated: false,
    affectedParameter: 'Signal bus integrity',
    visualPosition: [-0.4, 0.75, 1.15]
  }
};

export const simulationDefectTemplates: Defect[] = [
  {
    id: 'sim-scratch',
    name: 'Simulated Clearcoat Scratch',
    type: 'scratch',
    severity: 'minor',
    description: 'Injected surface paint scratch for Honda TQM visual audit training.',
    scoreDeduction: 15,
    simulated: true,
    affectedParameter: 'Surface condition'
  },
  {
    id: 'sim-dent',
    name: 'Simulated Panel Dent',
    type: 'dent',
    severity: 'major',
    description: 'Injected kinetic panel deflection for sheet metal alignment verification.',
    scoreDeduction: 24,
    simulated: true,
    affectedParameter: 'Structural condition'
  },
  {
    id: 'sim-crack',
    name: 'Simulated Glass Fissure',
    type: 'crack',
    severity: 'critical',
    description: 'Injected acoustic windshield stress fracture to test zero-defect threshold.',
    scoreDeduction: 38,
    simulated: true,
    affectedParameter: 'Structural condition'
  },
  {
    id: 'sim-corrosion',
    name: 'Simulated Disc Oxidation',
    type: 'corrosion',
    severity: 'major',
    description: 'Simulated atmospheric rust and pitting on rotor contact surface.',
    scoreDeduction: 26,
    simulated: true,
    affectedParameter: 'Corrosion resistance'
  },
  {
    id: 'sim-leak',
    name: 'Simulated Fluid Seepage',
    type: 'leak',
    severity: 'major',
    description: 'Simulated oil/coolant seal permeation along mating gasket.',
    scoreDeduction: 32,
    simulated: true,
    affectedParameter: 'Fluid sealing'
  },
  {
    id: 'sim-wear',
    name: 'Simulated Tyre Tread Wear',
    type: 'wear',
    severity: 'major',
    description: 'Simulated rubber depletion below 3.0mm legal safety depth.',
    scoreDeduction: 22,
    simulated: true,
    affectedParameter: 'Wear & dimensional tolerance'
  }
];

function buildStandardComponentsList(isEV: boolean, initialDefectSet: Record<string, Defect[]> = {}): VehicleComponent[] {
  return [
    // ----------------- EXTERIOR -----------------
    createComponent(
      'comp-front-bumper',
      'Front Aerodynamic Bumper & Grille',
      'exterior',
      'Body Panels & Fascia',
      'Impact energy absorption, pedestrian safety compliance, and cooling airflow routing across the radiator.',
      'front_bumper',
      [0, 0, 1.2],
      [0, 0.6, 3.4],
      [0, 0.3, 2.1],
      'Pristine micro-cellular polyurethane, nominal paint film 135 µm, zero deflection or loose clips.',
      [
        { name: 'Surface condition', nominal: 'Nominal (0 flaws)', inspected: 'Dent & scrape detected', tol: '0 defects', weight: 0.30, result: initialDefectSet['comp-front-bumper'] ? 'warning' : 'pass', desc: 'Visual and laser inspection for stone chips, warping or deep gouges.' },
        { name: 'Paint condition', nominal: '135 µm uniform', inspected: '110 µm localized', tol: '±15 µm', weight: 0.25, result: 'pass', desc: 'Spectrophotometric color match and paint film thickness.' },
        { name: 'Alignment & panel gap', nominal: '3.5 mm', inspected: '4.8 mm', tol: '±0.5 mm', weight: 0.25, result: initialDefectSet['comp-front-bumper'] ? 'warning' : 'pass', desc: 'Uniform shutline clearance with hood and front fenders.' },
        { name: 'Structural impact resilience', nominal: '100% nominal', inspected: '94% integrity', tol: '> 95%', weight: 0.20, result: 'pass', desc: 'Structural backing bar clip retention and energy absorber foam integrity.' }
      ],
      [sampleDefects.bumperDent, sampleDefects.doorScratch],
      initialDefectSet['comp-front-bumper'] || []
    ),

    createComponent(
      'comp-hood',
      'Sculpted Aluminium Hood / Bonnet',
      'exterior',
      'Body Panels',
      'Encloses powertrain bay, provides active pedestrian impact protection, and channels aerodynamic airflow.',
      'hood',
      [0, 0.9, 0.4],
      [0, 1.8, 2.8],
      [0, 0.8, 1.2],
      'High-tensile aluminium sheet, Ra < 0.2 µm, dual safety latch torque DIN EN ISO 898.',
      [
        { name: 'Surface condition', nominal: 'Zero blemishes', inspected: 'Blemishes noted', tol: 'Class A finish', weight: 0.30, result: 'pass', desc: 'Surface optical reflectometry inspection under polarized lighting.' },
        { name: 'Paint condition', nominal: '138 µm', inspected: '135 µm', tol: '±15 µm', weight: 0.25, result: 'pass', desc: 'Triple-coat clearcoat depth verification.' },
        { name: 'Alignment & margin', nominal: '3.2 mm', inspected: '3.3 mm', tol: '±0.4 mm', weight: 0.25, result: 'pass', desc: 'Left and right symmetrical fender margin gap.' },
        { name: 'Hinge & latch engagement', nominal: 'Dual latch 100%', inspected: '100%', tol: 'Nominal lock', weight: 0.20, result: 'pass', desc: 'Primary and secondary hood lock mechanism retention load.' }
      ],
      [sampleDefects.doorScratch, sampleDefects.bumperDent],
      initialDefectSet['comp-hood'] || []
    ),

    createComponent(
      'comp-front-left-door',
      'Driver Front Door Assembly',
      'exterior',
      'Closures & Doors',
      'Structural side-impact protection, acoustic sound-deadening seal, triple weatherstripping, and integrated power controls.',
      'door_fl',
      [-1.3, 0, 0],
      [-2.6, 1.2, 0.5],
      [-0.9, 0.8, 0.3],
      'Zero scratches, flush hinge alignment, acoustic sealing resistance 35 N, gap consistency 3.5 mm ±0.5 mm.',
      [
        { name: 'Surface condition', nominal: 'Flawless Class-A', inspected: 'Micro-scratch in clearcoat', tol: 'Zero scratches', weight: 0.25, result: initialDefectSet['comp-front-left-door'] ? 'fail' : 'pass', desc: 'Inspection of outer skin for scratches, orange peel, and micro-dents.' },
        { name: 'Paint condition', nominal: '135 µm', inspected: '112 µm (abraded)', tol: '±15 µm', weight: 0.20, result: initialDefectSet['comp-front-left-door'] ? 'warning' : 'pass', desc: 'Substrate primer, base, and clearcoat cross-section depth.' },
        { name: 'Alignment & gap consistency', nominal: '3.5 mm uniform', inspected: '5.2 mm (deviated)', tol: '±0.5 mm', weight: 0.20, result: initialDefectSet['comp-front-left-door'] ? 'fail' : 'pass', desc: 'Evenness of shutline with A-pillar, B-pillar, and rocker sill.' },
        { name: 'Structural side-impact beam', nominal: '1200 MPa boron steel', inspected: 'Conformant', tol: 'Zero deformation', weight: 0.25, result: 'pass', desc: 'Ultrasonic flaw detection across internal door intrusion beam.' },
        { name: 'Handle & latch functionality', nominal: 'Smooth 18 N pull', inspected: '19 N smooth', tol: '15-25 N', weight: 0.10, result: 'pass', desc: 'Electronic soft-close and manual mechanical release force.' }
      ],
      [sampleDefects.doorScratch, sampleDefects.doorMisalignment],
      initialDefectSet['comp-front-left-door'] || []
    ),

    createComponent(
      'comp-front-right-door',
      'Passenger Front Door Assembly',
      'exterior',
      'Closures & Doors',
      'Passenger acoustic comfort, side impact intrusion bar, acoustic glass, and central locking integration.',
      'door_fr',
      [1.3, 0, 0],
      [2.6, 1.2, 0.5],
      [0.9, 0.8, 0.3],
      'Factory standard alignment, nominal 136 µm clearcoat, zero micro-dents.',
      [
        { name: 'Surface condition', nominal: 'Nominal', inspected: 'Nominal', tol: 'Zero defects', weight: 0.25, result: 'pass', desc: 'Optical surface roughness check.' },
        { name: 'Paint condition', nominal: '136 µm', inspected: '137 µm', tol: '±15 µm', weight: 0.20, result: 'pass', desc: 'Film thickness uniformity.' },
        { name: 'Alignment & gap consistency', nominal: '3.5 mm', inspected: '3.6 mm', tol: '±0.5 mm', weight: 0.20, result: 'pass', desc: 'Gap gauge caliper inspection.' },
        { name: 'Structural condition', nominal: '100% nominal', inspected: '100%', tol: 'Zero deflection', weight: 0.25, result: 'pass', desc: 'Internal brace rigidity.' },
        { name: 'Handle functionality', nominal: 'Smooth', inspected: 'Smooth', tol: '15-25 N', weight: 0.10, result: 'pass', desc: 'Actuation latch force.' }
      ],
      [sampleDefects.doorScratch, sampleDefects.doorMisalignment],
      initialDefectSet['comp-front-right-door'] || []
    ),

    createComponent(
      'comp-windshield',
      'Acoustic Laminated Windshield Glass',
      'exterior',
      'Glazing & Vision',
      'Structural rollover cabin support, Honda Sensing optical camera transmission, UV attenuation, acoustic dampening.',
      'windshield',
      [0, 0.6, 0.5],
      [0, 1.8, 1.6],
      [0, 1.1, 0.5],
      'Laminated safety float glass, optical distortion < 0.1 diopters, zero stress micro-cracks or stone chips.',
      [
        { name: 'Optical clarity & transmission', nominal: '78% luminous trans.', inspected: '78% compliant', tol: '> 70% ECE R43', weight: 0.30, result: 'pass', desc: 'Optical transmittance and HUD distortion measurement.' },
        { name: 'Structural glass integrity', nominal: 'Zero cracks/chips', inspected: '38mm radial impact fissure', tol: '0 flaws', weight: 0.40, result: initialDefectSet['comp-windshield'] ? 'fail' : 'pass', desc: 'Acoustic PVB interlayer cohesion and impact flaw scan.' },
        { name: 'Perimeter urethane seal', nominal: '100% hermetic bond', inspected: '100% hermetic', tol: 'Zero moisture leak', weight: 0.30, result: 'pass', desc: 'Ultrasonic adhesive seal leak detection around cowl and pillars.' }
      ],
      [sampleDefects.windshieldCrack],
      initialDefectSet['comp-windshield'] || []
    ),

    createComponent(
      'comp-headlights',
      'Inline Full-LED Headlamp Cluster',
      'exterior',
      'Lighting & Vision',
      'Jewel-Eye 9-LED inline projector array, integrated LED Daytime Running Lights (DRL), active cornering beam.',
      'headlights',
      [0, 0.2, 1.1],
      [0.9, 0.9, 2.5],
      [0.6, 0.6, 1.8],
      'Polycarbonate lens with anti-scratch UV coating, 0% internal condensation, optical alignment nominal.',
      [
        { name: 'Photometric beam alignment', nominal: '1.0% downward dip', inspected: '1.05% nominal', tol: '±0.2%', weight: 0.35, result: 'pass', desc: 'Digital optical goniophotometer cut-off line evaluation.' },
        { name: 'Lens clarity & seal', nominal: 'Zero moisture/chips', inspected: 'Zero condensation', tol: 'Hermetic IP67', weight: 0.35, result: 'pass', desc: 'Inspection for micro-crystallization or venting moisture.' },
        { name: 'LED diode emitter health', nominal: '9/9 LED arrays active', inspected: '9/9 arrays active', tol: '100% operational', weight: 0.30, result: 'pass', desc: 'Individual matrix diode lumen output test.' }
      ],
      [sampleDefects.doorScratch],
      initialDefectSet['comp-headlights'] || []
    ),

    createComponent(
      'comp-wheels-tyres',
      'Diamond-Cut Alloy Wheels & Tubeless Tyres',
      'exterior',
      'Running Gear',
      'Transfers tractive and braking forces, cushions road vibrations, provides directional lateral grip.',
      'wheels_front',
      [1.1, 0, 0],
      [1.8, 0.5, 1.6],
      [0.9, 0.35, 1.4],
      'Dual-tone machined alloy rim runout < 0.3mm, radial tyre tread depth > 7.5mm, cold pressure 2.3 bar.',
      [
        { name: 'Tread depth & wear pattern', nominal: '7.8 mm uniform', inspected: '2.1 mm depleted shoulder', tol: '> 3.0 mm min', weight: 0.35, result: initialDefectSet['comp-wheels-tyres'] ? 'fail' : 'pass', desc: 'Laser depth scan across outer, center, and inner tyre ribs.' },
        { name: 'Wheel runout & rim balance', nominal: '< 0.3 mm radial', inspected: '0.2 mm compliant', tol: '< 0.5 mm', weight: 0.25, result: 'pass', desc: 'Dynamic balance and radial/axial dial indicator runout check.' },
        { name: 'Inflation pressure consistency', nominal: '2.30 bar', inspected: '2.28 bar', tol: '±0.10 bar', weight: 0.20, result: 'pass', desc: 'TPMS wireless sensor cross-verification.' },
        { name: 'Sidewall & bead integrity', nominal: 'Zero bulges or cuts', inspected: 'Zero sidewall damage', tol: 'Zero defects', weight: 0.20, result: 'pass', desc: 'Optical and tactile sidewall inspection for cord delamination.' }
      ],
      [sampleDefects.tyreWear],
      initialDefectSet['comp-wheels-tyres'] || []
    ),

    createComponent(
      'comp-roof',
      'Reinforced Roof & Shark-Fin Antenna',
      'exterior',
      'Body Structure',
      'Maintains cabin rollover survival space, houses electric sunroof mechanism, and integrates aerodynamic shark-fin antenna.',
      'roof',
      [0, 1.2, 0],
      [0, 2.4, 0.5],
      [0, 1.4, 0],
      'High-strength steel stamped roof panel, uniform laser-brazed roof ditch seams, nominal clearcoat 138 µm.',
      [
        { name: 'Roof panel surface & seams', nominal: 'Nominal Class-A finish', inspected: 'Nominal uniform', tol: 'Zero ripples', weight: 0.40, result: 'pass', desc: 'Surface scanning across laser-brazed roof rail joints.' },
        { name: 'Sunroof cassette sealing', nominal: 'Zero moisture leak', inspected: 'Zero moisture', tol: 'Hermetic IP65', weight: 0.30, result: 'pass', desc: 'Water ingress test and drain tube clearance verification.' },
        { name: 'Antenna seal & reception', nominal: '100% signal strength', inspected: '100% nominal', tol: '±2 dB', weight: 0.30, result: 'pass', desc: 'RF signal attenuation test for GPS/DAB telematics.' }
      ],
      [sampleDefects.doorScratch],
      initialDefectSet['comp-roof'] || []
    ),

    // ----------------- INTERIOR -----------------
    createComponent(
      'comp-dashboard',
      'Dual-Tone Padded Dashboard & AC Console',
      'interior',
      'Cabin Architecture',
      'Houses central touchscreen display, passenger SRS airbag chute, digital cluster, and dual-zone climate vents.',
      'dashboard',
      [0, 0.7, 0.3],
      [0, 1.2, 0.9],
      [0, 0.9, 0.4],
      'Soft-touch stitched synthetic leatherette, seamless laser-scored airbag door, scratch-resistant piano black trim.',
      [
        { name: 'Trim finish & stitching', nominal: 'Class A stitch line', inspected: 'Nominal stitch', tol: 'Zero loose thread', weight: 0.30, result: 'pass', desc: 'Visual alignment and tactile smoothness of dash pad.' },
        { name: 'Passenger airbag tear seam', nominal: 'Laser scored 0.45mm', inspected: '0.45mm nominal', tol: '±0.05 mm', weight: 0.40, result: 'pass', desc: 'Critical passenger airbag seamless deployment chute depth scan.' },
        { name: 'Panel gap with A-pillars', nominal: '1.8 mm uniform', inspected: '1.9 mm', tol: '±0.4 mm', weight: 0.30, result: 'pass', desc: 'Margin clearance between dashboard and windscreen cowl.' }
      ],
      [sampleDefects.doorScratch],
      initialDefectSet['comp-dashboard'] || []
    ),

    createComponent(
      'comp-steering-wheel',
      'Leather-Wrapped Steering Wheel with Paddle Shifters',
      'interior',
      'Driver Controls',
      'Electric Power Steering (EPS) tactile feedback, Honda Sensing ADAS cruise controls, audio switches, and driver SRS airbag.',
      'steering_wheel',
      [-0.4, 0.4, 0.2],
      [-0.4, 1.2, 0.6],
      [-0.4, 0.9, 0.3],
      'Perforated leather rim, 0.0° centered steering calibration, tactile click response on all 14 multi-function switches.',
      [
        { name: 'Zero-point resolver alignment', nominal: '0.0° / <0.5° delta', inspected: '0.0° centered', tol: '±0.5°', weight: 0.35, result: 'pass', desc: 'EPS sensor calibration and steering rack zero-point return.' },
        { name: 'Switchgear actuation force', nominal: '2.5 N crisp click', inspected: '2.5 N nominal', tol: '2.0-3.2 N', weight: 0.35, result: 'pass', desc: 'Switch tactile micro-switch actuation and paddle click feeling.' },
        { name: 'Driver airbag module clips', nominal: 'Dual locking pins', inspected: 'Compliant locked', tol: '100% secure', weight: 0.30, result: 'pass', desc: 'Horn pad spring retention and airbag module harness connector lock.' }
      ],
      [sampleDefects.doorScratch],
      initialDefectSet['comp-steering-wheel'] || []
    ),

    createComponent(
      'comp-front-seats',
      'Ergonomic Ventilated Leatherette Seats',
      'interior',
      'Seating & Comfort',
      'Supports spine posture, integrated side thorax airbags, 8-way power adjustment, and seatbelt load limiters.',
      'seats_front',
      [0, 0.5, -0.3],
      [0, 1.4, 0.3],
      [0, 0.7, -0.3],
      'Perforated synthetic leatherette, lumbar support stroke 40mm, seat slider rail retention force > 24 kN.',
      [
        { name: 'Upholstery & cushion integrity', nominal: 'Zero wrinkles/creases', inspected: 'Zero blemishes', tol: 'Class A', weight: 0.30, result: 'pass', desc: 'Wear bolster fabric durability and seat foam indentation firmness.' },
        { name: 'Power rail slide & tilt action', nominal: 'Smooth silent travel', inspected: 'Smooth travel', tol: '< 45 dB noise', weight: 0.35, result: 'pass', desc: 'Electric motor current draw across full fore/aft travel.' },
        { name: 'Seatbelt pre-tensioner circuit', nominal: '2.2 Ω squib resistance', inspected: '2.2 Ω nominal', tol: '2.0 - 2.5 Ω', weight: 0.35, result: 'pass', desc: 'Pyrotechnic buckle tensioner electrical diagnostic check.' }
      ],
      [sampleDefects.doorScratch],
      initialDefectSet['comp-front-seats'] || []
    ),

    createComponent(
      'comp-infotainment',
      'Advanced Honda Display Audio & Wireless Carplay',
      'interior',
      'Cockpit Electronics',
      'High-resolution touchscreen interface, Honda CONNECT telematics, multi-angle rear camera display, and climate control.',
      'infotainment',
      [0, 0.6, 0.4],
      [0, 1.1, 0.7],
      [0, 0.8, 0.3],
      'Optical bonding display, zero dead sub-pixels, anti-reflective coating, cold boot time < 4.5 seconds.',
      [
        { name: 'Display panel integrity & pixels', nominal: '0 dead sub-pixels', inspected: '0 defects', tol: 'ISO 9241 Class 0', weight: 0.40, result: 'pass', desc: 'RGB full-screen color cycle test for pixel retention.' },
        { name: 'Touch response latency', nominal: '< 20 ms latency', inspected: '18 ms nominal', tol: '< 25 ms', weight: 0.30, result: 'pass', desc: 'Capacitive touch gesture responsiveness.' },
        { name: 'Bluetooth & Wi-Fi throughput', nominal: '100% packet integrity', inspected: 'Nominal throughput', tol: 'Zero drops', weight: 0.30, result: 'pass', desc: 'Wireless smartphone projection connectivity test.' }
      ],
      [sampleDefects.ecuFault],
      initialDefectSet['comp-infotainment'] || []
    ),

    // ----------------- ENGINE & POWERTRAIN -----------------
    createComponent(
      isEV ? 'comp-ev-motor' : 'comp-engine-block',
      isEV ? 'Honda e:HEV Dual Electric Motor Unit' : 'Honda 1.5L DOHC i-VTEC 4-Cylinder Engine',
      'engine',
      'Powertrain Core',
      isEV 
        ? 'Dual electric motor system combining traction drive motor and starter/generator motor with intelligent power unit (IPU).' 
        : 'All-aluminium block, double overhead camshafts with Variable Timing Control (VTC), producing high thermal efficiency and linear power.',
      'engine_block',
      [0, 0.8, 0.8],
      [0, 1.4, 2.2],
      [0, 0.6, 1.4],
      isEV 
        ? 'Electric motor stator insulation resistance > 1000 MΩ, inverter drive balance nominal.' 
        : 'Zero oil or coolant seepage, cylinder compression within 2.0% variance across all 4 cylinders, smooth idle harmonics.',
      [
        { 
          name: isEV ? 'Electric motor insulation' : 'Hermetic seal integrity', 
          nominal: isEV ? '> 1000 MΩ @ 1000V' : 'Zero seepage (0 ppm)', 
          inspected: isEV ? '> 1000 MΩ' : 'Fluid seepage detected', 
          tol: isEV ? '> 500 MΩ' : 'Zero leak', 
          weight: 0.35, 
          result: initialDefectSet[isEV ? 'comp-ev-motor' : 'comp-engine-block'] ? 'fail' : 'pass', 
          desc: isEV ? 'Megger insulation breakdown test on stator windings.' : 'Helium mass spectrometer leak test on valve cover perimeter.' 
        },
        { 
          name: isEV ? 'Traction motor torque delta' : 'Cylinder compression balance', 
          nominal: isEV ? '< 1.0% variance' : '< 2.0% variance', 
          inspected: isEV ? '0.5% variance' : '1.2% nominal', 
          tol: isEV ? '< 3.0%' : '< 5.0%', 
          weight: 0.35, 
          result: 'pass', 
          desc: isEV ? 'Dynamometer electric motor torque ripple audit.' : 'Dynamic cylinder pressure transducer recording during crank.' 
        },
        { 
          name: isEV ? 'Inverter coolant loop flow' : 'Vibration & harmonic balance', 
          nominal: isEV ? '12.0 L/min @ 1.1 bar' : '< 1.2 mm/s RMS', 
          inspected: isEV ? '11.8 L/min' : '1.0 mm/s', 
          tol: isEV ? '±1.0 L/min' : '< 2.0 mm/s', 
          weight: 0.30, 
          result: 'pass', 
          desc: isEV ? 'Dielectric coolant flow rate through power drive unit.' : 'Hydraulic engine mount vibration damping and crankshaft harmonics.' 
        }
      ],
      [sampleDefects.oilLeak],
      initialDefectSet[isEV ? 'comp-ev-motor' : 'comp-engine-block'] || []
    ),

    createComponent(
      'comp-radiator',
      'Aluminium Core Radiator & Electric Cooling Fan',
      'engine',
      'Thermal Management',
      'High-efficiency heat exchanger maintaining engine operating temperatures across varying ambient conditions.',
      'radiator',
      [0, 0.4, 1.4],
      [0, 1.0, 2.5],
      [0, 0.5, 1.8],
      'Zero bent core fins, pressure tested to 2.2 bar hydrostatic head with 0.00 bar drop over 15 minutes.',
      [
        { name: 'Core fin integrity & airflow', nominal: '< 2% bent fins', inspected: '< 1% bent fins', tol: '< 5% max', weight: 0.30, result: 'pass', desc: 'Optical fin density and airflow restriction inspection.' },
        { name: 'Hydrostatic pressure retention', nominal: '2.2 bar held 15 min', inspected: '2.2 bar held', tol: 'Zero pressure drop', weight: 0.40, result: 'pass', desc: 'Pneumatic decay leak test of radiator core and tanks.' },
        { name: 'Coolant composition & pH', nominal: 'Honda Long Life Type 2', inspected: 'pH 8.2 compliant', tol: 'pH 7.8 - 8.6', weight: 0.30, result: 'pass', desc: 'Refractometer ethylene glycol concentration verification.' }
      ],
      [sampleDefects.oilLeak],
      initialDefectSet['comp-radiator'] || []
    ),

    createComponent(
      isEV ? 'comp-battery-pack' : 'comp-turbocharger',
      isEV ? 'Honda Lithium-ion IPU Battery Pack' : 'Continuously Variable Transmission (CVT) Unit',
      'engine',
      isEV ? 'Energy Storage' : 'Transmission',
      isEV 
        ? 'High-density lithium-ion battery modules with active air cooling and Battery Management System (BMS).' 
        : 'Honda G-Design Shift CVT with multi-plate wet clutch, electronic hydraulic control valve body, and dual-pulley steel belt.',
      isEV ? 'battery_pack' : 'cvt_transmission',
      [0, 0.6, 0.6],
      [0.4, 1.1, 1.8],
      [0.2, 0.6, 1.3],
      isEV 
        ? 'Cell voltage balance delta < 10 mV, thermal sensor calibration within 0.5°C.' 
        : 'Steel drive belt clamping pressure nominal, fluid temperature within operating range, zero shift flare.',
      [
        { 
          name: isEV ? 'Cell voltage delta' : 'CVT line hydraulic pressure', 
          nominal: isEV ? '< 12 mV balance' : '2.8 bar line pressure', 
          inspected: isEV ? '6 mV nominal' : '2.8 bar nominal', 
          tol: isEV ? '< 20 mV' : '±0.2 bar', 
          weight: 0.40, 
          result: 'pass', 
          desc: isEV ? 'Individual pouch cell voltage telemetry from Honda BMS.' : 'Hydraulic pressure transducer measurement across pulley ratio shifts.' 
        },
        { 
          name: isEV ? 'Battery casing seal' : 'Transmission fluid purity', 
          nominal: isEV ? 'IP67 water hermetic' : 'Zero particulate count', 
          inspected: isEV ? 'Hermetic' : 'Clean fluid', 
          tol: isEV ? 'Zero ingress' : '< 10 ppm', 
          weight: 0.30, 
          result: 'pass', 
          desc: isEV ? 'Pneumatic housing decay leak test.' : 'Spectrometric analysis of Honda HCF-2 transmission fluid.' 
        },
        { 
          name: isEV ? 'High-voltage interlock loop' : 'Drive belt slip detection', 
          nominal: isEV ? 'HVIL circuit closed' : '0.0% slip ratio', 
          inspected: isEV ? 'Closed' : '0.0% nominal', 
          tol: isEV ? '100% active' : '< 0.5%', 
          weight: 0.30, 
          result: 'pass', 
          desc: isEV ? 'High-voltage manual service disconnect interlock continuity.' : 'Input vs output pulley hall-sensor speed synchronization.' 
        }
      ],
      [sampleDefects.oilLeak],
      initialDefectSet[isEV ? 'comp-battery-pack' : 'comp-turbocharger'] || []
    ),

    // ----------------- UNDERCARRIAGE -----------------
    createComponent(
      'comp-suspension-front',
      'MacPherson Strut Front Suspension Assembly',
      'undercarriage',
      'Chassis Dynamics',
      'Forged lower control arms, fluid-filled compliance bushings, progressive-rate coil springs, and stabilizer bar.',
      'suspension_front',
      [0.9, -0.6, 0.4],
      [1.4, -0.2, 1.5],
      [0.7, 0.2, 1.4],
      'High-tensile steel control arm, dust boot hermetically sealed, nitrogen damper valve response nominal.',
      [
        { name: 'Ball joint boot & play', nominal: 'Zero play / sealed boot', inspected: 'Zero play nominal', tol: 'Zero play (<0.2mm)', weight: 0.30, result: 'pass', desc: 'Tactile and dial gauge axial deflection test on ball studs.' },
        { name: 'Fastener torque verification', nominal: '115 Nm Honda standard', inspected: '78 Nm (insufficient)', tol: '±5 Nm', weight: 0.40, result: initialDefectSet['comp-suspension-front'] ? 'fail' : 'pass', desc: 'Calibrated digital torque-angle transducer audit on subframe anchor bolts.' },
        { name: 'Damper rebound force curve', nominal: 'Within dyno corridor', inspected: 'Within corridor', tol: '±5% damping force', weight: 0.30, result: 'pass', desc: 'Velocity curve dyno check on hydraulic strut.' }
      ],
      [sampleDefects.looseFastener],
      initialDefectSet['comp-suspension-front'] || []
    ),

    createComponent(
      'comp-brakes-front',
      'Front Ventilated Disc Brakes & Floating Calipers',
      'undercarriage',
      'Braking System',
      'Converts vehicle kinetic energy into thermal energy safely; features ventilated cast-iron rotors and hydraulic single-piston calipers.',
      'brakes_front',
      [1.0, -0.4, 0.2],
      [1.6, -0.1, 1.6],
      [0.8, 0.25, 1.4],
      'Ventilated cast-iron friction ring, rotor thickness nominal 25.0 mm (min 23.0 mm), brake pad friction lining > 8.5 mm.',
      [
        { name: 'Rotor thickness & runout', nominal: '25.0 mm / <0.020mm', inspected: '24.9 mm / 0.015mm', tol: 'Min 23.0 mm', weight: 0.35, result: 'pass', desc: 'Micrometer thickness measurement at 8 radial points and dial indicator runout.' },
        { name: 'Surface condition & oxidation', nominal: 'Zero oxidation/pits', inspected: 'Surface oxidation & pits', tol: 'Zero pitting', weight: 0.35, result: initialDefectSet['comp-brakes-front'] ? 'fail' : 'pass', desc: 'Visual and eddy-current check for friction ring rust or scoring.' },
        { name: 'Brake pad lining & wear sensor', nominal: '9.5 mm / nominal pin', inspected: '9.2 mm / compliant', tol: '> 3.5 mm', weight: 0.30, result: 'pass', desc: 'Acoustic thickness measurement of semi-metallic brake pad compound.' }
      ],
      [sampleDefects.corrosionBrake],
      initialDefectSet['comp-brakes-front'] || []
    ),

    createComponent(
      'comp-exhaust-system',
      'Stainless Steel Exhaust & Catalytic Converter',
      'undercarriage',
      'Exhaust & Aero',
      'High-grade stainless steel exhaust system with close-coupled three-way catalytic converter and underfloor acoustic muffler.',
      'exhaust_system',
      [0, -0.8, -0.6],
      [0, -0.4, -1.8],
      [0, 0.1, -1.0],
      'Zero exhaust gas leakage, weld bead root penetration 100%, catalytic converter conversion efficiency > 99%.',
      [
        { name: 'Exhaust sealing & joints', nominal: 'Zero leak @ 0.6 bar', inspected: 'Zero leakage', tol: '0 ppm HC/CO', weight: 0.40, result: 'pass', desc: 'Pneumatic pressure test of exhaust flange gaskets.' },
        { name: 'Catalytic conversion rate', nominal: '> 99.0% efficiency', inspected: '99.4% nominal', tol: '> 98.0%', weight: 0.30, result: 'pass', desc: 'Pre- and post-cat dual oxygen sensor ratio recording.' },
        { name: 'Rubber isolator hangers', nominal: '4/4 flexible mounts', inspected: '4/4 nominal', tol: 'Zero cracks', weight: 0.30, result: 'pass', desc: 'Inspection of EPDM rubber exhaust vibration dampeners.' }
      ],
      [sampleDefects.corrosionBrake],
      initialDefectSet['comp-exhaust-system'] || []
    ),

    // ----------------- ELECTRICAL & ELECTRONICS -----------------
    createComponent(
      'comp-ecu',
      'Honda Engine & Powertrain Control Module (ECM/PCM)',
      'electrical',
      'Electronic Architecture',
      'Microprocessor controlling multi-point fuel injection, ignition timing, VTC cam phasing, drive-by-wire throttle, and emission diagnostics.',
      'ecu_unit',
      [-0.6, 0.4, 0.6],
      [-0.8, 1.1, 1.4],
      [-0.4, 0.7, 1.0],
      'Aluminium sealed casing, CAN-bus communication latency < 2 ms, 0 stored Diagnostic Trouble Codes (DTCs).',
      [
        { name: 'Diagnostic fault codes (DTC)', nominal: '0 stored DTCs', inspected: '0 DTCs active', tol: '0 faults', weight: 0.40, result: 'pass', desc: 'OBD-II / Honda HDS diagnostic scan of powertrain domain.' },
        { name: 'CAN-bus packet latency', nominal: '< 2.0 ms latency', inspected: '42 ms latency spike', tol: '< 5.0 ms max', weight: 0.30, result: initialDefectSet['comp-ecu'] ? 'warning' : 'pass', desc: 'CAN-bus differential voltage waveform analysis.' },
        { name: 'Regulated supply voltage', nominal: '13.80 V ±0.2 V', inspected: '13.82 V nominal', tol: '13.2 - 14.4 V', weight: 0.30, result: 'pass', desc: 'Input voltage regulation under electrical load.' }
      ],
      [sampleDefects.ecuFault],
      initialDefectSet['comp-ecu'] || []
    ),

    createComponent(
      'comp-wiring-harness',
      'Automotive Flame-Retardant Wiring Loom',
      'electrical',
      'Electrical Distribution',
      'Engine and chassis wiring harness with waterproof sealed connectors, distributing power and sensor telemetry.',
      'wiring_harness',
      [0, 0.3, 0.2],
      [0.3, 0.9, 1.2],
      [0, 0.5, 0.8],
      'High-temperature protective conduit, terminal retention force > 45 N, chassis ground resistance < 0.05 ohms.',
      [
        { name: 'Ground point resistance', nominal: '< 0.05 Ω to chassis', inspected: '0.02 Ω nominal', tol: '< 0.10 Ω', weight: 0.35, result: 'pass', desc: 'Four-wire Kelvin resistance measurement on main ground terminals.' },
        { name: 'Conduit abrasion clearance', nominal: '100% abrasion free', inspected: 'Nominal conduit', tol: 'Zero chafing', weight: 0.35, result: 'pass', desc: 'Clearance audit from sharp chassis edges and exhaust heat shields.' },
        { name: 'Connector seal & lock load', nominal: '> 45 N pull test', inspected: '> 50 N pull test', tol: '> 35 N', weight: 0.30, result: 'pass', desc: 'Connector secondary lock engagement verification on engine plugs.' }
      ],
      [sampleDefects.ecuFault],
      initialDefectSet['comp-wiring-harness'] || []
    ),

    createComponent(
      'comp-adas-sensors',
      'Honda Sensing ADAS Camera & Millimeter-Wave Radar',
      'electrical',
      'Advanced Driver Assistance',
      'Monocular wide-angle camera behind windshield and front-grille radar providing Collision Mitigation Braking (CMBS) and Lane Keeping Assist (LKAS).',
      'adas_sensors',
      [0, 0.4, 1.8],
      [0, 0.8, 2.6],
      [0, 0.4, 2.0],
      'Optically calibrated camera aperture, radar horizontal angle alignment < 0.1°, zero alignment DTCs.',
      [
        { name: 'Radar horizontal azimuth calibration', nominal: '0.00° / < 0.10°', inspected: '0.04° compliant', tol: '< 0.15°', weight: 0.40, result: 'pass', desc: 'Target board laser reflector alignment calibration.' },
        { name: 'Monocular camera optical aim', nominal: 'Factory calibrated', inspected: 'Nominal calibration', tol: '±0.1° optical', weight: 0.30, result: 'pass', desc: 'Windshield optical distortion compensation check.' },
        { name: 'Emergency braking fail-safe', nominal: 'Dual redundant loop', inspected: 'Verified active', tol: 'Zero faults', weight: 0.30, result: 'pass', desc: 'Simulated sensor block and fail-safe cluster warning activation.' }
      ],
      [sampleDefects.doorScratch],
      initialDefectSet['comp-adas-sensors'] || []
    )
  ];
}

export const vehiclesList: VehicleData[] = [
  // 1. Honda City (Midsize Premium Sedan) - Center Podium
  {
    id: 'honda-city',
    name: 'Honda City ZX e:HEV',
    brand: 'Honda',
    model: 'City',
    year: 2026,
    vin: 'MAK-GM4-67290-CTY',
    category: 'sedan',
    categoryLabel: 'Premium Midsize Sedan',
    subtitle: 'The Benchmark of Sophisticated Elegance & Hybrid Efficiency',
    description: 'The iconic Honda City featuring the advanced two-motor e:HEV hybrid powertrain, full LED jewel-eye headlights, refined dual-tone leatherette interior, and comprehensive Honda Sensing ADAS safety suite.',
    price: '$24,800',
    showroomPosition: [0, 0, 0], // Center Stage
    showroomRotation: [0, -Math.PI / 4, 0],
    platformRadius: 4.6,
    platformName: 'Center Stage - Honda City Premiere Pavilion',
    bodyColor: '#f8fafc', // Platinum White Pearl
    caliperColor: '#e2e8f0',
    rimColor: '#cbd5e1',
    interiorColor: '#e2e8f0', // Dual tone ivory/black
    specs: {
      powertrain: '1.5L Atkinson Cycle DOHC i-VTEC + Dual Electric Motor e:HEV',
      power: '126 PS Combined System Output',
      torque: '253 Nm Instant Electric Motor Torque',
      acceleration: '0-100 km/h in 9.2s',
      topSpeed: '185 km/h',
      transmission: 'Electronic Continuously Variable Transmission (e-CVT)',
      drivetrain: 'Front-Wheel Drive with Intelligent Multi-Mode Drive (i-MMD)',
      weight: '1,280 kg',
      dimensions: '4,583 mm L x 1,748 mm W x 1,489 mm H'
    },
    components: buildStandardComponentsList(false, {
      'comp-front-left-door': [sampleDefects.doorScratch, sampleDefects.doorMisalignment],
      'comp-brakes-front': [sampleDefects.corrosionBrake]
    })
  },

  // 2. Honda Elevate (Compact Urban SUV) - Left Front
  {
    id: 'honda-elevate',
    name: 'Honda Elevate ZX',
    brand: 'Honda',
    model: 'Elevate',
    year: 2026,
    vin: 'MAK-DG5-88312-ELV',
    category: 'suv',
    categoryLabel: 'Urban Compact SUV',
    subtitle: 'Bold SUV Stance, Class-Leading 220mm Ground Clearance',
    description: 'Engineered specifically for the modern urban adventure, the Honda Elevate commands attention with its imposing upright grille, robust body cladding, panoramic electric sunroof, and class-leading 458-litre cargo capacity.',
    price: '$21,500',
    showroomPosition: [-11, 0, 8], // Left Front Pavilion
    showroomRotation: [0, Math.PI / 6, 0],
    platformRadius: 4.4,
    platformName: 'Platform 2 - Honda Elevate Adventure Arena',
    bodyColor: '#4a453f', // Golden Brown Metallic (matching real Honda Elevate Photo)
    caliperColor: '#94a3b8',
    rimColor: '#0f172a',
    interiorColor: '#292524', // Rich Charcoal Leatherette
    specs: {
      powertrain: '1.5L DOHC i-VTEC 16-Valve 4-Cylinder Engine',
      power: '121 PS @ 6,600 rpm',
      torque: '145 Nm @ 4,300 rpm',
      acceleration: '0-100 km/h in 10.4s',
      topSpeed: '180 km/h',
      transmission: '7-Speed Step-Shift CVT with Paddle Shifters',
      drivetrain: 'Front-Wheel Drive with 220 mm High Ground Clearance',
      weight: '1,258 kg',
      dimensions: '4,312 mm L x 1,790 mm W x 1,650 mm H'
    },
    components: buildStandardComponentsList(false, {
      'comp-front-bumper': [sampleDefects.bumperDent],
      'comp-suspension-front': [sampleDefects.looseFastener]
    })
  },

  // 3. Honda ZR-V (Premium Crossover SUV) - Right Front
  {
    id: 'honda-zr-v',
    name: 'Honda ZR-V e:HEV AWD',
    brand: 'Honda',
    model: 'ZR-V',
    year: 2026,
    vin: 'JH4-RZ3-99120-ZRV',
    category: 'suv',
    categoryLabel: 'Premium Crossover SUV',
    subtitle: 'Coupe-Inspired Fluid Styling & Dynamic All-Wheel Drive Hybrid',
    description: 'Bridging refined athleticism and SUV utility, the Honda ZR-V features a distinctive vertical slatted grille, dual exhaust outlets, multi-link rear suspension, and intelligent Real Time AWD with Snow Mode.',
    price: '$38,900',
    showroomPosition: [11, 0, 8], // Right Front Pavilion
    showroomRotation: [0, -Math.PI / 6, 0],
    platformRadius: 4.6,
    platformName: 'Platform 3 - Honda ZR-V Premium Gallery',
    bodyColor: '#15171a', // Crystal Black Pearl (matching real Honda HR-V / ZR-V)
    caliperColor: '#475569',
    rimColor: '#64748b',
    interiorColor: '#18181b', // Premium Black Leather with contrast stitching
    specs: {
      powertrain: '2.0L Direct Injection Atkinson-Cycle i-VTEC + e:HEV Dual Motors',
      power: '184 PS Combined Output',
      torque: '315 Nm Drive Motor Torque',
      acceleration: '0-100 km/h in 7.9s',
      topSpeed: '190 km/h',
      transmission: 'Electronic Continuously Variable Transmission (e-CVT)',
      drivetrain: 'Real Time All-Wheel Drive (AWD) with E-Shaft Coupling',
      weight: '1,615 kg',
      dimensions: '4,568 mm L x 1,840 mm W x 1,620 mm H'
    },
    components: buildStandardComponentsList(false, {
      'comp-wheels-tyres': [sampleDefects.tyreWear],
      'comp-windshield': [sampleDefects.windshieldCrack]
    })
  },

  // 4. Honda Amaze (Subcompact Sedan) - Left Rear
  {
    id: 'honda-amaze',
    name: 'Honda Amaze VX',
    brand: 'Honda',
    model: 'Amaze',
    year: 2026,
    vin: 'MAK-DF2-44210-AMZ',
    category: 'sedan',
    categoryLabel: 'Subcompact Sedan',
    subtitle: 'Contemporary Aerodynamics, Big-Car Cabin Roominess',
    description: 'Compact on the outside yet remarkably spacious inside. Featuring Honda solid wing face with chrome bar, LED projector headlamps with DRLs, diamond-cut alloys, and ultra-smooth CVT transmission.',
    price: '$12,400',
    showroomPosition: [-11, 0, -8], // Left Rear Pavilion
    showroomRotation: [0, Math.PI / 3, 0],
    platformRadius: 4.2,
    platformName: 'Platform 4 - Honda Amaze Compact Pavilion',
    bodyColor: '#42484f', // Modern Steel / Meteoroid Grey Metallic (matching real Honda Amaze Photo)
    caliperColor: '#94a3b8',
    rimColor: '#e2e8f0',
    interiorColor: '#d6d3d1', // Dual-tone Warm Grey
    specs: {
      powertrain: '1.2L i-VTEC 4-Cylinder Petrol Engine',
      power: '90 PS @ 6,000 rpm',
      torque: '110 Nm @ 4,800 rpm',
      acceleration: '0-100 km/h in 11.2s',
      topSpeed: '165 km/h',
      transmission: 'Continuous Variable Transmission (CVT) with G-Design Shift',
      drivetrain: 'Front-Wheel Drive',
      weight: '995 kg',
      dimensions: '3,995 mm L x 1,695 mm W x 1,501 mm H'
    },
    components: buildStandardComponentsList(false, {
      'comp-ecu': [sampleDefects.ecuFault]
    })
  },

  // 5. Honda Civic Type R (High-Performance Sport Sedan) - Right Rear
  {
    id: 'honda-civic',
    name: 'Honda Civic Type R',
    brand: 'Honda',
    model: 'Civic Type R',
    year: 2026,
    vin: 'JHM-FL5-11004-CTR',
    category: 'sports',
    categoryLabel: 'High-Performance Sports Car',
    subtitle: 'Nürburgring Lap Record Holder, 2.0L VTEC Turbocharged Legend',
    description: 'The ultimate driver weapon engineered with Honda championship motorsport DNA. Featuring functional aero downforce, triple center exhaust pipes, Brembo 4-piston calipers, adaptive dual-axis damper suspension, and helical limited-slip differential.',
    price: '$45,800',
    showroomPosition: [11, 0, -8], // Right Rear Pavilion
    showroomRotation: [0, -Math.PI / 3, 0],
    platformRadius: 4.6,
    platformName: 'Platform 5 - Honda Motorsport Heritage Arena',
    bodyColor: '#525d6b', // Sonic Gray Pearl (matching real Honda Civic Type R FL5 Photo)
    caliperColor: '#334155', // Performance Charcoal Caliper (Defect-free, non-red)
    rimColor: '#0f172a', // Matte Berlina Black
    interiorColor: '#18181b', // Alcantara Charcoal Black (Defect-free, non-red)
    specs: {
      powertrain: '2.0L K20C1 Turbocharged DOHC VTEC Inline-4 Engine',
      power: '315 PS @ 6,500 rpm',
      torque: '420 Nm @ 2,600-4,000 rpm',
      acceleration: '0-100 km/h in 5.3s',
      topSpeed: '275 km/h',
      transmission: '6-Speed Close-Ratio Manual with Automatic Rev-Matching',
      drivetrain: 'Front-Wheel Drive with Helical Limited-Slip Differential (LSD)',
      weight: '1,430 kg',
      dimensions: '4,595 mm L x 1,890 mm W x 1,405 mm H'
    },
    components: buildStandardComponentsList(false, {
      'comp-front-bumper': [sampleDefects.bumperDent],
      'comp-wheels-tyres': [sampleDefects.tyreWear]
    })
  }
];
