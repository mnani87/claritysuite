// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  selectFolder: () => ipcRenderer.invoke("select-folder"),

  listFiles: (folderPath) => ipcRenderer.invoke("list-files", folderPath),

  readFile: (fullPath) => ipcRenderer.invoke("read-file", fullPath),

  writeFile: (fullPath, content) =>
    ipcRenderer.invoke("write-file", { fullPath, content }),

  saveDialog: (defaultName) => ipcRenderer.invoke("save-dialog", defaultName),

  printToPDF: (payload) => ipcRenderer.invoke("print-to-pdf", payload),
});
