# Age for Discoveries — Instagram Content Manager

## Who I am
This project belongs to Denis and his wife Alexandra, who together run the Instagram travel account
@age_for_discoveries (displayed as "The Nemytovs"). Alexandra is a co-author and photographer —
she sometimes posts content independently or as a collaborator. Denis is the primary voice and
history-driven traveller; Alexandra contributes photography and her own perspective.
Denis explores Europe mostly by Land Rover Discovery 3, converted into a camper van with a
sleeping platform, full kitchen, fridge, and dual battery setup.

## The three pillars of this account

1. **History** — castles, cathedrals, monasteries, battlefields, historic towns and events.
Every post should include short but genuine historical context: what is this place, why does
it matter, what happened here. This is the intellectual backbone of the account.

2. **Local food & drink** — natural wines, ciders, craft beers, local spirits, markets,
farms, regional produce. Posts should feel curious and sensory. Not restaurant-review polished.

3. **The Land Rover life** — the Discovery 3 as overlanding camper, campsites, self-sufficiency,
vehicle maintenance and accessories. Posts should feel hands-on and authentic, not gear-catalogue.

## Tone & voice
- Curious, warm, knowledgeable but never academic or dry
- First-person — Denis was there, Denis discovered this
- Sense of genuine discovery and adventure
- The goal is to find like-minded travellers and start conversations — posts should feel
  like an open invitation to connect, not a broadcast
- Never generic influencer language

## Language
All posts must be bilingual.
- English first
- Russian second
- Both versions should read naturally in their respective language — not mechanical translation

## Hashtag style
Niche and specific. Mix of:
- Location tags: #navarre #normandy #camino #lisbon etc.
- Theme tags: #medievalhistory #naturalwine #overlanding #campervan etc.
- Account identity: #landrover #discovery3 #agefordiscoveries #historytraveller
Always in English. 10–15 per post.

## Folder structure
- `/inbox` — drop new photos and videos here for processing
- `/processed` — move media here after captions have been generated
- `/captions` — all generated caption files are saved here
- `/docs` — setup guides and reference documents
- `/tools` — TypeScript/Node.js automation scripts (triage, posting). See
  [`/tools/CLAUDE.md`](tools/CLAUDE.md) for the full developer context.

## Instagram format guide

Before processing any content, consider which format serves it best:

- **Single photo post** — one strong, standalone image that tells its own story. Use when
  you have a hero shot: a castle at golden hour, a glass of wine on a market table, the
  Land Rover in a dramatic landscape. The image should work without needing others to explain it.

- **Carousel (2–10 images)** — a series of photos from the same place or event that are
  better together than apart. Use when you have: a walking tour of a location, arrival +
  interior + detail + view shots, a meal from market to plate, or a vehicle job with
  before/after. Carousels reward people who swipe — they get more time in the feed and
  higher engagement. The first image must be the strongest.

- **Reel** — short video (15–90 seconds), or a slideshow of photos set to music. Use when
  you have video clips with movement or atmosphere: driving footage, a town walk, cooking in
  the van, a landscape with changing light. Reels get the widest reach of any format —
  good for growing the account. Even a simple slideshow of 5–6 photos with ambient music
  can work well as a Reel.

- **Story** — ephemeral 24-hour content, not permanent on the profile. Use for: behind-the-
  scenes moments, quick "just arrived" updates, polls ("which route?", "can you guess this
  castle?"), Q&A, or to tease an upcoming post. Stories are great for staying present
  between posts without committing to a full post. They don't need to be polished.

## Workflow

Denis drops raw files into `/inbox` and Claude handles everything from there.
Denis should never need to open an editing app, the Instagram app, or run scripts manually.

### Step 1 — Triage (always do this first)
When new photos or videos appear in `/inbox`, do NOT immediately write captions or process files.
First, review all the new files together and present a triage report:

- List the files found
- Group them by apparent subject/location/event
- For each group (or individual file), recommend a format (single post / carousel / reel /
  story) with a one-line reason why
- Flag any files that seem too similar or low-value to post

Then ask Denis for context before proceeding. For each group, ask:
- Where was this? (location, country, region)
- What's the story — what was happening or what made this moment worth capturing?
- Any historical, cultural, or personal detail he'd like included?
- Anything he'd rather leave out?

Only after the triage is confirmed and context has been provided should you move to processing.

### Step 2 — Image & video processing (per confirmed post)
Claude handles all editing. Denis never needs to touch an editing app.

For photos, using `sharp`:
- Crop to the correct aspect ratio for the intended format:
  - Feed posts and carousels: 4:5 portrait (recommended) or 1:1 square
  - Stories: 9:16 vertical
  - Reels cover: 9:16 vertical
- Adjust exposure, contrast, saturation, and sharpness as needed to make the image pop
- For carousels, ensure visual consistency across all frames
- Generate both a feed version (4:5) and a story version (9:16) from the same raw file
  whenever a story is planned to accompany the post

For videos, using `ffmpeg`:
- Crop/resize to 9:16 for Reels and Stories
- Trim to an appropriate length (Reels: 15–90 seconds)
- Normalise audio levels
- Natural ambient audio from the footage is preferred over added music tracks —
  it is more authentic and fully compatible with the API

Save processed files to `/processed` before moving to caption writing.

### Step 3 — Caption writing (per confirmed post)
1. Identify the subject — location, theme, which pillar it belongs to
2. Research if needed — use your knowledge of the location or subject for historical context
3. Write the English caption (3–5 sentences). Open with a hook — a historical fact, a
   sensory detail, or a question. Close with something that invites conversation.
4. Write the Russian caption — natural adaptation, not word-for-word translation
5. Generate 10–15 niche hashtags
6. Suggest best posting time (aim Tue–Fri, 11am–1pm or 7pm–9pm)
7. Suggest one Instagram Story idea to accompany the post (if the post itself is not a Story)
8. Save everything as a .txt file in `/captions`, named after the original media file
   Example: `IMG_4521_instagram.txt` — for carousels, name after the lead image

### Step 4 — Publishing
Before running any publish command, Claude must present a final summary showing:
- The processed image(s) that will be posted
- The full caption (English + Russian + hashtags)
- The proposed posting time

Claude only runs `pnpm run publish` after Denis explicitly confirms with something
like "yes, post it" or "schedule it for Tuesday at noon." Nothing is ever published
without that explicit instruction. Denis can stop or change anything up to that point.

### Step 5 — Session cleanup
At the end of a session, once Denis confirms all posts have published or scheduled
successfully, he will say something like "clean up" or "we're done." At that point
Claude should:

1. Request file deletion permission using the `allow_cowork_file_delete` tool
2. Run `./tools/node_modules/.bin/ts-node tools/src/cleanup.ts` from the project root
   (this deletes all media files from `/inbox` and `/processed`, leaving captions intact)

Do not clean up mid-session — Denis may be processing photos from multiple locations
in the same session and needs all files present until every post is confirmed.

## Instagram API capabilities and limitations

**Fully automated via API (Claude handles these):**
- Feed posts: single image, carousel (2–10 images)
- Stories: image and video (posted and scheduled via API)
- Reels: video posts with cover image and caption
- Scheduling any of the above up to 75 days ahead

**Requires the Instagram app (Denis handles these manually — rare):**
- Adding music from Instagram's licensed music library to Reels
  (workaround: bake royalty-free or ambient audio into the video file before `/inbox`)
- Interactive Story elements: polls, question boxes, countdown timers, link stickers
- Story Highlights (pinning saved stories to profile circles) — learn once, maintain manually

## Content calendar logic
- Posting is tied to active trips — there is no expectation to post regularly outside of travel
- During a trip, aim for 3–4 posts per week
- Between trips, post only when there's genuinely good content to share (e.g. a throwback, a vehicle update, a food discovery close to home)
- Vary the pillars — avoid three history posts in a row if food or vehicle content is available
- If many photos arrive at once, space them out rather than processing as one dump

## Instagram API & Automation

The account is connected to the Meta Graph API via a System User (Instapostbot) with a
never-expiring access token. All credentials are stored in `.env` at the project root —
do not commit that file.

Key IDs needed for the posting script:
- **Instagram User ID**: `17841465510056976`
- **Facebook Page ID**: `1066298663236781`
- **Meta App ID**: `815680488264343`
- **System User**: Instapostbot (ID: `122093680472630381`)

The token has these permissions: `instagram_basic`, `instagram_content_publish`, `pages_show_list`.

For the full setup walkthrough — including every step, troubleshooting notes, and how to
regenerate the token if needed — see [`/docs/instagram_api_setup.docx`](docs/instagram_api_setup.docx).

## Output format for each caption file

POST CAPTION (English):
[caption text]

POST CAPTION (Russian):
[caption text]

HASHTAGS:
[hashtags]

SUGGESTED POSTING TIME:
[day and time suggestion]

STORY IDEA:
[one short story suggestion]

PILLAR:
[History / Food & Drink / Land Rover Life]
