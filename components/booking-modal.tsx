'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import {
  Star,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  Loader2,
  ChevronRight,
  Lock,
  Receipt,
  CalendarDays,
  User,
  Phone,
  Home,
  AlertCircle,
} from 'lucide-react';
import type { Service, Provider, Booking, TimeSlot } from '@/lib/types';
import {
  getProvidersForService,
  getProviderAvailability,
  getBookingsByProvider,
  generateTimeSlots,
  calculatePricing,
  formatPrice,
  formatTime,
  haversineDistance,
  createBooking,
} from '@/lib/data';
import { cn } from '@/lib/utils';
import type { UserLocation } from './location-bar';

interface BookingModalProps {
  service: Service | null;
  userLocation: UserLocation | null;
  onClose: () => void;
  onBookingConfirmed: (booking: Booking) => void;
}

type Step = 'provider' | 'schedule' | 'details' | 'payment' | 'confirm';

export function BookingModal({ service, userLocation, onClose, onBookingConfirmed }: BookingModalProps) {
  const [step, setStep] = useState<Step>('provider');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [processing, setProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (service && userLocation) {
      getProvidersForService(service.id, userLocation.lat, userLocation.lng).then(setProviders);
    }
  }, [service, userLocation]);

  useEffect(() => {
    if (!service) {
      setStep('provider');
      setSelectedProvider(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setConfirmedBooking(null);
      setError('');
    }
  }, [service]);

  const loadSlots = useCallback(async (provider: Provider, date: Date) => {
    setLoadingSlots(true);
    const [availability, bookings] = await Promise.all([
      getProviderAvailability(provider.id),
      getBookingsByProvider(provider.id),
    ]);
    const generated = generateTimeSlots(availability, bookings, date);
    setSlots(generated);
    setLoadingSlots(false);
  }, []);

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
    loadSlots(provider, tomorrow);
    setStep('schedule');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !selectedProvider) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    loadSlots(selectedProvider, date);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('details');
  };

  const handleDetailsSubmit = () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please fill in your name and phone number.');
      return;
    }
    setError('');
    setStep('payment');
  };

  const handlePayment = async () => {
    if (!service || !selectedProvider || !selectedDate || !selectedSlot) return;
    setProcessing(true);
    setError('');
    try {
      const pricing = calculatePricing(service, quantity);
      const booking = await createBooking({
        provider_id: selectedProvider.id,
        service_id: service.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress || undefined,
        customer_latitude: userLocation?.lat,
        customer_longitude: userLocation?.lng,
        scheduled_date: selectedDate.toISOString().split('T')[0],
        scheduled_start_time: selectedSlot.start_time,
        scheduled_end_time: selectedSlot.end_time,
        total_price: pricing.total,
        pricing_breakdown: pricing,
      });
      setConfirmedBooking(booking);
      setProcessing(false);
      setStep('confirm');
    } catch (err) {
      setProcessing(false);
      setError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    }
  };

  if (!service) return null;

  const pricing = calculatePricing(service, quantity);

  return (
    <Dialog open={!!service} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{service.name}</DialogTitle>
          <DialogDescription>
            {service.description || 'Book this service with transparent upfront pricing.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4 text-xs">
          {(['provider', 'schedule', 'details', 'payment', 'confirm'] as Step[]).map((s, i) => {
            const labels = ['Provider', 'Schedule', 'Details', 'Payment', 'Done'];
            const isActive = step === s;
            const isPast = (['provider', 'schedule', 'details', 'payment', 'confirm'] as Step[]).indexOf(step) > i;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isPast && 'text-primary',
                  !isActive && !isPast && 'text-muted-foreground',
                )}>
                  <span className={cn(
                    'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold',
                    isActive && 'bg-primary-foreground/20',
                    isPast && 'bg-primary/10',
                    !isActive && !isPast && 'bg-muted',
                  )}>{i + 1}</span>
                  <span className="hidden sm:inline font-medium">{labels[i]}</span>
                </div>
                {i < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
              </div>
            );
          })}
        </div>

        {/* Step: Provider selection */}
        {step === 'provider' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {providers.length} providers near you offer this service.
            </p>
            {providers.map((p) => {
              const dist = userLocation ? haversineDistance(userLocation.lat, userLocation.lng, p.latitude, p.longitude) : 0;
              return (
                <Card
                  key={p.id}
                  className="p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all"
                  onClick={() => handleProviderSelect(p)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate">{p.business_name || p.name}</h4>
                        {p.is_verified && (
                          <ShieldCheck className="h-4 w-4 text-success flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          {p.rating.toFixed(1)} ({p.total_reviews})
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {dist.toFixed(1)}km away
                        </span>
                        <span>{p.total_jobs} jobs done</span>
                      </div>
                      {p.bio && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{p.bio}</p>}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                  </div>
                </Card>
              );
            })}
            {providers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No providers found in your area. Try expanding your search radius.</p>
              </div>
            )}
          </div>
        )}

        {/* Step: Schedule */}
        {step === 'schedule' && selectedProvider && (
          <div className="space-y-4">
            {service.pricing_type !== 'flat' && (
              <div>
                <Label className="mb-2 block">
                  Quantity ({service.unit_label || 'unit'})
                </Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground ml-2">
                    {formatPrice(service.base_price)} per {service.unit_label}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Select a date
              </Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-lg border mx-auto"
              />
            </div>

            {selectedDate && (
              <div>
                <Label className="mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Available time slots
                </Label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No available slots on this day. The provider may not work on this day.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot, i) => (
                      <button
                        key={i}
                        disabled={!slot.available}
                        onClick={() => handleSlotSelect(slot)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                          selectedSlot?.start_time === slot.start_time
                            ? 'border-primary bg-primary text-primary-foreground'
                            : slot.available
                              ? 'border-border hover:border-primary hover:bg-primary/5'
                              : 'border-border bg-muted text-muted-foreground cursor-not-allowed line-through',
                        )}
                      >
                        {formatTime(slot.start_time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setStep('provider')} className="text-xs">
              Back to providers
            </Button>
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="mb-1.5 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="mb-1.5 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1-555-0100"
                />
              </div>
              <div>
                <Label htmlFor="address" className="mb-1.5 flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Service Address
                </Label>
                <Input
                  id="address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="123 Main Street, Downtown"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('schedule')}>
                Back
              </Button>
              <Button onClick={handleDetailsSubmit} className="flex-1">
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === 'payment' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Invoice Breakdown</h4>
              </div>
              <div className="space-y-2">
                {pricing.line_items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{formatPrice(item.amount)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service subtotal</span>
                  <span className="font-medium">{formatPrice(pricing.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform fee (10%)</span>
                  <span className="font-medium">{formatPrice(pricing.platform_fee)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg text-primary">{formatPrice(pricing.total)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Payment Method</h4>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Credit / Debit Card</p>
                    <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Payment is held in escrow and released to the provider only after you confirm job completion with an OTP code.
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('details')}>
                Back
              </Button>
              <Button onClick={handlePayment} disabled={processing} className="flex-1">
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing payment...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Pay {formatPrice(pricing.total)} & Book
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirmation */}
        {step === 'confirm' && confirmedBooking && (
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">Booking Confirmed!</h3>
              <p className="text-sm text-muted-foreground">
                Your service is scheduled and payment is held in escrow.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-left space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">{selectedProvider?.business_name || selectedProvider?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {selectedDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{formatTime(confirmedBooking.scheduled_start_time)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatPrice(confirmedBooking.total_price)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">OTP Code</span>
                <Badge className="text-base font-bold tracking-wider bg-primary">
                  {confirmedBooking.otp_code}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-warning-foreground">
              <p className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Share this OTP with the provider after the job is complete to release payment from escrow.
                </span>
              </p>
            </div>

            <Button
              onClick={() => onBookingConfirmed(confirmedBooking)}
              className="w-full max-w-sm"
            >
              View My Bookings
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
