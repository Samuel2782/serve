'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Loader2, MapPin, Star, ShieldCheck, CheckCircle2, Navigation, X, Radio, Phone, Clock,
} from 'lucide-react';
import type { Service, Provider, InstantRequest } from '@/lib/types';
import {
  getCheckedInProviders, createInstantRequest, acceptInstantRequest,
  haversineDistance, formatPrice,
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

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!service) {
      setPhase('details'); setRequest(null); setAcceptedProvider(null);
      setBroadcastSeconds(0); setEta(0); setProviderProgress(0); setError('');
      clearTimers();
    }
  }, [service, clearTimers]);

  const pollRequest = async (id: string): Promise<InstantRequest | null> => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.from('instant_requests')
        .select('*, service:services(*), provider:providers(*)').eq('id', id).maybeSingle();
      return data;
    } catch { return null; }
  };

  const handleBroadcast = async () => {
    if (!service || !userLocation) return;
    if (!customerName.trim() || !customerPhone.trim()) { setError('Please fill in your name and phone number.'); return; }
    setError('');
    try {
      const req = await createInstantRequest({
        service_id: service.id, customer_name: customerName, customer_phone: customerPhone,
        customer_address: customerAddress || undefined,
        customer_latitude: userLocation.lat, customer_longitude: userLocation.lng,
      });
      setRequest(req); setPhase('broadcasting'); setBroadcastSeconds(0);
      broadcastRef.current = setInterval(() => setBroadcastSeconds((s) => s + 1), 1000);
      pollRef.current = setInterval(async () => {
        const updated = await pollRequest(req.id);
        if (updated && updated.status === 'accepted' && updated.provider_id) {
          const provider = nearbyProviders.find((p) => p.id === updated.provider_id);
          if (provider) { setAcceptedProvider(provider); setRequest(updated); setPhase('accepted'); clearTimers(); }
        }
      }, 2000);
      setTimeout(async () => {
        const current = await pollRequest(req.id);
        if (current && current.status === 'broadcasting') { setPhase('expired'); clearTimers(); }
      }, 30000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast request.');
    }
  };

  const handleAccept = async () => {
    if (!request || !acceptedProvider) return;
    setPhase('tracking');
    const dist = userLocation ? haversineDistance(acceptedProvider.latitude, acceptedProvider.longitude, userLocation.lat, userLocation.lng) : 2;
    const etaMin = Math.max(3, Math.round(dist * 3));
    setEta(etaMin); setProviderProgress(0);
    trackingRef.current = setInterval(() => {
      setProviderProgress((p) => {
        const next = p + 100 / (etaMin * 60 / 2);
        if (next >= 100) { clearTimers(); return 100; }
        return next;
      });
    }, 2000);
  };

  const handleComplete = () => {
    if (request && acceptedProvider) onAccepted(request, acceptedProvider);
    onClose();
  };

  if (!service) return null;

  return (
    <AnimatePresence>
      {service && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-2xl"
          >
            <div className="sticky top-0 bg-card/90 backdrop-blur px-6 py-4 border-b border-border z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <h2 className="text-lg font-bold editorial-heading">Instant Work</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Phase: Details */}
              {phase === 'details' && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-secondary border border-border p-3 text-sm">
                    <p className="flex items-start gap-2">
                      <Radio className="h-4 w-4 flex-shrink-0 mt-0.5 animate-pulse" />
                      <span>{nearbyProviders.length} verified providers within 3km. First to accept wins.</span>
                    </p>
                  </div>
                  {nearbyProviders.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {nearbyProviders.slice(0, 5).map((p) => (
                        <span key={p.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          {p.business_name || p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs editorial-tracking text-muted-foreground mb-1.5 block">Full Name</label>
                      <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Doe"
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs editorial-tracking text-muted-foreground mb-1.5 block">Phone Number</label>
                      <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+1-555-0100"
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs editorial-tracking text-muted-foreground mb-1.5 block">Current Address</label>
                      <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Where should the provider come?"
                        className="w-full h-11 px-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/30 transition-all" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Service fee (flat rate)</span>
                    <span className="font-bold text-lg">{formatPrice(service.base_price)}</span>
                  </div>
                  {error && <p className="text-sm text-destructive flex items-center gap-2"><X className="h-4 w-4" /> {error}</p>}
                  <button onClick={handleBroadcast} className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors flex items-center justify-center gap-2">
                    <Zap className="h-4 w-4" /> Broadcast to {nearbyProviders.length} Providers
                  </button>
                </div>
              )}

              {/* Phase: Broadcasting */}
              {phase === 'broadcasting' && (
                <div className="py-8 text-center space-y-6">
                  <div className="relative flex justify-center">
                    <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center">
                      <Radio className="h-10 w-10 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">Broadcasting...</h3>
                    <p className="text-sm text-muted-foreground">Waiting for a provider to accept</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-medium">{broadcastSeconds}s elapsed</span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-xs mx-auto">
                    {nearbyProviders.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-secondary text-xs">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        {p.business_name || p.name}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { clearTimers(); onClose(); }} className="text-sm text-muted-foreground hover:text-foreground">Cancel Request</button>
                </div>
              )}

              {/* Phase: Accepted */}
              {phase === 'accepted' && acceptedProvider && (
                <div className="py-6 text-center space-y-5">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">Provider Accepted!</h3>
                    <p className="text-sm text-muted-foreground">{acceptedProvider.business_name || acceptedProvider.name} is on the way</p>
                  </div>
                  <div className="rounded-xl border border-border p-4 text-left space-y-2 max-w-sm mx-auto">
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold">{acceptedProvider.name.charAt(0)}</div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{acceptedProvider.business_name || acceptedProvider.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-foreground/40 text-foreground/40" />
                          {acceptedProvider.rating.toFixed(1)}
                          {acceptedProvider.is_verified && <ShieldCheck className="h-3 w-3 text-foreground/60" />}
                        </div>
                      </div>
                      <button className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-secondary"><Phone className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Distance</span>
                      <span className="font-medium">{userLocation ? haversineDistance(acceptedProvider.latitude, acceptedProvider.longitude, userLocation.lat, userLocation.lng).toFixed(1) : '2.0'}km</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> ETA</span>
                      <span className="font-medium">~{Math.max(3, Math.round((userLocation ? haversineDistance(acceptedProvider.latitude, acceptedProvider.longitude, userLocation.lat, userLocation.lng) : 2) * 3))} min</span>
                    </div>
                  </div>
                  <button onClick={handleAccept} className="w-full max-w-sm h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
                    Start Live Tracking
                  </button>
                </div>
              )}

              {/* Phase: Tracking */}
              {phase === 'tracking' && acceptedProvider && (
                <div className="space-y-4">
                  <div className="relative h-48 rounded-xl overflow-hidden bg-secondary border border-border">
                    <LiveMap
                      providerLat={acceptedProvider.latitude} providerLng={acceptedProvider.longitude}
                      customerLat={userLocation?.lat || 0} customerLng={userLocation?.lng || 0}
                      progress={providerProgress}
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Provider en route</span>
                        <span className="font-medium">{Math.round(providerProgress)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-foreground rounded-full transition-all duration-500" style={{ width: `${providerProgress}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-5 w-5" />
                        <div>
                          <p className="text-sm font-medium">ETA</p>
                          <p className="text-xs text-muted-foreground">{providerProgress >= 100 ? 'Arrived!' : `${Math.max(1, Math.round((100 - providerProgress) / 100 * eta))} min`}</p>
                        </div>
                      </div>
                      <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', providerProgress >= 100 ? 'bg-foreground text-background' : 'bg-secondary')}>
                        {providerProgress >= 100 ? 'Arrived' : 'En Route'}
                      </span>
                    </div>
                  </div>
                  {providerProgress >= 100 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl bg-secondary border border-border p-4 text-center space-y-3"
                    >
                      <CheckCircle2 className="h-8 w-8 mx-auto" />
                      <p className="text-sm font-medium">Provider has arrived!</p>
                      <p className="text-xs text-muted-foreground">After the service is complete, share your OTP to release payment.</p>
                      <button onClick={handleComplete} className="w-full h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
                        Complete & Release Payment
                      </button>
                    </motion.div>
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
                    <p className="text-sm text-muted-foreground">No providers accepted within the time window.</p>
                  </div>
                  <button onClick={onClose} className="w-full max-w-xs mx-auto h-11 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors">
                    Try Again Later
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LiveMap({ providerLat, providerLng, customerLat, customerLng, progress }: {
  providerLat: number; providerLng: number; customerLat: number; customerLng: number; progress: number;
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
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }} />
      <svg className="absolute inset-0 w-full h-full">
        <line x1={px} y1={py} x2={cx} y2={cy} stroke="hsl(var(--foreground))" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
      </svg>
      <div className="absolute h-4 w-4 rounded-full bg-foreground border-2 border-background shadow-md transition-all duration-500"
        style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -50%)' }}>
        <div className="absolute inset-0 rounded-full bg-foreground animate-ping opacity-20" />
      </div>
      <div className="absolute h-4 w-4 rounded-full bg-destructive border-2 border-background shadow-md"
        style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }} />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-xs bg-card/80 backdrop-blur px-2 py-1 rounded">
        <span className="h-2 w-2 rounded-full bg-foreground" /> Provider
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs bg-card/80 backdrop-blur px-2 py-1 rounded">
        <span className="h-2 w-2 rounded-full bg-destructive" /> You
      </div>
    </div>
  );
}
