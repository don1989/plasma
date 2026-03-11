import * as THREE from 'three';
import { GameEngine } from './core/GameEngine.ts';
import { InputManager } from './core/InputManager.ts';
import { Environment } from './world/Environment.ts';
import { PlayerController } from './player/PlayerController.ts';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const input = new InputManager(renderer.domElement);
const environment = new Environment(scene);
const player = new PlayerController(scene, camera, input);

const engine = new GameEngine(renderer, scene, camera);
engine.register(environment);
engine.register(player);
engine.start();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
