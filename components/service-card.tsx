'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Clock, ShieldCheck, Zap, MapPin } from 'lucide-react';
import type { Service, Provider } from '@/lib/types';
import { formatPricingType, formatPrice, haversineDistance } from '@/lib/data';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  providers: Provider[];
  userLat?: number;
  userLng?: number;
  onBook: (service: Service) => void;
  onInstantWork: (service: Service) => void;
}

function getIcon(name: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Icon || Icons.Wrench;
}

export function ServiceCard({ service, providers, userLat, userLng, onBook, onInstantWork }: ServiceCardProps) {
  const Icon = getIcon(service.icon);
  const availableProviders = providers.filter((p) => p.is_checked_in && p.is_verified);
  const nearestDist = userLat && userLng && providers.length > 0
    ? Math.min(...providers.map((p) => haversineDistance(userLat, userLng, p.latitude, p.longitude)))
    : null;

  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
      <div className="relative p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Icon className="h-6 w-6" />
          </div>
          {availableProviders.length > 0 && (
            <Badge variant="secondary" className="bg-success/10 text-success border-0">
              <span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5 animate-pulse" />
              {availableProviders.length} available now
            </Badge>
          )}
        </div>

        <h3 className="font-semibold text-base leading-tight mb-1">{service.name}</h3>
        {service.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{service.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {service.estimated_duration_mins < 60
              ? `${service.estimated_duration_mins} min`
              : `${Math.floor(service.estimated_duration_mins / 60)}h ${service.estimated_duration_mins % 60 > 0 ? `${service.estimated_duration_mins % 60}m` : ''}`}
          </span>
          {nearestDist !== null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {nearestDist < 1 ? `${Math.round(nearestDist * 1000)}m` : `${nearestDist.toFixed(1)}km`}
            </span>
          )}
          {providers.some((p) => p.is_verified) && (
            <span className="flex items-center gap-1 text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          )}
        </div>

        <div className="mt-auto">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-2xl font-bold text-foreground">{formatPrice(service.base_price)}</span>
              {service.pricing_type !== 'flat' && (
                <span className="text-sm text-muted-foreground ml-1">/{service.unit_label}</span>
              )}
            </div>
            <div className="flex items-center gap-0.5 text-sm">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-medium">
                {providers.length > 0
                  ? (providers.reduce((s, p) => s + p.rating, 0) / providers.length).toFixed(1)
                  : 'New'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => onBook(service)} className="flex-1" size="sm">
              Book Now
            </Button>
            {availableProviders.length > 0 && (
              <Button
                onClick={() => onInstantWork(service)}
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary/5"
              >
                <Zap className="h-3.5 w-3.5 mr-1" />
                Instant
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
