// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/bitto.js
// Mô tả: Linh vật 3D Bitto Mascot WebGL, 6 biểu cảm LED Pixel Matrix,
//        Tương tác thông minh 2 vùng (Tâm kéo rê / Rìa xoay 360°),
//        Bitto AI Copilot 2.0 (Direct Chat Popup & Quick Prompts) & Tour 7 bước.
// ============================================================================

// ---------- Tính năng 1 (v5.2): LINH VẬT BITTO 3D TƯƠNG TÁC ĐA ĐIỂM ----------
const BITTO_POS_STORAGE_KEY = "algoflow_bitto_dock_pos_v52";
const Bitto = {
  renderer: null,
  scene: null,
  camera: null,
  root: null,
  flames: [],
  ions: [],
  armL: null,
  armR: null,
  tex: null,
  ctx: null,
  mood: "happy",
  bounce: 0,
  userRotY: 0,
  userRotX: 0,
  tickleUntil: 0,
  angryUntil: 0,
  clickTimestamps: [],
  angerCooldownTimer: null,
};
// [UPGRADE FEATURE 3]: Hệ thống 6 biểu cảm LED Pixel Matrix chuẩn xác + tương tác mở rộng
const BITTO_FACES = {
  happy: ["[^_^]", "#22d3ee"], // Vui vẻ / Sẵn sàng (Mở web, Reset, PASS hết testcase)
  debug: ["[o_o]", "#38bdf8"], // Tập trung / Quét dữ liệu (Viên nang di chuyển, Step Debug, chạy test)
  warn: ["[>_<]", "#facc15"], // Cảnh báo (Linter phát hiện biến chưa khởi tạo / Dead Code)
  fail: ["[x_x]", "#f43f5e"], // Thất bại (Testcase FAIL hoặc TLE)
  confused: ["[?_?]", "#c084fc"], // Ngơ ngác / Tìm tòi (Xóa hết sơ đồ hoặc thiếu khối Start/End)
  wink: ["[^_~]", "#34d399"], // Nháy mắt khích lệ (Vừa kết nối thành công 2 khối lệnh)
  tickle: ["[^o^]", "#38bdf8"],
  angry: ["[>_<]", "#ef4444"],
  angryAlt: ["[#_#]", "#ef4444"],
};
const BITTO_TIPS = [
  "Bấm chấm tròn trên nhãn khối để đặt Breakpoint, rồi bấm 🎯 Tới Trạm Dừng nhé!",
  "Giữ chuột phải lên người mình để xoay mình 360° độc lập, hoặc kéo chuột trái để dời chỗ mình!",
  "Chuyển sang 📐 Mặt Bằng 2D để kéo thả các tòa nhà trực tiếp trên sơ đồ nhé!",
  "Nhấn ⚡ Cập Nhật & Tự Hành (Ctrl+Shift+Enter) để dịch C++ và cho viên nang chạy tự động luôn!",
  "Chỉnh thanh Tốc độ viên nang từ 0.5x đến 4.0x để xem chậm hoặc chạy nhanh.",
  "Thêm Testcase ở cuối bảng bên phải rồi bấm Chạy Test để chấm tự động.",
  "Ctrl+Z / Ctrl+Y để hoàn tác hoặc làm lại thao tác trên sơ đồ.",
  "Bật Drone Theo Dõi để camera bay theo viên nang dữ liệu.",
];
let bittoTimer = null,
  bittoLastTip = -1,
  bittoWarnSig = "";
// [UPGRADE FEATURE 3]: Tự động suy luận biểu cảm nền bao gồm cả [?_?] khi thiếu Start/End hoặc sơ đồ rỗng
const bittoBase = () => {
  if (Date.now() < Bitto.angryUntil) return "angry";
  if (Date.now() < Bitto.tickleUntil) return "tickle";
  if (Date.now() < (Bitto.winkUntil || 0)) return "wink";
  if (traceState.active) return "debug";
  const g = typeof currGraph === "function" ? currGraph() : null;
  const nodes = g?.nodes || [];
  const hasStart = nodes.some((n) => n.type === "start");
  const hasEndOrRet = nodes.some(
    (n) => n.type === "end" || n.type === "return",
  );
  if (nodes.length === 0 || !hasStart || !hasEndOrRet) return "confused";
  if (window.__lastLint && window.__lastLint.warnings.length)
    return "warn";
  return "happy";
};

// [UPGRADE FEATURE 3]: Vẽ ma trận điểm LED Pixel sắc nét cho mặt kính của Bitto
function bittoDrawFace(m) {
  if (!Bitto.ctx) return;
  const c = Bitto.ctx;
  const faceTuple = BITTO_FACES[m] || BITTO_FACES.happy;
  const [txt, col] = faceTuple;

  // Nền màn hình LED ma trận
  c.fillStyle = m === "angry" || m === "angryAlt" ? "#1a0409" : "#030f18";
  c.fillRect(0, 0, 64, 40);

  // Lưới điểm LED mờ phía sau (Matrix LED dots background)
  c.fillStyle = "rgba(34, 211, 238, 0.08)";
  for (let gx = 2; gx < 64; gx += 4) {
    for (let gy = 2; gy < 40; gy += 4) {
      c.fillRect(gx, gy, 2, 2);
    }
  }

  // Vẽ ký tự biểu cảm LED phát sáng
  c.font = "bold 17px 'Fira Code', monospace";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.shadowColor = col;
  c.shadowBlur = m === "angry" || m === "angryAlt" ? 9 : 5;
  c.fillStyle = col;
  c.fillText(txt, 32, 21);
  c.shadowBlur = 0;

  // Tạo hiệu ứng rãnh điểm Pixel Matrix ngang & dọc
  c.fillStyle = "rgba(2, 6, 14, 0.32)";
  for (let y = 0; y < 40; y += 2) c.fillRect(0, y, 64, 1);
  for (let x = 0; x < 64; x += 2) c.fillRect(x, 0, 1, 40);

  Bitto.tex.needsUpdate = true;
}
function bittoSetMood(m) {
  if (Bitto.mood === m) return;
  Bitto.mood = m;
  if (Bitto.ctx) bittoDrawFace(m);
}
function bittoSay(text, mood, ms = 4200) {
  const b = $id("bittoBubble");
  if (!b) return;
  // Do not override active anger state with normal messages
  if (Date.now() < Bitto.angryUntil && mood !== "angry") {
    return;
  }
  if (mood) bittoSetMood(mood);
  b.dataset.mood = Bitto.mood;
  b.textContent = text;
  b.classList.remove("off");
  clearTimeout(bittoTimer);
  bittoTimer = setTimeout(() => {
    b.classList.add("off");
    bittoSetMood(bittoBase());
  }, ms);
}

function bittoBuild() {
  const B = Bitto,
    V = 0.18;
  B.root = new THREE.Group();
  B.scene.add(B.root);
  const M = (c, e, ei = 0.9) =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.55,
      metalness: 0.25,
      emissive: e || 0x000000,
      emissiveIntensity: e ? ei : 0,
    });
  const box = (w, h, d, m, x, y, z, p = B.root) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    p.add(o);
    return o;
  };
  const dark = [M(0x1b2236), M(0x242c47)];
  [
    [6, 5],
    [8, 7],
    [10, 8],
    [11, 9],
    [11, 9],
    [11, 9],
    [10, 8],
    [8, 7],
  ].forEach(([w, d], i) =>
    box(w * V, V, d * V, dark[i % 2], 0, i * V + V / 2, 0),
  );
  // Màn hình LED pixel
  B.ctx = Object.assign(document.createElement("canvas"), {
    width: 64,
    height: 40,
  }).getContext("2d");
  B.tex = new THREE.CanvasTexture(B.ctx.canvas);
  B.tex.magFilter = B.tex.minFilter = THREE.NearestFilter;
  B.tex.generateMipmaps = false;
  bittoDrawFace(B.mood);
  box(1.72, 1.02, 0.06, M(0x0b1020), 0, 0.9, 0.81);
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(1.56, 0.9),
    new THREE.MeshBasicMaterial({ map: B.tex }),
  );
  scr.position.set(0, 0.9, 0.85);
  B.root.add(scr);
  // Mũ bảo hộ tím-cyan
  const pur = M(0xa855f7),
    pur2 = M(0x8b5cf6),
    cy = M(0x22d3ee, 0x22d3ee, 0.7);
  box(2.1, 0.14, 1.75, pur, 0, 1.51, 0);
  box(1.6, 0.2, 1.35, pur2, 0, 1.68, 0);
  box(1.1, 0.2, 0.95, pur, 0, 1.88, 0);
  box(0.34, 0.5, 1.0, cy, 0, 1.8, 0);
  box(0.2, 0.2, 0.12, cy, 0, 1.55, 0.88);
  // Họa tiết ngực: chữ T cam + đường mạch cyan
  const org = M(0xfb923c, 0xfb923c, 0.9);
  box(0.5, 0.1, 0.04, org, 0, 0.46, 0.76);
  box(0.1, 0.32, 0.04, org, 0, 0.3, 0.76);
  box(1.5, 0.04, 0.04, cy, 0, 0.12, 0.62);
  box(0.05, 0.4, 0.5, cy, 1.0, 0.7, 0);
  box(0.05, 0.4, 0.5, cy, -1.0, 0.7, 0);
  // Hai tay robot mini (tay trái cầm bút, tay phải cầm tablet)
  const arm = (sx) => {
    const a = new THREE.Group();
    a.position.set(sx * 1.2, 1.0, 0.15);
    box(0.22, 0.5, 0.22, dark[1], 0, -0.25, 0, a);
    box(0.28, 0.2, 0.28, org, 0, -0.55, 0, a);
    B.root.add(a);
    return a;
  };
  B.armL = arm(-1);
  B.armR = arm(1);
  const pen = box(0.06, 0.5, 0.06, M(0xcbd5e1), 0, -0.6, 0.12, B.armL);
  pen.rotation.z = 0.5;
  box(0.5, 0.36, 0.05, M(0x94a3b8), 0, -0.62, 0.16, B.armR);
  // Động cơ phản lực neon + hạt ion
  [-0.5, 0.5].forEach((x) => {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.3, 8),
      M(0x2a3050, 0x22d3ee, 0.25),
    );
    cyl.position.set(x, -0.08, 0);
    B.root.add(cyl);
    const fl = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xfb923c }),
    );
    fl.rotation.z = Math.PI;
    fl.position.set(x, -0.4, 0);
    B.root.add(fl);
    B.flames.push(fl);
  });
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.05),
      new THREE.MeshBasicMaterial({
        color: i % 3 ? 0x22d3ee : 0xf472b6,
        transparent: true,
      }),
    );
    p.userData = {
      life: i / 12,
      v: 0.003 * (i % 4),
      x: i % 2 ? 0.5 : -0.5,
      dx: (Math.random() - 0.5) * 0.25,
    };
    B.root.add(p);
    B.ions.push(p);
  }
  B.scene.add(new THREE.AmbientLight(0x8090c0, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(2, 4, 3);
  B.scene.add(key);
  const glow = new THREE.PointLight(0x22d3ee, 1.2, 6);
  glow.position.set(0, -0.6, 1.2);
  B.scene.add(glow);
  const glow2 = new THREE.PointLight(0xa855f7, 0.9, 7);
  glow2.position.set(-2, 1.5, 1.5);
  B.scene.add(glow2);
}

function bittoLoop(ts) {
  requestAnimationFrame(bittoLoop);
  const B = Bitto,
    t = ts / 1000;
  if (!B.renderer) return;

  const now = Date.now();
  const isAngry = now < B.angryUntil;
  const isTickle = !isAngry && now < B.tickleUntil;

  if (isAngry) {
    // Alternate angry LED expressions [>_<] and [#_#]
    const angryFace = Math.floor(t * 8) % 2 === 0 ? "angry" : "angryAlt";
    bittoSetMood(angryFace);
  } else if (isTickle) {
    bittoSetMood("tickle");
  }

  // Position & violent shake / tickle wiggle
  const shakeX = isAngry
    ? Math.sin(t * 68) * 0.11 + Math.cos(t * 43) * 0.06
    : isTickle
      ? Math.sin(t * 32) * 0.06
      : B.mood === "fail"
        ? Math.sin(t * 45) * 0.025
        : 0;
  const shakeY = isAngry ? Math.cos(t * 55) * 0.08 : 0;

  B.root.position.set(
    shakeX,
    Math.sin(t * 1.7) * 0.09 +
      Math.sin(B.bounce * 10) * 0.12 * B.bounce +
      shakeY,
    0,
  );

  // [UPGRADE FEATURE 3]: Damping return về góc nhìn chính diện khi thả chuột
  if (!B.isDraggingRot) {
    B.userRotY *= 0.91;
    B.userRotX *= 0.91;
    if (Math.abs(B.userRotY) < 0.001) B.userRotY = 0;
    if (Math.abs(B.userRotX) < 0.001) B.userRotX = 0;
  }

  // [UPGRADE FEATURE 3]: Rich Idle Animations khi người dùng không thao tác >= 10 giây
  const idleMs = now - (B.lastUserActivity || now);
  const isDeepIdle =
    idleMs >= 10000 && !isAngry && !isTickle && !B.isDraggingRot;
  let idleLookY = 0;
  let idleTiltZ = 0;
  let idleTiltX = 0;
  if (isDeepIdle) {
    // Chu kỳ 9 giây: ngó nghiêng trái phải + nghiêng đầu + xoay nhẹ thân mình
    const phase = t % 9;
    if (phase < 3.5) {
      idleLookY = Math.sin(phase * 2.6) * 0.52;
      idleTiltZ = Math.sin(phase * 2.6) * 0.16;
    } else if (phase < 6.5) {
      idleLookY = Math.cos((phase - 3.5) * 2.2) * 0.38;
      idleTiltX = Math.sin((phase - 3.5) * 3.1) * 0.14;
    }
  }

  // Combine autonomous breathing hover + rich idle motion + user 360° rotation
  const tickleRotZ = isTickle
    ? Math.sin(t * 28) * 0.28
    : Math.cos(t * 1.3) * 0.04;
  const angryRotZ = isAngry ? Math.sin(t * 50) * 0.16 : 0;
  B.root.rotation.y =
    0.42 + Math.sin(t * 0.7) * 0.14 + idleLookY + B.userRotY;
  B.root.rotation.x = Math.sin(t * 0.9) * 0.03 + idleTiltX + B.userRotX;
  B.root.rotation.z = tickleRotZ + angryRotZ + idleTiltZ;

  B.bounce = Math.max(0, B.bounce - 0.03);

  // Arms animation: wave when tickled, angry, or during 10s idle wave gesture
  if (isTickle) {
    B.armL.rotation.z = 0.85 + Math.sin(t * 30) * 0.65;
    B.armR.rotation.z = -0.85 - Math.cos(t * 30) * 0.65;
    B.armL.rotation.x = Math.sin(t * 24) * 0.4;
    B.armR.rotation.x = -Math.sin(t * 24) * 0.4;
  } else if (isAngry) {
    B.armL.rotation.z = 0.65 + Math.sin(t * 45) * 0.45;
    B.armR.rotation.z = -0.65 - Math.sin(t * 45) * 0.45;
    B.armL.rotation.x = -0.5;
    B.armR.rotation.x = -0.5;
  } else if (isDeepIdle && t % 9 >= 3.0 && t % 9 <= 7.2) {
    // Vẫy hai cánh tay rô-bốt thân thiện khi rảnh 10s
    B.armL.rotation.z = 0.55 + Math.sin(t * 9.5) * 0.38;
    B.armR.rotation.z = -0.55 - Math.cos(t * 9.5) * 0.38;
    B.armL.rotation.x = -0.25 + Math.sin(t * 6.0) * 0.18;
    B.armR.rotation.x = -0.25 + Math.cos(t * 6.0) * 0.18;
  } else {
    B.armL.rotation.z = 0.12 + Math.sin(t * 2.1) * 0.07;
    B.armR.rotation.z = -0.12 - Math.sin(t * 2.1 + 1) * 0.07;
    B.armL.rotation.x = 0;
    B.armR.rotation.x = 0;
  }

  // Jet thrusters: intense red-orange flame burst when angry
  B.flames.forEach((f, i) => {
    if (isAngry) {
      f.material.color.setHex(i % 2 === 0 ? 0xff2a00 : 0xff6a00);
      const s = 2.15 + 0.65 * Math.sin(t * 40 + i * 2);
      f.scale.set(1.45, s, 1.45);
      f.position.y = -0.22 - 0.34 * s;
    } else {
      f.material.color.setHex(0xfb923c);
      const s =
        1 + 0.35 * Math.sin(t * 16 + i * 2) + 0.12 * Math.sin(t * 33 + i);
      f.scale.set(1, s, 1);
      f.position.y = -0.22 - 0.3 * s;
    }
  });

  B.ions.forEach((p) => {
    const u = p.userData;
    u.life = (u.life + (isAngry ? 0.035 : 0.012) + u.v) % 1;
    p.position.set(
      u.x + u.dx * u.life,
      -0.6 - u.life * (isAngry ? 1.35 : 0.9),
      0,
    );
    p.material.opacity = 1 - u.life;
  });
  B.renderer.render(B.scene, B.camera);
}

function restoreBittoDockPosition() {
  const dock = $id("bittoDock");
  if (!dock) return;
  try {
    const raw = localStorage.getItem(BITTO_POS_STORAGE_KEY);
    if (!raw) return;
    const pos = JSON.parse(raw);
    if (typeof pos?.left === "number" && typeof pos?.top === "number") {
      const parent = dock.parentElement;
      const maxL = Math.max(
        0,
        (parent?.clientWidth || window.innerWidth) - 160,
      );
      const maxT = Math.max(
        0,
        (parent?.clientHeight || window.innerHeight) - 160,
      );
      dock.style.left = Math.min(maxL, Math.max(4, pos.left)) + "px";
      dock.style.top = Math.min(maxT, Math.max(4, pos.top)) + "px";
      dock.style.bottom = "auto";
    }
  } catch (e) {}
}

function saveBittoDockPosition(left, top) {
  try {
    localStorage.setItem(
      BITTO_POS_STORAGE_KEY,
      JSON.stringify({ left: Math.round(left), top: Math.round(top) }),
    );
  } catch (e) {}
}

function bittoShowDedicatedTip() {
  let i;
  do {
    i = Math.floor(Math.random() * BITTO_TIPS.length);
  } while (i === bittoLastTip);
  bittoLastTip = i;
  Bitto.bounce = 1.0;
  bittoSay("💡 " + BITTO_TIPS[i], "happy", 7000);
}

function handleBittoPokeInteraction() {
  const now = Date.now();
  Bitto.clickTimestamps = Bitto.clickTimestamps.filter(
    (t) => now - t <= 2000,
  );
  Bitto.clickTimestamps.push(now);

  if (Bitto.clickTimestamps.length >= 4) {
    // Spam Click (>= 4 times within 2 seconds) -> ANGER STATE
    Bitto.angryUntil = now + 4000;
    Bitto.tickleUntil = 0;
    Bitto.bounce = 1.4;
    const b = $id("bittoBubble");
    if (b) {
      bittoSetMood("angry");
      b.dataset.mood = "angry";
      b.textContent = "Tôi giận bạn thật sự đấy!!";
      b.classList.remove("off");
    }
    clearTimeout(bittoTimer);
    clearTimeout(Bitto.angerCooldownTimer);
    Bitto.angerCooldownTimer = setTimeout(() => {
      Bitto.angryUntil = 0;
      const bubble = $id("bittoBubble");
      if (bubble) bubble.classList.add("off");
      bittoSetMood(bittoBase());
    }, 4000);
  } else if (now < Bitto.angryUntil) {
    // Still angry: reset 4-second cooldown
    Bitto.angryUntil = now + 4000;
    clearTimeout(Bitto.angerCooldownTimer);
    Bitto.angerCooldownTimer = setTimeout(() => {
      Bitto.angryUntil = 0;
      const bubble = $id("bittoBubble");
      if (bubble) bubble.classList.add("off");
      bittoSetMood(bittoBase());
    }, 4000);
  } else {
    // Single / Normal Poke -> TICKLE + SMART TIP
    Bitto.tickleUntil = now + 2500;
    Bitto.bounce = 1.2;
    let i;
    do {
      i = Math.floor(Math.random() * BITTO_TIPS.length);
    } while (i === bittoLastTip);
    bittoLastTip = i;
    bittoSay(
      `Á nhột haha~ 💡 Mách bạn nè: ${BITTO_TIPS[i]}`,
      "tickle",
      6500,
    );
  }
}

function bittoInit() {
  const cv = $id("bittoCanvas");
  const dock = $id("bittoDock");
  try {
    Bitto.renderer = new THREE.WebGLRenderer({
      canvas: cv,
      alpha: true,
      antialias: true,
    });
    Bitto.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2),
    );
    Bitto.renderer.setSize(150, 150, false);
    Bitto.scene = new THREE.Scene();
    Bitto.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    Bitto.camera.position.set(2.0, 2.4, 5.4);
    Bitto.camera.lookAt(0, 0.5, 0);
    bittoBuild();
    restoreBittoDockPosition();
    requestAnimationFrame(bittoLoop);
  } catch (e) {
    console.warn("Bitto: không khởi tạo được WebGL", e);
    Bitto.renderer = null;
  }

  // Prevent context menu on Bitto so right-click 360° rotation is seamless
  cv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // [UPGRADE FEATURE 3]: Nhấn giữ chuột trái trên #bittoCanvas và kéo để XOAY 360 ĐỘ tự do;
  // tự động xoay nhẹ về góc nhìn chính diện khi thả chuột (damping return).
  // Nút #btnBittoMoveDock (hoặc kéo chuột phải) dùng để di chuyển vị trí khung Bitto.
  Bitto.lastUserActivity = Date.now();
  Bitto.isDraggingRot = false;
  const markUserActive = () => {
    Bitto.lastUserActivity = Date.now();
  };
  ["mousemove", "mousedown", "keydown", "wheel", "touchstart"].forEach(
    (ev) =>
      window.addEventListener(ev, markUserActive, { passive: true }),
  );

  let interactionMode = null; // 'rot360' | 'dockDrag'
  let startX = 0,
    startY = 0,
    origLeft = 0,
    origTop = 0,
    origRotY = 0,
    origRotX = 0,
    pointerMoved = false;

  const moveDockBtn = $id("btnBittoMoveDock");
  if (moveDockBtn && dock) {
    moveDockBtn.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      pointerMoved = false;
      interactionMode = "dockDrag";
      const parentRect = dock.parentElement.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      origLeft = dockRect.left - parentRect.left;
      origTop = dockRect.top - parentRect.top;
    });
  }

  cv.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    pointerMoved = false;

    if (e.button === 0) {
      // Left-click drag -> 360° Free Rotation
      interactionMode = "rot360";
      Bitto.isDraggingRot = true;
      origRotY = Bitto.userRotY;
      origRotX = Bitto.userRotX;
    } else if ((e.button === 2 || e.button === 1) && dock) {
      e.preventDefault();
      interactionMode = "dockDrag";
      const parentRect = dock.parentElement.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      origLeft = dockRect.left - parentRect.left;
      origTop = dockRect.top - parentRect.top;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!interactionMode) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > 4) pointerMoved = true;

    if (interactionMode === "rot360") {
      // Xoay 360° tự do theo mọi góc nhìn
      Bitto.userRotY = origRotY + dx * 0.032;
      Bitto.userRotX = Math.max(
        -Math.PI,
        Math.min(Math.PI, origRotX + dy * 0.028),
      );
    } else if (interactionMode === "dockDrag" && pointerMoved && dock) {
      const parent = dock.parentElement;
      const maxL = Math.max(
        0,
        (parent?.clientWidth || window.innerWidth) - 150,
      );
      const maxT = Math.max(
        0,
        (parent?.clientHeight || window.innerHeight) - 150,
      );
      const newL = Math.min(maxL, Math.max(0, origLeft + dx));
      const newT = Math.min(maxT, Math.max(0, origTop + dy));
      dock.style.left = `${Math.round(newL)}px`;
      dock.style.top = `${Math.round(newT)}px`;
      dock.style.bottom = "auto";
    }
  });

  window.addEventListener("mouseup", () => {
    if (!interactionMode) return;
    const mode = interactionMode;
    interactionMode = null;
    Bitto.isDraggingRot = false;
    if (mode === "rot360") {
      if (!pointerMoved) {
        handleBittoPokeInteraction();
      }
    } else if (mode === "dockDrag" && pointerMoved && dock) {
      const parentRect = dock.parentElement.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      saveBittoDockPosition(
        dockRect.left - parentRect.left,
        dockRect.top - parentRect.top,
      );
    }
  });

  // Touch support on #bittoCanvas for 360° rotation & tap interaction
  cv.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        e.stopPropagation();
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        pointerMoved = false;
        interactionMode = "rot360";
        Bitto.isDraggingRot = true;
        origRotY = Bitto.userRotY;
        origRotX = Bitto.userRotX;
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (interactionMode === "rot360" && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.hypot(dx, dy) > 5) pointerMoved = true;
        if (pointerMoved) {
          Bitto.userRotY = origRotY + dx * 0.032;
          Bitto.userRotX = Math.max(
            -Math.PI,
            Math.min(Math.PI, origRotX + dy * 0.028),
          );
        }
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "touchend",
    () => {
      if (interactionMode === "rot360") {
        interactionMode = null;
        Bitto.isDraggingRot = false;
        if (!pointerMoved) {
          handleBittoPokeInteraction();
        }
      }
    },
    { passive: true },
  );

  setTimeout(
    () =>
      bittoSay(
        "Xin chào! Mình là Bitto v5.2 🤖 Kéo mình đi bất kỳ đâu, giữ chuột phải xoay 360° hoặc chạm vào mình nhé!",
        "happy",
        5500,
      ),
    500,
  );
}

function bittoReact(n) {
  const t = traceState,
    c = n.content,
    lint = window.__lastLint;
  if (n.type === "end" || n.type === "return")
    return bittoSay(
      `Về tới đích rồi! 🏁 ${t.stdout.length ? "Output: " + t.stdout.join(" ") : "Chương trình chưa in gì."}`,
      "happy",
      6000,
    );
  const w =
    lint && lint.errorNodeIds.has(n.id)
      ? lint.warnings.find((x) => x.msg.includes(`[${c}]`))
      : null;
  if (w) return bittoSay("Coi chừng nhé! " + w.msg, "warn", 6500);
  if (n.type === "decision")
    return bittoSay(
      `Đang kiểm tra điều kiện ${c}… ➜ ${evalWithScope(c, t.vars, t.arrays) ? "ĐÚNG" : "SAI"}`,
      "debug",
      6000,
    );
  if (n.type === "input")
    return bittoSay(
      `Đã nhận dữ liệu cho ${c}: ${c
        .split(",")
        .map((v) => t.vars[v.trim()])
        .join(", ")}`,
      "debug",
      6000,
    );
  if (n.type === "output")
    return bittoSay(
      `In ra màn hình: ${t.stdout[t.stdout.length - 1]}`,
      "debug",
      6000,
    );
  if (n.type === "subroutine")
    return bittoSay(`Đang gọi hàm con: ${c}`, "debug", 6000);
  if (n.type === "process") {
    const v = c.match(
      /^\s*(?:(?:int|double|float|string|bool)\s+)?([a-zA-Z_]\w*)/,
    )?.[1];
    const val = v !== undefined ? t.vars[v] : undefined;
    return bittoSay(
      val !== undefined
        ? `Đã cập nhật giá trị biến ${v} = ${val}!`
        : `Đã thực thi: ${c}`,
      "debug",
      6000,
    );
  }
  bittoSay(`Đi qua [${c}]`, "debug", 4000);
}
function bittoAfterRender() {
  const l = window.__lastLint,
    n = l ? l.warnings.length : 0;
  const sig = n + ":" + (l ? l.warnings.map((w) => w.msg).join("|") : "");
  if (sig !== bittoWarnSig) {
    bittoWarnSig = sig;
    if (n > 0 && !traceState.active)
      bittoSay(
        `Phát hiện ${n} cảnh báo: ${l.warnings[0].msg}`,
        "warn",
        6500,
      );
  }
  if ($id("bittoBubble").classList.contains("off"))
    bittoSetMood(bittoBase());
}

// ---------- Móc nối vào các hàm có sẵn (không đổi hành vi gốc) ----------
const _renderAll = renderAll;
renderAll = function (persist = true) {
  _renderAll(persist);
  ideUpdateHL();
  bittoAfterRender();
};

const _startTrace = startTrace;
startTrace = function () {
  _startTrace();
  bittoSay("Viên nang xuất phát! Mình đang quét dữ liệu…", "debug", 5000);
};

const _stepNext = stepNext;
stepNext = function () {
  const was = traceState.active;
  const node = was
    ? currGraph().nodes.find((n) => n.id === traceState.currNodeId)
    : null;
  const r = _stepNext();
  if (was && node && r) bittoReact(node);
  if (typeof AppState !== 'undefined') AppState.emit('traceStep', { node, result: r, steps: traceState.steps });
  return r;
};

const _toast = showCapsuleToast;
showCapsuleToast = function (txt) {
  _toast(txt);
  if (/Breakpoint/.test(txt))
    bittoSay(
      "Dừng ở Trạm Dừng rồi! Xem bảng RAM thử nhé.",
      "debug",
      6000,
    );
};

// and triggers Bitto's [^_~] wink expression!
const _origStartConnection = startConnection;
startConnection = function (nodeId, branch) {
  _origStartConnection(nodeId, branch);
};

const _origFinishConnection = finishConnection;
finishConnection = function (targetId) {
  const hadConn = connectingFrom && connectingFrom.nodeId !== targetId;
  hideRubberbandWirePreview();
  rubberbandDragState.active = false;
  magneticTargetNodeId = null;
  _origFinishConnection(targetId);
  if (hadConn) {
    // [UPGRADE FEATURE 3]: Bitto nháy mắt khích lệ [^_~] khi kết nối thành công 2 khối lệnh
    Bitto.winkUntil = Date.now() + 3600;
    Bitto.bounce = 0.9;
    bittoSay(
      "Kết nối thành công 2 khối lệnh! Tiếp tục phát huy nhé [^_~] ✨",
      "wink",
      3600,
    );
  }
};

// Hook into resetCurrentTab and deleteSelectedNode so Bitto updates expression ([^_^] on Reset, [?_?] when empty/missing Start-End)
const _origResetCurrentTab = resetCurrentTab;
resetCurrentTab = function () {
  _origResetCurrentTab();
  Bitto.winkUntil = 0;
  bittoSay("Đã Reset sơ đồ về trạng thái sẵn sàng! [^_^]", "happy", 3800);
};

const _origDeleteSelectedNode = deleteSelectedNode;
deleteSelectedNode = function () {
  _origDeleteSelectedNode();
  const g = currGraph();
  const nodes = g?.nodes || [];
  const hasStart = nodes.some((n) => n.type === "start");
  const hasEnd = nodes.some(
    (n) => n.type === "end" || n.type === "return",
  );
  if (nodes.length === 0 || !hasStart || !hasEnd) {
    bittoSay(
      "Ủa, sơ đồ đang thiếu khối Start hoặc End kìa [?_?] Hãy thêm khối để hoàn thiện luồng nhé!",
      "confused",
      5200,
    );
  }
};

// ---------- FEATURE 5: Freely Roaming 3D Mascot "BITTO" & Automated Interactive Onboarding Tour ----------
const BittoTour = {
  active: false,
  stepIndex: 0,
  freeRoam: false,
  roamTimer: null,
  posX: 24,
  posY: window.innerHeight - 180,
  targetX: 24,
  targetY: window.innerHeight - 180,
  pointingAngle: 0,
  steps: [
    {
      selector: "#btnAddTab",
      title: "1/7 • Quản lý Đa Quận (Multi-Tab)",
      text: "Nhấp [+ Thêm Quận (Tab)] để tạo hàm con mới (Subroutine) hoặc tách bài toán thành nhiều mô-đun độc lập!",
    },
    {
      selector: "#btnUndo",
      title: "2/7 • Hoàn Tác & Làm Lại (Undo/Redo)",
      text: "Mọi thao tác thêm, xóa, kéo thả khối đều được lưu vào lịch sử. Bấm Undo (Ctrl+Z) hoặc Redo (Ctrl+Y) bất cứ lúc nào!",
    },
    {
      selector: "#btnAutoLayout",
      title: "3/7 • Quy Hoạch Đô Thị Sugiyama 3D",
      text: "Nút [🏙 Quy hoạch Đô thị 3D] tự động sắp xếp lại sơ đồ phân tầng độ cao L0, L1, L2+ thẳng hàng, không chồng chéo!",
    },
    {
      selector: "#btnOpenSketchPad",
      title: "4/7 • Bảng Vẽ Tay Sketch-to-Diagram",
      text: "Bạn thích vẽ tay? Mở [✏️ Vẽ Phác Thảo] để vẽ hình Elip, Chữ nhật, Hình thoi và tự động biến thành Đô thị 3D!",
    },
    {
      selector: "#btnIdeRunCode",
      title: "5/7 • VS Code C++ IDE & Terminal Scanner",
      text: "Soạn code C++ với màu VS Code, bấm [▶ Chạy Code (Run)] để thực thi ngay và tự động quét lỗi đỏ trên Terminal!",
    },
    {
      selector: "#btnRunTests",
      title: "6/7 • Chấm Test Tự Động (Resizable Testbench)",
      text: "Kéo thanh ngăn để chỉnh kích thước Testbench, bấm [▾ Ẩn/Hiện] hoặc [Chạy Test] để chấm hàng loạt bộ Input/Output!",
    },
    {
      selector: "#btnViewMode",
      title: "7/7 • Kéo Dây Bezier & Sửa Nhanh 2D/3D",
      text: "Kéo từ cổng +Out/+True/+False để nối dây Bezier nam châm, kéo khối bắt lưới 20px, hoặc nhấp đúp (Double-Click) lên khối để sửa code ngay tại chỗ!",
    },
  ],
};

function ensureBittoFixedInBody() {
  const dock = document.getElementById("bittoDock");
  const spot = document.getElementById("bittoTourSpotlight");
  const laser = document.getElementById("bittoLaserSvg");
  if (dock && dock.parentElement !== document.body) {
    document.body.appendChild(dock);
  }
  if (spot && spot.parentElement !== document.body) {
    document.body.appendChild(spot);
  }
  if (laser && laser.parentElement !== document.body) {
    document.body.appendChild(laser);
  }

  // Initialize starting fixed coordinates
  if (dock) {
    const r = dock.getBoundingClientRect();
    BittoTour.posX = r.left || 24;
    BittoTour.posY = r.top || Math.max(80, window.innerHeight - 190);
    BittoTour.targetX = BittoTour.posX;
    BittoTour.targetY = BittoTour.posY;
    dock.style.left = `${Math.round(BittoTour.posX)}px`;
    dock.style.top = `${Math.round(BittoTour.posY)}px`;
    dock.style.bottom = "auto";
  }
}

function moveBittoSmoothlyTo(x, y) {
  const maxW = Math.max(80, window.innerWidth - 180);
  const maxH = Math.max(80, window.innerHeight - 165);
  BittoTour.targetX = Math.min(maxW, Math.max(8, x));
  BittoTour.targetY = Math.min(maxH, Math.max(32, y));
}

function startBittoOnboardingTour() {
  ensureBittoFixedInBody();
  if (BittoTour.freeRoam) {
    toggleBittoFreeRoam(false);
  }
  BittoTour.active = true;
  BittoTour.stepIndex = 0;
  const ctrls = document.getElementById("bittoTourControls");
  if (ctrls) {
    ctrls.classList.remove("hidden");
    ctrls.classList.add("flex");
  }
  focusBittoTourStep(0);
}

function stopBittoOnboardingTour() {
  BittoTour.active = false;
  const ctrls = document.getElementById("bittoTourControls");
  const spot = document.getElementById("bittoTourSpotlight");
  const laser = document.getElementById("bittoLaserSvg");
  if (ctrls) {
    ctrls.classList.add("hidden");
    ctrls.classList.remove("flex");
  }
  if (spot) spot.style.display = "none";
  if (laser) laser.style.display = "none";
  try {
    localStorage.setItem("algoflow_v54_tour_seen", "1");
  } catch (e) {}
  // Glide back to comfortable bottom-left corner
  moveBittoSmoothlyTo(24, Math.max(100, window.innerHeight - 185));
  bittoSay(
    "Hoàn tất chuyến tham quan! Bấm [🤖 Guide Me (Tour)] bất cứ khi nào cần mình dẫn đường nhé [^_^] ✨",
    "happy",
    4500,
  );
}

function nextBittoTourStep() {
  if (!BittoTour.active) return;
  if (BittoTour.stepIndex + 1 >= BittoTour.steps.length) {
    stopBittoOnboardingTour();
  } else {
    BittoTour.stepIndex++;
    focusBittoTourStep(BittoTour.stepIndex);
  }
}

function prevBittoTourStep() {
  if (!BittoTour.active) return;
  BittoTour.stepIndex = Math.max(0, BittoTour.stepIndex - 1);
  focusBittoTourStep(BittoTour.stepIndex);
}

function focusBittoTourStep(idx) {
  const step = BittoTour.steps[idx];
  if (!step) return;

  // Ensure drawers/panels are visible if targeting an element inside them
  if (
    step.selector === "#btnIdeRunCode" ||
    step.selector === "#btnRunTests"
  ) {
    if (!rightDrawerOpen) toggleRightDrawer();
    if (step.selector === "#btnRunTests" && testbenchCollapsed) {
      toggleTestbenchCollapse();
    }
  }

  const targetEl = document.querySelector(step.selector);
  const badge = document.getElementById("bittoTourStepBadge");
  if (badge) badge.textContent = `${idx + 1}/${BittoTour.steps.length}`;

  if (!targetEl) {
    bittoSay(`${step.title}: ${step.text}`, "debug", 60000);
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  const spot = document.getElementById("bittoTourSpotlight");
  if (spot) {
    spot.style.display = "block";
    spot.style.left = `${Math.round(rect.left - 5)}px`;
    spot.style.top = `${Math.round(rect.top - 5)}px`;
    spot.style.width = `${Math.round(rect.width + 10)}px`;
    spot.style.height = `${Math.round(rect.height + 10)}px`;
  }

  // Compute ideal Bitto hover position near the target button so speech bubble stays on screen
  const targetCX = rect.left + rect.width / 2;
  const targetCY = rect.top + rect.height / 2;
  let destX = targetCX - 75;
  let destY = rect.bottom + 18;

  // If target is near the right edge (e.g. Right Sidebar), place Bitto to the left of the button
  if (targetCX > window.innerWidth - 360) {
    destX = rect.left - 340;
    destY = Math.max(60, targetCY - 70);
  }
  // If target is near the bottom (e.g. bottom camera bar or testbench), place Bitto above it
  if (rect.bottom > window.innerHeight - 210) {
    destY = Math.max(60, rect.top - 165);
  }

  moveBittoSmoothlyTo(destX, destY);
  Bitto.bounce = 1.1;
  bittoSay(`🎯 ${step.title}: ${step.text}`, "debug", 60000);
}

function toggleBittoFreeRoam(forceState) {
  ensureBittoFixedInBody();
  if (BittoTour.active) stopBittoOnboardingTour();
  BittoTour.freeRoam =
    typeof forceState === "boolean" ? forceState : !BittoTour.freeRoam;
  const btn = null; // Removed in v6.0 Bitto AI Copilot 2.0
  if (btn) {
    btn.textContent = BittoTour.freeRoam ? "🛑 Dừng Bay" : "🦋 Bay Tự Do";
    btn.className = BittoTour.freeRoam
      ? "px-2 py-0.5 rounded-full bg-amber-500/35 border border-amber-400 text-[10px] text-amber-100 mono font-bold shadow"
      : "px-2 py-0.5 rounded-full bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/50 text-[10px] text-purple-200 mono font-bold shadow";
  }
  clearInterval(BittoTour.roamTimer);
  if (BittoTour.freeRoam) {
    bittoSay(
      "Chế độ Bay Tự Do kích hoạt! Mình sẽ dạo quanh khắp các khu vực trên trang web nhé 🦋✨",
      "wink",
      4000,
    );
    const pickWaypoint = () => {
      if (!BittoTour.freeRoam || BittoTour.active) return;
      const landmarks = [
        {
          x: 40,
          y: 65,
          msg: "Đang ghé thăm Thanh Điều Khiển Quận (Tabs) phía trên! 🏛",
        },
        {
          x: Math.max(120, window.innerWidth * 0.42),
          y: 85,
          msg: "Từ trên cao nhìn xuống Đô thị Giải thuật 3D đẹp tuyệt! 🏙",
        },
        {
          x: Math.max(200, window.innerWidth - 460),
          y: 120,
          msg: "Đang kiểm tra mã C++ tại khung VS Code IDE bên phải! 💻",
        },
        {
          x: Math.max(200, window.innerWidth - 460),
          y: Math.max(220, window.innerHeight - 280),
          msg: "Ghế qua trạm Testbench xem các bộ Testcase nào! 🧪",
        },
        {
          x: 45,
          y: Math.max(180, window.innerHeight - 210),
          msg: "Tuần tra quanh Kho Mảng Voxel & Trạm RAM! 📦",
        },
      ];
      const pick =
        landmarks[Math.floor(Math.random() * landmarks.length)];
      moveBittoSmoothlyTo(pick.x, pick.y);
      if (Math.random() < 0.65) {
        bittoSay(pick.msg, "happy", 3400);
      }
    };
    pickWaypoint();
    BittoTour.roamTimer = setInterval(pickWaypoint, 5200);
  } else {
    bittoSay(
      "Đã tắt chế độ bay tự do. Bạn có thể kéo mình tới bất kỳ đâu nhé!",
      "happy",
      3000,
    );
  }
}

// Animation loop for Bitto's unrestricted spatial gliding & robotic stylus pointing laser
function animateBittoSpatialRoam() {
  requestAnimationFrame(animateBittoSpatialRoam);
  const dock = document.getElementById("bittoDock");
  if (!dock) return;

  // Smoothly interpolate Bitto's viewport coordinates when Tour or Free Roam is active
  if (BittoTour.active || BittoTour.freeRoam) {
    const dx = BittoTour.targetX - BittoTour.posX;
    const dy = BittoTour.targetY - BittoTour.posY;
    if (Math.hypot(dx, dy) > 0.5) {
      BittoTour.posX += dx * 0.085;
      BittoTour.posY += dy * 0.085;
      dock.style.left = `${Math.round(BittoTour.posX)}px`;
      dock.style.top = `${Math.round(BittoTour.posY)}px`;
      dock.style.bottom = "auto";
    }
  } else {
    // Sync current position from DOM in case user manually dragged the dock
    const r = dock.getBoundingClientRect();
    BittoTour.posX = r.left;
    BittoTour.posY = r.top;
    BittoTour.targetX = r.left;
    BittoTour.targetY = r.top;
  }

  // Update Robotic Stylus Arm pose & Laser Pointer Beam during Onboarding Tour
  const laserSvg = document.getElementById("bittoLaserSvg");
  const laserLine = document.getElementById("bittoLaserLine");
  const laserDot = document.getElementById("bittoLaserDot");
  const spot = document.getElementById("bittoTourSpotlight");

  if (BittoTour.active) {
    const step = BittoTour.steps[BittoTour.stepIndex];
    const targetEl = step ? document.querySelector(step.selector) : null;
    const cv = document.getElementById("bittoCanvas");
    if (targetEl && cv && laserSvg && laserLine && laserDot) {
      const tr = targetEl.getBoundingClientRect();
      const cr = cv.getBoundingClientRect();
      const startX = cr.left + cr.width * 0.32;
      const startY = cr.top + cr.height * 0.54;
      const endX = tr.left + tr.width / 2;
      const endY = tr.top + tr.height / 2;

      laserSvg.style.display = "block";
      laserLine.setAttribute("x1", startX.toFixed(1));
      laserLine.setAttribute("y1", startY.toFixed(1));
      laserLine.setAttribute("x2", endX.toFixed(1));
      laserLine.setAttribute("y2", endY.toFixed(1));
      laserDot.setAttribute("cx", endX.toFixed(1));
      laserDot.setAttribute("cy", endY.toFixed(1));

      if (spot) {
        spot.style.left = `${Math.round(tr.left - 5)}px`;
        spot.style.top = `${Math.round(tr.top - 5)}px`;
        spot.style.width = `${Math.round(tr.width + 10)}px`;
        spot.style.height = `${Math.round(tr.height + 10)}px`;
      }

      // Angle Bitto's left stylus arm (Bitto.armL) to point at the target button!
      if (Bitto.armL) {
        const angle = Math.atan2(endY - startY, endX - startX);
        Bitto.armL.rotation.z =
          1.15 + Math.sin(Date.now() * 0.008) * 0.18;
        Bitto.armL.rotation.x = -0.65;
        Bitto.userRotY = Math.max(
          -0.6,
          Math.min(0.6, (endX - startX) * 0.0015),
        );
      }
    }
  } else if (laserSvg && laserSvg.style.display !== "none") {
    laserSvg.style.display = "none";
  }
}

// =========================================================================
// GÓI 2: NÂNG CẤP BITTO THÀNH "BITTO AI COPILOT 2.0"
// - Cơ chế tương tác chuột thông minh trên #bittoCanvas:
//   + Vùng tâm (~40% diện tích giữa thân): cursor: move -> Nhấn giữ chuột trái để kéo rê khung Bitto
//   + Vùng ngoài tâm: cursor: grab -> Nhấn giữ kéo để xoay 360 độ (kèm damping) hoặc click chạm tương tác
// - Nút viên thuốc phát sáng "💬 Trò chuyện" mở Popup Chat trực tiếp với Quick Prompts & phân tích ngữ cảnh
// =========================================================================
function isPointerInBittoCenterZone(canvasEl, clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const nx = (clientX - rect.left) / Math.max(1, rect.width);
  const ny = (clientY - rect.top) / Math.max(1, rect.height);
  // Vùng tâm ~40% diện tích chính giữa thân Bitto (x từ 0.28..0.72, y từ 0.28..0.72)
  return nx >= 0.28 && nx <= 0.72 && ny >= 0.28 && ny <= 0.72;
}

function initBittoSmartZoneInteraction() {
  const cv = document.getElementById("bittoCanvas");
  const dock = document.getElementById("bittoDock");
  if (!cv || !dock) return;

  let activeZoneMode = null; // 'moveDock' | 'rotate360'
  let downX = 0,
    downY = 0,
    startLeft = 0,
    startTop = 0,
    startRotY = 0,
    startRotX = 0,
    hasMoved = false;

  // Cập nhật con trỏ chuột theo vùng tâm (move) hay vùng rìa ngoài (grab)
  cv.addEventListener("mousemove", (e) => {
    if (activeZoneMode) return;
    if (isPointerInBittoCenterZone(cv, e.clientX, e.clientY)) {
      cv.style.cursor = "move";
    } else {
      cv.style.cursor = "grab";
    }
  });

  // Sử dụng capture phase để ghi đè hoàn toàn handler cũ trên #bittoCanvas
  cv.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 0) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      downX = e.clientX;
      downY = e.clientY;
      hasMoved = false;

      if (isPointerInBittoCenterZone(cv, e.clientX, e.clientY)) {
        activeZoneMode = "moveDock";
        cv.style.cursor = "move";
        const dockRect = dock.getBoundingClientRect();
        startLeft = dockRect.left;
        startTop = dockRect.top;
      } else {
        activeZoneMode = "rotate360";
        cv.style.cursor = "grabbing";
        Bitto.isDraggingRot = true;
        startRotY = Bitto.userRotY || 0;
        startRotX = Bitto.userRotX || 0;
      }
    },
    true,
  );

  window.addEventListener(
    "mousemove",
    (e) => {
      if (!activeZoneMode) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) > 4) hasMoved = true;

      if (activeZoneMode === "moveDock" && hasMoved) {
        const maxL = Math.max(10, window.innerWidth - 160);
        const maxT = Math.max(24, window.innerHeight - 160);
        const newL = Math.min(maxL, Math.max(4, startLeft + dx));
        const newT = Math.min(maxT, Math.max(24, startTop + dy));
        dock.style.left = `${Math.round(newL)}px`;
        dock.style.top = `${Math.round(newT)}px`;
        dock.style.bottom = "auto";
        BittoTour.posX = newL;
        BittoTour.posY = newT;
        BittoTour.targetX = newL;
        BittoTour.targetY = newT;
      } else if (activeZoneMode === "rotate360" && hasMoved) {
        Bitto.userRotY = startRotY + dx * 0.035;
        Bitto.userRotX = Math.max(
          -Math.PI,
          Math.min(Math.PI, startRotX + dy * 0.03),
        );
      }
    },
    true,
  );

  window.addEventListener(
    "mouseup",
    () => {
      if (!activeZoneMode) return;
      const finishedMode = activeZoneMode;
      activeZoneMode = null;
      Bitto.isDraggingRot = false;
      cv.style.cursor = "grab";

      if (!hasMoved) {
        handleBittoPokeInteraction();
      } else if (finishedMode === "moveDock") {
        const r = dock.getBoundingClientRect();
        saveBittoDockPosition(r.left, r.top);
      }
    },
    true,
  );
}

// Quản lý Khung Đàm Thoại AI Copilot Trực Tiếp (Direct Chat UI)
function toggleBittoCopilotChat(forceOpen) {
  const popup = document.getElementById("bittoCopilotPopup");
  if (!popup) return;
  const shouldOpen =
    typeof forceOpen === "boolean"
      ? forceOpen
      : !popup.classList.contains("copilot-open");
  popup.classList.toggle("copilot-open", shouldOpen);
  popup.classList.remove("copilot-minimized");
  if (shouldOpen) {
    const body = document.getElementById("bittoCopilotBody");
    if (body && body.children.length === 0) {
      appendBittoCopilotMessage(
        "ai",
        "Xin chào! Mình là **Bitto AI Copilot 2.0** 🤖. Mình đang đọc trực tiếp sơ đồ khối, code C++/C/Python, biến trong RAM và cảnh báo Linter của bạn.\nHãy bấm các nút gợi ý nhanh bên dưới hoặc gõ câu hỏi bất kỳ nhé!",
      );
    }
    setTimeout(() => {
      document.getElementById("bittoCopilotInput")?.focus();
    }, 60);
  }
}

function toggleMinimizeBittoCopilot() {
  const popup = document.getElementById("bittoCopilotPopup");
  if (!popup) return;
  popup.classList.toggle("copilot-minimized");
}

function formatSimpleMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<b class='text-cyan-300'>$1</b>")
    .replace(
      /`([^`]+)`/g,
      "<code class='px-1 py-0.2 rounded bg-[#090b14] border border-cyan-500/30 text-amber-300 mono text-[10.5px]'>$1</code>",
    )
    .replace(/\n/g, "<br/>");
}

function appendBittoCopilotMessage(role, text) {
  const popup = document.getElementById("bittoCopilotPopup");
  const body = document.getElementById("bittoCopilotBody");
  if (!body) return;
  if (popup && !popup.classList.contains("copilot-open")) {
    popup.classList.add("copilot-open");
  }
  const div = document.createElement("div");
  div.className = role === "user" ? "copilot-msg-user" : "copilot-msg-ai";
  div.innerHTML = formatSimpleMarkdown(text);
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  if (role === "ai" && typeof SoundManager !== "undefined") {
    SoundManager.play("sfx_bitto_talk");
  }
}

function sendBittoQuickPrompt(promptText) {
  appendBittoCopilotMessage("user", promptText);
  const reply = generateBittoCopilotResponse(promptText);
  setTimeout(() => {
    appendBittoCopilotMessage("ai", reply);
  }, 140);
}

function submitBittoCopilotQuestion() {
  const inp = document.getElementById("bittoCopilotInput");
  if (!inp) return;
  const q = inp.value.trim();
  if (!q) return;
  inp.value = "";
  sendBittoQuickPrompt(q);
}

// Động cơ AI Copilot đọc ngữ cảnh thời gian thực (Flowchart, Code, RAM, Linter, Big-O)
function generateBittoCopilotResponse(userQuery) {
  const q = userQuery.toLowerCase();
  const g = currGraph() || { nodes: [], edges: [] };
  const nodes = g.nodes || [];
  const edges = g.edges || [];
  const backEdges = detectBackEdges(nodes, edges);
  const lint = runSemanticLinter(nodes, edges);
  const bigO =
    document.getElementById("bigOBadge")?.textContent || "O(1)";
  const decisions = nodes.filter((n) => n.type === "decision");
  const processes = nodes.filter((n) => n.type === "process");
  const inputs = nodes.filter((n) => n.type === "input");
  const outputs = nodes.filter((n) => n.type === "output");

  // 1. Phân tích độ phức tạp Big-O chi tiết
  if (
    q.includes("big-o") ||
    q.includes("độ phức tạp") ||
    q.includes("phức tạp")
  ) {
    const loopDesc =
      backEdges.size === 0
        ? "Sơ đồ hiện không có cạnh quay lui (vòng lặp), mọi khối chạy tuần tự."
        : `Sơ đồ có **${backEdges.size} vòng lặp** tại điều kiện ${decisions
            .map((d) => `\`[${d.content}]\``)
            .join(", ")}.`;
    return (
      `📊 **Phân tích Độ Phức Tạp Thuật Toán (Big-O):**\n` +
      `• **Độ phức tạp Thời gian (Time Complexity):** \`${bigO}\` — ${loopDesc}\n` +
      `• **Độ phức tạp Không gian (Space Complexity):** \`${
        Object.keys(traceState.arrays || {}).length > 0 ? "O(N)" : "O(1)"
      }\` — Đang dùng **${Object.keys(inferGraphVariableTypes(g).varTypes).length} biến đơn** trong RAM.\n` +
      `• **Đề xuất tối ưu:** ${
        backEdges.size >= 2
          ? "Với vòng lặp lồng nhau, hãy kiểm tra xem có thể giảm giới hạn duyệt (ví dụ `j <= x / 2` hoặc `j * j <= x`) để tăng tốc gấp nhiều lần nhé!"
          : "Cấu trúc hiện tại đã rất gọn nhẹ và tối ưu cho người mới bắt đầu!"
      }`
    );
  }

  // 2. Sửa lỗi sơ đồ / code
  if (
    q.includes("sửa lỗi") ||
    q.includes("lỗi") ||
    q.includes("fix") ||
    q.includes("debug")
  ) {
    const issues = [];
    if (!nodes.some((n) => n.type === "start")) {
      issues.push("Thiếu khối **Vòm Start** khởi đầu chương trình.");
    }
    if (!nodes.some((n) => n.type === "end" || n.type === "return")) {
      issues.push("Thiếu khối **Vòm End / Return** kết thúc thuật toán.");
    }
    lint.warnings.forEach((w) => issues.push(w.msg));
    decisions.forEach((d) => {
      const hasT = edges.some(
        (e) => e.source === d.id && e.branch === "true",
      );
      const hasF = edges.some(
        (e) => e.source === d.id && e.branch === "false",
      );
      if (!hasT || !hasF) {
        issues.push(
          `Khối điều kiện \`[${d.content}]\` đang thiếu dây nối nhánh **${!hasT ? "+True" : "+False"}**.`,
        );
      }
    });
    if (tleInfiniteNodeIds.size > 0) {
      issues.push(
        `Khối điều kiện đang bị tô đỏ gây **Vòng lặp vô tận (TLE)** — cần bổ sung lệnh tăng/giảm biến đếm trong nhánh True.`,
      );
    }

    if (issues.length === 0) {
      return (
        `✅ **Kiểm tra Sơ đồ & Code hoàn tất:**\n` +
        `Sơ đồ gồm **${nodes.length} khối** và **${edges.length} đường nối** hoàn toàn hợp lệ, không có Dead Code hay biến chưa khởi tạo!\n` +
        `💡 Bạn có thể nhấn **▶ Chạy Code (Run)** hoặc **Chạy Test** ở bảng Testbench để kiểm chứng kết quả nhé.`
      );
    }
    return (
      `🛠 **Bitto phát hiện ${issues.length} điểm cần chỉnh sửa trên sơ đồ:**\n` +
      issues.map((it, idx) => `${idx + 1}. ${it}`).join("\n") +
      `\n💡 **Cách sửa nhanh:** Nhấp trực tiếp vào khối bị cảnh báo để mở thanh công cụ mini \`[✏️ Sửa biểu thức]\` hoặc kéo dây từ cổng \`+True / +False\` tới cổng \`➔In\` của khối tiếp theo.`
    );
  }

  // 3. Gợi ý thuật toán bài hiện tại
  return (
    `💡 **Gợi ý Sư Phạm cho Sơ đồ Hiện tại (${activeTab}):**\n` +
    `• **Đầu vào (Input):** ${
      inputs.length
        ? inputs.map((i) => `\`${i.content}\``).join(", ")
        : "Được khởi tạo trực tiếp trong khối Process"
    }\n` +
    `• **Các bước xử lý chính:** ${
      processes.length
        ? processes.map((p) => `\`${p.content}\``).join(" ➔ ")
        : "Chưa có khối Process"
    }\n` +
    `• **Điều kiện rẽ nhánh / lặp:** ${
      decisions.length
        ? decisions.map((d) => `\`(${d.content})\``).join(", ")
        : "Không có"
    }\n` +
    `• **Đầu ra (Output):** ${
      outputs.length
        ? outputs.map((o) => `\`${o.content}\``).join(", ")
        : "Chưa có khối Xuất (cout)"
    }\n` +
    `👉 **Mẹo học C++:** Hãy chuyển qua lại giữa tab **[C++]**, **[C]** và **[Python]** ở góc phải trên để so sánh cách 3 ngôn ngữ biểu diễn cùng một sơ đồ khối này nhé!`
  );
}

