# Context & Domain Model: Arena BBS

This document defines the ubiquitous language, architectural boundaries, and core design principles for the Arena BBS multiplayer game.

## Ubiquitous Language

- **Rival / Avatar**: The in-game player representation, rendered in blocky Roblox R6-style (6 distinct parts: Head, Torso, Left Arm, Right Arm, Left Leg, Right Leg).
- **Duel**: A 1v1 match between two players, typically scored first-to-5 frags.
- **FFA (Free-For-All)**: An arena match where every player fights independently up to a frag limit.
- **Frag / Elimination**: Successfully depleting an opponent's health points (HP) to 0.
- **Brick Shatter**: The signature Roblox-style death effect where an avatar's limbs detach with physics impulses and tumble away as individual bricks.
- **Slide**: A high-momentum ground maneuver that lowers the player's collision height, provides a temporary forward speed burst, and tilts the camera.
- **Slide-Cancel**: Tapping Jump during a slide to retain momentum into the air while resetting ground friction.
- **Jump Pad**: An arena entity that propels any player who steps on it upward and forward with an audio whoosh.
- **Touch HUD**: The full-screen mobile touch interface comprising the dynamic thumbstick, look drag area, fire cluster, and status displays.
- **Dynamic Thumbstick**: A floating virtual joystick on the left half of the screen that anchors wherever the player touches down.
- **Look Zone**: The right surface of the touch screen used for directional camera yaw and pitch aiming.
- **ADS (Aim Down Sights)**: Toggling camera zoom (reducing Field of View) and reducing touch look sensitivity for precise ranged shooting.
- **QR Match Link**: An encoded URL (`http://<lan-ip>:3000/?room=<ROOM_ID>`) rendered as a scannable QR code on the host's screen.
- **Room / Match Session**: A server-side state machine managing connected players, round state (`WAITING`, `STARTING`, `PLAYING`, `ROUND_OVER`), score, and snapshot replication.
- **PBR Render Pipeline**: High-performance PlayCanvas ACES tonemapped renderer with cascaded PCF soft shadows, metallic-roughness PBR materials, and dynamic tablet DPR clamping (1.5x max) for locked 60 FPS.
- **Mixamo Animated Characters & Bots**: Full 3D skinned mesh models with 11 unified animation tracks (`idle`, `run`, `sprint`, `slide`, `jump`, `death`, `reload`, `stab`, `slash`, `turn180`, `strafe`), procedural head/spine aim pitching, and right-hand weapon socket binding.
- **World Powerup Pickups**: In-world rotating, bobbing 3D pickups (Shield, Speed, Quad Damage, Rapid Mag) placed at tactical map locations with proximity collection and timed respawns.
- **Static Mesh Batching**: PlayCanvas `BatchGroup` combining static level geometry into single draw calls via `app.batcher` to maximize mobile/tablet throughput.
- **In-Game Settings**: Real-time adjustments of FOV, sensitivity, invert-Y, auto-fire, and HUD opacity accessible at any time during gameplay.

## System Boundaries

1. **Client Engine (`src/client/engine/playcanvas/`)**: PlayCanvas PBR rendering, ACES tonemapping, lighting, 10 arena map architectures, static mesh batching, particle effects, GLB character animation controller, and synthesized Web Audio.
2. **Controls Layer (`src/client/controls/`)**: TouchControls with fire-button aim dragging, deadzone-curved joystick, inverted-Y support, and InputManager normalizing inputs across desktop and mobile.
3. **Networking Layer (`src/client/network/` & `src/server/`)**: Socket.IO transport, client-side snapshot interpolation, server-side room lifecycle, wave survival orchestration, and obstacle line-of-sight damage verification.
4. **UI Layer (`src/client/ui/`)**: Touch HUD, SettingsUI, QR generator, camera QR scanner, lobby management, account auth, and match dashboards.

