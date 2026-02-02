import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icons.png'),
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    titleBarStyle: 'hidden',
  })

  ipcMain.handle('minimize-window', (event) => {
    const focusedWin = BrowserWindow.fromWebContents(event.sender);
    focusedWin?.minimize();
  });

  ipcMain.handle('maximize-window', (event) => {
    const focusedWin = BrowserWindow.fromWebContents(event.sender);
    if (focusedWin?.isMaximized()) {
      focusedWin.unmaximize();
    } else {
      focusedWin?.maximize();
    }
  });

  ipcMain.handle('close-window', (event) => {
    const focusedWin = BrowserWindow.fromWebContents(event.sender);
    focusedWin?.close();
  });

  ipcMain.handle('new-window', () => {
    const newWin = new BrowserWindow({
      icon: path.join(process.env.VITE_PUBLIC, 'icons.png'),
      width: 1280,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
      },
      titleBarStyle: 'hidden',
    });
    if (VITE_DEV_SERVER_URL) {
      newWin.loadURL(VITE_DEV_SERVER_URL);
    } else {
      newWin.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('read-file', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('open-file-dialog', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Arquivos de Texto', extensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    })
    if (result.canceled) return { canceled: true, filePaths: [] }
    return { canceled: false, filePaths: result.filePaths }
  })

  ipcMain.handle('save-file-dialog', async (_, defaultName: string) => {
    const { dialog } = await import('electron')
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: defaultName,
      filters: [
        { name: 'Arquivos de Texto', extensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) return { canceled: true, filePath: '' }
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle('get-file-stats', async (_, filePath: string) => {
    try {
      const stats = await fs.stat(filePath)
      return { success: true, isDirectory: stats.isDirectory() }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('read-dir-recursive', async (_, dirPath: string) => {
    try {
      async function getFiles(dir: string): Promise<{ path: string; isDirectory: boolean }[]> {
        const ignored = new Set(['node_modules', '.git']);
        try {
          const dirents = await fs.readdir(dir, { withFileTypes: true });

          const entries: { path: string; isDirectory: boolean }[][] = await Promise.all(dirents.map(async (dirent) => {
            if (ignored.has(dirent.name)) return [];

            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
              const children = await getFiles(res);
              return [{ path: res, isDirectory: true }, ...children];
            } else {
              return [{ path: res, isDirectory: false }];
            }
          }));

          return entries.flat();
        } catch (err) {
          console.error(`Error reading ${dir}:`, err);
          return [];
        }
      }

      const files = await getFiles(dirPath);

      return { success: true, filePaths: files }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('rename-file', async (_, oldPath: string, newPath: string) => {
    try {
      await fs.rename(oldPath, newPath)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('delete-file', async (_, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('duplicate-file', async (_, filePath: string) => {
    try {
      const ext = path.extname(filePath);
      const name = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      const newPath = path.join(dir, `${name}_copy${ext}`);

      await fs.copyFile(filePath, newPath)
      return { success: true, newPath }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  ipcMain.handle('get-app-settings', async () => {
    try {
      const data = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return { recentProjects: [], lastProject: null };
    }
  });

  ipcMain.handle('get-chat-history', async () => {
    try {
      const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
      const data = await fs.readFile(historyPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return { sessions: [], currentSessionId: null };
    }
  })

  ipcMain.handle('save-chat-history', async (_, historyData) => {
    try {
      const historyPath = path.join(app.getPath('userData'), 'chat_history.json');
      await fs.writeFile(historyPath, JSON.stringify(historyData, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  })

  ipcMain.handle('set-app-settings', async (_, settings: any) => {
    try {
      let current = { recentProjects: [], lastProject: null };
      try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        current = JSON.parse(data);
      } catch (e) { }

      const newSettings = { ...current, ...settings };
      await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('open-folder-dialog', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    if (result.canceled) return { canceled: true, filePaths: [] }
    return { canceled: false, filePaths: result.filePaths }
  })

  let runningProcesses: Map<number, any> = new Map();
  let processIdCounter = 0;

  ipcMain.handle('run-command', async (_, command: string, cwd: string) => {
    const { spawn } = await import('child_process');
    const isWindows = process.platform === 'win32';

    const processId = ++processIdCounter;
    let output = '';

    return new Promise((resolve) => {
      const shell = isWindows ? 'powershell.exe' : '/bin/sh';
      const args = isWindows
        ? ['-NoProfile', '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`]
        : ['-c', command];

      const proc = spawn(shell, args, {
        cwd,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      runningProcesses.set(processId, proc);

      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('close', (code: number) => {
        runningProcesses.delete(processId);
        if (code === 0) {
          resolve({ success: true, output, processId });
        } else {
          resolve({ success: false, error: `Processo encerrado com código ${code}`, output, processId });
        }
      });

      proc.on('error', (err: Error) => {
        runningProcesses.delete(processId);
        resolve({ success: false, error: err.message, output, processId });
      });
    });
  });

  ipcMain.handle('kill-process', async (_, processId: number) => {
    const proc = runningProcesses.get(processId);
    if (proc && proc.pid) {
      const isWindows = process.platform === 'win32';

      if (isWindows) {
        const { exec } = await import('child_process');
        exec(`taskkill /PID ${proc.pid} /T /F`, (error) => {
          if (error) {
            console.error('Erro ao matar processo:', error);
          }
        });
      } else {
        try {
          process.kill(-proc.pid, 'SIGKILL');
        } catch (e) {
          proc.kill('SIGKILL');
        }
      }

      runningProcesses.delete(processId);
      return { success: true };
    }
    return { success: false, error: 'Processo não encontrado' };
  });

  ipcMain.handle('kill-all-processes', async () => {
    const isWindows = process.platform === 'win32';
    const { exec } = await import('child_process');

    for (const [, proc] of runningProcesses) {
      if (proc && proc.pid) {
        if (isWindows) {
          exec(`taskkill /PID ${proc.pid} /T /F`);
        } else {
          try {
            process.kill(-proc.pid, 'SIGKILL');
          } catch (e) {
            proc.kill('SIGKILL');
          }
        }
      }
    }

    runningProcesses.clear();
    return { success: true };
  });

  ipcMain.handle('run-command-stream', async (event, command: string, cwd: string) => {
    const { spawn } = await import('child_process');
    const isWindows = process.platform === 'win32';

    const processId = ++processIdCounter;

    const shell = isWindows ? 'powershell.exe' : '/bin/sh';
    const args = isWindows
      ? ['-NoProfile', '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`]
      : ['-c', command];

    const proc = spawn(shell, args, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    // Guardar referência para poder matar depois
    runningProcesses.set(processId, proc);

    proc.stdout.on('data', (data: Buffer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal-output', { processId, data: data.toString() });
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal-output', { processId, data: data.toString() });
      }
    });

    proc.on('close', (code: number) => {
      runningProcesses.delete(processId);
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal-exit', { processId, code });
      }
    });

    proc.on('error', (err: Error) => {
      runningProcesses.delete(processId);
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal-error', { processId, error: err.message });
      }
    });

    return { processId };
  });

  ipcMain.handle('copy-file-to-project', async (_, sourcePath: string, destDir: string) => {
    try {
      const fileName = sourcePath.split(/[\\/]/).pop() || 'file';
      const destPath = path.join(destDir, fileName);
      await fs.copyFile(sourcePath, destPath);
      return { success: true, destPath };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('ask-antagonista', async (_, message: string, history: any[]) => {
    const { spawn } = await import('child_process');

    let cmd: string;
    let args: string[];

    if (app.isPackaged) {
      const exePath = path.join(process.resourcesPath, 'python', 'antagonista.exe');
      cmd = exePath;
      args = [];
    } else {
      const pythonScript = path.join(process.env.APP_ROOT, 'resources', 'python', 'antagonista.py');
      cmd = 'python';
      args = [pythonScript];
    }

    return new Promise((resolve) => {
      const py = spawn(cmd, args);

      let outputData = '';
      let errorData = '';

      const input = JSON.stringify({ message, history });
      py.stdin.write(input);
      py.stdin.end();

      py.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      py.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      py.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `Process exited with code ${code}. Stderr: ${errorData}` });
        } else {
          try {
            const result = JSON.parse(outputData);
            resolve(result);
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse JSON response: ' + outputData });
          }
        }
      });
    });
  });

  let projectWatcher: any = null;

  ipcMain.handle('watch-project', async (_, projectPath: string) => {
    try {
      if (projectWatcher) {
        projectWatcher.close();
      }

      const { watch } = await import('node:fs');
      projectWatcher = watch(projectPath, { recursive: true }, (eventType, filename) => {
        if (filename && win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send('fs-event', { event: eventType, filename });
        }
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('stop-watching', async () => {
    if (projectWatcher) {
      projectWatcher.close();
      projectWatcher = null;
    }
    return { success: true };
  });

  ipcMain.handle('move-file', async (_, oldPath: string, newPath: string) => {
    try {
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('create-folder', async (_, folderPath: string) => {
    try {
      await fs.mkdir(folderPath, { recursive: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

})
