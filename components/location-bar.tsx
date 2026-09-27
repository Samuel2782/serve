'use client';

import { MapPin, Search, Navigation, Crosshair } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface UserLocation {
  lat: number;
  lng: number;
  locality: string;
}

interface LocationBarProps {
  location: UserLocation | null;
  onLocationChange: (location: UserLocation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const LOCALITIES = [
  { name: 'Downtown', lat: 12.9716, lng: 77.5946 },
  { name: 'Riverside', lat: 12.965, lng: 77.598 },
  { name: 'Northside', lat: 12.985, lng: 77.605 },
  { name: 'Eastgate', lat: 12.978, lng: 77.612 },
  { name: 'Westbrook', lat: 12.972, lng: 77.585 },
  { name: 'Midtown', lat: 12.968, lng: 77.602 },
];

export function detectLocation(): Promise<UserLocation> {
  return new Promise((resolve) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          let nearest = LOCALITIES[0];
          let minDist = Infinity;
          for (const loc of LOCALITIES) {
            const dist = Math.sqrt(
              Math.pow(loc.lat - latitude, 2) + Math.pow(loc.lng - longitude, 2),
            );
            if (dist < minDist) {
              minDist = dist;
              nearest = loc;
            }
          }
          resolve({ lat: nearest.lat, lng: nearest.lng, locality: nearest.name });
        },
        () => {
          resolve({ lat: LOCALITIES[0].lat, lng: LOCALITIES[0].lng, locality: LOCALITIES[0].name });
        },
        { timeout: 5000 },
      );
    } else {
      resolve({ lat: LOCALITIES[0].lat, lng: LOCALITIES[0].lng, locality: LOCALITIES[0].name });
    }
  });
}

export function LocationBar({ location, onLocationChange, searchQuery, onSearchChange }: LocationBarProps) {
  const [detecting, setDetecting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!location) {
      detectLocation().then(onLocationChange);
    }
  }, [location, onLocationChange]);

  const handleDetect = async () => {
    setDetecting(true);
    const loc = await detectLocation();
    onLocationChange(loc);
    setDetecting(false);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for services..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
        />
      </div>
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 h-11 px-4 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors w-full sm:w-auto"
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className="truncate">{location ? location.locality : 'Select area'}</span>
        </button>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden animate-slide-up">
              <button
                onClick={handleDetect}
                disabled={detecting}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 border-b border-border"
              >
                <Crosshair className={cn('h-4 w-4', detecting && 'animate-spin')} />
                {detecting ? 'Detecting...' : 'Use my location'}
              </button>
              {LOCALITIES.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => {
                    onLocationChange({ lat: loc.lat, lng: loc.lng, locality: loc.name });
                    setShowDropdown(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                >
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                  {loc.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
