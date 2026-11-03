import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'tinytorque-garage-v1';
const LAPS = 3;
const ROAD_WIDTH = 12;
const POINT_COUNT = 420;
const STEP = 1 / 60;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (n) => ((n % POINT_COUNT) + POINT_COUNT) % POINT_COUNT;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const fmt = (value) => String(Math.floor(value)).padStart(2, '0');
const lapTime = (seconds) => fmt(seconds / 60) + ':' + fmt(seconds % 60) + '.' + String(Math.floor(seconds % 1 * 100)).padStart(2, '0');

const TUNERS = [
  { key:'power', label:'Puissance moteur', min:55, max:180, step:5, unit:'%', desc:'Accélération en sortie de virage' },
  { key:'topSpeed', label:'Vitesse de pointe', min:16, max:42, step:1, unit:'', desc:'Rapidité sur les longues lignes droites' },
  { key:'grip', label:'Adhérence', min:0.55, max:1.55, step:0.05, unit:'', desc:'Tenue de route et freinage' },
  { key:'steering', label:'Direction', min:0.65, max:1.55, step:0.05, unit:'', desc:'Capacité à négocier les virages' },
  { key:'mass', label:'Masse', min:65, max:155, step:5, unit:'kg', desc:'Inertie et accélération du bolide' }
];
const CAR_PRESETS = [
  { name:'Kestrel GT', code:'01 / BALANCED', color:'#ff7458', tune:{power:115,topSpeed:31,grip:1.05,steering:1.05,mass:95} },
  { name:'Nebula XR', code:'02 / SPEEDSTER', color:'#66e6d6', tune:{power:140,topSpeed:39,grip:0.77,steering:0.85,mass:110} },
  { name:'Bumble R', code:'03 / GRIP MASTER', color:'#f2d25f', tune:{power:95,topSpeed:28,grip:1.38,steering:1.25,mass:85} },
  { name:'Nightshift', code:'04 / WILDCARD', color:'#a493f4', tune:{power:125,topSpeed:35,grip:1.0,steering:1.1,mass:130} }
];

let saved = null;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { saved = null; }
function sanitizeTune(source, fallback) {
  const result = {};
  for (const field of TUNERS) {
    const candidate = source && Number(source[field.key]);
    result[field.key] = Number.isFinite(candidate) && candidate >= field.min && candidate <= field.max ? candidate : fallback[field.key];
  }
  return result;
}
const cars = CAR_PRESETS.map((preset, index) => ({
  ...preset, id:index, tune:sanitizeTune(saved && saved[index], preset.tune),
  speed:0, index:0, lap:0, finished:false, finishedAt:0, heading:0,
  position:new THREE.Vector3(), visual:null, wheelParts:[], laneOffset:0, offroad:0
}));
function saveGarage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cars.map(car => car.tune))); } catch (_) { /* storage may be disabled */ }
}
let selected = 0;
let mode = 'idle';
let simSpeed = 1;
let elapsed = 0;
let timeAccumulator = 0;
let cameraMode = 'tv';
let cameraOrbit = 0;
let toastHandle;
const toast = (message) => {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => node.classList.remove('show'), 2600);
};

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fbfc2');
scene.fog = new THREE.Fog('#9fbfc2', 160, 350);
const viewport = $('scene');
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 600);
camera.position.set(105, 109, 130);
const cameraTarget = new THREE.Vector3();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
viewport.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe2fbff, 0x52634f, 2.15));
const sun = new THREE.DirectionalLight(0xffefd3, 2.1);
sun.position.set(-65, 110, 30);
scene.add(sun);

const path = new THREE.CatmullRomCurve3([
  [-3,-75], [34,-73], [69,-58], [87,-31], [81,-2], [55,14],
  [27,9], [13,36], [39,57], [49,78], [22,91], [-14,84],
  [-38,67], [-30,37], [-59,29], [-82,7], [-78,-29], [-53,-57], [-30,-72]
].map(([x,z]) => new THREE.Vector3(x,0,z)), true, 'catmullrom', 0.34);
const track = Array.from({ length:POINT_COUNT }, (_,i) => path.getPointAt(i / POINT_COUNT));
const tangents = Array.from({ length:POINT_COUNT }, (_,i) => {
  const a = track[wrap(i - 1)], b = track[wrap(i + 1)];
  return b.clone().sub(a).normalize();
});
const lengthOfTrack = path.getLength();
const distancePerPoint = lengthOfTrack / POINT_COUNT;
function pointWithOffset(index, offset = 0) {
  const i = wrap(index), p = track[i], t = tangents[i];
  return new THREE.Vector3(p.x + t.z * offset, 0, p.z - t.x * offset);
}
function nearestIndex(position, fromIndex, range = 17) {
  let best = fromIndex, bestDistance = Infinity;
  for (let d = -range; d <= range; d++) {
    const index = wrap(fromIndex + d);
    const p = track[index];
    const distance = (position.x - p.x) ** 2 + (position.z - p.z) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  }
  return best;
}
function mat(color, roughness = 0.9) { return new THREE.MeshStandardMaterial({color,roughness}); }
function box(w,h,d,color,x,y,z,group = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color));
  mesh.position.set(x,y,z);
  group.add(mesh);
  return mesh;
}
function buildWorld() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700,700), mat('#789478'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  scene.add(ground);
  const stripPositions = [], indices = [];
  for (let i = 0; i <= POINT_COUNT; i++) {
    const at = i % POINT_COUNT, point = track[at], t = tangents[at];
    for (const side of [1,-1]) {
      stripPositions.push(point.x + t.z * side * ROAD_WIDTH/2, 0.03, point.z - t.x * side * ROAD_WIDTH/2);
    }
    if (i < POINT_COUNT) {
      const j = i*2;
      indices.push(j,j+1,j+2, j+1,j+3,j+2);
    }
  }
  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stripPositions,3));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();
  const asphalt = new THREE.Mesh(roadGeometry,new THREE.MeshStandardMaterial({color:'#444c53',roughness:1,side:THREE.DoubleSide}));
  scene.add(asphalt);
  const curbGeo = new THREE.BoxGeometry(1.05,0.14,2.6);
  const curbMaterials = [mat('#efeee1'),mat('#d45c52')];
  for (let i = 0; i < POINT_COUNT; i += 7) {
    const tangent = tangents[i], yaw = Math.atan2(tangent.x,tangent.z);
    for (const side of [-1,1]) {
      const center = pointWithOffset(i,side*(ROAD_WIDTH/2 + 0.17));
      const curb = new THREE.Mesh(curbGeo,curbMaterials[(Math.floor(i/7))%2]);
      curb.position.set(center.x,0.09,center.z);
      curb.rotation.y = yaw;
      scene.add(curb);
    }
  }
  const paintMaterial = mat('#d9ddd6');
  for (let i = 15; i < POINT_COUNT; i += 13) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.035,3.5),paintMaterial);
    const p = track[i], t = tangents[i];
    line.position.set(p.x,0.065,p.z);
    line.rotation.y = Math.atan2(t.x,t.z);
    scene.add(line);
  }
  const first = track[0], firstTangent = tangents[0];
  const startGroup = new THREE.Group();
  startGroup.position.set(first.x,0.08,first.z);
  startGroup.rotation.y = Math.atan2(firstTangent.x,firstTangent.z);
  for (let i = 0; i < 10; i++) {
    const tile = box(ROAD_WIDTH/10,0.035,1.65,i%2 ? '#292d35' : '#f5f2e6',-ROAD_WIDTH/2+(i+.5)*ROAD_WIDTH/10,0,0,startGroup);
    tile.material.roughness = 1;
  }
  scene.add(startGroup);
  // Start gate
  for (const s of [-1,1]) {
    const p = pointWithOffset(0,s*8);
    box(0.6,7,0.6,'#26333c',p.x,3.5,p.z);
  }
  const gate = box(17,1,1.1,'#202e39',first.x,7.15,first.z);
  gate.rotation.y = Math.atan2(firstTangent.x,firstTangent.z);
  // Trees and low buildings provide depth, without blocking the course.
  let seed = 1871;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const foliage = [mat('#456f5e'),mat('#527a62'),mat('#66866b'),mat('#355f53')];
  const treeTrunk = mat('#5c5548');
  const treeTop = new THREE.ConeGeometry(3.1,8,7);
  const trunkGeo = new THREE.CylinderGeometry(0.55,0.8,3,6);
  let trees = 0;
  for (let tries = 0; tries < 330 && trees < 112; tries++) {
    const x = (rand()-.5)*295, z = (rand()-.5)*290;
    let near = Infinity;
    for (let i = 0; i < POINT_COUNT; i += 8) {
      const p = track[i];
      near = Math.min(near,(p.x-x)**2+(p.z-z)**2);
    }
    if (near < 18*18 || (Math.abs(x)<12 && Math.abs(z)<16)) continue;
    const h = 0.75 + rand()*0.7;
    const trunk = new THREE.Mesh(trunkGeo,treeTrunk);
    trunk.position.set(x,1.25*h,z);
    trunk.scale.set(h,h,h);
    scene.add(trunk);
    const top = new THREE.Mesh(treeTop,foliage[Math.floor(rand()*foliage.length)]);
    top.position.set(x,6.2*h,z);
    top.scale.set(h,h,h);
    scene.add(top);
    trees++;
  }
  const buildings = [
    {x:-119,z:-77,w:30,d:19,h:15,c:'#aeb8ad'},
    {x:108,z:-69,w:23,d:26,h:12,c:'#b7b2a0'},
    {x:116,z:72,w:34,d:22,h:11,c:'#b5c0ba'},
    {x:-101,z:85,w:25,d:27,h:13,c:'#9caeac'}
  ];
  buildings.forEach(b => {
    box(b.w,b.h,b.d,b.c,b.x,b.h/2,b.z);
    const roof = box(b.w+2,1,b.d+2,'#6a7575',b.x,b.h+.5,b.z);
    roof.rotation.z = .035;
  });
  // Test-area decorative cones, safely off the asphalt.
  const coneGeo = new THREE.ConeGeometry(.75,2,8);
  const coneMat = mat('#e9a04d');
  for (let i = 0; i < 26; i++) {
    const p = pointWithOffset((i*17)%POINT_COUNT, (i%2?1:-1)*11);
    const cone = new THREE.Mesh(coneGeo,coneMat);
    cone.position.set(p.x,1,p.z);
    scene.add(cone);
  }
}

function buildCar(car) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color:car.color,metalness:.32,roughness:.35});
  const dark = new THREE.MeshStandardMaterial({color:'#182330',metalness:.16,roughness:.42});
  const glass = new THREE.MeshStandardMaterial({color:'#83bac7',metalness:.35,roughness:.18});
  const rubber = mat('#1b2329');
  const silver = mat('#c7d8da',.4);
  function part(w,h,d,x,y,z,material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    m.position.set(x,y,z);
    root.add(m);
    return m;
  }
  part(3.45,.72,5.4,0,.81,0,bodyMat);
  part(3.05,.26,2.0,0,1.14,1.63,bodyMat);
  part(2.6,.72,2.52,0,1.44,-.48,glass);
  part(2.35,.22,2.15,0,1.86,-.51,bodyMat);
  part(3.68,.18,.45,0,.56,2.72,dark);
  part(3.54,.18,.46,0,.57,-2.69,dark);
  part(3.65,.19,.6,0,1.74,-2.6,dark);
  part(.22,.55,.3,-1.22,1.34,-2.45,dark);
  part(.22,.55,.3,1.22,1.34,-2.45,dark);
  for (const x of [-1.2,1.2]) {
    part(.64,.18,.08,x,.88,2.75,silver);
    part(.58,.17,.09,x,.9,-2.75,mat('#e65859'));
    for (const z of [-1.8,1.8]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.78,.78,.52,16),rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x*1.49,.73,z);
      root.add(wheel);
      car.wheelParts.push(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.54,12),silver);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      root.add(hub);
      car.wheelParts.push(hub);
    }
  }
  root.scale.setScalar(.82);
  scene.add(root);
  car.visual = root;
}
buildWorld();
cars.forEach(buildCar);

function resetRace() {
  elapsed = 0;
  timeAccumulator = 0;
  mode = 'idle';
  cars.forEach((car,i) => {
    car.index = 18 - i*5;
    car.lap = 0;
    car.speed = 0;
    car.finished = false;
    car.finishedAt = 0;
    car.offroad = 0;
    car.laneOffset = i%2 ? 1.75 : -1.75;
    const p = pointWithOffset(car.index,car.laneOffset);
    car.position.set(p.x,0,p.z);
    const t = tangents[car.index];
    car.heading = Math.atan2(t.x,t.z);
    car.visual.position.set(car.position.x,.09,car.position.z);
    car.visual.rotation.y = car.heading;
  });
  syncControls();
  updateDashboard();
}
function drive(car,dt) {
  if (car.finished) { car.speed = Math.max(0,car.speed-15*dt); return; }
  const tune = car.tune;
  const previous = car.index;
  let index = nearestIndex(car.position,previous);
  car.index = index;
  if (previous > POINT_COUNT-14 && index < 14 && car.speed > 3) {
    car.lap += 1;
    if (car.lap === LAPS) {
      car.finished = true;
      car.finishedAt = elapsed;
      car.speed = 0;
      toast(car.name + ' franchit la ligne !');
      if (cars.every(other => other.finished)) {
        mode = 'finished';
        const winner = [...cars].sort((a,b)=>a.finishedAt-b.finishedAt)[0];
        toast('Victoire : ' + winner.name + ' !');
        syncControls();
      }
      return;
    }
  }
  const current = track[index];
  const centerDistance = Math.hypot(car.position.x-current.x, car.position.z-current.z);
  car.offroad = Math.max(0, centerDistance - ROAD_WIDTH/2 + .4);
  const lookCount = clamp(Math.round((8 + car.speed * .38)/distancePerPoint),7,26);
  const target = pointWithOffset(wrap(index + lookCount),car.laneOffset);
  const angleToTarget = Math.atan2(target.x-car.position.x,target.z-car.position.z);
  const error = angleDiff(angleToTarget,car.heading);
  const ahead = tangents[wrap(index + lookCount)];
  const behind = tangents[wrap(index - lookCount)];
  const curve = Math.abs(angleDiff(Math.atan2(ahead.x,ahead.z),Math.atan2(behind.x,behind.z))) / (2*lookCount*distancePerPoint);
  const cornerSpeed = Math.sqrt((33 * Math.pow(tune.grip,.85))/(curve+.023)) * (.77 + tune.steering*.22);
  let targetSpeed = Math.min(tune.topSpeed,cornerSpeed);
  if (car.offroad > 0) targetSpeed = Math.min(targetSpeed, 11 / (1+car.offroad*.045));
  const acceleration = tune.power * .093 * Math.pow(100/tune.mass,.75);
  const brakes = 10 + tune.grip*9;
  car.speed += (car.speed < targetSpeed ? acceleration : -brakes) * dt;
  car.speed -= car.speed*.013*dt;
  car.speed = clamp(car.speed,0,tune.topSpeed);
  const turnRate = (0.75 + 1.23*tune.steering) * Math.pow(tune.grip,.8) / (.65 + car.speed*.035);
  car.heading += clamp(error*2.9,-turnRate,turnRate)*dt;
  car.position.x += Math.sin(car.heading)*car.speed*dt;
  car.position.z += Math.cos(car.heading)*car.speed*dt;
  if (car.offroad > 2) car.speed *= (1 - Math.min(car.offroad*.027,.3)*dt);
  car.visual.position.set(car.position.x,.09 + Math.sin(elapsed*12+car.id)*.018,car.position.z);
  car.visual.rotation.y = car.heading;
  for (const wheel of car.wheelParts) wheel.rotation.x += car.speed*dt*.5;
}
function simulate(dt) {
  elapsed += dt;
  cars.forEach(car => drive(car,dt));
  for (let i = 0; i < cars.length; i++) {
    for (let j = i+1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.finished || b.finished) continue;
      const dx = a.position.x-b.position.x, dz = a.position.z-b.position.z;
      const distance = Math.hypot(dx,dz);
      if (distance > .05 && distance < 2.75) {
        const push = (2.75-distance)*.28;
        a.position.x += dx/distance*push;
        a.position.z += dz/distance*push;
        b.position.x -= dx/distance*push;
        b.position.z -= dz/distance*push;
        a.speed *= .994;
        b.speed *= .994;
      }
    }
  }
}
function rankCars() {
  return [...cars].sort((a,b) => {
    if (a.finished && b.finished) return a.finishedAt-b.finishedAt;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return (b.lap*POINT_COUNT+b.index) - (a.lap*POINT_COUNT+a.index);
  });
}
function renderCarCards() {
  $('car-list').innerHTML = cars.map(car => '<button type="button" class="car-card ' + (car.id===selected?'active':'') + '" data-car="' + car.id + '" aria-pressed="' + (car.id===selected) + '">' +
    '<span class="car-art"><span class="wheels"></span><span class="car-top" style="background:' + car.color + '"></span></span>' +
    '<span class="car-name">' + car.name + '</span><span class="car-number">' + car.code + '</span></button>').join('');
}
function renderTuners() {
  const car = cars[selected];
  $('selected-name').textContent = car.name;
  $('selected-desc').textContent = car.code;
  $('selected-color').style.backgroundColor = car.color;
  $('tuners').innerHTML = TUNERS.map(t => {
    const val = car.tune[t.key], fill = (val-t.min)/(t.max-t.min)*100;
    return '<div class="tune-row"><div class="tune-line"><label for="tune-' + t.key + '">' + t.label + '</label>' +
      '<output id="val-' + t.key + '">' + Number(val.toFixed(2)) + (t.unit?' '+t.unit:'') + '</output></div>' +
      '<input type="range" id="tune-' + t.key + '" data-tune="' + t.key + '" min="' + t.min + '" max="' + t.max +
      '" step="' + t.step + '" value="' + val + '" style="--fill:' + fill + '%"><div class="tune-description">' + t.desc + '</div></div>';
  }).join('');
}
function selectCar(id) {
  if (!Number.isInteger(id) || id < 0 || id >= cars.length) return;
  selected = id;
  renderCarCards();
  renderTuners();
  updateDashboard();
}
function syncControls() {
  const label = mode==='running' ? 'METTRE EN PAUSE' : (mode==='paused' ? 'REPRENDRE LA COURSE' : mode==='finished' ? 'REJOUER LA COURSE' : 'LANCER LA COURSE');
  $('start-label').textContent = label;
  $('play-icon').textContent = mode==='running' ? 'Ⅱ' : '▶';
  const labels = {idle:'EN ATTENTE',running:'COURSE EN COURS',paused:'EN PAUSE',finished:'COURSE TERMINÉE'};
  $('session-state').textContent = labels[mode];
  $('session-indicator').parentElement.classList.toggle('running',mode==='running');
}
function updateDashboard() {
  const ordered = rankCars();
  $('leaderboard').innerHTML = ordered.map((car,position) => {
    const detail = car.finished ? '<span class="leader-finish">' + lapTime(car.finishedAt) + '</span><br><small>TERMINÉ</small>' :
      '<span>' + Math.min(car.lap+1,LAPS) + ' / ' + LAPS + ' TOUR</span><br><small>' + Math.round(car.speed*3.6) + ' km/h</small>';
    return '<div class="leader-row ' + (car.id===selected?'is-selected':'') + '"><span class="leader-place">' + (position+1) + '</span>' +
      '<span class="leader-color" style="background:' + car.color + '"></span><span class="leader-name">' + car.name +
      '</span><span class="leader-details">' + detail + '</span></div>';
  }).join('');
  const car = cars[selected];
  const kph = Math.round(car.speed*3.6);
  $('tele-speed').textContent = kph;
  $('speed-meter').style.width = Math.min(100,kph/(42*3.6)*100) + '%';
  $('tele-lap').textContent = Math.min(car.lap,LAPS) + ' / ' + LAPS;
  $('tele-offset').textContent = car.offroad.toFixed(1) + ' m';
  $('tele-note').textContent = car.finished ? 'Voiture arrivée. Comparez son chrono aux autres.' :
    car.offroad > 3 ? 'Attention : sortie de piste ! Essayez plus d’adhérence ou une direction moins nerveuse.' :
    car.speed > 18 ? 'En pleine course. Observez le comportement dans les prochains virages.' :
    'Les réglages modifient la vitesse, les freinages et les trajectoires.';
  $('timer').textContent = lapTime(elapsed);
}
function toggleRace() {
  if (mode==='finished') resetRace();
  mode = mode==='running' ? 'paused' : 'running';
  syncControls();
}
$('car-list').addEventListener('click', e => {
  const button = e.target.closest('[data-car]');
  if (button) selectCar(Number(button.dataset.car));
});
$('tuners').addEventListener('input', e => {
  const key = e.target.dataset.tune;
  if (!key) return;
  const def = TUNERS.find(x => x.key===key);
  if (!def) return;
  const value = clamp(Number(e.target.value),def.min,def.max);
  cars[selected].tune[key] = value;
  e.target.style.setProperty('--fill', (value-def.min)/(def.max-def.min)*100 + '%');
  $('val-'+key).textContent = Number(value.toFixed(2)) + (def.unit ? ' '+def.unit : '');
  saveGarage();
});
$('reset-tune').addEventListener('click', () => {
  cars[selected].tune = { ...CAR_PRESETS[selected].tune };
  saveGarage(); renderTuners(); toast('Réglages d’origine restaurés.');
});
$('randomize').addEventListener('click', () => {
  const current = cars[selected];
  for (const tune of TUNERS) {
    const slots = Math.round((tune.max-tune.min)/tune.step);
    current.tune[tune.key] = Number((tune.min+Math.floor(Math.random()*(slots+1))*tune.step).toFixed(2));
  }
  saveGarage(); renderTuners(); toast('Configuration expérimentale créée !');
});
$('start-button').addEventListener('click',toggleRace);
$('reset-race').addEventListener('click',() => { resetRace(); toast('Circuit réinitialisé. Prêt pour un nouvel essai.'); });
document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click',() => {
  simSpeed = Number(button.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach(el=>el.classList.toggle('active',el===button));
}));
document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click',() => {
  cameraMode = button.dataset.camera;
  document.querySelectorAll('[data-camera]').forEach(el=>el.classList.toggle('active',el===button));
}));
$('export').addEventListener('click', () => {
  const payload = {app:'TinyTorque',version:1,cars:cars.map(c => ({name:c.name,tune:c.tune}))};
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href=url; anchor.download='tinytorque-garage.json';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  URL.revokeObjectURL(url);
  toast('Profil du garage exporté.');
});
$('import').addEventListener('click',() => $('file-input').click());
$('file-input').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 50000) throw new Error('Fichier trop volumineux');
    const payload = JSON.parse(await file.text());
    if (payload.app!=='TinyTorque' || !Array.isArray(payload.cars) || payload.cars.length!==cars.length) throw new Error('Format de garage inconnu');
    payload.cars.forEach((entry,i) => { cars[i].tune = sanitizeTune(entry.tune,CAR_PRESETS[i].tune); });
    saveGarage(); renderTuners(); toast('Quatre voitures importées avec succès.');
  } catch (err) { toast('Import refusé : ' + err.message); }
  e.target.value='';
});
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select,button')) return;
  if (e.code==='Space') { e.preventDefault(); toggleRace(); }
  if (e.key==='r' || e.key==='R') resetRace();
  if (['1','2','3','4'].includes(e.key)) selectCar(Number(e.key)-1);
});

function updateCamera(dt) {
  const selectedCar = cars[selected];
  const forward = new THREE.Vector3(Math.sin(selectedCar.heading),0,Math.cos(selectedCar.heading));
  const cameraPosition = new THREE.Vector3();
  const target = new THREE.Vector3();
  cameraOrbit += dt*.06;
  if (cameraMode==='follow') {
    cameraPosition.copy(selectedCar.position).addScaledVector(forward,-20).add(new THREE.Vector3(0,11,0));
    target.copy(selectedCar.position).addScaledVector(forward,12).add(new THREE.Vector3(0,1.4,0));
  } else if (cameraMode==='top') {
    cameraPosition.set(0,185,.001);
    target.set(0,0,0);
  } else {
    cameraPosition.set(Math.sin(.68+cameraOrbit)*136,97,Math.cos(.68+cameraOrbit)*135);
    target.set(0,0,2);
  }
  const blend = 1 - Math.exp(-dt*(cameraMode==='follow'?4:1.9));
  camera.position.lerp(cameraPosition,blend);
  cameraTarget.lerp(target,blend);
  camera.lookAt(cameraTarget);
}
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w,h,false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
window.addEventListener('resize',resize);
resize();
renderCarCards();
renderTuners();
resetRace();
const clock = new THREE.Clock();
let lastUiUpdate = 0, fpsTime = 0, frames = 0;
function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(clock.getDelta(),.055);
  if (mode==='running') {
    timeAccumulator += realDt*simSpeed;
    let steps=0;
    while (timeAccumulator>=STEP && steps<15 && mode==='running') {
      simulate(STEP); timeAccumulator-=STEP; steps++;
    }
    if (steps===15) timeAccumulator=Math.min(timeAccumulator,STEP*2);
  }
  updateCamera(realDt);
  renderer.render(scene,camera);
  fpsTime += realDt; frames++;
  if (fpsTime>=1) {
    $('fps-display').textContent = Math.round(frames/fpsTime) + ' FPS · WEBGL';
    fpsTime=0;frames=0;
  }
  lastUiUpdate+=realDt;
  if (lastUiUpdate>=.16) {updateDashboard();lastUiUpdate=0;}
}
frame();
