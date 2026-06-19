# Docker-YT-Uploader
Dockerized YouTube uploader, for when you want to upload to YouTube directly from your NAS!

## Use Case
So I have a server that's running 24/7 mainly as a NAS, and when recording videos, filesizes regularly exceed 10–20 GB. Yes, compression software can reduce this, but that often introduces compression artifacts, on top of YouTube's own compression, resulting in a noticeably messier final video.

Add the fact that uploading large videos hammers my network connection, making it nearly impossible to do anything else online in the meantime (like, say, recording more footage), and you can start to see the problem.

**Solution?** Use the NAS I already own to handle uploads independently, keeping my main machine free.

---

## Setup

### 1. Google Cloud and YouTube API Credentials
This app requires you create your own Google Cloud project to authenticate with the YouTube Data API v3. Google does not allow a single set of credentials to be shared publicly for uploading purposes.

#### Step 1 - Create a Google Cloud Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click on **Select a project** (top right corner next to the Google Cloud brand name) -> **New Project**
3. Name it anything you want (e.g. `my-yt-uploader`), then hit **Create**
4. Now select the project you just created in the dropdown **Select a project**.

#### Step 2. Enable YouTube Data API v3
1. Open the left sidebar via the hamburger icon on the top left corner.
2. Navigate to **APIs & Services** -> **Library**
3. Search for `YouTube Data API v3` -> **Enable**

#### Step 3. Configure the OAuth Consent Screen
1. On the left sidebar again, head to **OAuth consent screen** -> **Get Started**
2. Fill in the app name (anything you want, e.g. `my-yt-uploader`), and user email
3. In **Audience**, make sure to select **External** and not Internal
4. Complete the rest of the page as is and agree to the privacy policy

#### Step 4. Create the OAuth credentials
1. Open up the full left sidebar again, navigate to **APIs & Services** -> **Credentials**
2. Select **+ Create credentials** -> **OAuth client ID**
3. Make sure that the application type is **Desktop App**. Name it whatever you wish (e.g. `my-yt-uploader`)
4. Click **Create** -> **Download JSON** - NOTE: This step is important! If you miss this step, you will have to recreate another client ID as you will only see this page once!
5. Rename the downloaded file to `client_secret.json`

#### Step 5. Place the credentials file
Place the `client_secret.json` file inside the `auth/` folder at the root of this repository:
```
Docker-YT-Uploader/
└── auth/
    └── client_secret.json   <- your file goes here
```
> Note: `client_secret.json` and `tokens.json` are listed in `.gitignore` and will never be committed. Never share these files publicly.

#### Step 6. Authenticate
Run the CLI authentication script to generate your OAuth tokens:
```
node auth/authenticate.js
```
This will open a browser window asking you to sign in with your Google account and grant permission. Once approved, a `tokens.json` file will be saved to the `auth/` folder automatically.

This only needs to be done once, as the tokens are refreshed automatically by this app.

---

## How It Works
> Note: Architecture and tech stack are subject to change as the project evolves.

### Foundation
At its core, Docker-YT-Uploader is a Docker container that:
1. **Watches a configured folder** for new video files. This folder can be:
   - A local directory within the Linux host or VM
   - An NFS-mounted share from another machine on the network (folder visibility should work the same either way)
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
> Note: Features, be it planned or key are subject to change as the project evolves.

### Key Features
- **Web interface for metadata editing** - Title, description, tags, category, privacy, schedule
- **Folder watch** - Files appearing in the configured watch folder are detected automatically and surfaced in the Web UI
- **Upload history view** - Shows previously uploaded videos from your YouTube channel
- **Sidecar JSON for metadata** - Optional `.meta.json` files per video for pre-filling metadata fields
- **Thumbnail upload support** - Custom thumbnail selection and upload via the API
- **In-browser upload notifications** - The web client notifies you when an upload completes, so you don't have to keep checking

### Planned Features
These are on the roadmap, planned for a future release:
- **Upload progress indicator** - Live progress bar with estimated time remaining for active uploads
- **Resumable uploads** - Leverages the YouTube Data API v3's resumable upload sessions, essential for large files where a mid-upload failure would otherwise require starting over
- **Queue management** - Queue multiple videos, reorder them, pause, or cancel pending uploads
- **Drag-and-drop upload** - Optionally drag and drop files directly into the Web UI (note: streaming multi-GB files through the browser requires careful handling)
- **Additional notification channels** - Beyond in-browser notifications, exploring options like webhooks or self-hosted push services (e.g. ntfy, Gotify) for truly headless setups

---

## Docker Configuration
> Note: Volume mounts, port mappings, resource limits, and the `.meta.json` schema will be documented here as the project matures. These details are subject to change during early development.

---

## Known Constraints
The YouTube Data API v3 has a default quota of **10,000 units per day**. Each video upload costs **1,600 units**, which works out to a maximum of **~6 uploads per day** on the default allocation. If this becomes a bottleneck, a quota increase can be requested through the [Google Cloud Console](https://console.cloud.google.com/).

---

## Development Status
This is a solo project currently in very early development. Features will be implemented and polished over time - don't expect a fully finished product just yet.

This is what the overall project structure exist as:
```
Docker-YT-Uploader/
├── app/                    <- Astro project for front-end
│   ├── src/
│   ├── public/
│   ├── astro.config.mjs
│   └── package.json
├── uploads/                <- The watched folder (mounted as a volume later)
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── README.md
```

Use this as the following template to understand where to put stuff as things go on, update project structure as project progresses.