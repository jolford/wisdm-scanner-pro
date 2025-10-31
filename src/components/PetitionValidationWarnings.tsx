import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, MapPin, Users, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

interface PetitionValidationWarningsProps {
  documentId: string;
  batchId: string;
  metadata?: Record<string, any>;
  onDuplicateCheck?: () => void;
  onAddressCheck?: () => void;
}

export function PetitionValidationWarnings({
  documentId,
  batchId,
  metadata = {},
  onDuplicateCheck,
  onAddressCheck
}: PetitionValidationWarningsProps) {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [addressValidation, setAddressValidation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<'duplicates' | 'address' | null>(null);

  useEffect(() => {
    loadValidations();
  }, [documentId]);

  const loadValidations = async () => {
    setLoading(true);
    try {
      // Load duplicate detections
      const { data: dupData } = await supabase
        .from('duplicate_detections')
        .select('*')
        .eq('document_id', documentId)
        .eq('status', 'pending')
        .order('similarity_score', { ascending: false });
      
      if (dupData) setDuplicates(dupData);

      // Load address validation
      const { data: addrData } = await supabase
        .from('address_validations')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (addrData) setAddressValidation(addrData);
    } catch (error) {
      console.error('Error loading validations:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicates = async () => {
    setChecking('duplicates');
    try {
      const { data, error } = await supabase.functions.invoke('detect-duplicates', {
        body: {
          documentId,
          batchId,
          checkCrossBatch: false,
          thresholds: { name: 0.85, address: 0.90, signature: 0.85 }
        }
      });

      if (error) throw error;
      
      await loadValidations();
      onDuplicateCheck?.();
    } catch (error) {
      console.error('Duplicate check error:', error);
    } finally {
      setChecking(null);
    }
  };

  const validateAddress = async () => {
    setChecking('address');
    try {
      // For petitions, validate addresses from line items instead of top-level metadata
      const lineItems = metadata.line_items || [];
      
      if (lineItems.length === 0) {
        console.warn('No line items found for address validation');
        return;
      }

      // Validate the first line item's address (could be enhanced to validate all)
      const firstItem = lineItems[0];
      const address = [
        firstItem.Address || firstItem.address || '',
        firstItem.City || firstItem.city || '',
        firstItem.State || firstItem.state || '',
        firstItem.Zip || firstItem.zip || firstItem['Zip Code'] || ''
      ].filter(Boolean).join(', ');

      if (!address) {
        console.warn('No address data found in line items');
        return;
      }

      const { data, error } = await supabase.functions.invoke('validate-address', {
        body: {
          address,
          documentId,
          provider: 'internal'
        }
      });

      if (error) throw error;
      
      await loadValidations();
      onAddressCheck?.();
    } catch (error) {
      console.error('Address validation error:', error);
    } finally {
      setChecking(null);
    }
  };

  const dismissDuplicate = async (duplicateId: string) => {
    try {
      const { error } = await supabase
        .from('duplicate_detections')
        .update({ status: 'dismissed', reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq('id', duplicateId);

      if (error) throw error;
      await loadValidations();
    } catch (error) {
      console.error('Error dismissing duplicate:', error);
    }
  };

  const confirmDuplicate = async (duplicateId: string) => {
    try {
      const { error } = await supabase
        .from('duplicate_detections')
        .update({ status: 'confirmed', reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq('id', duplicateId);

      if (error) throw error;
      await loadValidations();
    } catch (error) {
      console.error('Error confirming duplicate:', error);
    }
  };

  const getValidationStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      valid: { variant: 'default', label: 'Valid' },
      invalid: { variant: 'destructive', label: 'Invalid' },
      corrected: { variant: 'secondary', label: 'Corrected' },
      unverified: { variant: 'outline', label: 'Unverified' }
    };
    
    const config = statusConfig[status] || statusConfig.unverified;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const hasWarnings = duplicates.length > 0 || (addressValidation && addressValidation.validation_status !== 'valid');

  if (!hasWarnings && !loading) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">No validation warnings</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={checkDuplicates}
              disabled={checking === 'duplicates'}
            >
              <Users className="h-4 w-4 mr-2" />
              {checking === 'duplicates' ? 'Checking...' : 'Check Duplicates'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={validateAddress}
              disabled={checking === 'address'}
            >
              <MapPin className="h-4 w-4 mr-2" />
              {checking === 'address' ? 'Validating...' : 'Validate Address'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-900">
          <AlertTriangle className="h-5 w-5" />
          Petition Validation Warnings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address Validation */}
        {addressValidation && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Address Validation</span>
              </div>
              {getValidationStatusBadge(addressValidation.validation_status)}
            </div>
            
            <div className="bg-background rounded-md p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="ml-2 font-medium">
                    {Math.round((addressValidation.confidence_score || 0) * 100)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="ml-2 font-medium capitalize">
                    {addressValidation.validation_provider || 'Internal'}
                  </span>
                </div>
              </div>
              
              {addressValidation.normalized_address && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Normalized:</span>
                  <div className="mt-1 font-mono text-foreground">
                    {addressValidation.normalized_address.street && (
                      <div>{addressValidation.normalized_address.street}</div>
                    )}
                    {(addressValidation.normalized_address.city || addressValidation.normalized_address.state || addressValidation.normalized_address.zip) && (
                      <div>
                        {addressValidation.normalized_address.city}, {addressValidation.normalized_address.state} {addressValidation.normalized_address.zip}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={validateAddress}
              disabled={checking === 'address'}
            >
              {checking === 'address' ? 'Re-validating...' : 'Re-validate Address'}
            </Button>
          </div>
        )}

        {addressValidation && duplicates.length > 0 && <Separator />}

        {/* Duplicate Detections */}
        {duplicates.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Potential Duplicates</span>
              </div>
              <Badge variant="destructive">{duplicates.length}</Badge>
            </div>

            <div className="space-y-2">
              {duplicates.map((dup) => (
                <Alert key={dup.id} variant="destructive">
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {dup.duplicate_type} match
                        </span>
                        <Badge variant="outline">
                          {Math.round((dup.similarity_score || 0) * 100)}% similar
                        </Badge>
                      </div>
                      
                      {dup.duplicate_fields && (
                        <div className="text-xs space-y-1">
                          {dup.duplicate_fields.name && (
                            <div>
                              <span className="text-muted-foreground">Name similarity:</span>
                              <span className="ml-2 font-medium">
                                {Math.round(dup.duplicate_fields.name * 100)}%
                              </span>
                            </div>
                          )}
                          {dup.duplicate_fields.address && (
                            <div>
                              <span className="text-muted-foreground">Address similarity:</span>
                              <span className="ml-2 font-medium">
                                {Math.round(dup.duplicate_fields.address * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dismissDuplicate(dup.id)}
                        >
                          <EyeOff className="h-3 w-3 mr-1" />
                          Not Duplicate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => confirmDuplicate(dup.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Confirm Duplicate
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
            
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={checkDuplicates}
              disabled={checking === 'duplicates'}
            >
              {checking === 'duplicates' ? 'Re-checking...' : 'Re-check Duplicates'}
            </Button>
          </div>
        )}

        {!addressValidation && duplicates.length === 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={checkDuplicates}
              disabled={checking === 'duplicates'}
            >
              <Users className="h-4 w-4 mr-2" />
              {checking === 'duplicates' ? 'Checking...' : 'Check Duplicates'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={validateAddress}
              disabled={checking === 'address'}
            >
              <MapPin className="h-4 w-4 mr-2" />
              {checking === 'address' ? 'Validating...' : 'Validate Address'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}