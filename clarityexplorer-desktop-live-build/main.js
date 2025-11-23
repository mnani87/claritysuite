const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const dataDir = path.join(app.getPath("userData"));
const annotationsDir = path.join(dataDir, "annotations");
const projectsFile = path.join(dataDir, "projects.json");

// Ensure directories exist
if (!fs.existsSync(annotationsDir))
  fs.mkdirSync(annotationsDir, { recursive: true });

// -------- Helpers --------

function getHash(filePath) {
  try {
    return crypto.createHash("sha256").update(filePath, "utf8").digest("hex");
  } catch {
    return null;
  }
}

async function loadProjects() {
  let data = {};
  try {
    if (fs.existsSync(projectsFile)) {
      const raw = await fs.promises.readFile(projectsFile, "utf8");
      data = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error loading projects:", e);
    data = {};
  }
  return data;
}

async function saveProjects(projects) {
  try {
    await fs.promises.writeFile(
      projectsFile,
      JSON.stringify(projects, null, 2),
      "utf8"
    );
    return true;
  } catch (e) {
    console.error("Error saving projects:", e);
    return false;
  }
}

async function loadAnnotations(hash) {
  const file = path.join(annotationsDir, `${hash}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    const raw = await fs.promises.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveAnnotations(hash, data) {
  const file = path.join(annotationsDir, `${hash}.json`);
  try {
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Error saving annotation:", e);
    return false;
  }
}

// -------- Window --------

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "Clarity Explorer",
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      plugins: true, // Required for PDF Viewer
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  // Listen for PDF Find results
  mainWindow.webContents.on("found-in-page", (event, result) => {
    mainWindow.webContents.send("found-in-page-result", {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
    });
  });
}

app.whenReady().then(createWindow);

// -------- IPC HANDLERS --------

// Projects
ipcMain.handle("projects:load", () => loadProjects());
ipcMain.handle("projects:save", (_e, projects) => saveProjects(projects));

// Files
ipcMain.handle("dialog:pick-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("file:open-default", (_e, filePath) => {
  if (!fs.existsSync(filePath)) return { ok: false };
  shell.openPath(filePath);
  return { ok: true };
});

ipcMain.handle("file:exists", (_e, filePath) => fs.existsSync(filePath));

ipcMain.handle("file:read-text", async (_e, filePath) => {
  try {
    const contents = await fs.promises.readFile(filePath, "utf8");
    return { ok: true, contents };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("file:read-docx", async (_e, filePath) => {
  try {
    const mammoth = require("mammoth");
    const buff = await fs.promises.readFile(filePath);
    const { value } = await mammoth.convertToHtml({ buffer: buff });
    return { ok: true, html: value };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Annotations
ipcMain.handle("annot:get-hash", (_e, filePath) => getHash(filePath));
ipcMain.handle("annot:load", (_e, hash) => loadAnnotations(hash));
ipcMain.handle("annot:save", (_e, hash, data) => saveAnnotations(hash, data));

ipcMain.handle("annot:migrate", async (_e, oldPath, newPath) => {
  const oldHash = getHash(oldPath);
  const newHash = getHash(newPath);
  const oldFile = path.join(annotationsDir, `${oldHash}.json`);
  const newFile = path.join(annotationsDir, `${newHash}.json`);

  if (fs.existsSync(oldFile)) {
    try {
      await fs.promises.rename(oldFile, newFile);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: true, status: "no-notes-found" };
});

// Search Handlers (PDF / Native)
ipcMain.handle("find:start", (_e, text) => {
  if (mainWindow) mainWindow.webContents.findInPage(text, { findNext: true });
});
ipcMain.handle("find:stop", (_e) => {
  if (mainWindow) mainWindow.webContents.stopFindInPage("clearSelection");
});
ipcMain.handle("find:next", (_e, text, forward) => {
  if (mainWindow)
    mainWindow.webContents.findInPage(text, { findNext: true, forward });
});

// Deep Content Search
ipcMain.handle("project:search-text", async (_e, filePaths, query) => {
  const results = [];
  const q = query.toLowerCase();
  const snippetLength = 60;

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const ext = path.extname(filePath).toLowerCase();
    let content = "";

    try {
      if (ext === ".docx") {
        const mammoth = require("mammoth");
        const buffer = await fs.promises.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: buffer });
        content = result.value;
      } else if (
        [
          ".txt",
          ".md",
          ".html",
          ".htm",
          ".json",
          ".js",
          ".css",
          ".csv",
        ].includes(ext)
      ) {
        content = await fs.promises.readFile(filePath, "utf8");
      } else {
        continue;
      }

      const lowerContent = content.toLowerCase();
      const idx = lowerContent.indexOf(q);

      if (idx !== -1) {
        const start = Math.max(0, idx - snippetLength);
        const end = Math.min(content.length, idx + q.length + snippetLength);
        let snippet = content.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < content.length) snippet = snippet + "...";

        results.push({ file_path: filePath, snippet: snippet });
      }
    } catch (e) {
      console.error(`Error searching file ${filePath}:`, e);
    }
  }
  return results;
});

// Exports
ipcMain.handle("export:file-notes", async (_e, filePath) => {
  const projects = await loadProjects();
  const hash = getHash(filePath);
  const annotations = hash ? await loadAnnotations(hash) : {};
  const notes = annotations.notes || "";

  let tags = [];
  for (const [, proj] of Object.entries(projects)) {
    const f = (proj.files || []).find((x) => x.file_path === filePath);
    if (f) tags = f.tags || [];
  }

  const base = path.basename(filePath);
  let md = `# Notes for ${base}\n\n**File:** \`${filePath}\`\n\n`;
  if (tags.length)
    md += `**Tags:** ${tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
  md += `---\n\n${notes || "_No notes yet._"}\n`;

  const saveResult = await dialog.showSaveDialog({
    title: "Export notes",
    defaultPath: `${base}-notes.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  if (saveResult.canceled || !saveResult.filePath) return { ok: false };
  await fs.promises.writeFile(saveResult.filePath, md, "utf8");
  return { ok: true, savedPath: saveResult.filePath };
});

ipcMain.handle("export:project-notes", async (_e, projectName) => {
  const projects = await loadProjects();
  const proj = projects[projectName] || { meta: {}, files: [] };

  let md = `# Project: ${projectName}\n\n`;
  if (proj.meta.description) md += `${proj.meta.description}\n\n`;
  md += `---\n\n`;

  for (const f of proj.files) {
    const base = path.basename(f.file_path);
    const hash = getHash(f.file_path);
    const notes = hash ? (await loadAnnotations(hash)).notes || "" : "";
    md += `## ${base}\n\n${notes || "_No notes._"}\n\n---\n\n`;
  }

  const saveResult = await dialog.showSaveDialog({
    title: "Export Project Notes",
    defaultPath: `${projectName}-notes.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  if (saveResult.canceled || !saveResult.filePath) return { ok: false };
  await fs.promises.writeFile(saveResult.filePath, md, "utf8");
  return { ok: true, savedPath: saveResult.filePath };
});
