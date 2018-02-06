import { ipcMain, BrowserWindow, app, Menu, shell } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { Database } from 'sqlite3';

const db = new Database("./db.pmt.sqlite")
process.env.production = false;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow;

// Array of projects
let projects: any[] = [];
let selectedProject: any;
let deposits: any[] = [];

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 1100, height: 650 })
  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../index.html'),
    protocol: 'file:',
    slashes: true
  }))

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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
  const sql_main_table = 'CREATE TABLE IF NOT EXISTS project (id INTEGER PRIMARY KEY, name TEXT, description TEXT, to_give NUMBER NOT NULL)';
  const sql_deposit_table = 'CREATE TABLE IF NOT EXISTS deposit (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, value NUMBER, deposit_date DATE)';

  db.run(sql_main_table);
  db.run(sql_deposit_table);
}

// Catch project:add
ipcMain.on('project:add', (event: any, obj: any) => {
  db.run(
    "INSERT INTO project(name, description, to_give) VALUES (?, ?, ?)",
    [obj.name, obj.description, obj.value],
    fetchProjects(event)
  );
});

// Catch slideOut:open
ipcMain.on('slideOut:open', (event: any) => {
  fetchProjects(event);
})

// Catch project:selected
ipcMain.on('project:selected', (event: any, project: any) => {
  selectedProject = project;
  fetchProject(null, event);
});

// Catch deposit:add
ipcMain.on('deposit:add', (event: any, deposit: any) => {
  db.run(
    "INSERT INTO deposit(project_id, value, deposit_date) VALUES(?, ?, ?)",
    [selectedProject.id, deposit.value, deposit.date],
    (result: any, error: any) => fetchProject(error, event)
  );
});

function fetchProject(error: any, event: any) {

  if (error != null) { return; }
  let aProject: any = {};

  // Empty the array
  deposits.splice(0, deposits.length);

  if (selectedProject !== null) {
    db.each("SELECT * FROM deposit WHERE project_id = ?", [selectedProject.id], (error: any, row: any) => {
      row.deposit_date = new Date(row.deposit_date);
      deposits.push(row);
    }, (error: any, count: any) => {
      aProject.deposits = deposits;
      aProject.name = selectedProject.name;
      aProject.description = selectedProject.description;
      aProject.totalValue = selectedProject.to_give;
      event.sender.send("project:selected:fetched", aProject);
    });
  } else {
    event.sender.send("project:selected:fetched", null);
  }
}

ipcMain.on('btn:removeProject', (event: any) => {
  db.serialize(() => {
    db.parallelize(() => {
      db.run("DELETE FROM project WHERE id = ?", [selectedProject.id]),
        db.run("DELETE FROM deposit WHERE project_id = ?", [selectedProject.id]),
        refreshProjects(event)
    });
  })

});

function fetchProjects(event: any) {
  projects.splice(0, projects.length);

  db.each("SELECT * FROM project", [], (error, row) => {
    projects.push(row);
  }, (e, count) => {
    event.sender.send('projects:fetched', projects);
  });
}

function refreshProjects(event: any) {
  projects.forEach((project: any, index: number) => {
    if (project.id === selectedProject.id) {
      projects.splice(index, 1);
      if (projects.length > 0) {
        selectedProject = projects[0];
      } else {
        selectedProject = null;
      }
      fetchProject(null, event);
      return;
    }
  });
}

const template: any = [
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteandmatchstyle' },
      { role: 'delete' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  {
    role: 'window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click() { shell.openExternal('https://elsi.me/project-money-tracker') }
      }
    ]
  }
]

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services', submenu: [] },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  });

  // Edit menu
  template[1].submenu.push(
    { type: 'separator' },
    {
      label: 'Speech',
      submenu: [
        { role: 'startspeaking' },
        { role: 'stopspeaking' }
      ]
    }
  );

  if (process.env.production === true) {
    template[2].submenu.splice(2, 1);
  }

  // Window menu
  template[3].submenu = [
    { role: 'close' },
    { role: 'minimize' },
    { role: 'zoom' },
    { type: 'separator' },
    { role: 'front' }
  ]
}