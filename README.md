# Arch:Genesis

A mobile game/app where users ("Architects") create digital lifeforms called "Cyphers" and battle inside a vast digital space called "The Framework."

## Tech Stack

- **Expo React Native** (TypeScript)
- **expo-router** for navigation
- **React Native Skia** for Framework grid visual
- **NativeWind** for styling
- **Zustand** for state management
- **Supabase** for backend (stub included, not yet implemented)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- iOS Simulator (for iOS development) or Android Studio (for Android)
- Expo Go app (optional, for physical device testing)

### Installation

1. Navigate to the project directory:
   ```bash
   cd arch-genesis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on specific platform:
   ```bash
   npm run ios      # Run on iOS simulator
   npm run android  # Run on Android emulator
   npm run web      # Run in web browser
   ```

## Project Structure

```
arch-genesis/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home screen
│   │   ├── create.tsx     # Genesis Wizard
│   │   ├── cyphers.tsx    # Roster screen
│   │   └── battles.tsx    # Battles screen
│   ├── cypher/
│   │   └── [id].tsx       # Cypher Detail modal
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── wizard/           # Genesis Wizard steps
│   └── FrameworkBackground.tsx
├── store/                # Zustand state management
│   └── useGameStore.ts
├── types/                # TypeScript type definitions
│   └── index.ts
├── constants/            # App constants
│   └── abilities.ts
└── lib/                  # Utilities and services
    └── supabase.ts       # Supabase client stub
```

## Features

### Home Screen
- Displays the Framework background with perspective grid
- Shows Primary Cypher card
- Quick actions: Create Cypher, View Roster, Start Battle

### Genesis Wizard (Create)
5-step wizard for creating Cyphers:
1. **Sketch** - Placeholder for future sketch tool
2. **Identity** - Name, visual style, origin log
3. **Structure** - Size class, mobility, material, combat style
4. **Kit** - Abilities (basic attack, specials, defense, passive, weakness)
5. **Review** - Summary before creation

**Auto-Structure** button fills steps 3-4 with balanced defaults.

### Cyphers (Roster)
- View all Cyphers
- Toggle active status (max 3 active)
- Set primary Cypher
- Tap to view details

### Cypher Detail
- Battle pose image (placeholder)
- Full stats display
- Action buttons (Deploy, Reallocate FP, Edit) - placeholders

### Battles
- Simulate local battles between active Cyphers
- Deterministic battle simulation with seeded RNG
- Battle timeline showing condition state changes
- No health bars - uses condition states: Stable → Strained → Fractured → Destabilized

## Data Models

### Cypher
Core attributes:
- Identity: name, visual style, origin log
- Structure: size class, mobility, material, combat style
- Kit: 6 abilities (basic, special1, special2, defense, passive, weakness)
- State: condition, FP allocated/allocation

### Condition States
- **Stable** - Normal operation
- **Strained** - Minor degradation
- **Fractured** - Significant damage
- **Destabilized** - Battle loss

## Configuration

### Supabase Setup (Optional)
Update `.env` file with your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Development Notes

- All battles are client-side simulated (no backend required yet)
- Cypher images are placeholders (colored circles with initials)
- Framework background uses Skia for performance
- State is managed locally with Zustand
- Seed data includes 2 example Cyphers

## Next Steps

- [ ] Implement Skia sketch tool
- [ ] Add FP reallocation UI
- [ ] Implement Cypher editing
- [ ] Connect to Supabase backend
- [ ] Add authentication
- [ ] Implement server-side battle simulation
- [ ] Add Cypher image generation/upload
- [ ] Implement battle animations

## Design Principles

- Clean, minimal, premium aesthetic
- Neutral vocabulary (Framework, Genesis, Cypher)
- No "underground society" tone
- Mobile-first, performance-focused
- TypeScript for type safety
