const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const url = require("url");

if (process.env.NODE_ENV === "development") {
  require("electron-reload")(path.join(__dirname, "path/to/your/app"), {
    electron: require(path.join(__dirname, "node_modules/electron")),
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  // 加载文件拖入框的 HTML 页面
  // 移除菜单栏
  Menu.setApplicationMenu(null);
//   win.loadFile("index.html");
  win.webContents.openDevTools();
  win.loadFile("drag-and-drop.html");
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
