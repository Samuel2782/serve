'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, Loader2, Star, Lock, Unlock, Receipt, AlertCircle,
} from 'lucide-react';
import type { Booking } from '@/lib/types';
import { verifyOTPAndComplete, formatPrice, formatTime } from '@/lib/data';
import { cn } from '@/lib/utils';

interface BookingsListProps {
  refreshTrigger: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-secondary text-foreground' },
  confirmed: { label: 'Confirmed', color: 'bg-foreground text-background' },
  in_progress: { label: 'In Progress', color: 'bg-secondary text-foreground' },
  completed: { label: 'Completed', color: 'bg-foreground/10 text-foreground' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
};

export function BookingsList({ refreshTrigger }: BookingsListProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [otpResults, setOtpResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => { loadBookings(); }, [refreshTrigger]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const q = query(collection(db, 'bookings'), orderBy('created_at', 'desc'), limit(20));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking));
      setBookings(items);
    } catch { setBookings([]); }
    setLoading(false);
  };

  const handleVerifyOTP = async (bookingId: string) => {
    const otp = otpInputs[bookingId];
    if (!otp || otp.length !== 4) return;
    setVerifying((v) => ({ ...v, [bookingId]: true }));
    const result = await verifyOTPAndComplete(bookingId, otp);
    setOtpResults((r) => ({ ...r, [bookingId]: result }));
    setVerifying((v) => ({ ...v, [bookingId]: false }));
    if (result.success) loadBookings();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
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
      {bookings.map((booking, i) => {
        const status = statusConfig[booking.status] || statusConfig.pending;
        const isCompleted = booking.status === 'completed';
        const isConfirmed = booking.status === 'confirmed';
        const result = otpResults[booking.id];
        return (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="border border-border rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm truncate">{booking.service?.name || 'Service'}</h4>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.color)}>{status.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{booking.provider?.business_name || booking.provider?.name || 'Provider'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{formatPrice(booking.total_price)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />
                {new Date(booking.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(booking.scheduled_start_time)}</span>
              {booking.provider && (
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-foreground/40 text-foreground/40" />{booking.provider.rating.toFixed(1)}</span>
              )}
              <span className="flex items-center gap-1">
                {isCompleted ? <><Unlock className="h-3.5 w-3.5" /> Released</> : <><Lock className="h-3.5 w-3.5" /> In escrow</>}
              </span>
            </div>

            {isConfirmed && (
              <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" /> Enter the OTP from your provider to release payment
                </div>
                <div className="flex gap-2">
                  <input
                    maxLength={4} placeholder="4-digit OTP"
                    value={otpInputs[booking.id] || ''}
                    onChange={(e) => setOtpInputs((prev) => ({ ...prev, [booking.id]: e.target.value.replace(/\D/g, '') }))}
                    className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-mono tracking-widest focus:outline-none focus:border-foreground/30"
                  />
                  <button
                    onClick={() => handleVerifyOTP(booking.id)}
                    disabled={verifying[booking.id] || (otpInputs[booking.id] || '').length !== 4}
                    className="h-9 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {verifying[booking.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                  </button>
                </div>
                {result && (
                  <div className={cn('flex items-center gap-1.5 text-xs', result.success ? 'text-foreground' : 'text-destructive')}>
                    {result.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {result.message}
                  </div>
                )}
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                <CheckCircle2 className="h-3.5 w-3.5" /> Job completed and payment released
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
