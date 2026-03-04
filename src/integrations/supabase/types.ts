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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          accuracy: number | null
          confusion_matrix_path: string | null
          created_at: string
          f1_score: number | null
          fn: number | null
          fp: number | null
          id: string
          precision: number | null
          prediction_id: string
          recall: number | null
          recall_sensitivity: number | null
          roc_auc: number | null
          roc_curve_path: string | null
          specificity: number | null
          support: number | null
          tn: number | null
          tp: number | null
        }
        Insert: {
          accuracy?: number | null
          confusion_matrix_path?: string | null
          created_at?: string
          f1_score?: number | null
          fn?: number | null
          fp?: number | null
          id?: string
          precision?: number | null
          prediction_id: string
          recall?: number | null
          recall_sensitivity?: number | null
          roc_auc?: number | null
          roc_curve_path?: string | null
          specificity?: number | null
          support?: number | null
          tn?: number | null
          tp?: number | null
        }
        Update: {
          accuracy?: number | null
          confusion_matrix_path?: string | null
          created_at?: string
          f1_score?: number | null
          fn?: number | null
          fp?: number | null
          id?: string
          precision?: number | null
          prediction_id?: string
          recall?: number | null
          recall_sensitivity?: number | null
          roc_auc?: number | null
          roc_curve_path?: string | null
          specificity?: number | null
          support?: number | null
          tn?: number | null
          tp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      mri_uploads: {
        Row: {
          created_at: string
          id: string
          image_path: string
          patient_id: string
          upload_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          patient_id: string
          upload_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          patient_id?: string
          upload_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "mri_uploads_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number
          case_id: string
          created_at: string
          created_by: string | null
          gender: string
          headache_severity: Database["public"]["Enums"]["headache_severity"]
          id: string
          patient_name: string
          seizure: boolean
        }
        Insert: {
          age: number
          case_id: string
          created_at?: string
          created_by?: string | null
          gender: string
          headache_severity?: Database["public"]["Enums"]["headache_severity"]
          id?: string
          patient_name: string
          seizure?: boolean
        }
        Update: {
          age?: number
          case_id?: string
          created_at?: string
          created_by?: string | null
          gender?: string
          headache_severity?: Database["public"]["Enums"]["headache_severity"]
          id?: string
          patient_name?: string
          seizure?: boolean
        }
        Relationships: []
      }
      predictions: {
        Row: {
          baseline_probabilities: Json | null
          created_at: string
          gradcam_path: string | null
          id: string
          patient_id: string
          probabilities: Json | null
          queue_rank: number | null
          severity_level: Database["public"]["Enums"]["severity_level"]
          tumor_present: boolean
          tumor_type: Database["public"]["Enums"]["tumor_type"]
        }
        Insert: {
          baseline_probabilities?: Json | null
          created_at?: string
          gradcam_path?: string | null
          id?: string
          patient_id: string
          probabilities?: Json | null
          queue_rank?: number | null
          severity_level?: Database["public"]["Enums"]["severity_level"]
          tumor_present?: boolean
          tumor_type?: Database["public"]["Enums"]["tumor_type"]
        }
        Update: {
          baseline_probabilities?: Json | null
          created_at?: string
          gradcam_path?: string | null
          id?: string
          patient_id?: string
          probabilities?: Json | null
          queue_rank?: number | null
          severity_level?: Database["public"]["Enums"]["severity_level"]
          tumor_present?: boolean
          tumor_type?: Database["public"]["Enums"]["tumor_type"]
        }
        Relationships: [
          {
            foreignKeyName: "predictions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "doctor" | "radiologist"
      headache_severity: "Mild" | "Medium" | "Severe"
      severity_level: "RED" | "YELLOW" | "GREEN"
      tumor_type: "Glioma" | "Meningioma" | "Pituitary" | "NoTumor"
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
      app_role: ["admin", "doctor", "radiologist"],
      headache_severity: ["Mild", "Medium", "Severe"],
      severity_level: ["RED", "YELLOW", "GREEN"],
      tumor_type: ["Glioma", "Meningioma", "Pituitary", "NoTumor"],
    },
  },
} as const
