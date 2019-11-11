import { app, BrowserWindow, screen } from 'electron';
const { ipcMain } = require('electron');
const fs = require('fs');
var watch = require('node-watch');
import * as path from 'path';
import * as url from 'url';
import { FileInfo } from './src/app/types/DirectoryInfo';

let win, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');
const APP_DATA_DIR = './AppData';
let USER_DATA_DIR = APP_DATA_DIR;

function createWindow() {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width / 2,
    height: size.height / 2,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  if (serve) {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    win.loadURL('http://localhost:4200');
  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  if (serve) {
    win.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

}

try {

  // Ensure that a directory for the users' data has been initialized
  if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR);
  }

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', createWindow);

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

  ipcMain.on('login', (evt, msg) => {
    // Ensure that the directory for this specific user has been initialized
    USER_DATA_DIR = `${APP_DATA_DIR}/${msg.user}`;
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR);
    }
    const files: FileInfo = getDirInfo(USER_DATA_DIR);
    evt.reply('directory-update', files);
    // Watch the data directory and push changes to the UI
    let fsWait = false;
    watch(`${USER_DATA_DIR}`, { recursive: true }, (event, filename) => {
      if (filename) {
        if (fsWait) return;
        setTimeout(() => {
          fsWait = false;
        }, 100);

        const files: FileInfo = getDirInfo(USER_DATA_DIR);
        win.webContents.send('directory-update', files);
      }
    });
  });



} catch (e) {
  // Catch Error
  // throw e;
  console.log(e);
}

function getDirInfo(dirPath, dirEntry = null): FileInfo {
  const entries = fs.readdirSync(dirPath, { encoding: 'utf8', withFileTypes: true });
  const dir = {
    entry: dirEntry,
    isDirectory: fs.statSync(dirPath).isDirectory(),
    path: dirPath,
    stats: fs.statSync(dirPath),
    entries: []
  }
  for (const entry of entries) {
    let ent = null
    const entPath = `${dirPath}/${entry.name}`
    if (entry.isDirectory()) {
      ent = getDirInfo(entPath, entry);
    } else {
      ent = {
        entry: entry,
        isDirectory: false,
        path: entPath,
        stats: fs.statSync(entPath),
        entries: null
      }
    }
    dir.entries.push(ent);
  }
  return dir;
}