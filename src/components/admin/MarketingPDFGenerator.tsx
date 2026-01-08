import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import axiomiqLogo from '@/assets/axiomiq-logo.png';

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

export const MarketingPDFGenerator = () => {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 0;

      // Load logo
      let logoBase64: string | null = null;
      try {
        logoBase64 = await loadImageAsBase64(axiomiqLogo);
      } catch (e) {
        console.warn('Could not load logo:', e);
      }

      // === PAGE 1: Hero & Features ===
      
      // Gradient-style header background (simulate with layered rectangles)
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 70, 'F');
      doc.setFillColor(30, 41, 59); // slate-800 accent
      doc.rect(0, 60, pageWidth, 12, 'F');
      
      // Add decorative accent line
      doc.setFillColor(59, 130, 246); // blue-500
      doc.rect(0, 68, pageWidth, 4, 'F');

      // Logo with white background for visibility
      if (logoBase64) {
        doc.setFillColor(255, 255, 255);
        roundedRect(doc, margin - 2, 8, 50, 22, 3, 'F');
        doc.addImage(logoBase64, 'PNG', margin, 10, 46, 18);
      }
      
      // Main title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('Capture Pro', margin + 50, 22);
      
      // Subtitle with accent color
      doc.setTextColor(147, 197, 253); // blue-300
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Enterprise Document Capture & AI Processing Platform', margin + 50, 30);

      // Hero tagline
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Transform Your Document Processing with AI', margin, 52);

      y = 85;

      // Stats Cards Row
      const stats = [
        { value: '40%', label: 'Faster Processing', icon: '>' },
        { value: '99.5%', label: 'Accuracy Rate', icon: '*' },
        { value: '60%', label: 'Cost Reduction', icon: '$' },
        { value: '24/7', label: 'Automation', icon: '@' }
      ];
      
      const cardWidth = (contentWidth - 12) / 4;
      stats.forEach((stat, i) => {
        const x = margin + (cardWidth + 4) * i;
        
        // Card background
        doc.setFillColor(248, 250, 252); // slate-50
        roundedRect(doc, x, y, cardWidth, 32, 3, 'F');
        
        // Card border
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.3);
        roundedRect(doc, x, y, cardWidth, 32, 3, 'S');
        
        // Value
        doc.setTextColor(30, 64, 175); // blue-800
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(stat.value, x + cardWidth / 2, y + 14, { align: 'center' });
        
        // Label
        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(stat.label, x + cardWidth / 2, y + 24, { align: 'center' });
      });

      y += 45;

      // Core Capabilities Section
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Core Capabilities', margin, y);
      
      // Accent underline
      doc.setFillColor(59, 130, 246); // blue-500
      doc.rect(margin, y + 3, 35, 2, 'F');
      y += 15;

      const features = [
        { title: 'AI-Powered OCR', desc: 'Google Gemini & OpenAI GPT-5 for industry-leading extraction accuracy' },
        { title: 'Smart Document Routing', desc: 'Automatic classification and routing based on confidence thresholds' },
        { title: 'Multi-Language UI', desc: 'Interface available in English, Spanish, French, and German' },
        { title: 'Batch Processing', desc: 'Process thousands of documents with parallel OCR optimization' },
        { title: 'Zonal Extraction', desc: 'Template-based extraction for structured document types' },
        { title: 'Validation Workflows', desc: 'Configurable validation rules with exception handling' }
      ];

      features.forEach((feature, i) => {
        // Alternating background
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 4, contentWidth, 12, 'F');
        }
        
        // Bullet
        doc.setFillColor(59, 130, 246);
        doc.circle(margin + 3, y, 1.5, 'F');
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(feature.title, margin + 8, y + 1);
        
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(feature.desc, margin + 50, y + 1);
        y += 12;
      });

      y += 8;

      // Two-column section: Integrations & Security
      const colWidth = (contentWidth - 10) / 2;

      // Integrations Box
      doc.setFillColor(239, 246, 255); // blue-50
      roundedRect(doc, margin, y, colWidth, 55, 4, 'F');
      doc.setDrawColor(191, 219, 254); // blue-200
      doc.setLineWidth(0.5);
      roundedRect(doc, margin, y, colWidth, 55, 4, 'S');
      
      doc.setTextColor(30, 64, 175); // blue-800
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Enterprise Integrations', margin + 5, y + 10);
      
      const integrations = ['SharePoint & OneDrive', 'FileBound ECM', 'Resware (Mortgage)', 'Documentum', 'Custom Webhooks', 'REST API Access'];
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      integrations.forEach((int, i) => {
        doc.text('+ ' + int, margin + 8, y + 20 + (i * 6));
      });

      // Security Box
      const secX = margin + colWidth + 10;
      doc.setFillColor(240, 253, 244); // green-50
      roundedRect(doc, secX, y, colWidth, 55, 4, 'F');
      doc.setDrawColor(187, 247, 208); // green-200
      roundedRect(doc, secX, y, colWidth, 55, 4, 'S');
      
      doc.setTextColor(22, 101, 52); // green-800
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Enterprise Security', secX + 5, y + 10);
      
      const security = ['SOC 2 Ready Infrastructure', 'AES-256-GCM Encryption', 'Row-Level Security (RLS)', 'Multi-Factor Authentication', 'Complete Audit Trail', 'HIPAA Compliant Design'];
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      security.forEach((sec, i) => {
        doc.text('* ' + sec, secX + 8, y + 20 + (i * 6));
      });

      // Footer for page 1
      doc.setFillColor(241, 245, 249);
      doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text('Western Integrated Systems', margin, pageHeight - 5);
      doc.text('Page 1 of 2', pageWidth - margin, pageHeight - 5, { align: 'right' });

      // === PAGE 2: Solutions & Pricing ===
      doc.addPage();
      y = 0;

      // Page 2 header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 33, pageWidth, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Industry Solutions & Pricing', margin, 22);

      y = 50;

      // Industry Solutions
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Industry Solutions', margin, y);
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, y + 3, 30, 2, 'F');
      y += 15;

      const useCases = [
        { industry: 'Title & Escrow', benefits: 'AB 1466 compliance, deed processing, automated redaction', color: [254, 243, 199] },
        { industry: 'Mortgage & Lending', benefits: 'Loan document extraction, Resware integration, compliance checks', color: [254, 226, 226] },
        { industry: 'Healthcare', benefits: 'HIPAA-compliant processing, medical records, PII redaction', color: [220, 252, 231] },
        { industry: 'Legal Services', benefits: 'Contract analysis, discovery processing, signature validation', color: [224, 231, 255] },
        { industry: 'Accounts Payable', benefits: 'Invoice processing, PO matching, vendor management', color: [243, 232, 255] }
      ];

      useCases.forEach((uc, i) => {
        doc.setFillColor(uc.color[0], uc.color[1], uc.color[2]);
        roundedRect(doc, margin, y - 3, contentWidth, 12, 2, 'F');
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(uc.industry, margin + 5, y + 4);
        
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(uc.benefits, margin + 45, y + 4);
        y += 14;
      });

      y += 10;

      // Pricing Tiers
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Pricing Plans', margin, y);
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, y + 3, 25, 2, 'F');
      y += 15;

      const tiers = [
        { name: 'Starter', price: '$499', period: '/mo', docs: '5,000 docs/mo', features: ['3 projects', 'Email support', 'Standard OCR'], highlight: false },
        { name: 'Professional', price: '$999', period: '/mo', docs: '25,000 docs/mo', features: ['10 projects', 'Priority support', 'API access'], highlight: false },
        { name: 'Business', price: '$2,499', period: '/mo', docs: '100,000 docs/mo', features: ['Unlimited projects', 'SSO included', 'Custom integrations'], highlight: true },
        { name: 'Enterprise', price: 'Custom', period: '', docs: 'Unlimited', features: ['Dedicated support', 'Custom SLA', 'White-label'], highlight: false }
      ];

      const tierWidth = (contentWidth - 12) / 4;
      
      tiers.forEach((tier, i) => {
        const x = margin + (tierWidth + 4) * i;
        const boxHeight = 58;
        
        if (tier.highlight) {
          // Highlighted tier
          doc.setFillColor(30, 64, 175); // blue-800
          roundedRect(doc, x, y - 3, tierWidth, boxHeight + 6, 4, 'F');
          
          // "Popular" badge
          doc.setFillColor(251, 191, 36); // amber-400
          doc.rect(x, y - 3, tierWidth, 8, 'F');
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('MOST POPULAR', x + tierWidth / 2, y + 2, { align: 'center' });
          
          doc.setTextColor(255, 255, 255);
        } else {
          doc.setFillColor(248, 250, 252);
          roundedRect(doc, x, y, tierWidth, boxHeight, 4, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          roundedRect(doc, x, y, tierWidth, boxHeight, 4, 'S');
          doc.setTextColor(15, 23, 42);
        }
        
        const yOffset = tier.highlight ? 8 : 0;
        
        // Tier name
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(tier.name, x + tierWidth / 2, y + 12 + yOffset, { align: 'center' });
        
        // Price with period combined
        const priceText = tier.period ? tier.price + tier.period : tier.price;
        doc.setFontSize(14);
        doc.text(priceText, x + tierWidth / 2, y + 24 + yOffset, { align: 'center' });
        
        // Docs
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(tier.docs, x + tierWidth / 2, y + 32 + yOffset, { align: 'center' });
        
        // Features
        doc.setFontSize(6);
        tier.features.forEach((f, fi) => {
          doc.text(f, x + tierWidth / 2, y + 40 + (fi * 5) + yOffset, { align: 'center' });
        });
      });

      y += 75;

      // ROI Section
      doc.setFillColor(239, 246, 255);
      roundedRect(doc, margin, y, contentWidth, 40, 4, 'F');
      
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Return on Investment', margin + 10, y + 10);

      const roi = [
        'Reduce manual data entry by up to 80%',
        'Cut document processing time by 40%',
        'Eliminate paper handling costs',
        'Reduce error rates by 95%',
        'Achieve ROI within 3-6 months'
      ];

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const roiCol1 = roi.slice(0, 3);
      const roiCol2 = roi.slice(3);
      
      roiCol1.forEach((r, i) => {
        doc.text('> ' + r, margin + 10, y + 20 + (i * 6));
      });
      roiCol2.forEach((r, i) => {
        doc.text('> ' + r, margin + contentWidth / 2, y + 20 + (i * 6));
      });

      // CTA Box
      const ctaY = pageHeight - 55;
      doc.setFillColor(15, 23, 42);
      roundedRect(doc, margin, ctaY, contentWidth, 35, 5, 'F');
      
      // Decorative accent
      doc.setFillColor(59, 130, 246);
      doc.rect(margin + 10, ctaY + 5, 3, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Ready to Transform Your Document Processing?', margin + 20, ctaY + 15);
      
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Contact us today for a personalized demo and pricing quote', margin + 20, ctaY + 26);

      // Footer
      doc.setFillColor(241, 245, 249);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Western Integrated Systems', margin, pageHeight - 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('www.westint.com | sales@westint.com', pageWidth / 2, pageHeight - 5, { align: 'center' });
      doc.text('Page 2 of 2', pageWidth - margin, pageHeight - 5, { align: 'right' });

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
