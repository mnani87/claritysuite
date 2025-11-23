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
  let changed = false;

  try {
    if (fs.existsSync(projectsFile)) {
      const raw = await fs.promises.readFile(projectsFile, "utf8");
      data = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error loading projects.json:", e);
    data = {};
  }

  const nowIso = new Date().toISOString();

  // Normalisation Logic
  Object.entries(data).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      data[name] = {
        meta: {
          type: "general",
          description: "",
          created_at: nowIso,
          updated_at: nowIso,
        },
        files: value,
      };
      changed = true;
    } else if (value && typeof value === "object") {
      if (!value.meta) {
        value.meta = {
          type: "general",
          description: "",
          created_at: nowIso,
          updated_at: nowIso,
        };
        changed = true;
      }
      if (!Array.isArray(value.files)) {
        value.files = [];
        changed = true;
      }
    } else {
      data[name] = {
        meta: {
          type: "general",
          description: "",
          created_at: nowIso,
          updated_at: nowIso,
        },
        files: [],
      };
      changed = true;
    }
  });

  if (changed) {
    try {
      await fs.promises.writeFile(
        projectsFile,
        JSON.stringify(data, null, 2),
        "utf8"
      );
    } catch (e) {
      console.error("Error normalising projects.json:", e);
    }
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 800,
    title: "Clarity Explorer",
    webPreferences: {
      sandbox: false, // <--- FIX: Allows preload to use 'path' module
      nodeIntegration: false, // SECURITY: Keep Node out of Renderer
      contextIsolation: true, // SECURITY: Protect Window scope
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Note: We point to src/index.html
  win.loadFile(path.join(__dirname, "src", "index.html"));
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

ipcMain.handle("file:exists", (_e, filePath) => {
  return fs.existsSync(filePath);
});

// Async File Reading
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

// Migration Handler (Fixes data loss on moving files)
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

// Exports
ipcMain.handle("export:file-notes", async (_e, filePath) => {
  const projects = await loadProjects();
  const hash = getHash(filePath);
  const annotations = hash ? await loadAnnotations(hash) : {};
  const notes = annotations.notes || "";

  // find tags
  let tags = [];
  for (const [, proj] of Object.entries(projects)) {
    const files = proj.files || [];
    for (const f of files) {
      if (f.file_path === filePath) {
        tags = f.tags || [];
        break;
      }
    }
  }

  const base = path.basename(filePath);
  let md = `# Notes for ${base}\n\n`;
  md += `**File path:** \`${filePath}\`\n\n`;
  if (tags.length)
    md += `**Tags:** ${tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
  md += `---\n\n`;
  md += notes ? notes + "\n" : "_No notes yet._\n";

  const saveResult = await dialog.showSaveDialog({
    title: "Export notes for this file",
    defaultPath: `${base}-notes.md`,
    filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, canceled: true };
  }

  await fs.promises.writeFile(saveResult.filePath, md, "utf8");
  return { ok: true, savedPath: saveResult.filePath };
});

ipcMain.handle("export:project-notes", async (_e, projectName) => {
  const projects = await loadProjects();
  const proj = projects[projectName] || { meta: {}, files: [] };
  const projectFiles = proj.files || [];

  let md = `# Notes for project: ${projectName}\n\n`;
  const meta = proj.meta || {};
  if (meta.type || meta.description) {
    md += `**Type:** ${meta.type || "general"}\n\n`;
    if (meta.description) md += `${meta.description}\n\n`;
    md += `---\n\n`;
  }

  if (projectFiles.length === 0) {
    md += "_This project has no files._\n";
  } else {
    for (const f of projectFiles) {
      const base = path.basename(f.file_path);
      const hash = getHash(f.file_path);
      const annotations = hash ? await loadAnnotations(hash) : {};
      const notes = annotations.notes || "";
      const tags = f.tags || [];

      md += `## ${base}\n\n`;
      md += `**Path:** \`${f.file_path}\`\n\n`;
      if (tags.length)
        md += `**Tags:** ${tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
      if (notes.trim()) {
        md += notes.trim() + "\n\n";
      } else {
        md += "_No notes for this file._\n\n";
      }
      md += `---\n\n`;
    }
  }

  const saveResult = await dialog.showSaveDialog({
    title: "Export notes for this project",
    defaultPath: `${projectName}-notes.md`,
    filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, canceled: true };
  }

  await fs.promises.writeFile(saveResult.filePath, md, "utf8");
  return { ok: true, savedPath: saveResult.filePath };
});
