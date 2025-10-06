// main.js - Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow;
let jiraConfig = {
  domain: '', // e.g., 'yourcompany.atlassian.net'
  email: '',
  apiToken: '',
  boardId: ''
};

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
  return { success: true };
});

// Fetch Jira tasks
ipcMain.handle('fetch-tasks', async () => {
  if (!jiraConfig.domain || !jiraConfig.email || !jiraConfig.apiToken || !jiraConfig.boardId) {
    return { error: 'Configuration not set' };
  }

  try {
    const auth = Buffer.from(`${jiraConfig.email}:${jiraConfig.apiToken}`).toString('base64');
    
    // Get board configuration to find column mappings
    const boardConfig = await axios.get(
      `https://${jiraConfig.domain}/rest/agile/1.0/board/${jiraConfig.boardId}/configuration`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    // Fetch issues from the board
    const response = await axios.get(
      `https://${jiraConfig.domain}/rest/agile/1.0/board/${jiraConfig.boardId}/issue`,
      {
        params: {
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