# Playlist App

A playlist website for me and my friends to share our favorite songs.

## Quick Start

```bash
# Build and start the app
docker-compose up --build -d

# Open in browser
open http://localhost:3000
```

## Basic Commands

```bash
# Start the app
docker-compose up -d

# Stop the app
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up --build -d
```

## Share with Others (Public URL)

```bash
# Start a public tunnel (keep terminal open)
cloudflared tunnel --url http://localhost:3000

# Share the generated URL with others
# Example: https://xxx-xxx-xxx.trycloudflare.com
```
