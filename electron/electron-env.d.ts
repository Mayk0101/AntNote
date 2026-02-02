/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

interface ElectronAPI {
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  openFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  saveFileDialog: (defaultName: string) => Promise<{ canceled: boolean; filePath: string }>;

  getFileStats: (filePath: string) => Promise<{ success: boolean; isDirectory?: boolean; error?: string }>;
  readDirRecursive: (dirPath: string) => Promise<{ success: boolean; filePaths?: { path: string; isDirectory: boolean }[]; error?: string }>;
  renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  duplicateFile: (filePath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;

  getAppSettings: () => Promise<{ recentProjects: string[]; lastProject: string | null }>;
  setAppSettings: (settings: { recentProjects?: string[]; lastProject?: string | null }) => Promise<{ success: boolean }>;
  openFolderDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;

  runCommand: (command: string, cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  runCommandStream: (command: string, cwd: string) => Promise<{ processId: number }>;
  killProcess: (processId: number) => Promise<{ success: boolean; error?: string }>;
  killAllProcesses: () => Promise<{ success: boolean }>;

  onTerminalOutput: (callback: (data: { processId: number; data: string }) => void) => () => void;
  onTerminalExit: (callback: (data: { processId: number; code: number }) => void) => () => void;
  onTerminalError: (callback: (data: { processId: number; error: string }) => void) => () => void;

  copyFileToProject: (sourcePath: string, destDir: string) => Promise<{ success: boolean; destPath?: string; error?: string }>;
  askAntagonista: (message: string, history: any[]) => Promise<{
    success: boolean;
    response?: string;
    error?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }>;

  getChatHistory: () => Promise<{ sessions: any[]; currentSessionId: string | null }>;
  saveChatHistory: (data: { sessions: any[]; currentSessionId: string | null }) => Promise<{ success: boolean; error?: string }>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  watchProject: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  stopWatching: () => Promise<{ success: boolean }>;
  moveFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  onFsEvent: (callback: (data: { event: string, filename: string }) => void) => () => void;
  newWindow: () => Promise<void>;
}

interface Window {
  electronAPI: ElectronAPI;
}
