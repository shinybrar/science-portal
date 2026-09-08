/**
 * Parse a VOSpace `GET /nodes/<path>` XML response into the storage shape
 * the UI consumes (used / quota / mtime / usage %).
 *
 * Only the *root* node's properties are read. VOSpace responses may include
 * children under `<vos:nodes>` and each child has its own
 * `<vos:property uri=".../core#length">`; iterating across the whole XML
 * would let a leaf's size overwrite the home-directory aggregate, which is
 * exactly the bug seen on staging-src (root-aggregate 18.8 MB → last-child
 * 9.27 KB).
 */

export interface StorageData {
  size: number;
  quota: number;
  date: string;
  usage: number;
  /** Session mount path, e.g. `/arc/home/user/`. */
  path?: string;
}

/**
 * Map a VOSpace home node URI to the POSIX path mounted in Skaha sessions.
 *
 * Examples:
 * - `vos://cadc.nrc.ca~arc/home/brars` → `/arc/home/brars`
 * - `vos://canfar.net~src~cavern/home/szautkin` → `/cavern/home/szautkin`
 */
export function vosHomeUriToSessionPath(vosUri: string): string | null {
  const match = vosUri.match(/^vos:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const authority = match[1];
  const nodePath = match[2].replace(/\/+$/, '');
  const mountRoot = authority.split('~').pop();
  if (!mountRoot || !nodePath) return null;

  return `/${mountRoot}/${nodePath}`;
}

function extractRootNodeUri(xmlText: string): string | null {
  const match = xmlText.match(/<vos:node[^>]*\suri="([^"]+)"/);
  return match?.[1] ?? null;
}

export function parseVOSpaceXML(xmlText: string): StorageData {
  let size = 0;
  let quota = 0;
  let date = new Date().toISOString();

  // Root properties always precede the children block per the VOSpace XML
  // schema. Slice off everything from the first `<vos:nodes>` onward so the
  // regex can only see the root's <vos:properties>.
  const childrenStart = xmlText.indexOf('<vos:nodes');
  const rootScope = childrenStart >= 0 ? xmlText.slice(0, childrenStart) : xmlText;

  const propertyRegex = /<vos:property[^>]*uri="([^"]*)"[^>]*>([\s\S]*?)<\/vos:property>/g;
  let match;
  while ((match = propertyRegex.exec(rootScope)) !== null) {
    const uri = match[1];
    const value = match[2].trim();

    if (uri.includes('vospace/core#length')) {
      size = parseInt(value, 10) || 0;
    } else if (uri.includes('vospace/core#quota')) {
      quota = parseInt(value, 10) || 0;
    } else if (uri.includes('vospace/core#date')) {
      date = value;
    }
  }

  const usage = quota > 0 ? (size / quota) * 100 : 0;
  const rootUri = extractRootNodeUri(xmlText);
  const path = rootUri ? vosHomeUriToSessionPath(rootUri) ?? undefined : undefined;
  return { size, quota, date, usage, path };
}
