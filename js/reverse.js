// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/reverse.js
// Mô tả: Bộ dịch ngược AST C++ sang sơ đồ khối 3D (tokenizeCpp,
//        parseCppTokensToAST, parseCppToFlowchart) và đồng bộ 2 chiều IDE -> 3D.
// ============================================================================

// =========================================================================
// 15. AST REVERSE COMPILER (C++ CODE -> 3D CITY)
// =========================================================================
function openReverseModal() {
  const m = document.getElementById("reverseModal");
  m.classList.remove("hidden");
  m.classList.add("flex");
}

function closeReverseModal() {
  const m = document.getElementById("reverseModal");
  m.classList.add("hidden");
  m.classList.remove("flex");
}

function loadSampleReverseCode(type) {
  const box = document.getElementById("cppPasteBox");
  if (type === "for_ifelse") {
    box.value = `cin >> n;\ntong = 0;\nfor (i = 1; i <= n; i++) {\n    if (n % i == 0) {\n        tong += i;\n    } else {\n        du = n % i;\n    }\n}\ncout << tong;`;
  } else if (type === "dowhile") {
    box.value = `cin >> n;\ntong = 0;\ni = 1;\ndo {\n    tong += i;\n    i++;\n} while (i <= n);\ncout << tong;`;
  } else if (type === "nested") {
    box.value = `cin >> a >> b;\nif (a > b) {\n    if (a % 2 == 0) {\n        kq = a * 2;\n    } else {\n        kq = a + 1;\n    }\n} else {\n    kq = b;\n}\ncout << kq;`;
  } else if (type === "break_continue") {
    box.value = `cin >> n;\ntong = 0;\nfor (i = 1; i <= n; i++) {\n    if (i % 2 == 0) {\n        continue;\n    }\n    if (tong > 20) {\n        break;\n    }\n    tong += i;\n}\ncout << tong;`;
  }
}

function tokenizeCpp(source) {
  const cleaned = source
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*#.*$/gm, "")
    .replace(/\busing\s+namespace\s+std\s*;/g, "");

  const tokens = [];
  let i = 0;
  const n = cleaned.length;
  while (i < n) {
    const ch = cleaned[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < n && cleaned[i] !== '"') {
        if (cleaned[i] === "\\" && i + 1 < n) {
          str += cleaned[i] + cleaned[i + 1];
          i += 2;
        } else str += cleaned[i++];
      }
      if (i < n && cleaned[i] === '"') str += cleaned[i++];
      tokens.push({ type: "STRING", value: str });
      continue;
    }
    const two = cleaned.slice(i, i + 2);
    if (
      [
        ">>",
        "<<",
        "<=",
        ">=",
        "==",
        "!=",
        "&&",
        "||",
        "++",
        "--",
        "+=",
        "-=",
        "*=",
        "/=",
      ].includes(two)
    ) {
      tokens.push({ type: "OP", value: two });
      i += 2;
      continue;
    }
    if (["{", "}", "(", ")", "[", "]", ";", ","].includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }
    if (
      ["+", "-", "*", "/", "%", "=", "<", ">", "!", "?", ":"].includes(ch)
    ) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }
    if (/\d/.test(ch)) {
      let num = "";
      while (i < n && /[\d.]/.test(cleaned[i])) num += cleaned[i++];
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = "";
      while (i < n && /[a-zA-Z0-9_.]/.test(cleaned[i]))
        id += cleaned[i++];
      tokens.push({ type: "IDENT", value: id });
      continue;
    }
    tokens.push({ type: "OTHER", value: ch });
    i++;
  }
  return tokens;
}

function parseCppTokensToAST(tokens) {
  let pos = 0;
  const peek = (offset = 0) => tokens[pos + offset] || null;
  const consume = () => tokens[pos++] || null;
  const matchValue = (val) =>
    peek() && peek().value === val ? consume() : null;

  function formatTokensAsExpr(tokList) {
    let out = "";
    for (let i = 0; i < tokList.length; i++) {
      const curr = tokList[i].value;
      const prev = i > 0 ? tokList[i - 1].value : "";
      const noSpaceBefore = [";", ",", ")", "]", "++", "--"].includes(
        curr,
      );
      const noSpaceAfter = ["(", "["].includes(prev);
      if (i > 0 && !noSpaceBefore && !noSpaceAfter) out += " ";
      out += curr;
    }
    return out.trim();
  }

  function readBalancedParenTokens() {
    matchValue("(");
    let depth = 1;
    const collected = [];
    while (pos < tokens.length && depth > 0) {
      const t = consume();
      if (t.value === "(") depth++;
      else if (t.value === ")") {
        depth--;
        if (depth === 0) break;
      }
      if (depth > 0) collected.push(t);
    }
    return collected;
  }

  function readUntilSemicolon() {
    const collected = [];
    let parenDepth = 0,
      braceDepth = 0;
    while (pos < tokens.length) {
      const p = peek();
      if (!p) break;
      if (p.value === "(") parenDepth++;
      if (p.value === ")") parenDepth = Math.max(0, parenDepth - 1);
      if (p.value === "{") braceDepth++;
      if (p.value === "}") {
        if (braceDepth === 0) break;
        braceDepth--;
      }
      if (p.value === ";" && parenDepth === 0 && braceDepth === 0) {
        consume();
        break;
      }
      collected.push(consume());
    }
    return collected;
  }

  function parseStatementOrBlock() {
    if (matchValue("{")) {
      const stmts = [];
      while (pos < tokens.length && peek() && peek().value !== "}") {
        const s = parseStatement();
        if (s) stmts.push(s);
      }
      matchValue("}");
      return stmts;
    } else {
      const single = parseStatement();
      return single ? [single] : [];
    }
  }

  function parseStatement() {
    while (peek() && peek().value === ";") consume();
    const tok = peek();
    if (!tok) return null;

    if (
      (tok.value === "int" || tok.value === "void") &&
      peek(1)?.value === "main" &&
      peek(2)?.value === "("
    ) {
      consume();
      consume();
      readBalancedParenTokens();
      return { type: "Block", body: parseStatementOrBlock() };
    }
    if (tok.value === "if") {
      consume();
      const cond = formatTokensAsExpr(readBalancedParenTokens());
      const thenBranch = parseStatementOrBlock();
      let elseBranch = [];
      if (peek()?.value === "else") {
        consume();
        elseBranch = parseStatementOrBlock();
      }
      return { type: "If", cond, thenBranch, elseBranch };
    }
    if (tok.value === "while") {
      consume();
      const cond = formatTokensAsExpr(readBalancedParenTokens());
      return { type: "While", cond, body: parseStatementOrBlock() };
    }
    if (tok.value === "do") {
      consume();
      const body = parseStatementOrBlock();
      let cond = "true";
      if (peek()?.value === "while") {
        consume();
        cond = formatTokensAsExpr(readBalancedParenTokens());
      }
      matchValue(";");
      return { type: "DoWhile", cond, body };
    }
    if (tok.value === "for") {
      consume();
      const headerTokens = readBalancedParenTokens();
      const parts = [[], [], []];
      let partIdx = 0;
      headerTokens.forEach((ht) => {
        if (ht.value === ";" && partIdx < 2) partIdx++;
        else parts[partIdx].push(ht);
      });
      const initStr = formatTokensAsExpr(parts[0]).replace(
        /^(int|double|float|long)\s+/,
        "",
      );
      const condStr = formatTokensAsExpr(parts[1]) || "true";
      const stepStr = formatTokensAsExpr(parts[2]);
      return {
        type: "For",
        init: initStr,
        cond: condStr,
        step: stepStr,
        body: parseStatementOrBlock(),
      };
    }
    if (tok.value === "cin") {
      consume();
      const rawTokens = readUntilSemicolon();
      const vars = rawTokens
        .filter((t) => t.value !== ">>")
        .map((t) => t.value)
        .join(", ");
      return { type: "Input", content: vars };
    }
    if (tok.value === "cout") {
      consume();
      const rawTokens = readUntilSemicolon();
      const parts = [];
      let cur = [];
      rawTokens.forEach((t) => {
        if (t.value === "<<") {
          if (cur.length > 0) parts.push(formatTokensAsExpr(cur));
          cur = [];
        } else cur.push(t);
      });
      if (cur.length > 0) parts.push(formatTokensAsExpr(cur));
      const filtered = parts.filter(
        (p) => p !== "endl" && p !== '"\\n"' && p !== "'\\n'",
      );
      return { type: "Output", content: filtered.join(", ") || "x" };
    }
    if (tok.value === "return") {
      const rawTokens = readUntilSemicolon();
      return { type: "Return", content: formatTokensAsExpr(rawTokens) };
    }
    if (tok.value === "break") {
      consume();
      readUntilSemicolon();
      return { type: "Break", content: "break" };
    }
    if (tok.value === "continue") {
      consume();
      readUntilSemicolon();
      return { type: "Continue", content: "continue" };
    }

    const stmtTokens = readUntilSemicolon();
    if (stmtTokens.length === 0) return null;
    const firstVal = stmtTokens[0].value;
    const isTypeDecl = [
      "int",
      "double",
      "float",
      "string",
      "bool",
      "long",
    ].includes(firstVal);
    const hasEquals = stmtTokens.some((t) =>
      ["=", "+=", "-=", "*=", "/="].includes(t.value),
    );
    if (isTypeDecl && !hasEquals) return null;

    let exprStr = formatTokensAsExpr(stmtTokens);
    const cppArrMatch = exprStr.match(
      /^(?:int|double|float|string|bool)\s+([a-zA-Z_]\w*)\s*\[\s*\d*\s*\]\s*=\s*\{(.*)\}$/,
    );
    if (cppArrMatch) exprStr = `${cppArrMatch[1]} = [${cppArrMatch[2]}]`;
    else if (isTypeDecl)
      exprStr = exprStr.replace(
        /^(?:int|double|float|string|bool|long)\s+/,
        "",
      );

    const isSubCall =
      /^[a-zA-Z_]\w*\s*=\s*[a-zA-Z_]\w*\s*\(.*\)$/.test(exprStr) &&
      !exprStr.includes("Math.");
    return {
      type: isSubCall ? "Subroutine" : "Process",
      content: exprStr,
    };
  }

  const ast = [];
  while (pos < tokens.length) {
    if (peek()?.value === "}") {
      consume();
      continue;
    }
    const stmt = parseStatement();
    if (stmt) {
      if (stmt.type === "Block") ast.push(...stmt.body);
      else ast.push(stmt);
    }
  }
  return ast;
}

function parseCppToFlowchart(rawOverride, opts = {}) {
  const raw =
    typeof rawOverride === "string"
      ? rawOverride
      : document.getElementById("cppPasteBox").value;
  const tokens = tokenizeCpp(raw);
  const ast = parseCppTokensToAST(tokens);
  if (!opts.dryRun) pushHistoryState();

  const newNodes = [];
  const newEdges = [];
  let nodeCounter = 1;
  let edgeCounter = 1;

  function createNode(type, content) {
    const id = "r" + nodeCounter++;
    newNodes.push({
      id,
      type,
      content,
      x: 280,
      y: 40 + nodeCounter * 75,
      bp: false,
    });
    return id;
  }

  function connectOpenEnds(openEnds, targetId) {
    openEnds.forEach((oe) => {
      newEdges.push({
        id: "re" + edgeCounter++,
        source: oe.nodeId,
        target: targetId,
        branch: oe.branch || null,
      });
    });
  }

  const loopStack = [];

  function buildStatementList(stmts, incomingOpenEnds) {
    let currentOpen = incomingOpenEnds;
    for (const stmt of stmts) {
      if (!stmt || currentOpen.length === 0) continue;
      if (
        ["Input", "Output", "Process", "Subroutine"].includes(stmt.type)
      ) {
        const typeMap = {
          Input: "input",
          Output: "output",
          Process: "process",
          Subroutine: "subroutine",
        };
        const nId = createNode(typeMap[stmt.type], stmt.content);
        connectOpenEnds(currentOpen, nId);
        currentOpen = [{ nodeId: nId, branch: null }];
      } else if (stmt.type === "Break") {
        const brkId = createNode("process", "break");
        connectOpenEnds(currentOpen, brkId);
        if (loopStack.length > 0) {
          loopStack[loopStack.length - 1].breakOpenEnds.push({
            nodeId: brkId,
            branch: null,
          });
        }
        currentOpen = [];
      } else if (stmt.type === "Continue") {
        const contId = createNode("process", "continue");
        connectOpenEnds(currentOpen, contId);
        if (loopStack.length > 0) {
          const topLoop = loopStack[loopStack.length - 1];
          if (topLoop.continueTargetId) {
            connectOpenEnds(
              [{ nodeId: contId, branch: null }],
              topLoop.continueTargetId,
            );
          } else {
            topLoop.continueOpenEnds.push({
              nodeId: contId,
              branch: null,
            });
          }
        }
        currentOpen = [];
      } else if (stmt.type === "If") {
        const decId = createNode("decision", stmt.cond);
        connectOpenEnds(currentOpen, decId);
        const thenOut =
          stmt.thenBranch?.length > 0
            ? buildStatementList(stmt.thenBranch, [
                { nodeId: decId, branch: "true" },
              ])
            : [{ nodeId: decId, branch: "true" }];
        const elseOut =
          stmt.elseBranch?.length > 0
            ? buildStatementList(stmt.elseBranch, [
                { nodeId: decId, branch: "false" },
              ])
            : [{ nodeId: decId, branch: "false" }];
        currentOpen = [...thenOut, ...elseOut];
      } else if (stmt.type === "While") {
        const decId = createNode("decision", stmt.cond);
        connectOpenEnds(currentOpen, decId);
        const loopCtx = {
          continueTargetId: decId,
          continueOpenEnds: [],
          breakOpenEnds: [],
        };
        loopStack.push(loopCtx);
        const bodyOut =
          stmt.body?.length > 0
            ? buildStatementList(stmt.body, [
                { nodeId: decId, branch: "true" },
              ])
            : [{ nodeId: decId, branch: "true" }];
        loopStack.pop();
        connectOpenEnds([...bodyOut, ...loopCtx.continueOpenEnds], decId);
        currentOpen = [
          { nodeId: decId, branch: "false" },
          ...loopCtx.breakOpenEnds,
        ];
      } else if (stmt.type === "DoWhile") {
        const bodyStmts =
          stmt.body?.length > 0
            ? stmt.body
            : [{ type: "Process", content: "/* body */" }];
        const startEdgeSnap = newEdges.length;
        const loopCtx = {
          continueTargetId: null,
          continueOpenEnds: [],
          breakOpenEnds: [],
        };
        loopStack.push(loopCtx);
        const bodyOut = buildStatementList(bodyStmts, currentOpen);
        loopStack.pop();
        const firstBodyEdge = newEdges[startEdgeSnap];
        const bodyHeaderId = firstBodyEdge
          ? firstBodyEdge.target
          : newNodes[newNodes.length - 1].id;
        const decId = createNode("decision", stmt.cond);
        connectOpenEnds([...bodyOut, ...loopCtx.continueOpenEnds], decId);
        connectOpenEnds(
          [{ nodeId: decId, branch: "true" }],
          bodyHeaderId,
        );
        currentOpen = [
          { nodeId: decId, branch: "false" },
          ...loopCtx.breakOpenEnds,
        ];
      } else if (stmt.type === "For") {
        if (stmt.init) {
          const initId = createNode("process", stmt.init);
          connectOpenEnds(currentOpen, initId);
          currentOpen = [{ nodeId: initId, branch: null }];
        }
        const condId = createNode("decision", stmt.cond || "true");
        connectOpenEnds(currentOpen, condId);
        const loopCtx = {
          continueTargetId: null,
          continueOpenEnds: [],
          breakOpenEnds: [],
        };
        loopStack.push(loopCtx);
        const bodyOut =
          stmt.body?.length > 0
            ? buildStatementList(stmt.body, [
                { nodeId: condId, branch: "true" },
              ])
            : [{ nodeId: condId, branch: "true" }];
        loopStack.pop();
        if (stmt.step) {
          const stepId = createNode("process", stmt.step);
          connectOpenEnds(
            [...bodyOut, ...loopCtx.continueOpenEnds],
            stepId,
          );
          connectOpenEnds([{ nodeId: stepId, branch: null }], condId);
        } else {
          connectOpenEnds(
            [...bodyOut, ...loopCtx.continueOpenEnds],
            condId,
          );
        }
        currentOpen = [
          { nodeId: condId, branch: "false" },
          ...loopCtx.breakOpenEnds,
        ];
      } else if (stmt.type === "Return" && stmt.content !== "return 0") {
        const retId = createNode("return", stmt.content);
        connectOpenEnds(currentOpen, retId);
        currentOpen = [];
      }
    }
    return currentOpen;
  }

  const startId = createNode("start", "Start");
  const finalOpenEnds = buildStatementList(ast, [
    { nodeId: startId, branch: null },
  ]);
  const endId = createNode("end", "End");
  connectOpenEnds(finalOpenEnds, endId);

  if (opts.dryRun) return { nodes: newNodes, edges: newEdges };
  currGraph().nodes = newNodes;
  currGraph().edges = newEdges;
  closeReverseModal();
  autoLayout(false);
  setStatusText("Đã xây dựng Thành Phố 3D từ mã C++!");
}


// Tách các hàm cấp cao nhất; nếu chỉ là dãy lệnh trần thì coi như thân main.
function ideSplitFunctions(src) {
  const clean = src
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const re =
    /(?:^|[;}\s])((?:int|void|double|float|bool|string|long)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\))\s*\{/g;
  const out = [];
  let m;
  while ((m = re.exec(clean))) {
    let i = re.lastIndex,
      d = 1;
    while (i < clean.length && d > 0) {
      const c = clean[i++];
      if (c === "{") d++;
      else if (c === "}") d--;
    }
    out.push({
      name: m[2],
      sig: m[1].trim(),
      body: clean.slice(re.lastIndex, i - 1),
    });
    re.lastIndex = i;
  }
  if (!out.length)
    out.push({ name: "main", sig: "int main()", body: clean });
  return out;
}
function ideCompile(src) {
  return ideSplitFunctions(src).map((f) => {
    const g = parseCppToFlowchart(f.body, { dryRun: true });
    const endN = g.nodes.find((n) => n.type === "end");
    if (
      endN &&
      !g.edges.some((e) => e.target === endN.id) &&
      g.nodes.some((n) => n.type === "return")
    ) {
      g.nodes = g.nodes.filter((n) => n !== endN); // mọi nhánh đã return: bỏ vòm End mồ côi
    }
    g.nodes.forEach((n) => {
      if (n.type === "subroutine")
        n.content = n.content.replace(/([a-zA-Z_]\w*)\s+\(/g, "$1(");
    }); // "f (x)" -> "f(x)"
    return { ...f, graph: g };
  });
}

function ideSyncTo3D() {
  const src = ide().value;
  if (!src.trim()) {
    bittoSay(
      "Khung code đang trống, dán code C++ vào rồi thử lại nhé!",
      "warn",
    );
    return;
  }
  let compiled;
  try {
    compiled = ideCompile(src);
  } catch (e) {
    bittoSay("Mình không đọc được đoạn code này: " + e.message, "fail");
    return;
  }
  pushHistoryState();
  const keep = activeTab;
  compiled.forEach((f) => {
    const old = tabs[f.name],
      g = f.graph;
    const st = g.nodes.find((n) => n.type === "start");
    const param = f.sig.match(/(\w+)\s*\)$/)?.[1] || "x";
    if (st)
      st.content =
        f.name === "main"
          ? "Start"
          : old?.nodes.find((n) => n.type === "start")?.content ||
            `Start ${f.name}(${param})`;
    tabs[f.name] = {
      ...(old || {}),
      signature: f.sig,
      nodes: g.nodes,
      edges: g.edges,
    };
    activeTab = f.name;
    autoLayout(false);
  });
  activeTab = tabs[keep] ? keep : Object.keys(tabs)[0];
  selectedNodeId = null;
  ideDirty = false;
  renderTabs();
  renderAll();
  const total = compiled.reduce((a, f) => a + f.graph.nodes.length, 0);
  setStatusText(
    `Đã dựng ${total} khối từ mã C++ (${compiled.length} hàm).`,
  );
  bittoSay(
    `Đã dựng lại thành phố: ${total} khối từ ${compiled.length} hàm! 🏙`,
    "happy",
    5000,
  );
}

function ideFmtOut(content, vars, arrays) {
  const parts = [];
  let d = 0,
    q = false,
    cur = "";
  for (const c of content) {
    if (c === '"') q = !q;
    if (!q && (c === "(" || c === "[")) d++;
    if (!q && (c === ")" || c === "]")) d--;
    if (c === "," && !q && d === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts
    .map((p) => String(evalWithScope(p, vars, arrays)))
    .join("");
}


function ideSyncAndAutoRun() {
  stopAutoPlay();
  if (activeOutputTab !== "cpp") {
    switchOutTab("cpp");
  }
  const src = ide().value;
  if (!src.trim()) {
    bittoSay(
      "Khung code đang trống, dán code C++ vào rồi thử lại nhé!",
      "warn",
    );
    return;
  }
  // Step 1 & 2: Parse C++ into Flowchart and auto-layout 3D City
  ideSyncTo3D();
  // Switch to main() if present so simulation starts from main entry point
  if (tabs["main"] && activeTab !== "main") {
    activeTab = "main";
    renderTabs();
    renderAll(false);
  }
  // Step 3: Read Input and immediately launch autonomous capsule simulation
  startTrace();
  toggleAutoPlay();
  bittoSay(
    "⚡ Đã đồng bộ C++ lên Đô thị 3D & kích hoạt Viên Nang Tự Hành!",
    "debug",
    5000,
  );
}
