import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Barcode } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface BarcodeType {
  id?: string;
  name: string;
  barcode_format: string;
  action: string;
  pattern?: string;
  document_class_id?: string;
  is_active: boolean;
}

interface BarcodeConfigProps {
  projectId: string;
}

const BARCODE_FORMATS = [
  { value: 'code39', label: 'Code 39' },
  { value: 'code128', label: 'Code 128' },
  { value: 'qr', label: 'QR Code' },
  { value: 'datamatrix', label: 'Data Matrix' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'upca', label: 'UPC-A' },
  { value: 'pdf417', label: 'PDF417' },
  { value: 'aztec', label: 'Aztec' },
];

const BARCODE_ACTIONS = [
  { value: 'separate', label: 'Document Separation', description: 'Start a new document when barcode is found' },
  { value: 'index', label: 'Index Field', description: 'Use barcode value as metadata field' },
  { value: 'classify', label: 'Auto-Classify', description: 'Classify document based on barcode' },
  { value: 'route', label: 'Route Document', description: 'Route to specific queue or workflow' },
];

export function BarcodeConfig({ projectId }: BarcodeConfigProps) {
  const { toast } = useToast();
  const [barcodeTypes, setBarcodeTypes] = useState<BarcodeType[]>([]);
  const [documentClasses, setDocumentClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newBarcode, setNewBarcode] = useState<BarcodeType>({
    name: '',
    barcode_format: 'code39',
    action: 'separate',
    is_active: true,
  });

  useEffect(() => {
    fetchBarcodeTypes();
    fetchDocumentClasses();
  }, [projectId]);

  const fetchBarcodeTypes = async () => {
    const { data, error } = await supabase
      .from('barcode_types')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Error loading barcode types", description: error.message, variant: "destructive" });
    } else {
      setBarcodeTypes(data || []);
    }
  };

  const fetchDocumentClasses = async () => {
    const { data, error } = await supabase
      .from('document_classes')
      .select('id, name')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (error) {
      console.error('Error loading document classes:', error);
    } else {
      setDocumentClasses(data || []);
    }
  };

  const handleSaveBarcode = async () => {
    if (!newBarcode.name || !newBarcode.barcode_format || !newBarcode.action) {
      toast({ title: "Validation error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('barcode_types')
      .insert({
        ...newBarcode,
        project_id: projectId,
        created_by: user?.id,
      });

    setLoading(false);

    if (error) {
      toast({ title: "Error saving barcode type", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Barcode type saved successfully" });
      setNewBarcode({ name: '', barcode_format: 'code39', action: 'separate', is_active: true });
      fetchBarcodeTypes();
    }
  };

  const handleDeleteBarcode = async (id: string) => {
    const { error } = await supabase
      .from('barcode_types')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error deleting barcode type", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Barcode type deleted successfully" });
      fetchBarcodeTypes();
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('barcode_types')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast({ title: "Error updating barcode type", description: error.message, variant: "destructive" });
    } else {
      fetchBarcodeTypes();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            <div>
              <CardTitle>Barcode Recognition Configuration</CardTitle>
              <CardDescription>
                Configure how barcodes are detected and used for document processing
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Barcode */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold text-sm">Add New Barcode Type</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newBarcode.name}
                  onChange={(e) => setNewBarcode({ ...newBarcode, name: e.target.value })}
                  placeholder="e.g., Invoice Separator"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Barcode Format *</Label>
                <Select
                  value={newBarcode.barcode_format}
                  onValueChange={(value) => setNewBarcode({ ...newBarcode, barcode_format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BARCODE_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Action *</Label>
                <Select
                  value={newBarcode.action}
                  onValueChange={(value) => setNewBarcode({ ...newBarcode, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BARCODE_ACTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        <div className="flex flex-col">
                          <span>{action.label}</span>
                          <span className="text-xs text-muted-foreground">{action.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pattern">Pattern (Optional)</Label>
                <Input
                  id="pattern"
                  value={newBarcode.pattern || ''}
                  onChange={(e) => setNewBarcode({ ...newBarcode, pattern: e.target.value })}
                  placeholder="e.g., INV-\d{6}"
                />
              </div>

              {newBarcode.action === 'classify' && (
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="docClass">Document Class</Label>
                  <Select
                    value={newBarcode.document_class_id || ''}
                    onValueChange={(value) => setNewBarcode({ ...newBarcode, document_class_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select document class" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentClasses.map((dc) => (
                        <SelectItem key={dc.id} value={dc.id}>
                          {dc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={newBarcode.is_active}
                  onCheckedChange={(checked) => setNewBarcode({ ...newBarcode, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <Button onClick={handleSaveBarcode} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Barcode Type
              </Button>
            </div>
          </div>

          <Separator />

          {/* Existing Barcode Types */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Configured Barcode Types</h3>
            {barcodeTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No barcode types configured yet. Add one above to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {barcodeTypes.map((barcode) => (
                  <div key={barcode.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{barcode.name}</span>
                        {!barcode.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Format: {BARCODE_FORMATS.find(f => f.value === barcode.barcode_format)?.label}</span>
                        <span>Action: {BARCODE_ACTIONS.find(a => a.value === barcode.action)?.label}</span>
                        {barcode.pattern && <span>Pattern: {barcode.pattern}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={barcode.is_active}
                        onCheckedChange={() => handleToggleActive(barcode.id!, barcode.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBarcode(barcode.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
