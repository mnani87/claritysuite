// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

contextBridge.exposeInMainWorld("electronAPI", {
  /* ---- Open file ---- */
  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  /* ---- Save file ---- */
  saveFile: (content, defaultName, filters, targetPath) =>
    ipcRenderer.invoke("dialog:saveFile", {
      content,
      defaultName,
      filters,
      targetPath,
    }),

  /* ---- Minimal path helpers ---- */
  path: {
    basename: (p) => path.basename(p || ""),
  },
});
