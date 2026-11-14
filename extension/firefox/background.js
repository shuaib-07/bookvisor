// BookVisor Bridge - Universal Cross-Browser WebExtension Background Service Worker
// Supports: Zen Browser, Google Chrome, Brave, Microsoft Edge, Mozilla Firefox

const WS_URL = "ws://127.0.0.1:49152";
const api = typeof browser !== "undefined" ? browser : chrome;

let socket = null;
let reconnectTimer = null;
let isMutatingFromDesktop = false;
let pingInterval = null;

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Zen/")) return "Zen Browser";
  if (ua.includes("Edg/")) return "Microsoft Edge";
  if (ua.includes("Brave")) return "Brave";
  if (ua.includes("Chrome") && !ua.includes("Edg/")) return "Google Chrome";
  if (ua.includes("Firefox")) return "Mozilla Firefox";
  return "WebExtension Client";
}

console.log(`[BookVisor Bridge] Starting extension on ${detectBrowser()}...`);

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = async () => {
      console.log("[BookVisor Bridge] Connected to BookVisor desktop app via WebSocket!");
      clearTimeout(reconnectTimer);
      clearInterval(pingInterval);

      api.storage.local.set({
        connected: true,
        lastConnected: Date.now(),
        browserName: detectBrowser(),
      });

      // 1. Identify ourselves to desktop
      socket.send(JSON.stringify({
        type: "CLIENT_HELLO",
        payload: {
          browser: detectBrowser(),
          version: api.runtime.getManifest().version,
        },
      }));

      // 2. Automatically sync all bookmarks to desktop app immediately upon connection
      try {
        const tree = await api.bookmarks.getTree();
        socket.send(JSON.stringify({
          type: "BROWSER_TREE",
          payload: tree,
        }));
        console.log("[BookVisor Bridge] Sent full bookmark tree to BookVisor!");
      } catch (err) {
        console.error("[BookVisor Bridge] Failed to send tree on open:", err);
      }

      // 3. Keepalive ping every 25 seconds
      pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "PING" }));
        }
      }, 25000);
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("[BookVisor Bridge] Received command from desktop:", msg.type);

        switch (msg.type) {
          case "REQUEST_TREE": {
            const tree = await api.bookmarks.getTree();
            socket.send(JSON.stringify({
              type: "BROWSER_TREE",
              payload: tree,
            }));
            break;
          }

          case "DESKTOP_BOOKMARK_CREATED": {
            await handleDesktopBookmarkCreated(msg.payload);
            break;
          }

          case "DESKTOP_BOOKMARK_UPDATED": {
            await handleDesktopBookmarkUpdated(msg.payload);
            break;
          }

          case "DESKTOP_BOOKMARK_MOVED": {
            await handleDesktopBookmarkMoved(msg.payload);
            break;
          }

          case "DESKTOP_BOOKMARK_DELETED": {
            await handleDesktopBookmarkDeleted(msg.payload);
            break;
          }

          case "DESKTOP_FOLDER_CREATED": {
            await handleDesktopFolderCreated(msg.payload);
            break;
          }

          case "DESKTOP_FOLDER_DELETED": {
            await handleDesktopFolderDeleted(msg.payload);
            break;
          }

          case "MUTATE_TREE": {
            if (Array.isArray(msg.moves)) {
              await applyDesktopTreeMutations(msg.moves);
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("[BookVisor Bridge] Error handling message:", err);
      }
    };

    socket.onclose = () => {
      console.log("[BookVisor Bridge] Disconnected from BookVisor desktop app. Reconnecting in 3s...");
      api.storage.local.set({ connected: false });
      clearInterval(pingInterval);
      scheduleReconnect();
    };

    socket.onerror = (err) => {
      console.warn("[BookVisor Bridge] WebSocket error (desktop app may be closed):", err);
      try {
        socket.close();
      } catch (_) {}
    };
  } catch (err) {
    console.warn("[BookVisor Bridge] Connect failed:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, 3000);
}

// ── Browser Event Listeners ─────────────────────────────────────────────────

// When user creates a bookmark or folder in the browser
api.bookmarks.onCreated.addListener((id, bookmark) => {
  if (isMutatingFromDesktop) return; // avoid feedback loop

  if (!bookmark.url) {
    // Folder created
    console.log("[BookVisor Bridge] New folder created in browser:", bookmark.title);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "FOLDER_CREATED",
        payload: {
          guid: bookmark.id,
          title: bookmark.title || "New Folder",
          parent_guid: bookmark.parentId || null,
        },
      }));
    }
  } else {
    // Bookmark created
    console.log("[BookVisor Bridge] New bookmark saved in browser:", bookmark.title, bookmark.url);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "BOOKMARK_CREATED",
        payload: {
          guid: bookmark.id,
          url: bookmark.url || "",
          title: bookmark.title || "",
          parent_guid: bookmark.parentId || null,
          date_added: bookmark.dateAdded || Date.now(),
        },
      }));
    }
  }
});

// When user updates title or URL of a bookmark in browser
api.bookmarks.onChanged.addListener((id, changeInfo) => {
  if (isMutatingFromDesktop) return;

  console.log("[BookVisor Bridge] Bookmark updated in browser:", id, changeInfo);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "BOOKMARK_UPDATED",
      payload: {
        guid: id,
        title: changeInfo.title,
        url: changeInfo.url,
      },
    }));
  }
});

// When user moves a bookmark or folder in browser
api.bookmarks.onMoved.addListener((id, moveInfo) => {
  if (isMutatingFromDesktop) return;

  console.log("[BookVisor Bridge] Bookmark moved in browser:", id, moveInfo);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "BOOKMARK_MOVED",
      payload: {
        guid: id,
        parent_guid: moveInfo.parentId || null,
        index: moveInfo.index,
      },
    }));
  }
});

// When user deletes a bookmark or folder in browser
api.bookmarks.onRemoved.addListener((id, removeInfo) => {
  if (isMutatingFromDesktop) return;

  console.log("[BookVisor Bridge] Item removed in browser:", id);
  if (socket && socket.readyState === WebSocket.OPEN) {
    if (removeInfo && removeInfo.node && !removeInfo.node.url) {
      socket.send(JSON.stringify({
        type: "FOLDER_REMOVED",
        payload: { guid: id },
      }));
    } else {
      socket.send(JSON.stringify({
        type: "BOOKMARK_REMOVED",
        payload: { guid: id },
      }));
    }
  }
});

// ── Inbound Handlers (Desktop App -> Browser) ───────────────────────────────

async function handleDesktopBookmarkCreated(payload) {
  if (!payload || (!payload.url && !payload.clean_url)) return;

  isMutatingFromDesktop = true;
  try {
    const targetUrl = payload.url || payload.clean_url;
    // Check if bookmark already exists in browser
    const existing = await api.bookmarks.search({ url: targetUrl });
    if (existing && existing.length > 0) {
      console.log("[BookVisor Bridge] Bookmark already exists in browser:", targetUrl);
      return;
    }

    const folderId = await ensureBrowserFolderExists(payload.folder_path || "");
    const created = await api.bookmarks.create({
      parentId: folderId,
      title: payload.title || payload.clean_url || targetUrl,
      url: targetUrl,
    });
    console.log(`[BookVisor Bridge] Created bookmark in browser: "${created.title}" (ID: ${created.id})`);
  } catch (err) {
    console.error("[BookVisor Bridge] Error creating bookmark from desktop:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 400);
  }
}

async function handleDesktopBookmarkUpdated(payload) {
  if (!payload) return;

  isMutatingFromDesktop = true;
  try {
    let bookmarkNode = null;
    if (payload.browser_guid) {
      const results = await api.bookmarks.get(payload.browser_guid).catch(() => null);
      if (results && results.length > 0) bookmarkNode = results[0];
    }

    if (!bookmarkNode && (payload.url || payload.clean_url)) {
      const searchTarget = payload.url || payload.clean_url;
      const results = await api.bookmarks.search({ url: searchTarget });
      if (results && results.length > 0) bookmarkNode = results[0];
    }

    if (bookmarkNode) {
      const updateData = {};
      if (payload.title && payload.title !== bookmarkNode.title) updateData.title = payload.title;
      if (payload.url && payload.url !== bookmarkNode.url) updateData.url = payload.url;

      if (Object.keys(updateData).length > 0) {
        await api.bookmarks.update(bookmarkNode.id, updateData);
        console.log(`[BookVisor Bridge] Updated bookmark in browser: ${bookmarkNode.id}`);
      }

      if (payload.folder_path) {
        const targetFolderId = await ensureBrowserFolderExists(payload.folder_path);
        if (bookmarkNode.parentId !== targetFolderId) {
          await api.bookmarks.move(bookmarkNode.id, { parentId: targetFolderId });
          console.log(`[BookVisor Bridge] Relocated bookmark in browser: ${bookmarkNode.id} -> ${payload.folder_path}`);
        }
      }
    }
  } catch (err) {
    console.error("[BookVisor Bridge] Error updating bookmark from desktop:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 400);
  }
}

async function handleDesktopBookmarkMoved(payload) {
  if (!payload) return;

  isMutatingFromDesktop = true;
  try {
    let bookmarkNode = null;
    if (payload.browser_guid) {
      const results = await api.bookmarks.get(payload.browser_guid).catch(() => null);
      if (results && results.length > 0) bookmarkNode = results[0];
    }

    if (!bookmarkNode && payload.clean_url) {
      const results = await api.bookmarks.search({ url: payload.clean_url });
      if (results && results.length > 0) bookmarkNode = results[0];
    }

    if (bookmarkNode) {
      const targetFolderId = await ensureBrowserFolderExists(payload.target_folder_path || "");
      if (bookmarkNode.parentId !== targetFolderId) {
        await api.bookmarks.move(bookmarkNode.id, { parentId: targetFolderId });
        console.log(`[BookVisor Bridge] Moved bookmark in browser: ${bookmarkNode.id} -> folder ${targetFolderId}`);
      }
    }
  } catch (err) {
    console.error("[BookVisor Bridge] Error moving bookmark from desktop:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 400);
  }
}

async function handleDesktopBookmarkDeleted(payload) {
  if (!payload) return;

  isMutatingFromDesktop = true;
  try {
    let bookmarkNode = null;
    if (payload.browser_guid) {
      const results = await api.bookmarks.get(payload.browser_guid).catch(() => null);
      if (results && results.length > 0) bookmarkNode = results[0];
    }

    if (!bookmarkNode && payload.clean_url) {
      const results = await api.bookmarks.search({ url: payload.clean_url });
      if (results && results.length > 0) bookmarkNode = results[0];
    }

    if (bookmarkNode) {
      await api.bookmarks.remove(bookmarkNode.id);
      console.log(`[BookVisor Bridge] Deleted bookmark in browser: ${bookmarkNode.id}`);
    }
  } catch (err) {
    console.error("[BookVisor Bridge] Error deleting bookmark from desktop:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 400);
  }
}

async function handleDesktopFolderCreated(payload) {
  if (!payload || !payload.title) return;

  isMutatingFromDesktop = true;
  try {
    const parentFolderId = await ensureBrowserFolderExists(payload.parent_path || "");
    const children = await api.bookmarks.getChildren(parentFolderId);
    let existing = children.find((c) => !c.url && c.title.toLowerCase() === payload.title.toLowerCase());

    if (!existing) {
      existing = await api.bookmarks.create({
        parentId: parentFolderId,
        title: payload.title,
      });
      console.log(`[BookVisor Bridge] Created folder in browser: "${payload.title}" (ID: ${existing.id})`);
    }
  } catch (err) {
    console.error("[BookVisor Bridge] Error creating folder from desktop:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 400);
  }
}

async function handleDesktopFolderDeleted(payload) {
  if (!payload) return;

  isMutatingFromDesktop = true;
  try {
    if (payload.browser_guid) {
      await api.bookmarks.removeTree(payload.browser_guid).catch(() => {
        return api.bookmarks.remove(payload.browser_guid).catch(() => null);
      });
      console.log(`[BookVisor Bridge] Removed folder in browser: ${payload.browser_guid}`);
    }
  } catch (err) {
    console.error("[BookVisor Bridge] Error removing folder from desktop:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 400);
  }
}

// ── Smart Folder Resolver ───────────────────────────────────────────────────

const folderPathCache = {};

async function ensureBrowserFolderExists(path) {
  if (!path || !path.trim()) {
    return await getDefaultRootFolderId();
  }

  const cleanPath = path.trim();
  if (folderPathCache[cleanPath]) {
    return folderPathCache[cleanPath];
  }

  const segments = cleanPath.split(" / ").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) {
    return await getDefaultRootFolderId();
  }

  let currentParentId = await getDefaultRootFolderId();
  const tree = await api.bookmarks.getTree();
  const rootChildren = (tree[0] && tree[0].children) || [];

  // Check if first segment matches an existing browser native container
  const firstSegLower = segments[0].toLowerCase();
  const matchingRoot = rootChildren.find(
    (c) =>
      c.title.toLowerCase() === firstSegLower ||
      (firstSegLower.includes("toolbar") && (c.id === "toolbar_____" || c.id === "1")) ||
      (firstSegLower.includes("other") && (c.id === "unfiled_____" || c.id === "2")) ||
      (firstSegLower.includes("menu") && (c.id === "menu________" || c.id === "3"))
  );

  let remainingSegments = segments;
  if (matchingRoot) {
    currentParentId = matchingRoot.id;
    remainingSegments = segments.slice(1);
  }

  let accumulated = matchingRoot ? segments[0] : "";

  for (const seg of remainingSegments) {
    accumulated = accumulated ? `${accumulated} / ${seg}` : seg;

    if (folderPathCache[accumulated]) {
      currentParentId = folderPathCache[accumulated];
      continue;
    }

    const children = await api.bookmarks.getChildren(currentParentId);
    let found = children.find((c) => !c.url && c.title.toLowerCase() === seg.toLowerCase());

    if (!found) {
      found = await api.bookmarks.create({
        parentId: currentParentId,
        title: seg,
      });
      console.log(`[BookVisor Bridge] Created subfolder in browser: "${seg}"`);
    }

    folderPathCache[accumulated] = found.id;
    currentParentId = found.id;
  }

  folderPathCache[cleanPath] = currentParentId;
  return currentParentId;
}

async function getDefaultRootFolderId() {
  try {
    const tree = await api.bookmarks.getTree();
    const roots = (tree[0] && tree[0].children) || [];

    // Prefer Bookmarks Toolbar / Bookmarks Bar
    const toolbar = roots.find(
      (r) =>
        r.id === "toolbar_____" ||
        r.id === "1" ||
        r.title.toLowerCase().includes("toolbar") ||
        r.title.toLowerCase().includes("bar")
    );
    if (toolbar) return toolbar.id;

    // Fallback to Other Bookmarks / Unfiled
    const unfiled = roots.find(
      (r) =>
        r.id === "unfiled_____" ||
        r.id === "2" ||
        r.title.toLowerCase().includes("other") ||
        r.title.toLowerCase().includes("unfiled")
    );
    if (unfiled) return unfiled.id;

    if (roots.length > 0) return roots[0].id;
  } catch (_) {}

  return "1";
}

async function applyDesktopTreeMutations(moves) {
  isMutatingFromDesktop = true;
  console.log(`[BookVisor Bridge] Applying ${moves.length} moves from AI reorganization...`);

  try {
    for (const m of moves) {
      if (!m.target_folder_path || !m.clean_url) continue;

      const targetFolderId = await ensureBrowserFolderExists(m.target_folder_path);
      const matching = await api.bookmarks.search({ url: m.clean_url });

      if (matching && matching.length > 0) {
        for (const bm of matching) {
          if (bm.parentId !== targetFolderId) {
            await api.bookmarks.move(bm.id, { parentId: targetFolderId });
            console.log(`[BookVisor Bridge] Moved "${bm.title}" to ${m.target_folder_path}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[BookVisor Bridge] Error during tree mutations:", err);
  } finally {
    setTimeout(() => { isMutatingFromDesktop = false; }, 500);
  }
}

// Start connection
connectWebSocket();
