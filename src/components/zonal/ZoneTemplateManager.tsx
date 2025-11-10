import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Edit2 } from 'lucide-react';
import { ZoneTemplateEditor } from './ZoneTemplateEditor';
import { useAuth } from '@/hooks/use-auth';

interface ZoneTemplate {
  id: string;
  name: string;
  description: string | null;
  sample_image_url: string;
  is_active: boolean;
  created_at: string;
  zone_count?: number;
}

interface ZoneTemplateManagerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ZoneTemplateManager({ projectId, open, onClose }: ZoneTemplateManagerProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ZoneTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [sampleImagePath, setSampleImagePath] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [initialZones, setInitialZones] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, projectId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('zone_templates')
        .select(`
          *,
          zone_definitions(count)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const templatesWithCount = data.map(t => ({
        ...t,
        zone_count: t.zone_definitions?.[0]?.count || 0
      }));

      setTemplates(templatesWithCount);
    } catch (error: any) {
      toast.error('Failed to load templates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please select an image or PDF file');
      return;
    }

    setSelectedFile(file);
    
    // Upload to storage
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create a signed URL for previewing (bucket is private)
      const { data: signed, error: signErr } = await supabase.storage
        .from('documents')
        .createSignedUrl(data!.path, 3600);
      if (signErr) throw signErr;

      setUploadedImageUrl(signed.signedUrl);
      setSampleImagePath(data!.path);
      toast.success('Sample document uploaded');
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    }
  };

  const proceedToEditor = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!uploadedImageUrl) {
      toast.error('Please upload a sample document first');
      return;
    }
    setShowUpload(false);
    setShowEditor(true);
  };

  const handleSaveTemplate = async (zones: any[]) => {
    if (!user) return;

    try {
      if (editingTemplateId) {
        // Update existing template
        const { error: templateError } = await supabase
          .from('zone_templates')
          .update({
            name: templateName,
            description: templateDescription,
            sample_image_url: sampleImagePath || uploadedImageUrl, // store storage path if available
          })
          .eq('id', editingTemplateId);

        if (templateError) throw templateError;

        // Delete old zones
        const { error: deleteError } = await supabase
          .from('zone_definitions')
          .delete()
          .eq('template_id', editingTemplateId);

        if (deleteError) throw deleteError;

        // Insert new zones
        const zoneInserts = zones.map((zone, index) => ({
          template_id: editingTemplateId,
          field_name: zone.fieldName,
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          field_type: zone.fieldType,
          sort_order: index,
        }));

        const { error: zonesError } = await supabase
          .from('zone_definitions')
          .insert(zoneInserts);

        if (zonesError) throw zonesError;

        toast.success('Zone template updated successfully');
      } else {
        // Create new template
        const img = new Image();
        img.src = uploadedImageUrl;
        await new Promise((resolve) => { img.onload = resolve; });

        const { data: template, error: templateError } = await supabase
          .from('zone_templates')
          .insert({
            project_id: projectId,
            name: templateName,
            description: templateDescription,
            sample_image_url: sampleImagePath || uploadedImageUrl,
            created_by: user.id,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const zoneInserts = zones.map((zone, index) => ({
          template_id: template.id,
          field_name: zone.fieldName,
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          field_type: zone.fieldType,
          sort_order: index,
        }));

        const { error: zonesError } = await supabase
          .from('zone_definitions')
          .insert(zoneInserts);

        if (zonesError) throw zonesError;

        toast.success('Zone template created successfully');
      }
      
      setShowEditor(false);
      setTemplateName('');
      setTemplateDescription('');
      setSelectedFile(null);
      setUploadedImageUrl('');
      setSampleImagePath('');
      setEditingTemplateId(null);
      setInitialZones([]);
      loadTemplates();
    } catch (error: any) {
      toast.error('Failed to save template: ' + error.message);
    }
  };

  const editTemplate = async (template: ZoneTemplate) => {
    try {
      // Resolve storage path and sign it (bucket is private)
      const maybeUrl = template.sample_image_url || '';
      const lastIdx = maybeUrl.lastIndexOf('documents/');
      const pathMatch = lastIdx >= 0
        ? maybeUrl.substring(lastIdx + 'documents/'.length)
        : (maybeUrl.startsWith('http') ? '' : maybeUrl); // if it's a full http URL but not a storage URL, leave blank

      if (pathMatch) {
        const { data: signed, error: signErr } = await supabase.storage
          .from('documents')
          .createSignedUrl(pathMatch, 3600);
        if (signErr) throw signErr;
        setUploadedImageUrl(signed.signedUrl);
        setSampleImagePath(pathMatch);
      } else {
        // If we couldn't parse a storage path but have a direct URL, use it directly
        if (maybeUrl) setUploadedImageUrl(maybeUrl);
        setSampleImagePath('');
      }

      // Load zone definitions
      const { data: zones, error } = await supabase
        .from('zone_definitions')
        .select('*')
        .eq('template_id', template.id)
        .order('sort_order');

      if (error) throw error;

      // Convert database zones to editor format
      const editorZones = zones.map((zone, index) => ({
        id: `zone-${index}`,
        fieldName: zone.field_name,
        fieldType: zone.field_type,
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height,
      }));

      setEditingTemplateId(template.id);
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      setShowEditor(true);
      setShowUpload(false);
      setInitialZones(editorZones);
    } catch (error: any) {
      toast.error('Failed to load template: ' + error.message);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('zone_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      
      toast.success('Template deleted');
      loadTemplates();
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zone Extraction Templates</DialogTitle>
        </DialogHeader>

        {!showEditor && (
          <div className="space-y-4">
            <Button onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Create New Template
            </Button>

            {loading ? (
              <p className="text-muted-foreground">Loading templates...</p>
            ) : templates.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No Zone Templates</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first template to enable zonal extraction
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="p-4">
                    <div className="flex justify-between">
                      <div>
                        <h4 className="font-semibold">{template.name}</h4>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.zone_count} zones defined
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editTemplate(template)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {showUpload && !showEditor && (
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Invoice Template"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label>Sample Document *</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Upload a sample document to define extraction zones
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={proceedToEditor} disabled={!uploadedImageUrl || !templateName}>
                Next: Define Zones
              </Button>
              <Button variant="outline" onClick={() => setShowUpload(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {showEditor && uploadedImageUrl && (
          <ZoneTemplateEditor
            imageUrl={uploadedImageUrl}
            onSave={handleSaveTemplate}
            onCancel={() => {
              setShowEditor(false);
              setShowUpload(false);
              setEditingTemplateId(null);
              setInitialZones([]);
            }}
            initialZones={initialZones}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
