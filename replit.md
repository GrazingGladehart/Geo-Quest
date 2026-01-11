# GeoQuest - Location-Based Trivia Game

## Overview

GeoQuest is a mobile-first location-based trivia game where players explore their physical surroundings to collect virtual checkpoints. Players walk to nearby locations, answer trivia questions, and earn points. The app features AR view capabilities, real-time geolocation tracking, and a playful game-style UI with animations and confetti celebrations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, local React state for game logic
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for playful transitions and UI effects
- **Special Effects**: canvas-confetti for celebration animations
- **Geolocation**: Browser Geolocation API with custom hook (`useGeolocation`)
- **Distance Calculations**: geolib library for coordinate math

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: REST endpoints defined in `shared/routes.ts` with Zod validation
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Build System**: Custom build script using esbuild for server, Vite for client

### Data Storage
- **Database**: PostgreSQL (connection via `DATABASE_URL` environment variable)
- **Schema Location**: `shared/schema.ts`
- **Tables**:
  - `questions`: Trivia questions with answer options and point values
  - `custom_checkpoints`: Admin-placed checkpoints at specific GPS coordinates
  - `settings`: Game configuration (time limits)

### Key Design Decisions

1. **Shared Types**: Schema and route definitions in `shared/` directory enable type safety across frontend and backend
2. **Monorepo Structure**: Single repository with `client/`, `server/`, and `shared/` directories
3. **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code
4. **Game State**: Managed client-side for responsive gameplay, with server validation for answers
5. **Checkpoint Generation**: Server generates random checkpoints within a radius of user's location

### API Endpoints
- `POST /api/game/generate`: Create checkpoints near user location
- `POST /api/game/verify`: Validate player answers
- `GET /api/settings`: Retrieve game configuration
- `POST /api/settings`: Update game settings
- `GET /api/questions`: List all trivia questions
- `POST /api/checkpoints/custom`: Add custom checkpoint at specific location

## External Dependencies

### Database
- PostgreSQL database (required)
- Connection string provided via `DATABASE_URL` environment variable
- Schema migrations managed via Drizzle Kit (`npm run db:push`)

### Third-Party Services
- No external APIs required for core functionality
- Google Fonts for typography (Fredoka, Nunito)

### Key NPM Packages
- `geolib`: GPS coordinate calculations
- `canvas-confetti`: Victory animations
- `framer-motion`: UI animations
- `react-webcam`: AR camera view
- `drizzle-orm` + `drizzle-zod`: Database operations with type safety
- Full shadcn/ui component set via Radix UI primitives