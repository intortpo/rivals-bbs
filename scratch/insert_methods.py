with open("src/client/engine/playcanvas/PCMapBuilder.ts", "r") as f:
    content = f.read()

insert_idx = content.find("  public getGroundLevel")

if insert_idx == -1:
    print("Could not find getGroundLevel")
    exit(1)

methods = """  public checkJumpPads(pos: { x: number; y: number; z: number } | pc.Vec3): { impulseY: number; impulseX: number; impulseZ: number } | null {
    const pt = pos instanceof pc.Vec3 ? pos : new pc.Vec3(pos.x, pos.y, pos.z);
    for (const jp of this.jumpPads) {
      if (jp.box.containsPoint(pt)) {
        return {
          impulseY: jp.impulseY,
          impulseX: jp.impulseX || 0,
          impulseZ: jp.impulseZ || 0
        };
      }
    }
    return null;
  }

  public checkLadders(pos: { x: number; y: number; z: number } | pc.Vec3): pc.BoundingBox | null {
    const px = pos.x;
    const py = pos.y;
    const pz = pos.z;
    for (const box of this.ladderBoxes) {
      const min = box.getMin();
      const max = box.getMax();
      if (
        px >= min.x - 0.45 &&
        px <= max.x + 0.45 &&
        pz >= min.z - 0.45 &&
        pz <= max.z + 0.45 &&
        py >= min.y - 0.25 &&
        py <= max.y + 0.5
      ) {
        return box;
      }
    }
    return null;
  }

  public checkTeleportPorts(pos: { x: number; y: number; z: number } | pc.Vec3, lastTeleportTime: number): PCTeleportPort | null {
    const now = performance.now();
    if (lastTeleportTime > 0 && now - lastTeleportTime < 1500) {
      return null;
    }
    const pt = pos instanceof pc.Vec3 ? pos : new pc.Vec3(pos.x, pos.y, pos.z);
    for (const port of this.teleportPorts) {
      if (port.box.containsPoint(pt)) {
        return port;
      }
    }
    return null;
  }

"""

new_content = content[:insert_idx] + methods + content[insert_idx:]

with open("src/client/engine/playcanvas/PCMapBuilder.ts", "w") as f:
    f.write(new_content)
