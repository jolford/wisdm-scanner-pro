import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileDown, DollarSign } from 'lucide-react';
import { jsPDF } from 'jspdf';
import axiomiqLogo from '@/assets/axiomiq-logo.png';

export function PricingPDFGenerator() {
  const generatePDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Load and add logo
    const img = new Image();
    img.src = axiomiqLogo;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    
    // Add logo - centered at top
    const logoWidth = 40;
    const logoHeight = (img.height / img.width) * logoWidth;
    pdf.addImage(img, 'PNG', (pageWidth - logoWidth) / 2, 15, logoWidth, logoHeight);
    
    // "Powered by AI" badge below logo
    pdf.setFontSize(9);
    pdf.setTextColor(59, 130, 246);
    pdf.setFont('helvetica', 'bold');
    pdf.text('POWERED BY AI', pageWidth / 2, 15 + logoHeight + 3, { align: 'center' });
    
    // Title
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(24);
    pdf.setTextColor(31, 41, 55);
    pdf.text('WISDM Capture Pro', pageWidth / 2, 45, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.setTextColor(107, 114, 128);
    pdf.text('Enterprise Document Processing Platform', pageWidth / 2, 52, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.text('2025 Pricing Guide', pageWidth / 2, 59, { align: 'center' });
    
    // Horizontal line
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.5);
    pdf.line(20, 65, pageWidth - 20, 65);
    
    let yPos = 75;
    
    // Tier 1: Starter
    pdf.setFillColor(249, 250, 251);
    pdf.rect(20, yPos, pageWidth - 40, 35, 'F');
    
    pdf.setFontSize(16);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Starter', 25, yPos + 7);
    
    pdf.setFontSize(20);
    pdf.setTextColor(31, 41, 55);
    pdf.text('$199', pageWidth - 25, yPos + 7, { align: 'right' });
    
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text('/month', pageWidth - 25, yPos + 12, { align: 'right' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const starterFeatures = [
      '10,000 documents/month ($0.020 per document)',
      '5 concurrent users',
      'Basic OCR (Gemini Flash-Lite)',
      'CSV/JSON export • Email support'
    ];
    starterFeatures.forEach((feature, i) => {
      pdf.text(`• ${feature}`, 25, yPos + 15 + (i * 5));
    });
    
    yPos += 40;
    
    // Tier 2: Professional (Most Popular)
    pdf.setFillColor(239, 246, 255);
    pdf.rect(20, yPos, pageWidth - 40, 37, 'F');
    
    // "Most Popular" badge
    pdf.setFillColor(59, 130, 246);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.rect(25, yPos + 2, 28, 5, 'F');
    pdf.text('MOST POPULAR', 27, yPos + 5.5);
    
    pdf.setFontSize(16);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Professional', 25, yPos + 12);
    
    pdf.setFontSize(20);
    pdf.setTextColor(31, 41, 55);
    pdf.text('$699', pageWidth - 25, yPos + 12, { align: 'right' });
    
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text('/month', pageWidth - 25, yPos + 17, { align: 'right' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const proFeatures = [
      '50,000 documents/month ($0.014 per document)',
      '15 concurrent users',
      'Premium OCR (Gemini Pro)',
      'All export formats + PDF generation',
      'Batch validation workflow • Priority support'
    ];
    proFeatures.forEach((feature, i) => {
      pdf.text(`• ${feature}`, 25, yPos + 20 + (i * 5));
    });
    
    yPos += 42;
    
    // Tier 3: Business
    pdf.setFillColor(249, 250, 251);
    pdf.rect(20, yPos, pageWidth - 40, 37, 'F');
    
    pdf.setFontSize(16);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Business', 25, yPos + 7);
    
    pdf.setFontSize(20);
    pdf.setTextColor(31, 41, 55);
    pdf.text('$1,999', pageWidth - 25, yPos + 7, { align: 'right' });
    
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text('/month', pageWidth - 25, yPos + 12, { align: 'right' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const businessFeatures = [
      '200,000 documents/month ($0.010 per document)',
      'Unlimited users',
      'Enterprise OCR (Gemini Pro + Custom Training)',
      'ECM integration (FileBound/DocMgt)',
      'Custom document classes • Dedicated account manager'
    ];
    businessFeatures.forEach((feature, i) => {
      pdf.text(`• ${feature}`, 25, yPos + 15 + (i * 5));
    });
    
    yPos += 42;
    
    // Tier 4: Enterprise
    pdf.setFillColor(249, 250, 251);
    pdf.rect(20, yPos, pageWidth - 40, 32, 'F');
    
    pdf.setFontSize(16);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Enterprise', 25, yPos + 7);
    
    pdf.setFontSize(16);
    pdf.setTextColor(31, 41, 55);
    pdf.text('Custom', pageWidth - 25, yPos + 7, { align: 'right' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const enterpriseFeatures = [
      'Unlimited documents (volume discounts from $0.005/doc)',
      'Multi-tenant management • Custom AI model training',
      'SLA guarantees • On-premise deployment options'
    ];
    enterpriseFeatures.forEach((feature, i) => {
      pdf.text(`• ${feature}`, 25, yPos + 15 + (i * 5));
    });
    
    // Page 2 - Add-ons and Benefits
    pdf.addPage();
    
    // Title for page 2
    pdf.setFontSize(18);
    pdf.setTextColor(31, 41, 55);
    pdf.text('Add-Ons & Benefits', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setDrawColor(229, 231, 235);
    pdf.line(20, 25, pageWidth - 40, 25);
    
    yPos = 35;
    
    // Add-ons section
    pdf.setFontSize(14);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Available Add-Ons (All Tiers)', 20, yPos);
    
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const addons = [
      'Additional Users: $25/user/month',
      'Document Overage: $15 per 1,000 documents',
      'Premium Support (24/7): $500/month',
      'Custom Integration: $2,500 one-time setup',
      'Training Package: $1,500 (4 hours)'
    ];
    addons.forEach((addon, i) => {
      pdf.text(`• ${addon}`, 25, yPos + (i * 6));
    });
    
    yPos += 35;
    
    // Annual discounts
    pdf.setFontSize(14);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Annual Contract Incentives', 20, yPos);
    
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const discounts = [
      '10% discount - Annual prepay',
      '15% discount - 2-year commitment',
      '20% discount - 3-year commitment + Enterprise tier'
    ];
    discounts.forEach((discount, i) => {
      pdf.text(`• ${discount}`, 25, yPos + (i * 6));
    });
    
    yPos += 25;
    
    // Key benefits section
    pdf.setFillColor(239, 246, 255);
    pdf.rect(20, yPos, pageWidth - 40, 45, 'F');
    
    pdf.setFontSize(14);
    pdf.setTextColor(59, 130, 246);
    pdf.text('Why Choose WISDM Capture Pro?', 25, yPos + 7);
    
    pdf.setFontSize(10);
    pdf.setTextColor(75, 85, 99);
    const benefits = [
      '70-85% cost savings vs. AWS/Azure/Google Cloud',
      'All-in-one solution: scan → validate → export',
      'True multi-tenant with budget controls',
      'No hidden fees - transparent per-document pricing',
      'Fast ROI - typically 3-6 months for manual processing replacement',
      'Enterprise-grade security with role-based access control',
      'Real-time job queue monitoring and batch processing'
    ];
    benefits.forEach((benefit, i) => {
      pdf.text(`✓ ${benefit}`, 25, yPos + 15 + (i * 5));
    });
    
    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175);
    pdf.text('Contact us for a custom quote or enterprise volume pricing', pageWidth / 2, 280, { align: 'center' });
    pdf.text('Executive Sales Manager Maria Kinney | sales@westint.com', pageWidth / 2, 285, { align: 'center' });
    
    // Save the PDF
    pdf.save('WISDM-Capture-Pro-Pricing-2025.pdf');
  };
  
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Pricing Document
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Generate professional pricing PDF for your sales team
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Document Includes:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• AxiomIQ Capture Pro branding and logo</li>
            <li>• 4 pricing tiers (Starter, Professional, Business, Enterprise)</li>
            <li>• Add-ons and annual contract incentives</li>
            <li>• Key competitive advantages</li>
            <li>• Professional 2-page layout</li>
          </ul>
        </div>
        
        <Button onClick={generatePDF} className="w-full" size="lg">
          <FileDown className="mr-2 h-4 w-4" />
          Download Pricing PDF
        </Button>
      </div>
    </Card>
  );
}
