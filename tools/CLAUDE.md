# Age for Discoveries — Tools

This folder contains the TypeScript/Node.js automation scripts for the
@age_for_discoveries Instagram workflow. Denis is the author; he is a web
developer and TypeScript is his primary language. Denis uses **pnpm** as his
package manager — always use `pnpm` and `pnpm run`, not `npm`.

## Project context

This tooling supports the content workflow described in the root `CLAUDE.md`.
Read that file for the full picture: account identity, the three content pillars,
folder structure, and Instagram API credentials. All environment variables and
API credentials are documented there. Do not duplicate them here.

## Folder structure

```
tools/
├── src/
│   ├── sync.ts         # Downloads new files from Cloudinary afd-inbox folder to /inbox
│   ├── triage.ts       # Reads /inbox, extracts metadata, prints a triage report
│   ├── process.ts      # Crops, adjusts, and exports images/video ready for posting  [TODO]
│   ├── post.ts         # Uploads to Cloudinary, then publishes/schedules on Instagram
│   └── lib/
│       ├── meta.ts     # Thin wrapper around Meta Graph API calls
│       ├── media.ts    # Shared helpers: EXIF extraction, file moves, path utils
│       └── cloudinary.ts  # Cloudinary image upload/delete helpers
├── .sync-state.json    # Tracks which Cloudinary files have been downloaded (auto-generated)
├── CLAUDE.md           # This file
├── package.json
├── tsconfig.json
└── .gitignore
```

## Running scripts

```bash
# Install dependencies (first time or after pulling changes)
pnpm install

# Sync: download new photos/videos from Cloudinary afd-inbox to /inbox
# Only needed when photos were uploaded via the mobile uploader (backup method).
# Primary method is Google Photos batch download → unzip → drop into /inbox directly.
pnpm run sync

# Triage: scan /inbox and print a metadata report (read-only, safe to run anytime)
pnpm run triage

# Process: crop, adjust, and prepare images/video for posting  [TODO: process.ts not yet built]
pnpm run process -- inbox/IMG_4521.jpg --format feed      # 4:5 feed crop
pnpm run process -- inbox/IMG_4521.jpg --format story     # 9:16 story crop
pnpm run process -- inbox/IMG_4521.mp4 --format reel      # 9:16 video, normalise audio

# Publish: upload processed image(s) to Cloudinary, then post to Instagram immediately
pnpm run publish -- processed/IMG_4521.jpg

# Publish a carousel (2–10 images, lead image first)
pnpm run publish -- processed/IMG_4521.jpg processed/IMG_4522.jpg processed/IMG_4523.jpg

# Publish with a scheduled time (10 min – 75 days in the future)
pnpm run publish -- processed/IMG_4521.jpg --schedule "2026-04-18 12:00"
```

## Claude (Cowork) can run these scripts

Denis has authorised Claude to run `pnpm run sync`, `pnpm run triage`, and
`pnpm run publish` on his behalf during a Cowork session. When Denis says
"post this" or "publish this with a schedule of X", Claude should run the
appropriate command rather than asking Denis to do it manually.

## Environment variables

All credentials are loaded from `.env` in the **project root** (one level up from
`/tools`). Scripts use `dotenv` with an explicit path:

```ts
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
```

The root `.env` is the single source of truth. Do not maintain a separate `.env`
inside `/tools`. See the root `CLAUDE.md` for the full list of required variables.

Required variables for these scripts:

| Variable | Used by |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN` | `post.ts`, `lib/meta.ts` |
| `INSTAGRAM_USER_ID` | `post.ts`, `lib/meta.ts` |
| `CLOUDINARY_CLOUD_NAME` | `lib/cloudinary.ts` |
| `CLOUDINARY_API_KEY` | `lib/cloudinary.ts` |
| `CLOUDINARY_API_SECRET` | `lib/cloudinary.ts` |

## Dependencies

| Package | Purpose |
|---|---|
| `cloudinary` | Upload images to Cloudinary for public hosting |
| `exifr` | Extract EXIF/GPS metadata from JPEG/RAW photos |
| `sharp` | Image resizing and format conversion if needed |
| `axios` | HTTP client for Meta Graph API calls |
| `dotenv` | Load `.env` from project root |
| `fs-extra` | Friendlier file system operations (move, copy, ensureDir) |
| `ts-node` | Run TypeScript directly without a separate compile step |
| `typescript` | TypeScript compiler |
| `@types/node` | Node.js type definitions |
| `@types/fs-extra` | Types for fs-extra |

## Script responsibilities

### `sync.ts`
Downloads new photos and videos from the Cloudinary `afd-inbox` folder to the
local `/inbox` directory. Tracks already-downloaded files in `.sync-state.json`
so repeat runs are safe and only fetch what's new. Sorts downloads oldest-first
so `/inbox` files arrive in chronological order.

This is the **backup inbox method** — only run when photos were uploaded via the
mobile uploader at `https://denis-nv.github.io/age-for-discoveries/uploader/`.
The primary method is Google Photos batch download (Shift+D or Download as zip →
unzip → drop into `/inbox`), which fully preserves GPS coordinates. Android strips
GPS from photos shared with browser apps (OS-level restriction), so phone-uploaded
files will arrive with date and camera metadata intact but without GPS.

### `triage.ts`
Scans `/inbox` for new photos and videos. For each file it extracts:
- File name, type, size
- EXIF date taken (if available)
- GPS coordinates (if available)
- Camera model

Outputs a structured report to the terminal grouped by date. Does not move or
modify any files — safe to run at any time.

### `process.ts` [TODO — not yet built]
Handles all image and video editing so Denis never needs to open an editing app.
For images (using `sharp`): crop to the correct aspect ratio (4:5 feed, 9:16 story),
adjust exposure/contrast/saturation/sharpness, ensure visual consistency across carousel
frames, and generate both feed and story versions from a single raw file.
For video (using `ffmpeg`): crop/resize to 9:16, trim to target length, normalise audio.
Saves output to `/processed`.

### `post.ts`
Full publish pipeline: validates processed files and captions → uploads to Cloudinary →
creates Instagram media container(s) → publishes immediately or schedules →
moves media from `/processed` to a permanent archive. Handles single images,
carousels, Stories, and Reels. On any failure, cleans up Cloudinary uploads.

### `lib/cloudinary.ts`
Uploads a local image file to Cloudinary under the `age-for-discoveries` folder,
using the original filename as the public ID. Returns the permanent HTTPS URL
needed by the Meta Graph API. Also provides a `deleteImage` helper for cleanup.

### `lib/meta.ts`
Low-level functions for the Meta Graph API: create single/carousel containers,
poll container status, publish immediately, or schedule for a future timestamp.
No business logic — just the API calls.

### `lib/media.ts`
Shared utilities: EXIF extraction, inbox scanning, file type validation, moving
files between inbox/processed, parsing caption `.txt` files, path constants.

## Code style

- TypeScript strict mode on
- Async/await throughout — no callback style
- Each script should be runnable standalone (`ts-node src/triage.ts`)
- Keep scripts readable for a developer who is not the original author
- Prefer explicit types over `any`
- Log clearly to the terminal — these are CLI tools, output is the UI
