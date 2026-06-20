# Development Notes
These notes explain how to get a development environment running after cloning the repository. The goal is fast iteration using WSL2 (or native Linux), Docker, and the Node/NPM toolchain used by Astro.

---

## 1. Prerequisites
Before starting, make sure you have:
- Windows 10/11 with WSL2 enabled (or a Linux machine).
- A Linux distribution installed in WSL (e.g. Ubuntu).
- Docker installed and working inside WSL or reachable from WSL.
- Git installed in WSL.
- Node.js and npm installed in WSL (LTS version recommended).

### 1.1 WSL setup (Windows only)
1. Enable WSL2 and install Ubuntu from the Microsoft Store (Alternatively, you can also open up powershell as admin and run `wsl --install`)
2. Open Ubuntu and update packages:
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```
3. Make sure Git is installed
    ```bash
    sudo apt install -y git
    ```

### 1.2 Docker in WSL
1. Install Docker Desktop for Windows and enable:
    - "Use WSL2 based engine"
    - Integration with your Ubuntu distro
2. In your WSL shell, verify Docker works
    ```bash
    docker version
    docker run --rm hellow-world
    ```
If these commands run successfully, Docker is ready.

## 2. Clone the repository
In your WSL (or Linux) terminal:
```bash
cd ~/path/to/target/ #Replace with whever you want the repo to be
git clone https://github.com/Mr-KayZ/Docker-YT-Uploader.git
cd Docker-YT-Uploader
```
All remaining commands now assume you are in this directory.

## 3. Node.js and npm
This project uses Node.js + npm for both the front end and back end via Astro.

### 3.1. Install Node via nvm (recommended)
If `node` or `npm` are not available:
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload the shell
source ~/.bashrc # Assuming you use bash

# Install an LTS Node version (e.g. 24)
nvm install --lts
nvm use --lts
```

Check using:
```bash
node -v
npm -v
```

## 4. Install project dependancies
From the root folder, we run the following:
```bash
cd app/
npm install
npx astro sync
cd ..
```
This installs all dependancies listed in `package.json` for the Astro app and any supporting tooling within the `app/` directory.

## 5. Local development workflow (Astro)

### 5.1 Running the dev server
From the appropriate project directory (within the `app/` directory within the whole project which has `package.json` and `astro.config.*`):
```bash
npm run dev
```

By default, Astro runs on port 4321. Open the URL printed in the terminal in your browser (e.g. http://localhost:4321).

### 5.2 Running Astro inside Docker
For testing the dev server within Docker to ensure the Docker image works as intended:
1. Ensure Docker is running.
2. Build and start the dev container:
    ```bash
    docker compose up --build
    ```
3. If you are attaching a shell to a dev container, you can run:
    ```bash
    docker exec -it <container_name> bash
    npm run dev -- --host
    ```
Using `--host` ensures the dev server is reachable from your host browser.

## 6. Environment variables and configuration
If the application needs API keys (for example, Youtube API credentials), set them via environment variables, or a `.env` file. (Note, will get to these soon enough)
1. Copy the example env file if one exists:
```bash
cp .env.example .env
```
2. Fill in required values inside `.env` (API keys, secrets, etc.)
3. Make sure `.env` is not committed to Git.
If there is no `.env.example`, check the README for `process.env.*` usages and define those variables accordingly.

## 7. Docker workflow for the full stack
To run the full stack (front end + backend / worker components) using Docker:
1. Build images and start services:
```bash
docker compuse up --build
```
2. After the stack starts:
    - Open up the web UI: `http://localhost:<port>` (Check `docker-compose.yml` for the correct port)
    - Logs:
        ```bash
        docker compose logs -f
        ```
3. Stop the stack:
    ```bash
    docker compose down
    ```
Use this docker workflow when testing the project in an environment closer to production.

## 8 Common development tasks
Some common NPM scripts (from `package.json`) you will likely use:
- `npm run dev` - Start Astro development server with hot reload.
- `npm run build` - Build the project for production.
- `npm run preview` - Preview the production build locally.
- Any additional project-specific scripts for uploading, queue workers, or utilities (ckec `package.json`).

Run them from the project directory where `package.json` lives:
```bash
npm run <script-name>
```

## 9. Typical WSL shenanigans
- Always run commands **inside WSL**, not in Powershell/CMD, unless explicitly stated.
- For best performance, keep the repository inside the Linux filesystem (e.g. `/home/user/Docker-YT-Uploader`)
- If Docker commands fail in WSL, ensure Docker Desktop is running and WSL integration is enabled.
