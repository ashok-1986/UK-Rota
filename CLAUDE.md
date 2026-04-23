\# CareRota — Claude Code Context



\## What this is

CareRota is a B2B multi-tenant SaaS for UK care homes that replaces paper/spreadsheet

rota management. It enforces UK Working Time Regulations, provides audit logs for CQC

compliance, and handles staff scheduling across Early/Late/Night shifts.



Solopreneur project. Pre-MVP. Every decision optimises for: shipping fast, staying

compliant, and keeping costs near zero until revenue justifies spend.



\---



\## Current status (as of April 2026)



\### Auth migration in progress: Clerk → Kinde

\- \*\*Phase 1\*\* — Install Kinde, stub middleware, replace sign-in/sign-up pages

\- \*\*Phase 2\*\* — Rebuild RBAC middleware, restore role-based routing, replace all

&#x20; `auth()` / `currentUser()` calls with `getKindeServerSession()`

\- \*\*Phase 3\*\* — Rename `clerk\_user\_id` → `kinde\_user\_id` in DB, replace Clerk

&#x20; webhook with Kinde webhook, remove all Clerk dependencies



Do NOT reintroduce Clerk imports. Do NOT rename `clerk\_user\_id` until Phase 3 is

explicitly started.



\### Known issues fixed (do not reintroduce)

\- `page.tsx` had inverted redirect logic — `repaired` truthy was going to

&#x20; `/account-not-linked` instead of falling through to dashboard

\- `dashboard/layout.tsx` was reading `sessionClaims` (stale JWT) instead of

&#x20; `currentUser()` — now fixed

\- `middleware.ts` was returning 403 on RSC prefetch requests (`\_rsc` param /

&#x20; `RSC: 1` header) due to tenant isolation check firing before session loaded

\- Duplicate shifts in DB (seed ran twice) — cleaned via SQL, 3 rows remain



\---



\## Tech stack



| Layer | Technology | Region |

|-------|-----------|--------|

| Framework | Next.js 16.2.3 App Router (Turbopack) | — |

| Language | TypeScript 5.5 | — |

| Database | Neon PostgreSQL serverless | eu-west-2 (EU-London) |

| Auth | Kinde (migrating from Clerk) | EU |

| Hosting | Vercel | lhr1 (London) |

| Email | Resend | — |

| SMS | Twilio (optional) | — |

| Styling | Tailwind CSS 3.4 | — |



\*\*Data sovereignty rule: ALL services must be EU/UK region. No exceptions.

Never suggest US-only services for any data-touching layer.\*\*



\---



\## Repository structure



```

src/

├── app/

│   ├── page.tsx                          # Root — auth check + role-based redirect

│   ├── layout.tsx                        # Root layout — KindeProvider (was ClerkProvider)

│   ├── dashboard/

│   │   ├── layout.tsx                    # Dashboard shell — nav + auth guard

│   │   └── rota/\[homeId]/\[week]/         # Main rota view

│   ├── homes/\[homeId]/

│   │   ├── staff/                        # Staff management

│   │   └── settings/rules/              # Rules engine config

│   ├── staff/rota/                       # Care staff view (read-only shifts)

│   ├── sign-in/\[\[...rest]]/             # Kinde LoginLink

│   ├── sign-up/\[\[...sign-up]]/          # Kinde RegisterLink

│   ├── account-not-linked/              # No staff record found

│   └── api/

│       ├── auth/

│       │   ├── kinde/\[kindeAuth]/        # Kinde API route handler

│       │   ├── signup-home/             # system\_admin only

│       │   └── 2fa-enable/              # Stub — Phase 2

│       ├── rota/

│       │   ├── assign/                  # POST — assign staff to shift

│       │   ├── publish/                 # POST — publish rota week

│       │   ├── gaps/                    # GET — unfilled shifts

│       │   └── shifts/\[id]/            # GET/PATCH/DELETE individual shift

│       ├── staff/                       # CRUD staff records

│       ├── shifts/                      # CRUD shift templates

│       ├── homes/                       # Home management

│       ├── units/                       # Unit/ward management

│       ├── rules/                       # Rules engine

│       ├── reports/

│       │   ├── hours-csv/              # Export hours CSV

│       │   └── weekly-pdf/             # Export weekly PDF

│       ├── notify/

│       │   ├── shift-reminders/        # Cron — daily 18:00

│       │   └── gap-alerts/             # Cron — Monday 09:00

│       ├── admin/

│       │   └── retention-cleanup/      # Cron — monthly, GDPR purge

│       ├── setup/first-home/           # First-time setup

│       └── webhooks/

│           └── clerk/                  # TO BE REPLACED with Kinde webhook

├── components/

│   └── landing/LandingPage.tsx

├── lib/

│   ├── db.ts                           # Neon SQL client — DO NOT MODIFY

│   ├── audit.ts                        # writeAuditLog()

│   └── notify.ts                       # sendShiftReminder(), sendGapAlert()

├── types/index.ts                      # AppRole, Staff, Shift, RotaShift etc.

└── middleware.ts                       # Auth + RBAC + tenant isolation

```



\---



\## Database schema (Neon PostgreSQL)



\### Tables

\- `homes` — tenant root. `id` (UUID), `name`, `address`, `email`, `timezone`

&#x20; (default `Europe/London`), `max\_staff`, `is\_active`, `clerk\_org\_id` (legacy)

\- `units` — wards within a home. `home\_id` FK

\- `staff` — users. `clerk\_user\_id` (→ becomes `kinde\_user\_id` in Phase 3),

&#x20; `home\_id`, `unit\_id`, `role`, `employment\_type`, `contracted\_hours`,

&#x20; `max\_hours\_week` (default 48), `night\_shifts\_ok`, soft-delete via `deleted\_at`

\- `shifts` — templates per home. Early (07:00–15:00), Late (14:00–22:00),

&#x20; Night (22:00–07:00). 3 rows, no duplicates.

\- `rota\_shifts` — assignments. `staff\_id` nullable (unfilled slot), `week\_start`

&#x20; always Monday, `status`: draft → published → confirmed | cancelled

\- `rules` — per-home WTR config. Types: `min\_rest\_hours` (11),

&#x20; `max\_weekly\_hours` (48), `max\_consecutive\_days` (6)

\- `logs` — audit trail. 3-year retention. `actor\_id`, `home\_id`, `action`,

&#x20; `entity\_type`, `entity\_id`, `metadata\_json`

\- `shift\_swaps` — swap requests between staff (table exists in schema)

\- `staff\_availability` — availability preferences (table exists in schema)



\### Query patterns

\- Always filter by `home\_id` first (tenant isolation)

\- Staff queries: always add `AND deleted\_at IS NULL AND is\_active = TRUE`

\- Rota queries: use `week\_start` for weekly grouping

\- Never use `SELECT \*` in production queries — list columns explicitly



\---



\## Roles and access control



```

AppRole = 'system\_admin' | 'home\_manager' | 'unit\_manager' | 'care\_staff' | 'bank\_staff'

```



| Role | Access |

|------|--------|

| `system\_admin` | All homes, all routes, bypasses tenant isolation |

| `home\_manager` | Their home only, all manager routes |

| `unit\_manager` | Their home only, manager routes except home settings |

| `care\_staff` | Their home only, read-only — `/staff/rota` view |

| `bank\_staff` | Same as care\_staff |



Role and `homeId` are stored as Kinde custom claims (were Clerk `publicMetadata`).

Middleware reads them from JWT and injects as headers:

\- `x-home-id` — used by all API routes for tenant scoping

\- `x-user-role` — used by API routes for permission checks



\---



\## Middleware rules (middleware.ts)



Public routes (no auth):

\- `/`, `/sign-in(.\*)`, `/sign-up(.\*)`, `/account-not-linked(.\*)`,

&#x20; `/privacy`, `/api/webhooks/kinde`, `/api/setup/first-home(.\*)`



Cron routes (Bearer token, `CRON\_SECRET`):

\- `/api/notify/(.\*)`, `/api/admin/(.\*)`



Manager-only routes:

\- `/homes/(.\*)/settings(.\*)`, `/api/staff(.\*)`, `/api/shifts(.\*)`,

&#x20; `/api/units(.\*)`, `/api/rules(.\*)`, `/api/rota/assign(.\*)`,

&#x20; `/api/rota/publish(.\*)`, `/api/reports(.\*)`, `/api/homes(.\*)`



Admin-only routes:

\- `/api/auth/signup-home(.\*)`



\*\*RSC prefetch bypass\*\*: requests with `RSC: 1` header or `?\_rsc=` param must

skip tenant isolation check — they fire before session is fully loaded and will

return 403 otherwise, causing a visible redirect loop in the browser.



\---



\## Vercel cron jobs (vercel.json, region: lhr1)



| Cron | Schedule | Purpose |

|------|----------|---------|

| `/api/notify/shift-reminders` | Daily 18:00 | Email + SMS reminders to staff |

| `/api/notify/gap-alerts` | Monday 09:00 | Alert managers of unfilled shifts |

| `/api/admin/retention-cleanup` | 1st of month 02:00 | GDPR data purge |



\---



\## Environment variables



```bash

\# Database

DATABASE\_URL                          # Neon — eu-west-2



\# Auth (Kinde — replacing Clerk)

KINDE\_CLIENT\_ID

KINDE\_CLIENT\_SECRET

KINDE\_ISSUER\_URL                      # https://carerota.kinde.com

KINDE\_SITE\_URL                        # https://uk-rota.vercel.app

KINDE\_POST\_LOGOUT\_REDIRECT\_URL        # https://uk-rota.vercel.app

KINDE\_POST\_LOGIN\_REDIRECT\_URL         # https://uk-rota.vercel.app/dashboard



\# Email

RESEND\_API\_KEY

RESEND\_FROM\_EMAIL



\# SMS

TWILIO\_ACCOUNT\_SID

TWILIO\_AUTH\_TOKEN

TWILIO\_FROM\_NUMBER



\# App

NEXT\_PUBLIC\_APP\_URL                   # https://uk-rota.vercel.app

CRON\_SECRET                           # Random secret for cron route auth



\# Retention

RETENTION\_ROTA\_MONTHS=12

RETENTION\_LOGS\_YEARS=3

```



\---



\## Compliance constraints (non-negotiable)



\- \*\*UK GDPR / Data Protection Act 2018\*\* — all PII in EU/UK regions only

\- \*\*Working Time Regulations 1998\*\* — enforced in rules engine:

&#x20; - Min 11 hours rest between shifts

&#x20; - Max 48 hours/week

&#x20; - Max 6 consecutive days

\- \*\*CQC alignment\*\* — all rota actions written to audit log with actor, timestamp,

&#x20; and entity. Logs retained 3 years.

\- \*\*Soft deletes only\*\* — never hard-delete staff records. Use `deleted\_at`.

&#x20; Anonymise within 30 days of deletion request.

\- \*\*No clinical/health/resident data\*\* — CareRota handles scheduling only.



\---



\## Coding conventions



\- TypeScript strict mode. No `any` unless genuinely unavoidable — prefer `unknown`

&#x20; with type guards.

\- SQL via `sql` tagged template from `src/lib/db.ts` — never string-concatenate

&#x20; queries.

\- All API routes check `x-home-id` header for tenant scoping — never trust

&#x20; user-supplied `homeId` from request body for security decisions.

\- Audit log every state-changing action via `writeAuditLog()` from `src/lib/audit.ts`.

\- Error responses: `{ error: string }` with appropriate HTTP status.

\- Date formats: `YYYY-MM-DD` strings for dates, `HH:mm:ss` for times. No Date

&#x20; objects crossing API boundaries.

\- Week always starts Monday. `week\_start` is always the Monday ISO date.



\---



\## What NOT to do



\- Do not add new dependencies without checking EU data residency

\- Do not use `sessionClaims` to read role/homeId — always use `getKindeServerSession()`

&#x20; which hits the Kinde API directly (fresh, not cached JWT)

\- Do not hard-delete any staff, rota, or log records

\- Do not store any data outside Neon (no Redis, no external caches for PII)

\- Do not trust `homeId` from request body — always read from `x-home-id` header

&#x20; set by middleware

\- Do not add Clerk imports — migration to Kinde is in progress

\- Do not rename `clerk\_user\_id` column until Phase 3 of auth migration is

&#x20; explicitly started



\---



\## Current migration checkpoint



\*\*Completed:\*\*

\- Phase 1: Kinde installed, sign-in/sign-up pages updated, middleware stubbed,

&#x20; `ClerkProvider` → `KindeProvider`



\*\*In progress:\*\*

\- Phase 2: Rebuild full RBAC middleware with Kinde claims, restore role-based

&#x20; routing in `page.tsx` and `dashboard/layout.tsx`



\*\*Pending:\*\*

\- Phase 3: Rename `clerk\_user\_id` → `kinde\_user\_id`, replace Clerk webhook,

&#x20; remove all remaining Clerk code

```



\---

