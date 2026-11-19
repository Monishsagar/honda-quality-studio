import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TQMReport } from '../types/tqm';

export function exportTQMReportPDF(report: TQMReport) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Colors
  const darkNavy = [11, 17, 30] as [number, number, number];
  const accentBlue = [56, 189, 248] as [number, number, number];
  const gold = [245, 158, 11] as [number, number, number];
  const emerald = [16, 185, 129] as [number, number, number];
  const crimson = [239, 68, 68] as [number, number, number];

  // Header Background Banner
  doc.setFillColor(...darkNavy);
  doc.rect(0, 0, 210, 42, 'F');

  // Accent Line
  doc.setFillColor(...accentBlue);
  doc.rect(0, 42, 210, 2, 'F');

  // Brand Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('HONDA AUTOMOTIVE QUALITY METROLOGY', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 220, 240);
  doc.text('TOTAL QUALITY MANAGEMENT (TQM) CERTIFICATION AUDIT REPORT', 14, 25);
  doc.text(`Certificate No: ${report.reportNumber}  |  Issued: ${report.timestamp}`, 14, 32);

  // Score Badge in Header right
  doc.setFillColor(25, 33, 50);
  doc.roundedRect(155, 8, 42, 26, 3, 3, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 220);
  doc.text('OVERALL SCORE', 160, 15);
  
  const scoreColor = report.overallScore >= 90 ? emerald : report.overallScore >= 75 ? accentBlue : report.overallScore >= 60 ? gold : crimson;
  doc.setTextColor(...scoreColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.overallScore}/100`, 160, 24);

  doc.setFontSize(7);
  doc.text(report.overallGrade.toUpperCase().replace('_', ' '), 160, 30);

  // Section 1: Vehicle & Audit Metadata
  let currentY = 52;
  doc.setTextColor(20, 25, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. AUDITED VEHICLE & INSPECTION METADATA', 14, currentY);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: darkNavy, textColor: 255 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 45 },
      1: { cellWidth: 50 },
      2: { fontStyle: 'bold', fillColor: [245, 247, 250], cellWidth: 45 },
      3: { cellWidth: 50 }
    },
    body: [
      ['Vehicle Model:', report.vehicle.name, 'VIN Serial Number:', report.vehicle.vin],
      ['Manufacturer / Brand:', report.vehicle.brand, 'Vehicle Category:', report.vehicle.category],
      ['Manufacturing Year:', `${report.vehicle.year}`, 'Lead Metrology Auditor:', report.inspectorName],
      ['Auditing Facility:', report.facility, 'Standard Operating Model:', 'TQM Zero-Defects (IATF 16949)']
    ]
  });

  // Section 2: Domain-Level Quality Scores
  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. FIVE-DOMAIN TQM AGGREGATED QUALITY SCORES', 14, currentY);

  const domainTableRows = report.domainScores.map(d => [
    d.label,
    `${(d.weight * 100).toFixed(0)}%`,
    `${d.score}/100`,
    `${d.passedCount} Pass / ${d.warningCount} Warn / ${d.failedCount} Fail`,
    d.score >= 90 ? 'Class A (Optimal)' : d.score >= 75 ? 'Class B (Minor Var)' : d.score >= 60 ? 'Class C (Action Needed)' : 'Class D (Critical Non-conf.)'
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    head: [['Inspection Domain', 'TQM Weight', 'Score', 'Component Stats', 'Quality Classification']],
    body: domainTableRows
  });

  // Section 3: Non-conformances & Detected Defects
  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. IDENTIFIED NON-CONFORMANCES & ZERO-DEFECT DEFICITS', 14, currentY);

  if (report.detectedDefects.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(16, 185, 129);
    doc.text('✓ ZERO DEFECTS DETECTED. Vehicle fully conforms to pristine Golden Master reference specification.', 14, currentY + 6);
    currentY += 12;
  } else {
    const defectRows = report.detectedDefects.map(d => [
      d.name,
      d.type.toUpperCase(),
      d.severity.toUpperCase(),
      d.affectedParameter,
      `-${d.scoreDeduction} pts`,
      d.description
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [185, 28, 28], textColor: 255 },
      head: [['Defect Name', 'Type', 'Severity', 'Affected Parameter', 'Score Impact', 'Technical Description']],
      body: defectRows
    });
    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need page break
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  // Section 4: Continuous Improvement (Kaizen) & PDCA Recommendations
  doc.setTextColor(20, 25, 35);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. CONTINUOUS IMPROVEMENT (KAIZEN) & PDCA CORRECTIVE ACTIONS', 14, currentY);

  const kaizenRows = report.kaizenRecommendations.length > 0 
    ? report.kaizenRecommendations.map(k => [
        k.componentName,
        k.defect,
        k.severity.toUpperCase(),
        k.pdcaStage,
        k.recommendation
      ])
    : [['All Systems', 'None', 'NOMINAL', 'Act', 'Maintain scheduled preventative maintenance and standard tooling calibrations.']];

  autoTable(doc, {
    startY: currentY + 4,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    head: [['Component', 'Issue', 'Severity', 'PDCA Stage', 'Actionable Corrective Countermeasure']],
    body: kaizenRows
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 10;
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  // Section 5: Standards Compliance & Digital Seal
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. TQM STANDARDS COMPLIANCE & LEGAL CERTIFICATION', 14, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 70, 85);
  report.standardsComplied.forEach((std, i) => {
    doc.text(`• ${std}`, 16, currentY + 6 + (i * 4.5));
  });

  currentY += 6 + (report.standardsComplied.length * 4.5) + 6;

  // Digital Signature Box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, currentY, 182, 22, 2, 2, 'F');
  doc.rect(14, currentY, 182, 22, 'S');

  doc.setFontSize(7.5);
  doc.setTextColor(30, 40, 50);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFIED METROLOGY DIGITAL STAMP & INTEGRITY RECORD:', 18, currentY + 6);
  doc.setFont('courier', 'normal');
  doc.text(`Digital Verification Hash: ${report.certificateHash}`, 18, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Authorized by: Kenji Takahashi, CQE  |  Honda Quality Metrology Board  |  Valid: Worldwide`, 18, currentY + 17);

  // Save the PDF
  doc.save(`${report.vehicle.name.replace(/\s+/g, '_')}_TQM_Quality_Report.pdf`);
}
