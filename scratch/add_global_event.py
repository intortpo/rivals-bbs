import re

with open("src/client/ui/LobbyUI.ts", "r") as f:
    content = f.read()

target = """    // Play Solo Wave (Instant Match Start)
    const soloBtn = document.getElementById('btn-play-solo');"""

replacement = """    // Global Match (Join or Create)
    const globalBtn = document.getElementById('btn-global-match');
    globalBtn?.addEventListener('click', () => {
      const name = nameInput?.value.trim() || 'Rival';
      this.callbacks.onGlobalMatch(name, this.currentCustomization);
    });

    // Play Solo Wave (Instant Match Start)
    const soloBtn = document.getElementById('btn-play-solo');"""

content = content.replace(target, replacement)

# Now add onGlobalMatch to LobbyCallbacks interface
interface_target = """  onPlaySolo: (name: string, mapName: string, skyTheme: string, outfit: CharacterCustomization) => void;"""
interface_replacement = """  onPlaySolo: (name: string, mapName: string, skyTheme: string, outfit: CharacterCustomization) => void;
  onGlobalMatch: (name: string, outfit: CharacterCustomization) => void;"""

content = content.replace(interface_target, interface_replacement)

with open("src/client/ui/LobbyUI.ts", "w") as f:
    f.write(content)
