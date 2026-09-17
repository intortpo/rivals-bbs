import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill FileReader for Node.js environment
class NodeFileReader {
  result: any = null;
  onloadend: any = null;
  async readAsArrayBuffer(blob: Blob) {
    const buf = await blob.arrayBuffer();
    this.result = buf;
    if (this.onloadend) this.onloadend();
  }
}
(globalThis as any).FileReader = NodeFileReader;

const animFiles: Record<string, string> = {
  'idle': 'Breathing Idle.fbx',
  'run': 'Running.fbx',
  'sprint': 'Running (1).fbx',
  'slide': 'Running Slide.fbx',
  'turn180': 'Running Turn 180.fbx',
  'strafe_left': 'Strafe.fbx',
  'strafe_right': 'Strafe (1).fbx',
  'reload': 'Reloading.fbx',
  'stab': 'Stabbing.fbx',
  'slash': 'Stable Sword Inward Slash.fbx',
  'death': 'Dying.fbx'
};

export async function convertFBXToGLB(
  downloadsDir: string = '/home/hideo/Downloads',
  outputDir: string = path.resolve('public/models/characters')
): Promise<string> {
  const loader = new FBXLoader();
  const baseFilePath = path.join(downloadsDir, 'Breathing Idle.fbx');
  if (!fs.existsSync(baseFilePath)) {
    throw new Error(`Base character file not found at: ${baseFilePath}`);
  }

  const baseBuf = fs.readFileSync(baseFilePath);
  const baseArray = baseBuf.buffer.slice(baseBuf.byteOffset, baseBuf.byteOffset + baseBuf.byteLength);
  const characterObj = loader.parse(baseArray, '');

  const allClips: THREE.AnimationClip[] = [];

  for (const [animName, fileName] of Object.entries(animFiles)) {
    const filePath = path.join(downloadsDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[converter] Warning: Animation file not found: ${filePath}`);
      continue;
    }
    const buf = fs.readFileSync(filePath);
    const arr = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const fbx = loader.parse(arr, '');
    const clip = fbx.animations.find((a: any) => a.tracks && a.tracks.length > 0);
    if (clip) {
      clip.name = animName;
      allClips.push(clip);
      console.log(`[converter] Extracted animation: "${animName}" (${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks)`);
    }
  }

  // Standardize character mesh materials
  characterObj.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        obj.material = new THREE.MeshStandardMaterial({
          color: 0xdde2eb,
          roughness: 0.4,
          metalness: 0.2
        });
      }
    }
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, 'arena_character.glb');

  const exporter = new GLTFExporter();
  const glb: any = await exporter.parseAsync(characterObj, { binary: true, animations: allClips });
  fs.writeFileSync(outPath, Buffer.from(glb as ArrayBuffer));
  console.log(`[converter] Successfully wrote GLB to: ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
  return outPath;
}

if (process.argv[1] && process.argv[1].endsWith('convert-fbx-models.ts')) {
  convertFBXToGLB().catch(err => {
    console.error('[converter] Error:', err);
    process.exit(1);
  });
}
