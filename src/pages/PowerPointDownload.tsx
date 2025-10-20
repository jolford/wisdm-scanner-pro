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
      pptx.title = "WISDM Scanner Pro - Presentation";

      const addTitleSlide = () => {
        const slide = pptx.addSlide();
        slide.addImage({ path: heroSlide, x: 0, y: 0, w: 10, h: 5.625 });
        slide.addText("WISDM Scanner Pro", {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 1,
          fontSize: 44,
          bold: true,
          color: "FFFFFF",
        });
        slide.addText("Enterprise Document Processing Platform", {
          x: 0.5,
          y: 2.3,
          w: 9,
          h: 0.6,
          fontSize: 24,
          color: "FFFFFF",
        });
        slide.addText("AI-Powered • Cloud-Native • Enterprise-Ready", {
          x: 0.5,
          y: 3.0,
          w: 9,
          h: 0.5,
          fontSize: 18,
          color: "E5E7EB",
        });
        slide.addImage({ path: wisdmLogo, x: 0.5, y: 0.4, w: 1.2, h: 1.2, transparency: 10 });
      };

      const bulletSlide = (title: string, bullets: string[], bg?: string) => {
        const slide = pptx.addSlide();
        if (bg) {
          slide.addImage({ path: bg, x: 0, y: 0, w: 10, h: 5.625, transparency: 50 });
        }
        
        // Add semi-transparent white background box for content area
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.3,
          y: 0.3,
          w: 9.4,
          h: 5,
          fill: { color: "FFFFFF", transparency: 15 },
          line: { color: "E5E7EB", width: 1 },
        });
        
        slide.addText(title, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.7,
          fontSize: 32,
          bold: true,
          color: "1E293B",
        });
        
        slide.addText(bullets.map((b) => `• ${b}`).join("\n"), {
          x: 0.8,
          y: 1.4,
          w: 8.5,
          h: 3.8,
          fontSize: 20,
          color: "1E293B",
          lineSpacing: 24,
        });
      };

      addTitleSlide();

      // Problem & Solution
      const slide2 = pptx.addSlide();
      slide2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      slide2.addText("The Problem We Solve", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 32, bold: true, color: "1E293B" });
      slide2.addText("Current State:", { x: 0.5, y: 1.1, w: 4, h: 0.4, fontSize: 18, bold: true, color: "DC2626" });
      slide2.addText(
        "• Manual data entry is slow and error-prone\n• High processing costs ($0.50-2.00 per page)\n• Disconnected systems and workflows\n• No cost visibility or budget controls\n• Limited scalability",
        { x: 0.5, y: 1.5, w: 4, h: 2.5, fontSize: 16, color: "475569", lineSpacing: 18 }
      );
      slide2.addText("Our Solution:", { x: 5.2, y: 1.1, w: 4, h: 0.4, fontSize: 18, bold: true, color: "16A34A" });
      slide2.addText(
        "• AI-powered automatic data extraction\n• Transparent pricing ($0.10-0.50 per doc)\n• Unified platform with ECM integrations\n• Real-time cost tracking & budgets\n• Cloud-native architecture that scales",
        { x: 5.2, y: 1.5, w: 4, h: 2.5, fontSize: 16, color: "475569", lineSpacing: 18 }
      );

      // Core Features
      bulletSlide(
        "Core Features & Capabilities",
        [
          "Multi-Channel Capture: Physical scanners, uploads, batch processing",
          "AI-Powered OCR: 95%+ accuracy with barcode & field extraction",
          "Workflow Management: Project-based organization with job queue",
          "Document Separation: Auto-split using AI, barcodes, cover sheets",
          "Enterprise Export: FileBound, generic DMS, PDF, CSV formats",
          "Admin Controls: User management, licensing, cost tracking",
        ]
      );

      // Technical Architecture
      const slide4 = pptx.addSlide();
      slide4.addImage({ path: aiProcessing, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      slide4.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 15 }, line: { color: "E5E7EB", width: 1 } });
      slide4.addText("Technical Architecture", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B" });
      slide4.addText("Frontend: React + TypeScript, Vite, Tailwind CSS, PWA", { x: 0.8, y: 1.5, w: 8.5, h: 0.4, fontSize: 16, color: "1E293B" });
      slide4.addText("Backend: PostgreSQL, Edge Functions, Object Storage, Real-time", { x: 0.8, y: 2.0, w: 8.5, h: 0.4, fontSize: 16, color: "1E293B" });
      slide4.addText("AI Processing: Google Gemini Pro/Flash, OpenAI GPT-5 models", { x: 0.8, y: 2.5, w: 8.5, h: 0.4, fontSize: 16, color: "1E293B" });
      slide4.addText("Security: Row-level security, encryption at rest & transit, audit logging", { x: 0.8, y: 3.0, w: 8.5, h: 0.4, fontSize: 16, color: "1E293B" });
      slide4.addText("30+ Database Tables | 7+ Edge Functions | API-First Design", { x: 0.8, y: 3.7, w: 8.5, h: 0.4, fontSize: 16, bold: true, color: "2563EB" });

      // Pricing Tiers
      const slide5 = pptx.addSlide();
      slide5.addImage({ path: revenueGrowth, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      slide5.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 10 }, line: { color: "E5E7EB", width: 1 } });
      slide5.addText("Pricing Strategy", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B" });
      
      slide5.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.5, w: 2.7, h: 2.8, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      slide5.addText("Small Business", { x: 0.8, y: 1.6, w: 2.5, h: 0.4, fontSize: 18, bold: true, color: "1E293B" });
      slide5.addText("1,000 docs/month\nBasic OCR\nEmail support", { x: 0.8, y: 2.1, w: 2.5, h: 1.2, fontSize: 14, color: "475569", lineSpacing: 16 });
      slide5.addText("$299/month", { x: 0.8, y: 3.6, w: 2.5, h: 0.5, fontSize: 20, bold: true, color: "2563EB" });

      slide5.addShape(pptx.ShapeType.rect, { x: 3.65, y: 1.5, w: 2.7, h: 2.8, fill: { color: "DBEAFE" }, line: { color: "1D4ED8", width: 3 } });
      slide5.addText("Mid-Market", { x: 3.75, y: 1.6, w: 2.5, h: 0.4, fontSize: 18, bold: true, color: "1E293B" });
      slide5.addText("10,000 docs/month\nAdvanced AI\n2 ECM integrations\nPriority support", { x: 3.75, y: 2.1, w: 2.5, h: 1.3, fontSize: 14, color: "475569", lineSpacing: 16 });
      slide5.addText("$1,499/month", { x: 3.75, y: 3.6, w: 2.5, h: 0.5, fontSize: 20, bold: true, color: "1D4ED8" });

      slide5.addShape(pptx.ShapeType.rect, { x: 6.6, y: 1.5, w: 2.7, h: 2.8, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      slide5.addText("Enterprise", { x: 6.7, y: 1.6, w: 2.5, h: 0.4, fontSize: 18, bold: true, color: "1E293B" });
      slide5.addText("100K+ docs/month\nPremium AI\nUnlimited integrations\nDedicated manager", { x: 6.7, y: 2.1, w: 2.5, h: 1.3, fontSize: 14, color: "475569", lineSpacing: 16 });
      slide5.addText("Custom Pricing", { x: 6.7, y: 3.6, w: 2.5, h: 0.5, fontSize: 18, bold: true, color: "16A34A" });

      // ROI Example
      const slide6 = pptx.addSlide();
      slide6.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      slide6.addText("ROI Example: 10,000 Documents/Month", { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 28, bold: true, color: "1E293B" });
      
      slide6.addText("Current State (Manual):", { x: 0.5, y: 1.2, w: 4, h: 0.4, fontSize: 16, bold: true, color: "DC2626" });
      slide6.addText(
        "Labor: 833 hrs × $20 = $16,660\nRework (5% error): $2,500\nTotal: $19,160/month",
        { x: 0.5, y: 1.6, w: 4, h: 1.2, fontSize: 15, color: "475569", lineSpacing: 18 }
      );

      slide6.addText("With WISDM Scanner Pro:", { x: 5.2, y: 1.2, w: 4, h: 0.4, fontSize: 16, bold: true, color: "16A34A" });
      slide6.addText(
        "License: $1,499\nLabor: 167 hrs × $20 = $3,340\nRework (<1% error): $333\nTotal: $5,172/month",
        { x: 5.2, y: 1.6, w: 4, h: 1.3, fontSize: 15, color: "475569", lineSpacing: 18 }
      );

      slide6.addShape(pptx.ShapeType.rect, { x: 1.5, y: 3.4, w: 7, h: 1.5, fill: { color: "DBEAFE" }, line: { color: "2563EB", width: 2 } });
      slide6.addText("Monthly Savings: $13,988", { x: 2, y: 3.6, w: 6, h: 0.4, fontSize: 20, bold: true, color: "1E293B" });
      slide6.addText("Annual Savings: $167,856  |  ROI: 1,017%", { x: 2, y: 4.1, w: 6, h: 0.5, fontSize: 18, color: "2563EB", align: "center" });

      // Market Opportunity
      const slide7 = pptx.addSlide();
      slide7.addImage({ path: integration, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      slide7.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 15 }, line: { color: "E5E7EB", width: 1 } });
      slide7.addText("Market Opportunity", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 32, bold: true, color: "1E293B" });
      
      slide7.addText("Target Markets:", { x: 0.8, y: 1.4, w: 8.5, h: 0.4, fontSize: 18, bold: true, color: "1E293B" });
      slide7.addText("Healthcare • Legal • Financial Services • Government • Education • Real Estate", 
        { x: 0.8, y: 1.8, w: 8.5, h: 0.5, fontSize: 16, color: "475569" });

      slide7.addShape(pptx.ShapeType.rect, { x: 0.8, y: 2.5, w: 4, h: 1.2, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      slide7.addText("Document Management Market", { x: 1, y: 2.65, w: 3.6, h: 0.35, fontSize: 14, color: "475569" });
      slide7.addText("$8.5B", { x: 1, y: 3.0, w: 3.6, h: 0.5, fontSize: 28, bold: true, color: "2563EB" });
      slide7.addText("Growing 12% CAGR", { x: 1, y: 3.45, w: 3.6, h: 0.3, fontSize: 12, color: "64748B" });

      slide7.addShape(pptx.ShapeType.rect, { x: 5.2, y: 2.5, w: 4, h: 1.2, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      slide7.addText("Intelligent Doc Processing", { x: 5.4, y: 2.65, w: 3.6, h: 0.35, fontSize: 14, color: "475569" });
      slide7.addText("$2.1B → $9.1B", { x: 5.4, y: 3.0, w: 3.6, h: 0.5, fontSize: 24, bold: true, color: "16A34A" });
      slide7.addText("Expected by 2028", { x: 5.4, y: 3.45, w: 3.6, h: 0.3, fontSize: 12, color: "64748B" });

      // Competitive Advantages
      bulletSlide(
        "Why WISDM Stands Out",
        [
          "Modern Cloud-Native Architecture (no legacy infrastructure)",
          "AI-Powered with cutting-edge models (Gemini, GPT-5)",
          "Complete Cost Transparency with built-in tracking",
          "Flexible Licensing models adapt to customer needs",
          "Mobile-Ready PWA for field work",
          "API-First Design for easy integrations",
        ]
      );

      // Implementation
      const slide9 = pptx.addSlide();
      slide9.addImage({ path: validationWorkflow, x: 0, y: 0, w: 10, h: 5.625, transparency: 60 });
      slide9.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0.3, w: 9.4, h: 5, fill: { color: "FFFFFF", transparency: 12 }, line: { color: "E5E7EB", width: 1 } });
      slide9.addText("Implementation Timeline: 2-4 Weeks", { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 30, bold: true, color: "1E293B" });
      
      slide9.addText("Week 1: Setup & Configuration", { x: 0.8, y: 1.5, w: 8.5, h: 0.4, fontSize: 18, bold: true, color: "2563EB" });
      slide9.addText("Create accounts, configure licenses, set up projects", { x: 0.8, y: 1.9, w: 8.5, h: 0.3, fontSize: 14, color: "475569" });

      slide9.addText("Week 2: Integration & Testing", { x: 0.8, y: 2.4, w: 8.5, h: 0.4, fontSize: 18, bold: true, color: "2563EB" });
      slide9.addText("ECM connections, field mapping, workflow testing", { x: 0.8, y: 2.8, w: 8.5, h: 0.3, fontSize: 14, color: "475569" });

      slide9.addText("Week 3: Training", { x: 0.8, y: 3.3, w: 8.5, h: 0.4, fontSize: 18, bold: true, color: "2563EB" });
      slide9.addText("Admin training (2hrs), end-user training (1hr), documentation", { x: 0.8, y: 3.7, w: 8.5, h: 0.3, fontSize: 14, color: "475569" });

      slide9.addText("Week 4: Go-Live", { x: 0.8, y: 4.2, w: 8.5, h: 0.4, fontSize: 18, bold: true, color: "16A34A" });
      slide9.addText("First production batch, monitoring, ongoing support", { x: 0.8, y: 4.6, w: 8.5, h: 0.3, fontSize: 14, color: "475569" });

      // Next Steps
      const slide10 = pptx.addSlide();
      slide10.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "F8FAFC" } });
      slide10.addText("Next Steps", { x: 0.5, y: 0.6, w: 9, h: 0.7, fontSize: 36, bold: true, color: "1E293B" });
      
      slide10.addShape(pptx.ShapeType.rect, { x: 1, y: 1.8, w: 8, h: 0.6, fill: { color: "EFF6FF" }, line: { color: "3B82F6", width: 2 } });
      slide10.addText("📅 Schedule a Personalized Demo", { x: 1.3, y: 1.95, w: 7.5, h: 0.3, fontSize: 18, bold: true, color: "1E293B" });

      slide10.addShape(pptx.ShapeType.rect, { x: 1, y: 2.6, w: 8, h: 0.6, fill: { color: "F0FDF4" }, line: { color: "16A34A", width: 2 } });
      slide10.addText("🚀 Start Free Trial (500 documents included)", { x: 1.3, y: 2.75, w: 7.5, h: 0.3, fontSize: 18, bold: true, color: "1E293B" });

      slide10.addShape(pptx.ShapeType.rect, { x: 1, y: 3.4, w: 8, h: 0.6, fill: { color: "FEF3C7" }, line: { color: "F59E0B", width: 2 } });
      slide10.addText("📊 Request Custom ROI Analysis", { x: 1.3, y: 3.55, w: 7.5, h: 0.3, fontSize: 18, bold: true, color: "1E293B" });

      slide10.addText("Contact: westernintegrated.com", { x: 3.5, y: 4.7, w: 3, h: 0.4, fontSize: 16, color: "64748B", align: "center" });

      const thanks = pptx.addSlide();
      thanks.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "1E293B" } });
      thanks.addText("Thank You!", { x: 3, y: 2, w: 4, h: 0.8, fontSize: 40, bold: true, color: "FFFFFF", align: "center" });
      thanks.addText("Questions?", { x: 3, y: 2.8, w: 4, h: 0.5, fontSize: 24, color: "E5E7EB", align: "center" });
      thanks.addText("westernintegrated.com", { x: 2.5, y: 3.5, w: 5, h: 0.5, fontSize: 20, color: "60A5FA", align: "center" });
      thanks.addImage({ path: wisdmLogo, x: 4.4, y: 0.8, w: 1.2, h: 1.2 });

      await pptx.writeFile({ fileName: "WISDM_Presentation.pptx" });
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
          <p className="font-semibold">Your PowerPoint is ready.</p>
          <p className="text-sm text-muted-foreground">If the download didn’t start, click the button below.</p>
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
