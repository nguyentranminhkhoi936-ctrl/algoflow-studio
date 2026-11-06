// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/engine3d.js
// Mô tả: Động cơ đồ họa Three.js WebGL Isometric 3D (Scene, OrthographicCamera,
//        OrbitControls, 6 mô-đun kiến trúc 3D v6.1 GATEWAY / PROCESS / DECISION /
//        I-O SPIRE / STORAGE / LOOP, Viên nang dữ liệu & Điều khiển Camera 3D/2D).
// ============================================================================

// =========================================================================
// 2. THREE.JS ISOMETRIC CITY ENGINE STATE
// =========================================================================
let scene, camera, renderer, controls, raycaster, mouseVec;
let cityGroup,
  buildingsGroup,
  roadsGroup,
  voxelWarehouseGroup,
  pulseParticlesGroup;
let dataCapsuleMesh, dataCapsuleLight, dataCapsuleRing;
let buildingMeshesMap = {}; // nodeId -> THREE.Object3D
let animatedRotators = []; // Gears, torus rings, beacons
let roadPulseItems = []; // Animated energy spheres along loop highways
// isTopDown2D được quản lý tập trung tại AppState.isTopDown2D

// Smooth camera & capsule interpolation targets
let cameraTargetGoal = new THREE.Vector3(0, 20, 0);
let capsuleAnim = {
  moving: false,
  points: [],
  progress: 0,
  speed: 0.045,
  color: 0x38bdf8,
};

// Map 2D graph coordinates (x, y, layer) into 3D Isometric World Coordinates
function graphToWorld3D(node, layerMap = {}) {
  const layer = layerMap[node.id] || 0;
  const wx = (node.x - 320) * 0.95;
  const wz = (node.y - 260) * 0.92;
  const wy = layer * LAYER_HEIGHT_3D;
  return new THREE.Vector3(wx, wy, wz);
}


// =========================================================================
// 4. INITIALIZE THREE.JS SCENE, ORTHOGRAPHIC CAMERA & CONTROLS
// =========================================================================
function initThreeCity() {
  const mount = document.getElementById("threeCanvasMount");
  const width = mount.clientWidth || 800;
  const height = mount.clientHeight || 600;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b14);
  scene.fog = new THREE.FogExp2(0x090b14, 0.00065);

  // Isometric Orthographic Camera
  const aspect = width / height;
  const frustumSize = 540;
  camera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    -2000,
    3500,
  );
  camera.position.set(340, 330, 340);
  camera.lookAt(0, 20, 0);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.innerHTML = "";
  mount.appendChild(renderer.domElement);

  // OrbitControls with Isometric constraints
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.06; // Prevent going under the city floor
  controls.minPolarAngle = 0.05;
  controls.minZoom = 0.45;
  controls.maxZoom = 2.8;
  controls.target.set(0, 20, 0);

  // Lighting (Tokyo Night Cyber-Minimalism)
  const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.72);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x93c5fd, 0.95);
  dirLight.position.set(220, 420, 180);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0xc084fc, 0.45);
  rimLight.position.set(-240, 180, -200);
  scene.add(rimLight);

  // City Floor Grid & Cyber Foundation Platform
  cityGroup = new THREE.Group();
  scene.add(cityGroup);

  const floorGeo = new THREE.PlaneGeometry(1800, 1800);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e1a,
    roughness: 0.9,
    metalness: 0.1,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -2;
  floorMesh.receiveShadow = true;
  cityGroup.add(floorMesh);

  const gridHelper = new THREE.GridHelper(1400, 56, 0x3b4261, 0x1a1f33);
  gridHelper.position.y = -1;
  cityGroup.add(gridHelper);

  buildingsGroup = new THREE.Group();
  roadsGroup = new THREE.Group();
  voxelWarehouseGroup = new THREE.Group();
  pulseParticlesGroup = new THREE.Group();
  cityGroup.add(buildingsGroup);
  cityGroup.add(roadsGroup);
  cityGroup.add(voxelWarehouseGroup);
  cityGroup.add(pulseParticlesGroup);

  // Create the 3D Data Capsule (Particle Flow Vehicle)
  createDataCapsule3D();

  // Touch & Mouse Configuration for OrbitControls
  if (THREE.TOUCH) {
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
  }

  // Raycaster for 3D Building Selection & 2D Floorplan Drag & Drop
  raycaster = new THREE.Raycaster();
  mouseVec = new THREE.Vector2();

  initViewportPointerAndTouchInteractions();
  window.addEventListener("resize", onResizeCityViewport);
}

// 2D Drag & Drop State & Touch/Mouse Interaction Handler
let draggingBuildingState = {
  active: false,
  nodeId: null,
  planeY: 0,
  offsetX: 0,
  offsetZ: 0,
  moved: false,
  historySaved: false,
};

function createDataCapsule3D() {
  const group = new THREE.Group();
  const coreGeo = new THREE.SphereGeometry(8.5, 24, 24);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  const ringGeo = new THREE.TorusGeometry(13, 1.4, 12, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  dataCapsuleRing = new THREE.Mesh(ringGeo, ringMat);
  dataCapsuleRing.rotation.x = Math.PI / 2;
  group.add(dataCapsuleRing);

  dataCapsuleLight = new THREE.PointLight(0x38bdf8, 2.2, 130);
  group.add(dataCapsuleLight);

  group.visible = false;
  dataCapsuleMesh = group;
  dataCapsuleMesh.userData.coreMat = coreMat;
  scene.add(dataCapsuleMesh);
}

function onResizeCityViewport() {
  const mount = document.getElementById("threeCanvasMount");
  if (!mount || !renderer || !camera) return;
  const width = mount.clientWidth || 800;
  const height = mount.clientHeight || 600;
  const aspect = width / height;
  const frustumSize = 540;

  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// =========================================================================
// 5. BUILD 3D ARCHITECTURAL STRUCTURES & ELEVATED HIGHWAYS
// =========================================================================
const BUILDING_PALETTE = {
  start: {
    color: 0x73daca,
    emissive: 0x114b43,
    label: "● BẮT ĐẦU (START)",
  },
  end: { color: 0xf7768e, emissive: 0x521926, label: "■ KẾT THÚC (END)" },
  input: {
    color: 0xbb9af7,
    emissive: 0x36245c,
    label: "/ NHẬP DỮ LIỆU (CIN) /",
  },
  output: {
    color: 0x9ece6a,
    emissive: 0x2c4716,
    label: "/ XUẤT DỮ LIỆU (COUT) /",
  },
  process: {
    color: 0x7aa2f7,
    emissive: 0x1d3166,
    label: "[ XỬ LÝ / GÁN GIÁ TRỊ ]",
  },
  decision: {
    color: 0xe0af68,
    emissive: 0x543a14,
    label: "< ĐIỀU KIỆN RẼ NHÁNH >",
  },
  subroutine: {
    color: 0x2ac3de,
    emissive: 0x0f4957,
    label: "[| GỌI HÀM CON (FUNCTION) |]",
  },
  return: {
    color: 0xff9e64,
    emissive: 0x592d12,
    label: "↩ TRẢ VỀ (RETURN)",
  },
  connector: {
    color: 0xc0caf5,
    emissive: 0x2e344d,
    label: "◯ ĐIỂM NỐI LUỒNG",
  },
};

// Deep VRAM cleanup utility for Three.js hierarchy
function disposeHierarchy(obj) {
  if (!obj) return;
  for (let i = obj.children.length - 1; i >= 0; i--) {
    disposeHierarchy(obj.children[i]);
  }
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material))
      obj.material.forEach((m) => m && m.dispose());
    else obj.material.dispose();
  }
  if (obj.parent) obj.parent.remove(obj);
}

function rebuild3DCityScene() {
  if (!buildingsGroup || !roadsGroup) return;

  // Thoroughly dispose VRAM geometries & materials for all 4 scene groups
  disposeHierarchy(buildingsGroup);
  disposeHierarchy(roadsGroup);
  disposeHierarchy(voxelWarehouseGroup);
  disposeHierarchy(pulseParticlesGroup);
  cityGroup.add(buildingsGroup);
  cityGroup.add(roadsGroup);
  cityGroup.add(voxelWarehouseGroup);
  cityGroup.add(pulseParticlesGroup);

  buildingMeshesMap = {};
  animatedRotators = [];
  roadPulseItems = [];

  const g = currGraph();
  if (!g) return;
  const { nodes, edges } = g;
  const backEdgeIds = detectBackEdges(nodes, edges);
  const lintReport = runSemanticLinter(nodes, edges);
  window.__lastLint = lintReport;
  const layerMap = computeNodeElevationLayers(nodes, edges);

  // Update max layer badge
  const maxLayer = Math.max(0, ...Object.values(layerMap));
  const maxLayerEl = document.getElementById("maxLayerBadge");
  if (maxLayerEl) maxLayerEl.textContent = `Cao: L${maxLayer}`;

  // 1. Construct 3D Buildings
  nodes.forEach((node) => {
    const pos3D = graphToWorld3D(node, layerMap);
    const layer = layerMap[node.id] || 0;
    const isSel = node.id === selectedNodeId;
    const isTrace =
      traceState.active && traceState.currNodeId === node.id;
    const hasErr = lintReport.errorNodeIds.has(node.id);

    const bGroup = createBuildingMeshForNode(
      node,
      pos3D,
      layer,
      isSel,
      isTrace,
      hasErr,
    );
    buildingsGroup.add(bGroup);
    buildingMeshesMap[node.id] = bGroup;
  });

  // 2. Construct 3D Orthogonal Neon Roads & Highway Loop Back-Edges
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  let backEdgeIndex = 0;

  edges.forEach((edge) => {
    const u = nodeMap[edge.source];
    const v = nodeMap[edge.target];
    if (!u || !v) return;

    const p1 = graphToWorld3D(u, layerMap);
    const p2 = graphToWorld3D(v, layerMap);
    const isBack = backEdgeIds.has(edge.id) || v.y <= u.y;

    let roadColor = 0x7aa2f7;
    if (isBack) roadColor = 0xe0af68;
    else if (edge.branch === "true") roadColor = 0x9ece6a;
    else if (edge.branch === "false") roadColor = 0xf7768e;

    const pathPoints = compute3DRoadWaypoints(
      u,
      v,
      p1,
      p2,
      edge.branch,
      isBack,
      backEdgeIndex,
    );
    if (isBack) backEdgeIndex++;

    const curve = new THREE.CatmullRomCurve3(
      pathPoints,
      false,
      "catmullrom",
      0.12,
    );
    const tubeGeo = new THREE.TubeGeometry(
      curve,
      32,
      isBack ? 2.1 : 1.7,
      8,
      false,
    );
    const tubeMat = new THREE.MeshStandardMaterial({
      color: roadColor,
      emissive: roadColor,
      emissiveIntensity: isBack ? 0.65 : 0.4,
      roughness: 0.3,
      metalness: 0.6,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.userData = { edgeId: edge.id, pathPoints, roadColor };
    roadsGroup.add(tubeMesh);

    // Direction Arrow Cone near target
    if (pathPoints.length >= 2) {
      const lastPt = pathPoints[pathPoints.length - 1];
      const prevPt = pathPoints[pathPoints.length - 2];
      const dir = new THREE.Vector3()
        .subVectors(lastPt, prevPt)
        .normalize();
      const arrowPos = new THREE.Vector3().lerpVectors(
        prevPt,
        lastPt,
        0.72,
      );
      const coneGeo = new THREE.ConeGeometry(4.2, 10, 10);
      const coneMat = new THREE.MeshBasicMaterial({ color: roadColor });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(arrowPos);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      roadsGroup.add(cone);
    }

    // Animated Energy Pulse for Loop Back-Edges
    if (isBack) {
      const pulseGeo = new THREE.SphereGeometry(3.8, 12, 12);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const pulseOrb = new THREE.Mesh(pulseGeo, pulseMat);
      pulseParticlesGroup.add(pulseOrb);
      roadPulseItems.push({
        mesh: pulseOrb,
        curve: curve,
        t: (backEdgeIndex * 0.33) % 1.0,
      });
    }
  });

  // 3. Rebuild 3D Voxel Array Warehouse
  rebuildVoxelArrayWarehouse3D();

  // 4. Rebuild Crisp 2D Projected HTML HUD Badges
  buildHudOverlayElements(nodes, layerMap, lintReport.errorNodeIds);
}

function createBuildingMeshForNode(
  node,
  pos3D,
  layer,
  isSel,
  isTrace,
  hasErr,
) {
  const group = new THREE.Group();
  group.position.copy(pos3D);
  group.userData = { nodeId: node.id, layer };

  const pal = BUILDING_PALETTE[node.type] || BUILDING_PALETTE.process;

  // Support Pillar & Elevated Platform if Layer > 0
  if (layer > 0) {
    const pillarHeight = pos3D.y;
    const pillarGeo = new THREE.CylinderGeometry(5, 7, pillarHeight, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      roughness: 0.7,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = -pillarHeight / 2;
    group.add(pillar);

    // Glowing level rings on the support column
    for (let l = 1; l <= layer; l++) {
      const ringGeo = new THREE.TorusGeometry(8, 0.8, 8, 20);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -pillarHeight + l * LAYER_HEIGHT_3D - 2;
      group.add(ring);
    }
  }

  // Base Pad under every building
  const padGeo = new THREE.BoxGeometry(
    node.type === "connector" ? 28 : 54,
    4,
    node.type === "connector" ? 28 : 38,
  );
  const padMat = new THREE.MeshStandardMaterial({
    color: isTrace
      ? 0xe0af68
      : isSel
        ? 0x7aa2f7
        : hasErr
          ? 0xf7768e
          : 0x1e2438,
    emissive: isTrace
      ? 0x92400e
      : isSel
        ? 0x1e3a8a
        : hasErr
          ? 0x881337
          : 0x090d16,
    roughness: 0.4,
    metalness: 0.6,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 2;
  pad.userData = { nodeId: node.id };
  group.add(pad);

  // Selection / Active Trace Neon Halo Ring
  if (isSel || isTrace || node.bp) {
    const haloColor = isTrace ? 0xfbbf24 : node.bp ? 0xf43f5e : 0x38bdf8;
    const haloGeo = new THREE.TorusGeometry(34, 1.4, 12, 36);
    const haloMat = new THREE.MeshBasicMaterial({ color: haloColor });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.5;
    group.add(halo);
    animatedRotators.push({ mesh: halo, axis: "z", speed: 0.025 });
  }

  // Building Type-Specific Architecture
  const mainMat = new THREE.MeshStandardMaterial({
    color: pal.color,
    emissive: pal.emissive,
    roughness: 0.25,
    metalness: 0.45,
  });

  if (node.type === "start" || node.type === "end") {
    // Dome Portal
    const cylGeo = new THREE.CylinderGeometry(18, 22, 10, 20);
    const cyl = new THREE.Mesh(cylGeo, mainMat);
    cyl.position.y = 9;
    cyl.userData = { nodeId: node.id };
    group.add(cyl);

    const domeGeo = new THREE.SphereGeometry(
      16,
      20,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const domeMat = new THREE.MeshBasicMaterial({
      color: pal.color,
      wireframe: false,
      transparent: true,
      opacity: 0.85,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 14;
    dome.userData = { nodeId: node.id };
    group.add(dome);

    const portalRingGeo = new THREE.TorusGeometry(20, 1.2, 10, 28);
    const portalRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const portalRing = new THREE.Mesh(portalRingGeo, portalRingMat);
    portalRing.position.y = 20;
    group.add(portalRing);
    animatedRotators.push({ mesh: portalRing, axis: "y", speed: 0.035 });
  } else if (node.type === "decision") {
    // Hexagonal Traffic Control Tower + True/False Gates
    const hexGeo = new THREE.CylinderGeometry(20, 23, 24, 6);
    const hex = new THREE.Mesh(hexGeo, mainMat);
    hex.position.y = 16;
    hex.userData = { nodeId: node.id };
    group.add(hex);

    // Scanner Beacon on top
    const beaconGeo = new THREE.OctahedronGeometry(7, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      wireframe: true,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 35;
    group.add(beacon);
    animatedRotators.push({ mesh: beacon, axis: "y", speed: 0.045 });

    // Left Gate (True - Green) & Right Gate (False - Red)
    const gateGeo = new THREE.BoxGeometry(6, 8, 6);
    const trueGate = new THREE.Mesh(
      gateGeo,
      new THREE.MeshBasicMaterial({ color: 0x9ece6a }),
    );
    trueGate.position.set(-18, 8, 14);
    group.add(trueGate);

    const falseGate = new THREE.Mesh(
      gateGeo,
      new THREE.MeshBasicMaterial({ color: 0xf7768e }),
    );
    falseGate.position.set(18, 8, 14);
    group.add(falseGate);
  } else if (node.type === "subroutine") {
    // Tall Telecom Tower with Laser Spire
    const baseGeo = new THREE.CylinderGeometry(14, 19, 32, 12);
    const tower = new THREE.Mesh(baseGeo, mainMat);
    tower.position.y = 20;
    tower.userData = { nodeId: node.id };
    group.add(tower);

    const spireGeo = new THREE.CylinderGeometry(1.5, 3, 22, 8);
    const spireMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 44;
    group.add(spire);

    const waveGeo = new THREE.TorusGeometry(11, 0.9, 8, 24);
    const wave = new THREE.Mesh(waveGeo, spireMat);
    wave.rotation.x = Math.PI / 2;
    wave.position.y = 48;
    group.add(wave);
    animatedRotators.push({ mesh: wave, axis: "z", speed: 0.05 });
  } else if (node.type === "input" || node.type === "output") {
    // Cyber Data Dock
    const dockGeo = new THREE.BoxGeometry(42, 16, 26);
    const dock = new THREE.Mesh(dockGeo, mainMat);
    dock.position.y = 12;
    dock.userData = { nodeId: node.id };
    group.add(dock);

    // Glowing cargo strips
    const stripGeo = new THREE.BoxGeometry(34, 2.5, 6);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 21, 0);
    group.add(strip);
  } else if (node.type === "connector" || node.type === "return") {
    // Compact Relay Hub
    const hubGeo = new THREE.OctahedronGeometry(11, 1);
    const hub = new THREE.Mesh(hubGeo, mainMat);
    hub.position.y = 16;
    hub.userData = { nodeId: node.id };
    group.add(hub);
    animatedRotators.push({ mesh: hub, axis: "y", speed: 0.03 });
  } else {
    // Process Node: Industrial Factory Block + Rotating Energy Core
    const boxGeo = new THREE.BoxGeometry(44, 20, 28);
    const box = new THREE.Mesh(boxGeo, mainMat);
    box.position.y = 14;
    box.userData = { nodeId: node.id };
    group.add(box);

    // Roof Energy Core
    const gearGeo = new THREE.OctahedronGeometry(6.5, 0);
    const gearMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
    const gear = new THREE.Mesh(gearGeo, gearMat);
    gear.position.set(0, 30, 0);
    group.add(gear);
    animatedRotators.push({ mesh: gear, axis: "y", speed: 0.04 });
  }

  return group;
}

// Compute 3D Orthogonal / Elevated Highway Waypoints with Obstacle Avoidance
function compute3DRoadWaypoints(
  u,
  v,
  p1,
  p2,
  branch,
  isBack,
  backEdgeIndex,
) {
  const startPt = p1.clone().add(new THREE.Vector3(0, 8, 12));
  if (u.type === "decision") {
    if (branch === "true") startPt.x -= 16;
    if (branch === "false") startPt.x += 16;
  }
  const endPt = p2.clone().add(new THREE.Vector3(0, 10, -14));

  // Gather all intermediate building bounding boxes for obstacle avoidance
  const g = currGraph();
  const obstacles = [];
  if (g && Array.isArray(g.nodes)) {
    const layerMap = computeNodeElevationLayers(g.nodes, g.edges || []);
    g.nodes.forEach((n) => {
      if (n.id === u.id || n.id === v.id) return;
      const wp = graphToWorld3D(n, layerMap);
      const roofH =
        n.type === "subroutine" ? 54 : n.type === "decision" ? 42 : 36;
      obstacles.push({
        id: n.id,
        x: wp.x,
        yMin: wp.y,
        yMax: wp.y + roofH,
        z: wp.z,
        halfW: n.type === "connector" ? 20 : 34,
        halfD: n.type === "connector" ? 20 : 26,
      });
    });
  }

  const minZ = Math.min(startPt.z, endPt.z);
  const maxZ = Math.max(startPt.z, endPt.z);
  const spanObstacles = obstacles.filter(
    (ob) => ob.z + ob.halfD >= minZ - 12 && ob.z - ob.halfD <= maxZ + 12,
  );

  if (isBack) {
    // Dedicated Outer Highway Loop Lane + Obstacle Corridor Clearance
    const laneSide = u.x <= v.x ? -1 : 1;
    let corridorX =
      laneSide < 0
        ? Math.min(startPt.x, endPt.x) - (125 + backEdgeIndex * 38)
        : Math.max(startPt.x, endPt.x) + (125 + backEdgeIndex * 38);

    let maxObstacleRoof = Math.max(p1.y, p2.y);
    spanObstacles.forEach((ob) => {
      if (Math.abs(corridorX - ob.x) < ob.halfW + 18) {
        if (laneSide < 0)
          corridorX = Math.min(
            corridorX,
            ob.x - ob.halfW - 32 - backEdgeIndex * 20,
          );
        else
          corridorX = Math.max(
            corridorX,
            ob.x + ob.halfW + 32 + backEdgeIndex * 20,
          );
      }
      if (ob.yMax > maxObstacleRoof) maxObstacleRoof = ob.yMax;
    });

    const highwayElevation = Math.max(p1.y, p2.y) + 24;

    const w1 = new THREE.Vector3(
      startPt.x + laneSide * 25,
      highwayElevation,
      startPt.z + 18,
    );
    const w2 = new THREE.Vector3(corridorX, highwayElevation, startPt.z);
    const w3 = new THREE.Vector3(corridorX, highwayElevation, endPt.z);
    const w4 = new THREE.Vector3(
      endPt.x + laneSide * 20,
      endPt.y + 8,
      endPt.z - 8,
    );
    return [startPt, w1, w2, w3, w4, endPt];
  } else {
    // Forward Edge: Check if any intermediate building intersects the direct/orthogonal path
    let midZ = (startPt.z + endPt.z) / 2;
    const segHitsObstacle = (ob) => {
      // Check Z-span of segment 1 (x = startPt.x, z in [startPt.z, midZ])
      const z1Min = Math.min(startPt.z, midZ),
        z1Max = Math.max(startPt.z, midZ);
      const hitSeg1 =
        Math.abs(startPt.x - ob.x) < ob.halfW + 8 &&
        ob.z + ob.halfD > z1Min &&
        ob.z - ob.halfD < z1Max;
      // Check X-span of middle segment (z = midZ, x in [startPt.x, endPt.x])
      const xMin = Math.min(startPt.x, endPt.x),
        xMax = Math.max(startPt.x, endPt.x);
      const hitSegMid =
        Math.abs(midZ - ob.z) < ob.halfD + 8 &&
        ob.x + ob.halfW > xMin - 8 &&
        ob.x - ob.halfW < xMax + 8;
      // Check Z-span of segment 2 (x = endPt.x, z in [midZ, endPt.z])
      const z2Min = Math.min(midZ, endPt.z),
        z2Max = Math.max(midZ, endPt.z);
      const hitSeg2 =
        Math.abs(endPt.x - ob.x) < ob.halfW + 8 &&
        ob.z + ob.halfD > z2Min &&
        ob.z - ob.halfD < z2Max;

      const minPathY = Math.min(startPt.y, endPt.y) - 6;
      const maxPathY = Math.max(startPt.y, endPt.y) + 12;
      const yOverlap = maxPathY >= ob.yMin && minPathY <= ob.yMax;
      return yOverlap && (hitSeg1 || hitSegMid || hitSeg2);
    };

    const blockingBuildings = spanObstacles.filter(segHitsObstacle);
    if (blockingBuildings.length > 0) {
      // Elevate overpass above the highest blocking roof AND curve out along X corridor
      const maxRoofY = Math.max(...blockingBuildings.map((b) => b.yMax));
      const overpassY = Math.max(startPt.y, endPt.y, maxRoofY) + 18;
      const sideDir =
        branch === "false"
          ? 1
          : branch === "true"
            ? -1
            : startPt.x <= endPt.x
              ? 1
              : -1;
      const detourOffset =
        Math.abs(startPt.x - endPt.x) < 48 ? sideDir * 64 : 0;

      const o1 = new THREE.Vector3(
        startPt.x + detourOffset * 0.6,
        overpassY,
        startPt.z + (endPt.z - startPt.z) * 0.22,
      );
      const o2 = new THREE.Vector3(
        (startPt.x + endPt.x) / 2 + detourOffset,
        overpassY + 4,
        midZ,
      );
      const o3 = new THREE.Vector3(
        endPt.x + detourOffset * 0.6,
        overpassY,
        startPt.z + (endPt.z - startPt.z) * 0.78,
      );
      return [startPt, o1, o2, o3, endPt];
    }

    const midY = (startPt.y + endPt.y) / 2;
    const m1 = new THREE.Vector3(startPt.x, startPt.y, midZ);
    const m2 = new THREE.Vector3(endPt.x, midY, midZ);
    return [startPt, m1, m2, endPt];
  }
}

// =========================================================================
// 6. 3D VOXEL ARRAY WAREHOUSE VISUALIZER
// =========================================================================
function rebuildVoxelArrayWarehouse3D() {
  if (!voxelWarehouseGroup) return;
  disposeHierarchy(voxelWarehouseGroup);
  if (cityGroup) cityGroup.add(voxelWarehouseGroup);

  // Check active trace arrays, or parse static array literal from current graph
  let arrEntries = Object.entries(traceState.arrays);
  if (arrEntries.length === 0) {
    const g = currGraph();
    if (g) {
      g.nodes.forEach((n) => {
        const m = n.content.match(/([a-zA-Z_]\w*)\s*=\s*\[(.*?)\]/);
        if (m) {
          const vals = m[2].split(",").map((x) => Number(x.trim()) || 0);
          arrEntries.push([m[1], vals]);
        }
      });
    }
  }

  if (arrEntries.length === 0) return;

  const [arrName, arrVals] = arrEntries[0];
  const baseX = -260;
  const baseZ = -210;

  // Warehouse Platform Base
  const width = Math.max(120, arrVals.length * 42 + 40);
  const platGeo = new THREE.BoxGeometry(width, 4, 64);
  const platMat = new THREE.MeshStandardMaterial({
    color: 0x111c2d,
    emissive: 0x082f49,
    roughness: 0.5,
  });
  const plat = new THREE.Mesh(platGeo, platMat);
  plat.position.set(baseX + width / 2 - 30, 0, baseZ);
  voxelWarehouseGroup.add(plat);

  const maxVal = Math.max(
    1,
    ...arrVals.map((v) => Math.abs(Number(v) || 1)),
  );

  arrVals.forEach((val, idx) => {
    const numVal = Number(val) || 1;
    const h = Math.max(10, (Math.abs(numVal) / maxVal) * 68);
    const isI = traceState.vars.i === idx;
    const isJ = traceState.vars.j === idx;

    const voxGeo = new THREE.BoxGeometry(26, h, 26);
    const voxMat = new THREE.MeshStandardMaterial({
      color: isI ? 0xf59e0b : isJ ? 0xec4899 : 0x38bdf8,
      emissive: isI ? 0x78350f : isJ ? 0x831843 : 0x0c4a6e,
      roughness: 0.25,
      metalness: 0.5,
    });
    const vox = new THREE.Mesh(voxGeo, voxMat);
    const vx = baseX + idx * 42;
    vox.position.set(vx, h / 2 + 2, baseZ);
    voxelWarehouseGroup.add(vox);

    // Glowing 3D Pointer Cone above indexed element (i or j)
    if (isI || isJ) {
      const ptrGeo = new THREE.ConeGeometry(7, 16, 8);
      const ptrMat = new THREE.MeshBasicMaterial({
        color: isI ? 0xfde047 : 0xf472b6,
      });
      const ptr = new THREE.Mesh(ptrGeo, ptrMat);
      ptr.rotation.x = Math.PI; // Point downward
      ptr.position.set(vx, h + 20, baseZ);
      voxelWarehouseGroup.add(ptr);
    }
  });
}


// =========================================================================
// 8. ANIMATION LOOP (Rotating Cores, Highway Pulses, Capsule & Drone)
// =========================================================================
function animateCityLoop() {
  requestAnimationFrame(animateCityLoop);

  // Rotate building beacons, gears, and rings
  animatedRotators.forEach((item) => {
    if (item.axis === "y") item.mesh.rotation.y += item.speed;
    if (item.axis === "z") item.mesh.rotation.z += item.speed;
  });

  // Animate energy pulses along loop back-edges
  roadPulseItems.forEach((item) => {
    item.t = (item.t + 0.008) % 1.0;
    const pt = item.curve.getPointAt(item.t);
    item.mesh.position.copy(pt);
  });

  // Animate 3D Data Capsule along active road
  if (capsuleAnim.moving && capsuleAnim.points.length >= 2) {
    capsuleAnim.progress += capsuleAnim.speed * capsuleSpeedMult;
    if (capsuleAnim.progress >= 1) {
      capsuleAnim.progress = 1;
      capsuleAnim.moving = false;
    }
    const curve = new THREE.CatmullRomCurve3(capsuleAnim.points);
    const pos = curve.getPointAt(capsuleAnim.progress);
    dataCapsuleMesh.position.copy(pos);
    dataCapsuleRing.rotation.z += 0.08;
  }

  // Focus Drone smooth camera target interpolation
  const droneEnabled =
    document.getElementById("focusDroneToggle")?.checked;
  if (traceState.active && droneEnabled && traceState.currNodeId) {
    const activeBuilding = buildingMeshesMap[traceState.currNodeId];
    if (activeBuilding) {
      cameraTargetGoal.copy(activeBuilding.position);
      controls.target.lerp(
        cameraTargetGoal,
        Math.min(0.5, 0.06 * capsuleSpeedMult),
      );
    }
  }

  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    updateHudPositions();
  }
}

// Camera Controls Helpers (2D Drag & Drop Mode <-> 3D Isometric Free Rotate Mode)
function toggleCameraProjectionAngle() {
  isTopDown2D = !isTopDown2D;
  const btn = document.getElementById("btnViewMode");
  const viewportEl = document.getElementById("cityViewport");
  if (isTopDown2D) {
    camera.position.set(
      controls.target.x,
      560,
      controls.target.z + 0.001,
    );
    controls.enableRotate = false;
    if (viewportEl) viewportEl.classList.add("mode-2d-active");
    if (btn) btn.textContent = "📐 Chế độ: Mặt Bằng 2D (Kéo Thả Sơ Đồ)";
    setStatusText(
      "Chế độ Mặt Bằng 2D: Nhấn giữ chuột trái lên tòa nhà để kéo thả trực tiếp!",
    );
  } else {
    camera.position.set(
      controls.target.x + 340,
      330,
      controls.target.z + 340,
    );
    controls.enableRotate = true;
    if (viewportEl) viewportEl.classList.remove("mode-2d-active");
    if (btn) btn.textContent = "🌐 Chế độ: Isometric 3D (Xoay 360°)";
    setStatusText(
      "Chế độ Isometric 3D: Giữ chuột trái xoay 360°, chuột phải trượt bản đồ.",
    );
  }
  controls.update();
}

function zoomCamera(factor) {
  if (!camera) return;
  camera.zoom = Math.min(2.8, Math.max(0.45, camera.zoom * factor));
  camera.updateProjectionMatrix();
}

function resetCameraView() {
  if (!camera || !controls) return;
  controls.target.set(0, 20, 0);
  camera.zoom = 1.0;
  camera.updateProjectionMatrix();
  if (isTopDown2D) {
    camera.position.set(0, 520, 0.01);
  } else {
    camera.position.set(340, 330, 340);
  }
  controls.update();
}

function toggleLegendDetails() {
  const body = document.getElementById("cityLegendBody");
  if (body) body.classList.toggle("hidden");
}


// =========================================================================
// 13. STEP-TRACE DEBUGGER & 3D DATA CAPSULE FLIGHT
// =========================================================================
function showCapsuleToast(text) {
  const banner = document.getElementById("capsuleActionBanner");
  const txt = document.getElementById("capsuleActionText");
  if (banner && txt) {
    txt.textContent = text;
    banner.classList.remove("hidden");
  }
}

function launchCapsuleAlongEdge(sourceId, targetId, branch) {
  if (!dataCapsuleMesh) return;
  const g = currGraph();
  const layerMap = computeNodeElevationLayers(g.nodes, g.edges);
  const u = g.nodes.find((n) => n.id === sourceId);
  const v = g.nodes.find((n) => n.id === targetId);
  if (!u || !v) return;

  const backIds = detectBackEdges(g.nodes, g.edges);
  const edgeObj = g.edges.find(
    (e) => e.source === sourceId && e.target === targetId,
  );
  const isBack = (edgeObj && backIds.has(edgeObj.id)) || v.y <= u.y;

  const p1 = graphToWorld3D(u, layerMap);
  const p2 = graphToWorld3D(v, layerMap);
  const pts = compute3DRoadWaypoints(u, v, p1, p2, branch, isBack, 0);

  let col = 0x38bdf8;
  if (branch === "true") col = 0x10b981;
  else if (branch === "false") col = 0xf43f5e;
  else if (isBack) col = 0xf59e0b;

  dataCapsuleMesh.visible = true;
  dataCapsuleMesh.userData.coreMat.color.setHex(col);
  dataCapsuleLight.color.setHex(col);

  capsuleAnim.points = pts;
  capsuleAnim.progress = 0;
  capsuleAnim.moving = true;
}

// ---------- Tính năng 4: tốc độ viên nang ----------
function setCapsuleSpeed(v) {
  capsuleSpeedMult = Math.min(4, Math.max(0.5, Number(v) || 1));
  const b = $id("capsuleSpeedBadge");
  if (b) b.textContent = capsuleSpeedMult.toFixed(1) + "x";
  bittoSay(
    `Tốc độ viên nang: ${capsuleSpeedMult.toFixed(1)}x`,
    null,
    1800,
  );
}

// Override toggleCameraProjectionAngle to configure 2D free-form panning & grab cursor
const _origToggleCameraProjection = toggleCameraProjectionAngle;
toggleCameraProjectionAngle = function () {
  _origToggleCameraProjection();
  const vp = document.getElementById("cityViewport");
  if (isTopDown2D) {
    if (vp) vp.classList.add("canvas-pan-ready");
    if (controls && THREE.MOUSE) {
      controls.enableRotate = false;
      controls.enablePan = false; // Handled by our precision 1:1 FreeCanvasPan with inertia
    }
    setStatusText(
      "Chế độ Mặt Bằng 2D: Click & kéo chuột trên nền trống để di chuyển tự do (Pan) • Cuộn chuột để Zoom theo con trỏ!",
    );
  } else {
    if (vp) {
      vp.classList.remove("canvas-pan-ready", "canvas-pan-active");
    }
    if (controls && THREE.MOUSE) {
      controls.enableRotate = true;
      controls.enablePan = true;
    }
  }
  updateZoomBadgeUI();
};

// Override zoomCamera and resetCameraView to clamp [0.2x .. 2.5x] and sync #zoomPercentBadge
zoomCamera = function (factor, pivotClientX = null, pivotClientY = null) {
  if (!camera || !controls) return;
  const mount = document.getElementById("threeCanvasMount");
  const hasPivot =
    pivotClientX !== null && pivotClientY !== null && mount;

  let beforeWorld = null;
  if (hasPivot) {
    beforeWorld = getWorldPointOnHorizontalPlane(
      pivotClientX,
      pivotClientY,
      0,
    );
  }

  camera.zoom = Math.min(2.5, Math.max(0.2, camera.zoom * factor));
  camera.updateProjectionMatrix();

  if (hasPivot && beforeWorld) {
    const afterWorld = getWorldPointOnHorizontalPlane(
      pivotClientX,
      pivotClientY,
      0,
    );
    if (afterWorld) {
      const dx = beforeWorld.x - afterWorld.x;
      const dz = beforeWorld.z - afterWorld.z;
      camera.position.x += dx;
      camera.position.z += dz;
      controls.target.x += dx;
      controls.target.z += dz;
    }
  }

  controls.update();
  updateHudPositions();
  updateZoomBadgeUI();
  sync2DGridBackgroundWithCamera();
};

const _origResetCameraView = resetCameraView;
resetCameraView = function () {
  FreeCanvasPan.velX = 0;
  FreeCanvasPan.velZ = 0;
  FreeCanvasPan.inertiaActive = false;

  // Compute bounding center of current diagram nodes so centering frames the diagram
  const g = currGraph();
  let centerWX = 0;
  let centerWZ = 0;
  if (g && Array.isArray(g.nodes) && g.nodes.length > 0) {
    const layerMap = computeNodeElevationLayers(g.nodes, g.edges || []);
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    g.nodes.forEach((n) => {
      const p = graphToWorld3D(n, layerMap);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    });
    centerWX = (minX + maxX) / 2;
    centerWZ = (minZ + maxZ) / 2;
  }

  if (!camera || !controls) return;
  controls.target.set(centerWX, 20, centerWZ);
  camera.zoom = 1.0;
  camera.updateProjectionMatrix();
  if (isTopDown2D) {
    camera.position.set(centerWX, 560, centerWZ + 0.001);
  } else {
    camera.position.set(centerWX + 340, 330, centerWZ + 340);
  }
  controls.update();
  updateHudPositions();
  updateZoomBadgeUI();
  sync2DGridBackgroundWithCamera();
  setStatusText("Đã đặt lại tỷ lệ thu phóng 100% và căn giữa sơ đồ!");
};

// =========================================================================
// GÓI 6: CHUẨN HÓA MODEL 3D THEO PHONG CÁCH THÀNH PHỐ MỚI (MINIMALIST MATTE SLATE)
// - Chất liệu chung: Matte Anodized Slate (#1a1e2e, roughness: 0.85, metalness: 0.15)
// - Chỉ phát sáng viền màu Cyan (#2ac3de) khi khối đang chạy/active
// - START / END: Viên nang nằm ngang (bo tròn 2 đầu) trên đế phẳng, viền Cyan (Start) hoặc Đỏ san hô (End)
// - PROCESS / INPUT / OUTPUT: Khối hộp chữ nhật dẹt vát cạnh trên bệ phẳng, rãnh bên hông
// - DECISION: Khối hình thoi (Octahedron/Diamond) trên đế vuông xoay 45 độ, tách 2 nhánh Xanh lục (TRUE) & Đỏ cam (FALSE)
// - LOOP: Đường ray khép kín bo tròn góc có trụ đỡ, viên nang dữ liệu di chuyển bên trên
// - FUNCTION (Subroutine): Khối tháp trụ đứng thanh mảnh có ăng-ten nhỏ trên đỉnh, cao nổi bật
// - MEMORY: Khay mảng dạng các ô vuông phẳng liền kề, ô đang truy cập nhô lên và sáng viền Cyan + Hỗ trợ Ma trận 2D & Tia con trỏ
// =========================================================================
const MATTE_SLATE_HEX = 0x1a1e2e;
const MATTE_DARK_BASE_HEX = 0x131724;
const MATTE_TRIM_HEX = 0x242a40;
const CYAN_ACTIVE_HEX = 0x2ac3de;
const CORAL_END_HEX = 0xf7768e;
const TRUE_GREEN_HEX = 0x56b886;
const FALSE_CORAL_HEX = 0xe06c5a;

// Tập hợp các khối gây lặp vô tận (TLE Stagnation) để tô đỏ trên cả 3D và HUD
let tleInfiniteNodeIds = new Set();

// Hàm tạo hình chữ nhật bo góc (Rounded Rectangle Shape) dùng cho đế và hộp vát cạnh
function createRoundedRectShape(w, d, r) {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hd = d / 2;
  const cr = Math.min(r, hw * 0.48, hd * 0.48);
  shape.moveTo(-hw + cr, -hd);
  shape.lineTo(hw - cr, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + cr);
  shape.lineTo(hw, hd - cr);
  shape.quadraticCurveTo(hw, hd, hw - cr, hd);
  shape.lineTo(-hw + cr, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - cr);
  shape.lineTo(-hw, -hd + cr);
  shape.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
  return shape;
}

// Hàm dựng khối hộp chữ nhật vát cạnh nằm ngang trên mặt phẳng XZ
function createBeveledSlabMesh(w, h, d, radius, bevelSize, material) {
  const shape = createRoundedRectShape(
    w - bevelSize * 2,
    d - bevelSize * 2,
    radius,
  );
  const extrudeSettings = {
    depth: Math.max(0.5, h - bevelSize * 2),
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: bevelSize,
    bevelThickness: bevelSize,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const minY = geo.boundingBox ? geo.boundingBox.min.y : 0;
  geo.translate(0, -minY, 0);
  return new THREE.Mesh(geo, material);
}

// Hàm dựng viền phát sáng (Glowing Rim) dọc theo chu vi đế bo tròn
function createStadiumGlowRing(w, d, r, tubeRadius, colorHex) {
  const shape = createRoundedRectShape(w, d, r);
  const pts2d = shape.getPoints(36);
  const pts3d = pts2d.map((p) => new THREE.Vector3(p.x, 0, p.y));
  pts3d.push(pts3d[0].clone());
  const curve = new THREE.CatmullRomCurve3(pts3d, true);
  const geo = new THREE.TubeGeometry(curve, 64, tubeRadius, 8, true);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  return new THREE.Mesh(geo, mat);
}

// Ghi đè hàm tạo mô-đun 3D cho từng Node theo đúng thiết kế model_3d_6.0.jpg
createBuildingMeshForNode = function (
  node,
  pos3D,
  layer,
  isSel,
  isTrace,
  hasErr,
) {
  const group = new THREE.Group();
  group.position.copy(pos3D);
  group.userData = { nodeId: node.id, layer };

  const isTleNode = tleInfiniteNodeIds.has(node.id);

  // Chất liệu chung Matte Anodized Slate (#1a1e2e, roughness: 0.85, metalness: 0.15)
  const slateMat = new THREE.MeshStandardMaterial({
    color: isTleNode ? 0x3b1219 : MATTE_SLATE_HEX,
    roughness: 0.85,
    metalness: 0.15,
    emissive: isTleNode ? 0x7f1d1d : isTrace ? 0x0b3b49 : 0x000000,
    emissiveIntensity: isTleNode ? 0.65 : isTrace ? 0.45 : 0.0,
  });

  const baseMat = new THREE.MeshStandardMaterial({
    color: MATTE_DARK_BASE_HEX,
    roughness: 0.88,
    metalness: 0.12,
  });

  const grooveMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e17,
    roughness: 0.92,
    metalness: 0.1,
  });

  // Trụ đỡ (Support Pillar) nếu công trình nằm ở tầng cao L1, L2+
  if (layer > 0) {
    const pillarHeight = pos3D.y;
    const pillarGeo = new THREE.CylinderGeometry(
      3.2,
      4.2,
      pillarHeight,
      12,
    );
    const pillarMat = new THREE.MeshStandardMaterial({
      color: MATTE_DARK_BASE_HEX,
      roughness: 0.85,
      metalness: 0.15,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = -pillarHeight / 2;
    group.add(pillar);
  }

  // Màu viền phát sáng khi khối đang chạy/active hoặc bị lỗi TLE
  const activeRimColor = isTleNode
    ? 0xef4444
    : isTrace
      ? CYAN_ACTIVE_HEX
      : isSel
        ? CYAN_ACTIVE_HEX
        : hasErr
          ? CORAL_END_HEX
          : null;

  // 1. MÔ-ĐUN START / END / RETURN: Viên nang nằm ngang (bo tròn 2 đầu) đặt trên đế phẳng
  if (
    node.type === "start" ||
    node.type === "end" ||
    node.type === "return"
  ) {
    // Đế phẳng hình viên nang (Stadium Base)
    const padMesh = createBeveledSlabMesh(56, 3.5, 32, 15, 0.8, baseMat);
    padMesh.userData = { nodeId: node.id };
    group.add(padMesh);

    // Viền phát sáng chân viên nang: Cyan (#2ac3de) cho Start, Đỏ san hô (#f7768e) cho End/Return
    const rimColor = isTleNode
      ? 0xef4444
      : node.type === "start"
        ? CYAN_ACTIVE_HEX
        : CORAL_END_HEX;
    const capsuleRim = createStadiumGlowRing(
      44,
      21,
      10,
      isTrace ? 1.15 : 0.75,
      rimColor,
    );
    capsuleRim.position.y = 4.0;
    group.add(capsuleRim);

    // Khối viên nang nằm ngang (Horizontal Capsule: Cylinder + 2 Hemispheres)
    const capGroup = new THREE.Group();
    const cylLen = 22;
    const capRad = 9.5;
    const cylGeo = new THREE.CylinderGeometry(capRad, capRad, cylLen, 24);
    cylGeo.rotateZ(Math.PI / 2);
    const cylMesh = new THREE.Mesh(cylGeo, slateMat);
    cylMesh.userData = { nodeId: node.id };
    capGroup.add(cylMesh);

    const sphereGeo = new THREE.SphereGeometry(capRad, 24, 16);
    const leftCap = new THREE.Mesh(sphereGeo, slateMat);
    leftCap.position.x = -cylLen / 2;
    leftCap.userData = { nodeId: node.id };
    capGroup.add(leftCap);

    const rightCap = new THREE.Mesh(sphereGeo, slateMat);
    rightCap.position.x = cylLen / 2;
    rightCap.userData = { nodeId: node.id };
    capGroup.add(rightCap);

    capGroup.position.y = 11.5;
    group.add(capGroup);
  }

  // 2. MÔ-ĐUN DECISION: Khối hình thoi (◇) đặt trên đế vuông xoay góc 45 độ, tách 2 nhánh Xanh lục (TRUE) & Đỏ cam (FALSE)
  else if (node.type === "decision") {
    // Đế vuông xoay 45 độ (Diamond Pedestal)
    const baseSlab = createBeveledSlabMesh(
      44,
      3.8,
      44,
      3.5,
      0.8,
      baseMat,
    );
    baseSlab.rotation.y = Math.PI / 4;
    baseSlab.userData = { nodeId: node.id };
    group.add(baseSlab);

    // Khối đa diện hình thoi (Faceted Diamond / Octahedron vát đỉnh phẳng như mẫu model_3d_6.0.jpg)
    const octGeo = new THREE.OctahedronGeometry(16.5, 0);
    // Làm phẳng nhẹ mặt đỉnh và đáy để tạo khối kim cương kiến trúc chuẩn mẫu
    const posAttr = octGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      let vy = posAttr.getY(i);
      if (vy > 8) vy = 9.5;
      if (vy < -8) vy = -9.5;
      posAttr.setY(i, vy);
    }
    octGeo.computeVertexNormals();
    const diamondMesh = new THREE.Mesh(octGeo, slateMat);
    diamondMesh.position.y = 13.5;
    diamondMesh.userData = { nodeId: node.id };
    group.add(diamondMesh);

    // 2 nhánh đường ngắn xuất phát từ đế: Xanh lục cho TRUE (trái) và Đỏ cam cho FALSE (phải)
    const trueStripGeo = new THREE.BoxGeometry(16, 1.8, 3.4);
    const trueStripMat = new THREE.MeshStandardMaterial({
      color: TRUE_GREEN_HEX,
      roughness: 0.65,
      metalness: 0.15,
      emissive: isTrace ? TRUE_GREEN_HEX : 0x000000,
      emissiveIntensity: isTrace ? 0.45 : 0.1,
    });
    const trueStrip = new THREE.Mesh(trueStripGeo, trueStripMat);
    trueStrip.position.set(-20, 1.8, 12);
    trueStrip.rotation.y = -Math.PI / 6;
    group.add(trueStrip);

    const falseStripGeo = new THREE.BoxGeometry(16, 1.8, 3.4);
    const falseStripMat = new THREE.MeshStandardMaterial({
      color: FALSE_CORAL_HEX,
      roughness: 0.65,
      metalness: 0.15,
      emissive: isTrace ? FALSE_CORAL_HEX : 0x000000,
      emissiveIntensity: isTrace ? 0.45 : 0.1,
    });
    const falseStrip = new THREE.Mesh(falseStripGeo, falseStripMat);
    falseStrip.position.set(20, 1.8, 12);
    falseStrip.rotation.y = Math.PI / 6;
    group.add(falseStrip);

    if (activeRimColor) {
      const decRim = createStadiumGlowRing(
        45,
        45,
        4,
        0.9,
        activeRimColor,
      );
      decRim.rotation.y = Math.PI / 4;
      decRim.position.y = 4.0;
      group.add(decRim);
    }
  }

  // 3. MÔ-ĐUN FUNCTION (Subroutine): Khối tháp trụ đứng thanh mảnh có ăng-ten nhỏ trên đỉnh, cao nổi bật
  else if (node.type === "subroutine") {
    // Đế vuông phẳng rộng
    const padMesh = createBeveledSlabMesh(48, 3.6, 48, 4, 0.8, baseMat);
    padMesh.userData = { nodeId: node.id };
    group.add(padMesh);

    // Bệ trung tâm dưới chân tháp
    const plinth = createBeveledSlabMesh(18, 3.0, 18, 2.5, 0.5, baseMat);
    plinth.position.y = 3.5;
    group.add(plinth);

    // Thân tháp trụ đứng thanh mảnh (Slender Monolith Tower)
    const towerBody = createBeveledSlabMesh(
      13.5,
      44,
      13.5,
      2.2,
      0.9,
      slateMat,
    );
    towerBody.position.y = 6.0;
    towerBody.userData = { nodeId: node.id };
    group.add(towerBody);

    // Rãnh kỹ thuật dọc bên hông tháp
    const panelSlotGeo = new THREE.BoxGeometry(2.2, 26, 14.0);
    const panelSlot = new THREE.Mesh(panelSlotGeo, grooveMat);
    panelSlot.position.set(2.2, 28, 0);
    group.add(panelSlot);

    // Ăng-ten nhỏ trên đỉnh tháp
    const antennaBaseGeo = new THREE.CylinderGeometry(1.4, 2.0, 3.5, 12);
    const antennaBase = new THREE.Mesh(antennaBaseGeo, slateMat);
    antennaBase.position.set(-2.5, 51.5, -2.5);
    group.add(antennaBase);

    const antennaRodGeo = new THREE.CylinderGeometry(0.45, 0.45, 13, 8);
    const antennaRodMat = new THREE.MeshStandardMaterial({
      color: isTrace ? CYAN_ACTIVE_HEX : 0x64748b,
      emissive: isTrace ? CYAN_ACTIVE_HEX : 0x000000,
      emissiveIntensity: isTrace ? 0.8 : 0,
      roughness: 0.5,
      metalness: 0.4,
    });
    const antennaRod = new THREE.Mesh(antennaRodGeo, antennaRodMat);
    antennaRod.position.set(-2.5, 58.5, -2.5);
    group.add(antennaRod);

    if (activeRimColor) {
      const fnRim = createStadiumGlowRing(
        20,
        20,
        3,
        0.85,
        activeRimColor,
      );
      fnRim.position.y = 6.2;
      group.add(fnRim);
    }
  }

  // 4. MÔ-ĐUN CONNECTOR: Khối đĩa nối phẳng tối giản
  else if (node.type === "connector") {
    const padMesh = createBeveledSlabMesh(24, 3.2, 24, 11, 0.6, baseMat);
    padMesh.userData = { nodeId: node.id };
    group.add(padMesh);

    const hubMesh = createBeveledSlabMesh(
      16,
      6.5,
      16,
      7.5,
      1.0,
      slateMat,
    );
    hubMesh.position.y = 3.2;
    hubMesh.userData = { nodeId: node.id };
    group.add(hubMesh);

    if (activeRimColor) {
      const cRim = createStadiumGlowRing(
        20,
        20,
        9.5,
        0.75,
        activeRimColor,
      );
      cRim.position.y = 3.6;
      group.add(cRim);
    }
  }

  // 5. MÔ-ĐUN PROCESS / INPUT / OUTPUT: Khối hộp chữ nhật dẹt vát cạnh trên bệ phẳng, rãnh ngang bên hông
  else {
    // Bệ phẳng dưới đáy
    const padMesh = createBeveledSlabMesh(56, 3.5, 38, 4.5, 0.8, baseMat);
    padMesh.userData = { nodeId: node.id };
    group.add(padMesh);

    // Khối hộp chữ nhật dẹt vát cạnh (Chamfered Flat Rectangular Block)
    const bodySlab = createBeveledSlabMesh(
      45,
      11.5,
      28,
      3.8,
      1.8,
      slateMat,
    );
    bodySlab.position.y = 3.5;
    bodySlab.userData = { nodeId: node.id };
    group.add(bodySlab);

    // Các rãnh tản nhiệt ngang tinh tế ở mặt trước/sau và hai bên hông (như ảnh mẫu PROCESS)
    for (let s = 0; s < 2; s++) {
      const grooveZ = new THREE.Mesh(
        new THREE.BoxGeometry(36, 0.85, 28.6),
        grooveMat,
      );
      grooveZ.position.set(0, 6.2 + s * 2.2, 0);
      group.add(grooveZ);
    }

    if (activeRimColor) {
      const procRim = createStadiumGlowRing(
        47,
        30,
        4.2,
        0.9,
        activeRimColor,
      );
      procRim.position.y = 3.8;
      group.add(procRim);
    }
  }

  // Vòng chấm đỏ nhỏ báo hiệu Breakpoint nếu người dùng đặt Trạm Dừng
  if (node.bp) {
    const bpDot = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: CORAL_END_HEX }),
    );
    bpDot.position.set(-22, 5.5, -14);
    group.add(bpDot);
  }

  return group;
};

// =========================================================================
// GÓI 6 (LOOP TRACK) & GÓI 3 (ORTHOGONAL 2D WIRE):
// Cập nhật hàm dựng cảnh 3D: Đường nối trực giao chuẩn kỹ thuật khi ở 2D,
// và mô-đun LOOP dạng đường ray khép kín bo tròn góc có trụ đỡ & viên nang Cyan
// =========================================================================
compute3DRoadWaypoints = function (
  u,
  v,
  p1,
  p2,
  branch,
  isBack,
  backEdgeIndex,
) {
  const startPt = p1.clone().add(new THREE.Vector3(0, 3.2, 11));
  if (u.type === "decision") {
    if (branch === "true") startPt.x -= 16;
    if (branch === "false") startPt.x += 16;
  }
  const endPt = p2.clone().add(new THREE.Vector3(0, 3.2, -11));

  // Khi ở chế độ 2D hoặc đường nối chuẩn: Tạo các góc vuông trực giao (Orthogonal 90-degree routing)
  if (isBack) {
    const laneSide = u.x <= v.x ? -1 : 1;
    const corridorX =
      laneSide < 0
        ? Math.min(startPt.x, endPt.x) - (115 + backEdgeIndex * 34)
        : Math.max(startPt.x, endPt.x) + (115 + backEdgeIndex * 34);
    const trackY = isTopDown2D ? 4.0 : Math.max(p1.y, p2.y) + 14;

    const w1 = new THREE.Vector3(startPt.x, trackY, startPt.z + 16);
    const w2 = new THREE.Vector3(corridorX, trackY, startPt.z + 16);
    const w3 = new THREE.Vector3(corridorX, trackY, endPt.z - 14);
    const w4 = new THREE.Vector3(endPt.x, trackY, endPt.z - 14);
    return [startPt, w1, w2, w3, w4, endPt];
  } else {
    const midZ = (startPt.z + endPt.z) / 2;
    const midY = (startPt.y + endPt.y) / 2;
    const m1 = new THREE.Vector3(startPt.x, startPt.y, midZ);
    const m2 = new THREE.Vector3(endPt.x, midY, midZ);
    return [startPt, m1, m2, endPt];
  }
};

// Hàm dựng Đường Ray Khép Kín Bo Tròn Góc (Stadium Loop Track) có trụ đỡ & viên nang Cyan theo ảnh mẫu LOOP
function buildLoopStadiumTrackMesh(uNode, vNode, p1, p2, backIdx) {
  const loopGroup = new THREE.Group();
  const minX = Math.min(p1.x, p2.x) - 52 - backIdx * 18;
  const maxX = Math.max(p1.x, p2.x) + 52 + backIdx * 18;
  const minZ = Math.min(p1.z, p2.z) - 22;
  const maxZ = Math.max(p1.z, p2.z) + 22;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const trackW = Math.max(75, maxX - minX);
  const trackD = Math.max(75, maxZ - minZ);
  const cornerR = Math.min(26, trackW * 0.35, trackD * 0.35);
  const trackY = Math.max(p1.y, p2.y) + 6;

  // Đường cong khép kín bo tròn 4 góc (Stadium Curve)
  const shape = createRoundedRectShape(trackW, trackD, cornerR);
  const pts2d = shape.getPoints(48);
  const pts3d = pts2d.map(
    (pt) => new THREE.Vector3(cx + pt.x, trackY, cz + pt.y),
  );
  pts3d.push(pts3d[0].clone());
  const closedCurve = new THREE.CatmullRomCurve3(pts3d, true);

  const railMat = new THREE.MeshStandardMaterial({
    color: MATTE_SLATE_HEX,
    roughness: 0.85,
    metalness: 0.15,
  });
  const innerShape = createRoundedRectShape(
    trackW - 5,
    trackD - 5,
    Math.max(4, cornerR - 2.5),
  );
  const outerShape = createRoundedRectShape(
    trackW + 5,
    trackD + 5,
    cornerR + 2.5,
  );
  outerShape.holes.push(innerShape);

  const extrudeTrack = new THREE.ExtrudeGeometry(outerShape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.4,
    bevelThickness: 0.4,
  });
  extrudeTrack.rotateX(-Math.PI / 2);
  const trackMesh = new THREE.Mesh(extrudeTrack, railMat);
  trackMesh.position.set(cx, trackY - 1.1, cz);
  loopGroup.add(trackMesh);

  // Các trụ đỡ nhỏ (Support Stanchions) dọc theo đường ray như ảnh mẫu LOOP
  const pillarPositions = [
    0.08, 0.22, 0.35, 0.48, 0.58, 0.72, 0.85, 0.96,
  ];
  pillarPositions.forEach((tVal) => {
    const pt = closedCurve.getPointAt(tVal);
    const legH = Math.max(4, pt.y);
    const legGeo = new THREE.CylinderGeometry(1.1, 1.3, legH, 8);
    const leg = new THREE.Mesh(legGeo, railMat);
    leg.position.set(pt.x, pt.y - legH / 2, pt.z);
    loopGroup.add(leg);
  });

  // Viên nang dữ liệu cầu phát sáng Cyan (#2ac3de) chạy trên đường ray
  const orbGeo = new THREE.SphereGeometry(3.8, 16, 16);
  const orbMat = new THREE.MeshBasicMaterial({ color: CYAN_ACTIVE_HEX });
  const orbMesh = new THREE.Mesh(orbGeo, orbMat);
  pulseParticlesGroup.add(orbMesh);
  roadPulseItems.push({
    mesh: orbMesh,
    curve: closedCurve,
    t: (backIdx * 0.35) % 1.0,
  });

  return loopGroup;
}

// Ghi đè rebuild3DCityScene để áp dụng tông màu đường đi Matte Slate, nhánh True/False chuẩn ảnh mẫu và Loop Track
rebuild3DCityScene = function () {
  if (!buildingsGroup || !roadsGroup) return;

  disposeHierarchy(buildingsGroup);
  disposeHierarchy(roadsGroup);
  disposeHierarchy(voxelWarehouseGroup);
  disposeHierarchy(pulseParticlesGroup);
  cityGroup.add(buildingsGroup);
  cityGroup.add(roadsGroup);
  cityGroup.add(voxelWarehouseGroup);
  cityGroup.add(pulseParticlesGroup);

  buildingMeshesMap = {};
  animatedRotators = [];
  roadPulseItems = [];

  const g = currGraph();
  if (!g) return;
  const { nodes, edges } = g;
  const backEdgeIds = detectBackEdges(nodes, edges);
  const lintReport = runSemanticLinter(nodes, edges);
  window.__lastLint = lintReport;
  const layerMap = computeNodeElevationLayers(nodes, edges);

  const maxLayer = Math.max(0, ...Object.values(layerMap));
  const maxLayerEl = document.getElementById("maxLayerBadge");
  if (maxLayerEl) maxLayerEl.textContent = `Cao: L${maxLayer}`;

  // 1. Dựng các mô-đun kiến trúc 3D Matte Slate
  nodes.forEach((node) => {
    const pos3D = graphToWorld3D(node, layerMap);
    const layer = layerMap[node.id] || 0;
    const isSel = node.id === selectedNodeId;
    const isTrace =
      traceState.active && traceState.currNodeId === node.id;
    const hasErr =
      lintReport.errorNodeIds.has(node.id) ||
      tleInfiniteNodeIds.has(node.id);

    const bGroup = createBuildingMeshForNode(
      node,
      pos3D,
      layer,
      isSel,
      isTrace,
      hasErr,
    );
    buildingsGroup.add(bGroup);
    buildingMeshesMap[node.id] = bGroup;
  });

  // 2. Dựng hệ thống đường dẫn (Orthogonal ở 2D / Matte Track ở 3D) & Đường ray LOOP
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  let backEdgeIndex = 0;

  edges.forEach((edge) => {
    const u = nodeMap[edge.source];
    const v = nodeMap[edge.target];
    if (!u || !v) return;

    const p1 = graphToWorld3D(u, layerMap);
    const p2 = graphToWorld3D(v, layerMap);
    const isBack = backEdgeIds.has(edge.id) || v.y <= u.y;

    // Màu sắc đường nối theo chuẩn ảnh mẫu: Xanh lục cho TRUE, Đỏ cam cho FALSE, Xám Slate cho mặc định
    let roadColor = 0x3b4466;
    if (edge.branch === "true") roadColor = TRUE_GREEN_HEX;
    else if (edge.branch === "false") roadColor = FALSE_CORAL_HEX;
    else if (isBack) roadColor = CYAN_ACTIVE_HEX;

    const pathPoints = compute3DRoadWaypoints(
      u,
      v,
      p1,
      p2,
      edge.branch,
      isBack,
      backEdgeIndex,
    );

    if (isBack) {
      const loopTrack = buildLoopStadiumTrackMesh(
        u,
        v,
        p1,
        p2,
        backEdgeIndex,
      );
      roadsGroup.add(loopTrack);
      backEdgeIndex++;
    }

    // Trong chế độ 2D: Dựng đường gấp khúc trực giao sắc nét (Polyline); ở 3D dùng đường ống phẳng mịn
    const curve = isTopDown2D
      ? new THREE.CatmullRomCurve3(pathPoints, false, "catmullrom", 0.01)
      : new THREE.CatmullRomCurve3(pathPoints, false, "catmullrom", 0.08);

    const tubeGeo = new THREE.TubeGeometry(
      curve,
      36,
      isTopDown2D ? 2.1 : 1.5,
      8,
      false,
    );
    const tubeMat = new THREE.MeshStandardMaterial({
      color: roadColor,
      roughness: 0.78,
      metalness: 0.18,
      emissive: roadColor,
      emissiveIntensity: edge.branch ? 0.22 : 0.08,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.userData = { edgeId: edge.id, pathPoints, roadColor };
    roadsGroup.add(tubeMesh);

    // Mũi tên chỉ hướng
    if (pathPoints.length >= 2) {
      const lastPt = pathPoints[pathPoints.length - 1];
      const prevPt = pathPoints[pathPoints.length - 2];
      const dir = new THREE.Vector3()
        .subVectors(lastPt, prevPt)
        .normalize();
      const arrowPos = new THREE.Vector3().lerpVectors(
        prevPt,
        lastPt,
        0.75,
      );
      const coneGeo = new THREE.ConeGeometry(3.6, 8.5, 10);
      const coneMat = new THREE.MeshStandardMaterial({
        color: roadColor,
        roughness: 0.7,
        metalness: 0.2,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(arrowPos);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      roadsGroup.add(cone);
    }
  });

  // 3. Dựng Khay Bộ Nhớ MEMORY (1D & Ma trận 2D N×M + Tia Con Trỏ 3D)
  rebuildVoxelArrayWarehouse3D();

  // 4. Dựng HUD Labels với các cổng nối luôn hiển thị và Mini Toolbar
  buildHudOverlayElements(nodes, layerMap, lintReport.errorNodeIds);
};

// =========================================================================
// GÓI 5 & GÓI 6 (MEMORY MODULE): KHAY MẢNG 1D & MA TRẬN 2D (N×M) + TIA CON TRỎ
// - Các ô vuông phẳng vát cạnh liền kề trên đế Matte Slate
// - Ô nào đang truy cập (i, j, mid, left, right, ptr) sẽ nhô cao lên và sáng viền Cyan (#2ac3de)
// - Tia liên kết màu sắc (Pointer Laser Ray) chỉ trực tiếp vào ô nhớ tương ứng
// =========================================================================
const POINTER_COLORS = {
  i: 0x2ac3de, // Cyan
  j: 0xf59e0b, // Amber
  k: 0xa855f7, // Purple
  left: 0x10b981, // Emerald
  right: 0xf43f5e, // Rose
  mid: 0xfacc15, // Yellow
  ptr: 0x38bdf8, // Sky
};

rebuildVoxelArrayWarehouse3D = function () {
  if (!voxelWarehouseGroup) return;
  disposeHierarchy(voxelWarehouseGroup);
  if (cityGroup) cityGroup.add(voxelWarehouseGroup);

  let arrEntries = Object.entries(traceState.arrays || {});
  if (arrEntries.length === 0) {
    const g = currGraph();
    if (g) {
      g.nodes.forEach((n) => {
        // Nhận diện mảng 2D: m = [[1, 2], [3, 4]] hoặc mảng 1D: a = [4, 7, 2]
        const m2d = n.content.match(
          /([a-zA-Z_]\w*)\s*=\s*\[\s*(\[[\s\S]*?\])\s*\]/,
        );
        if (m2d) {
          try {
            const parsed2D = JSON.parse(`[${m2d[2]}]`);
            if (Array.isArray(parsed2D))
              arrEntries.push([m2d[1], parsed2D]);
          } catch (e) {}
        } else {
          const m1d = n.content.match(
            /([a-zA-Z_]\w*)\s*=\s*\[([^\[\]]*?)\]/,
          );
          if (m1d) {
            const vals = m1d[2]
              .split(",")
              .map((x) => Number(x.trim()) || 0);
            arrEntries.push([m1d[1], vals]);
          }
        }
      });
    }
  }

  if (arrEntries.length === 0) return;

  const [arrName, arrVals] = arrEntries[0];
  const is2DMatrix = Array.isArray(arrVals[0]);
  const baseX = -250;
  const baseZ = -215;
  const tileStep = 28;

  const slateTileMat = new THREE.MeshStandardMaterial({
    color: MATTE_SLATE_HEX,
    roughness: 0.85,
    metalness: 0.15,
  });
  const activeTileMat = new THREE.MeshStandardMaterial({
    color: 0x232a40,
    roughness: 0.75,
    metalness: 0.2,
    emissive: 0x0b3b49,
    emissiveIntensity: 0.4,
  });
  const trayBaseMat = new THREE.MeshStandardMaterial({
    color: MATTE_DARK_BASE_HEX,
    roughness: 0.9,
    metalness: 0.12,
  });

  // Tạo trạm phát tia con trỏ (Pointer Emitter Beacon) phía trên khay nhớ
  const createPointerLaserRay = (ptrName, targetPos, colorHex) => {
    const originPos = new THREE.Vector3(baseX - 38, 46, baseZ - 28);
    const emitterGeo = new THREE.SphereGeometry(2.6, 12, 12);
    const emitterMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const emitter = new THREE.Mesh(emitterGeo, emitterMat);
    emitter.position.copy(originPos);
    voxelWarehouseGroup.add(emitter);

    const rayCurve = new THREE.LineCurve3(originPos, targetPos);
    const rayGeo = new THREE.TubeGeometry(rayCurve, 8, 0.65, 6, false);
    const rayMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
    });
    const rayMesh = new THREE.Mesh(rayGeo, rayMat);
    voxelWarehouseGroup.add(rayMesh);
  };

  if (is2DMatrix) {
    // Dựng Ma trận 2 chiều N×M dạng lưới ô cờ 3D (Chessboard Matrix Grid)
    const rows = arrVals.length;
    const cols = Math.max(
      1,
      ...arrVals.map((r) => (Array.isArray(r) ? r.length : 1)),
    );
    const trayW = cols * tileStep + 18;
    const trayD = rows * tileStep + 18;

    const trayMesh = createBeveledSlabMesh(
      trayW,
      3.8,
      trayD,
      5,
      0.8,
      trayBaseMat,
    );
    trayMesh.position.set(
      baseX + ((cols - 1) * tileStep) / 2,
      0,
      baseZ + ((rows - 1) * tileStep) / 2,
    );
    voxelWarehouseGroup.add(trayMesh);

    const curI = traceState.vars?.i;
    const curJ = traceState.vars?.j;

    for (let r = 0; r < rows; r++) {
      const rowArr = Array.isArray(arrVals[r])
        ? arrVals[r]
        : [arrVals[r]];
      for (let c = 0; c < cols; c++) {
        const isAccessed = curI === r && curJ === c;
        const isRowOrColActive = curI === r || curJ === c;
        const elevY = isAccessed ? 8.5 : isRowOrColActive ? 5.0 : 3.6;

        const tile = createBeveledSlabMesh(
          23,
          4.6,
          23,
          3.0,
          0.7,
          isAccessed ? activeTileMat : slateTileMat,
        );
        const tx = baseX + c * tileStep;
        const tz = baseZ + r * tileStep;
        tile.position.set(tx, elevY, tz);
        voxelWarehouseGroup.add(tile);

        if (isAccessed) {
          const cyanRim = createStadiumGlowRing(
            24.5,
            24.5,
            3.2,
            0.8,
            CYAN_ACTIVE_HEX,
          );
          cyanRim.position.set(tx, elevY + 0.3, tz);
          voxelWarehouseGroup.add(cyanRim);
          createPointerLaserRay(
            "i,j",
            new THREE.Vector3(tx, elevY + 4.5, tz),
            CYAN_ACTIVE_HEX,
          );
        }
      }
    }
  } else {
    // Dựng Khay Mảng 1 Chiều (MEMORY 1D Tray) đúng chuẩn ảnh mẫu model_3d_6.0.jpg
    const len = arrVals.length;
    const trayW = len * tileStep + 16;
    const trayMesh = createBeveledSlabMesh(
      trayW,
      3.6,
      34,
      4.5,
      0.8,
      trayBaseMat,
    );
    trayMesh.position.set(baseX + ((len - 1) * tileStep) / 2, 0, baseZ);
    voxelWarehouseGroup.add(trayMesh);

    arrVals.forEach((val, idx) => {
      // Kiểm tra các biến con trỏ/chỉ số đang trỏ vào ô nhớ idx
      const matchingPtrs = Object.keys(POINTER_COLORS).filter(
        (pKey) => traceState.vars && traceState.vars[pKey] === idx,
      );
      const isAccessed = matchingPtrs.length > 0;
      const elevY = isAccessed ? 8.2 : 3.6;
      const tx = baseX + idx * tileStep;

      const tile = createBeveledSlabMesh(
        23.5,
        4.8,
        23.5,
        3.2,
        0.75,
        isAccessed ? activeTileMat : slateTileMat,
      );
      tile.position.set(tx, elevY, baseZ);
      voxelWarehouseGroup.add(tile);

      if (isAccessed) {
        // Viền sáng Cyan (#2ac3de) dưới chân ô nhớ đang truy cập (như ảnh mẫu MEMORY)
        const cyanRim = createStadiumGlowRing(
          25,
          25,
          3.4,
          0.85,
          CYAN_ACTIVE_HEX,
        );
        cyanRim.position.set(tx, elevY + 0.2, baseZ);
        voxelWarehouseGroup.add(cyanRim);

        // Phóng tia con trỏ màu sắc chỉ trực tiếp vào ô nhớ
        matchingPtrs.forEach((pName) => {
          createPointerLaserRay(
            pName,
            new THREE.Vector3(tx, elevY + 4.6, baseZ),
            POINTER_COLORS[pName] || CYAN_ACTIVE_HEX,
          );
        });
      }
    });
  }
};

// Cập nhật bảng RAM dưới đáy để hiển thị cả Mảng 1D, Ma trận 2D (N×M) và Nhãn Con Trỏ

// -------------------------------------------------------------------------
// HẠNG MỤC 6: CẬP NHẬT 6 MÔ-ĐUN 3D THEO ĐÚNG THIẾT KẾ `model_3d_6.0.png`
// 1. GATEWAY (Start / End / Return): Tháp trụ tròn lồng kính năng lượng, bên trong có
//    các vòng xoắn ốc vàng kim (Golden Helical Coils) phát sáng xoay tròn, trụ đỡ ngoài,
//    nắp đỉnh đa tầng viền neon và cổng vòm lối vào (Archway Entrance) có bậc thang sáng.
// 2. PROCESS: Khối vi xử lý CPU đa tầng (Multi-Tiered Processor Core) với hàng chân pin
//    vàng đồng (Gold IC Pins) xung quanh 4 cạnh đế, hệ thống khe tản nhiệt (Heatsink Fins)
//    dọc 4 mặt, viền mạch neon xanh dương và cột Hologram dữ liệu (Matrix Data Stream) trên đỉnh.
// 3. DECISION: Trạm phân luồng lục giác (Hexagonal Control Hub) với vòng lục giác neon trên mái
//    và 2 cổng vòm phát sáng rõ rệt: Cổng trái Xanh lá (TRUE) phóng tia laser xanh,
//    cổng phải Đỏ cam (FALSE) phóng tia laser đỏ.
// 4. I/O SPIRE (Subroutine / Function & Input / Output): Tháp viễn thông trụ cao có 4 chân
//    chống (Buttress Legs), khe sáng dọc thân, 3 vòng Hologram HUD xoay quanh thân tháp,
//    đĩa radar và cột ăng-ten phát sóng trên đỉnh.
// 5. STORAGE (Memory Array 1D / 2D): Đế bo mạch chủ có hàng chân pin vàng đồng & đèn LED
//    trạng thái, cắm các thanh RAM mạch xanh lá (Green PCB DIMM Modules) gắn chip nhớ đen
//    (Black IC Chips); ô đang truy cập sẽ nhô cao và phát sáng kèm tia con trỏ 3D.
// -------------------------------------------------------------------------

// Hàm tạo khung viền vuông mạch in PCB (Square Isometric PCB Frame) dưới chân mỗi công trình
function createSquarePCBFrame(sizeW, sizeD, borderHex, isActive) {
  const frameGroup = new THREE.Group();
  const borderMat = new THREE.MeshBasicMaterial({
    color: borderHex,
    transparent: true,
    opacity: isActive ? 0.95 : 0.65,
  });
  const thickness = isActive ? 1.1 : 0.75;
  const yPos = 0.25;

  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(sizeW, 0.35, thickness),
    borderMat,
  );
  topBar.position.set(0, yPos, -sizeD / 2);
  frameGroup.add(topBar);

  const botBar = new THREE.Mesh(
    new THREE.BoxGeometry(sizeW, 0.35, thickness),
    borderMat,
  );
  botBar.position.set(0, yPos, sizeD / 2);
  frameGroup.add(botBar);

  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, 0.35, sizeD),
    borderMat,
  );
  leftBar.position.set(-sizeW / 2, yPos, 0);
  frameGroup.add(leftBar);

  const rightBar = new THREE.Mesh(
    new THREE.BoxGeometry(thickness, 0.35, sizeD),
    borderMat,
  );
  rightBar.position.set(sizeW / 2, yPos, 0);
  frameGroup.add(rightBar);

  // 2 chip vi mạch nhỏ (Micro IC Chips) trang trí ở góc ngoài như trong ảnh model_3d_6.0.png
  const chipBodyMat = new THREE.MeshStandardMaterial({
    color: 0x111522,
    roughness: 0.6,
    metalness: 0.3,
  });
  const goldPinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b43,
    roughness: 0.35,
    metalness: 0.85,
  });
  [
    [-sizeW / 2 - 6, -sizeD / 2 + 6],
    [sizeW / 2 + 6, sizeD / 2 - 6],
  ].forEach(([cx, cz]) => {
    const ic = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.2, 3.6),
      chipBodyMat,
    );
    ic.position.set(cx, 0.6, cz);
    frameGroup.add(ic);
    for (let p = -1; p <= 1; p++) {
      const pin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 4.8),
        goldPinMat,
      );
      pin.position.set(cx + p * 1.4, 0.3, cz);
      frameGroup.add(pin);
    }
  });

  return frameGroup;
}

// Hàm tạo cột Hologram dữ liệu ma trận (Vertical Matrix Hologram) cho khối PROCESS
function createProcessMatrixHologramTexture(codeText) {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);

  // Vẽ các cột bit dữ liệu 0/1 & vạch xung thẳng đứng phát sáng màu Cyan
  for (let x = 12; x < 244; x += 14) {
    const colHeight = 70 + ((x * 37) % 150);
    const grad = ctx.createLinearGradient(x, 256, x, 256 - colHeight);
    grad.addColorStop(0, "rgba(34, 211, 238, 0.92)");
    grad.addColorStop(0.5, "rgba(56, 189, 248, 0.45)");
    grad.addColorStop(1, "rgba(34, 211, 238, 0.0)");
    ctx.fillStyle = grad;
    for (let y = 248; y > 256 - colHeight; y -= 10) {
      const h = (x + y) % 3 === 0 ? 6 : 3;
      ctx.fillRect(x, y - h, 4, h);
    }
  }

  // Hiển thị biểu thức code nổi bật giữa đám mây Hologram
  if (codeText) {
    const disp =
      codeText.length > 18 ? codeText.slice(0, 17) + "…" : codeText;
    ctx.font = "bold 22px 'Fira Code', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#e0f2fe";
    ctx.fillText(disp, 128, 175);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

// Hàm tạo dải vòng Hologram HUD kỹ thuật số cho tháp I/O SPIRE
function createSpireHologramBandTexture(colorHexStr = "#22d3ee") {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 64;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, 512, 64);

  ctx.strokeStyle = colorHexStr;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 6, 508, 52);

  ctx.fillStyle = colorHexStr;
  for (let x = 10; x < 500; x += 16) {
    const barH = 10 + ((x * 19) % 28);
    ctx.globalAlpha = (x / 16) % 3 === 0 ? 0.85 : 0.35;
    ctx.fillRect(x, 32 - barH / 2, 7, barH);
  }
  ctx.globalAlpha = 1.0;
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

createBuildingMeshForNode = function (
  node,
  pos3D,
  layer,
  isSel,
  isTrace,
  hasErr,
) {
  const group = new THREE.Group();
  group.position.copy(pos3D);
  group.userData = { nodeId: node.id, layer };

  const isTleNode = tleInfiniteNodeIds.has(node.id);
  const isActive = isTrace || isSel;

  // Vật liệu kim loại tối màu chủ đạo theo đúng ảnh model_3d_6.0.png
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: isTleNode ? 0x3b1219 : 0x1e2638,
    roughness: 0.45,
    metalness: 0.6,
    emissive: isTleNode ? 0x7f1d1d : isActive ? 0x0c3446 : 0x070a12,
    emissiveIntensity: isTleNode ? 0.65 : isActive ? 0.45 : 0.2,
  });

  const deepSlateMat = new THREE.MeshStandardMaterial({
    color: 0x121724,
    roughness: 0.55,
    metalness: 0.45,
  });

  const goldPinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b43,
    roughness: 0.3,
    metalness: 0.88,
    emissive: 0x422808,
    emissiveIntensity: 0.25,
  });

  // Trụ đỡ nếu công trình nằm ở tầng cao L1, L2+
  if (layer > 0) {
    const pillarHeight = pos3D.y;
    const pillarGeo = new THREE.CylinderGeometry(
      4.2,
      5.5,
      pillarHeight,
      12,
    );
    const pillar = new THREE.Mesh(pillarGeo, deepSlateMat);
    pillar.position.y = -pillarHeight / 2;
    group.add(pillar);

    for (let l = 1; l <= layer; l++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(6.8, 0.6, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -pillarHeight + l * LAYER_HEIGHT_3D - 2;
      group.add(ring);
    }
  }

  // =====================================================================
  // 1. MÔ-ĐUN GATEWAY (Start / End / Return) — Giống hệt khối GATEWAY góc trái dưới
  // =====================================================================
  if (
    node.type === "start" ||
    node.type === "end" ||
    node.type === "return"
  ) {
    const themeHex = isTleNode
      ? 0xef4444
      : node.type === "start"
        ? 0x22d3ee
        : node.type === "return"
          ? 0xff9e64
          : 0xf43f5e;
    const coilHex =
      node.type === "end"
        ? 0xfb7185
        : node.type === "return"
          ? 0xfbbf24
          : 0xfcd34d;

    // Khung PCB vuông viền vàng đồng dưới mặt đất
    group.add(createSquarePCBFrame(56, 56, 0xd4a359, isActive));

    // Đế trụ tròn nhiều bậc (Lower Cylindrical Base)
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(19.5, 21.0, 3.0, 32),
      deepSlateMat,
    );
    basePlinth.position.y = 1.5;
    basePlinth.userData = { nodeId: node.id };
    group.add(basePlinth);

    const lowerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(17.5, 18.5, 9.0, 32),
      darkMetalMat,
    );
    lowerBody.position.y = 7.5;
    lowerBody.userData = { nodeId: node.id };
    group.add(lowerBody);

    // Các dải đèn LED thông số ngang bên hông chân tháp (như trong ảnh GATEWAY)
    for (let s = 0; s < 3; s++) {
      const ledStrip = new THREE.Mesh(
        new THREE.CylinderGeometry(
          17.85,
          17.85,
          0.7,
          24,
          1,
          true,
          -Math.PI * 0.45,
          Math.PI * 0.55,
        ),
        new THREE.MeshBasicMaterial({
          color: themeHex,
          side: THREE.DoubleSide,
        }),
      );
      ledStrip.position.y = 5.2 + s * 2.0;
      group.add(ledStrip);
    }

    // Cổng vòm lối vào (Protruding Archway Entrance + 3 Glowing Steps) ở mặt trước (+Z)
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, 16.5);
    portalGroup.userData = { nodeId: node.id };

    const archBox = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 8.5, 6.5),
      darkMetalMat,
    );
    archBox.position.y = 4.25;
    portalGroup.add(archBox);

    const archRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 4.8, 6.5, 20, 1, false, 0, Math.PI),
      darkMetalMat,
    );
    archRoof.rotation.z = Math.PI / 2;
    archRoof.rotation.y = Math.PI / 2;
    archRoof.position.y = 8.5;
    portalGroup.add(archRoof);

    // Vòm sáng Cyan bên trong cửa GATEWAY
    const innerGlowBox = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 6.8, 6.9),
      new THREE.MeshBasicMaterial({ color: themeHex }),
    );
    innerGlowBox.position.y = 3.8;
    portalGroup.add(innerGlowBox);

    // 3 bậc thang phát sáng trước cửa vòm
    for (let st = 0; st < 3; st++) {
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.55, 1.4),
        new THREE.MeshBasicMaterial({ color: themeHex }),
      );
      stepMesh.position.set(0, 0.4 + (2 - st) * 0.55, 3.6 + st * 1.3);
      portalGroup.add(stepMesh);
    }
    group.add(portalGroup);

    // Buồng kính trụ tròn trong suốt (Central Translucent Glass Chamber)
    const glassMat = new THREE.MeshStandardMaterial({
      color: themeHex,
      emissive: themeHex,
      emissiveIntensity: 0.25,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.28,
    });
    const glassCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(14.8, 14.8, 19.0, 28),
      glassMat,
    );
    glassCyl.position.y = 21.5;
    glassCyl.userData = { nodeId: node.id };
    group.add(glassCyl);

    // Lõi xoắn ốc vàng kim phát sáng bên trong lồng kính (Golden Helical Energy Coils)
    const coilGroup = new THREE.Group();
    coilGroup.position.y = 21.5;
    const coilMat = new THREE.MeshBasicMaterial({ color: coilHex });
    for (let c = 0; c < 4; c++) {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(9.2, 0.95, 12, 32),
        coilMat,
      );
      torus.rotation.x = Math.PI / 2 + (c % 2 === 0 ? 0.16 : -0.16);
      torus.rotation.y = (c * Math.PI) / 4;
      torus.position.y = -5.5 + c * 3.6;
      coilGroup.add(torus);
    }
    // Cột năng lượng trung tâm trong buồng kính
    const innerCore = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 18.0, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
      }),
    );
    coilGroup.add(innerCore);
    group.add(coilGroup);
    animatedRotators.push({ mesh: coilGroup, axis: "y", speed: 0.035 });

    // 4 cột trụ bảo vệ bên ngoài lồng kính (4 Exterior Structural Struts)
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + Math.PI / 4;
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 19.5, 2.6),
        darkMetalMat,
      );
      strut.position.set(
        Math.cos(ang) * 15.6,
        21.5,
        Math.sin(ang) * 15.6,
      );
      group.add(strut);
    }

    // Nắp đỉnh đa tầng viền Neon (Upper Collar + Stepped Cap + Concentric Neon Rings)
    const upperCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(18.0, 17.2, 5.5, 32),
      darkMetalMat,
    );
    upperCollar.position.y = 33.8;
    upperCollar.userData = { nodeId: node.id };
    group.add(upperCollar);

    const collarRim = new THREE.Mesh(
      new THREE.TorusGeometry(17.8, 0.75, 10, 36),
      new THREE.MeshBasicMaterial({ color: themeHex }),
    );
    collarRim.rotation.x = Math.PI / 2;
    collarRim.position.y = 36.6;
    group.add(collarRim);

    const topDomeCap = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 13.5, 3.2, 28),
      darkMetalMat,
    );
    topDomeCap.position.y = 38.2;
    topDomeCap.userData = { nodeId: node.id };
    group.add(topDomeCap);

    const topInnerRim = new THREE.Mesh(
      new THREE.TorusGeometry(9.8, 0.7, 10, 32),
      new THREE.MeshBasicMaterial({ color: themeHex }),
    );
    topInnerRim.rotation.x = Math.PI / 2;
    topInnerRim.position.y = 39.9;
    group.add(topInnerRim);

    // Tia năng lượng thẳng đứng bắn lên từ tâm nắp đỉnh
    const topBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.9, 14, 8),
      new THREE.MeshBasicMaterial({
        color: themeHex,
        transparent: true,
        opacity: 0.8,
      }),
    );
    topBeam.position.y = 46.5;
    group.add(topBeam);
  }

  // =====================================================================
  // 2. MÔ-ĐUN PROCESS (Process) — Khối CPU đa tầng + Chân pin vàng + Khe tản nhiệt + Cột Hologram
  // =====================================================================
  else if (node.type === "process") {
    const neonBlue = isTleNode ? 0xef4444 : 0x22d3ee;

    // Khung PCB vuông màu Cyan dưới mặt đất
    group.add(createSquarePCBFrame(58, 58, neonBlue, isActive));

    // Tầng đế IC Package (44 x 3.8 x 44)
    const icBase = createBeveledSlabMesh(
      44,
      3.8,
      44,
      3.2,
      0.7,
      deepSlateMat,
    );
    icBase.userData = { nodeId: node.id };
    group.add(icBase);

    // Hàng chân pin vàng đồng (Gold Gull-Wing IC Pins) dọc khắp 4 cạnh đế như ảnh mẫu PROCESS
    const numPins = 9;
    const pinSpacing = 4.0;
    for (let i = 0; i < numPins; i++) {
      const offset = (i - (numPins - 1) / 2) * pinSpacing;
      // Cạnh trước (+Z) & sau (-Z)
      [-1, 1].forEach((side) => {
        const pinZ = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 1.4, 4.2),
          goldPinMat,
        );
        pinZ.position.set(offset, 1.0, side * 23.2);
        group.add(pinZ);

        // Cạnh trái (-X) & phải (+X)
        const pinX = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 1.4, 1.5),
          goldPinMat,
        );
        pinX.position.set(side * 23.2, 1.0, offset);
        group.add(pinX);
      });
    }

    // Tầng mạch Neon thứ 2 (39 x 3.4 x 39) kèm đường viền mạch phát sáng xanh dương
    const circuitTier = createBeveledSlabMesh(
      39,
      3.4,
      39,
      2.8,
      0.6,
      darkMetalMat,
    );
    circuitTier.position.y = 3.8;
    circuitTier.userData = { nodeId: node.id };
    group.add(circuitTier);

    const tierGlowRim = createStadiumGlowRing(
      40.2,
      40.2,
      3.0,
      0.75,
      0x38bdf8,
    );
    tierGlowRim.position.y = 5.6;
    group.add(tierGlowRim);

    // Khối thân tản nhiệt (Heatsink Core 33 x 8.5 x 33) kèm dãy lá tản nhiệt đứng 4 mặt
    const heatsinkCore = new THREE.Mesh(
      new THREE.BoxGeometry(31, 8.5, 31),
      deepSlateMat,
    );
    heatsinkCore.position.y = 11.4;
    heatsinkCore.userData = { nodeId: node.id };
    group.add(heatsinkCore);

    // Các lá tản nhiệt đứng (Vertical Cooling Fins) xung quanh 4 mặt
    const finCount = 11;
    const finStep = 2.6;
    for (let f = 0; f < finCount; f++) {
      const fo = (f - (finCount - 1) / 2) * finStep;
      [-1, 1].forEach((s) => {
        const finFB = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 8.2, 2.4),
          darkMetalMat,
        );
        finFB.position.set(fo, 11.4, s * 16.2);
        group.add(finFB);

        const finLR = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 8.2, 1.1),
          darkMetalMat,
        );
        finLR.position.set(s * 16.2, 11.4, fo);
        group.add(finLR);
      });
    }

    // Dải đèn Neon Cyan cắt ngang giữa các lá tản nhiệt
    const midHeatsinkGlow = createStadiumGlowRing(
      35.2,
      35.2,
      2.0,
      0.65,
      neonBlue,
    );
    midHeatsinkGlow.position.y = 11.4;
    group.add(midHeatsinkGlow);

    // Nắp đỉnh CPU (Top Processor Cap 34 x 3.0 x 34) + Đế lõi Hologram (24 x 2.5 x 24)
    const topCap = createBeveledSlabMesh(
      34,
      3.0,
      34,
      2.5,
      0.6,
      darkMetalMat,
    );
    topCap.position.y = 15.6;
    topCap.userData = { nodeId: node.id };
    group.add(topCap);

    const topCapRim = createStadiumGlowRing(
      33.5,
      33.5,
      2.4,
      0.75,
      neonBlue,
    );
    topCapRim.position.y = 18.7;
    group.add(topCapRim);

    const dieCore = createBeveledSlabMesh(
      23,
      2.4,
      23,
      1.8,
      0.5,
      deepSlateMat,
    );
    dieCore.position.y = 18.6;
    dieCore.userData = { nodeId: node.id };
    group.add(dieCore);

    const dieCoreRim = createStadiumGlowRing(
      22.5,
      22.5,
      1.8,
      0.8,
      0x67e8f9,
    );
    dieCoreRim.position.y = 21.1;
    group.add(dieCoreRim);

    // Cột Hologram dữ liệu ma trận (Vertical Matrix Hologram Projection) bay lên từ mặt đỉnh CPU
    const holoTex = createProcessMatrixHologramTexture(node.content);
    const holoMat = new THREE.MeshBasicMaterial({
      map: holoTex,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const holoGroup = new THREE.Group();
    holoGroup.position.y = 30.0;

    // 4 mặt tường Hologram xung quanh + 2 mặt chéo tạo hiệu ứng khối Hologram 3D dày đặc
    [
      [0, 0, 9.5, 0],
      [0, 0, -9.5, 0],
      [9.5, 0, 0, Math.PI / 2],
      [-9.5, 0, 0, Math.PI / 2],
      [0, 0, 0, Math.PI / 4],
      [0, 0, 0, -Math.PI / 4],
    ].forEach(([hx, hy, hz, ry]) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(19, 18), holoMat);
      p.position.set(hx, hy, hz);
      p.rotation.y = ry;
      holoGroup.add(p);
    });
    group.add(holoGroup);
  }

  // =====================================================================
  // 3. MÔ-ĐUN DECISION (Decision) — Trạm Lục Giác + Cổng vòm Xanh lá (TRUE) & Đỏ cam (FALSE)
  // =====================================================================
  else if (node.type === "decision") {
    // Khung PCB vuông viền vàng đồng dưới mặt đất
    group.add(createSquarePCBFrame(56, 56, 0xd4a359, isActive));

    // Thân tòa nhà lục giác (Hexagonal Hub)
    const hexBase = new THREE.Mesh(
      new THREE.CylinderGeometry(22.5, 23.5, 2.6, 6),
      deepSlateMat,
    );
    hexBase.position.y = 1.3;
    hexBase.userData = { nodeId: node.id };
    group.add(hexBase);

    const hexBody = new THREE.Mesh(
      new THREE.CylinderGeometry(19.5, 20.5, 13.5, 6),
      darkMetalMat,
    );
    hexBody.position.y = 9.3;
    hexBody.userData = { nodeId: node.id };
    group.add(hexBody);

    // Mái lục giác kèm vòng lục giác phát sáng xanh lục (Glowing Hexagonal Roof Ring)
    const hexRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(17.5, 19.0, 2.2, 6),
      deepSlateMat,
    );
    hexRoof.position.y = 17.1;
    hexRoof.userData = { nodeId: node.id };
    group.add(hexRoof);

    const roofHexRing = new THREE.Mesh(
      new THREE.TorusGeometry(14.5, 0.75, 8, 6),
      new THREE.MeshBasicMaterial({
        color: isTleNode ? 0xef4444 : 0x34d399,
      }),
    );
    roofHexRing.rotation.x = Math.PI / 2;
    roofHexRing.rotation.z = Math.PI / 6;
    roofHexRing.position.y = 18.4;
    group.add(roofHexRing);

    const innerHexRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.45, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    );
    innerHexRing.rotation.x = Math.PI / 2;
    innerHexRing.rotation.z = Math.PI / 6;
    innerHexRing.position.y = 18.4;
    group.add(innerHexRing);

    // Các tia hạt dữ liệu bay thẳng đứng lên từ các đỉnh lục giác trên mái
    for (let v = 0; v < 6; v++) {
      const va = (v * Math.PI) / 3 + Math.PI / 6;
      const beamH = 8 + (v % 3) * 4;
      const vBeam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, beamH, 6),
        new THREE.MeshBasicMaterial({
          color: v % 2 === 0 ? 0x34d399 : 0x22d3ee,
          transparent: true,
          opacity: 0.75,
        }),
      );
      vBeam.position.set(
        Math.cos(va) * 14.2,
        18.5 + beamH / 2,
        Math.sin(va) * 14.2,
      );
      group.add(vBeam);

      const vDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x6ee7b7 }),
      );
      vDot.position.set(
        Math.cos(va) * 14.2,
        18.5 + beamH + 0.8,
        Math.sin(va) * 14.2,
      );
      group.add(vDot);
    }

    // Hàm dựng cổng vòm phát sáng + 3 tia laser (TRUE bên trái Xanh lá, FALSE bên phải Đỏ san hô)
    const buildDecisionPortalTunnel = (sideSign, glowHex) => {
      const pGroup = new THREE.Group();
      const angle = sideSign * (Math.PI / 3);
      pGroup.position.set(
        Math.sin(angle) * 16.8,
        0,
        Math.cos(angle) * 16.8,
      );
      pGroup.rotation.y = angle;
      pGroup.userData = { nodeId: node.id };

      // Khung vòm kim loại nhô ra
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(9.2, 10.5, 5.2),
        darkMetalMat,
      );
      hood.position.y = 5.25;
      pGroup.add(hood);

      // Lõi cửa vòm phát sáng rực rỡ (Neon Green cho TRUE / Neon Red cho FALSE)
      const tunnelGlow = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 8.2, 5.6),
        new THREE.MeshBasicMaterial({ color: glowHex }),
      );
      tunnelGlow.position.y = 4.6;
      pGroup.add(tunnelGlow);

      // 3 tia laser dẫn luồng phát sáng phóng thẳng ra khỏi cổng vòm như trong ảnh mẫu DECISION
      [-2.0, 0, 2.0].forEach((lx, idx) => {
        const rayLen = idx === 1 ? 18 : 14;
        const laser = new THREE.Mesh(
          new THREE.BoxGeometry(idx === 1 ? 1.15 : 0.65, 0.5, rayLen),
          new THREE.MeshBasicMaterial({ color: glowHex }),
        );
        laser.position.set(lx, 0.45, 2.8 + rayLen / 2);
        pGroup.add(laser);
      });

      return pGroup;
    };

    // Cổng trái: TRUE (Xanh lá #22c55e) & Cổng phải: FALSE (Đỏ cam #ef4444)
    group.add(buildDecisionPortalTunnel(-1, 0x22c55e));
    group.add(buildDecisionPortalTunnel(1, 0xef4444));
  }

  // =====================================================================
  // 4. MÔ-ĐUN I/O SPIRE (Subroutine / Function & Input / Output) — Tháp Viễn Thông + Vòng Hologram HUD
  // =====================================================================
  else if (
    node.type === "subroutine" ||
    node.type === "input" ||
    node.type === "output"
  ) {
    const isFullSpire = node.type === "subroutine";
    const spireHex = isTleNode
      ? 0xef4444
      : node.type === "input"
        ? 0xc084fc
        : node.type === "output"
          ? 0x34d399
          : 0x22d3ee;
    const spireColorStr =
      node.type === "input"
        ? "#c084fc"
        : node.type === "output"
          ? "#34d399"
          : "#22d3ee";
    const towerH = isFullSpire ? 40 : 26;

    // Khung PCB vuông màu Cyan dưới chân tháp
    group.add(createSquarePCBFrame(52, 52, spireHex, isActive));

    // Đế tháp bát giác
    const padBase = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 16, 2.8, 8),
      deepSlateMat,
    );
    padBase.position.y = 1.4;
    padBase.userData = { nodeId: node.id };
    group.add(padBase);

    // 4 chân chống nghiêng (4 Angled Buttress Legs) bám xuống đế kèm đệm chân vàng đồng
    for (let b = 0; b < 4; b++) {
      const ba = (b * Math.PI) / 2 + Math.PI / 4;
      const legGroup = new THREE.Group();
      legGroup.rotation.y = ba;

      const legStrut = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 12.0, 5.5),
        darkMetalMat,
      );
      legStrut.position.set(0, 6.5, 9.5);
      legStrut.rotation.x = -0.35;
      legGroup.add(legStrut);

      const footPad = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.2, 3.6),
        goldPinMat,
      );
      footPad.position.set(0, 1.6, 13.0);
      legGroup.add(footPad);

      group.add(legGroup);
    }

    // Thân tháp trụ đứng vát cạnh thanh mảnh (Slender Octagonal Spire Shaft)
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 8.6, towerH, 8),
      darkMetalMat,
    );
    shaft.position.y = 2.8 + towerH / 2;
    shaft.userData = { nodeId: node.id };
    group.add(shaft);

    // 4 khe đèn Neon dọc thân tháp (Vertical Glowing Slits)
    for (let sl = 0; sl < 4; sl++) {
      const sa = (sl * Math.PI) / 2;
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, towerH * 0.72, 1.1),
        new THREE.MeshBasicMaterial({ color: spireHex }),
      );
      slit.position.set(
        Math.cos(sa) * 7.1,
        2.8 + towerH * 0.48,
        Math.sin(sa) * 7.1,
      );
      group.add(slit);
    }

    // Các vòng Hologram HUD (Rotating Cybernetic Holographic Rings) bao quanh thân tháp
    const bandTex = createSpireHologramBandTexture(spireColorStr);
    const ringHeights = isFullSpire
      ? [
          { y: 18, r: 12.5, h: 3.2, spd: 0.022 },
          { y: 28, r: 15.0, h: 4.0, spd: -0.028 },
          { y: 38, r: 18.0, h: 4.8, spd: 0.032 },
        ]
      : [
          { y: 15, r: 12.5, h: 3.2, spd: 0.025 },
          { y: 23, r: 15.0, h: 3.8, spd: -0.03 },
        ];

    ringHeights.forEach((rh, idx) => {
      const hRingGroup = new THREE.Group();
      hRingGroup.position.y = rh.y;

      const holoCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(rh.r, rh.r, rh.h, 32, 1, true),
        new THREE.MeshBasicMaterial({
          map: bandTex,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      hRingGroup.add(holoCyl);

      const rimTorus = new THREE.Mesh(
        new THREE.TorusGeometry(rh.r, 0.35, 8, 36),
        new THREE.MeshBasicMaterial({ color: spireHex }),
      );
      rimTorus.rotation.x = Math.PI / 2;
      hRingGroup.add(rimTorus);

      // Hạt vệ tinh phát sóng (Beacon Orbs) gắn quanh vòng Hologram
      const satOrb = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 10, 10),
        new THREE.MeshBasicMaterial({
          color: idx % 2 === 0 ? 0x6ee7b7 : 0xfef08a,
        }),
      );
      satOrb.position.set(rh.r + 2.2, 0, 0);
      hRingGroup.add(satOrb);

      group.add(hRingGroup);
      animatedRotators.push({
        mesh: hRingGroup,
        axis: "y",
        speed: rh.spd,
      });
    });

    // Đỉnh tháp: Đĩa Radar (Radar Dish) + Cột Ăng-ten cao vút + Vòng sóng phát xạ
    const topY = 2.8 + towerH;
    const topCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(6.6, 6.2, 3.2, 12),
      deepSlateMat,
    );
    topCollar.position.y = topY + 1.6;
    group.add(topCollar);

    // Đĩa Radar parabol gắn trên đỉnh tháp
    const radarDish = new THREE.Mesh(
      new THREE.SphereGeometry(
        3.2,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.45,
      ),
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.3,
        metalness: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    radarDish.rotation.x = Math.PI * 0.35;
    radarDish.position.set(-2.6, topY + 5.5, 2.2);
    group.add(radarDish);

    // Cột ăng-ten chính cao nổi bật
    const mastH = isFullSpire ? 22 : 14;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.9, mastH, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    mast.position.set(0, topY + 3.0 + mastH / 2, 0);
    group.add(mast);

    // Đèn phát sóng đỉnh ăng-ten + 2 vòng sóng Wi-Fi
    const tipY = topY + 3.0 + mastH;
    const tipBulb = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 12, 12),
      new THREE.MeshBasicMaterial({ color: spireHex }),
    );
    tipBulb.position.set(0, tipY, 0);
    group.add(tipBulb);

    [3.2, 5.4].forEach((wr) => {
      const waveRing = new THREE.Mesh(
        new THREE.TorusGeometry(wr, 0.3, 8, 24),
        new THREE.MeshBasicMaterial({
          color: spireHex,
          transparent: true,
          opacity: 0.75,
        }),
      );
      waveRing.position.set(0, tipY, 0);
      group.add(waveRing);
      animatedRotators.push({ mesh: waveRing, axis: "y", speed: 0.04 });
    });
  }

  // =====================================================================
  // 5. CONNECTOR (Điểm nối luồng): Trạm chuyển tiếp mạch IC tròn
  // =====================================================================
  else {
    group.add(createSquarePCBFrame(34, 34, 0x22d3ee, isActive));
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 12.5, 3.2, 24),
      deepSlateMat,
    );
    pad.position.y = 1.6;
    pad.userData = { nodeId: node.id };
    group.add(pad);

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 9, 5.5, 24),
      darkMetalMat,
    );
    core.position.y = 5.8;
    core.userData = { nodeId: node.id };
    group.add(core);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(9.2, 0.65, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 8.6;
    group.add(rim);
  }

  // Chấm đèn báo Breakpoint nếu khối có đặt Trạm Dừng
  if (node.bp) {
    const bpBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
    );
    bpBeacon.position.set(-22, 6.0, -22);
    group.add(bpBeacon);
  }

  return group;
};

// =========================================================================
// CẬP NHẬT MÔ-ĐUN STORAGE / MEMORY (Kho Mảng 1D & Ma trận 2D) THEO ĐÚNG ẢNH `model_3d_6.0.png`:
// - Đế bo mạch chủ (DIMM Socket Base) vát cạnh màu tối, có hàng chân pin vàng đồng (Gold IC Pins)
//   dọc cạnh dưới và dãy đèn LED trạng thái Đỏ/Vàng/Xanh ở mặt vát trước.
// - Các thanh RAM mạch xanh lá (Green PCB DIMM Modules) dựng đứng gắn hàng chip nhớ đen (Black IC Chips)
//   và chân tiếp xúc vàng đồng (Gold Edge Contacts); ô đang truy cập sẽ nâng cao và phát sáng Cyan!
// =========================================================================
rebuildVoxelArrayWarehouse3D = function () {
  if (!voxelWarehouseGroup) return;
  disposeHierarchy(voxelWarehouseGroup);
  if (cityGroup) cityGroup.add(voxelWarehouseGroup);

  let arrEntries = Object.entries(traceState.arrays || {});
  if (arrEntries.length === 0) {
    const g = currGraph();
    if (g) {
      g.nodes.forEach((n) => {
        const m2d = n.content.match(
          /([a-zA-Z_]\w*)\s*=\s*\[\s*(\[[\s\S]*?\])\s*\]/,
        );
        if (m2d) {
          try {
            const parsed2D = JSON.parse(`[${m2d[2]}]`);
            if (Array.isArray(parsed2D))
              arrEntries.push([m2d[1], parsed2D]);
          } catch (e) {}
        } else {
          const m1d = n.content.match(
            /([a-zA-Z_]\w*)\s*=\s*\[([^\[\]]*?)\]/,
          );
          if (m1d) {
            const vals = m1d[2]
              .split(",")
              .map((x) => Number(x.trim()) || 0);
            arrEntries.push([m1d[1], vals]);
          }
        }
      });
    }
  }

  if (arrEntries.length === 0) return;

  const [arrName, arrVals] = arrEntries[0];
  const is2DMatrix = Array.isArray(arrVals[0]);
  const baseX = -250;
  const baseZ = -215;
  const slotStep = 30;

  const baseDarkMat = new THREE.MeshStandardMaterial({
    color: 0x161c2c,
    roughness: 0.5,
    metalness: 0.55,
  });
  const slotMat = new THREE.MeshStandardMaterial({
    color: 0x0d111c,
    roughness: 0.7,
    metalness: 0.3,
  });
  const pcbGreenMat = new THREE.MeshStandardMaterial({
    color: 0x2d6e3e,
    roughness: 0.45,
    metalness: 0.25,
  });
  const pcbActiveMat = new THREE.MeshStandardMaterial({
    color: 0x3b8a4f,
    roughness: 0.35,
    metalness: 0.3,
    emissive: 0x10b981,
    emissiveIntensity: 0.45,
  });
  const icChipMat = new THREE.MeshStandardMaterial({
    color: 0x111520,
    roughness: 0.5,
    metalness: 0.4,
  });
  const goldPinMat = new THREE.MeshStandardMaterial({
    color: 0xd99b43,
    roughness: 0.3,
    metalness: 0.88,
  });

  const createPointerLaserRay = (ptrName, targetPos, colorHex) => {
    const originPos = new THREE.Vector3(baseX - 38, 48, baseZ - 30);
    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 12, 12),
      new THREE.MeshBasicMaterial({ color: colorHex }),
    );
    emitter.position.copy(originPos);
    voxelWarehouseGroup.add(emitter);

    const rayCurve = new THREE.LineCurve3(originPos, targetPos);
    const rayMesh = new THREE.Mesh(
      new THREE.TubeGeometry(rayCurve, 8, 0.7, 6, false),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.88,
      }),
    );
    voxelWarehouseGroup.add(rayMesh);
  };

  // Hàm dựng 1 thanh RAM mạch xanh lá (Green PCB DIMM Stick) gắn chip nhớ đen đúng chuẩn STORAGE
  const createGreenRamModuleStick = (stickWidth, isAccessed) => {
    const stickGroup = new THREE.Group();
    const stickH = 15.5;

    // Khe cắm DIMM màu tối dưới chân
    const socket = new THREE.Mesh(
      new THREE.BoxGeometry(stickWidth + 2.4, 2.6, 5.2),
      slotMat,
    );
    socket.position.y = 1.3;
    stickGroup.add(socket);

    // Dải chân tiếp xúc mạ vàng (Gold Edge Contacts) ở mép dưới thanh RAM
    const goldEdge = new THREE.Mesh(
      new THREE.BoxGeometry(stickWidth - 1.5, 1.8, 2.0),
      goldPinMat,
    );
    goldEdge.position.y = 3.2;
    stickGroup.add(goldEdge);

    // Bản mạch PCB màu xanh lá cây dựng đứng
    const pcbBoard = new THREE.Mesh(
      new THREE.BoxGeometry(stickWidth, stickH, 1.6),
      isAccessed ? pcbActiveMat : pcbGreenMat,
    );
    pcbBoard.position.y = 3.8 + stickH / 2;
    stickGroup.add(pcbBoard);

    // Hàng chip nhớ IC màu đen (Black IC Memory Chips) gắn trên 2 mặt thanh RAM
    const chipCount = Math.max(2, Math.floor(stickWidth / 6.2));
    const chipSpacing = (stickWidth - 4) / chipCount;
    for (let c = 0; c < chipCount; c++) {
      const cx =
        -stickWidth / 2 + 2 + chipSpacing * 0.5 + c * chipSpacing;
      const chip = new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.min(4.4, chipSpacing * 0.78),
          7.8,
          2.5,
        ),
        icChipMat,
      );
      chip.position.set(cx, 3.8 + stickH * 0.54, 0);
      stickGroup.add(chip);
    }

    return stickGroup;
  };

  if (is2DMatrix) {
    const rows = arrVals.length;
    const cols = Math.max(
      1,
      ...arrVals.map((r) => (Array.isArray(r) ? r.length : 1)),
    );
    const trayW = cols * slotStep + 22;
    const trayD = rows * 18 + 22;
    const centerX = baseX + ((cols - 1) * slotStep) / 2;
    const centerZ = baseZ + ((rows - 1) * 18) / 2;

    const frame = createSquarePCBFrame(
      trayW + 12,
      trayD + 12,
      0x22d3ee,
      true,
    );
    frame.position.set(centerX, 0, centerZ);
    voxelWarehouseGroup.add(frame);

    const trayMesh = createBeveledSlabMesh(
      trayW,
      5.0,
      trayD,
      4,
      0.9,
      baseDarkMat,
    );
    trayMesh.position.set(centerX, 0, centerZ);
    voxelWarehouseGroup.add(trayMesh);

    const curI = traceState.vars?.i;
    const curJ = traceState.vars?.j;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isAccessed = curI === r && curJ === c;
        const tx = baseX + c * slotStep;
        const tz = baseZ + r * 18;
        const elevY = isAccessed ? 9.5 : 5.0;

        const stick = createGreenRamModuleStick(24, isAccessed);
        stick.position.set(tx, elevY, tz);
        voxelWarehouseGroup.add(stick);

        if (isAccessed) {
          const cyanRim = createStadiumGlowRing(
            26,
            8,
            2.0,
            0.8,
            0x22d3ee,
          );
          cyanRim.position.set(tx, elevY + 0.4, tz);
          voxelWarehouseGroup.add(cyanRim);
          createPointerLaserRay(
            "i,j",
            new THREE.Vector3(tx, elevY + 18, tz),
            0x22d3ee,
          );
        }
      }
    }
  } else {
    const len = arrVals.length;
    const trayW = Math.max(78, len * slotStep + 24);
    const trayD = 48;
    const centerX = baseX + ((len - 1) * slotStep) / 2;

    // Khung viền Cyan dưới mặt đất cho khối STORAGE
    const frame = createSquarePCBFrame(
      trayW + 14,
      trayD + 14,
      0x22d3ee,
      true,
    );
    frame.position.set(centerX, 0, baseZ);
    voxelWarehouseGroup.add(frame);

    // Đế bo mạch STORAGE vát cạnh
    const trayMesh = createBeveledSlabMesh(
      trayW,
      5.2,
      trayD,
      4.2,
      0.9,
      baseDarkMat,
    );
    trayMesh.position.set(centerX, 0, baseZ);
    voxelWarehouseGroup.add(trayMesh);

    // Hàng chân pin vàng đồng (Gold IC Pins) dọc theo cạnh trước và cạnh bên của đế STORAGE
    const pinCountFront = Math.min(14, Math.floor(trayW / 5.5));
    for (let p = 0; p < pinCountFront; p++) {
      const px = centerX - ((pinCountFront - 1) * 4.8) / 2 + p * 4.8;
      const pinF = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.4, 4.0),
        goldPinMat,
      );
      pinF.position.set(px, 1.0, baseZ + trayD / 2 + 1.2);
      voxelWarehouseGroup.add(pinF);
    }

    // Đèn LED trạng thái Đỏ / Vàng / Xanh lá ở mặt trước đế STORAGE (như ảnh model_3d_6.0.png)
    [0xef4444, 0xf43f5e, 0xfbbf24, 0x22c55e, 0x22d3ee].forEach(
      (ledCol, lIdx) => {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(1.0, 10, 10),
          new THREE.MeshBasicMaterial({ color: ledCol }),
        );
        led.position.set(
          centerX - trayW / 2 + 10 + lIdx * 4.2,
          5.4,
          baseZ + trayD / 2 - 4.5,
        );
        voxelWarehouseGroup.add(led);
      },
    );

    // Dựng 2 hàng thanh RAM xanh lá song song (giống hệt khối STORAGE trong model_3d_6.0.png)
    // kết hợp với từng ô phần tử của mảng để khi truy cập phần tử i, j thanh RAM đó nhô cao và sáng viền!
    arrVals.forEach((val, idx) => {
      const matchingPtrs = Object.keys(POINTER_COLORS).filter(
        (pKey) => traceState.vars && traceState.vars[pKey] === idx,
      );
      const isAccessed = matchingPtrs.length > 0;
      const elevY = isAccessed ? 9.8 : 5.2;
      const tx = baseX + idx * slotStep;

      // Thanh RAM chính phía trước và thanh RAM song song phía sau tạo khối STORAGE 2 kênh đôi (Dual-Channel DIMM)
      [-7.5, 6.5].forEach((zOff, rowIdx) => {
        const stick = createGreenRamModuleStick(
          24,
          isAccessed && rowIdx === 1,
        );
        stick.position.set(tx, rowIdx === 1 ? elevY : 5.2, baseZ + zOff);
        voxelWarehouseGroup.add(stick);
      });

      if (isAccessed) {
        const cyanRim = createStadiumGlowRing(
          26.5,
          24,
          2.8,
          0.9,
          0x22d3ee,
        );
        cyanRim.position.set(tx, elevY + 0.3, baseZ);
        voxelWarehouseGroup.add(cyanRim);

        matchingPtrs.forEach((pName) => {
          createPointerLaserRay(
            pName,
            new THREE.Vector3(tx, elevY + 19, baseZ + 6.5),
            POINTER_COLORS[pName] || 0x22d3ee,
          );
        });
      }
    });
  }
};


// -------------------------------------------------------------------------
// HẠNG MỤC 1: SỬA LỖI XOAY 360 ĐỘ Ở CHẾ ĐỘ 3D & CHẠY SONG SONG VỚI CHẾ ĐỘ 2D
// - Khi ở Chế độ 3D: mở khóa hoàn toàn controls.enableRotate = true và controls.enabled = true.
//   * Chuột trái: Nhấn giữ và kéo để xoay 360 độ quanh tâm thành phố.
//   * Chuột phải (hoặc phím Space + chuột trái): Trượt mặt phẳng (Pan).
//   * Cuộn chuột: Phóng to / thu nhỏ (Zoom).
// - Khi ở Chế độ 2D (Mặt bằng):
//   * Chuyển camera về góc nhìn trực giao từ trên đỉnh nhìn xuống (controls.enableRotate = false).
//   * Chuột trái giữ nguyên tính năng di chuyển không gian (Free Pan trên nền trống)
//     và kéo thả khối lệnh (bắt lưới 20px).
// - Nút chuyển đổi mượt mà: 🌐 Chế độ 3D / 📐 Chế độ 2D
// -------------------------------------------------------------------------
let orbit3DManualState = {
  active: false,
  mode: null, // 'rotate' | 'pan'
  lastX: 0,
  lastY: 0,
};

function syncOrbitControlsForCurrentMode() {
  if (!controls || !camera) return;
  const btn = document.getElementById("btnViewMode");
  const vp = document.getElementById("cityViewport");

  if (isTopDown2D) {
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    if (vp) {
      vp.classList.add("mode-2d-active", "canvas-pan-ready");
    }
    if (btn) {
      btn.textContent = "🌐 Chế độ 3D / 📐 Chế độ 2D (Đang ở: 2D)";
    }
  } else {
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    if (typeof THREE !== "undefined" && THREE.MOUSE) {
      controls.mouseButtons = {
        LEFT: FreeCanvasPan.spacePressed
          ? THREE.MOUSE.PAN
          : THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
    if (vp) {
      vp.classList.remove(
        "mode-2d-active",
        "canvas-pan-ready",
        "canvas-pan-active",
      );
    }
    if (btn) {
      btn.textContent = "🌐 Chế độ 3D / 📐 Chế độ 2D (Đang ở: 3D)";
    }
  }
}

toggleCameraProjectionAngle = function () {
  isTopDown2D = !isTopDown2D;
  pan2DState.isPanning = false;
  FreeCanvasPan.active = false;
  FreeCanvasPan.inertiaActive = false;
  draggingBuildingState.active = false;
  hudCardDragState.active = false;
  orbit3DManualState.active = false;

  if (!camera || !controls) return;

  if (isTopDown2D) {
    camera.position.set(
      controls.target.x,
      560,
      controls.target.z + 0.001,
    );
    camera.lookAt(controls.target.x, 0, controls.target.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    syncOrbitControlsForCurrentMode();
    setStatusText(
      "📐 Chế độ 2D (Mặt bằng): Kéo chuột trái trên nền trống để Pan tự do • Kéo khối lệnh để bắt lưới 20px.",
    );
  } else {
    camera.position.set(
      controls.target.x + 340,
      330,
      controls.target.z + 340,
    );
    camera.lookAt(controls.target.x, 20, controls.target.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    syncOrbitControlsForCurrentMode();
    controls.update();
    setStatusText(
      "🌐 Chế độ 3D: Nhấn giữ chuột trái kéo để xoay 360° • Chuột phải (hoặc Space + chuột trái) để Pan • Cuộn chuột để Zoom.",
    );
  }
  rebuild3DCityScene();
  updateHudPositions();
  updateZoomBadgeUI();
  sync2DGridBackgroundWithCamera();
};

// Chỉ cho phép kéo thả nhãn HUD khối lệnh khi đang ở Chế độ 2D;

// Hàm xoay 360 độ trực tiếp bằng tọa độ cầu (Spherical) quanh controls.target
function apply3DSphericalRotationDelta(dxPixels, dyPixels) {
  if (!camera || !controls || isTopDown2D) return;
  const offset = new THREE.Vector3()
    .copy(camera.position)
    .sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= dxPixels * 0.0075;
  spherical.phi = Math.max(
    0.06,
    Math.min(Math.PI / 2 - 0.06, spherical.phi - dyPixels * 0.0065),
  );
  spherical.makeSafe();
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
  updateHudPositions();
}

// Hàm Pan mặt phẳng XZ trong không gian 3D
function apply3DPanDelta(dxPixels, dyPixels) {
  if (!camera || !controls) return;
  const mount = document.getElementById("threeCanvasMount");
  const rect = mount
    ? mount.getBoundingClientRect()
    : { width: 800, height: 600 };
  const viewW = Math.max(1, rect.width);
  const viewH = Math.max(1, rect.height);
  const zoom = Math.max(0.15, camera.zoom || 1);
  const worldPerPixelX = (camera.right - camera.left) / zoom / viewW;
  const worldPerPixelZ = (camera.top - camera.bottom) / zoom / viewH;

  const rightVec = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  camera.matrixWorld.extractBasis(rightVec, upVec, new THREE.Vector3());
  rightVec.y = 0;
  rightVec.normalize();
  const forwardVec = new THREE.Vector3(
    -rightVec.z,
    0,
    rightVec.x,
  ).normalize();

  const moveX =
    (-dxPixels * rightVec.x - dyPixels * forwardVec.x) *
    worldPerPixelX *
    1.15;
  const moveZ =
    (-dxPixels * rightVec.z - dyPixels * forwardVec.z) *
    worldPerPixelZ *
    1.15;
  camera.position.x += moveX;
  camera.position.z += moveZ;
  controls.target.x += moveX;
  controls.target.z += moveZ;
  camera.updateMatrixWorld();
  updateHudPositions();
}

// Cập nhật animateCityLoop để luôn mở khóa OrbitControls khi ở Chế độ 3D
animateCityLoop = function () {
  requestAnimationFrame(animateCityLoop);

  animatedRotators.forEach((item) => {
    if (item.axis === "y") item.mesh.rotation.y += item.speed;
    if (item.axis === "z") item.mesh.rotation.z += item.speed;
  });

  roadPulseItems.forEach((item) => {
    item.t = (item.t + 0.008) % 1.0;
    const pt = item.curve.getPointAt(item.t);
    item.mesh.position.copy(pt);
  });

  if (capsuleAnim.moving && capsuleAnim.points.length >= 2) {
    capsuleAnim.progress += capsuleAnim.speed * capsuleSpeedMult;
    if (capsuleAnim.progress >= 1) {
      capsuleAnim.progress = 1;
      capsuleAnim.moving = false;
    }
    const curve = new THREE.CatmullRomCurve3(capsuleAnim.points);
    const pos = curve.getPointAt(capsuleAnim.progress);
    dataCapsuleMesh.position.copy(pos);
    dataCapsuleRing.rotation.z += 0.08;
  }

  const droneEnabled =
    document.getElementById("focusDroneToggle")?.checked;
  if (
    traceState.active &&
    droneEnabled &&
    traceState.currNodeId &&
    !pan2DState.isPanning
  ) {
    const activeBuilding = buildingMeshesMap[traceState.currNodeId];
    if (activeBuilding) {
      cameraTargetGoal.copy(activeBuilding.position);
      controls.target.lerp(
        cameraTargetGoal,
        Math.min(0.5, 0.06 * capsuleSpeedMult),
      );
      if (isTopDown2D && camera) {
        camera.position.x = controls.target.x;
        camera.position.z = controls.target.z + 0.001;
      }
    }
  }

  if (controls && !isTopDown2D) {
    // Luôn đảm bảo ở Chế độ 3D thì controls.enabled = true và controls.enableRotate = true
    if (!rubberbandDragState.active) {
      controls.enabled = true;
      controls.enableRotate = true;
      controls.enablePan = true;
    }
    controls.update();
  } else if (camera && isTopDown2D) {
    if (controls) {
      controls.enableRotate = false;
      controls.enabled = false;
    }
    camera.position.x = controls.target.x;
    camera.position.y = 560;
    camera.position.z = controls.target.z + 0.001;
    camera.lookAt(controls.target.x, 0, controls.target.z);
    camera.updateMatrixWorld();
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    updateHudPositions();
  }
};

