const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const dataDir = path.join(app.getPath("userData"));
const annotationsDir = path.join(dataDir, "annotations");
const projectsFile = path.join(dataDir, "projects.json");

if (!fs.existsSync(annotationsDir))
  fs.mkdirSync(annotationsDir, { recursive: true });

// -------- Helpers --------

function getHash(filePath) {
  try {
    const buff = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buff).digest("hex");
  } catch {
    return null;
  }
}

function loadProjects() {
  try {
    if (fs.existsSync(projectsFile)) {
      return JSON.parse(fs.readFileSync(projectsFile, "utf8"));
    }
  } catch (e) {
    console.error("Error loading projects.json:", e);
  }
  return {};
}

function saveProjects(projects) {
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), "utf8");
}

function loadAnnotations(hash) {
  const file = path.join(annotationsDir, `${hash}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function saveAnnotations(hash, data) {
  const file = path.join(annotationsDir, `${hash}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// -------- Window --------

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 800,
    title: "Clarity Explorer",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(createWindow);

// -------- IPC: Projects, Files, DOCX, Annotations --------

ipcMain.handle("projects:load", () => loadProjects());

ipcMain.handle("projects:save", (_e, projects) => {
  saveProjects(projects);
  return true;
});

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

ipcMain.handle("file:read-text", (_e, filePath) => {
  try {
    const contents = fs.readFileSync(filePath, "utf8");
    return { ok: true, contents };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// DOCX -> HTML via Mammoth
ipcMain.handle("file:read-docx", async (_e, filePath) => {
  try {
    const mammoth = require("mammoth");
    const buff = fs.readFileSync(filePath);
    const { value } = await mammoth.convertToHtml({ buffer: buff });
    return { ok: true, html: value };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Annotations (notes + future highlights)
ipcMain.handle("annot:get-hash", (_e, filePath) => getHash(filePath));
ipcMain.handle("annot:load", (_e, hash) => loadAnnotations(hash));
ipcMain.handle("annot:save", (_e, hash, data) => saveAnnotations(hash, data));

// -------- IPC: Export Notes --------

// Export notes for a single file
ipcMain.handle("export:file-notes", async (_e, filePath) => {
  const projects = loadProjects();
  const hash = getHash(filePath);
  const annotations = hash ? loadAnnotations(hash) : {};
  const notes = annotations.notes || "";

  // find tags for this file
  let tags = [];
  for (const [projName, files] of Object.entries(projects)) {
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

  fs.writeFileSync(saveResult.filePath, md, "utf8");
  return { ok: true, savedPath: saveResult.filePath };
});

// Export notes for an entire project
ipcMain.handle("export:project-notes", async (_e, projectName) => {
  const projects = loadProjects();
  const projectFiles = projects[projectName] || [];

  let md = `# Notes for project: ${projectName}\n\n`;
  if (projectFiles.length === 0) {
    md += "_This project has no files._\n";
  } else {
    for (const f of projectFiles) {
      const base = path.basename(f.file_path);
      const hash = getHash(f.file_path);
      const annotations = hash ? loadAnnotations(hash) : {};
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

  fs.writeFileSync(saveResult.filePath, md, "utf8");
  return { ok: true, savedPath: saveResult.filePath };
});
