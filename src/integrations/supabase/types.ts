export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_trail: {
        Row: {
          action_type: string
          created_at: string | null
          customer_id: string | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          customer_id?: string | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          customer_id?: string | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      barcode_types: {
        Row: {
          action: string
          barcode_format: string
          created_at: string | null
          created_by: string
          document_class_id: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          pattern: string | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          action: string
          barcode_format: string
          created_at?: string | null
          created_by: string
          document_class_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          pattern?: string | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          barcode_format?: string
          created_at?: string | null
          created_by?: string
          document_class_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          pattern?: string | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barcode_types_document_class_id_fkey"
            columns: ["document_class_id"]
            isOneToOne: false
            referencedRelation: "document_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barcode_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_auto_rules: {
        Row: {
          conditions: Json
          created_at: string
          customer_id: string
          id: string
          is_active: boolean
          name: string
          priority: number
          template_id: string
          updated_at: string
        }
        Insert: {
          conditions: Json
          created_at?: string
          customer_id: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          customer_id?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_auto_rules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_auto_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "batch_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_templates: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          export_settings: Json | null
          extraction_config: Json | null
          id: string
          is_active: boolean
          name: string
          project_id: string | null
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          description?: string | null
          export_settings?: Json | null
          extraction_config?: Json | null
          id?: string
          is_active?: boolean
          name: string
          project_id?: string | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          export_settings?: Json | null
          extraction_config?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_templates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          assigned_to: string | null
          batch_name: string
          completed_at: string | null
          created_at: string | null
          created_by: string
          customer_id: string | null
          error_count: number | null
          exported_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          priority: number | null
          processed_documents: number | null
          project_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["batch_status"] | null
          total_documents: number | null
          updated_at: string | null
          validated_documents: number | null
        }
        Insert: {
          assigned_to?: string | null
          batch_name: string
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          error_count?: number | null
          exported_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: number | null
          processed_documents?: number | null
          project_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"] | null
          total_documents?: number | null
          updated_at?: string | null
          validated_documents?: number | null
        }
        Update: {
          assigned_to?: string | null
          batch_name?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          error_count?: number | null
          exported_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: number | null
          processed_documents?: number | null
          project_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_status"] | null
          total_documents?: number | null
          updated_at?: string | null
          validated_documents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          budget_limit_usd: number | null
          created_at: string | null
          current_spend_usd: number | null
          customer_id: string
          id: string
          message: string
          severity: string
          tenant_usage_id: string | null
          usage_percentage: number | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          budget_limit_usd?: number | null
          created_at?: string | null
          current_spend_usd?: number | null
          customer_id: string
          id?: string
          message: string
          severity: string
          tenant_usage_id?: string | null
          usage_percentage?: number | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          budget_limit_usd?: number | null
          created_at?: string | null
          current_spend_usd?: number | null
          customer_id?: string
          id?: string
          message?: string
          severity?: string
          tenant_usage_id?: string | null
          usage_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_alerts_tenant_usage_id_fkey"
            columns: ["tenant_usage_id"]
            isOneToOne: false
            referencedRelation: "tenant_usage"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_testimonials: {
        Row: {
          company: string
          created_at: string | null
          customer_name: string
          id: string
          quote: string
          rating: number
          role: string
          updated_at: string | null
        }
        Insert: {
          company: string
          created_at?: string | null
          customer_name: string
          id?: string
          quote: string
          rating: number
          role: string
          updated_at?: string | null
        }
        Update: {
          company?: string
          created_at?: string | null
          customer_name?: string
          id?: string
          quote?: string
          rating?: number
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          company_name: string
          contact_email: string
          contact_name: string | null
          created_at: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          company_name: string
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_cache: {
        Row: {
          cache_key: string
          cached_data: Json
          created_at: string
          document_id: string
          expires_at: string
          id: string
          signed_url: string | null
        }
        Insert: {
          cache_key: string
          cached_data: Json
          created_at?: string
          document_id: string
          expires_at: string
          id?: string
          signed_url?: string | null
        }
        Update: {
          cache_key?: string
          cached_data?: Json
          created_at?: string
          document_id?: string
          expires_at?: string
          id?: string
          signed_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_cache_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_classes: {
        Row: {
          barcode_config: Json | null
          class_type: Database["public"]["Enums"]["document_class_type"]
          created_at: string | null
          created_by: string
          description: string | null
          extraction_zones: Json | null
          id: string
          is_active: boolean | null
          name: string
          project_id: string
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          barcode_config?: Json | null
          class_type?: Database["public"]["Enums"]["document_class_type"]
          created_at?: string | null
          created_by: string
          description?: string | null
          extraction_zones?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          project_id: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          barcode_config?: Json | null
          class_type?: Database["public"]["Enums"]["document_class_type"]
          created_at?: string | null
          created_by?: string
          description?: string | null
          extraction_zones?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          project_id?: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_classes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comments: {
        Row: {
          comment: string
          created_at: string
          document_id: string
          flag_for_review: boolean | null
          id: string
          is_resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          document_id: string
          flag_for_review?: boolean | null
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          document_id?: string
          flag_for_review?: boolean | null
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_locks: {
        Row: {
          document_id: string
          expires_at: string
          id: string
          locked_at: string
          locked_by: string
          session_id: string
        }
        Insert: {
          document_id: string
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by: string
          session_id: string
        }
        Update: {
          document_id?: string
          expires_at?: string
          id?: string
          locked_at?: string
          locked_by?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_locks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          confidence_score: number | null
          created_at: string | null
          document_class_id: string | null
          document_type: Database["public"]["Enums"]["document_type"] | null
          extracted_metadata: Json | null
          extracted_text: string | null
          field_confidence: Json | null
          file_name: string
          file_type: string
          file_url: string | null
          id: string
          line_items: Json | null
          needs_review: boolean | null
          page_number: number | null
          processing_priority: number | null
          project_id: string
          redacted_file_url: string | null
          redaction_metadata: Json | null
          uploaded_by: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
          validation_suggestions: Json | null
          word_bounding_boxes: Json | null
        }
        Insert: {
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          document_class_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          extracted_metadata?: Json | null
          extracted_text?: string | null
          field_confidence?: Json | null
          file_name: string
          file_type: string
          file_url?: string | null
          id?: string
          line_items?: Json | null
          needs_review?: boolean | null
          page_number?: number | null
          processing_priority?: number | null
          project_id: string
          redacted_file_url?: string | null
          redaction_metadata?: Json | null
          uploaded_by: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          validation_suggestions?: Json | null
          word_bounding_boxes?: Json | null
        }
        Update: {
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          document_class_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type"] | null
          extracted_metadata?: Json | null
          extracted_text?: string | null
          field_confidence?: Json | null
          file_name?: string
          file_type?: string
          file_url?: string | null
          id?: string
          line_items?: Json | null
          needs_review?: boolean | null
          page_number?: number | null
          processing_priority?: number | null
          project_id?: string
          redacted_file_url?: string | null
          redaction_metadata?: Json | null
          uploaded_by?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          validation_suggestions?: Json | null
          word_bounding_boxes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_document_class_id_fkey"
            columns: ["document_class_id"]
            isOneToOne: false
            referencedRelation: "document_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_import_configs: {
        Row: {
          auto_create_batch: boolean | null
          batch_name_template: string | null
          created_at: string | null
          created_by: string
          customer_id: string | null
          delete_after_import: boolean | null
          email_folder: string
          email_host: string
          email_password: string
          email_port: number
          email_username: string
          id: string
          is_active: boolean | null
          last_check_at: string | null
          last_error: string | null
          mark_as_read: boolean | null
          project_id: string
          updated_at: string | null
          use_ssl: boolean | null
        }
        Insert: {
          auto_create_batch?: boolean | null
          batch_name_template?: string | null
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          delete_after_import?: boolean | null
          email_folder?: string
          email_host: string
          email_password: string
          email_port?: number
          email_username: string
          id?: string
          is_active?: boolean | null
          last_check_at?: string | null
          last_error?: string | null
          mark_as_read?: boolean | null
          project_id: string
          updated_at?: string | null
          use_ssl?: boolean | null
        }
        Update: {
          auto_create_batch?: boolean | null
          batch_name_template?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          delete_after_import?: boolean | null
          email_folder?: string
          email_host?: string
          email_password?: string
          email_port?: number
          email_username?: string
          id?: string
          is_active?: boolean | null
          last_check_at?: string | null
          last_error?: string | null
          mark_as_read?: boolean | null
          project_id?: string
          updated_at?: string | null
          use_ssl?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "email_import_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_import_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_import_logs: {
        Row: {
          batch_id: string | null
          config_id: string | null
          document_id: string | null
          email_date: string | null
          email_from: string
          email_subject: string
          error_message: string | null
          file_name: string
          file_size: number | null
          id: string
          imported_at: string | null
          status: string
        }
        Insert: {
          batch_id?: string | null
          config_id?: string | null
          document_id?: string | null
          email_date?: string | null
          email_from: string
          email_subject: string
          error_message?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          imported_at?: string | null
          status: string
        }
        Update: {
          batch_id?: string | null
          config_id?: string | null
          document_id?: string | null
          email_date?: string | null
          email_from?: string
          email_subject?: string
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          imported_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_import_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_import_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "email_import_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_import_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          component_name: string | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          id: string
          metadata: Json | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          id?: string
          metadata?: Json | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      field_changes: {
        Row: {
          change_type: string
          created_at: string
          document_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
          validation_status: string | null
        }
        Insert: {
          change_type: string
          created_at?: string
          document_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
          validation_status?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          document_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_changes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      job_metrics: {
        Row: {
          avg_processing_time_ms: number | null
          completed_jobs: number | null
          created_at: string | null
          customer_id: string | null
          failed_jobs: number | null
          id: string
          job_type: string
          metric_date: string
          metric_hour: number | null
          total_jobs: number | null
        }
        Insert: {
          avg_processing_time_ms?: number | null
          completed_jobs?: number | null
          created_at?: string | null
          customer_id?: string | null
          failed_jobs?: number | null
          id?: string
          job_type: string
          metric_date: string
          metric_hour?: number | null
          total_jobs?: number | null
        }
        Update: {
          avg_processing_time_ms?: number | null
          completed_jobs?: number | null
          created_at?: string | null
          customer_id?: string | null
          failed_jobs?: number | null
          id?: string
          job_type?: string
          metric_date?: string
          metric_hour?: number | null
          total_jobs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_metrics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number | null
          payload: Json
          priority: Database["public"]["Enums"]["job_priority"]
          result: Json | null
          scheduled_for: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          payload: Json
          priority?: Database["public"]["Enums"]["job_priority"]
          result?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          payload?: Json
          priority?: Database["public"]["Enums"]["job_priority"]
          result?: Json | null
          scheduled_for?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      license_usage: {
        Row: {
          document_id: string | null
          documents_used: number
          id: string
          license_id: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          document_id?: string | null
          documents_used?: number
          id?: string
          license_id: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          document_id?: string | null
          documents_used?: number
          id?: string
          license_id?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_usage_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_usage_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string | null
          customer_id: string
          end_date: string
          id: string
          license_key: string
          notes: string | null
          plan_type: Database["public"]["Enums"]["license_tier"]
          remaining_documents: number
          start_date: string
          status: Database["public"]["Enums"]["license_status"]
          total_documents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          end_date: string
          id?: string
          license_key: string
          notes?: string | null
          plan_type?: Database["public"]["Enums"]["license_tier"]
          remaining_documents: number
          start_date?: string
          status?: Database["public"]["Enums"]["license_status"]
          total_documents: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          end_date?: string
          id?: string
          license_key?: string
          notes?: string | null
          plan_type?: Database["public"]["Enums"]["license_tier"]
          remaining_documents?: number
          start_date?: string
          status?: Database["public"]["Enums"]["license_status"]
          total_documents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string
          customer_id: string | null
          description: string | null
          enable_check_scanning: boolean | null
          export_types: string[] | null
          extraction_fields: Json
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          queues: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          description?: string | null
          enable_check_scanning?: boolean | null
          export_types?: string[] | null
          extraction_fields?: Json
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          queues?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          description?: string | null
          enable_check_scanning?: boolean | null
          export_types?: string[] | null
          extraction_fields?: Json
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          queues?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reporting_snapshots: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          metric_data: Json
          metric_type: string
          snapshot_date: string
          snapshot_hour: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          metric_data: Json
          metric_type: string
          snapshot_date: string
          snapshot_hour?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          metric_data?: Json
          metric_type?: string
          snapshot_date?: string
          snapshot_hour?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reporting_snapshots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      scanner_import_configs: {
        Row: {
          auto_create_batch: boolean | null
          batch_name_template: string | null
          created_at: string | null
          created_by: string
          customer_id: string | null
          id: string
          is_active: boolean | null
          last_check_at: string | null
          project_id: string
          updated_at: string | null
          watch_folder: string
        }
        Insert: {
          auto_create_batch?: boolean | null
          batch_name_template?: string | null
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          last_check_at?: string | null
          project_id: string
          updated_at?: string | null
          watch_folder: string
        }
        Update: {
          auto_create_batch?: boolean | null
          batch_name_template?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          last_check_at?: string | null
          project_id?: string
          updated_at?: string | null
          watch_folder?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanner_import_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_import_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scanner_import_logs: {
        Row: {
          batch_id: string | null
          config_id: string | null
          document_id: string | null
          error_message: string | null
          file_name: string
          file_path: string
          id: string
          imported_at: string | null
          status: string
        }
        Insert: {
          batch_id?: string | null
          config_id?: string | null
          document_id?: string | null
          error_message?: string | null
          file_name: string
          file_path: string
          id?: string
          imported_at?: string | null
          status: string
        }
        Update: {
          batch_id?: string | null
          config_id?: string | null
          document_id?: string | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          id?: string
          imported_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanner_import_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_import_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "scanner_import_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scanner_import_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_exports: {
        Row: {
          created_at: string
          created_by: string
          day_of_month: number | null
          day_of_week: number | null
          destination_config: Json
          export_types: Json
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string | null
          project_id: string
          time_of_day: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_month?: number | null
          day_of_week?: number | null
          destination_config?: Json
          export_types?: Json
          frequency: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          project_id: string
          time_of_day: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_month?: number | null
          day_of_week?: number | null
          destination_config?: Json
          export_types?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string | null
          project_id?: string
          time_of_day?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_exports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      tenant_limits: {
        Row: {
          allow_high_priority: boolean | null
          created_at: string | null
          customer_id: string
          default_priority: Database["public"]["Enums"]["job_priority"] | null
          id: string
          max_concurrent_jobs: number | null
          max_daily_documents: number | null
          max_jobs_per_hour: number | null
          max_jobs_per_minute: number | null
          updated_at: string | null
        }
        Insert: {
          allow_high_priority?: boolean | null
          created_at?: string | null
          customer_id: string
          default_priority?: Database["public"]["Enums"]["job_priority"] | null
          id?: string
          max_concurrent_jobs?: number | null
          max_daily_documents?: number | null
          max_jobs_per_hour?: number | null
          max_jobs_per_minute?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_high_priority?: boolean | null
          created_at?: string | null
          customer_id?: string
          default_priority?: Database["public"]["Enums"]["job_priority"] | null
          id?: string
          max_concurrent_jobs?: number | null
          max_daily_documents?: number | null
          max_jobs_per_hour?: number | null
          max_jobs_per_minute?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_limits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage: {
        Row: {
          ai_cost_usd: number | null
          budget_alert_sent: boolean | null
          budget_alert_threshold: number | null
          budget_limit_usd: number | null
          created_at: string | null
          customer_id: string
          documents_failed: number | null
          documents_processed: number | null
          id: string
          period_end: string
          period_start: string
          storage_cost_usd: number | null
          total_cost_usd: number | null
          updated_at: string | null
        }
        Insert: {
          ai_cost_usd?: number | null
          budget_alert_sent?: boolean | null
          budget_alert_threshold?: number | null
          budget_limit_usd?: number | null
          created_at?: string | null
          customer_id: string
          documents_failed?: number | null
          documents_processed?: number | null
          id?: string
          period_end: string
          period_start: string
          storage_cost_usd?: number | null
          total_cost_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_cost_usd?: number | null
          budget_alert_sent?: boolean | null
          budget_alert_threshold?: number | null
          budget_limit_usd?: number | null
          created_at?: string | null
          customer_id?: string
          documents_failed?: number | null
          documents_processed?: number | null
          id?: string
          period_end?: string
          period_start?: string
          storage_cost_usd?: number | null
          total_cost_usd?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tos_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          privacy_policy_version: string
          tos_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          privacy_policy_version: string
          tos_version: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          privacy_policy_version?: string
          tos_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tos_versions: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          is_current: boolean
          privacy_policy_version: string
          tos_version: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          is_current?: boolean
          privacy_policy_version: string
          tos_version: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          is_current?: boolean
          privacy_policy_version?: string
          tos_version?: string
        }
        Relationships: []
      }
      user_customers: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_export: boolean | null
          can_scan: boolean | null
          can_validate: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_export?: boolean | null
          can_scan?: boolean | null
          can_validate?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_export?: boolean | null
          can_scan?: boolean | null
          can_validate?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          auto_navigate_validation: boolean | null
          created_at: string | null
          default_batch_view: string | null
          default_starting_page: string | null
          id: string
          notifications_enabled: boolean | null
          show_tooltips: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_navigate_validation?: boolean | null
          created_at?: string | null
          default_batch_view?: string | null
          default_starting_page?: string | null
          id?: string
          notifications_enabled?: boolean | null
          show_tooltips?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_navigate_validation?: boolean | null
          created_at?: string | null
          default_batch_view?: string | null
          default_starting_page?: string | null
          id?: string
          notifications_enabled?: boolean | null
          show_tooltips?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validation_analytics: {
        Row: {
          avg_time_seconds: number | null
          created_at: string
          customer_id: string
          document_type: string | null
          documents_rejected: number | null
          documents_validated: number | null
          field_errors: Json | null
          id: string
          project_id: string | null
          total_time_seconds: number | null
          updated_at: string
          user_id: string | null
          validation_date: string
          validation_hour: number
        }
        Insert: {
          avg_time_seconds?: number | null
          created_at?: string
          customer_id: string
          document_type?: string | null
          documents_rejected?: number | null
          documents_validated?: number | null
          field_errors?: Json | null
          id?: string
          project_id?: string | null
          total_time_seconds?: number | null
          updated_at?: string
          user_id?: string | null
          validation_date?: string
          validation_hour?: number
        }
        Update: {
          avg_time_seconds?: number | null
          created_at?: string
          customer_id?: string
          document_type?: string | null
          documents_rejected?: number | null
          documents_validated?: number | null
          field_errors?: Json | null
          id?: string
          project_id?: string | null
          total_time_seconds?: number | null
          updated_at?: string
          user_id?: string | null
          validation_date?: string
          validation_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "validation_analytics_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_analytics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: Json
      }
      admin_bulk_delete_batches: {
        Args: { batch_ids: string[] }
        Returns: Json
      }
      calculate_ai_cost: {
        Args: {
          _input_tokens: number
          _is_image?: boolean
          _model: string
          _output_tokens: number
        }
        Returns: number
      }
      check_license_capacity: {
        Args: { _documents_needed?: number; _license_id: string }
        Returns: boolean
      }
      check_tenant_rate_limit: {
        Args: { _customer_id: string; _job_type?: string }
        Returns: boolean
      }
      cleanup_expired_locks: { Args: never; Returns: undefined }
      consume_license_documents:
        | {
            Args: {
              _document_id: string
              _documents_count?: number
              _license_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _document_id: string
              _documents_count?: number
              _license_id: string
              _user_id: string
            }
            Returns: boolean
          }
      delete_expired_cache: { Args: never; Returns: undefined }
      generate_license_key: { Args: never; Returns: string }
      get_next_job: { Args: never; Returns: string }
      get_project_safe: {
        Args: { project_id: string }
        Returns: {
          created_at: string
          created_by: string
          customer_id: string
          description: string
          enable_check_scanning: boolean
          export_types: string[]
          extraction_fields: Json
          id: string
          is_active: boolean
          metadata: Json
          name: string
          queues: Json
          updated_at: string
        }[]
      }
      has_customer: {
        Args: { _customer_id: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_enhanced: { Args: never; Returns: boolean }
      is_admin_jwt: { Args: never; Returns: boolean }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _customer_id: string; _user_id: string }
        Returns: boolean
      }
      jwt_claim: { Args: { path: string }; Returns: string }
      track_field_change: {
        Args: {
          _change_type: string
          _document_id: string
          _field_name: string
          _new_value: string
          _old_value: string
        }
        Returns: string
      }
      update_tenant_usage: {
        Args: {
          _cost_usd: number
          _customer_id: string
          _documents_count?: number
          _failed?: boolean
          _job_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "system_admin"
      batch_status:
        | "new"
        | "scanning"
        | "indexing"
        | "validation"
        | "complete"
        | "exported"
        | "error"
        | "suspended"
      document_class_type:
        | "invoice"
        | "receipt"
        | "form"
        | "contract"
        | "id_card"
        | "check"
        | "other"
      document_type:
        | "check"
        | "invoice"
        | "purchase_order"
        | "receipt"
        | "contract"
        | "legal_document"
        | "form"
        | "letter"
        | "other"
      job_priority: "low" | "normal" | "high" | "urgent"
      job_status: "pending" | "processing" | "completed" | "failed" | "retrying"
      license_status: "active" | "expired" | "suspended" | "exhausted"
      license_tier: "starter" | "professional" | "business" | "enterprise"
      validation_status: "pending" | "validated" | "rejected" | "needs_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "system_admin"],
      batch_status: [
        "new",
        "scanning",
        "indexing",
        "validation",
        "complete",
        "exported",
        "error",
        "suspended",
      ],
      document_class_type: [
        "invoice",
        "receipt",
        "form",
        "contract",
        "id_card",
        "check",
        "other",
      ],
      document_type: [
        "check",
        "invoice",
        "purchase_order",
        "receipt",
        "contract",
        "legal_document",
        "form",
        "letter",
        "other",
      ],
      job_priority: ["low", "normal", "high", "urgent"],
      job_status: ["pending", "processing", "completed", "failed", "retrying"],
      license_status: ["active", "expired", "suspended", "exhausted"],
      license_tier: ["starter", "professional", "business", "enterprise"],
      validation_status: ["pending", "validated", "rejected", "needs_review"],
    },
  },
} as const
