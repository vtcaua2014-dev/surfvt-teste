// Transylvania × Iceland – independent Three.js runner using real extracted
// Iceland Unity 2019 meshes, UVs, and texture atlases.
// This deliberately does NOT patch or claim to modify Transylvania's
// proprietary compiled Unity/IL2CPP WebAssembly binary.
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const ui = {
  menu: $("menu"), play: $("playBtn"), pause: $("pause"),
  state: $("state"), description: $("description"), loaded: $("loaded"),
  score: $("score"), distance: $("distance"), coins: $("coins"),
  best: $("best"), error: $("errorBox"),
};

const laneX = [-6.5, 0, 6.5];
const tmpVec = new THREE.Vector3();
let current = "loading";
let renderer, scene, camera, player, playerFigure, snow, snowPositions;
let colors, maps = {}, model = {}, world = {}, trackParts = [];
let decorative = [], obstacles = [], collectible = [], activeParts = [];
let lane = 1, playerY = 0, playerSpeedY = 0, rollTime = 0, boardTime = 0;
let distance = 0, points = 0, coins = 0, spawnClock = 2.1;
let lastTouch = 0, lastFrame = performance.now(), lastHud = 0;
let maxScore = 0;
try { maxScore = Number(localStorage.getItem("icelandRunnerBest") || 0) || 0; } catch {}
let loadedMeshes = 0, loadedTextures = 0;
const meshFiles = [
  "track", "train_standard", "train_sub", "train_cargo", "train_ramp",
  "station_mid", "station_start", "station_platforms", "lightSignal",
  "blocker_jump", "blocker_roll", "blocker_standard", "bush_1", "bush_2",
  "rock01_mesh", "iceland_idle_mesh", "currency_coin", "gates_base", "NorthPole_prop",
];
const keyTextures = [
  "1.117_Iceland_environment", "1.117_Iceland_trains",
  "1.117_Iceland_train_start", "1.117_Iceland_enemies",
  "Snow", "GenericAtlas",
];

function setError(message) {
  ui.error.textContent = message;
  ui.error.style.display = "block";
  console.error("[Transylvania × Iceland]", message);
}
function saveBest() {
  if (points > maxScore) {
    maxScore = Math.floor(points);
    try { localStorage.setItem("icelandRunnerBest", String(maxScore)); } catch {}
  }
}
function updateHud() {
  ui.score.textContent = Math.floor(points).toLocaleString("pt-BR");
  ui.distance.textContent = Math.floor(distance) + " m";
  ui.coins.textContent = String(coins);
  ui.best.textContent = "Recorde: " + maxScore.toLocaleString("pt-BR");
}
function setMenu(status, button, description) {
  current = status;
  ui.menu.classList.remove("hidden");
  ui.play.disabled = false;
  ui.play.textContent = button;
  ui.description.textContent = description;
  ui.state.textContent = status === "gameover" ? "Fim de partida" :
    status === "paused" ? "Jogo pausado" : "Pronto";
}
function pauseGame() {
  if (current === "playing") {
    saveBest();
    updateHud();
    setMenu("paused", "CONTINUAR", "Partida pausada. As texturas, os meshes e os obstáculos do cenário permanecem carregados.");
  } else if (current === "paused") {
    current = "playing";
    ui.menu.classList.add("hidden");
    canvas.focus();
  }
}
function createRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#a4dce9");
  scene.fog = new THREE.FogExp2(0xa1d9e8, 0.0031);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 850);
  camera.position.set(0, 15, -32);
  camera.lookAt(0, 7, 40);
  scene.add(new THREE.HemisphereLight(0xe9faff, 0x4b8497, 2.45));
  const sun = new THREE.DirectionalLight(0xfffcf0, 2.4);
  sun.position.set(-80, 110, 90);
  scene.add(sun);
  const ambientFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 1400),
    new THREE.MeshLambertMaterial({ color: 0xc8eef3 }),
  );
  ambientFloor.rotation.x = -Math.PI / 2;
  ambientFloor.position.set(0, -4, 240);
  scene.add(ambientFloor);

  colors = {
    env: new THREE.MeshLambertMaterial({ color: 0xd8f4ff, side: THREE.DoubleSide }),
    train: new THREE.MeshLambertMaterial({ color: 0x82bfdf, side: THREE.DoubleSide }),
    player: new THREE.MeshLambertMaterial({ color: 0xfff6de, side: THREE.DoubleSide }),
    snow: new THREE.MeshLambertMaterial({ color: 0xe4ffff, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: 0xffdf74, metalness: 0.62, roughness: 0.32 }),
  };
  const particles = 400;
  snowPositions = new Float32Array(particles * 3);
  for (let i = 0; i < particles; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 150;
    snowPositions[i * 3 + 1] = Math.random() * 68;
    snowPositions[i * 3 + 2] = (Math.random() - 0.3) * 320;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
  snow = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.37, transparent: true, opacity: 0.8,
    depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(snow);

  player = new THREE.Group();
  scene.add(player);
  // Visible fallback is replaced by the extracted Iceland mesh as soon as it loads.
  const shell = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.02, 1.6, 5, 9),
    new THREE.MeshStandardMaterial({ color: 0x21364f, roughness: .8 })
  );
  shell.position.y = 2.0;
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.4, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x90c9e8, roughness: .7 })
  );
  jacket.position.y = 2.4;
  player.add(shell, jacket);
  playerFigure = { shell, jacket };
  player.position.set(laneX[lane], 0, 0);
  addEventListener("resize", resize);
}
function resize() {
  if (!renderer) return;
  const w = Math.max(320, innerWidth), h = Math.max(240, innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = h > w ? 73 : 62;
  camera.updateProjectionMatrix();
}
async function loadAssets() {
  const response = await fetch("./scene-assets.json", { cache: "no-store" });
  if (!response.ok) throw Error("scene-assets.json: HTTP " + response.status);
  const index = await response.json();
  const textureLoader = new THREE.TextureLoader();
  const objLoader = new OBJLoader();
  await Promise.all(keyTextures.map(async (id) => {
    const url = index.textures[id];
    if (!url) return;
    try {
      const texture = await textureLoader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      maps[id] = texture;
      loadedTextures++;
    } catch (e) { console.warn("Iceland texture:", id, e); }
  }));
  if (maps["1.117_Iceland_environment"]) {
    colors.env.map = maps["1.117_Iceland_environment"];
    colors.env.needsUpdate = true;
  }
  if (maps["1.117_Iceland_trains"]) {
    colors.train.map = maps["1.117_Iceland_trains"];
    colors.train.needsUpdate = true;
  }
  if (maps["1.117_Iceland_enemies"]) {
    colors.player.map = maps["1.117_Iceland_enemies"];
    colors.player.needsUpdate = true;
  }
  await Promise.all(meshFiles.map(async (id) => {
    const url = index.meshes[id];
    if (!url) return;
    try {
      const obj = await objLoader.loadAsync(url);
      const material = id.startsWith("train") ? colors.train :
        id === "iceland_idle_mesh" ? colors.player :
        id === "currency_coin" ? colors.gold : colors.env;
      obj.traverse((node) => {
        if (node.isMesh) {
          node.material = material;
          node.frustumCulled = false;
        }
      });
      model[id] = obj;
      loadedMeshes++;
    } catch (e) { console.warn("Iceland mesh:", id, e); }
  }));
  // The track and train must genuinely come from the extracted Unity archive.
  if (!model.track || !model.train_standard || !maps["1.117_Iceland_environment"]) {
    throw Error("Arquivos originais essenciais de Iceland indisponíveis: trilhos, trem ou atlas de cenário.");
  }
  createWorld();
  ui.loaded.textContent = loadedMeshes + " meshes + " + loadedTextures + " atlas/texturas Iceland carregados";
  ui.state.textContent = "Assets Iceland reais prontos";
  ui.play.disabled = false;
  ui.play.textContent = "JOGAR AGORA";
  ui.description.textContent =
    "Explore trilhos, estação, trens, obstáculos e texturas extraídos do Iceland original em um runner 3D experimental.";
  current = "ready";
  updateHud();
}
function cloneMesh(id, x, y, z, scale = 1) {
  const original = model[id];
  if (!original) return null;
  const copy = original.clone(true);
  copy.position.set(x, y, z);
  copy.scale.setScalar(scale);
  scene.add(copy);
  return copy;
}
function createWorld() {
  trackParts = [];
  for (let i = -1; i < 5; i++) {
    const copy = cloneMesh("track", 0, 0, i * 180, 1);
    if (copy) trackParts.push(copy);
  }
  world.station = cloneMesh("station_mid", -4, -1, 120, .16);
  world.station2 = cloneMesh("station_start", -4, -1, 390, .13);
  world.platforms = cloneMesh("station_platforms", 0, -2, 170, .65);
  decorative = [];
  for (let i = 0; i < 28; i++) {
    const kind = i % 4 === 0 ? "lightSignal" : i % 3 === 0 ? "rock01_mesh" : "bush_1";
    const x = i % 2 === 0 ? -19 - Math.random() * 7 : 19 + Math.random() * 7;
    const z = i * 24 - 70;
    const size = kind === "lightSignal" ? 0.24 : kind === "rock01_mesh" ? 5 : .7;
    const visual = cloneMesh(kind, x, kind === "rock01_mesh" ? -0.6 : -1, z, size);
    if (visual) decorative.push({ visual, z, type: kind });
  }
  const figure = model.iceland_idle_mesh;
  if (figure) {
    figure.scale.setScalar(1.45);
    // Original Iceland character rig is unanimated. A running bob gives motion.
    figure.position.set(0, 0, 0);
    player.remove(playerFigure.shell, playerFigure.jacket);
    player.add(figure);
    playerFigure = { figure };
  }
}
function spawnCoin(z, laneIndex) {
  let object;
  if (model.currency_coin) {
    object = cloneMesh("currency_coin", laneX[laneIndex], 3.0, z, 1.5);
  } else {
    object = new THREE.Mesh(new THREE.TorusGeometry(1.25, .36, 8, 12), colors.gold);
    object.position.set(laneX[laneIndex], 3, z);
    scene.add(object);
  }
  collectible.push({ object, z, lane: laneIndex, done: false });
}
function spawnRow(near = 185) {
  const free = Math.floor(Math.random() * 3);
  const blocked = Math.random() < .6 ? [ (free + 1) % 3, (free + 2) % 3 ] : [ (free + 1) % 3 ];
  blocked.forEach((l, index) => {
    const kinds = ["blocker_jump", "blocker_roll", "blocker_standard", "train_standard", "train_cargo"];
    let kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (!model[kind]) kind = "train_standard";
    const scale = kind.startsWith("train") ? .28 : .30;
    const visual = cloneMesh(kind, laneX[l], 0, near + index * 2, scale);
    if (visual) obstacles.push({ visual, lane: l, z: near + index * 2, kind, hit: false });
  });
  for (let i = 0; i < 5; i++) spawnCoin(near + i * 4 - 24, free);
}
function resetGame() {
  obstacles.forEach((o) => scene.remove(o.visual));
  collectible.forEach((o) => scene.remove(o.object));
  obstacles = []; collectible = [];
  lane = 1; playerY = 0; playerSpeedY = 0; rollTime = 0; boardTime = 0;
  distance = points = coins = 0;
  spawnClock = 2.5;
  player.position.set(0, 0, 0);
  spawnRow(125); spawnRow(230);
  current = "playing";
  ui.menu.classList.add("hidden");
  ui.error.style.display = "none";
  canvas.focus();
  updateHud();
}
function startAction() {
  if (current === "paused") return pauseGame();
  if (current !== "loading") resetGame();
}
function move(dir) { lane = Math.max(0, Math.min(2, lane + dir)); }
function jump() { if (playerY <= .01 && rollTime <= 0) playerSpeedY = 16.5; }
function roll() { if (playerY <= .1) rollTime = .85; }
function activateBoard() { boardTime = 6; }
function gameOver() {
  saveBest();
  updateHud();
  setMenu("gameover", "JOGAR NOVAMENTE",
    "Fim da partida! Você percorreu " + Math.floor(distance) +
    " metros e coletou " + coins + " moedas. A pista Iceland continua pronta para outra tentativa.");
}
function input(action) {
  if (current !== "playing") return;
  if (action === "left") move(-1);
  if (action === "right") move(1);
  if (action === "up") jump();
  if (action === "down") roll();
  if (action === "board") activateBoard();
}
function installControls() {
  ui.play.addEventListener("click", startAction);
  ui.pause.addEventListener("click", pauseGame);
  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d", "p", "escape", "b"].includes(k)) e.preventDefault();
    if (k === "escape" || k === "p") { pauseGame(); return; }
    if (k === "arrowleft" || k === "a") input("left");
    if (k === "arrowright" || k === "d") input("right");
    if (k === "arrowup" || k === "w" || k === " ") input("up");
    if (k === "arrowdown" || k === "s") input("down");
    if (k === "b") input("board");
  }, { passive: false });
  let sx = 0, sy = 0, down = 0;
  canvas.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; down = performance.now(); });
  canvas.addEventListener("pointerup", (e) => {
    if (current !== "playing") return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) {
      if (Math.abs(dx) > Math.abs(dy)) input(dx > 0 ? "right" : "left");
      else input(dy < 0 ? "up" : "down");
    } else if (performance.now() - down < 250) {
      const now = performance.now();
      if (now - lastTouch < 340) { input("board"); lastTouch = 0; }
      else lastTouch = now;
    }
  });
  addEventListener("visibilitychange", () => { if (document.hidden && current === "playing") pauseGame(); });
}
function update(dt, t) {
  if (current !== "playing") return;
  const speed = Math.min(50, 25 + distance * .012);
  const shift = dt * speed;
  distance += shift / 2;
  points += shift * 1.6;
  player.position.x += (laneX[lane] - player.position.x) * Math.min(1, dt * 13);
  if (playerY > 0 || playerSpeedY > 0) {
    playerY += playerSpeedY * dt;
    playerSpeedY -= 29 * dt;
    if (playerY < 0) { playerY = 0; playerSpeedY = 0; }
  }
  player.position.y = playerY + (playerY > .1 || rollTime > 0 ? 0 : .18 * Math.sin(t * 12));
  if (rollTime > 0) rollTime -= dt;
  if (boardTime > 0) boardTime -= dt;
  player.scale.y += ((rollTime > 0 ? .48 : 1) - player.scale.y) * Math.min(1, dt * 15);
  for (const part of trackParts) {
    part.position.z -= shift;
    if (part.position.z < -360) part.position.z += 180 * trackParts.length;
  }
  for (const prop of decorative) {
    prop.visual.position.z -= shift;
    if (prop.visual.position.z < -150) prop.visual.position.z += 28 * 24;
  }
  for (const name of ["station", "station2", "platforms"]) {
    if (world[name]) {
      world[name].position.z -= shift * .55;
      if (world[name].position.z < -280) world[name].position.z += 600;
    }
  }
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.z -= shift; o.visual.position.z = o.z;
    const threshold = o.kind.startsWith("train") ? 8.5 : 3.3;
    if (!o.hit && Math.abs(o.z) < threshold && o.lane === lane) {
      o.hit = true;
      const safe = o.kind === "blocker_jump" ? playerY > 2.5 :
        o.kind === "blocker_roll" ? rollTime > 0 :
        false;
      if (!safe) {
        if (boardTime > 0) {
          boardTime = 0;
          scene.remove(o.visual);
          obstacles.splice(i, 1);
          continue;
        }
        gameOver();
        return;
      }
    }
    if (o.z < -70) { scene.remove(o.visual); obstacles.splice(i, 1); }
  }
  for (let i = collectible.length - 1; i >= 0; i--) {
    const coin = collectible[i];
    coin.z -= shift; coin.object.position.z = coin.z;
    coin.object.rotation.y += dt * 4;
    if (Math.abs(coin.z) < 3.2 && coin.lane === lane && playerY < 6) {
      coins++; points += 25;
      scene.remove(coin.object); collectible.splice(i, 1);
    } else if (coin.z < -50) {
      scene.remove(coin.object); collectible.splice(i, 1);
    }
  }
  spawnClock -= dt;
  if (spawnClock <= 0) {
    spawnClock = Math.max(1.6, 2.45 - distance * .0007);
    spawnRow(230);
  }
  if (t - lastHud > .12) { updateHud(); lastHud = t; }
}
function renderFrame(time) {
  requestAnimationFrame(renderFrame);
  const dt = Math.min(.04, Math.max(0, (time - lastFrame) / 1000));
  lastFrame = time;
  if (!renderer) return;
  const t = time / 1000;
  update(dt, t);
  if (player) {
    camera.position.x += (player.position.x * .32 - camera.position.x) * Math.min(1, dt * 2.4);
    camera.lookAt(player.position.x * .4, 5, 48);
  }
  const pos = snow.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] -= dt * 3.3;
    if (pos[i + 1] < -1) { pos[i + 1] = 52; pos[i] = (Math.random() - .5) * 130; }
    if (current === "playing") {
      pos[i + 2] -= dt * 7;
      if (pos[i + 2] < -100) pos[i + 2] = 230;
    }
  }
  snow.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}
async function initialize() {
  try {
    createRenderer();
    installControls();
    requestAnimationFrame(renderFrame);
    await loadAssets();
  } catch (e) {
    setError("Não foi possível carregar a cena extraída de Iceland: " + (e?.message || String(e)));
    ui.play.textContent = "ASSETS INDISPONÍVEIS";
    ui.state.textContent = "Falha de carregamento";
  }
}
initialize();
