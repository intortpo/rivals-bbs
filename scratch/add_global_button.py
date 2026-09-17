with open("src/client/ui/LobbyUI.ts", "r") as f:
    content = f.read()

target = """        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-play-solo" class="btn" style="padding: 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; background: linear-gradient(135deg, #00d2ff, #2563eb); color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 210, 255, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <span>⚡</span> PLAY SOLO WAVE (INSTANT ACTION)
          </button>"""

replacement = """        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-global-match" class="btn" style="padding: 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; background: linear-gradient(135deg, #ff0055, #a200ff); color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 15px rgba(255, 0, 85, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <span>🌍</span> JOIN GLOBAL BULLET HELL
          </button>

          <button id="btn-play-solo" class="btn" style="padding: 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; background: linear-gradient(135deg, #00d2ff, #2563eb); color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 210, 255, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <span>⚡</span> PLAY SOLO WAVE (INSTANT ACTION)
          </button>"""

if target in content:
    content = content.replace(target, replacement)
else:
    print("Could not find button target")

with open("src/client/ui/LobbyUI.ts", "w") as f:
    f.write(content)
