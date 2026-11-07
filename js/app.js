// ============================================================================
// AlgoFlow Studio v6.1 - The Living Algorithm City & Visual Programming Workbench
// Tệp: js/app.js
// Mô tả: Entry point khởi chạy ứng dụng, Hệ thống âm thanh 9 hiệu ứng (SoundManager),
//        Quản lý Modal / Thanh công cụ / Focus Canvas Mode / Sổ tay hướng dẫn,
//        Phím tắt toàn cục và Bộ kiểm thử hồi quy (runAlgoFlowTestSuite + AppState).
// ============================================================================

function openFunctionModal() {
  const m = document.getElementById("functionModal");
  document.getElementById("newFuncNameInput").value =
    `quan${Object.keys(tabs).length + 1}`;
  m.classList.remove("hidden");
  m.classList.add("flex");
}

function closeFunctionModal() {
  const m = document.getElementById("functionModal");
  m.classList.add("hidden");
  m.classList.remove("flex");
}

function confirmAddFunctionTab() {
  const rawName = document
    .getElementById("newFuncNameInput")
    .value.trim()
    .replace(/[^a-zA-Z0-9_]/g, "");
  const rawParam = document
    .getElementById("newFuncParamInput")
    .value.trim();
  if (!rawName || tabs[rawName]) {
    closeFunctionModal();
    return;
  }
  pushHistoryState();
  const paramVar = rawParam.match(/([a-zA-Z_]\w*)\s*$/)?.[1] || "x";
  tabs[rawName] = {
    signature: rawParam
      ? `int ${rawName}(${rawParam})`
      : `int ${rawName}()`,
    nodes: [
      {
        id: "s1",
        type: "start",
        content: `Start ${rawName}(${paramVar})`,
        x: 280,
        y: 50,
        bp: false,
      },
      {
        id: "s2",
        type: "process",
        content: `res = ${paramVar} * 2`,
        x: 280,
        y: 150,
        bp: false,
      },
      {
        id: "s3",
        type: "return",
        content: "return res",
        x: 280,
        y: 250,
        bp: false,
      },
    ],
    edges: [
      { id: "se1", source: "s1", target: "s2" },
      { id: "se2", source: "s2", target: "s3" },
    ],
  };
  activeTab = rawName;
  selectedNodeId = null;
  closeFunctionModal();
  renderTabs();
  renderAll();
}

function initWorkspaceResizers() {
  const leftSidebar = document.getElementById("leftSidebar");
  const rightSidebar = document.getElementById("rightSidebar");
  const bottomRamPanel = document.getElementById("bottomRamPanel");
  const leftResizer = document.getElementById("leftResizer");
  const rightResizer = document.getElementById("rightResizer");
  const bottomResizer = document.getElementById("bottomResizer");

  let mode = null;
  leftResizer?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mode = "left";
    leftResizer.classList.add("active");
  });
  rightResizer?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mode = "right";
    rightResizer.classList.add("active");
  });
  bottomResizer?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    mode = "bottom";
    bottomResizer.classList.add("active");
  });

  window.addEventListener("mousemove", (e) => {
    if (!mode) return;
    if (mode === "left")
      leftSidebar.style.width =
        Math.min(480, Math.max(220, e.clientX)) + "px";
    if (mode === "right")
      rightSidebar.style.width =
        Math.min(600, Math.max(260, window.innerWidth - e.clientX)) +
        "px";
    if (mode === "bottom")
      bottomRamPanel.style.height =
        Math.min(380, Math.max(105, window.innerHeight - e.clientY)) +
        "px";
    onResizeCityViewport();
  });

  window.addEventListener("mouseup", () => {
    if (mode) {
      mode = null;
      leftResizer?.classList.remove("active");
      rightResizer?.classList.remove("active");
      bottomResizer?.classList.remove("active");
      onResizeCityViewport();
    }
  });

  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName || "";
    const isInput =
      tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      !isInput &&
      selectedNodeId
    ) {
      e.preventDefault();
      deleteSelectedNode();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z" &&
      !e.shiftKey &&
      !isInput
    ) {
      e.preventDefault();
      undoAction();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "y" ||
        (e.shiftKey && e.key.toLowerCase() === "z")) &&
      !isInput
    ) {
      e.preventDefault();
      redoAction();
    }
  });
}

// =========================================================================
// 17. BOOTSTRAP APPLICATION ON WINDOW LOAD
// =========================================================================
window.onload = function () {
  initThreeCity();
  initWorkspaceResizers();

  if (!loadFromLocalStorage()) {
    tabs = {
      main: getPresetGraphData("perfect"),
      khoMangVoxel: getPresetGraphData("array"),
    };
    activeTab = "main";
    renderTabs();
    renderAll(false);
  }

  updateRamUI();
  animateCityLoop();
};

// ---------- Tính năng 2: sổ tay ----------
function openManual() {
  const m = $id("manualModal");
  m.classList.remove("hidden");
  m.classList.add("flex");
  $id("manualBody").scrollTop = 0;
}
function closeManual() {
  const m = $id("manualModal");
  m.classList.add("hidden");
  m.classList.remove("flex");
}
function manualGo(id) {
  $id(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    !$id("manualModal").classList.contains("hidden")
  )
    closeManual();
  if (e.key === "F1") {
    e.preventDefault();
    openManual();
  }
});

// ---------- v5.2: DRAWERS, FULLSCREEN & ONE-CLICK SYNC & RUN ----------
let leftDrawerOpen = true;
let rightDrawerOpen = true;

function toggleLeftDrawer() {
  const panel = $id("leftSidebar");
  const resizer = $id("leftResizer");
  const btn = $id("btnToggleLeftDrawer");
  if (!panel) return;
  leftDrawerOpen = !leftDrawerOpen;
  panel.classList.toggle("drawer-collapsed", !leftDrawerOpen);
  if (resizer)
    resizer.classList.toggle("drawer-collapsed", !leftDrawerOpen);
  if (btn) {
    btn.textContent = leftDrawerOpen ? "◧ Thanh Trái" : "◧ Mở Trái";
  }
  onResizeCityViewport();
}

function toggleRightDrawer() {
  const panel = $id("rightSidebar");
  const resizer = $id("rightResizer");
  const btn = $id("btnToggleRightDrawer");
  if (!panel) return;
  rightDrawerOpen = !rightDrawerOpen;
  panel.classList.toggle("drawer-collapsed", !rightDrawerOpen);
  if (resizer)
    resizer.classList.toggle("drawer-collapsed", !rightDrawerOpen);
  if (btn) {
    btn.textContent = rightDrawerOpen ? "Thanh Phải ◨" : "Mở Phải ◨";
  }
  onResizeCityViewport();
}

function toggleFullscreenApp() {
  const btn = $id("btnFullscreen");
  try {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  } catch (e) {}
  setTimeout(onResizeCityViewport, 120);
}

document.addEventListener("fullscreenchange", () => {
  const btn = $id("btnFullscreen");
  if (btn) {
    btn.textContent = document.fullscreenElement
      ? "🗗 Thoát Toàn Màn Hình"
      : "⛶ Toàn Màn Hình";
  }
  onResizeCityViewport();
});

// Global shortcut Ctrl + Shift + Enter for One-Click Sync & Auto-Run
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
    e.preventDefault();
    ideSyncAndAutoRun();
  }
});

// ---------- FEATURE 2: Brand Identity Modal ----------
function openBrandIdentityModal() {
  const m = document.getElementById("brandIdentityModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("flex");
}
function closeBrandIdentityModal() {
  const m = document.getElementById("brandIdentityModal");
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("flex");
}

// ---------- PART A: DYNAMIC UI SOUND EFFECTS ENGINE (SoundManager) ----------
const SFX_DATA_URIS = {
  sfx_click:
    "data:audio/wav;base64,UklGRqQHAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YYAHAACl1UJics6JG6CloEZH34deT5rUPlqQtY0dmrWHVUjVkkxikc5MSp6pkSeGwYBdS8GmRmSLxmQ8mqeWOWzEiWJMqLpPXIK+gzeHqKBPUrmca0uJx2tTcrGjQWqgqm1AnK2AUGbBkFhel7pgUoitkkJyq5tnSKCtc1Rwuo5SZpmyY1CMqY9HbquZaU6Wr3VXbrGXV2OSsnBPg6aXVGKjoHRPhLCFXWGjpGZbga+IUm+cpGlTjaWKVGqkm25Vh6yCXGegomddgaqKV22ZpG9WhaSPXGScn3dXe6iOZF+Tpnhcc6KYZGGIpoRZcZmeblqEoY5gZpafe1t3o5NrX4qkgmFrmZ1xX3uhkGRmi6KAXXKXm3FegZ6QZWaPnoJfcZqYdF9+n45qY4ufgmNtlZp2Ynick2xlg5+IZmuNnn5jc5WZdGN8mpFsZoWbiWZrjZqBY3KTl3ljepeTcmWBmoxsaIiahmlsjpiAZnGSlnpld5WTdWZ8mI9xaIGZi25qhpiHbGyJmINqb4yXf2lyj5V8aXWRlHppd5OSeGl6k5B2aXyUj3RqfpSNc2t/lYxza4CVi3JrgZSKcmyBlIpybIGUinJtgZSKc22Bk4pzbICSi3RtgJKMdW1+kYx2bX2QjXhte4+OeW16jo97bXiMkH1udouRgG90iJGCcHKGkYVycYORiHRwgJCKd299jox6b3mMjn5wdomPgXF0hY+Fc3GCj4h3cH2NjHpweYqOf3F2h4+DdHOCjod3cX6Mi3txeYmNgHJ1hY6FdXKAjIl6cnuKjH9zdoWNhHZzgIyJenJ6iYyAdHaEjYV3c36LinxzeYeMgnV1gYyHenN7iIuAdHaDi4Z5dH2Jin91d4SLhXh0fomJfnV4hIuEeHV+iYl+dXiEioV5dX2IiX92d4OKhXp1fIeJgXd3gYmHfHV6hYmDeHZ+iIh+dniDiYV7dnyGiYF4d3+Ih352eYOJhXt2fIWIgnh3f4eHf3d5goiFfHd7hIiDend9hoiBeHh/h4d/eHmBiIV9d3qDiIR7d3yEiIJ6eH6Fh4F5eH+GhoB5eYCHhn94eoGHhX54eoKHhH14e4KHhHx4e4OHg3x4fIOHg3x4fIOGg3x5fIOGg3x5fIOGg3x5fIOGg3x5fIOGg315fIKGg315e4KGhH55e4GFhH56e4CFhX96en+FhYB7en6EhYF8en2DhYJ9enyChYN+enyBhYR/e3t/hIWAe3p+g4WCfXp9goWDfnp8gISEgHt7f4OEgXx6fYKFg357fICEhIB8e36DhIJ9e32BhIN/e3t/g4SBfXt9gYSDf3t8f4OEgX17fYGEg397fH+DhIF9e32BhIN/fHx/goSBfnt9gIODgHx8foKEgn58fH+Dg4F9fH2Bg4OAfHx+goOCf3x8f4KDgX58fYCDg4B9fH2Bg4KAfXx+gYOCf3x8f4KDgn98fX+Cg4F+fH2AgoOBfnx9gIKDgX58fYCCg4B+fH2AgoKAfnx9gIKCgH58fYCCgoB+fH2AgoKBfn19gIKCgX59fX+CgoF/fX1/gYKBf319f4GCgn99fX6AgoKAfn1+gIKCgH59fX+BgoF/fX1/gYKCgH59foCCgoB+fX5/gYKBf319f4CCgoB+fX6AgYKBf319f4GCgYB+fX6AgYKBf359f4CCgYB+fX5/gYKBf359foCBgYB/fn5/gYKBgH59fn+BgoF/fn5+gIGBgH9+fn+AgYGAf35+f4CBgYB+fn5/gYGBgH5+fn+BgYGAfn5+f4GBgX9+fn6AgYGBf35+fn+BgYGAfn5+f4GBgYB+fn5/gIGBgH9+fn+AgYGAf35+f4CBgYB/fn5/gIGBgH9+fn5/gIGBgH9+fn+AgYGAf35+f4CBgYCAf35+f4CBgYB/fn5/gIGBgIB/fn5/gIGBgH9+fn+AgIGBgH9+fn+AgYGAf39+f3+AgYGAf39+f3+AgYGAf35+f4CAgYCAf35+f4CAgYCAf35+f4CAgYCAf35+f4CAgYCAf39+f4CAgYCAf39+f4CAgICAf39/f3+AgICAf39/f3+AgICAgH9/f3+AgICAgH9/f39/gICAgH9/f39/gICAgIB/f39/f4CAgICAf39/f4CAgICAf39/f3+AgICAgH9/f39/gICAgIB/f39/f4CAgICAf39/f3+AgICAgH9/f39/gICAgIB/f39/f4CAgICAf39/f3+AgICAgH9/f39/gICAgIB/f39/f3+AgICAgH9/f39/gICAgIB/f39/f3+AgICAgH9/f39/gICAgICAf39/f3+AgICAgIB/f39/f4CAgICAgH9/f39/gICAgICAf39/f3+AgICAgIB/f39/f4CAgICAgH9/f39/f4CAgICAgH9/f39/gICAgICAf39/f39/gICAgICAf39/f39/gICAgICAf39/f39/gICAgICAf39/f39/gICAgICAf39/f39/gICAgICAf39/f39/gICAgICAf39/f39/f4CAgICAgH9/f39/f4CAgICAgIB/f39/f3+AgICAgICAf39/f39/gICAgICAgH9/f39/f4A=",
  sfx_node_add:
    "data:audio/wav;base64,UklGRgMWAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0Yd8VAACAg4aKjZCUl5qdoKOlqKqtr7GztLa3ubq7u7y8vLy8vLu6ubi3trSysa+sqqilo6CdmpeUkY6LiISBfnt4dHFua2hlY2BdW1hWVFJQTk1LSklIR0dGRkZGRkZHSEhJS0xNT1FTVVdZW15gY2Zoa25xdHd6fYCDhomMj5KUl5qcn6GkpqiqrK2vsLGztLS1tra2tra2trW0tLOysK+trKqopqSin52bmJWTkI2LiIWCf316d3Ryb2xqZ2ViYF5cWlhWVVNSUU9OTk1MTExLS0xMTE1OTk9QUlNUVlhZW11fYmRmaGttcHJ1eHp9gIKFh4qWz9evh3uAfn2Xyu/bnGlslrvGx9HUuIRng8Pv58GknJaHhqfb8c6OZ3GSpqqywLySWkdrpL+tjXtyYUtPeaqyhk01Q1ljaXuNgE4dGEN0gnFdVUoyHi9ijoxeMyk5SE5deo14RR8qWYCIfXZ0ZUg7WI+0p39hYW1zepK1wqVyWW6Ys7Wxs6+WdnGVyd/Lp5OVl5Scu9zdtoZ3ja68u7zBtJJwcprEzLOViIV9dYGkv7SIX1htgoiJkZWBWDxIcZGQd2NcVEU/VHuQfVI0NkpXW2R0dlw1IzlienVkW1dLOzxbgpF6VURNXGVsfpKRck9JZYmZlIyKhHNjbJG1uqCEe4SMj5uyxLqXeXuYs7u2s7KmjoCPs8/KrpiTlpWWpL7JtZB3fpanqKWno49zaHyer6OJeXZya22BmZ2DYE9abXZ2eX53XkM/WXeAc2BXVExETGZ9fGBEPUpZX2NtdWpQOkBdd3xxZ2RfVVBffZKLcVxdanR5gpKYim5gbYmdnpaSkYh7eY2rua2Vh4qTlpuoubqmi4KRqLSxraynl4iJoLm/rpiPkZKRl6a0rpV8d4eXnJmXl415anCHmpmHdnBwbGlyhI+DaVVWZHBxcXR0Z1FHUmp5dGVbWFVPUF5zemxUSE5bY2ZrcnFhTkpbcn13bmpoY11idYqNfmtlbXd8gYuUkH5ucIOWnJeSkY2Ef4idrqybjIqRlpifq7GolIaMnaqsp6Wjm46Klam0rJuQj5GRkpunqZqFe4KQl5aTko6CdHF/kJaLfHVzcm9yfYiGdWNdZXB0c3N1b2BUVmZ1d21iXl1aV15sdnJhU1JcZGdpbnBpWlJZand3b2ppZ2JibX2Ff3BnanN5fIGJioBzbnmJkpGMiomEf4GOnqKZjIeLkJOWnqWkl4qIk6Clop+em5OMkJ6qqp+UkJOUlJigpqCRhYaPmJmWlZONgnyCj5eTiH99fXt7gImMg3RrbXZ7e3p6eG9kYWl2e3ZsZ2ZkYWJrdHVrXlleZWlqbG5rYllZZG9zbmhmZWNhZXB6eW9lZGpwcnV6fnpwaW15g4WBfn58eHd+ipKPhX+AhYmLj5WYkoeDiJOampeWlZGMjJSfpJ6VkJGUlZecoqGYjouRmZybmZiWj4mKkpuclY2JiYmIipCUkYd9fIGHiIaGhYB4cnV+hIN8dnNycG9zen14bmdnbXBxcXJxbGNgZW5zcWtoZ2VjY2lxc25lYWRoa2xvcnFrZGNqc3d1cXBwbmxudn5/eXNxdXl7fYGFg3x3eYCIioiHh4aCgYWOlJONiIiLjY6RlpmVjYmMk5iYl5aWk46NkpqdmpSQkJGRkpaam5WNioySlJOSkpCLhoWLkZKOiIaFhIOEiIyKg3x6fYCBgICAfXdyc3l+fnl1c3Jwb3F2eXZvamptb3BwcnJuaGVobnJxbmxramdna3F0cWtoaWxub3F0dHBraW50d3Z1dHRycHJ3fX98d3Z4ent9gYSDf3t7gIWHh4aHhoOChIqPj4yIiImKi46SlJKNiYuPk5OTk5ORjYyPlJiWkpCPj4+PkpaXk42KjI+RkZGRkIyIh4qOkI6KiIeGhIWIi4qGgH6AgoKCgoOBfHh4e39/fXp4d3V0dXl7enVxcHFzc3N1dXNua2xwc3NxcG9ubGttcnRybmtsbW5vcHNzcW1rbnJ0dHNzc3FvcHR4enh1dHV2d3h7fn57eHd6foCAgIGAfn1+goaHhYODhISFhoqMi4iFhomMjY2Njo2KiYuPkZGPjY2NjY2PkpORjoyMjpCQkJGRjouKjI+RkI6MjIuJiYyOjoyIhoeIiIiJiYiFgoGDhoaEg4KBf31+gIKBfnt6e3t7e3x9e3d1dXd5eXh3dnVzcnN2d3ZzcXFxcXFydHVzb25vcXNzcnJycG9ucHR1dHJxcXFxcnR2dnRycXN1d3d3eHh2dXV4e3x7enl6enp8foCAfnx8foCBgoODg4GAgYSHh4aFhYWFhYeJi4qIh4eJiouLjI2LiYmKjY6OjYyMjIuLjY+QjoyLi4yMjY2OjoyKiYqMjYyLi4qJiIiKi4uJh4aGhoaGh4iHhIKCg4SEhIOCgYB+f4GCgX99fX18fHx9fnx6eHh5enp6eXl4dnV2eHl4dnV1dHR0dXZ3dXNycnR0dHR1dHNxcXN1dXVzc3Nzc3N1dnZ1c3N0dXZ2d3d3dnV1d3l5eXh4eHh4eXt9fHt6enx8fX5/f39+fX6AgYKBgYGBgYGChIWFhIOEhIWGhoiIh4aFhoiJiYmJiYiIiImLi4uJiYmKioqLjIyKiYmKi4uLi4uLiomJioyLiomJiYmIiYqKiYiGhoeIiIeHh4aFhISGhoaEhIODgoKCg4OCgYCAgICAgICAfn18fX5+fn18fHt6ent8fHp5eHl5eXl5eXl3dnZ3eHh3d3d2dnV1dnd3dnV1dXV1dnZ3dnV0dHV2dnZ2dnZ1dXZ3eHd3dnZ3d3d4eXl4d3d4eXp6enp6enl5e3x9fHx7fHx8fX5/f359fX5/gICAgYGAgICCg4ODgoKDg4ODhIWFhISEhYaGhoeHhoaFhoeIiIiHh4eHh4iJiYmIiIiIiYmJiYmJiIiIiYmJiYiIiIiIiImJiIeHh4eHh4iIiIeGhYaHh4aGhoWFhISFhYWEg4ODg4ODg4ODgYGAgYGBgYCAgH9+f3+Af35+fX19fX19fX18e3t7fHt7e3t6enl6enp6eXl5eXh4eXl5eHh3d3h4eHh4eHd3d3d4eHh3d3d3d3d4eHh3d3d3eHh4eHh4eHd4eHl5eXl5eXl5eXp6enp5enp6e3t7fHt7e3t8fX19fX19fX19fn9/fn5+f39/gICAgICAgIGBgYKCgoKBgoKDg4ODg4ODg4SEhYWEhISFhYWFhYaFhYWFhoeHhoaGhoaGhoeHh4aGhoeHh4eHh4eGhoeHh4eHh4eGhoaHh4eHhoaGhoaGhoaGhoWFhYWGhYWFhYSEhISFhISDg4ODg4ODg4OCgoKCgoKCgYGBgICAgYGAgH9/f39/f39/f35+fn5+fn59fX18fHx9fX18fHx8e3t7fHx7e3p6e3t7enp6enp5enp6enp5eXl5eXl6enl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXp6eXl5eXp6enp6enp6enp7e3t6e3t7e3t7fHt7e3t8fHx8fHx8fHx9fX19fX19fX1+fn5/fn5+fn9/f3+AgIB/f4CAgICBgYGBgYGBgoKCgYKCgoKCg4ODgoKCg4ODg4ODg4ODhISEhISEhISEhISFhYWEhISFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhISFhYWEhISEhISEhISEhIODhISEg4ODg4ODg4ODg4KCgoKCgoKCgoKBgYGBgYGBgYGBgICAgICAgICAgH9/f39/f39/f39/f35+fn5+fn5+fn59fX19fX19fX19fHx8fHx8fHx8fHx8fHx8fHx7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7ent7e3t7enp6e3t7e3t7e3p6e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t8fHx8fHx8fHx8fHx8fHx8fHx9fX19fX19fX19fX19fX19fX5+fn5+fn5+fn5/f39/f39/f39/f39/f39/gICAgICAgICAgICBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODhISDg4ODhISEhISEhIOEhISEhISEhISEhISEhISDg4SEhISEhISDg4OEhISDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OCgoKDgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fn5+fn1+fn59fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fHx9fX18fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx9fX18fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX1+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgIGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/fn5/f39/fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+f39/f35/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/",
  sfx_node_delete:
    "data:audio/wav;base64,UklGRuscAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YcccAAB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f35/f39/f35+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5/f39/f39+fn9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBgYGAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fXx8fX19fX18fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fH19fX18fHx9fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fn5+fn1+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+f39/f39/f39/f39/f39/f39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoODgoKCgoODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4SEhISDg4ODg4SEhISEhISEhIODhISEhISEhISEhISEhISEhISEhISDhISEhISEhISEhIODg4ODhISDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGAgICAgICAgICAgICAgH9/f39/f39/f39/f39/f39/f39/f35+fn5+fn5+fn5+fn5+fX19fX19fX19fX19fX19fX19fX19fXx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t6ent7e3t7e3t7e3t6enp7e3t7e3t7ent7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7fHx8fHx8fHx8fHx8fHx8fHx8fHx8fH19fX19fX19fX19fX1+fn5+fn5+fn5+fn5+f39/f39/f39/f39/f39/f4CAgICAgICAgICAgICAgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoODg4ODg4ODg4ODg4ODhISEg4ODhISEhISEhISEhISEhISFhYWFhYSEhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYaGhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhISEhYWFhYWEhISEhISEhISEhISEg4ODg4ODg4ODg4ODg4KCgoODg4OCgoKCgoKCgYGCgoKCgYGBgYGBgYGBgICAgICAf3+AgICAf39/f39/fn5+fn9/fn5+fX19fX19fX19fX19fHx8fHx8fHx8fHx8e3t7e3t8fHt7e3t7e3t6ent7e3t6enp6enp6enp6enp6eXl5eXl6enp5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXp6enl5eXl5eXl5enp6enp6eXp6enp6ent7e3t7enp6e3t8fHx7e3t7fHx8fHx9fX19fHx8fX19fX1+fn5+fn5+fn5/f39/f39/f39/f4CAgIGBgICAgIGBgYGBgoKCgoKCgoKCg4ODg4ODg4ODg4ODhISFhISEhISEhYWFhYWGhoWFhYWFhoaGhoaGhoaGhoaGhoeHh4eHhoaGhoeHh4eHh4eHh4aGhoeHh4eHh4eHh4aGhoeHh4eHh4aGhoaGhoaGhoeGhoWFhYWFhoaFhYWFhYWEhISEhYWFhISEg4ODg4ODg4ODg4OCgoGCgoKCgoGBgYGAgICAgICAgIB/f39/fn5+fn5/f35+fX19fX19fX19fX18fHt7e3t8fHt7e3t6enp6eXp6enp6eXl5eXl5eXl5eXl5eXh3d3d4eHh4eHh4eHd3d3d3eHh4eHd3d3d3d3d3d3h4eHh3d3d3d3h4eHh4eHh4d3d3eHl5eXl5eHh4eXl5eXp6enp6enl5enp7e3t7e3x8e3t7e3x9fX19fX19fX19fX5+f39/f39+f3+AgICBgYGBgYGBgIGCgoODg4ODg4ODg4ODhIWFhYWEhISFhYWGhoaHh4aGhoWGh4eIiIiHh4eHh4eHh4iJiYmIiIiIiIiIiYmJiYmJiIiIiIiJiYmJiYmJiIiIiIiJiYmJiIiHh4eHh4eIiIiIh4aGhYaGh4eHhoaGhoWEhISEhYWFhYSDg4ODg4KCg4ODg4KBgICAgYGBgYCAgIB/fn19fn9/f359fXx8fHx7fHx8fXx7enl5eXp6enp6enp5eHh3d3h4eXl4eHd3d3Z2dnZ3d3h3d3Z1dXV2dnZ2dnZ2dnV0dHR1dnZ2dnZ1dXV1dXV1dnd3d3Z1dXV2dnZ3d3d4eHh3dnZ2eHl5eXl5eXl5eXh4eXp7fHx7enp6e3t8fH19fn5+fXx8fX5/gICAgICAgIB/gIGCg4SDg4KCgoODg4SEhYaGhoWEhIWGh4eHh4iIiIeHhoeIiYqKiomJiImJiYmJiouMjIuKiYmJiouLi4uLi4uKiYmJiouMjIuLioqKiomJiYqLi4uKiYiIiImJiYmJiYmIh4aFhYaHiIiHhoWFhYSEg4OEhYWFhIKBgYGBgYGBgYKCgX9+fX1+f39/fn59fXx7enp7e3x9fHt5eHh4eHh4eHl5eXh3dXV1dnd3d3d2dnV1dHNzdHV2dnZ0c3Nzc3Nzc3R1dXV0c3FxcnN0dXR0dHR0dHNycnN1dnd2dXR0dHR1dXV2d3h5eHZ1dXZ3eHl5enp6enl5eHh6fH1+fX18fHx9fX19f4CCgoF/fn+AgYKDg4OEhYSDgoKChIaHiIeHhoaGhoaGh4mKi4uKiYiIiYqKi4uMjY2Ni4qJiouNjo6OjY2MjIyLi4yNj5CPjoyLi4uMjIyNjY6OjYuJiYmKjI2MjIuLiomIh4eHiYuLioiGhYWFhYWFhoaHh4WDgYCAgoODg4KCgYF/fnx8fX+AgH99e3p6enp5eXp7fHx6eHV1dXZ4eHh3d3d2dXNxcXN1dnZ1dHJycXFxcHFydHV1c3Bvbm9wcnJycnNzcnFvbm5wcnR1dHNycXFxcXFxc3Z3d3VzcnJzdHZ2d3h5eXl3dXR1d3p8fXx7e3t7e3p6e36BgoKAfn1+f4CBgoOEhYaGhIKBgoSHiYmJiIiIiIeGhoiKjY+OjIqJiYqLjIyNj5CRkI2LiouNkJGRkZCQkI+NjIyNkJKTkpCOjY2NjY2NjpCSkZCNiomJi42Ojo2NjIyKiIaFh4mMjIuIhoWEhIODg4SGh4eEgX59fn+AgYCAgIB/fXp3d3l8fn58enh3dnZ1dHR2eHp5dnNwb3Byc3Nzc3R0c3Fta2tucXNzcnBvbm5tbGtsb3J0c3Fta2tsbm9vcHFzc3JwbWtsb3J1dXRzc3NzcXBwcnV5e3t4dXR0dnd4eXp8f4B+fHl3eXyAgoOCgoKCgoB/foGFiYuKiIWEhYaHh4iKjY+QjouIh4iLj5CRkZGRkY+Ni4uNkZWXlpOQj4+Pj4+QkpWXl5WRjYyNkJKTk5OTk5OQjYqJjJCTlJKPjIuLiomIiIqOkI+Mh4OCg4WGh4aHh4eGgn57en2BhISCf317enl3dnZ5fX9+enVxcHFzdHR0dXd3dXFtaWptcXR0cnBvbm1raWdpbXF0c29qZ2doamtrbG9xcnBsZ2Vmam9ycnFwcG9ubGppbHF2eXh1cW9vcXJzdHZ6fX58eHNydHh9gIGAgIGBgH16en2DiYyLh4SCg4SFhYaJjpKTkIuGhYeLkJKSk5OUlJGNioqOlJmbmpaTkZGRkZCRlJmdnZmTjo2OkpWWlpeYmJeTjoqJjZOXmJaSj42Ni4mHiIyRlJOPiIOBgoWGh4eIiYqIgnx3d3uAhIWCf3x6eXZzcXJ3fIB+eXJtbG1vcHBxc3Z3dG5nY2NobnJycG5sa2pmY2FjaXB0cm1nY2NkZmdnaW1xc3BqY2BiZ21xcnFwcXBva2dmanF5fXx3cnBwcXNzdHh+g4WCe3VydXuBhYaGhoiIhYB8fICJkZSTjoqIiImJiYqPlZudmZGKiIuQlZiZmZucnJeRjIuQmaCioJuXlZWUkpCRlp2jo52VjYuNkZWWlpeZm5mSioSDiJCWmJWQjIqIhYF/gIWNkpGKgXl3eXx9fn6Ag4WCenBqam93fX16dnRycGtmY2VtdXp5cmliYWJlZmZobHFzcGddWFlgaG1ubGppaWZhW1ldZnB2dW5mYmFjZWZna3F4e3duZWBja3N5enp6e3t4cmxrcHuGjIqEfnp7fH19f4SNlZiTiYB8f4ePk5WVl5mZlIyFhIuWoaajnZeUlJSSkJKYoqqspZqQjI+Wm56foKOlo5yRiYiPmqOmopyWlJKPi4eIkJqioZmMgn6BhYmKio2Qk4+GeXBudoGJi4aBfHp3cmtnaXJ9hYR6bmRhY2dpaWtwdXh0aVtTU1xnb3BtaWdmY1xVUVVhbnZ1a2BZV1pdXl9ja3R4c2daU1Vfa3N1c3Nzc3BoYF1jcYCJh391cHByc3R1fIeSlpCEd3B0f4qQkpOUl5eSh357hJOiqqeelpKRkpCOkJilsLOsnY+JjZafo6WmqayropSJho+erLGtpJyYlpOOiouUoq2upJOFf4KJj5GRlJmcmY18b212hZGUj4eAfXp0a2Znc4KNjYFvYl1gZWhqa3F4fXhqWEtKVWVwc29pZmRgWE5ITVtteXhsXFFOUlZYWl5oc3l0ZVNISldncnVzcXFxbWNYU1ptgY2MgXNqam1wcHJ6h5adloVzaW17i5SXl5ibnJWIe3aAlKm0sqaZkpGSkY+Rmqu6wLajj4aKlqOqrK2wtLOoloaCjKC0vLirn5mWk42IiJSmtbmslYB3e4WOkpKVm5+cjXdlYWyBk5mTh314dG1jW11rgJCRgmtXT1NcYmRmbHZ9eGZPPDpIXm91cGdhXlpRRDxBVGx+f29aSURJUVVXXWl3gHtoTz9AUWh5fnt3dnZyZVdPWG+LnZ2Oem1qb3R2eIGSpa+oknhpbH6Uo6empqipoZB+doGbt8jGtaKXlZaWk5SftMnRxquQgYSVp7Gzs7a6uayVfnaCnLjFv66ckY6LhHx8iaG2vKyPcmNndYOJio2TmZaEaE5GVHGKlY5+b2djXFBGR1h0i5B+X0M4PUpUWVxkcHp2YUIpJDdVbnhzZ15aVkw8MjdPcIqOfF5GP0VRWV1kc4aUj3dWPz5UdI2WkouIiIN0YVZffKK8v6uOenV7g4aJk6fAzsaphm5wh6W6wb67vLuynIN2gaLI4N7IrJmUlpeTk5+409/Sr4dwcoehsLOxsra0pIZnWWaJrsK8pIp6dHFqYV9vjaq0ontSPD9UaHR2eH+IhnBMKh0vVXqMhXBbT0pENyorQmeJk35WMB4lOUtUWWJygX9mPhwULFZ8jYd3aWRgVUM2O1mHrLWed1VIUWNwd3+Rqr25m29NSWSQtMK9saupopB3Zm6Txerv1a2Ng4qVm56ov97x6MKQbGmGrszW0MjGxLiceWRvl8nr6syjhnx+gH17iKbJ28udi4mHhYOBf317eXd1c3FvbWtqaGZkY2FfXlxbWVhXVVRTUlFQT09OTU1MTExMS0tLTExMTE1OTk9QUFFSVFVWV1laW11fYGJkZmdpa21vcXN1d3p8foCChIaJi42PkZOVl5mbnZ+goqSlp6iqq6yur7CxsrOztLW1tra2tra2tra2tbW0tLOysbCvrq2sqqmnpqSioJ+dm5mXlZORjoyKiIWDgX98enh1c3FvbWpoZmRiYF5cWllXVVRSUVBOTUxLSklISEdHRkZGRkZGRkZHR0hISUpLTE1OUFFTVFZXWVtdX2FjZWdpbG5wc3V3enx/gYSGiIuNkJKUl5mbnaCipKanqautrrCxs7S1tre4ubq7u7y8vLy8vLy8u7u6ubm4t7a0s7Kwr62rqqimpKKfnZuZlpSRj4yKh4WCgA==",
  sfx_wire_connect:
    "data:audio/wav;base64,UklGRkQcAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YSAcAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f39+fn5+fn5+fn5+fn5/f39/f39/gICAgICBgYGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAf39/f39/f39/fn5+fn5+fX19fX19fX19fX19fX19fn5+f39/gICBgYGCgoKCg4ODg4ODg4ODgoKCgoKBgYGBgYCAgICAgICAf39/f39/fn5+fn59fX18fHx8fHt7e3t7e3t8fHx9fX1+fn+AgIGBgoKDg4SEhISEhISEhISEhIODg4KCgoGBgYGAgICAgIB/f39/f35+fn19fXx8fHt7e3p6enp6enp6enp7e3x8fX5+f4CBgoKDhISFhYWGhoaGhoaGhYWFhISDg4OCgoGBgYGAgICAf39/f35+fn19fXx8e3t6enl5eXh4eHh4eHl5enp7fH19fn+AgYKDhIWGhoeHh4eHh4eHh4aGhYWEhIODgoKCgYGBgICAf39/f35+fX19fHt7enp5eXh4d3d3d3d3d3d4eXl6e3x9foCBgoOEhYaHiIiJiYmJiYmIiIeHhoaFhISDg4KCgYGAgIB/f39+fn59fXx7e3p5eXh3d3Z2dnV1dXV2dnd4eHl7fH1/gIGDhIWGh4iJioqKioqKiomJiIiHhoWFhIODgoKBgYCAgH9/fn59fXx8e3p5eXh3dnZ1dXR0dHR0dHV2d3h5enx9f4GChIWHiImKi4uMjIyMi4uKiomIh4aGhYSDg4KCgYGAgH9/fn59fXx7enp5eHd2dXR0c3NycnJzc3R1dnd5enx+f4GDhYaIiYqLjI2NjY2NjIyLiomJiIeGhYSDg4KBgYCAf39+fn18fHt6eXh3dnV0c3JycXFxcXFyc3R1d3h6fH6AgoSGiIqLjI2Ojo+Pjo6NjYyLiomIh4aFhIOCgoGAgH9/fn19fHt6eXh3dnV0c3JxcHBwcHBwcXJzdXd5e31/gYSGiIqLjY6PkJCQkI+Pjo2Mi4qJh4aFhIODgoGAgH9/fn19fHt6eXh2dXRzcnFwb25ubm9vcHFzdXd5e36Ag4WIioyNj5CRkZGRkZCPjo2Mi4mIh4aFhIOCgYGAf39+fXx7enl4d3V0c3Fwb25tbW1tbm5wcXN1d3p8f4KFh4qMjo+RkpKTkpKSkZCOjYyKiYiGhYSDgoGBgH9+fn18e3p4d3Z0c3Fwb25tbGxsbG1ub3Fzdnh7foGEh4mMjpCRk5OUlJOTkpGQjo2LioiHhYSDgoGBgH9+fXx7enl4dnVzcnBvbWxra2pra2xtb3F0dnl8gIOGiYyOkJKTlJWVlZSTkpGPjoyKiYeGhYOCgYGAf359fHt6eHd1dHJwb21sa2ppaWpqbG1vcnV4e36ChYiLjpGTlJWWlpaVlZOSkI+Ni4mIhoWEg4KBgH9+fXx7eXh2dHNxb21samloaGhpamttcHJ2eX2AhIeLjpGTlZaXl5eXlpWTkZCOjIqIh4WEg4KBgH9+fXt6eXd1dHJwbmxqaWhnZ2doaWttcHN3en6ChoqNkJOVl5iYmZiXlpWTkY+Ni4mHhoSDgoGAf359e3p4d3VzcW9ta2loZ2ZmZmdpa21wdHh8gISIjI+SlZeYmZqZmZiWlJKQjoyKiIaFg4KBgH9+fHt6eHZ0cnBubGpoZmVlZWVmaGptcXV5fYGGio6RlJeZmpubmpmYlpSSj42LiYeFhIOBgH9+fXt6eHZ0cnBta2lnZWRkZGRlZ2ptcXV5foKHi4+Tlpiam5ycm5qYlpSRj42KiIaFg4KBf359fHp4dnRycG1raGZlY2NjY2RmaWxwdHl+g4iMkJSXmpydnZ2cmpiWlJGPjIqIhoSDgYB/fnx7eXd1cnBta2hmZGNiYWJjZWhrb3N4fYKHjJGVmJucnp6enZuZl5SRj4yKiIaEg4GAfn18enh2c3FubGlmZGJhYWFhY2ZpbXF2e4GGi5CUmJudnp+fnpyamJWSj42KiIaEg4GAfn17eXd1c3BtamhlY2FgX2BhY2ZqbnN4foSJjpOXm52foKCfnpyZlpSRjouJh4WDgYB+fXt5d3VycG1qZ2RiYF9fX2BjZmpudHl/hYuQlZmcn6ChoZ+em5mWk5CNioiGhIKBf318enh1c3BtamdkYV9eXl5fYWVpbXN5f4WLkZaanaChoqGgnpyZlpOQjYqHhYOCgH59e3l3dHFua2hlYmBeXV1eYGJma3F3fYOKkJWanaCio6Khn52al5OQjYqIhYOCgH59e3l2c3BtamdjYV5dXFxdX2NnbHJ5f4aNkpicoKKjpKOhn5yZlZKPjImGhIKAf317eXZ0cW1qZmNgXlxbW1xfYmdscnmAh42UmZ2ho6Sko6KfnJiVkY6LiIaEgoB+fHp4dXJva2hkYV5cWlpbXWBkanB3foWMkpidoaSlpaSjoJ2ZlpKPi4iGhIKAfnx6d3VxbmpmY19dW1lZWl1gZWtyeYCIj5WboKOlpqakop+cmJSQjYqHhYKAf316eHVybmtnY19cWllYWVxfZGpxeICIj5acoKSmp6elo5+cmJSQjYmHhIKAfnx6d3RwbWllYV1aWVhYWl1hZ211fYWMlJqfpKaoqKakoZ2ZlZGNioeFgoB+fHp3dHBsaGRgXVpYV1dZXGFnbnZ+ho6VnKGlp6iopqSgnZiUkIyJhoSBf317eHVybmpmYV1aWFZWV1pfZGtze4SMlJuhpaipqailop6ZlZGNiYaEgX99e3h1cW1pZWBcWVdVVldbX2ZtdX6Hj5eeo6epqqmnpKCcmJOPi4iFg4B+fHl2c29qZmFdWVdVVVZZXWRrc3yFjpado6eqq6qopaGdmJSPi4iFgoB+e3l1cm5pZWBcWFVUVFZZX2Vtdn+IkZmgpamrq6qnpKCblpKNioaEgX98enZzb2pmYVxYVVNTVVhdY2t0foeQmaCmqqysq6ikoJuWko2KhoOBfnx5dnJuaWRfW1dUU1NVWF5lbneBi5Sco6irrayqp6OemZSQi4iFgn99endzb2tmYFxXVFJSU1dcY2x1f4mTnKOorK2tq6ikn5qVkIyIhYJ/fXp3c25qZF9aVlNRUVNXXWVueIKNlp+lqq2uraunop2Yk46KhoOBfnt4dHBrZmFcV1NRUVJVW2JrdYCKlJ2lqq2vrqyoo56Zk4+Kh4SBfnt4dHBrZmBbVlJQUFJVW2Ntd4KNl6CnrK+vrqunop2Xko2JhYKAfXp2cm1oYl1YU1BPUFNYX2hzfomUnaWrr7CvramknpmTjoqGg4B9endybmhjXVhTUE9PUlhfaHN+ipWepqyvsbCtqaOemJKNiYWCf3x5dXFsZmBaVVFPTlBUWmNteISPmqOqr7Gxr6umoJqVj4uHg4B9enZybWdhW1ZRT01PUllha3aCjpmiqq+xsq+sp6GblY+Lh4OAfXp2cWxmYFpVUE5NT1NaY215hpGcpaywsrKvqqWfmZOOiYWCf3t4dG9pY11XUk5MTVBWX2l1gY6Zo6uwsrOwrKehmpSPioaCf3x4dG9qY11XUk5MTVBWXml1gY6apKuxs7OwrKegmpSOiYWCf3t3c25oYVtVUExLTVFYYW15hpOeqK6ztLOvqqSdl5GMh4OAfXl1cGpkXVZRTUtLT1VeaXaDkJymrrK0tLCrpZ+YkoyIhIB9eXVwamNdVlBMSktPVV5qd4SRnaevs7W0sKuknpeRi4eDf3x4c25oYVpUTktKTFBYYm98ipejrLK1tbOuqKGalI6JhYF9enVwamNcVVBLSUpOVV9reYeUoaqxtba0r6mim5SOiYWBfnp1cGpjXFVPS0lKTlVgbHqIlqKssra2tK+ooZqTjYiEgH15dG5oYVpTTUlIS1BYZHGAjpunr7W3trKspZ6XkIuGgn56dnFrZFxVT0pISU1VYG17ipikrrS3t7Oup6CYkoyHg397d3FrZFxVT0pISE1VX217ipmlrrW4t7Oup5+YkYuGgn56dnBqYlpTTUlHSU5XY3GAj52psbe4trKrpJyVjomEgHx4c21mXlZPSkdHS1Jda3qJmKWvtri4tK6nn5eQioaBfXl0bmdfV1BKR0dKUVtpeIiXpK+2ubi1r6efl5CKhYF9eXRuZ19XT0lGRkpSXWt6ipqnsbe5uLStpZ2Wj4mEgHx3cmtkXFNMSEVHTFZicYGRoKy0ubm3saqhmZKMhoJ+eXRuZ15WT0lFRkpSXmx9jZyps7m6uLOso5uTjYeDfnp1b2dfV09JRUVJUV1sfI2cqbO5urizrKObk4yHgn55dG5mXlVOSEVFSlNfb4CRoKy1uru3samhmJGLhYF8eHJrY1pSS0ZERk1YZneImKeyubu6ta2lnJSNh4N+enRuZl1UTEdERUpUYXKDlKSwuLu7tq+nnpaOiIN/enVuZ15VTUdDRElTYXGDlKOwuLy7t6+nnpWOiIN+enRtZl1UTEZDREpVY3SGmKeyury6ta6lnJOMhoJ9eHJrYllQSURDRk5aanyOn623vLy5sqmgl5CJhH96dW5mXVRLRUJESlVkdoiaqbS7vbq0rKOakYuFgHt2b2deVUxGQkNJU2JzhpiotLu9u7Wto5qSi4WAe3ZvZ15UTEVCQ0lUY3WImqq1vL27tKuimZCKhH96dG1lW1JJQ0FETFhpe46grri9vbmxqJ6VjYeCfXhxaWBXTUZCQkdRYHKGmKm1vL67tayimZCJhH96dGxjWlBIQkFFTlxtgZSls7u+vbeupJuSi4V/enRtZFtRSEJARE1abH+TpbK7v723rqSakoqEf3p0bWRaUEdCQEROXG+Clqe0vb+8tqyimZCJg355cmphV01FQEFHUmJ1iZ2tuL6/urKpnpWNhoF8dm9mXFFIQkBDTFpsgJSmtL2/vbatopiQiYN+eHFpX1VLQ0BBSFVme4+isbvAvrivpZuRioR+eXJqYFZMREBAR1NleY6hsbvAv7mwpZuSioR+eXJqYFVLQz9ASFVme5CjsrzAvriupJmQiYN9eHBoXVNJQj9BSllsgZaotr7AvbWroJaNhoF7dW1kWU5FQD9EUGF1i5+wu8C/ubClm5GJg354cWhdUkhBPkFLWm2DmKu4v8G8tKmelIyFf3pzamBVSkI+QEhWaX+VqLa/wb21q5+VjYaAenNrYVZLQj4/R1VofpSot7/BvbWqn5WMhX96c2pgVEpBPkBJWGuCmKu5wMG8s6idk4uEfnhxaF1RR0A9QUxdcomesLzBwLqwpJmQiIJ8dW1jWE1DPj5FU2Z9k6i3wMK+taqelIuEfnhxaF1RRj89Qk1fdIuhsr7CwLiuopeOhoB6c2pgVElAPUBKWm+Gna+8wsG6sKSZj4eBe3RrYVVKQT0/SVluhZyvvMLBurCkmY+HgXt0a2BUSUA9P0lacIiesb3Cwbmvo5eOhoB6cmleUkc/PEFNX3WNo7W/w7+3q5+Ui4R+d29lWk5DPT1EU2d/l6u6wsK8sqaakIiBe3RrYFNIPzxAS110jKO0wMPAt6uflIuEfXduZFhMQjw9RlZshJywvcPBuq+il42Ff3hxZltOQz09RFNogJitvMPCu7CkmI6GgHlxZ1xPRD08Q1Jnf5etvMPCu7CkmI6Gf3lxZ1tOQzw8RFNpgZqvvcPCuq+ilo2FfnhvZVhMQTw9Rlhuh6Czv8TBuKufk4qDfHVsYVRIPzs/TF93kai5wsO+s6aaj4eAeXFnW05DPDxEVGuEnbG/xMG4rJ+UioN8dWxgU0c+O0BNYnqUq7vDw7yxpJeNhX53b2RXSkA7PklcdI6muMLEvrOmmo+GgHlwZllMQTs9R1lxi6S3wsS/tKeakIeAeXFmWUxBOzxHWXGMpLfCxL+0p5qPhn94cGVYS0A7PUhcdI+nucPEvbKlmI2FfnduYlVIPjo/TGF7lq29xMO7rqGUi4N8dGpeUEQ8O0NTaoWftMHFwLapm5CHgHlwZVhKQDo9SV53kqq8xMS8r6KVi4N8dGpeUEM8O0NUbYiitsLFv7SnmY6GfnduYlRHPTpAT2WAm7HAxcK3qpyRh4B5cGVXST86PkthfJeuvsXCuayekoiBenFmWEo/Oj1KX3qWrr7Fw7msnpKIgXpxZlhKPzo9S2F8l6+/xcK4q52RiIB5cGRWSD46P05lgJyywcXBtqiaj4Z+d21hU0U8OkJTbIijuMPFvrKkloyDfHRpXE5BOjtHXHaTrL3Fw7qsnpGIgHlvY1VHPTlAUGiEoLbDxb+zpZeMhHx0aVxNQTo8SF14la6/xcK4qpyQhn93bWFSRDs6Q1VvjKe7xcS8rqCTiYF5cGRWRz05QFFqh6K4xMW+saKVioJ6cWZYST45Pk5ng6C2w8W/sqOWi4J7cmZYSj45Pk5mg6C2w8W/sqOVioJ6cWZXST05P1BphqK4xMW9sKGUiYF5cGRVRjw5QVRujKe7xcS7rZ6Rh393bWBRQzo6RVp2lK6/xsK3qJqOhH10aVtMPzk9TGSBn7bDxr6xopSJgXlwY1RGOzpCVnGQq77Gw7iqm46FfXVpW0w/OT1MZYKgt8TFvrChk4iAeG5hUkM6OkVbeJawwcbBtaWXi4N7cWVWRzw5QVVwj6q+xsO4qZqOhHxzaFlKPjk/UWuKprvFxLqrnI+FfXVpW0s/OT5PaYelusXEu6ycj4Z+dWlbSz85Pk9piKW7xcS6q5yPhX10aVpKPjk/UWyLqLzGw7mpmo6EfHNnWEg8OUFVcZCsv8bCtqaXi4J6cGNURTs6RVx5mLLCxr+xoZOIgHdtX09BOTxMZYSjucXFuqucj4V9c2dYSD05QVZykq7AxuzXvKOQgnRjTDIbDREoUYO12+/v38eumIh7bVpCKRYRHj1qnMfk7eXRuKGPgnVlUDgiFRkvVYSy1efn2MGqlod7bVtFLh0ZJkVvncXe5dzJsp2NgHRlUTomHCI5Xou00+HezrijkYR5bFpELyIhMlJ7pcfb3dG+qJaIfXFhTTgoIy5Jb5m91NvTwayZi390ZlQ/LiYtRGiQtc7Y0sKum4yBd2lYRDMqL0Nki6/J1NDBrpuNgnhrWkc2LTFEZIqtxtHNv6yajIF4a1tIODA0SGiMrsbPyruol4qAdmpaRzgyOU9vk7LGzMW1o5OHfnRnVkU4NUBZep24x8i9rZyOg3pwYlFBODtMaIqpv8fCtKOUiH92alpJPTpFXHuctcPDuKiYi4J5b2FQQjxCVXKTrr7CuaqbjYR7cmRVRj9DU2+OqrvAuaqbjoR8c2ZXSEFEVXCOqbq9tqiZjIN7cmVWSUNIWnWTq7m7sqOViYF5b2JTSEVOY3+bsLm2q5yPhX52alxPR0lYcY2mtbevopSJgXlwY1VLSVNphJ6wtrGll4uDfHNnWU5KUmV/may0saWXjIN8dGhbUExTZn+Zq7Ovo5aLgnxzaFpQTldrhJyssaufkoiBenFlWFBRXXSNoq6upZmNhH52bF9VUVdpgZmprqmdkYeAenFlWVJVY3qSpKyqn5OJgntzaFxUVWJ3j6KrqZ+TiYJ7c2ldVVdjeJCiqqedkYiBe3JnXFZZaH6UpKmkmY6Ff3hvZFpXX3CHm6amnpOJgnx1al9ZW2h9k6KmoZeMhH54bmNbWmR3jZ6lopiNhX95cGVcW2R2i5ykoZiNhX95cGZdXGV4jZ2jn5aMhH54b2RdXmp9kZ+inJKJgnx1bGJdYnGGmKGfl42Ff3lxZ19gan2QnaCakIeBfHRrYl9neIyboJuSiIJ9dm1jYGZ2iZmfm5KIgn12bWRhZ3eKmZ6ZkIeBfHVsZGJre46anZeNhYB6c2ljZXCCk5ybkomDfnhvZmNqeYuYnJaNhYB6c2pkZ3OFlZuYj4eBfHVsZWZxgpKamJCHgX12bmZmcIGRmZiQh4F9dm5nZ3KDkpmWjoaBfHVsZ2l1hpSYlIuEf3pzamdtfIyWl5CIgn13b2hpdISSl5OLhH96c2tob36OlpWNhoB8dW1pbXqKlZWPh4F9d29pbHmIlJWPh4F9d29qbXmJk5WOhoF9d29qbnuKlJOMhYB8dW5rcX+NlJGKg396c2xsdoWRlI6HgX13cGtwfYyTkYqDf3pzbW14hpGSjIWAfHZvbXSCj5KOhoF9d3Btc4CNko6Hgn54cW1yf4ySjoeCfnhxbXOAjZGNhoF9eHFudYKOkYyFgHx2cG94hY+QioN/e3RvcX2KkI6HgX54cW92g46QioR/e3Vwcn2KkI2GgX14cXB4ho+OiIJ+enNwdoKNj4mDf3t0cHSAjI+KhIB7dXF0f4uOioSAfHZxdH+LjomDf3t1cXWBi46Ig397dHF3g4yNh4J+eXNyeoaNi4WAfXdydH+KjYmDf3t1cniEjIuGgX14c3R+iY2Ig397dXN5hYyKhIB9d3N2gouLhoF+eXN1f4mMh4J+enR0fYiMiIJ/e3V0fIeMiIN/e3V0e4aLiIJ/e3V0fIeLh4J/e3V1fYiLhoF+enV2f4mKhYF+eXR4goqJhIB8d3V7hoqHgn97dnZ/iIqFgH14dXmEioeCf3t2dn+IiYSAfXh1eoWKh4J/enZ4gYmIg398d3Z+h4mEgH14dnyGiYWBfnl2eoSJhoF+enZ5g4mGgn97dnmCiYeCf3t3eYKIhoJ/e3d5g4iGgX96d3qEiIWBfnp3e4WIhIB+eXd9hoiDgH14eICIh4J/e3d6g4iFgX56d32Gh4OAfHh5gYeGgX56d3yFh4OAfXh5gYeFgX56eH2Fh4N/fHh6goeEgH55eH+GhoF/e3h9hYeCf3x4e4OHg4B9eXqBh4SAfnp5gIaFgX56eX+GhYF/e3l+hoWBf3t5foWFgX97eX6FhYF/e3l/hoWBfnt5f4aEgX56eoGGhIB+enqChoOAfXl8g4aCf3x5foWFgX97eoCGhIB+enuChoJ/fHl9hIWBf3t6gYaDgH16fISFgX97eoCFg4B9enyDhYF/e3qAhYOAfXp9hISBfnt7goWCf3x6f4WDgH56fYSEgX57e4KFgn98eoCFgoB9en6Eg4B+en2EhIB+e3yDhIF/e3uChIF/fHuBhIF/fHuBhIJ/fHuBhIJ/fHuBhIJ/fHuBhIF/fHuBhIF/fHyChIF/fHyChIF+e32Dg4B+e36Eg4B+e3+Egn99e4CEgX98fIKDgX57fYODgH57f4SCf318gYSBf3x9g4OAfnuAhIF/fHyCg4B+fH6Dgn99fIGDgH58foOCf318gYOAfnx+g4J/fXyBg4B+fH+DgX99fYKCgH58gIOBf3x+g4J/fX2CgoB+fICDgX98f4OBf319goKAfXyBg4B+fICDgH98f4OBf3x+g4F/fX2CgoB9fYKCgH58gYKAfnyBg4B+fICDgH58gIOAf3x/g4B/fH+DgH98f4OAf3x/g4B/fICDgH58gIKAfn2AgoB+fYGCgH59gYKAfn2CgX99foKBf31/goF/fYCCgH59gYKAfn2BgX99foKBf31/goB/fYCCgH59goF/fX6CgH99gIKAfn2BgX99f4KAf32AgoB+foKBf31/goB+fYGBf31/goB/fYGBf35+goB/fYCBgH5+goB/fYCBgH5+goB/fYGBf35/goB+fYE=",
  sfx_step_debug:
    "data:audio/wav;base64,UklGRuQNAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YcANAACS1drGyLhzLSQ5OEWHz9rHxrx9NCQ5OkJ9yNrHxL+GPCU4PEB0wNrIwsGPRCY3Pj9st9jJwMGXTSg2QD5krtbKvsGfVis1QT9dpdTLvcClXy40Qj9Ym9DMvb+qaDIzQ0BTksvNvL6vcTcyQ0JPisXNvLyyej0yQ0RMgb/NvLq0gkMyQkZJebjNvbm2ikkzQkdIcbHMvbe3kVE0QUlIa6rKvra3l1k2QEpIZKLIv7S3nWE4P0tJX5vFwLO2omg7PktKWpPBwbO1pnBAPkxLV4u9wrO0qXhEPUxMVIS4wrOyrH9KPUxOUnyzwbSxroZQPUtPUXatwbSvr4xWPktQUHCnwLWur5JcQEpRUGugvratr5diQklSUGaZvLasrpxpRUhTUWKTubesraBwSEhUUl6MtrisrKJ2TEdUU1yGsrisq6V9UEdTVFp/rbisqqaDVEdTVlh6qLisqaeIWUhTV1d0o7etqKiNX0lSWFdvnbatp6iSZEpRWVdrmLSupqiWakxRWVhnkrGvpaeZcE9QWlhkjK6vpaacdVFQWllhh6uwpaWee1VPWlpggaiwpaSggFlPWltefKSvpaOhhV1PWVxed6CvpqKiiWJQWV1dc5uupqGijmdRWF5db5atp6CikWtTWF9dbJGrqKCilHBVV19eaYypqKChl3VYV2BfZ4imqKCgmXpaVmBfZYOkqaCfm35eVl9gZH+gqaCenINhV19hY3qcqKCdnYdlV19iYneYqKCdnYpoWF5jYnOUp6GcnY5sWV5jYnCQpaGbnZBxW11kYm2Mo6KbnJN1XF1kY2uIoaKbnJV5X11kZGmEn6Obm5Z9YVxkZWiAnKObmpeBZFxkZWd9maKbmZiEZ11kZmd5lqKbmZiHa11jZ2Z2k6GcmJmKbl5jZ2Zzj6Ccl5mNcl9iaGdxjJ+dl5iPdWFiaGdviJ2dl5iReWNiaGhthZudl5eSfGViaGhsgZmdl5aUf2diaGlrfpedl5aUgmpiaGpre5Sdl5WVhW1iaGpqeZGdmJWViG9jZ2tqdo6cmJSVinJkZ2tqdIubmJSVjHVlZ2tqcoiZmZOUjnhmZmxrcYWYmZOUj3toZmxrb4KWmZOTkH5qZmxsboCUmZOTkYFsZmttbn2SmZSSkYNuZmttbXqPmJSSkoZxZ2tubXiNmJSRkohzZ2tubXaKl5WRkop2aGpubnSIlpWRkYt4aWpubnOFlZWQkYx7a2pvbnKDk5WQkY19bGpvb3GAkpWQkI6Abmpvb3F+kJWRkI+CcGpucHB8jpXMrYlGEDGW1s6vjU0TLI7Tz7GQUxYnhdDRs5NZGSN9zdK1ll8eH3XJ07eZZSIcbcTTuZtrJxplvtS6nnAsGF641LygdTIXVrLUvqJ6NxdPrNPApH49F0ml0sGmgkMYQ57Qw6eGSRo9l87FqYlPHDiQzMarjFUeM4nJx6yPWiIugsbJrpJgJit7wsmwlWUqJ3O+yrGXai4lbLnKs5lvMyNltcu1m3M4Il+wyradeD0iWKrKuJ98QiJSpcm5oYBHI0yfyLuig0wkRpnGvKSGUSZCk8W+pYpWKD2Mwr+njFsrOYbAwKiPYC42f73BqpFlMTN5usGrk2o1MXK2wq2VbjgvbLLCrpdyPS5mrsKvmXZBLWCpwrGbekUtWqTCspx+Si1Vn8G0noFOLlCZwLWfhFMvS5S/tqCHWDBHjr23oolcMkOIu7ijjGE0QIK4uaSOZTc9fbW6ppBpOjp3srunkm0+OHGuu6iUcUE3bKu7qZV1RTVnp7url3hJNWGiu6yYfE01XJ66rZp/UTZYmbmum4JWN1OVuLCchFo4T5C3sZ2HXjpLi7WynoliPEiFs7Ogi2Y+RYCxs6GNakFDe660oo9tQ0F2q7SjkXFGQHGotaSSdEo/bKW1pZN4TT5nobWnlXtRPmOetKiWflQ+Xpq0qZeAWD5albOqmINbP1eRsquZhV9AU4yxrJqHY0JQh6+tnIlmRE6Dra2di2pGS36rrp6MbUhJeqivn45xSkd1pq+gj3RNRnGjr6GRd1BFbZ+vopJ5VERonK+jk3xXRGSYrqSUflpEYZWupZWBXUVdka2mloNhRlqNrKaXhWRHV4mqp5iHZ0lUhamomYlqS1GBp6maim1NUH2lqZuMcE9OeaOpnI1zUk11oKqdjnZUTHGeqp2PeVdLbZuqnpB7WktpmKmfkX1cS2aVqaCSgF9MY5KooZOCYkxgjqiilIRlTV2Kp6KVhWhOWoemo5aHa1BYg6SklohuUVZ/o6SXiXFTVXyhpZiLc1VTeJ6lmYx2V1J0nKWajXhaUXGZpZuOelxRbpelm498X1FrlKWckH5hUWiRpZ2QgGRRZY6knpGCZ1Jii6OekoNpUmCIop+ThWxUXYWhoJOGblVbgZ+glIhxV1p+nqGViXNZWHucoZaKdVtXeJqhlot3XVZ0mKGXjHpfVnGWoZiNfGFWbpOhmY19Y1ZskaGZjn9lVmmOoJqPgWhXZ4yfm5CCaldkiZ+bkIRsWGKGnpyRhW9ZYYOdnJKGcVtfgJudkodzXF59mp2TiHVeXXqZnZSJd19cd5edlIp5YVt1lZ6Vi3tjW3KTnpWLfWVab5Cdlox+Z1ptjp2XjYBpW2uMnZeNgWtbaYmcmI6CbVxnh5uYj4RvXGWEmpmPhXFdY4GZmZCGc19if5iakId1YGF8lpqRiHdiYHqVmpKIeWNfd5Oakol6ZV51kZqTinxnXnKQmpOKfWlecI6alIt/al5ujJmUjIBsX2yJmZWMgW5faoeYlY2DcGBohZiWjYRyYWeDl5aOhXRiZoCWl46GdWNlfpWXj4Z3ZGR8lJePh3lmY3mSl5CIemdjd5GXkIh8aWJ1j5eRiX1qYnONl5GJfmxicYyXkoqAbWJvipeSi4FvY26IlpOLgnFjbIaWk4uDcmRrhJWUjIN0ZGmBlJSMhHVlaH+TlI2Fd2ZnfZKVjYZ4Z2Z7kZWOhnppZnmPlY6He2pld46Vj4h8bGV2jZWPiH5tZXSLlZCJf25lcomUkImAcGVwiJSQioFxZm+Gk5GKgnNmbYSTkYqDdGdsgpKSi4N2aGuBkZKLhHdpan+RkoyFeGpqfZCSjIV6a2l7jpKMhntsaXmNko2GfG1oeIySjYd9bmh2i5KOh35vaHSJko6If3Foc4iSjoiAcmhyhpKPiYFzaXCFkY+JgnVpb4ORj4mDdmpugZCQioN3a22Aj5CKhHlrbH6PkIqEemxsfI6Qi4V7bWt7jJCLhXxua3mLkYyGfW9reIqQjIZ+cGp2iZCMh39yanWIkI2HgHNrdIaQjYeAdGtzhY+NiIF1a3GEj46IgnZscIKOjoiCd2xvgY6OiYN5bW9/jY6JhHpubn6MjomEe29ufIyPioV8cG17i4+KhX1xbXmKj4qFfnJteImOi4Z+c213iI6Lhn90bXaGjouGgHVtdYWOjIeBdm10hI6Mh4F3bnODjYyHgnhucoGNjIiCeW9xgIyNiIN6b3B/jI2Ig3twcH2LjYiEfHFwfIqNiYR8cm97iY2JhH1yb3qIjYmFfnNveYeNioV/dG93ho2KhX91b3aFjYqGgHZvdYSMioaBd291g4yLhoF4cHSCjIuHgnlwc4GLi4eCenFyf4uLh4N7cXJ+iouHg3xycX2Ji4iDfHNxfImLiIR9c3F7iIuIhH50cXqHi4iEfnVxeYaLiYV/dnF4hYuJhYB3cXeEi4mFgHhxdoOLiYWBeHF1goqJhoF5cnWBioqGgnpydICKioaCe3N0f4mKhoJ8c3N+iYqHg3x0c32IioeDfXRzfIeKh4N+dXJ7h4qHhH52cnqGioeEf3ZyeYWKiIR/d3J4hIqIhIB4cniDioiFgHlzd4KKiIWBeXN2gYmIhYF6c3aBiYmFgnt0dYCIiYWCfHR1f4iJhoJ8dXR+h4mGg311dH2HiYaDfXZ0fIaJhoN+dnR7homGg393dHqFiYeEf3h0eoSJh4SAeHR5g4mHhIB5dHiDiIeEgHp0eIKIh4SBenR3gYiIhYF7dXaAiIiFgnx1dn+HiIWCfHZ2f4eIhYJ9dnV+hoiFgn13dX2GiIWDfnd1fIWIhoN+eHV7hYiGg394dXuEiIaDf3l1eoOIhoOAeXV5g4iGhIB6dXmCiIaEgHt1eIGHh4SBe3Z4gYeHhIF8dneAh4eEgXx2d3+Gh4SCfXd3foaHhYJ9d3Z+hYeFgn54dn2Fh4WCfnh2fISHhYJ/eXZ8hIeFg395dnuDh4WDf3p2eoOHhYOAenZ6goeGg4B7dnmBhoaDgHt3eYGGhoOBfHd4gIaGhIF8d3iAhoaEgX14eH+FhoSCfXh4foWGhIJ+eHd+hYaEgn55d32EhoSCf3l3fISGhIJ/end8g4aFgn96d3uDhoWDgHt3e4KGhYOAe3d6goaFg4B7eHqBhoWDgHx4eYCGhYOBfHh5gIWFg4F9eHl/hYWDgX15eX+FhYOBfnl4foSGhIJ+eXh+hIaEgn56eH2EhoSCf3p4fIOGhIJ/enh8g4WEgn97eHyChYSCgHt4e4KFhIKAfHh7gYWEgoB8eHqBhYWDgHx5eoCFhYOBfXl6gISFg4F9eXl/hIWDgX55eX+EhYOBfnp5foSFg4F+enl+g4WDgn96eX2DhYOCf3t5fYOFhIJ/e3l8goWEgoB7eXyChYSCgHx5e4GFhIKAfHl7gYSEgoB9eXuA",
  sfx_compile:
    "data:audio/wav;base64,UklGRsNBAABXQVZFZm10IBAAAAABAAEA4C4AAOAuAAABAAgAZGF0YZ9BAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f39/f39+fn5+fn5+fn5/f39/f39/f39/f39/f3+AgICAgICAgICAgICBgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAf39/f39/f39/f35+fn5+fn5+fn5+fn5+fn5+fn5+f39/f39/f39/gICAgICAgICAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGAgICAgICAgH9/f39/f39+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+f39/f39/f4CAgICAgICBgYGBgYGBgYGBgYKCgoKCgYGBgYGBgYGBgYGAgICAgIB/f39/f39+fn5+fn5+fn19fX19fX19fX19fn5+fn5+fn5/f39/f3+AgICAgICBgYGBgYGCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgICAgIB/f39/f35+fn5+fn19fX19fX19fX19fX19fX19fX5+fn5+fn9/f3+AgICAgIGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYCAgIB/f39/fn5+fn59fX19fX19fX19fX19fX19fX19fX1+fn5+fn9/f3+AgICAgYGBgYKCgoKCgoKDg4ODg4ODg4OCgoKCgoKBgYGBgYCAgH9/f39+fn5+fX19fX19fHx8fHx8fHx8fHx8fX19fX1+fn5+f39/f4CAgIGBgYGCgoKCgoODg4ODg4ODg4ODg4ODgoKCgoKBgYGBgICAf39/fn5+fn19fX18fHx8fHx8fHx8fHx8fHx8fX19fX5+fn5/f3+AgICBgYGBgoKCgoODg4ODg4ODg4ODg4ODg4ODgoKCgoGBgYCAgH9/f35+fn19fX18fHx8fHx7e3t7e3t8fHx8fHx9fX19fn5+f39/gICAgYGBgoKCg4ODg4OEhISEhISEhISDg4ODg4KCgoGBgYCAgH9/f35+fn19fXx8fHx7e3t7e3t7e3t7e3t8fHx8fX19fn5+f3+AgICBgYGCgoKDg4ODhISEhISEhISEhISEg4ODg4KCgoGBgYCAf39/fn5+fX18fHx8e3t7e3t7e3t7e3t7e3t8fHx8fX1+fn5/f4CAgIGBgoKCg4ODhISEhISEhIWFhISEhISEg4ODg4KCgYGBgIB/f35+fn19fHx8e3t7e3t6enp6enp6e3t7e3x8fH19fX5+f3+AgICBgYKCg4ODhISEhIWFhYWFhYWFhYSEhISDg4OCgoGBgICAf39+fn19fHx8e3t7enp6enp6enp6enp7e3t8fHx9fX5+f39/gICBgYKCg4OEhISEhYWFhYWFhYWFhYWEhISEg4OCgoGBgIB/f35+fX18fHx7e3t6enp6enp6enp6enp7e3t8fHx9fX5+f3+AgIGBgoKDg4SEhIWFhYWFhoaGhYWFhYWEhISDg4KCgYGAgH9/fn59fXx8e3t6enp6eXl5eXl5eXp6enp7e3x8fH1+fn9/gICBgYKDg4OEhIWFhYaGhoaGhoaGhoWFhYSEg4OCgoGBgIB/fn59fXx8e3t6enp5eXl5eXl5eXl5enp6e3t8fH19fn5/gICBgYKDg4SEhIWFhoaGhoaGhoaGhoaFhYWEhIODgoGBgIB/fn59fXx7e3p6enl5eXl5eXl5eXl5enp6e3t8fH19fn9/gIGBgoODhISFhYWGhoaGh4eHh4aGhoaFhYSEg4OCgYGAgH9+fn18fHt7enp5eXl5eHh4eHh5eXl5enp7e3x8fX5+f4CAgYKCg4SEhYWGhoaHh4eHh4eHhoaGhoWFhIODgoKBgH9/fn19fHt7enp5eXl4eHh4eHh4eHl5eXp6e3t8fX1+f4CAgYKCg4SEhYWGhoeHh4eHh4eHh4eGhoWFhISDgoKBgH9/fn18fHt6enl5eXh4eHh4eHh4eHh5eXp6e3x8fX5+f4CBgYKDhISFhYaGh4eHh4iIiIeHh4eGhoWEhIOCgoGAf39+fXx8e3p6eXl4eHh3d3d3d3h4eHl5enp7fHx9fn+AgIGCg4SEhYWGh4eHiIiIiIiIh4eHhoaFhYSDg4KBgH9+fn18e3t6eXl4eHh3d3d3d3d3eHh5eXp6e3x9fX5/gIGCg4OEhYWGh4eHiIiIiIiIiIiHh4aGhYSEg4KBgH9+fn18e3p6eXh4eHd3d3d3d3d3eHh5eXp6e3x9fn+AgIGCg4SFhYaHh4iIiIiIiIiIiIiHh4aFhYSDgoGAf35+fXx7enl5eHh3d3d2dnZ3d3d3eHh5ent7fH1+f4CBgoOEhIWGh4eIiIiJiYmJiYiIh4eGhoWEg4KBgH9+fn18e3p5eXh3d3d2dnZ2dnZ3d3h4eXp7fHx9fn+AgYKDhIWGhoeIiImJiYmJiYmIiIeHhoWEhIOCgYB/fn18e3p5eHh3d3Z2dnZ2dnZ3d3h4eXp7fH1+f4CBgoOEhYWGh4iIiYmJiYmJiYmIiIeHhoWEg4KBgH9+fXx7enl4eHd2dnZ2dXZ2dnZ3d3h5ent8fX5/gIGCg4SFhoeHiImJiYqKioqJiYiIh4aGhYSDgYB/fn18e3p5eHh3dnZ2dXV1dXZ2d3d4eXl6e31+f4CBgoOEhYaHiIiJiYqKioqKiYmIiIeGhYSDgoGAf358e3p5eHh3dnZ1dXV1dXV2dnd3eHl6e3x9f4CBgoOEhYaHiImJioqKioqKiomJiIeGhYSDgoF/fn18e3p5eHd2dnV1dXV1dXV2dnd4eXp7fH1+gIGCg4SFhoeIiYmKioqLioqKiYmIh4aFhIOCgH9+fXt6eXh3d3Z1dXV0dHV1dXZ2d3h5ent9fn+AgoOEhYaHiImKioqLi4uKioqJiIeGhYSDgoB/fnx7enl4d3Z1dXR0dHR0dXV2dnd4eXt8fX6AgYKEhYaHiImKiouLi4uLi4qJiYiHhoSDgoF/fn17enl4d3Z1dXR0dHR0dHV2dnd4ent8fX+AgYOEhYeIiYmKi4uLi4uLi4qJiIeGhYSCgYB+fXx6eXh3dnV1dHR0dHR0dXV2d3h5e3x9f4CCg4SGh4iJioqLi4yMi4uLiomIh4aFg4KAf358e3l4d3Z1dXR0c3NzdHR1dnd4eXp8fX+AgYOEhoeIiYqLi4yMjIyLi4qJiIeGhYOCgH99fHp5eHd2dXR0c3Nzc3R0dXZ3eHp7fH5/gYKEhYeIiYqLi4yMjIyMi4qKiYeGhYOCgH99fHp5eHZ1dHRzc3Nzc3R0dXZ3eHp7fX6AgYOFhoeJioqLjIyMjIyMi4qJiIeFhIKBf358enl4dnV0dHNzc3Nzc3R1dnd4ent9foCCg4WGiImKi4yMjI2MjIyLiomIhoWDgoB/fXt6eHd2dXRzc3Jyc3NzdHV2eHl7fH6AgYOFhoiJiouMjI2NjYyMi4qJiIeFg4KAfn17eXh3dXRzc3JycnJzc3R1d3h6e31/gIKEhYeIiouMjI2NjY2MjIuKiIeGhIKAf317enh3dXRzc3JycnJzc3R1d3h6e31/gYKEhoeJiouMjY2NjY2MjIuJiIeFg4GAfnx6eXd2dHNzcnJycnJzdHV2d3l7fH6AgoSGh4mKi4yNjY2NjY2Mi4qIh4WDgYB+fHp4d3V0c3JycXFycnN0dXZ4ent9f4GDhYaIiouMjY2Ojo6NjIuKiYeGhIKAfnx6eXd1dHNycnFxcXJzdHV2eHl7fX+Bg4WHiIqLjI2Ojo6OjYyLiomHhYOBf317enh2dXNycnFxcXFyc3R1d3l6fH6AgoSGiIqLjI2Ojo6OjY2MiomHhoSCgH17enh2dXNycXFxcXFyc3R1d3l7fX+Bg4WHiYqMjY2Ojo6OjY2LioiHhYOBfnx6eHd1dHJxcXFxcXFyc3V2eHp8foGDhYeJioyNjo6Pj46OjYyKiIeFg4B+fHp4dnVzcnFxcHBxcXJ0dXd5e31/gYSGiImLjI2Oj4+Pjo2Mi4mHhoOBf317eHd1c3JxcHBwcHFyc3V3eHt9f4GDhoiJi42Ojo+Pj46NjIuJh4WDgX98enh2dHNycXBwcHBxcnR1d3l7foCChYeJi4yNjo+Pj4+OjYyKiIaEgX99enh2dHNycXBwcHBxcnN1d3l7foCChYeJi4yOj4+Pj4+OjYuKiIaDgX98enh2dHJxcHBvcHBxcnR2eHp8f4GEhoiKjI2Oj5CQj4+NjIqIhoSCf316eHZ0cnFwb29vcHFydHZ4enx/gYSGiIqMjo+PkJCPj42MioiGg4F+fHp3dXNycXBvb29wcXN0dnl7foCDhYeKjI2Oj5CQkI+OjYuJh4SCf316eHVzcnFwb29vcHFydHZ4e32Ag4WIioyNj5CQkJCPjo2LiYaEgX98eXd1c3Fwb29vb3Bxc3V3eXx+gYSGiYuNjo+QkJCQj42MioeFgn99enh1c3Jwb29ub3BxcnR2eXt+gYSGiYuNjpCQkZCQj42MioeFgn98end1c3Fwb25ub3Bxc3V3enx/goWHioyOj5CRkZCQjo2LiIaDgH57eHZzcnBvbm5ub3BydHZ5fH6BhIeJjI6PkJGRkZCPjYuJhoOAfnt4dXNxcG9ubm5vcHJ0d3l8f4KFiIqMjpCRkZGRkI6NioiFgn98eXd0cnBvbm5ubnBxc3V4e36BhIeJjI6PkJGRkZCPjYuIhoOAfXp3dHJwb25ubm5vcXN1eHt+gYSHioyOkJGRkpGQj42LiIWCf3x5dnRycG5ubW5ucHF0dnl8f4KFiIuNj5CRkpKRkI6MiYaDgH16d3RycG9ubW1ub3FzdXh7f4KFiIuNj5CRkpKRkI6MiYeEgH16d3RycG5tbW1ub3Fzdnl8f4KGiYuOj5GSkpKRkI6LiYaCf3x5dnNxb25tbW1ucHJ0d3p+gYSHio2PkZKSkpGQjoyKh4OAfXl2dHFvbm1tbW5vcnR3en2BhIeKjY+RkpKSkpCOjImGg4B8eXZzcW9tbW1tbnBydXh7foKFiIuOkJGSk5KRkI6LiIWCfnt3dHJwbm1sbW1vcXN2eX2AhIeKjY+RkpOTkpCOjImGgn97eHVycG5tbGxtb3Fzdnl9gISHio2QkZKTk5KQjoyJhYJ+e3d0cW9tbGxsbW9xdHd6foGFiIyOkJKTk5OSkI2Lh4SAfXl2c3BubWxsbW5wcnV5fICEh4uNkJKTk5OSkI6LiIWBfXp2c3BubWxsbG5wcnV4fICEh4uOkJKTk5OSkI6LiISBfXl2cnBubGxsbG5wc3Z5fYGFiIyOkZKTlJOSkI2Kh4N/e3d0cW9tbGtsbW9xdHh7f4OHio6QkpOUk5KRjouIhIB8eHVyb21sa2tsbnF0d3t/g4eKjZCSk5SUk5GOi4iEgHx4dXFvbWxra2xucXR4e3+Dh4uOkZOUlJSSkI6Kh4N/e3dzcG5sa2tsbW9ydXl9gYWJjZCSk5SUk5GPjIiFgHx4dXFvbGtra2xucXR4fICEiIyPkpOUlJSSkI2JhYF9eXVxb2xra2tsbnF0eHyAhYmMj5KTlJSUko+MiYWAfHh0cW5sa2prbG9ydXl9goaKjZCTlJWUk5GOi4eDf3p2cm9ta2pqa21wc3d7gISIjI+SlJWVlJKPjIiEgHt3c3Bta2pqa21vcnZ6f4OIjI+SlJWVlJKQjYmFgHx3c3Bta2pqa21vc3Z7f4SIjI+SlJWVlJKPjIiEf3t2cm9sa2pqa21wdHh8gYWKjZGTlZWVk5GOioaCfXl0cW5rampqbG9ydnp/g4iMkJKUlZWUko+MiIN+enVxbmxqamprbnF1eX6Dh4yPkpSVlZSTkIyIg396dXFubGppamtucXV5foOIjJCTlZaWlJKPjIeDfnl1cW1ramlqbG5ydnuAhYmNkZOVlpWUkY6KhYF8d3NvbGppaWttcHR4fYKHjI+TlZaWlZOQjIeCfXl0cG1qaWlqbG9zd3yBhouPkpSWlpWTkIyIg355dHBta2lpamxvc3d8gYaLj5KVlpaVk5CMiIN+eXRwbGppaWpsb3N4fYKHjJCTlZaWlZOPi4aBfHdyb2tpaWlqbXF1en+EiY6RlJaWlpSRjYmEfnl0cG1qaWlqbG9zeH2Ch4yQk5aXlpWSj4qFgHt2cW1qaWhpa25yd3yBh4yQk5aXl5WTj4uGgHt2cW1qaWhpa25yd3yCh4yQlJaXl5WSj4qFgHp1cG1qaGhpa29zeH2DiI2RlJaXlpWRjYmDfnhzb2tpaGhqbXB1eoCFi4+TlpeXlpOQi4aAe3VxbWpoaGlrb3N4foOJjpKVl5eWlJGNh4J8d3JtamhoaGpucnd9goiNkZWXl5eVkY2Ign13cm5qaGhoam5yd32DiI2SlZeYl5WRjYiCfHZxbWpoZ2hrbnN4foSJjpOWl5iWlJCMhoB6dXBsaWdnaWxwdXqAhouQlJeYl5aTjomDfXhybmpoZ2hqbnJ3fYOJjpOWmJiXlJCLhoB6dG9raGdnaWxxdnyCiI2SlZeYl5WRjIeBe3Vwa2lnZ2lscHV7gYeNkpWXmJeVkY2HgXt1cGtoZ2dpbHB1e4KIjZKWmJiXlZGMhoB6dG9raGdnaW1xd32DiY+TlpiYl5SPioR+eHJtaWdnaGpuc3l/hoyRlZeYmJaSjYeBe3Vva2hnZ2lscXZ9g4mPlJeYmJeUj4qDfXZxbGlnZmhrb3V7gYiOk5aYmZeVkIuFfnhybWlnZmdqb3R6gYeNkpaYmZiVkYuFfnhybWlnZmdqb3R6gYiOk5aZmZiVkIqEfXdxbGhmZmhrb3V8gomPlJeZmZeUj4mCe3Vva2dmZmhscXd+hYuRlZiZmJaSjIZ/eXJtaWZmZ2pudHuCiI6Tl5mZl5SPiYJ7dW9qZ2ZmaGxyeH+GjJKWmZmYlZGLhH12cGtoZmZoa3B3foWLkZaYmpmWkoyFfndxbGhmZmdrcHZ9hIuRlpmamZaSjIV+d3FraGZmZ2twd36FjJGWmZqZlpGLhH12cGtnZWZobHF4f4aNk5eZmpiVkImCe3RuaWZlZmludHqCiY+VmJqal5ONhn94cWxoZWVna3B3foWMkpeZmpmVkIqCe3RuaWZlZmludHuDipCVmZqZl5KMhX12b2pmZWVobHJ5gYiPlZiampeTjYZ/d3BrZ2VlZ2xxeICIjpSYmpqYlI6Hf3hxa2dlZWdrcXiAiI+UmJqamJONhn93cGpmZWVnbHJ5gYmQlZmbmpeSjIV9dW9pZmRlaG10e4OLkZeam5mWkYqCenNsaGVkZmpwd36GjpSYm5uYlI6Hf3dwamZkZWhsc3qCipGWmpualpGKgnpzbGdlZGZqcHd/h4+VmZubmJOMhX11bmhlZGVpbnV9ho2UmJubmZSOhn52b2llZGVobXR8hIyTmJubmZWPh393b2llZGVobXR8hIyTmJubmZWOh392b2llZGVobXV9hY2UmZubmZSOhn11bmhlY2Vpb3Z+h4+VmZubmJOMhHtzbGdkZGZqcXmBiZGXmpyalpCJgHhwamVjZGdtdHyFjZSZm5uZlI2FfHRtZ2RjZWpweIGJkZebnJqWkIiAd29pZWNkaG51foaOlZqcm5iSi4N6cmtmY2NmbHN7hI2UmZycmZSNhHxzbGZjY2ZrcnqDjJOYnJyalY6FfHRsZ2NjZWpxeoOLk5icnJqVjoV8dGxmY2NlanJ6g4yTmZycmZSNhHtza2ZjY2Zrc3uFjZSanJyZk4uDeXFqZWNjZ211foePlpudm5eRiYB3bmhkYmRpb3iBipKYnJ2alY6FfHNrZmNjZmtzfIWOlZqdnJiSioF3b2hkYmRob3iBipKZnJ2alY2Fe3JqZWJjZmx0foeQl5udm5eQh351bGZjYmVqcnuFjpWbnZyYkomAdm5nY2JkaXB5g4yUmp2dmZOLgXhvaGNiZGhweYKMlJqdnZmTi4J4b2hjYmNocHmDjJSanZ2Zk4uBd25nY2JkaXB6hI2Vm52dmZKJgHZtZmJiZGpyfIaPlpydnJiQh31za2ViYmVsdH6IkZidnpuWjoR6cGljYWNnb3iCjJSanZ2Zk4qAdm1mYmFkanN8h5CYnJ6cl4+Fe3FpZGFiZ254goyVm56dmZKJf3VsZWJhZWt0foiSmZ2em5WNg3hvZ2JhY2lxe4WPl5yenJePhXtxaWNhYmdveYONlpyenZiRh31yamRhYmZud4KMlZuenZmSiH1zamRhYmZtd4GMlZuenZmSiH5zamRhYmZtd4KMlZuenZmRiH1yamNhYmZueIONlpyenZiQhntxaGNgYmhweoWPmJ2fnJeOhHlvZ2JgY2lyfYiSmZ6em5SLgHVsZWFhZWx2gYyVm5+emZGHfHFpY2BiZ3B6hZCYnZ+clo2Cd21lYWBka3WAi5Sbn56akod8cWhiYGJncHuGkZmen5yVjIF1bGRgYWVtd4KNlp2fnZiPhHluZmFgY2p0f4qUm5+empKHfHFoYmBiaHF8iJKan5+blIl+c2liYGFncHuGkZmen5yVi390amNgYWZveoWQmZ6fnJWLgHRqY2BhZm96hZCZnp+clYt/dGpjYGFmb3qGkZqfn5yUin5yaWJfYWdxfIiTm5+fm5OIfHFnYV9iaXN+ipWcoJ+ZkIV5bmVgYGNrdoKNl56gnpeNgnVrY19gZW56hpGan6CclIl9cWdhX2Joc36LlZ2gn5mQhHhtZGBgZG14hJCZn6CclYp+cmhhX2Focn6LlZ2gn5mPg3dsY19gZW55hpGan6Cbk4h7b2ZgX2NqdYKOmJ6gnZaLf3NoYV9haHJ+i5adoJ+YjoJ2amJfYGZvfIiUnKCfmpCFeGxjX19lbnqGkpugoJuShnltZF9fZG14hZGboKCbk4d6bmRfX2NseIWRm6CgnJOHem5kX19jbXiFkpugoJuShnltZF9fZG16h5OcoKCbkYV3bGNeX2VvfImUnaGfmY+CdWphXmBncX6Ll56hn5eMf3JnYF5haXWCj5mgoZ2UiHtuZF9eY2x5hpOcoaCakIR2amJeX2ZxfouXnqGfl4x+cWZfXmJqdoSRm6ChnJKFeGtiXl9lcH2Llp6hn5eMfnFmX15ia3eFkpuhoZuRhHZqYV5fZ3J/jZifoZ6ViXtuZF5eY217iJWeoqCZjYByZ19dYWp3hZKcoaGbkYN1aWFdYGhzgY+aoKGdk4Z4a2JdX2Zxf42YoKKelYh6bWNeXmVvfYuXn6Kflop7bmNeXmRufIqXn6Kfl4p8bmReXmNufIqXn6Kfl4p8bmNeXmRufIuXn6Kflol7bWNdXmRvfYyYoKKelYh5bGJdXmVxf46ZoaKdk4Z3amFdX2d0gpCboaKckYN0Z19dYGp3hpOdoqGZjX9wZV5dYm17ipegop+WiXpsYl1eZXGAj5qhop2ShHVoX1xgaXeGlJ6ioZmMfm9kXV1jb32MmaGjnpSGd2lgXF9odYSTnaKhmo1+b2RdXWNvfYyZoaOek4V2aF9cYGl3hpSeo6GYi3xtYlxdZXGAj5uiopyQgXJlXlxibXuLmKGjn5SGd2lfXF9pd4aVn6OhmIp7bGFcXmZzg5Gdo6KajX5vY11dZHCAj5uio5yQgXFlXVxibn2NmqKjnZKDc2ZeXGFtfIuZoaOek4R0Z15cYWx7ipiho5+UhXVnXlxga3qKmKGjn5SFdWdeXGFse4uZoaOek4R0Zl1cYW18jJmio56SgnJlXVxibn6Om6KjnJCAcGNcXGNwgJCdo6KbjX1tYVxdZXOEk5+koZiKeWpfW15od4iWoaSglYZ1Z11bYGx8jJqio52RgXBjXFxkcYGRnqSimYt7a2BbXmh3h5ehpKCVhXRmXVthbX6OnKOjnI5+bmFbXWZ0hZWgpKGWh3ZnXVtgbHyNm6OknI9+bmFbXWZ1hpWgpKCWhnVmXVthbn6PnKSjm418a2BbXmh3iZiipJ+TgnFjW1tjcoOTn6Wil4h2Z11bYG19jpyko5uNfGtfWl5peIqZo6SekYBvYVtcZXSGlqGloJSEcmRbW2NxgpOgpaKXh3VmXFthboCRnqWjmYl4aF1aYGx9j52ko5qLeWleWl9rfI6cpKSbjHtqXlpeanuNnKSknI17al5aXmp7jZykpJyNe2peWl5qe42cpKSbjHppXlpfa32OnaWkmot4aF1aYG1+kJ6lo5mJdmZcWmFvgZOgpaKXhnRkW1pjcoSVoaWhlIJwYlpbZXWImKOlnpB+bF9aXWl6jJykpJuMeWhdWV9tf5GfpaOYh3RkW1pjcoWWoqagkoBuYFlcZ3mLm6SlnIx5aFxZX22AkqCmopaFcmNaW2R1iJmkpZ6PfWteWV5rfZCfpqOYh3RkWlpjc4aYo6afkH1rXllea32Qn6ajmIZzY1paZHSImaSmno97aV1ZX22AkqCmopWDcGFZW2d4jJylpZuKd2VbWWJxhZejpp+RfWtdWV5sf5KgpqOWg3BgWVtneYydpqWaiXVkWlpjdIiZpKaejXpnW1lgcIOWo6agkX5rXVhebH+ToaeilIFuX1hcaXyQn6ajl4RwYFlbZ3mNnqakmYdzYllaZXeMnaalmoh0Y1laZHaKnKalm4l1ZFlZZHWKm6amm4p2ZFlZY3WKm6amm4p1ZFlZZHaKnKamm4l0Y1laZHeLnaalmohzYllaZniNnqelmYZxYFhbZ3uPn6ekl4NvX1hcan6SoaeilIBsXVhebYGVo6egkHxoW1hgcYWZpaeejHdlWVljdYqcpqaah3JhWFpne4+gp6SWgW1dWF1sgZWjp6CQe2daWGFyh5qmppyJdGJYWmZ5j6CnpJaCbV1XXWyBlqSooI95ZllYYnSKnaemmoZxX1dbaX6ToqiiknxoWlhgcoibpqabiHJgWFpofJKiqKKSfWhbV2ByiJumppuIcmBXW2l9k6OoopF7Z1pYYXSKnaemmYVvXldca4GWpKifjXdkWFlkeI6gqKSVf2pbV19xh5unp5uHcV9XW2p/laSooI54ZFhYZHmPoaiklH5pWldgc4mdp6aZhG5dV11tg5mmqJ2Kc2BXWml+lKSooI54Y1hYZXqQoqmjknxmWVdido2fqKWVf2laV2ByiZ2oppiDbFxWXnCHm6enmoVuXVZcboSap6ech3BeVlxsg5imqJ2IcV9WW2uCmKaonolyX1Zba4GXpqieinJfVlprgZemqJ6Jcl9WW2uCmKaonYhxXlZbbIOZp6ich29dVlxuhZuop5uFbVxWXXCHnKinmIJrWlZfc4qfqaaWf2hZVmF2jqGppJN7ZVhXZHqSo6mij3diVllof5amqZ+Kcl5WW2yEmqiom4RtW1ZecoqfqaaWfmdYVmJ4kKOqopB3YlZYaH+WpqmeiXBdVVxuh52pp5iBaVlWYXaPoqqjkHhiVlhnf5enqZ6Ib1xVXXCInqmmln5nWFZjeZKkqqGNdF9VWmyEm6iomYJqWVZhdo+jqqOPdmFWWWqCmqiom4RrWVVgdY6iqqOQd2FVWWqCmqiomoNqWVVgdo+jqqKOdV9VWmuEnKmomIBoWFZjepOlqqCLcV1VXHCJn6qmlHtjVldnf5ioqZyFa1lVYHaQo6qijXReVVpuh56qp5V8ZFZXZn+YqKmchGtZVWB3kaSqoYtxXVRccIqgqqWSeGFVWGqEnKmomH9mVlZlfZeoqpyEa1lVYXiSpauginBbVF1zjaKro450XlRabomgq6aTeGFVWGuFnaqnlnxjVVdogZqpqZl/ZlZWZX6YqKmbgmhXVWN8lqeqnYRqWFViepSnq56Ga1lUYHiTpqufh2xZVGB4kqarn4htWVRgd5Kmq6CIbVlUYHeSpqufh2xZVGB4k6fM29K2lHhrbnuJkIp3YE1GUWqIo7CsmoBrYmh7kqOonIVrWFRgeZOmp5d7XEdFV3idusW7oH5gUVNlfpWhn5B8aV9faHR+goF9e4GOoLC3sZ1/YEg/RlhvgouKgXl4gpatvsKzlnFPOjdGYX6UnZuQhX5/hY2Qi39xZmZyh52rq5l8XUZCUW+Rq7Omi2xWU2WEpr2/q4hiSEJSb4+kpZN2WktRaYysvbuni3JnbX+Smo9zTi4hMVuUy+3w06JuSDtKao2jo41sTkBLaZK1xb2he1pLUWqJoauijHNkZHKHmJyOdFhFRVuAp8PKuZhzWE9ac46ho5V8ZFVUYHOFj4+IgoKKmaeup5N3XExLWG6BioZ4aWNshafF08mpfVI3M0Vlhpuekn9xb3uPoaebgGFLSV2Dq8bIsIZaPDdNdJuysJVvTUBOcqDG1cikd1JBSmSDmZ2OdFxSW3OQpqyhi3Zsc4ihsa+YckovKj1giKi1sKCOg4OLlZeNeWNTUF10jJqajHlqaXeOpKyhhWJIQlV8qMnQvJJiPzRCY4acn494ZmV4l7XDuZpwTT9KaY+prZdyTTlAYI22zMish2dZYXiRn5qFZ09FTmWBlp6akIiKlKKqo4xqSTc7VX2it7WggWZbZHmPm5aCaltfdpe0wLORaEc9TG2RpqOLaExHXom52t3BkF07M0drjZ+ch21cXG6In6efjHhvdoqgq6SJZkY3QFt+m6ehj312fpGkrKGGZk1IWHeVpaCJa1dXbpKyv6+IWjcwSnuv09nAkmVHRFZxhoyAa1xdcY+SlJaXlI+GfHNsaWpucnZ3d3d5fYWOl52dmI2BdW9ucnqBhIF5bmRgZXGEmaqyr6GNd2VaWmFvfYmPkIyGgX17e3t7enh3eX2EjZSYl5KIfnRuampsbm9wcXV9iZelrq+nl4BqWE9RXG6AjpSSin92c3eAjJednJWIe3BpZ2pvdHh6e3x/hIqPk5SRioN7dnV2eHt8e3l4eHyCio+QjIJ1aWNkbn+Tpa+vo493YlNOVGBwf4mPkI+OjpGUl5aQhnlsY15gZm95gYeKi4yNjo+Oi4Z/eXV0d3yChYR+dWxmZm58jp2nqJ+PfGthX2d0go6TkoqAd3FwdHp/g4SCf31+g4qRlpeTin5yaGJgYmdudn6HkZukqaihk4BtXFNTW2t8i5SVj4V8dnZ9h5GYmJKGeW5naG53gIaHhH55dnd8hIySk5CJgnp2dHV4enx9fn+Bg4WFg354cW1udoKSoKmpoI95ZVZQVF9vfoqQkY+Mi42RlpiVjH5uYFdWXWp6iJOYmJOMhoF/fn5+fn19fn+Bg4J/eXNubG93g4+YnJmPgnVtam95hI6Sj4Z7cGppb3iCio2KhX97fIGKkpiZkoZ3aF1YWWFteoeRmZ+hoZ6XjH9xZFxaX2l3hY+TkYuDfHp8goqPkY2EeXBrbHN9h46OiX90bGltd4SQmZqWjYJ4cnBzeH2Bg4KAfXt6enp6eXp8gIePmJ2dl4x8a15YWWFte4eOkI+MiouPlJeVjoFxYldUWWd5jJqhn5eLf3Zyc3d9goaGhYOBgH99e3l2c3N1eoKJj5GPiYJ8eHl9hImKiIB3bmhobniDjZGQioJ8eXyDjZWZlot8a1xVVV5sfYyYn6GemZKLhH11bmhlZmtzfYaNkI6KhIB+f4KFh4aBe3ZzdHqCi5CQiX5xZ2Jkb36OmqCflop9c25vdXyChYR/enVyc3Z7gYWJi4yNj5CPjIZ9c2pjYmVtd4GIjY6NjIyOkZOSjIJ0ZltXW2d5i5qioZmLfHBqa3J8hYyOjIeCfnt7e3x7end1dHd7gYiMjo6LiISCgoGAfnlzbmprcHmDjJKSjoZ+enp/h5CVlI1/b2FYV15sfo+boaCakomCfXp5d3Rxb25xdn2Fi4+Pi4aBfXt7fH5+fn19f4KHi46MhXtwZmBia3mKmKGjnJCDdm9ucnmAg4N+eHFub3R9h46Tk5CMh4OBgIB+enZxbWxucnmBh4uOj4+Pj46MiIB2bGNfYmt5iZaenpaJe29oaXB7ho+TkYuEfXl5en1/fnt2cW9xd3+JkpeYlY+HgHp1c3Fwb29ydnyDio+QjomCfXt9gomOj4qBdGhfXWJufo2ZnpyWjIJ8eXl8fn58eHNwcXV8hYyQkIyFfnd0dHZ7gISHiYqLioiFf3duZ2NlbHiGlJ6inpWJfXRwcXV7f4B8d3Fub3V/ipSZmJOKgXp2dnl9gIB+eXRwcHN5gIeNkJGQjYqGgn13cW1qbHF6hY+VlpGHfHFra3B6hY6Tk46Gfnl4eX1/f3x3cGxrcHqGk52hn5eMf3RsaWlscXV5fYCEh4qMjIqGgn9+f4KFh4WBeXFqZ2pyfYiSl5aQiH96eHp/g4WEf3hyb3B1foiPkpCJgHZwbnF4gYmPkpGOiIN9d3JtamlrcHiDjpednZeOhHp0cXN2eXp5dnNxc3mCjJWamZOIfXRvcHV8g4iHg3x0b25yeYKLkJKRjYeCfXp4d3Z2dnh8gIWJi4mEfndycXR7g4uQkY6IgXx5eXt+fnx3cWxqbneEk56lpJyPf3FnY2Rqcnp/g4SFhYaHiImIhoOAfn19f39/fXl2c3N2fIKJjI2KhH97e32BhomIhHx1b21xeIKLkJCLgnhwbW93gYyUl5WPh312cG1tbnBydnuBiZCVmJeSi4J6dHFxcnR1dnZ3eX6FjZOXlY+Ge3JtbXN8hYuNioJ5cW1udH2GjpKRjIZ/e3l5e35/gH99fXx9f4CAf317enp9goeLjYyJhIB8enp7e3l2cm5tcHiDkZyjpJ2QgHFlYGJpc3yEiIiGg4KChIeJiYeDfnp4eHl8f4GAf318e3x+gYKDgoCAgIKFiIqJhX94cW5vdX2Fi46LhHt0cHF4goyVmJaPhXpxbGttcXZ6fX+BhIiNkZSTkImBeHJtbG1xdXl8gISJjZCRj4qDenNvb3R8hYyPjYd+dW5tcHiBiY6Pi4Z/e3p7f4SGh4R/eXVzdHh8gIOEg4KBgYKFh4mJh4SAfXp4d3Z0c3FydXuEjpien5qPgXNoY2Nqc32FiYmHg4B/gYSIiomFf3l1c3V6gIWJiYaBe3d1dnh8f4OFhoiIiYmIhIB6dXFwc3h/hYiIhX96dnZ7gouSlZONg3hwa2pudHp/goKBgYKFio+Sko6HfXRtaWltc3uBh4qMjIyKh4R/enZ0dHd9hIqNjYiBeXJub3R7g4mLioaBfn1/g4eKioZ/d3BtbXF5gIeLi4iFgX9/gYSHiIeEf3t3dHJyc3V4e4CFjJKWl5OMgnduaWhsdHyDiImHg4B+f4KGiIiGgHp1cnR5gYiNjouEfHRvbXB2fYSKjY2MioiFgn98eHVzc3Z5foKEhIOAfn1/g4iNj46JgXhxbW1xd32ChISCf36AhIqPkpGLgnhuaGdrc3yEi46Oi4eDgH18enp6enx/g4eJioiDfXdzcXN3fIKGh4aEgoKDhomLioV+dm5paW52gImPkI6Ign17fH+Eh4iHgnx2cnBxdHh9gYSHioyNjYyIg3x2cW9xdXqAhIaFg4F/f4GDhoaFgXt3dHV6gYmOkI2GfHNraGtye4WNkZKPi4aCf358e3l3dXR1eHyAg4WGhoWEhYaHh4aDf3p1cnJ1eX6ChISBf319gYaLj5CNhXxya2lrcnyFjI+OioR+enh5e32AgYKCgoOEhYWDgHx4dHN0d3uAhIaIiIiIiYqJh4J8dG5paW11f4mQk5GLhH15eXyAhYiHhH54c3BxdXuAhYiIiIaFhISEg4F+e3h2dnh7f4GDg4KBgIGCg4OCgH16eHl8goiNj4yGfXNraGlweoSNk5SRjIaBfnx8fHt6d3VzdHd7gYeLjIyJhoOBf35+fXt6eXh6fH+BgoKBfn19f4OHjI6Mh393cW1uc3uEio2MiIF7d3Z4fICEhoaFgoGAgIGCgoB9eHVzc3Z6gIWKjY6NjImGg355c29sbHB2f4iOkpGMhn96eHl9goWGhIB6dXJzd3yCh4mIhYJ/fX6Ag4WFg4B8eXd3eXx/goODgoGAgICAf39+fX6Ag4aJioiDfHRuamtweYOMkpSSjYaBfXt7fHx7eXZzcnR5f4eNkJCNiIJ8eXh4enx+f39/f39/f39/fn19foGEh4qKh4N9d3RzdnuBhomIhYB6d3Z4fYOHiomHg399fH6AgoKAfHdzcXJ2fYSLkJKRjomEfnp2c3FwcXR5f4WLjo6Mh4J9enl7foKEg4F9eXZ3eX6DhoiHg397eXp+goeKioeCfHd0dHd7gIOFhIOAfn19foCBgoODhIWFhYOAe3Zyb3BzeYGJjpGQjYeCfnx7fHx8end0cnR4foaNkpKPiYF6dXN0eH2ChIWEgX99fHx8fX5/f4CChIWGhoSCfnt5eXp9gIKDgX57eXl7f4SIi4qHg357ent+gYOCf3p1cnF0eoKKkZSTj4mBe3ZzcnN0dnl8f4OGiYqKiISAfXt6fH6AgYF/fXx7fH+ChIWDgHx5d3l9goiNjouGf3hzcnN4fYKFhoSBfnx8foCDhoeHhYOBf318enh3dnZ3e4CFiYyNjIiEgH58fHt7enh1dHV4foWMkJGPiYF5c3FzeH6EiImHg397eXl6fH6AgYGBgYKDhIWFhIJ/fHp6ent8fX18fH1/goWIiomHg357eXp8f4KCgH14dHN0eYGJj5OTj4iAeXRyc3V4e31/gIGChIaHh4aDgH17enp8foCBgYGAgICAgIB/fXp5eHp+g4mNj42IgXp0cXF1eoCEhYWCf318foGFiImIhoJ9enh4eXp7fHx8fX6BhIeJiYmGg4B+fHp6eXh3d3h7f4SJjY6Mh4F6dXJ0eH6EiYuJhYB7eHd4e36AgYGAf3+Bg4aIiIeEgHt3dXV2eXt+gIKDhIaHh4eFgn98enp7foCBgH57eHZ2en+GjJCQjYeAeXVzdHd7foCBgH9/f4GDhoeGhIB8enl5fH+ChIWFg4F/fXx6enl5enyAhImMjo2Jg3x2cnFzd32BhISDgX9+f4KFiImIhYB7d3V2eHt/gYGBf35+f4GEh4iIhoOAfHp5eHh5ent9gIOGiImIhYF8eHZ2eX6EiIqJhYB8eHZ3en2AgYGAf3+AgoWJi4qHgnx2cnFydXp/g4aHh4aFhIOCgX9+fHt8fH5/f399e3p6fH+DiIuMioaAe3d2d3p9gIKCgH58fH6AhIaHhoN/e3h4en2ChoiIhYJ+enh3d3h7fYCDhoiKi4qIg355dXNzdnp+gYODgoGBgYOFh4iHhH96dnR1eH2BhIWEgX58e32Ag4eIiIaCfnp4d3h6fH6AgYKDhISDgoB+fHt7fH+ChYeHhYF9eXd3eXx+gIGAf3+AgoWJi4uJg312cW5vc3mAhYmKiYeEgoCAf39/fn18fHx9fn5/f35+fn+Bg4WGhoSBfnt6enx+gYKBf317ent+goWHh4WBfXl4eX2BhoiJh4J9eHV0dXh8gIOFh4iIiIeFg4B8eXZ1dXd6foGDhISEhISFhYWEgX56d3Z2eX6ChYeGgn57eXl8gIWIiYiEgHx5eHl7foCCgoGAf39/gICAgIB/f4CBgoOEg4F+fHp5eXt9foCAgICBg4WIioqIg313cm9vc3mAhoqMioeEgH59fn+AgH9+fHt7fH6AgYKBgYB/f4CBgoKCgYB/f39/gIB/fnx7ent9gIOGh4aDf3x6en2AhIeIhoJ9eHRzdXh9goWHiIeGhYSDgoF/fHl3dnZ4e36ChYaHh4aFg4KAf3x6eXh5e3+ChYaFg397eXh6foKGiIiGgn57eXp8foGCgoB+fHt8fYCChISEgoGAf3+AgICAfnx7enp7fX6AgYKDhIaHiIiGgn14dHFxdHl/hYmLioeDgH18fX6AgYB/fXt7e32AgoSEg4B+fHt8foCChISEg4GAf359fHt7e3t9f4KEhYWEgX99fH2AgoWGhIF9eXV0dnl+goaIiIeEgoGBgYGAf316d3Z2eHyAhIiJiYeEgn99fHt7e3t8foCChIWEgn98eXl6fICEh4iHhIF9fHt8foCBgX99enl6fICDhoiHhYJ/fXx9fn+AgH99fHp6e31/gYOFhoaGhoWDgX16d3V0dnp+g4eJiYeDgH18fX6AgYGAfnx7e32Ag4SFg4F9enl5e3+ChoiIhoOAfnx6enp7fHx9f4CChISEg4KAf39/gIGCgoB9enh3eHt+goaHh4WDgX9/gIGBgX98eXd2d3p/hIeKioiEgX17enp7fX6AgYGCgoKCgH99e3p6fH6BhIaGhYOBf319fn9/f317enl6fICEiImJh4N/fHp6e36AgYGAfnt6ent+gYSGh4aFhIKAfn17enl5eXt+gYSGhoWDgX99fX5/gICAf318fH6AgoSEg4B9end3en6Ch4qKiYWBfXp4eHl7fH5+f4CBgoOEhISDgoB/fn5+fn59fHt6e31/goSFhYSCgH9/f4GCgoF+e3l3d3p9goaJiYiEgHx6eXp8f4GCg4KBgH9/f35+fXx8fH1/goSFhoWEgoB+fX19fHt6enp7fYGEiImJh4R/e3l5en1/gYKBf317ent9gISGh4aEgoB+fX19fX19fX19foCCg4ODgoF/f35/f4CAf39+fn+AgYKDgoB9enh4en2Ch4qLioaCfXp4d3l7fX5/f3+AgIKDhYWFhIJ/fXx7e3x9fn5+f3+AgYKCg4KBgH9/gICBgoF/fXt5eHp9gISHiIaEgH16ent9gIOEhIOBf319fX1+fn5+fX1+f4GEhYaGhIKAfXt6eXl6ent9f4KFh4iIhoOAfHp5eXx+gYKCgX58e3t9gIOFhoWDgX59fH1+f4CAf359fX1+gIGCg4OCgH9+fn5/f4CAgICAgIGBgH59e3p6e36ChomKiYaCfnp4d3h6fX+AgIB/gIGDhYaGhYOAfXp5eXp9f4GCgoGAgH+AgICAgICAgIGBgYGAfn17ent8f4GEhYWDgH58e3x+gYOEhIOAfnx7fH1+f4CAf359foCChIaHhoSBfnp4d3h5e31/gYOFhoaGhYOAfXt6ent9gIGCgYB+fX19f4GDhISCgH59fH1/gYKCgX99e3p7fX+Cg4SEgoB/fn5+f4CBgYGAgH9+fn18fHx8fX+ChIeIiIaCf3t5eHl6fH5/gICAgIGChIaGhYOAfHl4eHp8gIKEhIOBf359fX5/gIGCgYGBgYCAf359fXx8fX+AgoKCgX9+fn6AgYOEg4KAfXx7e3x+gIGBgH5+fX+Bg4aHh4WCfnp4dnd5e36Bg4SEhYSEg4KAfn18e3x9foCBgYGAf35+f4CBgoKBgH5+fn+AgoODgoB9e3l5e32Ag4WFhIKAfn1+f4CBgoKBf318fHx8fX5/gIGCg4SFhYSCgH17enp6fH1/f4CAgIGChIWFhYOAfXp4eHp9gIOFhYSCf317e31+gIKDgoKBgICAgH9/fn59fX19f4CBgYGBgYGBgYKCgoF/fXx7e3x+gIGBgH9+fn6AgoWGh4WCf3t4d3d5fH+ChISEg4KBgYGAgH9+fXx8fX6AgYGBgYB/f39/f39/f39/f4CBg4ODgoB9e3l4eXx/goWFhYOBf35+f4CBgoKAf317e3t8foCBgoKCgoKCgoKCgX9+fHt7e3x9f4CAgYKCg4SEg4KAfXt5eXp9gIOFhYSCf3x7enx+gIKDg4KBgH9/gICAgH99fHt7fH1/gYODhIOCgoGAgH9+fX18fH1+f4CBgYB/f3+AgYOFhYSCf3x5eHh6fH+ChISEgoGAf4CAgICAf359fH1+gIGCgoKAf359fX1+f4CBgYKDg4OCgX99e3l5eXt+gYSFhYSCgH9+fn+BgYGAfnx7ent9f4GDg4OCgYCAgICBgYGAfn18e3t8fn+BgoKDg4OCgoF/fn18e3x+gIKEhIOBf3x7ent9gIKDg4OCgYB/gICBgH9+fHt6enx+gYSFhoWEgoB+fn19fX19fn5+f4CAgICAgICAgYKDg4OCgH17enp7fX+Cg4ODgYB/f3+AgYGBgH99fHx9f4GCg4OBf318e3x9f4GCg4SEg4KBgH59e3p6enx+gIKEhYSDgoB/f3+AgIB/fnx7e3x9gIKDhIOCgH9+fn+AgYKCgX99fHt7fX6AgoODgoKBgIB/f35+fn5/gIGCgoKBf318e3x9f4GCg4OCgYCAgICBgIB+fHp5ent+gYSGh4aEgn99fHx8fX5/f39/f39/gICBgYGAgICBgYGBgH9+fXx8fX+AgYKBgH9/f3+AgYKCgYB+fXx9foCCg4OCgH18e3t8f4GDhYWEg4GAfn19fHx7fHx9f4GChISEg4KAf39/f35+fX18fH1+gIKDhIOCgH59fX5/gYKDgoB+fHt7fH6AgYKDgoGAf39/f3+AgICAgICAgICAf359fX1+f4CBgoOCgoGBgICAgH9+fHt6ent+gYSGh4eFgn99e3t8fX+AgIB/f39/f4CBgYGBgIB/f3+AgICAf39+fn5/f4CAf39/f4CAgYKCgoB/fn19fn+BgoKBgH58e3t8f4GDhYWEg4F/fX18fH19fX1+fn+BgoOEhIOCgH9+fX19fX1+fn9/gYKCg4KBf359fX5/gYKDg4KAfnx7fH1/gYKCgoF/f35/gIGBgoGBf39+fn5+f39/f35+f3+AgYKCgoKBgYCAf359fHt7e3x+gIOFhoaEgn99e3t8fX+AgYCAf35+f4CBgYKBgH9+fn5/gIGBgYGAf359fX5+f3+AgICBgYKCgoGAf359fn5/gIGBgH59fHx9f4GDhYWEgoB+fXx8fX5+fn5+fn5/gYKEhISDgX99fHx8fX5/f4CBgYGBgYGAf359fX5/gYKDg4KBf318fH1+f4GBgYB/f39/gIGCg4KBf359fH19f4CAgIB/f39/gIGCgoKCgYB/fn19fHx8fH1/gIKEhYWEgoB+fHx8fX+AgYGAf39+f3+AgYGBgH9+fX1+gIGCg4KBf358fHx9fn+AgYGBgYGBgYGAf39+fn5+f3+Af39+fn5+f4GChISDgoB+fX19fX5/f39+fn5/gIGDhISDgoB+fHt7fH5/gYGCgYGAgH9/f35+fn9/gIGCgoKBgH59fX19fn+AgICAf3+AgYKDg4KBf318e3x9foCBgYGAf39+f4CBgoOCgoB/fn18fH19fn9/gIGCg4OCgoB/fn19fX5/gICAgH9/f3+AgYGBgH9+fX1+gIKDhIOCgH58e3t8fX+AgoKCgoGBgYCAgH9/fn5+fn5+f39/f39/gIGBgoKCgYB/fn19fn9/f39/fn5+f4CCg4SDgoB+fHt7fH6AgYKCgYB/fn5+fn9/f4CAgIGBgYKBgYB+fn19fX5+f4CAgICBgoKDg4KBf318e3t8foCBgoKBgH9+fn+AgoKCgoF/fn18fX1+f4CAgICBgYGBgYGAf39+fn5/f4CAgIB/f3+AgICAgH9+fn5/gIKDhIOCgH58e3p7fX+BgoOCgoGBgICAgICAf359fX1+fn+AgYGBgYCAgIGBgIB/f35+fn9/f39/fn5+f4CBgoODgoF/fXx8fX6AgYKCgYB/fn19fn+AgIGAgICAgYGBgYCAfn19fHx9fn+AgYKCgoKCgoGAf318fHx9foCBgoKBgH9+fn+AgYKCgoF/fn19fX5/gICBgIB/f3+AgIGBgYB/f35+fn9/gICAgH9/f39/f39/f3+AgIGCg4OCgH58e3t7fX6AgoODgoGBgICAgICAf359fHx9fn+BgoKCgYCAf39/f4CAgIB/f39/f39/f35+f3+AgYKCgoGAfn19fn+AgYKBgYB+fX19fn+AgYGBgICAgICBgYGAf359fHx8fX+AgoKDg4KCgYB/fn19fX19fn+AgYKBgYB/f39/gIGBgYGAf359fn5/gIGBgH9+fn5/gIGCgoGBf35+fn5/gICAgIB/f35+f39/gICAgYGCgoKBgH59fHt8fX6AgYKCgoGBgICAgICAf359fHx9fn+BgoOCgoB/fn5+f3+AgYGAgH9/f39/f39/f3+AgIGBgYGAgH9/f39/gICAgH9+fn1+fn+AgYGBgYB/f4CAgYGBgH99fHx8fX6AgoODg4KBgH9+fn5+fn5+fn+AgYGBgYCAf39/f4CAgICAf39/f3+AgICAgH9+fX5+gIGCgoKBgH9+fX5+f4CAgIB/f35+fn+AgIGBgYGBgYCAf39+fX19fX5/gIGCgoKBgYCAgICAf35+fX19fn+BgoOCgoB/fn19fn+AgYKBgYB/fn5+f39/f39/f4CAgIGBgYCAgH9/f39/f39+fn5+f4CAgYGBgYB/f3+AgIGBgH9+fXx8fX6AgoODg4KBgH9+fn5+fn9/f39/gICBgYGAgA==",
  sfx_test_pass:
    "data:audio/wav;base64,UklGRrQzAABXQVZFZm10IBAAAAABAAEA4C4AAOAuAAABAAgAZGF0YZAzAACAk6Wyubu3r6WakYmEgX98d3FoXVNKRUVLV2d6jqCut7q4saedk4uGgn99eXJqYFZNR0ZKVGN1iJuqtLm4sqqflo2Hg4B9enRtY1lQSUZJUV9wg5amsbe4tKyimJCJhIF+e3ZvZlxSS0dJT1trfpGhrrW4ta6lm5KLhYJ/e3dxaF9VTUlITlhneYucqrO3ta+nnZSNh4N/fHhya2FYUEpJTVZjdIaYprC2tbGpoJePiISAfXl0bWRbUkxJTFNgcIGToq20tbKropmRioWBfnp1b2ZdVU5KS1Fca3yOnqqytbOtpZyTjIaCf3t3cWlgV1BMS1BaZ3iJmaewtLOup56VjoiDgHx4cmtiWlJNTE9XZHOElaOtsrOvqaCYkImFgX15dG1lXFRPTE5VYW+AkJ+qsbKwqqKakouGgn56dW9nX1dQTU5UXmt7jJunr7KwrKSclI2Hg397d3FpYVlSTk5SW2h3h5ajrLGxraaelo+JhIB8eHJrY1tUUE5RWWRzg5Kgqq+wrqigmJGKhYF9eXRtZl5WUU9RV2Fvfo6cp62wrqmimpOMh4J+enVvaGBZU1BRVl9reoqYo6uvrqqknJWOiIN/e3dxamJbVVFRVFxodoWUoKmurqumnpeQioWAfHhybGRdVlJRVFplcoGQnaasrqynoJmSi4aCfnl0bmdfWFNRU1lib32MmaSqrayoopuTjYeDf3p1b2lhWlVSU1dgbHmIlaGorKypo52Vj4mEgHt3cWpjXFdTU1ZeaHaEkp2mq6yqpZ6XkIqFgX14c2xlXlhUU1ZcZnKAjpqkqayqpqCZkoyHgn55dG5nYFpWVFVaY298ipehqKuqp6KblI6Ig397dnBpYlxXVFVZYWx5hpOepqqqqKOdlo+KhYB8d3FrZF5ZVVVYX2l1go+bo6iqqKSemJGLhoF9eHNtZmBaVlVYXWZyf4yYoaepqaWgmZONh4N+enRvaGJcWFZXXGRve4iUnqWpqaahm5SOiYR/e3ZwamReWVdXW2JseIWRm6OnqKainJaQioWBfHdybGVfWldXWmBpdYGNmKGmqKejnpiSjIeCfXhzbWdhXFhXWV9ncn6KlZ6kp6ekn5mTjYiDfnp1b2ljXlpYWV1lb3uHkpyjpqeloJuVj4mEgHt2cWtlX1tYWVxjbHeDj5mhpaeloZyWkIuGgXx3cmxmYVxZWVxhanSAjJaepKalop6YkoyHgn55dG5oYl5aWVtgaHJ9iJOcoqWlo5+ZlI6IhH96dXBqZF9bWltfZm96hZCZoKSlpKCblY+KhYB7dnFrZmFcWlteZGx3go2XnqOlpKGcl5GLhoF9eHNtZ2JeW1tdYmp0f4qUnKKkpKGdmJKNiIN+eXRvaWRfXFtdYWhyfIeRmqCjpKKemZSOiYR/enVwa2VgXVtcYGZveYSOl56io6KfmpWQioWBfHdybGdiXlxcX2Vtd4GMlZyho6KgnJeRjIeCfXhzbmhjX11cX2NrdH6JkpqfoqKgnZiTjYiDfnp1b2plYF5dXmJpcXuGkJieoaKhnpmUj4mEgHt2cWtmYl5dXmFnb3mDjZWcoKKhnpqVkIuGgXx3cm1oY2BeXmBmbXaAipOan6Ghn5uWkYyHgn15dG5pZGFeXmBka3R9h5CYnaChn5yYk42IhH96dXBrZmJfXl9jaXF7hY6WnKChoJ2ZlI+KhYB7dnFsZ2NgX19iaG94gouUmp6goJ6alZCLhoF9eHNuaWRhX19iZm12f4mRmJ2goJ6blpGOorG3tKmYhnVpYl9dWlZSTk5UYneQqsDO0sy+rZuMgHdvZVlKOi0nKztVdZe0ytTUy76vopiPh3xuXkw9MzM7TWN7kaCpq6iloaCfnpmRg3NiVE5QW2x/kJuemY+DeXRzd3yAgHx0bGdnbnyOoK+3tq6fjn5wZ2FdWFNNSUhNWm6HornK0c7DtKOUh311a19RQTQrLDZLZ4eku8nNyb+zqJ6VjIJ1ZlVGPDpATWF2iZegoqGdm5qam5mSiHpqXVZWXm1/j5ufnJOGe3NvcHR3eHZxbGhpcH2On663uLKlloZ4bWVfWVJLRUNHUmV9mLDDzs/HuqqbjoR7cWZYSTsxLjVFXXmVrL3ExL61q6KakYh8bV5PRUFFUGByhJGZm5qXlJOUlpWSin9xZV1cYm9/jpqgnpaLf3VubG1vcXBtaWdpcHyNnq23urWrnY6AdGtjW1NLREBCS1tyjKa7yM3Jv7GjlYqBd2xfUUM4MzZCVW6In7C6vbq0rKWdlo2CdGZYTUhKU2BxgY2UlpWRjo2Oj5CPioF2bGRiZ3F/jpqhoZqQg3hwa2pqamlnZWRnbnqKnKu2u7iwo5WHe3FoX1dNRT8/RVNogZqxwcnJwrapnJGHfXNmWUs/OTlBUWZ9kqSvtLSwq6WfmZGHe21gVU9PVmJwf4qRk5KOioeHiYqKh4F5cGpna3OAjpqho56ViX1zbGhmZWNhYGBja3eHmKm1u7u0qZyOgnduZFtRR0A9QUxedY6lt8PGwrmuopeNg3ltYFNHPz5DT2B0iJmlq62rqKOfmpSLgXRnXVZVWmRxfomQkpCMh4OCgoSEg4B6c21rbnaBjpqipaKZjoJ3b2llYl9dW1teZnKClKWyury3rqKViX50amBWS0M+P0dWa4KZrbrBwLuxp5ySiX9zZ1pPRkNGT11vgJCboqWlo6CdmpWOhXpuZF1bXmdyfomQkpCLhYB+fX1+fnx4c29ucXiCj5qjpqWelIh9c2tmYV1ZV1ZZYGx8jp+uuLy6sqibj4R6cGZbUUdBQEVQYneOorG6vLqzqqGXjoR5bmJWTUlKUVxre4mUm56fnZyal5SPiH50amNgY2l0f4mQkpGMhoB7eXh4eHd1cm9vcnmDj5qjqKeimY6DeG9oYlxYVFNUW2V1hpmptbu7tayhloqAdmxhVkxFQkRNXG6DlqextrayrKSbk4l/dGhdVE9PU11pd4SOlZiZmJeVlJKOiYF4cGlmZ211gImQk5KOh4B6dnR0c3Jxb25ucnmDjpqjqamlnpOIfnRsZF5YU1BRVl9tf5GisLi6t7Cmm5CGfHJnXFJKRUVLV2d6jJyor7Kwq6Welo6Eem9kW1VUV15pdYCKkJOUk5GQj46MiIJ7dG5ra3B3gYqRlZSQioJ7dnJwb25sa2tscHeBjZmiqauoopmOg3lwaGBZU09OUlpmdomaqbO4uLKqoJaMgndtYlhPSUhLVGJyg5OfqKysqaSfmJGJf3VrYltZW2FqdH6HjY+Qj42Mi4qIhoJ8d3Jvb3N6gouSlpaTjYV9d3JubGpoZ2dpbXV/i5ehqayrpp6UiX91bGRcVVBNT1Vgb4CSoa20trOtpJuRh31zaF5VTktNVF9tfIuXoKWmpaKemZOMg3pwaGFeX2RrdH6Fi42NjImHhoWEg4B8eHRxcnV7hIyTmJiWkImAeXNuamdlZGNlanF7h5SfqKytqaKZj4R7cWhgWFJOTlJbaHiJmaavs7Kup5+WjIN5bmRbVFBQVV1ul7jLzsa5rKOclId0XUg7O0lif5ioramgmJGMhnxuXE1GSlpzjaGsrKWblZSVlpGFcVtLRk5heY6ampCDeXV5gYiKhn11dHuLnq61sJ+Jcl9TTUpIRUVKWHGRss/f4dXBqZSDdGVUQCwfHi1KcZi4ys3FuKqfl4+DcVxIOjpHYH6arbSyqJ2Ti4N5a1tMREZTaYKZqa+tp6GenZqThXFbSkNIWW+DkJSPhn59gYqRko2DeHN2gpOiq6ibh3JgVVBPUFFSVmF0jarE1NjPvaeSgHFjVEMzKSk3UXSXtcbKwrWnnJOKfm5bSDw7SWGAnLG6uK2gk4l/dWlaTEJCTWF7lKeytLGspqKck4RwW0pBRFFleYiPjoqGhoqSmJiShnpxcXqJmKGhl4VyYlhVVllcXWBndYmiucnPybmlkH5vYlVIPDQ1QFd1lbDAxb6ypJiPhnpsWko/P0xkgp+0vbuwoZOGfHJmWEtBQEhcdZCntry6tK2lnZKCb1tJP0BKXHCBi4+Pjo+TmZ2clYh6cG1zf42XmZKEdGZeXF9jZmdobHWFma6+xcK1o499bmJYTkU/QElcdpKqub66r6KVi4J3altNREVSaIWgtL67saGShHlvZFdKQD5GWXOPqLnBwbuxp5yQgG5aST48RVVpe4mRlZaYnKChnpaIeW5pbXeEjpKOg3ZrZWRobG9vbm50gJGjs7u6sKCNfG9kXFVPSktSYHWNorG3tKufkoh+dGlcUUtMWG2HoLO8urCgkIJ3bGFVSUA+Rlhyj6m8xsa/tKibjX5sWUg8OUBPY3eIlJufoaOkpJ+Vh3hrZWdve4aLioN6cm1tcHR2dXJwcnqJmamys6udjX1xaGJeWVVUWGN0h5upsK+nnJCFe3NpX1dSVV9yiZ+xubetno+AdGlfVElBQEhZc5CrvsjJwbWnmYt7alhHOzc9S191iZihpqiop6Sek4V2aWJiaHN+hYeEf3l2dnh7e3h0cHB1gZCfqaumm41/dW5qZmJeXF1kcYKToaipo5mNg3pya2ReW11mdomdrbSzqpyNfnJnXVNJQ0NLXHWRrL/JycK1ppeIeWhXRzs3O0ledYqbp6ytrKmknJGDdGdfXWJsd4GGh4SBf36AgH97dW9tcXqIlaCkopmOg3p1cW5rZmJhZW58i5ihop6Vi4J6c25pZWNlbHmJmqevrqaZi3xwZVxTS0dHUGF4k6u+yMjAtKSVhnZmVkY7NztJXnWMn6uxsa6qo5qPgXJlXFpeZ3N+hoqKiYeGhoSBfHVua2x0gI2Ynp6YkIeAfHl2cm1nY2RqdoOQmZyak4qBe3Zyb21rbHF7iJaiqKiilol7bmRbVE5LTVZle5SrvMXGvrGik4N0ZVVHPDg9Sl93jqGutLOvqaGXjH9wY1pXWmNvfIaNkJCOjIqHgnx0bGhobniFkJiamJOMh4OAfXhxamVjZ3B8iJKWlZCJgn16eHZ0c3N1fIaRm6KinZOGeW1kXFZSUVRcan6UqbnBwruvoJCBcmNVSD47QE1ieZCjr7W0r6iflYl8bmJZVVhgbXuIkZWWlJGNiYJ7cmtlZGlyfoqTmJmWko6Lh4N9dWxlYmNqdYGKkJGOiYSAf359e3l4eHyDjJWbnJiQhHhtZF5ZV1daYm+Ak6a0vL23rJ2Of3BiVUpCP0VRZXuRpK+0s66mnJKGem1gV1RXX218ipSam5mVj4mCenFpY2FkbXiFkJebm5iVkY2HgHdtZWBgZW96hIuOjYqHhYSNr7yznId+fnxyY1tjfJmrqJN5Z15ZUUQ9SGug0u/v2Lqgi3VZNx0YLFF3kJqbnqarppN6aW2Cnauki29cWFtcWFZge6HBz8WtkX1uXUgyKDZdkLvQzLupnZODa1BARFt6kZiSiYWGhHllVVVrj6++taCKfnp3bWBYYHaTpqeWf25lYFhMREtpmMfl59S4n4p0WTsjHjBTeJGcnqClqaSSe2prfZaloItxX1pcXlxbZX2gvszErZJ8bFxHMik1WYq1zc7BsKOYh29UQ0RYdIqRjYWCg4N6alxccJGvvreijH53cmlcVVxyjqKmmYZ1bGZeUklOZ5G92t/Qtp6JdFs/KSQ1VnmTnqCgo6ahkXpqaXmQn52LdGNeX2FgYGl/nrvIwqySfGtaRzMqNFaFsMvQxbaom4pyV0VEVW6Di4mCf4GCfG9kZHWTr723pI19dG1kWVNZboqfpp2MfXNtZFdNT2SKss/Xy7SciHRdRDArO1l7k5+goKGinY55aWh1ipqbjXhoYmNlZGRsf5u2xL6rkXtqWUc1LDZVga3J0cm7rJ6Mc1lHRFJofYaFgH6Agn91a2t6lK67tqSNfHFpYFZRV2uGnaehk4R6cmlcUFBhg6nFz8aynIh1YEo3M0FcfJSfoJ6enpmLeGlmcoaWmY59bmdnaGdnbX6Ysb67qZF7aVlHNy84VX+qx9HMvq+gjXVbSERPZHeBgn59gIOBenJxfZSsubWjjXpuZl1TT1ZphJyopZmLgHdsX1NQXnyfu8fBr5uJd2RQPztHYH2Tnp+cm5mUiHdoZXCDk5iRgnRta2tqaW59lKy5t6eQe2lZSToyO1Z+p8XRzcCxoI11XElDTWByfYB+fYGFhH93doCUqbWyoox5bGNaUU5VaIOcqqmfkYV7b2FUUFt1lrK/vK2binppVkdCTGN9kpydmpeVkIV1aGVugJGYk4d6cm9ubGpue5Cms7OlkHtpWks9Nz9XfaXC0M3BsaCNdV1KQ0tcbnp+fn6Ch4eDfHqDlKayr6CLeGpgV1BNVWiDnKutpJaJfnFiVVBYb46pt7esnI1+bl1PSlJlfZGampaTkIuBdGhlbn+QmZeMgHdzcG1qbXiLoK6voo97alxOQjxDWn2jwM3MwbGgjHVeS0RKWmx4fn+AhImKhoB+hJKjrqyeindpXlZPTlZpg52tsKibjYByY1VPVWqGobGzqp2PgnNjVlBXZ32Ol5eTj4yHfnJoZW5/kJqakYV8dnJtamt1hpqoqqCPfGxeUkdBSFx9oLzKyr+wn4t1XkxESVhqd36BgoaLjImDgISRoKmonIl3aF1VUE9XaoSdrrKrno+Bc2NVTlNlgJqqr6mekoZ5al1WWml8jJSUkIuIg3txaGZvf5GcnZWKgHlzbWlpcoKUo6aej35uYVZMR0xffJ24xse9rp2KdF5NRUlXaXd/g4WIjI6LhYGEj5ylpJmIdmhdVlFRWWuFna+0raCRgnNjVU1RYXqTpaypoJaLfnBjW15qeoiQkIyHhIB5cGlocYGSnqCZjoN6c21nZ259j52inY+AcWVaUUxRYXyatMLDu6yciXRfTkZKWGl3gYWHio6Oi4aChIyYoaGXh3ZoXldSU1xthZ2vtK6ikoNzY1VNT151jqGqqaKZj4N1aGBganiFjI2JhIB8d3BqanOClKCinZKGfHNsZmRreIqYn5uQgnVpX1dSVWN7l6+9v7eqmoh0YFBITFlpeIKHioyOj4uGgYKKlJydlYd3aV9YVVZeb4adrrSvopODc2NVTE5bcYmdqKmlnZOHeWxjYmp2gomJhoF9enZwbG11hZWhpZ+UiH1zamRiZ3SFlJyakYV5bmRcV1llepOquLq0p5iGdGFSS05aa3qEiYyNj46LhYCBh5GZmpOGeGthW1hZYXGGnK2zrqKTg3JjVUxNWW6Gmqeqp6CWi31wZmRpdH6FhoN+e3h1cW5weIeXo6ahlol9cmliX2RwgZCZmpOIfXNpYVtcZnmQpbK1sKSWhnRjVU5RXW18houNjo6NiYR/f4SNlZeSh3ltZF5bXGNyhpursa2ikoJyYlVMTVhshJimq6mimY6Ac2hkaHF7gYOAfHl3dXJxc3uJmKOnopeKfXFnYF1hbX2NmJqVjIJ4bmVfX2d3jJ+ssKyilIV1ZVhSVF9vfYeMjo6OjIiCfX2CipKVkYd7cGdhXl9mc4WZqK+roZKCcmJVTU1Ya4KXpauqpZyQgnVqZWdveH6Afnt4d3V0c3Z+i5mkp6KXinxwZl5bX2p6i5aal5CGfHJqY2FndYiap6uon5OFdmdbVlhicX+JjY6OjIqFgHx7f4ePk5GJfnNrZWJiZ3OElqWsqZ+RgXFjVk5OWGqBlqSrq6adkoR2a2VmbXV7fnx6eHd2dnZ5gIyZo6eil4p8b2RdWl1oeImVm5qTioB2bWVjZ3ODlaGmpJ2ShXdqX1pcZnOAio6OjYuHg356eX2FjZKRioF3bmhlZGlzg5ShqKedkIFyY1dQUFlrgJWkq6ynnpOFd2tlZWtzeXx7eXh4d3d4e4KNmaOmoZeJe25jW1hcZnaHlZyclo6EenBoZGZwf4+coqGakYV5bWNeYGl1gYqOjoyJhYF8eHd7g4uRkYyEenJsaGdqc4GQnqWknI+BcmRZUlJba4CUo6usp56ThXdrZWRpcXd6e3p5eXl5en6EjpmipKCWiHptYltYW2V1hpWdnpmRh31yaWRmbnyLl52emZCGe3BnYmRsd4KKjY2Kh4N+eXZ2eoKKkZKOh352b2poanJ+jZqhoZqOgXNmW1VVXW2Ak6Kqq6eek4V3bGVkaG92ent6enp7e3x/hY6YoKKelYh6bWJaWFtldYaVnaCclIp/dGplZWx4hpKZm5eQh310a2dobniCio2MiISAfHd0dHmBipGTkIqBeXJsaWtxfImWnZ6YjYF0aF5YWGBugJOhqaqmnZKFd2xkY2dudXl7e3t8fH1+gYaOl56gnZOHeW1iW1hbZXSGlZ6hnZaMgHVrZWRqdYKOlpiWkYmAd29ra3F5gomLioaCfnl1c3N4gIqRlZONhXx0bmpqb3mGkpmblo2CdmphW1tib4CSn6eopJyRhHdsZWNnbXR6fH19fX5+f4GGjZWcnpuShnltYltZXGZ1hpWfop+XjYJ2bGVjaHJ/i5OWlZGLg3pzbm5yeoKIioiEgHt3dHJzeICKkpaVkIh/dm9ram52go6WmJWNgndtZF9fZXGAkJ2lpqKakIN3bGVjZ211en1/f39/f4CChYyTmZuZkYV5bWNdWl5ndYaUn6KgmI6CdmxkYmZvfIiRlZWSjIV9dnJxdHqBhoiGgn55dXJxc3iBi5OXl5KKgXhwa2lsdH+KkpaTjYR6cGhjYmdygI+boqSgmI6CdmxlZGdudXt/gIGAgICAgYWKkZaZl4+FeW5lXlxfaHaGlJ6ioJmOg3dsZGJlbXmFj5SVk46IgHl0c3V6gIWGhIF8eHRycXN5gYuUmZmUjIN5cWtoanF7ho+Tk42FfHNrZmVpc4CNmaChnpaNgXZsZmVob3Z8gIKCgoGAgIGDiI6UlpWOhXpvZmBeYWl2hZSdoqCZjoN3bGRhZGx3g42TlZSQioN8dnR1en+DhIJ/e3ZzcXF0eoKMlZqalY6EenFqZ2lveIONkpKOh392b2poa3N/jJadnpuUi4F2bWdmaXB4foKDg4OCgH+AgoaMkZSTjoV7cWhjYWNrd4WTnKGfmI6Dd2xkYWNrdoKMk5aVkYyFfnh1dnl9gYKBfXl2c3FxdHuDjZabm5ePhXtxamZnbXaBipCSj4mBeXJta210fomTmZuYkoqAdm5paGtyeX+DhYWDgoB/foCEio+Sko2FfHNrZWNlbHeFkZufnpeOgndsZGFjanWBi5OWlpONhn95dnZ4fH+Af3x5dXNxcnV8hI6Wm5yXj4V7cWplZmt0foiPkpCLhHx1cG1udH2HkJaYlpCJgHdvamptc3uBhYaFhIF/fX1+goeNkJCNhn51bWhmZ213hJCZnZyWjYJ3bGViZGp1gYuTlpaUjoiBenZ2d3t+f357eHVzcnN3fYWOlpucl5CGe3FpZWRpcnyHjpKRjYd/eHJvb3R8hY2TlZOOiH93cWxsb3V8goaHhoSBfnx7fYCFi4+QjYeAd3BraGlud4OOl5ualYyCd21mY2RrdYCLk5eXlI+IgXt3dXZ5fH19e3h1dHN0eH6Gj5abm5ePhXtxaWRkaHB7ho6Sko+Jgnt0cXB0eoOKkJKRjYeAeHJubnF3fYOGh4aDgH17ent+g4mNj42IgnpzbWprb3eCjJSZmJOLgXduZ2RlbHWBi5KXl5SPiYF7dnV1eHt8fHt4dnV0dnl/ho+WmpuXj4V7cGhkY2dveoWNkpOQi4R9dnJxc3mAiI2Qj4yGgHl0cXBzeX+Eh4eGg398eXh5fIKHjI+OioR8dXBsbHB3gIqSlpaSioF4b2hlZ212gYuSlpeUj4mBe3Z0dXd6fHx7eXd2dXd6f4eOlZqalo+FenBoZGNnb3mEjZOUko2GfnhzcXJ3foWKjY2LhoB7dnNzdXqAhIeHhYJ+e3h3eHuAhoyPj4uGf3hybm1wdn6Ij5SUkIqBeHBqZ2lud4GLkpaWlI+IgXp2dHR2eXt8e3p4d3d4e4CHjpSYmZWOhHpwaWRjZ295hI2TlZOOh4B5c3FydnyDiIuMioaBfHh1dXd8gYWHh4WBfXl2dXZ6f4WLj4+NiIF6dHBucHV9hY2Rko+JgXlxbGlqcHiBi5GVlpOOiIF6dXNzdnl7fHx7eXh4eXyAho2Tl5eUjYR6cWlkZGdveYSNk5WUj4iBeXRxcXR6gYaKi4mGgn56d3d5fYGFh4aEgHx4dXR1eX6Fi4+QjoqDfHZxb3B0e4OKj5COiYJ6c25rbHF5goqRlJWSjYeAenVzc3V5e319fHt6eXp8gIaMkZWWk4yEenFqZWVob3mEjZOWlJCJgXp0cXBzeX+EiIqJh4N/fHl5en2BhYaGg397d3RzdHh+hYuQkZCLhX53cm9vc3mAh4yOjYmCfHVwbW5zeYKKkJOTkYyGf3l1c3N2eXx+fn18e3p7fICFipCTlJGMhHtya2dmaXB5hI2TlpSQiYJ6dHBwcnd9g4eJiYeEgX17ent+gYSFhYJ+enZzc3R4foWLkJKRjYeAeXNvb3J3foWKjYyJg313cnBwdHqCiY+Sko+LhX55dXNzdnl8f39/fXx7e3x/hImOkpKQi4N7c2xoZ2pxeoOMk5WUkImCenRwb3F2fIKGiYmIhYJ/fHt8foGEhYSBfXl1c3J0eH6FjJGTko6IgXpzb25xdnyDiIuLiYR+eXRycnV7gYiNkJCOiYR+eHVzdHZ6fYCAgH99fHt8f4KHjJCRj4qEfHRuamlrcXqDjJKVlJCJgnp0cG9xdXuBhomKiYaDgH58fX6Bg4SDgH15dXNydHh+hYyRk5OPiYJ6dG9ub3R6gYeKi4mFgHt3dHR2e4GHjI6OjIiDfXh1dHR3e36BgoGAfnx7fH6BhoqOj46KhH11b2tqbXJ6g4uRlJOPiYJ6dHBvcXV7gYaJiomHhIF/fX1+gIKDgn98eHVzcnR4foWMkZSTkIqCe3RvbW9zeX+FiYuJhoJ9eXZ1d3uBhoqNjYuHgn14dXR1eHx/goOCgX58e3t9gISIjI6NioR+d3FtbG5zeoOKkJOSjoiBenRwb3F1e4CFiYqKiIWCf319fn+BgoF/fHh1c3N1eX+FjJGUk5CKg3t0b21ucnd+hImLioeDf3p3d3h7gIWJi4uJhoF9eXZ1dnl9gIOEg4F/fHt6fH6Ch4qNjIqFf3lzb25vdHqCiY+RkY2IgXp0cW9xdXuBhomLioiGgoB+fX1/gIGAfnt4dXRzdXl/hoyRlJOQioN7dG9tbXF2fYOIi4uIhYB8eXh4e3+Dh4mJiIWBfHl3dnd6foGEhISCf3x6enp9gYWJjIyKhoB6dXFvcHR6gYiNkI+Mh4F6dXFwcnZ7gYaJi4uJhoOAfX19fn+AgH57eHZ0dHZ6f4aMkZOTkIqDe3RvbG1wdnyDiIuLiYaCfnp4eXt+goWIiIaEgH15d3d5e3+ChIWEgn98enl5fH+EiIuMioeCfHdzcXJ1eoCHjI6Oi4eBe3VycXJ2e4GGiYuLiYaDgH18fH1+f39+fHl3dXV3eoCGjJCTk4+Kg3t0b2xtcHV8goiLjIqHg397eXl6fYGEhoeFg4B9enh4enyAg4WFhIJ/fHl4eHp+goeKi4uIg355dXJydXp/hYqNjYqGgHt2c3Jzd3yBhomLi4mGgn99fHx9fn9/fnx6eHZ2eHuAhYuQkpKPioN7dW9tbXB1e4KIi4yLiISAfHl5enyAg4WFhYOAfXt5eXt9gYOFhoSCf3t4d3d5fYGGiouLiYR/enZ0c3V5foSIi4uJhYB7d3RzdHh8goaJi4qJhoJ/fHt7fH1+f359e3l3d3h7gIWKj5GRjomDe3VwbW1wdXuCiIuMi4mFgHx6eXl8foGDhISCgH58enp8foGEhoaEgn57eHZ2eHyBhYmLjIqGgXx3dXR1eH2Ch4mKiIWBfHh1dHV5fYKGiYqKiIWCfnx7ent9fn9/fXt6eHh5fICFio6QkI2Jgnx1cG1tcHV7goeLjYyJhYF9enh5e32AgoSDgoB+fXt8fX+ChIaGhIF+end2dnh7gIWJjIyKh4J9eXV0dXh8gYWIiYiFgX15dnV3eX6ChomKiYeEgX57enp7fX5/f359e3l5enx/hImMj4+NiIJ8dnFubnF1fIKHi42MiYWBfXp4eHp9f4KDg4KBf318fH6AgoSFhYSBfXp3dXV3e4CFiYyNi4iDfnp2dHV3e3+DhoiHhYF9end3eHp+goaIiYmHhIB9e3p6e31/gIB/fnx6enp8f4OHi42OjIiCfHZyb29xdnyCh4uMjImFgX16eHh5fH+Bg4ODgYB+fX1+gIKEhYWDgH15d3V1d3t/hImMjYyJhH97d3V0dnp+goWHhoWCfnt5eHl7f4KGiImIhoOAfXp5ent9f4CBgH99e3p6fH6ChoqMjYuHgn13c3BwcnZ8goeLjIyJhYF9enh4eXt+gYKDg4KAf35+f4CChIWEg4B9eXZ1dXd6f4SJjI2MioWAe3d1dHZ5fYGEhoaFgn98enl6fH+ChYeIh4WCf3x6eXp7fX+BgYF/fnx7enx+gYWIi4yKh4J9eHRxcXN3fIKHioyLiYWBfXp4d3l7foCCg4OCgYB/fn+AgoOEhIKAfHl2dXV3en+EiYyOjYqGgXx3dXR1eHyAg4WGhYOAfXt6e3x/goWGh4aEgX58enl6e36AgYKCgH59e3p7fYCEh4qLioeDfnl1c3J0d3yBhoqLi4iFgX15eHd5e36AgoSEg4KAf39/gIGDg4OCf3x5d3V1d3t/hImMjo2KhoF8eHV0dXd7f4KFhoWDgX58e3x9f4KEhoaFg4F+fHp5enx+gIKDgoF/fXt6e3x/g4aIiomHg396dnRzdXh8gYaJioqIhIB9eXh3eXt+gYOEhIOCgYB/f4CBgoODgX98eXd1dnd7f4SJjI6Ni4aBfHh1c3R3en6ChIaFhIJ/fXx8fX+Bg4WFhIKAfnt6enp8f4GDg4OCgH17enp8foGFh4mJh4SAe3h1dHZ4fIGFiImJh4SAfHp4eHl7foGDhISEgoGAf39/gIKCgoF/fHp3dnZ4e3+EiYyNjYqGgXx4dXN0dnp+gYSGhoWDgH59fX1/gYOEhIOCgH17enp7fX+Bg4SEgoB+e3p6e32AhIaIiIeEgHx5dnV2eXyAhIeIiIaDgHx6eHh5e36Bg4SFhIOBgH9/f4CBgoKBf3x6eHd3eHt/hIiMjY2KhoF8eHVzdHZ5fYGEhoaFg4F/fn19f4CCg4ODgX99e3p6e32AgoSEhIOAfnt6eXp8f4OGiIiHhYF+enh2d3l8gIOGh4eGg4B9enl4enx/gYOFhYSDgYB/fn5/gIGBgX99e3l3d3l8gISIi42MioaBfXh1c3R2eX2BhIaGhoSCgH59fX6AgYKDgoF/fXx7e3x+gIKEhYSDgH57eXl5e36ChYeIh4WCf3t5d3d5fH+ChYaGhYOAfXp5eXp8f4KEhYWEg4F/fn5+f4CBgYB/fXt5eHh5fICEh4qMjIqGgX14dXR0dnl9gYSGh4aEgoB+fX1+f4GCgoGAf318e3t8foGDhIWEg4B+e3l4eXt+gYSHiIiGg4B8enh4eXx/goSFhYSCgH17enp7fX+ChIWFhIOBf359fX5/gIGBf358enl5enx/g4eKi4uJhoF9eXV0dHZ5fYGEhoeGhYOAfn19fn+AgYGBgH99fHx8fX+Bg4SFhIOAfnt5eHh6fYGEhoiIhoSBfXt5eHl7foGDhIWEgoB9e3p6e32AgoSFhYSCgH99fX1+f4CBgYB+fXt6eXp8f4OGiYqKiYWBfXl2dHR2eX2BhIaHhoWDgH99fX1+f4CBgYB/fn18fH1/gYOFhYSDgH17eXh4en2AhIaIiIeFgX57eXl5e32AgoSEg4KAfnx7e3x+gIKEhYWEgoB+fXx9fX+AgYGAf318enp7fH+ChYiKioiFgX15dnV1d3p9gYSGh4aFg4B+fX19fn+AgYGAf359fX1+f4GDhIWEg4B9e3l4eHp8gIOGiIiHhYJ/fHp5eXp8f4GDg4OCgH59fHx9foGChIWEg4KAfn18fH1+gIGBgYB+fHt7e3x/goWHiYmHhYF9end2dnd6fYGEhoeGhYOAfn18fX1/gICBgH9/fn19foCBg4SFhIKAfXp4d3h5fICDhoiJiIaDf3x6eXl6fH6AgoODgoB/fXx8fX+Bg4SEhIOBf318fHx9foCBgoGAf318e3t8foGEhoiIh4WBfnp4dnZ4en2BhIaGhoWCgH59fHx9fn+AgYCAf35+fn+AgYOEhISCgH16eHh4eXx/g4aIiYiGg4B9enl5ent+gIGCgoKAf359fX5/gYKEhISCgX99fHt8fX6AgYKCgYB+fHt7fH6Ag4WHh4aEgX57eHd3eHt+gYOFhoaEgoB+fXx8fX5/gIGBgH9/fn5/gIGDhISDgoB9e3l4eHl8f4OGiImIhoSAfXp5eHl7fX+BgoKCgYB+fn5+gIGCg4SDgoB+fXx7fH1+gIKCgoKAfn18e3x9gIKEhoeGhIJ/fHl4eHl7foGDhYaFhIKAfn18fH1+f4CBgYGAf35+f4CBgoODg4J/fXt5eHh6fH+DhoiJiIaEgH17eXh5enx/gYKCgoGAf35+f4CBgoODg4GAfn17e3x9f4CCg4OCgX99fHt8fX+BhIWGhoSCf3x6eXh5e36Ag4SFhYOCgH58fHx9foCBgYGBgH9/fn9/gYKDg4OBf317eXh5enx/g4aIiYiHhIF9e3l4eXp8foCCgoKCgYB/f3+AgYKDg4KBf358e3t8fX+BgoODg4F/fXx7e3x+gYOFhYWEgoB9e3p5enx+gIKEhYSDgX9+fHx8fX6AgYKCgYCAf35/f4CBgoOCgX99e3p5eXp9f4OGiIiIhoSBfXt5eHl6fH6AgoKCgoGAf39/gIGCgoKCgX9+fHt7fH1/gYKDhIOBgH58e3t8foCChIWFhIOAfnx6enp8foCCg4SEg4F/fnx8fH1/gIGCgoGBgH9+fn+AgYKCgoF/fnx6eXl7fX+DhYeIiIaEgX57eXh4enx+gIKCg4KBgIB/f4CAgYKCgYB/fnx8e3x9f4GDhISDgoB+fHt7e31/gYOFhYSDgX98e3p7fH6AgoODg4KBf359fH1+f4CBgoKCgYB/fn5/f4CBgoKBgH58e3p6e31/goWHiIeGhIF+e3l4eXp8foCCg4OCgoGAf3+AgIGBgYGAf318fHx8fn+Bg4SEg4KAfnx7ent9f4GDhIWFg4F/fXx7e3x+f4GCg4OCgH9+fX19fn+BgoKCgoGAf35+fn+AgYGCgYB+fXt6ent9f4KFhoeHhoOBfnt5eHl6fH6AgoODg4KBgH9/f4CBgYGBgH9+fXx8fX6AgYOEhIOCgH58e3p7fH6Ag4SFhYSCgH58e3t8fX+AgoKCgYB/fn19fX6AgYKCgoKBgH9+fn5+f4CBgYGAf318e3t8fX+ChIaHh4WDgX57enl5enx+gIKDg4OCgYB/f3+AgIGBgIB/fn18fH1+gIGDhISDgoB+fHt6e3x+gIKEhYWEgoB+fXx8fH1/gIGCgoGAf359fX5/gIGCg4OCgYB+fn19fn+AgYGBgH9+fHt7fH1/gYSFhoaFg4B+e3p5eXp8foCCg4ODgoGAf39/f4CAgICAf359fX19foCCg4SEg4KAfnx7enp8foCChIWFhIOBf318fHx9fn+BgYGBgH9+fn5+f4CBgoODgoF/fn19fX5/gIGBgYGAfn18fHx9f4GDhYaGhYOAfnx6eXp7fH6AgoODg4KBgH9/f3+AgICAgH9+fX19fX+AgYOEhIOCgH58enp6fH2AgoSFhYWDgX9+fHx8fX5/gIGBgYB/fn5+fn+AgYKDgoKBf359fX19f4CBgYKBgH99fHx8fX+Bg4SFhYSDgH58e3p6e31+gIKDg4OCgYB/f39/f4CAgIB/fn59fX5/gIGDg4SDgoB+fHt6ent9gIKEhYWFg4KAfnx8fHx9f4CAgYCAf39+fn+AgYKCg4KCgH9+fXx9fX6AgYKCgYB/fn18fH1+gIKEhIWEgoF+fHt6ent9f4CCg4OCgoGAf35+f3+AgICAf39+fn1+f4CBgoODg4GAfnx7enp7fYCChIWFhYSCgH59fHx8fX5/gICAgH9/f39/gIGCgoKCgYB/fn18fH1+gIGCgoKBgH59fXx9foCBg4SEhIKBf317e3t8fX+AgoKDgoGAf39+fn9/gICAgIB/fn5+fn+AgYKDg4KBgH58e3p6fH1/goSFhYWEgoB+fXx8fH1+f4CAgICAf39/f4CBgoKCgoGAf319fHx9foCBgoKCgYB/fn18fX5/gYKDhIOCgX99fHt7fH1/gIGCgoKBgH9/fn5/f4CAgICAf39+fn5/gIGCg4OCgYB+fHt6e3x9f4KDhYWFhIKAfn18e3x9fn+AgICAgH9/f4CAgYKCgoKBgH99fHx8fX6AgYKCgoKAf359fH1+f4CCg4ODgoF/fn18fHx9f4CBgoKCgYB/fn5+fn+AgIGBgIB/fn5+f3+AgYKCgoGAfnx7e3t8foCCg4WFhYSCgH59fHt8fH5/gICAgICAf3+AgIGBgoKCgYB+fXx8fH1+gIGCg4OCgX9+fXx9fX6AgYKDg4KBgH59fHx9fn+AgYKCgYGAf35+fn5/gIGBgYCAf35+fn5/gIGCgoKBgH59fHt7fH6AgYOEhYWEgoB+fXx7fHx9f4CAgYGAgICAgICBgYKCgYGAfn18fHx9foCBgoODgoF/fn18fH1+gIGCg4OCgYB/fX19fX5/gIGBgYGAgH9+fn5/f4CBgYGBgH9/fn5+f4CBgYKCgYB+fXx7fHx+gIGDhIWEg4KAfn18e3x8fX+AgIGBgICAgICAgYGBgYGAf359fHx8fX6AgYKDg4KBgH59fHx9fn+BgoODgoKAf359fX1+f4CBgYGBgH9/fn5+f3+AgYGBgYB/f35+fn+AgIGCgYGAf318fHx9fn+Bg4SEhIOCgH59fHx8fH1/gICBgYGAgICAgICBgYGBgH9+fX18fX1+gIGCg4OCgYB+fXx8fX5/gIKCg4KCgX9+fn19fn+AgIGBgYB/f35+fn+AgIGBgYGAgH9+fn5+f4CBgYGBgH9+fXx8fX5/gYOEhISDgoB+fXx8fH1+f4CAgYGBgICAgICAgYGBgYB/fn19fH19f4CBgoODgoGAfn18fHx9f4CBgoODgoGAf359fX5/f4CAgICAf39+fn5/gIGBgoKBgIB/fn5+fn+AgYGBgYB/fn19fH1+f4GCg4SEg4KAfn18fHx9fn+AgIGBgYCAgICAgICBgYGAf35+fX19fn+AgYKDg4KBgH59fHx8fX6AgYKDg4KBgH9+fn5+fn+AgICAgH9/fn5/f4CBgYKCgYGAf35+fX5/f4CBgYGAf35+fX19fn+BgoODg4OBgH59fHx8fX5/gIGBgYGAgICAgICAgYGAgH9/fn19fX5/gIGCg4OCgYB+fXx8fH1+gIGCg4OCgYB/fn5+fn5/f4CAgH9/f35+f3+AgYGCgoGBgH9+fX1+fn+AgYGBgYB/fn19fX5/gIKDg4OCgYB/fX18fH1+f4CBgYGBgICAf3+AgICBgIB/f359fX1+f4CBgoODgoGAfn18fHx9foCBgoODgoKBf39+fn5+f3+AgIB/f38=",
  sfx_test_fail:
    "data:audio/wav;base64,UklGRnwbAABXQVZFZm10IBAAAAABAAEAsDYAALA2AAABAAgAZGF0YVgbAACFm7HF1uPt8vLu5trKt6ONdmBLOSkcEw8OEholNEVYbYKXq73N2+Xs7+/r49nMvKuZhnNgTz8xJRwVEhEUGSAqNkRTYnODk6Oxv8vV3uTp6+zq5+Ha0si9saWYi35xZFhNQjkwKSMdGhcWFhcZHSEmLDM7Q0xVXmhxe4WOmKGpsbnAx83T2Nzf4uTm5ubm5OLg3NnUz8rEvrixqaKak4uDe3NrY1xUTUdAOjUwKyckIR8dHBwdHiAjJyswNTxCSlJaY2x2f4mSnKWutr7GzNLX297g4ODe2tbQycG4rqSYjYB0aFxRRj00LScjISEjJiszPEZSX217ipims7/J0dfb3dvY0cm+saOUhHRkVUc7MSolJCUqMjxJV2d4ipqqucXP1tnZ1tDGuqubinhnVkc7MSonJysyPEhXaHmLnKy6xs/V19bSy8CzpJSDcmJTRToxLCkpLTQ9SFZkdISUorC8xs3S1dTRzMS7r6KVh3lrXVFGPTYwLSssLzQ6QktVYGx4hJCbprC5wMfMz9HS0c/Mx8K7tKyjmpGHfnVsY1tTTEVAOzc0MTAvLzAyNDc7P0RJT1VbYmhvdn2Ei5KYnqSqr7S5vcHEx8nLzM3Ozs3MysjGw8C8uLSvqqWfmZSOh4F7dW9pY11YUk1JRUE9Ojg2NTQ0NDU3Oj1ARElPVFthaHB3f4ePlp6lrLK4vcHFx8nJycfFwby2sKigl46EenFnXlVNR0E8OTg3OTxBR05XYWt2go2Yo6y1vMHFxsbDv7iwppuQg3ZqXlRLQz46Ojs/RU5YZHB9i5ikrre+w8TEwLqyqJyQgnRnW1FIQT07PUFHUFpmc4COmqawuL7Cw8G9tq2jmIt+cWVaUEhCPz0+QUdOV2FseISQm6Wutbu/wcC+u7WuppySiH1zaWBXUEpFQkA/QENHTFJZYGlxeoOLlJyjqa+0uLu9vr69vLm2sa2noZuVjoeBenNtZ2FcV1JOS0hGRENCQkNERUdJTE9TV1tfZGhtcnd8gYaLkJSZnaGlqayvsrS2uLm6u7u7urq4t7WzsK2qp6Ofm5eSjYmEf3p1cGtnYl5aVlNQTUtJR0ZGRkdISkxPUlZaX2Rqb3V8goiPlZugpaqusrS2t7i3tbOwrKehmpOMhH11bWZfWVRPTElISUpNUVddZGx1foeQmKCnrbG0trW0sKulnZWLgnhuZV1WUU1KSkxPVVxkbXeBi5Wepqyxs7Szr6qjm5KIfXNpYFlTTkxMTVFXXmdweoSOmKCnrbGzsrCtp6CYj4V8cmlhWlRQTk1OUVVbYWlyeoOMlJyjqKyvsbGwramln5iRiYF6cmtkXllVUlBPT1BSVVhdYmdtc3qAh42TmJ2ipqmrra+vr6+tq6mmo5+bl5KNiYR/enZxbWllYV5bWFZUU1JRUVFRUlNUVlhaXWBiZmlscHN3en6ChYmMkJOWmZyfoaSmp6mqq6ysra2sq6upqKakoZ+cmZaSj4uHhIB8eHRwbGllYl9cWlhWVVRUVFRVV1lbXmFlaW1ydnuBhouQlJmdoaSmqKqqqqmopaKempWPiYN9d3FrZmFdWldWVVZYW19jaW91fIOKkZedoaWoqamnpaGclo+IgHlxamRfW1hXV1lcYGZsdHuDi5KZn6OmqKemo56YkoqCenNrZWBcWVhYWl5jaW93foaOlJugo6anpqShnJeQiYJ7dG1nYl5bWVlaXF9jaW51e4KJj5SanqGkpaWlo6GdmZWPioR+eXNuaWViX1xbWlpbXF5hZGhscHR5foKHi4+Tl5qdn6Gio6SkpKOioJ6cmZeUkY2Kh4OAfHl2c3BtamhlY2JgX15dXFxcXF1dXl9hYmRmaGpsb3F0d3l8f4GEh4mMj5GTlZeZm52en6ChoaKioqGhoJ+dnJqYlpORjouIhYJ/e3h1cm9samdlY2FgX15eXl9gYWNlaGtucXV5fYGFiY2RlJeanJ6foKCfnpyal5OPi4aBfHdzbmpnZGJgX2BhY2VpbXJ3fIKHjJGWmZyen5+enJiUkIqFf3lzbmpmY2FgYWJlaW5zeX+Fi5CVmZyenp6cmZWQi4V/eXNuaWZjYmFiZGdrcHV7gYeMkZaZnJ2dnZuYlJCLhoB7dnFsaWZjYmJjZGdqbnJ3fIGGio+SlpmbnJycm5qYlZKOioaCfnl1cm5raWdlZGNjY2RmZ2psb3J1eHx/goWJjI6Rk5WXmZqbm5ubm5qZmJeVk5KPjYuJhoSBf3x6eHVzcW9ubGppaGdmZWVlZWVlZWZmZ2hpa2xub3FzdXd5e31/gYOFh4mLjY+RkpSVlpeYmZmZmpqZmZiXlpWTkpCOjImHhYJ/fXp4dXNwbmxraWhnZmZmZ2doamxucHN1eHx/goaJjI+Rk5WXmJiYmJeVk5GOioeDf3t4dHFua2loZ2doaWtucXV5fYGFiY2Rk5aXmJeWlZKPi4eCfnl1cW5raWhoaGpsb3N3fIGFio6RlJaXl5aUko+LhoJ9eXRxbWtpaGlqa25xdXl+goaKjpGUlZaWlZSSj4yIhIB7eHRxbmxqaWlqa2xvcnV4fH+Dh4qNkJKUlZWWlZSTkY+NioeEgX57eHVzcG5tbGtqampqa2xub3FzdXh6fH+Bg4aIioyOj5GSk5SUlZWVlJSTk5KRj46Ni4qIhoSDgX99fHp4d3V0c3Fwb25tbWxsa2tra2trbGxtbm9wcXJzdXZ4eXt8foCBg4SGiImLjI2OkJGRkpOTk5OTk5OSkZCPjoyLiYeFg4F/fXt5d3VzcXBvbm1sbGxtbW5vcXN1d3l8foGEhomLjY+QkZKSkpKRkI6MiYeEgX57eHVzcG9ubW1tbnBydHd6fYGEh4qNj5CSkpKRj42LiISBfXp3dHFvbm1tbnBydHd7foKFiYuOkJGRkZCPjYqHg4B8eXZzcW9ubm5vcXN2eXx/goaJi46PkJGRkI+Ni4iFgn98eXd0cnBvb25vb3FydHd5fH6BhIaJi42Oj5CQkJCPjo2LiYeFg4F/fHp4dnVzcnFwb29vb3BwcXJzdHZ3eXt8foCBg4WGiImKi4yNjo+Pj5CQkI+Pj46NjIyLiomHhoWEg4GAf318e3p5eHZ1dXRzcnJxcXBwcHBwcHBxcXJyc3R1dnd4eXp7fH5/gIKDhIaHiImKi4yNjY6Oj4+Pjo6OjYyLiomIhoWDgYB+fHt5d3Z1dHNycXFxcXFyc3R1d3l6fH6Bg4WHiIqLjY2Ojo6NjIuKiIaDgX98enh2dHNycXFycnN1d3l8foGDhoiKjI2Njo2Mi4mHhYKAfXp4dnRzcnJyc3R2eHp9gIKFh4mLjI2NjYyKiYaEgX98end1dHNycnJzdXZ5e32AgoWHiYuMjI2NjIuKiIaEgn99e3l3dXRzc3Jzc3R1dnh6fH6AgoSFh4mKi4yMjIyMi4uKiYeGhIOBf358e3l4d3Z1dHRzc3Nzc3R0dXZ3eHl6e3x9f4CBgoOEhYaHiImKiouLi4yMjIyMi4uLioqJiIiHhoWEg4OCgYB/fn18e3p5eXh3d3Z1dXV0dHR0dHR0dHR1dXZ2d3h4eXp7fH1+f4CBgoOEhYaHiImJioqLi4uLi4qKiYmIh4aFhIKBgH59fHp5eHd2dXV0dHR1dXZ3eHl6fH1/gYKEhYeIiYqKi4uKiomIhoWDgX99fHp4d3Z1dXV1dXZ4eXt9f4GDhYaIiYqKioqJiIeFg4F/fXt5eHZ1dXV1dnd5enx+iJusvczZ4+vw8/Lu6N/UxrenlYNyYFBAMicdFRAODhEWHicyP05dbHyMnKu5xdHb4+nt7+/u6+bf183DuKyfkoV5bGBUST81LSYgGhcUEhESExYZHSIoLjU8RExUXGVtdn6Gj5eepq2zusDFys/U2Nve4eTm5+nq6uvr6urp6Ofl4+Hf3drY1dLPzMnFwr67t7OwrKikoJyYlJCMiISAfHdzb2tnY19bV1NQTEhEQT06NzQwLisoJiMhHx4cGxoaGRkZGhscHiAiJSgsMDQ5PkRKUFdeZW10fISMlJykrLS7wsjO1Njc3+Lj4+Ph3trW0MnBuK+lmo+DeGxhVktBODEqJCEeHh8hJiwzPEdSX2x6iJWjr7vGz9bb3+Df3NfQx7ywopSFdmhaTEA2LSciICEjKTA5RFFebXyLmqi1wMrS2Nze3drUzcS5rZ+Rg3VnWk1CODAqJiMjJCgtNDxGUVxpdYKOmqawusPK0dXZ29va2NTPysO7s6qgl42DeXBmXVVNRj85NDAsKScmJiYnKCotMDQ4PUJHTFJYXmNpb3V7gYeMkpecoaaqr7O3ur7BxMbJy83P0NLT1NXW1tbW1tbW1dXU09LR0M/NzMrIxsXDwL68ure1sq+tqqekoZ6bmJSRjoqHg4B8eHVxbWpmYl9bV1RQTUlGQ0A9Ojg2NDIwLy4tLCwtLS4wMjQ3Oj5CRktQVlxiaXB3foWNlJuiqbC2vMHFyczP0NHQz83JxcC5squimZCGfHJoX1ZNRT85NTIwMDE0OD1ETFZganaBjZijrba+xMnNzs7MyMK7s6mek4d6bmNYTkU+ODQyMjQ3PURNVmFteYWRnKexucDGyszMy8fDvLWsopeMgXZrYVdOR0A7NzU0NDY6PkRLUltjbXaAiZKbo6uyuL7CxcjJysrIxsPAu7axq6WemJGKg3x1b2hiXVdSTklGQj89Ozk4Nzc3Nzg5Ojs9P0FERklMT1JVWVxfY2ZqbXB0d3p+gYSHio2Qk5aYm56goqWnqautr7GztLa4ubq8vb6/wMHCw8PExMXFxcXFxcXFxMTDwsHBv769u7q4trSysK2qqKWin5uYlJGNiYWBfXl0cGxoZF9bV1RQTUpHREJAPj08PDw9PkBCRUlMUVZbYWdtdHuBiI+WnaOpr7S4vL7AwcHAv7y4s66noJiQiH92bmVeVlBKRUJAPz9BREhNVFtkbXaAiZOcpKyyuLy+wL+9urWvqKCXjoR6cGdeVk9JRUJAQEJFSU9WXWZveIKLlJ2lrLK3ur2+vry5tbCrpJyUjIR7c2tjXFZRTEhFQ0JCQ0VIS09UWV9lbHJ5gIaNk5meo6issLO2uLq7vLy7u7m4trOxrqqno6CcmJSQjIiEgHx4dHFtamdjYV5bWVZUUlBPTUxLSUhIR0ZGRkVFRUVFRkZGR0dISUlKS0xNTk9QUVNUVVdYWVtdXmBhY2VnaGpsbnBydHZ4en1/gYOFiIqMj5GTlZianJ+ho6WnqautrrCxs7S1tra3t7e3tra1tLKwrqyppqOgnJiUkIuHgn14c29qZWFdWVVST01LSklJSktNUFNXW2Bla3F4foWLkpieo6issLK0tbW0sa6qpqCak4yEfXVuZ2BaVVFOTEtLTU9TV11ka3J6goqSmaCmq6+xs7Ozsa6ppJ6XkImBeXFqY11YU1BOTExNT1JWW2FnbnV8g4qRl52ip6uusLKysrGvrKikoJuVkIqEfnhzbWhkX1tYVVJQT05OTk9QUVNVWFteYWVobHB0eHyAg4eLjpKVmJudoKKkpqiqq6ytrq+vsLCwsLCvr66urayrq6qop6alpKKhoJ6dm5qZl5aUk5GQjo2LioiHhYSCgX9+fHt5eHZ1c3Jwb21sa2loZmVkYmFgX11cW1pZWFdWVVVUU1NSUlJSUlJSUlNTVFVWV1laXF5gYmVnam1wc3Z5fYCEh4uOkpWYm56hpKaoqausrKysq6qopqOgnZmVkIuGgXx3cm1oZGBdWldVVFRUVVdZXGBkaW90eoCGjJKXnKGkp6mqq6qppqOfmpWPiYJ8dW9pZGBcWVZVVVZXWl1iZ2xyeH+Fi5GXnKCkpqipqqmnpaGdmZSOiIN9d3FsZ2NfXFlXVlZWV1lbXmJmam5zeH2ChouPlJibnqGjpaeoqKiop6alo6GenJmWk5CMiYaCf3x5dnNwbWtoZmRiYF9dXFtaWVlYWFhYWFhYWVlaWltcXV5fYGFiY2RmZ2hpamxtbnBxcnN1dnd4ent8fX+AgYKDhIaHiImKi4yNjo+RkpOUlZaXmJiZmpucnZ6fn6ChoaKjo6SkpKWlpaWlpaWlpKSjo6KhoJ+enZuamJaUkpCOi4mHhIF/fHl2c3Fua2lnZGJhX15cXFtbW1xcXl9hY2ZpbG9zd3t/g4eLj5OWmZyfoaKjo6OioZ+dmpaSjomFgHt2cW1pZWJgXl1cXF1fYmVobHF2e4CGi4+UmJueoKKioqGgnZqWko6JhH55dHBrZ2RhX15dXV5fYmRoa290eH2ChouPk5eanJ+goaGhoZ+em5mWk4+MiISAfHh1cW5raGZkYmBfX15eXl9gYWJkZmhqbG5xc3Z4e32AgoWHiYyOkJGTlZaYmZqbnJ2enp+foKCgoKCgoJ+fn56enZ2cnJuampmYl5eWlZSTk5KRkI+OjYyMi4qJiIeGhYWEg4KBgH9+fX18e3p5eHd2dXRzc3JxcG9ubWxra2ppaGdnZmVlZGNjYmJiYWFhYWFhYWFiYmNjZGVmZ2lqa21vcXJ1d3l7fYCChYeJjI6QkpSWmJmbnJ2dnZ2dnJuamJaUko+MiYaCf3t4dXFubGlnZWRjYmJjZGVnaWxvc3d6foKGio6RlJeZm5ycnJyamJaTkIyIhIB7d3NwbGlnZWRjY2RlZ2lsb3J2en6Ch4qOkZSXmZqbnJubmZiWk5CNiYaCfnt3dHFua2lnZmVkZGRlZmdpam1vcnR3en2Ag4aIi42QkpSVl5iZmpqbm5uampmYl5aVlJORkI6Mi4mHhoSCgX99fHp5d3Z1c3JxcG9ubWxra2ppaWhoZ2dnZmZmZmZlZWVlZWVlZWZmZmZmZmdnZ2doaGhoaWlqampra2xsbW1ubm9vcHBxcnJzdHR1dnd3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpaXl5iYmJiYmJiYl5aWlZSSkZCOjIqIhoSCgH57eXd1c3FvbWtqaWhoZ2doaGlqbG1vcnR3enx/goWIi46QkpSVlpeXl5eWlJKQjouIhIF+end0cW9ta2loaGhpamttb3J1eHx/goaJjI+Rk5WWl5eWlpSTkY6MiYaCf3x5dnNwbmxramlpaWlqa21vcXN2eHt+gIOGiIuNj5GSlJWVlpaWlpWUk5KRj46MioiGhIKAfn17eXd1dHJxcG9ubWxra2pqampqampqampra2xsbW5ub3BwcXJzc3R1dnd3eHl6e3t8fX5+f4CAgYKCg4SEhYWGhoeHiIiJiYqKi4uMjIyNjY6Ojo+Pj5CQkJGRkZKSkpKTk5OTk5SUlJSUlJSUlJSUlJSUlJOTk5KSkpGQkI+Ojo2Mi4qJiIeGhIOCgX9+fHt6eHd2dHNycXBvbm1sbGxra2xsbG1ub3Byc3V2eHp9f4GDhYeJi42PkJGSk5OTk5KSkY+OjIqHhYKAfXt4dnRycG5tbWxsbW1ucHJ0dnh7foGDhomLjY+QkZKTk5KRkI+Ni4iGg4B+e3h2dHJwb25tbW1tbm9wcnR2eHp8f4GEhoiKjI6PkJGSkpKSkZGQj46Mi4mHhYSCgH58enl3dnRzcnFwb25ubm1tbW5ubm9vcHBxcnN0dXZ3eHl6e3x9fn+AgYKDhISFhoeIiImJiouLjIyNjY2Ojo6Pj4+PkJCQkJCQkZGRkZGRkZGRkZGRkZGRkZGRkJCQkJCQkJCPj4+Pj4+Ojo6OjY2NjIyMi4uLioqJiYiIh4eGhoWEhIOCgoGAf35+fXx7enp5eHd2dnV0c3NycXFwcHBvb29vb29vcHBxcXJzdHV2eHl6fH1/gYKEhYeIiouMjY6Pj5CQkI+Pjo2Mi4mIhoSCgH58enh2dXNycXBwcHBwcXJzdHZ4enx+gIOFh4mKjI2Oj4+Pj46NjIuJh4WDgX99enh3dXNycXBwcHBxcnN0dXd5e31/gYOFh4iKi4yNjo6Pj4+Ojo2Mi4mIhoWDgoB+fXt6eHd2dXRzcnJxcXFxcXFxcXJyc3R1dXZ3eHl6e3x9fn+AgYKDhISFhoeHiImJioqLi4yMjIyNjY2Njo6Ojo6Ojo6Ojo6Ojo6Ojo2NjY2NjY2NjIyMjIyMi4uLi4uKioqKiomJiYmIiIiIh4eHh4aGhoWFhYSEhIODg4KCgYGBgIB/f35+fX18fHt7enp5eXh3d3Z2dXV1dHRzc3NycnJycnJycnJyc3N0dHV1dnd4eXp7fH1+f4GCg4SFh4iJioqLjIyNjY2NjIyLi4qJiIaFg4KAf318enl3dnV0c3NzcnNzdHR1d3h5e31/gIKEhoeIiouLjIyMjIyLiomIhoWDgX99fHp5d3Z1dHNzc3NzdHV2d3h5e31+gIKDhYaHiYqKi4yMjIyMi4uKiYiHhoSDgoB/fn17enl4d3Z1dXR0dHNzc3N0dHR1dXZ2d3h4eXp7fHx9fn+AgIGCg4OEhYWGhoeHiIiJiYmKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKioqKiYmJiYmJiYiIiIiIiIeHh4eHh4aGhoaGhYWFhYSEhISDg4ODgoKCgYGBgICAf39+fn59fXx8fHt7enp5eXh4eHd3d3Z2dnV1dXV1dHR0dHV1dXV1dnZ3d3h5eXp7fH1+f4CBgoOEhYWGh4iJiYqKioqKioqKiYiIh4aFhIKBgH99fHt6eXh3dnV1dXV1dXZ3d3h5e3x9f4CCg4SGh4iJiYqKioqKiYiHhoWEgoGAfn17enl4d3Z2dXV1dXZ2d3h5ent8fn+AgoOEhYaHiImJiYqKiomJiYiHh4aFhIOCgYB/fn18e3p5eXh3d3Z2dnZ2dXV2dnZ2dnd3eHh5eXp6e3t8fH1+fn9/gICBgYKCg4OEhISFhYWGhoaHh4eHh4iIiIiIiIiIiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYiIiIiIiIiIiIiIiIiHh4eHh4eHhoaGhoaFhYWFhISEhIODg4KCgoGBgYCAf39+fn59fXx8e3t6enp5eXh4eHd3d3d3dnZ2d3d3d3d4eHl5enp7fHx9fn+AgYKCg4SFhoaHh4iIiIiIiIiIh4eGhYSDgoGAf359fHt6eXh4d3d3d3d3eHh5ent8fX5/gIGChIWFhoeHiIiIiIiHh4aFhIOCgYB/fn18e3p5eHh3d3d3d3h4eXl6e3x9fn+AgYKDhISFhoaHh4iIiIiIiIeHhoaFhYSDg4KBgYB/fn59fHx7e3p6eXl5eHh4eHh3d3d3d3h4eHh4eHl5eXl6enp6e3t7fHx8fH19fX5+fn5/f39/gICAgICBgYGBgYGCgoKCgoKDg4ODg4ODg4OEhISEhISE",
  sfx_bitto_talk:
    "data:audio/wav;base64,UklGRjgeAABXQVZFZm10IBAAAAABAAEAsDYAALA2AAABAAgAZGF0YRQeAACAgICAgICAgICAgICAgICAgIB/f39/fn5+fn5+fn5+fn9/f4CAgYGBgoKCgoKCgoGBgYCAf35+fX19fHx8fHx9fX1+f4CAgYKCg4OEhISEhIOCgoGAf359fHx7enp6enp7fHx9foCBgoOEhYWGhoaGhYSDgoGAfn18e3p5eHh4eHl6e3x+f4GChIWGh4iIiIeHhoSDgYB+fHt5eHd2dnZ3eHl7fH6AgoSGh4iJioqJiYeGhIKAfnx6eHd1dXR1dXZ4enx+gIOFh4mKi4uLi4qIhoSCf316eHZ0c3Nzc3R2eHp9gIKFh4qLjI2NjYuKiIWCf3x5d3VzcnFxcnN1d3p9gIOGiYuNjo+PjoyKh4SBfnp3dHJxcG9wcXN2eXyAg4eKjI6QkJCPjouIhYF9eXZzcW9ubm9wcnV5fYGFiYyPkZKSkZCOi4eDf3t3c3BubWxtbnB0d3yAhImMj5KTlJOSj4yIg396dnJvbGtra21wc3h8gYaKjpGUlZWUko+LhoJ8eHNvbGppaWttcXV6f4WKjpKVlpeWlJGNiIJ9eHNua2loaGpscHV6gIaLkJOWmJiXlJGMh4F7dXBsaWdmZ2ltcXd9g4mOk5aZmZmXk4+Jg313cWxoZmVlZ2twdXyCiY6Tl5qbmpiUj4qDfHZwa2dkY2Rna3B2fYSLkZaZnJybmJSOiIB5c21oZGJiZGhtc3qBiI+VmZydnZqWkIqCe3RtaGRhYWNma3F5gIiPlZqdn56bl5GKgnpybGZiYGBiZmtyeoKKkpicn6Cem5aPh393b2hjYF5fY2hudn+Hj5acoKGgnpmSioJ5cGljX11eYWZsdH2Gj5acoKKin5qTi4J5cGhiXlxdYGVsdX6IkJieoqOin5mSiX92bWVfXFtdYWdveIKMlZyhpKSinZaNhHpwaGFcWlteZGx1f4mTm6GkpaSfmJCGe3FoYVxZWl1janR+iZOboqampaCZkIV6cGdfWlhZXWNsdoGLlZ6kp6ekn5eNgndsY1xYV1leZm96hpCaoqeop6Obkod8cGZeWVZXW2JrdoKNmKCmqamlnpWKfnJnX1lVVlpganWBjZihp6qqpp+Vin5yZ15XVVVZYWp2go+aoqirqqWek4d7bmRbVVNVWmNueoeTnqarrKmjmo+CdWlfV1NTV15odIGOmqOqraynnpOHeWxhWVNSVVtkcH6LmKKpra2ooZaJe25iWVNRU1pjb32LmKKqrq6poZaIem1hWFJQU1pkcX+NmqWsr66on5OFd2leVVBQVFxodYSSnqiusK2mm45/cWNZUk9RV2FufYuZpaywr6qglIV2aFxTT09UXWl4h5aiq7CxrKOXiXlrXlRPTlJbZ3WFlKGrsLGtpZiKemteVE5OUlpndoaVoqyxsq2kl4h4aVxSTU1SXGl5iZilrrKyrKKUhHRlWFBMTlVgbn6Pnamxs7CpnI19bV5TTUxQWWZ2h5ekrrOzraKUhHNjV05LTVVhcIGSoayztLCmmYh3Z1lPS0xTXm1+j5+rsrWxqJuLeWhaUEtLUl1sfY+fq7O1saibinhnWU9KS1JebX+RoK20tbGnmId1ZFZNSUxUYXGDlaSvtbWvo5SCcF9TS0lOWGZ4ipups7azq52MemhZTklKUl5vgZOjr7a2sKSUgm9eUUpJTlloeo2erLW3s6iZh3RjVEtIS1VkdombqrS3tKuci3dlVkxISlNidIeZqbO3tayejHhmVkxHSlNidIeaqbS4taudindkVUtHS1RkdoqdrLW4tKmZhnNgUklHTFhoe4+hr7e4sqWUgGxbTkdIT11vg5ans7i2rZ+MeGRUSkdKVWV4jZ+ut7izppWBbVtOR0hPXXCEmKm0ubasnIh0YVFIRkxYan6TpbK4t6+gjXllVEpGSlVmeo+isLi4saOQe2dWSkZJVGR4jaGvuLixpJF8aFZKRklUZHmOobC4uLGjkHtmVUpGSlVne5Cjsbm4r6CMd2NSSEZMWGuAlae0ubasm4dxXk9HR09ecYebrLa5tKeUf2pXS0ZJVGV6kKOyubivn4t1YFBHRk1cb4Waq7a5tKeUf2lXSkZJVWd8kqWzubesm4ZwXE5GR1FhdYygsLi4sKGMdmFRR0ZOXXGHnK23ubKkkHpkU0hGTFpuhJqrtrmzpZJ8ZlRJRkxZbYOZq7a5s6aSfGZUSUZMWm6Emqu2ubKkkHpkU0hGTVxwh5ytt7ixoY12YVFHR1BgdYygsLi3rp2HcFxNR0lUZXuSprO5tamWgGlWSkdMWm2Emqy2uLGijXZhUUhIUWJ3jqOxuLaqmIJrWEtHTFltg5mrtriwoYx1YFBISVNkepGls7i0p5R9Z1VKSE9ec4qfr7e2q5qEbVlMR0xabYSarLa3rp6IcV1OSEtXaoCXqbW3sKGMdV9QSEpVaH6VqLS3saKNdmFRSUpVZ32Up7O3sKKNdmBRSUtWaH6VqLS2r6CLdF9QSUxXaoGXqbS2rZ2IcVxOSU1aboWbrLW0q5mDbFlNSVBfdIugr7ayppN8ZlVLS1Rle5KlsrWvoIt0X1BKTVpthJqrtLSqmIJrWE1LUmJ3jqKwtbCijndiUktNWWyDmaqzs6mYgmtZTUtTY3mPo7C0rp+LdF9RS09dcYecrLOxpZJ7ZlVMTVhqgJaosrKpl4JrWU5NVWV7kaSws6uchnBdUExTYneNoa6yrZ6Kc19STVJgdIqfrbKtoIx2YVNNUV9yiZ2ssq6gjXZiU05SX3KJnauxraCMdmJTTlJgc4qerLGsnot0YVNOVGJ2jJ+ssKuciHJfUk9WZXmPoq2wqJiDblxRUFhpfpOlrq6lk35pWVBSXW+EmaivrKCNeGRVUFVidYueq6+omoZwXlNRWWl9k6StraOSfWlZUVRfcYeaqK6pnIlzYVVSWGh8kaKsrKOTfmpaUlVgcoeaqK2omodyYFVTWmp+k6OrqqCPemdZU1dkdoudqauklYJtXVRVX3CFmKarp5qIc2FWVFxrf5OiqqiejHhlWVVaaHuPn6mpoJB8aVtVWWV3i52nqaKTf2xdVlhjdYmapqmilIFuXldYY3SHmaWpo5WCb19XWGJzhpikqKKVgm9gWFljc4eYpKeilIJvYFhaZHWImaSnoJKAbV9ZW2Z3ipqkpp+QfmxeWV1oeoycpaWcjXppXVlfbH2PnqWjmYl2ZlxaYXCCk6CloZWEcmNbXGV1h5ehpJ6Qf21hW19qe4ybo6KZinhpXlxicIGSnqOflINyZF1eaHeIl6Gim418bGFdYm5/j5yin5SFdGZeX2h2h5afoZqNfG1iXmNvf4+boZ6ThHNmX2BpeIiWn5+YinprYmBmcoKRnJ+bj4BxZWBjbXyMmJ6dk4V2aGFianiHlZ2dlol6bGNiaHSDkZudmI1+cGViZnF/jpmdmo+Bc2diZW98i5ecmpGEdWljZW16iZWbmpOGd2tkZWx5h5OampOHeW1lZWx4hpKZmpOIem5mZmx3hZGYmZOIem5nZmx3hJCYmZOIem9nZ214hZCXmJKHem9oZ255hZGXl5GGeW5oaG96hpGXlo+EeG5oanF8iJKWlY2Cdm1pa3N+iZKWk4uAdWxpbHWAi5OVkol+c2xqb3iDjZOUj4Z7cWtrcXuGj5STjYN4b2ttdH6IkJORiX91bmxvd4KLkZKOhnxzbW1ye4WOkpGLgnhxbW92f4mPkY6HfnVvbnJ6g4yQkIuDenJvcHZ+h46Qjod+dnFvc3qDio+PioN6c3Bxd3+HjY+Mhn52cXF0e4OKjo2JgXp0cXN4gIeMjYqEfXZycnZ9hIqNi4Z/eXRydXuCiIyMiIJ7dnN0eYCGioyJhH13dHR4foSJi4mFf3l1dXd8goeKioaAe3Z1d3uBhomJhoF8eHZ3e4CFiImHgn15dnd6f4SHiIeDfnp3d3p+g4aIhoN/e3h4en6ChoeGg397eXh6foKFhoaDf3x5eXt+gYSGhYOAfHp6e36BhIWFg4B9e3p8foGDhISCgH17e3x+gYOEg4J/fXx8fX+BgoODgX99fHx9f4GCg4KBf359fX5/gYKCgYB/fn1+fn+AgYGBgH9+fn5/gICBgYCAf39/f3+AgICAgIB/f39/f67s5qFHECBtxvHTfywOO5bh665SFB9sxu/MdCMTTqzq3Y0zED2a4+SbPhE2kd/ln0ESN5Pg45k8Ez+d5NyKMBZQserNcSEfbMnpslAXNZLf3IkvGly96bpXGTSR39iCKh5pyOWnRBhKrebAXxs1lN/RdiMogNbahy0hcc7ekzQfaMjgmTgeZcbgmTkfZ8jflTYibszcjDAnedPWfikvidrLbCI8nd+7Vx5Ps9+kQSFpyNiHLi6I2MZmIkaq36lGI2jI14MtNJHavVkiVbjalTYsgtTFZiRMsNucPCt80sdpJkuu25w8LH7SxGUmUbLYlDcwh9S8XCZbvNSHMjmV2LBPKWvGzXYrR6bXnkAvf8+/YihYt9KJNDuV1a5PLG7GyXItTKnUmD4zhc+5XSpfu86CM0Gb1KZLL3XIxG0uUazSlD03iM62XCxhucyDNkGX0alQMG/CxnYySqHRoEkzd8XBbzFPps+bRzR6xb9vMk+lz51JNXbDwnU1S53OpVEza7rHgjpBjcqzYjJZqsyYSjZ0v8N9O0OOybRmNFWjzKJTNWezyJBGOne9woE+QITDu3Y6Ro3Gtm44S5PHsms4TZXHsWs5TZPGs246So7EuHY9RYS/voFDP3e3xJBOOmaqx6JeOVSWxLR1QEN8uMKRUTpfoMWubz5GfrfBlFU6WZjCtXxGP2ypxKhrP0Z7ssKdYT1Mg7fAmF09T4W3wJhfPk2BtMGeZkBId6zCqXNGQmiewLWGUz5ViLW/n2pERGufvrWKWD9OfKzArH1PP1aGsb+nd01BWYexvqh6UEFVgay+roRYQk1zoLu3lWhHRF+Lsb2qglhDS26Zt7uheFJDUHSduLmfd1NDT3GZtrqkf1lFSmaNrruvj2lMRVZ4nba5pYJeSEhdgKO4t6F/XUhIXX6gtrelhWNMR1Zzla+5r5RzVkdLYYCftLeojGxTR05kg6G0t6iOb1VITF98mq+3rph7X01JVW2KpLS1qI9yWktLWXGNpbS0p490W0xLVm2HoLG1q5d9ZFJKUGF6lKizsqWPdV5PS1Rmf5eqs7GjjXVeUExTZXyUp7KxppJ7ZFNMUF5zi6Cusqychm9cUE5WZ32TprCxp5V/aVhPT1psgpeosK+kknxnV09RXG6DmKiwrqORe2dXUFFdboSYqK+topB7Z1hQUl1vhJinr6yhkHtnWFFTXnCFmaiuq6CNeGVXUVVhdImcqa6pm4hzYVVSWGd7kKGrrKOTfmpaU1VgcoebqKynmYVwXlRUXW+EmKasp5qGcV9VVV9xhpqnq6WVgGtbVFhleY+gqqmdinRhVlZhc4mdqKmfjHZiV1ZhdIueqaibh3FfVllofZOjqaOSe2ZZV2J2jaCopJV+aFpXYnaNoKijknplWFlnfZSkp5yHcF1YYHSMn6egjXVhWF5xiZ6noY11YFhgdI2gppyHblxaZ36WpaOSeWNZYHWPoaWYf2daXnKMoKWYgGdaX3SOoaSVe2RaY3uVpKCMcV5cbYiepJZ8ZFtmf5iknINpW2J6laSdhmtcYnqVo5yEaVxkfpijmH1kXGuGnqKPc15gdpKim4FmXGqGnqGNb15jfZiilHdgYHeUopd7Yl90kaKYfGNfdJKhl3piYXiVoZN1YGR+mqCMbl5qh56cgmZgdJKhk3VgZoKcnYVoYHOSoJFzYGmHnpp+ZGN8mZ6HaWB0k6COb2BujZ+TdGBriZ6Wd2Fphp2XeWJohZ2XeWJohp2WeGJqiJ2UdWFsjJ6RcWFxkJ6MbWJ3lZ2FaGR+mZl9ZGmHnZN0YnCQnYprY3uXmX9laYacknNic5KchmlmgJqWeGNvjpyKa2R9mJd6Y22MnIpsZHyYl3pkbo2ciWtlfpmVeGRxj5uGaWeCmpJ0ZHSSmYFnaoebjnBlepaXe2VvjZuIa2eBmZJ1ZHWSmYFna4iajG9mfJaVemZxjpqGammDmZBzZXeTl39nbYmZim5nfZeUeWZyjpmFa2qDmJB0ZneSl4BobIeZjHFnepSVfWhuiZmKb2h8lJV8aG+KmIpvaHyUlH1obomYi3FoeZKWgGpthZePdWd1jpeFbWp/lZN8aW+Hl410aHaOl4ZuaX2TlH9rbIOWkXppcIiXjXVoc4uXinJpdo2WiHFpeI+WhnBpeY+WhnBpeY+Wh3Fpd42WiXNpdYuWjHZpcYeVj3trboGTk4Fua3qPlYh0anOIlY98bG1+kZSGcmp0iJWPfW1sfI+ViXZrcIKSk4RyanSGlJGBcGt2iZSQf29rd4mUkH9va3aIk5GBcWt0hZKShXRrcICPlIt6bW15iZOQgnJrcYCPk4t8bmx2hpGSiHhtbXmIkpGGd21ueYiSkYZ3bW14hpGSiXtvbHSCjpONgHNscHuJkpGIem9tc4CMko+Fd25tdYKNko+Ed25tdIGMkpCGenBtcn2JkZGKf3Rtb3eCjZKPh3txbXB5hY6SjoV6cW1weYSNkY+HfXNub3aAipCRi4J3cG5yeoSNkY+Jf3ZvbnN7hY2Rj4mAdnBucnmDi5CQi4N6cm9wdX6GjZGPiYB4cW9wdn+HjpCPiYF4cm9wdX2GjJCPi4R7dHBvc3mBiY6QjoiBeXNvcHR7g4rxsT0OV8runi4Ua9joiyIcfuLfeBonkenTZRQ0ou3FVBJCsu22RRJRwOumOBRhzeeWLRpx1+GGJCKB39l2HiuR5c9nGjaf6MRaF0Gs6LhNF02356xCGFrC5Z84G2bL4ZIwH3PS3IYqJn/Y1XolLYvdz28hNZXhx2UfPaDiv1sdRanitlIdTrHhrUkeVrngpEIfX7/enDwhZ8Xbkzclb8rYizMpeM/UhC8tf9LRfCwxhtTMdio2jdbIbyg6k9fDaSY/mNi+ZCVDndm5XyVHotm1WyZLptmxVyZQqtmtVCdUrtmpUChYsNimTihbs9ejSyletNagSSphttSdRytjuNObRitludKYRSxnutGXRS5pu9GVRC9qu9CURDBru9CTRDFsu8+TRDFsu86TRDJsus2TRTJsuc2TRTJsuMyURzJrt8yVSDJqtsyWSTNotcyXSzNns8yZTTNlssybTzRjr8ydUTRhrcyfVDRfqsuiVjRcp8ukWTRapMqnXTVXoMmqYDVUncisZDdRmcevaDhOlcaybTpLkMW1cjxIi8O4dz5GhsC7fEFDgb2+gURBe7q/h0c/drbBjEs9cLHCkk88aqzDmFU7ZKfDnVo7XqLDo2E8WZvCqGc9VJXBrm4/T46/snVCS4a8t31GR3+3uoRKRHeyvYxPQm+tv5RVQGimv5tcQGCfv6JkQFqXvqlsQlOPu651RU2GuLN9SUl9s7eGT0Z0rbqPVURrpryYXUNjnrygZkRblbuob0ZUjLiveEpOgrO0g09Kd623jVVHbqW5ll1FZJ25n2dGXJO4p3FIVIm0rnxNTn6vs4dTSXOotpFbSGift5tlSF+VtqRwSleKs6x7T1B+rrGGVUxzprWSXkponbacaEpekrSmc01WhrCtf1JQeqmyi1pMbqC0l2RLY5WzoW9NWoqwqXxRUn2qr4hZTnGhspRjTGWWsp9vTluKr6h8U1R9qK6IW09wn7GVZU5klLCgcVBbh62oflZUeqWujF9QbZuwmGpQYo+uo3dTWYKpqoRaU3SgrpJlUWiUrp1xUl2HqqZ/WFZ5o6yNYVJsmK2ZbVJhi6uje1dYfaSqiWBTb5qslmxTY42qoXlXWX+kqIhgVHCaq5VrVGSNqqB5WFt/o6iIYFVwmauVbFVkjKmge1pbfaKniWJWb5eql29WY4mnoX1cWnqfqIxmVmyTqZlzWGGFpKOCX1l2m6iQaldojqeceFpef6Gkh2NYcZanlXBYZIikoH9eXHmcpo1pWGuPppp3W2CAoKOGZFpxlaaUcFplh6OfgGBceJqlj2taao2km3peX32do4lnW26RpJd1XGOCn6CEZFxzlaSTcVxmh6GegGJed5ijj25caYqim31hYHqaooxsXGyNopl6YGF9m6GKal1ujqKXeGBjf5ygiGlecJCilndgZICcn4doXnGQoZV2YGWBnJ6GaF9ykKGUdmBmgZyehmlfcpCglHZhZoGbnYZpYHKPoJR3YWaAmp2HamBxjp+VeGJlf5mdiGxgcIyelnpjZX2XnYpuYW6KnZd9ZWR6lZ2McGFsh5yYf2djeJOdj3NiaoSamoNpY3WQnZF2Y2iBmJuGbGJxjJyUemVmfZWcinBjboibl39oZXiSnI50ZGuDmJmEa2R0jZuSeWVofpWaiW9kb4ialX5oZnmRm451ZWuDl5iEbGVzjJqSemdofZOainJlboaYloFrZnaOmpB4Zmp/lZiHcGVwiJiUf2pneI+ZjnZma4GVl4ZvZnKJmJN+amh5kJmNdmdsgZWXhW9mcomYkn5qaHmPmI12aGyBlJaGcGdyiJeTf2tpeI6YjXhobH+TlodyaHGGlpOBbWh3jJePemprfZGWiXRob4OUlINvaHSJlpF9bGp6jpaMeGptgJKVh3NpcYWUk4FvanaKlo98bGt7jpaLd2pugJKUhnNqcoWUkoFvaneKlY98bGx7jpWLeGtvgJGUh3RqcoSTkoJwa3WIlI9+bmx5jJSMemxufo+UiXZrcIGRk4Vza3OFk5GBcGx3iZOOfm5teoyUjHptbn2Ok4l3bHGBkJKGdGxzhJGRgnJsdoeSj39wbXiJk419b257jJOLem5vfo6SiHdtcYGPkYZ1bXODkJCDc211hZGPgXJtd4eSjn9xbnmJkox9cG97i5KKe29wfYyRiXlucX+NkYd3bnKBjpCFdm50g4+PhHVudYSQj4JzbnaFkI6Bc254h5CNf3JveYiQjH5xb3qJkIt9cXB7ipCKfHBxfIqQiXtwcX2LkIh6cHJ+i5CIeXByf4yPh3lwc3+Mj4Z4cHOAjI+GeHB0gY2PhXhwdIGNjoV3cHSBjY6Fd3B1go2OhHdwdYKNjoR3cHWCjY6Ed3B1go2OhHdxdYKMjYR3cXWCjI2Ed3F1gYyNhHhxdYGMjYR4cXWBjI2FeHF1gIuNhXlxdYCLjYZ5cnR/io2GenJ0f4qNh3pydH6JjYd7c3R9iY2IfHNzfYiNiH1zc3yHjYl+dHN7h42Jf3VzeoaNioB1cnmFjIqBdnJ4hIyLgndyd4KLi4N4c3eBioyEeXN2gIqMhXpzdX+JjIZ8dHR9iIyHfXR0fIaMiH51dHuFjImAdnN5hIuKgXdzeIKKi4N5c3eBiouEenR2f4iLhnx0dX2Hi4d9dXR8houIf3Z0eoSLiYF4dHiCioqDeXR3gImLhXt0dn6Hi4Z9dXV8houIf3Z0eoSKiYF4dHmCiYqDenR3gIiKhXt1dn6Hi4d+dnV8hYqIgHd1eoOKiYJ5dXiBiIqEe3V3foeKhn12dnyFioiAeHV6g4mJgnl1eICIioR8dnd+hoqGfnd2e4SJiIB4dXmCiImDe3Z4f4eKhX13dn2FiYd/eHZ6gomIgnp2eICHiYR8dnd9hYmGf3h2e4OIiIJ6dnmAh4mEfHd3fYWJhn94dnuDiIiCenZ5gIeJhH13d32FiYZ/eXZ7goiIgnt3eH+GiYV9d3d8hIiHgHl3eoGHiIN8d3h+hYiFf3h3e4OIh4F6d3mAhoiEfXh4fYSIhoB5d3qBh4iDfHd4foWIhX95d3uCh4eCe3d5f4WIhX54eHyDh4eBend6gIaIhH14eH2Dh4aAend6gIaHg314eH2Eh4aAenh7gYaHg314eX6Eh4WAenh7gYaHg3x4eX6Eh4WAenh7gYaHg3x4eX6Eh4WAenh7gYaHg314eX6Eh4WAenh7gYaHg315eX2Dh4WAe3h7gIWHg355eX2DhoaBe3h6f4WHhH55eXyChoaCfHl6f4SHhH96eXyBhoaCfXl5foOGhYB7eXuAhYaDfnl5fYKGhYF8eXp/hIaEf3p5fIGFhoJ9eXp+g4aFgHt5e4CFhoN+enl9goaFgnx5en6DhoSAe3l7gIWGg356eX2ChYWBfHl6f4OGhIB7eXyAhYaDfnp6fYKFhYF8enp/g4aEgHt5e4CEhYN+enp9goWFgn16en6DhYSAfHp7f4SFg397enyBhYWCfnp6fYKFhYF8ent/g4WEgHx6fICEhYN/e3p9gYSFgn16en6ChYSBfXp7f4OFhIB8enyAhA==",
};

const SoundManager = {
  muted: false,
  volume: 0.38, // Default gentle 38% volume
  unlocked: false,
  audioCtx: null,
  buffers: {}, // Decoded WebAudio AudioBuffers for zero-latency playback
  htmlAudioPool: {}, // Preloaded HTML5 Audio elements fallback
  lastPlayedAt: {},
  suppressClickUntil: 0,
  storageKeyMute: "algoflow_v54_sfx_muted",
  storageKeyVol: "algoflow_v54_sfx_volume",

  // Minimum cooldown (ms) per sound to prevent clipping/spam
  cooldowns: {
    sfx_click: 45,
    sfx_node_add: 70,
    sfx_node_delete: 70,
    sfx_wire_connect: 80,
    sfx_step_debug: 65,
    sfx_compile: 180,
    sfx_test_pass: 200,
    sfx_test_fail: 220,
    sfx_bitto_talk: 160,
  },

  init() {
    // Load saved preferences from localStorage
    try {
      const savedMute = localStorage.getItem(this.storageKeyMute);
      if (savedMute !== null) this.muted = savedMute === "1";
      const savedVol = localStorage.getItem(this.storageKeyVol);
      if (savedVol !== null) {
        const v = parseFloat(savedVol);
        if (!isNaN(v)) this.volume = Math.min(1, Math.max(0, v));
      }
    } catch (e) {}

    this.syncUI();

    // Preload HTML5 Audio elements from embedded Data URIs
    Object.entries(SFX_DATA_URIS).forEach(([key, uri]) => {
      try {
        const a = new Audio(uri);
        a.preload = "auto";
        a.volume = this.volume;
        this.htmlAudioPool[key] = a;
      } catch (e) {}
    });

    // Unlock Web Audio Context + HTML5 Audio on first user interaction
    const unlockHandler = () => {
      this.unlockAudio();
    };
    window.addEventListener("pointerdown", unlockHandler, {
      once: true,
      capture: true,
    });
    window.addEventListener("keydown", unlockHandler, {
      once: true,
      capture: true,
    });
  },

  unlockAudio() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass && !this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      // Decode embedded base64 WAVs into Web Audio API AudioBuffers for crisp polyphonic playback
      if (this.audioCtx) {
        Object.entries(SFX_DATA_URIS).forEach(([key, uri]) => {
          const b64 = uri.split(",")[1];
          if (!b64) return;
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          this.audioCtx.decodeAudioData(
            bytes.buffer.slice(0),
            (decoded) => {
              this.buffers[key] = decoded;
            },
            () => {},
          );
        });
      }
    } catch (e) {}
  },

  syncUI() {
    const btn = document.getElementById("btnAudioMuteToggle");
    const icon = document.getElementById("audioMuteIcon");
    const label = document.getElementById("audioMuteLabel");
    const slider = document.getElementById("audioVolumeSlider");
    const badge = document.getElementById("audioVolumeBadge");
    const pct = Math.round(this.volume * 100);

    if (slider) slider.value = String(pct);
    if (badge) badge.textContent = this.muted ? "OFF" : `${pct}%`;
    if (icon)
      icon.textContent =
        this.muted || pct === 0 ? "🔇" : pct < 45 ? "🔉" : "🔊";
    if (label) label.textContent = this.muted ? "MUTE" : "SFX";
    if (btn) {
      btn.className = this.muted
        ? "text-xs px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 font-semibold mono flex items-center gap-1"
        : "text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/40 font-semibold mono flex items-center gap-1";
    }
  },

  play(sfxName, options = {}) {
    if (this.muted || this.volume <= 0.001) return;
    const now = performance.now();

    // If a specific feature sound just fired, suppress generic sfx_click for 65ms
    if (sfxName === "sfx_click" && now < this.suppressClickUntil) {
      return;
    }
    if (sfxName !== "sfx_click") {
      this.suppressClickUntil = now + 70;
    }

    const minGap = this.cooldowns[sfxName] || 50;
    if (now - (this.lastPlayedAt[sfxName] || 0) < minGap) {
      return;
    }
    this.lastPlayedAt[sfxName] = now;

    if (!this.unlocked) {
      this.unlockAudio();
    }

    const gainMul = options.gain !== undefined ? options.gain : 1.0;
    const effVol = Math.min(1.0, Math.max(0.01, this.volume * gainMul));

    // 1. Primary: Play decoded Web Audio API buffer (zero latency, polyphonic)
    if (this.audioCtx && this.buffers[sfxName]) {
      try {
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {});
        }
        const srcNode = this.audioCtx.createBufferSource();
        srcNode.buffer = this.buffers[sfxName];
        if (options.playbackRate) {
          srcNode.playbackRate.value = options.playbackRate;
        }
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.value = effVol;
        srcNode.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        srcNode.start(0);
        return;
      } catch (e) {}
    }

    // 2. Secondary: Play preloaded HTML5 Audio clone
    const baseAudio = this.htmlAudioPool[sfxName];
    if (baseAudio) {
      try {
        const clone = baseAudio.cloneNode();
        clone.volume = effVol;
        if (options.playbackRate)
          clone.playbackRate = options.playbackRate;
        const p = clone.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            this.playSynthFallback(sfxName, effVol);
          });
        }
        return;
      } catch (e) {}
    }

    // 3. Tertiary: Web Audio API procedural synthesis fallback
    this.playSynthFallback(sfxName, effVol);
  },

  playSynthFallback(sfxName, effVol) {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) this.audioCtx = new AudioContextClass();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const tones = {
        sfx_click: [880, 1120, 0.045, "sine"],
        sfx_node_add: [520, 780, 0.09, "triangle"],
        sfx_node_delete: [440, 210, 0.11, "sawtooth"],
        sfx_wire_connect: [587, 880, 0.11, "sine"],
        sfx_step_debug: [660, 740, 0.06, "triangle"],
        sfx_compile: [440, 880, 0.18, "sine"],
        sfx_test_pass: [523, 1046, 0.22, "triangle"],
        sfx_test_fail: [240, 160, 0.22, "sawtooth"],
        sfx_bitto_talk: [720, 960, 0.08, "sine"],
      };
      const [f1, f2, dur, waveType] = tones[sfxName] || tones.sfx_click;
      osc.type = waveType;
      osc.frequency.setValueAtTime(f1, now);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, f2),
        now + dur,
      );
      gain.gain.setValueAtTime(effVol * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.start(now);
      osc.stop(now + dur);
    } catch (e) {}
  },
};

const AudioManager = SoundManager;

function toggleAudioMute() {
  SoundManager.muted = !SoundManager.muted;
  try {
    localStorage.setItem(
      SoundManager.storageKeyMute,
      SoundManager.muted ? "1" : "0",
    );
  } catch (e) {}
  SoundManager.syncUI();
  if (!SoundManager.muted) {
    SoundManager.play("sfx_click");
  }
}

function setAudioVolume(val) {
  const pct = Math.min(100, Math.max(0, Number(val) || 0));
  SoundManager.volume = pct / 100;
  if (pct > 0 && SoundManager.muted) {
    SoundManager.muted = false;
    try {
      localStorage.setItem(SoundManager.storageKeyMute, "0");
    } catch (e) {}
  }
  try {
    localStorage.setItem(
      SoundManager.storageKeyVol,
      String(SoundManager.volume),
    );
  } catch (e) {}
  SoundManager.syncUI();
  SoundManager.play("sfx_click");
}

// Hook all 9 specific interaction types to SoundManager
function wireSoundEffectsToActions() {
  // 1. Global UI Clicks, Tab switches & Dropdowns -> sfx_click
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(
        "button, select, .hud-port, #headerBrandBadge",
      );
      if (!btn) return;
      if (btn.id === "btnAudioMuteToggle") return;
      SoundManager.play("sfx_click");
    },
    false,
  );

  document.addEventListener("change", (e) => {
    if (
      e.target &&
      (e.target.tagName === "SELECT" || e.target.type === "checkbox")
    ) {
      SoundManager.play("sfx_click");
    }
  });

  // 2. sfx_node_add: Creating or dropping a flowchart node onto the canvas
  const _origAddNode = addNode;
  addNode = function (type, defaultText) {
    SoundManager.play("sfx_node_add");
    return _origAddNode(type, defaultText);
  };

  const _origApplySketch = applySketchToMainDiagram;
  applySketchToMainDiagram = function () {
    SoundManager.play("sfx_compile");
    return _origApplySketch();
  };

  // 3. sfx_node_delete: Deleting a node, edge, tab, or clearing testcases/sketch
  const _origDelNode = deleteSelectedNode;
  deleteSelectedNode = function () {
    if (selectedNodeId) SoundManager.play("sfx_node_delete");
    return _origDelNode();
  };

  const _origRemoveEdge = removeEdgeById;
  removeEdgeById = function (edgeId) {
    SoundManager.play("sfx_node_delete");
    return _origRemoveEdge(edgeId);
  };

  const _origDeleteTab = deleteCurrentTab;
  deleteCurrentTab = function () {
    SoundManager.play("sfx_node_delete");
    return _origDeleteTab();
  };

  const _origClearSketch = clearSketchCanvas;
  clearSketchCanvas = function () {
    SoundManager.play("sfx_node_delete");
    return _origClearSketch();
  };

  const _origClearTests = clearAllTestCases;
  clearAllTestCases = function () {
    SoundManager.play("sfx_node_delete");
    return _origClearTests();
  };

  // 4. sfx_wire_connect: Connecting a wire/edge between two ports
  const _origFinishConnSfx = finishConnection;
  finishConnection = function (targetId) {
    if (connectingFrom && connectingFrom.nodeId !== targetId) {
      SoundManager.play("sfx_wire_connect");
    }
    return _origFinishConnSfx(targetId);
  };

  // 5. sfx_step_debug: Stepping through nodes during execution
  const _origStartTraceSfx = startTrace;
  startTrace = function () {
    SoundManager.play("sfx_step_debug");
    return _origStartTraceSfx();
  };

  const _origStepNextSfx = stepNext;
  stepNext = function () {
    SoundManager.play("sfx_step_debug");
    return _origStepNextSfx();
  };

  // 6. sfx_compile: Compiling C++ code, syncing to 3D, or running Sugiyama Auto-Layout
  const _origIdeSyncTo3DSfx = ideSyncTo3D;
  ideSyncTo3D = function () {
    SoundManager.play("sfx_compile");
    return _origIdeSyncTo3DSfx();
  };

  const _origParseCppSfx = parseCppToFlowchart;
  parseCppToFlowchart = function (rawOverride, opts = {}) {
    if (!opts.dryRun) SoundManager.play("sfx_compile");
    return _origParseCppSfx(rawOverride, opts);
  };

  const _origAutoLayoutSfx = autoLayout;
  autoLayout = function (recordHistory = true) {
    if (recordHistory) SoundManager.play("sfx_compile");
    return _origAutoLayoutSfx(recordHistory);
  };

  // 7 & 8. sfx_test_pass & sfx_test_fail: Testbench pass/fail and Linter/Terminal errors
  const _origRunAllTestsSfx = runAllTests;
  runAllTests = async function () {
    await _origRunAllTestsSfx();
    if (!testCases || testCases.length === 0) return;
    const hasFail = testCases.some(
      (tc) => tc.status === "FAIL" || tc.status === "TLE",
    );
    if (hasFail) {
      SoundManager.play("sfx_test_fail");
    } else {
      SoundManager.play("sfx_test_pass");
    }
  };

  const _origIdeRunCodeSfx = ideRunCode;
  ideRunCode = async function () {
    await _origIdeRunCodeSfx();
    const outText =
      document.getElementById("stdoutBox")?.textContent || "";
    if (/(Lỗi dịch mã|TLE:)/i.test(outText)) {
      SoundManager.play("sfx_test_fail");
    } else {
      SoundManager.play("sfx_test_pass");
    }
  };

  let lastScannerErrCount = 0;
  const _origTerminalScannerSfx = runTerminalSemanticScanner;
  runTerminalSemanticScanner = function (announceIfClean = false) {
    const errs = _origTerminalScannerSfx(announceIfClean);
    if (errs.length > lastScannerErrCount) {
      SoundManager.play("sfx_test_fail");
    } else if (announceIfClean && errs.length === 0) {
      SoundManager.play("sfx_test_pass");
    }
    lastScannerErrCount = errs.length;
    return errs;
  };

  // 9. sfx_bitto_talk: Bitto mascot speaks, triggers a hint, or changes expression
  const _origBittoSaySfx = bittoSay;
  bittoSay = function (text, mood, ms = 4200) {
    if (mood === "fail" || mood === "angry") {
      SoundManager.play("sfx_test_fail");
    } else {
      SoundManager.play("sfx_bitto_talk");
    }
    return _origBittoSaySfx(text, mood, ms);
  };
}

// GÓI 3: TỐI ƯU KHÔNG GIAN BẢN VẼ SƠ ĐỒ KHỐI 2D & FOCUS CANVAS MODE
// - Nút Toàn Màn Hình mở rộng Viewport 100% (ẩn 2 thanh bên + thanh dưới), có nút nổi Thoát Focus
// - Bấm vào bất kỳ khối nào mở thanh công cụ mini: [Sửa biểu thức | Đặt Breakpoint | Xóa khối (Del)]
// - Luôn hiện các cổng nối dây (+Out, +True, +False, ➔In)
// - Hỗ trợ Pan tự do bằng chuột giữa, chuột phải, hoặc giữ phím Space + kéo chuột trái
// =========================================================================
let isFocusCanvasMode = false;

function toggleFocusCanvasMode(forceState) {
  isFocusCanvasMode =
    typeof forceState === "boolean" ? forceState : !isFocusCanvasMode;
  document.body.classList.toggle(
    "focus-canvas-active",
    isFocusCanvasMode,
  );
  const btn = document.getElementById("btnFullscreen");
  if (btn) {
    btn.textContent = isFocusCanvasMode
      ? "🗗 Thoát Focus"
      : "⛶ Toàn Màn Hình";
  }
  setTimeout(() => {
    onResizeCityViewport();
    updateHudPositions();
  }, 60);
  if (isFocusCanvasMode) {
    setStatusText(
      "Chế độ Toàn màn hình khung vẽ Flowchart (Focus Mode): Nhấn nút nổi góc phải trên hoặc phím ESC để thoát.",
    );
  }
}

// Phím ESC thoát Focus Canvas Mode nếu đang bật
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isFocusCanvasMode) {
    toggleFocusCanvasMode(false);
  }
});


// =========================================================================
// [FIX GÓI 3 - CẬP NHẬT TRỰC TIẾP]:
// 1. Focus Canvas Mode: Chỉ giữ duy nhất Thanh Trái (#leftSidebar) + Khung vẽ
// 2. Sửa dứt điểm Pan 2D (Bấm và kéo chuột trái/giữa/phải trên nền trống để di chuyển sơ đồ tự do mượt mà)
// 3. Bắt buộc người dùng lần đầu vào web phải đọc "Sổ Tay Hướng Dẫn" và bấm xác nhận
// =========================================================================
const MANUAL_READ_STORAGE_KEY = "algoflow_v60_manual_read_ack";
let isFirstVisitManualRequired = false;

function checkAndEnforceFirstTimeManual() {
  let hasRead = false;
  try {
    hasRead = localStorage.getItem(MANUAL_READ_STORAGE_KEY) === "1";
  } catch (e) {}
  if (!hasRead) {
    isFirstVisitManualRequired = true;
    const m = document.getElementById("manualModal");
    const badge = document.getElementById("manualMandatoryBadge");
    const topClose = document.getElementById("btnManualTopClose");
    if (m) {
      m.classList.remove("hidden");
      m.classList.add("flex");
    }
    if (badge) badge.classList.remove("hidden");
    if (topClose) topClose.classList.add("hidden");
  }
}

function tryCloseManualModal() {
  if (isFirstVisitManualRequired) {
    const hint = document.getElementById("manualFooterHint");
    if (hint) {
      hint.innerHTML =
        "<b class='text-amber-300'>⚠️ Đây là lần đầu bạn truy cập! Vui lòng đọc lướt qua hướng dẫn và bấm nút [✓ Tôi đã hiểu — Bắt đầu sử dụng!] góc dưới bên phải nhé.</b>";
    }
    const btnAck = document.getElementById("btnAcknowledgeManual");
    if (btnAck) {
      btnAck.classList.add("ring-2", "ring-amber-300", "scale-105");
      setTimeout(
        () =>
          btnAck.classList.remove(
            "ring-2",
            "ring-amber-300",
            "scale-105",
          ),
        900,
      );
    }
    return;
  }
  closeManual();
}

function acknowledgeAndCloseManual() {
  isFirstVisitManualRequired = false;
  try {
    localStorage.setItem(MANUAL_READ_STORAGE_KEY, "1");
  } catch (e) {}
  const badge = document.getElementById("manualMandatoryBadge");
  const topClose = document.getElementById("btnManualTopClose");
  if (badge) badge.classList.add("hidden");
  if (topClose) topClose.classList.remove("hidden");
  closeManual();
  bittoSay(
    "Chào mừng bạn! Hãy chọn các khối bên Thanh Trái hoặc mở một bài tập trong Thử thách nhập môn nhé!",
    "happy",
    5000,
  );
}

// Chặn phím ESC đóng Sổ tay nếu người dùng lần đầu chưa bấm xác nhận
document.addEventListener(
  "keydown",
  (e) => {
    const m = document.getElementById("manualModal");
    if (
      e.key === "Escape" &&
      m &&
      !m.classList.contains("hidden") &&
      isFirstVisitManualRequired
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      tryCloseManualModal();
    }
  },
  true,
);

// Cập nhật toggleFocusCanvasMode để đảm bảo Thanh Trái luôn mở khi vào Focus Mode
toggleFocusCanvasMode = function (forceState) {
  isFocusCanvasMode =
    typeof forceState === "boolean" ? forceState : !isFocusCanvasMode;
  document.body.classList.toggle(
    "focus-canvas-active",
    isFocusCanvasMode,
  );
  if (isFocusCanvasMode && !leftDrawerOpen) {
    toggleLeftDrawer();
  }
  const btn = document.getElementById("btnFullscreen");
  if (btn) {
    btn.textContent = isFocusCanvasMode
      ? "🗗 Thoát Focus"
      : "⛶ Toàn Màn Hình";
  }
  setTimeout(() => {
    onResizeCityViewport();
    updateHudPositions();
  }, 60);
  if (isFocusCanvasMode) {
    setStatusText(
      "Chế độ Focus Canvas: Hiển thị Thanh Trái + Khung vẽ Flowchart mở rộng. Bấm nút nổi góc phải trên hoặc ESC để thoát.",
    );
  }
};

// -------------------------------------------------------------------------
// HẠNG MỤC 2: BẮT BUỘC ĐỌC SỔ TAY HƯỚNG DẪN MỖI LẦN TẢI TRANG WEB (MANDATORY ONBOARDING)
// - Mỗi lần truy cập hoặc tải lại trang web, #manualModal bắt buộc bật lên chính giữa màn hình.
// - Ẩn nút ✕ và khóa phím ESC cho đến khi người dùng nhấn:
//   "✓ Tôi đã hiểu — Bắt đầu sử dụng!"
// -------------------------------------------------------------------------
isFirstVisitManualRequired = true;

checkAndEnforceFirstTimeManual = function () {
  isFirstVisitManualRequired = true;
  const m = document.getElementById("manualModal");
  const badge = document.getElementById("manualMandatoryBadge");
  const topClose = document.getElementById("btnManualTopClose");
  if (m) {
    m.classList.remove("hidden");
    m.classList.add("flex");
  }
  if (badge) badge.classList.remove("hidden");
  if (topClose) {
    topClose.classList.add("hidden");
    topClose.disabled = true;
  }
};

openManual = function () {
  const m = document.getElementById("manualModal");
  const topClose = document.getElementById("btnManualTopClose");
  const badge = document.getElementById("manualMandatoryBadge");
  if (!m) return;
  m.classList.remove("hidden");
  m.classList.add("flex");
  const body = document.getElementById("manualBody");
  if (body) body.scrollTop = 0;
  if (isFirstVisitManualRequired) {
    if (topClose) {
      topClose.classList.add("hidden");
      topClose.disabled = true;
    }
    if (badge) badge.classList.remove("hidden");
  } else {
    if (topClose) {
      topClose.classList.remove("hidden");
      topClose.disabled = false;
    }
    if (badge) badge.classList.add("hidden");
  }
};

closeManual = function () {
  if (isFirstVisitManualRequired) {
    tryCloseManualModal();
    return;
  }
  const m = document.getElementById("manualModal");
  if (m) {
    m.classList.add("hidden");
    m.classList.remove("flex");
  }
};

tryCloseManualModal = function () {
  if (isFirstVisitManualRequired) {
    const hint = document.getElementById("manualFooterHint");
    if (hint) {
      hint.innerHTML =
        "<b class='text-amber-300'>⚠️ Bắt buộc đọc Sổ tay hướng dẫn! Vui lòng xem qua nội dung và nhấn nút [✓ Tôi đã hiểu — Bắt đầu sử dụng!] ở góc dưới bên phải để mở khóa hệ thống.</b>";
    }
    const btnAck = document.getElementById("btnAcknowledgeManual");
    if (btnAck) {
      btnAck.classList.add("ring-2", "ring-amber-300", "scale-105");
      setTimeout(
        () =>
          btnAck.classList.remove(
            "ring-2",
            "ring-amber-300",
            "scale-105",
          ),
        900,
      );
    }
    return;
  }
  closeManual();
};

acknowledgeAndCloseManual = function () {
  isFirstVisitManualRequired = false;
  const badge = document.getElementById("manualMandatoryBadge");
  const topClose = document.getElementById("btnManualTopClose");
  const m = document.getElementById("manualModal");
  if (badge) badge.classList.add("hidden");
  if (topClose) {
    topClose.classList.remove("hidden");
    topClose.disabled = false;
  }
  if (m) {
    m.classList.add("hidden");
    m.classList.remove("flex");
  }
  syncOrbitControlsForCurrentMode();
  bittoSay(
    "Chào mừng bạn đến với AlgoFlow Studio v6.1! Hãy kéo chuột trái xoay 3D 360° hoặc chọn khối lệnh ở Thanh Trái nhé!",
    "happy",
    5000,
  );
};

// Lắng nghe phím ESC ở Capture Phase để:
// 1) Chặn đóng #manualModal khi đang ở chế độ bắt buộc đọc
// 2) Thoát ngay chế độ Fullscreen của khung IDE C++ (#idePanelContainer.ide-fullscreen)
// 3) Thoát Fullscreen của Terminal hoặc đóng #sketchModal
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape") return;

    const manualModal = document.getElementById("manualModal");
    if (manualModal && !manualModal.classList.contains("hidden")) {
      if (isFirstVisitManualRequired) {
        e.stopImmediatePropagation();
        e.preventDefault();
        tryCloseManualModal();
        return;
      }
    }

    const ideContainer = document.getElementById("idePanelContainer");
    if (
      ideContainer &&
      ideContainer.classList.contains("ide-fullscreen")
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      toggleIdeFullscreen(false);
      setStatusText(
        "Đã thoát chế độ Toàn màn hình khung Code C++ (ESC).",
      );
      return;
    }

    const termPanel = document.getElementById("terminalConsolePanel");
    if (termPanel && termPanel.classList.contains("term-fullscreen")) {
      e.stopImmediatePropagation();
      e.preventDefault();
      toggleTerminalFullscreen();
      return;
    }

    const sketchModal = document.getElementById("sketchModal");
    if (sketchModal && !sketchModal.classList.contains("hidden")) {
      e.stopImmediatePropagation();
      e.preventDefault();
      closeSketchModal();
      return;
    }
  },
  true,
);

// =========================================================================
// 32. ALGOFLOW REGRESSION TEST SUITE (HOTFIX VERIFICATION)
// =========================================================================
function runAlgoFlowTestSuite() {
  console.log(
    "%c=== BẮT ĐẦU KIỂM THỬ TOÀN DIỆN ALGOFLOW GRAPH ENGINE ===",
    "color: #38bdf8; font-weight: bold; font-size: 14px;",
  );
  let passedCount = 0;
  let failedCount = 0;

  function assert(testName, condition, details = "") {
    if (condition) {
      console.log(
        `%c[PASS] ${testName}`,
        "color: #4ade80; font-weight: bold;",
      );
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName} ➔ Chi tiết: ${details}`);
      failedCount++;
    }
  }

  // TEST 1: Tự phục hồi khi tabs rỗng
  try {
    const oldTabs = tabs;
    const oldActive = activeTab;
    tabs = {};
    const g = currGraph();
    assert(
      "TEST 1: Tự phục hồi khi tabs rỗng",
      g && g.nodes && g.nodes.length >= 2,
      "currGraph() không tạo graph mặc định khi tabs = {}",
    );
    tabs = oldTabs;
    activeTab = oldActive;
  } catch (err) {
    assert("TEST 1: Tự phục hồi khi tabs rỗng", false, err.message);
  }

  // TEST 2: Đảm bảo tính duy nhất của ID khi tạo liên tiếp 100 Node
  try {
    const generatedIds = new Set();
    let hasDuplicate = false;
    for (let i = 0; i < 100; i++) {
      const id = addNode("process", `x = ${i}`);
      if (generatedIds.has(id)) {
        hasDuplicate = true;
        break;
      }
      generatedIds.add(id);
    }
    // Dọn dẹp 100 node vừa tạo để không làm bẩn giao diện
    const g = currGraph();
    g.nodes = g.nodes.filter((n) => !generatedIds.has(n.id));
    renderAll();
    assert(
      "TEST 2: Tính duy nhất của ID (100 Nodes liên tục)",
      !hasDuplicate,
      "Phát hiện ID bị trùng lặp",
    );
  } catch (err) {
    assert("TEST 2: Tính duy nhất của ID", false, err.message);
  }

  // TEST 3: Xóa node dọn sạch cạnh liên kết và con trỏ connectingFrom
  try {
    const nA = addNode("process", "A");
    const nB = addNode("process", "B");
    connectingFrom = { nodeId: nA, branch: null };
    finishConnection(nB);

    connectingFrom = { nodeId: nA, branch: "true" };
    deleteNodeById(nA);
    const g = currGraph();
    const edgeRemaining = g.edges.some(
      (e) => e.source === nA || e.target === nA,
    );
    const pointerCleared = connectingFrom === null;

    assert(
      "TEST 3.1: Dọn dẹp cạnh liên kết trong g.edges",
      !edgeRemaining,
      "Vẫn còn cạnh chứa ID của node đã xóa",
    );
    assert(
      "TEST 3.2: Dọn dẹp con trỏ connectingFrom",
      pointerCleared,
      "connectingFrom vẫn giữ ID của node đã xóa",
    );
    deleteNodeById(nB);
  } catch (err) {
    assert("TEST 3: Xóa node và dọn dẹp liên kết", false, err.message);
  }

  // TEST 4: Chặn tạo cạnh ma khi nối vào node không tồn tại
  try {
    const nReal = addNode("process", "RealNode");
    connectingFrom = { nodeId: nReal, branch: null };
    finishConnection("non_existent_target_id_999");
    const g = currGraph();
    const danglingEdge = g.edges.find(
      (e) => e.target === "non_existent_target_id_999",
    );
    assert(
      "TEST 4: Chặn tạo cạnh ma (Dangling Edge)",
      !danglingEdge,
      "Hàm finishConnection vẫn tạo cạnh trỏ tới ID không tồn tại",
    );
    deleteNodeById(nReal);
  } catch (err) {
    assert("TEST 4: Chặn tạo cạnh ma", false, err.message);
  }

  // TEST 5: Chặn bẫy treo vô tận khi tự nối chính mình (Self-loop)
  try {
    const nLoop = addNode("decision", "x > 0");
    connectingFrom = { nodeId: nLoop, branch: "true" };
    finishConnection(nLoop);
    const g = currGraph();
    const selfEdge = g.edges.find(
      (e) => e.source === nLoop && e.target === nLoop,
    );
    const pointerReset = connectingFrom === null;
    assert(
      "TEST 5: Chặn tự nối chính mình (Self-Loop Trap)",
      !selfEdge && pointerReset,
      "Hàm cho phép tự nối hoặc không hủy trạng thái",
    );
    deleteNodeById(nLoop);
  } catch (err) {
    assert("TEST 5: Chặn tự nối chính mình", false, err.message);
  }

  // TEST 6: Ngăn chặn đệ quy vô tận / Tràn ngăn xếp (Depth Guard)
  try {
    let caughtDepthError = false;
    const fakeRecursiveGraph = {
      signature: "int rec(int n)",
      nodes: [
        { id: "s", type: "start", content: "Start rec(n)" },
        { id: "p", type: "process", content: "ans = rec(n)" },
        { id: "e", type: "return", content: "return ans" },
      ],
      edges: [
        { id: "e1", source: "s", target: "p" },
        { id: "e2", source: "p", target: "e" },
      ],
    };
    try {
      globalSubroutineRecursionDepth = MAX_SUBROUTINE_DEPTH;
      runSubroutineHeadless(fakeRecursiveGraph, 1);
    } catch (e) {
      if (
        e.message &&
        e.message.includes("Vượt quá giới hạn đệ quy tối đa")
      ) {
        caughtDepthError = true;
      }
    } finally {
      globalSubroutineRecursionDepth = 0;
    }
    assert(
      "TEST 6: Ngăn chặn đệ quy vô tận / Tràn ngăn xếp (Depth Guard)",
      caughtDepthError,
      "Không chặn được đệ quy sâu",
    );
  } catch (err) {
    assert("TEST 6: Kiểm tra đệ quy", false, err.message);
  }

  // TEST 7: Kiểm thử các phương thức nguyên tử (Atomic Methods) & Observer của AppState
  try {
    let eventFiredCount = 0;
    const unsub = AppState.on("graphChanged", () => {
      eventFiredCount++;
    });
    const n1 = AppState.addNode("process", "a = 10", 240, 120);
    const n2 = AppState.addNode("output", "a", 240, 220);
    AppState.updateNode(n1, { content: "a = 42", bp: true }, true);
    const edge = AppState.addEdge(n1, n2, null);
    AppState.selectedEdgeId = edge ? edge.id : null;
    AppState.deleteNode(n1);
    const g = AppState.getCurrentGraph();
    const edgeCleaned = !g.edges.some((e) => e.id === edge?.id);
    const selectedEdgeReset = AppState.selectedEdgeId === null;
    unsub();
    AppState.deleteNode(n2);
    assert(
      "TEST 7: AppState Atomic Methods & Observer (on/emit, updateNode, selectedEdgeId cleanup)",
      eventFiredCount >= 4 && edgeCleaned && selectedEdgeReset,
      "AppState không bắn đủ sự kiện hoặc không dọn sạch selectedEdgeId"
    );
  } catch (err) {
    assert("TEST 7: AppState Atomic Methods & Observer", false, err.message);
  }

  console.log(
    `%c=== KẾT QUẢ: ${passedCount} PASS / ${failedCount} FAIL ===`,
    "color: #38bdf8; font-weight: bold;",
  );
  return { passed: passedCount, failed: failedCount };
}
window.runAlgoFlowTestSuite = runAlgoFlowTestSuite;


// ============================================================================
// KHỞI CHẠY ĐỒNG BỘ TOÀN BỘ CÁC PHÂN HỆ (UNIFIED APPLICATION BOOTSTRAP)
// ============================================================================
window.addEventListener("load", () => {
  // 1. Khởi tạo IDE, Linh vật Bitto và Bảng vẽ phác thảo SketchPad
  ideInit();
  bittoInit();
  initSketchPadEvents();
  ideBadge();

  // 2. Đảm bảo Bitto nổi tự do trên body, khởi tạo Resizer cho Testbench & SketchModal
  ensureBittoFixedInBody();
  initTestbenchResizer();
  initSketchModalResizer();
  renderIdeSyntaxHighlight();
  runTerminalSemanticScanner(false);
  requestAnimationFrame(animateBittoSpatialRoam);

  // 3. Gắn sự kiện đồng bộ lớp phủ cú pháp VS Code IDE & Autocomplete
  const ta = document.getElementById("codeOutputBox");
  if (ta) {
    ta.addEventListener("input", () => {
      renderIdeSyntaxHighlight();
      updateIdeAutocomplete();
      runTerminalSemanticScanner(false);
    });
    ta.addEventListener("click", updateIdeActiveLineAndCursor);
    ta.addEventListener("keyup", (e) => {
      updateIdeActiveLineAndCursor();
      if (e.key === "Escape") {
        document
          .getElementById("ideAutocompletePopup")
          ?.classList.add("hidden");
      }
    });
    ta.addEventListener("scroll", () => {
      const layer = document.getElementById("ideSyntaxHighlightLayer");
      if (layer) {
        layer.scrollTop = ta.scrollTop;
        layer.scrollLeft = ta.scrollLeft;
      }
      updateIdeActiveLineAndCursor();
    });
  }

  // 4. Khởi tạo hệ thống âm thanh 9 SFX và điều hướng 2D/3D hợp nhất
  SoundManager.init();
  wireSoundEffectsToActions();
  initFreeForm2DNavigation();
  initReliable2DCanvasPan();
  initBittoSmartZoneInteraction();
  updateZoomBadgeUI();

  // 5. Dựng lại cảnh 3D với kiến trúc v6.1, kiểm tra Sổ tay bắt buộc và đồng bộ OrbitControls
  rebuild3DCityScene();
  compileAll();
  checkAndEnforceFirstTimeManual();
  syncOrbitControlsForCurrentMode();
});


// =========================================================================
// TỰ ĐỘNG THU GỌN THANH BÊN CHO MOBILE & TABLET (RESPONSIVE SAFE-HOOK)
// =========================================================================
function autoFoldSidebarsOnMobile() {
  // Chỉ kích hoạt khi chiều rộng màn hình nhỏ hơn 1024px (Mobile / iPad)
  if (window.innerWidth >= 1024) return;

  try {
    // 1. Tìm các nút bấm hoặc thanh bên trên giao diện
    const leftSidebar = document.getElementById("leftSidebar") || document.querySelector(".sidebar-left");
    const rightSidebar = document.getElementById("rightSidebar") || document.querySelector(".sidebar-right");

    // 2. Nếu có hàm toggle có sẵn trong dự án thì gọi an toàn
    if (typeof toggleLeftSidebar === "function") {
      toggleLeftSidebar(false);
    } else if (leftSidebar && !leftSidebar.classList.contains("drawer-collapsed")) {
      leftSidebar.classList.add("drawer-collapsed");
    }

    if (typeof toggleRightSidebar === "function") {
      toggleRightSidebar(false);
    } else if (rightSidebar && !rightSidebar.classList.contains("drawer-collapsed")) {
      rightSidebar.classList.add("drawer-collapsed");
    }

    // 3. Căn chỉnh lại tầm nhìn camera 3D cho vừa khung hình di động
    if (typeof onResizeCityViewport === "function") {
      onResizeCityViewport();
    }
  } catch (err) {
    console.warn("Auto-fold sidebars warning:", err);
  }
}

// Lắng nghe sự kiện khi trang vừa nạp xong và khi người dùng xoay ngang/dọc điện thoại
window.addEventListener("DOMContentLoaded", autoFoldSidebarsOnMobile);
window.addEventListener("resize", autoFoldSidebarsOnMobile);