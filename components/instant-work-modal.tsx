'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Zap,
  Loader2,
  MapPin,
  Star,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  X,
  Radio,
  Phone,
  Clock,
} from 'lucide-react';
import type { Service, Provider, InstantRequest } from '@/lib/types';
import {
  getCheckedInProviders,
  createInstantRequest,
  acceptInstantRequest,
  haversineDistance,
  formatPrice,
  formatTime,
} from '@/lib/data';
import { cn } from '@/lib/utils';
import type { UserLocation } from './location-bar';

interface InstantWorkModalProps {
  service: Service | null;
  userLocation: UserLocation | null;
  onClose: () => void;
  onAccepted: (request: InstantRequest, provider: Provider) => void;
}

type Phase = 'details' | 'broadcasting' | 'accepted' | 'tracking' | 'expired';

export function InstantWorkModal({ service, userLocation, onClose, onAccepted }: InstantWorkModalProps) {
  const [phase, setPhase] = useState<Phase>('details');
  const [nearbyProviders, setNearbyProviders] = useState<Provider[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [request, setRequest] = useState<InstantRequest | null>(null);
  const [acceptedProvider, setAcceptedProvider] = useState<Provider | null>(null);
  const [broadcastSeconds, setBroadcastSeconds] = useState(0);
  const [eta, setEta] = useState(0);
  const [providerProgress, setProviderProgress] = useState(0);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (service && userLocation) {
      getCheckedInProviders(service.id, userLocation.lat, userLocation.lng, 3).then(setNearbyProviders);
    }
  }, [service, userLocation]);

  const clearTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (broadcastRef.current) clearInterval(broadcastRef.current);
    if (trackingRef.current) clearInterval(trackingRef.current);
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    if (!service) {
      setPhase('details');
      setRequest(null);
      setAcceptedProvider(null);
      setBroadcastSeconds(0);
      setEta(0);
      setProviderProgress(0);
      setError('');
      clearTimers();
    }
  }, [service, clearTimers]);

  const handleBroadcast = async () => {
    if (!service || !userLocation) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Please fill in your name and phone number.');
      return;
    }
    setError('');
    try {
      const req = await createInstantRequest({
        service_id: service.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress || undefined,
        customer_latitude: userLocation.lat,
        customer_longitude: userLocation.lng,
      });
      setRequest(req);
      setPhase('broadcasting');
      setBroadcastSeconds(0);

      broadcastRef.current = setInterval(() => {
        setBroadcastSeconds((s) => s + 1);
      }, 1000);

      pollRef.current = setInterval(async () => {
        const updated = await pollRequest(req.id);
        if (updated && updated.status === 'accepted' && updated.provider_id) {
          const provider = nearbyProviders.find((p) => p.id === updated.provider_id);
          if (provider) {
            setAcceptedProvider(provider);
            setRequest(updated);
            setPhase('accepted');
            clearTimers();
          }
        }
      }, 2000);

      setTimeout(async () => {
        const current = await pollRequest(req.id);
        if (current && current.status === 'broadcasting') {
          setPhase('expired');
          clearTimers();
        }
      }, 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast request.');
    }
  };

  const pollRequest = async (id: string): Promise<InstantRequest | null> => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('instant_requests')
        .select('*, service:services(*), provider:providers(*)')
        .eq('id', id)
        .maybeSingle();
      return data;
    } catch {
      return null;
    }
  };

  const handleAccept = async () => {
    if (!request || !acceptedProvider) return;
    setPhase('tracking');
    const dist = userLocation
      ? haversineDistance(acceptedProvider.latitude, acceptedProvider.longitude, userLocation.lat, userLocation.lng)
      : 2;
    const etaMin = Math.max(3, Math.round(dist * 3));
    setEta(etaMin);
    setProviderProgress(0);

    trackingRef.current = setInterval(() => {
      setProviderProgress((p) => {
        const next = p + 100 / (etaMin * 60 / 2);
        if (next >= 100) {
          clearTimers();
          return 100;
        }
        return next;
      });
    }, 2000);
  };

  const handleComplete = () => {
    if (request && acceptedProvider) {
      onAccepted(request, acceptedProvider);
    }
    onClose();
  };

  if (!service) return null;

  return (
    <Dialog open={!!service} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-warning fill-warning" />
            Instant Work
          </DialogTitle>
          <DialogDescription>
            Lightning booking — broadcast to nearby providers instantly.
          </DialogDescription>
        </DialogHeader>

        {/* Phase: Details */}
        {phase === 'details' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-sm">
              <p className="flex items-start gap-2">
                <Radio className="h-4 w-4 text-warning flex-shrink-0 mt-0.5 animate-pulse" />
                <span>
                  {nearbyProviders.length} verified providers checked in within 3km.
                  The first to accept wins the job.
                </span>
              </p>
            </div>

            {nearbyProviders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nearbyProviders.slice(0, 5).map((p) => (
                  <Badge key={p.id} variant="secondary" className="gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    {p.business_name || p.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="inst-name" className="mb-1.5">Full Name</Label>
                <Input
                  id="inst-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="inst-phone" className="mb-1.5">Phone Number</Label>
                <Input
                  id="inst-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1-555-0100"
                />
              </div>
              <div>
                <Label htmlFor="inst-addr" className="mb-1.5">Current Address</Label>
                <Input
                  id="inst-addr"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Where should the provider come?"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Service fee (flat rate)</span>
              <span className="font-bold text-lg text-primary">{formatPrice(service.base_price)}</span>
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <X className="h-4 w-4" /> {error}
              </p>
            )}

            <Button onClick={handleBroadcast} className="w-full" size="lg">
              <Zap className="h-4 w-4 mr-2" />
              Broadcast to {nearbyProviders.length} Providers
            </Button>
          </div>
        )}

        {/* Phase: Broadcasting */}
        {phase === 'broadcasting' && (
          <div className="py-8 text-center space-y-6">
            <div className="relative flex justify-center">
              <div className="h-24 w-24 rounded-full bg-warning/10 flex items-center justify-center animate-pulse-ring">
                <Radio className="h-10 w-10 text-warning animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">Broadcasting to nearby providers...</h3>
              <p className="text-sm text-muted-foreground">
                Waiting for a provider to accept your request
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-medium">{broadcastSeconds}s elapsed</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs mx-auto">
              {nearbyProviders.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-xs">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  {p.business_name || p.name}
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => { clearTimers(); onClose(); }}>
              Cancel Request
            </Button>
          </div>
        )}

        {/* Phase: Accepted */}
        {phase === 'accepted' && acceptedProvider && (
          <div className="py-6 text-center space-y-5">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">Provider Accepted!</h3>
              <p className="text-sm text-muted-foreground">{acceptedProvider.business_name || acceptedProvider.name} is on the way</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-left space-y-2 max-w-sm mx-auto">
              <div className="flex items-center gap-3 pb-2 border-b border-border">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {acceptedProvider.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{acceptedProvider.business_name || acceptedProvider.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {acceptedProvider.rating.toFixed(1)}
                    {acceptedProvider.is_verified && <ShieldCheck className="h-3 w-3 text-success" />}
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Distance
                </span>
                <span className="font-medium">
                  {userLocation ? haversineDistance(acceptedProvider.latitude, acceptedProvider.longitude, userLocation.lat, userLocation.lng).toFixed(1) : '2.0'}km
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3.5 w-3.5" /> ETA
                </span>
                <span className="font-medium">~{Math.max(3, Math.round((userLocation ? haversineDistance(acceptedProvider.latitude, acceptedProvider.longitude, userLocation.lat, userLocation.lng) : 2) * 3))} min</span>
              </div>
            </div>
            <Button onClick={handleAccept} className="w-full max-w-sm">
              Start Live Tracking
            </Button>
          </div>
        )}

        {/* Phase: Tracking */}
        {phase === 'tracking' && acceptedProvider && (
          <div className="space-y-4">
            <div className="relative h-48 rounded-lg overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 border border-border">
              <LiveMap
                providerLat={acceptedProvider.latitude}
                providerLng={acceptedProvider.longitude}
                customerLat={userLocation?.lat || 0}
                customerLng={userLocation?.lng || 0}
                progress={providerProgress}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Provider en route</span>
                  <span className="font-medium">{Math.round(providerProgress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${providerProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">ETA</p>
                    <p className="text-xs text-muted-foreground">
                      {providerProgress >= 100 ? 'Arrived!' : `${Math.max(1, Math.round((100 - providerProgress) / 100 * eta))} min`}
                    </p>
                  </div>
                </div>
                <Badge className={providerProgress >= 100 ? 'bg-success' : 'bg-warning'}>
                  {providerProgress >= 100 ? 'Arrived' : 'En Route'}
                </Badge>
              </div>
            </div>

            {providerProgress >= 100 && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-center space-y-3 animate-fade-in">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                <p className="text-sm font-medium">Provider has arrived at your location!</p>
                <p className="text-xs text-muted-foreground">
                  After the service is complete, share your OTP to release payment.
                </p>
                <Button onClick={handleComplete} className="w-full">
                  Complete & Release Payment
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Phase: Expired */}
        {phase === 'expired' && (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">No providers available</h3>
              <p className="text-sm text-muted-foreground">
                No providers accepted your request within the time window.
              </p>
            </div>
            <Button onClick={onClose} className="w-full max-w-xs mx-auto">
              Try Again Later
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LiveMap({
  providerLat,
  providerLng,
  customerLat,
  customerLng,
  progress,
}: {
  providerLat: number;
  providerLng: number;
  customerLat: number;
  customerLng: number;
  progress: number;
}) {
  const t = progress / 100;
  const currentLat = providerLat + (customerLat - providerLat) * t;
  const currentLng = providerLng + (customerLng - providerLng) * t;

  const toX = (lng: number) => ((lng - Math.min(providerLng, customerLng) + 0.005) / 0.01) * 100;
  const toY = (lat: number) => 100 - ((lat - Math.min(providerLat, customerLat) + 0.005) / 0.01) * 100;

  const px = Math.max(5, Math.min(95, toX(currentLng)));
  const py = Math.max(5, Math.min(95, toY(currentLat)));
  const cx = Math.max(5, Math.min(95, toX(customerLng)));
  const cy = Math.max(5, Math.min(95, toY(customerLat)));

  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />
      <svg className="absolute inset-0 w-full h-full">
        <line
          x1={px}
          y1={py}
          x2={cx}
          y2={cy}
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity="0.4"
        />
      </svg>
      <div
        className="absolute h-4 w-4 rounded-full bg-primary border-2 border-white shadow-md transition-all duration-500"
        style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -50%)' }}
      >
        <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
      </div>
      <div
        className="absolute h-4 w-4 rounded-full bg-destructive border-2 border-white shadow-md"
        style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-xs bg-card/80 backdrop-blur px-2 py-1 rounded">
        <span className="h-2 w-2 rounded-full bg-primary" /> Provider
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs bg-card/80 backdrop-blur px-2 py-1 rounded">
        <span className="h-2 w-2 rounded-full bg-destructive" /> You
      </div>
    </div>
  );
}
