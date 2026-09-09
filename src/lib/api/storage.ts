/**
 * Storage Service API Client
 *
 * Handles all interactions with the CANFAR storage service (Cavern).
 * Uses Bearer token authentication from token storage.
 */

import { getAuthHeader } from '@/lib/auth/token-storage';
import { throwIfNotOk } from '@/lib/api/http-error';
import { buildApiRoutes } from '@/lib/config/api';
import { getRuntimeBasePath } from '@/lib/config/runtime-public-snapshot';

function storageRoutes() {
  return buildApiRoutes(getRuntimeBasePath()).storage;
}

export interface UserStorageQuota {
  name: string;
  quota: number;
  used: number;
  available: number;
  unit: 'bytes' | 'GB';
}

export interface StorageNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: string;
}

/** Parsed VOSpace home summary (used / quota / mtime). */
export interface UserStorageSummary {
  size: number;
  quota: number;
  date: string;
  usage: number;
}

/**
 * Get user storage quota information
 */
export async function getUserStorageQuota(username: string): Promise<UserStorageQuota> {
  const authHeaders = getAuthHeader();
  const response = await fetch(storageRoutes().quota(username), {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders },
    credentials: 'include',
  });

  await throwIfNotOk(response, 'Failed to fetch storage quota');

  return response.json();
}

/**
 * Get user home storage summary (used, quota, usage %, last modified).
 * Proxied through /api/storage/raw — parses VOSpace XML server-side.
 */
export async function getUserStorageSummary(username: string): Promise<UserStorageSummary> {
  const authHeaders = getAuthHeader();
  const response = await fetch(storageRoutes().raw(username), {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders },
    credentials: 'include',
  });

  await throwIfNotOk(response, 'Failed to fetch storage summary');

  return response.json();
}

/**
 * List files and directories in a path
 */
export async function listStorageNodes(
  username: string,
  path: string = '',
): Promise<StorageNode[]> {
  const authHeaders = getAuthHeader();
  const url = `${storageRoutes().files(username)}${path ? `?path=${encodeURIComponent(path)}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders },
    credentials: 'include',
  });

  await throwIfNotOk(response, 'Failed to list storage nodes');

  return response.json();
}

/**
 * Upload a file to storage
 */
export async function uploadFile(username: string, path: string, file: File): Promise<void> {
  const authHeaders = getAuthHeader();
  const url = `${storageRoutes().files(username)}${path ? `?path=${encodeURIComponent(path)}` : ''}`;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders, // Don't include Content-Type for FormData, browser will set it
    body: formData,
    credentials: 'include',
  });

  await throwIfNotOk(response, 'Failed to upload file');
}

/**
 * Delete a file or directory
 */
export async function deleteStorageNode(username: string, path: string): Promise<void> {
  const authHeaders = getAuthHeader();
  const url = `${storageRoutes().files(username)}?path=${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders },
    credentials: 'include',
  });

  await throwIfNotOk(response, 'Failed to delete storage node');
}

/**
 * Create a directory
 */
export async function createDirectory(username: string, path: string): Promise<void> {
  const authHeaders = getAuthHeader();
  const url = `${storageRoutes().files(username)}?path=${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    },
    credentials: 'include',
    body: JSON.stringify({ type: 'directory' }),
  });

  await throwIfNotOk(response, 'Failed to create directory');
}
