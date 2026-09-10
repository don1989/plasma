import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface AnimationManifestEntry {
  clip: string;
  loop: boolean;
  duration: number;
  speed?: number;
}

export interface CharacterManifest {
  id: string;
  model: string;
  animations: Record<string, AnimationManifestEntry>;
  scale: number;
  groundOffset: number;
}

export interface LoadedCharacter {
  group: THREE.Group;
  clips: Map<string, THREE.AnimationClip>;
  manifest: CharacterManifest;
}

export class AssetLoader {
  private gltfLoader: GLTFLoader;
  private loadingManager: THREE.LoadingManager;

  constructor() {
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onStart = (_url, loaded, total) =>
      console.log(`Loading: ${loaded}/${total}`);
    this.loadingManager.onLoad = () => console.log('All assets loaded');
    this.loadingManager.onError = (url) => console.error(`Failed to load: ${url}`);

    this.gltfLoader = new GLTFLoader(this.loadingManager);

    // DRACO decoder for compressed GLB
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  async loadManifest(path: string): Promise<CharacterManifest> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load manifest: ${path}`);
    return response.json() as Promise<CharacterManifest>;
  }

  async loadCharacter(manifestPath: string): Promise<LoadedCharacter> {
    const manifest = await this.loadManifest(manifestPath);

    // Resolve model path relative to manifest
    const basePath = manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1);
    const modelPath = basePath + manifest.model;

    const gltf = await this.loadGLTF(modelPath);

    // Extract the scene group
    const group = gltf.scene;
    group.scale.setScalar(manifest.scale);
    group.position.y = manifest.groundOffset;

    // Enable shadows on all meshes
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Map animation clips by manifest key
    const clips = new Map<string, THREE.AnimationClip>();
    for (const [key, entry] of Object.entries(manifest.animations)) {
      const clip = gltf.animations.find((a) => a.name === entry.clip);
      if (clip) {
        clips.set(key, clip);
      } else {
        console.warn(
          `Animation clip "${entry.clip}" not found for key "${key}". Available: ${gltf.animations.map((a) => a.name).join(', ')}`,
        );
      }
    }

    return { group, clips, manifest };
  }

  private loadGLTF(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(path, resolve, undefined, reject);
    });
  }
}
