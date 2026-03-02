# The Dugout — Where Decisions Win Matches

A multiplayer IPL-style cricket management simulator built with Next.js 14, TypeScript, and real-time game mechanics.

## 🏏 Features

- **Live Auction System** — Real-time bidding with timer, purse management, and squad limits
- **Ball-by-Ball Match Simulation** — Skill-based engine considering batter/bowler stats, pitch conditions, and match phase
- **Multiplayer Rooms** — Create/join rooms with 6-character codes, up to 10 players
- **Team Management** — Build your dream squad from 60+ IPL-style players
- **Premium UI** — Black & Gold broadcast-grade design with smooth animations

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| State Management | Zustand |
| Backend | Next.js API Routes |
| Database | PostgreSQL (Prisma ORM) |
| Cache/State | Redis (ioredis) |
| Real-time | Socket.io (ready) |
| Deployment | Vercel-ready |

## 📦 Project Structure

```
/app
  /login              # Username-based auth
  /dashboard          # Create/join rooms
  /room/[code]        # Room lobby
  /auction/[code]     # Live auction
  /match/[code]       # Ball-by-ball match
  /api/auth/          # Auth endpoints
  /api/rooms/         # Room CRUD
  /api/auction/       # Auction engine API
  /api/match/         # Match engine API

/components
  Navbar.tsx           # Global navigation
  RoomCard.tsx         # Room display card
  AuctionPanel.tsx     # Live auction UI
  MatchBoard.tsx       # Match info display
  ScoreCard.tsx        # Score component

/lib
  prisma.ts            # Prisma client
  redis.ts             # Redis client (w/ memory fallback)
  socket.ts            # Socket.io client
  auctionEngine.ts     # Server-side auction logic
  matchEngine.ts       # Ball-by-ball simulation
  roomManager.ts       # Room CRUD + Redis state
  store.ts             # Zustand stores

/data
  players.ts           # 60 IPL-style player dataset

/prisma
  schema.prisma        # Database schema (10 models)
```

## 🚀 Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL (local or remote)
- Redis (optional, has in-memory fallback)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed players (optional)
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🌍 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dugout` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NEXT_PUBLIC_APP_URL` | App URL | `http://localhost:3000` |
| `SESSION_SECRET` | Session encryption key | `random-secure-string` |

## ☁️ Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel dashboard
3. Add environment variables:
   - `DATABASE_URL` — Vercel Postgres or external
   - `REDIS_URL` — Upstash Redis
   - `NEXT_PUBLIC_APP_URL` — Your Vercel URL
   - `SESSION_SECRET` — Generate a strong secret
4. Deploy!

### Vercel Postgres Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Add Postgres addon
vercel postgres create
```

### Upstash Redis Setup
1. Create account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the connection URL to `REDIS_URL`

## 🎮 How to Play

1. **Login** — Enter a username (no account needed)
2. **Create Room** — Get a 6-character code
3. **Share Code** — Friends join with the code
4. **Host Starts Auction** — Bid on real cricket players
5. **Build Your Squad** — Manage your ₹100 Cr purse wisely
6. **Watch Matches** — Ball-by-ball simulation with your squad

## 🧪 Testing

Open two browser windows:
1. Both login with different usernames
2. One creates a room, shares the code
3. Both join and participate in auction
4. Watch match simulation together

## 📄 License

MIT
