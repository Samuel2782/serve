/*
# VicinityServices - Local Services Marketplace Schema

## Overview
Creates the complete database schema for VicinityServices, a local services marketplace
connecting customers with local service providers. This is a no-auth demo application
where data is intentionally shared/public (single-tenant style), so all policies allow
both anon and authenticated roles.

## New Tables

1. `service_categories` - Top-level service categories (e.g., AC Repair, Cleaning, Plumbing)
   - id, name, slug, icon (lucide icon name), description, display_order, created_at

2. `services` - Specific services with transparent pricing
   - id, category_id (FK), name, slug, description, pricing_type (flat/hourly/unit),
     base_price (numeric), unit_label (e.g., "room", "hour"), estimated_duration_mins,
     icon, image_url, is_active, created_at

3. `providers` - Service provider profiles with geo-location
   - id, name, business_name, avatar_url, phone, email, bio, latitude, longitude,
     address, locality, city, service_radius_km, is_verified, is_checked_in,
     rating, total_reviews, total_jobs, created_at

4. `provider_services` - Many-to-many: which services each provider offers
   - id, provider_id (FK), service_id (FK), custom_price (nullable override)

5. `provider_availability` - Weekly recurring availability slots
   - id, provider_id (FK), day_of_week (0-6), start_time (time), end_time (time),
     max_simultaneous_jobs

6. `bookings` - Scheduled service bookings with escrow payment
   - id, provider_id (FK), service_id (FK), customer_name, customer_phone,
     customer_address, customer_latitude, customer_longitude,
     scheduled_date (date), scheduled_start_time (time), scheduled_end_time (time),
     status (pending/confirmed/in_progress/completed/cancelled),
     total_price (numeric), pricing_breakdown (jsonb), otp_code,
     provider_latitude, provider_longitude (for live tracking),
     created_at, completed_at

7. `transactions` - Escrow payment records
   - id, booking_id (FK), amount (numeric), status (held/released/refunded),
     payment_method, created_at, released_at

8. `instant_requests` - On-demand dispatch requests (Instant Work feature)
   - id, service_id (FK), customer_name, customer_phone, customer_address,
     customer_latitude, customer_longitude, status (broadcasting/accepted/expired/cancelled),
     provider_id (nullable FK), accepted_at, created_at

9. `reviews` - Customer reviews for completed bookings
   - id, booking_id (FK), provider_id (FK), customer_name, rating (1-5),
     comment, created_at

## Security
- RLS enabled on all tables.
- All tables allow anon + authenticated CRUD (intentionally public/shared demo data).
- USING (true) is correct here because this is a no-auth app with intentionally shared data.
*/

-- ============ SERVICE CATEGORIES ============
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text NOT NULL DEFAULT 'Wrench',
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_service_categories" ON service_categories;
CREATE POLICY "anon_crud_service_categories" ON service_categories FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ SERVICES ============
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  pricing_type text NOT NULL DEFAULT 'flat' CHECK (pricing_type IN ('flat','hourly','unit')),
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  unit_label text,
  estimated_duration_mins int NOT NULL DEFAULT 60,
  icon text NOT NULL DEFAULT 'Wrench',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_services" ON services;
CREATE POLICY "anon_crud_services" ON services FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

-- ============ PROVIDERS ============
CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_name text,
  avatar_url text,
  phone text,
  email text,
  bio text,
  latitude numeric(10,6) NOT NULL DEFAULT 0,
  longitude numeric(10,6) NOT NULL DEFAULT 0,
  address text,
  locality text,
  city text,
  service_radius_km int NOT NULL DEFAULT 5,
  is_verified boolean NOT NULL DEFAULT false,
  is_checked_in boolean NOT NULL DEFAULT false,
  rating numeric(3,2) NOT NULL DEFAULT 5.0,
  total_reviews int NOT NULL DEFAULT 0,
  total_jobs int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_providers" ON providers;
CREATE POLICY "anon_crud_providers" ON providers FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_providers_locality ON providers(locality);
CREATE INDEX IF NOT EXISTS idx_providers_checked_in ON providers(is_checked_in);
CREATE INDEX IF NOT EXISTS idx_providers_verified ON providers(is_verified);

-- ============ PROVIDER SERVICES ============
CREATE TABLE IF NOT EXISTS provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  custom_price numeric(10,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider_id, service_id)
);
ALTER TABLE provider_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_provider_services" ON provider_services;
CREATE POLICY "anon_crud_provider_services" ON provider_services FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_services_service ON provider_services(service_id);

-- ============ PROVIDER AVAILABILITY ============
CREATE TABLE IF NOT EXISTS provider_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_simultaneous_jobs int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_provider_availability" ON provider_availability;
CREATE POLICY "anon_crud_provider_availability" ON provider_availability FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_id);

-- ============ BOOKINGS ============
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  customer_latitude numeric(10,6),
  customer_longitude numeric(10,6),
  scheduled_date date NOT NULL,
  scheduled_start_time time NOT NULL,
  scheduled_end_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  pricing_breakdown jsonb NOT NULL DEFAULT '{}',
  otp_code text,
  provider_latitude numeric(10,6),
  provider_longitude numeric(10,6),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_bookings" ON bookings;
CREATE POLICY "anon_crud_bookings" ON bookings FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(scheduled_date);

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded')),
  payment_method text NOT NULL DEFAULT 'card',
  created_at timestamptz DEFAULT now(),
  released_at timestamptz
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_transactions" ON transactions;
CREATE POLICY "anon_crud_transactions" ON transactions FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);

-- ============ INSTANT REQUESTS ============
CREATE TABLE IF NOT EXISTS instant_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text,
  customer_latitude numeric(10,6) NOT NULL DEFAULT 0,
  customer_longitude numeric(10,6) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'broadcasting' CHECK (status IN ('broadcasting','accepted','expired','cancelled')),
  provider_id uuid REFERENCES providers(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE instant_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_instant_requests" ON instant_requests;
CREATE POLICY "anon_crud_instant_requests" ON instant_requests FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_instant_requests_status ON instant_requests(status);
CREATE INDEX IF NOT EXISTS idx_instant_requests_created ON instant_requests(created_at);

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating int NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_reviews" ON reviews;
CREATE POLICY "anon_crud_reviews" ON reviews FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);

-- Enable realtime on key tables for live tracking/instant dispatch
ALTER TABLE instant_requests REPLICA IDENTITY FULL;
ALTER TABLE bookings REPLICA IDENTITY FULL;
ALTER TABLE providers REPLICA IDENTITY FULL;