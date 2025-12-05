import { useEffect, useState, useCallback } from "react";
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
import Index from "./pages/Index";
import Queue from "./pages/Queue";
import Auth from "./pages/Auth";
import Batches from "./pages/Batches";
import BatchDetail from "./pages/BatchDetail";
import Install from "./pages/Install";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/projects/Index";
import NewProject from "./pages/admin/projects/New";
import EditProject from "./pages/admin/projects/Edit";
import BatchesIndex from "./pages/admin/batches/Index";
import NewBatch from "./pages/admin/batches/New";
import AdminBatchDetail from "./pages/admin/batches/Detail";
import LicensesIndex from "./pages/admin/licenses/Index";
import NewLicense from "./pages/admin/licenses/New";
import EditLicense from "./pages/admin/licenses/Edit";
import CustomersIndex from "./pages/admin/customers/Index";
import NewCustomer from "./pages/admin/customers/New";
import EditCustomer from "./pages/admin/customers/Edit";
import UsersIndex from "./pages/admin/users/Index";
import NewUser from "./pages/admin/users/New";
import DocumentsAdmin from "./pages/admin/Documents";
import CostTracking from "./pages/admin/CostTracking";
import Analytics from "./pages/admin/Analytics";
import BarcodeTest from "./pages/admin/BarcodeTest";
import SystemViability from "./pages/admin/SystemViability";
import ErrorLogs from "./pages/admin/ErrorLogs";
import AdvancedReports from "./pages/admin/AdvancedReports";
import DocumentReprocessing from "./pages/admin/DocumentReprocessing";
import BusinessMetrics from "./pages/admin/BusinessMetrics";
import WhiteLabel from "./pages/admin/WhiteLabel";
import CustomerSuccess from "./pages/admin/CustomerSuccess";
import BatchTemplates from "./pages/admin/BatchTemplates";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import ApiDocs from "./pages/ApiDocs";
import UserSettings from "./pages/UserSettings";
import Presentation from "./pages/Presentation";
import Training from "./pages/Training";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import DataProcessingAgreement from "./pages/DataProcessingAgreement";
import SecurityPolicy from "./pages/SecurityPolicy";
import IncidentResponse from "./pages/IncidentResponse";
import BusinessContinuity from "./pages/BusinessContinuity";
import ComplianceHub from "./pages/ComplianceHub";
import SecurityCompliance from "./pages/SecurityCompliance";
import ValidationAnalytics from "./pages/admin/ValidationAnalytics";
import MLTemplates from "./pages/admin/MLTemplates";
import ValidationLookups from "./pages/admin/ValidationLookups";
import ConfidenceDashboard from "./pages/admin/ConfidenceDashboard";
import ExceptionQueue from "./pages/admin/ExceptionQueue";
import WebhookConfig from "./pages/admin/WebhookConfig";
import DuplicateDetections from "./pages/admin/DuplicateDetections";
import ValidationRules from "./pages/admin/ValidationRules";
import ScheduledBatches from "./pages/admin/ScheduledBatches";
import ReleaseNotes from "./pages/ReleaseNotes";
import ReleaseNotesManager from "./pages/admin/ReleaseNotesManager";
import DocumentComparison from "./pages/admin/DocumentComparison";
import QAMetrics from "./pages/admin/QAMetrics";
import Downloads from "./pages/Downloads";
import CredentialMigration from "./pages/admin/CredentialMigration";
import MLLearning from "./pages/admin/MLLearning";
import SmartRouting from "./pages/admin/SmartRouting";
import MobileValidation from "./pages/admin/MobileValidation";
import WorkflowBuilder from "./pages/admin/WorkflowBuilder";
import Workflows from "./pages/admin/Workflows";
import CustomScripts from "./pages/admin/CustomScripts";
import IntegrationMarketplace from "./pages/admin/IntegrationMarketplace";
import SSOConfig from "./pages/admin/SSOConfig";
import SCIMConfig from "./pages/admin/SCIMConfig";
import RetentionPolicies from "./pages/admin/RetentionPolicies";
import EnhancedSLAMonitoring from "./pages/admin/EnhancedSLAMonitoring";
import { Footer } from "./components/Footer";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SkipToContent } from "./components/SkipToContent";
import { AIAssistant } from "./components/AIAssistant";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bot } from "lucide-react";
import { Button } from "./components/ui/button";
const queryClient = new QueryClient();

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
            <Toaster />
            <Sonner />
            <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
          <BrowserRouter>
            <CommandPalette />
            <GlobalKeyboardShortcuts onShowShortcuts={() => setShowShortcuts(true)} onFilesLaunched={handleFilesLaunched} />
          <RecoveryRedirect />
          <div id="main-content" className="flex-1" role="main">
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
            <Route path="/admin/barcode-test" element={<BarcodeTest />} />
            <Route path="/admin/system-viability" element={<SystemViability />} />
            <Route path="/admin/advanced-reports" element={<AdvancedReports />} />
            <Route path="/admin/error-logs" element={<ErrorLogs />} />
            <Route path="/admin/reprocess" element={<DocumentReprocessing />} />
            <Route path="/admin/document-reprocessing" element={<DocumentReprocessing />} />
            <Route path="/admin/business-metrics" element={<BusinessMetrics />} />
            <Route path="/admin/white-label" element={<WhiteLabel />} />
            <Route path="/admin/customer-success" element={<CustomerSuccess />} />
            <Route path="/admin/batch-templates" element={<BatchTemplates />} />
            <Route path="/admin/validation-analytics" element={<ValidationAnalytics />} />
            <Route path="/admin/ml-templates" element={<MLTemplates />} />
            <Route path="/admin/validation-lookups" element={<ValidationLookups />} />
            <Route path="/admin/confidence" element={<ConfidenceDashboard />} />
            <Route path="/admin/exceptions" element={<ExceptionQueue />} />
            <Route path="/admin/webhooks" element={<WebhookConfig />} />
            <Route path="/admin/duplicates" element={<DuplicateDetections />} />
            <Route path="/admin/validation-rules" element={<ValidationRules />} />
          <Route path="/admin/scheduled-batches" element={<ScheduledBatches />} />
          <Route path="/admin/release-notes" element={<ReleaseNotesManager />} />
          <Route path="/admin/credential-migration" element={<CredentialMigration />} />
          
          {/* Phase 1 Enhancements */}
          <Route path="/admin/ml-learning" element={<MLLearning />} />
          <Route path="/admin/smart-routing" element={<SmartRouting />} />
          <Route path="/admin/mobile-validation" element={<MobileValidation />} />
          <Route path="/admin/workflows" element={<Workflows />} />
          <Route path="/admin/workflow-builder" element={<WorkflowBuilder />} />
          <Route path="/admin/custom-scripts" element={<CustomScripts />} />
          <Route path="/admin/integrations" element={<IntegrationMarketplace />} />
          
          {/* Enterprise Features */}
          <Route path="/admin/sso" element={<SSOConfig />} />
          <Route path="/admin/scim" element={<SCIMConfig />} />
          <Route path="/admin/retention" element={<RetentionPolicies />} />
          <Route path="/admin/sla-monitoring" element={<EnhancedSLAMonitoring />} />
          
          {/* Phase 3: QA */}
          <Route path="/admin/document-comparison" element={<DocumentComparison />} />
          <Route path="/admin/qa-metrics" element={<QAMetrics />} />
            <Route path="/help" element={<Help />} />
            <Route path="/release-notes" element={<ReleaseNotes />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/presentation" element={<Presentation />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
          <Footer />
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
          
          {/* Demo Mode Components - Disabled for now
          <DemoModeToggle />
          <DemoGuidedTour />
          <DemoBanner />
          */}
          </div>
        </ThemeProvider>
      </QueryClientProvider>
      </I18nextProvider>
      </DemoModeProvider>
    </ErrorBoundary>;
};
export default App;