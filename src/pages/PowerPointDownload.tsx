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
          y: 0.6,
          w: 8,
          h: 1,
          fontSize: 36,
          bold: true,
          color: "FFFFFF",
        });
        slide.addText("Enterprise Document Processing Platform", {
          x: 0.5,
          y: 1.2,
          w: 8,
          h: 0.6,
          fontSize: 20,
          color: "FFFFFF",
        });
        slide.addImage({ path: wisdmLogo, x: 9.0, y: 0.4, w: 1.2, h: 1.2, transparency: 10 });
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

      bulletSlide(
        "AI-Powered Processing",
        [
          "OCR and handwriting recognition",
          "Automatic field and table extraction",
          "Document classification with confidence scores",
          "Barcode and QR detection",
        ],
        aiProcessing
      );

      bulletSlide(
        "Validation & Quality Control",
        [
          "Side-by-side review UI",
          "AI suggestions and keyboard shortcuts",
          "Region re-processing",
          "Redaction before export",
        ],
        validationWorkflow
      );

      bulletSlide(
        "Enterprise Integrations",
        [
          "FileBound and DMS exports",
          "PDF with embedded metadata",
          "CSV/Excel data exports",
          "Custom API integrations",
        ],
        integration
      );

      bulletSlide(
        "Revenue & Pricing",
        ["Recurring licenses", "Usage-based AI processing", "Integration services", "Support and training"],
        revenueGrowth
      );

      const thanks = pptx.addSlide();
      thanks.addText("Thank you!", { x: 3.5, y: 2.5, w: 3, h: 1, fontSize: 32, bold: true, color: "203040" });
      thanks.addText("westernintegrated.com", { x: 3.0, y: 3.3, w: 4, h: 0.6, fontSize: 16, color: "6b7280" });
      thanks.addImage({ path: wisdmLogo, x: 0.5, y: 0.5, w: 1.4, h: 1.4 });

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
