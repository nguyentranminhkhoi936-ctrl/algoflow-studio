// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/hud2d.js
// Mô tả: Lớp phủ HTML 2D HUD trên Canvas, cổng nối dây (➔In, +Out, +True, +False),
//        dây nối Bezier SVG cao su (rubberbandWireSvg), bắt lưới thông minh 20px
//        (Grid Snap), In-place Editor, Mini Toolbar và Pan/Zoom 2D tự do.
// ============================================================================


function getWorldPointOnHorizontalPlane(clientX, clientY, planeY = 0) {
  const mount = document.getElementById("threeCanvasMount");
  if (!mount || !camera || !raycaster) return null;
  const rect = mount.getBoundingClientRect();
  mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const targetPt = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(plane, targetPt);
  return hit ? targetPt : null;
}

function pickBuildingNodeAtClientPos(clientX, clientY) {
  const mount = document.getElementById("threeCanvasMount");
  if (!mount || !camera || !raycaster || !buildingsGroup) return null;
  const rect = mount.getBoundingClientRect();
  mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const intersects = raycaster.intersectObjects(
    buildingsGroup.children,
    true,
  );
  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData?.nodeId) {
      obj = obj.parent;
    }
    if (obj && obj.userData?.nodeId) return obj.userData.nodeId;
  }
  return null;
}

function begin2DBuildingDrag(nodeId, clientX, clientY) {
  if (!isTopDown2D || !nodeId) return false;
  const g = currGraph();
  const node = g?.nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  const layerMap = computeNodeElevationLayers(g.nodes, g.edges);
  const pos3D = graphToWorld3D(node, layerMap);
  const hitPt = getWorldPointOnHorizontalPlane(clientX, clientY, pos3D.y);
  if (!hitPt) return false;

  draggingBuildingState = {
    active: true,
    nodeId,
    planeY: pos3D.y,
    offsetX: pos3D.x - hitPt.x,
    offsetZ: pos3D.z - hitPt.z,
    moved: false,
    historySaved: false,
  };
  if (controls) controls.enabled = false;
  selectedNodeId = nodeId;
  updateEditorPanel();
  return true;
}

function update2DBuildingDrag(clientX, clientY) {
  if (!draggingBuildingState.active || !draggingBuildingState.nodeId)
    return;
  const g = currGraph();
  const node = g?.nodes.find(
    (n) => n.id === draggingBuildingState.nodeId,
  );
  if (!node) return;
  const hitPt = getWorldPointOnHorizontalPlane(
    clientX,
    clientY,
    draggingBuildingState.planeY,
  );
  if (!hitPt) return;

  if (!draggingBuildingState.historySaved) {
    pushHistoryState();
    draggingBuildingState.historySaved = true;
  }
  draggingBuildingState.moved = true;

  const targetWX = hitPt.x + draggingBuildingState.offsetX;
  const targetWZ = hitPt.z + draggingBuildingState.offsetZ;

  // [UPGRADE FEATURE 2]: Smart Grid Snapping (20px grid)
  const rawX = targetWX / 0.95 + 320;
  const rawY = targetWZ / 0.92 + 260;
  node.x = Math.max(40, Math.round(rawX / 20) * 20);
  node.y = Math.max(20, Math.round(rawY / 20) * 20);

  rebuild3DCityScene();
  updateHudPositions();
}

function end2DBuildingDrag() {
  if (!draggingBuildingState.active) return;
  const wasMoved = draggingBuildingState.moved;
  const draggedId = draggingBuildingState.nodeId;
  draggingBuildingState.active = false;
  draggingBuildingState.nodeId = null;
  if (controls) {
    controls.enabled = true;
    controls.enableRotate = !isTopDown2D;
  }
  if (wasMoved) {
    compileAll();
    saveToLocalStorage();
    setStatusText(`Đã kéo thả cập nhật tọa độ công trình [${draggedId}]`);
  } else if (draggedId) {
    selectNode(draggedId);
  }
}

function initViewportPointerAndTouchInteractions() {
  let downPos = { x: 0, y: 0 };
  const dom = renderer.domElement;

  dom.addEventListener("mousedown", (e) => {
    downPos = { x: e.clientX, y: e.clientY };
    if (e.button === 0 && isTopDown2D) {
      const hitNodeId = pickBuildingNodeAtClientPos(e.clientX, e.clientY);
      if (hitNodeId) {
        if (connectingFrom && connectingFrom.nodeId !== hitNodeId) {
          finishConnection(hitNodeId);
          return;
        }
        begin2DBuildingDrag(hitNodeId, e.clientX, e.clientY);
      }
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (draggingBuildingState.active) {
      update2DBuildingDrag(e.clientX, e.clientY);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (draggingBuildingState.active) {
      end2DBuildingDrag();
      return;
    }
    const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (dist < 6 && e.button === 0 && e.target === dom) {
      handleCanvas3DClick(e);
    }
  });

  // Touch Events Support for Mobile/Tablet (1-finger select/drag in 2D, 2-finger pinch zoom)
  let touchStartPos = { x: 0, y: 0 };
  dom.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartPos = { x: t.clientX, y: t.clientY };
        if (isTopDown2D) {
          const hitNodeId = pickBuildingNodeAtClientPos(
            t.clientX,
            t.clientY,
          );
          if (hitNodeId) {
            if (connectingFrom && connectingFrom.nodeId !== hitNodeId) {
              finishConnection(hitNodeId);
              return;
            }
            begin2DBuildingDrag(hitNodeId, t.clientX, t.clientY);
          }
        }
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (draggingBuildingState.active && e.touches.length === 1) {
        const t = e.touches[0];
        update2DBuildingDrag(t.clientX, t.clientY);
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "touchend",
    (e) => {
      if (draggingBuildingState.active) {
        end2DBuildingDrag();
        return;
      }
      if (e.changedTouches && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const dist = Math.hypot(
          t.clientX - touchStartPos.x,
          t.clientY - touchStartPos.y,
        );
        if (dist < 10 && e.target === dom) {
          handleCanvas3DClick({ clientX: t.clientX, clientY: t.clientY });
        }
      }
    },
    { passive: true },
  );
}


// =========================================================================
// 7. 2D PROJECTED FLOATING HUD BADGES & INTERACTIVE PORTS
// =========================================================================
function buildHudOverlayElements(nodes, layerMap, errorNodeIds) {
  const overlay = document.getElementById("hudOverlayLayer");
  if (!overlay) return;
  overlay.innerHTML = "";

  nodes.forEach((node) => {
    const layer = layerMap[node.id] || 0;
    const isSel = node.id === selectedNodeId;
    const isTrace =
      traceState.active && traceState.currNodeId === node.id;
    const hasErr = errorNodeIds.has(node.id);
    const pal = BUILDING_PALETTE[node.type] || BUILDING_PALETTE.process;

    const badge = document.createElement("div");
    badge.id = `hud_${node.id}`;
    badge.className = `city-hud-label rounded-lg bg-[#0d101b]/92 backdrop-blur px-2.5 py-1.5 border ${
      isTrace
        ? "border-amber-400 hud-trace"
        : isSel
          ? "border-indigo-400 hud-selected"
          : hasErr
            ? "border-rose-500 hud-error"
            : "border-[#283152] hover:border-indigo-400/70"
    }`;

    // [UPGRADE FEATURE 2]: Kéo thả trực tiếp khối lệnh (bắt lưới 20px) hoặc chọn khối
    badge.onmousedown = (e) => {
      if (
        e.button === 0 &&
        !e.target.classList.contains("hud-port") &&
        !e.target.classList.contains("hud-quick-delete") &&
        e.target.tagName !== "INPUT"
      ) {
        e.stopPropagation();
        beginHudCardDrag(node.id, e.clientX, e.clientY);
      }
    };
    badge.ontouchstart = (e) => {
      if (
        isTopDown2D &&
        e.touches.length === 1 &&
        !e.target.classList.contains("hud-port")
      ) {
        const t = e.touches[0];
        begin2DBuildingDrag(node.id, t.clientX, t.clientY);
      }
    };
    badge.onclick = (e) => {
      e.stopPropagation();
      if (!draggingBuildingState.moved) selectNode(node.id);
    };

    // Top row: Breakpoint Dot + Type Label + Elevation Layer Pill
    const bpColor = node.bp
      ? "bg-rose-500 ring-2 ring-white"
      : "bg-slate-700 hover:bg-rose-400";
    const layerTag =
      layer > 0
        ? `<span class="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] mono font-bold">L${layer}</span>`
        : `<span class="px-1 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px] mono">L0</span>`;

    // [UPGRADE FEATURE 2]: Interactive Ports Row with Rubberband Dragging & Magnetic Snap
    let portsHtml = "";
    if (node.type !== "start") {
      portsHtml += `<span
        data-port-in="${node.id}"
        onmouseenter="onPortInHover('${node.id}', true, this)"
        onmouseleave="onPortInHover('${node.id}', false, this)"
        onmouseup="event.stopPropagation(); completeRubberbandConnection('${node.id}')"
        onclick="event.stopPropagation(); finishConnection('${node.id}')"
        class="hud-port hud-port-in bg-slate-700 text-slate-200 border border-slate-400"
        title="Cổng Vào (Kéo thả dây vào đây hoặc nhấp để nối tới công trình này)"
      >➔In</span>`;
    }
    if (node.type !== "end" && node.type !== "return") {
      if (node.type === "decision") {
        portsHtml += `<span
          data-port-out="${node.id}:true"
          onmousedown="event.stopPropagation(); beginRubberbandDrag(event, '${node.id}', 'true', this)"
          ontouchstart="event.stopPropagation(); beginRubberbandDragTouch(event, '${node.id}', 'true', this)"
          onclick="event.stopPropagation(); startConnection('${node.id}', 'true')"
          class="hud-port port-true bg-emerald-500/25 text-emerald-300 border border-emerald-400/60"
          title="Nhấn giữ và kéo dây nhánh Đúng (True) hoặc nhấp để nối"
        >+True</span>`;
        portsHtml += `<span
          data-port-out="${node.id}:false"
          onmousedown="event.stopPropagation(); beginRubberbandDrag(event, '${node.id}', 'false', this)"
          ontouchstart="event.stopPropagation(); beginRubberbandDragTouch(event, '${node.id}', 'false', this)"
          onclick="event.stopPropagation(); startConnection('${node.id}', 'false')"
          class="hud-port port-false bg-rose-500/25 text-rose-300 border border-rose-400/60"
          title="Nhấn giữ và kéo dây nhánh Sai (False) hoặc nhấp để nối"
        >+False</span>`;
      } else {
        portsHtml += `<span
          data-port-out="${node.id}:out"
          onmousedown="event.stopPropagation(); beginRubberbandDrag(event, '${node.id}', null, this)"
          ontouchstart="event.stopPropagation(); beginRubberbandDragTouch(event, '${node.id}', null, this)"
          onclick="event.stopPropagation(); startConnection('${node.id}', null)"
          class="hud-port port-out bg-indigo-500/25 text-indigo-300 border border-indigo-400/60"
          title="Nhấn giữ và kéo dây nối trực tiếp hoặc nhấp để nối"
        >+Out</span>`;
      }
    }

    // [UPGRADE FEATURE 2]: Double-click In-Place Editor & Quick Delete Trash Button
    badge.ondblclick = (e) => {
      e.stopPropagation();
      openInPlaceNodeEditor(node.id);
    };
    badge.onmouseenter = () => {
      if (
        connectingFrom &&
        connectingFrom.nodeId !== node.id &&
        node.type !== "start"
      ) {
        badge.classList.add("port-target-hover");
        magneticTargetNodeId = node.id;
      }
    };
    badge.onmouseleave = () => {
      badge.classList.remove("port-target-hover");
      if (magneticTargetNodeId === node.id) magneticTargetNodeId = null;
    };
    badge.onmouseup = (e) => {
      if (
        rubberbandDragState.active &&
        connectingFrom &&
        connectingFrom.nodeId !== node.id &&
        node.type !== "start"
      ) {
        e.stopPropagation();
        completeRubberbandConnection(node.id);
      }
    };

    badge.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-0.5">
      <div class="flex items-center gap-1">
        <span onclick="event.stopPropagation(); toggleNodeBreakpointById('${node.id}')" class="w-2.5 h-2.5 rounded-full inline-block cursor-pointer ${bpColor}" title="Bật/Tắt Breakpoint"></span>
        <span class="text-[9px] font-bold tracking-wider uppercase text-slate-400">${pal.label}</span>
      </div>
      <div class="flex items-center gap-1">
        ${layerTag}
        <button
          onclick="event.stopPropagation(); deleteNodeById('${node.id}')"
          class="hud-quick-delete px-1 py-0.2 rounded bg-rose-500/25 hover:bg-rose-500/50 text-rose-300 border border-rose-400/40 text-[9px] leading-none"
          title="Xóa nhanh khối lệnh này"
        >🗑</button>
      </div>
    </div>
    <div
      id="hud_content_${node.id}"
      title="Nhấp đúp chuột (Double-click) để sửa nhanh biểu thức tại chỗ"
      class="text-xs mono font-semibold text-white max-w-[190px] truncate"
    >${escapeHtml(node.content)}</div>
    <div class="flex items-center justify-center gap-1 mt-1 pt-0.5 border-t border-[#1e243d]">
      ${portsHtml}
    </div>
  `;

    overlay.appendChild(badge);
  });
}

function updateHudPositions() {
  if (!camera || !renderer) return;
  const g = currGraph();
  if (!g) return;
  const mount = document.getElementById("threeCanvasMount");
  const width = mount.clientWidth;
  const height = mount.clientHeight;

  g.nodes.forEach((node) => {
    const meshGroup = buildingMeshesMap[node.id];
    const badge = document.getElementById(`hud_${node.id}`);
    if (!meshGroup || !badge) return;

    const worldPos = meshGroup.position.clone();
    worldPos.y += node.type === "subroutine" ? 56 : 42;
    worldPos.project(camera);

    const screenX = (worldPos.x * 0.5 + 0.5) * width;
    const screenY = (-(worldPos.y * 0.5) + 0.5) * height;

    if (
      worldPos.z > 1 ||
      screenX < -100 ||
      screenX > width + 100 ||
      screenY < -100 ||
      screenY > height + 100
    ) {
      badge.style.display = "none";
    } else {
      badge.style.display = "block";
      badge.style.left = `${Math.round(screenX)}px`;
      badge.style.top = `${Math.round(screenY)}px`;
    }
  });
}

function handleCanvas3DClick(event) {
  const mount = document.getElementById("threeCanvasMount");
  const rect = mount.getBoundingClientRect();
  mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouseVec, camera);
  const intersects = raycaster.intersectObjects(
    buildingsGroup.children,
    true,
  );

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData?.nodeId) {
      obj = obj.parent;
    }
    if (obj && obj.userData?.nodeId) {
      if (
        connectingFrom &&
        connectingFrom.nodeId !== obj.userData.nodeId
      ) {
        finishConnection(obj.userData.nodeId);
      } else {
        selectNode(obj.userData.nodeId);
      }
      return;
    }
  }
}


// =========================================================================
// 19. [UPGRADE FEATURE 2]: INTUITIVE 2D FLOW INTERACTION
//     (Rubberband Wire Dragging, Magnetic Port Snap, 20px Smart Grid Snapping,
//      In-Place Double-Click Editor & Quick Trash Delete)
// =========================================================================
let rubberbandDragState = {
  active: false,
  sourceId: null,
  branch: null,
  startX: 0,
  startY: 0,
};
let magneticTargetNodeId = null;

function deleteNodeById(nodeId) {
  if (!nodeId) return;
  selectedNodeId = nodeId;
  deleteSelectedNode();
}

function openInPlaceNodeEditor(nodeId) {
  const g = currGraph();
  const node = g?.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const contentEl = document.getElementById(`hud_content_${nodeId}`);
  if (!contentEl) return;
  if (contentEl.querySelector("input")) return;

  selectedNodeId = nodeId;
  updateEditorPanel();

  const origVal = node.content;
  const input = document.createElement("input");
  input.type = "text";
  input.value = origVal;
  input.className = "inplace-node-input mono";
  contentEl.innerHTML = "";
  contentEl.appendChild(input);
  input.focus();
  input.select();

  let committed = false;
  const commitChange = (save) => {
    if (committed) return;
    committed = true;
    const newVal = input.value.trim();
    if (save && newVal && newVal !== origVal) {
      pushHistoryState();
      node.content = newVal;
      setStatusText(`Đã cập nhật biểu thức tại chỗ: [${newVal}]`);
    }
    renderAll();
  };

  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitChange(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      commitChange(false);
    }
  });
  input.addEventListener("blur", () => commitChange(true));
}

// Direct HUD Card Drag with 20px Smart Grid Snapping
let hudCardDragState = {
  active: false,
  nodeId: null,
  startClientX: 0,
  startClientY: 0,
  origNodeX: 0,
  origNodeY: 0,
  moved: false,
  historySaved: false,
};

function beginHudCardDrag(nodeId, clientX, clientY) {
  if (isTopDown2D) {
    begin2DBuildingDrag(nodeId, clientX, clientY);
    return;
  }
  const g = currGraph();
  const node = g?.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  hudCardDragState = {
    active: true,
    nodeId,
    startClientX: clientX,
    startClientY: clientY,
    origNodeX: node.x,
    origNodeY: node.y,
    moved: false,
    historySaved: false,
  };
}

window.addEventListener("mousemove", (e) => {
  if (hudCardDragState.active && hudCardDragState.nodeId) {
    const dx = e.clientX - hudCardDragState.startClientX;
    const dy = e.clientY - hudCardDragState.startClientY;
    if (Math.hypot(dx, dy) > 5) {
      const g = currGraph();
      const node = g?.nodes.find((n) => n.id === hudCardDragState.nodeId);
      if (node) {
        if (!hudCardDragState.historySaved) {
          pushHistoryState();
          hudCardDragState.historySaved = true;
        }
        hudCardDragState.moved = true;
        const zoomScale = camera ? Math.max(0.5, camera.zoom) : 1;
        const rawX = hudCardDragState.origNodeX + dx / zoomScale;
        const rawY = hudCardDragState.origNodeY + dy / zoomScale;
        // Smart Grid Snapping (20px)
        node.x = Math.max(40, Math.round(rawX / 20) * 20);
        node.y = Math.max(20, Math.round(rawY / 20) * 20);
        rebuild3DCityScene();
        updateHudPositions();
      }
    }
  }

  // Update Rubberband Wire Preview Line
  if (rubberbandDragState.active || connectingFrom) {
    updateRubberbandWirePreview(e.clientX, e.clientY);
  }
});

window.addEventListener("mouseup", () => {
  if (hudCardDragState.active) {
    const wasMoved = hudCardDragState.moved;
    const draggedId = hudCardDragState.nodeId;
    hudCardDragState.active = false;
    hudCardDragState.nodeId = null;
    if (wasMoved) {
      compileAll();
      saveToLocalStorage();
      setStatusText(`Đã căn lưới 20px công trình [${draggedId}]`);
    } else if (draggedId) {
      selectNode(draggedId);
    }
  }

  if (rubberbandDragState.active) {
    if (
      magneticTargetNodeId &&
      magneticTargetNodeId !== rubberbandDragState.sourceId
    ) {
      completeRubberbandConnection(magneticTargetNodeId);
    } else {
      rubberbandDragState.active = false;
      hideRubberbandWirePreview();
    }
  }
});

function getViewportRelativeCoords(clientX, clientY) {
  const vp = document.getElementById("cityViewport");
  if (!vp) return { x: clientX, y: clientY };
  const rect = vp.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function getPortCenterInViewport(portEl, nodeId) {
  const vp = document.getElementById("cityViewport");
  if (!vp) return { x: 0, y: 0 };
  const vpRect = vp.getBoundingClientRect();
  if (portEl) {
    const r = portEl.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - vpRect.left,
      y: r.top + r.height / 2 - vpRect.top,
    };
  }
  const badge = document.getElementById(`hud_${nodeId}`);
  if (badge) {
    const r = badge.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - vpRect.left,
      y: r.bottom - 10 - vpRect.top,
    };
  }
  return { x: vpRect.width / 2, y: vpRect.height / 2 };
}

function beginRubberbandDrag(event, nodeId, branch, portEl) {
  if (event.button !== 0) return;
  connectingFrom = { nodeId, branch };
  const startPt = getPortCenterInViewport(portEl, nodeId);
  rubberbandDragState = {
    active: true,
    sourceId: nodeId,
    branch,
    startX: startPt.x,
    startY: startPt.y,
  };
  const brName = branch ? `nhánh ${branch.toUpperCase()}` : "cổng ra";
  setStatusText(
    `Đang kéo dây trực tiếp từ ${nodeId} (${brName})... Thả vào cổng ➔In của khối đích!`,
  );
  updateRubberbandWirePreview(event.clientX, event.clientY);
}

function beginRubberbandDragTouch(event, nodeId, branch, portEl) {
  if (!event.touches || event.touches.length !== 1) return;
  const t = event.touches[0];
  connectingFrom = { nodeId, branch };
  const startPt = getPortCenterInViewport(portEl, nodeId);
  rubberbandDragState = {
    active: true,
    sourceId: nodeId,
    branch,
    startX: startPt.x,
    startY: startPt.y,
  };
  updateRubberbandWirePreview(t.clientX, t.clientY);
}

function onPortInHover(targetNodeId, isEntering, portEl) {
  if (!connectingFrom || connectingFrom.nodeId === targetNodeId) return;
  if (isEntering) {
    magneticTargetNodeId = targetNodeId;
    if (portEl) portEl.classList.add("port-magnetic-snap");
  } else {
    if (magneticTargetNodeId === targetNodeId)
      magneticTargetNodeId = null;
    if (portEl) portEl.classList.remove("port-magnetic-snap");
  }
}

function updateRubberbandWirePreview(clientX, clientY) {
  const pathEl = document.getElementById("rubberbandWirePath");
  if (!pathEl || !connectingFrom) return;

  const srcPortSelector = connectingFrom.branch
    ? `[data-port-out="${connectingFrom.nodeId}:${connectingFrom.branch}"]`
    : `[data-port-out="${connectingFrom.nodeId}:out"]`;
  const srcPortEl = document.querySelector(srcPortSelector);
  const startPt = getPortCenterInViewport(
    srcPortEl,
    connectingFrom.nodeId,
  );

  let endPt = getViewportRelativeCoords(clientX, clientY);
  if (
    magneticTargetNodeId &&
    magneticTargetNodeId !== connectingFrom.nodeId
  ) {
    const targetInEl = document.querySelector(
      `[data-port-in="${magneticTargetNodeId}"]`,
    );
    endPt = getPortCenterInViewport(targetInEl, magneticTargetNodeId);
  }

  const dy = endPt.y - startPt.y;
  const ctrlOffset = Math.max(
    40,
    Math.min(140, Math.abs(dy) * 0.55 + 30),
  );
  const c1x = startPt.x;
  const c1y = startPt.y + ctrlOffset;
  const c2x = endPt.x;
  const c2y = endPt.y - ctrlOffset;

  let strokeCol = "#22d3ee";
  if (connectingFrom.branch === "true") strokeCol = "#34d399";
  else if (connectingFrom.branch === "false") strokeCol = "#fb7185";

  pathEl.setAttribute("stroke", strokeCol);
  pathEl.setAttribute(
    "d",
    `M ${startPt.x.toFixed(1)} ${startPt.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${endPt.x.toFixed(1)} ${endPt.y.toFixed(1)}`,
  );
  pathEl.style.display = "block";
}

function hideRubberbandWirePreview() {
  const pathEl = document.getElementById("rubberbandWirePath");
  if (pathEl) {
    pathEl.style.display = "none";
    pathEl.setAttribute("d", "");
  }
  document
    .querySelectorAll(".port-magnetic-snap, .port-target-hover")
    .forEach((el) => {
      el.classList.remove("port-magnetic-snap", "port-target-hover");
    });
}

function completeRubberbandConnection(targetId) {
  rubberbandDragState.active = false;
  magneticTargetNodeId = null;
  hideRubberbandWirePreview();
  if (connectingFrom && connectingFrom.nodeId !== targetId) {
    finishConnection(targetId);
  }
}

// Hook into startConnection & finishConnection so rubberband works for both click-move-click and drag-drop,

// Double-click on 3D Canvas Building also opens In-Place Quick Editor
document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("threeCanvasMount");
  mount?.addEventListener("dblclick", (e) => {
    const hitId = pickBuildingNodeAtClientPos(e.clientX, e.clientY);
    if (hitId) {
      openInPlaceNodeEditor(hitId);
    }
  });
});


// ---------- FEATURE 1: Enhanced Magnetic Snap, Bezier Rubberband & 20px Grid Toast ----------
function showGridSnapToast(node, clientX, clientY) {
  const toast = document.getElementById("gridSnapToast");
  const vp = document.getElementById("cityViewport");
  if (!toast || !vp || !node) return;
  const r = vp.getBoundingClientRect();
  toast.textContent = `🧲 Lưới 20px: (${node.x}, ${node.y})`;
  toast.style.left = `${Math.round(clientX - r.left)}px`;
  toast.style.top = `${Math.round(clientY - r.top - 18)}px`;
  toast.classList.remove("hidden");
}
function hideGridSnapToast() {
  const toast = document.getElementById("gridSnapToast");
  if (toast) toast.classList.add("hidden");
}

// Override updateRubberbandWirePreview to add proximity magnetic snapping (within 42px of any port-in)
// and render both the glowing bezier curve and magnetic snap target ring!
const _v52UpdateRubberband = updateRubberbandWirePreview;
updateRubberbandWirePreview = function (clientX, clientY) {
  const pathEl = document.getElementById("rubberbandWirePath");
  const glowEl = document.getElementById("rubberbandWireGlow");
  const ringEl = document.getElementById("rubberbandSnapRing");
  const arrowPath = document.getElementById("rubberbandArrowPath");
  if (!pathEl || !connectingFrom) return;

  const vp = document.getElementById("cityViewport");
  const vpRect = vp ? vp.getBoundingClientRect() : { left: 0, top: 0 };
  const cursorPt = getViewportRelativeCoords(clientX, clientY);

  // Proximity Magnetic Snap Detection across all candidate target input ports
  let closestNodeId = null;
  let closestDist = 44; // 44px magnetic attraction radius
  let closestPortCenter = null;

  document.querySelectorAll("[data-port-in]").forEach((portEl) => {
    const candId = portEl.getAttribute("data-port-in");
    if (!candId || candId === connectingFrom.nodeId) return;
    const r = portEl.getBoundingClientRect();
    const cx = r.left + r.width / 2 - vpRect.left;
    const cy = r.top + r.height / 2 - vpRect.top;
    const d = Math.hypot(cursorPt.x - cx, cursorPt.y - cy);
    if (d < closestDist) {
      closestDist = d;
      closestNodeId = candId;
      closestPortCenter = { x: cx, y: cy, portEl };
    } else {
      portEl.classList.remove("port-magnetic-snap");
      document
        .getElementById(`hud_${candId}`)
        ?.classList.remove("port-target-hover");
    }
  });

  if (closestNodeId && closestPortCenter) {
    magneticTargetNodeId = closestNodeId;
    closestPortCenter.portEl.classList.add("port-magnetic-snap");
    document
      .getElementById(`hud_${closestNodeId}`)
      ?.classList.add("port-target-hover");
  } else if (magneticTargetNodeId) {
    // Keep hover if cursor is directly inside the badge
    const hoveredBadge = document.getElementById(
      `hud_${magneticTargetNodeId}`,
    );
    if (hoveredBadge) {
      const br = hoveredBadge.getBoundingClientRect();
      const inside =
        clientX >= br.left - 8 &&
        clientX <= br.right + 8 &&
        clientY >= br.top - 8 &&
        clientY <= br.bottom + 8;
      if (!inside) {
        hoveredBadge.classList.remove("port-target-hover");
        magneticTargetNodeId = null;
      }
    }
  }

  const srcPortSelector = connectingFrom.branch
    ? `[data-port-out="${connectingFrom.nodeId}:${connectingFrom.branch}"]`
    : `[data-port-out="${connectingFrom.nodeId}:out"]`;
  const srcPortEl = document.querySelector(srcPortSelector);
  const startPt = getPortCenterInViewport(
    srcPortEl,
    connectingFrom.nodeId,
  );

  let endPt = cursorPt;
  if (
    magneticTargetNodeId &&
    magneticTargetNodeId !== connectingFrom.nodeId
  ) {
    const targetInEl = document.querySelector(
      `[data-port-in="${magneticTargetNodeId}"]`,
    );
    endPt = getPortCenterInViewport(targetInEl, magneticTargetNodeId);
    if (ringEl) {
      ringEl.setAttribute("cx", endPt.x.toFixed(1));
      ringEl.setAttribute("cy", endPt.y.toFixed(1));
      ringEl.style.display = "block";
    }
  } else if (ringEl) {
    ringEl.style.display = "none";
  }

  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  const ctrlOffset = Math.max(
    45,
    Math.min(160, Math.hypot(dx, dy) * 0.45),
  );
  const c1x = startPt.x + dx * 0.12;
  const c1y = startPt.y + ctrlOffset;
  const c2x = endPt.x - dx * 0.12;
  const c2y = endPt.y - ctrlOffset;

  let strokeCol = "#22d3ee";
  if (connectingFrom.branch === "true") strokeCol = "#34d399";
  else if (connectingFrom.branch === "false") strokeCol = "#fb7185";

  const dStr = `M ${startPt.x.toFixed(1)} ${startPt.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${endPt.x.toFixed(1)} ${endPt.y.toFixed(1)}`;
  pathEl.setAttribute("stroke", strokeCol);
  pathEl.setAttribute("d", dStr);
  pathEl.style.display = "block";
  if (arrowPath) arrowPath.setAttribute("fill", strokeCol);
  if (glowEl) {
    glowEl.setAttribute("stroke", strokeCol);
    glowEl.setAttribute("d", dStr);
    glowEl.style.display = "block";
  }
};

const _v52HideRubberband = hideRubberbandWirePreview;
hideRubberbandWirePreview = function () {
  _v52HideRubberband();
  const glowEl = document.getElementById("rubberbandWireGlow");
  const ringEl = document.getElementById("rubberbandSnapRing");
  if (glowEl) {
    glowEl.style.display = "none";
    glowEl.setAttribute("d", "");
  }
  if (ringEl) ringEl.style.display = "none";
};

// Hook 20px grid toast into HUD card drag & 2D plane drag
window.addEventListener("mousemove", (e) => {
  if (
    hudCardDragState.active &&
    hudCardDragState.moved &&
    hudCardDragState.nodeId
  ) {
    const n = currGraph()?.nodes.find(
      (x) => x.id === hudCardDragState.nodeId,
    );
    if (n) showGridSnapToast(n, e.clientX, e.clientY);
  } else if (
    draggingBuildingState.active &&
    draggingBuildingState.moved &&
    draggingBuildingState.nodeId
  ) {
    const n = currGraph()?.nodes.find(
      (x) => x.id === draggingBuildingState.nodeId,
    );
    if (n) showGridSnapToast(n, e.clientX, e.clientY);
  }
});
window.addEventListener("mouseup", () => {
  hideGridSnapToast();
});

// ---------- PART B: FREE-FORM 2D CANVAS NAVIGATION (PAN & ZOOM ON CLICK & DRAG) ----------
const FreeCanvasPan = {
  active: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  velX: 0,
  velZ: 0,
  inertiaActive: false,
  spacePressed: false,
  gridOffsetX: 0,
  gridOffsetY: 0,
};

function updateZoomBadgeUI() {
  const badge = document.getElementById("zoomPercentBadge");
  if (!badge || !camera) return;
  const pct = Math.round(camera.zoom * 100);
  badge.textContent = `${pct}%`;
}

function sync2DGridBackgroundWithCamera() {
  const mount = document.getElementById("threeCanvasMount");
  if (!mount || !controls || !camera) return;
  const zoom = camera.zoom || 1;
  const ox = Math.round(-controls.target.x * zoom);
  const oy = Math.round(-controls.target.z * zoom);
  mount.style.backgroundPosition = `${ox}px ${oy}px`;
}



function initFreeForm2DNavigation() {
  const vp = document.getElementById("cityViewport");
  const mount = document.getElementById("threeCanvasMount");
  if (!vp || !mount) return;

  // Track Spacebar for Space+Drag panning in any mode
  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName || "";
    if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA") {
      FreeCanvasPan.spacePressed = true;
      vp.classList.add("canvas-pan-ready");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      FreeCanvasPan.spacePressed = false;
      if (!isTopDown2D) vp.classList.remove("canvas-pan-ready");
    }
  });

  // Play sfx_node_add when a dragged node snaps onto the 20px grid on mouseup
  window.addEventListener("mouseup", () => {
    if (
      (hudCardDragState && hudCardDragState.moved) ||
      (draggingBuildingState && draggingBuildingState.moved)
    ) {
      SoundManager.play("sfx_node_add", { gain: 0.75 });
    }
  });

  // Mouse Down on Viewport: Start Free-Form Panning if on empty space in 2D mode (or Middle Click / Space+Click)
  vp.addEventListener("mousedown", (e) => {
    // Ignore clicks on UI overlays, buttons, ports, or HUD node cards
    if (
      e.target.closest(
        ".city-hud-label, .hud-port, button, input, select, #cityLegendBody, #bittoDock",
      )
    ) {
      return;
    }
    // Ignore if a node drag or wire drag is active
    if (
      draggingBuildingState.active ||
      hudCardDragState.active ||
      rubberbandDragState.active
    ) {
      return;
    }

    const isMiddleClick = e.button === 1;
    const isLeftClick = e.button === 0;
    const hitBuildingId = pickBuildingNodeAtClientPos(
      e.clientX,
      e.clientY,
    );

    // If in 2D mode and user left-clicks on empty space (not on a building), or middle-clicks in any mode
    if (
      (isTopDown2D && isLeftClick && !hitBuildingId) ||
      isMiddleClick ||
      (FreeCanvasPan.spacePressed && isLeftClick)
    ) {
      e.preventDefault();
      FreeCanvasPan.active = true;
      FreeCanvasPan.inertiaActive = false;
      FreeCanvasPan.startX = e.clientX;
      FreeCanvasPan.startY = e.clientY;
      FreeCanvasPan.lastX = e.clientX;
      FreeCanvasPan.lastY = e.clientY;
      FreeCanvasPan.velX = 0;
      FreeCanvasPan.velZ = 0;
      vp.classList.add("canvas-pan-active");
      if (controls) controls.enabled = false;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!FreeCanvasPan.active || !camera || !controls) return;
    if (
      draggingBuildingState.active ||
      hudCardDragState.active ||
      rubberbandDragState.active
    ) {
      FreeCanvasPan.active = false;
      vp.classList.remove("canvas-pan-active");
      return;
    }

    // Compute exact 1:1 world-plane delta between previous and current pointer positions
    const prevPt = getWorldPointOnHorizontalPlane(
      FreeCanvasPan.lastX,
      FreeCanvasPan.lastY,
      0,
    );
    const currPt = getWorldPointOnHorizontalPlane(
      e.clientX,
      e.clientY,
      0,
    );

    if (prevPt && currPt) {
      const dx = prevPt.x - currPt.x;
      const dz = prevPt.z - currPt.z;
      camera.position.x += dx;
      camera.position.z += dz;
      controls.target.x += dx;
      controls.target.z += dz;
      FreeCanvasPan.velX = dx * 0.65;
      FreeCanvasPan.velZ = dz * 0.65;
      updateHudPositions();
      sync2DGridBackgroundWithCamera();
    }

    FreeCanvasPan.lastX = e.clientX;
    FreeCanvasPan.lastY = e.clientY;
  });

  window.addEventListener("mouseup", () => {
    if (!FreeCanvasPan.active) return;
    FreeCanvasPan.active = false;
    vp.classList.remove("canvas-pan-active");
    if (controls) {
      controls.enabled = true;
      controls.enableRotate = !isTopDown2D;
      controls.enablePan = !isTopDown2D;
    }
    if (Math.hypot(FreeCanvasPan.velX, FreeCanvasPan.velZ) > 0.35) {
      FreeCanvasPan.inertiaActive = true;
    }
  });

  // Smooth Mouse Wheel Zoom centered around pointer coordinates (0.2x to 2.5x)
  vp.addEventListener(
    "wheel",
    (e) => {
      if (e.target.closest("#cityLegendBody, #bittoDock")) return;
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      zoomCamera(factor, e.clientX, e.clientY);
    },
    { passive: false, capture: true },
  );

  // Smooth Inertia Loop for Free-Form 2D Panning
  function stepPanInertia() {
    requestAnimationFrame(stepPanInertia);
    if (
      FreeCanvasPan.inertiaActive &&
      !FreeCanvasPan.active &&
      camera &&
      controls
    ) {
      camera.position.x += FreeCanvasPan.velX;
      camera.position.z += FreeCanvasPan.velZ;
      controls.target.x += FreeCanvasPan.velX;
      controls.target.z += FreeCanvasPan.velZ;
      FreeCanvasPan.velX *= 0.88;
      FreeCanvasPan.velZ *= 0.88;
      updateHudPositions();
      sync2DGridBackgroundWithCamera();
      if (Math.hypot(FreeCanvasPan.velX, FreeCanvasPan.velZ) < 0.15) {
        FreeCanvasPan.inertiaActive = false;
      }
    }
  }
  requestAnimationFrame(stepPanInertia);
}

// và luôn hiển thị rõ các cổng nối dây (+Out, +True, +False, ➔In)
const _v5BuildHudOverlayElements = buildHudOverlayElements;
buildHudOverlayElements = function (nodes, layerMap, errorNodeIds) {
  _v5BuildHudOverlayElements(nodes, layerMap, errorNodeIds);
  nodes.forEach((node) => {
    const badge = document.getElementById(`hud_${node.id}`);
    if (!badge) return;
    if (tleInfiniteNodeIds.has(node.id)) {
      badge.classList.add("hud-tle-infinite");
    }
    // Thêm thanh công cụ mini vào mỗi khối (hiển thị ngay khi khối được chọn)
    const miniBar = document.createElement("div");
    miniBar.className = "hud-mini-toolbar";
    miniBar.innerHTML = `
      <button
        onclick="event.stopPropagation(); openInPlaceNodeEditor('${node.id}')"
        class="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 border border-cyan-400/50 font-semibold"
        title="Sửa trực tiếp biểu thức trên khối"
      >✏️ Sửa biểu thức</button>
      <button
        onclick="event.stopPropagation(); toggleNodeBreakpointById('${node.id}')"
        class="px-1.5 py-0.5 rounded ${
          node.bp
            ? "bg-rose-500/40 text-white border border-rose-300"
            : "bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50"
        } font-semibold"
        title="Đặt hoặc gỡ Trạm Dừng (Breakpoint) tại khối này"
      >🎯 ${node.bp ? "Gỡ BP" : "Đặt Breakpoint"}</button>
      <button
        onclick="event.stopPropagation(); deleteNodeById('${node.id}')"
        class="px-1.5 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/45 text-rose-200 border border-rose-400/50 font-semibold"
        title="Xóa khối này (Phím Delete)"
      >🗑 Xóa (Del)</button>
    `;
    badge.appendChild(miniBar);
  });
};

// Mở rộng Pan tự do bằng chuột phải (Right-Click Drag) bên cạnh chuột giữa & Space+Chuột trái
window.addEventListener("load", () => {
  const vp = document.getElementById("cityViewport");
  if (!vp) return;
  vp.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  vp.addEventListener("mousedown", (e) => {
    if (
      e.button === 2 &&
      !e.target.closest(
        ".city-hud-label, .hud-port, button, input, select, #bittoDock",
      )
    ) {
      e.preventDefault();
      FreeCanvasPan.active = true;
      FreeCanvasPan.inertiaActive = false;
      FreeCanvasPan.startX = e.clientX;
      FreeCanvasPan.startY = e.clientY;
      FreeCanvasPan.lastX = e.clientX;
      FreeCanvasPan.lastY = e.clientY;
      FreeCanvasPan.velX = 0;
      FreeCanvasPan.velZ = 0;
      vp.classList.add("canvas-pan-active");
      if (controls) controls.enabled = false;
    }
  });
});

// =========================================================================
// SỬA DỨT ĐIỂM LỖI PAN 2D TỰ DO & KÉO THẢ 2D (FIX ROOT CAUSE):
// - Root Cause 1: `window.onload` gán trực tiếp ở dòng 7971 chạy SAU `window.addEventListener("load")`
//   nên lúc `initReliable2DCanvasPan()` chạy trước đó thì `controls` vẫn là `undefined`!
//   Hệ quả là `animateCityLoop()` gọi `controls.update()` mỗi khung hình (60 lần/giây) và ép
//   `camera.position` quay về tọa độ cầu (spherical) của `OrbitControls`, làm vô hiệu hóa mọi thao tác Pan!
// - Root Cause 2: `THREE.OrbitControls` (r128) lắng nghe `pointerdown` / `pointermove` trên canvas.
//   Nếu chỉ chặn `mousedown` mà không chặn `pointerdown` ở Capture Phase, OrbitControls vẫn bắt giữ chuột.
// =========================================================================
let pan2DState = {
  isPanning: false,
  pointerId: null,
  lastClientX: 0,
  lastClientY: 0,
  velWX: 0,
  velWZ: 0,
};

// Ghi đè animateCityLoop: Khi đang ở chế độ Mặt Bằng 2D (isTopDown2D) hoặc đang kéo Pan,
// TUYỆT ĐỐI KHÔNG gọi controls.update() để tránh OrbitControls tính lại góc cầu (spherical)

// Đồng bộ lại beginHudCardDrag để ở cả 2D và 3D khi kéo nhãn HUD khối lệnh đều mượt mà và không bị giới hạn biên
beginHudCardDrag = function (nodeId, clientX, clientY) {
  const g = currGraph();
  const node = g?.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  selectedNodeId = nodeId;
  updateEditorPanel();
  hudCardDragState = {
    active: true,
    nodeId,
    startClientX: clientX,
    startClientY: clientY,
    origNodeX: node.x,
    origNodeY: node.y,
    moved: false,
    historySaved: false,
  };
};

function initReliable2DCanvasPan() {
  const vp = document.getElementById("cityViewport");
  const mount = document.getElementById("threeCanvasMount");
  if (!vp || !mount) return;
  if (vp._reliablePanInitialized) return;
  vp._reliablePanInitialized = true;

  const isInteractiveOverlayTarget = (targetEl) => {
    if (!targetEl || !targetEl.closest) return false;
    return Boolean(
      targetEl.closest(
        ".city-hud-label, .hud-port, button, input, select, textarea, label, #cityLegendBody, #bittoDock, #questBannerCard",
      ),
    );
  };

  const startPanning = (clientX, clientY, pointerId = null) => {
    pan2DState.isPanning = true;
    pan2DState.pointerId = pointerId;
    pan2DState.lastClientX = clientX;
    pan2DState.lastClientY = clientY;
    pan2DState.velWX = 0;
    pan2DState.velWZ = 0;
    FreeCanvasPan.active = false;
    FreeCanvasPan.inertiaActive = false;
    vp.classList.add("canvas-pan-active");
    if (controls) controls.enabled = false;
  };

  const applyScreenDeltaToCameraPan = (dxPixels, dyPixels) => {
    if (!camera || !controls) return;
    const rect = mount.getBoundingClientRect();
    const viewW = Math.max(1, rect.width);
    const viewH = Math.max(1, rect.height);
    const zoom = Math.max(0.15, camera.zoom || 1);

    // Tỷ lệ chuẩn 1:1 giữa độ dịch chuyển pixel chuột trên màn hình và kích thước Orthographic Frustum
    const worldPerPixelX = (camera.right - camera.left) / zoom / viewW;
    const worldPerPixelZ = (camera.top - camera.bottom) / zoom / viewH;

    if (isTopDown2D) {
      const deltaWX = -dxPixels * worldPerPixelX;
      const deltaWZ = -dyPixels * worldPerPixelZ;
      controls.target.x += deltaWX;
      controls.target.z += deltaWZ;
      camera.position.x = controls.target.x;
      camera.position.y = 560;
      camera.position.z = controls.target.z + 0.001;
      camera.lookAt(controls.target.x, 0, controls.target.z);
      pan2DState.velWX = deltaWX * 0.7;
      pan2DState.velWZ = deltaWZ * 0.7;
    } else {
      const rightVec = new THREE.Vector3();
      const upVec = new THREE.Vector3();
      camera.matrixWorld.extractBasis(
        rightVec,
        upVec,
        new THREE.Vector3(),
      );
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
    }

    camera.updateMatrixWorld();
    updateHudPositions();
    sync2DGridBackgroundWithCamera();
  };

  const stopPanning = () => {
    if (!pan2DState.isPanning) return;
    pan2DState.isPanning = false;
    pan2DState.pointerId = null;
    vp.classList.remove("canvas-pan-active");
    if (controls) {
      controls.enabled = !isTopDown2D;
      controls.enableRotate = !isTopDown2D;
      controls.enablePan = !isTopDown2D;
    }
  };

  // Chặn cả pointerdown VÀ mousedown ở Capture Phase để OrbitControls r128 không bao giờ chiếm quyền điều khiển chuột ở chế độ 2D
  const onPointerOrMouseDown = (e) => {
    if (isInteractiveOverlayTarget(e.target)) return;
    if (
      draggingBuildingState.active ||
      hudCardDragState.active ||
      rubberbandDragState.active
    ) {
      return;
    }

    const isMiddle = e.button === 1;
    const isRight = e.button === 2;
    const isLeft = e.button === 0 || e.button === undefined;
    const hitNodeId = isLeft
      ? pickBuildingNodeAtClientPos(e.clientX, e.clientY)
      : null;

    // Nếu click trúng mô hình khối 3D trên nền ở chế độ 2D -> cho phép kéo khối đó luôn
    if (isTopDown2D && isLeft && hitNodeId) {
      e.stopImmediatePropagation();
      e.preventDefault();
      beginHudCardDrag(hitNodeId, e.clientX, e.clientY);
      return;
    }

    // Nếu click vào khoảng trống ở chế độ 2D (hoặc chuột phải / chuột giữa / Space + chuột trái ở mọi chế độ) -> Kéo Pan bản vẽ tự do!
    if (
      (isTopDown2D && isLeft && !hitNodeId) ||
      isMiddle ||
      isRight ||
      (FreeCanvasPan.spacePressed && isLeft)
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      startPanning(e.clientX, e.clientY, e.pointerId ?? null);
    }
  };

  vp.addEventListener("pointerdown", onPointerOrMouseDown, true);
  vp.addEventListener("mousedown", onPointerOrMouseDown, true);

  const onPointerOrMouseMove = (e) => {
    if (!pan2DState.isPanning) return;
    const dx = e.clientX - pan2DState.lastClientX;
    const dy = e.clientY - pan2DState.lastClientY;
    pan2DState.lastClientX = e.clientX;
    pan2DState.lastClientY = e.clientY;
    if (dx !== 0 || dy !== 0) {
      applyScreenDeltaToCameraPan(dx, dy);
    }
  };

  window.addEventListener("pointermove", onPointerOrMouseMove, true);
  window.addEventListener("mousemove", onPointerOrMouseMove, true);

  window.addEventListener("pointerup", stopPanning, true);
  window.addEventListener("mouseup", stopPanning, true);
  window.addEventListener("pointercancel", stopPanning, true);
}


// Điều chỉnh độ cao nhãn HUD nổi phía trên các tòa nhà 3D mới để không che khuất kiến trúc 3D
updateHudPositions = function () {
  if (!camera || !renderer) return;
  const g = currGraph();
  if (!g) return;
  const mount = document.getElementById("threeCanvasMount");
  const width = mount.clientWidth;
  const height = mount.clientHeight;

  g.nodes.forEach((node) => {
    const meshGroup = buildingMeshesMap[node.id];
    const badge = document.getElementById(`hud_${node.id}`);
    if (!meshGroup || !badge) return;

    const worldPos = meshGroup.position.clone();
    if (node.type === "subroutine") worldPos.y += 68;
    else if (node.type === "input" || node.type === "output")
      worldPos.y += 48;
    else if (
      node.type === "start" ||
      node.type === "end" ||
      node.type === "return"
    )
      worldPos.y += 46;
    else if (node.type === "process") worldPos.y += 42;
    else worldPos.y += 32;

    worldPos.project(camera);

    const screenX = (worldPos.x * 0.5 + 0.5) * width;
    const screenY = (-(worldPos.y * 0.5) + 0.5) * height;

    if (
      worldPos.z > 1 ||
      screenX < -100 ||
      screenX > width + 100 ||
      screenY < -100 ||
      screenY > height + 100
    ) {
      badge.style.display = "none";
    } else {
      badge.style.display = "block";
      badge.style.left = `${Math.round(screenX)}px`;
      badge.style.top = `${Math.round(screenY)}px`;
    }
  });
};

// Ở Chế độ 3D, nhấn giữ chuột trái trên nhãn HUD và kéo sẽ xoay 360° quanh thành phố!
beginHudCardDrag = function (nodeId, clientX, clientY) {
  const g = currGraph();
  const node = g?.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  selectedNodeId = nodeId;
  updateEditorPanel();
  if (!isTopDown2D) {
    // Ở chế độ 3D: Không khóa chuột vào kéo khối mà khởi tạo xoay 360° (hoặc Pan nếu giữ Space)
    orbit3DManualState = {
      active: true,
      mode: FreeCanvasPan.spacePressed ? "pan" : "rotate",
      lastX: clientX,
      lastY: clientY,
    };
    return;
  }
  hudCardDragState = {
    active: true,
    nodeId,
    startClientX: clientX,
    startClientY: clientY,
    origNodeX: node.x,
    origNodeY: node.y,
    moved: false,
    historySaved: false,
  };
};


// Ghi đè initReliable2DCanvasPan để tách bạch hoàn hảo Chế độ 3D (Xoay 360° + Pan) và Chế độ 2D (Free Pan + Snap 20px)
initReliable2DCanvasPan = function () {
  const vp = document.getElementById("cityViewport");
  const mount = document.getElementById("threeCanvasMount");
  if (!vp || !mount) return;
  if (vp._v61UnifiedControllerInitialized) return;
  vp._v61UnifiedControllerInitialized = true;

  syncOrbitControlsForCurrentMode();

  const isInteractiveWidgetTarget = (targetEl) => {
    if (!targetEl || !targetEl.closest) return false;
    return Boolean(
      targetEl.closest(
        ".hud-port, .hud-quick-delete, .hud-mini-toolbar, button, input, select, textarea, label, #cityLegendBody, #bittoDock, #questBannerCard",
      ),
    );
  };

  const apply2DScreenDeltaPan = (dxPixels, dyPixels) => {
    if (!camera || !controls) return;
    const rect = mount.getBoundingClientRect();
    const viewW = Math.max(1, rect.width);
    const viewH = Math.max(1, rect.height);
    const zoom = Math.max(0.15, camera.zoom || 1);
    const worldPerPixelX = (camera.right - camera.left) / zoom / viewW;
    const worldPerPixelZ = (camera.top - camera.bottom) / zoom / viewH;

    const deltaWX = -dxPixels * worldPerPixelX;
    const deltaWZ = -dyPixels * worldPerPixelZ;
    controls.target.x += deltaWX;
    controls.target.z += deltaWZ;
    camera.position.x = controls.target.x;
    camera.position.y = 560;
    camera.position.z = controls.target.z + 0.001;
    camera.lookAt(controls.target.x, 0, controls.target.z);
    camera.updateMatrixWorld();
    updateHudPositions();
    sync2DGridBackgroundWithCamera();
  };

  // Cập nhật phím Space cho chế độ 3D (Space + Chuột trái = Pan)
  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName || "";
    if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA") {
      FreeCanvasPan.spacePressed = true;
      if (
        !isTopDown2D &&
        controls &&
        typeof THREE !== "undefined" &&
        THREE.MOUSE
      ) {
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      FreeCanvasPan.spacePressed = false;
      if (
        !isTopDown2D &&
        controls &&
        typeof THREE !== "undefined" &&
        THREE.MOUSE
      ) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
    }
  });

  vp.addEventListener(
    "pointerdown",
    (e) => {
      if (isInteractiveWidgetTarget(e.target)) return;
      if (rubberbandDragState.active) return;

      const isLeft = e.button === 0;
      const isMiddle = e.button === 1;
      const isRight = e.button === 2;

      // --- CHẾ ĐỘ 3D ISOMETRIC (XOAY 360 ĐỘ & PAN) ---
      if (!isTopDown2D) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;

        const onCanvas = e.target === renderer?.domElement;
        if (isLeft && !FreeCanvasPan.spacePressed) {
          // Nếu người dùng nhấn trên nhãn HUD (.city-hud-label), kích hoạt xoay cầu 360°
          // Nếu nhấn trên canvas, OrbitControls tự xử lý xoay 360° mượt mà
          if (!onCanvas) {
            orbit3DManualState = {
              active: true,
              mode: "rotate",
              lastX: e.clientX,
              lastY: e.clientY,
            };
          }
          return;
        }
        if (
          isRight ||
          isMiddle ||
          (isLeft && FreeCanvasPan.spacePressed)
        ) {
          if (!onCanvas || (isLeft && FreeCanvasPan.spacePressed)) {
            e.stopPropagation();
            orbit3DManualState = {
              active: true,
              mode: "pan",
              lastX: e.clientX,
              lastY: e.clientY,
            };
          }
          return;
        }
        return;
      }

      // --- CHẾ ĐỘ 2D MẶT BẰNG (FREE PAN & KÉO KHỐI BẮT LƯỚI 20PX) ---
      const hudCard = e.target.closest(".city-hud-label");
      if (hudCard && isLeft && !FreeCanvasPan.spacePressed) {
        const nodeId = hudCard.id.replace(/^hud_/, "");
        e.stopImmediatePropagation();
        e.preventDefault();
        beginHudCardDrag(nodeId, e.clientX, e.clientY);
        return;
      }

      const hitNodeId =
        isLeft && !FreeCanvasPan.spacePressed
          ? pickBuildingNodeAtClientPos(e.clientX, e.clientY)
          : null;
      if (hitNodeId) {
        e.stopImmediatePropagation();
        e.preventDefault();
        beginHudCardDrag(hitNodeId, e.clientX, e.clientY);
        return;
      }

      if (isLeft || isMiddle || isRight) {
        e.stopImmediatePropagation();
        e.preventDefault();
        pan2DState.isPanning = true;
        pan2DState.lastClientX = e.clientX;
        pan2DState.lastClientY = e.clientY;
        FreeCanvasPan.active = false;
        vp.classList.add("canvas-pan-active");
      }
    },
    true,
  );

  window.addEventListener(
    "pointermove",
    (e) => {
      if (orbit3DManualState.active && !isTopDown2D) {
        const dx = e.clientX - orbit3DManualState.lastX;
        const dy = e.clientY - orbit3DManualState.lastY;
        orbit3DManualState.lastX = e.clientX;
        orbit3DManualState.lastY = e.clientY;
        if (orbit3DManualState.mode === "rotate") {
          apply3DSphericalRotationDelta(dx, dy);
        } else if (orbit3DManualState.mode === "pan") {
          apply3DPanDelta(dx, dy);
        }
        return;
      }

      if (pan2DState.isPanning && isTopDown2D) {
        const dx = e.clientX - pan2DState.lastClientX;
        const dy = e.clientY - pan2DState.lastClientY;
        pan2DState.lastClientX = e.clientX;
        pan2DState.lastClientY = e.clientY;
        if (dx !== 0 || dy !== 0) {
          apply2DScreenDeltaPan(dx, dy);
        }
      }
    },
    true,
  );

  const endAllPointerActions = () => {
    if (orbit3DManualState.active) {
      orbit3DManualState.active = false;
    }
    if (pan2DState.isPanning) {
      pan2DState.isPanning = false;
      vp.classList.remove("canvas-pan-active");
    }
    FreeCanvasPan.active = false;
    syncOrbitControlsForCurrentMode();
  };

  window.addEventListener("pointerup", endAllPointerActions, true);
  window.addEventListener("mouseup", endAllPointerActions, true);
  window.addEventListener("pointercancel", endAllPointerActions, true);
};
