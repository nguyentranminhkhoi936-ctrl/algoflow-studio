// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/codegen.js
// Mô tả: Động cơ suy luận kiểu dữ liệu và sinh mã nguồn đa ngôn ngữ:
//        C++17/C++20 chuẩn giáo dục (generateFullCpp), C (generateFullC),
//        Python 3 (generateFullPython), Mermaid.js (generateMermaid),
//        LaTeX TikZ (generateTikZ), cùng trình soạn thảo VS Code IDE & Scanner.
// ============================================================================

function inferGraphVariableTypes(graph) {
  const { nodes } = graph;
  const varTypes = {};
  const arrayVars = new Set();
  let needsStringInclude = false;
  let needsCmathInclude = false;

  const paramVars = new Set();
  if (graph.signature && !graph.signature.includes("main(")) {
    const paramPart = graph.signature.match(/\((.*?)\)/)?.[1] || "";
    paramPart
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => {
        const m = p.match(/([a-zA-Z_]\w*)\s*$/);
        if (m) paramVars.add(m[1]);
      });
  }

  const priority = { int: 1, bool: 2, double: 3, string: 4 };
  function setType(v, t) {
    if (!v || paramVars.has(v) || arrayVars.has(v)) return;
    const curr = varTypes[v];
    if (!curr || priority[t] > priority[curr]) varTypes[v] = t;
  }

  nodes.forEach((n) => {
    if (n.type === "input") {
      n.content
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((v) => {
          const base = v.replace(/\[.*\]$/, "").trim();
          if (base) setType(base, "int");
        });
    } else if (n.type === "process" || n.type === "subroutine") {
      n.content
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((stmt) => {
          const arrMatch = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*\[(.*)\]$/);
          if (arrMatch) {
            arrayVars.add(arrMatch[1]);
            delete varTypes[arrMatch[1]];
            return;
          }
          const incMatch = stmt.match(/^\s*([a-zA-Z_]\w*)\s*(\+\+|--)/);
          if (incMatch) {
            setType(incMatch[1], "int");
            return;
          }
          const assignMatch = stmt.match(
            /^([a-zA-Z_]\w*)(?:\s*\[.*?\])?\s*([+\-*/]?=)\s*(.+)$/,
          );
          if (assignMatch) {
            const lhs = assignMatch[1];
            const rhs = assignMatch[3].trim();
            if (/"(?:\\.|[^"\\])*"/.test(rhs)) {
              setType(lhs, "string");
              needsStringInclude = true;
            } else if (
              /^(true|false)$/.test(rhs) ||
              /\b(true|false)\b/.test(rhs) ||
              /(==|!=|<=|>=|&&|\|\|)/.test(rhs)
            ) {
              if (/\?.*:/.test(rhs) && !/\b(true|false)\b/.test(rhs))
                setType(lhs, "int");
              else setType(lhs, "bool");
            } else if (
              /\b\d+\.\d+\b/.test(rhs) ||
              /\b(sqrt|sin|cos|tan|pow|log|exp|fabs|ceil)\s*\(/.test(rhs)
            ) {
              setType(lhs, "double");
              if (/\b(sqrt|sin|cos|tan|pow|log|exp|fabs|ceil)\s*\(/.test(rhs))
                needsCmathInclude = true;
            } else {
              const rhsTokens = rhs.match(/[a-zA-Z_]\w*/g) || [];
              const hasDoubleDep = rhsTokens.some(
                (tok) => varTypes[tok] === "double",
              );
              setType(lhs, hasDoubleDep ? "double" : "int");
            }
          }
        });
    }
  });

  return { varTypes, arrayVars, needsStringInclude, needsCmathInclude };
}

function formatProcessStatementToCpp(stmt) {
  const arrMatch = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*\[(.*)\]$/);
  if (arrMatch) {
    const arrName = arrMatch[1];
    const rawElems = arrMatch[2]
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    let elemType = "int";
    if (rawElems.some((e) => /"(?:\\.|[^"\\])*"/.test(e))) elemType = "string";
    else if (rawElems.some((e) => /\b\d+\.\d+\b/.test(e))) elemType = "double";
    else if (rawElems.some((e) => /^(true|false)$/.test(e))) elemType = "bool";
    return `${elemType} ${arrName}[${rawElems.length}] = {${rawElems.join(", ")}};`;
  }
  return `${stmt.replace(/Math\.floor\((.*?)\)/g, "$1")};`;
}

function switchOutTab(tab) {
  activeOutputTab = tab;
  ["cpp", "c", "python", "mermaid", "tikz"].forEach((t) => {
    const btn = document.getElementById("outTab_" + t);
    if (btn) {
      btn.className =
        t === tab
          ? "px-2.5 py-1 rounded bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 font-bold"
          : "px-2 py-1 rounded text-slate-400 hover:bg-[#1b2033]";
    }
  });
  compileAll();
}

function compileAll() {
  const box = document.getElementById("codeOutputBox");
  if (!box) return;
  let outText = "";
  if (activeOutputTab === "cpp") outText = generateFullCpp();
  else if (activeOutputTab === "c") outText = generateFullC();
  else if (activeOutputTab === "python") outText = generateFullPython();
  else if (activeOutputTab === "mermaid")
    outText = generateMermaid(currGraph());
  else outText = generateTikZ(currGraph());
  ideSetText(outText);
}

function generateFullCpp() {
  let anyString = false;
  let anyCmath = false;
  Object.values(tabs).forEach((g) => {
    const info = inferGraphVariableTypes(g);
    if (info.needsStringInclude) anyString = true;
    if (info.needsCmathInclude) anyCmath = true;
  });

  let out = `// ============================================================================\n// 🏛 AlgoFlow Studio v5.4 • Official Brand Export (The Living Algorithm City)\n// ============================================================================\n#include <iostream>\n`;
  if (anyString) out += `#include <string>\n`;
  if (anyCmath) out += `#include <cmath>\n`;
  out += `using namespace std;\n\n`;

  cppLineIndex = {};
  let lineOff = out.split("\n").length - 1;
  const addBlock = (name) => {
    const blk = compileTabToCpp(tabs[name]);
    const m = cppLineMaps.get(tabs[name]) || {};
    const abs = {};
    Object.keys(m).forEach((k) => (abs[k] = m[k].map((x) => x + lineOff)));
    cppLineIndex[name] = abs;
    lineOff += blk.split("\n").length + 1;
    return blk;
  };
  Object.keys(tabs)
    .filter((k) => k !== "main")
    .forEach((fnName) => {
      out += addBlock(fnName) + `\n\n`;
    });
  if (tabs["main"]) out += addBlock("main");
  return out;
}

function compileTabToCpp(graph) {
  const { nodes, edges } = graph;
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const backIds = detectBackEdges(nodes, edges);

  const whileHeaders = {};
  const doWhileHeaders = {};
  edges
    .filter((e) => backIds.has(e.id))
    .forEach((e) => {
      const targetNode = nodeMap[e.target];
      const sourceNode = nodeMap[e.source];
      const isContinueEdge =
        sourceNode && sourceNode.content.trim() === "continue";
      if (targetNode && targetNode.type === "decision") {
        if (!whileHeaders[e.target] || !isContinueEdge) {
          whileHeaders[e.target] = e.source;
        }
      } else if (targetNode && sourceNode && sourceNode.type === "decision") {
        doWhileHeaders[e.target] = e.source;
      }
    });

  const lines = [`${graph.signature || "int main()"} {`];
  // --- v5.1: ghi nhận dòng C++ của từng khối (Sync Highlight) ---
  const owned = {},
    lineOwner = [];
  let emitting = null,
    po_ = null;
  const mark = (nid, i) => {
    if (nid) owned[nid] = [i];
  };
  const _push = lines.push.bind(lines);
  lines.push = (str) => {
    const i = lines.length;
    _push(str);
    lineOwner[i] = emitting;
    if (emitting) (owned[emitting] = owned[emitting] || []).push(i);
    return lines.length;
  };
  const popLine = () => {
    const i = lines.length - 1,
      o = lineOwner[i];
    if (o && owned[o]) owned[o].pop();
    lineOwner.length = i;
    lines.pop();
    return o;
  };
  const { varTypes } = inferGraphVariableTypes(graph);
  const grouped = { int: [], double: [], string: [], bool: [] };
  Object.entries(varTypes).forEach(([vName, vType]) => {
    if (grouped[vType]) grouped[vType].push(vName);
  });

  const declLines = [];
  ["int", "double", "string", "bool"].forEach((t) => {
    if (grouped[t].length > 0)
      declLines.push(`    ${t} ${grouped[t].join(", ")};`);
  });
  if (declLines.length > 0) lines.push(declLines.join("\n") + "\n");

  const optFor = document.getElementById("optForToggle")?.checked ?? true;
  const visited = new Set();
  const activeDoWhileHeaders = new Set();

  function walk(id, stopId, indent, currentLoopHeaderId = null) {
    const saved = emitting;
    emitting = id;
    try {
      return walkInner(id, stopId, indent, currentLoopHeaderId);
    } finally {
      emitting = saved;
    }
  }
  function walkInner(id, stopId, indent, currentLoopHeaderId = null) {
    if (!id || id === stopId || visited.has(id)) return;
    const node = nodeMap[id];
    if (!node) return;

    if (node.type === "end" || node.type === "return") {
      const raw = node.content.trim();
      const ret = raw.startsWith("return")
        ? raw
        : node.type === "return"
          ? `return ${raw || 0}`
          : "return 0";
      lines.push(`${indent}${ret};`);
      return;
    }

    if (node.type === "connector") {
      visited.add(id);
      const nextEdge = edges.find((e) => e.source === id && !backIds.has(e.id));
      if (nextEdge) walk(nextEdge.target, stopId, indent, currentLoopHeaderId);
      return;
    }

    if (doWhileHeaders[id] && !activeDoWhileHeaders.has(id)) {
      const footerDecId = doWhileHeaders[id];
      const footerDecNode = nodeMap[footerDecId];
      activeDoWhileHeaders.add(id);
      emitting = null;
      lines.push(`${indent}do {`);
      emitting = id;
      walk(id, footerDecId, indent + "    ", id);
      const cleanCond = footerDecNode
        ? footerDecNode.content.replace(/Math\.floor\((.*?)\)/g, "$1")
        : "true";
      emitting = null;
      lines.push(`${indent}} while (${cleanCond});`);
      mark(footerDecId, lines.length - 1);
      emitting = id;
      visited.add(footerDecId);
      const fEdge = edges.find(
        (e) => e.source === footerDecId && e.branch === "false",
      );
      if (fEdge) walk(fEdge.target, stopId, indent, currentLoopHeaderId);
      return;
    }

    if (node.type === "decision") {
      const tEdge = edges.find((e) => e.source === id && e.branch === "true");
      const fEdge = edges.find((e) => e.source === id && e.branch === "false");
      const cleanCond = node.content.replace(/Math\.floor\((.*?)\)/g, "$1");

      if (whileHeaders[id]) {
        visited.add(id);
        const latchId = whileHeaders[id];
        const latchNode = nodeMap[latchId];
        const prevLine = lines[lines.length - 1] || "";
        const varMatch = cleanCond.match(/^([a-zA-Z_]\w*)/);
        const loopVar = varMatch ? varMatch[1] : null;

        if (
          optFor &&
          loopVar &&
          latchNode &&
          latchNode.type === "process" &&
          latchNode.content.includes(loopVar) &&
          prevLine.includes(`${loopVar} =`)
        ) {
          po_ = popLine();
          const initPart = prevLine.trim().replace(/;$/, "");
          lines.push(
            `${indent}for (${initPart}; ${cleanCond}; ${latchNode.content.trim()}) {`,
          );
          visited.add(latchId);
          if (po_) (owned[po_] = owned[po_] || []).push(lines.length - 1);
          mark(latchId, lines.length - 1);
          if (tEdge) walk(tEdge.target, id, indent + "    ", id);
          lines.push(`${indent}}`);
        } else {
          lines.push(`${indent}while (${cleanCond}) {`);
          if (tEdge) walk(tEdge.target, id, indent + "    ", id);
          lines.push(`${indent}}`);
        }
        if (fEdge) walk(fEdge.target, stopId, indent, currentLoopHeaderId);
        return;
      } else {
        visited.add(id);
        const tTarget = tEdge ? tEdge.target : null;
        const fTarget = fEdge ? fEdge.target : null;
        const mergeNodeId = findMergeNode(
          tTarget,
          fTarget,
          currentLoopHeaderId,
          graph,
        );
        const branchStopId = mergeNodeId || stopId;

        // Check if true branch directly executes a jump (break, continue, return)
        const tNode = tTarget ? nodeMap[tTarget] : null;
        const tTrim = tNode ? tNode.content.trim() : "";
        const tIsJump =
          tNode &&
          (tNode.type === "return" ||
            tTrim === "break" ||
            tTrim === "continue");

        lines.push(`${indent}if (${cleanCond}) {`);
        if (tTarget && tTarget !== branchStopId)
          walk(
            tEdge.target,
            branchStopId,
            indent + "    ",
            currentLoopHeaderId,
          );
        if (
          !tIsJump &&
          fTarget &&
          fTarget !== mergeNodeId &&
          fTarget !== stopId
        ) {
          lines.push(`${indent}} else {`);
          walk(
            fEdge.target,
            branchStopId,
            indent + "    ",
            currentLoopHeaderId,
          );
        }
        lines.push(`${indent}}`);
        if (tIsJump && fTarget && fTarget !== stopId) {
          walk(fTarget, stopId, indent, currentLoopHeaderId);
        } else if (mergeNodeId && mergeNodeId !== stopId) {
          walk(mergeNodeId, stopId, indent, currentLoopHeaderId);
        }
        return;
      }
    }

    visited.add(id);
    const trimmedContent = node.content.trim();
    if (trimmedContent === "break" || trimmedContent === "continue") {
      lines.push(`${indent}${trimmedContent};`);
      return;
    }
    if (node.type === "input") {
      const vs = node.content
        .split(",")
        .map((s) => s.trim())
        .join(" >> ");
      lines.push(`${indent}cin >> ${vs};`);
    } else if (node.type === "output") {
      lines.push(`${indent}cout << ${node.content} << endl;`);
    } else if (node.type === "process" || node.type === "subroutine") {
      node.content
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((stmt) => {
          lines.push(`${indent}${formatProcessStatementToCpp(stmt)}`);
        });
    }

    const nextEdge = edges.find((e) => e.source === id && !backIds.has(e.id));
    if (nextEdge) walk(nextEdge.target, stopId, indent, currentLoopHeaderId);
  }

  const start = nodes.find((n) => n.type === "start");
  if (start) {
    const first = edges.find((e) => e.source === start.id);
    if (first) walk(first.target, null, "    ", null);
  }
  lines.push(`}`);
  const starts = [];
  let acc = 0;
  lines.forEach((l, i) => {
    starts[i] = acc;
    acc += l.split("\n").length;
  });
  const lmap = {};
  Object.keys(owned).forEach((k) => (lmap[k] = owned[k].map((i) => starts[i])));
  if (start) lmap[start.id] = [0];
  cppLineMaps.set(graph, lmap);
  return lines.join("\n");
}

function generateMermaid(graph) {
  let m = `flowchart TD\n`;
  graph.nodes.forEach((n) => {
    const c = n.content.replace(/"/g, "'");
    if (n.type === "start" || n.type === "end" || n.type === "return")
      m += `    ${n.id}(["${c}"])\n`;
    else if (n.type === "input" || n.type === "output")
      m += `    ${n.id}[/"${c}"/]\n`;
    else if (n.type === "decision") m += `    ${n.id}{"${c}"}\n`;
    else if (n.type === "subroutine") m += `    ${n.id}[["${c}"]]\n`;
    else if (n.type === "connector") m += `    ${n.id}(("${c}"))\n`;
    else m += `    ${n.id}["${c}"]\n`;
  });
  graph.edges.forEach((e) => {
    const lbl = e.branch ? `|${e.branch === "true" ? "True" : "False"}|` : "";
    m += `    ${e.source} -->${lbl} ${e.target}\n`;
  });
  return m;
}

function generateTikZ(graph) {
  let t = `\\begin{tikzpicture}[node distance=1.5cm, auto]\n`;
  graph.nodes.forEach((n) => {
    const pos = `(${(n.x / 100).toFixed(1)}, -${(n.y / 100).toFixed(1)})`;
    t += `  \\node[draw, rounded corners] (${n.id}) at ${pos} {\\texttt{${n.content.replace(/%/g, "\\%")}}};\n`;
  });
  graph.edges.forEach((e) => {
    const lbl = e.branch ? ` node {${e.branch}}` : "";
    t += `  \\draw[->] (${e.source}) --${lbl} (${e.target});\n`;
  });
  t += `\\end{tikzpicture}`;
  return t;
}

function copyOutputCode() {
  const text = document.getElementById("codeOutputBox").value;
  const btn = document.getElementById("btnCopyCode");
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch (e) {}
  document.body.removeChild(ta);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "✓ Đã Copy!";
    setTimeout(() => (btn.textContent = orig), 1200);
  }
}

// ---------- Tính năng 3: IDE C++ ----------
let ideDirty = false,
  ideBase = "",
  ideStash = null;
const ide = () => $id("codeOutputBox");

function ideBadge() {
  const el = $id("ideSyncBadge");
  if (!el) return;
  const cpp = activeOutputTab === "cpp";
  el.textContent = !cpp
    ? "chỉ đọc"
    : ideDirty
      ? "● đã sửa, chưa đồng bộ"
      : "✓ đồng bộ với 3D";
  el.style.color = ideDirty && cpp ? "#facc15" : "#64748b";
}
function ideRefreshGutter() {
  const ta = ide(),
    g = $id("ideGutter");
  const n = ta.value.split("\n").length;
  if (g.dataset.n !== String(n)) {
    g.dataset.n = n;
    g.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  }
  g.scrollTop = ta.scrollTop;
  ideUpdateHL();
}
function ideSetText(text) {
  const ta = ide(),
    cpp = activeOutputTab === "cpp";
  ta.readOnly = !cpp;
  $id("ideToolbar")
    .querySelectorAll("button:not(#btnCopyCode)")
    .forEach((b) => (b.style.display = cpp ? "" : "none"));
  if (!cpp) {
    if (ideDirty) {
      ideStash = ta.value;
      ideDirty = false;
    }
    if (ta.value !== text) ta.value = text;
  } else {
    if (ideStash !== null) {
      const st = ideStash;
      ideStash = null;
      if (text === ideBase) {
        ta.value = st;
        ideDirty = true;
        ideBadge();
        ideRefreshGutter();
        return;
      }
    }
    if (ideDirty && text === ideBase) {
      ideRefreshGutter();
      return;
    } // sơ đồ chưa đổi: giữ phần người dùng đang gõ
    ideDirty = false;
    ideBase = text;
    if (ta.value !== text) ta.value = text;
  }
  ideBadge();
  ideRefreshGutter();
}
function ideUpdateHL() {
  const hl = $id("ideHL"),
    ta = ide();
  if (!hl) return;
  let range = null;
  if (
    activeOutputTab === "cpp" &&
    !ideDirty &&
    traceState.active &&
    traceState.currNodeId
  ) {
    const node = currGraph()?.nodes.find((n) => n.id === traceState.currNodeId);
    const ls = cppLineIndex[activeTab]?.[traceState.currNodeId];
    if (node && ls && ls.length)
      range =
        node.type === "decision" ? [ls[0], ls[0]] : [ls[0], ls[ls.length - 1]];
  }
  if (!range) {
    hl.style.display = "none";
    return;
  }
  const top = 10 + range[0] * 18 - ta.scrollTop;
  if (top < 0 || top > ta.clientHeight - 24) {
    ta.scrollTop = Math.max(0, range[0] * 18 - ta.clientHeight / 2);
    return;
  } // cuộn → sự kiện scroll gọi lại hàm này
  hl.style.display = "block";
  hl.style.top = top + "px";
  hl.style.height = (range[1] - range[0] + 1) * 18 + "px";
}
function ideInit() {
  const ta = ide();
  ta.addEventListener("input", () => {
    if (activeOutputTab === "cpp") {
      ideDirty = ta.value !== ideBase;
      ideBadge();
    }
    ideRefreshGutter();
  });
  ta.addEventListener("scroll", () => {
    $id("ideGutter").scrollTop = ta.scrollTop;
    ideUpdateHL();
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !ta.readOnly) {
      e.preventDefault();
      ta.setRangeText("    ", ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      ideSyncAndAutoRun();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      ideRunCode();
    }
  });
}

// ---------- FEATURE 4: VS Code IDE Theme, Live Syntax Highlighting, Active Line, Autocomplete & Terminal Error Scanner ----------
const CPP_KEYWORDS_SET = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "return",
  "break",
  "continue",
  "switch",
  "case",
  "default",
  "using",
  "namespace",
  "include",
]);
const CPP_TYPES_SET = new Set([
  "int",
  "double",
  "float",
  "string",
  "bool",
  "void",
  "long",
  "char",
  "std",
  "cin",
  "cout",
  "endl",
]);

function switchIdeTheme(themeName) {
  const container = document.getElementById("idePanelContainer");
  if (!container) return;
  container.classList.remove("ide-theme-tokyonight", "ide-theme-onedark");
  if (themeName === "onedark") {
    container.classList.add("ide-theme-onedark");
  } else {
    container.classList.add("ide-theme-tokyonight");
  }
  renderIdeSyntaxHighlight();
}

function toggleIdeCollapse() {
  const container = document.getElementById("idePanelContainer");
  const btn = document.getElementById("btnIdeCollapse");
  if (!container) return;
  const collapsed = container.classList.toggle("ide-collapsed");
  if (btn) btn.textContent = collapsed ? "▴ Mở IDE" : "▾ Thu gọn";
}

function toggleIdeFullscreen() {
  const container = document.getElementById("idePanelContainer");
  const btn = document.getElementById("btnIdeFullscreen");
  if (!container) return;
  const isFull = container.classList.toggle("ide-fullscreen");
  if (btn) btn.textContent = isFull ? "🗗 Thu nhỏ" : "⛶ Fullscreen";
  setTimeout(ideRefreshGutter, 50);
}

function toggleTerminalCollapse() {
  const panel = document.getElementById("terminalConsolePanel");
  const btn = document.getElementById("btnToggleTerminalCollapse");
  if (!panel) return;
  const collapsed = panel.classList.toggle("term-collapsed");
  if (btn) btn.textContent = collapsed ? "▴" : "▾";
}

function toggleTerminalFullscreen() {
  const panel = document.getElementById("terminalConsolePanel");
  const btn = document.getElementById("btnToggleTerminalFullscreen");
  if (!panel) return;
  const isFull = panel.classList.toggle("term-fullscreen");
  if (btn) btn.textContent = isFull ? "🗗" : "⛶";
}

function highlightCppCodeToHtml(rawCode) {
  if (!rawCode) return "";
  // Tokenize line by line preserving exact whitespace and character positions
  const lines = rawCode.split("\n");
  const tokenRegex =
    /(\/\/.*$|^\s*#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_]\w*\b|[+\-*/%=<>!&|]+|[(){}\[\];,])/gm;

  return (
    lines
      .map((line) => {
        let result = "";
        let lastIdx = 0;
        let match;
        tokenRegex.lastIndex = 0;
        const hasDivZero = /[\/%]\s*0\b/.test(line);

        while ((match = tokenRegex.exec(line)) !== null) {
          if (match.index > lastIdx) {
            result += escapeHtml(line.slice(lastIdx, match.index));
          }
          const tok = match[0];
          const esc = escapeHtml(tok);
          if (tok.startsWith("//")) {
            result += `<span class="tok-cmt">${esc}</span>`;
          } else if (tok.trim().startsWith("#")) {
            result += `<span class="tok-kw">${esc}</span>`;
          } else if (tok.startsWith('"') || tok.startsWith("'")) {
            result += `<span class="tok-str">${esc}</span>`;
          } else if (/^\d/.test(tok)) {
            result += `<span class="tok-num">${esc}</span>`;
          } else if (CPP_KEYWORDS_SET.has(tok)) {
            result += `<span class="tok-kw">${esc}</span>`;
          } else if (CPP_TYPES_SET.has(tok)) {
            result += `<span class="tok-type">${esc}</span>`;
          } else if (/^[a-zA-Z_]\w*$/.test(tok)) {
            const after = line.slice(match.index + tok.length).trimStart();
            if (after.startsWith("(")) {
              result += `<span class="tok-fn">${esc}</span>`;
            } else {
              result += esc;
            }
          } else if (/^[+\-*/%=<>!&|]+$/.test(tok)) {
            result += `<span class="tok-op">${esc}</span>`;
          } else {
            result += esc;
          }
          lastIdx = match.index + tok.length;
        }
        if (lastIdx < line.length) {
          result += escapeHtml(line.slice(lastIdx));
        }
        if (hasDivZero) {
          return `<span class="tok-err" title="Cảnh báo: Chia cho 0 (Division by Zero)">${result}</span>`;
        }
        return result;
      })
      .join("\n") + "\n"
  );
}

function renderIdeSyntaxHighlight() {
  const ta = document.getElementById("codeOutputBox");
  const layer = document.getElementById("ideSyntaxHighlightLayer");
  if (!ta || !layer) return;
  layer.innerHTML = highlightCppCodeToHtml(ta.value);
  layer.scrollTop = ta.scrollTop;
  layer.scrollLeft = ta.scrollLeft;
  updateIdeActiveLineAndCursor();
}

function updateIdeActiveLineAndCursor() {
  const ta = document.getElementById("codeOutputBox");
  const activeHL = document.getElementById("ideActiveLineHL");
  const statusPos = document.getElementById("ideCursorPosText");
  if (!ta) return;
  const pos = ta.selectionStart || 0;
  const before = ta.value.slice(0, pos);
  const linesBefore = before.split("\n");
  const lineIndex = linesBefore.length - 1;
  const colIndex = linesBefore[linesBefore.length - 1].length + 1;

  if (statusPos) {
    statusPos.textContent = `Ln ${lineIndex + 1}, Col ${colIndex} • Fira Code`;
  }
  if (activeHL) {
    const topPx = 10 + lineIndex * 18 - ta.scrollTop;
    if (topPx < -18 || topPx > ta.clientHeight) {
      activeHL.style.display = "none";
    } else {
      activeHL.style.display = "block";
      activeHL.style.top = `${topPx}px`;
    }
  }
}

// VS Code IntelliSense Autocomplete Helper
const IDE_COMPLETION_ITEMS = [
  { label: "cin >> ", detail: "istream input" },
  { label: "cout << ", detail: "ostream output" },
  { label: "for (int i = 1; i <= n; i++)", detail: "for loop snippet" },
  { label: "while (i <= n)", detail: "while loop" },
  { label: "if (n % i == 0)", detail: "conditional branch" },
  { label: "return 0;", detail: "exit function" },
  { label: "endl", detail: "newline flush" },
  { label: "int ", detail: "32-bit integer" },
  { label: "double ", detail: "floating point" },
  { label: "string ", detail: "std::string" },
  { label: "bool ", detail: "boolean" },
];

function updateIdeAutocomplete() {
  const ta = document.getElementById("codeOutputBox");
  const popup = document.getElementById("ideAutocompletePopup");
  if (!ta || !popup || ta.readOnly) return;

  const pos = ta.selectionStart || 0;
  const before = ta.value.slice(0, pos);
  const wordMatch = before.match(/([a-zA-Z_]\w*)$/);
  if (!wordMatch || wordMatch[1].length < 2) {
    popup.classList.add("hidden");
    return;
  }
  const prefix = wordMatch[1].toLowerCase();
  const matches = IDE_COMPLETION_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().startsWith(prefix) &&
      item.label.toLowerCase().trim() !== prefix,
  );
  if (matches.length === 0) {
    popup.classList.add("hidden");
    return;
  }

  const linesBefore = before.split("\n");
  const lineIdx = linesBefore.length - 1;
  const colIdx = linesBefore[linesBefore.length - 1].length;
  const topPx = Math.min(
    ta.clientHeight - 60,
    Math.max(24, 28 + lineIdx * 18 - ta.scrollTop),
  );
  const leftPx = Math.min(
    ta.clientWidth - 195,
    Math.max(12, 12 + colIdx * 7.2 - ta.scrollLeft),
  );

  popup.style.top = `${Math.round(topPx)}px`;
  popup.style.left = `${Math.round(leftPx)}px`;
  popup.innerHTML = matches
    .slice(0, 5)
    .map(
      (m, i) => `
    <div
      class="ac-item ${i === 0 ? "ac-active" : ""}"
      onmousedown="event.preventDefault(); applyIdeAutocomplete('${m.label.replace(/'/g, "\'")}', '${wordMatch[1]}')"
    >
      <span class="font-bold text-cyan-300">${escapeHtml(m.label)}</span>
      <span class="text-[9px] text-slate-400 ml-2">${escapeHtml(m.detail)}</span>
    </div>
  `,
    )
    .join("");
  popup.classList.remove("hidden");
}

function applyIdeAutocomplete(insertion, prefixWord) {
  const ta = document.getElementById("codeOutputBox");
  const popup = document.getElementById("ideAutocompletePopup");
  if (!ta) return;
  const pos = ta.selectionStart || 0;
  const startPos = pos - prefixWord.length;
  ta.setRangeText(insertion, startPos, pos, "end");
  if (popup) popup.classList.add("hidden");
  ta.dispatchEvent(new Event("input"));
  ta.focus();
}

// Real-Time Terminal Semantic Error Scanner & Glowing Red Diagnostics
function runTerminalSemanticScanner(announceIfClean = false) {
  const diagBox = document.getElementById("terminalDiagnosticsBox");
  const errBadge = document.getElementById("terminalErrorCountBadge");
  const ideLintText = document.getElementById("ideLinterStatusText");
  const stdoutEl = document.getElementById("stdoutBox");
  const ta = document.getElementById("codeOutputBox");
  if (!diagBox) return [];

  const errors = [];
  const codeStr = ta ? ta.value : "";

  // 1. Check Static Graph Linter Warnings (Uninitialized variables & Dead Code)
  const lint = window.__lastLint;
  if (lint && Array.isArray(lint.warnings)) {
    lint.warnings.forEach((w) => {
      errors.push(`[LINTER] ${w.msg}`);
    });
  }

  // 2. Check Division / Modulo by Zero in Code or Flowchart Nodes
  if (/[\/%]\s*0(?![.\d])/.test(codeStr)) {
    errors.push(
      "[RUNTIME RISK] Phát hiện phép chia cho 0 (/ 0 hoặc % 0) trong mã C++!",
    );
  }
  const g = currGraph();
  if (g && Array.isArray(g.nodes)) {
    g.nodes.forEach((n) => {
      if (/[\/%]\s*0(?![.\d])/.test(n.content)) {
        errors.push(
          `[ZERO DIV] Khối [${n.content}] chứa phép chia cho 0 nguy hiểm!`,
        );
      }
    });
  }

  // 3. Check Infinite Loop Risks (while(true) / while(1) without break/return)
  if (
    /while\s*\(\s*(true|1)\s*\)/.test(codeStr) &&
    !/\b(break|return)\b/.test(codeStr)
  ) {
    errors.push(
      "[INFINITE LOOP] Vòng lặp while(true) không có lệnh thoát (break/return)!",
    );
  }

  // 4. Check Testbench Failures or TLE
  if (Array.isArray(testCases)) {
    testCases.forEach((tc, i) => {
      if (tc.status === "FAIL") {
        errors.push(
          `[TEST #${i + 1} FAIL] Input(${tc.input}) kỳ vọng '${tc.expected}' nhưng ra '${tc.actual}'.`,
        );
      } else if (tc.status === "TLE") {
        errors.push(
          `[TEST #${i + 1} TLE] Vượt quá 2500 bước — Nghi ngờ vòng lặp vô hạn!`,
        );
      }
    });
  }

  // 5. Check if stdout itself contains error / TLE messages
  if (stdoutEl && /(Lỗi dịch mã|TLE:|FAIL)/i.test(stdoutEl.textContent)) {
    stdoutEl.classList.remove("text-emerald-400");
    stdoutEl.classList.add("text-rose-400", "font-bold", "terminal-error-glow");
  } else if (stdoutEl) {
    stdoutEl.classList.remove(
      "text-rose-400",
      "font-bold",
      "terminal-error-glow",
    );
    stdoutEl.classList.add("text-emerald-400");
  }

  if (errors.length > 0) {
    diagBox.classList.remove("hidden");
    diagBox.innerHTML = errors
      .map(
        (err) =>
          `<div class="text-rose-400 font-bold terminal-error-glow flex items-start gap-1"><span>✖</span><span>${escapeHtml(err)}</span></div>`,
      )
      .join("");
    if (errBadge) {
      errBadge.textContent = `${errors.length} lỗi`;
      errBadge.classList.remove("hidden");
    }
    if (ideLintText) {
      ideLintText.textContent = `⚠ ${errors.length} phát hiện lỗi logic`;
      ideLintText.className = "text-rose-400 font-bold";
    }
  } else {
    if (announceIfClean) {
      diagBox.classList.remove("hidden");
      diagBox.innerHTML = `<div class="text-emerald-400 font-semibold">✓ Quét hoàn tất: Không phát hiện lỗi chia 0, biến rác hay vòng lặp vô hạn.</div>`;
      setTimeout(() => {
        if (
          document
            .getElementById("terminalErrorCountBadge")
            ?.classList.contains("hidden")
        ) {
          diagBox.classList.add("hidden");
        }
      }, 3200);
    } else {
      diagBox.classList.add("hidden");
      diagBox.innerHTML = "";
    }
    if (errBadge) errBadge.classList.add("hidden");
    if (ideLintText) {
      ideLintText.textContent = "✓ C++17 • 0 lỗi ngữ nghĩa";
      ideLintText.className = "text-emerald-400";
    }
  }
  return errors;
}

// Hook IDE refresh & renderAll to keep syntax highlight and semantic error scanner live
const _v52IdeRefreshGutter = ideRefreshGutter;
ideRefreshGutter = function () {
  _v52IdeRefreshGutter();
  renderIdeSyntaxHighlight();
  runTerminalSemanticScanner(false);
};

// =========================================================================
// GÓI 4: CHUYỂN ĐỔI SƠ ĐỒ KHỐI SANG C++ CHUẨN GIÁO DỤC (KÈM C VÀ PYTHON)
// - Bộ sinh mã C++17/C++20 chuẩn giáo dục, thụt lề 4 dấu cách, có chú thích giải thích từng dòng lệnh
// - Khối Nhập -> cout << "Nhap ...: "; cin >> ...;
// - Khối Xuất -> cout << ... << endl;
// - Khối Điều kiện -> if (...) / else hoặc while (...), do ... while (...), for (...)
// - Hỗ trợ đầy đủ 5 tab: [C++], [C], [Python], [Mermaid], [TikZ]
// =========================================================================
switchOutTab = function (tab) {
  activeOutputTab = tab;
  ["cpp", "c", "python", "mermaid", "tikz"].forEach((t) => {
    const btn = document.getElementById("outTab_" + t);
    if (btn) {
      btn.className =
        t === tab
          ? "px-2.5 py-1 rounded bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 font-bold"
          : "px-2 py-1 rounded text-slate-400 hover:bg-[#1b2033]";
    }
  });
  const fileLbl = document.getElementById("ideFileNameLabel");
  if (fileLbl) {
    const mapName = {
      cpp: "main.cpp • C++20 Giáo Dục",
      c: "main.c • Chuẩn C99/C11",
      python: "main.py • Python 3",
      mermaid: "flowchart.mmd • Mermaid",
      tikz: "flowchart.tex • LaTeX TikZ",
    };
    fileLbl.textContent = mapName[tab] || "main.cpp • VS Code IDE";
  }
  compileAll();
};

// Ghi đè compileTabToCpp để bổ sung chú thích sư phạm từng dòng và lệnh nhắc nhập liệu thân thiện cho người mới học C++
const _v5CompileTabToCpp = compileTabToCpp;
compileTabToCpp = function (graph) {
  const rawCpp = _v5CompileTabToCpp(graph);
  // Nâng cấp từng dòng lệnh C++ với chú thích giải thích sư phạm và câu nhắc nhập liệu
  const lines = rawCpp.split("\n");
  const enhanced = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    const indentMatch = line.match(/^(\s*)/);
    const ind = indentMatch ? indentMatch[1] : "";

    if (
      /^(int|double|string|bool)\s+[a-zA-Z_]/.test(trimmed) &&
      !trimmed.includes("(") &&
      !trimmed.includes("=")
    ) {
      enhanced.push(`${line} // Khai báo các biến sử dụng trong thuật toán`);
    } else if (trimmed.startsWith("cin >> ")) {
      const varsStr = trimmed
        .replace(/^cin\s*>>\s*/, "")
        .replace(/;$/, "")
        .split(">>")
        .map((s) => s.trim())
        .join(", ");
      enhanced.push(`${ind}// Nhập dữ liệu đầu vào cho biến ${varsStr}`);
      enhanced.push(`${ind}cout << "Nhap ${varsStr}: ";`);
      enhanced.push(line);
    } else if (trimmed.startsWith("cout << ")) {
      enhanced.push(`${line} // Xuất kết quả ra màn hình`);
    } else if (trimmed.startsWith("for (")) {
      enhanced.push(
        `${line} // Vòng lặp for: khởi tạo; điều kiện lặp; bước nhảy`,
      );
    } else if (trimmed.startsWith("while (") && !trimmed.endsWith(";")) {
      enhanced.push(`${line} // Vòng lặp while: lặp khi điều kiện còn đúng`);
    } else if (trimmed.startsWith("do {")) {
      enhanced.push(
        `${line} // Vòng lặp do-while: thực hiện ít nhất 1 lần trước khi kiểm tra`,
      );
    } else if (trimmed.startsWith("if (")) {
      enhanced.push(
        `${line} // Rẽ nhánh có điều kiện: kiểm tra biểu thức logic`,
      );
    } else if (trimmed.startsWith("} else {")) {
      enhanced.push(`${line} // Nhánh ngược lại khi điều kiện if bị sai`);
    } else if (trimmed === "return 0;") {
      enhanced.push(`${line} // Kết thúc chương trình thành công`);
    } else {
      enhanced.push(line);
    }
  });
  return enhanced.join("\n");
};

// Bộ biên dịch Sơ đồ khối sang Ngôn ngữ C chuẩn giáo dục (stdio.h, scanf, printf)
function generateFullC() {
  let out = `// ============================================================================\n// 🏛 AlgoFlow Studio v6.0 • Mã Nguồn Ngôn Ngữ C Chuẩn Giáo Dục (C99/C11)\n// ============================================================================\n#include <stdio.h>\n#include <stdbool.h>\n#include <math.h>\n\n`;
  Object.keys(tabs)
    .filter((k) => k !== "main")
    .forEach((fnName) => {
      out += compileTabToC(tabs[fnName]) + "\n\n";
    });
  if (tabs["main"]) out += compileTabToC(tabs["main"]);
  return out;
}

function compileTabToC(graph) {
  const cppCode = _v5CompileTabToCpp(graph);
  const { varTypes } = inferGraphVariableTypes(graph);
  const lines = cppCode.split("\n");
  const cLines = [];

  lines.forEach((line) => {
    const ind = line.match(/^(\s*)/)?.[1] || "";
    const t = line.trim();
    if (t.startsWith("cin >> ")) {
      const vars = t
        .replace(/^cin\s*>>\s*/, "")
        .replace(/;$/, "")
        .split(">>")
        .map((s) => s.trim())
        .filter(Boolean);
      const fmt = vars
        .map((v) => (varTypes[v] === "double" ? "%lf" : "%d"))
        .join(" ");
      const refs = vars.map((v) => `&${v}`).join(", ");
      cLines.push(`${ind}// Nhập dữ liệu từ bàn phím bằng scanf`);
      cLines.push(`${ind}printf("Nhap ${vars.join(", ")}: ");`);
      cLines.push(`${ind}scanf("${fmt}", ${refs});`);
    } else if (t.startsWith("cout << ")) {
      const expr = t
        .replace(/^cout\s*<<\s*/, "")
        .replace(/\s*<<\s*endl\s*;$/, "")
        .replace(/;$/, "")
        .trim();
      const isDouble = varTypes[expr] === "double" || /\.\d+/.test(expr);
      const fmt = /^".*"$/.test(expr)
        ? "%s\\n"
        : isDouble
          ? "%.2f\\n"
          : "%d\\n";
      cLines.push(
        `${ind}printf("${fmt}", ${expr}); // Xuất kết quả ra màn hình`,
      );
    } else if (t.startsWith("string ")) {
      cLines.push(line.replace(/\bstring\b/, "char*"));
    } else {
      cLines.push(line);
    }
  });
  return cLines.join("\n");
}

// Bộ biên dịch Sơ đồ khối sang Ngôn ngữ Python 3 chuẩn giáo dục
function generateFullPython() {
  let out = `# ============================================================================\n# 🐍 AlgoFlow Studio v6.0 • Mã Nguồn Python 3 Trực Quan Cho Người Mới Bắt Đầu\n# ============================================================================\nimport math\n\n`;
  Object.keys(tabs)
    .filter((k) => k !== "main")
    .forEach((fnName) => {
      out += compileTabToPython(tabs[fnName], fnName) + "\n\n";
    });
  if (tabs["main"]) {
    out +=
      compileTabToPython(tabs["main"], "main") +
      '\n\nif __name__ == "__main__":\n    main()\n';
  }
  return out;
}

function compileTabToPython(graph, fnName = "main") {
  const cppCode = _v5CompileTabToCpp(graph);
  const rawLines = cppCode.split("\n");
  const pyLines = [];
  let indentLevel = 0;
  const pad = () => "    ".repeat(Math.max(0, indentLevel));

  const convertExprToPy = (ex) => {
    return ex
      .replace(/&&/g, "and")
      .replace(/\|\|/g, "or")
      .replace(/!(?!=)/g, "not ")
      .replace(/\btrue\b/g, "True")
      .replace(/\bfalse\b/g, "False")
      .replace(/Math\.floor\((.*?)\)/g, "int($1)");
  };

  const convertStmtToPy = (stmt) => {
    const s = stmt.replace(/;$/, "").trim();
    const inc = s.match(/^([a-zA-Z_]\w*)\s*\+\+$/);
    if (inc) return `${inc[1]} += 1`;
    const dec = s.match(/^([a-zA-Z_]\w*)\s*--$/);
    if (dec) return `${dec[1]} -= 1`;
    const arrDecl = s.match(
      /^(?:int|double|float|string|bool)\s+([a-zA-Z_]\w*)\s*\[\d*\]\s*=\s*\{(.*)\}$/,
    );
    if (arrDecl) return `${arrDecl[1]} = [${arrDecl[2]}]`;
    return convertExprToPy(s);
  };

  rawLines.forEach((line) => {
    const t = line.trim();
    if (!t) return;

    // Bỏ dòng khai báo kiểu dữ liệu thuần của C++
    if (/^(int|double|string|bool)\s+[a-zA-Z_][\w,\s]*;$/.test(t)) return;

    // Chuyển chữ ký hàm
    if (
      t.endsWith("{") &&
      !t.startsWith("if ") &&
      !t.startsWith("for ") &&
      !t.startsWith("while ") &&
      !t.startsWith("do ") &&
      !t.startsWith("} else")
    ) {
      const paramMatch = t.match(/\((.*?)\)/);
      const params =
        paramMatch && paramMatch[1]
          ? paramMatch[1]
              .split(",")
              .map((p) => p.trim().split(/\s+/).pop())
              .filter(Boolean)
              .join(", ")
          : "";
      pyLines.push(`${pad()}def ${fnName}(${params}):`);
      indentLevel++;
      return;
    }

    if (t === "}") {
      indentLevel = Math.max(0, indentLevel - 1);
      return;
    }

    if (t.startsWith("} while (")) {
      const cond = convertExprToPy(
        t.replace(/^\}\s*while\s*\((.*)\)\s*;$/, "$1"),
      );
      pyLines.push(`${pad()}if not (${cond}):`);
      pyLines.push(`${pad()}    break`);
      indentLevel = Math.max(0, indentLevel - 1);
      return;
    }

    if (t.startsWith("do {")) {
      pyLines.push(`${pad()}# Vòng lặp mô phỏng do-while trong Python`);
      pyLines.push(`${pad()}while True:`);
      indentLevel++;
      return;
    }

    if (t.startsWith("} else {")) {
      indentLevel = Math.max(0, indentLevel - 1);
      pyLines.push(`${pad()}else:`);
      indentLevel++;
      return;
    }

    if (t.startsWith("if (")) {
      const cond = convertExprToPy(t.replace(/^if\s*\((.*)\)\s*\{$/, "$1"));
      pyLines.push(`${pad()}if ${cond}:`);
      indentLevel++;
      return;
    }

    if (t.startsWith("while (")) {
      const cond = convertExprToPy(t.replace(/^while\s*\((.*)\)\s*\{$/, "$1"));
      pyLines.push(`${pad()}while ${cond}:`);
      indentLevel++;
      return;
    }

    if (t.startsWith("for (")) {
      const inside = t.replace(/^for\s*\((.*)\)\s*\{$/, "$1");
      const parts = inside.split(";").map((x) => x.trim());
      if (parts.length === 3) {
        const initM = parts[0].match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        const condM = parts[1].match(/^([a-zA-Z_]\w*)\s*(<=|<)\s*(.+)$/);
        const stepOne = /\+\+$|\+=\s*1$/.test(parts[2]);
        if (initM && condM && initM[1] === condM[1] && stepOne) {
          const vName = initM[1];
          const startVal = convertExprToPy(initM[2]);
          const endVal =
            condM[2] === "<="
              ? `${convertExprToPy(condM[3])} + 1`
              : convertExprToPy(condM[3]);
          pyLines.push(
            `${pad()}for ${vName} in range(${startVal}, ${endVal}):`,
          );
          indentLevel++;
          return;
        }
      }
      // Fallback sang while nếu vòng for phức tạp
      if (parts[0]) pyLines.push(`${pad()}${convertStmtToPy(parts[0])}`);
      pyLines.push(`${pad()}while ${convertExprToPy(parts[1] || "True")}:`);
      indentLevel++;
      return;
    }

    if (t.startsWith("cin >> ")) {
      const vars = t
        .replace(/^cin\s*>>\s*/, "")
        .replace(/;$/, "")
        .split(">>")
        .map((s) => s.trim())
        .filter(Boolean);
      vars.forEach((v) => {
        pyLines.push(`${pad()}${v} = int(input("Nhap ${v}: "))`);
      });
      return;
    }

    if (t.startsWith("cout << ")) {
      const expr = convertExprToPy(
        t
          .replace(/^cout\s*<<\s*/, "")
          .replace(/\s*<<\s*endl\s*;$/, "")
          .replace(/;$/, "")
          .trim(),
      );
      pyLines.push(`${pad()}print(${expr})`);
      return;
    }

    if (t === "return 0;") {
      return;
    }

    if (t.startsWith("return ")) {
      const retEx = convertExprToPy(
        t.replace(/^return\s+/, "").replace(/;$/, ""),
      );
      pyLines.push(`${pad()}return ${retEx}`);
      return;
    }

    pyLines.push(`${pad()}${convertStmtToPy(t)}`);
  });

  if (pyLines.length === 1) {
    pyLines.push("    pass");
  }
  return pyLines.join("\n");
}

compileAll = function () {
  const box = document.getElementById("codeOutputBox");
  if (!box) return;
  let outText = "";
  if (activeOutputTab === "cpp") outText = generateFullCpp();
  else if (activeOutputTab === "c") outText = generateFullC();
  else if (activeOutputTab === "python") outText = generateFullPython();
  else if (activeOutputTab === "mermaid")
    outText = generateMermaid(currGraph());
  else outText = generateTikZ(currGraph());
  ideSetText(outText);
};

// -------------------------------------------------------------------------
// HẠNG MỤC 3: BỔ SUNG NÚT THOÁT TOÀN MÀN HÌNH CHO KHUNG CODE C++ (IDE FULLSCREEN EXIT)
// - Đổi nhãn nút phóng to thành `🗗 Thu Nhỏ` khi ở chế độ toàn màn hình.
// - Hiển thị nút đóng nổi bật màu đỏ/cam ở góc trên bên phải khung IDE: `✕ Thoát Fullscreen (ESC)`.
// - Bấm phím `ESC` khi đang ở Fullscreen IDE tự động thoát chế độ toàn màn hình.
// -------------------------------------------------------------------------
toggleIdeFullscreen = function (forceState) {
  const container = document.getElementById("idePanelContainer");
  const btn = document.getElementById("btnIdeFullscreen");
  const exitBtn = document.getElementById("btnIdeExitFullscreen");
  if (!container) return;

  const wantFull =
    typeof forceState === "boolean"
      ? forceState
      : !container.classList.contains("ide-fullscreen");

  container.classList.toggle("ide-fullscreen", wantFull);
  document.body.classList.toggle("ide-fullscreen-active", wantFull);

  if (wantFull && container.classList.contains("ide-collapsed")) {
    container.classList.remove("ide-collapsed");
    const colBtn = document.getElementById("btnIdeCollapse");
    if (colBtn) colBtn.textContent = "▾ Thu gọn";
  }

  if (btn) {
    btn.textContent = wantFull ? "🗗 Thu Nhỏ" : "⛶ Fullscreen";
  }
  if (exitBtn) {
    exitBtn.style.display = wantFull ? "inline-flex" : "none";
  }
  setTimeout(() => {
    ideRefreshGutter();
    onResizeCityViewport();
  }, 50);
};
