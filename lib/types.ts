export type PricingType = 'flat' | 'hourly' | 'unit';
export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type TransactionStatus = 'held' | 'released' | 'refunded';
export type InstantRequestStatus = 'broadcasting' | 'accepted' | 'expired' | 'cancelled';

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface Service {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  pricing_type: PricingType;
  base_price: number;
  unit_label: string | null;
  estimated_duration_mins: number;
  icon: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  category?: ServiceCategory;
}

export interface Provider {
  id: string;
  name: string;
  business_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  locality: string | null;
  city: string | null;
  service_radius_km: number;
  is_verified: boolean;
  is_checked_in: boolean;
  rating: number;
  total_reviews: number;
  total_jobs: number;
  created_at: string;
}

export interface ProviderService {
  id: string;
  provider_id: string;
  service_id: string;
  custom_price: number | null;
  provider?: Provider;
  service?: Service;
}

export interface ProviderAvailability {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_simultaneous_jobs: number;
  created_at: string;
}

export interface PricingBreakdown {
  base_price: number;
  pricing_type: PricingType;
  unit_label?: string;
  quantity?: number;
  line_items: { label: string; amount: number }[];
  subtotal: number;
  platform_fee: number;
  total: number;
}

export interface Booking {
  id: string;
  provider_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  status: BookingStatus;
  total_price: number;
  pricing_breakdown: PricingBreakdown;
  otp_code: string | null;
  provider_latitude: number | null;
  provider_longitude: number | null;
  created_at: string;
  completed_at: string | null;
  provider?: Provider;
  service?: Service;
}

export interface Transaction {
  id: string;
  booking_id: string;
  amount: number;
  status: TransactionStatus;
  payment_method: string;
  created_at: string;
  released_at: string | null;
}

export interface InstantRequest {
  id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_latitude: number;
  customer_longitude: number;
  status: InstantRequestStatus;
  provider_id: string | null;
  accepted_at: string | null;
  created_at: string;
  service?: Service;
  provider?: Provider;
}

export interface Review {
  id: string;
  booking_id: string;
  provider_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
  max_jobs: number;
  current_bookings: number;
}
