/**
 * Fault catalog shaped like OpenCADC Java services (cadc-rest, Skaha, Cavern/VOSpace, AC).
 * Bodies are picked at request time so refresh exercises different messages and encodings.
 */

const SKAHA_STACK = (simpleName, message, action = 'GetAction') =>
  `ca.nrc.cadc.auth.${simpleName}: ${message}
	at org.opencadc.skaha.session.${action}.checkAuthentication(${action}.java:118)
	at org.opencadc.skaha.session.${action}.doAction(${action}.java:86)
	at ca.nrc.cadc.rest.RestServlet.doGet(RestServlet.java:201)
	at jakarta.servlet.http.HttpServlet.service(HttpServlet.java:527)
`;

const CADC_XML = (type, detail) => `<?xml version="1.0" encoding="UTF-8"?>
<fault>
  <message>${escapeXml(type)}</message>
  <detail>${escapeXml(detail)}</detail>
</fault>
`;

const VOSPACE_XML = (detail) => `<?xml version="1.0" encoding="UTF-8"?>
<vos:error xmlns:vos="http://www.ivoa.net/xml/VOSpace/v2.0">
${escapeXml(detail)}
</vos:error>
`;

const JERSEY_JSON = (status, error, message, path) =>
  JSON.stringify({
    timestamp: new Date().toISOString(),
    status,
    error,
    message,
    path,
  });

const CADC_JSON = (type, message) => JSON.stringify({ error: type, message });

/** Default Jetty 9/10 error page (cadc-rest often sits behind this). */
const JETTY_HTML = (status, reason, pathname, message) => `<html>
<head>
<meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
<title>Error ${status} ${reason}</title>
</head>
<body><h2>HTTP ERROR ${status} ${reason}</h2>
<table>
<tr><th>URI:</th><td>${escapeXml(pathname)}</td></tr>
<tr><th>STATUS:</th><td>${status}</td></tr>
<tr><th>MESSAGE:</th><td>${escapeXml(message)}</td></tr>
<tr><th>SERVLET:</th><td>ca.nrc.cadc.rest.RestServlet</td></tr>
</table>
</body>
</html>
`;

/** Tomcat 9/10 default report (AC / older deployments). */
const TOMCAT_HTML = (status, reason, message) => `<!doctype html><html lang="en"><head>
<title>HTTP Status ${status} – ${reason}</title></head>
<body><h1>HTTP Status ${status} – ${reason}</h1>
<p><b>Type</b> Status Report</p>
<p><b>Message</b> ${escapeXml(message)}</p>
<p><b>Description</b> The server understood the request but refuses to authorize it.</p>
<hr class="line" /><h3>Apache Tomcat/9.0.83</h3>
</body></html>
`;

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** @typedef {{ id: string, status: number, contentType: string, body: string | ((ctx: object) => string) }} JavaFault */

/** @type {Record<string, JavaFault[]>} */
const CATALOG = {
  skaha: [
    {
      id: 'skaha-not-authenticated',
      status: 401,
      contentType: 'text/plain; charset=UTF-8',
      body: 'NotAuthenticated: No credentials found',
    },
    {
      id: 'skaha-not-authenticated-stack',
      status: 401,
      contentType: 'text/plain; charset=UTF-8',
      body: SKAHA_STACK('NotAuthenticatedException', 'No credentials found'),
    },
    {
      id: 'skaha-invalid-token',
      status: 401,
      contentType: 'text/plain; charset=UTF-8',
      body: 'NotAuthenticated: invalid or expired access token',
    },
    {
      id: 'skaha-not-member',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: ({ username }) =>
        `PermissionDenied: user ${username} is not a member of group skaha-users`,
    },
    {
      id: 'skaha-max-sessions',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: 'User has reached the maximum of 3 active sessions.',
    },
    {
      id: 'skaha-private-image',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: 'No authentication provided for unknown or private image: images.canfar.net/secret/notebook:1.2',
    },
    {
      id: 'skaha-quota',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: 'quota exceeded: requested 16G RAM exceeds remaining allocation',
    },
    {
      id: 'skaha-permission-list',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: SKAHA_STACK('AccessControlException', 'permission denied: session list'),
    },
    {
      id: 'skaha-jersey-forbidden',
      status: 403,
      contentType: 'application/json',
      body: ({ pathname }) => JERSEY_JSON(403, 'Forbidden', 'Access is denied', pathname),
    },
    {
      id: 'skaha-jetty-html',
      status: 403,
      contentType: 'text/html; charset=UTF-8',
      body: ({ pathname }) =>
        JETTY_HTML(403, 'Forbidden', pathname, 'permission denied: session list'),
    },
    {
      id: 'skaha-plain-typename',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: 'PermissionDenied',
    },
    {
      id: 'skaha-transient',
      status: 503,
      contentType: 'text/plain; charset=UTF-8',
      body: 'ca.nrc.cadc.net.TransientException: service busy, try again later',
    },
    {
      id: 'skaha-bad-gateway',
      status: 502,
      contentType: 'text/html; charset=UTF-8',
      body: ({ pathname }) =>
        JETTY_HTML(502, 'Bad Gateway', pathname, 'proxy: skaha upstream closed connection'),
    },
    {
      id: 'skaha-not-found',
      status: 404,
      contentType: 'text/plain; charset=UTF-8',
      body: ({ pathname }) => `NotFound: session not found: ${pathname.split('/').pop() || 'unknown'}`,
    },
    {
      id: 'skaha-name-conflict',
      status: 409,
      contentType: 'text/plain; charset=UTF-8',
      body: 'Conflict: session name already exists: demo-notebook',
    },
    {
      id: 'skaha-rate-limit',
      status: 429,
      contentType: 'text/plain; charset=UTF-8',
      body: 'TooManyRequests: rate limit exceeded for /v1/session',
    },
    {
      id: 'skaha-k8s-list',
      status: 500,
      contentType: 'text/plain; charset=UTF-8',
      body: SKAHA_STACK(
        'RuntimeException',
        'Failed to list pods in namespace skaha-workload',
        'SessionDao',
      ),
    },
    {
      id: 'skaha-k8s-timeout',
      status: 503,
      contentType: 'text/plain; charset=UTF-8',
      body: 'ServiceUnavailable: kubernetes API timed out',
    },
  ],
  cavern: [
    {
      id: 'cavern-not-authenticated',
      status: 401,
      contentType: 'text/plain; charset=UTF-8',
      body: 'NotAuthenticated: No credentials found',
    },
    {
      id: 'cavern-cadc-xml-auth',
      status: 401,
      contentType: 'application/xml; charset=UTF-8',
      body: CADC_XML('NotAuthenticated', 'No credentials found'),
    },
    {
      id: 'cavern-permission-home',
      status: 403,
      contentType: 'application/xml; charset=UTF-8',
      body: ({ username }) =>
        VOSPACE_XML(`PermissionDenied: permission denied: vos://cadc.nrc.ca~cavern/home/${username}`),
    },
    {
      id: 'cavern-cadc-xml-denied',
      status: 403,
      contentType: 'application/xml; charset=UTF-8',
      body: ({ username }) =>
        CADC_XML('PermissionDenied', `permission denied: /home/${username}`),
    },
    {
      id: 'cavern-not-owner',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: ({ username }) =>
        `PermissionDenied: user ${username} is not the owner of node /home/${username}`,
    },
    {
      id: 'cavern-json',
      status: 403,
      contentType: 'application/json',
      body: ({ username }) =>
        CADC_JSON('PermissionDenied', `permission denied: user ${username} cannot read node`),
    },
    {
      id: 'cavern-tomcat-html',
      status: 403,
      contentType: 'text/html; charset=ISO-8859-1',
      body: ({ username }) =>
        TOMCAT_HTML(403, 'Forbidden', `permission denied: /home/${username}`),
    },
    {
      id: 'cavern-transient',
      status: 503,
      contentType: 'text/plain; charset=UTF-8',
      body: 'ca.nrc.cadc.net.TransientException: transfer failed: cavern backend busy',
    },
    {
      id: 'cavern-node-missing',
      status: 404,
      contentType: 'application/xml; charset=UTF-8',
      body: ({ username }) =>
        VOSPACE_XML(`NodeNotFound: node not found: vos://cadc.nrc.ca~cavern/home/${username}`),
    },
    {
      id: 'cavern-busy',
      status: 503,
      contentType: 'text/plain; charset=UTF-8',
      body: 'ServiceUnavailable: cavern backend busy',
    },
    {
      id: 'cavern-internal',
      status: 500,
      contentType: 'text/plain; charset=UTF-8',
      body: 'ca.nrc.cadc.vos.NodeFault: unexpected error reading container properties\n\tat org.opencadc.cavern.nodes.GetAction.doAction(GetAction.java:154)\n',
    },
  ],
  ac: [
    {
      id: 'ac-not-authenticated',
      status: 401,
      contentType: 'text/plain; charset=UTF-8',
      body: 'NotAuthenticated',
    },
    {
      id: 'ac-cookie-expired',
      status: 401,
      contentType: 'text/plain; charset=UTF-8',
      body: 'NotAuthenticated: CADC_SSO cookie expired or invalid',
    },
    {
      id: 'ac-permission-denied',
      status: 403,
      contentType: 'text/plain; charset=UTF-8',
      body: 'PermissionDenied: permission denied',
    },
    {
      id: 'ac-xml',
      status: 403,
      contentType: 'application/xml; charset=UTF-8',
      body: CADC_XML('PermissionDenied', 'permission denied: whoami'),
    },
    {
      id: 'ac-tomcat-html',
      status: 401,
      contentType: 'text/html; charset=ISO-8859-1',
      body: TOMCAT_HTML(401, 'Unauthorized', 'NotAuthenticated'),
    },
    {
      id: 'ac-user-not-found',
      status: 404,
      contentType: 'text/plain; charset=UTF-8',
      body: ({ username }) => `NotFound: user not found: ${username}`,
    },
    {
      id: 'ac-internal',
      status: 500,
      contentType: 'text/plain; charset=UTF-8',
      body: 'InternalServerError: LDAP lookup failed',
    },
  ],
};

export function serviceForPath(pathname) {
  if (pathname.startsWith('/v1/')) return 'skaha';
  if (pathname.startsWith('/cavern/')) return 'cavern';
  return 'ac';
}

export function usernameFromPath(pathname) {
  const home = pathname.match(/\/home\/([^/]+)/);
  if (home) return home[1];
  const users = pathname.match(/\/users\/([^/]+)/);
  if (users) return users[1];
  return 'devuser';
}

/**
 * Pick a Java-shaped fault. `status` may be a number or `'random'`.
 */
export function pickJavaFault({ service, status, pathname, method }) {
  const family = CATALOG[service] || CATALOG.ac;
  const want = status === 'random' || status == null ? null : Number(status);
  const pool = want ? family.filter((f) => f.status === want) : family;
  const chosen = pick(pool.length > 0 ? pool : family);
  const ctx = { pathname, method, username: usernameFromPath(pathname) };
  const body = typeof chosen.body === 'function' ? chosen.body(ctx) : chosen.body;
  return {
    id: chosen.id,
    status: chosen.status,
    contentType: chosen.contentType,
    body,
  };
}

export function catalogIds() {
  return Object.fromEntries(
    Object.entries(CATALOG).map(([service, faults]) => [service, faults.map((f) => f.id)]),
  );
}
