# SETTLR — End-to-End Plan: Idea → Production App Store Launch

## Context

`Settlr.pdf` is an investor business plan for an India-first shared-expense + settlement app. The `Settlr/` project directory is currently empty (just the PDF) — this is a greenfield build. The goal is to turn the business plan into a real, installable, production-ready mobile app that feels fast and trustworthy, built end-to-end by Claude Code.

Decisions locked in with the user before this plan:
- **No payment aggregator / no money movement through Settlr.** Settlement uses UPI "deep-link handoff": Settlr builds a UPI intent/QR, the user's existing UPI app (GPay/PhonePe/Paytm) completes the actual transfer, and Settlr just confirms it happened. This avoids RBI/PA-PG licensing entirely for MVP — matches the doc's own "Key Strategic Point" (don't assume in-app payment abstraction from day one).
- **Solo founder / very small team** → every infra choice should minimize ops burden (managed services over self-hosted).
- **Claude Code builds the app end-to-end** across future sessions, iterating phase by phase.
- **Lean MVP, 3-4 months to a store listing** (even soft/limited launch) → aggressive scope-cutting versus the full doc; AI/voice/OCR and monetization are explicitly deferred past MVP.

The plan below is the roadmap; no code is written in this planning turn.

## Tech Stack (chosen for solo-founder low-ops execution)

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **React Native + Expo (EAS)** | One codebase for iOS + Android, managed builds/OTA updates, no need to hand-manage Xcode/Android Studio signing for most of the loop |
| Backend/DB | **Supabase (Postgres + Auth + Storage + Edge Functions + Realtime)** | Real relational Postgres (ledger correctness needs ACID transactions, not NoSQL), built-in phone-OTP auth, row-level security for group/ledger data isolation, realtime balance updates, generous free tier — replaces the doc's Node/Redis/AWS stack with one managed service a solo founder can run |
| Push notifications | **Expo Push Notifications** | Native fit with Expo, no separate FCM/APNs plumbing needed initially |
| Crash/analytics | **Sentry (crashes) + PostHog (product analytics, self-serve free tier)** | Needed to track the doc's own success metrics (time-to-first-settlement, recurring usage, balance trust) |
| CI/CD | **EAS Build + EAS Submit + GitHub Actions** | Automates store builds/submission without manual cert wrangling |
| AI (post-MVP) | Claude API for structured extraction / voice-command parsing | Deferred to Phase 6; doc's own "AI Strategy" says utility layer, not headline |

This directly implements the doc's "Recommended AI Architecture" principle of a rules engine for ledger/payment logic — Postgres functions/transactions are that rules engine, not a generic backend service layer.

## Phased Roadmap

### Phase 0 — Foundations (Week 1-2)
- Initialize Expo (TypeScript) app + repo structure; set up Supabase project (dev + prod)
- Phone-number OTP auth (India-first, not email) via Supabase Auth
- Base navigation shell, design tokens (color/type/spacing), component primitives (buttons, inputs, sheets, cards)
- CI: lint/typecheck/test on push; EAS dev build profile

### Phase 1 — Core Ledger & Groups (Week 3-6)
This is the trust-critical core the doc calls "non-negotiable."
- Schema: `users`, `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, all in Postgres with RLS scoping every row to group membership
- Group creation + shareable invite links (deep link → join flow with minimal friction for non-users, per the doc's virality note)
- Expense entry: equal / exact / percentage splits
- Balance engine: per-person and per-group running balances, computed via a debt-simplification algorithm (minimize number of settling transactions) — implemented as a tested pure function, unit-tested heavily since correctness errors here directly damage trust (doc: "Trust failure around balances can kill the product")
- All ledger mutations wrapped in Postgres transactions/RPC functions for idempotency and auditability

### Phase 2 — Settlement Loop (Week 7-9)
- Generate UPI deep-link/QR (`upi://pay?pa=...&am=...&tn=...`) from a balance
- **Android:** launch via intent and capture the result code (SUCCESS/FAILURE/SUBMITTED) — this is the one platform where UPI apps return a real status to the caller
- **iOS:** no reliable programmatic confirmation exists for UPI intents, so use a two-way manual confirm: payer taps "I've paid" → recipient gets a prompt to confirm receipt (or auto-confirms after a timeout window) — keeps ledger state honest without a payment partner
- Settle-up flow wired to balances; notifications/reminders via Expo push
- "Share to WhatsApp" balance/recap cards (functional virality loop from the doc, no entertainment gimmicks)

### Phase 3 — Retention Features (Week 10-12)
- Recurring expenses (rent/utilities) with scheduled generation (Supabase Edge Function on cron)
- Smart reminders (pre-month-end nudges)
- Monthly recap screen (per group)
- Basic personal spend categorization (rule-based, not AI, for MVP)

### Phase 4 — Seamless UX Pass (Week 12-13, overlaps Phase 3)
Directly targets "make it feel seamless and attractive":
- Onboarding flow tuned for <60s to first group + first expense
- Empty states, skeleton loaders, optimistic UI updates on expense/settle actions
- Motion/haptics on settle-up and balance-clear moments (the "closure" feeling the doc emphasizes)
- Dark mode, accessibility pass (dynamic type, screen reader labels)
- Error/offline handling (no dead-ends, retry affordances)

### Phase 5 — Store Readiness & Compliance (Week 13-15)
- Privacy policy + ToS (financial-adjacent app — Apple/Google apply extra scrutiny even without money movement)
- Apple App Store privacy "nutrition label" + Play Data Safety form filled accurately
- Security pass: RLS audit, OTP rate limiting, no VPA/financial data logged in plaintext, dependency audit
- TestFlight (iOS) + Play Internal/Closed testing (Android) beta rounds with real users (target: friend groups/roommates per the doc's wedge segments)
- Store listing assets (screenshots, description built from the doc's "Split. Pay. Done." messaging), age rating, financial-app questionnaire answers
- Submit to both stores

### Phase 6 — Post-Launch (deferred, not in the 3-4 month MVP window)
Explicitly out of MVP scope per the doc's own "Features to Remove from v1" and the user's lean-timeline choice:
- Voice logging + receipt OCR (Claude API structured extraction)
- Premium subscription (RevenueCat + billing), couple/household premium mode, exports
- Referral rewards, campus ambassador tooling
- Anything from the doc's Phase 4 (merchant partnerships, lending) — not planned at all near-term

## What Gets Cut vs. the Original Doc (and why)

- No Node/Redis/AWS self-hosted stack → Supabase, since one person cannot run that ops load
- No payment aggregator integration → UPI deep-link only, per user decision
- No AI/voice/OCR in MVP → doc itself recommends this as Phase 2, and lean timeline confirms deferral
- No monetization in MVP → premium tier is Phase 6; MVP must prove the core loop first, matching the doc's "growth depends on free core usage" principle

## Verification Plan (once building starts)

- Unit tests for the debt-simplification/balance engine (property-based tests: balances must always sum to zero across a group)
- Integration tests against a local Supabase instance for RLS policies (a user must never read another group's ledger)
- Manual E2E pass of the golden path each phase: create group → add expense → see balance → settle via UPI intent → balance clears
- TestFlight/Play beta with a real roommate/travel group before public listing, tracking the doc's own success metrics (time to first settled transaction, recurring usage)

## Amendments Since Original Plan

- **Auth:** switched from phone-OTP (as originally planned) to **email OTP** for now, since no SMS/phone-OTP provider is free at production scale. Phone OTP can be added later before public launch. Email OTP requires custom SMTP (Supabase's built-in email sending only reaches the project owner's own inbox and is rate-limited to a couple of messages/hour) — wired up via **Resend's free tier** (3,000 emails/month) as the SMTP provider, sending from `onboarding@resend.dev` until a real domain is set up.
- **Navigation:** built on **Expo Router** (file-based routing) rather than plain React Navigation, since it has a built-in `Stack.Protected` auth-guard pattern and will make Phase 1's invite-link deep-linking simpler.
- **Expo SDK:** pinned to **SDK 54** rather than the newest SDK 57, because the publicly released Expo Go app doesn't yet support SDK 57 — needed for the plain Expo Go dev workflow to work during development. Can revisit once Expo Go catches up, or move to EAS dev/production builds regardless by Phase 5.
