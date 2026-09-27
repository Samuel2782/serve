'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap,
  Wrench,
  Sparkles,
  ShieldCheck,
  CreditCard,
  MapPin,
  TrendingUp,
  Users,
  Star,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LocationBar, detectLocation, type UserLocation } from '@/components/location-bar';
import { ServiceCard } from '@/components/service-card';
import { BookingModal } from '@/components/booking-modal';
import { InstantWorkModal } from '@/components/instant-work-modal';
import { BookingsList } from '@/components/bookings-list';
import type { Service, ServiceCategory, Provider, Booking, InstantRequest } from '@/lib/types';
import {
  getCategories,
  getAllServices,
  getProvidersForService,
} from '@/lib/data';
import { cn } from '@/lib/utils';

function getIcon(name: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Icon || Icons.Wrench;
}

export default function Home() {
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

  useEffect(() => {
    detectLocation().then(setLocation);
  }, []);

  useEffect(() => {
    getCategories().then(setCategories);
    getAllServices().then(setServices);
  }, []);

  useEffect(() => {
    if (services.length === 0) return;
    const loadProviders = async () => {
      const cache: Record<string, Provider[]> = {};
      for (const s of services) {
        cache[s.id] = await getProvidersForService(
          s.id,
          location?.lat,
          location?.lng,
          10,
        );
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

  const handleBookingConfirmed = useCallback((booking: Booking) => {
    setBookingService(null);
    setRefreshTrigger((r) => r + 1);
    setActiveTab('bookings');
  }, []);

  const handleInstantAccepted = useCallback((_request: InstantRequest, _provider: Provider) => {
    setRefreshTrigger((r) => r + 1);
    setActiveTab('bookings');
  }, []);

  const stats = [
    { icon: Users, label: 'Verified Providers', value: '10+' },
    { icon: Wrench, label: 'Services', value: '22+' },
    { icon: Star, label: 'Avg Rating', value: '4.7' },
    { icon: Zap, label: 'Instant Dispatch', value: '3km' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-none">VicinityServices</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5">Local services marketplace</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/provider', '_blank')}
              className="hidden sm:flex"
            >
              Provider Dashboard
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <LocationBar
            location={location}
            onLocationChange={setLocation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14 relative">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-primary/10 text-primary border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              100% upfront pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-balance mb-3">
              Book trusted local services with{' '}
              <span className="text-primary">transparent pricing</span> and{' '}
              <span className="text-accent">instant dispatch</span>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg mb-6">
              No blind quotes. No hidden fees. See exact prices, pick a time slot,
              and get matched with verified providers in your area.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border border-border bg-card p-3">
                    <Icon className="h-5 w-5 text-primary mb-2" />
                    <p className="font-bold text-lg leading-none">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="discover">
              <Wrench className="h-4 w-4 mr-1.5" />
              Discover Services
            </TabsTrigger>
            <TabsTrigger value="bookings">
              <Clock className="h-4 w-4 mr-1.5" />
              My Bookings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-6">
            {/* Category filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
                  !selectedCategory
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:border-primary/50',
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
                      selectedCategory === cat.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-success/10">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Verified Providers</p>
                  <p className="text-xs text-muted-foreground">Background-checked & rated</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Escrow Payments</p>
                  <p className="text-xs text-muted-foreground">Funds released on OTP confirm</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-warning/10">
                  <Zap className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Instant Work</p>
                  <p className="text-xs text-muted-foreground">On-demand dispatch in 3km</p>
                </div>
              </div>
            </div>

            {/* Service grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  {selectedCategory
                    ? categories.find((c) => c.id === selectedCategory)?.name
                    : 'All Services'}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {filteredServices.length} services available
                </span>
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
                      onBook={setBookingService}
                      onInstantWork={setInstantService}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">My Bookings</h3>
                <Badge variant="secondary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Escrow protected
                </Badge>
              </div>
              <BookingsList refreshTrigger={refreshTrigger} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>VicinityServices — Local services marketplace with transparent pricing.</p>
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
