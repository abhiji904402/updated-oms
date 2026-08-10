# BROOMIES OMS - APPLICATION BLUEPRINT & ARCHITECTURE DIRECTORY

This document provides a comprehensive blueprint and function index for the **Broomies Order Management System (OMS)**. Refer to this document whenever modifying features, adding components, or optimizing performance.

---

## 1. System Overview & Architecture

Broomies OMS is a real-time, high-performance, offline-first Order & Delivery Management application built with **React (Vite), TypeScript, Tailwind CSS, Firebase Firestore, IndexedDB, and Recharts**.

### Core Architecture Principles
- **Instant Data Hydration**: Application loads synchronously from `localStorage` & `IndexedDB` on startup, giving an immediate 0ms load feeling. Real-time updates then stream via Firebase Firestore (`onSnapshot`).
- **High-Performance UI**: Pages and heavy components are wrapped in `React.memo` with `useMemo` / `useCallback` to prevent lag when operating on thousands of orders.
- **Dual-Layer Storage**: Data persists in `IndexedDB` (unlimited quota) and `localStorage` (lightweight fallback with image payload stripping).
- **Multi-Role RBAC**:
  - `admin`: Central Admin Dashboard, full control, rider map tracking, password management, bulk sheet sync.
  - `outlet`: Outlet Manager view (Sector 31, Sector 15, Sector 46, Sector 21), order creation, delivery confirmation.
  - `rider`: Mobile Delivery Partner interface, photo proof upload, OTP verification, live GPS location broadcasting.

---

## 2. Global State Store Reference (`src/lib/store.tsx`)

The central state is provided via `useOMS()` hook from `OMSContext`. Below is a breakdown of all state variables and action functions:

### State Variables
| State Variable | Type | Description |
| :--- | :--- | :--- |
| `orders` | `Order[]` | List of all orders sorted by `order_number` descending. |
| `partners` | `DeliveryPartner[]` | Delivery rider list with status, phone, and GPS coords. |
| `outletLocations` | `OutletLocation[]` | List of dark store / outlet coordinates & colors. |
| `session` | `UserSession` | Currently logged-in user details (`id`, `name`, `role`, `outletName`, `deliveryPartnerId`). |
| `isAuthenticated` | `boolean` | Authentication status. |
| `authPasswords` | `AuthPasswords` | Password hashes for Admin, Outlets, and Delivery Riders. |
| `sheetConfig` | `SheetConfig` | Google Sheets Apps Script webhook URL and auto-sync config. |
| `syncLogs` | `SyncLog[]` | Audit logs of automated and manual sync operations. |
| `selectedOrderIds` | `string[]` | Selected order IDs for batch operations. |
| `searchQuery` | `string` | Search query for filtering orders by customer, address, or items. |
| `selectedOutletFilter` | `string` | Active outlet filter (`ALL` or specific outlet name). |
| `selectedStatusFilter` | `string` | Active status filter (`ALL`, `pending`, `processing`, `out_for_delivery`, `delivered`, `cancelled`). |
| `dateRangeFilter` | `{ start: string, end: string }` | Date range filter object. |
| `recentNotification` | `string \| null` | Floating notification toast message. |

### Core Action Functions
- **Authentication & Roles**:
  - `login(userSession)`: Sets authenticated session.
  - `logout()`: Clears active session.
  - `switchRole(role, name)`: Switches active user role.
  - `verifyPassword(role, identifier, attempt)`: Validates credentials.
  - `updateAdminPassword(newPass)` / `updateOutletPassword(outlet, newPass)` / `updatePartnerPassword(partnerId, newPass)`: Updates role passwords.
- **Order Management**:
  - `addOrder(orderData)`: Creates a new order, assigns 4-digit OTP, saves to Firestore & IndexedDB, and triggers Sheet sync.
  - `importOrders(newOrders)`: Bulk imports multiple orders from CSV/Excel.
  - `updateOrder(id, updates)`: Updates order fields and syncs changes.
  - `deleteOrder(id)`: Removes an order from Firestore & storage.
  - `clearAllOrders()`: Purges all orders from system.
  - `updateOrderStatus(id, status, rider)`: Changes order status (`pending` -> `processing` -> `out_for_delivery` -> `delivered`).
  - `markDelivered(id, photoUrl, otpInput)`: Delivery rider completion with photo/OTP verification.
  - `confirmRiderDelivery(id)`: Outlet manager confirmation of rider-delivered order.
- **Rider & Outlet Management**:
  - `addPartner(data)` / `deletePartner(id)` / `updatePartnerStatus(id, status)`: Rider CRUD.
  - `updatePartnerLocation(partnerId, loc)`: Broadcasts rider GPS coordinates.
  - `updateOutletLocation(id, updates)`: Updates dark store location.
- **Google Sheets & Bulk Actions**:
  - `triggerGoogleSheetSync()`: Forces 2-way sync with Google Sheets Apps Script webhook.
  - `updateSheetConfig(updates)`: Configures sheet URL and auto-sync toggle.
  - `toggleOrderSelection(id)` / `selectAllOrders(ids)` / `clearOrderSelection()`: Selection helper functions.

---

## 3. Data Models (`src/types.ts`)

```typescript
export type OrderStatus = 'pending' | 'processing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentType = 'full' | 'partial' | 'cod' | 'unpaid';
export type Role = 'admin' | 'outlet' | 'rider';
export type OutletName = 'Sector 31' | 'Sector 15' | 'Sector 46' | 'Sector 21';

export interface Order {
  id: string;
  order_number: number;
  outlet: OutletName;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: string;
  item_image_url?: string;
  quantity: number;
  total_amount: number;
  advance_amount: number;
  remaining_balance: number;
  due_amount: number;
  payment_type: PaymentType;
  status: OrderStatus;
  delivery_partner?: string;
  scheduled_time?: string;
  delivery_photo_url?: string;
  otp?: string;
  actual_delivery_time?: string;
  delivered_by?: string;
  payment_changed_by?: string;
  payment_changed_at?: string;
  rider_delivered?: boolean;
  delivery_confirmation_pending?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  vehicle_type: 'bike' | 'scooter' | 'cycle' | 'ev';
  status: 'available' | 'busy' | 'offline';
  total_deliveries: number;
  rating?: number;
  is_tracking_active?: boolean;
  location?: DeliveryPartnerLocation;
}
```

---

## 4. Component Structure & Page Blueprint

- `/src/App.tsx`: Main router & view renderer. Switch between tabs without full re-renders.
- `/src/pages/AdminDashboard.tsx`: Central command dashboard (metrics, rider live tracking map, order dispatch table, bulk actions). Wrapped in `React.memo`.
- `/src/pages/OutletDashboard.tsx`: Outlet-specific operational view with status columns and quick delivery confirmation. Wrapped in `React.memo`.
- `/src/pages/DeliveryDashboard.tsx`: Mobile-first Delivery Partner portal with location broadcast, camera photo capture, and OTP verification. Wrapped in `React.memo`.
- `/src/pages/GoogleSheetsPage.tsx`: Live sheet sync control, CSV import/export, and spreadsheet-style table editor. Wrapped in `React.memo`.
- `/src/pages/AnalyticsPage.tsx`: Recharts charts for daily revenue, outlet breakdown, and rider performance metrics. Wrapped in `React.memo`.
- `/src/pages/AlertsPage.tsx`: System alerts (SLA delay warnings, pending rider confirmations, unpaid orders). Wrapped in `React.memo`.
- `/src/components/`:
  - `Header.tsx`: Top bar with notification badge, role switcher, sync status.
  - `Sidebar.tsx`: Navigation drawer with role-based visibility.
  - `OrderCard.tsx`: Individual order summary card.
  - Modals: `AddOrderModal`, `EditOrderModal`, `ConfirmDeliveryModal`, `DeliveryPhotoModal`, `PasswordModal`, `MapModal`, `GoogleSheetSyncModal`.

---

## 5. Performance & Optimization Rules

1. **Component Memoization**: Always wrap page components and modal components in `React.memo`.
2. **Selective State Updates**: Compare array lengths and key properties before invoking `setOrders` or `setPartners` to avoid unnecessary DOM reconciliations.
3. **Optimized Calculations**: Use `useMemo` for filtering, sorting, or summarizing large arrays (`orders`, `partners`).
4. **Non-blocking Storage**: Use asynchronous `IndexedDB` calls (`idbSet`, `idbGet`) for unlimited local storage that never blocks the main UI thread.
