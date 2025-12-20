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
      address_validations: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          document_id: string
          id: string
          normalized_address: Json | null
          original_address: Json
          validation_details: Json | null
          validation_provider: string | null
          validation_status: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          document_id: string
          id?: string
          normalized_address?: Json | null
          original_address: Json
          validation_details?: Json | null
          validation_provider?: string | null
          validation_status: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          document_id?: string
          id?: string
          normalized_address?: Json | null
          original_address?: Json
          validation_details?: Json | null
          validation_provider?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_validations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_usage: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allowed_project_ids: string[] | null
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          last_used_ip: string | null
          name: string
          rate_limit_per_day: number
          rate_limit_per_hour: number
          rate_limit_per_minute: number
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          rotated_at: string | null
          rotated_from_key_id: string | null
          scope: Database["public"]["Enums"]["api_key_scope"]
          updated_at: string
          usage_count: number
        }
        Insert: {
          allowed_project_ids?: string[] | null
          created_at?: string
          created_by: string
          customer_id: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name: string
          rate_limit_per_day?: number
          rate_limit_per_hour?: number
          rate_limit_per_minute?: number
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          rotated_at?: string | null
          rotated_from_key_id?: string | null
          scope?: Database["public"]["Enums"]["api_key_scope"]
          updated_at?: string
          usage_count?: number
        }
        Update: {
          allowed_project_ids?: string[] | null
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          name?: string
          rate_limit_per_day?: number
          rate_limit_per_hour?: number
          rate_limit_per_minute?: number
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          rotated_at?: string | null
          rotated_from_key_id?: string | null
          scope?: Database["public"]["Enums"]["api_key_scope"]
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_rotated_from_key_id_fkey"
            columns: ["rotated_from_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
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
          trigger_schedule: string | null
          trigger_type: string | null
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
          trigger_schedule?: string | null
          trigger_type?: string | null
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
          trigger_schedule?: string | null
          trigger_type?: string | null
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
          export_started_at: string | null
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
          export_started_at?: string | null
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
          export_started_at?: string | null
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
      custom_scripts: {
        Row: {
          created_at: string | null
          created_by: string
          customer_id: string
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          project_id: string | null
          schedule_cron: string | null
          script_code: string
          script_language: string
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          customer_id: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          project_id?: string | null
          schedule_cron?: string | null
          script_code: string
          script_language: string
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          customer_id?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          project_id?: string | null
          schedule_cron?: string | null
          script_code?: string
          script_language?: string
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_scripts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      detected_fields: {
        Row: {
          auto_detected: boolean | null
          bounding_box: Json | null
          confidence: number | null
          created_at: string | null
          document_id: string
          field_name: string
          field_type: string
          id: string
        }
        Insert: {
          auto_detected?: boolean | null
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string | null
          document_id: string
          field_name: string
          field_type: string
          id?: string
        }
        Update: {
          auto_detected?: boolean | null
          bounding_box?: Json | null
          confidence?: number | null
          created_at?: string | null
          document_id?: string
          field_name?: string
          field_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detected_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
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
      document_exceptions: {
        Row: {
          assigned_to: string | null
          batch_id: string
          created_at: string
          description: string
          details: Json | null
          document_id: string
          exception_type: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          batch_id: string
          created_at?: string
          description: string
          details?: Json | null
          document_id: string
          exception_type: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          batch_id?: string
          created_at?: string
          description?: string
          details?: Json | null
          document_id?: string
          exception_type?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_exceptions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_exceptions_document_id_fkey"
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
      document_purge_logs: {
        Row: {
          archived_location: string | null
          batch_id: string | null
          customer_id: string
          document_id: string
          document_name: string | null
          id: string
          metadata: Json | null
          policy_id: string | null
          project_id: string | null
          purge_reason: string
          purged_at: string | null
          purged_by: string | null
        }
        Insert: {
          archived_location?: string | null
          batch_id?: string | null
          customer_id: string
          document_id: string
          document_name?: string | null
          id?: string
          metadata?: Json | null
          policy_id?: string | null
          project_id?: string | null
          purge_reason: string
          purged_at?: string | null
          purged_by?: string | null
        }
        Update: {
          archived_location?: string | null
          batch_id?: string | null
          customer_id?: string
          document_id?: string
          document_name?: string | null
          id?: string
          metadata?: Json | null
          policy_id?: string | null
          project_id?: string | null
          purge_reason?: string
          purged_at?: string | null
          purged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_purge_logs_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_summary: string | null
          change_type: string
          changed_at: string | null
          changed_by: string | null
          changed_fields: Json | null
          classification_metadata: Json | null
          confidence_score: number | null
          document_id: string
          extracted_metadata: Json | null
          extracted_text: string | null
          field_confidence: Json | null
          file_name: string | null
          file_url: string | null
          id: string
          line_items: Json | null
          validation_status: string | null
          version_number: number
          word_bounding_boxes: Json | null
        }
        Insert: {
          change_summary?: string | null
          change_type: string
          changed_at?: string | null
          changed_by?: string | null
          changed_fields?: Json | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          document_id: string
          extracted_metadata?: Json | null
          extracted_text?: string | null
          field_confidence?: Json | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          line_items?: Json | null
          validation_status?: string | null
          version_number: number
          word_bounding_boxes?: Json | null
        }
        Update: {
          change_summary?: string | null
          change_type?: string
          changed_at?: string | null
          changed_by?: string | null
          changed_fields?: Json | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          document_id?: string
          extracted_metadata?: Json | null
          extracted_text?: string | null
          field_confidence?: Json | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          line_items?: Json | null
          validation_status?: string | null
          version_number?: number
          word_bounding_boxes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ab1466_detected_terms: Json | null
          ab1466_redaction_applied: boolean | null
          ab1466_violation_count: number | null
          ab1466_violations_detected: boolean | null
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          confidence_score: number | null
          created_at: string | null
          detected_pii_regions: Json | null
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
          pii_detected: boolean | null
          processing_priority: number | null
          project_id: string
          redacted_file_url: string | null
          redaction_metadata: Json | null
          search_vector: unknown
          signature_authentication_status: string | null
          signature_similarity_score: number | null
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
          ab1466_detected_terms?: Json | null
          ab1466_redaction_applied?: boolean | null
          ab1466_violation_count?: number | null
          ab1466_violations_detected?: boolean | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          detected_pii_regions?: Json | null
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
          pii_detected?: boolean | null
          processing_priority?: number | null
          project_id: string
          redacted_file_url?: string | null
          redaction_metadata?: Json | null
          search_vector?: unknown
          signature_authentication_status?: string | null
          signature_similarity_score?: number | null
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
          ab1466_detected_terms?: Json | null
          ab1466_redaction_applied?: boolean | null
          ab1466_violation_count?: number | null
          ab1466_violations_detected?: boolean | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          detected_pii_regions?: Json | null
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
          pii_detected?: boolean | null
          processing_priority?: number | null
          project_id?: string
          redacted_file_url?: string | null
          redaction_metadata?: Json | null
          search_vector?: unknown
          signature_authentication_status?: string | null
          signature_similarity_score?: number | null
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
      duplicate_detections: {
        Row: {
          batch_id: string
          created_at: string | null
          document_id: string
          duplicate_document_id: string | null
          duplicate_fields: Json | null
          duplicate_type: string
          id: string
          metadata: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          similarity_score: number
          status: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          document_id: string
          duplicate_document_id?: string | null
          duplicate_fields?: Json | null
          duplicate_type: string
          id?: string
          metadata?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          similarity_score: number
          status?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          document_id?: string
          duplicate_document_id?: string | null
          duplicate_fields?: Json | null
          duplicate_type?: string
          id?: string
          metadata?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          similarity_score?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_detections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_detections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_detections_duplicate_document_id_fkey"
            columns: ["duplicate_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
          email_password_encrypted: string | null
          email_port: number
          email_username: string
          encryption_version: number | null
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
          email_password_encrypted?: string | null
          email_port?: number
          email_username: string
          encryption_version?: number | null
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
          email_password_encrypted?: string | null
          email_port?: number
          email_username?: string
          encryption_version?: number | null
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
      extraction_confidence: {
        Row: {
          confidence_score: number
          created_at: string | null
          document_id: string
          extracted_value: string | null
          field_name: string
          id: string
          needs_review: boolean | null
        }
        Insert: {
          confidence_score: number
          created_at?: string | null
          document_id: string
          extracted_value?: string | null
          field_name: string
          id?: string
          needs_review?: boolean | null
        }
        Update: {
          confidence_score?: number
          created_at?: string | null
          document_id?: string
          extracted_value?: string | null
          field_name?: string
          id?: string
          needs_review?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_confidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fax_import_configs: {
        Row: {
          auto_create_batch: boolean | null
          batch_name_template: string | null
          created_at: string | null
          created_by: string
          customer_id: string | null
          id: string
          is_active: boolean | null
          project_id: string
          twilio_phone_number: string
          updated_at: string | null
        }
        Insert: {
          auto_create_batch?: boolean | null
          batch_name_template?: string | null
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          project_id: string
          twilio_phone_number: string
          updated_at?: string | null
        }
        Update: {
          auto_create_batch?: boolean | null
          batch_name_template?: string | null
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          project_id?: string
          twilio_phone_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fax_import_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fax_import_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fax_logs: {
        Row: {
          batch_id: string | null
          config_id: string | null
          document_id: string | null
          error_message: string | null
          from_number: string
          id: string
          media_url: string | null
          metadata: Json | null
          num_pages: number | null
          received_at: string | null
          status: string
          to_number: string
          twilio_sid: string
        }
        Insert: {
          batch_id?: string | null
          config_id?: string | null
          document_id?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          media_url?: string | null
          metadata?: Json | null
          num_pages?: number | null
          received_at?: string | null
          status: string
          to_number: string
          twilio_sid: string
        }
        Update: {
          batch_id?: string | null
          config_id?: string | null
          document_id?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          media_url?: string | null
          metadata?: Json | null
          num_pages?: number | null
          received_at?: string | null
          status?: string
          to_number?: string
          twilio_sid?: string
        }
        Relationships: [
          {
            foreignKeyName: "fax_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fax_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "fax_import_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fax_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
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
      field_learning_data: {
        Row: {
          confidence_score: number | null
          corrected_value: string
          correction_count: number | null
          created_at: string | null
          document_type: string | null
          field_name: string
          id: string
          original_value: string | null
          project_id: string
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          corrected_value: string
          correction_count?: number | null
          created_at?: string | null
          document_type?: string | null
          field_name: string
          id?: string
          original_value?: string | null
          project_id: string
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          corrected_value?: string
          correction_count?: number | null
          created_at?: string | null
          document_type?: string | null
          field_name?: string
          id?: string
          original_value?: string | null
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_learning_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_detections: {
        Row: {
          batch_id: string | null
          created_at: string
          description: string
          details: string | null
          document_id: string | null
          fraud_type: string
          id: string
          metadata: Json | null
          reviewed_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          description: string
          details?: string | null
          document_id?: string | null
          fraud_type: string
          id?: string
          metadata?: Json | null
          reviewed_by?: string | null
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          description?: string
          details?: string | null
          document_id?: string | null
          fraud_type?: string
          id?: string
          metadata?: Json | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_detections_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_detections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_integrations: {
        Row: {
          configuration: Json | null
          customer_id: string
          id: string
          installed_at: string | null
          installed_by: string | null
          integration_id: string
          integration_name: string
          is_active: boolean | null
        }
        Insert: {
          configuration?: Json | null
          customer_id: string
          id?: string
          installed_at?: string | null
          installed_by?: string | null
          integration_id: string
          integration_name: string
          is_active?: boolean | null
        }
        Update: {
          configuration?: Json | null
          customer_id?: string
          id?: string
          installed_at?: string | null
          installed_by?: string | null
          integration_id?: string
          integration_name?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "installed_integrations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      ml_document_templates: {
        Row: {
          accuracy_rate: number | null
          created_at: string | null
          document_type: string
          field_patterns: Json
          id: string
          is_active: boolean | null
          project_id: string
          template_name: string
          training_data_count: number | null
          updated_at: string | null
        }
        Insert: {
          accuracy_rate?: number | null
          created_at?: string | null
          document_type: string
          field_patterns: Json
          id?: string
          is_active?: boolean | null
          project_id: string
          template_name: string
          training_data_count?: number | null
          updated_at?: string | null
        }
        Update: {
          accuracy_rate?: number | null
          created_at?: string | null
          document_type?: string
          field_patterns?: Json
          id?: string
          is_active?: boolean | null
          project_id?: string
          template_name?: string
          training_data_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_document_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      project_integrations: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          installed_integration_id: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          installed_integration_id: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          installed_integration_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_integrations_installed_integration_id_fkey"
            columns: ["installed_integration_id"]
            isOneToOne: false
            referencedRelation: "installed_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string
          customer_id: string | null
          description: string | null
          detect_pii: boolean | null
          display_fields_above: boolean
          enable_ab1466_redaction: boolean | null
          enable_check_scanning: boolean | null
          enable_signature_verification: boolean | null
          export_types: string[] | null
          extraction_fields: Json
          icon_url: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          ocr_model: string | null
          queues: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          customer_id?: string | null
          description?: string | null
          detect_pii?: boolean | null
          display_fields_above?: boolean
          enable_ab1466_redaction?: boolean | null
          enable_check_scanning?: boolean | null
          enable_signature_verification?: boolean | null
          export_types?: string[] | null
          extraction_fields?: Json
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          ocr_model?: string | null
          queues?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          customer_id?: string | null
          description?: string | null
          detect_pii?: boolean | null
          display_fields_above?: boolean
          enable_ab1466_redaction?: boolean | null
          enable_check_scanning?: boolean | null
          enable_signature_verification?: boolean | null
          export_types?: string[] | null
          extraction_fields?: Json
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          ocr_model?: string | null
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
      redaction_audit_log: {
        Row: {
          document_id: string
          id: string
          ip_address: string | null
          reason: string | null
          user_agent: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          document_id: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          document_id?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "redaction_audit_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      release_notes: {
        Row: {
          created_at: string
          created_by: string
          description: string
          features: Json
          highlights: Json
          id: string
          is_latest: boolean
          release_date: string
          status: string
          technical_info: Json | null
          updated_at: string
          version: string
          version_name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          features?: Json
          highlights?: Json
          id?: string
          is_latest?: boolean
          release_date?: string
          status?: string
          technical_info?: Json | null
          updated_at?: string
          version: string
          version_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          features?: Json
          highlights?: Json
          id?: string
          is_latest?: boolean
          release_date?: string
          status?: string
          technical_info?: Json | null
          updated_at?: string
          version?: string
          version_name?: string
        }
        Relationships: []
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
      retention_policies: {
        Row: {
          applies_to_document_types: string[] | null
          applies_to_projects: string[] | null
          archive_before_purge: boolean | null
          archive_location: string | null
          auto_purge: boolean | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          retention_days: number
          updated_at: string | null
        }
        Insert: {
          applies_to_document_types?: string[] | null
          applies_to_projects?: string[] | null
          archive_before_purge?: boolean | null
          archive_location?: string | null
          auto_purge?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          retention_days?: number
          updated_at?: string | null
        }
        Update: {
          applies_to_document_types?: string[] | null
          applies_to_projects?: string[] | null
          archive_before_purge?: boolean | null
          archive_location?: string | null
          auto_purge?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          retention_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_policies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_config: {
        Row: {
          auto_validate_enabled: boolean | null
          created_at: string | null
          customer_id: string | null
          enabled: boolean | null
          high_confidence_threshold: number | null
          id: string
          medium_confidence_threshold: number | null
          updated_at: string | null
        }
        Insert: {
          auto_validate_enabled?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          enabled?: boolean | null
          high_confidence_threshold?: number | null
          id?: string
          medium_confidence_threshold?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_validate_enabled?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          enabled?: boolean | null
          high_confidence_threshold?: number | null
          id?: string
          medium_confidence_threshold?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routing_config_customer_id_fkey"
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
      scim_configs: {
        Row: {
          auto_deactivate_users: boolean | null
          auto_provision_users: boolean | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          default_role: Database["public"]["Enums"]["app_role"] | null
          group_mappings: Json | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          scim_token_hash: string
          scim_token_prefix: string
          updated_at: string | null
        }
        Insert: {
          auto_deactivate_users?: boolean | null
          auto_provision_users?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          default_role?: Database["public"]["Enums"]["app_role"] | null
          group_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          scim_token_hash: string
          scim_token_prefix: string
          updated_at?: string | null
        }
        Update: {
          auto_deactivate_users?: boolean | null
          auto_provision_users?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          default_role?: Database["public"]["Enums"]["app_role"] | null
          group_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          scim_token_hash?: string
          scim_token_prefix?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scim_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      scim_sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          operation: string
          resource_id: string | null
          resource_type: string
          scim_config_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          operation: string
          resource_id?: string | null
          resource_type: string
          scim_config_id?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          operation?: string
          resource_id?: string | null
          resource_type?: string
          scim_config_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scim_sync_logs_scim_config_id_fkey"
            columns: ["scim_config_id"]
            isOneToOne: false
            referencedRelation: "scim_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      script_agents: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          is_active: boolean | null
          last_heartbeat_at: string | null
          last_ip_address: string | null
          machine_name: string | null
          name: string
          supported_languages: string[] | null
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          last_ip_address?: string | null
          machine_name?: string | null
          name: string
          supported_languages?: string[] | null
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          last_heartbeat_at?: string | null
          last_ip_address?: string | null
          machine_name?: string | null
          name?: string
          supported_languages?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_agents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      script_execution_logs: {
        Row: {
          error_message: string | null
          executed_at: string | null
          executed_by: string | null
          execution_context: Json | null
          execution_duration_ms: number | null
          id: string
          output: string | null
          script_id: string
          status: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_context?: Json | null
          execution_duration_ms?: number | null
          id?: string
          output?: string | null
          script_id: string
          status: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_context?: Json | null
          execution_duration_ms?: number | null
          id?: string
          output?: string | null
          script_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_execution_logs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "custom_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_jobs: {
        Row: {
          agent_id: string | null
          assigned_at: string | null
          batch_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          document_id: string | null
          error_message: string | null
          exit_code: number | null
          id: string
          max_retries: number | null
          priority: number | null
          project_id: string | null
          result_data: Json | null
          retry_count: number | null
          script_content: string
          script_language: string
          script_name: string
          script_parameters: Json | null
          started_at: string | null
          status: string
          stderr: string | null
          stdout: string | null
          timeout_seconds: number | null
          trigger_event: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          assigned_at?: string | null
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          document_id?: string | null
          error_message?: string | null
          exit_code?: number | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          project_id?: string | null
          result_data?: Json | null
          retry_count?: number | null
          script_content: string
          script_language: string
          script_name: string
          script_parameters?: Json | null
          started_at?: string | null
          status?: string
          stderr?: string | null
          stdout?: string | null
          timeout_seconds?: number | null
          trigger_event?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          assigned_at?: string | null
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          document_id?: string | null
          error_message?: string | null
          exit_code?: number | null
          id?: string
          max_retries?: number | null
          priority?: number | null
          project_id?: string | null
          result_data?: Json | null
          retry_count?: number | null
          script_content?: string
          script_language?: string
          script_name?: string
          script_parameters?: Json | null
          started_at?: string | null
          status?: string
          stderr?: string | null
          stdout?: string | null
          timeout_seconds?: number | null
          trigger_event?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "script_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_jobs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      script_templates: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          default_parameters: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          project_id: string | null
          schedule_cron: string | null
          schedule_enabled: boolean | null
          script_content: string
          script_language: string
          trigger_on_batch_complete: boolean | null
          trigger_on_batch_export: boolean | null
          trigger_on_document_upload: boolean | null
          trigger_on_validation_complete: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          default_parameters?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          project_id?: string | null
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          script_content: string
          script_language: string
          trigger_on_batch_complete?: boolean | null
          trigger_on_batch_export?: boolean | null
          trigger_on_document_upload?: boolean | null
          trigger_on_validation_complete?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          default_parameters?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          project_id?: string | null
          schedule_cron?: string | null
          schedule_enabled?: boolean | null
          script_content?: string
          script_language?: string
          trigger_on_batch_complete?: boolean | null
          trigger_on_batch_export?: boolean | null
          trigger_on_document_upload?: boolean | null
          trigger_on_validation_complete?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_templates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_comparisons: {
        Row: {
          comparison_details: Json | null
          created_at: string | null
          document_id: string
          id: string
          recommendation: string
          reference_signature_id: string | null
          similarity_score: number
        }
        Insert: {
          comparison_details?: Json | null
          created_at?: string | null
          document_id: string
          id?: string
          recommendation: string
          reference_signature_id?: string | null
          similarity_score: number
        }
        Update: {
          comparison_details?: Json | null
          created_at?: string | null
          document_id?: string
          id?: string
          recommendation?: string
          reference_signature_id?: string | null
          similarity_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "signature_comparisons_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_comparisons_reference_signature_id_fkey"
            columns: ["reference_signature_id"]
            isOneToOne: false
            referencedRelation: "signature_references"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_references: {
        Row: {
          created_at: string | null
          created_by: string
          entity_id: string
          entity_name: string | null
          entity_type: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          project_id: string
          signature_image_url: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          entity_id: string
          entity_name?: string | null
          entity_type: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          project_id: string
          signature_image_url: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          entity_id?: string
          entity_name?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          project_id?: string
          signature_image_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_breaches: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_value: number | null
          breach_details: Json | null
          breach_type: string
          created_at: string | null
          customer_id: string
          entity_id: string | null
          entity_type: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          sla_config_id: string | null
          target_value: number | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number | null
          breach_details?: Json | null
          breach_type: string
          created_at?: string | null
          customer_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_config_id?: string | null
          target_value?: number | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number | null
          breach_details?: Json | null
          breach_type?: string
          created_at?: string | null
          customer_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          sla_config_id?: string | null
          target_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_breaches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_sla_config_id_fkey"
            columns: ["sla_config_id"]
            isOneToOne: false
            referencedRelation: "sla_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_configs: {
        Row: {
          alert_on_breach: boolean | null
          alert_recipients: string[] | null
          created_at: string | null
          customer_id: string
          description: string | null
          escalation_after_minutes: number | null
          escalation_recipients: string[] | null
          export_time_target_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
          processing_time_target_minutes: number | null
          updated_at: string | null
          uptime_target_percentage: number | null
          validation_time_target_minutes: number | null
        }
        Insert: {
          alert_on_breach?: boolean | null
          alert_recipients?: string[] | null
          created_at?: string | null
          customer_id: string
          description?: string | null
          escalation_after_minutes?: number | null
          escalation_recipients?: string[] | null
          export_time_target_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          processing_time_target_minutes?: number | null
          updated_at?: string | null
          uptime_target_percentage?: number | null
          validation_time_target_minutes?: number | null
        }
        Update: {
          alert_on_breach?: boolean | null
          alert_recipients?: string[] | null
          created_at?: string | null
          customer_id?: string
          description?: string | null
          escalation_after_minutes?: number | null
          escalation_recipients?: string[] | null
          export_time_target_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          processing_time_target_minutes?: number | null
          updated_at?: string | null
          uptime_target_percentage?: number | null
          validation_time_target_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_configs: {
        Row: {
          attribute_mapping: Json | null
          certificate: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          enforce_sso: boolean | null
          entity_id: string | null
          id: string
          is_active: boolean | null
          metadata_url: string | null
          provider_name: string
          provider_type: string
          sso_url: string | null
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          certificate?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          enforce_sso?: boolean | null
          entity_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata_url?: string | null
          provider_name: string
          provider_type: string
          sso_url?: string | null
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          certificate?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          enforce_sso?: boolean | null
          entity_id?: string | null
          id?: string
          is_active?: boolean | null
          metadata_url?: string | null
          provider_name?: string
          provider_type?: string
          sso_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      user_dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          position: number
          updated_at: string | null
          user_id: string
          widget_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number
          updated_at?: string | null
          user_id: string
          widget_type: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          position?: number
          updated_at?: string | null
          user_id?: string
          widget_type?: string
        }
        Relationships: []
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
          onboarding_completed_steps: string[] | null
          onboarding_dismissed: boolean | null
          saved_filters: Json | null
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
          onboarding_completed_steps?: string[] | null
          onboarding_dismissed?: boolean | null
          saved_filters?: Json | null
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
          onboarding_completed_steps?: string[] | null
          onboarding_dismissed?: boolean | null
          saved_filters?: Json | null
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
      validation_rules: {
        Row: {
          created_at: string
          created_by: string
          document_class_id: string | null
          error_message: string
          field_name: string
          id: string
          is_active: boolean
          project_id: string
          rule_config: Json
          rule_type: string
          severity: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_class_id?: string | null
          error_message: string
          field_name: string
          id?: string
          is_active?: boolean
          project_id: string
          rule_config?: Json
          rule_type: string
          severity?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_class_id?: string | null
          error_message?: string
          field_name?: string
          id?: string
          is_active?: boolean
          project_id?: string
          rule_config?: Json
          rule_type?: string
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_rules_document_class_id_fkey"
            columns: ["document_class_id"]
            isOneToOne: false
            referencedRelation: "document_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      voter_registry: {
        Row: {
          address: string | null
          city: string | null
          county: string | null
          created_at: string
          customer_id: string
          id: string
          name: string
          name_normalized: string
          party_affiliation: string | null
          precinct: string | null
          project_id: string | null
          raw_data: Json | null
          registration_date: string | null
          signature_reference_uploaded_at: string | null
          signature_reference_url: string | null
          source_file: string | null
          state: string | null
          updated_at: string
          voter_id: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          customer_id: string
          id?: string
          name: string
          name_normalized: string
          party_affiliation?: string | null
          precinct?: string | null
          project_id?: string | null
          raw_data?: Json | null
          registration_date?: string | null
          signature_reference_uploaded_at?: string | null
          signature_reference_url?: string | null
          source_file?: string | null
          state?: string | null
          updated_at?: string
          voter_id?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          name_normalized?: string
          party_affiliation?: string | null
          precinct?: string | null
          project_id?: string | null
          raw_data?: Json | null
          registration_date?: string | null
          signature_reference_uploaded_at?: string | null
          signature_reference_url?: string | null
          source_file?: string | null
          state?: string | null
          updated_at?: string
          voter_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voter_registry_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voter_registry_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          encryption_version: number | null
          events: Json
          headers: Json | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          retry_config: Json | null
          secret: string | null
          secret_encrypted: string | null
          updated_at: string
          url: string
          webhook_type: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          encryption_version?: number | null
          events?: Json
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          retry_config?: Json | null
          secret?: string | null
          secret_encrypted?: string | null
          updated_at?: string
          url: string
          webhook_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          encryption_version?: number | null
          events?: Json
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          retry_config?: Json | null
          secret?: string | null
          secret_encrypted?: string | null
          updated_at?: string
          url?: string
          webhook_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          attempt_number: number
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_config_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          webhook_config_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_config_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          change_summary: string | null
          change_type: string
          changed_at: string | null
          changed_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_events: string[] | null
          version_number: number
          workflow_edges: Json | null
          workflow_id: string
          workflow_nodes: Json | null
        }
        Insert: {
          change_summary?: string | null
          change_type: string
          changed_at?: string | null
          changed_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_events?: string[] | null
          version_number: number
          workflow_edges?: Json | null
          workflow_id: string
          workflow_nodes?: Json | null
        }
        Update: {
          change_summary?: string | null
          change_type?: string
          changed_at?: string | null
          changed_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_events?: string[] | null
          version_number?: number
          workflow_edges?: Json | null
          workflow_id?: string
          workflow_nodes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          trigger_events: string[]
          updated_at: string
          workflow_edges: Json | null
          workflow_nodes: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          trigger_events?: string[]
          updated_at?: string
          workflow_edges?: Json | null
          workflow_nodes?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          trigger_events?: string[]
          updated_at?: string
          workflow_edges?: Json | null
          workflow_nodes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workflows_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_definitions: {
        Row: {
          anchor_offset_x: number | null
          anchor_offset_y: number | null
          anchor_search_radius: number | null
          anchor_text: string | null
          created_at: string | null
          field_name: string
          field_type: string
          height: number
          id: string
          page_number: number | null
          preprocessing: Json | null
          sort_order: number | null
          template_id: string
          validation_flags: string | null
          validation_pattern: string | null
          validation_rules: Json | null
          width: number
          x: number
          y: number
        }
        Insert: {
          anchor_offset_x?: number | null
          anchor_offset_y?: number | null
          anchor_search_radius?: number | null
          anchor_text?: string | null
          created_at?: string | null
          field_name: string
          field_type?: string
          height: number
          id?: string
          page_number?: number | null
          preprocessing?: Json | null
          sort_order?: number | null
          template_id: string
          validation_flags?: string | null
          validation_pattern?: string | null
          validation_rules?: Json | null
          width: number
          x: number
          y: number
        }
        Update: {
          anchor_offset_x?: number | null
          anchor_offset_y?: number | null
          anchor_search_radius?: number | null
          anchor_text?: string | null
          created_at?: string | null
          field_name?: string
          field_type?: string
          height?: number
          id?: string
          page_number?: number | null
          preprocessing?: Json | null
          sort_order?: number | null
          template_id?: string
          validation_flags?: string | null
          validation_pattern?: string | null
          validation_rules?: Json | null
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "zone_definitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "zone_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_templates: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          project_id: string
          sample_image_url: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          project_id: string
          sample_image_url: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          project_id?: string
          sample_image_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_templates_project_id_fkey"
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
      check_api_key_rate_limit: { Args: { _api_key_id: string }; Returns: Json }
      check_license_capacity: {
        Args: { _documents_needed?: number; _license_id: string }
        Returns: boolean
      }
      check_tenant_rate_limit: {
        Args: { _customer_id: string; _job_type?: string }
        Returns: boolean
      }
      cleanup_completed_jobs: {
        Args: { retention_days?: number }
        Returns: Json
      }
      cleanup_expired_locks: { Args: never; Returns: undefined }
      cleanup_old_audit_trail: {
        Args: { retention_days?: number }
        Returns: Json
      }
      cleanup_old_error_logs: {
        Args: { retention_days?: number }
        Returns: Json
      }
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
          detect_pii: boolean
          enable_check_scanning: boolean
          enable_signature_verification: boolean
          export_types: string[]
          extraction_fields: Json
          icon_url: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          ocr_model: string
          queues: Json
          updated_at: string
        }[]
      }
      get_system_health: { Args: never; Returns: Json }
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
      migrate_to_encrypted_credentials: { Args: never; Returns: undefined }
      retry_stuck_jobs: { Args: never; Returns: Json }
      run_system_maintenance: { Args: never; Returns: Json }
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
      trigger_webhook: {
        Args: { _customer_id: string; _event_type: string; _payload: Json }
        Returns: undefined
      }
      update_ml_template_accuracy: {
        Args: {
          _correct_predictions: number
          _template_id: string
          _total_predictions: number
        }
        Returns: undefined
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
      validate_api_key: { Args: { _key_hash: string }; Returns: Json }
    }
    Enums: {
      api_key_scope: "read" | "write" | "admin"
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
        | "petition"
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
      api_key_scope: ["read", "write", "admin"],
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
        "petition",
      ],
      job_priority: ["low", "normal", "high", "urgent"],
      job_status: ["pending", "processing", "completed", "failed", "retrying"],
      license_status: ["active", "expired", "suspended", "exhausted"],
      license_tier: ["starter", "professional", "business", "enterprise"],
      validation_status: ["pending", "validated", "rejected", "needs_review"],
    },
  },
} as const
