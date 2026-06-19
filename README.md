# Docker-YT-Uploader: Ver. 0.6.0
Dockerized YouTube uploader, for when you want to upload to YouTube directly from your NAS!

## Use Case
So I have a server that's running 24/7 mainly as a NAS, and when recording videos, filesizes regularly exceed 10–20 GB. Yes, compression software can reduce this, but that often introduces compression artifacts, on top of YouTube's own compression, resulting in a noticeably messier final video.

Add the fact that uploading large videos hammers my network connection, making it nearly impossible to do anything else online in the meantime (like, say, recording more footage), and you can start to see the problem.

**Solution?** Use the NAS I already own to handle uploads independently, keeping my main machine free.

---

## Setup

### 1. Google Cloud and YouTube API Credentials
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

5. Rename the downloaded file to `client_secret.json`

#### Step 6 - Authenticate via the Web UI
Once the app is running (see Docker Configuration below), navigate to it in your browser. If no credentials are detected, you will be automatically redirected to the setup page where you can:

1. **Upload your `client_secret.json`** via drag-and-drop or the file browser
2. **Click "Connect YouTube Account"** to be redirected to Google's OAuth consent screen
3. Sign in and approve access - you will be redirected back to the app automatically

A `tokens.json` file is saved to the `auth/` volume automatically. This only needs to be done once; tokens are refreshed automatically by the app going forward.

> Note: `client_secret.json` and `tokens.json` are listed in `.gitignore` and will never be committed. Never share these files publicly.

### 2. (OTHER STUFF THATS NECESSARY LATER)

---

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

---

## Features
> Note: Features, planned or otherwise, are subject to change as the project evolves.

### Key Features
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

### Planned Features
These are on the roadmap for a future release:
- **Upload progress indicator** - Live progress bar with estimated time remaining and a spinner while the upload is in flight
- **Resumable uploads** - Leverages the YouTube Data API v3's resumable upload sessions, essential for large files where a mid-upload failure would otherwise require starting over
- **Queue management** - Queue multiple videos, reorder them, pause, or cancel pending uploads
- **Drag-and-drop upload** - Optionally drag and drop video files directly into the web UI (note: streaming multi-GB files through the browser requires careful handling)
- **Additional notification channels** - Beyond in-browser notifications, exploring options like webhooks or self-hosted push services (e.g. ntfy, Gotify) for truly headless setups
- **Mount point configuration** - Setup UI for configuring the watched folder path and auth directory, so no manual `docker-compose.yml` edits are needed for common cases

---

## Docker Configuration
> Note: Volume mounts, port mappings, resource limits, and the `.meta.json` schema will be documented here as the project matures. These details are subject to change during early development.

---

## Known Constraints
The YouTube Data API v3 has a default quota of **10,000 units per day**. Each video upload costs **1,600 units**, which works out to a maximum of **~6 uploads per day** on the default allocation. If this becomes a bottleneck, a quota increase can be requested through the [Google Cloud Console](https://console.cloud.google.com/).

---

## Development Status
This is a solo project currently in very early development. Features will be implemented and polished over time - don't expect a fully finished product just yet.

### Fixes to Implement
These are outstanding structural and UX improvements that don't map to a specific feature, but need to be resolved before the project is considered stable:

- **Verify solo Docker container operation** - Confirm the app works correctly as a standalone Docker image; build and test a Docker image independent of compose
- **Refactor `index.astro` into components** - The main page is excessively large; break it into Astro layouts, components, and an `assets/` folder for easier maintenance
- **Consolidate setup flow into a single modal-based page** - Replace the separate `setup.astro` route with an inline modal system on `index.astro`; explore using Astro component files as modal panels for maintainability
- **Separate left and right panel scroll contexts** - The file list (left pane) and metadata form (right pane) should each scroll independently
- **Selected file highlight** - The active file in the left panel should darken slightly and show a rounded border to make the selection state unambiguous
- **Upload complete toast notification** - On successful upload, show a green toast (with darker green border and a dismiss button) reading "Upload complete! \<Video Title\>: \<YouTube link\>"; the same notification should also appear in the bell icon popover
- **Tooltips** - Enable tooltip support across the UI; icon buttons in the header (bell, logs) should show a tooltip on hover describing their function