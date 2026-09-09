# Auth session vs API authorization

Source of truth for the failure mode **“user is logged in, but some or all other endpoints return 401 or 403.”**

This is an investigation and working architecture brief, not a decided ADR. Cut follow-up ADRs from the [action backlog](#action-backlog) once the team picks a direction.

| Field | Value |
|-------|-------|
| **Status** | Review — use for diagnosis and next architecture work |
| **Date** | 2026-09-04 |
| **Scope** | Dual-mode portal (CANFAR + OIDC), BFF `/api/*`, token lifecycle, username/identity, deploy contract |
| **Related** | [ADR 0001](./adr/0001-client-state-management.md), [state-management guide](./state-management.md), [helm/DEPLOYMENT-MODES.md](../helm/DEPLOYMENT-MODES.md), [`.env.example`](../.env.example), [mock-upstream](../dev/mock-upstream/README.md) |

---

## How to use this document

1. **On-call / bug.** Start at [Symptom → cause](#symptom--cause) and [Investigation playbook](#investigation-playbook).
2. **Feature work.** Read [Mental model](#mental-model) and [State and identity boundaries](#state-and-identity-boundaries) before adding a route or hook.
3. **Architecture.** Use [Gaps](#gaps-and-risks) and [Action backlog](#action-backlog). Do not invent a third auth path.

**Invariant the UI already violates:** “logged in” is **portal identity**. Skaha / Cavern / CADC AC each independently decide whether the **credential the BFF actually sent** is valid **and** authorized for that resource.

---

## Problem statement

Observed case:

> After a successful login the chrome shows an authenticated user (name, logout). Session list, launch form, storage widget, or only a subset of those, fail with **401** or **403**.

That is expected under the current design whenever any of these diverge:

| Layer | What “success” means today |
|-------|----------------------------|
| Portal UI | `useAuthStatus().authenticated === true` |
| NextAuth cookie (OIDC) | Encrypted JWT cookie exists; `useSession().status === 'authenticated'` |
| Access token | `session.accessToken` present and not past refresh-margin |
| BFF middleware | Session exists and `session.error !== 'RefreshAccessTokenError'` |
| Upstream | Bearer or `CADC_SSO` accepted **and** user may use that path / group / home |

Login only completes the **first one or two** rows. The rest are separate contracts.

---

## Mental model

```
Browser                         Portal BFF                         Upstream
──────                          ──────────                         ────────
useAuthStatus  ──identity──►    (does not mean APIs work)
useSession     ──OIDC cookie──► auth() / middleware
getAuthHeader  ──CANFAR only──►
credentials:include
                                forwardAuthHeader() ──Bearer──►    SRC Skaha / Cavern
                                forwardCookies()    ──CADC_SSO──►  ws-cadc AC / whoami
                                (or send nothing)   ───────────►   401 / 403
```

Rules:

1. **The browser never talks to Skaha or Cavern directly.** All product calls go same-origin `/api/*` with `credentials: 'include'`.
2. **OIDC:** the BFF reads the access token from the NextAuth cookie via `await auth()`. The client **must not** attach a Bearer (`getAuthHeader()` returns `{}`).
3. **CANFAR:** the BFF forwards the browser `Cookie` (`CADC_SSO` on `*.canfar.net`) **and** any client `Authorization` (localStorage Bearer — localhost fallback).
4. **401** = missing / expired / rejected **credential**. **403** = credential understood, **operation or identity not allowed** (or a cookie-only route in OIDC with no `CADC_SSO`).
5. Middleware (OIDC only) gates on **session cookie + `session.error`**. It does **not** require `accessToken`. A “live” session with an empty token still reaches the route handler.

---

## Dual mode (do not mix)

Mode is selected by environment. Several call sites **do not use the same predicate**. That is a first-class bug class.

| Source | Predicate | Used by |
|--------|-----------|---------|
| `getAuthMode()` / `isOIDCAuth()` | `NEXT_USE_CANFAR === 'true'` **OR** `NEXT_PUBLIC_USE_CANFAR === 'true'` → CANFAR | `src/lib/config/auth-config.ts`, `server-config.ts` (Skaha/Cavern URL pick) |
| `getPublicRuntimeConfigFromEnv().useCanfar` | Same OR | Root layout → client hooks (`useAuth`, `AuthProvider`) |
| Middleware, `forwardAuthHeader`, `fetchExternalApi`, `/api/auth/status`, `/api/auth/session` | **`NEXT_USE_CANFAR !== 'true'`** → OIDC (ignores `NEXT_PUBLIC_*`) | Request path / token forwarding |
| `getAuthHeader()` | **`NEXT_PUBLIC_USE_CANFAR !== 'true'`** → OIDC (build-inlined in the browser) | Client Bearer attach |

Helm and [DEPLOYMENT-MODES.md](../helm/DEPLOYMENT-MODES.md) require **matching image + both flags**. `NEXT_PUBLIC_USE_CANFAR` is baked into the client bundle at `next build`. `layout.tsx` is `force-dynamic`, so **server** `useCanfar` can change at runtime while **`getAuthHeader()` cannot**.

**If the flags or image disagree, the UI can look logged in while the BFF forwards the wrong (or empty) credential.** Treat that as a deploy incident, not a widget bug.

### Upstream hosts (must match mode)

From `src/app/api/lib/server-config.ts`:

| Service | OIDC (`isOIDCAuth()`) | CANFAR |
|---------|------------------------|--------|
| Skaha | `SRC_SKAHA_API` / `NEXT_PUBLIC_SRC_SKAHA_API` → default `https://src.canfar.net/skaha` | `SKAHA_API` / `NEXT_PUBLIC_SKAHA_API` → `ws-uv.canfar.net` |
| Storage | `SRC_CAVERN_API` / `NEXT_PUBLIC_SRC_CAVERN_API` → default `https://src.canfar.net/cavern/nodes/home/` | `SERVICE_STORAGE_API` → VOSpace home base |
| Login / AC | `LOGIN_API` (same var both modes) — typically `https://ws-cadc.canfar.net/ac` | same |

SRC hosts are documented as accepting **SKA IAM** tokens. CANFAR hosts accept **`CADC_SSO` / CANFAR Bearer**. Sending an IAM JWT to `ws-uv` (or a CADC cookie to SRC) produces 401/403 that look like “portal auth is broken.”

`.env.example` requires `SRC_CAVERN_API` to **end with `/`**. Helm examples in `DEPLOYMENT-MODES.md` sometimes use `https://src.canfar.net/cavern` (no `/nodes/home/`). Those two shapes are not interchangeable — see [Storage URL construction](#storage-url-construction).

---

## Components (inventory)

### Client — identity and chrome

| Component / hook | Path | Role |
|------------------|------|------|
| `AuthProvider` | `src/app/providers/AuthProvider.tsx` | `SessionProvider` (`refetchInterval` 300s), `OIDCRefreshErrorRecovery`, `OIDCFetch401Listener` |
| `useAuthStatus` | `src/lib/hooks/useAuth.ts` | **The UI’s “logged in” bit.** OIDC: derived from `useSession()` (no `session.error` / token check). CANFAR: React Query → `GET /api/auth/status` |
| `useLogin` / `useLogout` / `useOIDCLogin` | same | Mode-aware mutations |
| `useAuthModeSync` | same | Writes `localStorage.AUTH_MODE` (debug only; not a source of truth) |
| `AppBarWithAuth` | `src/app/components/AppBarWithAuth/AppBarWithAuth.tsx` | Login modal (CANFAR), OIDC redirect, logout, display name |
| `SessionsDashboard` | `src/lib/features/sessions/SessionsDashboard.tsx` | Gates widgets on `isAuthenticated`; passes `username` into storage |
| `PortalLayout` | `src/app/components/PortalLayout/PortalLayout.tsx` | `useLogoutReset` on true→false |
| `useLogoutReset` | `src/lib/hooks/useLogoutReset.ts` | Clears Zustand + React Query, full reload |
| `oidc-callback` page | `src/app/oidc-callback/page.tsx` | **Legacy.** Real callback is `/api/auth/callback/oidc` |

### Client — API and tokens

| Module | Path | Role |
|--------|------|------|
| `login.ts` | `src/lib/api/login.ts` | CANFAR login/status/user/permissions |
| `skaha.ts` | `src/lib/api/skaha.ts` | Sessions, images, context, logs, events, renew |
| `storage.ts` | `src/lib/api/storage.ts` | Quota, VOSpace summary, files CRUD |
| `token-storage.ts` | `src/lib/auth/token-storage.ts` | CANFAR `localStorage` token + sessionStorage password (certs). OIDC: `getAuthHeader()` → `{}` |
| `oidc-client.ts` | `src/lib/auth/oidc-client.ts` | **Dead / legacy PKCE.** Not on the NextAuth path. Do not reuse. |
| Domain hooks | `src/lib/hooks/useSessions.ts`, `useImages.ts`, `useUserStorage.ts` | `enabled: isAuthenticated !== false` (default **true** if omitted) |

### Server — session and BFF

| Module | Path | Role |
|--------|------|------|
| `auth.ts` | `src/auth.ts` | NextAuth config, JWT/session callbacks, refresh + in-process mutex |
| `[...nextauth]/route.ts` | `src/app/api/auth/[...nextauth]/route.ts` | Auth.js handlers + `basePath` response patches |
| `session/route.ts` | `src/app/api/auth/session/route.ts` | OIDC: delegate GET **and** POST to Auth.js. CANFAR: whoami → fake NextAuth JSON |
| `status/route.ts` | `src/app/api/auth/status/route.ts` | OIDC: `auth()`. CANFAR: whoami. Maps 401/403 → `{ authenticated: false }` |
| `login/route.ts` | `src/app/api/auth/login/route.ts` | CANFAR form login; copies `Set-Cookie` |
| `forwardAuthHeader` | `src/app/api/lib/api-utils.ts` | Mode-aware credential to upstream |
| `forwardCookies` | same | Raw `Cookie` header |
| `fetchExternalApi` | same | Upstream fetch; OIDC `credentials: 'omit'` |
| `auth-middleware.ts` | `src/app/api/lib/auth-middleware.ts` | `requireAuth` / `checkAuthentication` — **unused by any route** |
| `middleware.ts` | repo root | OIDC gate; `/api/auth/*` excluded |
| `server-config.ts` | `src/app/api/lib/server-config.ts` | Mode-aware Skaha/storage bases |
| `debug/session` | `src/app/api/debug/session/route.ts` | Dumps session + token prefix. **Remove from production.** |

### Patches (OIDC + `basePath`)

| Patch | Why it exists |
|-------|----------------|
| `patches/@auth+core+0.41.0.patch` | Token exchange `redirect_uri` must include Next `basePath` |
| `patches/oauth4webapi+3.8.3.patch` | Issuer `//` path join |
| `src/lib/auth/patch-providers-response.ts` | Auth.js omits app `basePath` on Location / providers JSON |

Upgrading `next-auth` without re-validating these patches will break **login**, not mid-session 401s — but operators will still report “auth is broken.”

---

## Data structures

### `TokenWithRefresh` (server JWT payload, `src/auth.ts`)

```ts
interface TokenWithRefresh {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number; // ms epoch
  user?: Record<string, unknown>;
  error?: string;              // 'RefreshAccessTokenError' | undefined
}
```

Lives only inside the encrypted Auth.js session cookie. `refreshToken` is **never** copied to the client session object.

### NextAuth `Session` / `JWT` (`src/types/next-auth.d.ts`)

```ts
interface Session {
  accessToken?: string;  // copied to the browser via /api/auth/session
  error?: string;
  user: { id?, username?, email?, name?, firstName?, lastName?, image? };
}
```

`session.accessToken` in the client is unused for BFF calls and is an XSS exfil surface. Architecture follow-up: stop exposing it.

### `AuthStatus` / `User`

Shared shape in `src/lib/api/login.ts` and `src/app/api/auth/status/route.ts`:

```ts
interface AuthStatus {
  authenticated: boolean;
  user?: User;
}

interface User {
  username: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  // CANFAR whoami only:
  institute?, internalID?, numericID?, uid?, gid?, homeDirectory?;
  identities?: Array<{ type: string; value: string | number }>;
  groups?: string[];
}
```

OIDC fills a **subset**. POSIX / groups / home are not loaded after IAM login. Storage and any future AC calls still need a **CADC/SRC username**, not a display name.

### Username derivation (OIDC) — high 403 risk

`useAuthStatus` and `/api/auth/status`:

```text
session.user.username          // preferred_username from IdP profile()
  || email.split('@')[0]
  || session.user.name
  || 'user'                    // literal fallback
```

`SessionsDashboard` then calls `useUserStorageSummary(username, isAuthenticated)`.

If `preferred_username` is missing or does not match the Cavern/VOSpace home name, storage returns **403/404** while sessions (identity from JWT `sub` / mapped user) can still **200**. Do not treat “sessions work, storage fails” as a storage-widget bug until this mapping is verified.

CANFAR whoami username comes from `posixDetails.username` or HTTP identity — that is the name Cavern expects.

### Standard BFF error body (`src/app/api/lib/api-utils.ts`)

```ts
interface ApiError {
  error: string;    // HTTP_STATUS_NAMES[status]
  message: string;
  status: number;
  details?: unknown;
}
```

Client helpers typically throw `Failed to fetch …: ${response.status}`. `useSessions` skips retries when the message matches `/\b401\b/`. **403 still retries** (Query default: 3). `OIDCFetch401Listener` reacts to **401 only**.

---

## Workflows

### A. CANFAR login

```
LoginModal
  → useLogin → POST /api/auth/login { username, password }
  → BFF form-posts LOGIN_API/login
  → body = base64 token; Set-Cookie: CADC_SSO (Domain=.canfar.net)
  → copyCookies() + JSON { user, token }
  → saveToken(localStorage) + saveCredentials(sessionStorage) for certs
  → invalidate authKeys.status()
  → GET /api/auth/status → LOGIN_API/whoami (Cookie + Bearer)
  → widgets enable
```

Localhost: browser **rejects** `.canfar.net` cookie. Production SSO depends on cookie; local depends on Bearer in `getAuthHeader()`.

### B. OIDC login

```
AppBar → nextAuthSignIn('oidc')
  → /api/auth/signin/oidc (patched URLs if basePath set)
  → SKA IAM (scope default: openid profile email offline_access)
  → /api/auth/callback/oidc   ← register THIS redirect_uri, not /oidc-callback
  → jwt callback stores accessToken, refreshToken, accessTokenExpires, user
  → SessionProvider polls GET /api/auth/session every 5 min
  → useAuthStatus: status==='authenticated' && session.user → authenticated
  → widgets enable (no whoami, no group check)
```

`offline_access` is required for refresh tokens. If the IdP omits a refresh token, the first expiry becomes a **terminal** failure.

### C. Authenticated product call (sessions / storage)

```
Hook enabled by isAuthenticated
  → lib/api/* fetch(BFF, credentials:include, getAuthHeader())
  → middleware (OIDC): 401 if !session or RefreshAccessTokenError
  → route: authHeaders = await forwardAuthHeader(request)
       OIDC: Bearer from auth(), or {} if error or missing token
       CANFAR: client Authorization + Cookie
  → fetchExternalApi(upstream)
  → if !ok: errorResponse(message, upstream.status)  // pass-through 401/403
```

### D. OIDC access-token refresh (`src/auth.ts`)

Runs on every `auth()` / session read when `Date.now() >= accessTokenExpires - margin` (default margin **5 min**, same as client poll).

| Outcome | accessToken | refreshToken | `error` | Middleware | UI | Upstream |
|---------|-------------|--------------|---------|------------|----|----------|
| Success | new | rotated or kept | cleared | pass | still logged in | Bearer OK |
| **Transient** (5xx / network) | **cleared** | kept | **unset** | **pass** | **logged in** | **no Bearer → 401** |
| **Terminal** (4xx / no refresh token) | cleared | leftover | `RefreshAccessTokenError` | **401** | logged in until poll/`update()` | 401 |
| In-flight dedupe | per-process `Map` keyed by refresh token | | | | | |

SKA IAM **rotates** refresh tokens. Two parallel refreshes with the same token → second `invalid_grant` → terminal logout. Mutex is **per Node process**. Replica count > 1 without sticky sessions on `__Secure-authjs.session-token` races the IdP.

`OIDCFetch401Listener` patches `window.fetch` (not XHR). On portal `/api/*` 401 excluding `/api/auth/*`, it calls `useSession().update()` so recovery does not wait 5 minutes.

### E. Logout

| Mode | What happens |
|------|----------------|
| CANFAR | Clear local token; navigate to CANFAR `/access/logout?target=…` (clears `.canfar.net` cookie) |
| OIDC | `clearAuth()` + `signOut({ callbackUrl: basePath })` |
| Either | `useLogoutReset`: Zustand reset, drop non-auth queries, full page reload |

---

## Route and auth matrix

**Legend:** FAH = `forwardAuthHeader`. FC = `forwardCookies` only. `auth()` = NextAuth session. Pass-through = same status returned to the browser.

### Auth

| Route | Methods | Credential | Upstream | 401/403 mapping |
|-------|---------|------------|----------|-----------------|
| `/api/auth/[...nextauth]` | GET, POST | Auth.js | IdP | Auth.js |
| `/api/auth/session` | GET, POST | OIDC: handlers. CANFAR GET: FC | CANFAR: `LOGIN_API/whoami` | CANFAR non-OK → **200 `null`** |
| `/api/auth/status` | GET | OIDC: `auth()`. CANFAR: FAH | CANFAR: `LOGIN_API/whoami` | CANFAR 401/403 → **200 `{authenticated:false}`** |
| `/api/auth/login` | POST | FC | `LOGIN_API/login` | Pass-through |
| `/api/auth/user/[username]` | GET | **FC only** | `LOGIN_API/users/{username}` | Pass-through |
| `/api/auth/permissions` | GET | **FC only** | `LOGIN_API/permissions/…` | 403/404 → **200 `{granted:false}`**; 401 pass-through |
| `/api/auth/register` | POST | none | `REGISTRATION_URL` | Pass-through |
| `/api/auth/reset-password` | POST | none | `PASSWORD_RESET_URL` | Pass-through |

`/api/auth/user` and `/api/auth/permissions` are **not usable in OIDC** (no `CADC_SSO`, no Bearer). Hooks exist (`useUserDetails`, `usePermission`) but are unused in UI. Calling them after IAM login will 401/403.

### Sessions (all FAH, all pass-through)

| Route | Upstream |
|-------|----------|
| `GET/POST /api/sessions` | `{skaha}/v1/session?view=interactive` / `POST {skaha}/v1/session` |
| `GET/DELETE /api/sessions/[id]` | `{skaha}/v1/session/{id}` |
| `POST /api/sessions/[id]/renew` | `POST {skaha}/v1/session/{id}` `action=renew` |
| `GET …/logs` `GET …/events` | `?view=logs` / `?view=events` |
| `GET /api/sessions/context` | `{skaha}/v1/context` |
| `GET /api/sessions/images` | `{skaha}/v1/image` |
| `GET /api/sessions/repository` | `{skaha}/v1/repository` |
| `GET /api/sessions/platform-load` | `{skaha}/v1/session?view=stats` (no client wrapper; dashboard uses static data) |

### Storage (all FAH, all pass-through)

| Route | Upstream construction | UI today |
|-------|----------------------|----------|
| `GET /api/storage/raw/[username]` | `${storage.baseUrl}${username}` | **Used** (`useUserStorageSummary`) |
| `GET /api/storage/quota/[username]` | `${storage.baseUrl}/users/${username}/quota` | Hook unused |
| `GET/POST/DELETE/PUT /api/storage/files/…` | `${storage.baseUrl}/users/${username}/files[/{path}]` | Hooks unused |

### Public / infra

| Route | Gate |
|-------|------|
| `/`, `/oidc-callback`, `/api/public-config`, `/api/health`, `/api/health/ready`, `/api/metrics` | Public (OIDC middleware allow-list) |
| All `/api/auth/*` | **Excluded from middleware matcher** (OAuth state/PKCE) |
| `/api/debug/session` | OIDC-gated; leaks token prefix |

---

## Storage URL construction

One `storage.baseUrl` is used for two incompatible path styles.

| If `SRC_CAVERN_API` / `SERVICE_STORAGE_API` is… | `raw` (`base + username`) | `quota` / `files` (`base + /users/{user}/…`) |
|-----------------------------------------------|---------------------------|----------------------------------------------|
| `https://src.canfar.net/cavern/nodes/home/` (code default + `.env.example`) | `…/home/alice` — VOSpace home | `…/home/users/alice/quota` — **wrong** |
| `https://src.canfar.net/cavern` (some Helm examples) | `…/cavernalice` or `…/cavern/alice` — **wrong** | `…/cavern/users/alice/quota` — different API |

**Consequence:** storage widget (raw) can 200 while future `/storage` files/quota 403/404, or the reverse, depending on env. Next storage work **must** split “VOSpace node base” from “files/quota API base” instead of appending both shapes to one string.

`useUserStorageSummary` also refuses username `'Login'` (legacy placeholder). OIDC fallback `'user'` is **not** filtered — it will call Cavern as user `user`.

---

## Middleware vs “logged in”

OIDC (`middleware.ts`):

- Public: `/`, `/oidc-callback`, `/api/public-config`, `/api/health*`, `/api/metrics`
- Dead session (`!session` **or** `session.error === 'RefreshAccessTokenError'`): `/api/*` → 401 `{ error, message: 'Session required' }`; pages → `/`
- **Not** dead: missing `accessToken` after **transient** refresh. Request proceeds; `forwardAuthHeader` returns `{}`.

CANFAR: middleware is a no-op. Upstream owns auth.

---

## Symptom → cause

### 401 — all or most `/api/sessions/*` and `/api/storage/*`

| Likelihood | Cause | How to confirm |
|------------|-------|----------------|
| High | Transient refresh: session cookie OK, `accessToken` cleared, no `error` | `/api/debug/session` or logs: `hasAccessToken: false`, `error: null`, UI still authenticated. BFF logs empty `authHeaders` |
| High | Terminal refresh not yet visible to client (up to 5 min without a fetch 401) | `session.error === 'RefreshAccessTokenError'`; middleware 401 `Session required` |
| High | Mode/image split: client CANFAR, server OIDC (or reverse) | Compare image build-arg `NEXT_PUBLIC_USE_CANFAR` vs pod `NEXT_USE_CANFAR`. Logs: “OIDC mode, using SRC Skaha” vs login form |
| High | Wrong Skaha/Cavern host for the token type | OIDC hitting `ws-uv` or CANFAR hitting `src.canfar.net` |
| Medium | Multi-replica refresh race → `invalid_grant` | `replicaCount`/`HPA` > 1, no sticky cookie |
| Medium | No refresh token (`offline_access` missing / IdP withheld) | First token expiry → terminal |
| Medium | `AUTH_SECRET` rotated → cookie undecryptable | Sudden mass 401 after secret change |
| Low | Client attached a stale Bearer in OIDC | Only if something bypasses `getAuthHeader()` |

### 403 — one surface, others OK

| Likelihood | Cause | How to confirm |
|------------|-------|----------------|
| High | Username ≠ VOSpace / POSIX home (OIDC `preferred_username` / email prefix / `'user'`) | Compare `authStatus.user.username` to Cavern home and Skaha `userid` |
| High | User not provisioned on SRC Skaha/Cavern (IAM login ≠ science-platform account) | IdP login works; upstream 403 with a valid Bearer |
| High | Cookie-only AC route used in OIDC (`/api/auth/user`, `/permissions`) | 401/403 only on those paths |
| Medium | Storage base URL shape (raw vs `/users/…/files`) | One storage route 200, another 403/404 |
| Medium | Group / allocation missing (Skaha context, launch) | List 200, POST launch 403 |
| Low | Listener ignores 403 — UI keeps “logged in” and retries | Network tab: 403 loop, no sign-out |

### 401 on product APIs, chrome still logged in (OIDC)

By design today:

1. `useAuthStatus` does **not** read `session.error` or `accessToken`.
2. `/api/auth/status` **does** treat `RefreshAccessTokenError` as unauthenticated — but OIDC UI does not call that route.
3. Transient failure never sets `error`, so even the status route would still say authenticated if it were used.

This is the primary product bug for the reported case.

### CANFAR-specific

| Symptom | Cause |
|---------|--------|
| Works on `*.canfar.net`, 401 on localhost | `CADC_SSO` rejected; missing/stale `localStorage` Bearer |
| Login 200, later whoami 401 | Cookie not copied (`copyCookies` uses `headers.get('set-cookie')` — first header only) or token not saved |
| Some tabs 401 | Token only in that browser profile; no NextAuth session |

---

## State and identity boundaries

Align with [state-management.md](./state-management.md). Additional auth rules:

| Concern | Owner | Do not |
|---------|-------|--------|
| OIDC identity + tokens | NextAuth cookie + `auth()` | Zustand, localStorage, React Query |
| CANFAR token | `token-storage` localStorage + `CADC_SSO` | NextAuth JWT |
| “May we fetch?” | `useAuthStatus().authenticated` **plus** (OIDC) `!session.error && accessToken` — **not implemented** | `enabled: isAuthenticated !== false` defaulting to true |
| Username for storage | Must be the **storage-home** name, not a display-name fallback | Email prefix / `'user'` without a mapping service |
| Groups / POSIX / quota identity | CANFAR whoami or a future SRC userinfo BFF | Guessing from IAM `name` |
| Deploy mode | One function, one pair of env flags, matching image | OR-ing `NEXT_PUBLIC_*` in some files and ignoring it in others |

**Anti-patterns (review failures):**

- New route using `forwardCookies` only if it must work in OIDC.
- New client `fetch` that attaches Bearer in OIDC.
- New “am I logged in?” check besides `useAuthStatus` (once that hook is fixed).
- Storing `accessToken` in Zustand or localStorage.
- Calling `LOGIN_API` with an IAM token and expecting whoami to work.
- Enabling React Query hooks without an explicit `isAuthenticated` argument (default is “fetch anyway”).

---

## Environment and deploy contract

### Flags that must stay paired

| Variable | Layer | Notes |
|----------|-------|-------|
| `NEXT_USE_CANFAR` | Server runtime | Middleware, FAH, session/status branches |
| `NEXT_PUBLIC_USE_CANFAR` | **Image build** + server OR in `getAuthMode` | Client `getAuthHeader`; Helm sets both from `app.useCanfar` |
| `AUTH_SECRET` | Cookie encryption | Rotate = all sessions die |
| `AUTH_TRUST_HOST` / `NEXTAUTH_URL` / `AUTH_URL` | Host + secure cookies | HTTPS URL forces `useSecureCookies` |
| `NEXT_OIDC_*` + `NEXT_PUBLIC_OIDC_*` | IdP | `REDIRECT_URI` = `/api/auth/callback/oidc` including `basePath` |
| `NEXT_OIDC_SCOPE` | Refresh | Keep `offline_access` unless IdP forbids it |
| `NEXT_OIDC_ACCESS_TOKEN_REFRESH_MARGIN_MS` | Refresh timing | Default 300000; equals client poll |
| `NEXT_OIDC_CLOCK_TOLERANCE_SECONDS` | **Login `id_token` only** | Does not help access-token expiry skew |
| `NEXT_PUBLIC_BASE_PATH` | Mount path | Server Auth.js `basePath` stays `/api/auth` |
| `SRC_SKAHA_API` / `SRC_CAVERN_API` | OIDC upstream | Must accept IAM JWT; cavern URL must match route builder |
| `SKAHA_API` / `SERVICE_STORAGE_API` / `LOGIN_API` | CANFAR upstream | Cookie/Bearer AC |

### Deploy constraints (OIDC)

1. **One image per mode** until `getAuthHeader` stops using build-inlined `NEXT_PUBLIC_USE_CANFAR`.
2. **`replicaCount` / HPA:** default chart is 1; several docs enable 2–6. Without sticky sessions on `__Secure-authjs.session-token` (or `authjs.session-token`), refresh rotation evicts users. Helm templates do **not** configure stickiness.
3. **IdP redirect** must be the Auth.js callback, including basePath (e.g. `https://host/science-portal/api/auth/callback/oidc`).
4. Do not register `/oidc-callback` as the code-exchange URI.

---

## Gaps and risks

1. **Three different “are we OIDC?” predicates** — split-brain is easy in Helm/env overlays.
2. **`useAuthStatus` (OIDC) ignores `session.error` and missing `accessToken`** — chrome lies.
3. **Transient refresh is invisible** — middleware passes, FAH sends `{}`, UI stays green, APIs 401.
4. **Poll interval = refresh margin = 5 min** — no headroom; listener is a band-aid on `window.fetch` only.
5. **In-memory refresh lock** — unsafe above one replica.
6. **No username mapping** IAM → Cavern/Skaha POSIX after OIDC login.
7. **Cookie-only AC routes** in a dual-mode app.
8. **One storage base URL, two path dialects.**
9. **`requireAuth` unused** — no BFF-level “refuse to call upstream without a credential.”
10. **`session.accessToken` exposed to the browser.**
11. **Legacy `oidc-client.ts` + debug session route** — confusion and leakage.
12. **403 not in the recovery path** — retries and no sign-out (correct for real ACL 403; bad if 403 is used as “no cookie”).
13. **Zero tests** for `forwardAuthHeader`, refresh terminal/transient, middleware, `useAuthStatus`, or 401 listener.
14. **`copyCookies` / single `set-cookie`** — fragile CANFAR SSO seeding.
15. **Dependency patches** required for `basePath` OAuth.

---

## Recommended architecture (for the next ADR)

Target: **one credential pipeline, honest UI, explicit authorization.**

```
                    ┌─────────────────────────────────────┐
                    │  AuthSession (single client type)     │
                    │  mode, authenticated, usable,         │
                    │  username (platform), error           │
                    └─────────────────────────────────────┘
                                      │
           usable === authenticated && !error && hasUpstreamCredential
                                      │
                    hooks enabled ────┘
                                      │
Browser ──cookie only──► BFF ──requireUpstreamAuth──► Skaha / Cavern / AC
                         │
                         └─ OIDC: auth() Bearer (never empty if usable)
                         └─ CANFAR: Cookie + optional Bearer
                         └─ never cookie-only on routes that must work in both modes
```

Decisions to record in a follow-up ADR (do not implement ad hoc):

1. **Unify mode detection** behind `isOIDCAuth()` everywhere (middleware, FAH, client header, Helm).
2. **`useAuthStatus`:** `authenticated` from session; add `usable` (or treat terminal + missing token as logged out). Drive query `enabled` from `usable`.
3. **Transient refresh:** either retry inside `forwardAuthHeader` before calling upstream, or surface a distinct `session.error` and disable fetches (no silent `{}` Bearer).
4. **Refresh coordination:** sticky sessions **or** distributed lock **or** replicaCount=1 as a hard deploy rule. Document the chosen one in Helm.
5. **Platform username:** after OIDC login, resolve CADC/SRC user (whoami that accepts IAM, or a mapping API). Do not use email prefix / `'user'`.
6. **Storage config:** `cavernVospaceHomeBase` vs `cavernFilesApiBase`.
7. **Delete or FAH-migrate** `/api/auth/user` and `/permissions`.
8. **Stop putting `accessToken` on the client session.**
9. **Remove** `oidc-client.ts`, `/api/debug/session` from prod images, unused `requireAuth` or actually use it as `requireUpstreamAuth`.

---

## Action backlog

Priority is “stops the reported case” then “makes the next feature safe.”

### P0 — honesty and the 401 loop

| ID | Action | Owner hint |
|----|--------|------------|
| P0.1 | `useAuthStatus` (OIDC): `authenticated === false` when `session.error === 'RefreshAccessTokenError'` **or** no `accessToken` after session is loaded | Client |
| P0.2 | Query `enabled` must use that honest flag (sessions, images, context, storage) | Client |
| P0.3 | `forwardAuthHeader`: if OIDC and no token, return a signal the route can turn into **401** without calling upstream | BFF |
| P0.4 | Single `isOidcMode()` used by middleware, FAH, `fetchExternalApi`, session/status routes | Server |
| P0.5 | Runbook: image tag mode, `NEXT_USE_CANFAR`, `NEXT_PUBLIC_USE_CANFAR`, Skaha/Cavern URLs must match | Deploy |

### P1 — refresh and multi-instance

| ID | Action | Owner hint |
|----|--------|------------|
| P1.1 | Decide sticky vs single replica vs distributed refresh; implement in Helm | Platform |
| P1.2 | Decouple client poll from refresh margin (poll faster than margin) | Auth |
| P1.3 | Tests: terminal vs transient refresh, mutex, `invalid_grant` | Auth |
| P1.4 | Tests: middleware 401 vs pass on transient; FAH empty token | Auth |

### P2 — identity and 403

| ID | Action | Owner hint |
|----|--------|------------|
| P2.1 | Define platform username source; persist on session; use for all storage paths | Auth + SRC |
| P2.2 | Split storage base URLs; fix Helm examples vs `.env.example` | Storage |
| P2.3 | FAH or retire cookie-only AC routes | BFF |
| P2.4 | Distinguish ACL 403 (show message) vs auth 403 (recovery) | Client |

### P3 — hygiene

| ID | Action |
|----|--------|
| P3.1 | Stop exposing `accessToken` on `/api/auth/session` |
| P3.2 | Delete or quarantine `oidc-client.ts`; gate `/api/debug/session` |
| P3.3 | Use or delete `auth-middleware.ts` |
| P3.4 | Harden `copyCookies` for multiple `Set-Cookie` |
| P3.5 | Patch checklist on `next-auth` upgrades |
| P3.6 | `useSessions`-style 401 no-retry on other domain hooks; do not retry auth failures 3× |

---

## Local mock-upstream

To reproduce “logged in, some APIs 401/403” without SRC/CANFAR hosts, run the zero-dep Node stand-in and point BFF env at it. Details: [dev/mock-upstream/README.md](../dev/mock-upstream/README.md).

```bash
npm run mock:upstream
# overlay URL block from .env.mock.example into .env.local
# then: curl -X PUT http://127.0.0.1:4010/__faults -d '{"preset":"java-mix"}' -H 'Content-Type: application/json'
```

This mocks **upstream only** (Skaha / AC / Cavern). Do not mock NextAuth or `/api/auth/session` here. Presets `java-mix` and `chaos` emit cadc-rest / VOSpace / Jersey bodies; the BFF puts the raw body in `details` and widgets show the first Java error line.

---

## Investigation playbook

Work top-down. Record **mode, which routes fail, 401 vs 403**.

1. **Mode**
   - Image build-arg `NEXT_PUBLIC_USE_CANFAR`
   - Pod `NEXT_USE_CANFAR`, `NEXT_PUBLIC_USE_CANFAR`
   - Log lines: `Server config - OIDC mode, using SRC Skaha` vs `CANFAR mode`
   - UI: password modal vs IAM redirect
   - `GET /api/public-config` → `useCanfar`

2. **Session vs token (OIDC)**
   - `GET /api/auth/session` (and `/api/debug/session` on non-prod): `error`, `hasAccessToken`, `user.username`
   - Compare to chrome: if chrome says in and `hasAccessToken` is false → P0.1 / transient refresh

3. **What the BFF sent**
   - Route logs (`Session GET route - authHeaders`, `SKAHA API REQUEST` Authorization prefix)
   - Empty headers + 401 → FAH had no token
   - Bearer present + 401 → wrong host, expired JWT, or IdP/upstream trust
   - Bearer present + 403 → username, groups, provisioning, or path

4. **Username**
   - UI username vs Skaha session `userid` vs Cavern path
   - If they differ, storage/AC 403 is an identity bug

5. **Upstream URL**
   - Reconstruct from `server-config` + env
   - Confirm cavern base ends with `/` and matches the route’s path dialect

6. **Replicas**
   - If HPA > 1 and users drop after ~token lifetime → refresh race

7. **Do not** “fix” a 403 by signing the user out unless `session.error` is set or FAH had no credential. Real 403s are authorization.

---

## Tests that should exist (none do today)

Existing tests cover Zustand auth **modals**, session quota math, VOSpace XML, image parsing. Missing:

- `isAccessTokenStillValid` / margin
- `terminalRefreshFailure` vs `transientRefreshFailure`
- `refreshInFlight` dedupe
- `forwardAuthHeader` OIDC empty / error / Bearer; CANFAR cookie+Bearer
- Middleware public vs gated vs `RefreshAccessTokenError`
- `useAuthStatus` OIDC matrix: loading, user+token, user+error, user+no token
- `getAuthHeader` never sets Authorization when `useCanfar` is false
- Storage URL builder for both cavern base shapes

---

## File index

| Path | Why it is on the critical path |
|------|--------------------------------|
| `src/auth.ts` | Token lifecycle, refresh, replica warning |
| `middleware.ts` | OIDC 401 gate; matcher excludes `/api/auth` |
| `src/app/providers/AuthProvider.tsx` | Poll, 401 listener, forced sign-out |
| `src/lib/hooks/useAuth.ts` | UI authenticated bit (OIDC gap) |
| `src/app/api/lib/api-utils.ts` | FAH / cookies / upstream fetch |
| `src/app/api/lib/server-config.ts` | Host selection |
| `src/lib/auth/token-storage.ts` | CANFAR token; OIDC empty header |
| `src/lib/config/auth-config.ts` | Mode + OIDC env |
| `src/lib/config/public-runtime-config.ts` | Runtime `useCanfar` OR |
| `src/types/next-auth.d.ts` | Session fields |
| `src/lib/features/sessions/SessionsDashboard.tsx` | Username → storage |
| `helm/templates/_env.tpl` | How flags and URLs are emitted |
| `helm/DEPLOYMENT-MODES.md` | Image-per-mode, troubleshooting (does not cover this case) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-04 | Initial review from codebase (login-success vs later 401/403) |
