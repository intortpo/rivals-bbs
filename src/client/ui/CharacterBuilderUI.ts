import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CharacterCustomization } from '../../shared/types.js';
import {
  DEFAULT_CUSTOMIZATION,
  MODULAR_CATALOG,
  customizationToMeshNames,
  ModularItemOption
} from '../engine/CharacterModel.js';

export class CharacterBuilderUI {
  private container: HTMLElement;
  private modalEl!: HTMLElement;
  private canvasContainer!: HTMLElement;
  private onSaveCb?: (custom: CharacterCustomization) => void;

  // Active customization state
  public currentCustomization: CharacterCustomization;

  // Three.js 3D Turntable Preview
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer | null;
  private previewMesh: THREE.Group | null = null;
  private animFrameId: number | null = null;
  private clock = new THREE.Clock();

  // Turntable interaction controls
  private isPointerDown: boolean = false;
  private lastPointerX: number = 0;
  private targetYaw: number = 0;
  private currentYaw: number = 0;
  private zoomDistance: number = 2.4;

  // Active Category Tab
  private activeTab: 'head' | 'top' | 'bottom' | 'face' | 'colors' = 'head';

  constructor(container: HTMLElement, onSave?: (custom: CharacterCustomization) => void) {
    this.container = container;
    this.onSaveCb = onSave;

    // Load saved customization from localStorage or fallback to default
    const saved = localStorage.getItem('bbs_character_customization');
    if (saved) {
      try {
        this.currentCustomization = JSON.parse(saved);
      } catch {
        this.currentCustomization = { ...DEFAULT_CUSTOMIZATION };
      }
    } else {
      this.currentCustomization = { ...DEFAULT_CUSTOMIZATION };
    }

    this.buildUI();
  }

  public open(custom?: CharacterCustomization): void {
    if (custom) {
      this.currentCustomization = { ...custom };
    }
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.modalEl.style.display = 'flex';
    this.initTurntable();
    this.renderCategoryOptions();
    this.updatePreviewOutfit();
  }

  public close(): void {
    this.modalEl.style.display = 'none';
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private buildUI(): void {
    this.modalEl = document.createElement('div');
    this.modalEl.id = 'character-builder-modal';
    this.modalEl.className = 'modal-backdrop';
    this.modalEl.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(8, 12, 22, 0.88);
      backdrop-filter: blur(12px);
      z-index: 5000;
      justify-content: center;
      align-items: center;
      padding: 16px;
      box-sizing: border-box;
      pointer-events: auto !important;
      cursor: default;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    `;

    this.modalEl.innerHTML = `
      <div class="builder-dialog" style="
        display: flex;
        flex-direction: row;
        width: 100%;
        max-width: 960px;
        height: 90vh;
        max-height: 640px;
        background: linear-gradient(135deg, rgba(16, 22, 38, 0.95), rgba(10, 14, 26, 0.98));
        border: 1px solid rgba(0, 210, 255, 0.4);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 210, 255, 0.2);
        border-radius: 20px;
        overflow: hidden;
      ">
        <!-- Left: 3D Turntable Viewport -->
        <div style="flex: 1.1; display: flex; flex-direction: column; position: relative; border-right: 1px solid rgba(255, 255, 255, 0.08); background: radial-gradient(circle at 50% 60%, #151e33 0%, #090c16 80%);">
          <!-- Viewport Header -->
          <div style="position: absolute; top: 16px; left: 20px; z-index: 10; pointer-events: none;">
            <div style="font-size: 11px; font-weight: 800; color: #00d2ff; letter-spacing: 1.5px; text-transform: uppercase;">3D PILOT STUDIO</div>
            <div style="font-size: 18px; font-weight: 900; color: #ffffff;">Customize Avatar</div>
          </div>

          <!-- 3D Canvas Mount Point -->
          <div id="builder-canvas-container" style="width: 100%; height: 100%; cursor: grab;"></div>

          <!-- Turntable Drag Hint -->
          <div style="position: absolute; bottom: 16px; left: 0; width: 100%; text-align: center; pointer-events: none; color: #64748b; font-size: 11px; font-weight: 600;">
            🖱️ Drag to rotate 360° • Scroll / Pinch to zoom
          </div>
        </div>

        <!-- Right: Customizer Controls Panel -->
        <div style="flex: 1.2; display: flex; flex-direction: column; padding: 20px 24px; box-sizing: border-box; overflow: hidden; background: rgba(12, 16, 28, 0.92);">
          <!-- Top Row: Close button -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; gap: 8px;">
              <button id="btn-builder-randomize" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; background: rgba(0, 210, 255, 0.1); border-color: rgba(0, 210, 255, 0.4); color: #00d2ff; border-radius: 8px; cursor: pointer;">
                🎲 Randomize
              </button>
            </div>
            <button id="btn-builder-close" style="background: transparent; border: none; color: #8da2c0; font-size: 22px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: color 0.15s;">
              ✕
            </button>
          </div>

          <!-- Category Navigation Tabs -->
          <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 16px;">
            <button class="builder-tab-btn active" data-tab="head" style="flex: 1; min-width: 64px; padding: 8px 4px; font-size: 11px; font-weight: 700; border-radius: 8px; border: 1px solid rgba(0, 210, 255, 0.4); background: rgba(0, 210, 255, 0.15); color: #00d2ff; cursor: pointer; text-align: center;">🧢 Head</button>
            <button class="builder-tab-btn" data-tab="top" style="flex: 1; min-width: 64px; padding: 8px 4px; font-size: 11px; font-weight: 700; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.04); color: #8da2c0; cursor: pointer; text-align: center;">👕 Tops</button>
            <button class="builder-tab-btn" data-tab="bottom" style="flex: 1; min-width: 64px; padding: 8px 4px; font-size: 11px; font-weight: 700; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.04); color: #8da2c0; cursor: pointer; text-align: center;">👖 Legs</button>
            <button class="builder-tab-btn" data-tab="face" style="flex: 1; min-width: 64px; padding: 8px 4px; font-size: 11px; font-weight: 700; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.04); color: #8da2c0; cursor: pointer; text-align: center;">👓 Face</button>
            <button class="builder-tab-btn" data-tab="colors" style="flex: 1; min-width: 64px; padding: 8px 4px; font-size: 11px; font-weight: 700; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.04); color: #8da2c0; cursor: pointer; text-align: center;">🎨 Colors</button>
          </div>

          <!-- Options Grid Body (Scrollable) -->
          <div id="builder-options-container" style="flex: 1; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 14px;">
            <!-- Rendered dynamically -->
          </div>

          <!-- Bottom Footer Action Bar -->
          <div style="display: flex; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
            <button id="btn-builder-save" class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 14px; font-weight: 800; background: linear-gradient(135deg, #00d2ff, #0077ff); color: #040914; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 16px rgba(0, 210, 255, 0.4);">
              💾 Save & Equip
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.modalEl);
    this.canvasContainer = this.modalEl.querySelector('#builder-canvas-container') as HTMLElement;

    // Attach Event Handlers
    this.modalEl.querySelector('#btn-builder-close')?.addEventListener('click', () => this.close());
    this.modalEl.querySelector('#btn-builder-randomize')?.addEventListener('click', () => this.randomizeOutfit());
    this.modalEl.querySelector('#btn-builder-save')?.addEventListener('click', () => this.saveAndEquip());

    // Tab buttons
    const tabBtns = this.modalEl.querySelectorAll('.builder-tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as any;
        this.switchTab(tab);
      });
    });

    // Turntable pointer drag listeners
    this.setupTurntableControls();
  }

  private switchTab(tab: 'head' | 'top' | 'bottom' | 'face' | 'colors'): void {
    this.activeTab = tab;
    const tabBtns = this.modalEl.querySelectorAll('.builder-tab-btn');
    tabBtns.forEach((btn) => {
      const b = btn as HTMLElement;
      const isActive = b.dataset.tab === tab;
      b.style.borderColor = isActive ? 'rgba(0, 210, 255, 0.4)' : 'transparent';
      b.style.background = isActive ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      b.style.color = isActive ? '#00d2ff' : '#8da2c0';
    });
    this.renderCategoryOptions();
  }

  private renderCategoryOptions(): void {
    const container = this.modalEl.querySelector('#builder-options-container') as HTMLElement;
    if (!container) return;
    container.innerHTML = '';

    if (this.activeTab === 'head') {
      // 1. Headwear Subgroup
      this.renderOptionGroup(container, '🧢 Headwear', 'headwear', (item) => {
        this.currentCustomization.headwear = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.headwear === item.id);

      // 2. Hairstyle Subgroup
      this.renderOptionGroup(container, '💇 Hairstyles', 'hair', (item) => {
        this.currentCustomization.hair = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.hair === item.id);
    } else if (this.activeTab === 'top') {
      this.renderOptionGroup(container, '👕 Tops & Outerwear', 'top', (item) => {
        this.currentCustomization.top = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.top === item.id);

      this.renderOptionGroup(container, '🧤 Tactical Gloves', 'gloves', (item) => {
        this.currentCustomization.gloves = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.gloves === item.id);
    } else if (this.activeTab === 'bottom') {
      this.renderOptionGroup(container, '👖 Pants & Shorts', 'bottom', (item) => {
        this.currentCustomization.bottom = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.bottom === item.id);

      this.renderOptionGroup(container, '👟 Footwear', 'shoes', (item) => {
        this.currentCustomization.shoes = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.shoes === item.id);

      // Socks toggle tile
      const sockGroup = document.createElement('div');
      sockGroup.innerHTML = `
        <label style="font-size: 12px; font-weight: 800; color: #8da2c0; display: block; margin-bottom: 8px;">🧦 Athletic Socks</label>
        <div style="display: flex; gap: 8px;">
          <div class="builder-option-card ${this.currentCustomization.socks ? 'selected' : ''}" id="sock-toggle-btn" style="
            display: flex; align-items: center; gap: 8px; padding: 10px 14px;
            background: ${this.currentCustomization.socks ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)'};
            border: 1px solid ${this.currentCustomization.socks ? '#00d2ff' : 'rgba(255, 255, 255, 0.08)'};
            border-radius: 10px; cursor: pointer;
          ">
            <span style="font-size: 18px;">🧦</span>
            <span style="font-size: 12px; font-weight: 700; color: ${this.currentCustomization.socks ? '#00d2ff' : '#cbd5e1'};">High Tube Socks</span>
          </div>
        </div>
      `;
      sockGroup.querySelector('#sock-toggle-btn')?.addEventListener('click', () => {
        this.currentCustomization.socks = !this.currentCustomization.socks;
        this.renderCategoryOptions();
        this.updatePreviewOutfit();
      });
      container.appendChild(sockGroup);
    } else if (this.activeTab === 'face') {
      this.renderOptionGroup(container, '😐 Facial Expression', 'face', (item) => {
        this.currentCustomization.face = item.id;
        this.updatePreviewOutfit();
      }, (item) => this.currentCustomization.face === item.id);

      // Accessories
      const accItems = MODULAR_CATALOG.filter((i) => i.category === 'accessories');
      const accGroup = document.createElement('div');
      accGroup.innerHTML = `
        <label style="font-size: 12px; font-weight: 800; color: #8da2c0; display: block; margin-bottom: 8px;">🕶️ Glasses & Face Accessories</label>
        <div class="builder-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px;"></div>
      `;
      const grid = accGroup.querySelector('.builder-cards-grid') as HTMLElement;

      accItems.forEach((item) => {
        const isSelected = item.id === 'none'
          ? (this.currentCustomization.eyewear === 'none' && this.currentCustomization.accessories.length === 0)
          : (this.currentCustomization.eyewear === item.id || this.currentCustomization.accessories.includes(item.id));

        const card = document.createElement('div');
        card.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px 8px;
          background: ${isSelected ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)'};
          border: 1px solid ${isSelected ? '#00d2ff' : 'rgba(255, 255, 255, 0.08)'};
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        `;
        card.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 4px;">${item.icon}</div>
          <div style="font-size: 11px; font-weight: 700; color: ${isSelected ? '#00d2ff' : '#cbd5e1'}; text-align: center;">${item.name}</div>
        `;
        card.addEventListener('click', () => {
          if (item.id === 'none') {
            this.currentCustomization.eyewear = 'none';
            this.currentCustomization.accessories = [];
          } else if (item.id === 'Glasses_004' || item.id === 'Glasses_006') {
            this.currentCustomization.eyewear = this.currentCustomization.eyewear === item.id ? 'none' : item.id;
          } else {
            // Toggle in accessories array
            const idx = this.currentCustomization.accessories.indexOf(item.id);
            if (idx >= 0) {
              this.currentCustomization.accessories.splice(idx, 1);
            } else {
              this.currentCustomization.accessories.push(item.id);
            }
          }
          this.renderCategoryOptions();
          this.updatePreviewOutfit();
        });
        grid.appendChild(card);
      });
      container.appendChild(accGroup);
    } else if (this.activeTab === 'colors') {
      const palette = [
        { name: 'Cyber Cyan', color: '#00d2ff' },
        { name: 'Crimson Strike', color: '#ff2a55' },
        { name: 'Neon Emerald', color: '#00ff88' },
        { name: 'Electric Amber', color: '#ffaa00' },
        { name: 'Royal Purple', color: '#b537f2' },
        { name: 'Stealth Slate', color: '#64748b' }
      ];

      const colorGroup = document.createElement('div');
      colorGroup.innerHTML = `
        <label style="font-size: 12px; font-weight: 800; color: #8da2c0; display: block; margin-bottom: 8px;">🎨 Accent & Highlights</label>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px;">
          ${palette.map((p) => {
            const isSelected = this.currentCustomization.accentColor === p.color;
            return `
              <div class="color-select-card" data-color="${p.color}" style="
                display: flex; align-items: center; gap: 10px; padding: 10px 12px;
                background: ${isSelected ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)'};
                border: 1px solid ${isSelected ? '#00d2ff' : 'rgba(255, 255, 255, 0.08)'};
                border-radius: 10px; cursor: pointer;
              ">
                <div style="width: 20px; height: 20px; border-radius: 50%; background: ${p.color}; box-shadow: 0 0 10px ${p.color};"></div>
                <div style="font-size: 11px; font-weight: 700; color: ${isSelected ? '#00d2ff' : '#cbd5e1'};">${p.name}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      colorGroup.querySelectorAll('.color-select-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          const hex = (e.currentTarget as HTMLElement).dataset.color || '#00d2ff';
          this.currentCustomization.accentColor = hex;
          this.renderCategoryOptions();
          this.updatePreviewOutfit();
        });
      });

      container.appendChild(colorGroup);
    }
  }

  private renderOptionGroup(
    container: HTMLElement,
    title: string,
    category: ModularItemOption['category'],
    onSelect: (item: ModularItemOption) => void,
    isSelectedCheck: (item: ModularItemOption) => boolean
  ): void {
    const items = MODULAR_CATALOG.filter((i) => i.category === category);
    const group = document.createElement('div');
    group.innerHTML = `
      <label style="font-size: 12px; font-weight: 800; color: #8da2c0; display: block; margin-bottom: 8px;">${title}</label>
      <div class="builder-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px;"></div>
    `;
    const grid = group.querySelector('.builder-cards-grid') as HTMLElement;

    items.forEach((item) => {
      const isSelected = isSelectedCheck(item);
      const card = document.createElement('div');
      card.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 10px 8px;
        background: ${isSelected ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)'};
        border: 1px solid ${isSelected ? '#00d2ff' : 'rgba(255, 255, 255, 0.08)'};
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      card.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 4px;">${item.icon}</div>
        <div style="font-size: 11px; font-weight: 700; color: ${isSelected ? '#00d2ff' : '#cbd5e1'}; text-align: center;">${item.name}</div>
      `;
      card.addEventListener('click', () => {
        onSelect(item);
        this.renderCategoryOptions();
      });
      grid.appendChild(card);
    });

    container.appendChild(group);
  }

  private randomizeOutfit(): void {
    const randItem = (cat: ModularItemOption['category']) => {
      const list = MODULAR_CATALOG.filter((i) => i.category === cat);
      return list[Math.floor(Math.random() * list.length)].id;
    };

    const colors = ['#00d2ff', '#ff2a55', '#00ff88', '#ffaa00', '#b537f2', '#64748b'];

    this.currentCustomization = {
      face: randItem('face'),
      hair: Math.random() > 0.3 ? randItem('hair') : 'none',
      headwear: Math.random() > 0.4 ? randItem('headwear') : 'none',
      eyewear: Math.random() > 0.5 ? (Math.random() > 0.5 ? 'Glasses_004' : 'Glasses_006') : 'none',
      accessories: Math.random() > 0.5 ? ['Headphones_002'] : [],
      top: randItem('top'),
      bottom: randItem('bottom'),
      shoes: randItem('shoes'),
      socks: Math.random() > 0.5,
      gloves: Math.random() > 0.5 ? randItem('gloves') : 'none',
      accentColor: colors[Math.floor(Math.random() * colors.length)]
    };

    this.renderCategoryOptions();
    this.updatePreviewOutfit();
  }

  private saveAndEquip(): void {
    localStorage.setItem('bbs_character_customization', JSON.stringify(this.currentCustomization));
    if (this.onSaveCb) {
      this.onSaveCb(this.currentCustomization);
    }
    this.close();
  }

  // --- 3D Turntable Scene & Interaction ---

  private initTurntable(): void {
    if (this.renderer) return;

    const width = this.canvasContainer.clientWidth || 420;
    const height = this.canvasContainer.clientHeight || 560;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0, 0.68, this.zoomDistance * 0.75);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasContainer.appendChild(this.renderer.domElement);

    // Studio Lighting
    const hemiLight = new THREE.HemisphereLight('#b1e1ff', '#1a1f33', 1.0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffffff', 1.8);
    keyLight.position.set(3, 4, 3);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#00d2ff', 1.2);
    rimLight.position.set(-3, 2, -2);
    this.scene.add(rimLight);

    // Glowing Pedestal
    const pedGeo = new THREE.CylinderGeometry(0.60, 0.68, 0.06, 32);
    const pedMat = new THREE.MeshStandardMaterial({
      color: '#151c2e',
      roughness: 0.3,
      metalness: 0.2
    });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = -0.03;
    pedestal.receiveShadow = true;
    this.scene.add(pedestal);

    const ringGeo = new THREE.RingGeometry(0.58, 0.61, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#00d2ff', side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    this.scene.add(ring);

    // Load Character Model for Turntable
    const loader = new GLTFLoader();
    loader.load('/models/characters/creative_character.glb', (gltf) => {
      const clone = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      clone.scale.set(0.60, 0.60, 0.60);
      clone.position.set(0, 0, 0);

      // Relax arms into tactical combat stance
      const leftArm = clone.getObjectByName('LeftArm');
      if (leftArm) {
        leftArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.2, Math.PI * 0.35)));
      }
      const rightArm = clone.getObjectByName('RightArm');
      if (rightArm) {
        rightArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.2, -Math.PI * 0.35)));
      }

      this.previewMesh = clone;
      this.scene.add(clone);
      this.updatePreviewOutfit();
    });

    this.startTurntableLoop();
  }

  private updatePreviewOutfit(): void {
    if (!this.previewMesh) return;

    const allowed = customizationToMeshNames(this.currentCustomization);
    this.previewMesh.traverse((child: any) => {
      if (child.isMesh) {
        child.visible = allowed.has(child.name);
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: THREE.Material) => { m.side = THREE.DoubleSide; });
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }
      }
    });
  }

  private setupTurntableControls(): void {
    const el = this.canvasContainer;

    el.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      el.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;
      this.targetYaw += dx * 0.015;
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
      if (el) el.style.cursor = 'grab';
    });

    // Zoom via wheel
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance + e.deltaY * 0.002, 1.4, 3.4);
      if (this.camera) {
        this.camera.position.z = this.zoomDistance;
      }
    }, { passive: false });
  }

  private startTurntableLoop(): void {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);

      // Smooth turntable damping
      this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, this.targetYaw, 0.12);

      if (this.previewMesh) {
        this.previewMesh.rotation.y = this.currentYaw;

        // Subtle idle breathing animation
        const time = this.clock.getElapsedTime();
        this.previewMesh.position.y = Math.sin(time * 2.2) * 0.012;
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }
}
