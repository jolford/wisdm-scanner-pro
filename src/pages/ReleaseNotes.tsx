import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Rocket, Zap, Shield, TrendingUp, Calendar, Package } from "lucide-react";
import { format } from "date-fns";

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
            <div className="flex items-center justify-center gap-4 mt-6">
              <Badge variant="default" className="text-sm py-1.5">
                <Calendar className="h-3 w-3 mr-1" />
                Version {latestRelease.version}
              </Badge>
              <Badge variant="outline" className="text-sm py-1.5">
                {format(new Date(latestRelease.release_date), "MMMM yyyy")}
              </Badge>
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
                  {/* Latest Release Details */}
                  <AccordionItem value={latestRelease.id}>
                    <AccordionTrigger className="text-lg font-semibold">
                      <div className="flex items-center gap-3">
                        <Badge>{latestRelease.version}</Badge>
                        <span>{latestRelease.version_name}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                      {(latestRelease.features as any[])?.map((feature: any, idx: number) => (
                        <div key={idx}>
                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            {feature.section}
                          </h4>
                          <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                            {feature.items?.map((item: string, itemIdx: number) => (
                              <li key={itemIdx}>• {item}</li>
                            ))}
                          </ul>
                          {idx < ((latestRelease.features as any[])?.length - 1) && <Separator className="mt-6" />}
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Older Releases */}
                  {olderReleases.map((release: any) => (
                    <AccordionItem key={release.id} value={release.id}>
                      <AccordionTrigger className="text-lg font-semibold">
                        <div className="flex items-center gap-3">
                          <Badge>{release.version}</Badge>
                          <span>{release.version_name}</span>
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
