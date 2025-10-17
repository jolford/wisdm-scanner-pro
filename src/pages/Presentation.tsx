import { useState } from "react";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroSlide from "@/assets/presentation/hero-slide.jpg";
import aiProcessing from "@/assets/presentation/ai-processing.jpg";
import validationWorkflow from "@/assets/presentation/validation-workflow.jpg";
import integration from "@/assets/presentation/integration.jpg";
import revenueGrowth from "@/assets/presentation/revenue-growth.jpg";
import wisdmLogo from "@/assets/wisdm-logo.png";

const slides = [
  {
    title: "WISDM Scanner Pro",
    subtitle: "Enterprise Document Processing Platform",
    image: heroSlide,
    content: (
      <div className="space-y-6">
        <h2 className="text-4xl font-bold text-foreground">Transform Your Document Workflow</h2>
        <p className="text-xl text-muted-foreground max-w-3xl">
          An all-in-one solution for intelligent document capture, processing, validation, and export
        </p>
        <div className="grid grid-cols-3 gap-6 mt-8">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">99.5%</div>
            <div className="text-sm text-muted-foreground">OCR Accuracy</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">10x</div>
            <div className="text-sm text-muted-foreground">Faster Processing</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">70%</div>
            <div className="text-sm text-muted-foreground">Cost Reduction</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "The Problem We Solve",
    subtitle: "Current Document Processing Challenges",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-destructive">Current State</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">✗</span>
                <span>Manual data entry - slow and error-prone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">✗</span>
                <span>Expensive per-page processing costs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">✗</span>
                <span>Disconnected systems and workflows</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">✗</span>
                <span>No visibility into processing costs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive mt-1">✗</span>
                <span>Limited scalability and flexibility</span>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-primary">Our Solution</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>AI-powered automatic data extraction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Transparent, predictable pricing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Unified platform with enterprise integrations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Real-time cost tracking and analytics</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Cloud-native architecture that scales</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "AI-Powered Processing",
    subtitle: "Intelligent Document Recognition & Extraction",
    image: aiProcessing,
    content: (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-foreground">Advanced AI Capabilities</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">OCR & Recognition</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• 99.5% accuracy using Google Gemini Pro</li>
              <li>• Multi-language support</li>
              <li>• Handwriting & cursive recognition</li>
              <li>• Barcode & QR code scanning</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">Data Extraction</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• Automatic field detection</li>
              <li>• Custom metadata extraction</li>
              <li>• Smart document separation</li>
              <li>• Region-specific re-processing</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 p-4 border-2 border-primary rounded-lg bg-primary/5">
          <h4 className="text-lg font-semibold text-primary mb-3">Automatic Document Classification</h4>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="p-2 bg-background rounded text-center">
              <div className="font-semibold">Invoices</div>
            </div>
            <div className="p-2 bg-background rounded text-center">
              <div className="font-semibold">Receipts</div>
            </div>
            <div className="p-2 bg-background rounded text-center">
              <div className="font-semibold">Purchase Orders</div>
            </div>
            <div className="p-2 bg-background rounded text-center">
              <div className="font-semibold">Checks</div>
            </div>
            <div className="p-2 bg-background rounded text-center">
              <div className="font-semibold">Forms</div>
            </div>
            <div className="p-2 bg-background rounded text-center">
              <div className="font-semibold">Letters</div>
            </div>
            <div className="p-2 bg-background rounded text-center col-span-2">
              <div className="font-semibold">+ More Document Types</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            AI automatically identifies document types with confidence scores during OCR processing
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "Validation & Quality Control",
    subtitle: "Human-in-the-Loop Workflow",
    image: validationWorkflow,
    content: (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-foreground">Ensure Accuracy & Compliance</h3>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold">1.</span>
            <span><strong>Review Interface:</strong> Side-by-side document and metadata view</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold">2.</span>
            <span><strong>Smart Suggestions:</strong> AI recommends field values for quick validation</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold">3.</span>
            <span><strong>Region Re-OCR:</strong> Select specific areas for re-processing</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold">4.</span>
            <span><strong>Redaction Tools:</strong> Black out sensitive information before export</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-primary font-bold">5.</span>
            <span><strong>Keyboard Shortcuts:</strong> Rapid validation with hotkeys</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: "Enterprise Integration",
    subtitle: "Seamless Export to Your Systems",
    image: integration,
    content: (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-foreground">Connect to Existing Infrastructure</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">Supported Exports</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• FileBound ECM</li>
              <li>• Generic Document Management APIs</li>
              <li>• PDF with embedded metadata</li>
              <li>• CSV/Excel data exports</li>
              <li>• Custom API integrations</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">Configuration</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• Project-specific field mapping</li>
              <li>• Automatic or manual export triggers</li>
              <li>• Document separation rules</li>
              <li>• Batch processing options</li>
              <li>• Real-time status monitoring</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Revenue Opportunities",
    subtitle: "Multiple Streams for Growth",
    image: revenueGrowth,
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">Revenue Streams</h3>
            <div className="space-y-3 text-sm">
              <div className="p-4 border rounded-lg bg-card">
                <div className="font-semibold">License Fees</div>
                <div className="text-muted-foreground">$50-500/user/month recurring</div>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <div className="font-semibold">AI Processing</div>
                <div className="text-muted-foreground">$0.01-0.05 per page processed</div>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <div className="font-semibold">Integration Setup</div>
                <div className="text-muted-foreground">$5,000-25,000 one-time</div>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <div className="font-semibold">Support & Training</div>
                <div className="text-muted-foreground">20% annual maintenance</div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">Example Pricing</h3>
            <div className="space-y-3 text-sm">
              <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                <div className="font-bold text-base mb-2">Small Business</div>
                <div className="text-muted-foreground">5 users, 10K pages/month</div>
                <div className="text-2xl font-bold text-primary mt-2">$750/mo</div>
              </div>
              <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                <div className="font-bold text-base mb-2">Mid-Market</div>
                <div className="text-muted-foreground">25 users, 100K pages/month</div>
                <div className="text-2xl font-bold text-primary mt-2">$6,250/mo</div>
              </div>
              <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                <div className="font-bold text-base mb-2">Enterprise</div>
                <div className="text-muted-foreground">100 users, 500K pages/month</div>
                <div className="text-2xl font-bold text-primary mt-2">$35,000/mo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Technical Architecture",
    subtitle: "Modern, Scalable, Cloud-Native",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">Frontend</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• React + TypeScript</li>
              <li>• Vite build system</li>
              <li>• Tailwind CSS</li>
              <li>• Progressive Web App</li>
              <li>• React Query</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">Backend</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• PostgreSQL database</li>
              <li>• Edge Functions</li>
              <li>• Object Storage</li>
              <li>• Real-time sync</li>
              <li>• Row Level Security</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-primary">AI Processing</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>• Google Gemini Pro</li>
              <li>• OpenAI GPT-4</li>
              <li>• PDF.js parsing</li>
              <li>• Image processing</li>
              <li>• Batch queuing</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 p-4 border rounded-lg bg-muted/30">
          <h4 className="font-semibold mb-2">Key Features</h4>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>• Multi-tenant architecture with row-level security</div>
            <div>• Real-time job queue processing</div>
            <div>• Comprehensive audit logging</div>
            <div>• Cost tracking and budgeting</div>
            <div>• Role-based access control</div>
            <div>• API-first design</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Market Opportunity",
    subtitle: "Target Industries & Growth Potential",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">Target Markets</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 border rounded bg-card">
                <div className="font-semibold">Healthcare</div>
                <div className="text-muted-foreground">Patient records, insurance claims, forms</div>
              </div>
              <div className="p-3 border rounded bg-card">
                <div className="font-semibold">Legal</div>
                <div className="text-muted-foreground">Case files, contracts, discovery documents</div>
              </div>
              <div className="p-3 border rounded bg-card">
                <div className="font-semibold">Financial Services</div>
                <div className="text-muted-foreground">Loan applications, statements, compliance</div>
              </div>
              <div className="p-3 border rounded bg-card">
                <div className="font-semibold">Government</div>
                <div className="text-muted-foreground">Permits, applications, public records</div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">Market Size</h3>
            <div className="space-y-4">
              <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                <div className="text-muted-foreground text-sm">Document Management Market</div>
                <div className="text-3xl font-bold text-primary">$8.5B</div>
                <div className="text-xs text-muted-foreground">Growing at 12% CAGR</div>
              </div>
              <div className="p-4 border-2 border-primary rounded-lg bg-primary/5">
                <div className="text-muted-foreground text-sm">Intelligent Document Processing</div>
                <div className="text-3xl font-bold text-primary">$2.1B</div>
                <div className="text-xs text-muted-foreground">Expected to reach $9.1B by 2028</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Competitive Advantages",
    subtitle: "Why WISDM Stands Out",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
            <h4 className="text-lg font-bold text-primary">Modern Architecture</h4>
            <p className="text-sm text-muted-foreground">
              Cloud-native design built on modern web technologies. No legacy infrastructure or
              on-premise installations required.
            </p>
          </div>
          <div className="p-6 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
            <h4 className="text-lg font-bold text-primary">AI-Powered</h4>
            <p className="text-sm text-muted-foreground">
              Leveraging the latest AI models from Google and OpenAI for superior accuracy and
              capabilities compared to traditional OCR.
            </p>
          </div>
          <div className="p-6 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
            <h4 className="text-lg font-bold text-primary">Cost Transparency</h4>
            <p className="text-sm text-muted-foreground">
              Real-time tracking of processing costs with budget controls. No surprise bills or
              hidden fees.
            </p>
          </div>
          <div className="p-6 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
            <h4 className="text-lg font-bold text-primary">Flexible Licensing</h4>
            <p className="text-sm text-muted-foreground">
              Multi-tenant platform supporting customer/project isolation with granular user
              permissions and budget controls.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "ROI Calculator",
    subtitle: "Typical Customer Savings",
    content: (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-destructive">Current Manual Process</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 border rounded">
                <span>Data entry staff (3 FTE)</span>
                <span className="font-semibold">$150,000/yr</span>
              </div>
              <div className="flex justify-between p-3 border rounded">
                <span>Error correction time</span>
                <span className="font-semibold">$25,000/yr</span>
              </div>
              <div className="flex justify-between p-3 border rounded">
                <span>Legacy software licenses</span>
                <span className="font-semibold">$20,000/yr</span>
              </div>
              <div className="flex justify-between p-3 border rounded">
                <span>IT maintenance</span>
                <span className="font-semibold">$15,000/yr</span>
              </div>
              <div className="flex justify-between p-4 border-2 border-destructive rounded bg-destructive/5 font-bold">
                <span>Total Annual Cost</span>
                <span className="text-destructive">$210,000</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-primary">With WISDM Scanner Pro</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 border rounded">
                <span>Validation staff (1 FTE)</span>
                <span className="font-semibold">$50,000/yr</span>
              </div>
              <div className="flex justify-between p-3 border rounded">
                <span>WISDM licenses (10 users)</span>
                <span className="font-semibold">$18,000/yr</span>
              </div>
              <div className="flex justify-between p-3 border rounded">
                <span>AI processing (100K pages)</span>
                <span className="font-semibold">$30,000/yr</span>
              </div>
              <div className="flex justify-between p-3 border rounded">
                <span>Support & maintenance</span>
                <span className="font-semibold">$5,000/yr</span>
              </div>
              <div className="flex justify-between p-4 border-2 border-primary rounded bg-primary/5 font-bold">
                <span>Total Annual Cost</span>
                <span className="text-primary">$103,000</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-4 border-primary rounded-lg bg-primary/10 text-center">
          <div className="text-sm text-muted-foreground mb-2">First Year Savings</div>
          <div className="text-5xl font-bold text-primary">$107,000</div>
          <div className="text-lg text-muted-foreground mt-2">51% Cost Reduction</div>
        </div>
      </div>
    ),
  },
  {
    title: "Implementation Timeline",
    subtitle: "Typical Customer Onboarding",
    content: (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1 w-0.5 bg-primary/30 my-2"></div>
            </div>
            <div className="flex-1 pb-8">
              <h4 className="font-semibold text-lg">Discovery & Setup (Week 1)</h4>
              <p className="text-sm text-muted-foreground">
                Requirements gathering, project configuration, field mapping, user setup
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1 w-0.5 bg-primary/30 my-2"></div>
            </div>
            <div className="flex-1 pb-8">
              <h4 className="font-semibold text-lg">Integration & Testing (Week 2)</h4>
              <p className="text-sm text-muted-foreground">
                ECM integration setup, test document processing, workflow validation
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1 w-0.5 bg-primary/30 my-2"></div>
            </div>
            <div className="flex-1 pb-8">
              <h4 className="font-semibold text-lg">Training & Pilot (Week 3)</h4>
              <p className="text-sm text-muted-foreground">
                User training, pilot batch processing, feedback and adjustments
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-lg">Go Live & Support (Week 4+)</h4>
              <p className="text-sm text-muted-foreground">
                Full production deployment, ongoing support, optimization and scaling
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Next Steps",
    subtitle: "Ready to Transform Your Document Processing?",
    content: (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h3 className="text-3xl font-bold text-foreground">Let's Get Started</h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Schedule a personalized demo to see how WISDM Scanner Pro can transform your document
            processing workflow and deliver immediate ROI.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 border-2 rounded-lg text-center space-y-3 hover:border-primary transition-colors">
            <div className="text-4xl">📅</div>
            <h4 className="font-semibold">Schedule Demo</h4>
            <p className="text-sm text-muted-foreground">
              See the platform in action with your documents
            </p>
          </div>
          <div className="p-6 border-2 rounded-lg text-center space-y-3 hover:border-primary transition-colors">
            <div className="text-4xl">🔧</div>
            <h4 className="font-semibold">Pilot Program</h4>
            <p className="text-sm text-muted-foreground">
              Start with a small batch to prove value
            </p>
          </div>
          <div className="p-6 border-2 rounded-lg text-center space-y-3 hover:border-primary transition-colors">
            <div className="text-4xl">🚀</div>
            <h4 className="font-semibold">Full Deployment</h4>
            <p className="text-sm text-muted-foreground">
              Scale to your entire organization
            </p>
          </div>
        </div>
        <div className="p-8 border-2 border-primary rounded-lg bg-primary/5 text-center space-y-4">
          <h4 className="text-2xl font-bold text-foreground">Contact Information</h4>
          <div className="space-y-2 text-muted-foreground">
            <p>📧 Email: sales@wisdm.com</p>
            <p>📞 Phone: 1-800-WISDM-PRO</p>
            <p>🌐 Website: www.wisdm.com/scanner-pro</p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function Presentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={wisdmLogo} alt="WISDM" className="h-8" />
            <div className="text-sm text-muted-foreground">
              Sales Presentation - {currentSlide + 1} of {slides.length}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Back to App
          </Button>
        </div>
      </div>

      {/* Slide Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-bold text-foreground">{slide.title}</h1>
            <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
          </div>

          {/* Image */}
          {slide.image && (
            <div className="rounded-lg overflow-hidden border shadow-lg">
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-[400px] object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="bg-card border rounded-lg p-8 shadow-sm">{slide.content}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <Button
              variant="outline"
              size="lg"
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>

            {/* Slide Indicators */}
            <div className="flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? "bg-primary w-8"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <Button
              variant="default"
              size="lg"
              onClick={nextSlide}
              disabled={currentSlide === slides.length - 1}
            >
              Next
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
