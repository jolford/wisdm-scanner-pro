import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Rocket, Zap, Shield, TrendingUp, Calendar, Package, Download } from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";

// Helper function to compare semantic versions
const compareVersions = (a: string, b: string): number => {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (aPart > bPart) return -1; // Descending order (newer first)
    if (aPart < bPart) return 1;
  }
  
  return 0;
};

export default function ReleaseNotes() {
  const { data: releases, isLoading } = useQuery({
    queryKey: ["release-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("release_notes")
        .select("*")
        .eq("status", "published")
        .order("release_date", { ascending: false });
      if (error) throw error;
      
      // Sort by semantic version (descending)
      return data?.sort((a, b) => compareVersions(a.version, b.version)) || [];
    },
  });

  const latestRelease = releases?.find(r => r.is_latest) || releases?.[0];
  const olderReleases = releases?.filter(r => r.id !== latestRelease?.id) || [];

  const handleDownloadPDF = () => {
    if (!releases || releases.length === 0) return;

    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(20);
    doc.text("WISDM Capture Pro - Release Notes", margin, yPos);
    yPos += 15;

    releases.forEach((release: any, releaseIndex: number) => {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Version header
      doc.setFontSize(16);
      doc.text(`Version ${release.version} - ${release.version_name}`, margin, yPos);
      yPos += 7;

      doc.setFontSize(10);
      doc.text(`Released: ${format(new Date(release.release_date), "MMMM d, yyyy")}`, margin, yPos);
      yPos += 10;

      // Description
      doc.setFontSize(11);
      const descLines = doc.splitTextToSize(release.description, maxWidth);
      doc.text(descLines, margin, yPos);
      yPos += descLines.length * 5 + 5;

      // Features
      if (release.features && Array.isArray(release.features)) {
        release.features.forEach((feature: any) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(12);
          doc.text(feature.section, margin, yPos);
          yPos += 6;

          doc.setFontSize(10);
          feature.items?.forEach((item: string) => {
            const itemLines = doc.splitTextToSize(`• ${item}`, maxWidth - 5);
            if (yPos + itemLines.length * 5 > 280) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(itemLines, margin + 5, yPos);
            yPos += itemLines.length * 5;
          });
          yPos += 3;
        });
      }

      yPos += 10;
    });

    doc.save(`WISDM-Release-Notes-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Rocket className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Release Notes</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay up to date with the latest features, improvements, and updates to WISDM Capture Pro
          </p>
          {latestRelease && (
            <div className="flex flex-col items-center gap-4 mt-6">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="text-sm py-1.5">
                  <Calendar className="h-3 w-3 mr-1" />
                  Version {latestRelease.version}
                </Badge>
                <Badge variant="outline" className="text-sm py-1.5">
                  {format(new Date(latestRelease.release_date), "MMMM yyyy")}
                </Badge>
              </div>
              <Button onClick={handleDownloadPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Release Notes
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading releases...</div>
        ) : !latestRelease ? (
          <div className="text-center py-12 text-muted-foreground">No releases available yet.</div>
        ) : (
          <>
            {/* Latest Release Highlight */}
            <Card className="mb-8 border-primary/50 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Zap className="h-6 w-6 text-primary" />
                      Latest: {latestRelease.version_name}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      {latestRelease.description}
                    </CardDescription>
                  </div>
                  <Badge variant="default">Latest</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {(latestRelease.highlights as any[])?.map((highlight: any, idx: number) => (
                    <Card key={idx}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">{highlight.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {highlight.description}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Release History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Release History
                </CardTitle>
                <CardDescription>Complete changelog of all major releases</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {/* Sorted Releases */}
                  {releases?.map((release: any) => (
                    <AccordionItem key={release.id} value={release.id}>
                      <AccordionTrigger className="text-lg font-semibold">
                        <div className="flex items-center gap-3">
                          <Badge>{release.version}</Badge>
                          <span className="flex items-center gap-2">
                            {release.version_name}
                            {release.id === latestRelease?.id && (
                              <Badge variant="default">Latest</Badge>
                            )}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-6 pt-4">
                        {(release.features as any[])?.map((feature: any, idx: number) => (
                          <div key={idx}>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              {feature.section}
                            </h4>
                            <ul className="space-y-2 ml-6 text-muted-foreground">
                              {feature.items?.map((item: string, itemIdx: number) => (
                                <li key={itemIdx}>• {item}</li>
                              ))}
                            </ul>
                            {idx < ((release.features as any[])?.length - 1) && <Separator className="mt-6" />}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Technical Details */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Technical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-semibold mb-1">Database Updates</p>
                    <p className="text-muted-foreground">New tables with RLS policies</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Edge Functions</p>
                    <p className="text-muted-foreground">Serverless backend functions</p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">UI Components</p>
                    <p className="text-muted-foreground">New admin interfaces</p>
                  </div>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold mb-2">Compatibility</p>
                  <p>Browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</p>
                  <p>Devices: Desktop, tablet, mobile (responsive)</p>
                  <p>File Formats: PNG, JPEG, TIFF, BMP, WEBP, PDF</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
