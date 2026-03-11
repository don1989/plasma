import * as THREE from 'three';

interface CelMaterialOptions {
  color?: THREE.ColorRepresentation;
  steps?: number;
}

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform float uSteps;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightDir);

    float NdotL = dot(normal, lightDir);
    float intensity = (NdotL * 0.5 + 0.5);        // remap to 0..1
    intensity = floor(intensity * uSteps) / uSteps; // quantize

    // Ambient + diffuse
    vec3 ambient = uColor * 0.3;
    vec3 diffuse = uColor * intensity * 0.7;

    gl_FragColor = vec4(ambient + diffuse, 1.0);
  }
`;

export function createCelMaterial(options: CelMaterialOptions = {}): THREE.ShaderMaterial {
  const color = new THREE.Color(options.color ?? 0xffffff);
  const steps = options.steps ?? 3;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: color },
      uLightDir: { value: new THREE.Vector3(0.5, 1.0, 0.3).normalize() },
      uSteps: { value: steps },
    },
  });
}
