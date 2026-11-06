// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/layout.js
// Mô tả: Thuật toán quy hoạch đô thị phân tầng Sugiyama 3D, phân bổ độ cao L0-L2
//        (computeNodeElevationLayers), Kahn Topological Sort O(V+E), tìm điểm
//        hội tụ (findMergeNode), phát hiện chu trình (detectBackEdges) & Linter.
// ============================================================================

// =========================================================================
// 3. COMPUTE NESTING ELEVATION LAYERS (Vertical Layering System)
// =========================================================================
function computeNodeElevationLayers(nodes, edges) {
  const layers = {};
  nodes.forEach((n) => (layers[n.id] = 0));
  if (!nodes.length) return layers;

  const backEdgeIds = detectBackEdges(nodes, edges);
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // 1. Identify nodes inside loop bodies via back-edges (target = header, source = latch)
  edges
    .filter((e) => backEdgeIds.has(e.id))
    .forEach((backEdge) => {
      const headerId = backEdge.target;
      const latchId = backEdge.source;
      // Reverse BFS from latchId stopping at headerId to find all nodes in this loop
      const inLoop = new Set([headerId, latchId]);
      const queue = [latchId];
      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === headerId) continue;
        edges
          .filter((e) => e.target === curr && !backEdgeIds.has(e.id))
          .forEach((inEdge) => {
            if (!inLoop.has(inEdge.source)) {
              inLoop.add(inEdge.source);
              queue.push(inEdge.source);
            }
          });
      }
      inLoop.forEach((id) => {
        if (id !== headerId) {
          layers[id] = Math.min(3, (layers[id] || 0) + 1);
        }
      });
    });

  // 2. Elevate nodes inside non-loop conditional if-else branches by +1 layer
  nodes
    .filter((n) => n.type === "decision")
    .forEach((dec) => {
      const isLoopHeader = edges.some(
        (e) => backEdgeIds.has(e.id) && e.target === dec.id,
      );
      if (!isLoopHeader) {
        const tEdge = edges.find(
          (e) => e.source === dec.id && e.branch === "true",
        );
        const fEdge = edges.find(
          (e) => e.source === dec.id && e.branch === "false",
        );
        const mergeId = findMergeNode(
          tEdge?.target,
          fEdge?.target,
          null,
          { nodes, edges },
        );
        [tEdge?.target, fEdge?.target].forEach((branchStart) => {
          if (
            branchStart &&
            branchStart !== mergeId &&
            nodeMap[branchStart]
          ) {
            if (nodeMap[branchStart].type !== "end") {
              layers[branchStart] = Math.min(
                3,
                Math.max(
                  layers[branchStart] || 0,
                  (layers[dec.id] || 0) + 1,
                ),
              );
            }
          }
        });
      }
    });

  return layers;
}


// =========================================================================
// 11. SUGIYAMA AUTO-LAYOUT + 3D CITY PLANNING
// =========================================================================
function autoLayout(recordHistory = true) {
  const { nodes, edges } = currGraph();
  if (!nodes || nodes.length === 0) return;
  if (recordHistory) pushHistoryState();

  const start = nodes.find((n) => n.type === "start") || nodes[0];
  if (!start) return;

  const backEdgeIds = detectBackEdges(nodes, edges);
  const forwardEdges = edges.filter((e) => !backEdgeIds.has(e.id));
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const rowMap = {};
  nodes.forEach((n) => (rowMap[n.id] = 0));

  // HOTFIX [BUG-05]: Thuật toán gán tầng tuyến tính O(V + E) bằng Kahn Topological Sort Longest Path
  // Thay thế assignRowsDFS O(2^N) tránh đóng băng giao diện khi đồ thị rẽ nhánh phức tạp
  const inDegree = {};
  nodes.forEach((n) => (inDegree[n.id] = 0));
  forwardEdges.forEach((e) => {
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
  });

  const topoQueue = nodes
    .filter((n) => inDegree[n.id] === 0)
    .map((n) => n.id);
  while (topoQueue.length > 0) {
    const uId = topoQueue.shift();
    const uRow = rowMap[uId] || 0;

    forwardEdges
      .filter((e) => e.source === uId)
      .forEach((e) => {
        const vId = e.target;
        if (uRow + 1 > (rowMap[vId] || 0)) {
          rowMap[vId] = uRow + 1;
        }
        inDegree[vId]--;
        if (inDegree[vId] === 0) {
          topoQueue.push(vId);
        }
      });
  }

  const xAssigned = {};
  const occupiedAtRow = {};
  const MIN_X_GAP = 220;
  const ROW_HEIGHT = 90;

  function reserveX(row, desiredX) {
    if (!occupiedAtRow[row]) occupiedAtRow[row] = [];
    let finalX = desiredX;
    while (
      occupiedAtRow[row].some(
        (ex) => Math.abs(ex - finalX) < MIN_X_GAP - 15,
      )
    ) {
      finalX += MIN_X_GAP;
    }
    occupiedAtRow[row].push(finalX);
    return finalX;
  }

  const layoutVisited = new Set();
  function positionSubgraph(uId, preferredX, stopNodeId = null) {
    if (
      !uId ||
      uId === stopNodeId ||
      layoutVisited.has(uId) ||
      !nodeMap[uId]
    )
      return;
    layoutVisited.add(uId);

    const row = rowMap[uId] || 0;
    const x = reserveX(row, preferredX);
    xAssigned[uId] = x;

    const uNode = nodeMap[uId];
    const outs = forwardEdges.filter((e) => e.source === uId);

    if (uNode.type === "decision") {
      const tEdge = outs.find((e) => e.branch === "true");
      const fEdge = outs.find((e) => e.branch === "false");
      const tTarget = tEdge ? tEdge.target : null;
      const fTarget = fEdge ? fEdge.target : null;

      const isLoopHeader = edges.some(
        (e) => backEdgeIds.has(e.id) && e.target === uId,
      );
      if (isLoopHeader) {
        if (tTarget) positionSubgraph(tTarget, x, stopNodeId);
        if (fTarget) positionSubgraph(fTarget, x + MIN_X_GAP, stopNodeId);
      } else {
        const mergeId = findMergeNode(tTarget, fTarget, null);
        if (tTarget && tTarget !== mergeId) {
          positionSubgraph(
            tTarget,
            Math.max(80, x - Math.round(MIN_X_GAP * 0.65)),
            mergeId,
          );
        }
        if (fTarget && fTarget !== mergeId) {
          positionSubgraph(
            fTarget,
            x + Math.round(MIN_X_GAP * 0.65),
            mergeId,
          );
        }
        if (mergeId) positionSubgraph(mergeId, x, stopNodeId);
      }
    } else {
      outs.forEach((e, idx) => {
        positionSubgraph(
          e.target,
          idx === 0 ? x : x + idx * MIN_X_GAP,
          stopNodeId,
        );
      });
    }
  }

  positionSubgraph(start.id, 280, null);

  let extraY = 0;
  nodes.forEach((n) => {
    if (!layoutVisited.has(n.id)) {
      const r = rowMap[n.id] || extraY++;
      xAssigned[n.id] = reserveX(r, 540);
    }
    n.x = xAssigned[n.id] || 280;
    n.y = 35 + (rowMap[n.id] || 0) * ROW_HEIGHT;
  });

  renderAll();
  resetCameraView();
  setStatusText(
    "Đã quy hoạch phân tầng Đô thị 3D (Sugiyama + Elevation)!",
  );
}

// =========================================================================
// 12. STATIC LINTER, MERGE NODE & TYPE INFERENCE COMPILER
// =========================================================================
function detectBackEdges(nodes, edges) {
  const backIds = new Set();
  const visited = new Set();
  const stack = new Set();
  const start = nodes.find((n) => n.type === "start");
  function dfs(u) {
    if (!u) return;
    visited.add(u);
    stack.add(u);
    edges
      .filter((e) => e.source === u)
      .forEach((e) => {
        if (stack.has(e.target)) backIds.add(e.id);
        else if (!visited.has(e.target)) dfs(e.target);
      });
    stack.delete(u);
  }
  if (start) dfs(start.id);
  nodes.forEach((n) => {
    if (!visited.has(n.id)) dfs(n.id);
  });
  return backIds;
}

function runSemanticLinter(nodes, edges) {
  const warnings = [];
  const errorNodeIds = new Set();
  const backEdgeIds = detectBackEdges(nodes, edges);

  const reachable = new Set();
  const start = nodes.find((n) => n.type === "start");
  function markReach(u) {
    if (!u || reachable.has(u)) return;
    reachable.add(u);
    edges
      .filter((e) => e.source === u)
      .forEach((e) => markReach(e.target));
  }
  if (start) markReach(start.id);
  nodes.forEach((n) => {
    if (!reachable.has(n.id)) {
      warnings.push({
        level: "error",
        msg: `Công trình [${n.content}] bị cô lập (Dead Code).`,
      });
      errorNodeIds.add(n.id);
    }
  });

  const initialized = new Set(["Math", "endl", "true", "false"]);
  nodes.forEach((n) => {
    if (n.type === "input") {
      n.content.split(",").forEach((v) => initialized.add(v.trim()));
    } else if (n.type === "process" || n.type === "subroutine") {
      n.content.split(";").forEach((stmt) => {
        const m = stmt.match(
          /^\s*([a-zA-Z_]\w*)\s*(?:\[.*?\])?\s*[+\-*/]?=/,
        );
        if (m) initialized.add(m[1]);
        const inc = stmt.match(/^\s*([a-zA-Z_]\w*)\s*(\+\+|--)/);
        if (inc) initialized.add(inc[1]);
      });
    }
  });

  nodes.forEach((n) => {
    if (
      n.type === "decision" ||
      n.type === "output" ||
      n.type === "return"
    ) {
      const withoutStrings = n.content.replace(/"(?:\\.|[^"\\])*"/g, "");
      const tokens = withoutStrings.match(/[a-zA-Z_]\w*/g) || [];
      tokens.forEach((tok) => {
        if (
          ![
            "Math",
            "floor",
            "sqrt",
            "pow",
            "abs",
            "sin",
            "cos",
            "true",
            "false",
            "return",
            "endl",
          ].includes(tok) &&
          !initialized.has(tok) &&
          !tabs[tok] &&
          activeTab === "main"
        ) {
          warnings.push({
            level: "warn",
            msg: `Biến '${tok}' tại [${n.content}] chưa khởi tạo.`,
          });
          errorNodeIds.add(n.id);
        }
      });
    }
  });

  const loopCount = backEdgeIds.size;
  let bigO = "O(1)";
  if (loopCount === 1) {
    const hasLog = nodes.some((n) =>
      /(\*=|\/=|\*\s*2|\/\s*2)/.test(n.content),
    );
    bigO = hasLog ? "O(log N)" : "O(N)";
  } else if (loopCount >= 2) {
    bigO = `O(N^${loopCount})`;
  }
  const badge = document.getElementById("bigOBadge");
  if (badge) badge.textContent = bigO;

  const list = document.getElementById("linterList");
  if (list) {
    if (warnings.length === 0) {
      list.innerHTML = `<div class="text-emerald-400">✓ Đô thị thông suốt, không có lỗi logic tĩnh.</div>`;
    } else {
      list.innerHTML = warnings
        .map(
          (w) => `
      <div class="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">${escapeHtml(w.msg)}</div>
    `,
        )
        .join("");
    }
  }
  return { warnings, errorNodeIds };
}

function findMergeNode(
  trueTargetId,
  falseTargetId,
  loopHeaderId,
  graph = null,
) {
  if (!trueTargetId || !falseTargetId) return null;
  if (trueTargetId === falseTargetId) return trueTargetId;

  const g = graph || currGraph();
  const { nodes, edges } = g;
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const backIds = detectBackEdges(nodes, edges);

  function bfsReachable(startId) {
    const dist = new Map();
    const queue = [{ id: startId, d: 0 }];
    while (queue.length > 0) {
      const { id, d } = queue.shift();
      if (!id || dist.has(id)) continue;
      dist.set(id, d);

      const node = nodeMap[id];
      const trimmedContent = node ? node.content.trim() : "";
      if (
        !node ||
        id === loopHeaderId ||
        node.type === "end" ||
        node.type === "return" ||
        trimmedContent === "break" ||
        trimmedContent === "continue"
      )
        continue;

      edges
        .filter((e) => e.source === id && !backIds.has(e.id))
        .forEach((e) => {
          if (!dist.has(e.target)) queue.push({ id: e.target, d: d + 1 });
        });
    }
    return dist;
  }

  const distTrue = bfsReachable(trueTargetId);
  const distFalse = bfsReachable(falseTargetId);

  let bestMergeId = null;
  let bestScore = Infinity;
  for (const [nodeId, dT] of distTrue.entries()) {
    if (distFalse.has(nodeId) && nodeId !== loopHeaderId) {
      const score = dT + distFalse.get(nodeId);
      if (score < bestScore) {
        bestScore = score;
        bestMergeId = nodeId;
      }
    }
  }
  return bestMergeId;
}
