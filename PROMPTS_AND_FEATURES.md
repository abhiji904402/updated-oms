# BROOMIES OMS - FEATURE PROMPTS & RECOVERY PLAYBOOK

This playbook records every core feature, its exact trigger prompts (in Hindi, Hinglish, and English), expected behaviors, exact files to modify, and recovery steps if context is lost.

---

## Quick Reference Table

| Feature # | Feature Name | Core Keywords / Prompts | Primary Files |
| :--- | :--- | :--- | :--- |
| **01** | **Rider Delivery Confirmation Popup** | `rider deliver mark`, `dashboard popup`, `confirm delivery` | `ConfirmDeliveryModal.tsx`, `store.tsx`, `App.tsx` |
| **02** | **30-Minute SLA Auto-Confirm Timer** | `30 min timer`, `auto confirm`, `timer nahi aa raha` | `OrderCard.tsx`, `store.tsx`, `AdminDashboard.tsx` |
| **03** | **App Lag & Smoothness Optimization** | `app laggy hai`, `smooth banao`, `freeze ho raha hai` | `store.tsx`, `Header.tsx`, `OutletDashboard.tsx` |
| **04** | **Thermal Printing & KOT** | `thermal print`, `receipt print`, `kot bill` | `printReceipt.ts`, `ThermalPrintModal.tsx` |
| **05** | **Manager Delay Alarm System** | `alarm sound`, `beep nahi baj raha`, `manager alarm` | `ManagerAlarmSystem.tsx`, `App.tsx` |
| **06** | **WhatsApp Automation** | `whatsapp msg`, `auto whatsapp`, `qr code` | `store.tsx`, `WhatsAppAutomationPage.tsx`, `server.ts` |
| **07** | **Google Sheets Sync** | `sheet sync`, `google sheet webhook`, `csv export` | `store.tsx`, `GoogleSheetsPage.tsx` |
| **08** | **Live GPS Rider Tracking** | `rider map`, `live location`, `gps tracking` | `DeliveryDashboard.tsx`, `AdminDashboard.tsx`, `store.tsx` |
| **09** | **Role & Password Management** | `password change`, `role switch`, `outlet login` | `store.tsx`, `PasswordModal.tsx`, `types.ts` |
| **10** | **Order Creation & Edit** | `new order`, `edit order`, `order number`, `due payment` | `AddOrderModal.tsx`, `EditOrderModal.tsx`, `store.tsx` |

---

## 1. Feature 01: Rider Delivery Confirmation Popup

### User Prompt Examples
- *"rider deliver mark ker rhe hai to dashboard me popup nhi aa raha check kro"*
- *"rider ne order deliver kiya par dashboard pe confirm popup nahi dikh raha"*
- *"delivery confirmation modal is not opening on admin dashboard"*

### Required Behavior
1. Rider marks order as delivered via `markDelivered(id, photo, otp)`.
2. `order.status = 'delivered'`, `order.rider_delivered = true`, `order.delivery_confirmation_pending = true`.
3. An automatic modal (`ConfirmDeliveryModal.tsx`) MUST pop up immediately on the Admin dashboard and on the specific Outlet manager's dashboard.
4. Modal shows: Customer details, items, delivery proof photo with zoom, 4-digit OTP badge, delivery time, and live 30-min countdown timer.
5. Clicking "CONFIRM DELIVERY NOW" calls `confirmRiderDelivery(id)` which sets `delivery_confirmation_pending = false` and closes the modal.

### Recovery / Fix Checklist
- Check `api/index.ts`: ensure `delivery_confirmation_pending` is NOT overwritten to `false` during updates.
- Check `src/lib/store.tsx`: in `mergeAndDeduplicateOrders`, ensure incoming docs do not overwrite `delivery_confirmation_pending: true` with `false`.
- Check `src/App.tsx`: verify `<ConfirmDeliveryModal />` is mounted inside the main layout.

---

## 2. Feature 02: 30-Minute SLA Auto-Confirm Timer

### User Prompt Examples
- *"30 min ka timer tha vah bhi nhi aa raha use bhi fix kro bhai"*
- *"auto confirm timer 30 minutes wala chal nahi raha"*
- *"delivered order should automatically confirm after 30 mins"*

### Required Behavior
1. As soon as a rider marks an order delivered, a 30-minute countdown starts from `actual_delivery_time`.
2. Both `ConfirmDeliveryModal` and `OrderCard` (via `AutoConfirmTimer`) show the remaining time (`MM:SS`).
3. If no manager manually confirms within 30 minutes, a background interval in `store.tsx` (running every 10s) automatically triggers `confirmRiderDelivery(order.id, true)`.
4. The confirmation status updates to confirmed in Firestore, SSE, and IndexedDB, and the timer/popup gracefully disappears.

### Recovery / Fix Checklist
- Inspect `src/lib/store.tsx` (around line 1985): verify the `setInterval` checks `Date.now() - deliveryTime >= 30 * 60 * 1000`.
- Inspect `src/components/OrderCard.tsx`: verify `AutoConfirmTimer` parses `actualDeliveryTime` with a fallback to `updated_at`.

---

## 3. Feature 03: App Lag & Smoothness Optimization

### User Prompt Examples
- *"application feels laggy use fix kro aur too smooth banao"*
- *"typing me lag ho raha hai scroll smooth nahi hai"*
- *"app bohot heavy lag raha hai 60fps smooth karo"*

### Required Behavior
1. Instant typing response: Search input in `Header.tsx` and `OutletDashboard.tsx` MUST be debounced (150–160ms) so typing never triggers 100+ card re-renders per keystroke.
2. Non-blocking storage: `safeSaveOrdersToLocalStorage` and `idbSet` MUST be coalesced via `scheduleAsyncOrderPersistence` so rapid mutations don't freeze the main JavaScript thread.
3. Heavy images stripped: Images must never be stored raw in `localStorage`.
4. Page size limit: Lists MUST be paged (`PAGE_SIZE = 30`) or virtualized.

### Recovery / Fix Checklist
- Verify `scheduleAsyncOrderPersistence` in `src/lib/store.tsx` uses a 200ms debounce timer.
- Verify `Header.tsx` uses local state `localSearch` debounced to `searchQuery`.

---

## 4. Feature 04: Thermal Printing & KOT

### User Prompt Examples
- *"thermal print nahi nikal raha"*
- *"receipt size 2 inch aur 3 inch dono option do"*
- *"print kot receipt with barcode and due balance"*

### Required Behavior
1. Supports both 58mm (2-inch) and 80mm (3-inch) ESC/POS thermal printers.
2. Receipt displays: Broomies logo, Outlet name & phone, Order number with high-contrast barcode, items breakdown, payment type, advance vs. due amount, customer address, and delivery notes.
3. Direct print via iframe window without altering main page DOM.

### Recovery / Fix Checklist
- Inspect `src/lib/printReceipt.ts` and `src/components/ThermalPrintModal.tsx`.

---

## 5. Feature 05: Manager Delay Alarm System

### User Prompt Examples
- *"order delay ho raha hai to sound bajna chahiye"*
- *"manager ko alarm chime suna do"*
- *"30 min bache hain delivery ko to alert karo"*

### Required Behavior
1. Continuous 3-beep Web Audio API synthesizer (880Hz square wave) rings every 1.5 seconds when an order is within 30 minutes of `delivery_time_expected` or is overdue.
2. Filtered by role: Central admin hears alarms for all branches; Outlet staff hears alarms only for their branch.
3. Dismissing the modal adds the order ID to the acknowledged set, immediately stopping the audio chime.

### Recovery / Fix Checklist
- Inspect `src/components/ManagerAlarmSystem.tsx`. Ensure AudioContext resumes properly on user gesture.

---

## 6. Feature 06: WhatsApp Background Automation Engine

### User Prompt Examples
- *"whatsapp auto message bhej do"*
- *"customer ko delivery otp aur rider ka name whatsapp karo"*
- *"qr code scan karke whatsapp connect karo"*

### Required Behavior
1. QR code linking for WhatsApp web in `src/pages/WhatsAppAutomationPage.tsx`.
2. Automatic triggers on:
   - Order creation (`type: 'confirm'`)
   - Rider dispatch (`type: 'dispatch'`)
   - Delivery complete (`type: 'delivered'`)
3. Templates with dynamic variable replacement: `{order_number}`, `{customer_name}`, `{items}`, `{remaining_balance}`, `{rider_name}`, `{otp}`.

### Recovery / Fix Checklist
- Inspect `src/lib/store.tsx` (`triggerWhatsAppBackgroundMessage`) and `/api/whatsapp/status`.

---

## 7. Context Reset (LRM) Emergency Procedure

If the conversation history is truncated or context is lost:
1. Open `AGENTS.md` and `src/docs/ARCHITECTURE_LIBRARY.md` to restore full architectural awareness.
2. Consult this file (`PROMPTS_AND_FEATURES.md`) for the exact user prompt match.
3. Run `lint_applet` and `compile_applet` before and after any modification.
4. Keep all changes focused and surgical — never delete existing features.
