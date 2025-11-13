// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  await mainWindow.loadFile("app.html");

  // mainWindow.webContents.openDevTools(); // optional
}

/* IPC HANDLERS */

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return null;
  }
  const folderPath = result.filePaths[0];
  return {
    path: folderPath,
    name: path.basename(folderPath),
  };
});

ipcMain.handle("list-files", async (_event, folderPath) => {
  if (!folderPath) return [];
  try {
    const entries = await fs.readdir(folderPath, {
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isFile())
      .map((e) => ({
        name: e.name,
        fullPath: path.join(folderPath, e.name),
      }));
  } catch (e) {
    console.error("list-files error:", e);
    return [];
  }
});

ipcMain.handle("read-file", async (_event, fullPath) => {
  if (!fullPath) return null;
  try {
    const data = await fs.readFile(fullPath, "utf8");
    return data;
  } catch (e) {
    console.error("read-file error:", e);
    return null;
  }
});

ipcMain.handle("write-file", async (_event, payload) => {
  try {
    const { fullPath, content } = payload || {};
    if (!fullPath) return false;
    await fs.writeFile(fullPath, content ?? "", "utf8");
    return true;
  } catch (e) {
    console.error("write-file error:", e);
    return false;
  }
});

ipcMain.handle("save-dialog", async (_event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save note",
    defaultPath: defaultName || "notes.md",
    filters: [
      { name: "Markdown", extensions: ["md"] },
      { name: "Text", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle("print-to-pdf", async (_event, payload) => {
  try {
    const { html, title } = payload || {};
    if (!html) return null;

    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    const safeTitle =
      typeof title === "string" && title.trim()
        ? title.trim()
        : "ClarityHub note";

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safeTitle}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                system-ui, sans-serif;
              padding: 32px;
              margin: 0;
              color: #222;
            }
            h1, h2, h3, h4, h5, h6 {
              font-weight: 600;
            }
            pre, code {
              font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
                "Courier New", monospace;
              font-size: 0.9rem;
            }
            pre {
              background: #f5f5f5;
              padding: 12px;
              border-radius: 6px;
              overflow-x: auto;
            }
            blockquote {
              margin: 0 0 1em;
              padding-left: 1em;
              border-left: 3px solid #ccc;
              color: #555;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    await pdfWindow.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(fullHtml)
    );

    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      marginsType: 1,
      pageSize: "A4",
    });

    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: "Export note as PDF",
      defaultPath: safeTitle.replace(/[\\/:*?"<>|]+/g, "_") + ".pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    pdfWindow.destroy();

    if (canceled || !filePath) return null;

    await fs.writeFile(filePath, pdfData);
    return filePath;
  } catch (err) {
    console.error("print-to-pdf error:", err);
    return null;
  }
});

/* APP LIFECYCLE */

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
