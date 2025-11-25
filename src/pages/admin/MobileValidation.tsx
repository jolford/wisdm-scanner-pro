import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Smartphone, Check, X, Image as ImageIcon, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSignedUrl } from '@/hooks/use-signed-url';

export default function MobileValidation() {
  const isMobile = useIsMobile();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const { signedUrl: imageUrl } = useSignedUrl(selectedDoc?.file_url);

  useEffect(() => {
    loadPendingDocuments();
  }, []);

  const loadPendingDocuments = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('documents')
      .select('*, batches(batch_name), projects(name)')
      .eq('validation_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast.error('Failed to load documents');
      console.error(error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  const validateDocument = async (docId: string, status: 'validated' | 'rejected') => {
    const { error } = await supabase
      .from('documents')
      .update({ 
        validation_status: status,
        validated_at: new Date().toISOString(),
        validated_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', docId);

    if (error) {
      toast.error('Failed to update document');
      console.error(error);
    } else {
      toast.success(`Document ${status}`);
      setSelectedDoc(null);
      loadPendingDocuments();
    }
  };

  return (
    <AdminLayout title="Mobile Validation">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle>Mobile Document Validation</CardTitle>
            </div>
            <CardDescription>
              Optimized validation workflow for mobile devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {documents.length} documents pending validation
                </div>
                <Button onClick={loadPendingDocuments} size="sm" variant="outline">
                  Refresh
                </Button>
              </div>

              {!selectedDoc ? (
                <div className="space-y-2">
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No documents pending validation
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <Card
                        key={doc.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="font-medium">{doc.file_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {doc.projects?.name} • {doc.batches?.batch_name}
                              </div>
                            </div>
                            <Badge variant={
                              doc.confidence_score >= 0.9 ? 'default' :
                              doc.confidence_score >= 0.7 ? 'secondary' : 'destructive'
                            }>
                              {Math.round((doc.confidence_score || 0) * 100)}%
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDoc(null)}
                  >
                    ← Back to List
                  </Button>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{selectedDoc.file_name}</CardTitle>
                      <CardDescription>
                        {selectedDoc.projects?.name} • {selectedDoc.batches?.batch_name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Image Viewer */}
                      <div className="relative bg-muted rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="Document"
                            className="w-full h-auto"
                            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-64 text-muted-foreground">
                            <ImageIcon className="h-12 w-12" />
                          </div>
                        )}
                      </div>

                      {/* Zoom Controls */}
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground min-w-16 text-center">
                          {Math.round(zoom * 100)}%
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoom(1)}
                        >
                          Reset
                        </Button>
                      </div>

                      <Separator />

                      {/* Extracted Data */}
                      <div className="space-y-3">
                        <h4 className="font-semibold">Extracted Data</h4>
                        {selectedDoc.extracted_metadata && Object.entries(selectedDoc.extracted_metadata).map(([key, value]: [string, any]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs">{key}</Label>
                            <Input
                              value={value || ''}
                              onChange={(e) => {
                                setSelectedDoc({
                                  ...selectedDoc,
                                  extracted_metadata: {
                                    ...selectedDoc.extracted_metadata,
                                    [key]: e.target.value
                                  }
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => validateDocument(selectedDoc.id, 'rejected')}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          className="w-full"
                          onClick={() => validateDocument(selectedDoc.id, 'validated')}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Validate
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isMobile && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium">Mobile Mode Active</div>
                  <div className="text-xs text-muted-foreground">
                    This interface is optimized for mobile validation workflows
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
