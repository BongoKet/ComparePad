# ComparePad — Firefox Browser Extension

Drag images and highlighted text from any webpage into a persistent side panel for comparison.

## Features

- **Drag & Drop** — drag images or selected text from any webpage into the sidebar
- **Persistent Storage** — items survive browser restarts via `browser.storage.local`
- **Delete Individual Items** — click the × on any card to remove it
- **Clear All** — one-click removal of everything (with confirmation)
- **Dark Mode UI** — clean, modern dark interface

## Installation (Temporary — for development)

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file from this folder
4. The ComparePad sidebar icon will appear — click it or use **View → Sidebar → ComparePad**

## Usage

1. Open the ComparePad sidebar (click the toolbar icon or via **View → Sidebar → ComparePad**)
2. On any webpage, highlight text or find an image you want to save
3. Drag it toward the sidebar drop zone
4. Items are saved automatically and persist across sessions

## File Structure

```
├── manifest.json        # Extension manifest (v3, Firefox)
├── background.js        # Message relay between content ↔ sidebar
├── content.js           # Captures drag events on webpages
├── sidebar/
│   ├── sidebar.html     # Sidebar panel markup
│   ├── sidebar.css      # Dark-mode styles
│   └── sidebar.js       # Drop handling, storage, rendering
└── icons/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```
