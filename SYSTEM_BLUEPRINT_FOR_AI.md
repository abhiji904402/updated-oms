# BROOMIES OMS - SYSTEM BLUEPRINT & ARCHITECTURE DIRECTORY

This document serves as the core reference for the Broomies Order Management System (OMS).
Always review this alongside `/src/lib/safetyGuards.ts` to ensure 0-error runtime stability.

---

## 1. System Overview
- **Product**: Broomies Bakery Order Management System (OMS)
- **Stack**: React 18, Vite, TypeScript, Tailwind CSS, Firebase Firestore (`broomies-v2`), IndexedDB, Recharts.
- **Roles**:
  - `admin`: Central Admin Dashboard (Full system control, rider tracking, password management, sync logs).
  - `outlet`: Dark store manager (Sector 31, Sector 15, Sector 46, Sector 21).
  - `delivery` / `rider`: Delivery partner portal (photo proof, OTP, GPS updates).

---

## 2. Safety Guards & Crash Prevention
- All page views inside `src/App.tsx` are wrapped with `<SafeErrorBoundary>` and `<Suspense fallback={<PageFallback />}>`.
- Root level errors are trapped by `<RootErrorBoundary>` in `src/main.tsx`.
- Data hydrated from `IndexedDB` and `localStorage` is validated via `src/lib/safetyGuards.ts`.
