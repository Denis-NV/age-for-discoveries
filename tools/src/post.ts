/**
 * post.ts — Upload and publish a post to Instagram
 *
 * Usage (run by Claude in Cowork, or manually):
 *
 *   Single image, post now:
 *     pnpm run publish -- inbox/IMG_4521.jpg
 *
 *   Carousel, post now:
 *     pnpm run publish -- inbox/IMG_4521.jpg inbox/IMG_4522.jpg inbox/IMG_4523.jpg
 *
 *   Single image, scheduled:
 *     pnpm run publish -- inbox/IMG_4521.jpg --schedule "2026-04-18 12:00"
 *
 *   Carousel, scheduled:
 *     pnpm run publish -- inbox/IMG_4521.jpg inbox/IMG_4522.jpg --schedule "2026-04-18 19:30"
 *
 * Flow:
 *   1. Validate files and caption exist
 *   2. Upload image(s) to Cloudinary → get public URL(s)
 *   3. Create Instagram media container(s)
 *   4. Publish immediately or schedule
 *   5. Move media file(s) from /inbox to /processed
 *   6. Clean up Cloudinary uploads (optional, commented out by default)
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import fs from 'fs-extra';
import {
  PATHS,
  parseCaptionFile,
  moveToProcessed,
  isImage,
} from './lib/media';
import {
  createImageContainer,
  createCarouselItemContainer,
  createCarouselContainer,
  waitForContainer,
  publishContainer,
  scheduleContainer,
} from './lib/meta';
import { uploadImage, deleteImage, UploadResult } from './lib/cloudinary';

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const TOKEN   = process.env.INSTAGRAM_ACCESS_TOKEN ?? '';
const IG_USER = process.env.INSTAGRAM_USER_ID      ?? '';

if (!TOKEN || !IG_USER) {
  console.error('\n  Error: INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID must be set in .env\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captionPathForMedia(mediaPath: string): string {
  const base = path.basename(mediaPath, path.extname(mediaPath));
  return path.join(PATHS.captions, `${base}_instagram.txt`);
}

function buildCaption(english: string, russian: string, hashtags: string): string {
  return `${english}\n\n• • •\n\n${russian}\n\n${hashtags}`;
}

function parseSchedule(value: string): number {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid --schedule value: "${value}". Use format "YYYY-MM-DD HH:MM"`);
  }
  const unixTs = Math.floor(d.getTime() / 1000);
  // Meta requires scheduled time to be 10 min – 75 days from now
  const now = Math.floor(Date.now() / 1000);
  if (unixTs < now + 600) {
    throw new Error('Scheduled time must be at least 10 minutes in the future.');
  }
  return unixTs;
}

// ---------------------------------------------------------------------------
// Single image post
// ---------------------------------------------------------------------------

async function postSingleImage(
  mediaPath: string,
  scheduledTs?: number,
): Promise<void> {
  const captionPath = captionPathForMedia(mediaPath);

  if (!await fs.pathExists(captionPath)) {
    throw new Error(`Caption file not found: ${captionPath}`);
  }

  const caption = await parseCaptionFile(captionPath);
  const fullCaption = buildCaption(caption.english, caption.russian, caption.hashtags);

  console.log(`\n  [1/4] Uploading ${path.basename(mediaPath)} to Cloudinary…`);
  let upload: UploadResult | null = null;
  try {
    upload = await uploadImage(mediaPath);
    console.log(`        ✓ ${upload.publicUrl}`);
    console.log(`        ${upload.width}×${upload.height}px · ${(upload.bytes / 1024).toFixed(0)} KB · ${upload.format}`);

    console.log(`\n  [2/4] Creating Instagram media container…`);
    const containerId = await createImageContainer(IG_USER, TOKEN, {
      imageUrl: upload.publicUrl,
      caption:  fullCaption,
    });

    console.log(`\n  [3/4] Waiting for container ${containerId}…`);
    await waitForContainer(containerId, TOKEN);

    console.log(`\n  [4/4] ${scheduledTs ? 'Scheduling' : 'Publishing'}…`);
    let mediaId: string;
    if (scheduledTs) {
      mediaId = await scheduleContainer(IG_USER, TOKEN, containerId, scheduledTs);
      const schedDate = new Date(scheduledTs * 1000).toLocaleString();
      console.log(`\n  ✓ Scheduled for ${schedDate}`);
    } else {
      mediaId = await publishContainer(IG_USER, TOKEN, containerId);
      console.log(`\n  ✓ Published! Media ID: ${mediaId}`);
    }

    console.log(`    Pillar       : ${caption.pillar}`);
    console.log(`    Story idea   : ${caption.storyIdea}`);

  } catch (err) {
    // Clean up Cloudinary upload on failure so we don't leave orphans
    if (upload) {
      console.log(`\n  Cleaning up Cloudinary upload…`);
      await deleteImage(upload.publicId).catch(() => {});
    }
    throw err;
  }

  await moveToProcessed(mediaPath);
  console.log(`\n  ✓ Moved ${path.basename(mediaPath)} → /processed\n`);
}

// ---------------------------------------------------------------------------
// Carousel post
// ---------------------------------------------------------------------------

async function postCarousel(
  mediaPaths: string[],
  scheduledTs?: number,
): Promise<void> {
  if (mediaPaths.length < 2 || mediaPaths.length > 10) {
    throw new Error('Carousels require 2–10 images.');
  }

  const captionPath = captionPathForMedia(mediaPaths[0]);
  if (!await fs.pathExists(captionPath)) {
    throw new Error(`Caption file not found: ${captionPath}`);
  }

  const caption = await parseCaptionFile(captionPath);
  const fullCaption = buildCaption(caption.english, caption.russian, caption.hashtags);

  console.log(`\n  [1/4] Uploading ${mediaPaths.length} images to Cloudinary…`);
  const uploads: UploadResult[] = [];
  try {
    for (let i = 0; i < mediaPaths.length; i++) {
      const u = await uploadImage(mediaPaths[i]);
      uploads.push(u);
      console.log(`        [${i + 1}/${mediaPaths.length}] ✓ ${path.basename(mediaPaths[i])}`);
    }

    console.log(`\n  [2/4] Creating ${mediaPaths.length} carousel item containers…`);
    const itemIds: string[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const itemId = await createCarouselItemContainer(IG_USER, TOKEN, {
        imageUrl: uploads[i].publicUrl,
      });
      itemIds.push(itemId);
      console.log(`        [${i + 1}/${mediaPaths.length}] Container: ${itemId}`);
    }

    console.log(`\n        Creating carousel container…`);
    const carouselId = await createCarouselContainer(IG_USER, TOKEN, {
      itemContainerIds: itemIds,
      caption: fullCaption,
    });

    console.log(`\n  [3/4] Waiting for carousel ${carouselId}…`);
    await waitForContainer(carouselId, TOKEN);

    console.log(`\n  [4/4] ${scheduledTs ? 'Scheduling' : 'Publishing'}…`);
    let mediaId: string;
    if (scheduledTs) {
      mediaId = await scheduleContainer(IG_USER, TOKEN, carouselId, scheduledTs);
      const schedDate = new Date(scheduledTs * 1000).toLocaleString();
      console.log(`\n  ✓ Carousel scheduled for ${schedDate}`);
    } else {
      mediaId = await publishContainer(IG_USER, TOKEN, carouselId);
      console.log(`\n  ✓ Carousel published! Media ID: ${mediaId}`);
    }

    console.log(`    Pillar       : ${caption.pillar}`);
    console.log(`    Story idea   : ${caption.storyIdea}`);

  } catch (err) {
    if (uploads.length > 0) {
      console.log(`\n  Cleaning up ${uploads.length} Cloudinary upload(s)…`);
      await Promise.all(uploads.map(u => deleteImage(u.publicId).catch(() => {})));
    }
    throw err;
  }

  for (const mp of mediaPaths) {
    await moveToProcessed(mp);
  }
  console.log(`\n  ✓ Moved ${mediaPaths.length} files → /processed\n`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\n  Usage:');
    console.log('    pnpm run publish -- <file> [<file2> ...] [--schedule "YYYY-MM-DD HH:MM"]\n');
    process.exit(1);
  }

  // Split args into file paths and flags
  const filePaths: string[] = [];
  let scheduledTs: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schedule') {
      if (!args[i + 1]) {
        console.error('  Error: --schedule requires a value, e.g. --schedule "2026-04-18 12:00"\n');
        process.exit(1);
      }
      scheduledTs = parseSchedule(args[++i]);
    } else {
      filePaths.push(args[i]);
    }
  }

  if (filePaths.length === 0) {
    console.error('  Error: at least one image file path is required.\n');
    process.exit(1);
  }

  for (const p of filePaths) {
    if (!isImage(p)) {
      console.error(`  Error: ${p} is not a supported image type\n`);
      process.exit(1);
    }
    if (!await fs.pathExists(p)) {
      console.error(`  Error: file not found: ${p}\n`);
      process.exit(1);
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Age for Discoveries — Publish to Instagram');
  console.log('══════════════════════════════════════════');
  if (scheduledTs) {
    const schedDate = new Date(scheduledTs * 1000).toLocaleString();
    console.log(`  Mode: scheduled for ${schedDate}`);
  } else {
    console.log('  Mode: publish immediately');
  }

  if (filePaths.length === 1) {
    await postSingleImage(filePaths[0], scheduledTs);
  } else {
    await postCarousel(filePaths, scheduledTs);
  }
}

main().catch(err => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
