import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSignedUrl } from '@/hooks/use-signed-url';
import { FileText, Loader2 } from 'lucide-react';

interface BatchHoverPreviewProps {
  batchId: string;
  isVisible: boolean;
}

export function BatchHoverPreview({ batchId, isVisible }: BatchHoverPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);

  useEffect(() => {
    if (!isVisible || !batchId) return;

    const fetchPreview = async () => {
      setLoading(true);
      try {
        // Fetch first document from batch
        const { data: docs, error } = await supabase
          .from('documents')
          .select('file_url, id')
          .eq('batch_id', batchId)
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) throw error;

        if (docs && docs.length > 0) {
          const signedUrl = await getSignedUrl(docs[0].file_url);
          setPreviewUrl(signedUrl);
        }

        // Get total document count
        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batchId);

        setDocumentCount(count || 0);
      } catch (error) {
        console.error('Error fetching preview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [batchId, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="absolute left-full top-0 ml-4 z-50 w-64 bg-popover border rounded-lg shadow-lg p-4 pointer-events-none animate-in fade-in-0 zoom-in-95 slide-in-from-left-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4 text-primary" />
          <span>Preview ({documentCount} docs)</span>
        </div>
        
        <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Document preview" 
              className="w-full h-full object-contain"
            />
          ) : (
            <FileText className="h-12 w-12 text-muted-foreground/30" />
          )}
        </div>
        
        {!loading && documentCount > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            +{documentCount - 1} more document{documentCount - 1 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
