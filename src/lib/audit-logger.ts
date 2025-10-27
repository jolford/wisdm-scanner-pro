import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  action_type: 'view' | 'edit' | 'delete' | 'export' | 'validate' | 'scan' | 'upload' | 'download' | 'approve' | 'reject' | 'create' | 'update';
  entity_type: 'document' | 'batch' | 'project' | 'user' | 'license' | 'settings';
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  success?: boolean;
  error_message?: string;
}

export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get user's customer_id if available
    let customer_id = null;
    if (user) {
      const { data: userCustomer } = await supabase
        .from('user_customers')
        .select('customer_id')
        .eq('user_id', user.id)
        .single();
      
      customer_id = userCustomer?.customer_id;
    }

    const { error } = await supabase
      .from('audit_trail')
      .insert({
        user_id: user?.id,
        customer_id,
        action_type: entry.action_type,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        old_values: entry.old_values,
        new_values: entry.new_values,
        metadata: entry.metadata || {},
        ip_address: null, // Can be filled by edge function
        user_agent: navigator.userAgent,
        success: entry.success ?? true,
        error_message: entry.error_message,
      });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

// Convenience functions for common actions
export const auditLog = {
  documentViewed: (documentId: string, metadata?: Record<string, any>) =>
    logAuditEvent({ action_type: 'view', entity_type: 'document', entity_id: documentId, metadata }),
  
  documentEdited: (documentId: string, oldValues: any, newValues: any) =>
    logAuditEvent({ action_type: 'edit', entity_type: 'document', entity_id: documentId, old_values: oldValues, new_values: newValues }),
  
  documentDeleted: (documentId: string, metadata?: Record<string, any>) =>
    logAuditEvent({ action_type: 'delete', entity_type: 'document', entity_id: documentId, metadata }),
  
  documentExported: (documentId: string, exportType: string) =>
    logAuditEvent({ action_type: 'export', entity_type: 'document', entity_id: documentId, metadata: { export_type: exportType } }),
  
  documentValidated: (documentId: string, validationStatus: string) =>
    logAuditEvent({ action_type: 'validate', entity_type: 'document', entity_id: documentId, metadata: { validation_status: validationStatus } }),
  
  documentUploaded: (documentId: string, fileName: string, fileSize: number) =>
    logAuditEvent({ action_type: 'upload', entity_type: 'document', entity_id: documentId, metadata: { file_name: fileName, file_size: fileSize } }),
  
  batchCreated: (batchId: string, batchName: string) =>
    logAuditEvent({ action_type: 'create', entity_type: 'batch', entity_id: batchId, metadata: { batch_name: batchName } }),
  
  batchExported: (batchId: string, exportType: string, documentCount: number) =>
    logAuditEvent({ action_type: 'export', entity_type: 'batch', entity_id: batchId, metadata: { export_type: exportType, document_count: documentCount } }),
  
  projectCreated: (projectId: string, projectName: string) =>
    logAuditEvent({ action_type: 'create', entity_type: 'project', entity_id: projectId, metadata: { project_name: projectName } }),
  
  projectUpdated: (projectId: string, oldValues: any, newValues: any) =>
    logAuditEvent({ action_type: 'update', entity_type: 'project', entity_id: projectId, old_values: oldValues, new_values: newValues }),
  
  settingsChanged: (settingKey: string, oldValue: any, newValue: any) =>
    logAuditEvent({ action_type: 'update', entity_type: 'settings', metadata: { setting_key: settingKey, old_value: oldValue, new_value: newValue } }),
};
