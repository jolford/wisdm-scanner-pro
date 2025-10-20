import { useEffect, useState } from "react";
import PptxGenJS from "pptxgenjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroSlide from "@/assets/presentation/hero-slide.jpg";
import aiProcessing from "@/assets/presentation/ai-processing.jpg";
import validationWorkflow from "@/assets/presentation/validation-workflow.jpg";
import integration from "@/assets/presentation/integration.jpg";
import revenueGrowth from "@/assets/presentation/revenue-growth.jpg";
import wisdmLogo from "@/assets/wisdm-logo.png";

const PowerPointDownload = () => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setDownloading(true);
    setError(null);
    try {
      const pptx = new PptxGenJS();
      pptx.author = "Western Integrated Systems";
      pptx.company = "Western Integrated Systems";
      pptx.title = "WISDM Scanner Pro - Complete Sales Presentation";

      // Slide 1: Title
      const s1 = pptx.addSlide();
      s1.addImage({ path: heroSlide, x: 0, y: 0, w: 10, h: 5.625 });
      s1.addShape(pptx.ShapeType.rect, { x: 0, y: 1.2, w: 10, h: 2.5, fill: { color: "000000", transparency: 40 } });
      s1.addText("WISDM Scanner Pro", { x: 0.5, y: 1.5, w: 9, h: 0.8, fontSize: 48, bold: true, color: "FFFFFF", align: "center" });
      s1.addText("Enterprise Document Processing Platform", { x: 0.5, y: 2.3, w: 9, h: 0.5, fontSize: 26, color: "FFFFFF", align: "center" });
      s1.addText("Transform Your Document Workflow", { x: 0.5, y: 2.9, w: 9, h: 0.4, fontSize: 20, color: "E5E7EB", align: "center" });
      s1.addImage({ path: wisdmLogo, x: 0.4, y: 0.3, w: 1, h: 1, transparency: 10 });

      // Slide 2: Value Props
      const s2 = pptx.addSlide();
      s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s2.addText("Key Value Propositions", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      
      s2.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.3, w: 2.7, h: 1.4, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      s2.addText("99.5%", { x: 0.8, y: 1.5, w: 2.5, h: 0.5, fontSize: 36, bold: true, color: "2563EB", align: "center" });
      s2.addText("OCR Accuracy", { x: 0.8, y: 2.1, w: 2.5, h: 0.4, fontSize: 16, color: "475569", align: "center" });

      s2.addShape(pptx.ShapeType.rect, { x: 3.65, y: 1.3, w: 2.7, h: 1.4, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      s2.addText("10x", { x: 3.75, y: 1.5, w: 2.5, h: 0.5, fontSize: 36, bold: true, color: "16A34A", align: "center" });
      s2.addText("Faster Processing", { x: 3.75, y: 2.1, w: 2.5, h: 0.4, fontSize: 16, color: "475569", align: "center" });

      s2.addShape(pptx.ShapeType.rect, { x: 6.6, y: 1.3, w: 2.7, h: 1.4, fill: { color: "FEF3C7" }, line: { color: "F59E0B", width: 2 } });
      s2.addText("70%", { x: 6.7, y: 1.5, w: 2.5, h: 0.5, fontSize: 36, bold: true, color: "D97706", align: "center" });
      s2.addText("Cost Reduction", { x: 6.7, y: 2.1, w: 2.5, h: 0.4, fontSize: 16, color: "475569", align: "center" });

      s2.addText("An all-in-one solution for intelligent document capture, processing, validation, and export", 
        { x: 0.7, y: 3.0, w: 8.6, h: 0.6, fontSize: 18, color: "475569", align: "center" });

      // Slide 3: Problem vs Solution
      const s3 = pptx.addSlide();
      s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s3.addText("The Problem We Solve", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      
      s3.addText("Current State:", { x: 0.5, y: 1.1, w: 4, h: 0.4, fontSize: 18, bold: true, color: "DC2626" });
      s3.addText("✗ Manual data entry - slow and error-prone\n✗ Expensive per-page processing costs\n✗ Disconnected systems and workflows\n✗ No visibility into processing costs\n✗ Limited scalability and flexibility", 
        { x: 0.5, y: 1.5, w: 4, h: 2.2, fontSize: 15, color: "475569", lineSpacing: 20 });

      s3.addText("Our Solution:", { x: 5.2, y: 1.1, w: 4, h: 0.4, fontSize: 18, bold: true, color: "16A34A" });
      s3.addText("✓ AI-powered automatic data extraction\n✓ Transparent, predictable pricing\n✓ Unified platform with ECM integrations\n✓ Real-time cost tracking and analytics\n✓ Cloud-native architecture that scales", 
        { x: 5.2, y: 1.5, w: 4, h: 2.2, fontSize: 15, color: "475569", lineSpacing: 20 });

      // Slide 4: AI-Powered Processing
      const s4 = pptx.addSlide();
      s4.addImage({ path: aiProcessing, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      s4.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 12 }, line: { color: "E5E7EB", width: 1 } });
      s4.addText("AI-Powered Processing", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B" });
      
      s4.addText("OCR & Recognition:", { x: 0.8, y: 1.4, w: 4, h: 0.4, fontSize: 16, bold: true, color: "2563EB" });
      s4.addText("• 99.5% accuracy using Google Gemini Pro\n• Multi-language support\n• Handwriting & cursive recognition\n• Barcode & QR code scanning",
        { x: 0.8, y: 1.8, w: 4, h: 1.2, fontSize: 14, color: "1E293B", lineSpacing: 16 });

      s4.addText("Data Extraction:", { x: 5.2, y: 1.4, w: 4, h: 0.4, fontSize: 16, bold: true, color: "2563EB" });
      s4.addText("• Automatic field detection\n• Custom metadata extraction\n• Smart document separation\n• Region-specific re-processing",
        { x: 5.2, y: 1.8, w: 4, h: 1.2, fontSize: 14, color: "1E293B", lineSpacing: 16 });

      s4.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.3, w: 8.4, h: 1.7, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      s4.addText("Automatic Document Classification", { x: 1, y: 3.5, w: 8, h: 0.35, fontSize: 16, bold: true, color: "1E293B" });
      s4.addText("Invoices • Receipts • Purchase Orders • Checks • Forms • Letters • More",
        { x: 1, y: 3.9, w: 8, h: 0.8, fontSize: 14, color: "475569", align: "center" });

      // Slide 5: Validation & Quality Control
      const s5 = pptx.addSlide();
      s5.addImage({ path: validationWorkflow, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      s5.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 12 }, line: { color: "E5E7EB", width: 1 } });
      s5.addText("Validation & Quality Control", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B" });
      s5.addText("Human-in-the-Loop Workflow", { x: 0.5, y: 1.2, w: 9, h: 0.4, fontSize: 18, color: "64748B" });
      
      s5.addText("1. Review Interface: Side-by-side document and metadata view\n\n2. Smart Suggestions: AI recommends field values for quick validation\n\n3. Region Re-OCR: Select specific areas for re-processing\n\n4. Redaction Tools: Black out sensitive information before export\n\n5. Keyboard Shortcuts: Rapid validation with hotkeys",
        { x: 0.8, y: 1.8, w: 8.5, h: 2.8, fontSize: 15, color: "1E293B", lineSpacing: 18, bullet: true });

      // Slide 6: Enterprise Integration
      const s6 = pptx.addSlide();
      s6.addImage({ path: integration, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      s6.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 20 }, line: { color: "E5E7EB", width: 1 } });
      s6.addText("Enterprise Integration", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B", fontFace: "Arial" });
      
      s6.addText("Supported Exports:", { x: 0.8, y: 1.4, w: 4, h: 0.4, fontSize: 16, bold: true, color: "2563EB", fontFace: "Arial" });
      s6.addText(
        [
          "FileBound ECM",
          "Generic Document Management APIs",
          "PDF with embedded metadata",
          "CSV/Excel data exports",
          "Custom API integrations",
        ].join("\n"),
        { x: 0.8, y: 1.8, w: 4, h: 1.5, fontSize: 14, color: "1E293B", lineSpacing: 16, bullet: true, fontFace: "Arial" }
      );

      s6.addText("Configuration:", { x: 5.2, y: 1.4, w: 4, h: 0.4, fontSize: 16, bold: true, color: "2563EB", fontFace: "Arial" });
      s6.addText(
        [
          "Project-specific field mapping",
          "Automatic or manual export triggers",
          "Document separation rules",
          "Batch processing options",
          "Real-time status monitoring",
        ].join("\n"),
        { x: 5.2, y: 1.8, w: 4, h: 1.5, fontSize: 14, color: "1E293B", lineSpacing: 16, bullet: true, fontFace: "Arial" }
      );

      // Slide 7: Revenue Opportunities
      const s7 = pptx.addSlide();
      s7.addImage({ path: revenueGrowth, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      s7.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 10 }, line: { color: "E5E7EB", width: 1 } });
      s7.addText("Revenue Opportunities", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B" });
      
      s7.addText("Revenue Streams:", { x: 0.7, y: 1.3, w: 4, h: 0.3, fontSize: 16, bold: true, color: "1E293B" });
      s7.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.65, w: 4, h: 0.55, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
      s7.addText("License Fees: $50-500/user/month recurring", { x: 0.8, y: 1.75, w: 3.8, h: 0.35, fontSize: 13, color: "475569" });
      
      s7.addShape(pptx.ShapeType.rect, { x: 0.7, y: 2.25, w: 4, h: 0.55, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
      s7.addText("AI Processing: $0.01-0.05 per page processed", { x: 0.8, y: 2.35, w: 3.8, h: 0.35, fontSize: 13, color: "475569" });
      
      s7.addShape(pptx.ShapeType.rect, { x: 0.7, y: 2.85, w: 4, h: 0.55, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
      s7.addText("Integration Setup: $5,000-25,000 one-time", { x: 0.8, y: 2.95, w: 3.8, h: 0.35, fontSize: 13, color: "475569" });

      s7.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.45, w: 4, h: 0.55, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
      s7.addText("Support & Training: 20% annual maintenance", { x: 0.8, y: 3.55, w: 3.8, h: 0.35, fontSize: 13, color: "475569" });

      // Example Pricing column
      s7.addText("Example Pricing:", { x: 5.3, y: 1.3, w: 4, h: 0.3, fontSize: 16, bold: true, color: "1E293B" });
      
      s7.addShape(pptx.ShapeType.rect, { x: 5.3, y: 1.7, w: 4, h: 0.75, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      s7.addText("Small Business", { x: 5.4, y: 1.78, w: 3.8, h: 0.25, fontSize: 14, bold: true, color: "1E293B" });
      s7.addText("5 users, 10K pages/mo → $750/mo", { x: 5.4, y: 2.05, w: 3.8, h: 0.3, fontSize: 12, color: "475569" });

      s7.addShape(pptx.ShapeType.rect, { x: 5.3, y: 2.55, w: 4, h: 0.75, fill: { color: "DBEAFE" }, line: { color: "1D4ED8", width: 2 } });
      s7.addText("Mid-Market", { x: 5.4, y: 2.63, w: 3.8, h: 0.25, fontSize: 14, bold: true, color: "1E293B" });
      s7.addText("25 users, 100K pages/mo → $6,250/mo", { x: 5.4, y: 2.9, w: 3.8, h: 0.3, fontSize: 12, color: "475569" });

      s7.addShape(pptx.ShapeType.rect, { x: 5.3, y: 3.4, w: 4, h: 0.75, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      s7.addText("Enterprise", { x: 5.4, y: 3.48, w: 3.8, h: 0.25, fontSize: 14, bold: true, color: "1E293B" });
      s7.addText("100 users, 500K pages/mo → $35,000/mo", { x: 5.4, y: 3.75, w: 3.8, h: 0.3, fontSize: 12, color: "475569" });

      // Slide 8: Technical Architecture
      const s8 = pptx.addSlide();
      s8.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s8.addText("Technical Architecture", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      s8.addText("Modern, Scalable, Cloud-Native", { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 18, color: "64748B" });
      
      s8.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.6, w: 2.7, h: 1.6, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      s8.addText("Frontend", { x: 0.8, y: 1.7, w: 2.5, h: 0.3, fontSize: 14, bold: true, color: "1E293B" });
      s8.addText("• React + TypeScript\n• Vite build system\n• Tailwind CSS\n• Progressive Web App\n• React Query",
        { x: 0.8, y: 2.0, w: 2.5, h: 1.1, fontSize: 11, color: "475569", lineSpacing: 14 });

      s8.addShape(pptx.ShapeType.rect, { x: 3.65, y: 1.6, w: 2.7, h: 1.6, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      s8.addText("Backend", { x: 3.75, y: 1.7, w: 2.5, h: 0.3, fontSize: 14, bold: true, color: "1E293B" });
      s8.addText("• PostgreSQL database\n• Edge Functions\n• Object Storage\n• Real-time sync\n• Row Level Security",
        { x: 3.75, y: 2.0, w: 2.5, h: 1.1, fontSize: 11, color: "475569", lineSpacing: 14 });

      s8.addShape(pptx.ShapeType.rect, { x: 6.6, y: 1.6, w: 2.7, h: 1.6, fill: { color: "FEF3C7" }, line: { color: "F59E0B", width: 2 } });
      s8.addText("AI Processing", { x: 6.7, y: 1.7, w: 2.5, h: 0.3, fontSize: 14, bold: true, color: "1E293B" });
      s8.addText("• Google Gemini Pro\n• OpenAI GPT-5\n• PDF.js parsing\n• Image processing\n• Batch queuing",
        { x: 6.7, y: 2.0, w: 2.5, h: 1.1, fontSize: 11, color: "475569", lineSpacing: 14 });

      s8.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.4, w: 8.6, h: 1.5, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
      s8.addText("Key Features:", { x: 0.8, y: 3.55, w: 8.4, h: 0.3, fontSize: 13, bold: true, color: "1E293B" });
      s8.addText("Multi-tenant architecture • Real-time job queue • Comprehensive audit logging\nCost tracking and budgeting • Role-based access control • API-first design",
        { x: 0.8, y: 3.85, w: 8.4, h: 0.8, fontSize: 11, color: "475569", lineSpacing: 14 });

      // Slide 9: Market Opportunity
      const s9 = pptx.addSlide();
      s9.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s9.addText("Market Opportunity", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      
      s9.addText("Target Markets:", { x: 0.7, y: 1.2, w: 8.6, h: 0.3, fontSize: 16, bold: true, color: "1E293B" });
      
      const markets = [
        ["Healthcare", "Patient records, insurance claims, forms"],
        ["Legal", "Case files, contracts, discovery documents"],
        ["Financial Services", "Loan applications, statements, compliance"],
        ["Government", "Permits, applications, public records"]
      ];
      
      markets.forEach((market, i) => {
        s9.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.6 + (i * 0.55), w: 4, h: 0.5, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
        s9.addText(market[0], { x: 0.8, y: 1.65 + (i * 0.55), w: 3.8, h: 0.2, fontSize: 13, bold: true, color: "1E293B" });
        s9.addText(market[1], { x: 0.8, y: 1.85 + (i * 0.55), w: 3.8, h: 0.2, fontSize: 11, color: "64748B" });
      });

      s9.addText("Market Size:", { x: 5.3, y: 1.2, w: 4, h: 0.3, fontSize: 16, bold: true, color: "1E293B" });
      
      s9.addShape(pptx.ShapeType.rect, { x: 5.3, y: 1.6, w: 4, h: 1.0, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      s9.addText("Document Management Market", { x: 5.4, y: 1.75, w: 3.8, h: 0.25, fontSize: 12, color: "475569" });
      s9.addText("$8.5B", { x: 5.4, y: 2.0, w: 3.8, h: 0.4, fontSize: 28, bold: true, color: "2563EB" });
      s9.addText("Growing at 12% CAGR", { x: 5.4, y: 2.4, w: 3.8, h: 0.2, fontSize: 10, color: "64748B" });

      s9.addShape(pptx.ShapeType.rect, { x: 5.3, y: 2.75, w: 4, h: 1.0, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      s9.addText("Intelligent Document Processing", { x: 5.4, y: 2.9, w: 3.8, h: 0.25, fontSize: 12, color: "475569" });
      s9.addText("$2.1B → $9.1B", { x: 5.4, y: 3.15, w: 3.8, h: 0.4, fontSize: 24, bold: true, color: "16A34A" });
      s9.addText("Expected by 2028", { x: 5.4, y: 3.55, w: 3.8, h: 0.2, fontSize: 10, color: "64748B" });

      // Slide 10: Competitive Advantages
      const s10 = pptx.addSlide();
      s10.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s10.addText("Why WISDM Stands Out", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      s10.addText("Competitive Advantages", { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 18, color: "64748B" });

      const advantages = [
        ["Modern Architecture", "Cloud-native design on modern web technologies. No legacy infrastructure."],
        ["AI-Powered", "Latest AI models from Google and OpenAI for superior accuracy."],
        ["Cost Transparency", "Real-time cost tracking with budget controls. No surprise bills."],
        ["Flexible Licensing", "Multi-tenant platform with granular permissions and budget controls."]
      ];

      advantages.forEach((adv, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        s10.addShape(pptx.ShapeType.rect, { 
          x: 0.7 + (col * 4.65), 
          y: 1.6 + (row * 1.4), 
          w: 4.3, 
          h: 1.2, 
          fill: { color: "EFF6FF" }, 
          line: { color: "3B82F6", width: 2 } 
        });
        s10.addText(adv[0], { 
          x: 0.8 + (col * 4.65), 
          y: 1.7 + (row * 1.4), 
          w: 4.1, 
          h: 0.3, 
          fontSize: 14, 
          bold: true, 
          color: "1E293B" 
        });
        s10.addText(adv[1], { 
          x: 0.8 + (col * 4.65), 
          y: 2.0 + (row * 1.4), 
          w: 4.1, 
          h: 0.7, 
          fontSize: 11, 
          color: "475569" 
        });
      });

      // Slide 11: ROI Calculator
      const s11 = pptx.addSlide();
      s11.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s11.addText("ROI Calculator - Typical Customer Savings", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 28, bold: true, color: "1E293B" });

      s11.addText("Current Manual Process:", { x: 0.7, y: 1.1, w: 4, h: 0.3, fontSize: 15, bold: true, color: "DC2626" });
      const current = [
        ["Data entry staff (3 FTE)", "$150,000/yr"],
        ["Error correction time", "$25,000/yr"],
        ["Legacy software licenses", "$20,000/yr"],
        ["IT maintenance", "$15,000/yr"]
      ];
      current.forEach((item, i) => {
        s11.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.45 + (i * 0.45), w: 4, h: 0.4, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
        s11.addText(item[0], { x: 0.8, y: 1.55 + (i * 0.45), w: 2.5, h: 0.2, fontSize: 12, color: "1E293B" });
        s11.addText(item[1], { x: 3.3, y: 1.55 + (i * 0.45), w: 1.3, h: 0.2, fontSize: 12, bold: true, color: "1E293B", align: "right" });
      });
      s11.addShape(pptx.ShapeType.rect, { x: 0.7, y: 3.3, w: 4, h: 0.5, fill: { color: "FEE2E2" }, line: { color: "DC2626", width: 2 } });
      s11.addText("Total Annual Cost", { x: 0.8, y: 3.4, w: 2.5, h: 0.3, fontSize: 13, bold: true, color: "1E293B" });
      s11.addText("$210,000", { x: 3.3, y: 3.4, w: 1.3, h: 0.3, fontSize: 16, bold: true, color: "DC2626", align: "right" });

      s11.addText("With WISDM Scanner Pro:", { x: 5.3, y: 1.1, w: 4, h: 0.3, fontSize: 15, bold: true, color: "16A34A" });
      const wisdm = [
        ["Validation staff (1 FTE)", "$50,000/yr"],
        ["WISDM licenses (10 users)", "$18,000/yr"],
        ["AI processing (100K pages)", "$30,000/yr"],
        ["Support & maintenance", "$5,000/yr"]
      ];
      wisdm.forEach((item, i) => {
        s11.addShape(pptx.ShapeType.rect, { x: 5.3, y: 1.45 + (i * 0.45), w: 4, h: 0.4, fill: { color: "FFFFFF" }, line: { color: "E5E7EB", width: 1 } });
        s11.addText(item[0], { x: 5.4, y: 1.55 + (i * 0.45), w: 2.5, h: 0.2, fontSize: 12, color: "1E293B" });
        s11.addText(item[1], { x: 7.9, y: 1.55 + (i * 0.45), w: 1.3, h: 0.2, fontSize: 12, bold: true, color: "1E293B", align: "right" });
      });
      s11.addShape(pptx.ShapeType.rect, { x: 5.3, y: 3.3, w: 4, h: 0.5, fill: { color: "D1FAE5" }, line: { color: "16A34A", width: 2 } });
      s11.addText("Total Annual Cost", { x: 5.4, y: 3.4, w: 2.5, h: 0.3, fontSize: 13, bold: true, color: "1E293B" });
      s11.addText("$103,000", { x: 7.9, y: 3.4, w: 1.3, h: 0.3, fontSize: 16, bold: true, color: "16A34A", align: "right" });

      s11.addShape(pptx.ShapeType.rect, { x: 1.5, y: 4.2, w: 7, h: 1.2, fill: { color: "DBEAFE" }, line: { color: "2563EB", width: 3 } });
      s11.addText("First Year Savings: $107,000", { x: 2, y: 4.4, w: 6, h: 0.4, fontSize: 24, bold: true, color: "1E293B", align: "center" });
      s11.addText("51% Cost Reduction", { x: 2, y: 4.8, w: 6, h: 0.3, fontSize: 16, color: "2563EB", align: "center" });

      // Slide 12: Implementation Timeline
      const s12 = pptx.addSlide();
      s12.addImage({ path: validationWorkflow, x: 0, y: 0, w: 10, h: 5.625, transparency: 70 });
      s12.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 10 }, line: { color: "E5E7EB", width: 1 } });
      s12.addText("Implementation Timeline", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      s12.addText("Typical Customer Onboarding: 2-4 Weeks", { x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 18, color: "64748B" });

      const timeline = [
        ["Week 1", "Discovery & Setup", "Requirements gathering, project configuration, field mapping, user setup"],
        ["Week 2", "Integration & Testing", "ECM integration setup, test document processing, workflow validation"],
        ["Week 3", "Training & Pilot", "User training, pilot batch processing, feedback and adjustments"],
        ["Week 4", "Go Live & Support", "Full production deployment, ongoing support, optimization and scaling"]
      ];

      timeline.forEach((week, i) => {
        const color = i === 3 ? "16A34A" : "2563EB";
        s12.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.7 + (i * 0.85), w: 8.4, h: 0.7, fill: { color: "FFFFFF" }, line: { color: color, width: 2 } });
        s12.addText(week[0], { x: 0.9, y: 1.8 + (i * 0.85), w: 1.5, h: 0.25, fontSize: 14, bold: true, color: "1E293B" });
        s12.addText(week[1], { x: 0.9, y: 2.05 + (i * 0.85), w: 7.5, h: 0.2, fontSize: 13, bold: true, color: color });
        s12.addText(week[2], { x: 0.9, y: 2.25 + (i * 0.85), w: 7.5, h: 0.2, fontSize: 11, color: "475569" });
      });

      // Slide 13: Next Steps
      const s13 = pptx.addSlide();
      s13.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      s13.addText("Next Steps", { x: 0.5, y: 0.6, w: 9, h: 0.7, fontSize: 40, bold: true, color: "1E293B", align: "center" });
      s13.addText("Ready to Transform Your Document Processing?", { x: 0.5, y: 1.3, w: 9, h: 0.4, fontSize: 20, color: "64748B", align: "center" });

      s13.addShape(pptx.ShapeType.rect, { x: 1.5, y: 2.0, w: 7, h: 0.6, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      s13.addText("📅 Schedule a Personalized Demo", { x: 2, y: 2.15, w: 6, h: 0.3, fontSize: 18, bold: true, color: "1E293B", align: "center" });

      s13.addShape(pptx.ShapeType.rect, { x: 1.5, y: 2.8, w: 7, h: 0.6, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      s13.addText("🔧 Start Pilot Program (Prove Value)", { x: 2, y: 2.95, w: 6, h: 0.3, fontSize: 18, bold: true, color: "1E293B", align: "center" });

      s13.addShape(pptx.ShapeType.rect, { x: 1.5, y: 3.6, w: 7, h: 0.6, fill: { color: "FEF3C7" }, line: { color: "F59E0B", width: 2 } });
      s13.addText("🚀 Full Deployment to Organization", { x: 2, y: 3.75, w: 6, h: 0.3, fontSize: 18, bold: true, color: "1E293B", align: "center" });

      s13.addText("Contact: westernintegrated.com | 1-800-WISDM-PRO", { x: 2, y: 4.8, w: 6, h: 0.4, fontSize: 14, color: "64748B", align: "center" });

      // Final Slide: Thank You
      const s14 = pptx.addSlide();
      s14.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "1E293B" } });
      s14.addText("Thank You!", { x: 2.5, y: 1.8, w: 5, h: 0.8, fontSize: 48, bold: true, color: "FFFFFF", align: "center" });
      s14.addText("Questions?", { x: 2.5, y: 2.6, w: 5, h: 0.5, fontSize: 28, color: "E5E7EB", align: "center" });
      s14.addText("westernintegrated.com", { x: 2, y: 3.3, w: 6, h: 0.5, fontSize: 22, color: "60A5FA", align: "center" });
      s14.addImage({ path: wisdmLogo, x: 4.4, y: 0.5, w: 1.2, h: 1.2 });

      await pptx.writeFile({ fileName: "WISDM_Sales_Presentation_Complete.pptx" });
    } catch (e: any) {
      setError(e?.message || "Failed to create PowerPoint");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    document.title = "Download PowerPoint - WISDM Presentation";
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container max-w-2xl mx-auto py-16">
      <h1 className="sr-only">Download PowerPoint Presentation</h1>
      <Card className="p-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold">Your comprehensive PowerPoint is ready.</p>
          <p className="text-sm text-muted-foreground">14 detailed slides with all sales presentation content.</p>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </div>
        <Button onClick={generate} disabled={downloading}>
          {downloading ? "Preparing..." : "Download again"}
        </Button>
      </Card>
    </main>
  );
};

export default PowerPointDownload;
