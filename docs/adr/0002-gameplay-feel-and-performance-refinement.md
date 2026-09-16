# ADR 0002: Gameplay Feel & Performance Refinements

## Status
Accepted

## Context
High-octane tactical mobile shooters demand consistent 60–120 FPS frame rates, zero garbage-collection stutter, responsive input registration, and visceral gunplay feedback. Profiling the application revealed several performance bottlenecks and gameplay opportunities:
1. **Memory & Garbage Collection Churn**:
   - The tick loop and particle systems were instantiating new `THREE.Vector3`, `THREE.BoxGeometry`, `THREE.MeshBasicMaterial`, and dynamic `<canvas>` DOM elements on every frame, slide, and shot.
   - Web Audio effects were allocating and populating 4,410–19,200 random floats for noise buffers on every weapon discharge and slide.
2. **Raycast Line-of-Sight (LOS) CPU Overhead**:
   - Evaluating line-of-sight across 80+ obstacles in Cartoon City performed full 3D slab ray-box intersection algorithms with floating-point divisions on all obstacles during every bot tick and bullet fired.
3. **Movement & Input Responsiveness**:
   - Strictly frame-checked jump inputs led to dropped jumps when players pressed jump shortly before touching down or immediately after stepping off a rooftop ledge.
   - First-person camera lacked physical weight: no camera roll tilt during slides/strafes, no head bobbing, and no weapon viewmodel sway.
4. **Bot Navigation Realism**:
   - AI bots only avoided the central plaza fountain, occasionally clipping into buildings or getting caught on outer architecture.
5. **Client Bundle Footprint**:
   - Monolithic 1.18 MB client bundle invalidated browser cache on minor game code edits.

## Decisions

### 1. Broadphase Line-of-Sight (LOS) Culling
- Added an initial segment AABB bounding extent pre-filter (`rMin` to `rMax`) in `hasLineOfSight()`.
- Obstacles whose axis-aligned bounding boxes do not overlap the ray's bounding box are immediately discarded using 6 scalar comparisons, bypassing >95% of full slab intersection calculations.

### 2. Pre-baked Audio Noise Buffer
- Pre-generate a 1.0-second white noise `AudioBuffer` once during `AudioManager.initContext()`.
- Reused by both `playShoot()` and `playSlide()` via lightweight `AudioBufferSourceNode` references, eliminating runtime buffer allocations and random number calculations.

### 3. Comprehensive Object Pooling (FX, Tracers, Debris)
- **Dust Particles**: Reusable pool of meshes backed by a static shared `BoxGeometry` and material pool.
- **Damage Numbers**: Reusable pool of 10 sprites with dedicated offscreen 256x128 canvases, redrawing only modified textures rather than creating DOM canvas elements and textures.
- **Tracers**: Reusable line pool with static `Float32BufferAttribute` position arrays updated in-place via direct index assignment.
- **Death Debris**: Static shared `BoxGeometry` and palette materials in `CharacterModel`.

### 4. Zero-Allocation Tick Loop & Responsive Movement Dynamics
- Replaced per-frame `new THREE.Vector3()` instantiations in `main.ts` with pre-allocated scratch vectors (`_scratchForward`, `_scratchRight`, etc.).
- **Jump Buffering (120ms)**: Jump inputs triggered just before touching the ground execute immediately upon touchdown.
- **Coyote Time (100ms)**: Players stepping off ledges or boxes can still jump within 100ms of losing ground contact.
- **Dynamic Camera Feel**: Smooth camera roll tilt during slides (-2.9°) and strafes (+/- 1.4°), subtle rhythmic head bobbing while moving, viewmodel weapon sway lagging behind rapid look deltas, and camera recoil punch on weapon discharge.

### 5. AI Bot Obstacle Collisions & Corner Sliding
- Integrated horizontal AABB obstacle collision resolution against `mapObstacles` into `WaveManager.tick()`.
- Normal penetration velocities are cancelled while tangential velocities are preserved, enabling bots to slide smoothly around building corners when pursuing players.

### 6. Vite Vendor & Engine Chunk Splitting
- Configured `rollupOptions.output.manualChunks` in `vite.config.ts` to isolate `three` and vendor dependencies (`socket.io-client`, `qrcode`, `html5-qrcode`).
- Reduced game application code bundle to 250 kB (62 kB gzipped), allowing permanent caching of engine dependencies across releases.

## Consequences
- Main game loop runs with near-zero memory allocations and no garbage collection pauses.
- Server CPU tick duration during wave mode reduced significantly with broadphase ray culling.
- Movement and gunplay feel visceral, responsive, and weighty.
- AI bots navigate realistically around urban structures without clipping through architecture.
