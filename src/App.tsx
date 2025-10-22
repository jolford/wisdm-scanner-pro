import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
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
import SystemViability from "./pages/admin/SystemViability";
import ErrorLogs from "./pages/admin/ErrorLogs";
import DocumentReprocessing from "./pages/admin/DocumentReprocessing";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import ApiDocs from "./pages/ApiDocs";
import Presentation from "./pages/Presentation";
import PowerPointDownload from "./pages/PowerPointDownload";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import DataProcessingAgreement from "./pages/DataProcessingAgreement";
import SecurityPolicy from "./pages/SecurityPolicy";
import IncidentResponse from "./pages/IncidentResponse";
import BusinessContinuity from "./pages/BusinessContinuity";
import ComplianceHub from "./pages/ComplianceHub";
import { Footer } from "./components/Footer";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

// Redirect users to the Auth page when arriving via a password recovery link
// This catches older reset emails that might point to "/" instead of "/auth"
const RecoveryRedirect: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || '');

  const hash = location.hash || '';
  const hasHashRecovery = hash.includes('type=recovery');
  const hasAccessToken = hash.includes('access_token=');
  const hasAuthError = hash.includes('error=') || hash.includes('error_description=');
  const hasQueryRecovery = searchParams.get('type') === 'recovery' || searchParams.get('mode') === 'recovery';

  if (hasHashRecovery || hasAccessToken || hasAuthError) {
    // Preserve the original hash so the auth page can parse tokens or errors
    return <Navigate to={`/auth${hash}`} replace />;
  }
  if (hasQueryRecovery) {
    return <Navigate to="/auth?mode=recovery" replace />;
  }
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">{/* Force light mode only */}
        <div className="flex flex-col min-h-screen">
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <RecoveryRedirect />
          <div className="flex-1">
          <Routes>
            <Route path="/" element={<Queue />} />
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
            <Route path="/admin/viability" element={<SystemViability />} />
            <Route path="/admin/error-logs" element={<ErrorLogs />} />
            <Route path="/admin/reprocess" element={<DocumentReprocessing />} />
            <Route path="/help" element={<Help />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/presentation" element={<Presentation />} />
            <Route path="/download/presentation" element={<PowerPointDownload />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/data-processing-agreement" element={<DataProcessingAgreement />} />
            <Route path="/security-policy" element={<SecurityPolicy />} />
            <Route path="/incident-response" element={<IncidentResponse />} />
            <Route path="/business-continuity" element={<BusinessContinuity />} />
            <Route path="/compliance" element={<ComplianceHub />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
          <Footer />
        </BrowserRouter>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
