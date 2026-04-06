# Campaign Manager

A full-stack Mini Campaign Manager — a simplified MarTech tool that lets marketers create, manage, and track email campaigns.

## Tech Stack

**Backend:** Node.js · Express · PostgreSQL · Sequelize · JWT · Zod · Jest  
**Frontend:** React 18 · TypeScript · Vite · TanStack Query · Zustand · Tailwind CSS

---

## Local Setup

### Option A — Docker Compose (recommended)

```bash
git clone <your-repo-url>
cd campaign-manager
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Demo credentials: `alice@example.com` / `password123`

Migrations and seed data run automatically on first boot.

### Option B — Manual Setup

**Prerequisites:** Node.js 20+, PostgreSQL 14+, Yarn

```bash
git clone <your-repo-url>
cd campaign-manager
yarn install
```

**Backend:**
```bash
cd packages/backend
cp .env.example .env
# Edit .env with your DB credentials

yarn db:migrate
yarn db:seed
yarn dev
```

**Frontend:**
```bash
cd packages/frontend
yarn dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

---

## Database Schema

```
users
  id UUID PK, email UNIQUE, name, password_hash, created_at

campaigns
  id UUID PK, name, subject, body TEXT
  status ENUM(draft|sending|scheduled|sent) DEFAULT draft
  scheduled_at TIMESTAMPTZ nullable
  created_by UUID FK→users, created_at, updated_at

recipients
  id UUID PK, email UNIQUE, name, created_at

campaign_recipients
  campaign_id UUID FK, recipient_id UUID FK  ← composite PK
  sent_at TIMESTAMPTZ nullable, opened_at TIMESTAMPTZ nullable
  status ENUM(pending|sent|failed) DEFAULT pending
```

**Indexes:**
- `campaigns(created_by)` — fast lookups for a user's campaigns
- `campaigns(status)` — filter by status without full scan
- `campaign_recipients(campaign_id)` — enumerate a campaign's recipients
- `campaign_recipients(recipient_id)` — enumerate a recipient's campaigns
- `campaign_recipients(status)` — aggregate stats without scanning all columns

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | — | Register user |
| POST | /auth/login | — | Login, returns JWT |
| GET | /campaigns | ✓ | List campaigns (paginated, filterable by status) |
| POST | /campaigns | ✓ | Create campaign |
| GET | /campaigns/:id | ✓ | Campaign detail + stats |
| PATCH | /campaigns/:id | ✓ | Update draft campaign |
| DELETE | /campaigns/:id | ✓ | Delete draft campaign |
| POST | /campaigns/:id/schedule | ✓ | Schedule campaign |
| POST | /campaigns/:id/send | ✓ | Async send (returns 202) |
| GET | /campaigns/:id/stats | ✓ | Sending stats |
| GET | /recipients | ✓ | List recipients |
| POST | /recipients | ✓ | Create recipient |

---

## Running Tests

```bash
# Requires a test database: campaign_manager_test
yarn test
```

Tests cover:
- Auth: register/login validation and error cases
- Business rules: draft-only edits, future scheduled_at, send idempotency, ownership checks
- Stats: rate calculation accuracy across pending/sent/failed states

---

## How I Used Claude Code

### 1. Tasks Delegated to Claude Code

- **Schema design** — Described the business domain; Claude produced the full Sequelize model definitions, migration files, and index strategy with explanations for each index choice.
- **Boilerplate scaffolding** — Generated the entire monorepo structure (yarn workspaces, Dockerfiles, Vite config, Tailwind setup) so I could focus on business logic.
- **Route implementation** — Drafted all Express route handlers including the async fire-and-forget send simulation.
- **Frontend pages** — Generated full React pages with React Query, Zustand auth store, and Tailwind styling from high-level descriptions.
- **Test scaffolding** — Generated the three test files with supertest setup and teardown patterns.

### 2. Real Prompts Used

**Prompt 1 — Schema & models:**
> "Design PostgreSQL tables for User, Campaign, Recipient, and CampaignRecipient with the following fields... Use Sequelize v6, UUID primary keys, and explain which indexes you'd add and why."

**Prompt 2 — Async send endpoint:**
> "Implement POST /campaigns/:id/send that returns 202 immediately, then in the background processes each recipient with a random 200–1500ms delay, marks each as sent (80%) or failed (20%), and sets the campaign status to 'sent' when all recipients are done. Use Sequelize, no job queue."

**Prompt 3 — Frontend detail page:**
> "Build CampaignDetail.tsx using React Query. When campaign.status === 'sending', set refetchInterval: 3000 to poll. Show conditional action buttons: draft gets Schedule + Send + Delete; scheduled gets Send; sending shows a spinner; sent shows nothing. Include a schedule modal with a datetime-local input that validates the selected time is at least 5 minutes in the future."

### 3. Where Claude Code Was Wrong or Needed Correction

- **Circular import in API client** — Claude initially imported the Zustand store directly inside `client.ts`, causing a circular dependency (`store → client → store`). Fixed by using a lazy accessor pattern: the interceptor reads `useAuthStore.getState()` at call time instead of at module load time.
- **Sequelize association alias mismatch** — Claude used `as: 'CampaignRecipients'` in one model and `as: 'campaignRecipients'` in another. Caught this during integration testing; standardized to match the model class name casing used by Sequelize's default behavior.
- **Background send race condition in tests** — The generated tests awaited the 202 response then immediately checked stats, finding them still at zero. Had to add a polling loop in the test to wait for background processing to complete.

### 4. What I Would Not Let Claude Code Do

- **Write the business rule enforcement** without review — The rules around status transitions (draft → scheduled → sent, cannot revert) are the core invariant of the system. I reviewed every condition check in the route handlers myself to ensure they were correct and complete, rather than trusting generated code blindly.
- **Design the database indexes** without understanding them — Claude suggested the indexes, but I verified the query patterns they optimize before accepting. Adding unnecessary indexes slows writes; missing a critical one tanks read performance.
- **Push to the repository** — All git operations (commits, branch naming, PR creation) were done manually to ensure the commit history is clean and intentional.

---

## Demo Script

```bash
# 1. Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","name":"Your Name","password":"secret123"}'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' | jq -r '.token')

# 3. Create a recipient
curl -X POST http://localhost:3001/recipients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"recipient@example.com","name":"Test Recipient"}'

# 4. Create a campaign (use the recipient ID from step 3)
curl -X POST http://localhost:3001/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Campaign","subject":"Hello World","body":"Campaign body text","recipientIds":["<recipient-id>"]}'

# 5. Send the campaign (returns 202, processes in background)
curl -X POST http://localhost:3001/campaigns/<campaign-id>/send \
  -H "Authorization: Bearer $TOKEN"

# 6. Check stats
curl http://localhost:3001/campaigns/<campaign-id>/stats \
  -H "Authorization: Bearer $TOKEN"
```
