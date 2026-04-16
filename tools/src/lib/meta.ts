/**
 * meta.ts — Meta Graph API wrapper
 *
 * Low-level functions for creating and publishing Instagram media containers.
 * No business logic here — just the API calls.
 *
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */

import axios from 'axios';

const BASE_URL = 'https://graph.facebook.com/v20.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SingleImageParams {
  imageUrl:  string;
  caption:   string;
}

export interface CarouselItemParams {
  imageUrl: string;
}

export interface CarouselParams {
  itemContainerIds: string[];
  caption:          string;
}

export type ContainerStatus = 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function endpoint(igUserId: string, path = ''): string {
  return `${BASE_URL}/${igUserId}${path}`;
}

// ---------------------------------------------------------------------------
// Container creation
// ---------------------------------------------------------------------------

/** Create a single-image media container. Returns a container ID. */
export async function createImageContainer(
  igUserId: string,
  token: string,
  params: SingleImageParams,
): Promise<string> {
  const res = await axios.post(endpoint(igUserId, '/media'), {
    image_url:    params.imageUrl,
    caption:      params.caption,
    access_token: token,
  });
  return res.data.id as string;
}

/** Create a carousel item container (no caption). Returns a container ID. */
export async function createCarouselItemContainer(
  igUserId: string,
  token: string,
  params: CarouselItemParams,
): Promise<string> {
  const res = await axios.post(endpoint(igUserId, '/media'), {
    image_url:    params.imageUrl,
    is_carousel_item: true,
    access_token: token,
  });
  return res.data.id as string;
}

/** Create the top-level carousel container. Returns a container ID. */
export async function createCarouselContainer(
  igUserId: string,
  token: string,
  params: CarouselParams,
): Promise<string> {
  const res = await axios.post(endpoint(igUserId, '/media'), {
    media_type:   'CAROUSEL',
    children:     params.itemContainerIds.join(','),
    caption:      params.caption,
    access_token: token,
  });
  return res.data.id as string;
}

// ---------------------------------------------------------------------------
// Container status check
// ---------------------------------------------------------------------------

/** Poll the status of a media container. */
export async function getContainerStatus(
  containerId: string,
  token: string,
): Promise<ContainerStatus> {
  const res = await axios.get(`${BASE_URL}/${containerId}`, {
    params: {
      fields:       'status_code',
      access_token: token,
    },
  });
  return res.data.status_code as ContainerStatus;
}

/** Wait until a container is FINISHED (or throw if it errors / times out). */
export async function waitForContainer(
  containerId: string,
  token: string,
  maxWaitMs = 60_000,
  pollIntervalMs = 3_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const status = await getContainerStatus(containerId, token);
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Container ${containerId} ended with status: ${status}`);
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`Timed out waiting for container ${containerId}`);
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** Publish a finished container to the Instagram feed immediately. Returns the media ID. */
export async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<string> {
  const res = await axios.post(endpoint(igUserId, '/media_publish'), {
    creation_id:  containerId,
    access_token: token,
  });
  return res.data.id as string;
}

/**
 * Schedule a finished container to be published at a specific time.
 * scheduledTs is a Unix timestamp (seconds). Must be 10 min – 75 days from now.
 * Returns the media ID.
 */
export async function scheduleContainer(
  igUserId: string,
  token: string,
  containerId: string,
  scheduledTs: number,
): Promise<string> {
  const res = await axios.post(endpoint(igUserId, '/media_publish'), {
    creation_id:            containerId,
    published:              false,
    scheduled_publish_time: scheduledTs,
    access_token:           token,
  });
  return res.data.id as string;
}
