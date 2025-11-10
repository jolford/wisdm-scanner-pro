import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BarcodeTestTool } from '@/components/admin/BarcodeTestTool';

const BarcodeTest = () => {
  const { loading } = useRequireAuth(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AdminLayout 
      title="Barcode Testing" 
      description="Test barcode detection and extraction on sample documents"
    >
      <div className="max-w-4xl">
        <BarcodeTestTool />
      </div>
    </AdminLayout>
  );
};

export default BarcodeTest;
