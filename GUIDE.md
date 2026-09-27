# Kehi — Developer Guide for Future Changes

This document explains the architecture, data flow, and common modification patterns so you can extend the platform confidently.

---

## Architecture Overview

```
Browser (React Client)
  ├── Firebase Auth (email/password)
  ├── Firestore (real-time reads via onSnapshot)
  └── No server-side API routes — everything runs client-side
```

The app is a pure client-side SPA built on Next.js App Router. There are no API routes or server-side data fetching. All database reads and writes go directly from the browser to Firebase using the Firebase Client SDK.

---

## Data Flow

### 1. App Initialization (`app/layout.tsx`)

The root layout wraps the entire app in `AuthProvider` and renders a single global `AuthModal`. This means:
- Auth state is available everywhere via `useAuth()`
- The auth modal can be triggered from any component without importing it

### 2. Customer Homepage (`app/page.tsx`)

```
Home component
  ├── useAuth() → gets user, pendingAction
  ├── Loads categories + services from Firestore (on mount)
  ├── Loads providers for each service (cached in providerCache)
  ├── Renders LocationBar → search + locality filter
  ├── Renders ServiceCard grid → each card shows image, price, availability
  ├── handleBook(service) → if not logged in, sets pendingAction + shows auth modal
  ├── handleInstantWork(service) → same auth interception
  └── After auth → useEffect resumes pendingAction automatically
```

### 3. Booking Flow (`components/booking-modal.tsx`)

5-step wizard:
1. **Provider** — Fetches providers for the service, filtered by distance
2. **Schedule** — Loads provider availability + existing bookings, generates time slots
3. **Details** — Collects customer name, phone, address
4. **Payment** — Shows pricing breakdown (base + 10% platform fee), creates booking + transaction
5. **Confirm** — Shows OTP code, booking summary

When a booking is created (`createBooking` in `lib/data.ts`):
- A document is added to `bookings` collection with status `confirmed`
- A matching `transactions` document is created with status `held`
- A 4-digit OTP is generated and stored on the booking

### 4. Instant Work Flow (`components/instant-work-modal.tsx`)

```
Details → user enters name/phone/address
  ↓
Broadcasting → creates instant_requests doc with status "broadcasting"
  ↓            polls the doc every 2s for status change
  ↓
Accepted → provider accepts (status changes to "accepted")
  ↓
Tracking → animated map shows provider moving toward customer
  ↓
Complete → customer releases payment
```

### 5. Provider Dashboard (`app/provider/page.tsx`)

- Selects a provider from dropdown
- Shows stats (rating, jobs, earnings, active bookings)
- **Bookings tab**: Lists all bookings, allows OTP verification to release payment
- **Instant Work tab**: Polls for broadcasting instant requests every 3s, allows accept
- **Availability tab**: Weekly schedule editor (toggle days, set hours, max jobs)

---

## How to Make Common Changes

### Add a New Service Category

1. Add a document to `service_categories` in Firestore:
   ```
   { name: "Gardening", slug: "gardening", icon: "Flower", description: "...", display_order: 9, image_url: "https://..." }
   ```
2. The icon field must match a Lucide React icon name (see https://lucide.dev/icons)
3. It will automatically appear in the category filter bar on the homepage

### Add a New Service

1. Add a document to `services`:
   ```
   { category_id: "<category-doc-id>", name: "Lawn Mowing", slug: "lawn-mowing",
     description: "...", pricing_type: "flat", base_price: 40, unit_label: null,
     estimated_duration_mins: 60, icon: "Scissors", image_url: "https://...", is_active: true }
   ```
2. `pricing_type` can be `"flat"`, `"hourly"`, or `"unit"`
3. For hourly/unit, set `unit_label` (e.g., `"hour"`, `"room"`)

### Add a New Provider

1. Add a document to `providers`:
   ```
   { name: "John Smith", business_name: "Smith Plumbing", latitude: 12.9716, longitude: 77.5946,
     address: "...", locality: "Downtown", city: "Bangalore", service_radius_km: 5,
     is_verified: true, is_checked_in: false, rating: 4.5, total_reviews: 10, total_jobs: 25 }
   ```
2. Link them to services via `provider_services`:
   ```
   { provider_id: "<provider-doc-id>", service_id: "<service-doc-id>", custom_price: null }
   ```
3. Add their weekly schedule to `provider_availability`:
   ```
   { provider_id: "...", day_of_week: 1, start_time: "09:00", end_time: "17:00", max_simultaneous_jobs: 1 }
   ```
   (`day_of_week`: 0=Sunday, 1=Monday, ... 6=Saturday)

### Change the Theme Colors

All colors are CSS variables in `app/globals.css`:

```css
:root {
  --background: 0 0% 100%;        /* main background */
  --foreground: 210 20% 12%;      /* main text */
  --primary: 210 20% 12%;          /* buttons, active states */
  --border: 210 16% 90%;           /* card borders */
  --slate-bg: 210 20% 12%;         /* dark hero section */
  --slate-fg: 210 10% 88%;         /* text on dark section */
}
```

Change these HSL values and the entire app updates.

### Change the Platform Fee

In `lib/data.ts`, function `calculatePricing`:
```typescript
const platformFee = Math.round(subtotal * 0.1 * 100) / 100;  // 0.1 = 10%
```
Change `0.1` to your desired fee rate.

### Change the Instant Work Radius

In `lib/data.ts`, function `getCheckedInProviders`:
```typescript
radiusKm: number = 3  // change this default
```
Also in `app/page.tsx` the `getCheckedInProviders` call passes `3` as the last argument.

### Change the Broadcast Timeout

In `components/instant-work-modal.tsx`:
```typescript
setTimeout(async () => {
  // expires after 30 seconds — change 30000 to adjust
}, 30000);
```

### Add Google Sign-In

1. In Firebase Console → Authentication → Sign-in method → enable Google
2. In `components/auth-modal.tsx`, add a Google button:
```typescript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const handleGoogle = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};
```

### Replace Placeholder Images

Service images are stored in the `image_url` field on each `services` and `service_categories` document. Update these in Firestore directly — the UI reads them automatically. Current images are from Pexels (license-free stock photos).

### Add Real-Time Provider Location Tracking

The app already has `onSnapshot` listeners in `lib/data.ts`:
- `onInstantRequestSnapshot` — watch a single instant request
- `onActiveInstantRequests` — watch all broadcasting requests
- `onProviderBookings` — watch a provider's bookings in real time

To add live provider GPS tracking, write to the provider's document:
```typescript
await updateDoc(doc(db, 'providers', providerId), {
  provider_latitude: newLat,
  provider_longitude: newLng,
});
```
Then use `onSnapshot` on the provider doc to animate the map.

---

## File Responsibilities

| File | What It Does | When to Edit |
|------|-------------|-------------|
| `lib/firebase.ts` | Initializes Firebase with env vars | Only if adding Storage/Messaging |
| `lib/auth-context.tsx` | React context wrapping Firebase Auth | Adding auth methods, changing user state shape |
| `lib/data.ts` | ALL Firestore reads/writes + utilities | Adding queries, changing pricing, adding collections |
| `lib/types.ts` | TypeScript interfaces for all data | When Firestore schema changes |
| `app/page.tsx` | Customer homepage | Changing layout, adding sections |
| `app/provider/page.tsx` | Provider dashboard | Changing provider tools |
| `components/booking-modal.tsx` | 5-step booking wizard | Changing booking steps/flow |
| `components/instant-work-modal.tsx` | Instant dispatch + tracking | Changing broadcast/tracking behavior |
| `components/auth-modal.tsx` | Sign in / sign up UI | Adding social login, changing design |
| `components/service-card.tsx` | Service card in grid | Changing card layout/info |
| `app/globals.css` | Theme variables + utilities | Changing colors, fonts, effects |

---

## Remaining Migration Steps

The Firebase migration is set up but needs your credentials to go live:

1. **Add Firebase env vars** to `.env` (the 6 `NEXT_PUBLIC_FIREBASE_*` variables)
2. **Enable Email/Password auth** in Firebase Console
3. **Create Firestore database** and apply the security rules from README
4. **Seed data** — copy the data from the existing Supabase database into Firestore collections (the collection names match exactly)
5. **Test** — run `npm run dev` and verify browsing works without auth, booking triggers auth modal

The old Supabase files (`lib/supabase.ts`, `supabase/` directory) can be deleted once Firebase is confirmed working. They are not imported anywhere in the current code.
