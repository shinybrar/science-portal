import { describe, expect, it } from 'vitest';
import { joinQueryErrors, queryErrorMessage, retryUnlessAuthFailure } from './query-result';

describe('queryErrorMessage', () => {
  it('returns undefined for empty values', () => {
    expect(queryErrorMessage(undefined)).toBeUndefined();
    expect(queryErrorMessage(null)).toBeUndefined();
    expect(queryErrorMessage('')).toBeUndefined();
    expect(queryErrorMessage(0)).toBeUndefined();
  });

  it('reads Error.message', () => {
    expect(queryErrorMessage(new Error('Failed to fetch sessions: 403'))).toBe(
      'Failed to fetch sessions: 403',
    );
  });

  it('ignores non-Error values instead of stringifying them', () => {
    expect(queryErrorMessage('raw timeout')).toBeUndefined();
    expect(queryErrorMessage({ message: 'nope' })).toBeUndefined();
  });
});

describe('joinQueryErrors', () => {
  it('joins unique messages', () => {
    expect(
      joinQueryErrors([new Error('Failed to fetch container images: 403'), new Error('Failed to fetch context: 403')]),
    ).toBe('Failed to fetch container images: 403 · Failed to fetch context: 403');
  });

  it('dedupes identical messages', () => {
    expect(joinQueryErrors([new Error('403'), new Error('403')])).toBe('403');
  });

  it('skips empty entries', () => {
    expect(joinQueryErrors([])).toBeUndefined();
    expect(joinQueryErrors([null, undefined, '', new Error('only')])).toBe('only');
  });
});

describe('retryUnlessAuthFailure', () => {
  it('does not retry 401 or 403', () => {
    expect(retryUnlessAuthFailure(0, new Error('Failed to fetch sessions: 401'))).toBe(false);
    expect(retryUnlessAuthFailure(0, new Error('Failed to fetch storage summary: 403'))).toBe(false);
    expect(
      retryUnlessAuthFailure(
        0,
        new Error('Failed to fetch sessions: PermissionDenied: not a member of group skaha-users (403)'),
      ),
    ).toBe(false);
  });

  it('does not retry Java auth type names even without a status', () => {
    expect(retryUnlessAuthFailure(0, new Error('NotAuthenticated: No credentials found'))).toBe(false);
    expect(retryUnlessAuthFailure(0, new Error('AccessControlException: permission denied'))).toBe(false);
    expect(retryUnlessAuthFailure(0, 'PermissionDenied')).toBe(false);
  });

  it('does not treat nearby numbers as 401/403', () => {
    expect(retryUnlessAuthFailure(0, new Error('upstream 1401'))).toBe(true);
    expect(retryUnlessAuthFailure(0, new Error('error 4030'))).toBe(true);
  });

  it('retries other errors up to 3 times', () => {
    expect(retryUnlessAuthFailure(0, new Error('Failed to fetch sessions: 500'))).toBe(true);
    expect(retryUnlessAuthFailure(2, new Error('Failed to fetch sessions: 500'))).toBe(true);
    expect(retryUnlessAuthFailure(3, new Error('Failed to fetch sessions: 500'))).toBe(false);
    expect(
      retryUnlessAuthFailure(0, new Error('TransientException: service busy, try again later (503)')),
    ).toBe(true);
    expect(
      retryUnlessAuthFailure(0, new Error('Failed to fetch storage: NodeFault: unexpected error (500)')),
    ).toBe(true);
  });
});
