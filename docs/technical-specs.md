# Merlux Chauffeur Services - Technical Documentation

## 1. Database Schema (Firestore)

### Collection: `bookings`
- `id`: string (auto-generated)
- `userId`: string (ref: users.id)
- `serviceType`: enum ('airport', 'corporate', 'wedding', 'tour', 'hourly')
- `pickup`: string (address)
- `dropoff`: string (address)
- `date`: timestamp
- `time`: string
- `vehicleId`: string (ref: fleet.id)
- `passengers`: number
- `flightNumber`: string (optional)
- `status`: enum ('pending', 'confirmed', 'in-progress', 'completed', 'cancelled')
- `price`: number
- `paymentStatus`: enum ('unpaid', 'paid', 'refunded')
- `driverId`: string (ref: drivers.id, optional)
- `createdAt`: timestamp

### Collection: `users`
- `id`: string (UID from Firebase Auth)
- `name`: string
- `email`: string
- `phone`: string
- `role`: enum ('customer', 'driver', 'admin')
- `createdAt`: timestamp

### Collection: `fleet`
- `id`: string
- `name`: string
- `model`: string
- `pax`: number
- `bags`: number
- `basePrice`: number
- `pricePerKm`: number

## 2. API Structure (Express/Firebase Functions)

### Auth
- `POST /api/auth/register`: Create new user
- `POST /api/auth/login`: Authenticate user

### Bookings
- `GET /api/bookings`: List user bookings
- `POST /api/bookings`: Create new booking
- `GET /api/bookings/:id`: Get booking details
- `PATCH /api/bookings/:id`: Update booking status (Admin/Driver)

### Payments (Stripe)
- `POST /api/payments/create-intent`: Create Stripe Payment Intent
- `POST /api/payments/webhook`: Handle Stripe webhooks

## 3. SEO Strategy

### Keywords
- Primary: "Melbourne Airport Transfer", "Luxury Chauffeur Melbourne", "Private Car Hire Melbourne"
- Secondary: "Chauffeur Great Ocean Road", "Yarra Valley Wine Tour Chauffeur", "Corporate Chauffeur Service Melbourne"

### Blog Topics
1. "Top 5 Reasons to Hire a Chauffeur for Melbourne Airport Transfers"
2. "How to Plan the Perfect Yarra Valley Wine Tour with a Private Driver"
3. "The Ultimate Guide to Luxury Wedding Transport in Melbourne"
4. "Business Travel Hacks: Why Chauffeurs Beat Ride-Sharing for Executives"
5. "Exploring the Great Ocean Road: A Luxury Private Tour Itinerary"

## 4. Admin Dashboard Structure
- **Overview**: Revenue charts, active bookings, driver status.
- **Bookings Management**: List, filter, assign drivers, cancel/refund.
- **Driver Management**: Onboarding, earnings, performance ratings.
- **Fleet Management**: Add/edit vehicles, maintenance logs.
- **Pricing Engine**: Dynamic surge pricing, suburb-based rates.

# Technical Specifications & Dashboard Access

## Dashboard Access Details
- **URL**: `/app`
- **Access**: Requires authentication via Firebase Auth.
- **Features**:
  - View active bookings.
  - Track chauffeur (simulated).
  - View recent ride history.
  - Quick actions for Airport, Hourly, VIP, and History.

## Temporary Dev Credentials
- **Email**: `dev@merlux.com`
- **Password**: `Merlux2026!`
- **Important**: If you see "Email already in use", it means the account is already created. Please switch to the **Login** tab (click "Login Here" at the bottom) and use these credentials to sign in.

## Admin Access Credentials
- **Email**: `admin@merlux.com.au`
- **Password**: `12345678`
- *Note: This account has admin privileges in Firestore.*

## Steps for Access
1. Navigate to the homepage.
2. Click on the user icon or "Login" in the navigation bar.
3. Sign in using Google or the dev email credentials above.
4. Once authenticated, you will be redirected to the dashboard or can access it via the user icon in the navbar.

## Technical Notes
- **Frontend**: React with Vite, Tailwind CSS, Framer Motion (motion/react).
- **Backend**: Firebase (Firestore, Auth).
- **Maps**: Google Maps API for route visualization and autocomplete.
- **Flight Tracking**: Simulated flight status service.

## Mandatory Firebase Console Setup
To fix `auth/operation-not-allowed` errors, ensure the following are configured in the Firebase Console:
1. **Enable Sign-in Providers**:
   - Go to **Authentication > Sign-in method**.
   - Enable **Email/Password**.
   - Enable **Google**.
2. **Add Authorized Domains**:
   - Go to **Authentication > Settings > Authorized domains**.
   - Add your App URL and Shared App URL to the list.
