# Keeper

**One household, one shared budget, complete transparency.**

Keeper is a private shared household ledger built for roommates and friends sharing a house, denominated in **TZS (Tanzanian Shillings)**, powered by **React 19**, **TypeScript**, **Tailwind CSS v4**, **[Glisse](https://github.com/0kzh/glisse)** Liquid Glass controls, and **Supabase** (Auth, PostgreSQL, Row-Level Security, and Realtime).

---

## Complete Feature Overview

- **Private Households & 8-Character Invite Keys**: Create a household or join an existing one using an 8-character alphanumeric invite key or a direct `?join=CODE` invite link (both clicking the link and pasting the full URL work automatically).
- **Email & Google OAuth Sign-In**: Instant account creation with email/password or 1-tap Google OAuth, plus custom branded password recovery emails ([`supabase/templates/recovery.html`](./supabase/templates/recovery.html)).
- **Weekly & Monthly Views (`W1–W5`)**: Switch between `This Week`, `Last Week`, `2 Weeks Ago`, `This Month`, and `Last Month`, with automatic Monday–Sunday daily bars or `W1–W5` weekly buckets.
- **All-Time Carry-Over Cash on Hand Pool**: Tracks both the active period's remaining balance and the all-time carry-over house pool (`Total All-Time Contributions - Total All-Time Expenses`).
- **Contributions & Paid-By Attribution**: Log pooled contributions (including treasurers recording a contribution on behalf of another roommate) and categorized household expenses (`Food & Groceries`, `Electricity & Water`, `House Rent`, `Security & Internet`, `House Supplies`, `Transport & Gas`).
- **Recurring Bills Due-Date Tracker**: Track monthly or multi-month house bills (rent, Wi-Fi, water, security) separately from weekly contributions, with `Split by all (N)` vs. `Paid by 1 member`, 1-tap roommate payback checkmarks, and optional leftover pool money usage.
- **Shared House Needs Shopping List**: Add needed items with optional quantity and estimated TZS price, view live per-member shopping totals, mark items bought with actual price paid, split or track 1-member paybacks, and optionally apply leftover pool cash.
- **Member Totals & Statements**: View every roommate's combined out-of-pocket total across weekly pool contributions, bills, and needs (with pending payback balances and 1-tap WhatsApp statement copy).
- **Multi-Field Ledger Search, WhatsApp Summary & CSV Export**: Search hundreds of transactions by description, roommate, category, date, or TZS amount; copy a formatted weekly/monthly WhatsApp summary in one tap; or export filtered records to CSV.
- **Admin & Account Controls**: Household admins can rename the house, rotate the invite key (revoking old codes), promote members to admin, or remove a roommate. Every member can customize their display name and avatar color, leave a household, or permanently delete their account.

---

## Android App (`Android` Branch)

Keeper has a **separate standalone Android app** maintained on the [`Android`](https://github.com/realmadede/Keeper/tree/Android) branch (built with **Capacitor**):

- **Detached from the web landing page**: Opens into a 3-slide native onboarding flow matching Keeper's warm-stone, obsidian, and brass design, with native status bar styling, custom Keeper launcher icon, and Android hardware Back button support.
- **Same live data & features**: Connects to the same Supabase backend and real-time sync as the web app on `main`.
- **Direct APK download**: Pushes to the `Android` branch automatically build `Keeper.apk` via GitHub Actions (`.github/workflows/android-apk.yml`) and publish it to GitHub Releases — linked directly from the **Download for Android** button on the web landing page.
- **Local build & USB phone install** (on the `Android` branch):
  ```bash
  git checkout Android
  npm ci
  ANDROID_HOME=$HOME/Android/Sdk npm run android:apk
  npm run android:install   # installs directly onto a USB-connected Android phone
  ```

---

## 5-Minute Setup & Self-Hosting Guide

### Option A: Run Locally in Demo Mode (Zero Backend Setup)

You can run and test every screen of Keeper immediately without configuring Supabase:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and click **Preview demo household** on the welcome or sign-in screen. Demo Mode loads a realistic Dar es Salaam shared household in TZS and persists your local changes in `localStorage`.

### Option B: Connect Supabase & Deploy on Vercel

#### 1. Configure Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Apply the database schema using **either** method:
   - **Automatic Git Migrations**: Connect this repository to your Supabase project; Supabase automatically detects [`supabase/config.toml`](./supabase/config.toml) and applies the timestamped SQL migrations in [`supabase/migrations/`](./supabase/migrations/).
   - **Manual SQL Editor**: Open **SQL Editor** in the Supabase Dashboard, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
3. In **Authentication → Providers → Email**, turn off **Confirm email** if you want new accounts to enter Keeper immediately after sign-up.
4. *(Optional)* In **Authentication → Providers → Google**, enable Google OAuth with your Google Cloud OAuth Client ID and Secret, and set your **Site URL** under **Authentication → URL Configuration**.
5. Copy your **Project URL** and **anon public key** from **Project Settings → API**.

#### 2. Configure Local Environment
```bash
cp .env.example .env
```
Add your keys to `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```
*(Once real Supabase credentials are set, the Demo Mode button automatically hides itself.)*

#### 3. Deploy on Vercel
1. Import the repository at [vercel.com/new](https://vercel.com/new) (leave **Root Directory** as `./`).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Environment Variables**.
3. Click **Deploy**. Security headers and SPA routing are pre-configured in [`vercel.json`](./vercel.json).

---

## Architecture & Security Overview

- **Strict Multi-Tenant Row-Level Security (RLS)**: Every table (`profiles`, `households`, `household_members`, `transactions`, `household_needs`, `recurring_bills`, `invite_join_attempts`) has RLS enabled. Helper functions `is_household_member()` and `is_user_in_household()` enforce complete isolation so a user can only read or write data belonging to their own household.
- **Brute-Force & Write Rate Limiting**:
  - `join_household_by_code()` logs failed invite code guesses in `invite_join_attempts` and blocks brute-force guessing after **5 failed attempts within 15 minutes** (using an 8-character unambiguous alphabet with $32^8 \approx 1.1\times 10^{12}$ combinations).
  - `guard_transaction_insert()` enforces a database-level write limit of **30 transactions per 10 minutes per user** and verifies that any `paid_by` user is a member of the same household.
- **Immutable Server-Side Audit Triggers**: `guard_transaction_update()` locks `id`, `household_id`, `recorded_by`, and `created_at` on the server and forces `updated_at = now()`, ensuring no client can spoof authorship or hide edits.
- **Hardened Client & Transport Layer**:
  - Supabase Auth uses the **PKCE** flow (`flowType: "pkce"`).
  - CSV exports neutralize spreadsheet formula-injection payloads (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - [`vercel.json`](./vercel.json) enforces a strict Content-Security-Policy (CSP), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Verification & Engineering Guidelines

```bash
npm run typecheck   # TypeScript strict check
npm test            # Vitest unit test suite (analytics, export, security)
npm run build       # Production bundle build
```

This repository follows the [Skarp](https://github.com/realmadede/Skarp) engineering guidelines in [`AGENTS.md`](./AGENTS.md), [`GEMINI.md`](./GEMINI.md), and [`EXAMPLES.md`](./EXAMPLES.md).
