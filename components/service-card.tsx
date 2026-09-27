'use client';

import { motion } from 'framer-motion';
import { Star, Clock, ShieldCheck, Zap, MapPin } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Service, Provider } from '@/lib/types';
import { formatPrice, haversineDistance } from '@/lib/data';
import { cn } from '@/lib/utils';

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
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-colors flex flex-col"
    >
      {service.image_url && (
        <div className="relative h-40 overflow-hidden bg-muted">
          <img
            src={service.image_url}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {availableProviders.length > 0 && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              {availableProviders.length} available
            </div>
          )}
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-secondary text-foreground/70 group-hover:bg-foreground group-hover:text-background transition-colors">
            <Icon className="h-4.5 w-4.5" />
          </div>
          {providers.some((p) => p.is_verified) && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified
            </span>
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
              : `${Math.floor(service.estimated_duration_mins / 60)}h${service.estimated_duration_mins % 60 > 0 ? ` ${service.estimated_duration_mins % 60}m` : ''}`}
          </span>
          {nearestDist !== null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {nearestDist < 1 ? `${Math.round(nearestDist * 1000)}m` : `${nearestDist.toFixed(1)}km`}
            </span>
          )}
          {providers.length > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-foreground/60 text-foreground/60" />
              {(providers.reduce((s, p) => s + p.rating, 0) / providers.length).toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-auto">
          <div className="flex items-end justify-between mb-3">
            <div>
              <span className="text-xl font-bold tracking-tight">{formatPrice(service.base_price)}</span>
              {service.pricing_type !== 'flat' && (
                <span className="text-sm text-muted-foreground ml-1">/{service.unit_label}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onBook(service)}
              className="flex-1 h-9 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
            >
              Book Now
            </button>
            {availableProviders.length > 0 && (
              <button
                onClick={() => onInstantWork(service)}
                className="h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1"
              >
                <Zap className="h-3.5 w-3.5" />
                Instant
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
