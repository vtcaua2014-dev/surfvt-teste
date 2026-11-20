/*
 * Iceland × Transylvania: best-effort visual composite.
 *
 * Native Unity objects, physics and camera stay inside the unmodified
 * Transylvania miamiSiteBuild runtime. This Three.js surface renders
 * authentic extracted Iceland OBJ meshes + PNG atlases separately.
 * This is NOT a Unity AssetBundle import and cannot replace native scenery.
 */
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const canvas = document.getElementById("iceland-scene");
const status = document.getElementById("iceland-status");
const toggle = document.getElementById("iceland-toggle");
const opacityControl = document.getElementById("iceland-opacity");
const info = document.getElementById("iceland-info");
const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent);
const THREE_ERROR = "Este navegador não conseguiu iniciar a camada 3D de Iceland. A Transylvania continua disponível.";
const state = { running: false, starting: false, renderer: null, scene: null, camera: null, objects: [], loaded: false, failed: false, resize: null, raf: 0, ready: false, lastFrame: 0 };
const base = new URL("./", import.meta.url);
const url = (path) => new URL(path, base).toString();

function setStatus(message) {
  status.textContent = message;
  console.info("[Iceland visual composite]", message);
}
function setEnabled(enabled) {
  if (!state.renderer) return;
  state.running = enabled;
  canvas.hidden = !enabled;
  toggle.textContent = enabled ? "Desativar camada" : "Ativar camada";
  toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  if (enabled) {
    state.lastFrame = 0;
    renderLoop();
  } else {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
}
function setOpacity(value) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  canvas.style.opacity = String(n / 100);
  opacityControl.value = String(n);
}
setOpacity(opacityControl.value || 80);
opacityControl.addEventListener("input", (event) => setOpacity(event.target.value));
info.addEventListener("click", () => {
  const expanded = info.getAttribute("aria-expanded") !== "true";
  info.setAttribute("aria-expanded", String(expanded));
  document.getElementById("iceland-disclosure").hidden = !expanded;
});

function renderLoop(time = 0) {
  if (!state.running || !state.renderer) return;
  state.raf = requestAnimationFrame(renderLoop);
  // Unity WebGL already consumes a large GPU budget. Cap to ~25 FPS.
  if (time - state.lastFrame < 40) return;
  state.lastFrame = time;
  state.renderer.render(state.scene, state.camera);
}

function resize() {
  if (!state.renderer || !state.camera) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  state.renderer.setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1));
  state.renderer.setSize(w, h, false);
  state.camera.aspect = w / h;
  state.camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; }
  else if (state.running) renderLoop();
});
window.addEventListener("pagehide", () => {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
});
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  state.failed = true;
  state.running = false;
  setStatus("GPU interrompeu a camada Iceland. O jogo Unity permanece independente.");
});

async function prepareLayer() {
  if (state.loaded || state.starting || state.failed) return;
  state.starting = true;
  toggle.disabled = true;
  setStatus("Carregando meshes, ground, atlas e texturas originais Iceland…");
  try {
    const response = await fetch(url("scene-plan.json"), { cache: "no-cache" });
    if (!response.ok) throw new Error("scene-plan.json: HTTP " + response.status);
    const plan = await response.json();
    if (!Array.isArray(plan.placements) || !plan.placements.length) throw new Error("Plano de cenário vazio");
    const renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false, preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    state.renderer = renderer;
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.sortObjects = true;
    const scene = new THREE.Scene();
    scene.background = null;
    const light = new THREE.HemisphereLight(0xe8faff, 0x3c5666, 2.3);
    scene.add(light);
    const sun = new THREE.DirectionalLight(0xfff6df, 1.1);
    sun.position.set(-35, 80, 10);
    scene.add(sun);
    state.scene = scene;

    const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 700);
    camera.position.set(0, 22, -35);
    camera.lookAt(0, 7, 65);
    state.camera = camera;
    resize();

    const assetLoader = new OBJLoader();
    const textureLoader = new THREE.TextureLoader();
    const textureResults = {};
    const texEntries = Object.entries(plan.textures || {});
    await Promise.all(texEntries.map(async ([name, file]) => {
      try {
        if (!/^textures\/[A-Za-z0-9_.-]+\.png$/.test(file)) return;
        const image = await textureLoader.loadAsync(url("extracted/" + file));
        image.colorSpace = THREE.SRGBColorSpace;
        image.wrapS = THREE.ClampToEdgeWrapping;
        image.wrapT = THREE.ClampToEdgeWrapping;
        image.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        image.needsUpdate = true;
        textureResults[name] = image;
      } catch (error) {
        console.warn("[Iceland] atlas unavailable:", name, error);
      }
    }));

    // Avoid flooding the network or creating too many GPU allocations on iOS.
    // Every object here comes from the exported Iceland asset manifest.
    let success = 0;
    let failures = 0;
    for (const item of plan.placements) {
      if (!/^meshes\/[A-Za-z0-9_.-]+\.obj$/.test(item.file)) continue;
      try {
        const obj = await assetLoader.loadAsync(url("extracted/" + item.file));
        obj.name = "Iceland:" + item.name;
        const map = textureResults[item.texture] || null;
        const opacity = Number.isFinite(item.opacity) ? Math.min(1, Math.max(0, item.opacity)) : .6;
        const mat = new THREE.MeshStandardMaterial({
          map,
          color: map ? 0xffffff : 0xa5d8ec,
          roughness: .9,
          metalness: 0,
          side: THREE.DoubleSide,
          transparent: opacity < 1,
          opacity,
          depthWrite: opacity >= .95,
          alphaTest: 0,
        });
        obj.traverse((child) => { if (child.isMesh) child.material = mat; });
        obj.position.set(...item.position);
        obj.scale.set(...item.scale);
        scene.add(obj);
        state.objects.push(obj);
        success++;
        if (success % 4 === 0) setStatus("Compondo Iceland: " + success + "/" + plan.placements.length + " meshes");
      } catch (error) {
        failures++;
        console.warn("[Iceland] mesh failed:", item.name, error);
      }
    }
    if (!success) throw new Error("Nenhum mesh pôde ser carregado");
    state.loaded = true;
    state.starting = false;
    setStatus("Iceland: " + success + " objetos 3D e " + Object.keys(textureResults).length +
      " texturas disponíveis" + (failures ? " (" + failures + " falharam)" : ""));
    toggle.disabled = false;
    setEnabled(true);
  } catch (error) {
    console.error("[Iceland] failed to initialize visual layer", error);
    state.failed = true;
    setStatus(THREE_ERROR);
    toggle.disabled = false;
    toggle.textContent = "Camada indisponível";
  }
}
toggle.addEventListener("click", () => {
  if (!state.ready) { setStatus("Carregando Transylvania antes de ativar Iceland…"); return; }
  if (state.loaded) setEnabled(!state.running);
  else prepareLayer();
});

function unityReady() {
  if (state.ready) return;
  state.ready = true;
  toggle.disabled = false;
  if (mobile) {
    setStatus("Transylvania pronta. Toque em 'Ativar camada' para carregar Iceland (alto uso de GPU).");
    toggle.textContent = "Ativar camada";
  } else {
    // Delaying GPU context creation until after Unity startup avoids disrupting
    // its initial allocation of a large WebAssembly heap and multiple shaders.
    setStatus("Transylvania pronta. Preparando a camada Iceland…");
    setTimeout(prepareLayer, 1200);
  }
}
window.addEventListener("iceland:unity-ready", unityReady);
if (window.unityInstance) unityReady();
else { setStatus("Aguardando inicialização do carregador Transylvania…"); toggle.disabled = true; }
