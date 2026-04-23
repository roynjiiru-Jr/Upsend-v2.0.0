// Cloudflare environment bindings
export type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
}

// User types
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: number;
}

// Payment method options
export type PaymentMethod =
  | 'mpesa_phone'
  | 'mpesa_paybill'
  | 'mpesa_till'
  | 'bank_transfer'
  | 'external_link';

// Event types
export interface Event {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  event_date: string;
  cover_image: string | null;
  shareable_link: string;
  created_at: number;
  // Payment details
  payment_method:  PaymentMethod | null;
  payment_phone:   string | null;
  payment_name:    string | null;
  payment_paybill: string | null;
  payment_account: string | null;
  payment_till:    string | null;
  payment_link:    string | null;
}

// Message types
export interface Message {
  id: number;
  event_id: number;
  user_name: string | null;
  message_text: string;
  created_at: number;
}

// Contribution types (simplified — no payment gateway fields)
export interface Contribution {
  id: number;
  event_id: number;
  contributor_name: string | null; // used as 'name' in UI
  amount: number | null;
  message: string | null;
  created_at: number;
}

// Session types
export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: number;
  created_at: number;
}

// Event Image types
export interface EventImage {
  url: string;
  key: string;
  is_cover: number;
  display_order: number;
}

// Request payload interfaces
export interface CreateEventRequest {
  title: string;
  description?: string;
  event_date: string;
  cover_image?: string;
  images?: EventImage[];
  payment_method?:  PaymentMethod;
  payment_phone?:   string;
  payment_name?:    string;
  payment_paybill?: string;
  payment_account?: string;
  payment_till?:    string;
  payment_link?:    string;
}

export interface CreateContributionRequest {
  event_id: number;
  name: string;
  amount?: number;
  message?: string;
}

export interface CreateMessageRequest {
  event_id: number;
  user_name?: string;
  message_text: string;
}

export interface MagicLinkRequest {
  email: string;
  name?: string;
}

export interface VerifyMagicLinkRequest {
  token: string;
}

export interface EventWithStats extends Event {
  total_contributions: number;
  message_count: number;
  contribution_count: number;
}

export interface EventDetails extends Event {
  messages: Message[];
  contributions: Contribution[];
  total_contributions: number;
}
