/**
 * media.ts — Shared file and media utilities
 *
 * Helpers for reading EXIF data, validating file types, moving files
 * between inbox/processed, and parsing caption .txt files.
 */

import path from 'path';
import fs from 'fs-extra';
import exifr from 'exifr';

// ---------------------------------------------------------------------------
// Paths (relative to the project root, one level above /tools)
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export const PATHS = {
  inbox:     path.join(PROJECT_ROOT, 'inbox'),
  processed: path.join(PROJECT_ROOT, 'processed'),
  captions:  path.join(PROJECT_ROOT, 'captions'),
};

// ---------------------------------------------------------------------------
// File type helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.raw', '.dng']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi']);

export function isImage(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isVideo(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isMedia(filePath: string): boolean {
  return isImage(filePath) || isVideo(filePath);
}

// ---------------------------------------------------------------------------
// Inbox scanning
// ---------------------------------------------------------------------------

export async function listInbox(): Promise<string[]> {
  await fs.ensureDir(PATHS.inbox);
  const entries = await fs.readdir(PATHS.inbox);
  return entries
    .filter(f => !f.startsWith('.') && isMedia(f))
    .map(f => path.join(PATHS.inbox, f))
    .sort();
}

// ---------------------------------------------------------------------------
// EXIF extraction
// ---------------------------------------------------------------------------

export interface MediaMeta {
  filePath:   string;
  fileName:   string;
  type:       'image' | 'video';
  sizeKB:     number;
  dateTaken?: Date;
  camera?:    string;
  latitude?:  number;
  longitude?: number;
}

export async function extractMeta(filePath: string): Promise<MediaMeta> {
  const stat = await fs.stat(filePath);
  const meta: MediaMeta = {
    filePath,
    fileName: path.basename(filePath),
    type:     isImage(filePath) ? 'image' : 'video',
    sizeKB:   Math.round(stat.size / 1024),
  };

  if (isImage(filePath)) {
    try {
      const exif = await exifr.parse(filePath, {
        gps:             true,
        tiff:            true,
        exif:            true,
        translateKeys:   true,
        translateValues: true,
        reviveValues:    true,
      });
      if (exif) {
        if (exif.DateTimeOriginal) meta.dateTaken = exif.DateTimeOriginal;
        if (exif.Make || exif.Model) meta.camera = [exif.Make, exif.Model].filter(Boolean).join(' ');
        if (exif.latitude  != null && !isNaN(exif.latitude))  meta.latitude  = exif.latitude;
        if (exif.longitude != null && !isNaN(exif.longitude)) meta.longitude = exif.longitude;
      }
    } catch {
      // EXIF not available — not fatal
    }
  }

  return meta;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

export async function moveToProcessed(filePath: string): Promise<string> {
  await fs.ensureDir(PATHS.processed);
  const dest = path.join(PATHS.processed, path.basename(filePath));
  const src  = path.resolve(filePath);
  if (src === path.resolve(dest)) return dest;   // already in /processed
  await fs.move(filePath, dest, { overwrite: false });
  return dest;
}

// ---------------------------------------------------------------------------
// Caption file parsing
// ---------------------------------------------------------------------------

export interface CaptionFile {
  english:     string;
  russian:     string;
  hashtags:    string;
  postingTime: string;
  storyIdea:   string;
  pillar:      string;
}

export async function parseCaptionFile(captionPath: string): Promise<CaptionFile> {
  const raw = await fs.readFile(captionPath, 'utf-8');

  const extract = (label: string): string => {
    const regex = new RegExp(`${label}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z ()]+:|$)`, 'i');
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    english:     extract('POST CAPTION \\(English\\)'),
    russian:     extract('POST CAPTION \\(Russian\\)'),
    hashtags:    extract('HASHTAGS'),
    postingTime: extract('SUGGESTED POSTING TIME'),
    storyIdea:   extract('STORY IDEA'),
    pillar:      extract('PILLAR'),
  };
}
