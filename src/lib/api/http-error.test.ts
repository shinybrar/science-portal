import { describe, expect, it } from 'vitest';
import {
  MAX_ERROR_LINE_CHARS,
  MAX_UNTRUSTED_ERROR_CHARS,
  clipUntrustedDetails,
  errorFromPortalResponse,
  firstJavaErrorLine,
  throwIfNotOk,
} from './http-error';

describe('firstJavaErrorLine', () => {
  describe('empty and untrusted input', () => {
    it('returns undefined for nullish, blank, or non-text values', () => {
      expect(firstJavaErrorLine(undefined)).toBeUndefined();
      expect(firstJavaErrorLine(null)).toBeUndefined();
      expect(firstJavaErrorLine('')).toBeUndefined();
      expect(firstJavaErrorLine('   \n\t  ')).toBeUndefined();
      expect(firstJavaErrorLine(403)).toBeUndefined();
      expect(firstJavaErrorLine(true)).toBeUndefined();
      expect(firstJavaErrorLine(['PermissionDenied', 'no'])).toBeUndefined();
      expect(firstJavaErrorLine({ error: 403, message: 500 })).toBeUndefined();
    });

    it('does not throw on circular objects or inherited fields', () => {
      const circular: { self?: unknown } = {};
      circular.self = circular;
      expect(firstJavaErrorLine(circular)).toBeUndefined();

      const polluted = Object.create({ message: 'inherited phishing', error: 'Forbidden' });
      expect(firstJavaErrorLine(polluted)).toBeUndefined();
    });

    it('does not echo raw JSON, markup leftovers, or script bodies as a line', () => {
      expect(firstJavaErrorLine('{error: PermissionDenied}')).toBeUndefined();
      expect(firstJavaErrorLine('{"error":"   ","message":"   "}')).toBeUndefined();
      expect(firstJavaErrorLine('<script>alert(1)</script>')).toBeUndefined();
      expect(firstJavaErrorLine('<')).toBeUndefined();
      expect(firstJavaErrorLine('<>')).toBeUndefined();
      expect(firstJavaErrorLine('javascript:alert(1)')).toBeUndefined();
    });
  });

  describe('cadc-rest text and stacks', () => {
    it('reads a cadc-rest exception line and drops the stack', () => {
      const raw = `ca.nrc.cadc.auth.NotAuthenticatedException: No credentials found
	at org.opencadc.skaha.session.GetAction.checkAuthentication(GetAction.java:118)
`;
      expect(firstJavaErrorLine(raw)).toBe('NotAuthenticatedException: No credentials found');
    });

    it('uses the first exception in a Caused by chain', () => {
      const raw = `ca.nrc.cadc.auth.AccessControlException: permission denied: session list
	at org.opencadc.skaha.session.GetAction.doAction(GetAction.java:86)
Caused by: java.io.IOException: broken pipe
	at java.base/sun.nio.ch.FileDispatcherImpl.write0(Native Method)
`;
      expect(firstJavaErrorLine(raw)).toBe('AccessControlException: permission denied: session list');
    });

    it('keeps a type-only cadc-rest line', () => {
      expect(firstJavaErrorLine('PermissionDenied')).toBe('PermissionDenied');
      expect(firstJavaErrorLine('NotAuthenticated: No credentials found')).toBe(
        'NotAuthenticated: No credentials found',
      );
    });

    it('reads cadc *Fault types and truncates long messages', () => {
      const line = firstJavaErrorLine(`ca.nrc.cadc.vos.NodeFault: ${'x'.repeat(400)}`);
      expect(line).toHaveLength(MAX_ERROR_LINE_CHARS);
      expect(line?.startsWith('NodeFault: ')).toBe(true);
    });

    it('strips control characters and RTL overrides from stacks', () => {
      expect(
        firstJavaErrorLine('NotAuthenticatedException: No\u0000 credentials\u202E found'),
      ).toBe('NotAuthenticatedException: No credentials found');
    });
  });

  describe('XML', () => {
    it('reads cadc-rest XML <detail>', () => {
      expect(
        firstJavaErrorLine(
          '<?xml version="1.0"?><fault><message>PermissionDenied</message><detail>permission denied: /home/devuser</detail></fault>',
        ),
      ).toBe('permission denied: /home/devuser');
    });

    it('unescapes entities but drops any tags that appear after unescape', () => {
      expect(
        firstJavaErrorLine(
          '<fault><detail>permission denied: a &amp; b &lt;home&gt;</detail></fault>',
        ),
      ).toBe('permission denied: a & b');
    });

    it('skips empty <detail> and falls back to stripped text', () => {
      expect(firstJavaErrorLine('<fault><message>PermissionDenied</message><detail>  </detail></fault>')).toBe(
        'PermissionDenied',
      );
    });

    it('handles unclosed or truncated XML without throwing', () => {
      expect(firstJavaErrorLine('<fault><detail>permission denied')).toBe('permission denied');
      expect(firstJavaErrorLine('<?xml version="1.0"?><fault>')).toBeUndefined();
    });

    it('strips VOSpace tags', () => {
      expect(
        firstJavaErrorLine(
          '<vos:error xmlns:vos="http://www.ivoa.net/xml/VOSpace/v2.0">PermissionDenied: permission denied: vos://cadc.nrc.ca~cavern/home/devuser</vos:error>',
        ),
      ).toBe('PermissionDenied: permission denied: vos://cadc.nrc.ca~cavern/home/devuser');
    });
  });

  describe('JSON', () => {
    it('reads Jersey / cadc JSON message', () => {
      expect(
        firstJavaErrorLine(
          '{"timestamp":"2026-09-04T20:00:00.000Z","status":403,"error":"Forbidden","message":"Access is denied","path":"/v1/session"}',
        ),
      ).toBe('Forbidden: Access is denied');
    });

    it('reads an already-parsed object', () => {
      expect(firstJavaErrorLine({ error: 'PermissionDenied', message: 'cannot read node' })).toBe(
        'PermissionDenied: cannot read node',
      );
    });

    it('does not duplicate error when it equals message', () => {
      expect(firstJavaErrorLine({ error: 'PermissionDenied', message: 'PermissionDenied' })).toBe(
        'PermissionDenied',
      );
    });

    it('accepts message-only or error-only objects', () => {
      expect(firstJavaErrorLine({ message: 'Access is denied' })).toBe('Access is denied');
      expect(firstJavaErrorLine({ error: 'Forbidden' })).toBe('Forbidden');
    });

    it('trims JSON fields and ignores whitespace-only values', () => {
      expect(firstJavaErrorLine({ error: '  Forbidden  ', message: '  no  ' })).toBe('Forbidden: no');
      expect(firstJavaErrorLine('{"error":"   ","message":"   "}')).toBeUndefined();
    });

    it('parses JSON with leading whitespace', () => {
      expect(firstJavaErrorLine('  \n{"error":"Forbidden","message":"no"}')).toBe('Forbidden: no');
    });

    it('ignores broken JSON and trailing junk instead of echoing it', () => {
      expect(firstJavaErrorLine('{error: PermissionDenied}')).toBeUndefined();
      expect(firstJavaErrorLine('{"error":"Forbidden","message":"no"} trailing')).toBeUndefined();
      expect(firstJavaErrorLine('{"error":')).toBeUndefined();
    });

    it('does not use a backend HTML/script message', () => {
      expect(
        firstJavaErrorLine({
          error: 'Forbidden',
          message: '<script>alert(1)</script>',
        }),
      ).toBeUndefined();
    });
  });

  describe('HTML', () => {
    it('reads Jetty and Tomcat HTML message rows', () => {
      expect(
        firstJavaErrorLine(
          '<html><body><table><tr><th>MESSAGE:</th><td>permission denied: session list</td></tr></table></body></html>',
        ),
      ).toBe('permission denied: session list');
      expect(
        firstJavaErrorLine(
          '<html><body><p><b>Message</b> permission denied: /home/devuser</p></body></html>',
        ),
      ).toBe('permission denied: /home/devuser');
    });

    it('unescapes entities in HTML message rows', () => {
      expect(firstJavaErrorLine('<p><b>Message</b> denied: a &amp; b</p>')).toBe('denied: a & b');
    });

    it('returns undefined for tag-only HTML', () => {
      expect(firstJavaErrorLine('<html><body></body></html>')).toBeUndefined();
    });
  });
});

describe('errorFromPortalResponse', () => {
  function response(body: string, status = 403, contentType = 'application/json') {
    return new Response(body, { status, headers: { 'Content-Type': contentType } });
  }

  it('uses the caller fallback, not the backend message, as chrome', async () => {
    const error = await errorFromPortalResponse(
      response(
        JSON.stringify({
          message: 'Your password expired — reset at https://evil.example',
          error: 'Forbidden',
          details:
            'ca.nrc.cadc.auth.AccessControlException: permission denied: session list\n\tat GetAction.java:86\n',
        }),
      ),
      'Failed to fetch sessions',
    );
    expect(error.message).toBe(
      'Failed to fetch sessions: AccessControlException: permission denied: session list (403)',
    );
    expect(error.message).not.toContain('evil.example');
  });

  it('reads XML and JSON details from the BFF wrapper', async () => {
    const xml = await errorFromPortalResponse(
      response(
        JSON.stringify({
          message: 'please ignore this backend string',
          details: '<fault><detail>permission denied: /home/devuser</detail></fault>',
        }),
      ),
      'Failed to fetch storage summary',
    );
    expect(xml.message).toBe(
      'Failed to fetch storage summary: permission denied: /home/devuser (403)',
    );

    const json = await errorFromPortalResponse(
      response(
        JSON.stringify({
          message: 'please ignore',
          details: { error: 'Forbidden', message: 'Access is denied' },
        }),
      ),
      'Failed to fetch container images',
    );
    expect(json.message).toBe('Failed to fetch container images: Forbidden: Access is denied (403)');
  });

  it('does not echo BFF JSON when details are missing or not a useful line', async () => {
    const noDetails = await errorFromPortalResponse(response('{"status":403}'), 'Failed to fetch sessions');
    expect(noDetails.message).toBe('Failed to fetch sessions: 403');

    const badTypes = await errorFromPortalResponse(
      response('{"message":403,"error":true,"details":{"message":1}}'),
      'Failed to fetch sessions',
    );
    expect(badTypes.message).toBe('Failed to fetch sessions: 403');
  });

  it('does not crash on JSON null, arrays, or primitives', async () => {
    await expect(errorFromPortalResponse(response('null'), 'Failed to fetch sessions')).resolves.toMatchObject({
      message: 'Failed to fetch sessions: 403',
    });
    await expect(errorFromPortalResponse(response('[]'), 'Failed to fetch sessions')).resolves.toMatchObject({
      message: 'Failed to fetch sessions: 403',
    });
    await expect(errorFromPortalResponse(response('401'), 'Failed to fetch sessions')).resolves.toMatchObject({
      message: 'Failed to fetch sessions: 403',
    });
  });

  it('does not echo invalid JSON or empty bodies', async () => {
    const broken = await errorFromPortalResponse(
      response('{not json', 401, 'text/plain'),
      'Failed to fetch sessions',
    );
    expect(broken.message).toBe('Failed to fetch sessions: 401');

    const empty = await errorFromPortalResponse(response('', 502, 'text/plain'), 'Failed to fetch sessions');
    expect(empty.message).toBe('Failed to fetch sessions: 502');
  });

  it('parses a raw Java body when the BFF forwarded text, not JSON', async () => {
    const error = await errorFromPortalResponse(
      response('NotAuthenticated: No credentials found', 401, 'text/plain'),
      'Failed to fetch sessions',
    );
    expect(error.message).toBe('Failed to fetch sessions: NotAuthenticated: No credentials found (401)');
  });

  it('ignores empty details and hostile details', async () => {
    const empty = await errorFromPortalResponse(
      response(JSON.stringify({ message: 'Failed to fetch sessions', details: '   ' })),
      'Failed to fetch sessions',
    );
    expect(empty.message).toBe('Failed to fetch sessions: 403');

    const xss = await errorFromPortalResponse(
      response(
        JSON.stringify({
          message: '<img src=x onerror=alert(1)>',
          details: '<script>alert(1)</script>',
        }),
      ),
      'Failed to fetch sessions',
    );
    expect(xss.message).toBe('Failed to fetch sessions: 403');
    expect(xss.message).not.toContain('script');
    expect(xss.message).not.toContain('onerror');
  });

  it('caps a huge body instead of parsing the whole payload', async () => {
    const huge = `${'x'.repeat(MAX_UNTRUSTED_ERROR_CHARS + 2000)}`;
    const error = await errorFromPortalResponse(response(huge, 500, 'text/plain'), 'Failed to fetch sessions');
    expect(error.message).toBe('Failed to fetch sessions: 500');
    expect(error.message.length).toBeLessThan(80);
  });

  it('still sees an exception that is at the start of a large stack', async () => {
    const body = `ca.nrc.cadc.net.TransientException: service busy\n${'at Foo.java:1\n'.repeat(2000)}`;
    const error = await errorFromPortalResponse(response(body, 503, 'text/plain'), 'Failed to fetch sessions');
    expect(error.message).toBe('Failed to fetch sessions: TransientException: service busy (503)');
  });
});

describe('clipUntrustedDetails', () => {
  it('drops null, primitives, and circular objects', () => {
    expect(clipUntrustedDetails(null)).toBeUndefined();
    expect(clipUntrustedDetails(403)).toBeUndefined();
    expect(clipUntrustedDetails(true)).toBeUndefined();
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(clipUntrustedDetails(circular)).toBeUndefined();
  });

  it('caps long strings', () => {
    const clipped = clipUntrustedDetails('z'.repeat(MAX_UNTRUSTED_ERROR_CHARS + 50));
    expect(clipped).toHaveLength(MAX_UNTRUSTED_ERROR_CHARS);
  });

  it('keeps small objects and caps stringified large ones', () => {
    expect(clipUntrustedDetails({ error: 'Forbidden' })).toEqual({ error: 'Forbidden' });
    const big = { message: 'm'.repeat(MAX_UNTRUSTED_ERROR_CHARS + 10) };
    const clipped = clipUntrustedDetails(big);
    expect(typeof clipped).toBe('string');
    expect((clipped as string).length).toBe(MAX_UNTRUSTED_ERROR_CHARS);
  });
});

describe('throwIfNotOk', () => {
  it('resolves for successful responses', async () => {
    await expect(throwIfNotOk(new Response('[]', { status: 200 }), 'Failed')).resolves.toBeUndefined();
    await expect(throwIfNotOk(new Response(null, { status: 204 }), 'Failed')).resolves.toBeUndefined();
  });

  it('throws a parsed Error for error responses', async () => {
    const response = new Response('PermissionDenied: not a member of group skaha-users', {
      status: 403,
    });
    await expect(throwIfNotOk(response, 'Failed to fetch sessions')).rejects.toThrow(
      'Failed to fetch sessions: PermissionDenied: not a member of group skaha-users (403)',
    );
  });
});
