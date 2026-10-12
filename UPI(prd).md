# UPI Peer Payments — Product Requirements Document (PRD)

**Status:** ⛔ **REMOVED** (2026-03-10). Feature stripped from all app code and from the
Supabase schema (migration `remove_upi_feature_columns`). This document is the complete,
self-contained reimplementation spec — restoring the feature exactly as it was should only
require following §10 (Reimplementation Checklist).

**Repo:** CP EATS · **Stack:** React 19 + Vite SPA, Supabase (Postgres/Realtime), Express `server.ts`

---

## 1. Overview

CP EATS is a home-kitchen food app. Kitchens and customers settle payments **out-of-band**
over UPI (India's instant real-time payment rail). The feature never moves money through
the app and never talks to a payment gateway — it only exchanges *payment coordinates*
(UPI handle, beneficiary display name, bank label, QR image) inside the existing
**per-order chat**, so the customer can pay manually from any UPI app (GPay / PhonePe / Paytm).

Two chat artifacts can be created by the **kitchen only**:

| Artifact | Trigger | `upiCardData.amount` | Purpose |
|---|---|---|---|
| **Share Card** | typing `/UPI` in chat | `0` | Kitchen shares its payout handle + QR |
| **Payment Request Card** | `₹` button → amount → Send | `> 0` | Kitchen requests a specific ₹ amount |

Customers can **view/copy** cards but can never create them (enforced by `isKitchenView`).

## 2. Goals / Non-Goals

**Goals**
- Zero MDR/gateway fees for kitchen owners; settlement is direct P2P.
- Time-to-pay < 10 seconds: one card shows handle + name + amount + QR together.
- Fraud-aware UX: prominent "verify recipient name" warnings and a QR lightbox.
- Kitchen-controlled data: payout profile is PIN-gated to save **and** to wipe.

**Non-Goals**
- No payment gateway integration (Razorpay/Cashfree/etc.), no UPI intent/deeplink SDK.
- No automatic payment verification/reconciliation — the kitchen marks orders paid manually.
- No escrow, refunds, chargebacks, cards, or wallets.

## 3. Personas

| Persona | Need |
|---|---|
| **Kitchen owner** | Fast fee-free settlement; configure payout once in Settings; blast a request card per order. |
| **Customer (resident)** | Everything needed to pay in one glance; protected from *others* creating fake requests. |
| **Admin** | No dedicated surface — normal moderation only. |

## 4. Data Model

### 4.1 Postgres (project `eqslifnlscywjppcwupn`)

```sql
-- users: customer-side payout profile (optional, rarely used)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "upiDisplayName" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;   -- base64 data URL (compressed image)

-- kitchens: primary carrier of the payout profile
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "upiDisplayName" TEXT;
ALTER TABLE kitchens ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;

-- chats: one row per chat message; UPI cards are ordinary rows with flags
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "isUpiCard" BOOLEAN DEFAULT FALSE;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "upiCardData" JSONB;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS "qrCodeUrl" TEXT;
```

`upiCardData` JSONB shape:

```json
{ "upiId": "chefname@upi", "amount": 250, "displayName": "Simranjeet Kaur", "bankName": "HDFC Bank" }
```

* `amount` — `0` ⇒ "Shared Payout Handle / Ready to Pay" layout; `> 0` ⇒ "Requested Amount" layout.
* `bankName` — badge on the card header; falls back to `"Verified Partner"` in the UI and
  `"Personal Payout"` / `"HDFC Bank"` at write time (see §5).
* No FKs, no CHECK constraints, no RLS policies referenced these columns.
  `public_profiles` view never exposed them.

### 4.2 TypeScript (`src/types.ts`)

```ts
export interface KitchenDetails {
  // ...
  upiId: string;
  bankName: string;
  upiDisplayName: string;
  qrCodeUrl: string; // Base64 data URL
}

export interface UserProfile {
  // ...
  upiId?: string;
  bankName?: string;
  upiDisplayName?: string;
  qrCodeUrl?: string;
}

export interface ChatMessage {
  // ...
  isUpiCard?: boolean;
  upiCardData?: {
    upiId: string;
    amount: number;
    displayName: string;
    bankName?: string;
  } | null;
  qrCodeUrl?: string;
}
```

### 4.3 Persistence layer (`src/database.ts`)

```ts
// createChatMessage(): plain text and UPI cards share one insert path
await supabase.from('chats').insert(normalizePayload('chats', [{
  id, orderId, senderId, senderName, text,
  isUpiCard: message.isUpiCard,
  upiCardData: message.upiCardData,
  qrCodeUrl: message.qrCodeUrl,
  createdAt: new Date(message.createdAt).toISOString()
}]));

// mapToChatMessage(): tolerates JSONB returned as string (PostgREST quirk)
isUpiCard: data.isUpiCard === true,
upiCardData: typeof data.upiCardData === 'string'
  ? (() => { try { return JSON.parse(data.upiCardData); } catch { return null; } })()
  : data.upiCardData,
qrCodeUrl: data.qrCodeUrl,
```

`createUser`/`updateUser`/`createKitchen`/`updateKitchen`/`mapToUserProfile`/
`mapToKitchenDetails` all carried the four `upiId|bankName|upiDisplayName|qrCodeUrl`
fields verbatim (`createUser` only when `!== undefined`; mappers default kitchens to `''`).

## 5. Flows

### 5.1 Kitchen: configure payout profile (Settings tab → "UPI Payment Configuration")

**UI:** a dedicated form card inside Kitchen Dashboard **Settings (TAB 5)**, between the
Ringtone card and the Reviews card.

**State** (top of `KitchenDashboard.tsx`):

```ts
// UPI configuration drawer state
const [upiId, setUpiId] = useState("");
const [bankName, setBankName] = useState("");
const [upiDisplayName, setUpiDisplayName] = useState("");
const [hardDeleteUpi, setHardDeleteUpi] = useState(false);
const [qrCodeUrl, setQrCodeUrl] = useState("");
```

**Hydration** — inside the `kitchens/{uid}` `onSnapshot` listener:

```ts
setUpiId(details.upiId || "");
setBankName(details.bankName || "");
setUpiDisplayName(details.upiDisplayName || "");
setQrCodeUrl(details.qrCodeUrl || "");
```

**Form fields:**

| Field | Input | Required | Notes |
|---|---|---|---|
| UPI Handle / ID | text, `placeholder="e.g. chefname@upi"` | `required={!hardDeleteUpi}` | mono font |
| Beneficiary Display Name | text, `placeholder="e.g. Simranjeet Kaur"` | `required={!hardDeleteUpi}` | must match what payer sees in their UPI app |
| Bank Name | text, `placeholder="e.g. HDFC Bank"` | `required={!hardDeleteUpi}` | shown as card badge |
| Save QR Code Image | `file input accept="image/*"` | no | compressed client-side via `compressImage()` → base64 data URL; 64×64 preview + **Remove** button |
| Hard Wipe Payment Profiles | rose toggle (`ToggleLeft`/`ToggleRight`) | — | flips submit button to destructive mode |

All inputs are `disabled={hardDeleteUpi}` except the toggle.

**Submit** — PIN-gated, then either wipe or save:

```ts
// Update UPI credentials drawer
const handleSaveUpiProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    if (!(await requestKitchenPin("Save or wipe UPI payment settings?"))) return;
    const updateData = hardDeleteUpi ? {
      upiId: deleteField(),
      bankName: deleteField(),
      upiDisplayName: deleteField(),
      qrCodeUrl: deleteField()
    } : {
      upiId: upiId.trim(),
      bankName: bankName.trim(),
      upiDisplayName: upiDisplayName.trim(),
      qrCodeUrl: qrCodeUrl
    };

    await updateDoc(doc(db, "kitchens", currentProfile.uid), updateData);

    if (hardDeleteUpi) {
      setUpiId(""); setBankName(""); setUpiDisplayName(""); setHardDeleteUpi(false);
      showToast("UPI payment details permanently wiped out! 🧹");
    } else {
      showToast("UPI payment profile configured! 🔐");
    }
  } catch (err) {
    console.error("Failed to save UPI info:", err);
  }
};
```

Submit button label: `hardDeleteUpi ? "Confirm Hard Wipe Details" : "Save Payout Profile"`.

### 5.2 Kitchen: `/UPI` slash command → Share Card (`amount: 0`)

In `Chat.tsx` `handleSendMessage`, before the normal message insert:

```ts
if (messageText.toUpperCase() === "/UPI") {
  if (!isKitchenView) {
    return; // Customers cannot use UPI sharing features
  }
  try {
    let upiIdToUse = "", displayNameToUse = "", bankNameToUse = "", qrCodeUrlToUse = "";

    // Fetch from kitchens collection
    const docSnap = await getDoc(doc(db, "kitchens", senderId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      upiIdToUse = data.upiId || "";
      displayNameToUse = data.upiDisplayName || data.kitchenName || senderName;
      bankNameToUse = data.bankName || "";
      qrCodeUrlToUse = data.qrCodeUrl || "";
    }

    // If no saved info, nothing happens!
    if (!upiIdToUse && !qrCodeUrlToUse) return;

    const messageId = "chat_" + Date.now();
    await setDoc(doc(db, "chats", messageId), {
      id: messageId, orderId, senderId, senderName,
      text: `Shared UPI Details & QR Code`,
      isUpiCard: true,
      upiCardData: {
        upiId: upiIdToUse,
        amount: 0, // 0 for general sharing
        displayName: displayNameToUse,
        bankName: bankNameToUse || "Personal Payout"
      },
      qrCodeUrl: qrCodeUrlToUse || "",
      createdAt: new Date().toISOString()
    });
    setNewMessage("");
    return;
  } catch (err) {
    console.error("Failed to fetch and send /UPI card:", err);
  }
}
```

**Behavior notes**
- Case-insensitive match on exactly `/UPI` (trimmed input).
- Silent no-op for customers and when the kitchen never configured a handle/QR.
- Display-name precedence: `upiDisplayName` → `kitchenName` → `senderName`.
- `bankName` fallback string: `"Personal Payout"`.

### 5.3 Kitchen: "Request Payment" amount creator → Request Card (`amount > 0`)

**Header button** (kitchen view only, right side of the chat header, `₹` glyph,
`title="Request Payment"`) toggles a popover:

```tsx
{isKitchenView && (
  <div className="relative">
    <button type="button" onClick={() => setShowUpiCreator(!showUpiCreator)}
      className="w-8 h-8 ... bg-indigo-600 hover:bg-indigo-700 ..." title="Request Payment">
      <span>₹</span>
    </button>
    {showUpiCreator && (
      <div className="absolute right-0 top-10 w-64 p-3 ... rounded-xl shadow-lg z-50">
        <p className="text-xs font-semibold ...">Create UPI Request Card</p>
        <div className="flex gap-2">
          <input type="text" inputMode="decimal" pattern="[0-9]*"
            value={customAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              const parts = val.split('.');
              setCustomAmount(parts.length <= 2 ? val : parts[0] + '.' + parts.slice(1).join(''));
            }}
            placeholder="Enter amount (₹)" className="flex-1 ..." />
          <button type="button" onClick={triggerUpiRequest}
            className="px-3 py-1.5 bg-emerald-600 ...">Send</button>
        </div>
      </div>
    )}
  </div>
)}
```

```ts
const triggerUpiRequest = () => {
  const amt = parseFloat(customAmount);
  if (isNaN(amt) || amt <= 0) return;
  if (onSendUpiRequest) {
    onSendUpiRequest(amt);
    setCustomAmount("");
    setShowUpiCreator(false);
  }
};
```

`Chat` exposes `onSendUpiRequest?: (amount: number) => void`; the dashboard wires it:

```tsx
<Chat orderId={ord.id} senderId={currentProfile.uid}
      senderName={kitchenDetails?.kitchenName || currentProfile.displayName}
      isKitchenView={true}
      onSendUpiRequest={handleSendBillingRequest} />
```

**Producer** (`KitchenDashboard.tsx`):

```ts
// Send Billing payment card into chat
const handleSendBillingRequest = async (amount: number) => {
  if (!selectedOrderId) return;
  const ord = incomingOrders.find(o => o.id === selectedOrderId);
  if (!ord) return;

  if (!kitchenDetails?.upiId) {
    showToast("❌ Please configure your UPI Handle in Settings before requesting payments.");
    return;
  }

  try {
    const messageId = "chat_" + Date.now();
    await setDoc(doc(db, "chats", messageId), {
      id: messageId,
      orderId: selectedOrderId,
      senderId: currentProfile.uid,
      senderName: kitchenDetails.kitchenName,
      text: `Requested payment of ₹${amount.toFixed(2)}`,
      isUpiCard: true,
      upiCardData: {
        upiId: kitchenDetails.upiId,
        amount,
        displayName: kitchenDetails.upiDisplayName || currentProfile.displayName,
        bankName: kitchenDetails.bankName || "HDFC Bank"
      },
      qrCodeUrl: qrCodeUrl || kitchenDetails?.qrCodeUrl || "",
      createdAt: new Date().toISOString()
    });
    showToast("Secure UPI request card sent to chat! 💳");
  } catch (err) {
    console.error("Failed to send billing invoice:", err);
  }
};
```

Amount input sanitization: keeps digits + at most one `.`; `parseFloat` must yield `> 0`.
Visible `text` of the message doubles as the plain-text fallback (`Requested payment of ₹X`).

## 6. Card Rendering (both roles, inside `Chat.tsx` message list)

A message renders as a UPI card iff `msg.isUpiCard && msg.upiCardData`, otherwise as a
normal bubble. Card = `max-w-[320px]`, `bg-gradient-to-br from-indigo-900 to-slate-900`,
`rounded-2xl`, `animate-fade-in`.

**Anatomy (top → bottom):**

1. **Header** — `Award` icon (amber) + `Secure UPI Request` (uppercase, indigo-200) on the
   left; bank badge (`msg.upiCardData.bankName || "Verified Partner"`, emerald pill) right.
2. **Amount row**
   - `amount > 0`: label `Requested Amount` / value `₹{amount.toFixed(2)}` (2xl, amber-300).
   - `amount === 0`: label `Shared Payout Handle` / value `Ready to Pay` (emerald, uppercase).
3. **UPI Handle block** (only if `upiCardData.upiId`) — dark `slate-950/65` panel,
   `UPI Handle` caption + mono handle + copy button (`Copy`/`Check` icon swap via
   `copiedId === msg.id`, 2 s timeout, `navigator.clipboard.writeText`).
4. **QR block** (only if `msg.qrCodeUrl`) — white panel, caption `Scan QR Code to Pay`,
   `<img src={msg.qrCodeUrl} className="max-w-[160px] ... cursor-zoom-in" />`; click sets
   `enlargedImage` **and** `enlargedUpiData = { upiId, displayName, amount }`.
5. **Safety banner** — amber panel with `ShieldAlert` icon:
   > Verify that the recipient name is exactly **{displayName}** on your payment app (GPay/PhonePe) before transferring funds.

**QR lightbox (shared modal):** when `enlargedImage` is set, the overlay's title/subtitle
switch to `🔐 Secure UPI Payment` / `Scan QR using your payment app or copy the UPI ID below`
(else `🔍 Image View` / `Enlarged image preview`). Below the image, if `enlargedUpiData` is
set, an info panel shows:

- `Recipient Name` → `displayName || "Neighbor"`
- `UPI Handle / ID` → mono handle + copy button (`copiedInModal`, 2 s)
- `Amount to Pay` row **only when `amount > 0`**
- Guidance box: `💡 Scan the QR Code using Google Pay, PhonePe, or Paytm, or copy the UPI ID above to transfer funds manually.`

Closing the lightbox (backdrop or ✕) resets `enlargedImage`, `enlargedUpiData`,
`copiedInModal`.

**Chat states involved:** `showUpiCreator`, `customAmount`, `enlargedUpiData`,
`enlargedImage`, `copiedId`, `copiedInModal`.

## 7. Edge Cases & Error Handling

| # | Case | Behavior |
|---|---|---|
| 1 | Customer types `/UPI` | Silent return — never creates a card. |
| 2 | Kitchen types `/UPI` but never configured handle/QR | Silent no-op (`if (!upiIdToUse && !qrCodeUrlToUse) return;`). |
| 3 | Kitchen taps Request Payment with no `kitchenDetails.upiId` | Toast `❌ Please configure your UPI Handle in Settings before requesting payments.` — no card. |
| 4 | Amount empty / `NaN` / `≤ 0` | `triggerUpiRequest` returns; popover stays open. |
| 5 | Amount with multiple dots (`1.2.3`) | Sanitizer keeps only the first `.`. |
| 6 | `upiCardData` arrives as JSON **string** (PostgREST) | `mapToChatMessage` `JSON.parse`s; malformed ⇒ `null` ⇒ card degrades to normal bubble (condition requires `msg.upiCardData`). |
| 7 | Kitchen wipes profile (hard delete) | `deleteField()` → NULLed columns; local state cleared; subsequent `/UPI` no-ops (case 2). |
| 8 | Saving/wiping without PIN | `requestKitchenPin("Save or wipe UPI payment settings?")` rejects ⇒ abort. |
| 9 | QR only, no handle (or vice versa) | Card still renders; missing sections hidden (`upiCardData.upiId && …`, `msg.qrCodeUrl && …`). |
| 10 | Clipboard failure | Not guarded — `navigator.clipboard.writeText` may reject silently (accepted limitation). |

## 8. Acceptance Criteria

1. Kitchen can save `upiId`, `upiDisplayName`, `bankName`, `qrCodeUrl` in Settings, PIN-gated; values survive reload (rehydrated from `kitchens/{uid}` snapshot).
2. Hard-wipe toggle turns the form destructive (`Confirm Hard Wipe Details`), clears all four fields locally and in DB, shows 🧹 toast.
3. Kitchen typing `/UPI` in an order chat posts a card with `amount: 0` and its saved profile; customer typing `/UPI` posts nothing.
4. `₹` button is visible only when `isKitchenView`; amount popover creates a card with `amount > 0`, `text = "Requested payment of ₹X.XX"`.
5. Both roles render the card (header/badge/amount/handle/copy/QR/safety banner) in place of a bubble.
6. QR click opens lightbox titled `🔐 Secure UPI Payment` with recipient, handle, optional amount, and guidance text; close resets all state.
7. `mapToChatMessage` tolerates stringified and malformed `upiCardData`.
8. `npx tsc --noEmit`, `npx vitest run`, `npx playwright test`, `npm run build` all pass with the feature present.

## 9. Removal Record (what was stripped on 2026-03-10)

- **Code:** `src/components/Chat.tsx` (prop `onSendUpiRequest`, 6 states, `/UPI` branch, `triggerUpiRequest`, ₹ popover, card JSX, lightbox UPI panels), `src/components/KitchenDashboard.tsx` (5 states, hydration lines, `handleSaveUpiProfile`, `handleSendBillingRequest`, full settings form, `Chat` prop wiring, `deleteField`/`Settings`/`ToggleLeft`/`ToggleRight` imports), `src/components/OnboardingView.tsx` (4 default fields), `src/types.ts` (3 interfaces), `src/database.ts` (8 regions), `src/utils/seeding.ts` (3 kitchens), `src/schema.sql`, `tests/unit/database.test.ts` (2 UPI tests → replaced by plain mapper test).
- **DB migration `remove_upi_feature_columns`:** dropped 11 columns — `users.upiId/bankName/upiDisplayName/qrCodeUrl`, `kitchens.upiId/bankName/upiDisplayName/qrCodeUrl`, `chats.isUpiCard/upiCardData/qrCodeUrl`. Pre-verified: no views (`public_profiles`), RLS policies, constraints, or indexes referenced them.
- **Docs/schema:** `supabase-schema.sql`, `fix-kitchen-saves-schema.sql`, `fix-onboarding-users-schema.sql` updated to match.
- **Not touched:** `.kilo/worktrees/*` (other branches), `QA_REPORT.md` (historical record).

## 10. Reimplementation Checklist

1. Re-run the §4.1 SQL (11 `ADD COLUMN` statements), then `NOTIFY pgrst, 'reload schema';`.
2. Restore the `src/types.ts` interfaces (§4.2).
3. Restore `src/database.ts` payload + mapper fields (§4.3) and re-add the two `upiCardData` JSON-parse unit tests.
4. Restore `KitchenDashboard.tsx`: states → hydration → `handleSaveUpiProfile` → `handleSendBillingRequest` → form JSX → `<Chat onSendUpiRequest={…}>` (§5.1, §5.3).
5. Restore `Chat.tsx`: props/states → `/UPI` branch → popover → card JSX → lightbox panels (§5.2, §5.3, §6).
6. Restore defaults in `OnboardingView.tsx` + `seeding.ts`; update `supabase-schema.sql`.
7. Run full verification: `tsc`, `vitest`, `playwright`, `build`.

> **Security note for any future version:** UPI handles and QR codes are PII/financial-adjacent.
> Keep them owner-writable only (the RLS in `supabase-rls-policies.sql` never covered these
> columns because the whole feature was removed before hardening). Consider a dedicated
> `kitchen_payouts` table with `is_admin()`-scoped writes instead of putting them on `kitchens`.
