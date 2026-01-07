import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  FileCode, 
  Network, 
  LayoutGrid, 
  Cloud, 
  Shield, 
  Map, 
  Scale,
  Download,
  ExternalLink,
  ChevronRight,
  Server,
  Lock,
  Users,
  Building2,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { Link } from "react-router-dom";

const EnterpriseInfo = () => {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    document.title = "Enterprise Information | WISDM Scanner Pro";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl">
            <Badge variant="outline" className="mb-4">Enterprise Documentation</Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              WISDM Scanner Pro
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Enterprise-grade document capture and AI processing platform. 
              Built for scale, security, and seamless integration.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <a href="/downloads/WISDM-Enterprise-Package.zip" download>
                  <Download className="mr-2 h-4 w-4" />
                  Download Full Package
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/api-docs">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  API Documentation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { icon: FileCode, label: "Source Code", tab: "source" },
            { icon: Network, label: "Architecture", tab: "architecture" },
            { icon: LayoutGrid, label: "Features", tab: "features" },
            { icon: Cloud, label: "Deployment", tab: "deployment" },
            { icon: Shield, label: "Security", tab: "security" },
            { icon: Map, label: "Roadmap", tab: "roadmap" },
            { icon: Scale, label: "IP & Licensing", tab: "licensing" },
          ].map(({ icon: Icon, label, tab }) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              className="flex flex-col h-auto py-4 gap-2"
              onClick={() => setActiveTab(tab)}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-16">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="hidden">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="deployment">Deployment</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            <TabsTrigger value="licensing">Licensing</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("source")}>
                <CardHeader>
                  <FileCode className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Source Code</CardTitle>
                  <CardDescription>Clean, documented repository with full codebase access</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("architecture")}>
                <CardHeader>
                  <Network className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Architecture</CardTitle>
                  <CardDescription>System architecture diagrams and component details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("features")}>
                <CardHeader>
                  <LayoutGrid className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Feature Matrix</CardTitle>
                  <CardDescription>Complete feature comparison across all tiers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("deployment")}>
                <CardHeader>
                  <Cloud className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Deployment</CardTitle>
                  <CardDescription>On-prem, cloud, and hybrid deployment options</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("security")}>
                <CardHeader>
                  <Shield className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Security Posture</CardTitle>
                  <CardDescription>Auth, audit, isolation, and compliance details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("roadmap")}>
                <CardHeader>
                  <Map className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Roadmap</CardTitle>
                  <CardDescription>12-18 month product roadmap and vision</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("licensing")}>
                <CardHeader>
                  <Scale className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>IP & Licensing</CardTitle>
                  <CardDescription>Clear IP ownership and licensing terms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    View details <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Source Code Tab */}
          <TabsContent value="source" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="h-5 w-5" />
                  Source Code Repository
                </CardTitle>
                <CardDescription>Clean, well-documented codebase with comprehensive documentation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Technology Stack</h4>
                    <div className="space-y-2">
                      {[
                        { name: "Frontend", tech: "React 18, TypeScript, Vite, TailwindCSS" },
                        { name: "UI Components", tech: "shadcn/ui, Radix Primitives" },
                        { name: "State Management", tech: "TanStack Query, React Context" },
                        { name: "Backend", tech: "Deno Edge Functions, PostgreSQL" },
                        { name: "AI/ML", tech: "Google Gemini, OpenAI GPT-5" },
                        { name: "Auth", tech: "JWT, SAML 2.0, SCIM 2.0" },
                      ].map(({ name, tech }) => (
                        <div key={name} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-mono text-xs">{tech}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Repository Structure</h4>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
{`wisdm-scanner-pro/
├── src/
│   ├── components/    # React components
│   ├── pages/         # Page routes
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Utilities
│   └── i18n/          # Translations
├── supabase/
│   ├── functions/     # Edge functions
│   └── migrations/    # DB migrations
├── docs/              # Documentation
└── public/            # Static assets`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Documentation</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { name: "README.md", desc: "Getting started guide" },
                      { name: "API_DOCUMENTATION.md", desc: "REST API reference" },
                      { name: "SECURITY_GUIDE.md", desc: "Security best practices" },
                      { name: "ARCHITECTURE.md", desc: "System architecture" },
                      { name: "DEPLOYMENT.md", desc: "Deployment guides" },
                      { name: "CONTRIBUTING.md", desc: "Development workflow" },
                    ].map(({ name, desc }) => (
                      <div key={name} className="p-3 border rounded-lg">
                        <div className="font-mono text-sm">{name}</div>
                        <div className="text-xs text-muted-foreground">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Architecture Tab */}
          <TabsContent value="architecture" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  System Architecture
                </CardTitle>
                <CardDescription>Multi-layer architecture designed for scale and security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted p-6 rounded-lg overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Web App    │  │  Mobile PWA  │  │ Scanner App  │  │   REST API   │    │
│  │   (React)    │  │   (React)    │  │  (Electron)  │  │   Clients    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │                 │
          └─────────────────┴────────┬────────┴─────────────────┘
                                     │ HTTPS/WSS
┌────────────────────────────────────┼────────────────────────────────────────┐
│                          API GATEWAY LAYER                                  │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐ │
│  │  Edge Functions: Auth • Rate Limiting • Validation • CORS             │ │
│  └─────────────────────────────────┬─────────────────────────────────────┘ │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                        PROCESSING LAYER                                     │
│  ┌─────────────────┐  ┌────────────┴─────────────┐  ┌─────────────────┐    │
│  │  OCR Engine     │  │   Business Logic         │  │  AI Services    │    │
│  │  Gemini/GPT-5   │  │   Queue • Validation     │  │  Classification │    │
│  └─────────────────┘  └──────────────────────────┘  └─────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                          DATA LAYER                                         │
│  ┌─────────────────┐  ┌────────────┴─────────────┐  ┌─────────────────┐    │
│  │   PostgreSQL    │  │     Object Storage       │  │   Real-time     │    │
│  │   + RLS         │  │     (S3 Compatible)      │  │   WebSocket     │    │
│  └─────────────────┘  └──────────────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘`}
                  </pre>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Scalability</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Stateless edge functions auto-scale
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Database connection pooling
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        CDN for static assets
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        10,000+ concurrent users
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Performance Targets</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">API Response (p95)</span>
                        <span className="font-mono">&lt; 200ms</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">OCR Processing</span>
                        <span className="font-mono">&lt; 10s/page</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Uptime SLA</span>
                        <span className="font-mono">99.9%</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-muted-foreground">Throughput</span>
                        <span className="font-mono">100K+ docs/day</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Feature Matrix
                </CardTitle>
                <CardDescription>Complete feature comparison across all tiers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Feature</th>
                        <th className="text-center py-3 px-2">Standard</th>
                        <th className="text-center py-3 px-2">Professional</th>
                        <th className="text-center py-3 px-2">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { category: "Document Capture", features: [
                          { name: "Web upload", std: true, pro: true, ent: true },
                          { name: "Mobile PWA", std: true, pro: true, ent: true },
                          { name: "Scanner integration", std: false, pro: true, ent: true },
                          { name: "Hot folder monitoring", std: false, pro: true, ent: true },
                          { name: "Email/Fax import", std: false, pro: false, ent: true },
                        ]},
                        { category: "AI/OCR", features: [
                          { name: "Text extraction", std: true, pro: true, ent: true },
                          { name: "Multi-language (12+)", std: true, pro: true, ent: true },
                          { name: "Handwriting recognition", std: false, pro: true, ent: true },
                          { name: "Zonal extraction", std: false, pro: true, ent: true },
                          { name: "Custom AI prompts", std: false, pro: false, ent: true },
                        ]},
                        { category: "Security", features: [
                          { name: "Email/password auth", std: true, pro: true, ent: true },
                          { name: "MFA (TOTP)", std: true, pro: true, ent: true },
                          { name: "SAML SSO", std: false, pro: false, ent: true },
                          { name: "SCIM provisioning", std: false, pro: false, ent: true },
                          { name: "Custom roles", std: false, pro: false, ent: true },
                        ]},
                        { category: "Integrations", features: [
                          { name: "CSV/JSON export", std: true, pro: true, ent: true },
                          { name: "FileBound/SharePoint", std: false, pro: true, ent: true },
                          { name: "REST API", std: false, pro: true, ent: true },
                          { name: "Webhooks", std: false, pro: true, ent: true },
                          { name: "ResWare/Documentum", std: false, pro: false, ent: true },
                        ]},
                      ].map(({ category, features }) => (
                        <>
                          <tr key={category} className="bg-muted/50">
                            <td colSpan={4} className="py-2 px-2 font-semibold">{category}</td>
                          </tr>
                          {features.map(({ name, std, pro, ent }) => (
                            <tr key={name}>
                              <td className="py-2 px-2">{name}</td>
                              <td className="text-center py-2 px-2">
                                {std ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="text-center py-2 px-2">
                                {pro ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="text-center py-2 px-2">
                                {ent ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deployment Tab */}
          <TabsContent value="deployment" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <Cloud className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Cloud (SaaS)</CardTitle>
                  <CardDescription>Fully managed, auto-scaling infrastructure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      No infrastructure management
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Automatic updates
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Multi-tenant with isolation
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Pay-as-you-go pricing
                    </li>
                  </ul>
                  <Badge>Recommended for most customers</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Building2 className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Dedicated Cloud</CardTitle>
                  <CardDescription>Single-tenant in your chosen region</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Isolated infrastructure
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Data residency compliance
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Custom network config
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Dedicated support
                    </li>
                  </ul>
                  <Badge variant="outline">Enterprise tier</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Server className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>On-Premises</CardTitle>
                  <CardDescription>Full control in your data center</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Complete data sovereignty
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Air-gap capable
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Custom security policies
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Local LLM support
                    </li>
                  </ul>
                  <Badge variant="outline">Enterprise tier</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex gap-2 mb-2">
                    <Cloud className="h-8 w-8 text-primary" />
                    <Server className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle>Hybrid</CardTitle>
                  <CardDescription>Local capture, cloud processing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Best of both worlds
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Gradual cloud migration
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Branch office support
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Flexible data residency
                    </li>
                  </ul>
                  <Badge variant="outline">Enterprise tier</Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <Lock className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Email/Password
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    MFA (TOTP)
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Google OAuth
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    SAML 2.0 SSO
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    SCIM 2.0 Provisioning
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Users className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Authorization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Role-Based Access (RBAC)
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Row-Level Security
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Tenant Isolation
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Custom Roles
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    IP Allowlisting
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Shield className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Compliance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    SOC 2 Type II
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ISO 27001
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    GDPR
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    HIPAA (BAA)
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">In Progress</Badge>
                    FedRAMP
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Encryption & Data Protection</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Data at Rest</h4>
                    <ul className="space-y-2 text-sm">
                      <li>Database: AES-256 TDE</li>
                      <li>Storage: AES-256 SSE</li>
                      <li>Backups: AES-256 (BYOK available)</li>
                      <li>Secrets: AES-256-GCM vault</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Data in Transit</h4>
                    <ul className="space-y-2 text-sm">
                      <li>Browser → CDN: TLS 1.3</li>
                      <li>CDN → Origin: TLS 1.3</li>
                      <li>Internal: mTLS</li>
                      <li>Database: TLS 1.3 + Cert Pinning</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Product Roadmap (12-18 Months)
                </CardTitle>
                <CardDescription>Planned features and improvements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {[
                  { quarter: "Q1 2025", status: "current", features: [
                    { name: "AI-Powered OCR (Gemini/GPT-5)", done: true },
                    { name: "Multi-Tenant Architecture", done: true },
                    { name: "ECM Integrations", done: true },
                    { name: "SAML SSO & SCIM", done: true },
                  ]},
                  { quarter: "Q2 2025", status: "next", features: [
                    { name: "AI Model Fine-Tuning", done: false },
                    { name: "Mobile App (iOS/Android)", done: false },
                    { name: "Advanced Analytics Dashboard", done: false },
                    { name: "DocuSign Integration", done: false },
                  ]},
                  { quarter: "Q3 2025", status: "planned", features: [
                    { name: "Document Classification ML", done: false },
                    { name: "Multi-Language UI", done: false },
                    { name: "FedRAMP Authorization", done: false },
                    { name: "Real-Time Collaboration", done: false },
                  ]},
                  { quarter: "Q4 2025", status: "planned", features: [
                    { name: "On-Premises Air-Gap Edition", done: false },
                    { name: "Local LLM Support (Ollama)", done: false },
                    { name: "Visual Workflow Designer", done: false },
                    { name: "Customer Self-Service Portal", done: false },
                  ]},
                ].map(({ quarter, status, features }) => (
                  <div key={quarter} className="relative pl-6 border-l-2 border-muted">
                    <div className={`absolute -left-2 w-4 h-4 rounded-full ${
                      status === "current" ? "bg-primary" : "bg-muted"
                    }`} />
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h4 className="font-semibold">{quarter}</h4>
                      {status === "current" && <Badge>Current</Badge>}
                      {status === "next" && <Badge variant="outline">Next</Badge>}
                    </div>
                    <ul className="space-y-2">
                      {features.map(({ name, done }) => (
                        <li key={name} className="flex items-center gap-2 text-sm">
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted" />
                          )}
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Licensing Tab */}
          <TabsContent value="licensing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  IP Ownership & Licensing
                </CardTitle>
                <CardDescription>Clear intellectual property and licensing terms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Platform IP</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      WISDM Scanner Pro and all associated IP is owned by WISDM Technologies, Inc.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between">
                        <span>Core Platform</span>
                        <Badge variant="outline">Proprietary</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span>Edge Functions</span>
                        <Badge variant="outline">Proprietary</Badge>
                      </li>
                      <li className="flex justify-between">
                        <span>Documentation</span>
                        <Badge variant="outline">CC BY-NC 4.0</Badge>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Your Data Rights</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      You own your data. WISDM claims no IP rights over your content.
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Full data export
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        API access to all data
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Right to deletion
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Migration assistance
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Licensing Models</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">SaaS Subscription</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Platform access, updates included, support per tier
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">On-Premises</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Perpetual or term license, binary distribution
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">OEM/White-Label</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Embed in your product, custom branding
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Source Code Options</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Source code escrow available
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Source license for strategic partners
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Open-source components list available
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer CTA */}
      <div className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Learn More?</h2>
            <p className="text-muted-foreground mb-6">
              Contact our enterprise team for detailed discussions, custom demos, or to request additional documentation.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg">
                Contact Sales
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/downloads">
                  Download Resources
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseInfo;
