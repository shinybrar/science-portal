import { describe, expect, it } from 'vitest';
import { catalogIds, pickJavaFault, serviceForPath, usernameFromPath } from './java-faults.mjs';

describe('serviceForPath', () => {
  it('classifies Skaha, Cavern, and AC paths', () => {
    expect(serviceForPath('/v1/session')).toBe('skaha');
    expect(serviceForPath('/v1/image')).toBe('skaha');
    expect(serviceForPath('/cavern/nodes/home/devuser')).toBe('cavern');
    expect(serviceForPath('/whoami')).toBe('ac');
    expect(serviceForPath('/login')).toBe('ac');
    expect(serviceForPath('/')).toBe('ac');
  });
});

describe('usernameFromPath', () => {
  it('reads /home/{user} and /users/{user}', () => {
    expect(usernameFromPath('/cavern/nodes/home/alice')).toBe('alice');
    expect(usernameFromPath('/cavern/nodes/home/alice/files')).toBe('alice');
    expect(usernameFromPath('/users/bob/quota')).toBe('bob');
  });

  it('falls back when the path has no user segment', () => {
    expect(usernameFromPath('/v1/session')).toBe('devuser');
    expect(usernameFromPath('/home/')).toBe('devuser');
    expect(usernameFromPath('/users/')).toBe('devuser');
  });
});

describe('pickJavaFault', () => {
  it('returns a catalog entry for the requested status', () => {
    const fault = pickJavaFault({
      service: 'skaha',
      status: 401,
      pathname: '/v1/session',
      method: 'GET',
    });
    expect(fault.status).toBe(401);
    expect(fault.id).toMatch(/^skaha-/);
    expect(fault.body.length).toBeGreaterThan(0);
    expect(fault.contentType).toMatch(/text\/plain|application\/xml|application\/json|text\/html/);
  });

  it('interpolates the username into Cavern bodies', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i += 1) {
      const fault = pickJavaFault({
        service: 'cavern',
        status: 403,
        pathname: '/cavern/nodes/home/alice',
        method: 'GET',
      });
      seen.add(fault.id);
      expect(fault.status).toBe(403);
      if (fault.body.includes('alice') || fault.body.includes('home')) {
        expect(fault.body).toContain('alice');
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('falls back to the full family when no status matches', () => {
    const fault = pickJavaFault({
      service: 'skaha',
      status: 418,
      pathname: '/v1/session',
      method: 'GET',
    });
    expect(fault.id).toMatch(/^skaha-/);
    expect(typeof fault.status).toBe('number');
  });

  it('uses AC when the service name is unknown', () => {
    const fault = pickJavaFault({
      service: 'unknown',
      status: 401,
      pathname: '/whoami',
      method: 'GET',
    });
    expect(fault.id).toMatch(/^ac-/);
    expect(fault.status).toBe(401);
  });

  it('escapes XML special characters in generated Cavern faults', () => {
    const xmlFaults = [];
    for (let i = 0; i < 30; i += 1) {
      const fault = pickJavaFault({
        service: 'cavern',
        status: 403,
        pathname: '/cavern/nodes/home/a&b<c>',
        method: 'GET',
      });
      if (fault.contentType.includes('xml')) xmlFaults.push(fault);
    }
    expect(xmlFaults.length).toBeGreaterThan(0);
    for (const fault of xmlFaults) {
      expect(fault.body).not.toMatch(/<c>/);
      if (fault.body.includes('a&')) {
        expect(fault.body).toContain('a&amp;b&lt;c&gt;');
      }
    }
  });

  it('lists catalog ids per service', () => {
    const ids = catalogIds();
    expect(ids.skaha).toContain('skaha-not-authenticated-stack');
    expect(ids.cavern).toContain('cavern-cadc-xml-denied');
    expect(ids.ac).toContain('ac-cookie-expired');
  });
});
