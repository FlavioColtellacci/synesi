export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          stripe_customer_id: string | null
          subscription_status: string
          subscription_plan: string | null
          subscription_period_end: string | null
          trial_started_at: string | null
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_plan?: string | null
          subscription_period_end?: string | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_plan?: string | null
          subscription_period_end?: string | null
          trial_started_at?: string | null
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      theses: {
        Row: {
          id: string
          user_id: string
          ticker: string
          company_name: string
          thesis_statement: string
          investing_style: string | null
          bull_case: string | null
          base_case: string | null
          bear_case: string | null
          exit_criteria: string | null
          confidence_level: string
          status: string
          purchase_date: string | null
          purchase_price: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ticker: string
          company_name: string
          thesis_statement: string
          investing_style?: string | null
          bull_case?: string | null
          base_case?: string | null
          bear_case?: string | null
          exit_criteria?: string | null
          confidence_level: string
          status?: string
          purchase_date?: string | null
          purchase_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ticker?: string
          company_name?: string
          thesis_statement?: string
          investing_style?: string | null
          bull_case?: string | null
          base_case?: string | null
          bear_case?: string | null
          exit_criteria?: string | null
          confidence_level?: string
          status?: string
          purchase_date?: string | null
          purchase_price?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assumptions: {
        Row: {
          id: string
          thesis_id: string
          user_id: string
          category: string
          statement: string
          evidence: string | null
          kpi_label: string | null
          kpi_threshold: string | null
          break_condition: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          thesis_id: string
          user_id: string
          category: string
          statement: string
          evidence?: string | null
          kpi_label?: string | null
          kpi_threshold?: string | null
          break_condition?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          thesis_id?: string
          user_id?: string
          category?: string
          statement?: string
          evidence?: string | null
          kpi_label?: string | null
          kpi_threshold?: string | null
          break_condition?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      thesis_updates: {
        Row: {
          id: string
          thesis_id: string
          user_id: string
          update_type: string
          old_status: string | null
          new_status: string | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          thesis_id: string
          user_id: string
          update_type: string
          old_status?: string | null
          new_status?: string | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          thesis_id?: string
          user_id?: string
          update_type?: string
          old_status?: string | null
          new_status?: string | null
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          thesis_id: string
          user_id: string
          event_type: string
          event_detail: string | null
          is_reviewed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          thesis_id: string
          user_id: string
          event_type: string
          event_detail?: string | null
          is_reviewed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          thesis_id?: string
          user_id?: string
          event_type?: string
          event_detail?: string | null
          is_reviewed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      trusted_sources: {
        Row: {
          id: string
          thesis_id: string
          user_id: string
          name: string
          url: string | null
          source_type: string
          created_at: string
        }
        Insert: {
          id?: string
          thesis_id: string
          user_id: string
          name: string
          url?: string | null
          source_type: string
          created_at?: string
        }
        Update: {
          id?: string
          thesis_id?: string
          user_id?: string
          name?: string
          url?: string | null
          source_type?: string
          created_at?: string
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          id: string
          user_id: string
          thesis_id: string
          name: string
          mode: "only_sources" | "include_sources" | "exclude_sources"
          min_confidence: "high" | "medium"
          include_keywords: string[]
          exclude_keywords: string[]
          is_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          thesis_id: string
          name: string
          mode: "only_sources" | "include_sources" | "exclude_sources"
          min_confidence: "high" | "medium"
          include_keywords?: string[]
          exclude_keywords?: string[]
          is_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          thesis_id?: string
          name?: string
          mode?: "only_sources" | "include_sources" | "exclude_sources"
          min_confidence?: "high" | "medium"
          include_keywords?: string[]
          exclude_keywords?: string[]
          is_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      alert_rule_sources: {
        Row: {
          id: string
          alert_rule_id: string
          trusted_source_id: string
          created_at: string
        }
        Insert: {
          id?: string
          alert_rule_id: string
          trusted_source_id: string
          created_at?: string
        }
        Update: {
          id?: string
          alert_rule_id?: string
          trusted_source_id?: string
          created_at?: string
        }
        Relationships: []
      }
      financial_snapshots: {
        Row: {
          id: string
          ticker: string
          provider: string
          as_of: string
          fetched_at: string
          stale_after: string
          payload: Record<string, unknown>
          coverage: Record<string, unknown> | null
        }
        Insert: {
          id?: string
          ticker: string
          provider?: string
          as_of?: string
          fetched_at?: string
          stale_after?: string
          payload: Record<string, unknown>
          coverage?: Record<string, unknown> | null
        }
        Update: {
          id?: string
          ticker?: string
          provider?: string
          as_of?: string
          fetched_at?: string
          stale_after?: string
          payload?: Record<string, unknown>
          coverage?: Record<string, unknown> | null
        }
        Relationships: []
      }
      source_documents: {
        Row: {
          id: string
          source_name: string
          source_type: string
          url: string
          title: string
          published_at: string | null
          content_excerpt: string | null
          content_hash: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          source_name: string
          source_type: string
          url: string
          title: string
          published_at?: string | null
          content_excerpt?: string | null
          content_hash: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          source_name?: string
          source_type?: string
          url?: string
          title?: string
          published_at?: string | null
          content_excerpt?: string | null
          content_hash?: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
      thesis_source_matches: {
        Row: {
          id: string
          user_id: string
          thesis_id: string
          trusted_source_id: string
          source_document_id: string
          relevance_score: number | null
          match_reason: string | null
          confidence: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          thesis_id: string
          trusted_source_id: string
          source_document_id: string
          relevance_score?: number | null
          match_reason?: string | null
          confidence?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          thesis_id?: string
          trusted_source_id?: string
          source_document_id?: string
          relevance_score?: number | null
          match_reason?: string | null
          confidence?: string | null
          created_at?: string
        }
        Relationships: []
      }
      chat_uploaded_documents: {
        Row: {
          id: string
          user_id: string
          bucket: string
          storage_path: string
          file_name: string
          file_extension: string
          mime_type: string
          size_bytes: number
          sha256: string
          status: "ready" | "failed"
          malware_scan_status: "clean" | "blocked" | "skipped"
          extracted_text: string | null
          extracted_chars: number
          extraction_error: string | null
          metadata: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bucket: string
          storage_path: string
          file_name: string
          file_extension: string
          mime_type: string
          size_bytes: number
          sha256: string
          status: "ready" | "failed"
          malware_scan_status: "clean" | "blocked" | "skipped"
          extracted_text?: string | null
          extracted_chars?: number
          extraction_error?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bucket?: string
          storage_path?: string
          file_name?: string
          file_extension?: string
          mime_type?: string
          size_bytes?: number
          sha256?: string
          status?: "ready" | "failed"
          malware_scan_status?: "clean" | "blocked" | "skipped"
          extracted_text?: string | null
          extracted_chars?: number
          extraction_error?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_exports: {
        Row: {
          id: string
          user_id: string
          bucket: string
          storage_path: string
          file_name: string
          format: "csv" | "docx" | "pdf" | "xlsx"
          mime_type: string
          size_bytes: number
          source_request_id: string | null
          signed_url_expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bucket: string
          storage_path: string
          file_name: string
          format: "csv" | "docx" | "pdf" | "xlsx"
          mime_type: string
          size_bytes: number
          source_request_id?: string | null
          signed_url_expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bucket?: string
          storage_path?: string
          file_name?: string
          format?: "csv" | "docx" | "pdf" | "xlsx"
          mime_type?: string
          size_bytes?: number
          source_request_id?: string | null
          signed_url_expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Thesis = Database['public']['Tables']['theses']['Row']
export type Assumption = Database['public']['Tables']['assumptions']['Row']
export type ThesisUpdate = Database['public']['Tables']['thesis_updates']['Row']
export type ThesisEvent = Database['public']['Tables']['events']['Row']
export type TrustedSource = Database['public']['Tables']['trusted_sources']['Row']
export type AlertRule = Database['public']['Tables']['alert_rules']['Row']
export type AlertRuleSource = Database['public']['Tables']['alert_rule_sources']['Row']
export type FinancialSnapshot = Database['public']['Tables']['financial_snapshots']['Row']
export type SourceDocument = Database['public']['Tables']['source_documents']['Row']
export type ThesisSourceMatch = Database['public']['Tables']['thesis_source_matches']['Row']
export type ChatUploadedDocument = Database['public']['Tables']['chat_uploaded_documents']['Row']
export type ChatExport = Database['public']['Tables']['chat_exports']['Row']
