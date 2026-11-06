// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/evaluator.js
// Mô tả: Trình thông dịch biểu thức đệ quy an toàn (Safe Recursive Descent
//        Expression Evaluator - tokenizeSafeExpr, evalWithScope, không dùng eval),
//        thực thi lệnh gán mảng 1D / ma trận 2D và gọi hàm con (runSubroutineHeadless).
// ============================================================================


function extractSubroutineParamNames(subGraph) {
  const names = [];
  if (subGraph && subGraph.signature) {
    const paramPart = subGraph.signature.match(/\((.*?)\)/)?.[1] || "";
    paramPart
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => {
        const m = p.match(/([a-zA-Z_]\w*)\s*$/);
        if (m) names.push(m[1]);
      });
  }
  if (names.length === 0 && subGraph && Array.isArray(subGraph.nodes)) {
    const st = subGraph.nodes.find((n) => n.type === "start");
    const m = st?.content.match(/\((.*?)\)/);
    if (m && m[1]) {
      m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((p) => names.push(p));
    }
  }
  if (names.length === 0) names.push("x");
  return names;
}

function parseSubroutineCallStatement(stmtStr) {
  const clean = stmtStr.trim().replace(/;$/, "").trim();
  const m = clean.match(
    /^(?:([a-zA-Z_]\w*)\s*=\s*)?([a-zA-Z_]\w*)\s*\((.*)\)$/,
  );
  if (!m) return null;
  const returnVar = m[1] || null;
  const fnName = m[2];
  const rawArgs = m[3].trim();
  const argExprs = [];
  if (rawArgs) {
    let depth = 0,
      inStr = false,
      cur = "";
    for (let i = 0; i < rawArgs.length; i++) {
      const c = rawArgs[i];
      if (c === '"') inStr = !inStr;
      if (!inStr) {
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (c === "," && depth === 0) {
          argExprs.push(cur.trim());
          cur = "";
          continue;
        }
      }
      cur += c;
    }
    if (cur.trim()) argExprs.push(cur.trim());
  }
  return { returnVar, fnName, argExprs };
}

function executeStatementBlock(codeStr, vars, arrays) {
  codeStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((stmt) => {
      const cleanStmt = stmt.replace(
        /^(int|double|float|string|bool)\s+/,
        "",
      );

      const arrMatch =
        cleanStmt.match(/^([a-zA-Z_]\w*)\s*=\s*\[(.*?)\]$/) ||
        cleanStmt.match(/^([a-zA-Z_]\w*)\s*\[\d*\]\s*=\s*\{(.*?)\}$/);
      if (arrMatch) {
        arrays[arrMatch[1]] = arrMatch[2].split(",").map((x) => {
          const t = x.trim();
          if (/^".*"$/.test(t)) return t.slice(1, -1);
          return Number(t);
        });
        return;
      }
      const arrElemMatch = cleanStmt.match(
        /^([a-zA-Z_]\w*)\s*\[(.+?)\]\s*=\s*(.+)$/,
      );
      if (arrElemMatch) {
        const arrName = arrElemMatch[1];
        const idx = Number(evalWithScope(arrElemMatch[2], vars, arrays));
        const val = evalWithScope(arrElemMatch[3], vars, arrays);
        if (!arrays[arrName]) arrays[arrName] = [];
        arrays[arrName][idx] = val;
        return;
      }
      const incMatch =
        cleanStmt.match(/^([a-zA-Z_]\w*)\s*(\+\+|--)$/) ||
        cleanStmt.match(/^(\+\+|--)\s*([a-zA-Z_]\w*)$/);
      if (incMatch) {
        const v =
          incMatch[1] === "++" || incMatch[1] === "--"
            ? incMatch[2]
            : incMatch[1];
        const op =
          incMatch[1] === "++" || incMatch[1] === "--"
            ? incMatch[1]
            : incMatch[2];
        vars[v] = (vars[v] || 0) + (op === "++" ? 1 : -1);
        return;
      }
      const compMatch = cleanStmt.match(
        /^([a-zA-Z_]\w*)\s*([+\-*/%])=\s*(.+)$/,
      );
      if (compMatch) {
        const v = compMatch[1],
          op = compMatch[2],
          rhs = evalWithScope(compMatch[3], vars, arrays),
          cur = vars[v] || 0;
        if (op === "+") vars[v] = cur + rhs;
        if (op === "-") vars[v] = cur - rhs;
        if (op === "*") vars[v] = cur * rhs;
        if (op === "/") {
          if (rhs === 0) vars[v] = 0;
          else if (Number.isInteger(cur) && Number.isInteger(rhs))
            vars[v] = Math.trunc(cur / rhs);
          else vars[v] = cur / rhs;
        }
        if (op === "%") vars[v] = rhs === 0 ? 0 : cur % rhs;
        return;
      }
      const assignMatch = cleanStmt.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      if (assignMatch) {
        vars[assignMatch[1]] = evalWithScope(
          assignMatch[2],
          vars,
          arrays,
        );
      }
    });
}

// =========================================================================
// SAFE EXPRESSION PARSER & EVALUATOR (Recursive Descent - No eval / Function)
// =========================================================================
const FORBIDDEN_IDENTIFIERS = new Set([
  "window",
  "document",
  "fetch",
  "localStorage",
  "sessionStorage",
  "globalThis",
  "Function",
  "eval",
  "constructor",
  "__proto__",
  "prototype",
  "XMLHttpRequest",
  "WebSocket",
  "navigator",
  "location",
  "parent",
  "top",
  "self",
]);

const SAFE_MATH_FUNCS = {
  sqrt: Math.sqrt,
  pow: Math.pow,
  abs: Math.abs,
  fabs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
  trunc: Math.trunc,
};

function tokenizeSafeExpr(exprStr) {
  const tokens = [];
  let i = 0;
  const n = exprStr.length;

  while (i < n) {
    const ch = exprStr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // String literal
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let s = "";
      i++;
      while (i < n && exprStr[i] !== quote) {
        if (exprStr[i] === "\\" && i + 1 < n) {
          const next = exprStr[i + 1];
          s += next === "n" ? "\n" : next === "t" ? "\t" : next;
          i += 2;
        } else {
          s += exprStr[i++];
        }
      }
      if (i < n && exprStr[i] === quote) i++;
      tokens.push({ type: "STR", value: s });
      continue;
    }
    // Two-character operators
    const two = exprStr.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      tokens.push({ type: "OP", value: two });
      i += 2;
      continue;
    }
    // Single-character operators and punctuation
    if (["+", "-", "*", "/", "%", "<", ">", "!", "?", ":"].includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }
    if (["(", ")", "[", "]", ","].includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }
    // Numbers
    if (
      /\d/.test(ch) ||
      (ch === "." && i + 1 < n && /\d/.test(exprStr[i + 1]))
    ) {
      let numStr = "";
      while (i < n && /[\d.]/.test(exprStr[i])) {
        numStr += exprStr[i++];
      }
      tokens.push({ type: "NUM", value: Number(numStr) });
      continue;
    }
    // Identifiers (including Math.xxx)
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = "";
      while (i < n && /[a-zA-Z0-9_$]/.test(exprStr[i])) {
        id += exprStr[i++];
      }
      if (FORBIDDEN_IDENTIFIERS.has(id)) {
        throw new Error("Blocked unsafe identifier: " + id);
      }
      // Handle Math.<fn> or Math.PI / Math.E safely
      if (id === "Math" && exprStr[i] === ".") {
        i++; // skip '.'
        let prop = "";
        while (i < n && /[a-zA-Z0-9_]/.test(exprStr[i])) {
          prop += exprStr[i++];
        }
        if (FORBIDDEN_IDENTIFIERS.has(prop)) {
          throw new Error("Blocked unsafe property: " + prop);
        }
        if (prop === "PI") {
          tokens.push({ type: "NUM", value: Math.PI });
        } else if (prop === "E") {
          tokens.push({ type: "NUM", value: Math.E });
        } else {
          tokens.push({ type: "IDENT", value: prop });
        }
        continue;
      }
      if (exprStr[i] === ".") {
        throw new Error("Property access is forbidden in safe evaluator");
      }
      tokens.push({ type: "IDENT", value: id });
      continue;
    }
    throw new Error("Unexpected character: " + ch);
  }
  return tokens;
}

function evalWithScope(expr, vars = {}, arrays = {}) {
  try {
    if (expr === undefined || expr === null) return 0;
    const trimmed = String(expr).trim();
    if (!trimmed) return 0;

    const tokens = tokenizeSafeExpr(trimmed);
    let pos = 0;

    const peek = () => tokens[pos] || null;
    const consume = () => tokens[pos++] || null;
    const matchOp = (opVal) => {
      const p = peek();
      if (p && p.type === "OP" && p.value === opVal) {
        pos++;
        return true;
      }
      return false;
    };

    // 1. Ternary: cond ? a : b
    function parseTernary() {
      const cond = parseLogicalOr();
      if (matchOp("?")) {
        const trueVal = parseTernary();
        if (!matchOp(":")) throw new Error("Missing ':' in ternary");
        const falseVal = parseTernary();
        return cond ? trueVal : falseVal;
      }
      return cond;
    }

    // 2. Logical OR: ||
    function parseLogicalOr() {
      let left = parseLogicalAnd();
      while (matchOp("||")) {
        const right = parseLogicalAnd();
        left = Boolean(left) || Boolean(right);
      }
      return left;
    }

    // 3. Logical AND: &&
    function parseLogicalAnd() {
      let left = parseEquality();
      while (matchOp("&&")) {
        const right = parseEquality();
        left = Boolean(left) && Boolean(right);
      }
      return left;
    }

    // 4. Equality: ==, !=
    function parseEquality() {
      let left = parseRelational();
      while (true) {
        if (matchOp("==")) {
          const right = parseRelational();
          left = left == right;
        } else if (matchOp("!=")) {
          const right = parseRelational();
          left = left != right;
        } else break;
      }
      return left;
    }

    // 5. Relational: <, <=, >, >=
    function parseRelational() {
      let left = parseAdditive();
      while (true) {
        if (matchOp("<")) {
          left = left < parseAdditive();
        } else if (matchOp("<=")) {
          left = left <= parseAdditive();
        } else if (matchOp(">")) {
          left = left > parseAdditive();
        } else if (matchOp(">=")) {
          left = left >= parseAdditive();
        } else break;
      }
      return left;
    }

    // 6. Additive: +, -
    function parseAdditive() {
      let left = parseMultiplicative();
      while (true) {
        if (matchOp("+")) {
          const right = parseMultiplicative();
          if (typeof left === "string" || typeof right === "string") {
            left = String(left) + String(right);
          } else {
            left = (Number(left) || 0) + (Number(right) || 0);
          }
        } else if (matchOp("-")) {
          const right = parseMultiplicative();
          left = (Number(left) || 0) - (Number(right) || 0);
        } else break;
      }
      return left;
    }

    // 7. Multiplicative: *, /, %
    function parseMultiplicative() {
      let left = parseUnary();
      while (true) {
        if (matchOp("*")) {
          left = (Number(left) || 0) * (Number(parseUnary()) || 0);
        } else if (matchOp("/")) {
          const l = Number(left) || 0;
          const r = Number(parseUnary()) || 0;
          if (r === 0) {
            left = 0;
          } else if (Number.isInteger(l) && Number.isInteger(r)) {
            left = Math.trunc(l / r);
          } else {
            left = l / r;
          }
        } else if (matchOp("%")) {
          const r = Number(parseUnary());
          left = r === 0 ? 0 : (Number(left) || 0) % r;
        } else break;
      }
      return left;
    }

    // 8. Unary: !, -, +
    function parseUnary() {
      if (matchOp("!")) return !Boolean(parseUnary());
      if (matchOp("-")) return -(Number(parseUnary()) || 0);
      if (matchOp("+")) return +(Number(parseUnary()) || 0);
      return parsePrimary();
    }

    // 9. Primary: literals, (expr), array[idx], fn(args), variables
    function parsePrimary() {
      const tok = peek();
      if (!tok) return 0;

      if (tok.type === "(") {
        consume();
        const val = parseTernary();
        if (peek()?.type === ")") consume();
        return val;
      }

      if (tok.type === "NUM" || tok.type === "STR") {
        consume();
        return tok.value;
      }

      if (tok.type === "IDENT") {
        consume();
        const name = tok.value;
        if (name === "true") return true;
        if (name === "false") return false;

        // Function call: ident(arg1, arg2, ...)
        if (peek()?.type === "(") {
          consume(); // '('
          const args = [];
          if (peek() && peek().type !== ")") {
            args.push(parseTernary());
            while (peek()?.type === ",") {
              consume();
              args.push(parseTernary());
            }
          }
          if (peek()?.type === ")") consume();

          if (
            Object.prototype.hasOwnProperty.call(SAFE_MATH_FUNCS, name)
          ) {
            return SAFE_MATH_FUNCS[name](
              ...args.map((a) => Number(a) || 0),
            );
          }
          if (tabs && Object.prototype.hasOwnProperty.call(tabs, name)) {
            return runSubroutineHeadless(tabs[name], args);
          }
          return 0;
        }

        // Array element access: a[i]
        if (peek()?.type === "[") {
          consume(); // '['
          const idx = Math.trunc(Number(parseTernary()) || 0);
          if (peek()?.type === "]") consume();
          if (
            arrays &&
            Object.prototype.hasOwnProperty.call(arrays, name)
          ) {
            const arr = arrays[name];
            return Array.isArray(arr) && arr[idx] !== undefined
              ? arr[idx]
              : 0;
          }
          return 0;
        }

        // Scalar variable lookup
        if (vars && Object.prototype.hasOwnProperty.call(vars, name)) {
          return vars[name];
        }
        return 0;
      }

      consume();
      return 0;
    }

    const result = parseTernary();
    return result;
  } catch (err) {
    return 0;
  }
}

// HOTFIX [BUG-04]: Biến theo dõi độ sâu đệ quy toàn cục để bảo vệ Call Stack
let globalSubroutineRecursionDepth = 0;
const MAX_SUBROUTINE_DEPTH = 128;

function runSubroutineHeadless(subGraph, argValOrList) {
  if (!subGraph || !Array.isArray(subGraph.nodes)) return 0;
  if (globalSubroutineRecursionDepth >= MAX_SUBROUTINE_DEPTH) {
    throw new Error(
      `Vượt quá giới hạn đệ quy tối đa (${MAX_SUBROUTINE_DEPTH} tầng)! Nghi ngờ đệ quy vô hạn.`,
    );
  }

  globalSubroutineRecursionDepth++;
  try {
    const argList = Array.isArray(argValOrList)
      ? argValOrList
      : [argValOrList];
    const firstArg = argList[0] !== undefined ? argList[0] : 0;
    const localVars = { x: firstArg, n: firstArg };
    const paramNames = extractSubroutineParamNames(subGraph);
    paramNames.forEach((pName, idx) => {
      localVars[pName] =
        argList[idx] !== undefined ? argList[idx] : firstArg;
    });

    const localArr = {};
    const start = subGraph.nodes.find((n) => n.type === "start");
    if (!start) return 0;
    let currId = start.id;
    let steps = 0;
    while (currId && steps < 1500) {
      steps++;
      const node = subGraph.nodes.find((n) => n.id === currId);
      if (!node) break;
      if (node.type === "end" || node.type === "return") {
        const retExpr = node.content.replace(/^return\s*/, "").trim();
        return retExpr ? evalWithScope(retExpr, localVars, localArr) : 0;
      }
      if (node.type === "process" || node.type === "subroutine") {
        const trimmed = node.content.trim();
        if (trimmed !== "break" && trimmed !== "continue") {
          executeStatementBlock(node.content, localVars, localArr);
        }
      }
      if (node.type === "decision") {
        const cond = Boolean(
          evalWithScope(node.content, localVars, localArr),
        );
        const edge = subGraph.edges.find(
          (e) =>
            e.source === currId && e.branch === (cond ? "true" : "false"),
        );
        currId = edge ? edge.target : null;
      } else {
        const edge = subGraph.edges.find((e) => e.source === currId);
        currId = edge ? edge.target : null;
      }
    }
    return 0;
  } finally {
    globalSubroutineRecursionDepth--;
  }
}

// Hỗ trợ thực thi câu lệnh khởi tạo và gán phần tử Ma trận 2 chiều a[i][j] = val
const _v5ExecuteStatementBlock = executeStatementBlock;
executeStatementBlock = function (codeStr, vars, arrays) {
  const cleanFull = codeStr.trim();
  // Kiểm tra khai báo ma trận 2 chiều: mat = [[1, 2, 3], [4, 5, 6]]
  const mat2dMatch = cleanFull.match(
    /^([a-zA-Z_]\w*)\s*=\s*(\[\s*\[[\s\S]*\]\s*\])\s*;?$/,
  );
  if (mat2dMatch) {
    try {
      arrays[mat2dMatch[1]] = JSON.parse(mat2dMatch[2]);
      return;
    } catch (e) {}
  }

  // Tách theo dấu chấm phẩy nhưng bảo toàn mảng 2D nếu có
  codeStr
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((stmt) => {
      const m2 = stmt.match(
        /^([a-zA-Z_]\w*)\s*=\s*(\[\s*\[[\s\S]*\]\s*\])$/,
      );
      if (m2) {
        try {
          arrays[m2[1]] = JSON.parse(m2[2]);
          return;
        } catch (e) {}
      }
      const elem2d = stmt.match(
        /^([a-zA-Z_]\w*)\s*\[(.+?)\]\s*\[(.+?)\]\s*=\s*(.+)$/,
      );
      if (elem2d) {
        const name = elem2d[1];
        const r = Math.trunc(
          Number(evalWithScope(elem2d[2], vars, arrays)) || 0,
        );
        const c = Math.trunc(
          Number(evalWithScope(elem2d[3], vars, arrays)) || 0,
        );
        const val = evalWithScope(elem2d[4], vars, arrays);
        if (!Array.isArray(arrays[name])) arrays[name] = [];
        if (!Array.isArray(arrays[name][r])) arrays[name][r] = [];
        arrays[name][r][c] = val;
        return;
      }
      // Thay thế truy cập phần tử 2D a[i][j] ở vế phải trước khi đưa vào bộ tính toán
      const expandedStmt = stmt.replace(
        /([a-zA-Z_]\w*)\s*\[([^\[\]]+)\]\s*\[([^\[\]]+)\]/g,
        (_, arrN, rEx, cEx) => {
          const rv = Math.trunc(
            Number(evalWithScope(rEx, vars, arrays)) || 0,
          );
          const cv = Math.trunc(
            Number(evalWithScope(cEx, vars, arrays)) || 0,
          );
          const cellVal = arrays[arrN]?.[rv]?.[cv];
          return cellVal !== undefined ? String(cellVal) : "0";
        },
      );
      _v5ExecuteStatementBlock(expandedStmt, vars, arrays);
    });
};

// Mở rộng evalWithScope để hỗ trợ đọc phần tử ma trận 2 chiều a[i][j]
const _v5EvalWithScope = evalWithScope;
evalWithScope = function (expr, vars = {}, arrays = {}) {
  if (
    typeof expr === "string" &&
    /\[[^\[\]]+\]\s*\[[^\[\]]+\]/.test(expr)
  ) {
    const expanded = expr.replace(
      /([a-zA-Z_]\w*)\s*\[([^\[\]]+)\]\s*\[([^\[\]]+)\]/g,
      (_, arrN, rEx, cEx) => {
        const rv = Math.trunc(
          Number(_v5EvalWithScope(rEx, vars, arrays)) || 0,
        );
        const cv = Math.trunc(
          Number(_v5EvalWithScope(cEx, vars, arrays)) || 0,
        );
        const cellVal = arrays?.[arrN]?.[rv]?.[cv];
        return cellVal !== undefined ? String(cellVal) : "0";
      },
    );
    return _v5EvalWithScope(expanded, vars, arrays);
  }
  return _v5EvalWithScope(expr, vars, arrays);
};

