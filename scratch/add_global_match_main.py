with open("src/client/main.ts", "r") as f:
    content = f.read()

target = """      onCreateRoom: async (name, mode, fragLimit, mapName, skyTheme = 'twilight', outfitIndex = 0, customization) => {"""

replacement = """      onGlobalMatch: async (name, customization) => {
        this.audio.touchUnlock();
        const res = await this.networkClient.joinRoom('GLOBAL', name, 0, customization);
        if (!res.success) {
          // If GLOBAL doesn't exist, create it
          this.networkClient.createRoom(name, 'wave', 99, 'Sky Islands', 0, customization).then(createRes => {
              if (createRes.success && createRes.roomId) {
                  this.networkClient.startCountdown();
              }
          });
        }
      },
      onCreateRoom: async (name, mode, fragLimit, mapName, skyTheme = 'twilight', outfitIndex = 0, customization) => {"""

content = content.replace(target, replacement)

with open("src/client/main.ts", "w") as f:
    f.write(content)
