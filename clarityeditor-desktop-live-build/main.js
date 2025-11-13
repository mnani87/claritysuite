// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    icon: path.join(__dirname, "icon.png"), // uses your 512x512 icon
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Optional: remove menu for a cleaner look
  mainWindow.setMenuBarVisibility(false);
}

/* ------------ IPC: OPEN FILE ------------ */
ipcMain.handle("dialog:openFile", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Open file",
      properties: ["openFile"],
      filters: [
        {
          name: "Text / HTML / Markdown",
          extensions: ["txt", "md", "html", "htm"],
        },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, "utf8");

    return {
      success: true,
      cancelled: false,
      filePath,
      content,
    };
  } catch (err) {
    return {
      success: false,
      cancelled: false,
      error: err.message || String(err),
    };
  }
});

/* ------------ IPC: SAVE FILE ------------ */
// args: { content, defaultName, filters, targetPath }
ipcMain.handle("dialog:saveFile", async (_event, args) => {
  const { content, defaultName, filters, targetPath } = args || {};

  try {
    let filePath = targetPath || null;

    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: "Save file",
        defaultPath: defaultName || "document.txt",
        filters:
          filters && filters.length
            ? filters
            : [{ name: "All Files", extensions: ["*"] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }

      filePath = result.filePath;
    }

    fs.writeFileSync(filePath, content ?? "", "utf8");

    return {
      success: true,
      cancelled: false,
      filePath,
    };
  } catch (err) {
    return {
      success: false,
      cancelled: false,
      error: err.message || String(err),
    };
  }
});

/* ------------ APP LIFECYCLE ------------ */
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
