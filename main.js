const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
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
  Menu.setApplicationMenu(null);
  win.webContents.openDevTools();
  win.loadFile("drag-and-drop.html");
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  // 主线程-接收-打开文件
  ipcMain.on("open-file", () => {
    dialog
      .showOpenDialog({
        properties: ["openFile", "multiSelections", "openDirectory"],
      })
      .then((result) => {
        const os = require("os");
        const path = require("path");
        const { spawn } = require("child_process");
        const { Worker, isMainThread, workerData } = require("worker_threads");

        const input_folder = result.filePaths;
        const output_folder = result.filePaths;
        const watermark_file = "C:\\Users\\jia\\Desktop\\1.png";

        // 指定要使用的 GPU 加速器的名称
        const gpu_accelerator = "cuda";

        // 构造 FFmpeg 命令行
        function buildFFmpegCommand(inputFile, outputFile) {
          return `ffmpeg -hwaccel ${gpu_accelerator} -i "${inputFile}" -i "${watermark_file}" -filter_complex "[0:v][1:v]overlay=0:0" -c:a copy "${outputFile}"`;
        }

        // 定义一个处理视频的 Worker 线程
        function processVideoWorker({ inputFile, outputFile }) {
          const command = buildFFmpegCommand(inputFile, outputFile);
          spawn(command, { shell: true });
        }

        // 定义一个处理视频的函数
        function processVideo(inputFile) {
          // 构造输出文件的完整路径
          const relativePath = path.relative(input_folder, inputFile);
          const outputFile = path.join(output_folder, relativePath);
          // 确保输出文件的目录存在，如果不存在则创建
          const outputDir = path.dirname(outputFile);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          // 提交视频处理任务到 Worker 线程
          const worker = new Worker(processVideoWorker, {
            workerData: { inputFile, outputFile },
          });
        }

        // 主线程
        if (isMainThread) {
          const cpus = os.cpus().length;
          const threads = cpus < 4 ? cpus : 4; // 最多创建 4 个 Worker 线程

          // 遍历目录树，查找所有的 mp4 文件
          const fileList = [];
          for (const root of [
            input_folder,
            ...fs
              .readdirSync(input_folder, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => path.join(input_folder, d.name)),
          ]) {
            for (const file of fs.readdirSync(root)) {
              if (file.endsWith(".mp4")) {
                const inputFile = path.join(root, file);
                fileList.push(inputFile);
              }
            }
          }

          // 启动多个 Worker 线程进行视频处理
          const workerPool = new Set();
          for (let i = 0; i < threads; i++) {
            const worker = new Worker(__filename);
            workerPool.add(worker);
            worker.on("exit", () => {
              workerPool.delete(worker);
              if (workerPool.size === 0) {
                console.log("All workers have completed.");
              }
            });
          }
          for (const inputFile of fileList) {
            const worker = [...workerPool][0];
            worker.postMessage({ inputFile });
            workerPool.delete(worker);
            workerPool.add(worker);
          }
        } else {
          processVideo(workerData.inputFile);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  });
});
