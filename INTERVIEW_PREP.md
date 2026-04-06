# Interview Prep — Mini Campaign Manager

---

## 1. "Walk me through your project."

> "I built a full-stack Campaign Manager using a **yarn monorepo** with two packages: a Node/Express/PostgreSQL backend and a React/TypeScript frontend. The core idea is a marketer can create email campaigns, attach recipients, schedule them, and send them — with real-time send-progress tracking.
>
> On the backend I used **Sequelize** for ORM, **JWT** for authentication, and **Zod** for input validation. The most interesting backend feature is the **asynchronous send simulation** — when you hit POST /send, it returns `202 Accepted` immediately and processes each recipient in the background, randomly marking them sent or failed, then transitions the campaign to `sent`.
>
> On the frontend I used **React Query** with a 3-second polling interval when a campaign is in `sending` state, **Zustand** for auth state with localStorage persistence, and **Tailwind CSS** for styling."

---

## 2. Schema Design Questions

### "Why did you design the schema this way?"

**4 tables:**
- `users` — app accounts with hashed passwords
- `campaigns` — the email itself (name, subject, body, status, scheduled_at)
- `recipients` — a **global** recipient list, not per-user. Any campaign can reuse any recipient.
- `campaign_recipients` — join table with **extra columns**: `sent_at`, `opened_at`, `status`

> "The key decision was making recipients **global** rather than user-scoped. In a real MarTech tool, marketers often re-use the same contact lists. A `campaign_recipients` join table lets me track **per-recipient send state** without denormalizing anything — I know exactly which recipient got which email, when, and whether it failed."

### "Why a join table with extra fields instead of storing stats on the campaign?"

> "If I stored `sent_count` on the campaign row, I'd need to update it atomically with every recipient update — that's a concurrency nightmare under load. By reading `campaign_recipients` directly at query time, stats are always accurate with no sync issues. The trade-off is a slightly heavier read query, but it's indexed so it's fast."

### "What indexes did you add and why?"

```sql
idx_campaigns_created_by      -- fast "show me my campaigns" list query
idx_campaigns_status          -- fast status filter (draft/sent/etc)
idx_campaign_recipients_campaign_id   -- enumerate a campaign's recipients
idx_campaign_recipients_recipient_id  -- enumerate a recipient's history
idx_campaign_recipients_status        -- aggregate stats without full scan
```

> "Every index maps to a specific query pattern. `created_by` is hit on every `GET /campaigns` request. The `campaign_recipients` indexes cover both the join direction (campaign → recipients) and the stats aggregation (GROUP BY status). I didn't add indexes on columns that aren't queried — unnecessary indexes slow down writes."

### "What is the status flow for a campaign?"

```
draft → scheduled (POST /schedule with future date)
draft → sending   (POST /send)
scheduled → sending (POST /send)
sending → sent    (background process completes)
```

> "Only `draft` campaigns can be edited or deleted. Once something is `sent` it's immutable — that's a hard business rule enforced at the route level, not just the model level."

---

## 3. API Design Questions

### "Why did you return 202 on POST /send?"

> "HTTP `202 Accepted` means: 'I received your request and it's being processed, but it's not done yet.' Returning `200 OK` would be a lie — the recipients aren't sent yet. `202` is the semantically correct status for async work. The client then polls `GET /campaigns/:id` every 3 seconds until status changes from `sending` to `sent`."

### "How does the async send work?"

```js
// In the route handler:
campaign.status = 'sending';
await campaign.save();
processSend(campaign.id); // fire-and-forget — NOT awaited
res.status(202).json({ message: 'Send initiated', campaign });

// processSend runs in background:
async function processSend(campaignId) {
  const records = await CampaignRecipient.findAll({ where: { campaign_id: campaignId, status: 'pending' } });
  for (const record of records) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 1300)); // random delay
    const success = Math.random() < 0.8; // 80% sent, 20% failed
    record.status = success ? 'sent' : 'failed';
    record.sent_at = success ? new Date() : null;
    await record.save();
  }
  await Campaign.update({ status: 'sent' }, { where: { id: campaignId } });
}
```

> "The `processSend` function is never awaited — it runs in the Node.js event loop after the response is sent. This is the simplest possible async pattern without a job queue. In production I'd use **Bull** or **BullMQ** with Redis for reliability, retry logic, and observability."

### "Why 409 on double-send?"

> "If someone hits /send twice quickly, the second call would find the campaign already in `sending` or `sent` state. Returning `409 Conflict` clearly communicates 'this action conflicts with the current resource state' rather than silently doing nothing or returning a confusing 400."

### "How do you handle authorization — can user A see user B's campaigns?"

```js
async function findOwnedCampaign(campaignId, userId) {
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new AppError('Campaign not found', 404);
  if (campaign.created_by !== userId) throw new AppError('Forbidden', 403);
  return campaign;
}
```

> "Every mutating endpoint (PATCH, DELETE, schedule, send) calls `findOwnedCampaign` which checks `created_by === req.user.id`. If not, it throws a 403. The GET endpoint returns 404 for other users' campaigns rather than 403, to avoid leaking the existence of campaigns."

### "How does stats calculation work?"

```js
function computeStats(campaignRecipients) {
  const total = campaignRecipients.length;
  const sent = campaignRecipients.filter(cr => cr.status === 'sent').length;
  const failed = campaignRecipients.filter(cr => cr.status === 'failed').length;
  const opened = campaignRecipients.filter(cr => cr.opened_at !== null).length;
  const open_rate = sent > 0 ? Math.round((opened / sent) * 100 * 100) / 100 : 0;
  const send_rate = total > 0 ? Math.round((sent / total) * 100 * 100) / 100 : 0;
  return { total, sent, failed, opened, open_rate, send_rate };
}
```

> "Stats are computed on-the-fly from `campaign_recipients` rows. `open_rate` is opened/sent (not opened/total) because you can only open an email that was delivered. Both rates are rounded to 2 decimal places."

---

## 4. Security Questions

### "How do you store passwords?"

> "With `bcryptjs` using **10 salt rounds**. BCrypt is slow by design — it makes brute-force attacks expensive. I never store plaintext passwords, never log them, and never return `password_hash` in any API response."

### "How does JWT auth work in your app?"

```js
// Signing on login:
const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Verifying on each request:
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;
```

> "The JWT payload contains user `id` and `email`. It's signed with a secret from `.env`. The middleware extracts the Bearer token from the `Authorization` header, verifies it, and attaches the decoded payload to `req.user`. Expired tokens get a specific 401 error message so clients know to re-login."

### "What input validation do you use?"

> "Zod on every endpoint. It validates types, string lengths, UUID formats, and ISO datetime strings. If validation fails, Zod throws an error that the global error handler catches and returns as a structured 400 with the exact field errors. This prevents garbage data entering the database and protects against SQL injection through query parameterization."

---

## 5. Frontend Architecture Questions

### "Why Zustand over Redux?"

> "Zustand is much simpler for this use case. Auth state is just `{ token, user }` with two actions. Redux would require actions, reducers, selectors, and a store config — all for state that fits in 30 lines of Zustand. The requirement said 'Zustand **or** Redux' and I chose the right tool for the complexity level."

### "Why React Query? What does it give you?"

> "React Query manages server state — caching, background refetching, loading/error states, and deduplication. Without it I'd be writing `useEffect` + `useState` + manual loading flags on every page. The killer feature here is `refetchInterval: 3000` on the campaign detail page — when a campaign is in `sending` state, React Query automatically polls every 3 seconds and updates the UI without any extra code."

### "How do you handle the circular dependency between the API client and auth store?"

> "The naive approach is to import the Zustand store directly in `client.ts`, but Zustand's store imports `client.ts` for API calls — circular import. I solved it with **lazy initialization**: `initApiClient(getToken, clearAuth)` is called once at app startup in `main.tsx`, passing store accessor functions as closures. The Axios interceptors call `getToken()` at request time, not at module load time, so there's no circular dependency."

```ts
// client.ts
let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function initApiClient(tokenGetter: () => string | null, clearAuth: () => void) {
  getToken = tokenGetter;
  onUnauthorized = clearAuth;
}

// main.tsx
initApiClient(
  () => useAuthStore.getState().token,
  () => useAuthStore.getState().clearAuth(),
);
```

### "How does the polling work in the frontend?"

```ts
const { data: campaign } = useQuery({
  queryKey: ['campaign', id],
  queryFn: () => getCampaign(id!),
  refetchInterval: campaign?.status === 'sending' ? 3000 : false,
});
```

> "React Query's `refetchInterval` accepts a value or `false`. When the campaign status is `sending`, it polls every 3 seconds. When it becomes `sent`, `refetchInterval` returns `false` and polling stops automatically. No manual timers, no cleanup."

---

## 6. Testing Questions

### "What do your tests cover?"

Three test files with ~30 test cases total:

1. **`auth.test.js`** — register/login happy paths, duplicate email (409), wrong password (401), missing fields (400)

2. **`campaigns.test.js`** — the core business rules:
   - Auth guard (401 without token)
   - Only draft campaigns can be edited/deleted (400 otherwise)
   - `scheduled_at` must be a future date (400 for past)
   - POST /send returns 202 and transitions to `sending`
   - Double-send returns 409
   - Background send eventually sets status to `sent`
   - Ownership — 403 when accessing another user's campaign

3. **`stats.test.js`** — stats accuracy: all-sent, all-failed, mixed states, rate calculation

### "How do you test the async send?"

```js
it('background send eventually transitions campaign to sent', async () => {
  // trigger send
  await request(app).post(`/campaigns/${campaignId}/send`).set('Authorization', `Bearer ${token}`);

  // poll until sent (max 15s)
  const start = Date.now();
  let campaign;
  while (Date.now() - start < 15000) {
    const res = await request(app).get(`/campaigns/${campaignId}`).set('Authorization', `Bearer ${token}`);
    campaign = res.body.campaign;
    if (campaign.status === 'sent') break;
    await new Promise(r => setTimeout(r, 500));
  }
  expect(campaign.status).toBe('sent');
}, 20000);
```

> "I poll the GET endpoint in a while loop with a 500ms sleep, with a 20-second Jest timeout. It's not elegant but it's reliable for testing fire-and-forget logic. In production I'd use event-driven testing with a test job queue."

### "What's your test database strategy?"

> "I use a separate `campaign_manager_test` database configured via `NODE_ENV=test`. Each test suite calls `sequelize.sync({ force: true })` in `beforeAll` to recreate all tables fresh, and `sequelize.drop()` in `afterAll` to clean up. Tests run with `--runInBand` (sequentially) to avoid race conditions between test files on the same database."

---

## 7. Architecture & Trade-off Questions

### "What would you change if this were production?"

1. **Job queue** — Replace fire-and-forget with **BullMQ + Redis** for reliable async processing with retries and dead-letter queues
2. **Real email sending** — Integrate **SendGrid** or **AWS SES** instead of simulation
3. **WebSockets** — Replace polling with **Socket.io** for real-time send progress
4. **Rate limiting** — Add `express-rate-limit` on auth endpoints to prevent brute force
5. **Refresh tokens** — Short-lived access tokens + long-lived refresh tokens instead of 7-day JWTs
6. **Pagination cursor** — Replace offset pagination with cursor-based for large datasets
7. **Recipient deduplication** — Enforce one recipient per campaign at DB level with unique constraint

### "Why raw Sequelize over Prisma?"

> "The spec required it. But honestly, Sequelize gives you more SQL control — raw queries, `queryInterface` in migrations, and fine-grained transaction control. Prisma is great DX but abstracts away things you need to understand for performance tuning. For a MarTech app where query performance matters at scale, that control is valuable."

### "Why monorepo?"

> "Yarn workspaces let both packages share tooling config and be managed with a single `yarn install`. There's no overhead of syncing separate repos, and CI can test both in one pipeline. The trade-off is slightly more complex configuration — Vite's proxy config and Docker networking need to account for the separate services."

### "How would you scale this?"

> "The current architecture is single-process Node.js. To scale: (1) **Horizontally** — put the Express app behind a load balancer, but move sessions to Redis since JWT is already stateless. (2) **Database** — add read replicas for the stats queries, which are heavy reads. (3) **Send processing** — move to a worker pool where multiple workers pull jobs from a BullMQ queue, enabling parallel send processing. (4) **CDN** — serve the React frontend from S3 + CloudFront."

---

## 8. Quick-fire Questions

| Question | Answer |
|----------|--------|
| What HTTP status for "resource not found"? | **404** |
| What HTTP status for "you're not allowed"? | **403** Forbidden (vs 401 = not authenticated) |
| What HTTP status for async processing started? | **202** Accepted |
| What HTTP status for resource already exists? | **409** Conflict |
| What HTTP status for successful delete? | **204** No Content |
| What HTTP status for validation error? | **400** Bad Request |
| BCrypt salt rounds — what's the trade-off? | Higher rounds = slower hash = harder brute force, but slower login |
| JWT vs Session — when to use JWT? | JWT for stateless/distributed systems; Sessions for single-server with easy revocation |
| What is `findOrCreate` in Sequelize? | Atomic SELECT-or-INSERT — avoids race conditions on unique fields |
| Why `express-async-errors`? | Catches unhandled promise rejections in async route handlers automatically |

---

## 9. "How did you use Claude Code?" (AI Section)

> "I used Claude Code for scaffolding and boilerplate — generating the monorepo structure, Sequelize migration files, Tailwind component classes, and the React Query/Zustand wiring. This saved several hours on repetitive setup.
>
> However, I **reviewed every piece of business logic myself**. The status transition rules, the ownership checks, the stats calculation — these are the core of the application and I verified them manually. Claude also made a few mistakes I caught: a circular import between the API client and auth store (fixed with lazy initialization), and an association alias mismatch between models that only surfaced during integration testing.
>
> I would not let Claude handle database schema decisions or security code without review. Those are areas where a subtle mistake — a missing index, a wrong comparison, a missing auth check — has serious production consequences."

---

## 10. Sample "Tell me about a bug you fixed"

> "During testing I discovered that the stats endpoint returned incorrect open rates when there were zero sent recipients — it would divide 0/0 and return `NaN`. The fix was a simple guard:
> ```js
> const open_rate = sent > 0 ? Math.round((opened / sent) * 100 * 100) / 100 : 0;
> ```
> It's a small bug but it's the kind that slips through when you only test the happy path. That's why my stats test explicitly covers the zero-recipients case."

---

## 11. Docker & Infrastructure Questions

### "Walk me through your Docker setup."

> "The project has three containers orchestrated by Docker Compose: **postgres** (database), **backend** (Node/Express API), and **frontend** (React served by nginx). They communicate over Docker's internal network — the frontend proxies `/api/` requests to the backend, and the backend connects to postgres using the service name `postgres` as the hostname instead of `localhost`."

### "What is a multi-stage Docker build and why did you use it?"

The frontend Dockerfile has two stages:

```dockerfile
# Stage 1 — Builder: full Node.js image, installs deps and compiles React
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build        # outputs static files to /app/dist

# Stage 2 — Runtime: tiny nginx image, just serves the built files
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

> "Stage 1 installs all Node.js dependencies and runs the Vite build. Stage 2 copies only the compiled `/dist` folder into a fresh nginx image and throws everything else away — Node.js, node_modules, source code. The final image is around **25MB** instead of 400MB+. This is a standard pattern for any compiled frontend: build heavy, ship light."

### "How does the frontend talk to the backend inside Docker?"

```nginx
# nginx.conf
location /api/ {
    proxy_pass http://backend:3001/;
}
```

> "The browser sends requests to `/api/campaigns`. Nginx receives them and proxies to `http://backend:3001/` — `backend` is the Docker Compose service name, which Docker resolves to the backend container's internal IP automatically. The browser never knows the backend's address; it only ever talks to nginx on port 80. This means CORS is not needed in production."

### "How does Docker Compose handle startup order?"

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy

postgres:
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U postgres']
    interval: 5s
    timeout: 5s
    retries: 5
```

> "Postgres has a **healthcheck** that runs `pg_isready` every 5 seconds. The backend uses `condition: service_healthy` — meaning Docker won't start the backend container until postgres is actually accepting connections, not just running. Without this, the backend would start, try to connect to postgres immediately, fail, and crash."

### "Why use Alpine images?"

> "`node:20-alpine` and `nginx:alpine` are based on Alpine Linux — a minimal distro at ~5MB vs Ubuntu's ~70MB. Smaller images mean faster pulls in CI/CD, smaller attack surface, and less storage cost. The trade-off is Alpine uses `musl` libc instead of `glibc`, which occasionally breaks native Node addons — but `pg` (the postgres driver) doesn't have native bindings so it's safe here."

### "How do migrations run in Docker?"

```yaml
# docker-compose.yml
command: >
  sh -c "yarn db:migrate && yarn db:seed && yarn start"
```

> "The backend container's entrypoint runs migrations first, then seeds, then starts the server — all in one shell chain with `&&`. If migrations fail, the server never starts. This is a simple approach for a single-instance deployment. In production at scale, migrations would run as a separate one-off job before deploying new containers, to avoid running migrations in parallel across multiple instances."

### "What is the .dockerignore for?"

```
node_modules
dist
.env
```

> "Without `.dockerignore`, `COPY . .` would copy the local `node_modules` into the Docker image — overwriting the packages we just installed inside the container. This is a problem in a yarn monorepo because the local node_modules contains symlinks back to the workspace root that don't exist inside Docker. `.dockerignore` works like `.gitignore` — Docker skips those paths when building the context."

### "How would you improve this Docker setup for production?"

1. **Secrets management** — Use Docker secrets or a vault (AWS Secrets Manager) instead of env vars for `JWT_SECRET` and `DB_PASSWORD`
2. **Non-root user** — Add `USER node` in the backend Dockerfile so the process doesn't run as root
3. **Read-only filesystem** — Mount the container filesystem as read-only with a writable `/tmp` volume
4. **Resource limits** — Add `mem_limit` and `cpus` in docker-compose to prevent one container starving others
5. **Separate migration job** — Run `db:migrate` as a separate `docker compose run` one-off before deploying, not inside the app entrypoint
6. **Health check on backend** — Add a `/health` endpoint and Docker healthcheck so the load balancer only routes to healthy instances

### Quick-fire Docker questions

| Question | Answer |
|----------|--------|
| What port does the frontend expose? | **80** (nginx inside container), mapped to **3000** on your machine |
| What port does the backend expose? | **3001** both inside and outside |
| How does `backend` resolve to an IP? | Docker Compose creates an internal DNS — service names are hostnames |
| What's `WORKDIR /app` for? | Sets the working directory for all subsequent `RUN`, `COPY`, `CMD` instructions |
| Difference between `RUN`, `CMD`, `ENTRYPOINT`? | `RUN` = build time. `CMD` = default command at runtime (overridable). `ENTRYPOINT` = fixed runtime command |
| What does `--no-cache` do in `docker compose build`? | Forces Docker to re-run every layer instead of using cached layers |
| Why `node:20-alpine` not `node:20`? | Alpine is ~150MB vs ~1GB — same Node.js, much smaller base OS |

---

## 12. Real Bugs Found & Fixed (Strong Interview Stories)

### Bug 1 — API response shape mismatch (frontend showed empty recipients/campaigns)

**What happened:** After creating a campaign, the app navigated to `/campaigns/undefined`. The recipients list was always empty on the detail page.

**Root cause:** The backend wraps every response — `{ campaign: {...} }`, `{ campaigns: [...] }`, `{ recipient: {...} }` — but the frontend API functions were reading the response as if the data was at the top level. So `campaign.id` was `undefined` because the actual campaign was nested at `data.campaign.id`.

**Fix:** Updated every API function to unwrap the response shape:
```ts
// Before (wrong)
const { data } = await apiClient.post<Campaign>('/campaigns', payload)
return data  // data was actually { campaign: {...} }

// After (correct)
const { data } = await apiClient.post<{ campaign: Campaign }>('/campaigns', payload)
return data.campaign
```

Also caught that `updateCampaign` was using `.put()` instead of `.patch()`.

**Lesson:** Always verify the exact shape the backend returns against what the frontend consumes. TypeScript alone won't catch this if you cast with `as`.

---

### Bug 2 — Wrong association key casing (recipients not displaying in detail page)

**What happened:** Campaign detail page showed "No recipients attached" even when the campaign had recipients.

**Root cause:** Sequelize returns the `belongsToMany` association under the alias defined in the model — `as: 'recipients'` (lowercase). But the frontend was destructuring `Recipients` (PascalCase — Sequelize's un-aliased default):
```ts
// Wrong — looking for 'Recipients' (capital R)
const { Recipients: recipients } = campaign
```

**Fix:** Changed the type definition and destructure to match the actual alias:
```ts
const { recipients } = campaign  // lowercase — matches Sequelize 'as' alias
```

**Lesson:** Sequelize association names are case-sensitive. When you use `as:` in your model definition, that exact string is the key in the JSON response.

---

### Bug 3 — Mutation onSuccess overwrote full campaign with partial response

**What happened:** After clicking Schedule, the recipient list disappeared from the detail page.

**Root cause:** The `scheduleMutation.onSuccess` called `queryClient.setQueryData(['campaign', id], updated)` — but the schedule endpoint only returns `{ campaign: { id, status, scheduled_at, ... } }` with no `recipients` or `stats`. This overwrote the rich cached campaign data with a stripped-down object.

**Fix:** Instead of manually setting cache, invalidate and let React Query refetch the full data:
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['campaign', id] })  // triggers GET /campaigns/:id
  queryClient.invalidateQueries({ queryKey: ['campaigns'] })
}
```

**Lesson:** `setQueryData` is only safe when you're certain the mutation returns the same shape as the query. When in doubt, invalidate and refetch.

---

### Bug 4 — Campaigns stuck permanently in 'sending' after server restart

**What happened:** After restarting the Docker backend container, campaigns stayed in `sending` status forever and never transitioned to `sent`.

**Root cause:** The `processSend` background function lives in Node.js memory. When the container restarts, all in-flight background processes are killed. The campaign is left in `sending` in the database with no process to finish it.

**Fix:** Added recovery logic in the scheduler that runs on server startup:
```js
// Recover campaigns stuck in 'sending' (server restarted mid-send)
const stuckCampaigns = await Campaign.findAll({ where: { status: 'sending' } });
for (const campaign of stuckCampaigns) {
  processSend(campaign); // resume from remaining pending recipients
}
```
`processSend` queries `CampaignRecipient` for `status: 'pending'` rows — so it resumes from where it left off, skipping already-sent recipients.

**Lesson:** Any fire-and-forget background process is volatile. In production this is why you'd use a persistent job queue (BullMQ + Redis) — jobs survive restarts because they're stored in Redis, not memory.

---

### Bug 5 — Campaigns list showed stale 'sending' status after navigating between tabs

**What happened:** After a campaign finished sending, switching from the "Sending" tab to the "All" tab still showed the campaign as `sending` for up to 30 seconds.

**Root cause:** Each status tab has its own React Query cache entry:
- `['campaigns', 1, 'sending']` — the Sending tab
- `['campaigns', 1, 'all']` — the All tab

These are independent caches. When the Sending tab's polling detected the status changed to `sent`, it only updated its own cache. The All tab still had stale data, and the global `staleTime: 30s` prevented an immediate refetch on tab switch.

**Fix — two parts:**
1. Set `staleTime: 0` on the campaigns list query so every tab switch triggers a fresh fetch
2. Use `select` in the campaign detail query to invalidate all list caches when a campaign transitions out of `sending`:
```ts
select: (data) => {
  if (data.status !== 'sending') {
    queryClient.invalidateQueries({ queryKey: ['campaigns'], exact: false })
  }
  return data
},
```

**Lesson:** React Query caches by query key — different keys = different caches. When multiple views can show the same data, you must actively invalidate related caches or accept eventual consistency. `staleTime: 0` is the right default for frequently-changing data.

---

### Bug 6 — Scheduled campaigns never auto-sent

**What happened:** Setting a campaign to schedule for 2 minutes in the future — after 2 minutes, the campaign stayed `scheduled` and was never sent.

**Root cause:** The original implementation had no scheduler. `POST /campaigns/:id/send` only triggered sending when you manually clicked the button. There was no background job checking for overdue scheduled campaigns.

**Fix:** Added a `processScheduledCampaigns()` function that runs every 60 seconds:
```js
setInterval(processScheduledCampaigns, 60_000);
```
It queries `WHERE status = 'scheduled' AND scheduled_at <= NOW()`, transitions matching campaigns to `sending`, and fires `processSend` for each.

Also runs once immediately on startup to catch any campaigns that came due while the server was down.

**Lesson:** Scheduled tasks require a persistent scheduler. `setInterval` works for single-instance apps but won't scale horizontally — multiple instances would each trigger the same campaign. Production solution: use a distributed lock (Redis `SET NX`) or a dedicated job scheduler (cron + a single worker).

---

### Bug 7 — Pagination returning empty page 2 (Sequelize findAndCountAll with include)

**What happened:** Clicking "Next Page" on the campaigns list returned a blank page with an empty array, even though there were enough campaigns to fill multiple pages.

**Root cause:** Sequelize's `findAndCountAll` with an `include` (joining `campaign_recipients`) counts **join rows**, not parent rows. With 10 campaigns each having 3 recipients, `count` returned 30 instead of 10 — making `totalPages = 3` when it should be 1. Page 2 then queried with `offset: 10`, found nothing, and returned an empty array.

**Fix:** Add `distinct: true` to `findAndCountAll` so it counts `COUNT(DISTINCT "Campaign"."id")` instead of `COUNT(*)`:
```js
const { count, rows: campaigns } = await Campaign.findAndCountAll({
  where,
  limit,
  offset,
  distinct: true,  // counts unique campaigns, not join rows
  order: [['created_at', 'DESC']],
  include: [{ model: CampaignRecipient, as: 'campaignRecipients', ... }],
});
```

**What didn't work first:** Also tried `col: 'Campaign.id'` alongside `distinct: true`, which threw `missing FROM-clause entry for table "Campaign->Campaign"` in PostgreSQL. The `col` option uses model name casing but PostgreSQL expects the actual table name. Removed `col` and let Sequelize resolve the primary key automatically — which it does correctly with `distinct: true` alone.

**Lesson:** Always use `distinct: true` in `findAndCountAll` when you have a `hasMany` or `belongsToMany` include. Without it, the count is inflated by join rows and pagination breaks silently — you only notice when you actually click to page 2.
