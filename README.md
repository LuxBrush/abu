# ABU (Automatic Bookmark Updater)

ABU is a Chrome Extension that keeps your bookmarks pointing to where you actually are. It’s great for webcomics, blogs, wikis, YouTube, and more.

## What it does

- Converts normal bookmarks into ABUkmarks that update as you browse.
- Tracks progress on supported sites (e.g., YouTube time, manga/comic chapters, Tapas, Webtoons, etc.).
- Lets you revert ABUkmarks back to normal with one click.

## How it works

- The background service worker (`background.js`) listens to tab updates/activations and updates the matching ABUkmark.
- The popup (`popup.html` + `script.js`) lets you create/convert/revert ABUkmarks and manage them.
- Shared utilities live in `tools.js` (URL normalization, DOM helpers, notifications).

## Install (development)

1. Go to chrome://extensions.
2. Enable Developer Mode.
3. Load Unpacked and select this folder.

## Permissions rationale

- `tabs`: Read the current tab URL/title to update bookmarks.
- `bookmarks`: Create, update, and search bookmarks.
- `storage`: Store ABUkmark metadata (per-domain id and favicon).
- `scripting`: Inject lightweight scripts for specific page logic (e.g., YouTube time).
- `host_permissions: <all_urls>`: Needed to detect/update ABUkmarks across sites.

## Usage

- Open the popup on a page you want tracked.
- Click "Create ABUkmark" (or "Convert to ABUkmark").
- ABU will keep that bookmark updated as you move forward on that site.
- Use the list in the popup to remove ABUkmarks from anywhere.

## Supported/special handling

- YouTube: Tracks playback position by appending `&t=`.
- Tapas/Webtoons/Lezhin/MangaHub: Normalizes URL keys to the right series/chapters.

## Project structure

- `manifest.json`: MV3 config.
- `background.js`: Tab listeners, bookmark updates, YouTube progress handler.
- `popup.html`, `style.css`, `script.js`: Popup UI and logic.
- `tools.js`: Utilities (`createABURL`, `resolveUrlPath`, `normalizeContentUrl`, `setNotification`, `Get`).
- `definitions.d.ts`: Lightweight typings for JS type-check (`jsconfig.json`).

## Notes

- Errors in event-driven paths are logged (console.error) rather than thrown, to avoid crashing the popup/service worker.
- YouTube interval is cleaned up during navigation to avoid leaks.
