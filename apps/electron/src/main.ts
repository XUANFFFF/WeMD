import { app, BrowserWindow } from "electron";
import { createMenu } from "./menu";
import { registerIpcHandlers } from "./ipc";
import { checkForUpdates } from "./updater";
import { configureAppIdentity, createWindow } from "./window";
import { stopWatching } from "./watch/workspaceWatcher";

const isDev =
  !app.isPackaged ||
  process.argv.includes("--dev") ||
  !!process.env.ELECTRON_START_URL;

configureAppIdentity();

let mainWindow: BrowserWindow | null = null;

const getMainWindow = () => mainWindow;

registerIpcHandlers(getMainWindow);

function openMainWindow(): void {
  mainWindow = createWindow({
    isDev,
    onClosed: () => {
      mainWindow = null;
      stopWatching();
    },
  });
}

app.whenReady().then(() => {
  openMainWindow();
  createMenu(getMainWindow);

  setTimeout(() => {
    checkForUpdates(mainWindow);
  }, 3000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
