// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/sketch.js
// Mô tả: Bảng vẽ tay phác thảo sơ đồ khối (Sketch-to-Diagram Canvas 2D),
//        nhận diện hình học (Elip, Chữ nhật, Hình thoi, Mũi tên) và kéo giãn khung.
// ============================================================================

// =========================================================================
// 20. [UPGRADE FEATURE 1]: SKETCH-TO-DIAGRAM PAD & SHAPE RECOGNITION ENGINE
//     (Freehand Canvas 2D + Closed Stroke Clustering + Ellipse/Rect/Diamond
//      Classifier + Arrow/Edge Detector + Live Overlay + Graph Generator)
// =========================================================================
const SketchPad = {
  tool: "pen", // 'pen' | 'eraser'
  strokeWidth: 3,
  strokes: [], // Array of { points: [{x, y, t}], width }
  currentStroke: null,
  isDrawing: false,
  recognized: { shapes: [], edges: [] },
  customContents: {}, // clusterKey -> user edited string
};

function openSketchModal() {
  const m = document.getElementById("sketchModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("flex");
  setTimeout(() => {
    resizeSketchCanvas();
    if (SketchPad.strokes.length === 0) {
      loadSampleSketchDiagram();
    } else {
      runSketchRecognitionEngine();
      redrawSketchCanvas();
    }
  }, 40);
}

function closeSketchModal() {
  const m = document.getElementById("sketchModal");
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("flex");
}

function setSketchTool(toolName) {
  SketchPad.tool = toolName;
  const penBtn = document.getElementById("btnSketchPen");
  const eraBtn = document.getElementById("btnSketchEraser");
  const cv = document.getElementById("sketchPadCanvas");
  if (penBtn)
    penBtn.classList.toggle("sketch-tool-active", toolName === "pen");
  if (eraBtn)
    eraBtn.classList.toggle("sketch-tool-active", toolName === "eraser");
  if (cv) cv.style.cursor = toolName === "eraser" ? "cell" : "crosshair";
}

function updateSketchStrokeWidth(val) {
  SketchPad.strokeWidth = Number(val) || 3;
  const badge = document.getElementById("sketchStrokeWidthBadge");
  if (badge) badge.textContent = `${SketchPad.strokeWidth}px`;
}

function undoSketchStroke() {
  if (SketchPad.strokes.length > 0) {
    SketchPad.strokes.pop();
    runSketchRecognitionEngine();
    redrawSketchCanvas();
  }
}

function clearSketchCanvas() {
  SketchPad.strokes = [];
  SketchPad.recognized = { shapes: [], edges: [] };
  SketchPad.customContents = {};
  runSketchRecognitionEngine();
  redrawSketchCanvas();
  bittoSay(
    "Đã xóa trắng bảng vẽ phác thảo! Hãy vẽ các khối mới nhé [?_?]",
    "confused",
    3500,
  );
}

function resizeSketchCanvas() {
  const container = document.getElementById("sketchCanvasContainer");
  const cv = document.getElementById("sketchPadCanvas");
  if (!container || !cv) return;
  const rect = container.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    cv.width = rect.width;
    cv.height = rect.height;
    redrawSketchCanvas();
  }
}

window.addEventListener("resize", () => {
  const m = document.getElementById("sketchModal");
  if (m && !m.classList.contains("hidden")) {
    resizeSketchCanvas();
  }
});

function initSketchPadEvents() {
  const cv = document.getElementById("sketchPadCanvas");
  if (!cv) return;

  const getPt = (clientX, clientY) => {
    const r = cv.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, t: Date.now() };
  };

  const eraseAtPoint = (pt) => {
    const radius = Math.max(16, SketchPad.strokeWidth * 4);
    const before = SketchPad.strokes.length;
    SketchPad.strokes = SketchPad.strokes.filter(
      (st) =>
        !st.points.some(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= radius,
        ),
    );
    if (SketchPad.strokes.length !== before) {
      runSketchRecognitionEngine();
      redrawSketchCanvas();
    }
  };

  cv.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const pt = getPt(e.clientX, e.clientY);
    SketchPad.isDrawing = true;
    if (SketchPad.tool === "eraser") {
      eraseAtPoint(pt);
    } else {
      SketchPad.currentStroke = {
        points: [pt],
        width: SketchPad.strokeWidth,
      };
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!SketchPad.isDrawing) return;
    const pt = getPt(e.clientX, e.clientY);
    if (SketchPad.tool === "eraser") {
      eraseAtPoint(pt);
    } else if (SketchPad.currentStroke) {
      const pts = SketchPad.currentStroke.points;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 2.5) {
        pts.push(pt);
        redrawSketchCanvas();
      }
    }
  });

  window.addEventListener("mouseup", () => {
    if (!SketchPad.isDrawing) return;
    SketchPad.isDrawing = false;
    if (
      SketchPad.currentStroke &&
      SketchPad.currentStroke.points.length >= 3
    ) {
      SketchPad.strokes.push(SketchPad.currentStroke);
    }
    SketchPad.currentStroke = null;
    runSketchRecognitionEngine();
    redrawSketchCanvas();
  });

  // Touch / Stylus support
  cv.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      const pt = getPt(t.clientX, t.clientY);
      SketchPad.isDrawing = true;
      if (SketchPad.tool === "eraser") {
        eraseAtPoint(pt);
      } else {
        SketchPad.currentStroke = {
          points: [pt],
          width: SketchPad.strokeWidth,
        };
      }
    },
    { passive: false },
  );

  cv.addEventListener(
    "touchmove",
    (e) => {
      if (!SketchPad.isDrawing || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      const pt = getPt(t.clientX, t.clientY);
      if (SketchPad.tool === "eraser") {
        eraseAtPoint(pt);
      } else if (SketchPad.currentStroke) {
        SketchPad.currentStroke.points.push(pt);
        redrawSketchCanvas();
      }
    },
    { passive: false },
  );

  cv.addEventListener(
    "touchend",
    () => {
      if (!SketchPad.isDrawing) return;
      SketchPad.isDrawing = false;
      if (
        SketchPad.currentStroke &&
        SketchPad.currentStroke.points.length >= 3
      ) {
        SketchPad.strokes.push(SketchPad.currentStroke);
      }
      SketchPad.currentStroke = null;
      runSketchRecognitionEngine();
      redrawSketchCanvas();
    },
    { passive: true },
  );
}

// Compute basic stroke geometry metrics
function computeStrokeMetrics(points) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let pathLen = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLen += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const diag = Math.hypot(w, h);
  const startPt = points[0];
  const endPt = points[points.length - 1];
  const endDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);

  // Shoelace formula for enclosed polygon area
  let area2 = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area2 += p1.x * p2.y - p2.x * p1.y;
  }
  const polyArea = Math.abs(area2) * 0.5;

  const isClosed =
    diag >= 26 &&
    pathLen >= diag * 1.65 &&
    (endDist <= Math.max(42, diag * 0.42) || polyArea / (w * h) >= 0.34);

  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    diag,
    pathLen,
    endDist,
    polyArea,
    startPt,
    endPt,
    isClosed,
  };
}

// Classify a closed stroke (or cluster of strokes) into Ellipse, Rectangle, or Diamond
function classifyClosedShapeGeometry(points, metrics) {
  const { minX, minY, maxX, maxY, w, h, cx, cy, polyArea } = metrics;
  const boxArea = Math.max(1, w * h);
  const areaRatio = polyArea / boxArea;

  // Measure normalized distance of points to the 4 box corners vs 4 edge midpoints
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  const midSides = [
    { x: cx, y: minY },
    { x: maxX, y: cy },
    { x: cx, y: maxY },
    { x: minX, y: cy },
  ];

  const avgCornerDist =
    corners.reduce((acc, c) => {
      let best = Infinity;
      for (const p of points) {
        const d = Math.hypot((p.x - c.x) / w, (p.y - c.y) / h);
        if (d < best) best = d;
      }
      return acc + best;
    }, 0) / 4;

  const avgMidSideDist =
    midSides.reduce((acc, m) => {
      let best = Infinity;
      for (const p of points) {
        const d = Math.hypot((p.x - m.x) / w, (p.y - m.y) / h);
        if (d < best) best = d;
      }
      return acc + best;
    }, 0) / 4;

  // Normalized radial variance in elliptical coordinates
  const rx = Math.max(1, w / 2);
  const ry = Math.max(1, h / 2);
  let radSum = 0;
  const normRads = points.map((p) => {
    const nr = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
    radSum += nr;
    return nr;
  });
  const radMean = radSum / Math.max(1, normRads.length);
  const radStd = Math.sqrt(
    normRads.reduce((acc, r) => acc + Math.pow(r - radMean, 2), 0) /
      Math.max(1, normRads.length),
  );

  // 1. Diamond (Decision): vertices touch mid-sides closely, far from box corners, areaRatio ~ 0.40..0.64
  if (
    avgCornerDist >= 0.25 &&
    avgMidSideDist <= 0.14 &&
    areaRatio <= 0.66
  ) {
    return "diamond";
  }

  // 2. Ellipse / Circle (Start / End / Connector): smooth radial consistency in elliptical space and rounded corners
  if (avgCornerDist >= 0.145 && radStd <= 0.135) {
    return "ellipse";
  }

  // 3. Rectangle / Square (Process)
  return "rectangle";
}

function runSketchRecognitionEngine() {
  const rawStrokes = SketchPad.strokes;
  const shapes = [];
  const openStrokes = [];

  // Step 1: Evaluate each stroke and cluster multi-stroke closed shapes if bounding boxes overlap tightly
  rawStrokes.forEach((st, idx) => {
    const m = computeStrokeMetrics(st.points);
    if (m.isClosed) {
      const geom = classifyClosedShapeGeometry(st.points, m);
      shapes.push({
        idx,
        points: st.points,
        metrics: m,
        geometry: geom,
      });
    } else {
      openStrokes.push({ idx, points: st.points, metrics: m });
    }
  });

  // Sort shapes top-to-bottom (by cy) so we can assign Start, End, Process, Decision defaults
  shapes.sort((a, b) => a.metrics.cy - b.metrics.cy);

  const ellipseIndices = shapes
    .map((s, i) => (s.geometry === "ellipse" ? i : -1))
    .filter((i) => i >= 0);

  let procCounter = 1;
  let decCounter = 1;

  shapes.forEach((s, i) => {
    const { cx, cy, w, h, diag } = s.metrics;
    const key = `${Math.round(cx / 35)}_${Math.round(cy / 35)}_${s.geometry}`;
    s.clusterKey = key;

    if (s.geometry === "ellipse") {
      if (
        diag < 62 &&
        shapes.length > 2 &&
        i > 0 &&
        i < shapes.length - 1
      ) {
        s.nodeType = "connector";
        s.defaultContent = "O";
      } else if (i === ellipseIndices[0] || i === 0) {
        s.nodeType = "start";
        s.defaultContent = "Start";
      } else if (
        i === ellipseIndices[ellipseIndices.length - 1] ||
        i === shapes.length - 1
      ) {
        s.nodeType = "end";
        s.defaultContent = "End";
      } else {
        s.nodeType = "connector";
        s.defaultContent = "O";
      }
    } else if (s.geometry === "diamond") {
      s.nodeType = "decision";
      s.defaultContent =
        decCounter === 1 ? "i <= n" : `x % ${decCounter} == 0`;
      decCounter++;
    } else {
      s.nodeType = "process";
      if (procCounter === 1) s.defaultContent = "n = 6; tong = 0; i = 1";
      else if (procCounter === 2) s.defaultContent = "tong += i; i++";
      else s.defaultContent = `x = ${procCounter}`;
      procCounter++;
    }

    s.id = "sk" + (i + 1);
    s.content = SketchPad.customContents[key] || s.defaultContent;
  });

  // Step 2: Separate open strokes into main connector lines vs small arrowhead ticks
  const longConnectors = [];
  const shortTicks = [];
  openStrokes.forEach((os) => {
    if (os.metrics.pathLen < 48 && os.metrics.diag < 38) {
      shortTicks.push(os);
    } else {
      longConnectors.push(os);
    }
  });

  // Distance from point to shape bounding box
  const distToShapeBox = (pt, sh) => {
    const m = sh.metrics;
    const dx = Math.max(m.minX - pt.x, 0, pt.x - m.maxX);
    const dy = Math.max(m.minY - pt.y, 0, pt.y - m.maxY);
    return Math.hypot(dx, dy);
  };

  const findClosestShape = (pt, maxThreshold = 95) => {
    let best = null;
    let bestDist = maxThreshold;
    shapes.forEach((sh) => {
      const d = distToShapeBox(pt, sh);
      if (d < bestDist) {
        bestDist = d;
        best = sh;
      }
    });
    return best;
  };

  const edges = [];
  const decisionOutCount = {};

  longConnectors.forEach((conn, cIdx) => {
    const pStart = conn.metrics.startPt;
    const pEnd = conn.metrics.endPt;

    // Check if any short arrowhead tick is near pStart or pEnd
    let tickNearStart = false;
    let tickNearEnd = false;
    shortTicks.forEach((tk) => {
      const dStart = Math.min(
        Math.hypot(
          tk.metrics.startPt.x - pStart.x,
          tk.metrics.startPt.y - pStart.y,
        ),
        Math.hypot(
          tk.metrics.endPt.x - pStart.x,
          tk.metrics.endPt.y - pStart.y,
        ),
      );
      const dEnd = Math.min(
        Math.hypot(
          tk.metrics.startPt.x - pEnd.x,
          tk.metrics.startPt.y - pEnd.y,
        ),
        Math.hypot(
          tk.metrics.endPt.x - pEnd.x,
          tk.metrics.endPt.y - pEnd.y,
        ),
      );
      if (dEnd < 36) tickNearEnd = true;
      else if (dStart < 36) tickNearStart = true;
    });

    let srcShape = findClosestShape(pStart);
    let dstShape = findClosestShape(pEnd);

    // Flip direction if arrowhead tick was explicitly drawn at the start point
    if (tickNearStart && !tickNearEnd) {
      const tmp = srcShape;
      srcShape = dstShape;
      dstShape = tmp;
    }

    if (srcShape && dstShape && srcShape.id !== dstShape.id) {
      let branch = null;
      if (srcShape.nodeType === "decision") {
        const count = decisionOutCount[srcShape.id] || 0;
        // If edge exits horizontally to the right significantly, treat as false branch unless already assigned
        const exitsRight =
          pEnd.x > srcShape.metrics.maxX + 25 &&
          Math.abs(pStart.y - srcShape.metrics.cy) <
            srcShape.metrics.h * 0.45;
        if (count === 0) {
          branch = exitsRight ? "false" : "true";
        } else {
          branch =
            count === 1 &&
            edges.some(
              (e) => e.source === srcShape.id && e.branch === "true",
            )
              ? "false"
              : "true";
        }
        decisionOutCount[srcShape.id] = count + 1;
      }

      edges.push({
        id: "ske" + (cIdx + 1),
        source: srcShape.id,
        target: dstShape.id,
        branch,
        points: conn.points,
        srcShape,
        dstShape,
      });
    }
  });

  SketchPad.recognized = { shapes, edges };
  updateSketchSummaryUI();
}

function updateSketchSummaryUI() {
  const badge = document.getElementById("sketchRecognizeSummary");
  const overlay = document.getElementById("sketchLabelsOverlay");
  const { shapes, edges } = SketchPad.recognized;
  if (badge) {
    badge.textContent = `${shapes.length} khối • ${edges.length} dây nối`;
  }
  if (!overlay) return;
  overlay.innerHTML = "";

  const typeColors = {
    start: "border-teal-400 text-teal-200 bg-teal-950/90",
    end: "border-rose-400 text-rose-200 bg-rose-950/90",
    process: "border-blue-400 text-blue-200 bg-blue-950/90",
    decision: "border-amber-400 text-amber-200 bg-amber-950/90",
    connector: "border-slate-400 text-slate-200 bg-slate-900/90",
  };

  shapes.forEach((sh) => {
    const pill = document.createElement("div");
    const colCls = typeColors[sh.nodeType] || typeColors.process;
    pill.className = `pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded border text-[11px] mono font-semibold shadow-lg cursor-pointer flex items-center gap-1.5 ${colCls}`;
    pill.style.left = `${Math.round(sh.metrics.cx)}px`;
    pill.style.top = `${Math.round(sh.metrics.cy)}px`;
    pill.title = "Nhấp để đổi loại khối hoặc sửa biểu thức C++";

    const typeBadge = document.createElement("span");
    typeBadge.className =
      "px-1 rounded bg-black/40 text-[9px] uppercase font-bold";
    typeBadge.textContent = sh.nodeType;
    typeBadge.onclick = (e) => {
      e.stopPropagation();
      const order = [
        "start",
        "input",
        "process",
        "decision",
        "output",
        "end",
      ];
      const nextType =
        order[(order.indexOf(sh.nodeType) + 1) % order.length];
      sh.nodeType = nextType;
      redrawSketchCanvas();
      updateSketchSummaryUI();
    };

    const exprSpan = document.createElement("span");
    exprSpan.textContent = sh.content;
    exprSpan.onclick = (e) => {
      e.stopPropagation();
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = sh.content;
      inp.className = "inplace-node-input mono text-[11px] w-32";
      pill.replaceChild(inp, exprSpan);
      inp.focus();
      inp.select();
      const finishEdit = () => {
        const v = inp.value.trim();
        if (v) {
          sh.content = v;
          SketchPad.customContents[sh.clusterKey] = v;
        }
        updateSketchSummaryUI();
      };
      inp.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === "Escape") finishEdit();
      };
      inp.onblur = finishEdit;
    };

    pill.appendChild(typeBadge);
    pill.appendChild(exprSpan);
    overlay.appendChild(pill);
  });
}

function redrawSketchCanvas() {
  const cv = document.getElementById("sketchPadCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);

  // 1. Draw recognized bounding / geometric hints softly underneath
  const { shapes, edges } = SketchPad.recognized;
  shapes.forEach((sh) => {
    const { minX, minY, w, h, cx, cy } = sh.metrics;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle =
      sh.geometry === "ellipse"
        ? "rgba(45, 212, 191, 0.55)"
        : sh.geometry === "diamond"
          ? "rgba(251, 191, 36, 0.55)"
          : "rgba(96, 165, 250, 0.55)";
    ctx.strokeRect(minX - 4, minY - 4, w + 8, h + 8);
    ctx.restore();
  });

  edges.forEach((ed) => {
    const s = ed.srcShape.metrics;
    const d = ed.dstShape.metrics;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle =
      ed.branch === "true"
        ? "rgba(52, 211, 153, 0.65)"
        : ed.branch === "false"
          ? "rgba(251, 113, 133, 0.65)"
          : "rgba(34, 211, 238, 0.65)";
    ctx.moveTo(s.cx, s.cy);
    ctx.lineTo(d.cx, d.cy);
    ctx.stroke();
    ctx.restore();
  });

  // 2. Draw user strokes with neon glow
  const drawStrokeObj = (st, color = "#67e8f9") => {
    if (!st.points || st.points.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = st.width || 3;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.moveTo(st.points[0].x, st.points[0].y);
    for (let i = 1; i < st.points.length; i++) {
      ctx.lineTo(st.points[i].x, st.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  };

  SketchPad.strokes.forEach((st) => drawStrokeObj(st, "#38bdf8"));
  if (SketchPad.currentStroke) {
    drawStrokeObj(SketchPad.currentStroke, "#c084fc");
  }
}

// Generate a realistic hand-drawn sample sketch (Start -> Process -> Decision -> Process -> End)
function loadSampleSketchDiagram() {
  const cv = document.getElementById("sketchPadCanvas");
  const W = cv?.width || 920;
  const H = cv?.height || 560;
  const cx = Math.round(W * 0.45);

  const makeEllipseStroke = (x, y, rx, ry) => {
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      pts.push({
        x: x + Math.cos(a) * rx,
        y: y + Math.sin(a) * ry,
        t: Date.now(),
      });
    }
    return { points: pts, width: 3 };
  };

  const makeRectStroke = (x, y, w, h) => {
    const x0 = x - w / 2,
      y0 = y - h / 2,
      x1 = x + w / 2,
      y1 = y + h / 2;
    const pts = [];
    const segs = [
      [x0, y0, x1, y0],
      [x1, y0, x1, y1],
      [x1, y1, x0, y1],
      [x0, y1, x0, y0],
    ];
    segs.forEach(([ax, ay, bx, by]) => {
      for (let s = 0; s <= 8; s++) {
        const u = s / 8;
        pts.push({
          x: ax + (bx - ax) * u,
          y: ay + (by - ay) * u,
          t: Date.now(),
        });
      }
    });
    return { points: pts, width: 3 };
  };

  const makeDiamondStroke = (x, y, rx, ry) => {
    const verts = [
      [x, y - ry],
      [x + rx, y],
      [x, y + ry],
      [x - rx, y],
      [x, y - ry],
    ];
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = verts[i];
      const [bx, by] = verts[i + 1];
      for (let s = 0; s <= 8; s++) {
        const u = s / 8;
        pts.push({
          x: ax + (bx - ax) * u,
          y: ay + (by - ay) * u,
          t: Date.now(),
        });
      }
    }
    return { points: pts, width: 3 };
  };

  const makeArrowLine = (ptsList) => {
    const pts = [];
    for (let i = 0; i < ptsList.length - 1; i++) {
      const [ax, ay] = ptsList[i];
      const [bx, by] = ptsList[i + 1];
      for (let s = 0; s <= 10; s++) {
        const u = s / 10;
        pts.push({
          x: ax + (bx - ax) * u,
          y: ay + (by - ay) * u,
          t: Date.now(),
        });
      }
    }
    return { points: pts, width: 3 };
  };

  const y1 = Math.round(H * 0.12);
  const y2 = Math.round(H * 0.3);
  const y3 = Math.round(H * 0.52);
  const y4 = Math.round(H * 0.75);
  const rightX = Math.min(W - 130, cx + 250);

  SketchPad.customContents = {};
  SketchPad.strokes = [
    // 1. Start Ellipse
    makeEllipseStroke(cx, y1, 58, 24),
    // 2. Process Rect 1
    makeRectStroke(cx, y2, 165, 48),
    // 3. Decision Diamond
    makeDiamondStroke(cx, y3, 88, 42),
    // 4. Process Rect 2 (True branch below)
    makeRectStroke(cx, y4, 165, 48),
    // 5. End Ellipse (False branch to the right)
    makeEllipseStroke(rightX, y3, 58, 24),
    // Edges connecting the shapes
    makeArrowLine([
      [cx, y1 + 26],
      [cx, y2 - 26],
    ]),
    makeArrowLine([
      [cx, y2 + 26],
      [cx, y3 - 44],
    ]),
    makeArrowLine([
      [cx, y3 + 44],
      [cx, y4 - 26],
    ]),
    makeArrowLine([
      [cx - 84, y4],
      [cx - 140, y4],
      [cx - 140, y3],
      [cx - 90, y3],
    ]),
    makeArrowLine([
      [cx + 90, y3],
      [rightX - 60, y3],
    ]),
  ];

  runSketchRecognitionEngine();
  redrawSketchCanvas();
}

function applySketchToMainDiagram() {
  runSketchRecognitionEngine();
  const { shapes, edges } = SketchPad.recognized;
  if (shapes.length === 0) {
    bittoSay(
      "Chưa nhận diện được hình khối khép kín nào! Bạn hãy vẽ hình Elip, Chữ nhật hoặc Hình thoi nhé [?_?]",
      "confused",
      4500,
    );
    return;
  }

  pushHistoryState();
  const g = currGraph();

  // Map sketch coordinates to main flowchart coordinates with 20px Smart Grid Snapping
  const minX = Math.min(...shapes.map((s) => s.metrics.cx));
  const minY = Math.min(...shapes.map((s) => s.metrics.cy));

  const newNodes = shapes.map((sh) => {
    const relX = 160 + (sh.metrics.cx - minX) * 0.95;
    const relY = 50 + (sh.metrics.cy - minY) * 0.95;
    return {
      id: sh.id,
      type: sh.nodeType,
      content: sh.content,
      x: Math.max(40, Math.round(relX / 20) * 20),
      y: Math.max(20, Math.round(relY / 20) * 20),
      bp: false,
    };
  });

  const newEdges = edges.map((ed) => ({
    id: ed.id,
    source: ed.source,
    target: ed.target,
    branch: ed.branch || null,
  }));

  g.nodes = newNodes;
  g.edges = newEdges;
  selectedNodeId = newNodes[0]?.id || null;

  const useAutoLayout = document.getElementById(
    "sketchAutoLayoutToggle",
  )?.checked;
  closeSketchModal();
  if (useAutoLayout) {
    autoLayout(false);
  } else {
    renderAll();
    resetCameraView();
  }

  setStatusText(
    `Đã nhận diện phác thảo: ${newNodes.length} khối & ${newEdges.length} dây nối!`,
  );
  Bitto.winkUntil = Date.now() + 4200;
  bittoSay(
    `Tuyệt đỉnh! Đã nhận diện ${newNodes.length} khối hình học và ${newEdges.length} dây nối thành Đô thị 3D [^_~] ✨`,
    "wink",
    5000,
  );
}

// -------------------------------------------------------------------------
// HẠNG MỤC 5: CHO PHÉP MỞ RỘNG / THU NHỎ BẢNG VẼ PHÁC THẢO (RESIZABLE SKETCH PAD)
// - Nút `⛶ Phóng to tối đa / 🗗 Thu nhỏ` trên thanh công cụ của #sketchModal
// - Khi phóng to chiếm toàn bộ màn hình (w-screen h-screen inset-0 rounded-none)
// - Thanh kéo giãn kích thước (#sketchModalResizer) + tự động co giãn Canvas giữ nguyên tỉ lệ nét vẽ
// -------------------------------------------------------------------------
let isSketchMaximized = false;

function toggleSketchModalMaximize(forceState) {
  const modal = document.getElementById("sketchModal");
  const dialog = document.getElementById("sketchModalDialog");
  const btn = document.getElementById("btnSketchMaximize");
  if (!modal || !dialog) return;

  isSketchMaximized =
    typeof forceState === "boolean" ? forceState : !isSketchMaximized;

  if (isSketchMaximized) {
    modal.classList.remove("p-3");
    modal.classList.add("p-0");
    dialog.style.width = "";
    dialog.style.height = "";
    dialog.classList.add(
      "sketch-maximized",
      "w-screen",
      "h-screen",
      "inset-0",
      "rounded-none",
    );
    if (btn) btn.textContent = "🗗 Thu nhỏ";
  } else {
    modal.classList.remove("p-0");
    modal.classList.add("p-3");
    dialog.classList.remove(
      "sketch-maximized",
      "w-screen",
      "h-screen",
      "inset-0",
      "rounded-none",
    );
    if (btn) btn.textContent = "⛶ Phóng to tối đa";
  }

  setTimeout(() => {
    resizeSketchCanvas();
  }, 30);
}

// Nâng cấp resizeSketchCanvas để tự động co giãn nét vẽ theo tỉ lệ khung nhìn mà không làm méo hình
resizeSketchCanvas = function () {
  const container = document.getElementById("sketchCanvasContainer");
  const cv = document.getElementById("sketchPadCanvas");
  if (!container || !cv) return;
  const rect = container.getBoundingClientRect();
  const newW = Math.round(rect.width);
  const newH = Math.round(rect.height);
  if (newW <= 0 || newH <= 0) return;

  const oldW = cv.width || newW;
  const oldH = cv.height || newH;

  if (oldW !== newW || oldH !== newH) {
    // Co giãn đồng tỉ lệ (uniform scale) nếu kích thước thay đổi để nét vẽ không bị méo tỉ lệ
    if (oldW > 0 && oldH > 0 && SketchPad.strokes.length > 0) {
      const scale = Math.min(newW / oldW, newH / oldH);
      const offsetX = (newW - oldW * scale) / 2;
      const offsetY = (newH - oldH * scale) / 2;
      if (
        Math.abs(scale - 1) > 0.01 ||
        Math.abs(offsetX) > 2 ||
        Math.abs(offsetY) > 2
      ) {
        SketchPad.strokes.forEach((st) => {
          st.points.forEach((p) => {
            p.x = p.x * scale + offsetX;
            p.y = p.y * scale + offsetY;
          });
        });
      }
    }
    cv.width = newW;
    cv.height = newH;
    runSketchRecognitionEngine();
    redrawSketchCanvas();
  } else {
    redrawSketchCanvas();
  }
};

function initSketchModalResizer() {
  const resizer = document.getElementById("sketchModalResizer");
  const dialog = document.getElementById("sketchModalDialog");
  const container = document.getElementById("sketchCanvasContainer");
  if (!resizer || !dialog) return;

  let resizing = false;
  let startX = 0,
    startY = 0,
    startW = 0,
    startH = 0;

  resizer.addEventListener("mousedown", (e) => {
    if (isSketchMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = dialog.getBoundingClientRect();
    startW = r.width;
    startH = r.height;
  });

  window.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const nextW = Math.min(
      window.innerWidth - 16,
      Math.max(520, startW + dx * 2),
    );
    const nextH = Math.min(
      window.innerHeight - 16,
      Math.max(380, startH + dy * 2),
    );
    dialog.style.width = `${Math.round(nextW)}px`;
    dialog.style.height = `${Math.round(nextH)}px`;
    resizeSketchCanvas();
  });

  window.addEventListener("mouseup", () => {
    if (resizing) {
      resizing = false;
      resizeSketchCanvas();
    }
  });

  if (typeof ResizeObserver !== "undefined" && container) {
    const ro = new ResizeObserver(() => {
      const modal = document.getElementById("sketchModal");
      if (modal && !modal.classList.contains("hidden")) {
        resizeSketchCanvas();
      }
    });
    ro.observe(container);
  }
}
