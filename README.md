# Keeper

**One household, one shared budget, complete transparency.**

Keeper is a private shared household management web app built for roommates and friends sharing a rental house, denominated in **TZS (Tanzanian Shillings)**, powered by **Supabase** (Auth, PostgreSQL, Row-Level Security, Realtime) and **[Glisse](https://github.com/0kzh/glisse)** Liquid Glass UI effects.

## Features

- **User Accounts & Private Households**: Sign up, create a household or join an existing one with a private 6-character invite code.
- **Weekly Budget & Member Shares (TZS)**: Agree on a shared weekly pool target and per-member weekly share.
- **Contributions & Household Spending**: Record pooled contributions and shared expenses (Food & Groceries, Electricity & Water, House Rent, Security & Wi-Fi, Home Supplies, Errands & Transport).
- **Real-Time Sync**: Changes appear immediately across every roommate's device via Supabase Realtime.
- **Complete Transparency**: Every transaction records who logged it, what it was for, category, date, and TZS amount.

## Free Hosting Setup (Supabase + Vercel)

### 1. Create a Free Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new free project.
2. Open **SQL Editor** in your Supabase dashboard, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
3. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.

### 2. Run Locally
```bash
cp .env.example .env
# Paste VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY into .env
npm install
npm run dev
```
*(You can also click **Preview Demo Household (TZS)** on the sign-in screen to test the app immediately before adding Supabase keys.)*

### 3. Deploy Free on Vercel
1. Push this repo to GitHub (`https://github.com/realmadede/Keeper.git`).
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Click **Deploy**.

## Engineering Rules

This project uses [Skarp](https://github.com/realmadede/Skarp) coding guidelines (`AGENTS.md`, `GEMINI.md`, `EXAMPLES.md`).
