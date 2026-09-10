import * as THREE from 'three';
import type { AnimationManifestEntry, CharacterManifest } from '../engine/AssetLoader.js';

export type AnimationState = 'idle' | 'walk' | 'run' | 'sprint';

const CROSSFADE_DURATION = 0.2;

export class AnimationFSM {
  private mixer: THREE.AnimationMixer;
  private actions: Map<AnimationState, THREE.AnimationAction> = new Map();
  private currentState: AnimationState = 'idle';
  private manifest: CharacterManifest;

  constructor(
    mixer: THREE.AnimationMixer,
    clips: Map<string, THREE.AnimationClip>,
    manifest: CharacterManifest,
  ) {
    this.mixer = mixer;
    this.manifest = manifest;

    // Create actions from clips
    for (const [key, clip] of clips) {
      const state = key as AnimationState;
      const entry = manifest.animations[key] as AnimationManifestEntry | undefined;
      if (!entry) continue;

      const action = mixer.clipAction(clip);
      action.loop = entry.loop ? THREE.LoopRepeat : THREE.LoopOnce;
      if (!entry.loop) action.clampWhenFinished = true;
      this.actions.set(state, action);
    }

    // Start idle
    const idleAction = this.actions.get('idle');
    if (idleAction) {
      idleAction.play();
    }
  }

  get state(): AnimationState {
    return this.currentState;
  }

  /**
   * Transition to a new animation state based on speed magnitude.
   * speed: 0 = idle, 0-2 = walk, 2-4 = run, 4+ = sprint
   */
  updateFromSpeed(speed: number): void {
    let targetState: AnimationState;

    if (speed < 0.1) {
      targetState = 'idle';
    } else if (speed < 2.0) {
      targetState = 'walk';
    } else if (speed < 4.0) {
      targetState = 'run';
    } else {
      targetState = 'sprint';
    }

    // Fall back to available states
    if (!this.actions.has(targetState)) {
      if (targetState === 'sprint' && this.actions.has('run')) targetState = 'run';
      else if (targetState === 'run' && this.actions.has('walk')) targetState = 'walk';
      else if (!this.actions.has(targetState)) targetState = 'idle';
    }

    if (targetState !== this.currentState) {
      this.transitionTo(targetState);
    }
  }

  private transitionTo(newState: AnimationState): void {
    const currentAction = this.actions.get(this.currentState);
    const nextAction = this.actions.get(newState);

    if (!nextAction) return;

    if (currentAction) {
      currentAction.fadeOut(CROSSFADE_DURATION);
    }

    nextAction.reset().fadeIn(CROSSFADE_DURATION).play();
    this.currentState = newState;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }
}
