# LaunchNow Mini App

Open-source Farcaster Mini App for launching tokens through the o1 Launch API on Base and Robinhood Chain.

## Features

- Farcaster wallet connection
- Base and Robinhood Chain support
- Token metadata and logo upload
- o1 launch transaction preparation
- Success screen with o1 Launchpad and explorer links
- Sensitive server credentials remain backend-only

## Project structure

```text
frontend/   React + Vite Farcaster Mini App
backend/    Express API proxy for the o1 Launch API
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Set `O1_API_KEY` in `backend/.env`. Never commit the real `.env` file.

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

The frontend expects the backend at `/api/launch`. In production, proxy `/api/` to the backend with Nginx or another reverse proxy.

## Supported networks

- Base — chain ID `8453`
- Robinhood Chain — chain ID `4663`

## Security

This repository intentionally excludes API keys, private environment files, VPS credentials, and other secrets.

## License

MIT
