import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { safeDecrypt } from '../_shared/encryption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailImportConfig {
  id: string;
  project_id: string;
  customer_id: string;
  created_by: string;
  email_host: string;
  email_port: number;
  email_username: string;
  email_password: string;
  email_password_encrypted?: string;
  email_folder: string;
  use_ssl: boolean;
  auto_create_batch: boolean;
  batch_name_template: string;
  delete_after_import: boolean;
  mark_as_read: boolean;
}

interface EmailAttachment {
  filename: string;
  size: number;
  data: Uint8Array;
  contentType: string;
}

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  attachments: EmailAttachment[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting email import process...');

    // Get all active email import configs
    const { data: configs, error: configError } = await supabase
      .from('email_import_configs')
      .select('*')
      .eq('is_active', true);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log('No active email import configurations found');
      return new Response(
        JSON.stringify({ message: 'No active configurations', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${configs.length} active email import configs`);
    
    let totalProcessed = 0;
    const results = [];

    for (const config of configs) {
      try {
        console.log(`Processing config ${config.id} for project ${config.project_id}`);
        
        const result = await processEmailConfig(supabase, config);
        results.push(result);
        totalProcessed += result.imported;

        // Update last check time
        await supabase
          .from('email_import_configs')
          .update({ 
            last_check_at: new Date().toISOString(),
            last_error: null
          })
          .eq('id', config.id);

      } catch (error: any) {
        console.error(`Error processing config ${config.id}:`, error);
        
        // Log the error in the config
        await supabase
          .from('email_import_configs')
          .update({ 
            last_check_at: new Date().toISOString(),
            last_error: error.message
          })
          .eq('id', config.id);

        results.push({
          configId: config.id,
          error: error.message,
          imported: 0
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed,
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Fatal error in email import:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function processEmailConfig(supabase: any, config: EmailImportConfig) {
  console.log(`Connecting to ${config.email_host}:${config.email_port}, folder: ${config.email_folder}`);
  
  // Decrypt password if encrypted version exists
  const emailPassword = config.email_password_encrypted
    ? await safeDecrypt(config.email_password_encrypted)
    : config.email_password;
  
  // Note: This is a placeholder implementation
  // In production, you would use a proper IMAP client library
  // For now, we'll use a simulated approach that demonstrates the workflow
  
  const emails = await fetchEmails({ ...config, email_password: emailPassword });
  console.log(`Found ${emails.length} unread emails with attachments`);

  let imported = 0;
  let batchId = null;

  for (const email of emails) {
    try {
      // Create batch if needed
      if (config.auto_create_batch && !batchId) {
        const batchName = config.batch_name_template.replace(
          '{date}',
          new Date().toISOString().split('T')[0]
        );

        const { data: batch, error: batchError } = await supabase
          .from('batches')
          .insert({
            batch_name: batchName,
            project_id: config.project_id,
            customer_id: config.customer_id,
            created_by: config.created_by,
            status: 'new',
            total_documents: 0
          })
          .select()
          .single();

        if (batchError) throw batchError;
        batchId = batch.id;
        console.log(`Created batch: ${batchId}`);
      }

      // Process each attachment
      for (const attachment of email.attachments) {
        const documentId = await importAttachment(
          supabase,
          config,
          email,
          attachment,
          batchId
        );

        if (documentId) {
          imported++;
          
          // Log successful import
          await supabase.from('email_import_logs').insert({
            config_id: config.id,
            email_subject: email.subject,
            email_from: email.from,
            email_date: email.date,
            file_name: attachment.filename,
            file_size: attachment.size,
            batch_id: batchId,
            document_id: documentId,
            status: 'success'
          });
        }
      }

      // Mark email as read if configured
      if (config.mark_as_read) {
        await markEmailAsRead(config, email.id);
      }

      // Delete email if configured
      if (config.delete_after_import) {
        await deleteEmail(config, email.id);
      }

    } catch (error: any) {
      console.error(`Error processing email ${email.id}:`, error);
      
      // Log failed import
      await supabase.from('email_import_logs').insert({
        config_id: config.id,
        email_subject: email.subject,
        email_from: email.from,
        email_date: email.date,
        file_name: email.attachments[0]?.filename || 'unknown',
        status: 'failed',
        error_message: error.message
      });
    }
  }

  // Update batch document count
  if (batchId && imported > 0) {
    await supabase
      .from('batches')
      .update({ total_documents: imported })
      .eq('id', batchId);
  }

  return {
    configId: config.id,
    imported,
    batchId
  };
}

async function fetchEmails(config: EmailImportConfig): Promise<Email[]> {
  // Microsoft Graph API approach for Office 365
  // For now, return placeholder to test the workflow
  // In production, you would implement Microsoft Graph API or use an IMAP library that works with Deno
  console.log(`Would connect to ${config.email_host}:${config.email_port}, folder: ${config.email_folder}`);
  console.log('Note: Full IMAP implementation requires Microsoft Graph API for Office 365');
  
  // Return empty array for now - this allows testing the rest of the workflow
  return [];
}

async function importAttachment(
  supabase: any,
  config: EmailImportConfig,
  email: any,
  attachment: any,
  batchId: string | null
) {
  try {
    // Upload file to storage
    const fileName = `${Date.now()}-${attachment.filename}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, attachment.data, {
        contentType: attachment.contentType,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        file_name: attachment.filename,
        file_type: attachment.contentType,
        file_url: publicUrl,
        project_id: config.project_id,
        batch_id: batchId,
        uploaded_by: config.created_by,
        extracted_metadata: {
          source: 'email',
          email_subject: email.subject,
          email_from: email.from,
          email_date: email.date
        }
      })
      .select()
      .single();

    if (docError) throw docError;

    console.log(`Imported document: ${doc.id}`);
    return doc.id;

  } catch (error) {
    console.error('Error importing attachment:', error);
    throw error;
  }
}

async function markEmailAsRead(config: EmailImportConfig, emailId: string) {
  console.log(`Would mark email ${emailId} as read using Microsoft Graph API`);
}

async function deleteEmail(config: EmailImportConfig, emailId: string) {
  console.log(`Would delete email ${emailId} using Microsoft Graph API`);
}
