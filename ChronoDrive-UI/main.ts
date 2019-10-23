import { app, BrowserWindow, screen } from 'electron';
const { ipcMain } = require('electron');
const fs = require('fs');
import * as path from 'path';
import * as url from 'url';
import { Stats, Dirent } from 'fs';

let win, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');
const USER_DATA_DIR = './AppData';

class DirectoryInfo {
  entry: Dirent;
  stats: Stats;
  entries: DirectoryInfo[];
}

function createWindow() {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width / 3,
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

  // if (serve) {
  win.webContents.openDevTools();
  // }

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
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR);
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
    console.log('holy cow we got a login event', msg);
    // TODO: Handle login event, grab user's directory information and return it to the front end

    // Ensure that the directory for this specific user has been initialized
    const userDirPath = `${USER_DATA_DIR}/${msg.user}`;
    if (!fs.existsSync(userDirPath)) {
      fs.mkdirSync(userDirPath);
    }
    const files: DirectoryInfo = getDirInfo(userDirPath);
    evt.reply('directory-update', files);
    console.log(files);
  });

} catch (e) {
  // Catch Error
  // throw e;
  console.log(e);
}

function getDirInfo(dirPath, dirEntry = null): DirectoryInfo {
  const entries = fs.readdirSync(dirPath, { encoding: 'utf8', withFileTypes: true });
  console.log(dirPath, entries);
  const dir = {
    entry: dirEntry,
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
        stats: fs.statSync(entPath),
        entries: null
      }
    }
    dir.entries.push(ent);
  }
  return dir;
}