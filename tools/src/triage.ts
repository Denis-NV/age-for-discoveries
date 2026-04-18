/**
 * triage.ts — Scan /inbox and print a triage report
 *
 * Usage:
 *   npx ts-node src/triage.ts
 *   npm run triage
 *
 * Reads all media files from /inbox, extracts metadata, and prints a
 * structured report to the terminal. Does NOT move or modify any files.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { listInbox, extractMeta, MediaMeta } from './lib/media';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(d?: Date): string {
  if (!d) return 'unknown';
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function formatGps(lat?: number, lon?: number): string {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return 'no GPS data';
  const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

function printMeta(meta: MediaMeta, index: number): void {
  console.log(`\n  [${index + 1}] ${meta.fileName}`);
  console.log(`      Type    : ${meta.type} (${meta.sizeKB} KB)`);
  console.log(`      Taken   : ${formatDate(meta.dateTaken)}`);
  console.log(`      Camera  : ${meta.camera ?? 'unknown'}`);
  console.log(`      GPS     : ${formatGps(meta.latitude, meta.longitude)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════');
  console.log('  Age for Discoveries — Inbox Triage');
  console.log('══════════════════════════════════════════');

  const files = await listInbox();

  if (files.length === 0) {
    console.log('\n  /inbox is empty — nothing to triage.\n');
    return;
  }

  console.log(`\n  Found ${files.length} file${files.length === 1 ? '' : 's'} in /inbox:\n`);

  const metas: MediaMeta[] = [];

  for (const filePath of files) {
    const meta = await extractMeta(filePath);
    metas.push(meta);
    printMeta(meta, metas.length - 1);
  }

  // Group by apparent date (day)
  const byDate = new Map<string, MediaMeta[]>();
  for (const meta of metas) {
    const day = meta.dateTaken
      ? meta.dateTaken.toISOString().slice(0, 10)
      : 'unknown-date';
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day)!.push(meta);
  }

  console.log('\n──────────────────────────────────────────');
  console.log('  Grouped by date taken\n');

  for (const [day, group] of byDate.entries()) {
    console.log(`  ${day} — ${group.length} file${group.length === 1 ? '' : 's'}`);
    for (const meta of group) {
      console.log(`    • ${meta.fileName} (${meta.type}, ${meta.sizeKB} KB)`);
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log('  Next step');
  console.log('\n  Review the groups above and provide context for each:');
  console.log('    – Where was this? (location, country, region)');
  console.log('    – What\'s the story?');
  console.log('    – Any historical, cultural, or personal detail to include?');
  console.log('    – Anything to leave out?');
  console.log('\n  Then ask Claude (in Cowork) to write the captions.\n');
}

main().catch(err => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
