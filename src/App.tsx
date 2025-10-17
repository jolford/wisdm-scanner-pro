import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Queue from "./pages/Queue";
import Auth from "./pages/Auth";
import Batches from "./pages/Batches";
import BatchDetail from "./pages/BatchDetail";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/projects/Index";
import NewProject from "./pages/admin/projects/New";
import EditProject from "./pages/admin/projects/Edit";
import BatchesIndex from "./pages/admin/batches/Index";
import NewBatch from "./pages/admin/batches/New";
import AdminBatchDetail from "./pages/admin/batches/Detail";
import LicensesIndex from "./pages/admin/licenses/Index";
import NewLicense from "./pages/admin/licenses/New";
import CustomersIndex from "./pages/admin/customers/Index";
import NewCustomer from "./pages/admin/customers/New";
import EditCustomer from "./pages/admin/customers/Edit";
import UsersIndex from "./pages/admin/users/Index";
import DocumentsAdmin from "./pages/admin/Documents";
import CostTracking from "./pages/admin/CostTracking";
import Analytics from "./pages/admin/Analytics";
import ErrorLogs from "./pages/admin/ErrorLogs";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import ApiDocs from "./pages/ApiDocs";
import { Footer } from "./components/Footer";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">{/* Force light mode only */}
        <div className="flex flex-col min-h-screen">
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <div className="flex-1">
          <Routes>
            <Route path="/" element={<Queue />} />
            <Route path="/old" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
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
            <Route path="/admin/customers" element={<CustomersIndex />} />
            <Route path="/admin/customers/new" element={<NewCustomer />} />
            <Route path="/admin/customers/:id/edit" element={<EditCustomer />} />
            <Route path="/admin/users" element={<UsersIndex />} />
            <Route path="/admin/documents" element={<DocumentsAdmin />} />
            <Route path="/admin/cost-tracking" element={<CostTracking />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/error-logs" element={<ErrorLogs />} />
            <Route path="/help" element={<Help />} />
            <Route path="/api-docs" element={<ApiDocs />} />
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
