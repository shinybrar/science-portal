# State Management Guide

Developer reference for the Science Portal. Architectural rationale and decisions live in [ADR 0001](./adr/0001-client-state-management.md).

**Rule of thumb:** classify state before you write code. If you cannot name the owner, stop and decide.

---

## Quick reference

| If the state is… | Use | Example |
|------------------|-----|---------|
| From an API / async | **TanStack Query** | Session list, file listing, quota |
| Auth identity (OIDC) | **NextAuth** via `useAuthStatus()` | Logged-in user, gating queries — see [auth-session-authorization.md](./auth-session-authorization.md) (`authenticated` ≠ APIs will succeed) |
| Deploy-time config | **React Context** | `useCanfar`, `serviceUrls`, `basePath` |
| Bookmarkable / shareable | **nuqs** | File path `?path=`, session filters |
| Cross-route UI, not in URL | **Zustand** | Upload queue, auth modals, multi-select |
| Single component, ephemeral | **local `useState`** | Form fields, MUI `anchorEl` |

---

## Stack overview

```
Root layout providers (all routes)
  PublicRuntimeConfigProvider   → deployment config
  QueryProvider                 → TanStack Query cache
  NuqsProvider                  → URL state
  AuthProvider                  → NextAuth session
  ThemeProvider                 → light/dark (may move to Zustand later)

Layout components (all routes)
  AppBarWithAuth                → auth modals (Zustand)
  useLogoutReset                → clears Query + Zustand on logout
  GlobalUploadPanel (future)    → upload queue (Zustand)

Route page.tsx                  → thin shell only
Feature components              → Query hooks + Zustand selectors + local state
```

---

## TanStack Query (server state)

### When to use

- Any data fetched from `/api/*` or BFF routes
- Mutations: create, update, delete, upload
- Cache invalidation after mutations

### Where hooks live

`src/lib/hooks/` — one file per API domain:

| Hook file | Domain |
|-----------|--------|
| `useSessions.ts` | Sessions, logs, events |
| `useImages.ts` | Container images, launch context |
| `useAuth.ts` | Auth status (CANFAR + OIDC wrapper) |
| `useUserStorage.ts` | Quota, file nodes, upload, delete, mkdir |

### Rules

1. **Add a hook** when a new API endpoint is consumed by UI — do not `fetch` in components.
2. Use **query key factories** (`sessionKeys`, `storageKeys`, …) for invalidation.
3. Gate queries with `enabled: isAuthenticated` (or stricter) — do not fetch before auth is known.
4. Mutations invalidate related queries in `onSuccess` — see existing hooks for patterns.
5. **Never** copy query results into Zustand.

### Adding a new query

```typescript
// 1. API client in src/lib/api/
// 2. Query keys + hook in src/lib/hooks/
export const widgetKeys = {
  all: ['widgets'] as const,
  list: () => [...widgetKeys.all, 'list'] as const,
};

export function useWidgets(isAuthenticated?: boolean) {
  return useQuery({
    queryKey: widgetKeys.list(),
    queryFn: () => fetchWidgets(),
    enabled: isAuthenticated !== false,
  });
}
```

---

## Zustand (client UI state)

### When to use

- State shared across **routes** or distant components
- Upload queue and progress
- Global modals (login, reset password)
- Multi-select for bulk actions
- Session operation overlays (`operatingSessionIds`)

### When NOT to use

- API response data
- Current file directory path (use nuqs)
- Form field values inside a modal
- MUI popover anchor elements

### Store layout

```
src/lib/stores/
├── app-store.ts
├── types.ts
├── selectors.ts
├── slices/
│   ├── session-ui.ts
│   ├── modals.ts
│   ├── navigation.ts
│   ├── storage-ui.ts    # stub until /storage feature track
│   └── uploads.ts       # stub until upload UI
└── index.ts
```

### Rules

1. **Use selector hooks** from `selectors.ts` — avoid `useAppStore()` without a selector in leaf components.
   Selectors that return a new object per call (e.g. action bundles) **must** wrap the selector in
   `useShallow` from `zustand/react/shallow`; in Zustand v5 a bare object-returning selector causes an
   infinite re-render loop ("Maximum update depth exceeded").
2. **Reset slices on logout** — every slice exposes a `reset*()` called from `useLogoutReset`.
3. **Do not persist** uploads, selection, or modals to `localStorage`.
4. New cross-route UI → extend an existing slice or add a slice; do not add a new global pattern.

### Adding state to the store

1. Add types to `types.ts`
2. Add slice actions in `slices/`
3. Compose in `app-store.ts`
4. Export selector hook in `selectors.ts`
5. Unit test actions and reset behavior

---

## nuqs (URL state)

### When to use

- User should bookmark or share the view
- Browser back/forward should undo navigation
- State should survive page refresh

### Examples

| Route | Params | Hook |
|-------|--------|------|
| `/` | session filters, pagination (future) | Add when list UX needs shareable URLs |
| `/storage` | `path`, `sort`, `order` | `useStorageUrlState.ts` (feature track S1) |
| Launch form | `tab=standard\|advanced`, type, name, Standard catalog `project`/`image`, fixed resources | `sessionLaunchForm.tsx` (nuqs). Never: registry username/secret. |

### Rules

1. Add route-specific URL hooks alongside the route (e.g. `useStorageUrlState.ts`), re-exporting nuqs parsers from `useUrlState.ts` when useful.
2. Do not put upload progress or `File` objects in the URL.
3. Clear URL params on logout (handled by `useLogoutReset`).

---

## React Context

### When to use

- **Public runtime config only** — values from server env, read-only after hydration
- **Theme** (for now) — may migrate to Zustand `preferences` slice later

Do not add new Context providers for feature state. Use Zustand or Query instead.

---

## Route conventions

New routes must follow these patterns (enforced after foundation gate):

### 1. Thin `page.tsx`

```tsx
// src/app/storage/page.tsx — target shape
'use client';

import { StorageBrowser } from '@/lib/features/storage/StorageBrowser';

export default function StoragePage() {
  return <StorageBrowser />;
}
```

- No direct `fetch` in `page.tsx`
- No auth modal state in `page.tsx`
- Data hooks live in feature components or feature hooks

### 2. Feature colocation (recommended)

```
src/lib/features/storage/
├── StorageBrowser.tsx
├── useStorageBrowser.ts      # composes Query + nuqs + Zustand selectors
└── components/
    ├── FileList.tsx
    └── UploadButton.tsx
```

### 3. Layout owns shared chrome

- App bar, auth modals, logout reset → layout level
- Upload panel (future) → layout level
- Route pages own only route-specific UI

---

## Auth gating

All data hooks on authenticated routes:

```tsx
const { data: authStatus, isLoading: authLoading } = useAuthStatus();
const isAuthenticated = authStatus?.authenticated ?? false;

const { data: sessions } = useSessions(isAuthenticated);
```

Do not duplicate CANFAR vs OIDC branching — `useAuthStatus()` handles both.

---

## Logout behavior

On transition from authenticated → unauthenticated:

1. React Query: invalidate/remove all non-`auth` queries
2. Zustand: call all slice reset actions
3. URL: clear search params
4. Page reload (until all manual fetch paths are removed)

New slices **must** register a reset action.

---

## Code review checklist

Use for every PR that touches state:

- [ ] No new `fetch()` + `useState` for server data in components
- [ ] New API consumption has a hook in `src/lib/hooks/`
- [ ] Cross-route UI uses Zustand, not lifted page state
- [ ] Bookmarkable navigation uses nuqs
- [ ] Selector hooks used for Zustand reads
- [ ] Logout reset updated if new Zustand slice added
- [ ] `page.tsx` stays thin (< ~100 lines)
- [ ] No API data duplicated in Zustand

---

## Foundation gate

Do **not** start `/storage`, upload UI, or other heavy features until [ADR 0001 foundation gate](./adr/0001-client-state-management.md#foundation-gate-acceptance-criteria) is satisfied.

Foundation track: **F0 → F1 → F2 → F3** (see ADR).

---

## Further reading

- [ADR 0001: Client State Management with Zustand](./adr/0001-client-state-management.md)
- [TanStack Query docs](https://tanstack.com/query/latest)
- [Zustand docs](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [nuqs Next.js adapter](https://nuqs.47ng.com/docs/adapters/next-app-router)
