import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Scissors, 
  FileText, 
  Scan, 
  Barcode, 
  Layers, 
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Merge,
  Split
} from 'lucide-react';
import { toast } from 'sonner';

interface DetectedDocument {
  id: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  confidence: number;
  documentType?: string;
  splitReason: string;
  preview?: string;
}

interface SmartDocumentSplitterProps {
  documentId?: string;
  totalPages?: number;
  onSplit?: (documents: DetectedDocument[]) => void;
}

export function SmartDocumentSplitter({
  documentId,
  totalPages = 15,
  onSplit
}: SmartDocumentSplitterProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [splitMethod, setSplitMethod] = useState<'auto' | 'barcode' | 'blank' | 'pattern' | 'fixed'>('auto');
  const [fixedPageCount, setFixedPageCount] = useState(3);
  const [detectBlankPages, setDetectBlankPages] = useState(true);
  const [detectBarcodes, setDetectBarcodes] = useState(true);
  const [detectedDocuments, setDetectedDocuments] = useState<DetectedDocument[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const analyzeDocument = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setDetectedDocuments([]);

    // Simulate analysis progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + 15, 90));
    }, 300);

    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    clearInterval(progressInterval);
    setAnalysisProgress(100);

    // Generate detected documents based on method
    const docs: DetectedDocument[] = [];
    
    if (splitMethod === 'auto') {
      // Simulate intelligent detection
      docs.push(
        { id: '1', startPage: 1, endPage: 3, pageCount: 3, confidence: 0.95, documentType: 'Invoice', splitReason: 'Document header detected' },
        { id: '2', startPage: 4, endPage: 4, pageCount: 1, confidence: 0.88, documentType: 'Receipt', splitReason: 'Format change detected' },
        { id: '3', startPage: 5, endPage: 8, pageCount: 4, confidence: 0.92, documentType: 'Contract', splitReason: 'Signature page boundary' },
        { id: '4', startPage: 9, endPage: 12, pageCount: 4, confidence: 0.90, documentType: 'Invoice', splitReason: 'Barcode separator' },
        { id: '5', startPage: 13, endPage: 15, pageCount: 3, confidence: 0.85, documentType: 'Statement', splitReason: 'Blank page separator' },
      );
    } else if (splitMethod === 'fixed') {
      let pageNum = 1;
      let docId = 1;
      while (pageNum <= totalPages) {
        const endPage = Math.min(pageNum + fixedPageCount - 1, totalPages);
        docs.push({
          id: String(docId),
          startPage: pageNum,
          endPage,
          pageCount: endPage - pageNum + 1,
          confidence: 1.0,
          splitReason: `Fixed ${fixedPageCount}-page split`
        });
        pageNum = endPage + 1;
        docId++;
      }
    } else if (splitMethod === 'barcode') {
      docs.push(
        { id: '1', startPage: 1, endPage: 5, pageCount: 5, confidence: 0.98, splitReason: 'Barcode: INV-2024-001' },
        { id: '2', startPage: 6, endPage: 10, pageCount: 5, confidence: 0.97, splitReason: 'Barcode: INV-2024-002' },
        { id: '3', startPage: 11, endPage: 15, pageCount: 5, confidence: 0.96, splitReason: 'Barcode: INV-2024-003' },
      );
    } else if (splitMethod === 'blank') {
      docs.push(
        { id: '1', startPage: 1, endPage: 4, pageCount: 4, confidence: 0.99, splitReason: 'Blank page on page 5' },
        { id: '2', startPage: 6, endPage: 10, pageCount: 5, confidence: 0.99, splitReason: 'Blank page on page 11' },
        { id: '3', startPage: 12, endPage: 15, pageCount: 4, confidence: 0.99, splitReason: 'End of document' },
      );
    }

    setDetectedDocuments(docs);
    setSelectedDocs(new Set(docs.map(d => d.id)));
    setIsAnalyzing(false);
    
    toast.success(`Detected ${docs.length} documents`);
  }, [splitMethod, fixedPageCount, totalPages]);

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const mergeSelected = () => {
    const selectedList = detectedDocuments.filter(d => selectedDocs.has(d.id));
    if (selectedList.length < 2) {
      toast.error('Select at least 2 documents to merge');
      return;
    }

    const sorted = selectedList.sort((a, b) => a.startPage - b.startPage);
    const merged: DetectedDocument = {
      id: `merged-${Date.now()}`,
      startPage: sorted[0].startPage,
      endPage: sorted[sorted.length - 1].endPage,
      pageCount: sorted.reduce((acc, d) => acc + d.pageCount, 0),
      confidence: 1.0,
      splitReason: 'Manual merge',
      documentType: sorted[0].documentType
    };

    setDetectedDocuments(prev => [
      ...prev.filter(d => !selectedDocs.has(d.id)),
      merged
    ].sort((a, b) => a.startPage - b.startPage));
    setSelectedDocs(new Set([merged.id]));
    toast.success('Documents merged');
  };

  const handleSplit = () => {
    const selectedDocs = detectedDocuments.filter(d => selectedDocs.has(d.id));
    onSplit?.(selectedDocs.length > 0 ? selectedDocs : detectedDocuments);
    toast.success(`Split into ${detectedDocuments.length} documents`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          Smart Document Splitter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Split Method</Label>
            <Select value={splitMethod} onValueChange={(v) => setSplitMethod(v as typeof splitMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Scan className="h-4 w-4" />
                    AI Auto-Detect
                  </div>
                </SelectItem>
                <SelectItem value="barcode">
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4" />
                    Barcode Separators
                  </div>
                </SelectItem>
                <SelectItem value="blank">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Blank Page Separators
                  </div>
                </SelectItem>
                <SelectItem value="fixed">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Fixed Page Count
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {splitMethod === 'fixed' && (
            <div className="space-y-2">
              <Label>Pages per Document</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={fixedPageCount}
                onChange={(e) => setFixedPageCount(parseInt(e.target.value) || 1)}
              />
            </div>
          )}

          {splitMethod === 'auto' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Detect blank pages</Label>
                <Switch checked={detectBlankPages} onCheckedChange={setDetectBlankPages} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Detect barcodes</Label>
                <Switch checked={detectBarcodes} onCheckedChange={setDetectBarcodes} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          Source: {totalPages} pages
        </div>

        <Button 
          onClick={analyzeDocument} 
          disabled={isAnalyzing}
          className="w-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Scan className="h-4 w-4 mr-2" />
              Analyze Document
            </>
          )}
        </Button>

        {isAnalyzing && (
          <div className="space-y-2">
            <Progress value={analysisProgress} />
            <p className="text-sm text-center text-muted-foreground">
              Scanning for document boundaries...
            </p>
          </div>
        )}

        {/* Results */}
        {detectedDocuments.length > 0 && (
          <>
            <Separator />
            
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Detected Documents ({detectedDocuments.length})
              </h4>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={mergeSelected}
                  disabled={selectedDocs.size < 2}
                >
                  <Merge className="h-4 w-4 mr-1" />
                  Merge
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-4">
                {detectedDocuments.map((doc, index) => (
                  <div
                    key={doc.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDocs.has(doc.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleDocSelection(doc.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          selectedDocs.has(doc.id) ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Pages {doc.startPage}-{doc.endPage}
                            </span>
                            {doc.documentType && (
                              <Badge variant="secondary" className="text-xs">
                                {doc.documentType}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {doc.splitReason}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={doc.confidence > 0.9 ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {(doc.confidence * 100).toFixed(0)}%
                        </Badge>
                        {doc.confidence > 0.9 ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button onClick={handleSplit} className="w-full">
              <Split className="h-4 w-4 mr-2" />
              Split into {detectedDocuments.length} Documents
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
