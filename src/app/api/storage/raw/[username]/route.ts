/**
 * Storage Raw API Route
 *
 * GET /api/storage/raw/[username] - Get storage data for VOSpace
 * This endpoint fetches VOSpace XML and returns parsed JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withErrorHandling,
  errorResponse,
  fetchExternalApi,
  forwardAuthHeader,
} from '@/app/api/lib/api-utils';
import { serverApiConfig } from '@/app/api/lib/server-config';
import { HTTP_STATUS, API_TIMEOUTS } from '@/app/api/lib/http-constants';
import { parseVOSpaceXML } from '@/lib/storage/parseVOSpaceXML';

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ username: string }> }) => {
    const { username } = await params;

    if (!username) {
      return errorResponse('Username is required', HTTP_STATUS.BAD_REQUEST);
    }

    const authHeaders = await forwardAuthHeader(request);
    // Use mode-aware storage API (SRC Cavern for OIDC, CANFAR for CANFAR mode)
    const storageBaseUrl = serverApiConfig.storage.baseUrl;
    // Base URL already includes path, just append username
    const storageUrl = `${storageBaseUrl}${username}`;

    console.log('[Storage API] Fetching storage data:', {
      username,
      url: storageUrl,
      baseUrl: storageBaseUrl,
      mode: process.env.NEXT_USE_CANFAR !== 'true' ? 'OIDC' : 'CANFAR',
    });

    const response = await fetchExternalApi(
      storageUrl,
      {
        method: 'GET',
        headers: {
          ...authHeaders,
          Accept: 'application/xml',
        },
      },
      API_TIMEOUTS.DEFAULT,
    );

    console.log('[Storage API] Fetch response:', {
      username,
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
    });

    if (!response.ok) {
      console.error('[Storage API] Failed to fetch storage data:', {
        username,
        status: response.status,
        statusText: response.statusText,
      });
      const errorText = await response.text().catch(() => '');
      return errorResponse('Failed to fetch storage data', response.status, errorText);
    }

    const xmlText = await response.text();

    console.log('[Storage API] Raw XML response (first 500 chars):', {
      username,
      xmlPreview: xmlText.substring(0, 500),
      totalLength: xmlText.length,
    });

    // Parse the XML and extract storage data
    const storageData = parseVOSpaceXML(xmlText);

    console.log('[Storage API] Parsed storage data:', {
      username,
      data: storageData,
    });

    // Return JSON response
    return NextResponse.json(storageData, {
      status: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
);
