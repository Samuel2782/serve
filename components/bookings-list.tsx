'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  Phone,
  MapPin,
  Star,
  Lock,
  Unlock,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import type { Booking } from '@/lib/types';
import { getBookingsByProvider, verifyOTPAndComplete, formatPrice, formatTime } from '@/lib/data';
import { cn } from '@/lib/utils';

interface BookingsListProps {
  refreshTrigger: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-warning/10 text-warning' },
  confirmed: { label: 'Confirmed', color: 'bg-primary/10 text-primary' },
  in_progress: { label: 'In Progress', color: 'bg-accent/10 text-accent' },
  completed: { label: 'Completed', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
};

export function BookingsList({ refreshTrigger }: BookingsListProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [otpResults, setOtpResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    loadBookings();
  }, [refreshTrigger]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('bookings')
        .select('*, provider:providers(*), service:services(*)')
        .order('created_at', { ascending: false })
        .limit(20);
      setBookings(data || []);
    } catch {
      setBookings([]);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (bookingId: string) => {
    const otp = otpInputs[bookingId];
    if (!otp || otp.length !== 4) return;
    setVerifying((v) => ({ ...v, [bookingId]: true }));
    const result = await verifyOTPAndComplete(bookingId, otp);
    setOtpResults((r) => ({ ...r, [bookingId]: result }));
    setVerifying((v) => ({ ...v, [bookingId]: false }));
    if (result.success) {
      loadBookings();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No bookings yet. Book a service to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const status = statusConfig[booking.status] || statusConfig.pending;
        const isCompleted = booking.status === 'completed';
        const isConfirmed = booking.status === 'confirmed';
        const result = otpResults[booking.id];

        return (
          <Card key={booking.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm truncate">
                    {booking.service?.name || 'Service'}
                  </h4>
                  <Badge className={cn('border-0', status.color)}>{status.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {booking.provider?.business_name || booking.provider?.name || 'Provider'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{formatPrice(booking.total_price)}</p>
                <p className="text-xs text-muted-foreground">
                  {booking.pricing_breakdown?.line_items?.length || 1} item(s)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(booking.scheduled_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(booking.scheduled_start_time)}
              </span>
              {booking.provider && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  {booking.provider.rating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                {isCompleted ? (
                  <>
                    <Unlock className="h-3.5 w-3.5 text-success" />
                    Payment released
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-warning" />
                    In escrow
                  </>
                )}
              </span>
            </div>

            {/* OTP verification for confirmed bookings */}
            {isConfirmed && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  Enter the OTP from your provider to release payment
                </div>
                <div className="flex gap-2">
                  <Input
                    maxLength={4}
                    placeholder="4-digit OTP"
                    value={otpInputs[booking.id] || ''}
                    onChange={(e) =>
                      setOtpInputs((prev) => ({ ...prev, [booking.id]: e.target.value.replace(/\D/g, '') }))
                    }
                    className="h-9 font-mono tracking-widest"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleVerifyOTP(booking.id)}
                    disabled={verifying[booking.id] || (otpInputs[booking.id] || '').length !== 4}
                  >
                    {verifying[booking.id] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
                {result && (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      result.success ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                    {result.message}
                  </div>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Job completed and payment released to provider
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
