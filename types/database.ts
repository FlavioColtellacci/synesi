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
