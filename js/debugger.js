// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/debugger.js
// Mô tả: Bộ điều khiển mô phỏng từng bước (startTrace, stepNext, toggleAutoPlay,
//        runToBreakpoint, updateRamUI), Thực thi bất đồng bộ qua Inline Web Worker,
//        Infinite Loop Watchdog (State Stagnation), Kill Switch, Testbench & Quests.
// ============================================================================


function startTrace() {
  stopAutoPlay();
  const g = currGraph();
  const start = g.nodes.find((n) => n.type === "start");
  if (!start) return;

  const rawInputs = document
    .getElementById("traceInputBox")
    .value.trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((tok) => (isNaN(Number(tok)) ? tok : Number(tok)));

  traceState = {
    active: true,
    currNodeId: start.id,
    prevNodeId: null,
    lastBranch: null,
    vars: {},
    arrays: {},
    inputs: rawInputs,
    stdout: [],
    steps: 0,
    callStack: [],
  };

  const layerMap = computeNodeElevationLayers(g.nodes, g.edges);
  const startPos = graphToWorld3D(start, layerMap);
  if (dataCapsuleMesh) {
    dataCapsuleMesh.visible = true;
    dataCapsuleMesh.position
      .copy(startPos)
      .add(new THREE.Vector3(0, 22, 0));
  }

  showCapsuleToast(`Khởi hành tại Vòm [${start.content}]`);
  setStatusText("Đang khởi hành tại: " + start.content);
  updateRamUI();
  renderAll(false);
}

function stepNext() {
  if (!traceState.active) {
    startTrace();
    return false;
  }
  const g = currGraph();
  const node = g.nodes.find((n) => n.id === traceState.currNodeId);
  if (!node || node.type === "end" || node.type === "return") {
    // Check if we are returning from a Subroutine on the Call Stack
    if (
      node &&
      Array.isArray(traceState.callStack) &&
      traceState.callStack.length > 0
    ) {
      traceState.steps++;
      const retExpr = node.content.replace(/^return\s*/, "").trim();
      const retVal =
        node.type === "return" && retExpr
          ? evalWithScope(retExpr, traceState.vars, traceState.arrays)
          : 0;

      const frame = traceState.callStack.pop();
      activeTab = frame.tabName;
      selectedNodeId = null;
      renderTabs();

      traceState.vars = frame.vars || {};
      traceState.arrays = frame.arrays || {};
      if (frame.returnVar) {
        traceState.vars[frame.returnVar] = retVal;
      }
      traceState.currNodeId = frame.returnTargetId;

      rebuild3DCityScene();
      if (frame.currNodeId && frame.returnTargetId) {
        launchCapsuleAlongEdge(
          frame.currNodeId,
          frame.returnTargetId,
          null,
        );
      } else if (
        dataCapsuleMesh &&
        frame.currNodeId &&
        buildingMeshesMap[frame.currNodeId]
      ) {
        dataCapsuleMesh.position
          .copy(buildingMeshesMap[frame.currNodeId].position)
          .add(new THREE.Vector3(0, 22, 0));
      }

      const callerNext = currGraph()?.nodes.find(
        (n) => n.id === traceState.currNodeId,
      );
      showCapsuleToast(
        `↩ Return ${retVal} ➔ Quay về ${frame.tabName}()${frame.returnVar ? " [" + frame.returnVar + " = " + retVal + "]" : ""}`,
      );
      setStatusText(
        callerNext
          ? `Bước ${traceState.steps}: Return ${retVal} về [${callerNext.content}]`
          : `Return ${retVal} về ${frame.tabName}()`,
      );
      updateRamUI();
      renderAll(false);
      return true;
    }

    traceState.active = false;
    stopAutoPlay();
    showCapsuleToast("🏁 Viên nang đã tới Vòm Kết Thúc!");
    setStatusText("Đã hoàn tất hành trình giải thuật!");
    renderAll(false);
    return false;
  }

  traceState.steps++;
  let nextEdge = null;
  let actionDesc = "";

  // Handle Subroutine Call with Visual Call Stack Transition
  if (node.type === "subroutine") {
    const callInfo = parseSubroutineCallStatement(node.content);
    if (callInfo && tabs[callInfo.fnName]) {
      const subTabName = callInfo.fnName;
      const subGraph = tabs[subTabName];
      const argVals = callInfo.argExprs.map((ex) =>
        evalWithScope(ex, traceState.vars, traceState.arrays),
      );
      const outEdge = g.edges.find((e) => e.source === node.id);

      if (!Array.isArray(traceState.callStack)) traceState.callStack = [];
      traceState.callStack.push({
        tabName: activeTab,
        currNodeId: node.id,
        vars: { ...traceState.vars },
        arrays: JSON.parse(JSON.stringify(traceState.arrays)),
        returnTargetId: outEdge ? outEdge.target : null,
        returnVar: callInfo.returnVar,
        fnName: subTabName,
      });

      // Bind parameters into subroutine scope
      const paramNames = extractSubroutineParamNames(subGraph);
      const subVars = {};
      paramNames.forEach((pName, idx) => {
        subVars[pName] = argVals[idx] !== undefined ? argVals[idx] : 0;
      });
      if (argVals.length > 0 && subVars.x === undefined)
        subVars.x = argVals[0];

      activeTab = subTabName;
      selectedNodeId = null;
      renderTabs();

      const subStart =
        subGraph.nodes.find((n) => n.type === "start") ||
        subGraph.nodes[0];
      traceState.vars = subVars;
      traceState.arrays = {};
      traceState.currNodeId = subStart ? subStart.id : null;

      rebuild3DCityScene();
      if (subStart && dataCapsuleMesh) {
        const subLayers = computeNodeElevationLayers(
          subGraph.nodes,
          subGraph.edges,
        );
        const subStartPos = graphToWorld3D(subStart, subLayers);
        dataCapsuleMesh.visible = true;
        dataCapsuleMesh.position
          .copy(subStartPos)
          .add(new THREE.Vector3(0, 22, 0));
        capsuleAnim.moving = false;
      }

      showCapsuleToast(
        `📡 Call ${subTabName}(${argVals.join(", ")}) — Đẩy vào Call Stack (#${traceState.callStack.length})`,
      );
      setStatusText(
        `Bước ${traceState.steps}: Chuyển vào hàm con ${subTabName}(${argVals.join(", ")})`,
      );
      updateRamUI();
      renderAll(false);
      return true;
    }
  }

  if (node.type === "input") {
    node.content
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((v) => {
        const val =
          traceState.inputs.length > 0 ? traceState.inputs.shift() : 0;
        traceState.vars[v] = val;
        actionDesc = `Nhập cin >> ${v} = ${val}`;
      });
    nextEdge = g.edges.find((e) => e.source === node.id);
  } else if (node.type === "process" || node.type === "subroutine") {
    const trimmed = node.content.trim();
    if (trimmed === "break" || trimmed === "continue") {
      actionDesc = `Lệnh nhảy: ${trimmed}`;
    } else {
      executeStatementBlock(
        node.content,
        traceState.vars,
        traceState.arrays,
      );
      actionDesc = `Thực thi: ${node.content}`;
    }
    nextEdge = g.edges.find((e) => e.source === node.id);
  } else if (node.type === "output") {
    const val = evalWithScope(
      node.content,
      traceState.vars,
      traceState.arrays,
    );
    traceState.stdout.push(val);
    actionDesc = `Xuất cout << ${val}`;
    nextEdge = g.edges.find((e) => e.source === node.id);
  } else if (node.type === "decision") {
    const cond = Boolean(
      evalWithScope(node.content, traceState.vars, traceState.arrays),
    );
    const br = cond ? "true" : "false";
    actionDesc = `Kiểm tra (${node.content}) ➔ ${cond ? "ĐÚNG (True)" : "SAI (False)"}`;
    nextEdge = g.edges.find(
      (e) => e.source === node.id && e.branch === br,
    );
  } else {
    actionDesc = `Đi qua [${node.content}]`;
    nextEdge = g.edges.find((e) => e.source === node.id);
  }

  const prevId = node.id;
  traceState.currNodeId = nextEdge ? nextEdge.target : null;
  if (nextEdge && traceState.currNodeId) {
    launchCapsuleAlongEdge(
      prevId,
      traceState.currNodeId,
      nextEdge.branch,
    );
  }

  const nextNode = g.nodes.find((n) => n.id === traceState.currNodeId);
  showCapsuleToast(`Bước ${traceState.steps}: ${actionDesc}`);
  setStatusText(
    nextNode
      ? `Bước ${traceState.steps}: Tới [${nextNode.content}]`
      : "Hoàn tất",
  );
  updateRamUI();
  renderAll(false);
  return true;
}

function toggleAutoPlay() {
  if (autoPlayTimer) {
    stopAutoPlay();
    return;
  }
  if (!traceState.active) startTrace();
  const btn = document.getElementById("btnAutoPlay");
  if (btn) btn.textContent = "⏸ Tạm dừng";

  const runTick = () => {
    if (!traceState.active) {
      stopAutoPlay();
      return;
    }
    const moved = stepNext();
    if (!moved) {
      stopAutoPlay();
      return;
    }
    const curr = currGraph().nodes.find(
      (n) => n.id === traceState.currNodeId,
    );
    if (curr && curr.bp) {
      setStatusText(`Dừng tại Trạm Breakpoint: [${curr.content}]`);
      showCapsuleToast(`🛑 Dừng tại Breakpoint: [${curr.content}]`);
      stopAutoPlay();
      return;
    }
    const delay = Math.round(550 / capsuleSpeedMult);
    autoPlayTimer = setTimeout(runTick, delay);
  };

  const delay = Math.round(550 / capsuleSpeedMult);
  autoPlayTimer = setTimeout(runTick, delay);
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
  const btn = document.getElementById("btnAutoPlay");
  if (btn) btn.textContent = "⏩ Tự hành (Auto)";
}

function runToBreakpoint() {
  stopAutoPlay();
  if (!traceState.active) startTrace();
  let guard = 0;
  while (traceState.active && guard < 1500) {
    guard++;
    const moved = stepNext();
    if (!moved) break;
    const curr = currGraph().nodes.find(
      (n) => n.id === traceState.currNodeId,
    );
    if (curr && curr.bp) {
      setStatusText(`Dừng tại Breakpoint: [${curr.content}]`);
      showCapsuleToast(
        `🛑 Viên nang dừng tại Breakpoint: [${curr.content}]`,
      );
      break;
    }
  }
}



function updateRamUI() {
  const stackLen = Array.isArray(traceState.callStack)
    ? traceState.callStack.length
    : 0;
  document.getElementById("stepCounterBadge").textContent =
    stackLen > 0
      ? `Step: ${traceState.steps} • Stack: ${stackLen}`
      : `Step: ${traceState.steps}`;
  const sBox = document.getElementById("scalarRamBox");
  const entries = Object.entries(traceState.vars);
  const stackHtml =
    stackLen > 0
      ? `<div class="col-span-2 px-2 py-1 rounded bg-cyan-500/15 border border-cyan-400/40 text-[10px] text-cyan-200 mono truncate" title="Ngăn xếp Call Stack đang hoạt động">
          📚 Call Stack: ${traceState.callStack.map((f) => f.tabName + "()").join(" ➔ ")} ➔ <b>${activeTab}()</b>
         </div>`
      : "";
  sBox.innerHTML =
    stackHtml +
    (entries.length === 0
      ? `<div class="col-span-2 text-slate-500">Chưa có biến trong RAM</div>`
      : entries
          .map(([k, v]) => {
            const formattedVal =
              typeof v === "string" ? `"${v}"` : String(v);
            return `
        <div class="px-2 py-1 rounded bg-[#121521] border border-[#232942] flex justify-between">
          <span class="text-indigo-300">${escapeHtml(k)}</span>
          <span class="text-emerald-300 font-bold">${escapeHtml(formattedVal)}</span>
        </div>
      `;
          })
          .join(""));

  const aBox = document.getElementById("arrayRamBox");
  const arrEntries = Object.entries(traceState.arrays);
  if (arrEntries.length === 0) {
    aBox.innerHTML = `<div class="text-xs text-slate-500 mono">Khai báo mảng (VD: a = [4, 7, 2, 9, 5]) hoặc chọn Mẫu 2 để xem Tháp Voxel 3D &amp; thanh mảng.</div>`;
  } else {
    aBox.innerHTML = arrEntries
      .map(
        ([arrName, arrVals]) => `
    <div class="flex items-center gap-1.5">
      <span class="text-xs mono font-bold text-cyan-300 mr-1">${escapeHtml(arrName)}[]:</span>
      ${arrVals
        .map((val, idx) => {
          const isI = traceState.vars.i === idx;
          const isJ = traceState.vars.j === idx;
          return `
          <div class="flex flex-col items-center">
            <div class="w-10 h-9 rounded border flex items-center justify-center text-xs mono font-bold ${
              isI || isJ
                ? "bg-amber-500/30 border-amber-400 text-white scale-105"
                : "bg-[#121521] border-[#232942] text-slate-200"
            }">${escapeHtml(val)}</div>
            <span class="text-[10px] mono ${isI ? "text-amber-300 font-bold" : "text-slate-500"}">[${idx}]${isI ? " ↑i" : ""}${isJ ? " ↑j" : ""}</span>
          </div>
        `;
        })
        .join("")}
    </div>
  `,
      )
      .join("");
  }

  document.getElementById("stdoutBox").textContent =
    traceState.stdout.join("\n");
}

// =========================================================================
// 14. AUTOMATED TESTBENCH
// =========================================================================
function renderTestCases() {
  const box = document.getElementById("testCaseList");
  if (!box) return;
  if (!testCases || testCases.length === 0) {
    box.innerHTML = `
    <div class="p-3 rounded bg-[#090b14] border border-dashed border-[#232942] text-slate-500 text-center text-[11px]">
      Chưa có Testcase. Nhập Input &amp; Kỳ vọng bên dưới rồi nhấn <b>+ Thêm</b>.
    </div>
  `;
    return;
  }

  box.innerHTML = testCases
    .map((tc, idx) => {
      let badge = `<span class="text-slate-400 text-[11px]">IDLE</span>`;
      if (tc.status === "PASS")
        badge = `<span class="text-emerald-400 font-bold text-[11px]">✓ PASS</span>`;
      if (tc.status === "FAIL")
        badge = `<span class="text-rose-400 font-bold text-[11px]">✗ FAIL (Ra: ${escapeHtml(tc.actual)})</span>`;
      if (tc.status === "TLE")
        badge = `<span class="text-amber-400 font-bold text-[11px]">⚠ TLE</span>`;
      return `
    <div class="p-1.5 rounded bg-[#090b14] border border-[#232942] flex items-center justify-between gap-1.5">
      <div class="truncate flex-1">
        In: <span class="text-purple-300">${escapeHtml(tc.input)}</span> → Kỳ vọng: <span class="text-emerald-300">${escapeHtml(tc.expected)}</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        ${badge}
        <button onclick="removeTestCase(${idx})" class="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-[10px]">✕</button>
      </div>
    </div>
  `;
    })
    .join("");
}

function addTestCase() {
  const inp = document.getElementById("newTestIn").value.trim();
  const out = document.getElementById("newTestOut").value.trim();
  if (!inp && !out) return;
  testCases.push({
    input: inp,
    expected: out,
    status: "IDLE",
    actual: "",
  });
  document.getElementById("newTestIn").value = "";
  document.getElementById("newTestOut").value = "";
  saveToLocalStorage();
  renderTestCases();
}

function removeTestCase(idx) {
  testCases.splice(idx, 1);
  saveToLocalStorage();
  renderTestCases();
}

function clearAllTestCases() {
  testCases = [];
  saveToLocalStorage();
  renderTestCases();
}

function runAllTests() {
  const g = currGraph();
  const start = g.nodes.find((n) => n.type === "start");
  if (!start) return;

  testCases.forEach((tc) => {
    const inputs = tc.input
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((x) => (isNaN(Number(x)) ? x : Number(x)));
    const vars = {};
    const arrays = {};
    const out = [];
    let currId = start.id;
    let steps = 0;

    while (currId && steps < 2500) {
      steps++;
      const node = g.nodes.find((n) => n.id === currId);
      if (!node || node.type === "end" || node.type === "return") break;
      if (node.type === "input") {
        node.content
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((v) => {
            vars[v] = inputs.shift() ?? 0;
          });
        currId = g.edges.find((e) => e.source === currId)?.target;
      } else if (node.type === "process" || node.type === "subroutine") {
        executeStatementBlock(node.content, vars, arrays);
        currId = g.edges.find((e) => e.source === currId)?.target;
      } else if (node.type === "output") {
        out.push(evalWithScope(node.content, vars, arrays));
        currId = g.edges.find((e) => e.source === currId)?.target;
      } else if (node.type === "decision") {
        const cond = Boolean(evalWithScope(node.content, vars, arrays));
        currId = g.edges.find(
          (e) =>
            e.source === currId && e.branch === (cond ? "true" : "false"),
        )?.target;
      } else {
        currId = g.edges.find((e) => e.source === currId)?.target;
      }
    }

    if (steps >= 2500) {
      tc.status = "TLE";
    } else {
      tc.actual = out.join(" ").trim();
      const exp = tc.expected.trim();
      const lastToken = tc.actual.split(/\s+/).pop() || "";
      tc.status =
        tc.actual === exp || (exp && lastToken === exp) ? "PASS" : "FAIL";
    }
  });
  renderTestCases();
}



function ideRunCode() {
  const box = $id("stdoutBox");
  let compiled;
  try {
    compiled = ideCompile(ide().value);
  } catch (e) {
    box.textContent = "Lỗi dịch mã: " + e.message;
    bittoSay("Mình không đọc được đoạn code này…", "fail");
    return;
  }
  const g = (compiled.find((f) => f.name === "main") || compiled[0])
    .graph;
  const inputs = $id("traceInputBox")
    .value.trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => (isNaN(Number(t)) ? t : Number(t)));
  const vars = {},
    arrays = {},
    res = [];
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const next = (id, br) =>
    g.edges.find(
      (e) => e.source === id && (br === undefined || e.branch === br),
    )?.target;
  let cur = g.nodes.find((n) => n.type === "start")?.id,
    steps = 0;
  const realTabs = tabs;
  tabs = Object.fromEntries(compiled.map((f) => [f.name, f.graph])); // để gọi hàm con tìm đúng sơ đồ vừa dịch
  try {
    while (cur && steps < 20000) {
      steps++;
      const n = byId[cur];
      if (!n || n.type === "end" || n.type === "return") break;
      if (n.type === "input") {
        n.content
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((v) => (vars[v] = inputs.length ? inputs.shift() : 0));
        cur = next(cur);
      } else if (n.type === "process" || n.type === "subroutine") {
        executeStatementBlock(n.content, vars, arrays);
        cur = next(cur);
      } else if (n.type === "output") {
        res.push(ideFmtOut(n.content, vars, arrays));
        cur = next(cur);
      } else if (n.type === "decision") {
        cur = next(
          cur,
          Boolean(evalWithScope(n.content, vars, arrays))
            ? "true"
            : "false",
        );
      } else cur = next(cur);
    }
  } finally {
    tabs = realTabs;
  }
  const tle = steps >= 20000;
  box.textContent =
    (res.join("\n") || "(chương trình không in gì)") +
    `\n— Run xong sau ${steps} bước${tle ? " (TLE: có thể vòng lặp vô hạn)" : ""}`;
  setStatusText(
    tle ? "Chạy code: TLE" : `Chạy code xong sau ${steps} bước.`,
  );
  if (tle)
    bittoSay(
      "Chương trình chạy quá lâu (TLE). Kiểm tra vòng lặp vô hạn nhé!",
      "fail",
      6000,
    );
  else
    bittoSay(
      `Chạy xong! Kết quả cuối: ${res.length ? res[res.length - 1] : "(không có output)"}`,
      "happy",
      5000,
    );
}

// ---------- FEATURE 3: Resizable & Collapsible Testbench Window ----------
let testbenchCollapsed = false;
let savedTestbenchHeight = 256;

function toggleTestbenchCollapse() {
  const panel = document.getElementById("testbenchPanel");
  const btn = document.getElementById("btnToggleTestbench");
  if (!panel) return;
  testbenchCollapsed = !testbenchCollapsed;
  if (testbenchCollapsed) {
    savedTestbenchHeight = panel.offsetHeight || 256;
    panel.classList.add("tb-collapsed");
    if (btn) btn.textContent = "▴ Hiện";
  } else {
    panel.classList.remove("tb-collapsed");
    panel.style.height = Math.max(150, savedTestbenchHeight) + "px";
    if (btn) btn.textContent = "▾ Ẩn";
  }
  ideRefreshGutter();
}

function initTestbenchResizer() {
  const resizer = document.getElementById("testbenchResizer");
  const panel = document.getElementById("testbenchPanel");
  const rightSidebar = document.getElementById("rightSidebar");
  if (!resizer || !panel || !rightSidebar) return;

  let draggingTb = false;
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    draggingTb = true;
    resizer.classList.add("active");
    if (testbenchCollapsed) {
      toggleTestbenchCollapse();
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!draggingTb) return;
    const sidebarRect = rightSidebar.getBoundingClientRect();
    const newHeight = sidebarRect.bottom - e.clientY;
    const clamped = Math.min(
      Math.max(120, sidebarRect.height - 150),
      Math.max(110, newHeight),
    );
    panel.style.height = `${Math.round(clamped)}px`;
    savedTestbenchHeight = clamped;
    ideRefreshGutter();
  });

  window.addEventListener("mouseup", () => {
    if (draggingTb) {
      draggingTb = false;
      resizer.classList.remove("active");
      ideRefreshGutter();
    }
  });
}

const _v52IdeRunCode = ideRunCode;
ideRunCode = function () {
  _v52IdeRunCode();
  runTerminalSemanticScanner(false);
};

const _v52RunAllTests2 = runAllTests;
runAllTests = function () {
  _v52RunAllTests2();
  runTerminalSemanticScanner(false);
};

const _v5UpdateRamUI = updateRamUI;
updateRamUI = function () {
  _v5UpdateRamUI();
  const aBox = document.getElementById("arrayRamBox");
  if (!aBox) return;
  const arrEntries = Object.entries(traceState.arrays || {});
  if (arrEntries.length === 0) return;

  aBox.innerHTML = arrEntries
    .map(([arrName, arrVals]) => {
      if (Array.isArray(arrVals[0])) {
        // Render Ma trận 2 chiều N×M
        const curI = traceState.vars?.i;
        const curJ = traceState.vars?.j;
        return `
          <div class="flex flex-col gap-1 py-0.5">
            <span class="text-[11px] mono font-bold text-cyan-300">${escapeHtml(arrName)}[${arrVals.length}][${arrVals[0].length}] (Ma trận 2D):</span>
            <div class="flex flex-col gap-1">
              ${arrVals
                .map(
                  (row, rIdx) => `
                  <div class="flex items-center gap-1">
                    <span class="text-[9px] mono text-slate-500 w-7">r${rIdx}:</span>
                    ${(Array.isArray(row) ? row : [row])
                      .map((cell, cIdx) => {
                        const hit = curI === rIdx && curJ === cIdx;
                        return `<div class="px-2 py-0.5 rounded border text-[11px] mono font-bold ${
                          hit
                            ? "bg-cyan-500/30 border-cyan-400 text-white shadow"
                            : "bg-[#121521] border-[#232942] text-slate-300"
                        }" title="[${rIdx}][${cIdx}]">${escapeHtml(cell)}${hit ? " 🎯" : ""}</div>`;
                      })
                      .join("")}
                  </div>`,
                )
                .join("")}
            </div>
          </div>
        `;
      } else {
        // Render Mảng 1 chiều kèm các con trỏ i, j, left, right, mid, ptr
        return `
          <div class="flex items-center gap-1.5">
            <span class="text-xs mono font-bold text-cyan-300 mr-1">${escapeHtml(arrName)}[]:</span>
            ${arrVals
              .map((val, idx) => {
                const ptrs = Object.keys(POINTER_COLORS).filter(
                  (k) => traceState.vars && traceState.vars[k] === idx,
                );
                const isHit = ptrs.length > 0;
                return `
                  <div class="flex flex-col items-center">
                    <div class="w-10 h-8 rounded border flex items-center justify-center text-xs mono font-bold transition ${
                      isHit
                        ? "bg-cyan-500/30 border-cyan-400 text-white -translate-y-1 shadow-lg"
                        : "bg-[#121521] border-[#232942] text-slate-200"
                    }">${escapeHtml(val)}</div>
                    <span class="text-[10px] mono ${
                      isHit ? "text-cyan-300 font-bold" : "text-slate-500"
                    }">[${idx}]${isHit ? " ↑" + ptrs.join(",") : ""}</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }
    })
    .join("");
};


// =========================================================================
// GÓI 1: TÁCH ENGINE THÔNG DỊCH SANG INLINE WEB WORKER + TIME-SLICED ASYNC
//        & INFINITE LOOP WATCHDOG (STATE STAGNATION DETECTION) + KILL SWITCH
// =========================================================================
const MAX_SAFE_STEPS = 3000;
let activeWorkerInstance = null;
let asyncExecutionToken = 0; // Dùng để ngắt lập tức mọi vòng lặp async khi bấm Kill Switch

// Theo dõi lịch sử trạng thái biến tại mỗi khối Decision để phát hiện State Stagnation
let decisionStateWatchdog = {};

// Hàm trích xuất các biến phụ thuộc trong biểu thức điều kiện của khối Decision
function extractDependentVarsFromCondition(condExpr) {
  const cleaned = String(condExpr || "").replace(
    /"(?:\\.|[^"\\])*"/g,
    "",
  );
  const idents = cleaned.match(/[a-zA-Z_]\w*/g) || [];
  return idents.filter(
    (id) =>
      ![
        "Math",
        "floor",
        "ceil",
        "round",
        "sqrt",
        "pow",
        "abs",
        "true",
        "false",
      ].includes(id),
  );
}

// Tạo chữ ký trạng thái của các biến phụ thuộc tại khối Decision
function getConditionStateSignature(condExpr, vars, arrays) {
  const depVars = extractDependentVarsFromCondition(condExpr);
  if (depVars.length === 0) {
    return JSON.stringify({ vars, arrays });
  }
  const snap = {};
  depVars.forEach((v) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, v)) {
      snap[v] = vars[v];
    }
    if (arrays && Object.prototype.hasOwnProperty.call(arrays, v)) {
      snap["arr_" + v] = arrays[v];
    }
  });
  return JSON.stringify(snap);
}

// Phát hiện State Stagnation (khi khối decision lặp lại mà trạng thái các biến phụ thuộc không đổi)
function checkDecisionStagnation(node, vars, arrays) {
  if (!node || node.type !== "decision") return false;
  const sig = getConditionStateSignature(node.content, vars, arrays);
  const rec = decisionStateWatchdog[node.id];
  if (rec && rec.lastSig === sig) {
    rec.repeatCount += 1;
    // Nếu lặp lại liên tiếp 2 lần trở lên mà các biến phụ thuộc trong điều kiện hoàn toàn đứng yên -> Chắc chắn lặp vô tận!
    if (rec.repeatCount >= 2) {
      return true;
    }
  } else {
    decisionStateWatchdog[node.id] = { lastSig: sig, repeatCount: 1 };
  }
  return false;
}

// Xử lý khi phát hiện Vòng Lặp Vô Tận (Infinite Loop Watchdog) hoặc người dùng bấm Kill Switch
function handleInfiniteLoopDetected(nodeId, condText) {
  asyncExecutionToken++;
  if (activeWorkerInstance) {
    try {
      activeWorkerInstance.terminate();
    } catch (e) {}
    activeWorkerInstance = null;
  }
  stopAutoPlay();
  traceState.active = false;
  if (nodeId) {
    tleInfiniteNodeIds.add(nodeId);
    selectedNodeId = nodeId;
  }

  // Phát âm thanh cảnh báo lỗi
  if (typeof SoundManager !== "undefined") {
    SoundManager.play("sfx_test_fail");
  }

  // Xuất thông báo chuẩn ra màn hình Terminal/STDOUT
  const alertMsg = `[CẢNH BÁO TLE] Phát hiện vòng lặp vô tận tại khối [${condText}]! Hệ thống đã tự động ngắt để bảo vệ trình duyệt.`;
  const stdoutBox = document.getElementById("stdoutBox");
  if (stdoutBox) {
    stdoutBox.textContent =
      (traceState.stdout.length
        ? traceState.stdout.join("\n") + "\n"
        : "") + alertMsg;
    stdoutBox.classList.remove("text-emerald-400");
    stdoutBox.classList.add(
      "text-rose-400",
      "font-bold",
      "terminal-error-glow",
    );
  }

  showCapsuleToast(`🛑 ${alertMsg}`);
  setStatusText(alertMsg);
  renderAll(false);
  runTerminalSemanticScanner(false);

  // Kích hoạt Bitto AI Copilot đưa ra gợi ý sửa điều kiện dừng
  const depVars = extractDependentVarsFromCondition(condText);
  const varHint = depVars.length
    ? `biến \`${depVars[0]}\` (ví dụ: thêm khối Process \`${depVars[0]}++\` hoặc \`${depVars[0]}--\` bên trong nhánh True của vòng lặp)`
    : "biến đếm điều kiện dừng";
  const copilotAdvice = `🚨 **[CẢNH BÁO TLE]** Mình vừa tự động ngắt vòng lặp vô tận tại khối điều kiện \`[${condText}]\` vì trạng thái biến không thay đổi sau các chu kỳ lặp!\n💡 **Gợi ý sửa lỗi:** Bạn hãy kiểm tra xem nhánh **True** của khối \`[${condText}]\` đã có khối lệnh cập nhật ${varHint} trước khi nối vòng quay lại chưa nhé!`;

  bittoSay(
    `🚨 Phát hiện vòng lặp vô tận tại [${condText}]! Hãy cập nhật ${depVars[0] || "biến đếm"} trong thân vòng lặp nhé!`,
    "fail",
    8000,
  );
  appendBittoCopilotMessage("ai", copilotAdvice);
}

// Nút Ngắt Khẩn Cấp (Kill Switch)
function triggerEmergencyKillSwitch(reasonText) {
  asyncExecutionToken++;
  if (activeWorkerInstance) {
    try {
      activeWorkerInstance.terminate();
    } catch (e) {}
    activeWorkerInstance = null;
  }
  stopAutoPlay();
  traceState.active = false;
  if (typeof SoundManager !== "undefined") {
    SoundManager.play("sfx_node_delete");
  }
  const msg = `[KILL SWITCH] ${reasonText || "Người dùng chủ động bấm Nút Ngắt Khẩn Cấp (Kill Switch)!"}`;
  const stdoutBox = document.getElementById("stdoutBox");
  if (stdoutBox) {
    stdoutBox.textContent =
      (stdoutBox.textContent ? stdoutBox.textContent + "\n" : "") + msg;
  }
  showCapsuleToast("🛑 Đã kích hoạt Nút Ngắt Khẩn Cấp (Kill Switch)!");
  setStatusText(msg);
  renderAll(false);
}

// Khởi tạo lại bộ theo dõi Stagnation mỗi khi bắt đầu chạy mới
const _v6OrigStartTrace = startTrace;
startTrace = function () {
  tleInfiniteNodeIds.clear();
  decisionStateWatchdog = {};
  _v6OrigStartTrace();
};

// Ghi đè stepNext để kiểm tra Infinite Loop Watchdog (State Stagnation + MAX_SAFE_STEPS = 3000)
const _v6OrigStepNext = stepNext;
stepNext = function () {
  if (traceState.active && traceState.currNodeId) {
    const g = currGraph();
    const currNode = g?.nodes.find((n) => n.id === traceState.currNodeId);
    if (currNode) {
      if (traceState.steps >= MAX_SAFE_STEPS) {
        handleInfiniteLoopDetected(currNode.id, currNode.content);
        return false;
      }
      if (
        currNode.type === "decision" &&
        checkDecisionStagnation(
          currNode,
          traceState.vars,
          traceState.arrays,
        )
      ) {
        handleInfiniteLoopDetected(currNode.id, currNode.content);
        return false;
      }
    }
  }
  return _v6OrigStepNext();
};

// Ghi đè runToBreakpoint sang Time-Sliced Async Execution (16ms/frame budget + MAX_SAFE_STEPS = 3000)
runToBreakpoint = async function () {
  stopAutoPlay();
  if (!traceState.active) startTrace();
  const myToken = ++asyncExecutionToken;
  let frameStart = performance.now();

  while (traceState.active && traceState.steps < MAX_SAFE_STEPS) {
    if (myToken !== asyncExecutionToken) return;
    const moved = stepNext();
    if (!moved) break;

    const curr = currGraph()?.nodes.find(
      (n) => n.id === traceState.currNodeId,
    );
    if (curr && curr.bp) {
      setStatusText(`Dừng tại Breakpoint: [${curr.content}]`);
      showCapsuleToast(
        `🛑 Viên nang dừng tại Breakpoint: [${curr.content}]`,
      );
      break;
    }

    // Time-Sliced Async: Nếu thực thi trong frame vượt quá 16ms, nhường luồng cho trình duyệt vẽ 60 FPS
    if (performance.now() - frameStart > 16) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      frameStart = performance.now();
    }
  }
};

// Tạo Inline Web Worker (Blob URL) để chạy thông dịch thuật toán và chấm Testbench hoàn toàn ngoài Main Thread
function createInterpreterWorkerBlobUrl() {
  const workerCode = `
    const MAX_SAFE_STEPS = 3000;
    const SAFE_MATH = {
      sqrt: Math.sqrt, pow: Math.pow, abs: Math.abs, fabs: Math.abs,
      floor: Math.floor, ceil: Math.ceil, round: Math.round,
      sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log,
      exp: Math.exp, min: Math.min, max: Math.max, trunc: Math.trunc
    };
    const tokenizeSafeExpr = ${tokenizeSafeExpr.toString()};
    const FORBIDDEN_IDENTIFIERS = new Set(["window","document","fetch","Function","eval"]);
    const SAFE_MATH_FUNCS = SAFE_MATH;
    let tabs = {};
    let globalSubroutineRecursionDepth = 0;
    const MAX_SUBROUTINE_DEPTH = 128;
    const extractSubroutineParamNames = ${extractSubroutineParamNames.toString()};
    const runSubroutineHeadless = ${runSubroutineHeadless.toString()};
    const _v5EvalWithScope = ${_v5EvalWithScope.toString()};
    const evalWithScope = ${evalWithScope.toString()};
    const _v5ExecuteStatementBlock = ${_v5ExecuteStatementBlock.toString()};
    const executeStatementBlock = ${executeStatementBlock.toString()};
    const extractDependentVarsFromCondition = ${extractDependentVarsFromCondition.toString()};
    const getConditionStateSignature = ${getConditionStateSignature.toString()};

    function executeGraphInWorker(graph, allTabs, rawInputs) {
      tabs = allTabs || {};
      const inputs = Array.isArray(rawInputs) ? [...rawInputs] : [];
      const vars = {};
      const arrays = {};
      const out = [];
      const traceSteps = [];
      const watchdog = {};
      const byId = Object.fromEntries((graph.nodes || []).map((n) => [n.id, n]));
      const nextEdge = (id, br) =>
        (graph.edges || []).find(
          (e) => e.source === id && (br === undefined || e.branch === br)
        );

      let curId = (graph.nodes || []).find((n) => n.type === "start")?.id;
      let steps = 0;

      while (curId && steps < MAX_SAFE_STEPS) {
        steps++;
        const n = byId[curId];
        if (!n || n.type === "end" || n.type === "return") {
          traceSteps.push({ nodeId: curId, vars: { ...vars }, stdout: [...out] });
          break;
        }

        if (n.type === "decision") {
          const sig = getConditionStateSignature(n.content, vars, arrays);
          if (watchdog[n.id] && watchdog[n.id].sig === sig) {
            watchdog[n.id].count++;
            if (watchdog[n.id].count >= 2) {
              return {
                status: "TLE",
                tleNodeId: n.id,
                tleCond: n.content,
                steps,
                stdout: out,
                vars,
                arrays,
                traceSteps
              };
            }
          } else {
            watchdog[n.id] = { sig, count: 1 };
          }
        }

        let chosenEdge = null;
        if (n.type === "input") {
          n.content.split(",").map((s) => s.trim()).filter(Boolean).forEach((v) => {
            vars[v] = inputs.length ? inputs.shift() : 0;
          });
          chosenEdge = nextEdge(curId);
        } else if (n.type === "process" || n.type === "subroutine") {
          executeStatementBlock(n.content, vars, arrays);
          chosenEdge = nextEdge(curId);
        } else if (n.type === "output") {
          const parts = n.content.split(",").map((p) => String(evalWithScope(p.trim(), vars, arrays)));
          out.push(parts.join(""));
          chosenEdge = nextEdge(curId);
        } else if (n.type === "decision") {
          const cond = Boolean(evalWithScope(n.content, vars, arrays));
          chosenEdge = nextEdge(curId, cond ? "true" : "false");
        } else {
          chosenEdge = nextEdge(curId);
        }

        const nextId = chosenEdge ? chosenEdge.target : null;
        if (traceSteps.length < 180) {
          traceSteps.push({
            fromId: curId,
            toId: nextId,
            branch: chosenEdge?.branch || null,
            vars: { ...vars },
            stdout: [...out]
          });
        }
        curId = nextId;
      }

      if (steps >= MAX_SAFE_STEPS) {
        const stuckNode = byId[curId] || { id: curId, content: "loop" };
        return {
          status: "TLE",
          tleNodeId: stuckNode.id,
          tleCond: stuckNode.content,
          steps,
          stdout: out,
          vars,
          arrays,
          traceSteps
        };
      }

      return {
        status: "OK",
        steps,
        stdout: out,
        vars,
        arrays,
        traceSteps
      };
    }

    self.onmessage = function (e) {
      const data = e.data || {};
      if (data.cmd === "RUN_CODE") {
        const res = executeGraphInWorker(data.graph, data.tabs, data.inputs);
        self.postMessage({ type: "RUN_CODE_RESULT", result: res });
      } else if (data.cmd === "RUN_TESTS") {
        const results = (data.testCases || []).map((tc) => {
          const parsedIn = String(tc.input || "")
            .trim()
            .split(/[\\s,]+/)
            .filter(Boolean)
            .map((x) => (isNaN(Number(x)) ? x : Number(x)));
          const r = executeGraphInWorker(data.graph, data.tabs, parsedIn);
          if (r.status === "TLE") {
            return { ...tc, status: "TLE", actual: "TLE", tleNodeId: r.tleNodeId, tleCond: r.tleCond };
          }
          const actualStr = r.stdout.join(" ").trim();
          const exp = String(tc.expected || "").trim();
          const lastTok = actualStr.split(/\\s+/).pop() || "";
          const pass = actualStr === exp || (exp && lastTok === exp);
          return { ...tc, status: pass ? "PASS" : "FAIL", actual: actualStr };
        });
        self.postMessage({ type: "RUN_TESTS_RESULT", results });
      }
    };
  `;
  const blob = new Blob([workerCode], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

// Chạy thuật toán qua Inline Web Worker (với Time-Sliced Async fallback an toàn)
function dispatchWorkerTask(payload) {
  return new Promise((resolve) => {
    try {
      if (activeWorkerInstance) {
        activeWorkerInstance.terminate();
      }
      const blobUrl = createInterpreterWorkerBlobUrl();
      const worker = new Worker(blobUrl);
      activeWorkerInstance = worker;
      URL.revokeObjectURL(blobUrl);

      worker.onmessage = (ev) => {
        activeWorkerInstance = null;
        worker.terminate();
        resolve(ev.data);
      };
      worker.onerror = () => {
        activeWorkerInstance = null;
        worker.terminate();
        resolve(null);
      };
      worker.postMessage(payload);
    } catch (err) {
      resolve(null);
    }
  });
}

// Ghi đè ideRunCode: chạy trong Inline Web Worker, đồng bộ viên nang 3D mượt qua requestAnimationFrame và bắt lỗi lặp vô tận
ideRunCode = async function () {
  const box = document.getElementById("stdoutBox");
  tleInfiniteNodeIds.clear();
  let g = currGraph();

  if (activeOutputTab === "cpp") {
    try {
      const compiled = ideCompile(ide().value);
      g = (compiled.find((f) => f.name === "main") || compiled[0]).graph;
    } catch (e) {
      if (box) box.textContent = "Lỗi dịch mã: " + e.message;
      bittoSay("Mình không đọc được đoạn code này…", "fail");
      return;
    }
  }

  const inputs = document
    .getElementById("traceInputBox")
    .value.trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => (isNaN(Number(t)) ? t : Number(t)));

  setStatusText("Đang thực thi bất đồng bộ trong Web Worker...");
  const workerReply = await dispatchWorkerTask({
    cmd: "RUN_CODE",
    graph: g,
    tabs,
    inputs,
  });

  if (workerReply && workerReply.result) {
    const r = workerReply.result;
    traceState.vars = r.vars || {};
    traceState.arrays = r.arrays || {};
    traceState.stdout = r.stdout || [];
    traceState.steps = r.steps || 0;
    updateRamUI();

    // Đồng bộ chuyển động viên nang 3D ở bước cuối theo requestAnimationFrame
    if (Array.isArray(r.traceSteps) && r.traceSteps.length > 0) {
      const lastHop = r.traceSteps[r.traceSteps.length - 1];
      if (lastHop.fromId && lastHop.toId) {
        requestAnimationFrame(() => {
          launchCapsuleAlongEdge(
            lastHop.fromId,
            lastHop.toId,
            lastHop.branch,
          );
        });
      }
    }

    if (r.status === "TLE") {
      handleInfiniteLoopDetected(r.tleNodeId, r.tleCond || "loop");
      return;
    }

    if (box) {
      box.classList.remove(
        "text-rose-400",
        "font-bold",
        "terminal-error-glow",
      );
      box.classList.add("text-emerald-400");
      box.textContent =
        (r.stdout.join("\n") || "(chương trình không in gì)") +
        `\n— [Web Worker] Thực thi an toàn sau ${r.steps} bước.`;
    }
    setStatusText(`Web Worker hoàn tất sau ${r.steps} bước.`);
    rebuild3DCityScene();
    runTerminalSemanticScanner(false);
    if (typeof SoundManager !== "undefined")
      SoundManager.play("sfx_test_pass");
    bittoSay(
      `Chạy xong trên Web Worker! Kết quả: ${
        r.stdout.length
          ? r.stdout[r.stdout.length - 1]
          : "(không có output)"
      }`,
      "happy",
      5000,
    );
  }
};

// Ghi đè runAllTests: chấm Testbench bất đồng bộ qua Inline Web Worker
runAllTests = async function () {
  const g = currGraph();
  if (!g || !testCases.length) return;
  tleInfiniteNodeIds.clear();
  setStatusText("Đang chấm Testbench trên Web Worker...");

  const workerReply = await dispatchWorkerTask({
    cmd: "RUN_TESTS",
    graph: g,
    tabs,
    testCases,
  });

  if (workerReply && Array.isArray(workerReply.results)) {
    testCases = workerReply.results;
    renderTestCases();

    const tleCase = testCases.find((tc) => tc.status === "TLE");
    if (tleCase) {
      handleInfiniteLoopDetected(
        tleCase.tleNodeId,
        tleCase.tleCond || "decision",
      );
      return;
    }

    const failIdx = testCases.findIndex((t) => t.status === "FAIL");
    if (failIdx < 0) {
      if (typeof SoundManager !== "undefined")
        SoundManager.play("sfx_test_pass");
      bittoSay(
        "Tuyệt vời! Tất cả testcase đều PASS trên Web Worker 🎉",
        "happy",
        5000,
      );
    } else {
      if (typeof SoundManager !== "undefined")
        SoundManager.play("sfx_test_fail");
      const tc = testCases[failIdx];
      bittoSay(
        `Testcase #${failIdx + 1} FAIL: kỳ vọng "${tc.expected}" nhưng nhận "${tc.actual}"`,
        "fail",
        6500,
      );
    }
    runTerminalSemanticScanner(false);
  }
};

const ALGORITHM_QUESTS = {
  quest1: {
    title: "🏆 Bài 1: Tính tổng S = 1 + 2 + ... + N",
    desc: "Nhập số nguyên dương N. Sử dụng vòng lặp cộng dồn biến i từ 1 đến N vào biến S, sau đó xuất tổng S ra màn hình.",
    defaultInput: "5",
    hint: "Ở Bài 1, biến `S` được khởi tạo bằng 0 và `i = 1`. Khi điều kiện `i <= n` còn đúng (nhánh True), ta cộng `S += i` rồi tăng `i++` và quay lại kiểm tra điều kiện!",
    testCases: [
      { input: "5", expected: "15", status: "IDLE", actual: "" },
      { input: "10", expected: "55", status: "IDLE", actual: "" },
      { input: "100", expected: "5050", status: "IDLE", actual: "" },
    ],
    graph: {
      signature: "int main()",
      nodes: [
        {
          id: "q1_1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "q1_2",
          type: "input",
          content: "n",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "q1_3",
          type: "process",
          content: "S = 0; i = 1",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "q1_4",
          type: "decision",
          content: "i <= n",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "q1_5",
          type: "process",
          content: "S += i; i++",
          x: 280,
          y: 380,
          bp: true,
        },
        {
          id: "q1_6",
          type: "output",
          content: "S",
          x: 520,
          y: 380,
          bp: false,
        },
        {
          id: "q1_7",
          type: "end",
          content: "End",
          x: 520,
          y: 470,
          bp: false,
        },
      ],
      edges: [
        { id: "qe1", source: "q1_1", target: "q1_2" },
        { id: "qe2", source: "q1_2", target: "q1_3" },
        { id: "qe3", source: "q1_3", target: "q1_4" },
        { id: "qe4", source: "q1_4", target: "q1_5", branch: "true" },
        { id: "qe5", source: "q1_5", target: "q1_4" },
        { id: "qe6", source: "q1_4", target: "q1_6", branch: "false" },
        { id: "qe7", source: "q1_6", target: "q1_7" },
      ],
    },
  },
  quest2: {
    title: "🏆 Bài 2: Tìm số lớn nhất trong mảng (Find Max)",
    desc: "Cho mảng 1 chiều a = [12, 45, 7, 89, 23] gồm n = 5 phần tử. Hãy duyệt qua mảng để tìm và xuất giá trị lớn nhất (maxVal).",
    defaultInput: "5",
    hint: "Ở Bài 2, gán `maxVal = a[0]` rồi duyệt `i` từ 1 đến `n - 1`. Nếu `a[i] > maxVal` thì cập nhật `maxVal = a[i]`!",
    testCases: [
      { input: "5", expected: "89", status: "IDLE", actual: "" },
    ],
    graph: {
      signature: "int main()",
      nodes: [
        {
          id: "q2_1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "q2_2",
          type: "process",
          content: "a = [12, 45, 7, 89, 23]; n = 5",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "q2_3",
          type: "process",
          content: "maxVal = a[0]; i = 1",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "q2_4",
          type: "decision",
          content: "i < n",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "q2_5",
          type: "decision",
          content: "a[i] > maxVal",
          x: 280,
          y: 375,
          bp: false,
        },
        {
          id: "q2_6",
          type: "process",
          content: "maxVal = a[i]",
          x: 140,
          y: 460,
          bp: true,
        },
        {
          id: "q2_7",
          type: "process",
          content: "i++",
          x: 280,
          y: 545,
          bp: false,
        },
        {
          id: "q2_8",
          type: "output",
          content: "maxVal",
          x: 520,
          y: 375,
          bp: false,
        },
        {
          id: "q2_9",
          type: "end",
          content: "End",
          x: 520,
          y: 460,
          bp: false,
        },
      ],
      edges: [
        { id: "qe2_1", source: "q2_1", target: "q2_2" },
        { id: "qe2_2", source: "q2_2", target: "q2_3" },
        { id: "qe2_3", source: "q2_3", target: "q2_4" },
        { id: "qe2_4", source: "q2_4", target: "q2_5", branch: "true" },
        { id: "qe2_5", source: "q2_5", target: "q2_6", branch: "true" },
        { id: "qe2_6", source: "q2_6", target: "q2_7" },
        { id: "qe2_7", source: "q2_5", target: "q2_7", branch: "false" },
        { id: "qe2_8", source: "q2_7", target: "q2_4" },
        { id: "qe2_9", source: "q2_4", target: "q2_8", branch: "false" },
        { id: "qe2_10", source: "q2_8", target: "q2_9" },
      ],
    },
  },
  quest3: {
    title: "🏆 Bài 3: Kiểm tra số nguyên tố (Prime Check)",
    desc: "Nhập số nguyên dương N. Đếm số ước của N trong đoạn [2..N/2]. Xuất 1 nếu N là số nguyên tố, ngược lại xuất 0.",
    defaultInput: "17",
    hint: "Số nguyên tố lớn hơn 1 chỉ chia hết cho 1 và chính nó. Ta kiểm tra `i` từ 2 đến `n / 2`, nếu `n % i == 0` thì đánh dấu `isPrime = 0`.",
    testCases: [
      { input: "17", expected: "1", status: "IDLE", actual: "" },
      { input: "15", expected: "0", status: "IDLE", actual: "" },
      { input: "2", expected: "1", status: "IDLE", actual: "" },
    ],
    graph: {
      signature: "int main()",
      nodes: [
        {
          id: "q3_1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "q3_2",
          type: "input",
          content: "n",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "q3_3",
          type: "process",
          content: "isPrime = 1; i = 2",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "q3_4",
          type: "decision",
          content: "i <= Math.floor(n/2)",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "q3_5",
          type: "decision",
          content: "n % i == 0",
          x: 280,
          y: 375,
          bp: false,
        },
        {
          id: "q3_6",
          type: "process",
          content: "isPrime = 0",
          x: 140,
          y: 460,
          bp: true,
        },
        {
          id: "q3_7",
          type: "process",
          content: "i++",
          x: 280,
          y: 545,
          bp: false,
        },
        {
          id: "q3_8",
          type: "output",
          content: "isPrime",
          x: 520,
          y: 375,
          bp: false,
        },
        {
          id: "q3_9",
          type: "end",
          content: "End",
          x: 520,
          y: 460,
          bp: false,
        },
      ],
      edges: [
        { id: "qe3_1", source: "q3_1", target: "q3_2" },
        { id: "qe3_2", source: "q3_2", target: "q3_3" },
        { id: "qe3_3", source: "q3_3", target: "q3_4" },
        { id: "qe3_4", source: "q3_4", target: "q3_5", branch: "true" },
        { id: "qe3_5", source: "q3_5", target: "q3_6", branch: "true" },
        { id: "qe3_6", source: "q3_6", target: "q3_7" },
        { id: "qe3_7", source: "q3_5", target: "q3_7", branch: "false" },
        { id: "qe3_8", source: "q3_7", target: "q3_4" },
        { id: "qe3_9", source: "q3_4", target: "q3_8", branch: "false" },
        { id: "qe3_10", source: "q3_8", target: "q3_9" },
      ],
    },
  },
  quest4: {
    title: "🏆 Bài 4: Đảo ngược một số nguyên (Reverse Integer)",
    desc: "Nhập số nguyên dương N (ví dụ 1234). Dùng vòng lặp tách chữ số cuối (n % 10) để ghép thành số đảo ngược rev (4321) rồi xuất ra màn hình.",
    defaultInput: "1234",
    hint: "Trong mỗi bước lặp khi `n > 0`: lấy chữ số cuối `digit = n % 10`, ghép vào `rev = rev * 10 + digit`, và giảm `n = Math.floor(n / 10)`.",
    testCases: [
      { input: "1234", expected: "4321", status: "IDLE", actual: "" },
      { input: "907", expected: "709", status: "IDLE", actual: "" },
    ],
    graph: {
      signature: "int main()",
      nodes: [
        {
          id: "q4_1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "q4_2",
          type: "input",
          content: "n",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "q4_3",
          type: "process",
          content: "rev = 0",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "q4_4",
          type: "decision",
          content: "n > 0",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "q4_5",
          type: "process",
          content: "rev = rev * 10 + (n % 10); n = Math.floor(n / 10)",
          x: 280,
          y: 380,
          bp: true,
        },
        {
          id: "q4_6",
          type: "output",
          content: "rev",
          x: 520,
          y: 380,
          bp: false,
        },
        {
          id: "q4_7",
          type: "end",
          content: "End",
          x: 520,
          y: 470,
          bp: false,
        },
      ],
      edges: [
        { id: "qe4_1", source: "q4_1", target: "q4_2" },
        { id: "qe4_2", source: "q4_2", target: "q4_3" },
        { id: "qe4_3", source: "q4_3", target: "q4_4" },
        { id: "qe4_4", source: "q4_4", target: "q4_5", branch: "true" },
        { id: "qe4_5", source: "q4_5", target: "q4_4" },
        { id: "qe4_6", source: "q4_4", target: "q4_6", branch: "false" },
        { id: "qe4_7", source: "q4_6", target: "q4_7" },
      ],
    },
  },
  quest5: {
    title: "🏆 Bài 5: Thuật toán sắp xếp nổi bọt (Bubble Sort)",
    desc: "Sắp xếp mảng a = [9, 3, 7, 1, 5] tăng dần bằng 2 vòng lặp lồng nhau (so sánh cặp a[j] và a[j+1]), sau đó xuất phần tử nhỏ nhất a[0] và lớn nhất a[4].",
    defaultInput: "5",
    hint: "Bubble Sort dùng 2 vòng lặp `i` và `j`. Khi `a[j] > a[j + 1]`, ta hoán đổi vị trí 2 phần tử bằng biến tạm `tmp`. Quan sát Khay Memory 3D để thấy tia con trỏ `i, j` di chuyển nhé!",
    testCases: [
      { input: "5", expected: "1 9", status: "IDLE", actual: "" },
    ],
    graph: {
      signature: "int main()",
      nodes: [
        {
          id: "q5_1",
          type: "start",
          content: "Start",
          x: 260,
          y: 35,
          bp: false,
        },
        {
          id: "q5_2",
          type: "process",
          content: "a = [9, 3, 7, 1, 5]; n = 5; i = 0",
          x: 260,
          y: 110,
          bp: false,
        },
        {
          id: "q5_3",
          type: "decision",
          content: "i < n - 1",
          x: 260,
          y: 190,
          bp: false,
        },
        {
          id: "q5_4",
          type: "process",
          content: "j = 0",
          x: 260,
          y: 270,
          bp: false,
        },
        {
          id: "q5_5",
          type: "decision",
          content: "j < n - 1 - i",
          x: 260,
          y: 350,
          bp: false,
        },
        {
          id: "q5_6",
          type: "decision",
          content: "a[j] > a[j + 1]",
          x: 260,
          y: 435,
          bp: false,
        },
        {
          id: "q5_7",
          type: "process",
          content:
            "tmp = a[j]; idx2 = j + 1; val2 = a[idx2]; a[j] = val2; a[idx2] = tmp",
          x: 120,
          y: 520,
          bp: true,
        },
        {
          id: "q5_8",
          type: "process",
          content: "j++",
          x: 260,
          y: 605,
          bp: false,
        },
        {
          id: "q5_9",
          type: "process",
          content: "i++",
          x: 500,
          y: 350,
          bp: false,
        },
        {
          id: "q5_10",
          type: "output",
          content: "a[0]",
          x: 500,
          y: 190,
          bp: false,
        },
        {
          id: "q5_11",
          type: "output",
          content: "a[4]",
          x: 500,
          y: 270,
          bp: false,
        },
        {
          id: "q5_12",
          type: "end",
          content: "End",
          x: 500,
          y: 440,
          bp: false,
        },
      ],
      edges: [
        { id: "qe5_1", source: "q5_1", target: "q5_2" },
        { id: "qe5_2", source: "q5_2", target: "q5_3" },
        { id: "qe5_3", source: "q5_3", target: "q5_4", branch: "true" },
        { id: "qe5_4", source: "q5_4", target: "q5_5" },
        { id: "qe5_5", source: "q5_5", target: "q5_6", branch: "true" },
        { id: "qe5_6", source: "q5_6", target: "q5_7", branch: "true" },
        { id: "qe5_7", source: "q5_7", target: "q5_8" },
        { id: "qe5_8", source: "q5_6", target: "q5_8", branch: "false" },
        { id: "qe5_9", source: "q5_8", target: "q5_5" },
        { id: "qe5_10", source: "q5_5", target: "q5_9", branch: "false" },
        { id: "qe5_11", source: "q5_9", target: "q5_3" },
        {
          id: "qe5_12",
          source: "q5_3",
          target: "q5_10",
          branch: "false",
        },
        { id: "qe5_13", source: "q5_10", target: "q5_11" },
        { id: "qe5_14", source: "q5_11", target: "q5_12" },
      ],
    },
  },
};

let currentQuestKey = null;

function loadAlgorithmQuest(questKey) {
  const q = ALGORITHM_QUESTS[questKey];
  if (!q) return;
  currentQuestKey = questKey;
  pushHistoryState();
  stopAutoPlay();
  traceState.active = false;
  tleInfiniteNodeIds.clear();

  tabs["main"] = JSON.parse(JSON.stringify(q.graph));
  activeTab = "main";
  selectedNodeId = null;
  testCases = JSON.parse(JSON.stringify(q.testCases));

  const inpBox = document.getElementById("traceInputBox");
  if (inpBox) inpBox.value = q.defaultInput;

  const banner = document.getElementById("questBannerCard");
  const titleEl = document.getElementById("questBannerTitle");
  const descEl = document.getElementById("questBannerDesc");
  if (banner && titleEl && descEl) {
    titleEl.textContent = q.title;
    descEl.textContent = q.desc;
    banner.classList.remove("hidden");
  }

  renderTabs();
  renderAll();
  resetCameraView();
  bittoSay(
    `Đã nạp ${q.title}! Bấm Chạy Test hoặc từng bước để khám phá nhé!`,
    "happy",
    5000,
  );
}

function askCopilotQuestHint() {
  const q = ALGORITHM_QUESTS[currentQuestKey];
  toggleBittoCopilotChat(true);
  if (q) {
    appendBittoCopilotMessage(
      "ai",
      `🏆 **Gợi ý cho ${q.title}:**\n${q.hint}`,
    );
  } else {
    sendBittoQuickPrompt("Gợi ý thuật toán bài này");
  }
}
