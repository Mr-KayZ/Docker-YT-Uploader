# Docker-YT-Uploader: Ver. 0.9.1
Dockerized YouTube uploader, for when you want to upload to YouTube directly from your NAS!

## Use Case
So I have a server that's running 24/7 mainly as a NAS, and when recording videos, filesizes regularly exceed 10–20 GB. Yes, compression software can reduce this, but that often introduces compression artifacts, on top of YouTube's own compression, resulting in a noticeably messier final video.

Add the fact that uploading large videos hammers my network connection, making it nearly impossible to do anything else online in the meantime (like, say, recording more footage), and you can start to see the problem.

**Solution?** Use the NAS I already own to handle uploads independently, keeping my main machine free.

***

## Setup

### 1. Prerequisites
Before proceeding, you must have **Docker Desktop** ([Windows](https://docs.docker.com/desktop/setup/install/windows-install/)/[MacOS](https://docs.docker.com/desktop/setup/install/mac-install/)) or **Docker Engine** + **Docker Compose plugin** ([Linux](https://docs.docker.com/desktop/setup/install/linux/)). Everything else will be baked into the image.

### 2. Docker Setup

#### Download and start the container
Open a terminal where Docker Engine and Compose are present (for Windows, WSL integration is ideal) and run:
```bash
# Download the release compose file
curl -O https://raw.githubusercontent.com/Mr-KayZ/Docker-YT-Uploader/main/docker-compose.release.yml

# Pull and start
docker compose -f docker-compose.release.yml up -d
```
Once running, access the web UI at: **http://localhost:4321/setup**

### 3. Google Cloud and YouTube API Credentials
This app requires you to create your own Google Cloud project to authenticate with the YouTube Data API v3. Google does not allow a single set of credentials to be shared publicly for uploading purposes.

#### Step 1 - Create a Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** (top-right, next to the Google Cloud logo) → **New Project**
3. Name it anything you want (e.g. `my-yt-uploader`), then click **Create**
4. Select the project you just created from the **Select a project** dropdown

#### Step 2 - Enable YouTube Data API v3
1. Open the left sidebar via the hamburger icon (top-left)
2. Navigate to **APIs & Services** → **Library**
3. Search for `YouTube Data API v3` → **Enable**

#### Step 3 - Configure the OAuth Consent Screen
1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen** → **Get Started**
2. Fill in the app name (e.g. `my-yt-uploader`) and your user email
3. Under **Audience**, select **External**
4. Complete the remaining fields and agree to the policy

#### Step 4 - Add yourself as a test user
1. Still on the **OAuth consent screen** page, scroll down to the **Test users** section
2. Click **+ Add Users** and add your Google account email
3. Click **Save**

> This step is required. While the app is in Testing status, only approved test users can complete the OAuth flow. Formal Google app verification is **not** required for self-hosted personal use - staying in Testing mode permanently is intentional and sufficient.

#### Step 5 - Create the OAuth Credentials
1. In the left sidebar, navigate to **APIs & Services** → **Credentials**
2. Click **+ Create credentials** → **OAuth client ID**
3. Set the application type to **Desktop App** and name it anything (e.g. `my-yt-uploader`)
4. Click **Create**, then **Download JSON**

> **Important:** Download the JSON immediately - this is the only time the download option is shown. If you miss it, you will need to delete and recreate the credential.

5. Rename the downloaded file to `client_secret.json` (Optional)

### 4. First-Run Setup

Navigate to **http://localhost:4321/setup** in your browser. If no credentials are detected, you will be automatically redirected there. The setup page walks through two required steps before the uploader is accessible:

1. **Upload your `client_secret.json`** via drag-and-drop or the file browser
2. **Click "Connect YouTube Account"** to be redirected to Google's OAuth consent screen - sign in and approve access, and you will be returned to the setup page automatically

Once both steps are complete, the **Ready to proceed?** card becomes active and you can navigate to the uploader. The middleware blocks access to all non-setup routes until both credentials and tokens are present.

A `tokens.json` file is saved to the `auth/` volume automatically. This only needs to be done once; tokens are refreshed automatically by the app going forward.

> Note: `client_secret.json` and `tokens.json` are listed in `.gitignore` and will never be committed. Never share these files publicly.

***

## How It Works
> Note: Architecture and tech stack are subject to change as the project evolves.

### Foundation
At its core, Docker-YT-Uploader is a Docker container that:
1. **Watches a configured folder** for new video files. This folder can be:
   - A local directory within the Linux host or VM
   - An NFS-mounted share from another machine on the network (folder visibility works the same either way)
2. **Presents a web UI** (served via the container) where you can review detected videos, edit their metadata, and trigger or schedule uploads
3. **Authenticates with YouTube** via OAuth 2.0, then uses the YouTube Data API v3 to upload videos directly from the watched folder
4. **Tracks upload history** so you can see what has already been sent to your channel

The container is designed to run persistently alongside other services on a NAS or home server, with minimal interaction required once configured.

### Tech Stack
- **Frontend/Backend:** [Astro](https://astro.build/)
- **YouTube Integration:** [YouTube Data API v3 (OAuth 2.0)](https://developers.google.com/youtube/v3/guides/authentication)
- **Containerization:** Docker / Docker Compose

***

## Features
> Note: Features, planned or otherwise, are subject to change as the project evolves.

- **Web interface for metadata editing** - Title, description, tags, category, privacy, schedule
- **Folder watch** - Files appearing in the configured watch folder are detected automatically and surfaced in the web UI
- **Upload history view** - Shows previously uploaded videos from your YouTube channel
- **Sidecar JSON for metadata** - Optional `.meta.json` files per video for pre-filling metadata fields
- **Thumbnail upload support** - Custom thumbnail selection and upload via the API
- **In-browser upload notifications** - On upload completion, a toast shows the video title and a direct YouTube link; all notifications persist in a bell icon popover in the header
- **Browser-based OAuth setup** - Upload your `client_secret.json` and authenticate entirely through the web UI; no CLI or manual file placement required
- **Upload info panel** - Fixed bottom-left pane showing active upload status, live progress bar, upload speed, and current API quota usage vs. daily limit
- **Playlist support** - Pulls your existing YouTube playlists via the API so you can assign a video to one or more playlists at upload time
- **Docker log viewer** - Dedicated page showing live console output from the container for debugging and upload monitoring
- **Upload progress indicator** - Live progress bar with estimated time remaining and a spinner while the upload is in flight
- **Resumable uploads** - Leverages the YouTube Data API v3's resumable upload sessions, essential for large files where a mid-upload failure would otherwise require starting over
- **Queue management** - Queue multiple videos, reorder them, pause, or cancel pending uploads
- **Drag-and-drop upload** - Optionally drag and drop video files directly into the web UI (note: streaming multi-GB files through the browser requires careful handling)
- **Additional notification channels** - Beyond in-browser notifications, exploring options like webhooks or self-hosted push services (e.g. ntfy, Gotify) for truly headless setups
- **Mount point configuration** - Setup UI for configuring the watched folder path and auth directory, so no manual `docker-compose.yml` edits are needed for common cases

***

## Docker Configuration

> **Note:** Resource limits and environment variable configuration will be documented here as the project matures.

### Volume Mounts

The app requires three host directories to be mounted into the container. These can be configured from the **Setup page** and take effect after restarting the container. The defaults are:

| Mount | Default path | Purpose |
|---|---|---|
| Videos | `/videos` | Watched folder - drop `.mp4` files (and optional `.meta.json` sidecars) here |
| Auth | `/auth` | Stores `client_secret.json` and OAuth tokens |
| Data | `/data` | Stores queue state and persistence files |

**Docker Compose example:**
```yaml
services:
  yt-uploader:
    image: ghcr.io/mr-kayz/docker-yt-uploader:latest
    ports:
      - "4321:4321"
    volumes:
      - /your/videos:/videos
      - /your/auth:/auth
      - /your/data:/data
```

**Docker CLI equivalent:**
```bash
docker run -p 4321:4321 \
  -v /your/videos:/videos \
  -v /your/auth:/auth \
  -v /your/data:/data \
  ghcr.io/mr-kayz/docker-yt-uploader:latest
```

> Mount paths can be changed in the Setup UI under **Mount Points**. Saved changes apply on the next container restart. The active paths shown in the UI reflect what the currently running container was started with.

### Sidecar Metadata (`.meta.json`)

When a video is dropped into the `/videos` folder, the app also looks for a companion `.meta.json` file in the same directory with the same base name (e.g. `my-video.mp4` → `my-video.meta.json`). If found, its contents pre-fill the upload form fields automatically.

All fields are optional - any omitted field leaves the corresponding form field at its default value.

```json
{
  "title": "My Awesome Video",
  "description": "A full description for YouTube.\nNewlines are supported.",
  "tags": ["gaming", "tutorial", "walkthrough"],
  "privacy": "public",
  "categoryId": "20",
  "language": "en",
  "audience": "general"
}
```

| Field | Type | Accepted values |
|---|---|---|
| `title` | `string` | Any text, max 100 characters |
| `description` | `string` | Any text, max 5000 characters |
| `tags` | `string[]` | Array of strings, 500 characters total across all tags |
| `privacy` | `string` | `"public"`, `"private"`, `"unlisted"` |
| `categoryId` | `string` | YouTube numeric category ID (e.g. `"20"` = Gaming, `"22"` = People & Blogs) |
| `language` | `string` | BCP-47 code (e.g. `"en"`, `"fr"`, `"ja"`) |
| `audience` | `string` | `"general"`, `"kids"`, `"age_restricted"` |

Files with a recognised sidecar are marked with a **META** badge in the file panel. Invalid or malformed `.meta.json` files are silently ignored and the form remains blank.

***

## Known Constraints
The YouTube Data API v3 has a default quota of **10,000 units per day**. Each video upload costs **1,600 units**, which works out to a maximum of **~6 uploads per day** on the default allocation. If this becomes a bottleneck, a quota increase can be requested through the [Google Cloud Console](https://console.cloud.google.com/).

***

## Development Status
This is a solo project currently in very early development. Features will be implemented and polished over time - don't expect a fully finished product just yet.

Want to contribute? Remember to create an issue and read the [wiki](https://github.com/Mr-KayZ/Docker-YT-Uploader/wiki/Development-Notes) to quickly get up to speed on how to set up the dev space locally!

### Roadmap

| Version | Milestone | Status |
|---|---|---|
| 0.1.0 | Project scaffold - Astro + Docker + basic routing | Complete |
| 0.2.0 | Auth system - OAuth setup page, credential upload, callback | Complete |
| 0.3.0 | File watcher + queue persistence | Complete |
| 0.4.0 | Uploader core + scheduler | Complete |
| 0.5.0 | Web UI - metadata form, file list panel, enqueue flow | Complete |
| 0.6.0 | Cross-file integration fixes, route corrections, server init hooks | Complete |
| 0.7.0 | Refactor `index.astro` into components + independent panel scrolling + selected file highlight | Complete |
| 0.8.0 | Sidecar `.meta.json` support - auto-fill metadata form from file | Complete |
| 0.9.0 | Mount point configuration - setup UI for watched folder, auth, and data directories | Complete |
| 0.9.1 | Setup UX polish - proceed card, OAuth callback redirect fix, button alignment fixes | Complete |
| 0.9.2 | Resumable uploads + live upload progress indicator + spinner (bottom-left card) | In Progress |
| 0.9.3 | Upload info panel - progress bar, upload speed, quota usage | Planned |
| 0.9.4 | In-browser notifications - toast on completion + bell popover with history | Planned |
| 0.9.5 | Queue management - reorder, pause, cancel pending uploads via popover | Planned |
| 0.9.6 | Playlist support - pull channel playlists, assign at upload time | Planned |
| 0.9.7 | Docker log viewer - dedicated page for live container console output | Planned |
| 0.9.8 | Additional notification channels - webhooks, ntfy, Gotify | Planned |
| 0.9.9 | Drag-and-drop video upload directly into the web UI | Planned |
| 0.9.10 | Final bug fixing round (see Fixes to Implement) and testing | Planned |
| 1.0.0 | All key and planned features complete; end-to-end Docker tested | Target |

> Remember to tag releases with `git tag <version>` and `git push origin <version>` to trigger the Docker image build on GitHub Actions.

### Fixes to Implement
These are outstanding structural and UX improvements that don't map to a specific feature, but need to be resolved before the project is considered stable:

- **Verify solo Docker container operation** - Confirm the app works correctly as a standalone Docker image; build and test independent of Compose
- **Refactor `setup.astro` into components** - The page is large; break it into Astro components and a layout for easier maintenance
- **`.meta.json` tags on video cards** - If a video has a sidecar meta file, show a compact tag badge on the video card in the file list instead of embedding it as plain text
- **Back button on Uploader** - Add a back/settings link in the top-left header of the uploader (beside the logo/title) that returns the user to `/setup`
- **Tooltips on icon buttons** - Header icon buttons (bell, logs, etc.) should show a descriptive tooltip on hover
- **Upload complete toast notification** - On successful upload, show a green toast (darker green border, dismiss button) reading "Upload complete! \<Video Title\>: \<YouTube link\>"; the same notification should appear in the bell popover history
- **Fix webclient to be accessible everywhere** - Reconfirm that this docker image can have its webclient reached via simple IP address instead.
- **Have a settings page** - Allows changing of ports, updating of app (if possible), etc.