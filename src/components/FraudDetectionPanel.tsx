import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Shield, Eye, EyeOff } from 'lucide-react';

interface FraudDetectionPanelProps {
  documentId: string;
  batchId: string;
  lineItems?: any[];
  metadata?: Record<string, any>;
}

export function FraudDetectionPanel({
  documentId,
  batchId,
  lineItems = [],
  metadata = {}
}: FraudDetectionPanelProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [documentId]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fraud_detections')
        .select('*')
        .eq('document_id', documentId)
        .eq('status', 'pending')
        .order('severity', { ascending: false });
      
      if (data) setAlerts(data);
    } catch (error) {
      console.error('Error loading fraud alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const scanForFraud = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-fraud-patterns', {
        body: { documentId, batchId, metadata, lineItems }
      });

      if (error) throw error;
      await loadAlerts();
    } catch (error) {
      console.error('Fraud scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('fraud_detections')
        .update({ status: 'dismissed', reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq('id', alertId);

      if (error) throw error;
      await loadAlerts();
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const confirmAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('fraud_detections')
        .update({ status: 'confirmed', reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq('id', alertId);

      if (error) throw error;
      await loadAlerts();
    } catch (error) {
      console.error('Error confirming alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (alerts.length === 0 && !loading) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-medium">No fraud patterns detected</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={scanForFraud}
            disabled={scanning}
            className="mt-4"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {scanning ? 'Scanning...' : 'Scan for Fraud'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-900">
          <AlertTriangle className="h-5 w-5" />
          Fraud Detection Alerts
          <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <Alert key={alert.id} variant="destructive">
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium">
                      {alert.fraud_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm">{alert.description}</p>
                
                {alert.details && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {alert.details}
                  </p>
                )}
                
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    <EyeOff className="h-3 w-3 mr-1" />
                    False Positive
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => confirmAlert(alert.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Confirm Fraud
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ))}
        
        <Button
          size="sm"
          variant="ghost"
          onClick={scanForFraud}
          disabled={scanning}
          className="w-full"
        >
          {scanning ? 'Re-scanning...' : 'Re-scan for Fraud'}
        </Button>
      </CardContent>
    </Card>
  );
}
