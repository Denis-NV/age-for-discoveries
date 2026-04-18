/**
 * sync.ts — Download new photos/videos from Cloudinary afd-inbox folder to /inbox
 *
 * Usage:
 *   pnpm run sync
 *
 * Workflow:
 *   1. Lists all resources in the Cloudinary `afd-inbox` folder
 *   2. Compares against .sync-state.json to find files not yet downloaded
 *   3. Downloads new files to /inbox, preserving the original filename
 *   4. Updates .sync-state.json so they're skipped on the next run
 *
 * Run this at the start of a Cowork session after uploading photos from your phone.
 * Then run `pnpm run triage` to review what's arrived.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import fs from 'fs-extra';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLOUDINARY_FOLDER = 'afd-inbox';
const INBOX_DIR = path.resolve(__dirname, '../../inbox');
const STATE_FILE = path.resolve(__dirname, '../.sync-state.json');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ---------------------------------------------------------------------------
// State helpers — track which Cloudinary public IDs have been downloaded
// ---------------------------------------------------------------------------

interface SyncState {
  downloaded: string[];   // list of Cloudinary public_ids already pulled
  lastSync:   string;     // ISO timestamp of last successful sync
}

async function loadState(): Promise<SyncState> {
  if (await fs.pathExists(STATE_FILE)) {
    return fs.readJson(STATE_FILE);
  }
  return { downloaded: [], lastSync: new Date(0).toISOString() };
}

async function saveState(state: SyncState): Promise<void> {
  await fs.writeJson(STATE_FILE, state, { spaces: 2 });
}

// ---------------------------------------------------------------------------
// Cloudinary helpers
// ---------------------------------------------------------------------------

interface CloudinaryResource {
  public_id:    string;
  secure_url:   string;
  original_filename: string;
  format:       string;
  resource_type: string;
  bytes:        number;
  created_at:   string;
}

/**
 * List all raw resources in the afd-inbox folder.
 *
 * Files are uploaded as resource_type "raw" so Cloudinary stores them
 * without any re-encoding — preserving EXIF, GPS, and date metadata intact.
 */
async function listFolderResources(): Promise<CloudinaryResource[]> {
  const resources: CloudinaryResource[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await cloudinary.api.resources({
      type:          'upload',
      resource_type: 'raw',
      prefix:        CLOUDINARY_FOLDER + '/',
      max_results:   500,
      next_cursor:   nextCursor,
    });

    resources.push(...(response.resources as CloudinaryResource[]));
    nextCursor = response.next_cursor;
  } while (nextCursor);

  // Sort oldest first so /inbox files arrive in chronological order
  return resources.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

function buildDownloadUrl(resource: CloudinaryResource): string {
  // Raw resources are stored without re-encoding — full EXIF/GPS is preserved.
  // The CDN URL for raw files serves the original file directly, no auth needed.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  return `https://res.cloudinary.com/${cloudName}/raw/upload/${resource.public_id}`;
}

function resolveLocalFilename(resource: CloudinaryResource): string {
  // Cloudinary public_id = "afd-inbox/IMG_1234" → use the part after the slash
  const baseName = resource.public_id.split('/').pop() ?? resource.public_id;
  const ext = resource.format ? `.${resource.format}` : '';

  // If original_filename is available and differs from the public_id segment, prefer it
  const nameFromOriginal = resource.original_filename
    ? resource.original_filename.replace(/\.[^.]+$/, '')   // strip any ext
    : null;

  const stem = nameFromOriginal ?? baseName;
  return `${stem}${ext}`;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.outputFile(destPath, Buffer.from(response.data));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('  Age for Discoveries — Cloudinary Sync');
  console.log('══════════════════════════════════════════\n');

  await fs.ensureDir(INBOX_DIR);

  const state = await loadState();
  const alreadyDownloaded = new Set(state.downloaded);

  console.log('  Fetching file list from Cloudinary…');
  const resources = await listFolderResources();

  const newResources = resources.filter(r => !alreadyDownloaded.has(r.public_id));

  if (newResources.length === 0) {
    console.log('  No new files found — /inbox is up to date.\n');
    return;
  }

  console.log(`  Found ${newResources.length} new file${newResources.length === 1 ? '' : 's'}:\n`);

  const downloaded: string[] = [];
  const failed: string[] = [];

  for (const resource of newResources) {
    const fileName = resolveLocalFilename(resource);
    const destPath = path.join(INBOX_DIR, fileName);
    const sizeKB   = Math.round(resource.bytes / 1024);
    const url      = buildDownloadUrl(resource);

    process.stdout.write(`  ↓ ${fileName} (${sizeKB} KB) … `);

    try {
      // Don't overwrite a file that's already in /inbox under the same name
      if (await fs.pathExists(destPath)) {
        console.log('already exists, skipping');
      } else {
        await downloadFile(url, destPath);
        console.log('done');
      }

      downloaded.push(resource.public_id);
      state.downloaded.push(resource.public_id);
    } catch (err: any) {
      console.log(`FAILED (${err.message})`);
      failed.push(fileName);
    }
  }

  state.lastSync = new Date().toISOString();
  await saveState(state);

  console.log('\n──────────────────────────────────────────');
  console.log(`  Downloaded : ${downloaded.length} file${downloaded.length === 1 ? '' : 's'}`);
  if (failed.length > 0) {
    console.log(`  Failed     : ${failed.join(', ')}`);
  }
  console.log('\n  Run `pnpm run triage` to review the new files.\n');
}

main().catch(err => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
