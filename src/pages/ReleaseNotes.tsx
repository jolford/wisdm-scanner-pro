import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Rocket, Zap, Shield, TrendingUp, Calendar, Package } from "lucide-react";

export default function ReleaseNotes() {
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
          <div className="flex items-center justify-center gap-4 mt-6">
            <Badge variant="default" className="text-sm py-1.5">
              <Calendar className="h-3 w-3 mr-1" />
              Version 2.2.0
            </Badge>
            <Badge variant="outline" className="text-sm py-1.5">
              November 2024
            </Badge>
          </div>
        </div>

        {/* Latest Release Highlight */}
        <Card className="mb-8 border-primary/50 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Zap className="h-6 w-6 text-primary" />
                  Latest: Phase 2 - Automation & Advanced Validation
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Enhanced automation capabilities with intelligent duplicate detection, customizable validation rules, and scheduled batch processing
                </CardDescription>
              </div>
              <Badge variant="default">Latest</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Duplicate Detection</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Intelligent similarity scoring with Jaro-Winkler and Levenshtein algorithms
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Validation Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Custom field-level validation with regex, range, and lookup rules
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Scheduled Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Automated batch processing on daily, weekly, or monthly schedules
                  </p>
                </CardContent>
              </Card>
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
              {/* Phase 2 */}
              <AccordionItem value="phase2">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-3">
                    <Badge>v2.2.0</Badge>
                    <span>Phase 2: Automation & Advanced Validation</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Duplicate Detection System
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Real-time duplicate detection across batches</li>
                      <li>• Similarity scoring with configurable thresholds (90%+ critical, 70%+ warning)</li>
                      <li>• Review dashboard with confirm/dismiss workflow</li>
                      <li>• Name similarity using Jaro-Winkler algorithm</li>
                      <li>• Address similarity using Levenshtein distance</li>
                      <li>• Matching field highlights and detailed comparison</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Field-Level Validation Rules
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Custom validation rules per project and document type</li>
                      <li>• Multiple rule types: regex, range, required, lookup, format, custom</li>
                      <li>• Severity levels: error, warning, info</li>
                      <li>• Active/inactive rule toggling</li>
                      <li>• JSON-based rule configuration with visual editor</li>
                      <li>• Per-field custom error messages</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Scheduled Batch Processing
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Automated batch processing at specific times</li>
                      <li>• Daily, weekly, and monthly scheduling options</li>
                      <li>• Project-based schedule configuration</li>
                      <li>• Last run tracking and next run calculation</li>
                      <li>• Export type selection per schedule</li>
                      <li>• Active/inactive schedule management</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Phase 1 */}
              <AccordionItem value="phase1">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-3">
                    <Badge>v2.1.0</Badge>
                    <span>Phase 1: Quality Assurance & Monitoring</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Webhook Notification System
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Real-time HTTP webhooks for batch and validation events</li>
                      <li>• HMAC-SHA256 signature verification for security</li>
                      <li>• Retry logic with exponential backoff (3 attempts)</li>
                      <li>• Custom headers and authentication support</li>
                      <li>• Webhook health monitoring and testing</li>
                      <li>• Detailed delivery logs and response tracking</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Confidence Scoring Dashboard
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Visual confidence score distribution analytics</li>
                      <li>• Low-confidence document identification</li>
                      <li>• Field-level confidence tracking</li>
                      <li>• Batch-level confidence aggregation</li>
                      <li>• Filtering by confidence thresholds</li>
                      <li>• Trend analysis over time</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Exception Handling Workflow
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Centralized queue for validation failures</li>
                      <li>• Exception severity levels (low, medium, high, critical)</li>
                      <li>• Assignment and resolution workflow</li>
                      <li>• Detailed exception descriptions and context</li>
                      <li>• Status management (pending, in-progress, resolved, dismissed)</li>
                      <li>• Resolution tracking with notes</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Zonal System */}
              <AccordionItem value="zonal">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-3">
                    <Badge>v2.0.0</Badge>
                    <span>Zonal OCR Extraction System</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Zone Template Management
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Visual zone editor with drag-and-draw interface</li>
                      <li>• Reusable templates for different document types</li>
                      <li>• Field type configuration (text, number, date, currency)</li>
                      <li>• Validation pattern support with regex</li>
                      <li>• Template activation and management</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Anchor-Based Positioning
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Anchor text detection for position stability</li>
                      <li>• Zones relative to document content, not fixed coordinates</li>
                      <li>• Automatic fallback to absolute positioning</li>
                      <li>• Resilient to document layout variations</li>
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Barcode Detection
                    </h4>
                    <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
                      <li>• Multi-format support (QR, Code 128, Code 39, EAN, UPC)</li>
                      <li>• Confidence scoring for each detection</li>
                      <li>• Position and value extraction</li>
                      <li>• Built-in testing tool</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Coming Soon */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              What's Coming Next
            </CardTitle>
            <CardDescription>Planned features in development</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Phase 3: Bulk Operations & Analytics</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Bulk edit mode for multiple documents</li>
                  <li>• Document comparison view</li>
                  <li>• Quality assurance metrics dashboard</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Phase 4: Smart Search</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• AI-powered semantic search</li>
                  <li>• Natural language queries</li>
                  <li>• Cross-document intelligence</li>
                </ul>
              </div>
            </div>
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
                <p className="text-muted-foreground">5 new tables with RLS policies</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Edge Functions</p>
                <p className="text-muted-foreground">4 new serverless functions</p>
              </div>
              <div>
                <p className="font-semibold mb-1">UI Components</p>
                <p className="text-muted-foreground">6 new admin interfaces</p>
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
      </div>
    </div>
  );
}
