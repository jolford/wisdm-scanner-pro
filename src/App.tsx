import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Queue from "./pages/Queue";
import Auth from "./pages/Auth";
import Documents from "./pages/Documents";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/projects/Index";
import NewProject from "./pages/admin/projects/New";
import BatchesIndex from "./pages/admin/batches/Index";
import NewBatch from "./pages/admin/batches/New";
import BatchDetail from "./pages/admin/batches/Detail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Queue />} />
          <Route path="/old" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/projects" element={<AdminProjects />} />
          <Route path="/admin/projects/new" element={<NewProject />} />
          <Route path="/admin/batches" element={<BatchesIndex />} />
          <Route path="/admin/batches/new" element={<NewBatch />} />
          <Route path="/admin/batches/:id" element={<BatchDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
