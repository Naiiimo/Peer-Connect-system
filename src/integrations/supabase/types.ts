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
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          end_time: string
          id: string
          start_time: string
          tutor_id: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          start_time: string
          tutor_id: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          start_time?: string
          tutor_id?: string
          weekday?: number
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["connection_status"]
          student_id: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          student_id: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["connection_status"]
          student_id?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          code: string
          created_at: string
          programme_codes: string[]
          school: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          programme_codes?: string[]
          school: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          programme_codes?: string[]
          school?: string
          title?: string
        }
        Relationships: []
      }
      group_documents: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          path: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          path: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          path?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_documents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          programme: string | null
          school: string | null
          topic: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          programme?: string | null
          school?: string | null
          topic?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          programme?: string | null
          school?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      library_documents: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          path: string
          source: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          path: string
          source?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          path?: string
          source?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string
          edited_at: string | null
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          currency: string
          id: boolean
          service_fee_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: boolean
          service_fee_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: boolean
          service_fee_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avg_rating: number | null
          bio: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          hourly_rate: number | null
          id: string
          languages: string[]
          learning_style: Database["public"]["Enums"]["learning_style"] | null
          photo_url: string | null
          programme: string | null
          role: Database["public"]["Enums"]["app_role"]
          school: string | null
          specializations: string[] | null
          status: Database["public"]["Enums"]["user_status"]
          suspended_until: string | null
          tutor_programmes: string[] | null
          tutor_schools: string[] | null
          updated_at: string
          usiu_id: string | null
          year_of_study: number | null
        }
        Insert: {
          avg_rating?: number | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          hourly_rate?: number | null
          id: string
          languages?: string[]
          learning_style?: Database["public"]["Enums"]["learning_style"] | null
          photo_url?: string | null
          programme?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school?: string | null
          specializations?: string[] | null
          status?: Database["public"]["Enums"]["user_status"]
          suspended_until?: string | null
          tutor_programmes?: string[] | null
          tutor_schools?: string[] | null
          updated_at?: string
          usiu_id?: string | null
          year_of_study?: number | null
        }
        Update: {
          avg_rating?: number | null
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          hourly_rate?: number | null
          id?: string
          languages?: string[]
          learning_style?: Database["public"]["Enums"]["learning_style"] | null
          photo_url?: string | null
          programme?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school?: string | null
          specializations?: string[] | null
          status?: Database["public"]["Enums"]["user_status"]
          suspended_until?: string | null
          tutor_programmes?: string[] | null
          tutor_schools?: string[] | null
          updated_at?: string
          usiu_id?: string | null
          year_of_study?: number | null
        }
        Relationships: []
      }
      programmes: {
        Row: {
          code: string | null
          id: string
          name: string
          school: string
        }
        Insert: {
          code?: string | null
          id?: string
          name: string
          school: string
        }
        Update: {
          code?: string | null
          id?: string
          name?: string
          school?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          student_id: string
          tutor_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          student_id: string
          tutor_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          student_id?: string
          tutor_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          amount: number | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          availability_slot_id: string | null
          cancelled_at: string | null
          created_at: string
          currency: string
          end_at: string
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          reminders_sent: string[]
          review_note: string | null
          start_at: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          topic: string | null
          tutor_id: string
          zoom_url: string | null
        }
        Insert: {
          amount?: number | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          availability_slot_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          end_at: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          reminders_sent?: string[]
          review_note?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["session_status"]
          student_id: string
          topic?: string | null
          tutor_id: string
          zoom_url?: string | null
        }
        Update: {
          amount?: number | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          availability_slot_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          end_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          reminders_sent?: string[]
          review_note?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          student_id?: string
          topic?: string | null
          tutor_id?: string
          zoom_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_availability_slot_id_fkey"
            columns: ["availability_slot_id"]
            isOneToOne: false
            referencedRelation: "availability"
            referencedColumns: ["id"]
          },
        ]
      }
      student_courses: {
        Row: {
          course_code: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_code: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_code?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_courses_course_code_fkey"
            columns: ["course_code"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["code"]
          },
        ]
      }
      tutor_courses: {
        Row: {
          course_code: string
          created_at: string
          id: string
          tutor_id: string
        }
        Insert: {
          course_code: string
          created_at?: string
          id?: string
          tutor_id: string
        }
        Update: {
          course_code?: string
          created_at?: string
          id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_courses_course_code_fkey"
            columns: ["course_code"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["code"]
          },
        ]
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
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      get_booked_availability_slots: {
        Args: { _tutor_ids: string[] }
        Returns: {
          availability_slot_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      notify: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _title: string
          _user: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "tutor" | "admin" | "super_admin"
      connection_status: "pending" | "accepted" | "rejected"
      gender: "male" | "female" | "other"
      learning_style: "visual" | "auditory" | "reading" | "kinesthetic"
      report_status: "open" | "resolved" | "dismissed"
      session_status: "scheduled" | "completed" | "cancelled"
      user_status: "active" | "suspended" | "banned"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["student", "tutor", "admin", "super_admin"],
      connection_status: ["pending", "accepted", "rejected"],
      gender: ["male", "female", "other"],
      learning_style: ["visual", "auditory", "reading", "kinesthetic"],
      report_status: ["open", "resolved", "dismissed"],
      session_status: ["scheduled", "completed", "cancelled"],
      user_status: ["active", "suspended", "banned"],
    },
  },
} as const
