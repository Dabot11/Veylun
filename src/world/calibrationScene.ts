import { Scene } from '@babylonjs/core/scene';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Culling/ray';

export function resetCalibrationCamera(camera: ArcRotateCamera): void {
  camera.setTarget(new Vector3(-2.1, 0.6, 0));
  camera.alpha = -Math.PI / 2.7;
  camera.beta = 1.12;
  camera.radius = 10;
}

/** Neutral metric test stage, deliberately not the game's environment art. */
export function createCalibrationScene(engine: Engine, canvas: HTMLCanvasElement): { scene: Scene; camera: ArcRotateCamera } {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.055, 0.105, 0.092, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.045;
  scene.fogColor = new Color3(0.055, 0.105, 0.092);

  const camera = new ArcRotateCamera('calibration-camera', 0, 0, 10, Vector3.Zero(), scene);
  resetCalibrationCamera(camera);
  camera.lowerBetaLimit = 0.35;
  camera.upperBetaLimit = Math.PI / 2.05;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 18;
  camera.wheelPrecision = 35;
  camera.panningSensibility = 0;
  camera.attachControl(canvas, true);

  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.8;
  ambient.groundColor = new Color3(0.08, 0.14, 0.12);
  const sun = new DirectionalLight('sun', new Vector3(-0.6, -1, 0.4), scene);
  sun.diffuse = new Color3(1, 0.88, 0.65);
  sun.intensity = 1.2;

  const groundMaterial = new StandardMaterial('ground-material', scene);
  groundMaterial.diffuseColor = new Color3(0.09, 0.15, 0.13);
  groundMaterial.specularColor = Color3.Black();
  const ground = CreateGround('calibration-floor', { width: 90, height: 90 }, scene);
  ground.material = groundMaterial;

  for (let i = -14; i <= 14; i++) {
    const color = new Color3(0.14, 0.24, 0.20);
    CreateLines(`grid-x-${i}`, { points: [new Vector3(i, 0.005, -14), new Vector3(i, 0.005, 14)] }, scene).color = color;
    CreateLines(`grid-z-${i}`, { points: [new Vector3(-14, 0.005, i), new Vector3(14, 0.005, i)] }, scene).color = color;
  }

  const metricMaterial = new StandardMaterial('metric-volume-material', scene);
  metricMaterial.diffuseColor = new Color3(0.30, 0.50, 0.43);
  metricMaterial.specularColor = new Color3(0.12, 0.2, 0.18);
  metricMaterial.alpha = 0.25;
  const volume = CreateBox('1.45-meter-scale-reference', { width: 0.65, height: 1.45, depth: 0.65 }, scene);
  volume.position.y = 0.725;
  volume.material = metricMaterial;

  const lineColor = new Color3(0.42, 0.77, 0.66);
  for (const y of [0.015, 1.45]) {
    CreateLines(`metric-outline-${y}`, { points: [new Vector3(-0.325, y, -0.325), new Vector3(0.325, y, -0.325), new Vector3(0.325, y, 0.325), new Vector3(-0.325, y, 0.325), new Vector3(-0.325, y, -0.325)] }, scene).color = lineColor;
  }
  for (const x of [-0.325, 0.325]) for (const z of [-0.325, 0.325]) {
    CreateLines(`metric-edge-${x}-${z}`, { points: [new Vector3(x, 0, z), new Vector3(x, 1.45, z)] }, scene).color = lineColor;
  }
  return { scene, camera };
}
