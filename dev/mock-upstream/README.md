# mock-upstream

Zero-dependency Node 22 server that stands in for **Skaha + CADC AC + Cavern** so you can reproduce “logged in, some APIs 401/403” without touching real SRC/CANFAR hosts.

The portal BFF already talks to configurable base URLs. This process is those URLs. It is not a second Next app and it is not Express — `node:http` is enough.

```
browser  →  Next BFF (:3000)  →  mock-upstream (:4010)
                                  /login /whoami     (AC)
                                  /v1/session …      (Skaha)
                                  /cavern/nodes/home (Cavern)
```

## Run

```bash
npm run mock:upstream
```

Control UI: [http://127.0.0.1:4010](http://127.0.0.1:4010)

Copy [`.env.mock.example`](../../.env.mock.example) over the server URL block in `.env.local` (keep your `NEXT_USE_CANFAR` / OIDC secrets as they are), then `npm run dev`.

| Mode | What you get |
|------|----------------|
| **CANFAR** (`NEXT_USE_CANFAR=true`) | Login against the mock (`dev` / any password). Fastest loop for dashboard 403s. |
| **OIDC** | Still log in at the real IdP. Only Skaha/Cavern calls hit the mock — the “IAM session live, product APIs fail” case. |

Storage env vars **must** be `http://127.0.0.1:4010/cavern/nodes/home/` (trailing slash). That matches `server-config` + the raw VOSpace path.

## Flip faults (no Next restart)

Named presets (same cases as [auth-session-authorization.md](../../docs/auth-session-authorization.md)):

| Preset | Effect |
|--------|--------|
| `ok` | All 200 |
| `sessions-401` / `sessions-403` | Session list only |
| `images-403` / `context-403` | Launch-form pieces |
| `storage-401` / `storage-403` | Cavern home / quota / files |
| `product-401` / `product-403` | All `/v1/*` and `/cavern/*` |
| `whoami-ok-rest-403` | Login/whoami 200; everything the dashboard fetches 403 |
| `mixed` | Sessions 200; images 403; storage 401 |
| `java-mix` | Product paths: random **401 or 403** plus a random OpenCADC/Java body each request |
| `chaos` | Product paths: random status (401–503) and body each request |

Fault bodies mimic **Java OpenCADC** services: cadc-rest `text/plain` (`NotAuthenticated`, `PermissionDenied`, exception stacks), cadc-rest XML `<fault>`, VOSpace `<vos:error>`, Jersey/Jackson JSON, and Jetty/Tomcat HTML error pages. Each request picks a new catalog entry so widget refresh shows different copy. Header `X-Mock-Fault-Id` names the entry. 401s also send `WWW-Authenticate: ivoa_x509, CADC_SSO, Bearer`.

```bash
# preset
curl -X PUT http://127.0.0.1:4010/__faults \
  -H 'Content-Type: application/json' \
  -d '{"preset":"whoami-ok-rest-403"}'

# one extra rule
curl -X PUT http://127.0.0.1:4010/__faults \
  -H 'Content-Type: application/json' \
  -d '{"add":{"method":"POST","path":"/v1/session","status":403}}'

# replace all rules
curl -X PUT http://127.0.0.1:4010/__faults \
  -H 'Content-Type: application/json' \
  -d '{"rules":[{"method":"GET","path":"/v1/session","status":401}]}'

curl -X DELETE http://127.0.0.1:4010/__faults
```

Path patterns: exact (`/v1/session`), prefix (`/v1/*`, `/cavern/nodes/home/*`). Optional query: `/v1/session?view=stats`.

Startup:

```bash
MOCK_PRESET=sessions-403 npm run mock:upstream
MOCK_FAULTS='GET /v1/session:403,GET /v1/image:401' npm run mock:upstream
```

`MOCK_REQUIRE_AUTH=1` returns 401 when the BFF sends neither `Authorization` nor `Cookie` (except `/login`). Use this to simulate `forwardAuthHeader` sending `{}`.

## Why not Express

The BFF already owns routing, auth forwarding, and error mapping. This process only needs: fixtures + a fault table + `PUT /__faults`. Adding Express (or MSW inside Next) would couple the mock to the app or add a dependency for ~200 lines of `node:http`.

Do **not** mock `/api/auth/session` or NextAuth here. Those stay in the portal. This server is **upstream only**.
