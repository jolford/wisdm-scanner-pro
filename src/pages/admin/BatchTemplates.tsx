import { AdminLayout } from "@/components/admin/AdminLayout";
import { BatchTemplates as BatchTemplatesComponent } from "@/components/admin/BatchTemplates";
import { useRequireAuth } from "@/hooks/use-require-auth";

const BatchTemplates = () => {
  useRequireAuth(true);

  return (
    <AdminLayout
      title="Batch Templates"
      description="Create and manage reusable batch configurations"
    >
      <BatchTemplatesComponent />
    </AdminLayout>
  );
};

export default BatchTemplates;