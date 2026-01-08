import { ArrowLeft, Layers, Shield, Zap, Target, Lightbulb, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">About AxiomIQ</h1>
              <p className="text-muted-foreground">Intelligent automation built on trusted information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section */}
        <section className="mb-16">
          <p className="text-xl text-muted-foreground leading-relaxed">
            AxiomIQ is an intelligent automation platform built on trusted information.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            Modern organizations run on documents — invoices, forms, applications, records, and data that arrive from everywhere and in every format. But too often, that information enters systems late, incomplete, or unverified. Automation starts downstream, after humans clean things up.
          </p>
          <p className="text-xl font-semibold text-primary mt-6">
            AxiomIQ changes that.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            We focus on the very first moment information enters the business — capturing, validating, and structuring it so everything that follows is faster, more accurate, and more reliable.
          </p>
        </section>

        <Separator className="my-12" />

        {/* Built on First Principles */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Built on First Principles</h2>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            An axiom is a fundamental truth — something you can build on with confidence.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            AxiomIQ is designed around the idea that automation, AI, and workflows should be grounded in verified, structured information, not assumptions. By establishing trusted data at intake, organizations can scale automation without increasing risk or complexity.
          </p>
          <Card className="mt-6 bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <p className="text-lg font-semibold text-center text-foreground">
                In short: <span className="text-primary">better inputs → better intelligence → better outcomes.</span>
              </p>
            </CardContent>
          </Card>
        </section>

        <Separator className="my-12" />

        {/* One Platform */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">One Platform. Multiple Capabilities.</h2>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            AxiomIQ is a modular platform designed to grow with your organization.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            From intelligent document capture and validation to workflow automation, analytics, and integration, AxiomIQ provides a unified foundation for information-driven systems.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4 font-medium">
            Today, that includes:
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Capture Pro</h3>
                <p className="text-muted-foreground">Intelligent document ingestion, OCR, and validation</p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Admin & Configuration</h3>
                <p className="text-muted-foreground">Centralized control, security, and governance</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed mt-6">
            And tomorrow, it expands seamlessly as new capabilities are added — without re-architecting your stack.
          </p>
        </section>

        <Separator className="my-12" />

        {/* Enterprise by Design */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Enterprise by Design</h2>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            AxiomIQ is built for real-world enterprise environments:
          </p>
          <ul className="mt-6 space-y-3">
            <li className="flex items-center gap-3 text-lg text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              Deployment flexibility (cloud, hybrid, on-prem)
            </li>
            <li className="flex items-center gap-3 text-lg text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              Role-based access and security controls
            </li>
            <li className="flex items-center gap-3 text-lg text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              Integration-first architecture
            </li>
            <li className="flex items-center gap-3 text-lg text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              Scalable, multi-tenant foundations
            </li>
          </ul>
          <p className="text-lg text-muted-foreground leading-relaxed mt-6">
            Whether you're automating a single process or standardizing information intake across the organization, AxiomIQ adapts to how you work — not the other way around.
          </p>
        </section>

        <Separator className="my-12" />

        {/* Our Philosophy */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Our Philosophy</h2>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            We believe:
          </p>
          <div className="space-y-4">
            <Card className="border-l-4 border-l-primary transition-all duration-200 hover:shadow-md hover:bg-primary/5">
              <CardContent className="p-4">
                <p className="text-foreground">Automation should start at intake, not downstream</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary transition-all duration-200 hover:shadow-md hover:bg-primary/5">
              <CardContent className="p-4">
                <p className="text-foreground">Intelligence should be explainable and dependable</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary transition-all duration-200 hover:shadow-md hover:bg-primary/5">
              <CardContent className="p-4">
                <p className="text-foreground">Platforms should feel simple, even when doing complex work</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary transition-all duration-200 hover:shadow-md hover:bg-primary/5">
              <CardContent className="p-4">
                <p className="text-foreground">Technology should reduce friction — not introduce new layers of it</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed mt-6 font-medium">
            AxiomIQ exists to make information usable from the moment it arrives.
          </p>
        </section>

        <Separator className="my-12" />

        {/* Looking Forward */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Looking Forward</h2>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            As organizations adopt more automation and AI, the quality of underlying information becomes the defining factor for success.
          </p>
          <Card className="mt-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <p className="text-xl font-semibold text-center text-foreground">
                AxiomIQ is built to be that foundation — today and for what comes next.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default About;
