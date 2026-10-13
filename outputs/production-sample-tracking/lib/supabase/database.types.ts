export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "Admin" | "Pattern" | "Cutting" | "Mer" | "Viewer";
export type SamplePriority = "Low" | "Normal" | "High" | "Urgent";
export type SampleStatus =
  | "Pattern"
  | "Cutting"
  | "Embellishment"
  | "Sewing"
  | "Washing"
  | "QC"
  | "Complete"
  | "Cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string;
          role: AppRole;
          profile_image_path: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name: string;
          role?: AppRole;
          profile_image_path?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      samples: {
        Row: {
          id: string;
          sample_code: string;
          model_id: string | null;
          block_id: string | null;
          cutting: string | null;
          fabric_name: string;
          thread_color: string | null;
          fly: string | null;
          washing: string | null;
          priority: SamplePriority;
          status: SampleStatus;
          current_stage: string;
          start_date: string;
          due_date: string | null;
          note: string | null;
          washing_factory: string | null;
          size_mode: "numeric" | "letter";
          sample_size: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          sample_code: string;
          model_id?: string | null;
          block_id?: string | null;
          cutting?: string | null;
          fabric_name: string;
          thread_color?: string | null;
          fly?: string | null;
          washing?: string | null;
          priority?: SamplePriority;
          status?: SampleStatus;
          current_stage?: string;
          start_date?: string;
          due_date?: string | null;
          note?: string | null;
          washing_factory?: string | null;
          size_mode?: "numeric" | "letter";
          sample_size?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["samples"]["Insert"]>;
      };
      sample_files: {
        Row: {
          id: string;
          sample_id: string;
          bucket_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          file_size: number | null;
          stage: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sample_id: string;
          bucket_id?: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          file_size?: number | null;
          stage?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sample_files"]["Insert"]>;
      };
      sample_images: {
        Row: {
          id: string;
          sample_id: string;
          bucket_id: string;
          storage_path: string;
          sort_order: number;
          is_main: boolean;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sample_id: string;
          bucket_id?: string;
          storage_path: string;
          sort_order?: number;
          is_main?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sample_images"]["Insert"]>;
      };
      sample_timeline: {
        Row: {
          id: string;
          sample_id: string;
          stage: string;
          action: string;
          note: string | null;
          from_status: string | null;
          to_status: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sample_id: string;
          stage: string;
          action: string;
          note?: string | null;
          from_status?: string | null;
          to_status?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sample_timeline"]["Insert"]>;
      };
      sample_size_specs: {
        Row: {
          id: string;
          sample_id: string;
          measurement_point: string;
          description: string | null;
          tolerance: string | null;
          values: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sample_id: string;
          measurement_point: string;
          description?: string | null;
          tolerance?: string | null;
          values?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sample_size_specs"]["Insert"]>;
      };
      app_users: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          role: AppRole;
          password_hash: string;
          profile_image_path: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          display_name: string;
          role: AppRole;
          password_hash: string;
          profile_image_path?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          actor_username: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          sample_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          actor_username?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          sample_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
