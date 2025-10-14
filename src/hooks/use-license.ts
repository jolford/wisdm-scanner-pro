import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';

export const useLicense = () => {
  const { user } = useAuth();

  const { data: license, isLoading, refetch } = useQuery({
    queryKey: ['user-license', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      if (!user?.email) return null;

      // Get customer by email
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('contact_email', user.email)
        .maybeSingle();

      if (customerError || !customer) return null;

      // Get active license for this customer
      const { data: licenses, error: licenseError } = await supabase
        .from('licenses')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1);

      if (licenseError) throw licenseError;

      return licenses?.[0] || null;
    },
  });

  const hasCapacity = (documentsNeeded: number = 1): boolean => {
    if (!license) return true; // If no license, allow (for testing/admin)
    
    if (license.status !== 'active') return false;
    if (new Date(license.end_date) < new Date()) return false;
    if (license.remaining_documents < documentsNeeded) return false;
    
    return true;
  };

  const consumeDocuments = async (documentId: string, count: number = 1): Promise<boolean> => {
    if (!license || !user) return false;

    try {
      const { data, error } = await supabase.rpc('consume_license_documents', {
        _license_id: license.id,
        _document_id: documentId,
        _user_id: user.id,
        _documents_count: count,
      });

      if (error) throw error;

      // Refetch license to update remaining count
      await refetch();

      return data === true;
    } catch (error) {
      console.error('Error consuming license:', error);
      return false;
    }
  };

  return {
    license,
    isLoading,
    hasCapacity,
    consumeDocuments,
    refetch,
  };
};