# Setup

Local dev: Postgres 15 in Docker. No cloud account needed.

## Prerequisites

- Node 20+ and pnpm
- Docker Desktop

## First-time setup

```bash
git clone https://github.com/rizkyardiansyah/ottodot-booking-service.git
cd ottodot-booking-service
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm db:reset          # migrate + seed
pnpm dev               # http://localhost:3000
```

## `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ottodot
      POSTGRES_PASSWORD: ottodot
      POSTGRES_DB: ottodot
    ports:
      - "5443:5432"     # host:container. 5443 chosen to avoid common local conflicts.
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ottodot"]
      interval: 2s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

## `.env.example`

```
DATABASE_URL=postgres://ottodot:ottodot@localhost:5443/ottodot
```

## Migrations

Plain `.sql` files applied in filename order by `scripts/migrate.ts` (~45 lines). Applied migrations tracked in `schema_migrations` table.

## `pnpm db:reset` behavior

Runs `scripts/reset.ts` which:
1. Drops all tables (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
2. Runs `pnpm db:migrate` → applies all migrations from scratch
3. Runs `pnpm db:seed` → loads fixed-UUID seed data

Full recreate every time. Idempotent.

## `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "tsx scripts/reset.ts && pnpm db:migrate && pnpm db:seed"
  }
}
```

## Repo layout

```
.
├── CLAUDE.md
├── README.md
├── AI_USAGE.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── spec.md
│   ├── architecture.md
│   ├── testing.md
│   └── setup.md
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                    — parent booking flow
│   ├── _components/
│   │   └── parent-flow.tsx         — client component, 3-stage parent flow
│   ├── admin/
│   │   ├── page.tsx                — class list with occupancy
│   │   └── [classId]/page.tsx      — roster view
│   └── actions/
│       ├── booking.ts              — createBooking
│       ├── payment.ts              — confirmPayment
│       ├── roster.ts               — listAvailableClasses, listAllClasses, getBookingStatus, getClassRoster
│       ├── students.ts             — listStudents
│       └── types.ts                — ActionResult + shared shapes
├── lib/
│   └── db.ts                       — shared postgres.js pool
├── migrations/
│   └── 001_init.sql
├── scripts/
│   ├── env.ts                      — .env.local loader for standalone scripts
│   ├── migrate.ts
│   ├── seed.ts
│   └── reset.ts
├── tests/
│   ├── helpers.ts
│   ├── booking.test.ts
│   ├── payment.test.ts
│   ├── race.test.ts
│   └── roster.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.js
├── postcss.config.js
└── tailwind.config.ts
```
