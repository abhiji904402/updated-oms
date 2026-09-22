# BROOMIES OMS - CODE ARCHITECTURE & FEATURE LIBRARY

Welcome to the **Broomies OMS Architecture Library**. This document provides an exhaustive, code-level blueprint of the application so that any developer or AI coding agent can immediately understand, trace, and modify any feature by reading the exact lines and module boundaries.

---

## 1. System High-Level Topology

```
[ Client Browser ]
  ├── 0ms Hydration: localStorage (stripped) + IndexedDB (idb.ts)
  ├── Global Context: OMSContext (src/lib/store.tsx)
  │     ├── State: orders, partners, outletLocations, session, authPasswords, sheetConfig
  │     └── Actions: addOrder, updateOrder, markDelivered, confirmRiderDelivery, etc.
  ├── Real-Time Streams:
  │     ├── SSE Stream: GET /api/events (Instant <10ms local network sync)
  │     └── Firestore: onSnapshot(collection(db, 'orders')) (Multi-device cloud sync)
  └── UI Components:
        ├── Header & Nav: src/components/Header.tsx, src/components/Sidebar.tsx
        ├── Dashboards:
        │     ├── Admin: src/pages/AdminDashboard.tsx
        │     ├── Outlet: src/pages/OutletDashboard.tsx
        │     ├── Rider: src/pages/DeliveryDashboard.tsx
        │     └── Analytics: src/pages/AnalyticsPage.tsx
        └── Interactive Modals:
              ├── Delivery Confirmation: src/components/ConfirmDeliveryModal.tsx
              ├── SLA Alarm System: src/components/ManagerAlarmSystem.tsx
              ├── Thermal Print: src/components/ThermalPrintModal.tsx
              ├── WhatsApp Automation: src/pages/WhatsAppAutomationPage.tsx
              └── Order Edit/Add: src/components/EditOrderModal.tsx, src/components/AddOrderModal.tsx
```

---

## 2. Global State Store Directory (`src/lib/store.tsx`)

### Core State Variables & Types
- `orders: Order[]` (Line ~257): In-memory sorted array of orders. Deduplicated by `order_number` and `id`.
- `partners: DeliveryPartner[]` (Line ~274): Delivery partner records with `location` and `is_tracking_active`.
- `outletLocations: OutletLocation[]` (Line ~287): Dark store/branch coordinates and theme colors.
- `session: UserSession` (Line ~209): Current logged-in user profile (`id`, `name`, `role`, `outlet`).
- `authPasswords: AuthPasswords` (Line ~234): Passwords for `admin`, `manager`, `outlets`, and `partners`.
- `sheetConfig: SheetConfig` (Line ~300): Webhook URL, auto-sync toggle, last synced timestamp.
- `searchQuery: string` (Line ~335): Global search filter query string.

### Performance & Storage Batching Helpers
- `safeSaveOrdersToLocalStorage(ordersToSave, immediate?)` (Lines ~170–210):
  - Strips heavy base64 images (`item_image_url`, `delivery_photo_url`) to avoid exceeding 5MB quota.
  - Slices to top 50 recent orders.
  - Debounced by 150ms using `requestIdleCallback` to prevent main-thread freezing.
- `scheduleAsyncOrderPersistence(ordersToPersist)` (Lines ~215–230):
  - Coalesces both `idbSet(LOCAL_STORAGE_KEY_ORDERS, ...)` and `safeSaveOrdersToLocalStorage` into a 200ms batch.
  - Prevents rapid SSE mutations and Firestore snapshots from causing DOM stutter.

---

## 3. Feature-by-Feature Line Index & Logic Flow

### Feature 1: Rider Delivery Confirmation & 30-Minute SLA Auto-Confirm
- **Business Need**: When a rider delivers an order, the Outlet or Admin must confirm it. If unconfirmed for 30 minutes, it automatically confirms.
- **Key Files & Lines**:
  - `src/lib/store.tsx` (Lines ~1830–1890): `markDelivered(id, photoUrl, otpInput, deliveringRiderName)`
    - Sets `status: 'delivered'`.
    - Sets `rider_delivered: true`.
    - Sets `delivery_confirmation_pending: true`.
    - Sets `actual_delivery_time: new Date().toISOString()`.
  - `src/lib/store.tsx` (Lines ~1920–1980): `confirmRiderDelivery(id, isAutoConfirm?)`
    - Sets `delivery_confirmation_pending: false`.
    - Writes to Firestore: `setDoc(doc(db, 'orders', id), updates, { merge: true })`.
    - Posts to backend: `/api/orders/${id}` to trigger SSE broadcast.
  - `src/lib/store.tsx` (Lines ~1985–2005): Auto-confirm background loop
    - Runs every 10 seconds: `setInterval(..., 10000)`.
    - Checks: `now - deliveryTime >= 30 * 60 * 1000`.
    - Automatically invokes `confirmRiderDelivery(o.id, true)`.
  - `src/components/ConfirmDeliveryModal.tsx`:
    - Full-screen modal triggered when `pendingOrders.length > 0`.
    - Features: Delivery photo zoom, OTP verification badge, 30-min countdown timer, "Confirm Delivery Now" button.
  - `src/components/OrderCard.tsx` (Lines ~55–70): `AutoConfirmTimer`
    - Live countdown badge calculating remaining seconds until 30-minute auto-confirmation.

### Feature 2: High-Performance Real-Time Synchronization
- **Business Need**: Real-time sync across Admin, Outlet, and Rider screens with zero UI lag.
- **Key Files & Lines**:
  - `src/lib/store.tsx` (Lines ~480–575): `mergeAndDeduplicateOrders(currentList, incomingList, isFullSync?)`
    - Conflict resolution strategy: preserves `delivery_confirmation_pending` if true in either doc.
    - Chooses newest update by timestamp.
  - `src/lib/store.tsx` (Lines ~750–865): Server-Sent Events (SSE) listener
    - Connects to `/api/events`.
    - Listens for `order_mutation` and updates `setOrders` instantaneously.
  - `src/lib/store.tsx` (Lines ~870–940): Firestore `onSnapshot(collection(db, 'orders'))`
    - Cloud sync across distinct networks/browsers.
    - Batches updates through `scheduleAsyncOrderPersistence`.
  - `api/index.ts` (Lines ~35–90):
    - In-memory RAM order store for sub-10ms response times.
    - SSE clients manager and broadcast loop.

### Feature 3: Thermal Printing & KOT Generation
- **Business Need**: Print 2-inch and 3-inch thermal receipts for kitchen and dispatch.
- **Key Files & Lines**:
  - `src/lib/printReceipt.ts`:
    - `printThermalReceipts(orders, options)`: Formats receipts with customer name, items, advance/due amount, barcode, and delivery notes.
    - Uses `@media print` CSS rules in a dedicated iframe for instant thermal printing.
  - `src/components/ThermalPrintModal.tsx`:
    - Preview modal allowing selection of receipt size (58mm / 80mm) and copy count.

### Feature 4: Manager SLA Delay Alarm System
- **Business Need**: Auditory and visual chime alert when an order reaches within 30 minutes of its expected delivery time or is overdue.
- **Key Files & Lines**:
  - `src/components/ManagerAlarmSystem.tsx` (Lines ~40–80):
    - Role-aware filtering: Admin hears all alarms; Outlet hears only assigned outlet's orders.
    - Web Audio API (Lines ~90–145): Synthesizes three crisp 880Hz square-wave beeps every 1.5 seconds.
    - Alarm dismissal: Adds order ID to `acknowledgedOrders` Set so the sound stops upon acknowledgment.

### Feature 5: WhatsApp Background Automation Engine
- **Business Need**: Send automated WhatsApp notifications on order creation, dispatch, and delivery.
- **Key Files & Lines**:
  - `src/lib/store.tsx` (Lines ~590–705):
    - `checkWhatsAppStatus()`: Polls `/api/whatsapp/status`.
    - `triggerWhatsAppBackgroundMessage(order, type)`: Automatically triggers templated message via `/api/whatsapp/send`.
  - `server.ts` & `/api/whatsapp/*`:
    - Baileys/In-house WhatsApp web client connection, QR generation, and session management.
  - `src/pages/WhatsAppAutomationPage.tsx`:
    - QR scanning interface, custom message template editor, auto-trigger toggle switches.

### Feature 6: Role-Based Access Control (RBAC) & Password Security
- **Business Need**: Distinct portals for Admin, Outlets (Sector 31, Sector 35, Sector 42, Sector 88), and Riders with secure authentication.
- **Key Files & Lines**:
  - `src/types.ts`: `Role = 'admin' | 'outlet' | 'rider' | 'manager'`.
  - `src/lib/store.tsx` (Lines ~235–255 & ~1200–1280):
    - `verifyPassword(role, identifier, passwordAttempt)`.
    - `updateAdminPassword`, `updateOutletPassword`, `updatePartnerPassword`.
  - `src/components/PasswordModal.tsx`:
    - Password management UI allowing admins to reset credentials for any branch or rider.

### Feature 7: Performance & Fluid UI Engine (60 FPS)
- **Business Need**: Ensure 0ms latency typing, zero UI freezing, and instantaneous tab switching.
- **Key Files & Lines**:
  - `src/lib/store.tsx` (Lines ~170–230): Debounced dual-layer async persistence (`scheduleAsyncOrderPersistence`).
  - `src/components/Header.tsx` (Lines ~48–65): Debounced search input (160ms delay) prevents 100+ card re-renders on keystrokes.
  - `src/pages/OutletDashboard.tsx` (Lines ~85–95): `debouncedSearch` avoids filtering large arrays synchronously.
  - `src/pages/AdminDashboard.tsx` (Line ~264): Strict pagination (`PAGE_SIZE = 30`) prevents rendering hundreds of heavy DOM nodes.
  - `src/index.css`: `contain: content; will-change: transform;` applied to cards for GPU-accelerated scrolling.

---

## 4. How to Update Any Feature Safely (Rule of Thumb)

1. **State Mutation**: Never update `orders` directly without calling `ordersRef.current = next` and `scheduleAsyncOrderPersistence(next)`.
2. **Backend Sync**: Always call `syncOrderToBackend(id, updates)` to broadcast SSE events to all connected clients.
3. **Outlet Matching**: Always use `matchesOutlet(order.outlet, targetOutlet)` from `src/lib/outletUtils.ts` to support both full names ("Sector 31 Outlet") and short names ("Sector 31").
4. **Session Access**: Use `session.outlet` (NOT `session.outletName`), as defined in `src/types.ts`.
