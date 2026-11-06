// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/state.js
// Mô tả: Quản lý Trạng thái Tập trung (AppState - Single Source of Truth),
//        Cơ chế Observer (Event Emitter: on/off/emit), Các phương thức thao tác
//        đồ thị nguyên tử (Atomic Graph Operations) và Chuẩn hóa dữ liệu.
// ============================================================================

const STORAGE_KEY = "algoflow_city_3d_v5_state";
const MAX_HISTORY = 30;
const LAYER_HEIGHT_3D = 38; // Độ cao phân tầng 3D cho mỗi cấp độ lồng nhau (L0, L1, L2+)
const $id = (id) => document.getElementById(id);

/**
 * Chuẩn hóa dữ liệu một đỉnh (Node) trong đồ thị để tránh lỗi thiếu trường hoặc sai kiểu dữ liệu.
 * @param {Object} rawNode - Đối tượng đỉnh thô
 * @param {number} idx - Chỉ số thứ tự dự phòng
 * @returns {Object} Đỉnh đồ thị đã chuẩn hóa
 */
function normalizeGraphNode(rawNode, idx = 0) {
  const safe = rawNode && typeof rawNode === "object" ? rawNode : {};
  const validTypes = new Set([
    "start",
    "end",
    "input",
    "output",
    "process",
    "decision",
    "subroutine",
    "return",
    "connector",
  ]);
  const type = validTypes.has(safe.type) ? safe.type : "process";
  const id =
    typeof safe.id === "string" && safe.id.trim()
      ? safe.id.trim()
      : `n_${Date.now().toString(36)}_${idx}`;
  const defaultContentMap = {
    start: "Start",
    end: "End",
    return: "return 0",
    connector: "O",
  };
  const content =
    safe.content !== undefined && safe.content !== null
      ? String(safe.content)
      : defaultContentMap[type] || "x = 0";
  const x = Number.isFinite(Number(safe.x)) ? Math.max(40, Number(safe.x)) : 280;
  const y = Number.isFinite(Number(safe.y))
    ? Math.max(20, Number(safe.y))
    : 40 + idx * 85;
  return {
    ...safe,
    id,
    type,
    content,
    x,
    y,
    bp: Boolean(safe.bp),
  };
}

/**
 * Chuẩn hóa dữ liệu một cạnh nối (Edge) trong đồ thị.
 * @param {Object} rawEdge - Đối tượng cạnh thô
 * @param {number} idx - Chỉ số thứ tự dự phòng
 * @returns {Object|null} Cạnh nối đã chuẩn hóa hoặc null nếu thiếu source/target
 */
function normalizeGraphEdge(rawEdge, idx = 0) {
  if (!rawEdge || typeof rawEdge !== "object") return null;
  const source =
    typeof rawEdge.source === "string" ? rawEdge.source.trim() : "";
  const target =
    typeof rawEdge.target === "string" ? rawEdge.target.trim() : "";
  if (!source || !target) return null;
  const id =
    typeof rawEdge.id === "string" && rawEdge.id.trim()
      ? rawEdge.id.trim()
      : `e_${Date.now().toString(36)}_${idx}`;
  let branch = rawEdge.branch ?? rawEdge.label ?? null;
  if (typeof branch === "string") {
    const bLow = branch.trim().toLowerCase();
    branch = bLow === "true" || bLow === "false" ? bLow : null;
  } else {
    branch = null;
  }
  return {
    ...rawEdge,
    id,
    source,
    target,
    branch,
  };
}

/**
 * Chuẩn hóa toàn bộ cấu trúc đồ thị của một Quận / Hàm.
 * @param {Object} rawGraph - Đồ thị thô
 * @param {string} tabName - Tên tab hiện tại
 * @returns {Object} Đồ thị chuẩn hóa { signature, nodes, edges }
 */
function normalizeGraphData(rawGraph, tabName = "main") {
  const isMain = tabName === "main";
  const defaultSig = isMain ? "int main()" : `int ${tabName}(int x)`;
  if (!rawGraph || typeof rawGraph !== "object") {
    return createBlankGraph(tabName);
  }
  const signature =
    typeof rawGraph.signature === "string" && rawGraph.signature.trim()
      ? rawGraph.signature.trim()
      : defaultSig;
  const nodes = Array.isArray(rawGraph.nodes)
    ? rawGraph.nodes.map((n, i) => normalizeGraphNode(n, i))
    : [];
  const validNodeIds = new Set(nodes.map((n) => n.id));
  const edges = Array.isArray(rawGraph.edges)
    ? rawGraph.edges
        .map((e, i) => normalizeGraphEdge(e, i))
        .filter(
          (e) =>
            e &&
            e.source !== e.target &&
            validNodeIds.has(e.source) &&
            validNodeIds.has(e.target)
        )
    : [];
  return {
    ...rawGraph,
    signature,
    nodes,
    edges,
  };
}

/**
 * Đối tượng trung tâm AppState (Single Source of Truth) quản lý toàn bộ trạng thái ứng dụng,
 * cung cấp các phương thức thao tác nguyên tử (Atomic Data Methods) và cơ chế Observer (Event Emitter).
 */
const AppState = {
  // 1. STATE SCHEMA
  tabs: {},
  activeTab: "main",
  selectedNodeId: null,
  selectedEdgeId: null,
  hoveredNodeId: null,
  connectingFrom: null, // { nodeId, branch: 'true' | 'false' | null }
  activeOutputTab: "cpp", // 'cpp' | 'c' | 'python' | 'mermaid' | 'tikz'
  isTopDown2D: false,
  traceState: {
    active: false,
    currNodeId: null,
    prevNodeId: null,
    lastBranch: null,
    vars: {},
    arrays: {},
    inputs: [],
    stdout: [],
    steps: 0,
    callStack: [],
  },
  history: {
    undoStack: [],
    redoStack: [],
    maxLimit: MAX_HISTORY,
  },
  testCases: [
    { input: "6", expected: "6", status: "IDLE", actual: "" },
    { input: "28", expected: "6 28", status: "IDLE", actual: "" },
  ],

  // Danh sách các hàm lắng nghe sự kiện Observer theo tên sự kiện
  _listeners: {
    graphChanged: new Set(),
    nodeSelected: new Set(),
    traceStep: new Set(),
    tabSwitched: new Set(),
  },

  /**
   * Đăng ký hàm lắng nghe sự kiện thay đổi trạng thái (Observer Pattern).
   * @param {string} eventName - Tên sự kiện ('graphChanged' | 'nodeSelected' | 'traceStep' | 'tabSwitched')
   * @param {Function} handler - Hàm callback nhận payload
   * @returns {Function} Hàm hủy đăng ký (unsubscribe)
   */
  on(eventName, handler) {
    if (typeof handler !== "function") return () => {};
    if (!this._listeners[eventName]) {
      this._listeners[eventName] = new Set();
    }
    this._listeners[eventName].add(handler);
    return () => this.off(eventName, handler);
  },

  /**
   * Hủy đăng ký hàm lắng nghe sự kiện.
   */
  off(eventName, handler) {
    if (this._listeners[eventName]) {
      this._listeners[eventName].delete(handler);
    }
  },

  /**
   * Phát sự kiện tới tất cả các View/Listener đã đăng ký.
   * @param {string} eventName - Tên sự kiện
   * @param {*} payload - Dữ liệu kèm theo sự kiện
   */
  emit(eventName, payload = {}) {
    const handlers = this._listeners[eventName];
    if (!handlers) return;
    handlers.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.warn(`[AppState.emit] Lỗi trong listener (${eventName}):`, err);
      }
    });
  },

  /**
   * 2.1. Lấy đồ thị của tab hiện tại với cơ chế phòng ngừa lỗi rỗng (Null-safe guard).
   */
  getCurrentGraph() {
    if (
      !this.tabs ||
      typeof this.tabs !== "object" ||
      Object.keys(this.tabs).length === 0
    ) {
      this.tabs = { main: createBlankGraph("main") };
      this.activeTab = "main";
    }
    if (!this.tabs[this.activeTab]) {
      this.activeTab = Object.keys(this.tabs)[0] || "main";
      if (!this.tabs[this.activeTab]) {
        this.tabs[this.activeTab] = createBlankGraph(this.activeTab);
      }
    }
    const g = this.tabs[this.activeTab];
    if (!Array.isArray(g.nodes)) g.nodes = [];
    if (!Array.isArray(g.edges)) g.edges = [];
    return g;
  },

  /**
   * 2.2. Tạo đỉnh mới với UUID an toàn va chạm, tự động căn tọa độ và đẩy vào nodes.
   * @param {string} type - Loại khối ('start', 'end', 'input', 'output', 'process', 'decision', 'subroutine', 'return', 'connector')
   * @param {string} defaultContent - Biểu thức mặc định
   * @param {number} [x] - Tọa độ X tùy chọn
   * @param {number} [y] - Tọa độ Y tùy chọn
   * @returns {string} ID của đỉnh vừa tạo
   */
  addNode(type, defaultContent = "kq = tinhTongUoc(n)", x, y) {
    this.pushHistory();
    const id =
      "n_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 7);
    const g = this.getCurrentGraph();
    const lastNode = g.nodes[g.nodes.length - 1];
    const resolvedX = Number.isFinite(Number(x))
      ? Math.max(40, Math.round(Number(x) / 20) * 20)
      : lastNode
        ? lastNode.x
        : 280;
    const resolvedY = Number.isFinite(Number(y))
      ? Math.max(20, Math.round(Number(y) / 20) * 20)
      : lastNode
        ? lastNode.y + 85
        : 120;

    const newNode = normalizeGraphNode(
      {
        id,
        type,
        content: defaultContent,
        x: resolvedX,
        y: resolvedY,
        bp: false,
      },
      g.nodes.length
    );

    g.nodes.push(newNode);
    this.selectedNodeId = id;
    this.emit("nodeSelected", { nodeId: id, node: newNode });
    this.emit("graphChanged", { reason: "addNode", nodeId: id });
    return id;
  },

  /**
   * 2.3. Xóa đỉnh, ĐỒNG THỜI dọn sạch toàn bộ cạnh liên kết (source & target),
   * reset selectedNodeId, và tự động hủy bỏ selectedEdgeId nếu cạnh đó bị xóa theo.
   * @param {string} nodeId - ID của đỉnh cần xóa
   * @returns {Object|null} Đỉnh đã xóa hoặc null
   */
  deleteNode(nodeId) {
    const targetId = nodeId || this.selectedNodeId;
    if (!targetId) return null;
    const g = this.getCurrentGraph();
    const removedNode = g.nodes.find((n) => n.id === targetId);
    if (!removedNode) return null;

    this.pushHistory();

    // Xác định các cạnh sẽ bị xóa theo đỉnh này
    const removedEdgeIds = new Set(
      g.edges
        .filter((e) => e.source === targetId || e.target === targetId)
        .map((e) => e.id)
    );

    // Dọn sạch đỉnh và cạnh liên kết
    g.nodes = g.nodes.filter((n) => n.id !== targetId);
    g.edges = g.edges.filter(
      (e) => e.source !== targetId && e.target !== targetId
    );

    // Reset selectedNodeId và hủy bỏ selectedEdgeId nếu cạnh đó bị xóa theo
    if (this.selectedNodeId === targetId) {
      this.selectedNodeId = null;
    }
    if (this.selectedEdgeId && removedEdgeIds.has(this.selectedEdgeId)) {
      this.selectedEdgeId = null;
    }
    if (this.hoveredNodeId === targetId) {
      this.hoveredNodeId = null;
    }

    // Dọn sạch các con trỏ trạng thái ngoại vi (tránh Dangling Edge)
    if (this.connectingFrom && this.connectingFrom.nodeId === targetId) {
      this.connectingFrom = null;
      if (typeof hideRubberbandWirePreview === "function") {
        hideRubberbandWirePreview();
      }
    }
    if (
      typeof rubberbandDragState !== "undefined" &&
      rubberbandDragState &&
      rubberbandDragState.sourceId === targetId
    ) {
      rubberbandDragState.active = false;
      if (typeof hideRubberbandWirePreview === "function") {
        hideRubberbandWirePreview();
      }
    }
    if (
      typeof magneticTargetNodeId !== "undefined" &&
      magneticTargetNodeId === targetId
    ) {
      magneticTargetNodeId = null;
    }
    if (
      typeof tleInfiniteNodeIds !== "undefined" &&
      tleInfiniteNodeIds &&
      typeof tleInfiniteNodeIds.delete === "function"
    ) {
      tleInfiniteNodeIds.delete(targetId);
    }
    if (this.traceState && this.traceState.currNodeId === targetId) {
      this.traceState.currNodeId = null;
    }

    this.emit("nodeSelected", { nodeId: this.selectedNodeId, node: null });
    this.emit("graphChanged", { reason: "deleteNode", deletedId: targetId });
    return removedNode;
  },

  /**
   * 2.4. Cập nhật nguyên tử thuộc tính của đỉnh (tọa độ, kích thước, breakpoint, nội dung biểu thức).
   * @param {string} nodeId - ID của đỉnh
   * @param {Object} newProps - Các thuộc tính cập nhật ({ x, y, width, height, bp, content, type })
   * @param {boolean} recordHistory - Có ghi vào ngăn xếp Undo hay không
   * @returns {Object|null} Đỉnh sau khi cập nhật
   */
  updateNode(nodeId, newProps = {}, recordHistory = false) {
    if (!nodeId || !newProps || typeof newProps !== "object") return null;
    const g = this.getCurrentGraph();
    const node = g.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    if (recordHistory) {
      this.pushHistory();
    }
    if (newProps.x !== undefined && Number.isFinite(Number(newProps.x))) {
      node.x = Math.max(40, Number(newProps.x));
    }
    if (newProps.y !== undefined && Number.isFinite(Number(newProps.y))) {
      node.y = Math.max(20, Number(newProps.y));
    }
    if (newProps.width !== undefined) node.width = Number(newProps.width);
    if (newProps.height !== undefined) node.height = Number(newProps.height);
    if (newProps.bp !== undefined) node.bp = Boolean(newProps.bp);
    if (newProps.content !== undefined) node.content = String(newProps.content);
    if (newProps.type !== undefined) node.type = String(newProps.type);

    this.emit("graphChanged", { reason: "updateNode", nodeId, node });
    return node;
  },

  /**
   * 2.5. Thêm cạnh nối an toàn: Ngăn chặn tự nối chính mình (Self-loop),
   * kiểm tra tồn tại 2 đầu mút, chống trùng lặp cạnh và ghi đè cổng xuất nếu đã có dây cũ.
   * @param {string} fromId - ID đỉnh nguồn
   * @param {string} toId - ID đỉnh đích
   * @param {string|null} label - Nhánh xuất ('true' | 'false' | null)
   * @returns {Object|null} Cạnh mới tạo hoặc null nếu không hợp lệ
   */
  addEdge(fromId, toId, label = null) {
    if (!fromId || !toId) return null;
    // Chặn tự nối chính mình (Self-loop trap)
    if (fromId === toId) {
      this.connectingFrom = null;
      if (typeof hideRubberbandWirePreview === "function") {
        hideRubberbandWirePreview();
      }
      return null;
    }

    const g = this.getCurrentGraph();
    const srcNode = g.nodes.find((n) => n.id === fromId);
    const dstNode = g.nodes.find((n) => n.id === toId);
    if (!srcNode || !dstNode) {
      this.connectingFrom = null;
      if (typeof hideRubberbandWirePreview === "function") {
        hideRubberbandWirePreview();
      }
      return null;
    }

    const normBranch =
      typeof label === "string" &&
      (label.toLowerCase() === "true" || label.toLowerCase() === "false")
        ? label.toLowerCase()
        : null;

    this.pushHistory();

    // Ghi đè cổng xuất nếu đã có dây cũ trỏ ra trên cùng nhánh (hoặc chống trùng lặp cạnh)
    g.edges = g.edges.filter(
      (e) => !(e.source === fromId && (e.branch || null) === normBranch)
    );

    const edgeId =
      "e_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 7);
    const newEdge = {
      id: edgeId,
      source: fromId,
      target: toId,
      branch: normBranch,
    };
    g.edges.push(newEdge);
    this.connectingFrom = null;
    this.emit("graphChanged", { reason: "addEdge", edge: newEdge });
    return newEdge;
  },

  /**
   * 2.6. Xóa cạnh nối an toàn và tự động dọn dẹp selectedEdgeId.
   * @param {string} edgeId - ID cạnh cần xóa
   * @returns {boolean} true nếu xóa thành công
   */
  deleteEdge(edgeId) {
    if (!edgeId) return false;
    const g = this.getCurrentGraph();
    const exists = g.edges.some((e) => e.id === edgeId);
    if (!exists) return false;

    this.pushHistory();
    g.edges = g.edges.filter((e) => e.id !== edgeId);
    if (this.selectedEdgeId === edgeId) {
      this.selectedEdgeId = null;
    }
    this.emit("graphChanged", { reason: "deleteEdge", edgeId });
    return true;
  },

  /**
   * 2.7. Tuần tự hóa JSON đồ thị và đẩy vào ngăn xếp lịch sử Undo.
   */
  serialize() {
    return JSON.stringify({
      tabs: this.tabs,
      activeTab: this.activeTab,
    });
  },

  pushHistory(customSnapshotStr = null) {
    const snap = customSnapshotStr || this.serialize();
    const stack = this.history.undoStack;
    if (stack.length > 0 && stack[stack.length - 1] === snap) {
      return;
    }
    stack.push(snap);
    const limit = this.history.maxLimit || MAX_HISTORY;
    if (stack.length > limit) {
      stack.shift();
    }
    this.history.redoStack = [];
    updateUndoRedoUI();
    saveToLocalStorage();
  },

  /**
   * Hoàn tác (Undo) trạng thái đồ thị trước đó.
   */
  undo() {
    if (this.history.undoStack.length === 0) return false;
    this.history.redoStack.push(this.serialize());
    const prevSnap = this.history.undoStack.pop();
    this._restoreSnapshot(prevSnap);
    updateUndoRedoUI();
    saveToLocalStorage();
    return true;
  },

  /**
   * Làm lại (Redo) trạng thái đồ thị vừa hoàn tác.
   */
  redo() {
    if (this.history.redoStack.length === 0) return false;
    this.history.undoStack.push(this.serialize());
    const nextSnap = this.history.redoStack.pop();
    this._restoreSnapshot(nextSnap);
    updateUndoRedoUI();
    saveToLocalStorage();
    return true;
  },

  _restoreSnapshot(snapStr) {
    try {
      const parsed = JSON.parse(snapStr);
      if (parsed && parsed.tabs) {
        this.tabs = parsed.tabs;
        this.activeTab =
          parsed.activeTab && this.tabs[parsed.activeTab]
            ? parsed.activeTab
            : Object.keys(this.tabs)[0] || "main";
        this.selectedNodeId = null;
        this.selectedEdgeId = null;
        this.emit("tabSwitched", { activeTab: this.activeTab });
        this.emit("graphChanged", { reason: "historyRestore" });
      }
    } catch (e) {
      console.warn("[AppState._restoreSnapshot] Lỗi khôi phục snapshot:", e);
    }
  },

  /**
   * 2.8. Xuất dự án ra cấu trúc JSON chuẩn.
   */
  exportJSON() {
    return {
      app: "AlgoFlow Studio - The Living Algorithm City",
      version: "6.1",
      brandIdentity: "AlgoFlow Official Cyber-A Logo v6.1",
      exportedAt: new Date().toISOString(),
      activeTab: this.activeTab,
      tabs: this.tabs,
      testCases: this.testCases,
    };
  },

  /**
   * Nạp dữ liệu dự án từ đối tượng hoặc chuỗi JSON và chuẩn hóa toàn bộ đỉnh/cạnh.
   */
  importJSON(data) {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!parsed || !parsed.tabs || typeof parsed.tabs !== "object") {
      return false;
    }
    this.pushHistory();
    const normalizedTabs = {};
    Object.entries(parsed.tabs).forEach(([tName, rawG]) => {
      normalizedTabs[tName] = normalizeGraphData(rawG, tName);
    });
    this.tabs = normalizedTabs;
    this.activeTab =
      parsed.activeTab && this.tabs[parsed.activeTab]
        ? parsed.activeTab
        : Object.keys(this.tabs)[0] || "main";
    if (Array.isArray(parsed.testCases)) {
      this.testCases = parsed.testCases;
    }
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.emit("tabSwitched", { activeTab: this.activeTab });
    this.emit("graphChanged", { reason: "importJSON" });
    return true;
  },
};

// ============================================================================
// CẦU NỐI ĐỒNG BỘ TRẠNG THÁI TOÀN CỤC (REACTIVE GLOBAL BINDINGS)
// Đảm bảo mọi truy cập biến toàn cục (`tabs`, `activeTab`, `selectedNodeId`, v.v.)
// đều đọc/ghi trực tiếp vào `AppState` (Single Source of Truth), triệt tiêu hoàn toàn
// hiện tượng rò rỉ hoặc lệch pha trạng thái (State Desynchronization).
// ============================================================================
Object.defineProperties(window, {
  tabs: {
    get: () => AppState.tabs,
    set: (v) => {
      AppState.tabs = v;
    },
    configurable: true,
  },
  activeTab: {
    get: () => AppState.activeTab,
    set: (v) => {
      AppState.activeTab = v;
    },
    configurable: true,
  },
  selectedNodeId: {
    get: () => AppState.selectedNodeId,
    set: (v) => {
      AppState.selectedNodeId = v;
    },
    configurable: true,
  },
  selectedEdgeId: {
    get: () => AppState.selectedEdgeId,
    set: (v) => {
      AppState.selectedEdgeId = v;
    },
    configurable: true,
  },
  hoveredNodeId: {
    get: () => AppState.hoveredNodeId,
    set: (v) => {
      AppState.hoveredNodeId = v;
    },
    configurable: true,
  },
  connectingFrom: {
    get: () => AppState.connectingFrom,
    set: (v) => {
      AppState.connectingFrom = v;
    },
    configurable: true,
  },
  activeOutputTab: {
    get: () => AppState.activeOutputTab,
    set: (v) => {
      AppState.activeOutputTab = v;
    },
    configurable: true,
  },
  isTopDown2D: {
    get: () => AppState.isTopDown2D,
    set: (v) => {
      AppState.isTopDown2D = v;
    },
    configurable: true,
  },
  traceState: {
    get: () => AppState.traceState,
    set: (v) => {
      AppState.traceState = v;
    },
    configurable: true,
  },
  historyStack: {
    get: () => AppState.history.undoStack,
    set: (v) => {
      AppState.history.undoStack = Array.isArray(v) ? v : [];
    },
    configurable: true,
  },
  redoStack: {
    get: () => AppState.history.redoStack,
    set: (v) => {
      AppState.history.redoStack = Array.isArray(v) ? v : [];
    },
    configurable: true,
  },
  testCases: {
    get: () => AppState.testCases,
    set: (v) => {
      AppState.testCases = Array.isArray(v) ? v : [];
    },
    configurable: true,
  },
});

let inputFocusSnapshot = null;
let autoPlayTimer = null;
const cppLineMaps = new WeakMap(); // graph -> { nodeId: [dòng C++] }
let cppLineIndex = {}; // tab -> { nodeId: [dòng tuyệt đối] }
let capsuleSpeedMult = 1;

// 9. PRESETS & GRAPH MANAGEMENT
// =========================================================================
function getPresetGraphData(name) {
  if (name === "perfect") {
    return {
      signature: "int main()",
      nodes: [
        {
          id: "n1",
          type: "start",
          content: "Start",
          x: 260,
          y: 30,
          bp: false,
        },
        {
          id: "n2",
          type: "input",
          content: "n",
          x: 260,
          y: 105,
          bp: false,
        },
        {
          id: "n3",
          type: "process",
          content: "i = 1",
          x: 260,
          y: 180,
          bp: false,
        },
        {
          id: "n4",
          type: "decision",
          content: "i <= n",
          x: 260,
          y: 260,
          bp: false,
        },
        {
          id: "n5",
          type: "process",
          content: "tong = 0; x = i; j = 1",
          x: 260,
          y: 345,
          bp: false,
        },
        {
          id: "n6",
          type: "decision",
          content: "j <= Math.floor(x/2)",
          x: 260,
          y: 430,
          bp: false,
        },
        {
          id: "n7",
          type: "decision",
          content: "x % j == 0",
          x: 260,
          y: 520,
          bp: false,
        },
        {
          id: "n8",
          type: "process",
          content: "tong += j",
          x: 120,
          y: 605,
          bp: false,
        },
        {
          id: "n9",
          type: "process",
          content: "j++",
          x: 260,
          y: 690,
          bp: true,
        },
        {
          id: "n10",
          type: "decision",
          content: "x == tong && x != 1",
          x: 520,
          y: 520,
          bp: false,
        },
        {
          id: "n11",
          type: "output",
          content: "x",
          x: 520,
          y: 610,
          bp: false,
        },
        {
          id: "n12",
          type: "process",
          content: "i++",
          x: 520,
          y: 700,
          bp: false,
        },
        {
          id: "n13",
          type: "end",
          content: "End",
          x: 520,
          y: 345,
          bp: false,
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5", branch: "true" },
        { id: "e5", source: "n4", target: "n13", branch: "false" },
        { id: "e6", source: "n5", target: "n6" },
        { id: "e7", source: "n6", target: "n7", branch: "true" },
        { id: "e8", source: "n7", target: "n8", branch: "true" },
        { id: "e9", source: "n8", target: "n9" },
        { id: "e10", source: "n7", target: "n9", branch: "false" },
        { id: "e11", source: "n9", target: "n6" },
        { id: "e12", source: "n6", target: "n10", branch: "false" },
        { id: "e13", source: "n10", target: "n11", branch: "true" },
        { id: "e14", source: "n11", target: "n12" },
        { id: "e15", source: "n10", target: "n12", branch: "false" },
        { id: "e16", source: "n12", target: "n4" },
      ],
    };
  } else if (name === "array") {
    return {
      signature: "int main()",
      nodes: [
        {
          id: "a1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "a2",
          type: "process",
          content: "a = [4, 7, 2, 9, 5]; n = 5",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "a3",
          type: "process",
          content: "sum = 0; i = 0",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "a4",
          type: "decision",
          content: "i < n",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "a5",
          type: "process",
          content: "sum = sum + a[i]",
          x: 280,
          y: 375,
          bp: true,
        },
        {
          id: "a6",
          type: "process",
          content: "i++",
          x: 280,
          y: 460,
          bp: false,
        },
        {
          id: "a7",
          type: "output",
          content: "sum",
          x: 520,
          y: 375,
          bp: false,
        },
        {
          id: "a8",
          type: "end",
          content: "End",
          x: 520,
          y: 460,
          bp: false,
        },
      ],
      edges: [
        { id: "e1", source: "a1", target: "a2" },
        { id: "e2", source: "a2", target: "a3" },
        { id: "e3", source: "a3", target: "a4" },
        { id: "e4", source: "a4", target: "a5", branch: "true" },
        { id: "e5", source: "a5", target: "a6" },
        { id: "e6", source: "a6", target: "a4" },
        { id: "e7", source: "a4", target: "a7", branch: "false" },
        { id: "e8", source: "a7", target: "a8" },
      ],
    };
  } else if (name === "types") {
    return {
      signature: "int main()",
      nodes: [
        {
          id: "t1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "t2",
          type: "process",
          content: "a = [4, 7, 2, 9]; n = 4",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "t3",
          type: "process",
          content: 'pi = 3.14; msg = "Dat chuan"; ok = true',
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "t4",
          type: "decision",
          content: "ok",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "t5",
          type: "process",
          content: "area = pi * a[0] * a[0]",
          x: 140,
          y: 375,
          bp: false,
        },
        {
          id: "t6",
          type: "process",
          content: "area = 0.5",
          x: 420,
          y: 375,
          bp: false,
        },
        {
          id: "t7",
          type: "output",
          content: "area",
          x: 280,
          y: 470,
          bp: false,
        },
        {
          id: "t8",
          type: "end",
          content: "End",
          x: 280,
          y: 555,
          bp: false,
        },
      ],
      edges: [
        { id: "te1", source: "t1", target: "t2" },
        { id: "te2", source: "t2", target: "t3" },
        { id: "te3", source: "t3", target: "t4" },
        { id: "te4", source: "t4", target: "t5", branch: "true" },
        { id: "te5", source: "t4", target: "t6", branch: "false" },
        { id: "te6", source: "t5", target: "t7" },
        { id: "te7", source: "t6", target: "t7" },
        { id: "te8", source: "t7", target: "t8" },
      ],
    };
  } else if (name === "dowhile") {
    return {
      signature: "int main()",
      nodes: [
        {
          id: "d1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "d2",
          type: "input",
          content: "n",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "d3",
          type: "process",
          content: "tong = 0; i = 1",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "d4",
          type: "process",
          content: "tong += i; i++",
          x: 280,
          y: 285,
          bp: true,
        },
        {
          id: "d5",
          type: "decision",
          content: "i <= n",
          x: 280,
          y: 375,
          bp: false,
        },
        {
          id: "d6",
          type: "output",
          content: "tong",
          x: 280,
          y: 470,
          bp: false,
        },
        {
          id: "d7",
          type: "end",
          content: "End",
          x: 280,
          y: 555,
          bp: false,
        },
      ],
      edges: [
        { id: "de1", source: "d1", target: "d2" },
        { id: "de2", source: "d2", target: "d3" },
        { id: "de3", source: "d3", target: "d4" },
        { id: "de4", source: "d4", target: "d5" },
        { id: "de5", source: "d5", target: "d4", branch: "true" },
        { id: "de6", source: "d5", target: "d6", branch: "false" },
        { id: "de7", source: "d6", target: "d7" },
      ],
    };
  } else if (name === "matrix2d") {
    return {
      signature: "int main()",
      nodes: [
        {
          id: "m1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "m2",
          type: "process",
          content: "a = [[1, 2], [3, 4]]; n = 2; m = 2",
          x: 280,
          y: 115,
          bp: false,
        },
        {
          id: "m3",
          type: "process",
          content: "sum = 0; i = 0",
          x: 280,
          y: 190,
          bp: false,
        },
        {
          id: "m4",
          type: "decision",
          content: "i < n",
          x: 280,
          y: 265,
          bp: false,
        },
        {
          id: "m5",
          type: "process",
          content: "j = 0",
          x: 280,
          y: 345,
          bp: false,
        },
        {
          id: "m6",
          type: "decision",
          content: "j < m",
          x: 280,
          y: 425,
          bp: false,
        },
        {
          id: "m7",
          type: "process",
          content: "sum += a[i][j]; j++",
          x: 280,
          y: 510,
          bp: true,
        },
        {
          id: "m8",
          type: "process",
          content: "i++",
          x: 520,
          y: 425,
          bp: false,
        },
        {
          id: "m9",
          type: "output",
          content: "sum",
          x: 520,
          y: 265,
          bp: false,
        },
        {
          id: "m10",
          type: "end",
          content: "End",
          x: 520,
          y: 345,
          bp: false,
        },
      ],
      edges: [
        { id: "me1", source: "m1", target: "m2" },
        { id: "me2", source: "m2", target: "m3" },
        { id: "me3", source: "m3", target: "m4" },
        { id: "me4", source: "m4", target: "m5", branch: "true" },
        { id: "me5", source: "m5", target: "m6" },
        { id: "me6", source: "m6", target: "m7", branch: "true" },
        { id: "me7", source: "m7", target: "m6" },
        { id: "me8", source: "m6", target: "m8", branch: "false" },
        { id: "me9", source: "m8", target: "m4" },
        { id: "me10", source: "m4", target: "m9", branch: "false" },
        { id: "me11", source: "m9", target: "m10" },
      ],
    };
  }
  return null;
}

function loadPreset(name, recordHistory = false) {
  if (recordHistory && Object.keys(tabs).length > 0) {
    pushHistoryState();
  }
  stopAutoPlay();
  traceState.active = false;
  if (dataCapsuleMesh) dataCapsuleMesh.visible = false;
  selectedNodeId = null;

  if (name === "modular") {
    tabs[activeTab || "main"] = {
      signature: "int main()",
      nodes: [
        {
          id: "m1",
          type: "start",
          content: "Start",
          x: 280,
          y: 50,
          bp: false,
        },
        {
          id: "m2",
          type: "input",
          content: "n",
          x: 280,
          y: 135,
          bp: false,
        },
        {
          id: "m3",
          type: "subroutine",
          content: "kq = tinhTongUoc(n)",
          x: 280,
          y: 225,
          bp: true,
        },
        {
          id: "m4",
          type: "output",
          content: "kq",
          x: 280,
          y: 315,
          bp: false,
        },
        {
          id: "m5",
          type: "end",
          content: "End",
          x: 280,
          y: 400,
          bp: false,
        },
      ],
      edges: [
        { id: "e1", source: "m1", target: "m2" },
        { id: "e2", source: "m2", target: "m3" },
        { id: "e3", source: "m3", target: "m4" },
        { id: "e4", source: "m4", target: "m5" },
      ],
    };
    tabs["tinhTongUoc"] = {
      signature: "int tinhTongUoc(int x)",
      nodes: [
        {
          id: "f1",
          type: "start",
          content: "Start tinhTongUoc(x)",
          x: 280,
          y: 45,
          bp: false,
        },
        {
          id: "f2",
          type: "process",
          content: "s = 0; j = 1",
          x: 280,
          y: 130,
          bp: false,
        },
        {
          id: "f3",
          type: "decision",
          content: "j <= x / 2",
          x: 280,
          y: 215,
          bp: false,
        },
        {
          id: "f4",
          type: "process",
          content: "s += (x % j == 0 ? j : 0)",
          x: 280,
          y: 305,
          bp: false,
        },
        {
          id: "f5",
          type: "process",
          content: "j++",
          x: 280,
          y: 390,
          bp: false,
        },
        {
          id: "f6",
          type: "return",
          content: "return s",
          x: 520,
          y: 305,
          bp: false,
        },
      ],
      edges: [
        { id: "fe1", source: "f1", target: "f2" },
        { id: "fe2", source: "f2", target: "f3" },
        { id: "fe3", source: "f3", target: "f4", branch: "true" },
        { id: "fe4", source: "f4", target: "f5" },
        { id: "fe5", source: "f5", target: "f3" },
        { id: "fe6", source: "f3", target: "f6", branch: "false" },
      ],
    };
  } else {
    const presetGraph =
      getPresetGraphData(name) || getPresetGraphData("perfect");
    if (Object.keys(tabs).length === 0) {
      tabs = { main: presetGraph };
      activeTab = "main";
    } else {
      const currSig = tabs[activeTab]?.signature || "int main()";
      tabs[activeTab] = {
        ...presetGraph,
        signature: activeTab === "main" ? "int main()" : currSig,
      };
    }
  }

  renderTabs();
  renderAll();
  resetCameraView();
}

// HOTFIX [BUG-01]: Null-safe guard fallback khi tabs rỗng hoặc activeTab chưa khởi tạo
function currGraph() {
  if (
    !tabs ||
    typeof tabs !== "object" ||
    Object.keys(tabs).length === 0
  ) {
    tabs = { main: createBlankGraph("main") };
    activeTab = "main";
  }
  if (!tabs[activeTab]) {
    activeTab = Object.keys(tabs)[0] || "main";
    if (!tabs[activeTab]) {
      tabs[activeTab] = createBlankGraph(activeTab);
    }
  }
  if (!Array.isArray(tabs[activeTab].nodes)) tabs[activeTab].nodes = [];
  if (!Array.isArray(tabs[activeTab].edges)) tabs[activeTab].edges = [];
  return tabs[activeTab];
}

function renderTabs() {
  const container = document.getElementById("tabContainer");
  if (!container) return;
  container.innerHTML = "";
  Object.keys(tabs).forEach((tKey) => {
    const btn = document.createElement("button");
    btn.className = `px-2.5 py-1 rounded mono text-xs mr-0.5 transition ${
      tKey === activeTab
        ? "bg-indigo-600 text-white font-semibold shadow"
        : "text-slate-400 hover:text-white hover:bg-[#1b2033]"
    }`;
    btn.textContent = tKey === "main" ? "🏙 main()" : `📡 ${tKey}()`;
    btn.onclick = () => {
      activeTab = tKey;
      selectedNodeId = null;
      renderTabs();
      renderAll(false);
    };
    container.appendChild(btn);
  });
}


const _v5GetPresetGraphData = getPresetGraphData;
getPresetGraphData = function (name) {
  if (name === "matrix2d") {
    return {
      signature: "int main()",
      nodes: [
        {
          id: "m1",
          type: "start",
          content: "Start",
          x: 280,
          y: 40,
          bp: false,
        },
        {
          id: "m2",
          type: "process",
          content: "mat = [[2, 5, 8], [3, 9, 4], [7, 1, 6]]",
          x: 280,
          y: 120,
          bp: false,
        },
        {
          id: "m3",
          type: "process",
          content: "n = 3; m = 3; tongCheo = 0; i = 0",
          x: 280,
          y: 200,
          bp: false,
        },
        {
          id: "m4",
          type: "decision",
          content: "i < n",
          x: 280,
          y: 285,
          bp: false,
        },
        {
          id: "m5",
          type: "process",
          content: "j = i; tongCheo += mat[i][j]",
          x: 280,
          y: 375,
          bp: true,
        },
        {
          id: "m6",
          type: "process",
          content: "i++",
          x: 280,
          y: 460,
          bp: false,
        },
        {
          id: "m7",
          type: "output",
          content: "tongCheo",
          x: 520,
          y: 375,
          bp: false,
        },
        {
          id: "m8",
          type: "end",
          content: "End",
          x: 520,
          y: 460,
          bp: false,
        },
      ],
      edges: [
        { id: "me1", source: "m1", target: "m2" },
        { id: "me2", source: "m2", target: "m3" },
        { id: "me3", source: "m3", target: "m4" },
        { id: "me4", source: "m4", target: "m5", branch: "true" },
        { id: "me5", source: "m5", target: "m6" },
        { id: "me6", source: "m6", target: "m4" },
        { id: "me7", source: "m4", target: "m7", branch: "false" },
        { id: "me8", source: "m7", target: "m8" },
      ],
    };
  }
  return _v5GetPresetGraphData(name);
};



// ============================================================================
// CÁC HÀM ĐIỀU KHIỂN ĐỒ THỊ & LỊCH SỬ GỌI QUA PHƯƠNG THỨC NGUYÊN TỬ CỦA AppState
// ============================================================================

function currGraph() {
  return AppState.getCurrentGraph();
}

function selectNode(nodeId) {
  AppState.selectedNodeId = nodeId;
  AppState.emit("nodeSelected", { nodeId });
  updateEditorPanel();
  rebuild3DCityScene();
}

function addNode(type, defaultText = "kq = tinhTongUoc(n)", x, y) {
  const id = AppState.addNode(type, defaultText, x, y);
  renderAll();
  setStatusText(`Đã xây dựng [${BUILDING_PALETTE[type]?.label || type}]`);
  return id;
}

function nudgeSelectedNode(dx, dy) {
  const node = AppState.getCurrentGraph().nodes.find(
    (n) => n.id === AppState.selectedNodeId
  );
  if (!node) return;
  const nextX = Math.max(40, Math.round((node.x + dx) / 20) * 20);
  const nextY = Math.max(20, Math.round((node.y + dy) / 20) * 20);
  AppState.updateNode(node.id, { x: nextX, y: nextY }, true);
  renderAll();
}

function updateEditorPanel() {
  const box = document.getElementById("nodeEditor");
  if (!box) return;
  const g = AppState.getCurrentGraph();
  const node = g?.nodes.find((n) => n.id === AppState.selectedNodeId);
  if (!node) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  const inp = document.getElementById("nodeContentInput");
  if (inp && document.activeElement !== inp) {
    inp.value = node.content;
  }
  const bpInp = document.getElementById("nodeBpInput");
  if (bpInp) bpInp.checked = !!node.bp;

  const layers = computeNodeElevationLayers(g.nodes, g.edges);
  const lBadge = document.getElementById("selectedLayerBadge");
  if (lBadge) lBadge.textContent = `Tầng L${layers[node.id] || 0}`;

  const edgesBox = document.getElementById("selectedEdgesBox");
  if (!edgesBox) return;
  const outEdges = g.edges.filter((e) => e.source === node.id);
  if (outEdges.length === 0) {
    edgesBox.innerHTML = `<div class="text-slate-500">Chưa có đường nối ra. Nhấp nút <b>+Out / +True</b> trên công trình để nối.</div>`;
  } else {
    edgesBox.innerHTML = outEdges
      .map((e) => {
        const targetNode = g.nodes.find((n) => n.id === e.target);
        const brTag = e.branch ? `(${e.branch.toUpperCase()})` : "";
        return `
      <div class="flex items-center justify-between bg-[#121521] px-2 py-1 rounded border border-[#232942]">
        <span class="mono truncate text-slate-300">${brTag} ➔ ${escapeHtml(targetNode?.content || e.target)}</span>
        <button onclick="removeEdgeById('${e.id}')" class="text-rose-400 hover:text-rose-200 px-1" title="Xóa đường nối này">✕</button>
      </div>
    `;
      })
      .join("");
  }
}

function removeEdgeById(edgeId) {
  if (AppState.deleteEdge(edgeId)) {
    renderAll();
  }
}

function updateSelectedNodeContent(val) {
  const node = AppState.getCurrentGraph().nodes.find(
    (n) => n.id === AppState.selectedNodeId
  );
  if (node) {
    if (inputFocusSnapshot) {
      AppState.pushHistory(inputFocusSnapshot);
      inputFocusSnapshot = null;
    }
    AppState.updateNode(node.id, { content: val }, false);
    renderAll();
  }
}

function toggleSelectedBreakpoint(checked) {
  const node = AppState.getCurrentGraph().nodes.find(
    (n) => n.id === AppState.selectedNodeId
  );
  if (node) {
    AppState.updateNode(node.id, { bp: checked }, true);
    renderAll();
  }
}

function toggleNodeBreakpointById(nodeId) {
  const node = AppState.getCurrentGraph().nodes.find((n) => n.id === nodeId);
  if (node) {
    AppState.updateNode(node.id, { bp: !node.bp }, true);
    renderAll();
  }
}

function deleteSelectedNode() {
  if (!AppState.selectedNodeId) return;
  const removed = AppState.deleteNode(AppState.selectedNodeId);
  renderAll();
  if (removed) {
    setStatusText(`Đã phá dỡ công trình [${removed.content}]`);
  }
}

function deleteNodeById(nodeId) {
  if (!nodeId) return;
  AppState.selectedNodeId = nodeId;
  deleteSelectedNode();
}

function startConnection(nodeId, branch) {
  AppState.connectingFrom = { nodeId, branch };
  const brName = branch ? `nhánh ${branch.toUpperCase()}` : "cổng ra";
  setStatusText(
    `Đang kéo cầu vượt từ ${nodeId} (${brName})... Nhấp ➔In ở công trình đích!`
  );
}

function finishConnection(targetId) {
  if (!AppState.connectingFrom) return;
  const fromId = AppState.connectingFrom.nodeId;
  const branch = AppState.connectingFrom.branch || null;

  if (fromId === targetId) {
    AppState.connectingFrom = null;
    if (typeof hideRubberbandWirePreview === "function") {
      hideRubberbandWirePreview();
    }
    if (typeof SoundManager !== "undefined") {
      SoundManager.play("sfx_node_delete");
    }
    setStatusText(
      "Đã hủy nối dây: Không thể tự nối công trình vào chính nó."
    );
    return;
  }

  const createdEdge = AppState.addEdge(fromId, targetId, branch);
  if (typeof hideRubberbandWirePreview === "function") {
    hideRubberbandWirePreview();
  }
  if (!createdEdge) return;

  setStatusText("Đã xây cầu vượt nối 2 công trình thành công!");
  renderAll();
}

function serializeState() {
  return AppState.serialize();
}

function pushHistoryState(customSnapshotStr = null) {
  AppState.pushHistory(customSnapshotStr);
}

function captureHistoryBeforeInput() {
  inputFocusSnapshot = AppState.serialize();
}

function undoAction() {
  if (AppState.undo()) {
    renderTabs();
    renderAll(false);
    setStatusText("Đã hoàn tác (Undo)");
  }
}

function redoAction() {
  if (AppState.redo()) {
    renderTabs();
    renderAll(false);
    setStatusText("Đã làm lại (Redo)");
  }
}

function restoreFromSnapshot(snapStr) {
  AppState._restoreSnapshot(snapStr);
  renderTabs();
  renderAll(false);
}

function updateUndoRedoUI() {
  const btnUndo = document.getElementById("btnUndo");
  const btnRedo = document.getElementById("btnRedo");
  if (btnUndo) btnUndo.disabled = AppState.history.undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = AppState.history.redoStack.length === 0;
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: "6.1",
        tabs: AppState.tabs,
        activeTab: AppState.activeTab,
        testCases: AppState.testCases,
      })
    );
  } catch (e) {}
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data && data.tabs && Object.keys(data.tabs).length > 0) {
      AppState.tabs = data.tabs;
      AppState.activeTab =
        data.activeTab && AppState.tabs[data.activeTab]
          ? data.activeTab
          : Object.keys(data.tabs)[0];
      if (Array.isArray(data.testCases)) AppState.testCases = data.testCases;
      renderTabs();
      renderAll(false);
      updateUndoRedoUI();
      return true;
    }
  } catch (e) {}
  return false;
}

function exportProjectJSON() {
  const payload = AppState.exportJSON();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `algoflow-city3d-${AppState.activeTab}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function triggerImportJSON() {
  const input = document.getElementById("jsonFileInput");
  if (input) {
    input.value = "";
    input.click();
  }
}

function handleImportJSONFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (AppState.importJSON(e.target.result)) {
        renderTabs();
        renderAll();
      }
    } catch (err) {}
  };
  reader.readAsText(file);
}

function deleteCurrentTab() {
  const keys = Object.keys(AppState.tabs);
  AppState.pushHistory();
  if (keys.length <= 1) {
    AppState.tabs["main"] = createBlankGraph("main");
    AppState.activeTab = "main";
  } else {
    delete AppState.tabs[AppState.activeTab];
    AppState.activeTab = Object.keys(AppState.tabs)[0];
  }
  AppState.selectedNodeId = null;
  AppState.emit("tabSwitched", { activeTab: AppState.activeTab });
  renderTabs();
  renderAll();
}

function resetCurrentTab() {
  AppState.pushHistory();
  AppState.selectedNodeId = null;
  AppState.tabs[AppState.activeTab] = createBlankGraph(AppState.activeTab);
  AppState.emit("graphChanged", { reason: "resetCurrentTab" });
  renderTabs();
  renderAll();
  resetCameraView();
}

function createBlankGraph(tabName) {
  const isMain = tabName === "main";
  return {
    signature: isMain ? "int main()" : `int ${tabName}(int x)`,
    nodes: [
      {
        id: "b1",
        type: "start",
        content: isMain ? "Start" : `Start ${tabName}(x)`,
        x: 280,
        y: 60,
        bp: false,
      },
      {
        id: "b2",
        type: isMain ? "end" : "return",
        content: isMain ? "End" : "return 0",
        x: 280,
        y: 200,
        bp: false,
      },
    ],
    edges: [{ id: "be1", source: "b1", target: "b2", branch: null }],
  };
}

function setStatusText(msg) {
  const el = document.getElementById("traceStatus");
  if (el) el.textContent = msg;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderAll(persist = true) {
  rebuild3DCityScene();
  updateEditorPanel();
  compileAll();
  renderTestCases();
  updateUndoRedoUI();
  if (persist) saveToLocalStorage();
}
