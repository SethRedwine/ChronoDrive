"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
var ipcMain = require('electron').ipcMain;
var fs = require('fs');
var path = require("path");
var url = require("url");
var win, serve;
var args = process.argv.slice(1);
serve = args.some(function (val) { return val === '--serve'; });
var USER_DATA_DIR = './AppData';
var DirectoryInfo = /** @class */ (function () {
    function DirectoryInfo() {
    }
    return DirectoryInfo;
}());
function createWindow() {
    var electronScreen = electron_1.screen;
    var size = electronScreen.getPrimaryDisplay().workAreaSize;
    // Create the browser window.
    win = new electron_1.BrowserWindow({
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
            electron: require(__dirname + "/node_modules/electron")
        });
        win.loadURL('http://localhost:4200');
    }
    else {
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
    win.on('closed', function () {
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
    electron_1.app.on('ready', createWindow);
    // Quit when all windows are closed.
    electron_1.app.on('window-all-closed', function () {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    electron_1.app.on('activate', function () {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (win === null) {
            createWindow();
        }
    });
    ipcMain.on('login', function (evt, msg) {
        console.log('holy cow we got a login event', msg);
        // TODO: Handle login event, grab user's directory information and return it to the front end
        // Ensure that the directory for this specific user has been initialized
        var userDirPath = USER_DATA_DIR + "/" + msg.user;
        if (!fs.existsSync(userDirPath)) {
            fs.mkdirSync(userDirPath);
        }
        var files = getDirInfo(userDirPath);
        evt.reply('directory-update', files);
        console.log(files);
    });
}
catch (e) {
    // Catch Error
    // throw e;
    console.log(e);
}
function getDirInfo(dirPath, dirEntry) {
    if (dirEntry === void 0) { dirEntry = null; }
    var entries = fs.readdirSync(dirPath, { encoding: 'utf8', withFileTypes: true });
    console.log(dirPath, entries);
    var dir = {
        entry: dirEntry,
        isDirectory: fs.statSync(dirPath).isDirectory(),
        path: dirPath,
        stats: fs.statSync(dirPath),
        entries: []
    };
    for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
        var entry = entries_1[_i];
        var ent = null;
        var entPath = dirPath + "/" + entry.name;
        if (entry.isDirectory()) {
            ent = getDirInfo(entPath, entry);
        }
        else {
            ent = {
                entry: entry,
                isDirectory: false,
                path: entPath,
                stats: fs.statSync(entPath),
                entries: null
            };
        }
        dir.entries.push(ent);
    }
    return dir;
}
//# sourceMappingURL=main.js.map