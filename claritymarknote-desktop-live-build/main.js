// main.js

const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const isMac = process.platform === "darwin";

let mainWindow;

// --- IPC HANDLERS (File System Logic) ---------------------------------------

/**
 * Shows native open file dialog and reads content.
 */
ipcMain.handle("dialog:openFile", async () => {
  const filters = [
    { name: "Markdown Notes", extensions: ["md", "txt", "html", "htm"] },
    { name: "All Files", extensions: ["*"] },
  ];

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: filters,
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, cancelled: true };
  }

  const filePath = filePaths[0];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { success: true, filePath, content };
  } catch (error) {
    console.error("Failed to read file:", error);
    return { success: false, cancelled: false, error: error.message };
  }
});

/**
 * Shows native save file dialog and writes content.
 */
ipcMain.handle(
  "dialog:saveFile",
  async (event, content, defaultName, filters, currentPath) => {
    let filePathToSave = currentPath;

    if (!filePathToSave) {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: filters,
      });

      if (canceled || !filePath) {
        return { success: false, cancelled: true };
      }
      filePathToSave = filePath;
    }

    try {
      fs.writeFileSync(filePathToSave, content, "utf-8");
      return { success: true, filePath: filePathToSave };
    } catch (error) {
      console.error("Failed to write file:", error);
      return { success: false, cancelled: false, error: error.message };
    }
  }
);

/**
 * Reads the content of a single file for the linking system.
 */
ipcMain.handle("fs:readFile", async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.warn(
      "Could not read file for backlinking:",
      filePath,
      error.message
    );
    return null;
  }
});

/**
 * Lists all files in a directory for the linking and searching system.
 */
ipcMain.handle("fs:listFiles", async (event, dirPath) => {
  if (!dirPath) return [];

  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    return files
      .filter((dirent) => dirent.isFile())
      .map((dirent) => ({
        name: dirent.name,
        fullPath: path.join(dirPath, dirent.name),
      }));
  } catch (error) {
    console.error("Failed to list directory contents:", dirPath, error);
    throw new Error("Directory list failed.");
  }
});

/**
 * Prints the current window content (HTML preview) to a PDF file.
 */
ipcMain.handle("window:printToPDF", async (event, options) => {
  const defaultPath = `${options.title}.pdf`;

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath,
    filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) {
    return { success: false, cancelled: true };
  }

  try {
    const data = await mainWindow.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      scale: 0.9, // Scale down slightly to ensure good margins
    });
    fs.writeFileSync(filePath, data);
    return { success: true, filePath };
  } catch (error) {
    console.error("PDF printing failed:", error);
    return { success: false, error: error.message };
  }
});

// --- ELECTRON WINDOW SETUP ----------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "ClarityMarknote v0.1",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load your index.html file
  mainWindow.loadFile("index.html");

  // Optional: Open DevTools for debugging
  // mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
