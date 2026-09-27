# Kehi — Local Services Marketplace

A premium local services booking platform with upfront pricing, escrow-protected payments, instant work dispatch, and real-time provider tracking. Built with Next.js, Firebase, and Framer Motion.

## What This App Does

Kehi connects customers with verified local service providers (plumbers, electricians, cleaners, etc.) through two flows:

1. **Scheduled Booking** — Browse services, pick a provider, choose a date/time slot, pay into escrow, and receive an OTP. The provider completes the job, customer shares the OTP, and payment is released.

2. **Instant Work** — Broadcast an urgent request to all checked-in providers within 3km. First provider to accept gets the job. Customer tracks the provider's arrival in real time on a live map.

### Explore First, Authenticate Later

The entire marketplace (browsing services, filtering categories, viewing provider rates) is public — no login required. Authentication is only prompted when a user tries to book or broadcast an instant request. After signing in, the pending action resumes automatically.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 13.5 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + CSS variables (Slateon-inspired editorial theme) |
| Animations | Framer Motion (scroll-driven entries, hover lifts, modal transitions) |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore (real-time via `onSnapshot`) |
| Icons | Lucide React |
| UI Components | shadcn/ui (Radix primitives) |
| Fonts | Inter (Google Fonts) |

## Project Structure

```
app/
  layout.tsx          Root layout — wraps app in AuthProvider, renders AuthModal
  page.tsx            Customer homepage — hero, service grid, bookings tab
  provider/page.tsx   Provider dashboard — bookings, instant requests, availability
  globals.css         Theme variables (slate/charcoal/off-white palette)

components/
  auth-modal.tsx          Firebase auth modal (sign in / sign up)
  booking-modal.tsx       5-step booking flow (provider → schedule → details → payment → confirm)
  instant-work-modal.tsx  Instant dispatch flow (broadcast → accept → live tracking)
  service-card.tsx        Service card with image, pricing, provider count
  bookings-list.tsx       Customer's booking history with OTP verification
  location-bar.tsx        Locality selector + search bar
  ui/                     shadcn/ui component library

lib/
  firebase.ts         Firebase initialization (reads env vars)
  auth-context.tsx    React context for Firebase Auth state
  data.ts             All Firestore reads, writes, and real-time listeners
  types.ts            TypeScript interfaces for all data models
  utils.ts             Tailwind class merge utility
```

## Firestore Collections

| Collection | Purpose | Access |
|-----------|---------|--------|
| `service_categories` | Service categories (AC, Plumbing, etc.) | Public read |
| `services` | Individual services with pricing | Public read |
| `providers` | Provider profiles with location/rating | Public read |
| `provider_services` | Maps providers to services they offer | Public read |
| `provider_availability` | Weekly availability schedule | Public read |
| `bookings` | Customer bookings with OTP and escrow | Auth required to write |
| `transactions` | Payment records (held/released) | Auth required |
| `instant_requests` | Real-time instant work dispatch | Auth required to write |
| `reviews` | Customer reviews for providers | Public read |

## Setup Guide

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Enable **Authentication** → Sign-in method → **Email/Password**
4. Enable **Cloud Firestore** → Start in **test mode** (or production mode with rules below)
5. Go to Project Settings → General → Your apps → Web app
6. Register a web app and copy the config values

### 3. Add Environment Variables

Create or update `.env` with your Firebase credentials:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 4. Set Firestore Security Rules

In the Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /service_categories/{doc} { allow read: if true; }
    match /services/{doc} { allow read: if true; }
    match /providers/{doc} { allow read: if true; }
    match /provider_services/{doc} { allow read: if true; }
    match /provider_availability/{doc} { allow read: if true; write: if request.auth != null; }
    match /reviews/{doc} { allow read: if true; allow create: if request.auth != null; }

    match /bookings/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /transactions/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /instant_requests/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```

### 5. Seed the Database

Add initial data to Firestore. You can do this via the Firebase Console or a script. The collections needed are:

- `service_categories`: `{ name, slug, icon, description, display_order, image_url, created_at }`
- `services`: `{ category_id, name, slug, description, pricing_type, base_price, unit_label, estimated_duration_mins, icon, image_url, is_active, created_at }`
- `providers`: `{ name, business_name, latitude, longitude, address, locality, city, service_radius_km, is_verified, is_checked_in, rating, total_reviews, total_jobs, created_at }`
- `provider_services`: `{ provider_id, service_id, custom_price }`
- `provider_availability`: `{ provider_id, day_of_week, start_time, end_time, max_simultaneous_jobs }`

The `icon` field stores a Lucide React icon name (e.g., `"Wind"`, `"Droplets"`, `"Zap"`).

### 6. Run the App

```bash
npm run dev
```

Visit `http://localhost:3000` for the customer app and `http://localhost:3000/provider` for the provider dashboard.

## Build

```bash
npm run build
```

## Key Features

- **Upfront Pricing**: Every service shows its exact price. No quotes, no haggling.
- **Escrow Payments**: Payment is held when booking is created and only released when the customer shares their 4-digit OTP after job completion.
- **Instant Work Dispatch**: Real-time broadcast to nearby providers using Firestore `onSnapshot` listeners. First to accept wins.
- **Live Tracking**: Animated map showing the provider's position interpolating toward the customer's location.
- **Explore-First Auth**: Browse everything without an account. Auth is only triggered on booking/instant actions and resumes the pending action after login.
- **Slateon Design**: Deep charcoal hero sections, off-white content areas, fine borders instead of heavy shadows, editorial letter-spacing, and Framer Motion scroll-driven animations.

## Design System

The theme uses CSS custom properties defined in `app/globals.css`:

- **Background**: Crisp off-white (`0 0% 100%`)
- **Foreground**: Deep slate (`210 20% 12%`)
- **Slate section**: Dark charcoal hero (`210 20% 12%` background with `210 10% 88%` text)
- **Borders**: Fine `border-slate-200` / `border-zinc-800` style — no box shadows for sectioning
- **Typography**: Inter font, `-0.03em` letter-spacing on headings, `0.12em` uppercase tracking on labels
- **Animations**: Framer Motion `whileInView` for scroll entries, `whileHover={{ y: -4 }}` for card lifts
