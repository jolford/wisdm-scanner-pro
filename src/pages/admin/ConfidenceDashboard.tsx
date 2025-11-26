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
import { useSignedUrl } from '@/hooks/use-signed-url';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const ConfidenceDashboard = () => {
  const { loading } = useRequireAuth(true);

  const { data: confidenceStats } = useQuery({
    queryKey: ['confidence-stats'],
    queryFn: async () => {
      // Try per-field confidence records first
      const { data: confidenceData, error: confidenceError } = await supabase
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

      if (confidenceError) throw confidenceError;

      let data = confidenceData || [];

      // Fallback: if no field-level records exist, derive from documents' overall confidence
      if (!data || data.length === 0) {
        const { data: docs, error: docsError } = await supabase
          .from('documents')
          .select(`
            id,
            file_name,
            batch_id,
            validation_status,
            confidence_score,
            batch:batches(
              batch_name,
              project:projects(name)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (docsError) throw docsError;

        data = (docs || [])
          .filter((d: any) => typeof d.confidence_score === 'number')
          .map((d: any) => ({
            id: d.id,
            document_id: d.id,
            field_name: 'Document Overall',
            extracted_value: null,
            confidence_score: d.confidence_score,
            needs_review: d.validation_status === 'needs_review' || (d.confidence_score ?? 0) < 0.7,
            created_at: null,
            document: {
              id: d.id,
              file_name: d.file_name,
              batch_id: d.batch_id,
              validation_status: d.validation_status,
              batch: d.batch,
            },
          }));
      }

      // Calculate statistics
      const total = data?.length || 0;
      const avgConfidence = total > 0
        ? data.reduce((sum: number, item: any) => sum + Number(item.confidence_score), 0) / total
        : 0;

      const lowConfidence = data.filter((item: any) => Number(item.confidence_score) < 0.7);
      const mediumConfidence = data.filter((item: any) =>
        Number(item.confidence_score) >= 0.7 && Number(item.confidence_score) < 0.9
      );
      const highConfidence = data.filter((item: any) => Number(item.confidence_score) >= 0.9);

      // Group by field name
      const byField = data.reduce((acc: any, item: any) => {
        const key = item.field_name || 'Document Overall';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const fieldStats = Object.entries(byField).map(([fieldName, items]: [string, any]) => ({
        fieldName,
        avgConfidence: items.reduce((sum: number, item: any) =>
          sum + Number(item.confidence_score), 0) / items.length,
        count: items.length,
        lowConfidenceCount: items.filter((item: any) => Number(item.confidence_score) < 0.7).length,
      })).sort((a: any, b: any) => a.avgConfidence - b.avgConfidence);

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

  const DocumentPreview = ({ fileUrl }: { fileUrl: string | null }) => {
    const { signedUrl, loading } = useSignedUrl(fileUrl, 300);
    const [showFullImage, setShowFullImage] = useState(false);

    if (!fileUrl || loading) {
      return (
        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
      );
    }

    return (
      <>
        <img
          src={signedUrl || ''}
          alt="Document preview"
          className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          onClick={() => setShowFullImage(true)}
        />
        <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
          <DialogContent className="max-w-4xl">
            <img
              src={signedUrl || ''}
              alt="Document full preview"
              className="w-full h-auto"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  };

  return (
    <AdminLayout 
      title="Confidence Scoring Dashboard" 
      description="Monitor OCR confidence levels and identify documents needing review"
    >
      <div className="space-y-6">
        {/* Empty State */}
        {!confidenceStats || confidenceStats.total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Confidence Data Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                Confidence scores are tracked when documents are processed with OCR. 
                Process some documents to see confidence metrics here.
              </p>
              <Link to="/admin/batches">
                <Button>View Batches</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
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
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <DocumentPreview fileUrl={item.document.file_url} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.document.file_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        Field: {item.field_name} • {item.document.batch?.project?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
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
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default ConfidenceDashboard;
