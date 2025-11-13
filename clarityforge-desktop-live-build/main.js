// main.js - Electron Main Process
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs/promises"); // Use promises version for async/await

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    icon: path.join(__dirname, "icon.png"), // Optional: Add an icon
    webPreferences: {
      // Point the preload script to the file in the same directory
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Recommended security practice
      nodeIntegration: false, // Recommended security practice
    },
  });

  // Load the index.html file
  mainWindow.loadFile("index.html");

  // Optional: Open the DevTools
  // mainWindow.webContents.openDevTools();
}

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

// --- IPC Handlers for File I/O ---

// 1. Handle File Loading from disk
ipcMain.handle("dialog:openFile", async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "All Files", extensions: ["*"] },
      { name: "Text Files", extensions: ["txt", "md", "csv", "json", "log"] },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return null; // Cancelled
  }

  try {
    const data = await fs.readFile(filePaths[0], { encoding: "utf-8" });
    return data; // Return file content
  } catch (error) {
    console.error("Failed to read file:", error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// 2. Handle File Saving to disk
ipcMain.handle("dialog:saveFile", async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: "clarityforge_output.txt",
    filters: [
      { name: "Text File", extensions: ["txt"] },
      { name: "JSON File", extensions: ["json"] },
      { name: "CSV File", extensions: ["csv"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (canceled || !filePath) {
    return false; // Cancelled
  }

  try {
    await fs.writeFile(filePath, content, { encoding: "utf-8" });
    return true; // Success
  } catch (error) {
    console.error("Failed to write file:", error);
    throw new Error(`Failed to write file: ${error.message}`);
  }
});
