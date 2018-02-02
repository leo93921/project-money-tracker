const electron = require('electron')
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database("./db.pmt.sqlite")
// Module to control application life.
const app = electron.app
const { ipcMain } = electron;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

// Array of projects
let projects = [];
let selectedProject;
let deposits = [];

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 1000, height: 600 })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

function init() {
  createWindow();
  createTables();
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
function createTables() {
  // No error: create table
  sql_main_table = 'CREATE TABLE IF NOT EXISTS project (id INTEGER PRIMARY KEY, name TEXT, description TEXT)';
  sql_deposit_table = 'CREATE TABLE IF NOT EXISTS deposit (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, value NUMBER, deposit_date DATE)';

  db.run(sql_main_table);
  db.run(sql_deposit_table);
}

// Catch project:add
ipcMain.on('project:add', (event, obj) => {
  db.run("INSERT INTO project(name, description) VALUES (?, ?)", [obj.name, obj.description]);
});

// Catch slideOut:open
ipcMain.on('slideOut:open', (event) => {

  projects.splice(0, projects.length);

  db.each("SELECT * FROM project", [], (error, row) => {
    projects.push(row);
  }, (e, count) => {
    if (count > 0) {
      event.sender.send('projects:fetched', projects);
    }
  });
})

// Catch project:selected
ipcMain.on('project:selected', (event, project) => {
  selectedProject = project;
  fetchProject(event);
});

// Catch deposit:add
ipcMain.on('deposit:add', (event, deposit) => {
  db.run(
    "INSERT INTO deposit(project_id, value, deposit_date) VALUES(?, ?, ?)",
    [selectedProject.id, deposit.value, deposit.date],
    fetchProject(event)
  );
});

function fetchProject(event) {
  let aProject = {};

  // Empty the array
  deposits.splice(0, deposits.length);

  db.each("SELECT * FROM deposit WHERE project_id = ?", [selectedProject.id], (error, row) => {
    row.deposit_date = new Date(row.deposit_date);
    deposits.push(row);
  }, (error, count) => {
    aProject.deposits = deposits;
    aProject.name = selectedProject.name;
    aProject.description = selectedProject.description;
    
    event.sender.send("project:selected:fetched", aProject);
  });
}