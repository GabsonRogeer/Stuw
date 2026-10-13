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
  id: string;
  slot: string;
  title: string;
  subtitle: string;
  description: string;
  link: string;
  desktop_path: string;
  mobile_path: string;
  revision: number;
  updated_at: string;
  layout: 'split' | 'image';
  starts_at: string | null;
  ends_at: string | null;
  position: number;
  created_at: string;
  deleted_at: string | null;
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
  sku?: string;
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
  payment_test_mode: boolean;
  payment_status: string;
  shipment_status: string;
  payment_expires_at: string | null;
  checkout_fingerprint: string | null;
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
      checkout_shipping_quotes: {
        Row: {
          id: string;
          user_id: string;
          context_hash: string;
          products: import('@/services/checkout-integration').QuotedProduct[];
          options: import('@/services/shipping').ShippingOption[];
          expires_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          context_hash: string;
          products: import('@/services/checkout-integration').QuotedProduct[];
          options: import('@/services/shipping').ShippingOption[];
        };
        Update: never;
        Relationships: [];
      };
      order_integrations: {
        Row: {
          order_id: string;
          payment_id: string | null;
          payment_fingerprint: string;
          provider_updated_at: string | null;
          quote_id: string;
          shipping_service: string;
          label_id: string | null;
          stock_released: boolean;
          last_synced_at: string;
          next_sync_at: string | null;
          sync_error: string;
        };
        Insert: never;
        Update: { last_synced_at?: string; next_sync_at?: string | null; sync_error?: string };
        Relationships: [];
      };
      catalog_products: {
        Row: import('@/repositories/products').PublishedProduct;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      product_categories: {
        Row: import('@/services/categories').Category;
        Insert: import('@/services/categories').CategoryInput & { value: string };
        Update: Partial<
          Pick<import('@/services/categories').Category, 'label' | 'position' | 'archived'>
        >;
        Relationships: [];
      };
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
        Insert: never;
        Update: never;
        Relationships: [];
      };
      site_banners: { Row: Banner; Insert: never; Update: never; Relationships: [] };
      banner_campaigns: {
        Row: Banner;
        Insert: Omit<Banner, 'id' | 'revision' | 'updated_at' | 'created_at' | 'deleted_at'>;
        Update: Partial<
          Omit<Banner, 'id' | 'slot' | 'revision' | 'updated_at' | 'created_at' | 'deleted_at'>
        >;
        Relationships: [];
      };
      banner_publications: { Row: Banner; Insert: never; Update: never; Relationships: [] };
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
      create_checkout_order: {
        Args: {
          input_user: string;
          request: unknown;
          fingerprint: string;
          payment_fingerprint: string;
        };
        Returns: string;
      };
      apply_checkout_payment: {
        Args: { input_id: string; provider_id: string; next_status: string; provider_time: string };
        Returns: undefined;
      };
      apply_checkout_shipment: {
        Args: {
          input_id: string;
          input_label: string;
          next_status: string;
          input_tracking: string;
        };
        Returns: undefined;
      };
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
      change_banner_campaign: {
        Args: { input_id: string; expected_revision: number; operation: string };
        Returns: Banner[];
      };
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
