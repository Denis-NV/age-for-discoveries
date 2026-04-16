/**
 * cleanup.ts — Delete all local media files from /inbox and /processed
 *
 * Run this at the end of a publishing session, once you've confirmed all
 * posts and carousels have published or scheduled successfully.
 *
 * Originals are safe in Google Photos. Processed versions are already
 * uploaded to Cloudinary and fetched by Instagram — nothing is lost.
 *
 * Caption files in /captions are intentionally left untouched.
 *
 * Usage:
 *   pnpm run cleanup
 */

import path from 'path';
import fs from 'fs-extra';
import { PATHS, isMedia } from './lib/media';

async function listMediaFiles(dir: string): Promise<string[]> {
  await fs.ensureDir(dir);
  const entries = await fs.readdir(dir);
  return entries
    .filter(f => !f.startsWith('.') && isMedia(f))
    .map(f => path.join(dir, f))
    .sort();
}

async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('  Age for Discoveries — Session Cleanup');
  console.log('══════════════════════════════════════════\n');

  const inboxFiles     = await listMediaFiles(PATHS.inbox);
  const processedFiles = await listMediaFiles(PATHS.processed);
  const allFiles       = [...inboxFiles, ...processedFiles];

  if (allFiles.length === 0) {
    console.log('  Nothing to clean up — /inbox and /processed are already empty.\n');
    return;
  }

  console.log('  Files to delete:\n');
  for (const f of inboxFiles) {
    console.log(`    /inbox      ${path.basename(f)}`);
  }
  for (const f of processedFiles) {
    console.log(`    /processed  ${path.basename(f)}`);
  }

  console.log(`\n  Total: ${allFiles.length} file(s)\n`);

  for (const f of allFiles) {
    await fs.remove(f);
  }

  console.log(`  ✓ Deleted ${allFiles.length} file(s). Captions kept.\n`);
}

main().catch(err => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
