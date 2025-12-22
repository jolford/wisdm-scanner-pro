import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import wisdmLogo from '@/assets/wisdm-logo.png';

// Helper to load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
};

// Helper for rounded rectangles
const roundedRect = (doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: 'F' | 'S' | 'FD' = 'F') => {
  doc.roundedRect(x, y, w, h, r, r, style);
};

// Draw geometric pattern background (triangular mesh like reference)
const drawGeometricPattern = (doc: jsPDF, startY: number, height: number, opacity: number = 0.1) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Light blue/cyan background with geometric triangular pattern
  doc.setFillColor(220, 240, 250);
  doc.rect(0, startY, pageWidth, height, 'F');
  
  // Draw subtle triangular mesh pattern
  doc.setDrawColor(180, 210, 230);
  doc.setLineWidth(0.2);
  
  const gridSize = 20;
  for (let x = 0; x < pageWidth + gridSize; x += gridSize) {
    for (let y = startY; y < startY + height; y += gridSize) {
      // Random-ish triangular connections
      if (Math.random() > 0.5) {
        doc.line(x, y, x + gridSize, y + gridSize / 2);
      }
      if (Math.random() > 0.5) {
        doc.line(x, y, x - gridSize / 2, y + gridSize);
      }
    }
  }
};

// Draw workflow arrow
const drawArrow = (doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: number[] = [128, 0, 128]) => {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(1);
  doc.line(x1, y1, x2, y2);
  
  // Arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 4;
  doc.line(x2, y2, x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  doc.line(x2, y2, x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
};

export const ProductBrochurePDFGenerator = () => {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Colors matching the PSIGEN reference brochure
      const purplePrimary = [128, 0, 128]; // Deep purple
      const purpleAccent = [180, 0, 180]; // Lighter purple
      const orangeAccent = [255, 102, 0]; // Orange for highlights
      const grayText = [80, 80, 80];
      const lightGray = [120, 120, 120];

      // Load logo
      let logoBase64: string | null = null;
      try {
        logoBase64 = await loadImageAsBase64(wisdmLogo);
      } catch (e) {
        console.warn('Could not load logo:', e);
      }

      // ========================================
      // PAGE 1: Hero & Architecture
      // ========================================
      
      // Geometric pattern header (like the brain image in reference)
      drawGeometricPattern(doc, 0, 110);
      
      // Hero "brain" visualization area - abstract tech graphic
      doc.setFillColor(30, 144, 255); // Dodger blue
      doc.circle(pageWidth / 2, 50, 35, 'F');
      
      // Lightning bolt/gear icon overlay
      doc.setFillColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(128, 0, 128);
      doc.text('*', pageWidth / 2, 55, { align: 'center' });

      // Main product title with logo styling
      let y = 125;
      
      // Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y - 8, 35, 14);
      }
      
      // Product name with purple accent
      doc.setTextColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.setFontSize(36);
      doc.setFont('helvetica', 'bold');
      doc.text('WISDM', margin + 40, y);
      
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.text('capture', margin + 85, y);
      
      // Version number
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(28);
      doc.text('Pro', margin + 137, y);

      y += 15;
      
      // Tagline
      doc.setTextColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'italic');
      doc.text('Very', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(' Smart Data Capture & Extraction', margin + 12, y);

      y += 20;

      // Main description paragraph
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const introParagraph = "You're already overwhelmed by documents and information. WISDM Capture Pro is the multi-tool we all need. It's the on-ramp that allows you to use tools and programs you already have to make your workflow smooth and efficient. WISDM Capture Pro ingests your paperwork in any form, physical or digital, extracts the information accurately, and moves it to whatever type of electronic filing system you use.";
      const introLines = doc.splitTextToSize(introParagraph, contentWidth);
      doc.text(introLines, margin, y);
      
      y += introLines.length * 5 + 15;

      // Architecture section title
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Architecture of a WISDM Capture Pro solution', margin, y);
      
      y += 10;

      // Architecture diagram boxes
      const boxH = 35;
      const boxW = 50;
      
      // Input sources box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      roundedRect(doc, margin, y, boxW, boxH, 3, 'FD');
      
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Physical', margin + 5, y + 10);
      doc.text('Documents', margin + 5, y + 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Capture Stations', margin + 5, y + 23);
      doc.text('MFP or Networked Scanner', margin + 5, y + 28);
      
      // Emailed documents
      doc.text('Emailed Documents', margin + 5, y + 33);

      // Center processing box (WISDM Capture Pro)
      const centerX = pageWidth / 2 - boxW / 2;
      doc.setFillColor(248, 248, 255);
      roundedRect(doc, centerX, y, boxW, boxH, 3, 'FD');
      
      // Purple lightning icon
      doc.setFillColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.circle(centerX + boxW / 2, y + 12, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text('*', centerX + boxW / 2, y + 15, { align: 'center' });
      
      doc.setTextColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('WISDM', centerX + boxW / 2, y + 25, { align: 'center' });
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.text('capture', centerX + boxW / 2, y + 30, { align: 'center' });

      // Output box (Migrations)
      const rightX = pageWidth - margin - boxW;
      doc.setFillColor(255, 255, 255);
      roundedRect(doc, rightX, y, boxW, boxH, 3, 'FD');
      
      // Orange upload icon
      doc.setFillColor(orangeAccent[0], orangeAccent[1], orangeAccent[2]);
      roundedRect(doc, rightX + boxW / 2 - 8, y + 5, 16, 12, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('^', rightX + boxW / 2, y + 13, { align: 'center' });
      
      doc.setTextColor(orangeAccent[0], orangeAccent[1], orangeAccent[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Migrations', rightX + boxW / 2, y + 24, { align: 'center' });
      
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      const migrateText = doc.splitTextToSize('Migrate to over 60 ECM/DMS platforms or XML export', boxW - 6);
      doc.text(migrateText, rightX + 3, y + 30);

      // Arrows between boxes
      drawArrow(doc, margin + boxW + 5, y + boxH / 2, centerX - 5, y + boxH / 2, purplePrimary);
      drawArrow(doc, centerX + boxW + 5, y + boxH / 2, rightX - 5, y + boxH / 2, purplePrimary);

      // Deployment options above center
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.setFontSize(7);
      doc.text('Workstation    Server', centerX + 5, y - 5);
      doc.text('On-Premise    Cloud    Hybrid', rightX, y - 5);

      // Footer
      doc.setFillColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|', pageWidth / 2 - 20, pageHeight - 4);
      doc.text('sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // ========================================
      // PAGE 2: Capture & Data Extraction
      // ========================================
      doc.addPage();
      
      // Geometric header
      drawGeometricPattern(doc, 0, 25);
      
      // Page header
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'normal');
      doc.text('Work the way you want with WISDM', margin, 18);
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('capture', margin + 97, 18);

      // Subtitle
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Secure. Scalable. High-Performance. Automatic.', pageWidth / 2, 35, { align: 'center' });

      y = 50;

      // The Capture section
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('The Capture in WISDM', margin, y);
      doc.setFont('helvetica', 'bold');
      doc.text('capture', margin + 55, y);

      y += 10;

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const captureText = `We often throw around the word capture—in fact, it's in the product name for a very good reason. "Capture" simply means bringing the items in for processing and extraction. We can intake documents and files with scanners, copiers, monitored folders, other databases and IMAP email folders. Our auto importing feature allows a no-touch solution without lifting a finger.

We want to help you work better with what you have without a lot of hassle. Whether your office is still using that old copier from the 1990s or you're so electronic you don't even have paper, we can be that connection between your systems without the trouble of learning new processes and cumbersome software suites.`;
      const captureLines = doc.splitTextToSize(captureText, contentWidth * 0.55);
      doc.text(captureLines, margin, y);

      y += captureLines.length * 4 + 10;

      // Data, Data, Data section
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('Data, Data, Data', margin, y);

      y += 10;

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const dataText = `If we're honest with ourselves, it's really all about data. It's the new currency of the world. Once we've captured the source of the data, we can pull any information you want from it and check it against a database for verification. Our processors can read and extract information from handwriting, electronic type, metadata, or even those tests/surveys with bubbles you have to fill in.

WISDM Capture Pro's Accelerated Classification Engine (ACE) is a cutting-edge automatic document identification feature that allows users to build Classification rules in the middle of a workflow without breaking stride.`;
      const dataLines = doc.splitTextToSize(dataText, contentWidth * 0.55);
      doc.text(dataLines, margin, y);

      y += dataLines.length * 4 + 15;

      // ACE Workflow boxes
      // Unrecognized document box
      doc.setFillColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      roundedRect(doc, margin, y, 80, 20, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Unrecognized Document', margin + 5, y + 8);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('WISDM Capture ACE Workflow', margin + 5, y + 15);

      // Recognized document box
      doc.setFillColor(200, 200, 200);
      roundedRect(doc, margin, y + 25, 80, 20, 3, 'F');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Recognized Document', margin + 5, y + 33);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('WISDM Capture Automated Workflow', margin + 5, y + 40);

      y += 55;

      // ACE explanation
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      const aceText = `Instead of configuring rules for Classification prior to running the workflow, ACE makes it possible for Knowledge Workers to import never-before-seen documents and simply verify the automatic Classification that ACE has completed during the workflow. With ACE, users can simply validate the Classification and Data Extraction that ACE has intelligibly identified, reducing a process that once took hours to under a minute.`;
      const aceLines = doc.splitTextToSize(aceText, contentWidth);
      doc.text(aceLines, margin, y);

      // Right side graphic - letter cloud (simplified)
      const cloudX = pageWidth - margin - 50;
      doc.setFillColor(245, 245, 250);
      roundedRect(doc, cloudX, 45, 50, 70, 5, 'F');
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(8);
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      for (let i = 0; i < 40; i++) {
        const char = letters[Math.floor(Math.random() * letters.length)];
        const lx = cloudX + 5 + Math.random() * 40;
        const ly = 50 + Math.random() * 60;
        doc.text(char, lx, ly);
      }

      // Footer
      doc.setFillColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|', pageWidth / 2 - 20, pageHeight - 4);
      doc.text('sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // ========================================
      // PAGE 3: Workflow & Integrations
      // ========================================
      doc.addPage();
      
      // Geometric header
      drawGeometricPattern(doc, 0, 25);
      
      // Page header
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'normal');
      doc.text('Work the way you want with WISDM', margin, 18);
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('capture', margin + 97, 18);

      y = 40;

      // Let Our Workflow Do the Work
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('Let Our Workflow Do the Work', margin, y);

      y += 12;

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const workflowText = `Automation is a big deal to us. We want you to be able to focus on the important tasks and projects, not the tedious ones that are time consuming. With features like ACE and our Workflow setup, we can automate your processes so no one has to touch anything.

Part of our automation is our Workflow setup. The "workflow" determines the path we take your document(s) on. For example, one workflow can be to capture/import the document, perform OCR, identify the document/form, extract the information, pass it by Quality Assurance for verification, and migrate to basically anywhere. Once the workflow is setup, just let it go and we'll take it from there.`;
      const workflowLines = doc.splitTextToSize(workflowText, contentWidth * 0.55);
      doc.text(workflowLines, margin, y);

      y += workflowLines.length * 4 + 15;

      // Information discovery callout
      doc.setFillColor(248, 248, 255);
      roundedRect(doc, margin, y, contentWidth * 0.55, 35, 4, 'F');
      
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Information Just Waiting', margin + 10, y + 12);
      doc.text('to be Discovered.', margin + 10, y + 20);
      
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Your documents are actionable business intelligence.', margin + 10, y + 28);
      doc.text('Harness it with WISDM Capture Pro.', margin + 10, y + 33);

      y += 50;

      // Data Where You Need It
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('Data Where You Need It.', margin, y);

      y += 12;

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      const destinationText = `Whether you're capturing data for the first time or wanting to move documents from one spot to another, our software can get you there. With over 60+ ECM and file/folder types to choose from, integrating into your office ecosystem is easy. 

We can move files to ECMs like Microsoft SharePoint, DocuWare, and OnBase, just to name a few. Or if you just need it put into a folder on your company server, we can do that too. We can even email the documents to someone after processing for further follow-up.`;
      const destLines = doc.splitTextToSize(destinationText, contentWidth * 0.55);
      doc.text(destLines, margin, y);

      // Right side - Sample Workflow diagram
      const diagX = pageWidth - margin - 55;
      let diagY = 45;
      
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Sample WISDM', diagX, diagY);
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('capture', diagX + 33, diagY);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(' Workflow', diagX + 52, diagY);

      diagY += 15;

      // Workflow step boxes
      const steps = [
        { label: 'Ingest', icon: '@', color: purplePrimary },
        { label: 'OCR', icon: 'Ab', color: [200, 100, 50] },
        { label: 'Classify', icon: '*', color: [200, 50, 100] },
        { label: 'Index', icon: '#', color: [100, 50, 150] },
        { label: 'QA', icon: '✓', color: [50, 150, 50] },
        { label: 'Migrate', icon: '^', color: orangeAccent }
      ];

      steps.forEach((step, i) => {
        const stepY = diagY + i * 22;
        
        // Icon box
        doc.setFillColor(step.color[0], step.color[1], step.color[2]);
        roundedRect(doc, diagX, stepY, 15, 15, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(step.icon, diagX + 7.5, stepY + 10, { align: 'center' });
        
        // Label
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        doc.setFontSize(9);
        doc.text(step.label, diagX + 20, stepY + 10);
        
        // Connecting line
        if (i < steps.length - 1) {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.line(diagX + 7.5, stepY + 15, diagX + 7.5, stepY + 22);
        }
      });

      // Your data on tap callout
      const tapY = diagY + steps.length * 22 + 10;
      doc.setFillColor(240, 248, 255);
      roundedRect(doc, diagX - 5, tapY, 60, 30, 3, 'F');
      
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Your data, on tap.', diagX, tapY + 12);
      
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Migrate to almost any', diagX, tapY + 20);
      doc.text('EDM, HRIS, ECM, HCM', diagX, tapY + 25);

      // Footer
      doc.setFillColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|', pageWidth / 2 - 20, pageHeight - 4);
      doc.text('sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // ========================================
      // PAGE 4: Selected Features & About
      // ========================================
      doc.addPage();
      
      // Geometric header
      drawGeometricPattern(doc, 0, 25);
      
      // Page header
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'normal');
      doc.text('WISDM', margin, 18);
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('capture', margin + 30, 18);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFont('helvetica', 'normal');
      doc.text(' Selected Features', margin + 60, 18);

      y = 38;

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('To companies needing more complex workflows, WISDM Capture Pro offers a number of features to enhance and', margin, y);
      doc.text('accelerate important business data processing. These powerhouse features include:', margin, y + 5);

      y += 18;

      // Features list
      const features = [
        {
          title: 'Multi-Core OCR',
          icon: '#',
          color: purplePrimary,
          desc: 'Optical Character Recognition (OCR) allows a computer to read and recognize printed text at blinding speeds. With our High-Performance OCR, you can pump up the volume and use up to 16 cores for OCR capability. Organizations can realize text reading boosts up to 12X normal when OCR is utilized in a workflow.'
        },
        {
          title: 'Classification',
          icon: '*',
          color: [200, 50, 100],
          desc: 'Never again separate your documents before scanning them if you want. Most of the time, WISDM Capture Pro can be trained to automatically identify and separate documents, negating the need for pre-scan separation—a HUGE time waster!'
        },
        {
          title: 'eMail Capture',
          icon: '@',
          color: purpleAccent,
          desc: 'Companies can effortlessly have emails and their attachments automatically ingested, processed, and migrated to any number of final destinations. Super-simple to set up for administrators, and no end-user training required.'
        },
        {
          title: 'Table Extraction',
          icon: '=',
          color: [100, 50, 150],
          desc: 'Want your software to automatically identify rows and columns in documents? We can teach WISDM Capture Pro to extract each row as an individual record and post it to any number of places, including a database or an accounting system.'
        },
        {
          title: 'WISDM Capture Fusion',
          icon: '+',
          color: orangeAccent,
          desc: 'Our HTML5-friendly, team-driven Indexing and Quality Assurance solution. For really large teams of people needing to work together, or far-flung teams with assets on the go, this is a great way to assure documents get processed quickly.'
        }
      ];

      features.forEach((feature) => {
        // Icon
        doc.setFillColor(feature.color[0], feature.color[1], feature.color[2]);
        roundedRect(doc, margin, y, 15, 15, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(feature.icon, margin + 7.5, y + 10, { align: 'center' });
        
        // Title
        doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
        doc.setFontSize(11);
        doc.text(feature.title, margin + 20, y + 6);
        
        // Description
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(feature.desc, contentWidth - 25);
        doc.text(descLines, margin + 20, y + 12);
        
        y += 8 + descLines.length * 4 + 8;
      });

      y += 5;

      // Software & Hardware Requirements
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Software & Hardware Requirements', margin, y);

      y += 8;

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('For more information on the requirements for running WISDM Capture Pro, please visit our Support Portal at', margin, y);
      
      doc.setTextColor(59, 130, 246);
      doc.text('https://support.westint.com', margin, y + 5);

      y += 18;

      // About section
      doc.setTextColor(purpleAccent[0], purpleAccent[1], purpleAccent[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('About Western Integrated Systems', margin, y);

      y += 8;

      // Company logo placeholder
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y, 25, 10);
      }

      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const aboutText = `Unleash the power of your people by eliminating data entry with business automation technology from Western Integrated Systems. Implemented by a global network of integrators, WISDM paves the way for your digital transformation: on-ramp your information from paper and email attachments with WISDM Capture Pro advanced capture software; automate workflows with WISDM document management software; integrate these documents so they are available and searchable in software you use daily (ERP, CRM, HCM); and make better decisions faster as a result – with a positive ROI faster than you may think. Work the way you want, let technology do the rest.`;
      const aboutLines = doc.splitTextToSize(aboutText, contentWidth - 30);
      doc.text(aboutLines, margin + 30, y + 4);

      // Footer
      doc.setFillColor(purplePrimary[0], purplePrimary[1], purplePrimary[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|', pageWidth / 2 - 20, pageHeight - 4);
      doc.text('sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // Save PDF
      doc.save('WISDM-Capture-Pro-Product-Brochure.pdf');
      toast.success('Product brochure downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Product Brochure
        </CardTitle>
        <CardDescription>
          Download a professional 4-page product brochure for WISDM Capture Pro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>The brochure includes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Product overview and architecture diagram</li>
            <li>Data capture and extraction capabilities</li>
            <li>ACE (Accelerated Classification Engine)</li>
            <li>Workflow automation features</li>
            <li>Integration destinations (60+ ECM/DMS platforms)</li>
            <li>Selected features (Multi-Core OCR, Classification, Email Capture, Table Extraction)</li>
            <li>Company information</li>
          </ul>
        </div>
        <Button onClick={generatePDF} disabled={generating} className="w-full">
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Product Brochure
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
