import { PDCATask } from '../types/tqm';

export interface TQMStandardInfo {
  code: string;
  title: string;
  issuingBody: string;
  scope: string;
  complianceMandate: string;
}

export const TQM_STANDARDS_CATALOG: TQMStandardInfo[] = [
  {
    code: 'IATF 16949:2016',
    title: 'Quality Management Systems for Automotive Production',
    issuingBody: 'International Automotive Task Force',
    scope: 'Defect prevention, reduction of variation, and waste minimization in the supply chain.',
    complianceMandate: 'Zero-tolerance on structural safety joints, weld seam ultrasonic certification, and ASIL-D electronics integrity.'
  },
  {
    code: 'ISO 9001:2015',
    title: 'Quality Management Systems — Requirements',
    issuingBody: 'International Organization for Standardization',
    scope: 'Process standardization, risk-based thinking, and continuous customer satisfaction.',
    complianceMandate: 'Complete traceability of component batch serial numbers and calibrated inspection instrumentation.'
  },
  {
    code: 'VDA 6.3',
    title: 'Process Audit for Automotive Manufacturing',
    issuingBody: 'German Association of the Automotive Industry (VDA)',
    scope: 'Evaluation of product realization processes from design freeze to series delivery.',
    complianceMandate: 'PDI (Pre-Delivery Inspection) audit grading A (>92%) required for customer handover.'
  },
  {
    code: 'ECE R43',
    title: 'Uniform Provisions Concerning Safety Glazing Materials',
    issuingBody: 'United Nations Economic Commission for Europe',
    scope: 'Impact resistance, optical clarity, and fracture fragmentation of vehicle windscreens.',
    complianceMandate: 'Zero stress fissures or localized star cracks on primary driver optical sightlines.'
  },
  {
    code: 'DIN EN ISO 898-1',
    title: 'Mechanical Properties of Fasteners Made of Carbon Steel',
    issuingBody: 'Deutsches Institut für Normung',
    scope: 'Tightening torque, yield point, and clamp force retention under dynamic vibration.',
    complianceMandate: 'Critical suspension wishbone and subframe anchors audited via digital torque-angle transducers.'
  }
];

export const TQM_PILLARS = [
  {
    id: 'qc',
    title: '1. Quality Control (QC)',
    shortDesc: 'Component-Level Verification',
    description: 'Direct measurement of physical parameters (gap width, clearcoat depth, torque, acoustic noise) against nominal tolerance bands.'
  },
  {
    id: 'qa',
    title: '2. Quality Assurance (QA)',
    shortDesc: 'Process & System Compliance',
    description: 'Systematic auditing to ensure all assembly procedures comply with IATF 16949 and VDA 6.3 automotive manufacturing guidelines.'
  },
  {
    id: 'zd',
    title: '3. Zero Defects (ZD)',
    shortDesc: 'Right First Time Culture',
    description: 'Prevention-oriented philosophy popularized by Philip Crosby. Uncompromising standard where non-conformance is identified and eliminated at the root cause.'
  },
  {
    id: 'kaizen',
    title: '4. Continuous Improvement (Kaizen)',
    shortDesc: 'Incremental Excellence',
    description: 'Actionable root-cause recommendations generated for every flagged item, refining tooling, assembly jigs, and supplier specifications.'
  },
  {
    id: 'benchmarking',
    title: '5. Benchmarking',
    shortDesc: 'Golden Master Delta',
    description: 'Continuous side-by-side delta analysis comparing current production units directly against the defect-free Reference Model baseline.'
  },
  {
    id: 'reliability',
    title: '6. Reliability Engineering',
    shortDesc: 'MTBF & Durability',
    description: 'Stress testing and lifecycle thermal/vibration fatigue simulation to guarantee 10-year / 200,000 km structural integrity.'
  },
  {
    id: 'standardization',
    title: '7. Standardization',
    shortDesc: 'Reproducible Accuracy',
    description: 'Standard Operating Procedures (SOPs) ensuring that multi-inspector audits yield identical, objective, quantitative metrics.'
  },
  {
    id: 'pdca',
    title: '8. PDCA Improvement Cycle',
    shortDesc: 'Plan - Do - Check - Act',
    description: 'Deming cycle operational workflow closing the loop between defect identification, corrective countermeasure, and standard lock-in.'
  }
];

export const INITIAL_PDCA_TASKS: PDCATask[] = [
  {
    id: 'pdca-1',
    stage: 'Plan',
    title: 'Shut-line Alignment Calipers Calibration',
    description: 'Develop new optical 3D laser gauging fixture for door shutline inspection to eliminate ±0.8mm assembly jig drift.',
    componentId: 'comp-front-left-door',
    assignedRole: 'Metrology Specialist',
    status: 'in_progress',
    timestamp: '2026-11-15'
  },
  {
    id: 'pdca-2',
    stage: 'Do',
    title: 'Subframe Torque-Angle Robot Reprogramming',
    description: 'Update brushless DC nutrunner torque profile to 125 Nm + 45° angle yield monitoring for wishbone bolts.',
    componentId: 'comp-suspension-front',
    assignedRole: 'Robotics Automation Lead',
    status: 'completed',
    timestamp: '2026-11-14'
  },
  {
    id: 'pdca-3',
    stage: 'Check',
    title: 'Ceramic Rotor Surface Oxidation Audit',
    description: 'Sample 50 consecutive carbon-ceramic brake discs post-bedding for ferric oxide micro-pitting in salt-spray test.',
    componentId: 'comp-brakes-front',
    assignedRole: 'Quality Assurance Inspector',
    status: 'in_progress',
    timestamp: '2026-11-15'
  },
  {
    id: 'pdca-4',
    stage: 'Act',
    title: 'Standardize Clearcoat Curing Temperature Profile',
    description: 'Lock in revised 62°C 45-minute infrared curing curve in paint booth SOP-PT-204 to prevent clearcoat micro-scratch vulnerability.',
    componentId: 'comp-front-left-door',
    assignedRole: 'Chief Quality Officer',
    status: 'pending',
    timestamp: '2026-11-15'
  }
];
