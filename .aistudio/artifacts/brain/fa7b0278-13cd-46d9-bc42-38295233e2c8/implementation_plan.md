# Implementation Plan: Pending Payment Tab Filter & Automatic WhatsApp Send Test

## 1. Pending Payment Tab (`PENDING PAYMENT`) Filter Update
- **Current Behavior**: `isPaymentPending(order)` in `src/lib/orderLogic.ts` includes all non-cancelled orders that have a remaining balance (`remaining_balance > 0` or `payment_type === 'due' | 'part'`), even if the order is still in `pending` / `preparing` / `ready` or only marked delivered by the Rider without Admin/Outlet confirmation.
- **New Behavior**:
  - Update `isPaymentPending(order)` in `src/lib/orderLogic.ts` so that an order appears in the **Pending Payment** tab **only when**:
    1. The order is **Final Confirmed Delivered** by Admin or Outlet (`isOrderFinalDelivered(order)` is `true`, meaning `status === 'delivered'` and not waiting on Rider confirmation).
    2. Its payment is still pending/unpaid (`remaining_balance > 0` or `payment_type === 'due' | 'part'`, and `payment_type` is not marked as `'full' | 'paid'`).
  - Sync the Pending Payment filter in `src/pages/AdminDashboard.tsx` and the Bulk Payment Reminder list in `src/pages/WhatsAppAutomationPage.tsx` so both consistently show confirmed delivered orders with pending payment.

## 2. WhatsApp Automation "Send Test" — Automatic Only (No Manual Web Popup)
- **Current Behavior**: Clicking **Send Test** in `src/pages/WhatsAppAutomationPage.tsx` (`handleSendTest`) calls `POST /api/whatsapp/send`, and if the live WhatsApp socket is not immediately connected or returns `directWebUrl`, it opens manual WhatsApp Web (`window.open(data.directWebUrl, '_blank')`).
- **New Behavior**:
  - **Backend (`api/index.ts` & `api/whatsapp-service.ts`)**:
    - Support `strictAuto: true` in `POST /api/whatsapp/send`.
    - When `strictAuto: true` is passed and the socket is not currently connected, automatically attempt to restore/reconnect the saved WhatsApp session (`restoreSessionFromCloud` / `startWhatsAppEngine(false)`) and wait briefly for the socket to become ready before attempting automatic delivery.
    - If automatic delivery still cannot complete (e.g., no linked device or socket offline), return a clear JSON error status (`success: false`, `autoConnected: false`, `error: '...'`) without queuing a manual `directWebUrl` fallback.
  - **Frontend (`src/pages/WhatsAppAutomationPage.tsx`)**:
    - Update `handleSendTest` to send `strictAuto: true` and **never call `window.open`**.
    - Display a clear real-time status notification and inline feedback banner indicating whether the test message was **delivered automatically** via the connected WhatsApp engine or if **auto-reconnect failed** (with the exact connection reason so you can verify your live WhatsApp link).
