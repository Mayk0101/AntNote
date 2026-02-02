import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (defaultName: string) => ipcRenderer.invoke('save-file-dialog', defaultName),
  getFileStats: (filePath: string) => ipcRenderer.invoke('get-file-stats', filePath),
  readDirRecursive: (dirPath: string) => ipcRenderer.invoke('read-dir-recursive', dirPath),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  duplicateFile: (filePath: string) => ipcRenderer.invoke('duplicate-file', filePath),

  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  setAppSettings: (settings: any) => ipcRenderer.invoke('set-app-settings', settings),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  runCommand: (command: string, cwd: string) => ipcRenderer.invoke('run-command', command, cwd),
  runCommandStream: (command: string, cwd: string) => ipcRenderer.invoke('run-command-stream', command, cwd),
  killProcess: (processId: number) => ipcRenderer.invoke('kill-process', processId),

  onTerminalOutput: (callback: (data: { processId: number, data: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('terminal-output', subscription);
    return () => ipcRenderer.removeListener('terminal-output', subscription);
  },
  onTerminalExit: (callback: (data: { processId: number, code: number }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('terminal-exit', subscription);
    return () => ipcRenderer.removeListener('terminal-exit', subscription);
  },
  onTerminalError: (callback: (data: { processId: number, error: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('terminal-error', subscription);
    return () => ipcRenderer.removeListener('terminal-error', subscription);
  },

  copyFileToProject: (sourcePath: string, destDir: string) => ipcRenderer.invoke('copy-file-to-project', sourcePath, destDir),

  moveFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('move-file', oldPath, newPath),
  createFolder: (folderPath: string) => ipcRenderer.invoke('create-folder', folderPath),

  watchProject: (projectPath: string) => ipcRenderer.invoke('watch-project', projectPath),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  onFsEvent: (callback: (data: { event: string, filename: string }) => void) => {
    const subscription = (_: any, data: any) => callback(data);
    ipcRenderer.on('fs-event', subscription);
    return () => ipcRenderer.removeListener('fs-event', subscription);
  },
  askAntagonista: (message: string, history: any[]) => ipcRenderer.invoke('ask-antagonista', message, history),
  getChatHistory: () => ipcRenderer.invoke('get-chat-history'),
  saveChatHistory: (data: any) => ipcRenderer.invoke('save-chat-history', data),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  newWindow: () => ipcRenderer.invoke('new-window'),

  killAllProcesses: () => ipcRenderer.invoke('kill-all-processes')
})
