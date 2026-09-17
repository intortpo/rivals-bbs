# 🎯 Arena BBS

A fast-paced, touch-first 3D multiplayer arena shooter built with Three.js, TypeScript, Express, and Socket.IO. Features Roblox R6-style avatar physics, tactile mobile controls, PvE Wave Survival mode, and instant QR-code room joining.

🎮 **Live Demo:** [https://rivals-bbs-3ebnga4saa-as.a.run.app](https://rivals-bbs-3ebnga4saa-as.a.run.app)

---

## ✨ Features

- **Roblox R6-Style Character System**: Blocky avatars with procedural walking, jumping, sliding, and signature "Brick Shatter" death physics upon elimination.
- **Wave-Based PvE Mode**: Fight escalating waves of AI bot archetypes (Cyber Scouts, Rushers, Heavies, Snipers, and Titan Bosses) with intelligent pathfinding, tactical flanking, and wave-clear health recovery.
- **Physical Line-of-Sight & Obstacle Collision**: Real raycast obstacle collision for 80+ solid buildings, structures, and vehicles in Cartoon City and Classic Arena. Bots and players cannot shoot through solid architecture.
- **Touch-First Mobile Controls & Dual-Platform Support**:
  - Floating dynamic thumbstick (left) & smooth drag look zone (right).
  - Quick action cluster: Jump, Slide / Slide-Cancel, Reload, Switch Weapon, and Aim Down Sights (ADS).
  - Desktop mouse & keyboard support with Pointer Lock.
  - Safe modal clickability protection preventing accidental fire during menu interaction.
- **Instant QR Matchmaking**:
  - Host a match and display an instant QR code on screen.
  - Mobile players can scan directly with camera to join immediately.
  - Mid-game join support for rooms with open slots.
- **Engaging Mechanics & Powerups**:
  - Jump pads with physical launch impulses.
  - Speed Boost, Shield Regen, and Quad Damage map pickups.
  - Grammar Reload challenge mini-game for rapid tactical reload.
  - Character builder with customizable head, torso, limb colors, hats, and skins.

---

## 🛠️ Tech Stack

- **Client**: [Three.js](https://threejs.org/) (r174), HTML5 Canvas, Web Audio API, TypeScript, Vite
- **Server**: Node.js, Express, Socket.IO
- **Deployment**: Google Cloud Run (Containerized via Dockerfile)
- **Tooling**: TypeScript, tsx, vitest

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/intortpo/rivals-bbs.git
cd rivals-bbs

# Install dependencies
npm install

# Start local development server (Client + Server with HMR)
npm run dev
```

Open `http://localhost:3000` in your browser or connect your mobile device to the same Wi-Fi network using the displayed LAN address or QR code.

---

## 🧪 Testing & Building

```bash
# Run all unit and integration test suites
npm test

# Build client and server bundles
npm run build

# Start production server
npm start
```

---

## 🗺️ Game Modes & Maps

- **Game Modes**:
  - `PvE Wave Survival`: Cooperative bot survival mode with escalating waves, boss fights, and squad tactics.
  - `1v1 Duel`: First-to-5 frags competitive faceoff.
  - `Free For All (FFA)`: High-energy multiplayer deathmatch.
- **Maps**:
  - `Cartoon City`: Sprawling urban combat zone with skyscrapers, roads, cars, crosswalks, and high-ground jump pads.
  - `Classic Arena`: Symmetrical competitive arena with balanced sightlines, pillars, and jump pads.

---

## 📄 License

MIT
