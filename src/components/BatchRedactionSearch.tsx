import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  FileText, 
  Eye, 
  Check, 
  X, 
  AlertTriangle,
  Filter,
  Loader2,
  Shield,
  ShieldAlert,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  PATTERN_PRESETS, 
  PII_CATEGORIES,
  detectKeywords,
  getKeywordsByPreset,
  summarizeDetections,
  type DetectedKeyword 
} from '@/lib/keyword-redaction';

interface DocumentMatch {
  id: string;
  file_name: string;
  batch_id: string;
  batch_name?: string;
  project_id: string;
  project_name?: string;
  extracted_text?: string;
  word_bounding_boxes?: any;
  detections: DetectedKeyword[];
  summary: Record<string, { count: number; label: string }>;
  selected: boolean;
}

interface BatchRedactionSearchProps {
  projectId?: string;
  batchId?: string;
  onApplyRedactions?: (documentIds: string[]) => void;
}

export const BatchRedactionSearch = ({ projectId, batchId, onApplyRedactions }: BatchRedactionSearchProps) => {
  const [searchMode, setSearchMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof PATTERN_PRESETS>('pii-full');
  const [customKeyword, setCustomKeyword] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [matches, setMatches] = useState<DocumentMatch[]>([]);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  // Initialize selected categories from preset
  useEffect(() => {
    if (searchMode === 'preset') {
      const preset = PATTERN_PRESETS[selectedPreset];
      setSelectedCategories([...preset.categories]);
    }
  }, [selectedPreset, searchMode]);

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchProgress(0);
    setMatches([]);

    try {
      // Build query for documents
      let query = supabase
        .from('documents')
        .select(`
          id,
          file_name,
          batch_id,
          project_id,
          extracted_text,
          word_bounding_boxes,
          batches!inner(batch_name),
          projects!inner(name)
        `)
        .not('extracted_text', 'is', null);

      if (batchId) {
        query = query.eq('batch_id', batchId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data: documents, error } = await query.limit(500);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast({
          title: 'No Documents Found',
          description: 'No documents with extracted text were found in the selected scope.',
        });
        setIsSearching(false);
        return;
      }

      const foundMatches: DocumentMatch[] = [];
      const total = documents.length;

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i] as any;
        setSearchProgress(Math.round(((i + 1) / total) * 100));

        // Run detection on this document
        const keywords = searchMode === 'preset' 
          ? getKeywordsByPreset(selectedPreset)
          : customKeyword 
            ? [{ term: customKeyword, category: 'custom', label: 'Custom' }]
            : [];

        const detections = detectKeywords(
          doc.extracted_text || '',
          { wordBoundingBoxes: doc.word_bounding_boxes },
          searchMode === 'custom' && customKeyword ? keywords : [],
          searchMode === 'preset',
          searchMode === 'preset' ? selectedCategories : undefined
        );

        if (detections.length > 0) {
          foundMatches.push({
            id: doc.id,
            file_name: doc.file_name,
            batch_id: doc.batch_id,
            batch_name: doc.batches?.batch_name,
            project_id: doc.project_id,
            project_name: doc.projects?.name,
            extracted_text: doc.extracted_text,
            word_bounding_boxes: doc.word_bounding_boxes,
            detections,
            summary: summarizeDetections(detections),
            selected: true, // Default to selected
          });
        }
      }

      setMatches(foundMatches);
      
      toast({
        title: 'Search Complete',
        description: `Found ${foundMatches.length} document(s) with matching patterns`,
      });
    } catch (error: any) {
      console.error('Batch redaction search error:', error);
      toast({
        title: 'Search Failed',
        description: error.message || 'An error occurred during search',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setMatches(prev => prev.map(m => 
      m.id === docId ? { ...m, selected: !m.selected } : m
    ));
  };

  const selectAll = () => {
    setMatches(prev => prev.map(m => ({ ...m, selected: true })));
  };

  const deselectAll = () => {
    setMatches(prev => prev.map(m => ({ ...m, selected: false })));
  };

  const selectedCount = matches.filter(m => m.selected).length;
  const totalDetections = matches.reduce((sum, m) => 
    sum + Object.values(m.summary).reduce((s, v) => s + v.count, 0), 0
  );

  const handleApplyRedactions = async () => {
    const selectedDocs = matches.filter(m => m.selected);
    if (selectedDocs.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one document to redact',
        variant: 'destructive',
      });
      return;
    }

    setIsApplying(true);
    
    try {
      // Call the batch redaction edge function
      const { data, error } = await supabase.functions.invoke('batch-redact-documents', {
        body: {
          documentIds: selectedDocs.map(d => d.id),
          preset: searchMode === 'preset' ? selectedPreset : undefined,
          customKeyword: searchMode === 'custom' ? customKeyword : undefined,
          categories: selectedCategories,
        }
      });

      if (error) throw error;

      toast({
        title: 'Redaction Applied',
        description: `Successfully redacted ${selectedDocs.length} document(s)`,
      });

      // Callback to parent
      onApplyRedactions?.(selectedDocs.map(d => d.id));
      
      // Clear matches after successful redaction
      setMatches([]);
    } catch (error: any) {
      console.error('Batch redaction error:', error);
      toast({
        title: 'Redaction Failed',
        description: error.message || 'Failed to apply redactions',
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Batch Redaction Search
        </CardTitle>
        <CardDescription>
          Search across documents for sensitive patterns and apply redactions in bulk
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Configuration */}
        <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'preset' | 'custom')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preset">Preset Patterns</TabsTrigger>
            <TabsTrigger value="custom">Custom Search</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preset" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Pattern Preset</Label>
              <Select value={selectedPreset} onValueChange={(v) => setSelectedPreset(v as keyof typeof PATTERN_PRESETS)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PATTERN_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{preset.label}</span>
                        <span className="text-xs text-muted-foreground">{preset.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Toggles */}
            <div className="space-y-2">
              <Label>Active Categories</Label>
              <div className="flex flex-wrap gap-2">
                {PATTERN_PRESETS[selectedPreset].categories.map((cat) => {
                  const catInfo = PII_CATEGORIES[cat as keyof typeof PII_CATEGORIES];
                  return (
                    <Badge
                      key={cat}
                      variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(cat)}
                    >
                      {catInfo?.label || cat}
                      {selectedCategories.includes(cat) && <Check className="ml-1 h-3 w-3" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="custom-keyword">Custom Keyword or Regex</Label>
              <Input
                id="custom-keyword"
                placeholder="Enter keyword or regex pattern (e.g., \\b\\d{4}\\b)"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use \\b for word boundaries, \\d for digits. Example: \\b\\d{3}-\\d{2}-\\d{4}\\b for SSN
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Search Button */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSearch} 
            disabled={isSearching || (searchMode === 'custom' && !customKeyword)}
            className="flex-1"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching... {searchProgress}%
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Documents
              </>
            )}
          </Button>
        </div>

        {/* Progress Bar */}
        {isSearching && (
          <Progress value={searchProgress} className="w-full" />
        )}

        {/* Results */}
        {matches.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {matches.length} document(s) with {totalDetections} matches
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>
              <Badge variant="secondary">
                {selectedCount} selected
              </Badge>
            </div>

            <ScrollArea className="h-[400px] border rounded-md">
              <div className="p-4 space-y-3">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      match.selected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={match.selected}
                          onCheckedChange={() => toggleDocumentSelection(match.id)}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{match.file_name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {match.project_name} → {match.batch_name}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(match.summary).map(([cat, info]) => (
                              <Badge key={cat} variant="outline" className="text-xs">
                                {info.label}: {info.count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(showPreview === match.id ? null : match.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Preview Panel */}
                    {showPreview === match.id && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <Label className="text-xs">Detected Content Preview:</Label>
                        <div className="mt-2 space-y-1">
                          {match.detections.slice(0, 5).map((det, idx) => (
                            <div key={idx} className="text-xs">
                              <Badge variant="secondary" className="mr-2">
                                {det.label || det.category}
                              </Badge>
                              <code className="bg-destructive/20 px-1 rounded">
                                {det.matches[0]?.text?.substring(0, 30)}
                                {(det.matches[0]?.text?.length || 0) > 30 && '...'}
                              </code>
                              {det.matches.length > 1 && (
                                <span className="text-muted-foreground ml-1">
                                  +{det.matches.length - 1} more
                                </span>
                              )}
                            </div>
                          ))}
                          {match.detections.length > 5 && (
                            <div className="text-xs text-muted-foreground">
                              +{match.detections.length - 5} more categories
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Apply Redactions */}
            <Alert className="border-warning bg-warning/10">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Applying redactions will permanently modify the selected documents. 
                Original files will be preserved, and redacted versions will be created.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                onClick={handleApplyRedactions}
                disabled={selectedCount === 0 || isApplying}
                className="flex-1"
                variant="destructive"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying Redactions...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Apply Redactions to {selectedCount} Document(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && matches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a pattern preset or enter a custom search term</p>
            <p className="text-sm">Then click "Search Documents" to find matches</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
