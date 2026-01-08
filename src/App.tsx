import { useEffect, useState, useCallback, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { useKeyboardShortcuts, GLOBAL_SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { CommandPalette } from "@/components/CommandPalette";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useFileLaunch } from "@/hooks/use-file-launch";
import { toast } from "sonner";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { DemoModeToggle } from "@/components/demo/DemoModeToggle";
import { DemoGuidedTour } from "@/components/demo/DemoGuidedTour";
import { DemoBanner } from "@/components/demo/DemoBanner";

import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SkeletonPage } from "@/components/ui/skeleton-loaders";
import { OfflineIndicator } from "@/components/OfflineIndicator";

// Core pages - loaded immediately
import Index from "./pages/Index";
import Queue from "./pages/Queue";
import Auth from "./pages/Auth";
import Batches from "./pages/Batches";
import BatchDetail from "./pages/BatchDetail";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

// Admin pages - lazy loaded for better initial bundle size
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProjects = lazy(() => import("./pages/admin/projects/Index"));
const NewProject = lazy(() => import("./pages/admin/projects/New"));
const EditProject = lazy(() => import("./pages/admin/projects/Edit"));
const BatchesIndex = lazy(() => import("./pages/admin/batches/Index"));
const NewBatch = lazy(() => import("./pages/admin/batches/New"));
const AdminBatchDetail = lazy(() => import("./pages/admin/batches/Detail"));
const LicensesIndex = lazy(() => import("./pages/admin/licenses/Index"));
const NewLicense = lazy(() => import("./pages/admin/licenses/New"));
const EditLicense = lazy(() => import("./pages/admin/licenses/Edit"));
const CustomersIndex = lazy(() => import("./pages/admin/customers/Index"));
const NewCustomer = lazy(() => import("./pages/admin/customers/New"));
const EditCustomer = lazy(() => import("./pages/admin/customers/Edit"));
const UsersIndex = lazy(() => import("./pages/admin/users/Index"));
const NewUser = lazy(() => import("./pages/admin/users/New"));
const DocumentsAdmin = lazy(() => import("./pages/admin/Documents"));
const CostTracking = lazy(() => import("./pages/admin/CostTracking"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));

const SystemViability = lazy(() => import("./pages/admin/SystemViability"));
const ErrorLogs = lazy(() => import("./pages/admin/ErrorLogs"));
const AdvancedReports = lazy(() => import("./pages/admin/AdvancedReports"));
const DocumentReprocessing = lazy(() => import("./pages/admin/DocumentReprocessing"));
const BusinessMetrics = lazy(() => import("./pages/admin/BusinessMetrics"));
const MetricsBenchmark = lazy(() => import("./pages/admin/MetricsBenchmark"));
const WhiteLabel = lazy(() => import("./pages/admin/WhiteLabel"));
const CustomerSuccess = lazy(() => import("./pages/admin/CustomerSuccess"));
const BatchTemplates = lazy(() => import("./pages/admin/BatchTemplates"));
const ValidationAnalytics = lazy(() => import("./pages/admin/ValidationAnalytics"));
const MLTemplates = lazy(() => import("./pages/admin/MLTemplates"));
const ValidationLookups = lazy(() => import("./pages/admin/ValidationLookups"));
const ConfidenceDashboard = lazy(() => import("./pages/admin/ConfidenceDashboard"));
const ExceptionQueue = lazy(() => import("./pages/admin/ExceptionQueue"));
const WebhookConfig = lazy(() => import("./pages/admin/WebhookConfig"));

const ValidationRules = lazy(() => import("./pages/admin/ValidationRules"));
const ScheduledBatches = lazy(() => import("./pages/admin/ScheduledBatches"));
const ReleaseNotesManager = lazy(() => import("./pages/admin/ReleaseNotesManager"));
const DocumentComparison = lazy(() => import("./pages/admin/DocumentComparison"));
const QAMetrics = lazy(() => import("./pages/admin/QAMetrics"));
const CredentialMigration = lazy(() => import("./pages/admin/CredentialMigration"));
const MLLearning = lazy(() => import("./pages/admin/MLLearning"));

const MobileValidation = lazy(() => import("./pages/admin/MobileValidation"));
const IntegrationMarketplace = lazy(() => import("./pages/admin/IntegrationMarketplace"));
const SSOConfig = lazy(() => import("./pages/admin/SSOConfig"));
const SCIMConfig = lazy(() => import("./pages/admin/SCIMConfig"));
const EnhancedSLAMonitoring = lazy(() => import("./pages/admin/EnhancedSLAMonitoring"));
const SignatureVerificationHub = lazy(() => import("./pages/admin/SignatureVerificationHub"));


// Static pages - lazy loaded
const Help = lazy(() => import("./pages/Help"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const UserSettings = lazy(() => import("./pages/UserSettings"));

const Training = lazy(() => import("./pages/Training"));
const Downloads = lazy(() => import("./pages/Downloads"));
const ReleaseNotes = lazy(() => import("./pages/ReleaseNotes"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const DataProcessingAgreement = lazy(() => import("./pages/DataProcessingAgreement"));
const SecurityPolicy = lazy(() => import("./pages/SecurityPolicy"));
const IncidentResponse = lazy(() => import("./pages/IncidentResponse"));
const BusinessContinuity = lazy(() => import("./pages/BusinessContinuity"));
const ComplianceHub = lazy(() => import("./pages/ComplianceHub"));
const SecurityCompliance = lazy(() => import("./pages/SecurityCompliance"));
const EnterpriseInfo = lazy(() => import("./pages/EnterpriseInfo"));
const About = lazy(() => import("./pages/About"));

import { Footer } from "./components/Footer";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { AIAssistant } from "./components/AIAssistant";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bot } from "lucide-react";
import { Button } from "./components/ui/button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

// Redirect users to the Auth page when arriving via a password recovery link
// This catches reset emails that may point to "/" and use either hash tokens or a code query param
const RecoveryRedirect: React.FC = () => {
  const location = useLocation();
  const search = location.search || '';
  const searchParams = new URLSearchParams(search);
  const hash = location.hash || '';

  // Detect recovery signals from either hash or query
  const hasHashRecovery = hash.includes('type=recovery');
  const hasAccessToken = hash.includes('access_token=');
  const hasAuthError = hash.includes('error=') || hash.includes('error_description=');
  const hasQueryRecovery = searchParams.get('type') === 'recovery' || searchParams.get('mode') === 'recovery';
  const hasCode = searchParams.has('code') || hash.includes('code=');

  // Avoid redirect loop if already on /auth
  const isOnAuth = location.pathname === '/auth';
  if (!isOnAuth && (hasHashRecovery || hasAccessToken || hasAuthError || hasQueryRecovery || hasCode)) {
    // Preserve both search and hash so the Auth page can parse tokens or code
    return <Navigate to={`/auth${search}${hash}`} replace />;
  }
  return null;
};
function GlobalKeyboardShortcuts({
  onShowShortcuts,
  onFilesLaunched
}: {
  onShowShortcuts: () => void;
  onFilesLaunched: (files: File[]) => void;
}) {
  const navigate = useNavigate();
  useFileLaunch(files => {
    navigate('/');
    onFilesLaunched(files);
  });
  useKeyboardShortcuts({
    shortcuts: [{
      ...GLOBAL_SHORTCUTS.HELP,
      handler: onShowShortcuts
    }, {
      ...GLOBAL_SHORTCUTS.GO_BATCHES,
      handler: () => navigate('/batches')
    }, {
      ...GLOBAL_SHORTCUTS.GO_QUEUE,
      handler: () => navigate('/')
    }, {
      ...GLOBAL_SHORTCUTS.GO_ADMIN,
      handler: () => navigate('/admin/dashboard')
    }, {
      ...GLOBAL_SHORTCUTS.GO_HOME,
      handler: () => navigate('/')
    }]
  });
  return null;
}
const App = () => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [launchedFiles, setLaunchedFiles] = useState<File[]>([]);
  const handleFilesLaunched = useCallback((files: File[]) => {
    setLaunchedFiles(files);
    toast.success(`${files.length} file(s) ready to import`, {
      description: "Opening Queue page..."
    });
  }, []);

  // Clear launched files after they've been handled
  useEffect(() => {
    if (launchedFiles.length > 0) {
      const timer = setTimeout(() => setLaunchedFiles([]), 5000);
      return () => clearTimeout(timer);
    }
  }, [launchedFiles]);
  return <ErrorBoundary>
      <DemoModeProvider>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="light">{/* Theme toggle enabled */}
            <div className="flex flex-col min-h-screen pt-0 demo-mode-container">
            <SkipToContent />
            <OfflineIndicator />
            <Toaster />
            <Sonner />
            <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
          <BrowserRouter>
            <CommandPalette />
            <GlobalKeyboardShortcuts onShowShortcuts={() => setShowShortcuts(true)} onFilesLaunched={handleFilesLaunched} />
          <RecoveryRedirect />
          <div id="main-content" className="flex-1" role="main">
          <Suspense fallback={<SkeletonPage />}>
          <Routes>
            <Route path="/" element={<Queue launchedFiles={launchedFiles} />} />
            <Route path="/old" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/batches/:id" element={<BatchDetail />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
            <Route path="/admin/projects/new" element={<NewProject />} />
            <Route path="/admin/projects/:id/edit" element={<EditProject />} />
            <Route path="/admin/batches" element={<BatchesIndex />} />
            <Route path="/admin/batches/new" element={<NewBatch />} />
            <Route path="/admin/batches/:id" element={<AdminBatchDetail />} />
            <Route path="/admin/licenses" element={<LicensesIndex />} />
            <Route path="/admin/licenses/new" element={<NewLicense />} />
            <Route path="/admin/licenses/:id" element={<EditLicense />} />
            <Route path="/admin/customers" element={<CustomersIndex />} />
            <Route path="/admin/customers/new" element={<NewCustomer />} />
            <Route path="/admin/customers/:id/edit" element={<EditCustomer />} />
            <Route path="/admin/users" element={<UsersIndex />} />
            <Route path="/admin/users/new" element={<NewUser />} />
            <Route path="/admin/documents" element={<DocumentsAdmin />} />
            <Route path="/admin/cost-tracking" element={<CostTracking />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            
            <Route path="/admin/system-viability" element={<SystemViability />} />
            <Route path="/admin/advanced-reports" element={<AdvancedReports />} />
            <Route path="/admin/error-logs" element={<ErrorLogs />} />
            <Route path="/admin/reprocess" element={<DocumentReprocessing />} />
            <Route path="/admin/document-reprocessing" element={<DocumentReprocessing />} />
            <Route path="/admin/business-metrics" element={<BusinessMetrics />} />
            <Route path="/admin/metrics-benchmark" element={<MetricsBenchmark />} />
            <Route path="/admin/white-label" element={<WhiteLabel />} />
            <Route path="/admin/customer-success" element={<CustomerSuccess />} />
            <Route path="/admin/batch-templates" element={<BatchTemplates />} />
            <Route path="/admin/validation-analytics" element={<ValidationAnalytics />} />
            <Route path="/admin/ml-templates" element={<MLTemplates />} />
            <Route path="/admin/validation-lookups" element={<ValidationLookups />} />
            <Route path="/admin/confidence" element={<ConfidenceDashboard />} />
            <Route path="/admin/exceptions" element={<ExceptionQueue />} />
            <Route path="/admin/webhooks" element={<WebhookConfig />} />
            
            <Route path="/admin/validation-rules" element={<ValidationRules />} />
          <Route path="/admin/scheduled-batches" element={<ScheduledBatches />} />
          <Route path="/admin/release-notes" element={<ReleaseNotesManager />} />
          <Route path="/admin/credential-migration" element={<CredentialMigration />} />
          
          {/* Phase 1 Enhancements */}
          <Route path="/admin/ml-learning" element={<MLLearning />} />
          
          <Route path="/admin/mobile-validation" element={<MobileValidation />} />
          
          <Route path="/admin/integrations" element={<IntegrationMarketplace />} />
          
          
          {/* Enterprise Features */}
          <Route path="/admin/sso" element={<SSOConfig />} />
          <Route path="/admin/scim" element={<SCIMConfig />} />
          
          <Route path="/admin/sla-monitoring" element={<EnhancedSLAMonitoring />} />
          <Route path="/admin/signature-verification" element={<SignatureVerificationHub />} />
          
          
          {/* Phase 3: QA */}
          <Route path="/admin/document-comparison" element={<DocumentComparison />} />
          <Route path="/admin/qa-metrics" element={<QAMetrics />} />
            <Route path="/help" element={<Help />} />
            <Route path="/release-notes" element={<ReleaseNotes />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/downloads" element={<Downloads />} />
            
            <Route path="/training" element={<Training />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/data-processing-agreement" element={<DataProcessingAgreement />} />
            <Route path="/security-policy" element={<SecurityPolicy />} />
            <Route path="/incident-response" element={<IncidentResponse />} />
            <Route path="/business-continuity" element={<BusinessContinuity />} />
            <Route path="/compliance" element={<ComplianceHub />} />
            <Route path="/security-compliance" element={<SecurityCompliance />} />
            <Route path="/enterprise" element={<EnterpriseInfo />} />
            <Route path="/about" element={<About />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </div>
          {/* <OnboardingWizard /> */}
          <Footer />
          {/* Demo Mode Components - must be inside Router for useNavigate */}
          
          </BrowserRouter>
          
          {/* AI Copilot Floating Button */}
          <Sheet open={showCopilot} onOpenChange={setShowCopilot}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-40 bg-primary hover:bg-primary/90"
                aria-label="Open AI Copilot"
              >
                <Bot className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[600px] p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>AI Copilot</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100vh-5rem)]">
                <AIAssistant useCase="general" />
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </ThemeProvider>
      </QueryClientProvider>
      </I18nextProvider>
      </DemoModeProvider>
    </ErrorBoundary>;
};
export default App;