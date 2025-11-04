export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          query?: string
          variables?: Json
          operationName?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      avoidance_area_reports: {
        Row: {
          avoidance_area_id: string | null
          created_at: string
          description: string | null
          id: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avoidance_area_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avoidance_area_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avoidance_area_reports_avoidance_area_id_fkey"
            columns: ["avoidance_area_id"]
            isOneToOne: false
            referencedRelation: "avoidance_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoidance_area_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avoidance_areas: {
        Row: {
          boundary: unknown
          boundary_geojson: Json | null
          created_at: string
          description: string | null
          id: string
          name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          boundary: unknown
          boundary_geojson?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          boundary?: unknown
          boundary_geojson?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avoidance_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pois: {
        Row: {
          created_at: string
          id: string
          location: unknown
          location_geojson: Json | null
          metadata: Json
          poi_type: Database["public"]["Enums"]["poi_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location: unknown
          location_geojson?: Json | null
          metadata: Json
          poi_type: Database["public"]["Enums"]["poi_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: unknown
          location_geojson?: Json | null
          metadata?: Json
          poi_type?: Database["public"]["Enums"]["poi_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_common_locations: {
        Row: {
          created_at: string
          id: number
          label: string
          location: unknown
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          label: string
          location: unknown
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          label?: string
          location?: unknown
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_navigation_preferences: {
        Row: {
          avoid_areas: boolean | null
          created_at: string
          gradient_tolerance: number | null
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avoid_areas?: boolean | null
          created_at?: string
          gradient_tolerance?: number | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avoid_areas?: boolean | null
          created_at?: string
          gradient_tolerance?: number | null
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      insert_avoidance_area: {
        Args: { p_name: string; p_wkt: string }
        Returns: string
      }
      json_matches_schema: {
        Args: { schema: Json; instance: Json }
        Returns: boolean
      }
      jsonb_matches_schema: {
        Args: { instance: Json; schema: Json }
        Returns: boolean
      }
      jsonschema_is_valid: {
        Args: { schema: Json }
        Returns: boolean
      }
      jsonschema_validation_errors: {
        Args: { schema: Json; instance: Json }
        Returns: string[]
      }
    }
    Enums: {
      poi_type: "accessible_entrance"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Database

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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      poi_type: ["accessible_entrance"],
    },
  },
} as const

