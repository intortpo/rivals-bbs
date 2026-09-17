import re

with open("src/server/RoomManager.ts", "r") as f:
    content = f.read()

target1 = """  createRoom(
    hostId: string,
    playerName: string,
    mode: GameMode = '1v1',
    fragLimit?: number,
    mapName: string = 'Facility',
    outfitIndex: number = 0,
    customization?: CharacterCustomization
  ): { roomId: string; session: GameSession; hostSecret: string } {"""

replacement1 = """  createRoom(
    hostId: string,
    playerName: string,
    mode: GameMode = '1v1',
    fragLimit?: number,
    mapName: string = 'Facility',
    outfitIndex: number = 0,
    customization?: CharacterCustomization,
    forceRoomId?: string
  ): { roomId: string; session: GameSession; hostSecret: string } {"""

target2 = """    const roomId = (mapName === "Sky Islands" && mode === "wave") ? "GLOBAL" : this.generateRoomId();"""
replacement2 = """    const roomId = forceRoomId || this.generateRoomId();"""

if target1 in content:
    content = content.replace(target1, replacement1)
else:
    print("Could not find createRoom sig")

if target2 in content:
    content = content.replace(target2, replacement2)
else:
    print("Could not find roomId assignment")

with open("src/server/RoomManager.ts", "w") as f:
    f.write(content)

