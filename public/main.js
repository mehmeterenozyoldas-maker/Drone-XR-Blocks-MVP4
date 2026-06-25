import 'xrblocks/addons/simulator/SimulatorAddons.js';

import RAPIER from '@dimforge/rapier3d-simd-compat';
import * as xb from 'xrblocks';

import {SplashScript} from './SplashScript.js';
import {RainScene} from './RainScene.js';

const depthMeshColliderUpdateFps = xb.getUrlParamFloat(
  'depthMeshColliderUpdateFps',
  30
);
const splashScript = new SplashScript();
const rainScene = new RainScene();

let options = new xb.Options();
options.depth = new xb.DepthOptions(xb.xrDepthMeshPhysicsOptions);
options.depth.depthMesh.colliderUpdateFps = depthMeshColliderUpdateFps;
options.xrButton = {
  ...options.xrButton,
  startText: '<i id="xrlogo"></i> START SIMULATOR',
  endText: '<i id="xrlogo"></i> MISSION COMPLETE',
};
options.physics.RAPIER = RAPIER;
options.physics.useEventQueue = true;

// Initializes the scene, camera, xrRenderer, controls, and XR button.
async function start() {
  xb.add(splashScript);
  xb.add(rainScene); // Add rain scene to combine projects
  await xb.init(options);
  
  // Custom event listener from React UI to trigger rain
  window.addEventListener('activate-rain', () => {
     if (rainScene.startAudio) rainScene.startAudio();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  start();
});
