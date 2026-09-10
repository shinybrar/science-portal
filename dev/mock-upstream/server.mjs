/**
 * Local upstream stand-in for Skaha + CADC AC + Cavern.
 *
 * Zero dependencies (Node 22 `node:http`). Point LOGIN_API / SKAHA_API /
 * SRC_* / SERVICE_STORAGE_API at this origin, then flip 401/403 on individual
 * paths without restarting Next.
 *
 *   npm run mock:upstream
 *   open http://127.0.0.1:4010
 */

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { catalogIds, pickJavaFault, serviceForPath } from './java-faults.mjs';

const PORT = Number(process.env.MOCK_UPSTREAM_PORT || 4010);
const HOST = process.env.MOCK_UPSTREAM_HOST || '127.0.0.1';
const REQUIRE_AUTH = process.env.MOCK_REQUIRE_AUTH === '1';
const ALLOWED_STATUSES = [401, 403, 404, 409, 429, 500, 502, 503];
const RANDOM_STATUS = new Set(['random', 'random-auth']);

const PRESETS = {
  ok: [],
  'sessions-401': [{ method: 'GET', path: '/v1/session', status: 401 }],
  'sessions-403': [{ method: 'GET', path: '/v1/session', status: 403 }],
  'images-403': [{ method: 'GET', path: '/v1/image', status: 403 }],
  'context-403': [{ method: 'GET', path: '/v1/context', status: 403 }],
  'storage-403': [{ method: 'GET', path: '/cavern/nodes/home/*', status: 403 }],
  'storage-401': [{ method: 'GET', path: '/cavern/nodes/home/*', status: 401 }],
  'product-401': [
    { method: '*', path: '/v1/*', status: 401 },
    { method: '*', path: '/cavern/*', status: 401 },
  ],
  'product-403': [
    { method: '*', path: '/v1/*', status: 403 },
    { method: '*', path: '/cavern/*', status: 403 },
  ],
  /** Login/whoami stay 200; everything the dashboard fetches fails. */
  'whoami-ok-rest-403': [
    { method: '*', path: '/v1/*', status: 403 },
    { method: '*', path: '/cavern/*', status: 403 },
    { method: 'GET', path: '/users/*', status: 403 },
    { method: 'GET', path: '/permissions/*', status: 403 },
  ],
  /** Sessions work; storage and images do not — typical username / ACL split. */
  mixed: [
    { method: 'GET', path: '/v1/image', status: 403 },
    { method: 'GET', path: '/cavern/nodes/home/*', status: 401 },
  ],
  /**
   * Each request picks a random Java-shaped body for the configured status
   * (message + text/xml/json style). Status stays 401/403.
   */
  'java-mix': [
    { method: '*', path: '/v1/*', status: 'random-auth' },
    { method: '*', path: '/cavern/*', status: 'random-auth' },
  ],
  /** Random status + body from the full Java catalog (401–503) per request. */
  chaos: [
    { method: '*', path: '/v1/*', status: 'random' },
    { method: '*', path: '/cavern/*', status: 'random' },
  ],
};

let rules = parseFaultEnv(process.env.MOCK_FAULTS);
if (process.env.MOCK_PRESET && PRESETS[process.env.MOCK_PRESET]) {
  rules = cloneRules(PRESETS[process.env.MOCK_PRESET]);
}

const sessions = new Map();
seedSessions();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const method = (req.method || 'GET').toUpperCase();
  const pathname = normalizePath(url.pathname);

  cors(res);
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/' && method === 'GET') {
      return send(res, 200, controlPage(), 'text/html; charset=utf-8');
    }
    if (pathname === '/__health' && method === 'GET') {
      return sendJson(res, 200, { ok: true, port: PORT, rules, catalog: catalogIds() });
    }
    if (pathname === '/__presets' && method === 'GET') {
      return sendJson(res, 200, Object.keys(PRESETS));
    }
    if (pathname === '/__faults' && method === 'GET') {
      return sendJson(res, 200, { rules, presets: Object.keys(PRESETS) });
    }
    if (pathname === '/__faults' && method === 'PUT') {
      const body = await readJson(req);
      applyFaultUpdate(body);
      console.log('[mock-upstream] faults →', rules);
      return sendJson(res, 200, { rules });
    }
    if (pathname === '/__faults' && method === 'DELETE') {
      rules = [];
      console.log('[mock-upstream] faults cleared');
      return sendJson(res, 200, { rules });
    }

    if (REQUIRE_AUTH && !isPublicPath(pathname) && !hasCredential(req)) {
      return sendJavaFault(res, {
        service: serviceForPath(pathname),
        status: 401,
        pathname,
        method,
      });
    }

    const fault = matchFault(method, pathname, url.search);
    if (fault) {
      return sendJavaFault(res, {
        service: serviceForPath(pathname),
        status: fault.status,
        pathname,
        method,
        message: fault.message,
      });
    }

    await handleUpstream(req, res, method, pathname, url);
  } catch (error) {
    console.error('[mock-upstream]', error);
    sendJson(res, 500, { error: String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\nmock-upstream  http://${HOST}:${PORT}`);
  console.log(`control UI     http://${HOST}:${PORT}/`);
  console.log(`faults         ${rules.length ? JSON.stringify(rules) : '(none — all 200)'}`);
  console.log(`require auth   ${REQUIRE_AUTH ? 'yes' : 'no'}\n`);
});

function handleUpstream(req, res, method, pathname, url) {
  if (pathname === '/login' && method === 'POST') {
    return handleLogin(req, res);
  }
  if (pathname === '/whoami' && method === 'GET') {
    return sendJson(res, 200, whoamiBody());
  }
  if (pathname.startsWith('/users/') && method === 'GET') {
    const username = pathname.slice('/users/'.length);
    return sendJson(res, 200, { username, displayName: 'Dev User', groups: ['dev'] });
  }
  if (pathname.startsWith('/permissions/') && method === 'GET') {
    return sendJson(res, 200, {
      granted: true,
      username: url.searchParams.get('username') || pathname.split('/')[2],
      resource: url.searchParams.get('resource'),
      permission: url.searchParams.get('permission'),
    });
  }

  if (pathname === '/v1/session' && method === 'GET') {
    if (url.searchParams.get('view') === 'stats') {
      return sendJson(res, 200, platformStats());
    }
    return sendJson(res, 200, [...sessions.values()].filter((s) => s.status !== 'Failed'));
  }
  if (pathname === '/v1/session' && method === 'POST') {
    return handleLaunch(req, res);
  }
  if (pathname.startsWith('/v1/session/') && method === 'GET') {
    return handleSessionGet(res, pathname, url);
  }
  if (pathname.startsWith('/v1/session/') && method === 'POST') {
    return handleSessionPost(req, res, pathname);
  }
  if (pathname.startsWith('/v1/session/') && method === 'DELETE') {
    const id = pathname.slice('/v1/session/'.length);
    sessions.delete(id);
    res.writeHead(204);
    res.end();
    return;
  }
  if (pathname === '/v1/image' && method === 'GET') {
    return sendJson(res, 200, imagesFixture());
  }
  if (pathname === '/v1/context' && method === 'GET') {
    return sendJson(res, 200, contextFixture());
  }
  if (pathname === '/v1/repository' && method === 'GET') {
    return sendJson(res, 200, ['images.canfar.net']);
  }

  if (pathname.startsWith('/cavern/nodes/home/users/') && method === 'GET') {
    return handleStorageUsers(res, pathname);
  }
  if (pathname.startsWith('/cavern/nodes/home/') && method === 'GET') {
    const username = pathname.slice('/cavern/nodes/home/'.length).split('/')[0] || 'devuser';
    return send(res, 200, vospaceXml(username), 'application/xml');
  }

  sendJson(res, 404, { error: `No mock handler for ${method} ${pathname}` });
}

async function handleLogin(req, res) {
  const body = await readText(req);
  const params = new URLSearchParams(body);
  const username = params.get('username') || 'devuser';
  const token = Buffer.from(`userID=${username}&sessionID=mock`).toString('base64');
  res.setHeader('Set-Cookie', `CADC_SSO=${token}; Path=/; HttpOnly`);
  send(res, 200, token, 'text/plain');
}

async function handleLaunch(req, res) {
  const body = await readText(req);
  const params = new URLSearchParams(body);
  const session = makeSession({
    name: params.get('name') || 'launched',
    type: params.get('type') || 'notebook',
    image: params.get('image') || 'images.canfar.net/skaha/notebook:latest',
    status: 'Pending',
  });
  sessions.set(session.id, session);
  send(res, 200, session.id, 'text/plain');
}

function handleSessionGet(res, pathname, url) {
  const rest = pathname.slice('/v1/session/'.length);
  const [id] = rest.split('/');
  const session = sessions.get(id);
  if (!session) {
    return sendJson(res, 404, { error: 'Session not found' });
  }
  const view = url.searchParams.get('view');
  if (view === 'logs') {
    return send(res, 200, `[mock] logs for ${id}\nready\n`, 'text/plain');
  }
  if (view === 'events') {
    return send(res, 200, `[mock] events for ${id}\nScheduled\nStarted\n`, 'text/plain');
  }
  sendJson(res, 200, session);
}

async function handleSessionPost(req, res, pathname) {
  const id = pathname.slice('/v1/session/'.length);
  const session = sessions.get(id);
  if (!session) {
    return sendJson(res, 404, { error: 'Session not found' });
  }
  const body = await readText(req);
  if (body.includes('action=renew')) {
    session.expiryTime = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    return sendJson(res, 200, session);
  }
  sendJson(res, 400, { error: 'Unknown session action' });
}

function handleStorageUsers(res, pathname) {
  const rest = pathname.slice('/cavern/nodes/home/users/'.length);
  const [username, kind] = rest.split('/');
  if (kind === 'quota') {
    return sendJson(res, 200, {
      name: username,
      quota: 107374182400,
      used: 19712409,
      available: 107354470000,
      unit: 'bytes',
    });
  }
  if (kind === 'files') {
    return sendJson(res, 200, [
      {
        name: 'notes.txt',
        path: '/notes.txt',
        type: 'file',
        size: 128,
        lastModified: '2026-05-22T12:34:56.000Z',
      },
    ]);
  }
  sendJson(res, 404, { error: `Unknown storage path ${pathname}` });
}

function applyFaultUpdate(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('JSON object required');
  }
  if (body.preset) {
    if (!PRESETS[body.preset]) {
      throw new Error(`Unknown preset: ${body.preset}. Try: ${Object.keys(PRESETS).join(', ')}`);
    }
    rules = cloneRules(PRESETS[body.preset]);
    return;
  }
  if (Array.isArray(body.rules)) {
    rules = body.rules.map(normalizeRule);
    return;
  }
  if (body.add) {
    rules = [...rules, normalizeRule(body.add)];
    return;
  }
  throw new Error('Send { preset }, { rules }, or { add }');
}

function matchFault(method, pathname, search) {
  for (const rule of rules) {
    if (rule.method !== '*' && rule.method !== method) continue;
    const [pathPart, queryPart] = rule.path.split('?');
    if (queryPart && !search.includes(queryPart)) continue;
    if (pathMatches(pathPart, pathname)) return rule;
  }
  return null;
}

function pathMatches(pattern, pathname) {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  if (pattern.endsWith('*')) {
    return pathname.startsWith(pattern.slice(0, -1));
  }
  return pathname === pattern;
}

function parseFaultEnv(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map((part) => {
    const trimmed = part.trim();
    const colon = trimmed.lastIndexOf(':');
    const left = trimmed.slice(0, colon).trim();
    const statusRaw = trimmed.slice(colon + 1).trim();
    const status = RANDOM_STATUS.has(statusRaw) ? statusRaw : Number(statusRaw);
    const space = left.indexOf(' ');
    if (space === -1) {
      return normalizeRule({ method: '*', path: left, status });
    }
    return normalizeRule({
      method: left.slice(0, space),
      path: left.slice(space + 1),
      status,
    });
  });
}

function normalizeRule(rule) {
  const raw = rule.status;
  const status =
    typeof raw === 'string' && RANDOM_STATUS.has(raw) ? raw : Number(raw);
  if (typeof status === 'number' && !ALLOWED_STATUSES.includes(status)) {
    throw new Error(`Unsupported fault status: ${rule.status}`);
  }
  if (typeof status === 'string' && !RANDOM_STATUS.has(status)) {
    throw new Error(`Unsupported fault status: ${rule.status}`);
  }
  return {
    method: (rule.method || '*').toUpperCase(),
    path: rule.path.startsWith('/') ? rule.path : `/${rule.path}`,
    status,
    message: rule.message,
  };
}

function cloneRules(list) {
  return list.map((r) => ({ ...r }));
}

function isPublicPath(pathname) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/__') ||
    pathname === '/'
  );
}

function hasCredential(req) {
  return Boolean(req.headers.authorization || req.headers.cookie);
}

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

function seedSessions() {
  for (const session of [
    makeSession({ name: 'demo-notebook', type: 'notebook', status: 'Running' }),
    makeSession({ name: 'demo-desktop', type: 'desktop', status: 'Running' }),
  ]) {
    sessions.set(session.id, session);
  }
}

function makeSession({ name, type, image, status }) {
  const id = randomUUID().slice(0, 8);
  const now = Date.now();
  return {
    id,
    userid: 'devuser',
    runAsUID: '1000',
    runAsGID: '1000',
    image: image || 'images.canfar.net/skaha/notebook:1.0.0',
    type: type || 'notebook',
    status: status || 'Running',
    name,
    startTime: new Date(now - 60 * 60 * 1000).toISOString(),
    expiryTime: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
    connectURL: `https://example.test/session/${id}`,
    requestedRAM: '8',
    requestedCPUCores: '2',
    requestedGPUCores: '0',
    ramInUse: '1.2',
    cpuCoresInUse: '0.3',
    isFixedResources: false,
  };
}

function whoamiBody() {
  return {
    username: 'devuser',
    displayName: 'Dev User',
    email: 'devuser@example.com',
    user: {
      posixDetails: {
        username: { $: 'devuser' },
        uid: { $: 1000 },
        gid: { $: 1000 },
        homeDirectory: { $: '/home/devuser' },
      },
      personalDetails: {
        firstName: { $: 'Dev' },
        lastName: { $: 'User' },
        email: { $: 'devuser@example.com' },
        institute: { $: 'CADC' },
      },
      identities: {
        $: [
          { identity: { '@type': 'HTTP', $: 'devuser' } },
          { identity: { '@type': 'CADC', $: '12345' } },
        ],
      },
      internalID: { uri: { $: 'ivo://cadc.nrc.ca/user/devuser' } },
    },
  };
}

function imagesFixture() {
  return [
    { id: 'images.canfar.net/skaha/notebook:1.0.0', types: ['notebook'] },
    { id: 'images.canfar.net/skaha/desktop:1.0.0', types: ['desktop'] },
    { id: 'images.canfar.net/skaha/carta:4.0.0', types: ['carta'] },
  ];
}

function contextFixture() {
  return {
    cores: {
      default: 2,
      defaultRequest: 1,
      defaultLimit: 8,
      defaultHeadless: 2,
      options: [1, 2, 4, 8],
    },
    memoryGB: {
      default: 8,
      defaultRequest: 4,
      defaultLimit: 32,
      defaultHeadless: 8,
      options: [4, 8, 16, 32],
    },
    gpus: { options: [0, 1] },
  };
}

function platformStats() {
  return {
    cores: {
      requestedCPUCores: 4,
      cpuCoresAvailable: 64,
      maxCPUCores: { cpuCores: 8, withRam: '32' },
    },
    ram: {
      requestedRAM: '16',
      ramAvailable: '256',
      maxRAM: { ram: '32', withCPUCores: 8 },
    },
  };
}

function vospaceXml(username) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<vos:node xmlns:vos="http://www.ivoa.net/xml/VOSpace/v2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" uri="vos://canfar.net~mock~cavern/home/${username}" xsi:type="vos:ContainerNode">
  <vos:properties>
    <vos:property uri="ivo://ivoa.net/vospace/core#length">19712409</vos:property>
    <vos:property uri="ivo://ivoa.net/vospace/core#quota">107374182400</vos:property>
    <vos:property uri="ivo://ivoa.net/vospace/core#date">2026-05-22T12:34:56.000Z</vos:property>
  </vos:properties>
</vos:node>`;
}

function sendJavaFault(res, { service, status, pathname, method, message }) {
  const pickStatus = status === 'random-auth' ? pick([401, 403]) : status;
  const fault = pickJavaFault({ service, status: pickStatus, pathname, method });
  if (message) {
    fault.body = message;
    fault.contentType = 'text/plain; charset=UTF-8';
  }
  console.log(
    `[mock-upstream] FAULT ${fault.status} ${method} ${pathname} [${fault.id}] ${fault.contentType}`,
  );
  res.setHeader('X-Mock-Fault-Id', fault.id);
  if (fault.status === 401) {
    res.setHeader('WWW-Authenticate', 'ivoa_x509, CADC_SSO, Bearer realm="opencadc"');
  }
  send(res, fault.status, fault.body, fault.contentType);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Cookie');
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), 'application/json');
}

function send(res, status, body, contentType) {
  const buf = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
  });
  res.end(buf);
}

function readText(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const text = await readText(req);
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function controlPage() {
  const presetButtons = Object.keys(PRESETS)
    .map((name) => `<button data-preset="${name}">${name}</button>`)
    .join('\n    ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>mock-upstream</title>
  <style>
    body { font: 14px/1.45 system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; }
    code, pre { font-family: ui-monospace, monospace; font-size: 12px; }
    pre { background: #f4f4f5; padding: 0.75rem 1rem; overflow: auto; }
    button { margin: 0 0.35rem 0.35rem 0; }
    .row { margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>mock-upstream</h1>
  <p>Point portal <code>LOGIN_API</code> / <code>SKAHA_API</code> / <code>SRC_*</code> / storage bases at
    <code>http://${HOST}:${PORT}</code> (storage bases must end with <code>/cavern/nodes/home/</code>).</p>
  <p>Faults use OpenCADC/Java encodings (cadc-rest text, exception stacks, VOSpace XML, Jersey JSON).
    <code>java-mix</code> randomizes 401/403 bodies per request; <code>chaos</code> also randomizes status.</p>
  <div class="row">
    <strong>Presets</strong><br />
    ${presetButtons}
    <button data-clear="1">clear</button>
  </div>
  <pre id="out">loading…</pre>
  <script>
    const out = document.getElementById('out');
    async function refresh() {
      const res = await fetch('/__faults');
      out.textContent = JSON.stringify(await res.json(), null, 2);
    }
    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.clear) {
        await fetch('/__faults', { method: 'DELETE' });
      } else if (btn.dataset.preset) {
        await fetch('/__faults', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: btn.dataset.preset }),
        });
      }
      refresh();
    });
    refresh();
  </script>
</body>
</html>`;
}
