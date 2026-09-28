export type Address = {
  id: string;
  user_id: string;
  label: string;
  recipient: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  created_at: string;
};
export type Coupon = {
  id: string;
  code: string;
  percent: number;
  active: boolean;
  max_uses: number;
  used_count: number;
  expires_at: string;
  created_at: string;
};
export type Banner = {
  slot: string;
  title: string;
  subtitle: string;
  description: string;
  link: string;
  desktop_path: string;
  mobile_path: string;
  revision: number;
  updated_at: string;
};
type Profile = {
  id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};
type Order = {
  id: string;
  user_id: string;
  number: string;
  status: string;
  total_cents: number;
  created_at: string;
};
export type Database = {
  public: {
    Tables: {
      banner_drafts: {
        Row: Banner;
        Insert: Omit<Banner, 'revision' | 'updated_at'>;
        Update: Partial<Omit<Banner, 'slot' | 'revision' | 'updated_at'>>;
        Relationships: [];
      };
      site_banners: { Row: Banner; Insert: never; Update: never; Relationships: [] };
      coupons: {
        Row: Coupon;
        Insert: Omit<Coupon, 'id' | 'created_at' | 'used_count'>;
        Update: Partial<Omit<Coupon, 'id' | 'created_at' | 'used_count'>>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string;
          birth_date?: string | null;
          phone?: string | null;
        };
        Update: { full_name?: string; birth_date?: string | null; phone?: string | null };
        Relationships: [];
      };
      addresses: {
        Row: Address;
        Insert: Omit<Address, 'id' | 'created_at'>;
        Update: Partial<Omit<Address, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      publish_home_banner: { Args: { expected_revision: number }; Returns: undefined };
      unpublish_home_banner: { Args: Record<string, never>; Returns: undefined };
      lookup_coupon: {
        Args: { input_code: string };
        Returns: { code: string; percent: number; expires_at: string }[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
