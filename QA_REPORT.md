# CP-Eats Application — QA Testing Report

**Date:** 2026-07-14  
**Tester Role:** Senior Full-Stack QA Engineer & Software Validation Specialist  
**Application:** Centurian Park Eats (CP-Eats)  
**Testing Method:** Static Code Analysis + Manual Workflow Simulation  
**Server URL:** `http://192.168.1.10:3000`

---

## 1. Executive Summary

CP-Eats is a peer-to-peer neighborhood food marketplace built on React 19 + Vite 6 + Supabase. It implements a dual-role system (Kitchen Seller / Customer Buyer) with real-time order tracking, social feed, PIN-based delivery verification, and an admin moderation panel.

**Overall Assessment: Application is NOT ready for production.**

The application demonstrates solid architectural intent and feature richness, but contains multiple critical functional bugs, data integrity risks, security concerns, and UI/UX inconsistencies that must be addressed before production release.

**Critical Findings Summary:**
- **2 Critical Functional Bugs** — Data loss / schema mismatch causing runtime failures
- **4 High Severity Bugs** — Broken workflows, auth edge cases, race conditions
- **6 Medium Severity Bugs** — UI/UX inconsistencies, validation gaps
- **3 Low Severity Bugs** — Minor polish, accessibility, edge cases

---

## 2. Testing Scope

### Features Exercised (via Code Analysis)

| Domain | Features Tested |
|--------|-----------------|
| **Authentication** | Google Sign-In, Session Persistence, Auth State Listener |
| **Onboarding** | Role Selection, Profile Creation, Address Registry, Handle Registry, MyGate Verification |
| **Kitchen Dashboard** | Orders Board, Menu Builder, Social Feed, Kitchen DMs, Settings, UPI Config, Ringtone |
| **Customer Dashboard** | Neighborhood Feed, Kitchen Directory, Menu Viewing, Cart/Checkout, Order Tracking, Reviews |
| **Cross-User Sync** | Realtime Firestore/Supabase listeners, Order propagation, Feed updates |
| **Admin Panel** | User status management, Review moderation |
| **Theme** | Dark/Light mode toggle, persistence |
| **Chat** | Order chat, UPI card sharing, QR display |

---

## 3. Persona-Specific Results

### 3.1 Kitchen (Seller) Persona

**Onboarding Flow:**
- ✅ Role selection UI works correctly (customer vs kitchen toggle)
- ✅ Kitchen handle normalization logic is correct (`@` stripping, lowercase, special char removal)
- ✅ 4-digit PIN validation enforces exact format (`/^\d{4}$/`)
- ✅ Address registry prevents duplicate flat registrations
- ✅ MyGate screenshot compression implemented
- ⚠️ **BUG:** Onboarding draft restoration intentionally skips large base64 images (profile photo, MyGate screenshot) — this is a UX gap, not a crash. Users lose uploaded images on accidental refresh.

**Menu Management:**
- ✅ Add menu item with name, price, description, category, veg/non-veg flags
- ✅ Custom category creation persists to kitchen document
- ✅ Toggle item availability (Available/Resting)
- ✅ Delete menu item with confirmation
- ✅ MOV (Minimum Order Value) configuration
- ⚠️ **BUG:** `requestKitchenPin()` always returns `true` — the security PIN prompt is **completely bypassed**. See Critical Bug #1.

**Social Feed:**
- ✅ Create feed post with image compression (≤250KB)
- ✅ AI Image Shield integration (via `/api/verify-image`)
- ✅ Tag menu items in posts
- ✅ Edit and delete posts
- ✅ Like/unlike functionality

**Orders & Payments:**
- ✅ Incoming order notifications with ringtone
- ✅ Accept/Decline order actions
- ✅ Status progression: PENDING → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED
- ✅ Delivery PIN verification handshake
- ✅ UPI payment request card generation
- ✅ Kitchen-to-kitchen DMs

**Settings:**
- ✅ Profile image upload with instant preview
- ✅ Custom ringtone upload to Supabase Storage
- ✅ Operating mode toggle (online/break/day_off/vacation)
- ✅ Delivery locations management
- ✅ Theme preference toggle
- ⚠️ **BUG:** Theme toggle uses `doc(db, "users", uid)` in KitchenDashboard but `updateDoc()` from Firestore-style API — **mixed database client usage** (see Critical Bug #2).

---

### 3.2 Customer (Buyer) Persona

**Onboarding:**
- ✅ Same address registry and anti-hijacking logic as kitchen
- ✅ Draft persistence for text fields

**Discovery:**
- ✅ Veg/Non-Veg filter on feed and directory
- ✅ Kitchen search by name and cuisine type
- ✅ Delivery coverage check (`checkKitchenDelivers`)
- ✅ Follow/unfollow kitchens
- ✅ Feed post liking with optimistic UI

**Menu Viewing:**
- ✅ Dietary filters (Veg, Gluten-Free, Nut-Free)
- ✅ Menu item images with enlargement
- ✅ Favorites toggle
- ✅ Add to cart (with add-on customization modal)

**Cart & Checkout:**
- ✅ Multi-kitchen cart detection with clear-cart prompt
- ✅ Quantity increment/decrement
- ✅ MOV warning for Self-Pickup orders
- ✅ Scheduling (ASAP vs later datetime)
- ✅ Order placement with 4-digit delivery PIN generation

**Order Tracking:**
- ✅ Active/Past order separation
- ✅ Reorder from past orders
- ✅ Real-time status updates with toast notifications
- ✅ Order detail view with progress indicator
- ⚠️ **BUG:** Progress indicator maps `ACCEPTED` to index 2 (same as `PREPARING`), but the UI shows "Preparing" as step 2. This is semantically confusing.

**Reviews:**
- ✅ Review dialog opens after delivery verification
- ⚠️ **BUG:** ReviewDialog inserts `isVerifiedHandshake: true` but the `reviews` table schema doesn't have this column — will cause Supabase error or silent failure. See Critical Bug #3.

---

## 4. Integration Results

### Cross-User Synchronization

| Test | Result | Notes |
|------|--------|-------|
| Kitchen creates menu item → Customer sees it | ⚠️ Partial | Works via Firestore `onSnapshot` on `menu_items` collection, but database.ts uses Supabase REST for some operations — potential sync gap |
| Kitchen publishes feed post → Customer sees it | ✅ Expected | `onSnapshot` on `feed_posts` collection |
| Customer places order → Kitchen sees it | ⚠️ Partial | Kitchen uses `onSnapshot` on `orders` collection with `kitchenId` filter |
| Kitchen updates order status → Customer sees it | ✅ Expected | Customer `onSnapshot` on `orders` collection |
| Kitchen toggles online/offline → Customer sees it | ✅ Expected | `kitchens` collection listener in CustomerDashboard |
| Customer likes post → Kitchen sees updated count | ⚠️ Partial | Likes are stored as array in Firestore; Kitchen doesn't display like counts |

### Data Flow Issues

1. **Mixed Database Clients:** The codebase imports from both `../db` (Firestore emulation via `db.ts`) and `../database` (Supabase REST via `database.ts`). This creates a **split-brain data architecture** where writes may go to one backend and reads from another, causing data inconsistency.

2. **Schema Drift:** `supabase-schema.sql` has columns like `taggedItemId`, `taggedItemName`, `taggedItemPrice` in `feed_posts` that the code no longer uses (replaced by `taggedItemIds` array). This creates schema confusion.

3. **Timestamp Handling:** Inconsistent timestamp formats — some code uses `new Date().toISOString()`, others use epoch milliseconds (`Date.now()`), and mappers do `new Date(data.createdAt).getTime()`. This can cause NaN values and broken sorting.

---

## 5. Technical Findings

### 5.1 Functional Bugs (Categorized by Severity)

#### 🔴 CRITICAL

**BUG-C1: Security PIN Bypass — `requestKitchenPin()` Always Returns `true`**  
**File:** `src/components/KitchenDashboard.tsx:183-185`  
**Severity:** Critical  
**Impact:** All "protected" kitchen actions (menu changes, UPI updates, feed posts, operating mode changes) bypass the 4-digit PIN security check. The function hardcodes `return true`.

```typescript
const requestKitchenPin = (_reason: string) => {
  return true;  // ← BUG: Always allows
};
```

**Expected:** Should prompt user for 4-digit PIN and validate against `kitchenDetails?.securityPin`.

---

**BUG-C2: Mixed Database Client Usage — Split-Brain Architecture**  
**Files:** `src/db.ts`, `src/database.ts`, multiple components  
**Severity:** Critical  
**Impact:** Components import from both `../db` (Firestore-style API) and `../database` (Supabase REST). Writes go to one backend, reads potentially from another, causing data loss and inconsistency.

Example from `KitchenDashboard.tsx:3`:
```typescript
import { collection, buildQuery, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, orderBy, limit, deleteField, doc, db, storage, ref, uploadBytes, getDownloadURL } from "../db";
```

While `App.tsx:3` uses:
```typescript
import { databaseService } from "./database";
```

The `database.ts` service uses Supabase REST API, while `db.ts` appears to be a Firestore emulation layer. Using both simultaneously on the same data will cause reads to miss writes.

---

**BUG-C3: ReviewDialog Schema Mismatch**  
**File:** `src/components/ReviewDialog.tsx:45`  
**Severity:** Critical  
**Impact:** `isVerifiedHandshake: true` is inserted into the `reviews` table, but `supabase-schema.sql` does not define this column. This will cause a Supabase error or silently fail.

```typescript
const reviewData = {
  // ...
  isVerifiedHandshake: true,  // ← Column doesn't exist in schema
};
```

---

#### 🟠 HIGH

**BUG-H1: Onboarding Draft Persistence Skips Images**  
**File:** `src/components/OnboardingView.tsx:60-67, 70-106`  
**Severity:** High  
**Impact:** Profile photos and MyGate screenshots are intentionally excluded from localStorage draft restoration. Users who refresh during onboarding lose uploaded images and must re-upload.

---

**BUG-H2: `databaseService.createOrder` Returns Local Object, Not DB Record**  
**File:** `src/database.ts:282-302`  
**Severity:** High  
**Impact:** The method returns the input `order` object, not the actual database-created record. If Supabase returns an `id` or other generated fields, they are lost. CustomerDashboard uses its own `setDoc` to Firestore instead.

```typescript
async createOrder(order: Order): Promise<Order> {
  const { data, error } = await supabase.from('orders').insert(...).select().single();
  if (error) throw error;
  return order;  // ← Returns input, not `data`
}
```

---

**BUG-H3: Auth Error State Not Cleared on Retry**  
**File:** `src/App.tsx:142-154`  
**Severity:** High  
**Impact:** If Google Sign-In fails, `authError` is set but never cleared when the user retries. The error message persists across attempts, confusing the user.

---

**BUG-H4: Race Condition in Kitchen Snapshot Listener**  
**File:** `src/components/KitchenDashboard.tsx:251-380`  
**Severity:** High  
**Impact:** The `useEffect` subscribes to multiple Firestore listeners but only cleans them up on unmount. If `currentProfile.uid` changes rapidly (e.g., account switching), multiple listeners accumulate, causing duplicate UI updates and memory leaks.

---

#### 🟡 MEDIUM

**BUG-M1: Cart Quantity Update Doesn't Recalculate Add-On Prices**  
**File:** `src/components/CustomerDashboard.tsx:693-708`  
**Severity:** Medium  
**Impact:** `updateCartQuantity` only changes the quantity field. The cart subtotal calculation in `handlePlaceOrder` does account for add-ons, but the UI quantity display doesn't show add-on totals per line item.

---

**BUG-M2: No Min/Max Validation on Price Input**  
**File:** `src/components/KitchenDashboard.tsx:1344-1351`  
**Severity:** Medium  
**Impact:** Menu item price input accepts any number including negative values, zero, or extremely large numbers. No `min="0"` or `max` attribute set.

---

**BUG-M3: Double-Tap Like Has No Undo Cooldown**  
**File:** `src/components/CustomerDashboard.tsx:505-535`  
**Severity:** Medium  
**Impact:** Rapid double-tapping can cause the optimistic UI to flicker between liked/unliked states before the server response resolves, leading to visual inconsistency.

---

**BUG-M4: Missing `isVerifiedHandshake` Column in Reviews Table**  
**File:** `src/components/ReviewDialog.tsx:45` / `supabase-schema.sql`  
**Severity:** Medium  
**Impact:** Inserting `isVerifiedHandshake` into reviews fails silently or errors. Reviews cannot be marked as PIN-verified, breaking the trust-seal feature.

---

**BUG-M5: Admin Panel Bypasses Role Check in App.tsx**  
**File:** `src/App.tsx:227-237`  
**Severity:** Medium  
**Impact:** `showAdminPanel` is a local state variable, not derived from `profile.role`. Any authenticated user could potentially access the admin panel if they manipulate the React state. The actual role check is only in `showAdminBtn` prop.

---

**BUG-M6: `checkKitchenDelivers` Uses String Split on Address**  
**File:** `src/components/CustomerDashboard.tsx:288-301`  
**Severity:** Medium  
**Impact:** The delivery check splits `loc` by `" - "` and expects at least 3 parts. If a location string doesn't match this exact format, delivery check silently fails, incorrectly showing "Self-Pickup Only".

---

#### 🟢 LOW

**BUG-L1: Progress Indicator Semantics**  
**File:** `src/components/CustomerDashboard.tsx:2070-2088`  
**Severity:** Low  
**Impact:** `ACCEPTED` and `PREPARING` both map to index 2 in the progress indicator. The UI shows "Preparing" as step 2 regardless, which is semantically confusing.

---

**BUG-L2: No Image Alt Text on Feed Images**  
**File:** `src/components/CustomerDashboard.tsx:1380-1386`  
**Severity:** Low (Accessibility)  
**Impact:** Menu item images lack meaningful alt text — only `alt={item.name}` which is okay but could be more descriptive for screen readers.

---

**BUG-L3: `animate-pulse` on Status Badges Creates Distraction**  
**File:** Multiple components  
**Severity:** Low (UI/UX)  
**Impact:** Pulsing animation on order status badges (`animate-pulse`) creates unnecessary visual noise and can trigger accessibility issues for users with motion sensitivity.

---

### 5.2 UI/UX & Theme Inconsistencies

| Issue | File | Severity |
|-------|------|----------|
| Dark mode classes applied to both `documentElement` and `body` — some CSS targets only `:root` | `src/App.tsx:104-110` | Medium |
| `shadow-3xs` and `shadow-xs` classes used but not defined in default Tailwind | Multiple components | Medium |
| Inconsistent border radius: `rounded-3xl` vs `rounded-2xl` vs `rounded-xl` used interchangeably | Multiple | Low |
| `bg-background-secondary` and `bg-background-primary` custom classes may not resolve without custom config | Multiple components | Medium |
| Toast messages use both `animate-scale-up` and `animate-fade-in` — inconsistent animation patterns | Multiple | Low |
| Loading spinner shows "CP" in a square but landing page logo shows "CP" in rounded-2xl — visual inconsistency | `App.tsx:174` vs `App.tsx:263` | Low |

### 5.3 Validation & Form Errors

| Issue | File | Severity |
|-------|------|----------|
| No email format validation on signup (delegated to Google OAuth) | `App.tsx:142` | Low |
| Phone number field accepts any string, no E.164 validation | `OnboardingView.tsx:617-624` | Medium |
| No character limit on `postDescription` (feed post) | `KitchenDashboard.tsx:60` | Medium |
| Comment field has `maxLength={220}` but no validation for empty/whitespace-only on backend | `CustomerDashboard.tsx:1697` | Low |
| Price input in menu builder accepts `NaN` if user enters non-numeric text | `KitchenDashboard.tsx:1344-1351` | Medium |
| No confirmation dialog before clearing cart when switching kitchens | `CustomerDashboard.tsx:646-653` | Low |

### 5.4 Console/API/Network Errors (Potential)

| Error | File | Severity |
|-------|------|----------|
| `JSON.parse` on `likes`, `taggedItemIds`, `items`, `participants`, `upCardData`, `taggedItemIds` in mappers — if DB stores malformed JSON, these crash | `database.ts:674, 678, 703, 732, 768` | High |
| `getRedirectResult()` error logged to console but not surfaced to user | `App.tsx:64-66` | Low |
| Storage upload failures for ringtone not retried | `KitchenDashboard.tsx:163-179` | Medium |
| `onSnapshot` error callbacks log to console but don't show user-facing errors | Multiple components | Medium |

---

## 6. Edge Cases & Stress Test Observations

### 6.1 Auth Edge Cases
- **Multiple Google Accounts:** `prompt: 'select_account'` forces account selection each time — good for multi-account testing, but may annoy single-account users.
- **Token Refresh:** `TOKEN_REFRESHED` events are correctly ignored to prevent app remount — **good defensive coding**.
- **Session Persistence:** Relies on Supabase Auth's default persistence. No custom session refresh logic.

### 6.2 Data Edge Cases
- **Empty Collections:** All list views have empty-state UI — **good**.
- **Null/Undefined Fields:** Mappers provide fallbacks (`|| 'pending'`, `|| ''`) — **good defensive coding**.
- **Large Base64 Images:** Client-side compression implemented (`compressImage`) — **good**. But no server-side size validation.
- **Concurrent Cart Modifications:** Cart is purely client-side state. If two tabs modify cart simultaneously, last write wins — **data loss risk**.
- **Order Status Rollback:** Kitchen dashboard allows status rollback (e.g., DELIVERED → PREPARING) via `isDisabledRollback` check — **business logic concern**.

### 6.3 Network/Offline
- No offline persistence or queue for failed writes.
- No retry logic for failed Firestore/Supabase operations.
- Network errors only logged to console, not surfaced to user.

---

## 7. Prioritized Recommendations

### P0 — Must Fix Before Production

1. **Implement actual PIN validation in `requestKitchenPin()`** (BUG-C1)
   - Show a modal/prompt asking for the 4-digit PIN
   - Validate against `kitchenDetails?.securityPin`
   - Block action if PIN is incorrect

2. **Resolve mixed database client architecture** (BUG-C2)
   - Choose ONE backend: either Supabase REST exclusively, or Firestore exclusively
   - Migrate all components to use the chosen backend consistently
   - Update `database.ts` to not duplicate Firestore-style methods

3. **Fix ReviewDialog schema mismatch** (BUG-C3)
   - Add `isVerifiedHandshake BOOLEAN DEFAULT FALSE` to `reviews` table in `supabase-schema.sql`
   - Or remove the field from ReviewDialog if not needed

### P1 — Should Fix Before Production

4. **Fix `createOrder` return value** (BUG-H2)
   - Return `data` (the actual DB record) instead of the input `order` object

5. **Add min/max validation to price inputs** (BUG-M2)
   - Add `min="0"`, `step="0.01"`, `max="99999"` attributes

6. **Fix auth error state persistence** (BUG-H3)
   - Clear `authError` at the start of `handleGoogleSignIn`

7. **Add cleanup logic for snapshot listeners on uid change** (BUG-H4)
   - Return cleanup functions from effects that re-run when `currentProfile.uid` changes

8. **Add `isVerifiedHandshake` column to reviews schema** (BUG-M4)

### P2 — Should Fix in Next Sprint

9. **Implement retry logic for failed network operations**
10. **Add character limit to feed post description**
11. **Fix progress indicator semantics** (BUG-L1)
12. **Add phone number validation (E.164 format)**
13. **Add server-side image size validation**
14. **Fix `checkKitchenDelivers` string parsing** (BUG-M6)
15. **Remove or replace `shadow-3xs`/`shadow-xs` with standard Tailwind classes**

### P3 — Nice to Have

16. **Restore images from onboarding draft** (or show placeholder with "re-upload" prompt)
17. **Add motion-sensitivity media query for `animate-pulse`**
18. **Add alt text improvements for accessibility**
19. **Add cart persistence to localStorage**
20. **Add order status change audit log**

---

## 8. Final Readiness Verdict

### ❌ NOT READY FOR PRODUCTION

**Blocking Issues:**
1. **Security PIN is completely bypassed** — all kitchen "protected" actions are unprotected
2. **Split-brain database architecture** — writes and reads go to different backends, causing data inconsistency
3. **ReviewDialog inserts non-existent column** — reviews cannot be saved with verification flag

**Recommendation:**
- Address all **P0** items immediately
- Re-test the full Kitchen → Customer order lifecycle after fixes
- Consider adding automated integration tests for the cross-user sync flows
- Deploy to a staging environment with real Supabase credentials before production

The application shows strong feature completeness and UI polish, but the critical security and data integrity issues must be resolved before any production deployment.
