/**
 * Turn a portal BFF / upstream error body into a short Error for widgets.
 *
 * Upstream (and even the BFF JSON wrapper) is untrusted: never use its
 * `message` as chrome, never echo raw HTML/JSON, and never keep more than a
 * short sanitized excerpt.
 */

export const MAX_UNTRUSTED_ERROR_CHARS = 8_192;
export const MAX_ERROR_LINE_CHARS = 220;

export function firstJavaErrorLine(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return sanitizeUntrustedLine(messageFromJsonObject(raw as Record<string, unknown>));
  }

  const text = capUntrusted(typeof raw === 'string' ? raw : safeStringify(raw));
  if (!text.trim()) return undefined;
  if (isHostileMarkup(text)) return undefined;

  const fromJsonText = messageFromJsonText(text);
  if (fromJsonText) return sanitizeUntrustedLine(fromJsonText);

  const htmlMessage = text.match(/<b>\s*Message\s*<\/b>\s*([^<]+)/i);
  if (htmlMessage) {
    const line = sanitizeUntrustedLine(unescapeXml(htmlMessage[1]));
    if (line) return line;
  }
  const jettyMessage = text.match(/<th>\s*MESSAGE:\s*<\/th>\s*<td>([^<]+)<\/td>/i);
  if (jettyMessage) {
    const line = sanitizeUntrustedLine(unescapeXml(jettyMessage[1]));
    if (line) return line;
  }

  const exception = text.match(/([A-Za-z][\w.]*(?:Exception|Fault)):\s*([^\n\r]+)/);
  if (exception) {
    const simple = exception[1].split('.').pop() ?? exception[1];
    const line = sanitizeUntrustedLine(`${simple}: ${exception[2]}`);
    if (line) return line;
  }

  const xmlDetail = text.match(/<detail>([\s\S]*?)<\/detail>/i);
  if (xmlDetail) {
    const line = sanitizeUntrustedLine(unescapeXml(xmlDetail[1]));
    if (line) return line;
  }

  return sanitizeUntrustedLine(
    text.replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<[^>]+>/g, ' '),
  );
}

export async function throwIfNotOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  throw await errorFromPortalResponse(response, fallback);
}

export async function errorFromPortalResponse(
  response: Response,
  fallback = 'Request failed',
): Promise<Error> {
  const text = capUntrusted(await response.text());
  const prefix = fallback.trim() || 'Request failed';
  let excerpt: unknown;

  try {
    const json: unknown = JSON.parse(text);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const body = json as { details?: unknown };
      if (Object.hasOwn(body, 'details')) {
        excerpt = body.details;
      }
    } else {
      excerpt = text;
    }
  } catch {
    excerpt = text;
  }

  const javaLine = firstJavaErrorLine(excerpt);
  if (javaLine && javaLine !== prefix) {
    return new Error(`${prefix}: ${javaLine} (${response.status})`);
  }
  return new Error(`${prefix}: ${response.status}`);
}

/** Clip untrusted upstream text before the BFF forwards it to the browser. */
export function clipUntrustedDetails(details: unknown): unknown {
  if (details == null) return undefined;
  if (typeof details === 'string') return capUntrusted(details);
  if (typeof details === 'number' || typeof details === 'boolean') return undefined;
  if (typeof details === 'object') {
    try {
      const text = JSON.stringify(details);
      if (!text) return undefined;
      return text.length > MAX_UNTRUSTED_ERROR_CHARS ? capUntrusted(text) : details;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function messageFromJsonText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return messageFromJsonObject(parsed as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

function messageFromJsonObject(obj: Record<string, unknown>): string | undefined {
  const message = readOwnString(obj, 'message');
  const type = readOwnString(obj, 'error');
  if (!message && !type) return undefined;
  if (message && type && type !== message) return `${type}: ${message}`;
  return message || type;
}

function readOwnString(obj: Record<string, unknown>, key: string): string {
  if (!Object.hasOwn(obj, key)) return '';
  const value = obj[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isHostileMarkup(value: string): boolean {
  return /<script|javascript:|data:|vbscript:|on\w+\s*=/i.test(value);
}

function isPlausibleErrorLine(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 3 || !/[A-Za-z]/.test(compact)) return false;
  return !/^(.)\1+$/.test(compact);
}

function sanitizeUntrustedLine(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (isHostileMarkup(value)) return undefined;
  let text = value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g,
    '',
  );
  text = text.replace(/javascript:/gi, '').replace(/data:/gi, '').replace(/vbscript:/gi, '');
  text = collapseWs(text.replace(/<[^>]*>/g, ' '));
  text = collapseWs(text.replace(/[<>]/g, ''));
  if (!text) return undefined;
  if (text.startsWith('{') || text.startsWith('[')) return undefined;
  if (/^(null|true|false|undefined|-?\d+)$/i.test(text)) return undefined;
  if (text === '[object Object]') return undefined;
  const line = text.slice(0, MAX_ERROR_LINE_CHARS);
  return isPlausibleErrorLine(line) ? line : undefined;
}

function capUntrusted(text: string): string {
  return text.length > MAX_UNTRUSTED_ERROR_CHARS ? text.slice(0, MAX_UNTRUSTED_ERROR_CHARS) : text;
}

function collapseWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function unescapeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"');
}

function safeStringify(raw: unknown): string {
  try {
    return JSON.stringify(raw) ?? '';
  } catch {
    return String(raw);
  }
}
