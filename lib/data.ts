import { supabase } from './supabase';
import type {
  ServiceCategory,
  Service,
  Provider,
  ProviderAvailability,
  Booking,
  PricingBreakdown,
  TimeSlot,
  InstantRequest,
  Transaction,
  Review,
} from './types';

export async function getCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .order('display_order');
  if (error) throw error;
  return data || [];
}

export async function getServicesByCategory(categoryId?: string, searchQuery?: string): Promise<Service[]> {
  let query = supabase
    .from('services')
    .select('*, category:service_categories(*)')
    .eq('is_active', true)
    .order('name');
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    return data.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q),
    );
  }
  return data;
}

export async function getAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*, category:service_categories(*)')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getServiceById(id: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from('services')
    .select('*, category:service_categories(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProvidersForService(
  serviceId: string,
  userLat?: number,
  userLng?: number,
  radiusKm: number = 5,
): Promise<Provider[]> {
  const { data: providerServices, error: psError } = await supabase
    .from('provider_services')
    .select('provider:providers(*)')
    .eq('service_id', serviceId);
  if (psError) throw psError;
  if (!providerServices) return [];
  const providers = (providerServices
    .map((ps) => ps.provider)
    .filter((p) => p !== null)) as unknown as Provider[];
  if (userLat !== undefined && userLng !== undefined) {
    return providers.filter((p) => {
      const dist = haversineDistance(userLat, userLng, p.latitude, p.longitude);
      return dist <= Math.max(radiusKm, p.service_radius_km);
    });
  }
  return providers;
}

export async function getProviderById(id: string): Promise<Provider | null> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProviderAvailability(providerId: string): Promise<ProviderAvailability[]> {
  const { data, error } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', providerId)
    .order('day_of_week');
  if (error) throw error;
  return data || [];
}

export async function getProviderServices(providerId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('provider_services')
    .select('service:services(*)')
    .eq('provider_id', providerId);
  if (error) throw error;
  if (!data) return [];
  return (data.map((ps) => ps.service).filter((s) => s !== null)) as unknown as Service[];
}

export async function getBookingsByProvider(providerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, provider:providers(*), service:services(*)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getBookingsByStatus(status: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, provider:providers(*), service:services(*)')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, provider:providers(*), service:services(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTransactionByBooking(bookingId: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReviewsForProvider(providerId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCheckedInProviders(
  serviceId: string,
  userLat: number,
  userLng: number,
  radiusKm: number = 3,
): Promise<Provider[]> {
  const { data: providerServices, error } = await supabase
    .from('provider_services')
    .select('provider:providers(*)')
    .eq('service_id', serviceId);
  if (error) throw error;
  if (!providerServices) return [];
  return (providerServices
    .map((ps) => ps.provider)
    .filter((p) => p !== null) as unknown as Provider[])
    .filter((p) => p.is_checked_in && p.is_verified)
    .filter((p) => haversineDistance(userLat, userLng, p.latitude, p.longitude) <= radiusKm);
}

export async function getInstantRequestById(id: string): Promise<InstantRequest | null> {
  const { data, error } = await supabase
    .from('instant_requests')
    .select('*, service:services(*), provider:providers(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getActiveInstantRequests(): Promise<InstantRequest[]> {
  const { data, error } = await supabase
    .from('instant_requests')
    .select('*, service:services(*)')
    .eq('status', 'broadcasting')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getInstantRequestsForProvider(providerId: string): Promise<InstantRequest[]> {
  const { data: providerServices } = await supabase
    .from('provider_services')
    .select('service_id')
    .eq('provider_id', providerId);
  const serviceIds = (providerServices || []).map((ps) => ps.service_id);
  if (serviceIds.length === 0) return [];
  const { data, error } = await supabase
    .from('instant_requests')
    .select('*, service:services(*)')
    .in('service_id', serviceIds)
    .eq('status', 'broadcasting')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllProviders(): Promise<Provider[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('rating', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============ MUTATIONS ============

export async function createBooking(params: {
  provider_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  customer_latitude?: number;
  customer_longitude?: number;
  scheduled_date: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  total_price: number;
  pricing_breakdown: PricingBreakdown;
}): Promise<Booking> {
  const otp = generateOTP();
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...params,
      status: 'confirmed',
      otp_code: otp,
    })
    .select('*')
    .single();
  if (error) throw error;

  // Create escrow transaction
  await supabase.from('transactions').insert({
    booking_id: data.id,
    amount: params.total_price,
    status: 'held',
    payment_method: 'card',
  });

  return data;
}

export async function updateBookingStatus(
  bookingId: string,
  status: Booking['status'],
  extra?: Record<string, unknown>,
): Promise<Booking | null> {
  const updateData: Record<string, unknown> = { status, ...extra };
  if (status === 'completed') updateData.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', bookingId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function verifyOTPAndComplete(bookingId: string, otp: string): Promise<{ success: boolean; message: string }> {
  const booking = await getBookingById(bookingId);
  if (!booking) return { success: false, message: 'Booking not found' };
  if (booking.status === 'completed') return { success: false, message: 'Booking already completed' };
  if (booking.otp_code !== otp) return { success: false, message: 'Invalid OTP code' };

  await updateBookingStatus(bookingId, 'completed');

  // Release escrow
  await supabase
    .from('transactions')
    .update({ status: 'released', released_at: new Date().toISOString() })
    .eq('booking_id', bookingId);

  return { success: true, message: 'Job completed! Payment released to provider.' };
}

export async function createInstantRequest(params: {
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  customer_latitude: number;
  customer_longitude: number;
}): Promise<InstantRequest> {
  const { data, error } = await supabase
    .from('instant_requests')
    .insert({ ...params, status: 'broadcasting' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function acceptInstantRequest(
  requestId: string,
  providerId: string,
): Promise<InstantRequest | null> {
  const { data, error } = await supabase
    .from('instant_requests')
    .update({
      status: 'accepted',
      provider_id: providerId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'broadcasting')
    .select('*, service:services(*), provider:providers(*)')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function cancelInstantRequest(requestId: string): Promise<void> {
  await supabase
    .from('instant_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'broadcasting');
}

export async function updateProviderLocation(
  providerId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await supabase
    .from('providers')
    .update({ provider_latitude: lat, provider_longitude: lng })
    .eq('id', providerId);
}

export async function updateProviderCheckIn(
  providerId: string,
  checkedIn: boolean,
): Promise<void> {
  await supabase
    .from('providers')
    .update({ is_checked_in: checkedIn })
    .eq('id', providerId);
}

export async function saveProviderAvailability(
  providerId: string,
  slots: { day_of_week: number; start_time: string; end_time: string; max_simultaneous_jobs: number }[],
): Promise<void> {
  await supabase.from('provider_availability').delete().eq('provider_id', providerId);
  if (slots.length > 0) {
    await supabase
      .from('provider_availability')
      .insert(slots.map((s) => ({ ...s, provider_id: providerId })));
  }
}

export async function createReview(params: {
  booking_id: string;
  provider_id: string;
  customer_name: string;
  rating: number;
  comment?: string;
}): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .insert(params)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ============ UTILITIES ============

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function generateTimeSlots(
  availability: ProviderAvailability[],
  bookings: Booking[],
  date: Date,
): TimeSlot[] {
  const dayOfWeek = date.getDay();
  const daySlots = availability.filter((a) => a.day_of_week === dayOfWeek);
  if (daySlots.length === 0) return [];

  const slots: TimeSlot[] = [];
  const dateStr = date.toISOString().split('T')[0];
  const dayBookings = bookings.filter((b) => b.scheduled_date === dateStr && b.status !== 'cancelled');

  for (const avail of daySlots) {
    const [startH, startM] = avail.start_time.split(':').map(Number);
    const [endH, endM] = avail.end_time.split(':').map(Number);
    let currentMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const slotDuration = 60;

    while (currentMin + slotDuration <= endMin) {
      const slotStart = `${String(Math.floor(currentMin / 60)).padStart(2, '0')}:${String(currentMin % 60).padStart(2, '0')}`;
      const slotEnd = `${String(Math.floor((currentMin + slotDuration) / 60)).padStart(2, '0')}:${String((currentMin + slotDuration) % 60).padStart(2, '0')}`;
      const overlapping = dayBookings.filter((b) => {
        const bStart = b.scheduled_start_time.split(':').slice(0, 2).join(':');
        const bEnd = b.scheduled_end_time.split(':').slice(0, 2).join(':');
        return bStart < slotEnd && bEnd > slotStart;
      });
      slots.push({
        start_time: slotStart,
        end_time: slotEnd,
        available: overlapping.length < avail.max_simultaneous_jobs,
        max_jobs: avail.max_simultaneous_jobs,
        current_bookings: overlapping.length,
      });
      currentMin += slotDuration;
    }
  }
  return slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function calculatePricing(
  service: Service,
  quantity: number = 1,
): PricingBreakdown {
  const base = service.base_price;
  let lineItemLabel = service.name;
  let subtotal = base;

  if (service.pricing_type === 'flat') {
    lineItemLabel = service.name;
    subtotal = base;
  } else if (service.pricing_type === 'hourly') {
    lineItemLabel = `${service.name} (${quantity} ${service.unit_label || 'hour'}${quantity > 1 ? 's' : ''} @ $${base}/${service.unit_label || 'hour'})`;
    subtotal = base * quantity;
  } else if (service.pricing_type === 'unit') {
    lineItemLabel = `${service.name} (${quantity} ${service.unit_label || 'unit'}${quantity > 1 ? 's' : ''} @ $${base}/${service.unit_label || 'unit'})`;
    subtotal = base * quantity;
  }

  const platformFee = Math.round(subtotal * 0.1 * 100) / 100;
  const total = Math.round((subtotal + platformFee) * 100) / 100;

  return {
    base_price: base,
    pricing_type: service.pricing_type,
    unit_label: service.unit_label || undefined,
    quantity,
    line_items: [{ label: lineItemLabel, amount: subtotal }],
    subtotal,
    platform_fee: platformFee,
    total,
  };
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function formatPricingType(service: Service): string {
  switch (service.pricing_type) {
    case 'flat':
      return formatPrice(service.base_price);
    case 'hourly':
      return `${formatPrice(service.base_price)}/${service.unit_label || 'hr'}`;
    case 'unit':
      return `${formatPrice(service.base_price)}/${service.unit_label || 'unit'}`;
  }
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || '';
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}
