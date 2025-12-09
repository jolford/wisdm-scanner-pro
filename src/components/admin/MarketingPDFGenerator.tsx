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

export const MarketingPDFGenerator = () => {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      // Load logo
      let logoBase64: string | null = null;
      try {
        logoBase64 = await loadImageAsBase64(wisdmLogo);
      } catch (e) {
        console.warn('Could not load logo:', e);
      }

      // Header with white background for logo visibility
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      // Add logo if loaded
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, 8, 50, 18);
      }
      
      // Header text next to logo
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Capture Pro', margin + 55, 20);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Enterprise Document Capture & AI Processing Platform', margin + 55, 28);
      
      // Blue accent bar under header
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 48, pageWidth, 4, 'F');

      y = 65;

      // Tagline
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Transform Your Document Processing with AI', margin, y);
      y += 15;

      // Key Stats Banner
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 25, 'F');
      
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      
      const stats = [
        { value: '40%', label: 'Faster Processing' },
        { value: '99.5%', label: 'Accuracy Rate' },
        { value: '60%', label: 'Cost Reduction' },
        { value: '24/7', label: 'Automation' }
      ];
      
      const statWidth = contentWidth / 4;
      stats.forEach((stat, i) => {
        const x = margin + (statWidth * i) + (statWidth / 2);
        doc.setFontSize(14);
        doc.text(stat.value, x, y + 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(stat.label, x, y + 18, { align: 'center' });
        doc.setFont('helvetica', 'bold');
      });
      
      y += 35;

      // Core Features Section
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Core Capabilities', margin, y);
      y += 8;

      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + 40, y);
      y += 10;

      const features = [
        {
          title: 'AI-Powered OCR',
          desc: 'Google Gemini & OpenAI GPT-5 for industry-leading extraction accuracy'
        },
        {
          title: 'Smart Document Routing',
          desc: 'Automatic classification and routing based on confidence thresholds'
        },
        {
          title: 'Multi-Language Support',
          desc: 'Process documents in 50+ languages with native accuracy'
        },
        {
          title: 'Batch Processing',
          desc: 'Process thousands of documents with parallel OCR optimization'
        },
        {
          title: 'Zonal Extraction',
          desc: 'Template-based extraction for structured document types'
        },
        {
          title: 'Validation Workflows',
          desc: 'Configurable validation rules with exception handling'
        }
      ];

      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      
      features.forEach(feature => {
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${feature.title}`, margin + 5, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`  ${feature.desc}`, margin + 8, y + 5);
        y += 14;
      });

      y += 5;

      // Integration Section
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Enterprise Integrations', margin, y);
      y += 8;
      doc.line(margin, y, margin + 50, y);
      y += 10;

      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const integrations = [
        'SharePoint & OneDrive',
        'FileBound ECM',
        'Resware (Mortgage)',
        'Documentum',
        'Custom Webhooks',
        'REST API Access'
      ];

      const intCol1 = integrations.slice(0, 3);
      const intCol2 = integrations.slice(3);

      intCol1.forEach((int, i) => {
        doc.text(`[+] ${int}`, margin + 5, y + (i * 6));
      });
      intCol2.forEach((int, i) => {
        doc.text(`[+] ${int}`, margin + 80, y + (i * 6));
      });

      y += 25;

      // Security Section
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Enterprise Security', margin, y);
      y += 8;
      doc.line(margin, y, margin + 45, y);
      y += 10;

      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const security = [
        'SOC 2 Ready Infrastructure',
        'AES-256-GCM Encryption',
        'Row-Level Security (RLS)',
        'Multi-Factor Authentication',
        'Complete Audit Trail',
        'HIPAA Compliant Design'
      ];

      const secCol1 = security.slice(0, 3);
      const secCol2 = security.slice(3);

      secCol1.forEach((sec, i) => {
        doc.text(`[*] ${sec}`, margin + 5, y + (i * 6));
      });
      secCol2.forEach((sec, i) => {
        doc.text(`[*] ${sec}`, margin + 80, y + (i * 6));
      });

      // New Page - Use Cases & Pricing
      doc.addPage();
      y = 20;

      // Header on second page
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Industry Solutions & Pricing', margin, 20);

      y = 45;

      // Use Cases
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Industry Solutions', margin, y);
      y += 8;
      doc.line(margin, y, margin + 45, y);
      y += 12;

      const useCases = [
        {
          industry: 'Title & Escrow',
          benefits: 'AB 1466 compliance, deed processing, automated redaction'
        },
        {
          industry: 'Mortgage & Lending',
          benefits: 'Loan document extraction, Resware integration, compliance checks'
        },
        {
          industry: 'Healthcare',
          benefits: 'HIPAA-compliant processing, medical records, PII redaction'
        },
        {
          industry: 'Legal Services',
          benefits: 'Contract analysis, discovery processing, signature validation'
        },
        {
          industry: 'Accounts Payable',
          benefits: 'Invoice processing, PO matching, vendor management'
        }
      ];

      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);

      useCases.forEach(uc => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${uc.industry}:`, margin + 5, y);
        doc.setFont('helvetica', 'normal');
        doc.text(uc.benefits, margin + 45, y);
        y += 8;
      });

      y += 15;

      // Pricing Tiers
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Pricing Plans', margin, y);
      y += 8;
      doc.line(margin, y, margin + 35, y);
      y += 12;

      const tiers = [
        {
          name: 'Starter',
          price: '$499/mo',
          docs: '5,000 docs/mo',
          features: '3 projects, Email support'
        },
        {
          name: 'Professional',
          price: '$999/mo',
          docs: '25,000 docs/mo',
          features: '10 projects, Priority support, API access'
        },
        {
          name: 'Business',
          price: '$2,499/mo',
          docs: '100,000 docs/mo',
          features: 'Unlimited projects, SSO, Custom integrations'
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          docs: 'Unlimited',
          features: 'Dedicated support, SLA, White-label option'
        }
      ];

      const tierWidth = contentWidth / 4;
      
      tiers.forEach((tier, i) => {
        const x = margin + (tierWidth * i);
        
        // Tier box
        doc.setFillColor(i === 2 ? 30 : 241, i === 2 ? 58 : 245, i === 2 ? 138 : 249);
        doc.rect(x, y, tierWidth - 5, 45, 'F');
        
        doc.setTextColor(i === 2 ? 255 : 30, i === 2 ? 255 : 58, i === 2 ? 255 : 138);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(tier.name, x + (tierWidth - 5) / 2, y + 10, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text(tier.price, x + (tierWidth - 5) / 2, y + 20, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(tier.docs, x + (tierWidth - 5) / 2, y + 28, { align: 'center' });
        
        doc.setFontSize(7);
        const features = tier.features.split(', ');
        features.forEach((f, fi) => {
          doc.text(f, x + (tierWidth - 5) / 2, y + 35 + (fi * 4), { align: 'center' });
        });
      });

      y += 60;

      // ROI Section
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Return on Investment', margin, y);
      y += 8;
      doc.line(margin, y, margin + 50, y);
      y += 12;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 35, 'F');

      doc.setTextColor(51, 51, 51);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const roi = [
        '• Reduce manual data entry by up to 80%',
        '• Cut document processing time by 40%',
        '• Eliminate paper handling costs',
        '• Reduce error rates by 95%',
        '• Achieve ROI within 3-6 months'
      ];

      roi.forEach((r, i) => {
        doc.text(r, margin + 10, y + 8 + (i * 6));
      });

      y += 45;

      // Call to Action - position it above the footer with proper spacing
      const pageHeight = doc.internal.pageSize.getHeight();
      const ctaY = pageHeight - 55; // Position CTA box 55px from bottom
      
      doc.setFillColor(30, 58, 138);
      doc.rect(margin, ctaY, contentWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ready to Transform Your Document Processing?', pageWidth / 2, ctaY + 12, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Contact us for a personalized demo and pricing quote', pageWidth / 2, ctaY + 22, { align: 'center' });

      // Footer - positioned at very bottom
      const footerY = pageHeight - 10;
      doc.setTextColor(128, 128, 128);
      doc.setFontSize(8);
      doc.text('© 2025 WISDM Capture Pro. All rights reserved.', margin, footerY);
      doc.text('www.wisdmcapture.pro | sales@wisdmcapture.pro', pageWidth - margin, footerY, { align: 'right' });

      // Save PDF
      doc.save('WISDM-Capture-Pro-Marketing-Brochure.pdf');
      toast.success('Marketing brochure downloaded successfully!');
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
          Marketing Brochure
        </CardTitle>
        <CardDescription>
          Download a professional marketing PDF for WISDM Capture Pro
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>The brochure includes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Key statistics and value propositions</li>
            <li>Core features and capabilities</li>
            <li>Enterprise integrations</li>
            <li>Security and compliance info</li>
            <li>Industry solutions</li>
            <li>Pricing tiers</li>
            <li>ROI highlights</li>
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
              Download Marketing Brochure
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
