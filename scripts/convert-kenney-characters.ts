import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

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

export async function convertKenneyCharacter(
  sourceDir: string = '/home/hideo/Downloads/kenney_animated-characters-protagonists',
  outputDir: string = path.resolve('public/models/characters/kenney')
): Promise<string> {
  const loader = new FBXLoader();
  const modelPath = path.join(sourceDir, 'Model/characterMedium.fbx');
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Kenney character model not found at: ${modelPath}`);
  }

  const baseBuf = fs.readFileSync(modelPath);
  const baseArray = baseBuf.buffer.slice(baseBuf.byteOffset, baseBuf.byteOffset + baseBuf.byteLength);
  const characterObj = loader.parse(baseArray, '');

  const animDir = path.join(sourceDir, 'Animations');
  const animMapping: Record<string, string> = {
    'idle': 'idle.fbx',
    'run': 'run.fbx',
    'jump': 'jump.fbx'
  };

  const allClips: THREE.AnimationClip[] = [];

  for (const [animName, fileName] of Object.entries(animMapping)) {
    const filePath = path.join(animDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[kenney-converter] Warning: Animation file not found: ${filePath}`);
      continue;
    }
    const buf = fs.readFileSync(filePath);
    const arr = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const fbx = loader.parse(arr, '');
    const matchingClips = fbx.animations.filter((a: any) =>
      a.name.toLowerCase().includes(animName) || a.name.includes(animName.charAt(0).toUpperCase() + animName.slice(1))
    );
    const clip = matchingClips.sort((a: any, b: any) => b.duration - a.duration)[0] ||
                 fbx.animations.sort((a: any, b: any) => b.duration - a.duration)[0];
    if (clip) {
      const clonedClip = clip.clone();
      clonedClip.name = animName;
      allClips.push(clonedClip);
      console.log(`[kenney-converter] Extracted animation: "${animName}" (${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks)`);

      // Create synthetic sprint and strafe variants for PlayCanvas anim state machine
      if (animName === 'run') {
        const sprintClip = clip.clone();
        sprintClip.name = 'sprint';
        allClips.push(sprintClip);

        const strafeL = clip.clone();
        strafeL.name = 'strafe_left';
        allClips.push(strafeL);

        const strafeR = clip.clone();
        strafeR.name = 'strafe_right';
        allClips.push(strafeR);
      } else if (animName === 'jump') {
        const slideClip = clip.clone();
        slideClip.name = 'slide';
        allClips.push(slideClip);
      }
    }
  }

  // Standardize material
  characterObj.traverse((obj: any) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.1
      });
    }
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, 'kenney_character.glb');

  const exporter = new GLTFExporter();
  const glb: any = await exporter.parseAsync(characterObj, { binary: true, animations: allClips });
  fs.writeFileSync(outPath, Buffer.from(glb as ArrayBuffer));
  console.log(`[kenney-converter] Successfully generated Kenney character GLB: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  return outPath;
}

if (process.argv[1] && process.argv[1].endsWith('convert-kenney-characters.ts')) {
  convertKenneyCharacter().catch((err) => {
    console.error('[kenney-converter] Error:', err);
    process.exit(1);
  });
}
