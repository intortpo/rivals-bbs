import re

with open("src/client/main.ts", "r") as f:
    content = f.read()

# Replace the auto join logic with the original dashboardUI.open
target = """        // AUTO JOIN GLOBAL BULLET HELL SERVER
        const name = this.authUI?.currentUser?.displayName || 'InvaderHunter_' + Math.floor(Math.random() * 1000);
        
        // Attempt to join the persistent GLOBAL room
        this.networkClient.joinRoom('GLOBAL', name, 0, undefined).then(res => {
          if (!res.success) {
            // Room does not exist yet; create the global room. 
            // We'll let the server randomly name the room, but everyone else will see it in the open rooms list and can join.
            // Wait, we can modify the roomID on the server, but for now we'll just create a wave mode game and auto-start it.
            this.networkClient.createRoom(name, 'wave', 99, 'Sky Islands', 0, undefined).then(createRes => {
                if (createRes.success && createRes.roomId) {
                   this.networkClient.startCountdown();
                }
            });
          }
        });"""

replacement = """        this.dashboardUI.open(this.authUI?.currentUser || null);"""

if target in content:
    content = content.replace(target, replacement)
else:
    print("Could not find the auto join block.")

with open("src/client/main.ts", "w") as f:
    f.write(content)

