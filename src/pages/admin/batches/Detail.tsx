import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, CheckCircle2, XCircle, AlertCircle, Trash2, Download, FileSpreadsheet, FileJson, FileType, Cloud, Database, Clock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const BatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isSystemAdmin } = useAuth();

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batches')
        .select(`
          *,
          projects (name, extraction_fields, metadata, export_types)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: documents } = useQuery({
    queryKey: ['batch-documents', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('batch_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('batches')
        .update({ status: newStatus as any })
        .eq('id', id);

      if (error) throw error;

      // Trigger automatic export when moving to 'exported' status
      if (newStatus === 'exported') {
        toast({
          title: 'Exporting...',
          description: 'Automatically exporting batch to configured destinations',
        });

        const { data, error: exportError } = await supabase.functions.invoke('auto-export-batch', {
          body: { batchId: id }
        });

        if (exportError) {
          console.error('Auto-export error:', exportError);
          toast({
            title: 'Export Warning',
            description: 'Batch status updated but auto-export failed. You can manually export from batch details.',
            variant: 'destructive',
          });
        } else if (data?.success) {
          toast({
            title: 'Batch Exported',
            description: `Successfully exported to ${data.exports?.length || 0} format(s)`,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
      toast({
        title: 'Status Updated',
        description: 'Batch status has been updated successfully',
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async () => {
      // Use secure backend function to handle cascading deletes
      const { data, error } = await supabase.functions.invoke('delete-batch-safe', {
        body: { batchId: id },
      });

      if (error || (data && (data as any).error)) {
        throw new Error(error?.message || (data as any)?.error || 'Delete failed');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Batch Deleted',
        description: 'Batch and all its documents have been deleted',
      });
      navigate('/admin/batches');
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-500',
      scanning: 'bg-purple-500',
      indexing: 'bg-yellow-500',
      validation: 'bg-orange-500',
      validated: 'bg-teal-500',
      complete: 'bg-green-500',
      exported: 'bg-gray-500',
      suspended: 'bg-amber-600',
      error: 'bg-red-500',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getValidationStatusIcon = (status: string) => {
    switch (status) {
      case 'validated':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'needs_review':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDuration = (startDate: string, endDate: string | null) => {
    if (!endDate) return null;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const diffMs = end - start;
    
    if (diffMs < 0) return 'N/A';
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  };

  // Export functions
  const getExportConfig = () => {
    const metadata = batch?.projects?.metadata as any;
    return metadata?.export_config || metadata?.exportConfig || {};
  };

  const getEnabledExportTypes = () => {
    const exportConfig = getExportConfig();
    const enabledTypes: string[] = [];
    
    // Check standard export types
    Object.entries(exportConfig).forEach(([type, config]: [string, any]) => {
      if (config?.enabled) {
        enabledTypes.push(type);
      }
    });
    
    // Check ECM systems
    if (exportConfig.filebound?.enabled) {
      enabledTypes.push('filebound');
    }
    if (exportConfig.docmgt?.enabled) {
      enabledTypes.push('docmgt');
    }
    
    return enabledTypes.length > 0 ? enabledTypes : batch?.projects?.export_types || [];
  };

  const getExportDestination = (type: string) => {
    const exportConfig = getExportConfig();
    return exportConfig[type]?.destination || '/exports/';
  };

  const getValidationReasons = (result: any): string => {
    const reasons: string[] = [];
    
    // Check if not found in database at all
    if (!result.found) {
      reasons.push('Not found in voter database');
      return reasons.join('; ');
    }
    
    // Check individual field results
    const fieldResults = result.fieldResults || [];
    for (const field of fieldResults) {
      if (!field.matches) {
        const fieldName = field.field?.replace(/_/g, ' ') || 'Unknown field';
        if (field.suggestion) {
          reasons.push(`${fieldName} doesn't match (expected: ${field.suggestion})`);
        } else if (field.lookupValue) {
          reasons.push(`${fieldName} doesn't match database (expected: ${field.lookupValue})`);
        } else {
          reasons.push(`${fieldName} doesn't match database`);
        }
      }
    }
    
    // Check signature status
    const signatureStatus = result.signatureStatus;
    if (signatureStatus && !signatureStatus.present) {
      reasons.push('Signature missing');
    }
    
    return reasons.length > 0 ? reasons.join('; ') : 'Valid';
  };

  const exportToCSV = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    // Get batch custom fields from metadata
    const batchCustomFields = (batch?.metadata as any)?.custom_fields || {};
    const batchFieldKeys = Object.keys(batchCustomFields);
    
    // Check if any document has line items (petition processing)
    const hasLineItems = documents.some(doc => {
      const lineItems = doc.line_items as any[] || [];
      return lineItems.length > 0;
    });

    if (hasLineItems) {
      // Export line items with validation reasons
      const headers = [
        'Batch Name',
        ...batchFieldKeys,
        'Document',
        'Page',
        'Row Number',
        'Printed Name',
        'Address',
        'City',
        'Zip',
        'Signature Present',
        'Validation Status',
        'Validation Reasons'
      ];
      
      const rows: any[][] = [];
      
      for (const doc of documents) {
        const lineItems = doc.line_items as any[] || [];
        const validationSuggestions = doc.validation_suggestions as any;
        const lookupResults = validationSuggestions?.lookupValidation?.results || [];
        
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const validationResult = lookupResults[i];
          
          // Skip rejected signatures
          if (validationResult?.rejected) continue;
          
          // Check if operator override approved - if so, mark as Valid
          const isOverrideApproved = validationResult?.overrideApproved === true;
          const isValid = isOverrideApproved || (validationResult?.found && 
            validationResult?.matchScore >= 0.8 && 
            validationResult?.signatureStatus?.present !== false);
          
          const reasons = isOverrideApproved 
            ? 'Manually approved by operator' 
            : (validationResult ? getValidationReasons(validationResult) : 'Not validated');
          
          rows.push([
            batch?.batch_name || '',
            ...batchFieldKeys.map(key => batchCustomFields[key] || ''),
            doc.file_name,
            doc.page_number || 1,
            item.Row_Number || i + 1,
            item.Printed_Name || item.printed_name || '',
            item.Address || item.address || '',
            item.City || item.city || '',
            item.Zip || item.zip || '',
            item.Signature_Present || item.signature_present || '',
            isValid ? 'Valid' : 'Invalid',
            reasons
          ]);
        }
      }

      // Add total signatures count at the bottom
      const csvRows = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const totalRow = `\n"Total Signatures = ${rows.length}"`;
      const csv = csvRows + totalRow;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batch?.batch_name || 'batch'}-signers.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ 
        title: 'Exported successfully', 
        description: `CSV file with ${rows.length} signer records and validation reasons downloaded` 
      });
    } else {
      // Standard document export
      const headers = [
        'Batch Name',
        ...batchFieldKeys,
        'File Name',
        'Status',
        'Page',
        'Confidence',
        'Type',
        ...Object.keys(documents[0].extracted_metadata || {})
      ];
      
      const rows = documents.map(doc => [
        batch?.batch_name || '',
        ...batchFieldKeys.map(key => batchCustomFields[key] || ''),
        doc.file_name,
        doc.validation_status,
        doc.page_number,
        doc.confidence_score || '',
        doc.file_type,
        ...Object.values(doc.extracted_metadata || {})
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batch?.batch_name || 'batch'}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ 
        title: 'Exported successfully', 
        description: `CSV file downloaded with batch fields (destination: ${getExportDestination('csv')})` 
      });
    }
  };

  const exportToJSON = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const batchCustomFields = (batch?.metadata as any)?.custom_fields || {};
    
    const exportData = {
      batch: {
        id: batch?.id,
        name: batch?.batch_name,
        status: batch?.status,
        created_at: batch?.created_at,
        total_documents: batch?.total_documents,
        validated_documents: batch?.validated_documents,
        custom_fields: batchCustomFields,
      },
      documents: documents.map(doc => ({
        batch_name: batch?.batch_name,
        ...batchCustomFields,
        file_name: doc.file_name,
        validation_status: doc.validation_status,
        page_number: doc.page_number,
        confidence_score: doc.confidence_score,
        file_type: doc.file_type,
        extracted_metadata: doc.extracted_metadata,
        extracted_text: doc.extracted_text,
      }))
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `JSON file downloaded with batch fields (destination: ${getExportDestination('json')})` 
    });
  };

  const exportToTXT = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const batchCustomFields = (batch?.metadata as any)?.custom_fields || {};
    const batchFieldsText = Object.entries(batchCustomFields)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    const batchHeader = `BATCH: ${batch?.batch_name || 'Unnamed'}\n${batchFieldsText ? batchFieldsText + '\n' : ''}${'='.repeat(80)}\n\n`;
    
    const text = batchHeader + documents.map(doc => {
      const batchFields = Object.entries(batchCustomFields)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      const metadata = Object.entries(doc.extracted_metadata || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      return `File: ${doc.file_name}\nBatch: ${batch?.batch_name}\n${batchFields ? batchFields + '\n' : ''}Status: ${doc.validation_status}\nPage: ${doc.page_number}\n${metadata}\n\nExtracted Text:\n${doc.extracted_text || 'N/A'}\n\n${'='.repeat(80)}\n`;
    }).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `Text file downloaded with batch fields (destination: ${getExportDestination('txt')})` 
    });
  };

  const exportToXML = () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    const batchCustomFields = (batch?.metadata as any)?.custom_fields || {};
    
    const escapeXml = (str: any) => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const batchFieldsXml = Object.entries(batchCustomFields)
      .map(([key, value]) => `    <${key}>${escapeXml(value)}</${key}>`)
      .join('\n');

    const xmlDocs = documents.map(doc => {
      const batchFieldsForDoc = Object.entries(batchCustomFields)
        .map(([key, value]) => `    <${key}>${escapeXml(value)}</${key}>`)
        .join('\n');
      const metadata = Object.entries(doc.extracted_metadata || {})
        .map(([key, value]) => `    <${key}>${escapeXml(value)}</${key}>`)
        .join('\n');
      return `  <document>
    <batch_name>${escapeXml(batch?.batch_name)}</batch_name>
${batchFieldsForDoc}
    <file_name>${escapeXml(doc.file_name)}</file_name>
    <validation_status>${escapeXml(doc.validation_status)}</validation_status>
    <page_number>${escapeXml(doc.page_number)}</page_number>
    <confidence_score>${escapeXml(doc.confidence_score || '')}</confidence_score>
    <file_type>${escapeXml(doc.file_type)}</file_type>
    <metadata>
${metadata}
    </metadata>
    <extracted_text>${escapeXml(doc.extracted_text || '')}</extracted_text>
  </document>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<batch>
  <batch_info>
    <name>${escapeXml(batch?.batch_name)}</name>
    <status>${escapeXml(batch?.status)}</status>
    <total_documents>${escapeXml(batch?.total_documents)}</total_documents>
  </batch_info>
  <custom_fields>
${batchFieldsXml}
  </custom_fields>
  <documents>
${xmlDocs}
  </documents>
</batch>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batch?.batch_name || 'batch'}-export.xml`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ 
      title: 'Exported successfully', 
      description: `XML file downloaded with batch fields (destination: ${getExportDestination('xml')})` 
    });
  };

  const downloadRedactedImages = async () => {
    if (!documents || documents.length === 0) {
      toast({ title: 'No documents to export', variant: 'destructive' });
      return;
    }

    // Find documents with redacted versions
    const redactedDocs = documents.filter(doc => doc.redacted_file_url);
    
    if (redactedDocs.length === 0) {
      toast({ 
        title: 'No redacted documents', 
        description: 'No documents in this batch have redacted versions. Process documents with AB1466 redaction first.',
        variant: 'destructive' 
      });
      return;
    }

    toast({ title: 'Downloading...', description: `Downloading ${redactedDocs.length} redacted document(s)` });

    for (const doc of redactedDocs) {
      try {
        // Get public URL for redacted file
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(doc.redacted_file_url!);

        if (urlData?.publicUrl) {
          const response = await fetch(urlData.publicUrl);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          // Use original filename with _redacted suffix
          const ext = doc.redacted_file_url!.split('.').pop() || 'png';
          const baseName = doc.file_name.replace(/\.[^/.]+$/, '');
          a.download = `${baseName}_redacted.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error(`Failed to download redacted version of ${doc.file_name}:`, error);
      }
    }

    toast({ 
      title: 'Download complete', 
      description: `Downloaded ${redactedDocs.length} redacted document(s)` 
    });
  };

  const exportToFilebound = async () => {
    const exportConfig = getExportConfig();
    const fileboundConfig = exportConfig?.filebound;
    
    if (!fileboundConfig?.enabled || !fileboundConfig.url) {
      toast({ 
        title: 'Filebound not configured', 
        description: 'Please configure Filebound export in project settings first',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('export-to-filebound', {
        body: {
          batchId: id,
          fileboundUrl: fileboundConfig.url,
          username: fileboundConfig.username,
          password: fileboundConfig.password,
          project: fileboundConfig.project,
          fieldMappings: fileboundConfig.fieldMappings || {}
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: 'Export successful', 
          description: `Exported to Filebound project: ${fileboundConfig.project}` 
        });
        queryClient.invalidateQueries({ queryKey: ['batch', id] });
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Filebound export error:', error);
      toast({ 
        title: 'Export failed', 
        description: error.message || 'Failed to export to Filebound',
        variant: 'destructive'
      });
    }
  };

  const exportToDocmgt = async () => {
    const exportConfig = getExportConfig();
    const docmgtConfig = exportConfig?.docmgt;
    
    if (!docmgtConfig?.enabled || !docmgtConfig.url) {
      toast({ 
        title: 'Docmgt not configured', 
        description: 'Please configure Docmgt export in project settings first',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('export-to-docmgt', {
        body: {
          batchId: id,
          docmgtUrl: docmgtConfig.url,
          username: docmgtConfig.username,
          password: docmgtConfig.password,
          project: docmgtConfig.project,
          recordTypeId: docmgtConfig.recordTypeId,
          fieldMappings: docmgtConfig.fieldMappings || {}
        },
      });

      if (error) {
        console.error('Docmgt invocation error:', error);
        throw new Error(error.message || 'Failed to invoke export function');
      }

      if (data?.success) {
        toast({ 
          title: 'Export successful', 
          description: data.message || `Successfully exported ${data.results?.length || 0} documents to Docmgt` 
        });
        queryClient.invalidateQueries({ queryKey: ['batch', id] });
      } else {
        // Show detailed error with available record types if provided
        let errorMsg = data?.error || data?.message || 'Export failed';
        if (data?.availableRecordTypes && data.availableRecordTypes.length > 0) {
          errorMsg += '\n\nAvailable RecordTypes: ' + 
            data.availableRecordTypes.map((rt: any) => `${rt.name} (ID: ${rt.id})`).join(', ');
        }
        console.error('Docmgt export failed:', data);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Docmgt export error:', error);
      toast({ 
        title: 'Export failed', 
        description: error.message || 'Failed to export to Docmgt. Check console for details.',
        variant: 'destructive',
        duration: 10000, // Show for 10 seconds for long error messages
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Batch Not Found</h2>
          <Button onClick={() => navigate('/admin/batches')}>Back to Batches</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/admin/batches')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{batch.batch_name}</h1>
              <Badge className={getStatusColor(batch.status)}>
                {batch.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Project: {batch.projects?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {batch.status !== 'suspended' ? (
              <Button 
                variant="outline" 
                onClick={() => updateStatusMutation.mutate('suspended')}
                disabled={updateStatusMutation.isPending}
              >
                Suspend Batch
              </Button>
            ) : (
              <Button 
                variant="outline"
                onClick={() => updateStatusMutation.mutate('validation')}
                disabled={updateStatusMutation.isPending}
              >
                Resume Batch
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!documents || documents.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {getEnabledExportTypes().includes('csv') && (
                  <DropdownMenuItem onClick={exportToCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('json') && (
                  <DropdownMenuItem onClick={exportToJSON}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('xml') && (
                  <DropdownMenuItem onClick={exportToXML}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as XML
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('txt') && (
                  <DropdownMenuItem onClick={exportToTXT}>
                    <FileType className="h-4 w-4 mr-2" />
                    Export as TXT
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('filebound') && (
                  <DropdownMenuItem onClick={exportToFilebound}>
                    <Cloud className="h-4 w-4 mr-2" />
                    Export to Filebound
                  </DropdownMenuItem>
                )}
                {getEnabledExportTypes().includes('docmgt') && (
                  <DropdownMenuItem onClick={exportToDocmgt}>
                    <Database className="h-4 w-4 mr-2" />
                    Export to Docmgt
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={downloadRedactedImages}>
                  <Shield className="h-4 w-4 mr-2" />
                  Download Redacted Images
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Select
              value={batch.status}
              onValueChange={(value) => updateStatusMutation.mutate(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="scanning">Scanning</SelectItem>
                <SelectItem value="indexing">Indexing</SelectItem>
                <SelectItem value="validation">Validation</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="exported">Exported</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Batch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this batch and all {documents?.length || 0} documents in it. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteBatchMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Statistics */}
        <div className={`grid ${(isAdmin || isSystemAdmin) && batch.completed_at ? 'grid-cols-6' : 'grid-cols-4'} gap-4 mb-8`}>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Documents</p>
            <p className="text-3xl font-bold">{batch.total_documents}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Processed</p>
            <p className="text-3xl font-bold">{batch.processed_documents}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Validated</p>
            <p className="text-3xl font-bold">{batch.validated_documents}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Errors</p>
            <p className="text-3xl font-bold text-destructive">{batch.error_count}</p>
          </Card>
          {(isAdmin || isSystemAdmin) && batch.completed_at && (
            <>
              <Card className="p-6 bg-primary/5">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Total Duration
                </p>
                <p className="text-3xl font-bold">{formatDuration(batch.created_at!, batch.completed_at)}</p>
                <p className="text-xs text-muted-foreground mt-1">Creation to completion</p>
              </Card>
              {batch.started_at && (
                <Card className="p-6 bg-primary/5">
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Processing Time
                  </p>
                  <p className="text-3xl font-bold">{formatDuration(batch.started_at, batch.completed_at)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Start to completion</p>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Documents List */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents ({documents?.length || 0})
          </h2>
          
          {documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getValidationStatusIcon(doc.validation_status)}
                    <div>
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type} • Page {doc.page_number}
                        {doc.confidence_score && ` • ${doc.confidence_score}% confidence`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={doc.needs_review ? 'destructive' : 'secondary'}>
                      {doc.validation_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents in this batch yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/')}
              >
                Start Scanning
              </Button>
            </div>
          )}
        </Card>

        {/* Export Information */}
        {batch.exported_at && (
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Export Information
            </h3>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Exported At:</span>{' '}
                <span className="text-muted-foreground">
                  {new Date(batch.exported_at).toLocaleString()}
                </span>
              </p>
              {batch.metadata && typeof batch.metadata === 'object' && 'exports' in batch.metadata && Array.isArray(batch.metadata.exports) && batch.metadata.exports.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Exported Files:</p>
                  <div className="space-y-2">
                    {batch.metadata.exports.map((exp: any, idx: number) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{exp.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              Type: {exp.type.toUpperCase()} • Destination: {exp.destination}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-green-500/10 text-green-700">
                            Exported
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {batch.notes && (
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-2">Notes</h3>
            <p className="text-muted-foreground">{batch.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BatchDetail;
