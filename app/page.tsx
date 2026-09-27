'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, Wrench, ShieldCheck, CreditCard, Star, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LocationBar, detectLocation, type UserLocation } from '@/components/location-bar';
import { ServiceCard } from '@/components/service-card';
import { BookingModal } from '@/components/booking-modal';
import { InstantWorkModal } from '@/components/instant-work-modal';
import { BookingsList } from '@/components/bookings-list';
import { useAuth } from '@/lib/auth-context';
import type { Service, ServiceCategory, Provider, Booking, InstantRequest } from '@/lib/types';
import { getCategories, getAllServices, getProvidersForService } from '@/lib/data';
import { cn } from '@/lib/utils';

function getIcon(name: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Icon || Icons.Wrench;
}

export default function Home() {
  const { user, pendingAction, setPendingAction, setShowAuthModal } = useAuth();
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [providerCache, setProviderCache] = useState<Record<string, Provider[]>>({});
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [instantService, setInstantService] = useState<Service | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('discover');

  useEffect(() => { detectLocation().then(setLocation); }, []);
  useEffect(() => {
    getCategories().then(setCategories);
    getAllServices().then(setServices);
  }, []);

  useEffect(() => {
    if (services.length === 0) return;
    const loadProviders = async () => {
      const cache: Record<string, Provider[]> = {};
      for (const s of services) {
        cache[s.id] = await getProvidersForService(s.id, location?.lat, location?.lng, 10);
      }
      setProviderCache(cache);
    };
    loadProviders();
  }, [services, location]);

  const filteredServices = services.filter((s) => {
    if (selectedCategory && s.category_id !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleBook = useCallback((service: Service) => {
    if (!user) {
      setPendingAction({ type: 'booking', data: service });
      setShowAuthModal(true);
      return;
    }
    setBookingService(service);
  }, [user, setPendingAction, setShowAuthModal]);

  const handleInstantWork = useCallback((service: Service) => {
    if (!user) {
      setPendingAction({ type: 'instant', data: service });
      setShowAuthModal(true);
      return;
    }
    setInstantService(service);
  }, [user, setPendingAction, setShowAuthModal]);

  const handleBookingConfirmed = useCallback((booking: Booking) => {
    setBookingService(null);
    setRefreshTrigger((r) => r + 1);
    setActiveTab('bookings');
  }, []);

  const handleInstantAccepted = useCallback((_request: InstantRequest, _provider: Provider) => {
    setRefreshTrigger((r) => r + 1);
    setActiveTab('bookings');
  }, []);

  // After auth, resume pending action
  useEffect(() => {
    if (user && pendingAction) {
      if (pendingAction.type === 'booking') {
        setBookingService(pendingAction.data as Service);
      } else if (pendingAction.type === 'instant') {
        setInstantService(pendingAction.data as Service);
      }
      setPendingAction(null);
    }
  }, [user, pendingAction, setPendingAction]);

  const stats = [
    { label: 'Verified Providers', value: '10+' },
    { label: 'Services', value: '22+' },
    { label: 'Avg Rating', value: '4.7' },
    { label: 'Instant Dispatch', value: '3km' },
  ];

  const features = [
    { icon: ShieldCheck, title: 'Verified Providers', desc: 'Background-checked and rated by real customers.' },
    { icon: CreditCard, title: 'Escrow Payments', desc: 'Funds held securely and released only on OTP confirmation.' },
    { icon: Zap, title: 'Instant Work', desc: 'On-demand dispatch to nearby providers within a 3km radius.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-foreground text-background">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-none tracking-tight">Kehi</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5 editorial-tracking">Local Services</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <span className="text-xs text-muted-foreground hidden sm:block">{user.email}</span>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-sm font-medium px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                >
                  Sign in
                </button>
              )}
              <button
                onClick={() => window.open('/provider', '_blank')}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors hidden sm:flex items-center gap-1.5"
              >
                Provider <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <LocationBar
            location={location}
            onLocationChange={setLocation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </header>

      {/* Hero — Slateon editorial style */}
      <section className="slate-section border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <p className="text-xs editorial-tracking slate-muted mb-4">
              100% Upfront Pricing — Instant Dispatch — Escrow Protected
            </p>
            <h2 className="text-4xl sm:text-6xl font-bold editorial-heading slate-fg mb-4" style={{ color: 'hsl(var(--slate-fg))' }}>
              Book trusted local services with <span className="text-muted-foreground">transparent pricing.</span>
            </h2>
            <p className="text-base sm:text-lg slate-muted mb-8 max-w-xl">
              No blind quotes. No hidden fees. See exact prices, pick a time slot, and get matched with verified providers in your area.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-foreground/10 border border-foreground/10 rounded-xl overflow-hidden max-w-2xl">
              {stats.map((stat) => (
                <div key={stat.label} className="slate-card p-4">
                  <p className="text-2xl font-bold editorial-heading" style={{ color: 'hsl(var(--slate-fg))' }}>{stat.value}</p>
                  <p className="text-xs slate-muted mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature cards — Slateon multi-column */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card p-6"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-secondary mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab switch */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('discover')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'discover' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Wrench className="h-4 w-4" /> Discover Services
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'bookings' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <CheckCircle2 className="h-4 w-4" /> My Bookings
          </button>
        </div>

        {activeTab === 'discover' && (
          <div className="space-y-6">
            {/* Category filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
                  !selectedCategory ? 'bg-foreground text-background border-foreground' : 'bg-card border-border hover:border-foreground/30',
                )}
              >
                All Services
              </button>
              {categories.map((cat) => {
                const Icon = getIcon(cat.icon);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
                      selectedCategory === cat.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border hover:border-foreground/30',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Service grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  {selectedCategory ? categories.find((c) => c.id === selectedCategory)?.name : 'All Services'}
                </h3>
                <span className="text-sm text-muted-foreground">{filteredServices.length} services</span>
              </div>
              {filteredServices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wrench className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No services match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      providers={providerCache[service.id] || []}
                      userLat={location?.lat}
                      userLng={location?.lng}
                      onBook={handleBook}
                      onInstantWork={handleInstantWork}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">My Bookings</h3>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Escrow protected
              </span>
            </div>
            <BookingsList refreshTrigger={refreshTrigger} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-muted-foreground">
          <p className="editorial-tracking">Kehi — Local Services Marketplace</p>
        </div>
      </footer>

      {/* Modals */}
      <BookingModal
        service={bookingService}
        userLocation={location}
        onClose={() => setBookingService(null)}
        onBookingConfirmed={handleBookingConfirmed}
      />
      <InstantWorkModal
        service={instantService}
        userLocation={location}
        onClose={() => setInstantService(null)}
        onAccepted={handleInstantAccepted}
      />
    </div>
  );
}
