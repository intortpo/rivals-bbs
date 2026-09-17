with open("src/shared/mapObstacles.ts", "r") as f:
    content = f.read()

start_idx = content.find("export function getMapObstacles(mapName: string): BoundingBox[] {")
end_idx = content.find("}", start_idx) + 1

# Actually it's a huge switch, so the closing bracket of the function is much further down.
# Let's just find the end of the file.
new_func = """export function getMapObstacles(mapName: string): BoundingBox[] {
  return []; // Procedural maps do not use hardcoded server obstacles, allowing bullet hell projectile penetration.
}
"""

content = content[:start_idx] + new_func

with open("src/shared/mapObstacles.ts", "w") as f:
    f.write(content)
