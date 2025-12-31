import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import lucidDocsLogo from '@/assets/luciddocs-logo.png';

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

// Draw workflow arrow
const drawArrow = (doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: number[] = [59, 130, 246]) => {
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

      // Colors matching your design system (HSL converted to RGB)
      // Primary: 217 91% 60% = rgb(59, 130, 246)
      // Foreground: 222 47% 11% = rgb(15, 23, 42)
      // Muted foreground: 215 16% 47% = rgb(100, 116, 139)
      // Success: 142 71% 45% = rgb(34, 197, 94)
      // Warning: 38 92% 50% = rgb(245, 158, 11)
      // Info: 199 89% 48% = rgb(14, 165, 233)
      const primaryBlue = [59, 130, 246];
      const darkBlue = [30, 64, 175]; // Darker shade for headers
      const slateGray = [15, 23, 42]; // Foreground text
      const mutedGray = [100, 116, 139]; // Muted text
      const lightSlate = [241, 245, 249]; // Light background
      const successGreen = [34, 197, 94];
      const warningOrange = [245, 158, 11];

      // Load logo
      let logoBase64: string | null = null;
      try {
        logoBase64 = await loadImageAsBase64(lucidDocsLogo);
      } catch (e) {
        console.warn('Could not load logo:', e);
      }

      // ========================================
      // PAGE 1: Hero & Architecture
      // ========================================
      
      // Clean header background
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, 0, pageWidth, 70, 'F');
      
      // Accent line
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(0, 68, pageWidth, 4, 'F');

      // Logo with white background for visibility
      if (logoBase64) {
        doc.setFillColor(255, 255, 255);
        roundedRect(doc, margin - 2, 8, 50, 22, 3, 'F');
        doc.addImage(logoBase64, 'PNG', margin, 10, 46, 18);
      }
      
      // Main title in header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('WISDM Capture Pro', margin + 52, 22);
      
      // Subtitle
      doc.setTextColor(147, 197, 253); // Light blue
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Very Smart Data Capture & Extraction', margin + 52, 30);

      // Hero tagline
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Transform Your Document Processing', margin, 52);

      let y = 85;

      // Main description paragraph
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const introParagraph = "You're already overwhelmed by documents and information. WISDM Capture Pro is the multi-tool we all need. It's the on-ramp that allows you to use tools and programs you already have to make your workflow smooth and efficient. WISDM Capture Pro ingests your paperwork in any form, physical or digital, extracts the information accurately, and moves it to whatever type of electronic filing system you use.";
      const introLines = doc.splitTextToSize(introParagraph, contentWidth);
      doc.text(introLines, margin, y);
      
      y += introLines.length * 5 + 15;

      // Architecture section title
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Architecture of a WISDM Capture Pro Solution', margin, y);
      
      // Accent underline
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 80, 2, 'F');
      
      y += 15;

      // Architecture diagram boxes
      const boxH = 40;
      const boxW = 52;
      
      // Input sources box
      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      roundedRect(doc, margin, y, boxW, boxH, 3, 'FD');
      
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Physical Documents', margin + 5, y + 10);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Capture Stations', margin + 5, y + 18);
      doc.text('MFP or Networked Scanner', margin + 5, y + 24);
      doc.text('Emailed Documents', margin + 5, y + 32);

      // Center processing box (WISDM Capture Pro)
      const centerX = pageWidth / 2 - boxW / 2;
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      roundedRect(doc, centerX, y, boxW, boxH, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('WISDM', centerX + boxW / 2, y + 15, { align: 'center' });
      doc.text('Capture Pro', centerX + boxW / 2, y + 22, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Server manages batch', centerX + boxW / 2, y + 30, { align: 'center' });
      doc.text('database, images & metadata', centerX + boxW / 2, y + 35, { align: 'center' });

      // Output box (Migrations)
      const rightX = pageWidth - margin - boxW;
      doc.setFillColor(successGreen[0], successGreen[1], successGreen[2]);
      roundedRect(doc, rightX, y, boxW, boxH, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Migrations', rightX + boxW / 2, y + 15, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Migrate to over 60', rightX + boxW / 2, y + 24, { align: 'center' });
      doc.text('ECM/DMS platforms', rightX + boxW / 2, y + 30, { align: 'center' });
      doc.text('or XML export', rightX + boxW / 2, y + 36, { align: 'center' });

      // Arrows between boxes
      drawArrow(doc, margin + boxW + 5, y + boxH / 2, centerX - 5, y + boxH / 2, primaryBlue);
      drawArrow(doc, centerX + boxW + 5, y + boxH / 2, rightX - 5, y + boxH / 2, primaryBlue);

      // Deployment options labels
      doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
      doc.setFontSize(7);
      doc.text('Workstation | Server', centerX + 5, y - 5);
      doc.text('On-Premise | Cloud | Hybrid', rightX, y - 5);

      // Footer
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|  sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // ========================================
      // PAGE 2: Capture & Data Extraction
      // ========================================
      doc.addPage();
      
      // Page header bar
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(0, 28, pageWidth, 3, 'F');
      
      // Page header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text('Work the way you want with WISDM Capture Pro', margin, 20);

      // Subtitle
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Secure. Scalable. High-Performance. Automatic.', pageWidth / 2, 42, { align: 'center' });

      y = 55;

      // The Capture section
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('The Capture in WISDM Capture Pro', margin, y);
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 65, 2, 'F');

      y += 12;

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const captureText = "We often throw around the word capture - in fact, it is in the product name for a very good reason. Capture simply means bringing the items in for processing and extraction. We can intake documents and files with scanners, copiers, monitored folders, other databases and IMAP email folders. Our auto importing feature allows a no-touch solution without lifting a finger.\n\nWe want to help you work better with what you have without a lot of hassle. Whether your office is still using that old copier from the 1990s or you are so electronic you do not even have paper, we can be that connection between your systems without the trouble of learning new processes and cumbersome software suites.";
      const captureLines = doc.splitTextToSize(captureText, contentWidth * 0.58);
      doc.text(captureLines, margin, y);

      y += captureLines.length * 4 + 10;

      // Data, Data, Data section
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Data, Data, Data', margin, y);
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 35, 2, 'F');

      y += 12;

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const dataText = "If we are honest with ourselves, it is really all about data. It is the new currency of the world. Once we have captured the source of the data, we can pull any information you want from it and check it against a database for verification. Our processors can read and extract information from handwriting, electronic type, metadata, or even those tests and surveys with bubbles you have to fill in.\n\nWISDM Capture Pro's Accelerated Classification Engine (ACE) is a cutting-edge automatic document identification feature that allows users to build Classification rules in the middle of a workflow without breaking stride.";
      const dataLines = doc.splitTextToSize(dataText, contentWidth * 0.58);
      doc.text(dataLines, margin, y);

      y += dataLines.length * 4 + 12;

      // ACE Workflow boxes
      // Unrecognized document box
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      roundedRect(doc, margin, y, 85, 18, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Unrecognized Document', margin + 5, y + 8);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('WISDM Capture ACE Workflow', margin + 5, y + 14);

      // Recognized document box
      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      doc.setDrawColor(200, 200, 200);
      roundedRect(doc, margin, y + 22, 85, 18, 3, 'FD');
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Recognized Document', margin + 5, y + 30);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('WISDM Capture Automated Workflow', margin + 5, y + 36);

      y += 50;

      // ACE explanation
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      const aceText = "Instead of configuring rules for Classification prior to running the workflow, ACE makes it possible for Knowledge Workers to import never-before-seen documents and simply verify the automatic Classification that ACE has completed during the workflow. With ACE, users can simply validate the Classification and Data Extraction that ACE has intelligently identified, reducing a process that once took hours to under a minute.";
      const aceLines = doc.splitTextToSize(aceText, contentWidth);
      doc.text(aceLines, margin, y);

      // Right side info box
      const infoBoxX = pageWidth - margin - 55;
      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      roundedRect(doc, infoBoxX, 50, 55, 80, 4, 'F');
      
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Benefits', infoBoxX + 5, 62);
      
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const benefits = ['Multi-source capture', 'Advanced OCR', 'Auto classification', 'Data validation', 'Workflow automation', 'Real-time processing'];
      benefits.forEach((b, i) => {
        doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
        doc.circle(infoBoxX + 8, 72 + i * 10, 1.5, 'F');
        doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
        doc.text(b, infoBoxX + 12, 73 + i * 10);
      });

      // Footer
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|  sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // ========================================
      // PAGE 3: Workflow & Integrations
      // ========================================
      doc.addPage();
      
      // Page header bar
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(0, 28, pageWidth, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text('Work the way you want with WISDM Capture Pro', margin, 20);

      y = 45;

      // Let Our Workflow Do the Work
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Let Our Workflow Do the Work', margin, y);
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 55, 2, 'F');

      y += 12;

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const workflowText = "Automation is a big deal to us. We want you to be able to focus on the important tasks and projects, not the tedious ones that are time consuming. With features like ACE and our Workflow setup, we can automate your processes so no one has to touch anything.\n\nPart of our automation is our Workflow setup. The workflow determines the path we take your documents on. For example, one workflow can be to capture and import the document, perform OCR, identify the document and form, extract the information, pass it by Quality Assurance for verification, and migrate to basically anywhere. Once the workflow is setup, just let it go and we will take it from there.";
      const workflowLines = doc.splitTextToSize(workflowText, contentWidth * 0.55);
      doc.text(workflowLines, margin, y);

      y += workflowLines.length * 4 + 15;

      // Information discovery callout
      doc.setFillColor(239, 246, 255); // Light blue bg
      roundedRect(doc, margin, y, contentWidth * 0.55, 35, 4, 'F');
      doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setLineWidth(0.5);
      roundedRect(doc, margin, y, contentWidth * 0.55, 35, 4, 'S');
      
      doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Information Just Waiting', margin + 10, y + 12);
      doc.text('to be Discovered.', margin + 10, y + 20);
      
      doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Your documents are actionable business intelligence.', margin + 10, y + 28);
      doc.text('Harness it with WISDM Capture Pro.', margin + 10, y + 33);

      y += 45;

      // Data Where You Need It
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Data Where You Need It', margin, y);
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 45, 2, 'F');

      y += 12;

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const destinationText = "Whether you are capturing data for the first time or wanting to move documents from one spot to another, our software can get you there. With over 60 ECM and file or folder types to choose from, integrating into your office ecosystem is easy.\n\nWe can move files to ECMs like Microsoft SharePoint, DocuWare, and OnBase, just to name a few. Or if you just need it put into a folder on your company server, we can do that too. We can even email the documents to someone after processing for further follow-up.";
      const destLines = doc.splitTextToSize(destinationText, contentWidth * 0.55);
      doc.text(destLines, margin, y);

      // Right side - Sample Workflow diagram
      const diagX = pageWidth - margin - 60;
      let diagY = 45;
      
      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Sample Workflow', diagX, diagY);

      diagY += 12;

      // Workflow step boxes
      const steps = [
        { label: 'Ingest', color: primaryBlue },
        { label: 'OCR', color: [14, 165, 233] }, // Info blue
        { label: 'Classify', color: [139, 92, 246] }, // Violet
        { label: 'Index', color: [168, 85, 247] }, // Purple
        { label: 'QA', color: successGreen },
        { label: 'Migrate', color: warningOrange }
      ];

      steps.forEach((step, i) => {
        const stepY = diagY + i * 22;
        
        // Icon box
        doc.setFillColor(step.color[0], step.color[1], step.color[2]);
        roundedRect(doc, diagX, stepY, 50, 16, 2, 'F');
        
        // Label
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(step.label, diagX + 25, stepY + 10, { align: 'center' });
        
        // Connecting line
        if (i < steps.length - 1) {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(1);
          doc.line(diagX + 25, stepY + 16, diagX + 25, stepY + 22);
        }
      });

      // Your data on tap callout
      const tapY = diagY + steps.length * 22 + 8;
      doc.setFillColor(lightSlate[0], lightSlate[1], lightSlate[2]);
      roundedRect(doc, diagX - 5, tapY, 60, 28, 3, 'F');
      
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Your data, on tap.', diagX, tapY + 10);
      
      doc.setTextColor(mutedGray[0], mutedGray[1], mutedGray[2]);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Migrate to almost any EDM,', diagX, tapY + 18);
      doc.text('HRIS, ECM, HCM or LOB system.', diagX, tapY + 24);

      // Footer
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|  sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

      // ========================================
      // PAGE 4: Selected Features & About
      // ========================================
      doc.addPage();
      
      // Page header bar
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(0, 28, pageWidth, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text('WISDM Capture Pro Selected Features', margin, 20);

      y = 42;

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('To companies needing more complex workflows, WISDM Capture Pro offers a number of features to enhance and', margin, y);
      doc.text('accelerate important business data processing. These powerhouse features include:', margin, y + 5);

      y += 18;

      // Features list
      const features = [
        {
          title: 'Multi-Core OCR',
          color: primaryBlue,
          desc: 'Optical Character Recognition allows a computer to read and recognize printed text at blinding speeds. With our High-Performance OCR, you can use up to 16 cores for OCR capability. Organizations can realize text reading boosts up to 12X normal when OCR is utilized in a workflow.'
        },
        {
          title: 'Classification',
          color: [139, 92, 246],
          desc: 'Never again separate your documents before scanning them if you want. Most of the time, WISDM Capture Pro can be trained to automatically identify and separate documents, negating the need for pre-scan separation - a HUGE time waster!'
        },
        {
          title: 'eMail Capture',
          color: [14, 165, 233],
          desc: 'Companies can effortlessly have emails and their attachments automatically ingested, processed, and migrated to any number of final destinations. Super-simple to set up for administrators, and no end-user training required.'
        },
        {
          title: 'Table Extraction',
          color: [168, 85, 247],
          desc: 'Want your software to automatically identify rows and columns in documents? We can teach WISDM Capture Pro to extract each row as an individual record and post it to any number of places, including a database or an accounting system.'
        },
        {
          title: 'WISDM Capture Fusion',
          color: successGreen,
          desc: 'Our HTML5-friendly, team-driven Indexing and Quality Assurance solution. For really large teams of people needing to work together, or far-flung teams with assets on the go, this is a great way to assure documents get processed quickly.'
        }
      ];

      features.forEach((feature) => {
        // Colored sidebar
        doc.setFillColor(feature.color[0], feature.color[1], feature.color[2]);
        doc.rect(margin, y - 2, 3, 20, 'F');
        
        // Title
        doc.setTextColor(feature.color[0], feature.color[1], feature.color[2]);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(feature.title, margin + 8, y + 3);
        
        // Description
        doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(feature.desc, contentWidth - 12);
        doc.text(descLines, margin + 8, y + 10);
        
        y += 12 + descLines.length * 4;
      });

      y += 8;

      // Software & Hardware Requirements
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Software & Hardware Requirements', margin, y);
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 60, 2, 'F');

      y += 10;

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('For more information on the requirements for running WISDM Capture Pro, please visit our Support Portal at', margin, y);
      
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('https://support.westint.com', margin, y + 5);

      y += 15;

      // About section
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('About Western Integrated Systems', margin, y);
      doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.rect(margin, y + 3, 55, 2, 'F');

      y += 12;

      // Company logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, y - 2, 25, 10);
      }

      doc.setTextColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const aboutText = "Unleash the power of your people by eliminating data entry with business automation technology from Western Integrated Systems. Implemented by a global network of integrators, WISDM paves the way for your digital transformation: on-ramp your information from paper and email attachments with WISDM Capture Pro advanced capture software; automate workflows with WISDM document management software; integrate these documents so they are available and searchable in software you use daily (ERP, CRM, HCM); and make better decisions faster as a result - with a positive ROI faster than you may think. Work the way you want, let technology do the rest.";
      const aboutLines = doc.splitTextToSize(aboutText, contentWidth - 32);
      doc.text(aboutLines, margin + 30, y + 2);

      // Footer
      doc.setFillColor(slateGray[0], slateGray[1], slateGray[2]);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('www.westint.com', margin, pageHeight - 4);
      doc.text('|  sales@westint.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

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
