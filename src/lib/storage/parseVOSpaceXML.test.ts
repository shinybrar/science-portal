import { describe, it, expect } from 'vitest';
import { parseVOSpaceXML, vosHomeUriToSessionPath } from './parseVOSpaceXML';

/**
 * Real-world fragment shape: a home-directory node with a non-zero
 * aggregate `length` (the value the UI should display), followed by a
 * children section where each child file has its own `length` property.
 *
 * Production responses don't expand children (server-side default), so the
 * bug was invisible there. Staging-src does expand children — exposing the
 * "last `length` wins" behaviour of the original regex-only parser.
 */
const ROOT_LENGTH = 19_712_409; // 18.8 MiB — what the user should see
const CHILD_LENGTH_LAST = 9_492; // 9.27 KiB — the last leaf in the children
const QUOTA = 107_374_182_400; // 100 GiB

function xmlWithChildren(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<vos:node xmlns:vos="http://www.ivoa.net/xml/VOSpace/v2.0" uri="vos://canfar.net~staging-src~cavern/home/szautkin" xsi:type="vos:ContainerNode">
  <vos:properties>
    <vos:property uri="ivo://ivoa.net/vospace/core#length">${ROOT_LENGTH}</vos:property>
    <vos:property uri="ivo://ivoa.net/vospace/core#quota">${QUOTA}</vos:property>
    <vos:property uri="ivo://ivoa.net/vospace/core#date">2026-05-22T12:34:56.000Z</vos:property>
  </vos:properties>
  <vos:nodes>
    <vos:node uri="vos://canfar.net~staging-src~cavern/home/szautkin/big.fits" xsi:type="vos:DataNode">
      <vos:properties>
        <vos:property uri="ivo://ivoa.net/vospace/core#length">15000000</vos:property>
      </vos:properties>
    </vos:node>
    <vos:node uri="vos://canfar.net~staging-src~cavern/home/szautkin/tiny.txt" xsi:type="vos:DataNode">
      <vos:properties>
        <vos:property uri="ivo://ivoa.net/vospace/core#length">${CHILD_LENGTH_LAST}</vos:property>
      </vos:properties>
    </vos:node>
  </vos:nodes>
</vos:node>`;
}

function xmlNoChildren(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<vos:node xmlns:vos="http://www.ivoa.net/xml/VOSpace/v2.0" uri="vos://canfar.net~src~cavern/home/szautkin" xsi:type="vos:ContainerNode">
  <vos:properties>
    <vos:property uri="ivo://ivoa.net/vospace/core#length">${ROOT_LENGTH}</vos:property>
    <vos:property uri="ivo://ivoa.net/vospace/core#quota">${QUOTA}</vos:property>
    <vos:property uri="ivo://ivoa.net/vospace/core#date">2026-05-22T12:34:56.000Z</vos:property>
  </vos:properties>
</vos:node>`;
}

describe('vosHomeUriToSessionPath', () => {
  it('maps CANFAR ARC home URIs to /arc/home/username', () => {
    expect(vosHomeUriToSessionPath('vos://cadc.nrc.ca~arc/home/brars')).toBe('/arc/home/brars');
  });

  it('maps SRC Cavern home URIs to /cavern/home/username', () => {
    expect(vosHomeUriToSessionPath('vos://canfar.net~src~cavern/home/szautkin')).toBe(
      '/cavern/home/szautkin',
    );
    expect(vosHomeUriToSessionPath('vos://canfar.net~staging-src~cavern/home/szautkin')).toBe(
      '/cavern/home/szautkin',
    );
  });

  it('returns null for malformed URIs', () => {
    expect(vosHomeUriToSessionPath('not-a-uri')).toBeNull();
  });
});

describe('parseVOSpaceXML', () => {
  it('reads root size/quota/date when the XML has no children section (prod-like)', () => {
    const result = parseVOSpaceXML(xmlNoChildren());
    expect(result.size).toBe(ROOT_LENGTH);
    expect(result.quota).toBe(QUOTA);
    expect(result.date).toBe('2026-05-22T12:34:56.000Z');
    expect(result.usage).toBeCloseTo((ROOT_LENGTH / QUOTA) * 100, 6);
    expect(result.path).toBe('/cavern/home/szautkin');
  });

  it('reads the root aggregate, not a child leaf, when children are expanded (staging-like)', () => {
    // This is the regression test for the staging-src bug. Before the fix,
    // an unscoped global regex would iterate every `<vos:property>` in the
    // document and overwrite `size` with each child's length, leaving the
    // last child's `length` (9492 = 9.27 KiB) as the reported home size.
    const result = parseVOSpaceXML(xmlWithChildren());
    expect(result.size).toBe(ROOT_LENGTH);
    expect(result.size).not.toBe(CHILD_LENGTH_LAST);
    expect(result.quota).toBe(QUOTA);
    expect(result.usage).toBeCloseTo((ROOT_LENGTH / QUOTA) * 100, 6);
    expect(result.path).toBe('/cavern/home/szautkin');
  });

  it('returns zeros when the XML has no length/quota properties', () => {
    const empty = '<?xml version="1.0"?><vos:node xmlns:vos="..."></vos:node>';
    const result = parseVOSpaceXML(empty);
    expect(result.size).toBe(0);
    expect(result.quota).toBe(0);
    expect(result.usage).toBe(0);
  });
});

/**
 * Reproduce the original buggy implementation inline so the test suite is
 * self-documenting about *what* changed and *why* it was wrong. This is
 * the parser that shipped in `src/app/api/storage/raw/[username]/route.ts`
 * before the fix — it walks every property in the document.
 */
function parseVOSpaceXMLLegacyBuggy(xmlText: string): { size: number } {
  let size = 0;
  const propertyRegex = /<vos:property[^>]*uri="([^"]*)"[^>]*>([\s\S]*?)<\/vos:property>/g;
  let match;
  while ((match = propertyRegex.exec(xmlText)) !== null) {
    const uri = match[1];
    const value = match[2].trim();
    if (uri.includes('vospace/core#length')) {
      size = parseInt(value, 10) || 0;
    }
  }
  return { size };
}

describe('parseVOSpaceXML — legacy regression', () => {
  it('demonstrates the original parser misreports staging-like XML', () => {
    // Proves the bug existed: on the same XML, the legacy parser returns
    // the last child leaf's size (9.27 KiB) instead of the root's 18.8 MiB.
    const buggy = parseVOSpaceXMLLegacyBuggy(xmlWithChildren());
    expect(buggy.size).toBe(CHILD_LENGTH_LAST);
    expect(buggy.size).not.toBe(ROOT_LENGTH);
  });

  it('the legacy parser was correct for prod-like XML (no children)', () => {
    // Explains why the bug only manifested on staging: prod responses
    // didn't expand children, so the regex only ever saw the root length.
    const buggy = parseVOSpaceXMLLegacyBuggy(xmlNoChildren());
    expect(buggy.size).toBe(ROOT_LENGTH);
  });
});
