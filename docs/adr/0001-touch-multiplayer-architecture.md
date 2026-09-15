# ADR 0001: Touch-First Mobile Controls & QR Code Networking Architecture

## Status
Accepted

## Context
Roblox Rivals is renowned for fast-paced 1v1 and arena gunplay with fluid movement (sliding, jumping, quick weapon swaps). Replicating this experience in a web browser with a requirement to be entirely touch-based and support frictionless mobile room joining via QR codes presents several engineering challenges:
1. **Touch Ergonomics**: Virtual controls on mobile often feel clunky or interfere with multi-finger aiming and shooting.
2. **Room Joining UX**: Typing random 6-character room codes on a virtual mobile keyboard is tedious.
3. **Cross-Device Camera Permissions**: Mobile browsers require HTTPS or localhost for `getUserMedia` camera access to scan QR codes.
4. **Latency & Interpolation**: Fast movement and hit registration require responsive client prediction and remote interpolation.

## Decisions

### 1. Dual-Zone Dynamic Touch Controls
- **Left Zone**: Dynamic floating thumbstick that spawns where the finger touches down, avoiding rigid fixed-position fatigue.
- **Right Zone**: Unconstrained swipe surface for look/aim, paired with an ergonomic action arc (Shoot, ADS, Jump, Slide, Reload, Weapons).
- Simultaneous multi-touch tracking via pointer ID isolation prevents thumbstick drops when tapping fire or jump.

### 2. QR Code Room Joining & Fallback Strategy
- The room host renders a high-contrast QR code directly to a `<canvas>` element using `qrcode`.
- The QR payload contains the full host URL with room query parameter: `http://<lan-or-domain>:<port>/?room=<ROOM_CODE>`.
- The joining player can use the in-app camera scanner via `html5-qrcode`.
- To safeguard against mobile camera permission blocks on non-HTTPS LANs, the UI simultaneously offers:
  - Instant one-tap "Copy Link" to send via chat/AirDrop.
  - Prominent 6-character code input with auto-paste.
  - Direct URL access when scanned with native phone camera app.

### 3. Procedural Audio Synthesis via Web Audio API
- Rather than loading external `.mp3` or `.wav` sound files over network (which can fail, cause CORS errors, or delay initial interaction on mobile), all gunshots, hit chimes, jump whooshes, and death sounds are synthesized using Web Audio oscillators, noise buffers, and envelope filters.

### 4. Client-Side Prediction with Interpolation
- Local movement (walking, jumping, sliding) runs immediately on the client at 60/120 FPS.
- Network sync operates at 25Hz. Remote player transforms are smoothly interpolated using LERP and SLERP to prevent visual stuttering over wireless connections.

## Consequences
- High-fidelity mobile touch gameplay without requiring an app store download.
- Zero external audio assets ensures fast load times and offline/LAN resilience.
- Native phone cameras can also scan the QR code to open the game directly in Safari/Chrome.
