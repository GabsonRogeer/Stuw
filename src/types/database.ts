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
  desktop_position_y?: number;
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
      complete_look_settings: {
        Row: import('@/services/complete-look').CompleteLookSettings;
        Insert: never;
        Update: Partial<
          Omit<
            import('@/services/complete-look').CompleteLookSettings,
            'id' | 'revision' | 'updated_at'
          >
        >;
        Relationships: [];
      };
      operation_staff: ReadTable<{
        user_id: string;
        role: string;
        active: boolean;
        updated_at: string;
      }>;
      operation_orders: ReadTable<{
        order_id: string;
        stage: string;
        responsible_id: string | null;
        evidence: string;
        revision: number;
        updated_at: string;
      }>;
      order_refunds: ReadTable<{
        id: string;
        order_id: string;
        payment_id: string;
        amount_cents: number;
        cumulative_cents: number;
        provider_time: string;
        source: string;
        created_at: string;
      }>;
      order_returns: ReadTable<{
        id: string;
        request_key: string;
        order_id: string;
        item_index: number;
        quantity: number;
        kind: string;
        status: string;
        reason: string;
        resolution: string;
        inspection: string;
        stock_disposition: string;
        stock_reference: string;
        settlement_reference: string;
        responsible_id: string;
        revision: number;
        created_at: string;
        updated_at: string;
      }>;
      operation_audit: ReadTable<{
        id: number;
        entity: string;
        entity_id: string;
        order_id: string | null;
        actor_id: string | null;
        actor_source: string;
        action: string;
        before_data: Record<string, unknown> | null;
        after_data: Record<string, unknown>;
        created_at: string;
      }>;
      stock_movements: ReadTable<{
        id: number;
        sku: string;
        stock_before: number;
        stock_after: number;
        quantity: number;
        kind: string;
        reason: string;
        actor_id: string | null;
        order_id: string | null;
        created_at: string;
      }>;
      olist_orders: {
        Row: {
          order_id: string;
          remote_id: string | null;
          tax_document: string | null;
          state: string;
          attempted_at: string | null;
          invoice_id: string | null;
          last_error: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: {
          remote_id?: string;
          state?: string;
          attempted_at?: string;
          invoice_id?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      olist_invoice_automation: {
        Row: { id: boolean; enabled: boolean; activated_at: string | null };
        Insert: never;
        Update: { enabled?: boolean; activated_at?: string };
        Relationships: [];
      };
      olist_invoice_jobs: {
        Row: {
          order_id: string;
          invoice_id: string | null;
          status: string;
          generate_attempted_at: string | null;
          emit_attempted_at: string | null;
          generate_actor: string | null;
          emit_actor: string | null;
          last_error: string | null;
          document_error: string | null;
          documents_next_attempt_at: string;
          automatic: boolean;
          automation_attempts: number;
          validated_skus: string[];
          next_attempt_at: string;
          lease_owner: string | null;
          lease_until: string | null;
          updated_at: string;
        };
        Insert: { order_id: string };
        Update: {
          invoice_id?: string;
          status?: string;
          generate_attempted_at?: string;
          emit_attempted_at?: string;
          generate_actor?: string | null;
          emit_actor?: string | null;
          automation_attempts?: number;
          validated_skus?: string[];
          next_attempt_at?: string;
          lease_owner?: string | null;
          lease_until?: string | null;
          last_error?: string | null;
          document_error?: string | null;
          documents_next_attempt_at?: string;
        };
        Relationships: [];
      };
      olist_products: {
        Row: {
          product_id: number;
          remote_id: string | null;
          state: string;
          last_error: string | null;
          attempted_at: string | null;
          synced_revision: number | null;
          remote_hash: string | null;
          updated_at: string;
        };
        Insert: { product_id: number };
        Update: {
          remote_id?: string;
          state?: string;
          last_error?: string | null;
          attempted_at?: string;
          synced_revision?: number;
          remote_hash?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      olist_inventory: {
        Row: {
          sku: string;
          physical: number | null;
          reserved: number | null;
          observed_at: string | null;
          checked_at: string | null;
          next_check_at: string;
          error: string | null;
          enabled: boolean;
        };
        Insert: { sku: string };
        Update: { checked_at?: string; next_check_at?: string; error?: string | null };
        Relationships: [];
      };
      olist_skus: {
        Row: {
          sku: string;
          product_id: number;
          remote_id: string | null;
          state: string;
          attempted_at: string | null;
          remote_hash: string | null;
          last_error: string | null;
        };
        Insert: { sku: string; product_id: number; state?: string };
        Update: {
          state?: string;
          attempted_at?: string;
          remote_hash?: string;
          last_error?: string | null;
        };
        Relationships: [];
      };
      olist_inbox: {
        Row: {
          remote_id: string;
          name: string;
          state: string;
          last_error: string | null;
          remote_hash: string | null;
          updated_at: string;
        };
        Insert: {
          remote_id: string;
          name: string;
          state: string;
          last_error?: string | null;
          remote_hash?: string;
          updated_at?: string;
        };
        Update: {
          state?: string;
          last_error?: string | null;
          remote_hash?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      olist_cursor: {
        Row: {
          id: boolean;
          page: number;
          position: number;
          locked_until: string;
          owner: string | null;
        };
        Insert: never;
        Update: { page?: number; position?: number; locked_until?: string; owner?: string | null };
        Relationships: [];
      };
      order_invoice_documents: {
        Row: {
          order_id: string;
          invoice_id: string;
          number: string;
          series: string;
          access_key: string;
          total_cents: number;
          authorized_at: string;
          pdf_path: string;
          xml_path: string;
          pdf_sha256: string;
          xml_sha256: string;
          created_at: string;
        };
        Insert: {
          order_id: string;
          invoice_id: string;
          number: string;
          series: string;
          access_key: string;
          total_cents: number;
          authorized_at: string;
          pdf_path: string;
          xml_path: string;
          pdf_sha256: string;
          xml_sha256: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'order_invoice_documents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'olist_invoice_jobs';
            referencedColumns: ['order_id'];
          },
        ];
      };
      email_outbox: {
        Row: {
          id: string;
          order_id: string;
          kind: string;
          status: string;
          attempts: number;
          available_at: string;
          claimed_at: string | null;
          sent_at: string | null;
          last_error: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          status?: string;
          attempts?: number;
          available_at?: string;
          claimed_at?: string;
          sent_at?: string;
          last_error?: string | null;
        };
        Relationships: [];
      };
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
        Relationships: [
          {
            foreignKeyName: 'order_integrations_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
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
      operation_allowed: { Args: { permission: string }; Returns: boolean };
      change_operation: {
        Args: {
          input_order: string;
          expected_revision: number;
          next_stage: string;
          input_note: string;
        };
        Returns: undefined;
      };
      manage_return: {
        Args: {
          input_order: string;
          input_id: string | null;
          request_key: string;
          item_index: number;
          quantity: number;
          kind: string;
          next_status: string;
          expected_revision: number;
          note: string;
          details?: Record<string, string>;
        };
        Returns: string;
      };
      set_operation_staff: {
        Args: { input_user: string; input_role: string; input_active: boolean };
        Returns: undefined;
      };
      set_operation_staff_email: {
        Args: { input_email: string; input_role: string; input_active: boolean };
        Returns: undefined;
      };
      operation_people: {
        Args: Record<string, never>;
        Returns: { user_id: string; full_name: string }[];
      };
      reconcile_checkout_payment: {
        Args: {
          input_id: string;
          provider_id: string;
          next_status: string;
          provider_time: string;
          refunded_cents: number;
        };
        Returns: undefined;
      };
      apply_olist_inventory: {
        Args: {
          code: string;
          erp_id: string;
          physical_stock: number;
          reserved_stock: number;
          observed: string;
        };
        Returns: string;
      };
      confirm_olist_inventory: { Args: { input_order: string; proof: string }; Returns: undefined };
      get_olist_invoice_components: {
        Args: { input_order: string };
        Returns: { sku: string; quantity: number }[];
      };
      prepare_olist_order: {
        Args: { input_id: string; input_user: string; input_document: string };
        Returns: undefined;
      };
      claim_olist_sync: { Args: { worker: string }; Returns: boolean };
      claim_automatic_olist_invoice: {
        Args: { worker: string };
        Returns: Database['public']['Tables']['olist_invoice_jobs']['Row'][];
      };
      link_olist_product: {
        Args: {
          local_id: number;
          erp_id: string;
          sku_links: unknown;
          revision_seen: number;
          hash_seen: string;
        };
        Returns: undefined;
      };
      link_olist_sku: {
        Args: { local_id: number; sku_code: string; erp_id: string; hash_seen: string };
        Returns: undefined;
      };
      import_olist_product: {
        Args: { erp_id: string; doc: unknown; sku_links: unknown; hash_seen: string };
        Returns: number;
      };
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
type ReadTable<T> = { Row: T; Insert: never; Update: never; Relationships: [] };
