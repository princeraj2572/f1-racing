import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MathUtils,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Scene } from 'three';
import type { SkyMood } from '../sky';
import type { Quality } from './world';

const SUN_AZIMUTH = MathUtils.degToRad(25);

const rgb = (c: readonly [number, number, number]): Color =>
  new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace);

export interface Lighting {
  /** Applies a mood and keeps the sun and its shadow box on `focus`. */
  update(mood: SkyMood, focus: Vector3, cameraHeight: number): void;
  sun: DirectionalLight;
  dispose(): void;
}

export function createLighting(scene: Scene, quality: Quality): Lighting {
  const skyMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new Color() }, horizon: { value: new Color() } },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying float vHeight;
      void main() {
        float k = smoothstep(-0.05, 0.55, vHeight);
        gl_FragColor = vec4(mix(horizon, top, k), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const skyGeometry = new SphereGeometry(90, 24, 12);
  const sky = new Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const fog = new Fog(0x000000, 10, 46);
  scene.fog = fog;

  const hemi = new HemisphereLight(0xffffff, 0x3c6b55, 1);
  scene.add(hemi);

  const sun = new DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const size = quality === 'high' ? 2048 : 512;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = quality === 'high' ? 3 : 1;
  scene.add(sun, sun.target);

  const direction = new Vector3();
  let lastHalf = 0;

  return {
    sun,
    update(mood, focus, cameraHeight) {
      (skyMaterial.uniforms.top?.value as Color).copy(rgb(mood.top));
      (skyMaterial.uniforms.horizon?.value as Color).copy(rgb(mood.horizon));
      sky.position.copy(focus);
      fog.color.copy(rgb(mood.horizon)).lerp(rgb(mood.top), 0.12);
      // Fog thins out for the overview so the whole circuit stays readable
      const thin = MathUtils.clamp(cameraHeight / 12, 0, 1);
      fog.near = MathUtils.lerp(8, 26, thin);
      fog.far = MathUtils.lerp(34, 80, thin);

      hemi.color.copy(rgb(mood.top)).lerp(new Color(0xffffff), 0.45);
      hemi.groundColor.set(0x3c6b55);
      hemi.intensity = mood.ambient * 1.4;

      const elevation = MathUtils.degToRad(mood.sunElevation);
      direction.set(
        Math.cos(elevation) * Math.sin(SUN_AZIMUTH),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(SUN_AZIMUTH),
      );
      sun.color.copy(rgb(mood.sun));
      sun.intensity = mood.sunIntensity;
      sun.position.copy(focus).addScaledVector(direction, 40);
      sun.target.position.copy(focus);
      sun.target.updateMatrixWorld();

      const half = MathUtils.clamp(4 + cameraHeight * 0.9, 5, 14);
      if (Math.abs(half - lastHalf) > 0.25) {
        const cam = sun.shadow.camera;
        cam.left = -half;
        cam.right = half;
        cam.top = half;
        cam.bottom = -half;
        cam.updateProjectionMatrix();
        lastHalf = half;
      }
    },
    dispose() {
      skyGeometry.dispose();
      skyMaterial.dispose();
      sun.shadow.map?.dispose();
      scene.remove(sky, hemi, sun, sun.target);
      scene.fog = null;
    },
  };
}
