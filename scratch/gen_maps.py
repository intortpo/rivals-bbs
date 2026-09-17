import re

with open("src/client/engine/playcanvas/PCMapBuilder.ts", "r") as f:
    content = f.read()

# Find the start of the switch statement
start_idx = content.find("    switch (name) {")
# Find the start of getGroundLevel
end_idx = content.find("  public getGroundLevel")

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    exit(1)

new_methods = """    switch (name) {
      case 'Cartoon City':
      case 'Neon Warehouse':
      case 'Urban Slums':
      case 'Metro Underpass':
      case 'Skyline Penthouse':
      case 'Metro Underpass (Neon Subways)':
      case 'Skyline Penthouse (Vertigo Lounge)':
        this.generateUrbanCity();
        break;
        
      case 'Bio-Dome':
      case 'Bio-Dome (Neo Arboretum)':
      case 'Sky Sanctuary':
      case 'Sky Islands':
      case 'Sunken Atoll':
      case 'Sunken Atoll (Ancient Coral Ruins)':
      case 'Scrapyard Canyon':
      case 'Scrapyard Canyon (Rust Basin)':
        this.generateNatureBiome();
        break;

      default:
        this.generateTechFacility();
        break;
    }
  }

  private generateUrbanCity(): void {
    this.bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
    this.hasGroundPlane = true;
    
    // Base Asphalt
    this.addBox(0, -0.1, 0, 300, 0.2, 300, '#11141e', false, { metalness: 0.1, gloss: 0.5 });
    
    // Grid of roads and buildings
    const gridSize = 10;
    for (let x = -140; x <= 140; x += gridSize) {
      for (let z = -140; z <= 140; z += gridSize) {
        // Leave center open
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
        
        const rand = Math.random();
        if (rand < 0.2) {
          // Intersection
          this.addPlatformerProp('road-asphalt-center.glb', x, 0, z, 1.2);
        } else if (rand < 0.4) {
          // Road straight
          this.addPlatformerProp('road-asphalt-straight.glb', x, 0, z, 1.2);
        } else if (rand < 0.7) {
          // Building
          const bldg = `building-${String.fromCharCode(97 + Math.floor(Math.random() * 10))}.glb`; // building-a to building-j
          // We can set collider height massive so players can grapple up
          this.addPlatformerProp(bldg, x, 0, z, 2.0 + Math.random() * 2.0);
          
          // Occasional roof jump pad
          if (Math.random() < 0.1) {
             this.createJumpPad(x, 15, z, 20); // rough roof height
          }
        }
      }
    }
    
    // Central Monument
    this.addBox(0, 5, 0, 10, 10, 10, '#00d2ff', true, { emissive: '#00d2ff', emissiveIntensity: 2.0 });
    this.createJumpPad(-12, 0, 0, 25);
    this.createJumpPad(12, 0, 0, 25);
    this.createJumpPad(0, 0, -12, 25);
    this.createJumpPad(0, 0, 12, 25);
  }

  private generateNatureBiome(): void {
    this.bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
    this.hasGroundPlane = true;
    
    // Base Grass/Dirt
    this.addBox(0, -0.1, 0, 300, 0.2, 300, '#14532d', false, { metalness: 0.05, gloss: 0.2 });
    
    // Scatter trees and ruins
    for (let i = 0; i < 600; i++) {
       const x = (Math.random() - 0.5) * 280;
       const z = (Math.random() - 0.5) * 280;
       if (Math.abs(x) < 20 && Math.abs(z) < 20) continue; // Keep center clear

       const r = Math.random();
       if (r < 0.3) {
           this.addPlatformerProp('tree-pine-large.glb', x, 0, z, 2.0 + Math.random() * 1.5);
       } else if (r < 0.6) {
           this.addPlatformerProp('tree-park-large.glb', x, 0, z, 1.5 + Math.random());
       } else if (r < 0.8) {
           this.addPlatformerProp('tree.glb', x, 0, z, 1.5 + Math.random());
       } else {
           // Ruins / ancient column
           this.addPlatformerProp('column-rounded.glb', x, 0, z, 2.0);
           this.addPlatformerProp('column.glb', x + 2, 0, z + 2, 2.0);
           if (Math.random() < 0.1) {
              this.createJumpPad(x, 0, z, 18);
           }
       }
    }
    
    // River / Void crevice
    this.addBox(0, -0.5, 0, 20, 0.1, 300, '#0891b2', false, { emissive: '#06b6d4', emissiveIntensity: 1.0 });
    this.createJumpPad(-15, 0, 0, 20, 15, 0);
    this.createJumpPad(15, 0, 0, 20, -15, 0);
  }

  private generateTechFacility(): void {
    this.bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
    this.hasGroundPlane = false; // Void underneath
    
    // Massive scaffolding platforms
    for (let i = 0; i < 80; i++) {
        const x = (Math.random() - 0.5) * 280;
        const z = (Math.random() - 0.5) * 280;
        const y = Math.random() * 25; // Massive verticality
        const w = 15 + Math.random() * 25;
        const d = 15 + Math.random() * 25;
        
        this.addBox(x, y, z, w, 1, d, '#1e293b', true, { metalness: 0.8, gloss: 0.7 });
        
        // Add random tech props from prototype-kit
        if (Math.random() < 0.5) {
            this.addPlatformerProp('barrel.glb', x, y + 0.5, z, 1.5);
        }
        if (Math.random() < 0.3) {
            this.addPlatformerProp('crate-color.glb', x + 2, y + 0.5, z - 2, 1.5);
        }
        
        // Jump pads connecting verticality
        if (Math.random() < 0.5) {
            this.createJumpPad(x, y + 0.5, z, 22);
        }
    }
    
    // Central Hub
    this.addBox(0, 0, 0, 50, 2, 50, '#0f172a', true, { metalness: 0.9, gloss: 0.9, emissive: '#0284c7', emissiveIntensity: 0.3 });
    this.addBox(0, 5, 0, 10, 20, 10, '#f43f5e', true, { emissive: '#e11d48', emissiveIntensity: 1.5 });
    this.createJumpPad(-12, 1, 0, 25);
    this.createJumpPad(12, 1, 0, 25);
  }

"""

new_content = content[:start_idx] + new_methods + content[end_idx:]

with open("src/client/engine/playcanvas/PCMapBuilder.ts", "w") as f:
    f.write(new_content)

print("Map replacements injected successfully.")
