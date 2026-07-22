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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_personas: {
        Row: {
          agent_name: string | null
          audit_loop: string
          boundaries: string
          constitution: string
          constitutional_boundaries_en: string | null
          constitutional_boundaries_es: string | null
          created_at: string
          description: string
          description_es: string | null
          engagement: string
          governance_audit_loop_en: string | null
          governance_audit_loop_es: string | null
          id: string
          key_identifier: string | null
          name: string
          personality: string
          personality_anchors_en: string | null
          personality_anchors_es: string | null
          role: string
          rules_of_engagement_en: string | null
          rules_of_engagement_es: string | null
          slug: string
          sort_order: number
          structural_role_en: string | null
          structural_role_es: string | null
          updated_at: string
        }
        Insert: {
          agent_name?: string | null
          audit_loop?: string
          boundaries?: string
          constitution?: string
          constitutional_boundaries_en?: string | null
          constitutional_boundaries_es?: string | null
          created_at?: string
          description?: string
          description_es?: string | null
          engagement?: string
          governance_audit_loop_en?: string | null
          governance_audit_loop_es?: string | null
          id?: string
          key_identifier?: string | null
          name: string
          personality?: string
          personality_anchors_en?: string | null
          personality_anchors_es?: string | null
          role?: string
          rules_of_engagement_en?: string | null
          rules_of_engagement_es?: string | null
          slug: string
          sort_order?: number
          structural_role_en?: string | null
          structural_role_es?: string | null
          updated_at?: string
        }
        Update: {
          agent_name?: string | null
          audit_loop?: string
          boundaries?: string
          constitution?: string
          constitutional_boundaries_en?: string | null
          constitutional_boundaries_es?: string | null
          created_at?: string
          description?: string
          description_es?: string | null
          engagement?: string
          governance_audit_loop_en?: string | null
          governance_audit_loop_es?: string | null
          id?: string
          key_identifier?: string | null
          name?: string
          personality?: string
          personality_anchors_en?: string | null
          personality_anchors_es?: string | null
          role?: string
          rules_of_engagement_en?: string | null
          rules_of_engagement_es?: string | null
          slug?: string
          sort_order?: number
          structural_role_en?: string | null
          structural_role_es?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      agent_personas_public: {
        Row: {
          agent_name: string | null
          description: string | null
          description_es: string | null
          name: string | null
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          agent_name?: string | null
          description?: string | null
          description_es?: string | null
          name?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          agent_name?: string | null
          description?: string | null
          description_es?: string | null
          name?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
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
    Enums: {},
  },
} as const
