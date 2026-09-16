import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { WeaponType, CharacterCustomization } from '../../shared/types.js';
import { WEAPON_ORDER } from '../../shared/constants.js';
import { WeaponManager } from './WeaponManager.js';

interface BrickDebris {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
}

export interface ModularItemOption {
  id: string;
  name: string;
  category: 'headwear' | 'hair' | 'face' | 'top' | 'bottom' | 'shoes' | 'accessories' | 'gloves';
  icon: string;
}

export const MODULAR_CATALOG: ModularItemOption[] = [
  // Faces / Emotions
  { id: 'Male_emotion_usual_001', name: 'Classic Focused', category: 'face', icon: '😐' },
  { id: 'Male_emotion_happy_002', name: 'Confident Grin', category: 'face', icon: '😄' },
  { id: 'Male_emotion_angry_003', name: 'Battle Fierce', category: 'face', icon: '😠' },

  // Hairstyles
  { id: 'none', name: 'None / Shaved', category: 'hair', icon: '🧑‍🦲' },
  { id: 'Hairstyle_male_010', name: 'Slick Undercut', category: 'hair', icon: '💇‍♂️' },
  { id: 'Hairstyle_male_012', name: 'Messy Modern', category: 'hair', icon: '🦱' },

  // Headwear
  { id: 'none', name: 'No Hat', category: 'headwear', icon: '❌' },
  { id: 'Hat_010', name: 'Street Ballcap', category: 'headwear', icon: '🧢' },
  { id: 'Hat_049', name: 'Slouch Beanie', category: 'headwear', icon: '🎿' },
  { id: 'Hat_057', name: 'Spec-Ops Cap', category: 'headwear', icon: '🪖' },

  // Eyewear
  { id: 'none', name: 'No Eyewear', category: 'accessories', icon: '❌' },
  { id: 'Glasses_004', name: 'Cyber Sunshades', category: 'accessories', icon: '🕶️' },
  { id: 'Glasses_006', name: 'Scholar Specs', category: 'accessories', icon: '👓' },

  // Props & Facial Accessories
  { id: 'Headphones_002', name: 'Pro Headset', category: 'accessories', icon: '🎧' },
  { id: 'Moustache_001', name: 'Gentleman Stache', category: 'accessories', icon: '🥸' },
  { id: 'Moustache_002', name: 'Handlebar Stache', category: 'accessories', icon: '👨‍🦰' },
  { id: 'Clown_nose_001', name: 'Clown Nose', category: 'accessories', icon: '🔴' },
  { id: 'Pacifier_001', name: 'Golden Binky', category: 'accessories', icon: '🍼' },

  // Tops & Outerwear
  { id: 'T_Shirt_009', name: 'BBS Crewneck Tee', category: 'top', icon: '👕' },
  { id: 'Outerwear_029', name: 'Runner Windbreaker', category: 'top', icon: '🧥' },
  { id: 'Costume_10_001', name: 'Armored Tac-Vest', category: 'top', icon: '🦺' },
  { id: 'Costume_6_001', name: 'Stealth Jumpsuit', category: 'top', icon: '🥋' },
  { id: 'Outerwear_036', name: 'Subzero Puffer', category: 'top', icon: '🥼' },

  // Bottoms
  { id: 'Pants_010', name: 'Street Cargo Jeans', category: 'bottom', icon: '👖' },
  { id: 'Pants_014', name: 'BDU Tactical Slacks', category: 'bottom', icon: '🪖' },
  { id: 'Shorts_003', name: 'Athletic Shorts', category: 'bottom', icon: '🩳' },

  // Shoes
  { id: 'Shoe_Sneakers_009', name: 'High-Top Kicks', category: 'shoes', icon: '👟' },
  { id: 'Shoe_Slippers_002', name: 'Chill Slides', category: 'shoes', icon: '🩴' },
  { id: 'Shoe_Slippers_005', name: 'Cozy Slippers', category: 'shoes', icon: '🥿' },

  // Gloves
  { id: 'none', name: 'Bare Hands', category: 'gloves', icon: '❌' },
  { id: 'Gloves_006', name: 'Half-Finger Grip', category: 'gloves', icon: '🧤' },
  { id: 'Gloves_014', name: 'Tactical Gauntlets', category: 'gloves', icon: '🥊' }
];

export const CHARACTER_PRESETS = [
  {
    name: 'Cyber Scout',
    meshes: [
      'Body_010',
      'T_Shirt_009',
      'Outerwear_029',
      'Pants_010',
      'Shoe_Sneakers_009',
      'Hairstyle_male_010',
      'Headphones_002',
      'Glasses_004',
      'Male_emotion_usual_001'
    ]
  },
  {
    name: 'Tactical Agent',
    meshes: [
      'Body_010',
      'Costume_10_001',
      'Pants_014',
      'Shoe_Sneakers_009',
      'Hat_057',
      'Glasses_006',
      'Gloves_014',
      'Male_emotion_angry_003'
    ]
  },
  {
    name: 'Urban Runner',
    meshes: [
      'Body_010',
      'T_Shirt_009',
      'Shorts_003',
      'Socks_008',
      'Shoe_Sneakers_009',
      'Hat_010',
      'Gloves_006',
      'Male_emotion_happy_002'
    ]
  },
  {
    name: 'Beanie Merc',
    meshes: [
      'Body_010',
      'Outerwear_036',
      'Pants_010',
      'Shoe_Sneakers_009',
      'Hat_049',
      'Moustache_001',
      'Male_emotion_usual_001'
    ]
  }
];

export const DEFAULT_CUSTOMIZATION: CharacterCustomization = {
  face: 'Male_emotion_usual_001',
  hair: 'Hairstyle_male_010',
  headwear: 'none',
  eyewear: 'Glasses_004',
  accessories: ['Headphones_002'],
  top: 'Outerwear_029',
  bottom: 'Pants_010',
  shoes: 'Shoe_Sneakers_009',
  socks: false,
  gloves: 'none',
  accentColor: '#00d2ff'
};

export function customizationToMeshNames(config: CharacterCustomization): Set<string> {
  const set = new Set<string>();
  set.add('Body_010'); // Always active base body
  if (config.face) set.add(config.face);
  if (config.hair && config.hair !== 'none') set.add(config.hair);
  if (config.headwear && config.headwear !== 'none') set.add(config.headwear);
  if (config.eyewear && config.eyewear !== 'none') set.add(config.eyewear);
  if (config.accessories && Array.isArray(config.accessories)) {
    for (const acc of config.accessories) {
      if (acc && acc !== 'none') set.add(acc);
    }
  }
  if (config.top && config.top !== 'none') set.add(config.top);
  if (config.bottom && config.bottom !== 'none') set.add(config.bottom);
  if (config.shoes && config.shoes !== 'none') set.add(config.shoes);
  if (config.socks) set.add('Socks_008');
  if (config.gloves && config.gloves !== 'none') set.add(config.gloves);
  return set;
}

export function presetToCustomization(outfitIndex: number, accentColor: string = '#00d2ff'): CharacterCustomization {
  const idx = Math.max(0, Math.min(CHARACTER_PRESETS.length - 1, outfitIndex));
  switch (idx) {
    case 1:
      return {
        face: 'Male_emotion_angry_003',
        hair: 'none',
        headwear: 'Hat_057',
        eyewear: 'Glasses_006',
        accessories: [],
        top: 'Costume_10_001',
        bottom: 'Pants_014',
        shoes: 'Shoe_Sneakers_009',
        socks: false,
        gloves: 'Gloves_014',
        accentColor: accentColor || '#ff2a55'
      };
    case 2:
      return {
        face: 'Male_emotion_happy_002',
        hair: 'none',
        headwear: 'Hat_010',
        eyewear: 'none',
        accessories: [],
        top: 'T_Shirt_009',
        bottom: 'Shorts_003',
        shoes: 'Shoe_Sneakers_009',
        socks: true,
        gloves: 'Gloves_006',
        accentColor: accentColor || '#00ff88'
      };
    case 3:
      return {
        face: 'Male_emotion_usual_001',
        hair: 'none',
        headwear: 'Hat_049',
        eyewear: 'none',
        accessories: ['Moustache_001'],
        top: 'Outerwear_036',
        bottom: 'Pants_010',
        shoes: 'Shoe_Sneakers_009',
        socks: false,
        gloves: 'none',
        accentColor: accentColor || '#ffaa00'
      };
    case 0:
    default:
      return {
        face: 'Male_emotion_usual_001',
        hair: 'Hairstyle_male_010',
        headwear: 'none',
        eyewear: 'Glasses_004',
        accessories: ['Headphones_002'],
        top: 'Outerwear_029',
        bottom: 'Pants_010',
        shoes: 'Shoe_Sneakers_009',
        socks: false,
        gloves: 'none',
        accentColor: accentColor || '#00d2ff'
      };
  }
}

export class CharacterModel {
  public root: THREE.Group;
  public isLocal: boolean;
  public playerId: string;
  public playerName: string;
  public playerColor: string;
  public currentWeapon: WeaponType = 'rifle';
  public outfitIndex: number = 0;
  public customization: CharacterCustomization | null = null;

  // Visual GLB scene & bones
  public characterMesh: THREE.Group | null = null;
  public weaponSocket: THREE.Group;
  public nameplateGroup!: THREE.Group;

  // Rigged humanoid bones
  private hipsBone: THREE.Object3D | null = null;
  private spineBone: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  private leftArmBone: THREE.Object3D | null = null;
  private leftForeArmBone: THREE.Object3D | null = null;
  private rightArmBone: THREE.Object3D | null = null;
  private rightForeArmBone: THREE.Object3D | null = null;
  private leftUpLegBone: THREE.Object3D | null = null;
  private rightUpLegBone: THREE.Object3D | null = null;
  private leftKneeBone: THREE.Object3D | null = null;
  private rightKneeBone: THREE.Object3D | null = null;

  // Rest transforms cached for pristine deformation
  private initialHipsPos: THREE.Vector3 = new THREE.Vector3();
  private initialBoneRotations: Map<string, THREE.Quaternion> = new Map();

  // Hitbox meshes for precise raycasting
  public headCollider!: THREE.Mesh;
  public bodyCollider!: THREE.Mesh;

  public get torsoMesh(): THREE.Mesh {
    return this.bodyCollider;
  }
  public get headMesh(): THREE.Mesh {
    return this.headCollider;
  }

  private animTime: number = 0;
  private recoilImpulse: number = 0;
  private isDead: boolean = false;
  private equippedWeaponMeshes: Map<WeaponType, THREE.Group> = new Map();

  private static cachedCharacterGLTF: THREE.Group | null = null;
  private static isLoadingGLTF: boolean = false;
  private static loadWaiters: Array<(gltf: THREE.Group) => void> = [];
  private static debrisList: BrickDebris[] = [];
  private static sceneRef: THREE.Scene | null = null;
  private static readonly debrisGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  private static readonly debrisMaterials = [
    new THREE.MeshStandardMaterial({ color: '#00d2ff', roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#ffbb00', roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#ff2a55', roughness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: '#222233', roughness: 0.3 })
  ];
  private static readonly _axisZ = new THREE.Vector3(0, 0, 1);
  private static readonly _axisX = new THREE.Vector3(1, 0, 0);
  private static readonly _deltaQ = new THREE.Quaternion();
  private static readonly _deltaQ2 = new THREE.Quaternion();

  // Static precomputed combat ready quaternions (zero runtime allocation)
  private static readonly _combatRightArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0.75));
  private static readonly _combatRightForeArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0.2, 0));
  private static readonly _combatLeftArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, -0.65));
  private static readonly _combatLeftForeArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, -0.3, 0));

  private static readonly _katanaRightArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0, 0.5));
  private static readonly _katanaRightForeArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.1, 0));
  private static readonly _katanaLeftArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, -0.2));
  private static readonly _katanaLeftForeArmDelta = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.1, 0));

  constructor(
    scene: THREE.Scene,
    playerId: string,
    playerName: string,
    playerColor: string,
    isLocal: boolean = false,
    outfitIndex: number = 0,
    customization?: CharacterCustomization
  ) {
    CharacterModel.sceneRef = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    this.playerColor = playerColor;
    this.isLocal = isLocal;
    this.outfitIndex = outfitIndex % CHARACTER_PRESETS.length;
    this.customization = customization || presetToCustomization(this.outfitIndex, playerColor);

    this.root = new THREE.Group();
    this.weaponSocket = new THREE.Group();

    // 1. Build precise physics raycasting hitboxes
    this.buildHitboxes();

    // 2. Load and attach the 3D Creative Humanoid character model
    this.loadCharacterMesh();

    // 3. Build overhead nameplate
    if (!isLocal) {
      this.buildNameplate();
    }

    scene.add(this.root);
  }

  private buildHitboxes(): void {
    // Transparent / raycastable materials
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    // Body / Torso Box: Height 0.70m, Width 0.40m, Depth 0.30m (proportional to 0.60 avatar scale)
    const bodyGeo = new THREE.BoxGeometry(0.40, 0.70, 0.30);
    this.bodyCollider = new THREE.Mesh(bodyGeo, hitMat);
    this.bodyCollider.position.set(0, 0.58, 0);
    this.bodyCollider.userData = { playerId: this.playerId, isHeadshot: false };
    this.root.add(this.bodyCollider);

    // Head Sphere: Radius 0.16m, elevated at y = 1.10m
    const headGeo = new THREE.SphereGeometry(0.16, 12, 12);
    this.headCollider = new THREE.Mesh(headGeo, hitMat);
    this.headCollider.position.set(0, 1.10, 0);
    this.headCollider.userData = { playerId: this.playerId, isHeadshot: true };
    this.root.add(this.headCollider);
  }

  private loadCharacterMesh(): void {
    if (CharacterModel.cachedCharacterGLTF) {
      this.attachClonedModel(CharacterModel.cachedCharacterGLTF);
      return;
    }

    if (CharacterModel.isLoadingGLTF) {
      CharacterModel.loadWaiters.push((model) => this.attachClonedModel(model));
      return;
    }

    CharacterModel.isLoadingGLTF = true;
    const loader = new GLTFLoader();
    loader.load(
      '/models/characters/creative_character.glb',
      (gltf) => {
        CharacterModel.cachedCharacterGLTF = gltf.scene;
        CharacterModel.isLoadingGLTF = false;
        this.attachClonedModel(gltf.scene);
        for (const waiter of CharacterModel.loadWaiters) {
          waiter(gltf.scene);
        }
        CharacterModel.loadWaiters = [];
      },
      undefined,
      (err) => {
        console.warn('[CharacterModel] Could not load creative_character.glb, fallback to procedural:', err);
        CharacterModel.isLoadingGLTF = false;
      }
    );
  }

  public applyCustomization(custom: CharacterCustomization): void {
    this.customization = custom;
    if (!this.characterMesh) return;

    const allowed = customizationToMeshNames(custom);
    this.characterMesh.traverse((child: any) => {
      if (child.isMesh) {
        child.visible = allowed.has(child.name);
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: THREE.Material) => {
              m.side = THREE.DoubleSide;
            });
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }
      }
    });
  }

  private attachClonedModel(source: THREE.Group): void {
    const clone = SkeletonUtils.clone(source) as THREE.Group;

    // Scale to compact, proportional tactical avatar: ~1.26m height (2.10 * 0.60 = 1.26m)
    clone.scale.set(0.60, 0.60, 0.60);
    clone.position.set(0, 0, 0);

    // Locate bones
    this.hipsBone = clone.getObjectByName('Hips') || null;
    this.spineBone = clone.getObjectByName('Spine') || null;
    this.headBone = clone.getObjectByName('Head') || null;
    this.leftArmBone = clone.getObjectByName('LeftArm') || null;
    this.leftForeArmBone = clone.getObjectByName('LeftForeArm') || null;
    this.rightArmBone = clone.getObjectByName('RightArm') || null;
    this.rightForeArmBone = clone.getObjectByName('RightForeArm') || null;
    this.leftUpLegBone = clone.getObjectByName('LeftUpLeg') || null;
    this.rightUpLegBone = clone.getObjectByName('RightUpLeg') || null;
    this.leftKneeBone = clone.getObjectByName('LeftLeg') || null;
    this.rightKneeBone = clone.getObjectByName('RightLeg') || null;

    // Cache initial pristine bind-pose transforms for faithful deformation
    if (this.hipsBone) {
      this.initialHipsPos.copy(this.hipsBone.position);
      this.initialBoneRotations.set('Hips', this.hipsBone.quaternion.clone());
    }
    const trackedBones = [
      ['Spine', this.spineBone],
      ['Head', this.headBone],
      ['LeftArm', this.leftArmBone],
      ['LeftForeArm', this.leftForeArmBone],
      ['RightArm', this.rightArmBone],
      ['RightForeArm', this.rightForeArmBone],
      ['LeftUpLeg', this.leftUpLegBone],
      ['RightUpLeg', this.rightUpLegBone],
      ['LeftLeg', this.leftKneeBone],
      ['RightLeg', this.rightKneeBone]
    ] as const;

    for (const [name, bone] of trackedBones) {
      if (bone) {
        this.initialBoneRotations.set(name, bone.quaternion.clone());
      }
    }

    // Set initial combat ready pose on arms
    const isKatana = this.currentWeapon === 'katana';
    const rArmDelta = isKatana ? CharacterModel._katanaRightArmDelta : CharacterModel._combatRightArmDelta;
    const rForeArmDelta = isKatana ? CharacterModel._katanaRightForeArmDelta : CharacterModel._combatRightForeArmDelta;
    const lArmDelta = isKatana ? CharacterModel._katanaLeftArmDelta : CharacterModel._combatLeftArmDelta;
    const lForeArmDelta = isKatana ? CharacterModel._katanaLeftForeArmDelta : CharacterModel._combatLeftForeArmDelta;

    const qLeftArm = this.initialBoneRotations.get('LeftArm');
    if (this.leftArmBone && qLeftArm) {
      this.leftArmBone.quaternion.multiplyQuaternions(qLeftArm, lArmDelta);
    }
    const qLeftForeArm = this.initialBoneRotations.get('LeftForeArm');
    if (this.leftForeArmBone && qLeftForeArm) {
      this.leftForeArmBone.quaternion.multiplyQuaternions(qLeftForeArm, lForeArmDelta);
    }
    const qRightArm = this.initialBoneRotations.get('RightArm');
    if (this.rightArmBone && qRightArm) {
      this.rightArmBone.quaternion.multiplyQuaternions(qRightArm, rArmDelta);
    }
    const qRightForeArm = this.initialBoneRotations.get('RightForeArm');
    if (this.rightForeArmBone && qRightForeArm) {
      this.rightForeArmBone.quaternion.multiplyQuaternions(qRightForeArm, rForeArmDelta);
    }

    // Attach weapon socket to right hand prop
    const handProp = clone.getObjectByName('RightHandProp') || clone.getObjectByName('RightHand');
    if (handProp) {
      this.weaponSocket.position.set(0, 0, 0);
      // Socket rotation so that equipped weapon points forward along character line of sight (+Z)
      this.weaponSocket.quaternion.setFromEuler(new THREE.Euler(-2.28, 0.16, -1.03));
      handProp.add(this.weaponSocket);
    } else {
      this.weaponSocket.position.set(0.3, 0.9, 0.3);
      clone.add(this.weaponSocket);
    }

    this.characterMesh = clone;
    this.root.add(clone);

    // Apply modular outfit pieces
    const activeCustom = this.customization || presetToCustomization(this.outfitIndex, this.playerColor);
    this.applyCustomization(activeCustom);

    // Attach third-person weapon models
    this.setupWeaponsInSocket();
    this.setEquippedWeapon(this.currentWeapon);

    // If local player, hide third-person body so it doesn't block camera
    if (this.isLocal) {
      clone.visible = false;
    }
  }

  private setupWeaponsInSocket(): void {
    for (const t of WEAPON_ORDER) {
      const cached = WeaponManager.cachedWeaponModels.get(t);
      if (cached) {
        const wClone = cached.clone(true);
        wClone.scale.set(0.7, 0.7, 0.7);
        wClone.position.set(0, -0.05, 0.1);
        if (t === 'katana') {
          wClone.rotation.set(Math.PI / 2, 0, 0);
        } else {
          wClone.rotation.set(0, -Math.PI / 2, 0);
        }
        wClone.visible = t === this.currentWeapon;
        this.weaponSocket.add(wClone);
        this.equippedWeaponMeshes.set(t, wClone);
      }
    }
  }

  public setEquippedWeapon(weapon: WeaponType): void {
    this.currentWeapon = weapon;
    for (const [t, mesh] of this.equippedWeaponMeshes.entries()) {
      mesh.visible = t === weapon;
    }
  }

  private buildNameplate(): void {
    this.nameplateGroup = new THREE.Group();
    this.nameplateGroup.position.y = 1.45; // Placed right above compact character head

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Background pill
    ctx.fillStyle = 'rgba(15, 20, 32, 0.75)';
    ctx.roundRect(10, 8, 236, 48, 12);
    ctx.fill();
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 3;
    ctx.roundRect(10, 8, 236, 48, 12);
    ctx.stroke();

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.playerName.slice(0, 12), 128, 26);

    // Mini Health Bar
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(28, 42, 200, 6);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(28, 42, 200, 6);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.4, 0.35, 1.0);

    this.nameplateGroup.add(sprite);
    this.root.add(this.nameplateGroup);
  }

  public updateNameplate(hp: number): void {
    const sprite = this.nameplateGroup?.children[0] as THREE.Sprite;
    if (!sprite || !sprite.material.map) return;

    const canvas = sprite.material.map.image as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(15, 20, 32, 0.75)';
    ctx.roundRect(10, 8, 236, 48, 12);
    ctx.fill();
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 3;
    ctx.roundRect(10, 8, 236, 48, 12);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.playerName.slice(0, 12), 128, 26);

    // HP Fill
    const pct = Math.max(0, Math.min(100, hp)) / 100;
    ctx.fillStyle = '#331111';
    ctx.fillRect(28, 42, 200, 6);
    ctx.fillStyle = pct > 0.4 ? '#00ff88' : '#ff2a55';
    ctx.fillRect(28, 42, 200 * pct, 6);

    sprite.material.map.needsUpdate = true;
  }

  public triggerRecoil(): void {
    this.recoilImpulse = 0.25;
  }

  public update(
    delta: number,
    isMoving: boolean,
    isSliding: boolean,
    isJumping: boolean,
    pitch: number
  ): void {
    if (this.isDead) return;

    const qLeftUpLegInit = this.initialBoneRotations.get('LeftUpLeg');
    const qRightUpLegInit = this.initialBoneRotations.get('RightUpLeg');
    const qLeftKneeInit = this.initialBoneRotations.get('LeftLeg');
    const qRightKneeInit = this.initialBoneRotations.get('RightLeg');
    const qSpineInit = this.initialBoneRotations.get('Spine');
    const qHeadInit = this.initialBoneRotations.get('Head');
    const qLeftArmInit = this.initialBoneRotations.get('LeftArm');
    const qLeftForeArmInit = this.initialBoneRotations.get('LeftForeArm');
    const qRightArmInit = this.initialBoneRotations.get('RightArm');
    const qRightForeArmInit = this.initialBoneRotations.get('RightForeArm');

    // Decay recoil impulse
    if (this.recoilImpulse > 0) {
      this.recoilImpulse = Math.max(0, this.recoilImpulse - delta * 3.5);
    }

    const isKatana = this.currentWeapon === 'katana';
    const rArmDelta = isKatana ? CharacterModel._katanaRightArmDelta : CharacterModel._combatRightArmDelta;
    const rForeArmDelta = isKatana ? CharacterModel._katanaRightForeArmDelta : CharacterModel._combatRightForeArmDelta;
    const lArmDelta = isKatana ? CharacterModel._katanaLeftArmDelta : CharacterModel._combatLeftArmDelta;
    const lForeArmDelta = isKatana ? CharacterModel._katanaLeftForeArmDelta : CharacterModel._combatLeftForeArmDelta;

    // 1. Locomotion / Running leg swing & knee flexion (alternating stride)
    if (isMoving && !isSliding) {
      this.animTime += delta * 11;
      const legAngle = Math.sin(this.animTime) * 0.48;

      // Leg swing: LeftUpLeg & RightUpLeg alternate smoothly
      if (this.leftUpLegBone && qLeftUpLegInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, legAngle);
        this.leftUpLegBone.quaternion.multiplyQuaternions(qLeftUpLegInit, CharacterModel._deltaQ);
      }
      if (this.rightUpLegBone && qRightUpLegInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, legAngle);
        this.rightUpLegBone.quaternion.multiplyQuaternions(qRightUpLegInit, CharacterModel._deltaQ);
      }

      // Knee bend on backswing (flex trailing leg, lift foot)
      const leftKneeAngle = Math.max(0, legAngle) * 0.7;
      const rightKneeAngle = Math.max(0, -legAngle) * 0.7;

      if (this.leftKneeBone && qLeftKneeInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, leftKneeAngle);
        this.leftKneeBone.quaternion.multiplyQuaternions(qLeftKneeInit, CharacterModel._deltaQ);
      }
      if (this.rightKneeBone && qRightKneeInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -rightKneeAngle);
        this.rightKneeBone.quaternion.multiplyQuaternions(qRightKneeInit, CharacterModel._deltaQ);
      }

      // Upper body running lean into movement
      if (this.spineBone && qSpineInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisX, 0.12);
        this.spineBone.quaternion.multiplyQuaternions(qSpineInit, CharacterModel._deltaQ);
      }

      // Arm swing/bob during run
      const armBob = Math.cos(this.animTime) * 0.08;
      if (this.rightArmBone && qRightArmInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, armBob - this.recoilImpulse);
        CharacterModel._deltaQ2.multiplyQuaternions(rArmDelta, CharacterModel._deltaQ);
        this.rightArmBone.quaternion.multiplyQuaternions(qRightArmInit, CharacterModel._deltaQ2);
      }
      if (this.rightForeArmBone && qRightForeArmInit) {
        this.rightForeArmBone.quaternion.multiplyQuaternions(qRightForeArmInit, rForeArmDelta);
      }
      if (this.leftArmBone && qLeftArmInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -armBob);
        CharacterModel._deltaQ2.multiplyQuaternions(lArmDelta, CharacterModel._deltaQ);
        this.leftArmBone.quaternion.multiplyQuaternions(qLeftArmInit, CharacterModel._deltaQ2);
      }
      if (this.leftForeArmBone && qLeftForeArmInit) {
        this.leftForeArmBone.quaternion.multiplyQuaternions(qLeftForeArmInit, lForeArmDelta);
      }

    } else if (isJumping) {
      // 2. Jumping Posture (bilateral knee tuck)
      if (this.leftUpLegBone && qLeftUpLegInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, 0.22);
        this.leftUpLegBone.quaternion.multiplyQuaternions(qLeftUpLegInit, CharacterModel._deltaQ);
      }
      if (this.rightUpLegBone && qRightUpLegInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -0.22);
        this.rightUpLegBone.quaternion.multiplyQuaternions(qRightUpLegInit, CharacterModel._deltaQ);
      }
      if (this.leftKneeBone && qLeftKneeInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, 0.35);
        this.leftKneeBone.quaternion.multiplyQuaternions(qLeftKneeInit, CharacterModel._deltaQ);
      }
      if (this.rightKneeBone && qRightKneeInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -0.35);
        this.rightKneeBone.quaternion.multiplyQuaternions(qRightKneeInit, CharacterModel._deltaQ);
      }

      // Arm stability during jump
      if (this.rightArmBone && qRightArmInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -this.recoilImpulse);
        CharacterModel._deltaQ2.multiplyQuaternions(rArmDelta, CharacterModel._deltaQ);
        this.rightArmBone.quaternion.multiplyQuaternions(qRightArmInit, CharacterModel._deltaQ2);
      }
      if (this.rightForeArmBone && qRightForeArmInit) {
        this.rightForeArmBone.quaternion.multiplyQuaternions(qRightForeArmInit, rForeArmDelta);
      }
      if (this.leftArmBone && qLeftArmInit) {
        this.leftArmBone.quaternion.multiplyQuaternions(qLeftArmInit, lArmDelta);
      }
      if (this.leftForeArmBone && qLeftForeArmInit) {
        this.leftForeArmBone.quaternion.multiplyQuaternions(qLeftForeArmInit, lForeArmDelta);
      }

    } else if (isSliding) {
      // 3. Sliding Posture (hips drop, lead leg extends, trailing leg tucks)
      if (this.hipsBone) {
        this.hipsBone.position.y = this.initialHipsPos.y - 0.35;
      }
      if (this.spineBone && qSpineInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisX, 0.35);
        this.spineBone.quaternion.multiplyQuaternions(qSpineInit, CharacterModel._deltaQ);
      }
      if (this.leftUpLegBone && qLeftUpLegInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, 0.38);
        this.leftUpLegBone.quaternion.multiplyQuaternions(qLeftUpLegInit, CharacterModel._deltaQ);
      }
      if (this.leftKneeBone && qLeftKneeInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, 0.45);
        this.leftKneeBone.quaternion.multiplyQuaternions(qLeftKneeInit, CharacterModel._deltaQ);
      }
      if (this.rightUpLegBone && qRightUpLegInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -0.42);
        this.rightUpLegBone.quaternion.multiplyQuaternions(qRightUpLegInit, CharacterModel._deltaQ);
      }
      if (this.rightKneeBone && qRightKneeInit) {
        this.rightKneeBone.quaternion.slerp(qRightKneeInit, Math.min(1, delta * 12));
      }

      // Arms in combat stance during slide
      if (this.rightArmBone && qRightArmInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -this.recoilImpulse);
        CharacterModel._deltaQ2.multiplyQuaternions(rArmDelta, CharacterModel._deltaQ);
        this.rightArmBone.quaternion.multiplyQuaternions(qRightArmInit, CharacterModel._deltaQ2);
      }
      if (this.rightForeArmBone && qRightForeArmInit) {
        this.rightForeArmBone.quaternion.multiplyQuaternions(qRightForeArmInit, rForeArmDelta);
      }
      if (this.leftArmBone && qLeftArmInit) {
        this.leftArmBone.quaternion.multiplyQuaternions(qLeftArmInit, lArmDelta);
      }
      if (this.leftForeArmBone && qLeftForeArmInit) {
        this.leftForeArmBone.quaternion.multiplyQuaternions(qLeftForeArmInit, lForeArmDelta);
      }

    } else {
      // 4. Idle Stance (subtle breathing cycle & combat ready pose)
      this.animTime += delta * 2.2;
      const breath = Math.sin(this.animTime) * 0.015;

      if (this.hipsBone) {
        this.hipsBone.position.y = this.initialHipsPos.y + breath * 0.005;
      }

      // Legs recover to rest pose
      if (this.leftUpLegBone && qLeftUpLegInit) {
        this.leftUpLegBone.quaternion.slerp(qLeftUpLegInit, Math.min(1, delta * 12));
      }
      if (this.rightUpLegBone && qRightUpLegInit) {
        this.rightUpLegBone.quaternion.slerp(qRightUpLegInit, Math.min(1, delta * 12));
      }
      if (this.leftKneeBone && qLeftKneeInit) {
        this.leftKneeBone.quaternion.slerp(qLeftKneeInit, Math.min(1, delta * 12));
      }
      if (this.rightKneeBone && qRightKneeInit) {
        this.rightKneeBone.quaternion.slerp(qRightKneeInit, Math.min(1, delta * 12));
      }

      // Subtle chest breathing & pitch tracking
      const clampedPitch = THREE.MathUtils.clamp(-pitch, -0.6, 0.6);
      if (this.spineBone && qSpineInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisX, breath + clampedPitch * 0.3);
        this.spineBone.quaternion.multiplyQuaternions(qSpineInit, CharacterModel._deltaQ);
      }

      // Arms in combat ready stance with subtle breathing sway & recoil
      if (this.rightArmBone && qRightArmInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, breath * 0.5 - this.recoilImpulse);
        CharacterModel._deltaQ2.multiplyQuaternions(rArmDelta, CharacterModel._deltaQ);
        this.rightArmBone.quaternion.multiplyQuaternions(qRightArmInit, CharacterModel._deltaQ2);
      }
      if (this.rightForeArmBone && qRightForeArmInit) {
        this.rightForeArmBone.quaternion.multiplyQuaternions(qRightForeArmInit, rForeArmDelta);
      }
      if (this.leftArmBone && qLeftArmInit) {
        CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisZ, -breath * 0.5);
        CharacterModel._deltaQ2.multiplyQuaternions(lArmDelta, CharacterModel._deltaQ);
        this.leftArmBone.quaternion.multiplyQuaternions(qLeftArmInit, CharacterModel._deltaQ2);
      }
      if (this.leftForeArmBone && qLeftForeArmInit) {
        this.leftForeArmBone.quaternion.multiplyQuaternions(qLeftForeArmInit, lForeArmDelta);
      }
    }

    // 5. Head Pitch Tracking
    if (this.headBone && qHeadInit) {
      const clampedPitch = THREE.MathUtils.clamp(-pitch, -0.6, 0.6);
      CharacterModel._deltaQ.setFromAxisAngle(CharacterModel._axisX, clampedPitch * 0.7);
      this.headBone.quaternion.multiplyQuaternions(qHeadInit, CharacterModel._deltaQ);
    }
  }

  public shatterIntoBricks(): void {
    if (this.isDead) return;
    this.isDead = true;

    if (this.characterMesh) {
      this.characterMesh.visible = false;
    }
    if (this.nameplateGroup) {
      this.nameplateGroup.visible = false;
    }

    // Spawn celebratory brick debris using shared geometry and materials
    for (let i = 0; i < 12; i++) {
      const mat = CharacterModel.debrisMaterials[i % CharacterModel.debrisMaterials.length];
      const brick = new THREE.Mesh(CharacterModel.debrisGeometry, mat);

      brick.position.copy(this.root.position);
      brick.position.y += 0.5 + Math.random() * 0.8;
      brick.position.x += (Math.random() - 0.5) * 0.4;
      brick.position.z += (Math.random() - 0.5) * 0.4;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 3.5;

      CharacterModel.sceneRef?.add(brick);
      CharacterModel.debrisList.push({
        mesh: brick,
        vx: Math.cos(angle) * speed,
        vy: 3.5 + Math.random() * 2.5,
        vz: Math.sin(angle) * speed,
        rx: (Math.random() - 0.5) * 12,
        ry: (Math.random() - 0.5) * 12,
        rz: (Math.random() - 0.5) * 12,
        life: 2.2
      });
    }
  }

  public respawn(x: number, y: number, z: number, yaw: number): void {
    this.isDead = false;
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;

    if (this.characterMesh && !this.isLocal) {
      this.characterMesh.visible = true;
    }
    if (this.nameplateGroup && !this.isLocal) {
      this.nameplateGroup.visible = true;
      this.updateNameplate(100);
    }
  }

  public static updateDebris(delta: number): void {
    CharacterModel.updateAllDebris(delta);
  }

  public static updateAllDebris(delta: number): void {
    for (let i = CharacterModel.debrisList.length - 1; i >= 0; i--) {
      const d = CharacterModel.debrisList[i];
      d.vy -= 18 * delta; // Gravity
      d.mesh.position.x += d.vx * delta;
      d.mesh.position.y += d.vy * delta;
      d.mesh.position.z += d.vz * delta;

      d.mesh.rotation.x += d.rx * delta;
      d.mesh.rotation.y += d.ry * delta;
      d.mesh.rotation.z += d.rz * delta;

      // Ground bounce
      if (d.mesh.position.y < 0.1) {
        d.mesh.position.y = 0.1;
        d.vy = -d.vy * 0.4;
        d.vx *= 0.8;
        d.vz *= 0.8;
      }

      d.life -= delta;
      if (d.life <= 0) {
        CharacterModel.sceneRef?.remove(d.mesh);
        CharacterModel.debrisList.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
