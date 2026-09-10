# CANFAR Science Portal

A modern web application providing a user interface for the [CANFAR](https://www.canfar.net/) (Canadian Advanced Network for Astronomical Research) platform. Science Portal enables researchers to access and manage JupyterLab notebooks, CARTA, Desktop (VNC), and other interactive sessions backed by CANFAR resources.

Platform load information is available, including current CPU usage and counts of running instances.

## Description

This CANFAR service provides the ability to access and manage Jupyter notebook, desktop (VNC), and CARTA sessions that back onto CANFAR resources. Using container images and current system resource values (context) provided by [Skaha](https://ws-uv.canfar.net/skaha), you can launch and manage sessions using the container image you select. Contextualization is provided for some session types, allowing the amount of memory, number of cores, and GPU resources you designate to power your session.

## Features

- **Session Management** - Launch, monitor, renew, and delete computational sessions
- **Container Applications** - Access JupyterLab notebooks, CARTA, Desktop (VNC), and other research tools
- **Resource Selection** - Configure memory, CPU cores, and GPU resources with interactive controls
- **Platform Monitoring** - Real-time metrics for platform load and resource usage
- **Storage Management** - View and manage user storage quota
- **Session Logs & Events** - View logs and events for running sessions
- **Dual Authentication** - Supports both CANFAR and OIDC authentication modes
- **Responsive Design** - Mobile-friendly interface with light/dark theme support

## Endpoint Locations

All endpoints require authentication with CANFAR, and authorization to access Skaha resource allocations.

| Service | URL |
|---------|-----|
| Science Portal | https://www.canfar.net/science-portal |
| Skaha Web Service | https://ws-uv.canfar.net/skaha |

### OIDC Configuration

Science Portal supports OpenID Connect in the Next.js app (NextAuth). For registering URIs at your identity provider and for environment variables, see **[Deploying with OIDC](#deploying-with-oidc-openid-connect)** under Deployment below and [.env.example](.env.example). Older servlet-based deployments may still document `oidc` settings in [org.opencadc.science-portal.properties](./org.opencadc.science-portal.properties).

## User Workflows

All workflows assume you are logged in with a CADC account.

### Connecting to Existing Sessions

1. From the main page: https://www.canfar.net/science-portal
2. Science Portal will display any sessions you currently have, including session metadata
3. Clicking on a session card will connect to and forward you to the session

### Launch a New Session

1. From the main page: https://www.canfar.net/science-portal
2. Science Portal will poll for and display any sessions you currently have
3. After the form has loaded, scroll down to access the launch form
4. Select the type of session you want to launch (default is 'notebook')
5. The container image list will be updated for the session type
6. Optionally change the name of the session, and any available context values (memory, cores, or GPU)
7. Select 'Launch'
8. Science Portal will request the session be started
9. The new session will be added to the list at the top of the page

### Delete an Existing Session

1. From the main page: https://www.canfar.net/science-portal
2. Science Portal will display any sessions you currently have
3. Clicking on the trash can icon on a session card will bring up a confirmation box
4. Continue to delete or cancel
5. Science Portal will request the session be deleted, and will remove it from your session list

### Renew Session Time Frame

1. From the main page: https://www.canfar.net/science-portal
2. Science Portal will display any sessions you currently have
3. Click on the clock icon on a session card
4. Science Portal will request the session time frame be renewed (this is a 4-day extension from the time the request is submitted)
5. Session metadata will be refreshed on the portal

### View and Refresh Platform Load

1. From the main page: https://www.canfar.net/science-portal
2. The Platform Load panel displays current resource usage information
3. Click the refresh button to refresh values
4. A timestamp indicates the time of the last refresh

### View Session Logs and Events

1. From the main page: https://www.canfar.net/science-portal
2. In the Active Sessions panel, each Session Card has buttons for events (flag) and logs (file)
3. Click on either button
4. A new tab is opened displaying the output from the Skaha service with available event list or logs

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript 5
- **UI:** Material-UI 7, Tailwind CSS 4
- **State Management:** Zustand (client UI), TanStack React Query (server data), nuqs (URL state) — see [docs/state-management.md](docs/state-management.md) and [ADR 0001](docs/adr/0001-client-state-management.md)
- **Authentication:** NextAuth 5 (CANFAR/OIDC modes) — see [docs/auth-session-authorization.md](docs/auth-session-authorization.md) for the login vs 401/403 model
- **Runtime:** Node.js 22+

## Building

Dependencies for building are:

- Node.js 22.11 or later
- npm or yarn

### Installation

```bash
# Clone the repository
git clone git@github.com:opencadc/science-portal.git
cd science-portal

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local
```

### Environment Variables

Configure the following environment variables in `.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_LOGIN_API` | Authentication API endpoint |
| `NEXT_PUBLIC_SKAHA_API` | Session/compute API endpoint |
| `NEXT_PUBLIC_API_TIMEOUT` | API request timeout (default: 30000ms) |
| `NEXT_PUBLIC_SRCNET_LOGO_URL` | Optional. SRCNet header logo image URL or path (OIDC mode). When unset, defaults to `{NEXT_PUBLIC_BASE_PATH}/SRCNetLogo.png` |
| `AUTH_SECRET` | NextAuth secret key |
| `NEXT_USE_CANFAR` | Toggle between CANFAR/OIDC auth mode |

When **`NEXT_USE_CANFAR=false`** (and matching `NEXT_PUBLIC_USE_CANFAR`), also configure OIDC issuer, client, `NEXTAUTH_URL`, **`NEXT_OIDC_REDIRECT_URI` / `NEXT_PUBLIC_OIDC_REDIRECT_URI`**, and **`NEXT_OIDC_CALLBACK_URI` / `NEXT_PUBLIC_OIDC_CALLBACK_URI`**—see [.env.example](.env.example). Full deployment notes including IdP redirect registration are under [Deploying with OIDC](#deploying-with-oidc-openid-connect).

### Development

```bash
# Start development server with Turbopack
npm run dev

# Run linting
npm run lint

# Format code
npm run format
```

The application will be available at `http://localhost:3000`.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/              # API routes (auth, sessions, storage)
│   ├── components/       # UI components (Material-UI based)
│   ├── providers/        # React context providers
│   └── page.tsx          # Route shells (thin)
├── lib/                  # Shared libraries
│   ├── api/              # API client functions
│   ├── auth/             # Authentication helpers
│   ├── config/           # Configuration files
│   ├── features/         # Route feature modules (sessions, storage, …)
│   ├── hooks/            # TanStack Query domain hooks
│   ├── stores/           # Zustand client UI store
│   └── utils/            # Utility functions
docs/
├── adr/                           # Architecture decision records
├── state-management.md            # State classification guide
└── auth-session-authorization.md  # Login vs API 401/403 (source of truth)
```

## Deployment

### Docker

Build the production image (standalone Node server on port 3000):

```bash
docker build -t science-portal .
```

Run a minimal container. The app is served under **`NEXT_PUBLIC_BASE_PATH`** (defaults to `/science-portal` in the `Dockerfile`), so open **http://localhost:3000/science-portal** unless you use an empty base path at build time.

```bash
docker run --rm \
  -p 3000:3000 \
  -e AUTH_SECRET='replace-with-a-long-random-string' \
  -e NEXT_USE_CANFAR=true \
  -e LOGIN_API='https://ws-cadc.canfar.net/ac' \
  -e SKAHA_API='https://ws-uv.canfar.net/skaha' \
  -e SERVICE_STORAGE_API='https://ws-uv.canfar.net/arc/nodes/home/' \
  science-portal
```

Adjust the three API URLs for your environment. For **OIDC** mode, follow [Deploying with OIDC](#deploying-with-oidc-openid-connect) below instead of the CANFAR URLs above.

You can also use Docker Compose:

```bash
docker-compose up --build
```

Example compose files that wire OIDC env vars include [docker-compose.oidc.example.yml](./docker-compose.oidc.example.yml).

#### CI/CD (GitHub Actions)

The workflow [`.github/workflows/ci-build.yml`](./.github/workflows/ci-build.yml) builds the Docker image on every push to `main` (and on manual dispatch) without uploading it.

Publishing a **[GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)** does the following in order:

1. Pushes the container image to **[Harbor](https://goharbor.io/)** with two tags (the Git release tag, e.g. `2.1.3`, plus `latest`). It appears under the project **Repositories** UI.
2. Signs that image (**`cosign sign`** with **`registry-referrers-mode`** defaulting to **`legacy`**) against the pushed **manifest digest**, using Fulcio/GitHub Actions **OIDC keyless**. **Legacy** avoids the distribution **`/referrers/…`** API, which older registries (including some Harbor setups) reject with `UNAUTHORIZED` / **un‑recognized request**. Set Actions variable **`COSIGN_REGISTRY_REFERRERS_MODE`** to **`oci-1-1`** if your registry fully supports [OCI Referrers](https://github.com/opencontainers/distribution-spec/blob/main/spec.md#listing-references) and Harbor is new enough that you want referrer-based attachments.
3. Sets **`helm/Chart.yaml`** `version` and **`appVersion`** to that same release tag semantically (bare SemVer, no `v` prefix).
4. Points **`helm/values.yaml`** default **`image.repository`** / **`image.tag`** at the Harbor image (`HARBOR_REGISTRY` + `HARBOR_REPOSITORY`).
5. Runs **`helm lint`**, packages the chart tarball, then **HTTP POST**s it to **`/api/chartrepo/{project}/charts`** (multipart `chart=@…`, optional `prov=@….prov` beside the tarball) so it appears under the Harbor project **Helm Charts** tab—same pathway as uploading through the UI. This does **not** use **`helm push`** or **`oci://`**.

The workflow declares **`permissions: id-token: write`** so GitHub can mint an OIDC token for keyless Sigstore certificates **for the container image only**. Organizations or forks can block that policy; runners must reach the public Rekor/Fulcio endpoints unless you customize Cosign offline behavior.

Packaging applies only inside the Actions runner—it does **not** commit Helm file updates back to the branch. Maintain `helm/` in git separately if you want the repo defaults to mirror each release.

**Actions variables**, under *Settings → Secrets and variables → Actions*:

| Name | Meaning |
|------|--------|
| `HARBOR_REGISTRY` | Registry hostname (`docker login` host), default HTTPS base **`https://${HARBOR_REGISTRY}`** for Harbor’s Chart API unless overridden |
| `HARBOR_REPOSITORY` | Docker repository path inside the registry, e.g. `platform/science-portal` |
| `HARBOR_HELM_PROJECT` _(optional)_ | Harbor **project name** used for classic chart upload (`POST /api/chartrepo/<project>/charts`). If unset, **`HARBOR_HELM_OCI_REPOSITORY`** may still supply it |
| `HARBOR_HELM_OCI_REPOSITORY` _(optional, deprecated alias)_ | Legacy name — same semantics as **`HARBOR_HELM_PROJECT`** when the latter is unset; otherwise ignored |
| `HARBOR_API_BASE` _(optional)_ | Full Harbor URL if the REST API lives elsewhere than **`https://<HARBOR_REGISTRY>`** (no trailing slash; use when Harbor is exposed under a path prefix or different ingress host) |
| `COSIGN_REGISTRY_REFERRERS_MODE` _(optional)_ | Cosign **`--registry-referrers-mode`**: unset ⇒ **`legacy`** (for registries that do not serve **`GET /v2/.../referrers/...`**); set **`oci-1-1`** when your Harbor/registry supports [OCI Referrers](https://github.com/opencontainers/distribution-spec/blob/main/spec.md#listing-references) |

**Secrets:** `HARBOR_USERNAME`, `HARBOR_PASSWORD` — Docker push plus chart upload permission; also passed to **`cosign sign`** so Cosign pushes the signature with the same registry credentials (`docker/login-action` remains required for **`build-push`**).

**Consumers:** Charts from this path are fetched with Helm’s **`chartrepo`** index, for example **`helm repo add`** against **`https://<host>/chartrepo/<project>`** (see Harbor’s Helm chart docs for your Harbor version).

Patching logic lives in [.github/scripts/patch-helm-release.py](.github/scripts/patch-helm-release.py). Use **bare SemVer** Git release tags (for example **`2.1.3`** or **`2.0.0-rc.1`**); they become **`Chart.yaml` `version`**, **`appVersion`**, and **`values.yaml` `image.tag`**, so `version` must stay valid for `helm package`.

### Deploying with OIDC (OpenID Connect)

Use OIDC mode when **`NEXT_USE_CANFAR=false`** and **`NEXT_PUBLIC_USE_CANFAR=false`**. Supply **`AUTH_SECRET`** and set **`NEXTAUTH_URL`** to the public URL visitors use for this deployment (scheme, host, and non-default port if any). Behind a reverse proxy that terminates TLS, set **`AUTH_TRUST_HOST=true`** (or **`AUTH_URL`**) so redirects and cookie security match HTTPS; align this with `.env.example` comments.

Define your IdP (**`NEXT_OIDC_URI`**, **`NEXT_OIDC_CLIENT_ID`**, **`NEXT_OIDC_CLIENT_SECRET`**, **`NEXT_OIDC_SCOPE`**) plus the mirrored **`NEXT_PUBLIC_OIDC_*`** values for client-side discovery. OIDC-backed deployments normally use **`SRC_SKAHA_API`** / **`SRC_CAVERN_API`** instead of CANFAR `LOGIN_API`/`SKAHA_API`—see [.env.example](.env.example).

#### Callback and redirect URIs

Naming in this codebase:

- **Redirect URI** (`NEXT_OIDC_REDIRECT_URI` / `NEXT_PUBLIC_OIDC_REDIRECT_URI`) — OAuth 2 authorization-code **`redirect_uri`**. Sent to the IdP and handled by Auth.js / NextAuth at **`/api/auth/callback/oidc`**. This value **must exactly match** an allowed redirect URI in your IdP registration (often called “Redirect URIs”, “Valid redirect URIs”, or callback URLs).

- **Callback URI** (`NEXT_OIDC_CALLBACK_URI` / `NEXT_PUBLIC_OIDC_CALLBACK_URI`) — The portal’s **public landing URL** for this build (usually the UI root). It is required in configuration and must match how users reach the app; register it too if your IdP asks for origins, post-login URLs, or CORS/Web origins separately.

Express both using your public **origin** (no trailing path beyond what you need for the host) plus **`NEXT_PUBLIC_BASE_PATH`** (empty for root deployments, otherwise e.g. `/science-portal`):

| Concept | Typical URL |
| --------|---------------|
| **Register with IdP as OAuth redirect** | `{ORIGIN}{BASE}/api/auth/callback/oidc` |
| **Set redirect env vars to** | same as the row above |
| **Set callback env vars to** | `{ORIGIN}{BASE}` (portal entry; optionally with a trailing `/` consistent with how you expose the app) |

Here `{ORIGIN}` is whatever you effectively use as the site URL (e.g. `https://www.canfar.net` or `http://localhost:3000`), and **`{BASE}`** is **`NEXT_PUBLIC_BASE_PATH`** with no duplicate slashes when concatenating.

**Examples:**

- Production-style host with base path: `ORIGIN=https://www.canfar.net`, `BASE=/science-portal` → register and set **`https://www.canfar.net/science-portal/api/auth/callback/oidc`**; set callback env vars to **`https://www.canfar.net/science-portal`**.

- **`npm run dev`** on port `3000` with no base path: register **`http://localhost:3000/api/auth/callback/oidc`**; set callback vars to **`http://localhost:3000/`** (see [.env.example](.env.example) for the exact defaults your team prefers).

Never omit **`{BASE}`** from the OAuth path when **`NEXT_PUBLIC_BASE_PATH`** is set; browsers invoke NextAuth at **`{BASE}/api/auth/*`**.

### Kubernetes

Helm charts are provided for Kubernetes deployment. See the [Helm documentation](./helm/README.md) for detailed instructions.

```bash
# Quick start with Helm
helm install science-portal ./helm/science-portal
```

For deployment mode details (CANFAR vs OIDC), refer to [DEPLOYMENT-MODES.md](./helm/DEPLOYMENT-MODES.md).

## Documentation

- [Development Guide](./DEVELOPMENT_GUIDE.md) - Local development setup and testing
- [Helm Deployment](https://www.opencadc.org/deployments/helm/science-platform/science-portal/) - Kubernetes deployment with Helm
- [Kubernetes Guide](./helm/KUBERNETES-DEPLOYMENT-GUIDE.md) - Complete K8s deployment instructions

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the [OpenCADC](https://github.com/opencadc) initiative and is licensed under GPL-3.0.
