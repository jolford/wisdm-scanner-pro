import { useRequireAuth } from '@/hooks/use-require-auth';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const ConfidenceDashboard = () => {
  const { loading } = useRequireAuth(true);

  const { data: confidenceStats } = useQuery({
    queryKey: ['confidence-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extraction_confidence')
        .select(`
          *,
          document:documents(
            id,
            file_name,
            batch_id,
            validation_status,
            batch:batches(
              batch_name,
              project:projects(name)
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Calculate statistics
      const total = data?.length || 0;
      const avgConfidence = total > 0
        ? data!.reduce((sum, item) => sum + Number(item.confidence_score), 0) / total
        : 0;
      
      const lowConfidence = data?.filter(item => Number(item.confidence_score) < 0.7) || [];
      const mediumConfidence = data?.filter(item => 
        Number(item.confidence_score) >= 0.7 && Number(item.confidence_score) < 0.9
      ) || [];
      const highConfidence = data?.filter(item => Number(item.confidence_score) >= 0.9) || [];

      // Group by field name
      const byField = data?.reduce((acc: any, item) => {
        if (!acc[item.field_name]) {
          acc[item.field_name] = [];
        }
        acc[item.field_name].push(item);
        return acc;
      }, {}) || {};

      const fieldStats = Object.entries(byField).map(([fieldName, items]: [string, any]) => ({
        fieldName,
        avgConfidence: items.reduce((sum: number, item: any) => 
          sum + Number(item.confidence_score), 0) / items.length,
        count: items.length,
        lowConfidenceCount: items.filter((item: any) => Number(item.confidence_score) < 0.7).length,
      })).sort((a, b) => a.avgConfidence - b.avgConfidence);

      return {
        total,
        avgConfidence,
        lowConfidence,
        mediumConfidence,
        highConfidence,
        fieldStats,
        recentExtractions: data || [],
      };
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge variant="default" className="bg-success">High</Badge>;
    if (confidence >= 0.7) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  return (
    <AdminLayout 
      title="Confidence Scoring Dashboard" 
      description="Monitor OCR confidence levels and identify documents needing review"
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((confidenceStats?.avgConfidence || 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(confidenceStats?.avgConfidence || 0) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {confidenceStats?.highConfidence.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">≥90% confidence</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Medium Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {confidenceStats?.mediumConfidence.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">70-89% confidence</p>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Low Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {confidenceStats?.lowConfidence.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">&lt;70% confidence</p>
            </CardContent>
          </Card>
        </div>

        {/* Field-Level Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Field-Level Confidence Analysis</CardTitle>
            <CardDescription>
              Average confidence scores by field type - lowest first
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {confidenceStats?.fieldStats.map((field: any) => (
                <div key={field.fieldName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.fieldName}</span>
                      {field.lowConfidenceCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {field.lowConfidenceCount} low
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {field.avgConfidence < 0.7 ? (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-success" />
                      )}
                      <span className="text-sm font-medium">
                        {(field.avgConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={field.avgConfidence * 100} />
                  <p className="text-xs text-muted-foreground">
                    {field.count} extractions analyzed
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Low Confidence Extractions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Low Confidence Extractions</CardTitle>
            <CardDescription>
              Documents with confidence scores below 70% requiring review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {confidenceStats?.lowConfidence.slice(0, 10).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{item.document.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Field: {item.field_name} • {item.document.batch?.project?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getConfidenceBadge(Number(item.confidence_score))}
                    <span className="text-sm font-medium">
                      {(Number(item.confidence_score) * 100).toFixed(1)}%
                    </span>
                    <Link to={`/batches/${item.document.batch_id}`}>
                      <Button size="sm" variant="outline">Review</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ConfidenceDashboard;
