// main.js - Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

// Enable autostart on Linux
if (process.platform === 'linux') {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: ['--no-sandbox']
  });
}

let mainWindow;
let jiraConfig = {
  domain: '',
  email: '',
  apiToken: '',
  boardId: ''
};

// Path to store configuration
const configPath = path.join(app.getPath('userData'), 'config.json');

// Load saved configuration
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      jiraConfig = JSON.parse(data);
      console.log('Configuration loaded successfully');
      return true;
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return false;
}

// Save configuration
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('Configuration saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // Optional: Open DevTools for debugging
  // mainWindow.webContents.openDevTools();

  // Load config when window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (loadConfig()) {
      // Send saved config to renderer
      mainWindow.webContents.send('config-loaded', jiraConfig);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle configuration from renderer
ipcMain.handle('save-config', async (event, config) => {
  jiraConfig = config;
  saveConfig(config);
  return { success: true };
});

// Get saved configuration
ipcMain.handle('get-config', async () => {
  return jiraConfig;
});

// Logout - delete credentials
ipcMain.handle('logout', async () => {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log('Configuration deleted successfully');
    }
    jiraConfig = {
      domain: '',
      email: '',
      apiToken: '',
      boardId: ''
    };
    return { success: true };
  } catch (error) {
    console.error('Error deleting config:', error);
    return { success: false, error: error.message };
  }
});

// Fetch Jira tasks
ipcMain.handle('fetch-tasks', async () => {
  if (!jiraConfig.domain || !jiraConfig.email || !jiraConfig.apiToken || !jiraConfig.boardId) {
    return { error: 'Configuration not set' };
  }

  try {
    const auth = Buffer.from(`${jiraConfig.email}:${jiraConfig.apiToken}`).toString('base64');
    
    // First, get the current user's account ID
    const userResponse = await axios.get(
      `https://${jiraConfig.domain}/rest/api/3/myself`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );
    
    const currentUserAccountId = userResponse.data.accountId;

    // Fetch issues from the board assigned to current user and not in Done status
    const response = await axios.get(
      `https://${jiraConfig.domain}/rest/agile/1.0/board/${jiraConfig.boardId}/issue`,
      {
        params: {
          jql: `assignee = currentUser() AND status != Done AND status != Closed`,
          maxResults: 100,
          fields: 'summary,status,priority,assignee,description'
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    const tasks = response.data.issues.map(issue => ({
      key: issue.key,
      title: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority ? issue.fields.priority.name : 'None',
      assignee: issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned',
      description: issue.fields.description || 'No description',
      url: `https://${jiraConfig.domain}/browse/${issue.key}`
    }));

    return { tasks };
  } catch (error) {
    console.error('Error fetching tasks:', error.response?.data || error.message);
    return { error: error.response?.data?.errorMessages?.[0] || error.message };
  }
});

// Handle window controls
ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('close-window', () => {
  mainWindow.close();
});