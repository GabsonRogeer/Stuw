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
export type OrderItem = {
  id: number;
  title: string;
  image: string;
  size: string;
  color: string;
  qty: number;
  price_cents: number;
};
export type OrderEvent = {
  id: string;
  order_id: string;
  actor_id: string | null;
  status: string;
  note: string;
  created_at: string;
};
export type Order = {
  id: string;
  user_id: string;
  number: string;
  status: string;
  total_cents: number;
  created_at: string;
  is_demo: boolean;
  request_key: string | null;
  customer_name: string;
  customer_email: string;
  delivery: Record<string, string>;
  items: OrderItem[];
  payment_method: string;
  installments: number;
  gift: boolean;
  subtotal_cents: number;
  shipping_cents: number;
  gift_cents: number;
  discount_cents: number;
  pix_discount_cents: number;
  coupon_code: string;
  shipping_name: string;
  shipping_estimate: string;
  tracking_code: string;
  carrier: string;
  revision: number;
  updated_at: string;
};
export type WholesaleSettings = { id: boolean; minimum_quantity: number; whatsapp_number: string };
export type WholesaleQuote = {
  id: string;
  user_id: string;
  request_key: string;
  number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  company: string;
  cnpj: string;
  notes: string;
  items: import('@/services/wholesale').WholesaleLine[];
  quantity: number;
  minimum_quantity: number;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type QuoteEvent = {
  id: string;
  quote_id: string;
  actor_id: string | null;
  status: string;
  note: string;
  created_at: string;
};
export type Database = {
  public: {
    Tables: {
      admin_products: {
        Row: import('@/services/product-admin').AdminProduct;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      wholesale_settings: {
        Row: WholesaleSettings;
        Insert: never;
        Update: { minimum_quantity?: number; whatsapp_number?: string };
        Relationships: [];
      };
      wholesale_quotes: { Row: WholesaleQuote; Insert: never; Update: never; Relationships: [] };
      wholesale_quote_events: { Row: QuoteEvent; Insert: never; Update: never; Relationships: [] };
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
        Insert: never;
        Update: never;
        Relationships: [];
      };
      order_events: { Row: OrderEvent; Insert: never; Update: never; Relationships: [] };
    };
    Views: { [_ in never]: never };
    Functions: {
      save_product: {
        Args: {
          input_id: number | null;
          expected_revision: number;
          input_document: unknown;
          input_payload: unknown;
          legacy_slug?: string | null;
        };
        Returns: number;
      };
      archive_product: {
        Args: { input_id: number; expected_revision: number };
        Returns: undefined;
      };
      create_wholesale_quote: { Args: { request: unknown }; Returns: string };
      update_wholesale_quote: {
        Args: {
          input_id: string;
          expected_revision: number;
          next_status: string;
          input_note: string;
        };
        Returns: undefined;
      };
      create_demo_order: { Args: { request: unknown }; Returns: string };
      update_order: {
        Args: {
          input_id: string;
          expected_revision: number;
          next_status: string;
          input_carrier: string;
          input_tracking: string;
        };
        Returns: undefined;
      };
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
