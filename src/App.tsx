import React from 'react';
import { TitleBar } from './components/TitleBar';
import './styles/search.css';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { useTabs } from './hooks/useTabs';

import { StartScreen } from './components/StartScreen';
import { MediaViewer, getMediaType } from './components/MediaViewer';
import { Terminal } from './components/Terminal';
import { ChatPanel } from './components/ChatPanel';
import { DropZone } from './components/DropZone';

function App() {
  const { tabs, activeTab, activeTabId, setActiveTabId, updateTabContent, setTabs, saveFile, renameTabFile, duplicateTabFile, closeTab } = useTabs();
  const [projectRoot, setProjectRoot] = React.useState<string>('');
  const [projectFiles, setProjectFiles] = React.useState<{ path: string; isDirectory: boolean }[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [recentProjects, setRecentProjects] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showTerminal, setShowTerminal] = React.useState(false);
  const [showChat, setShowChat] = React.useState(true);
  const [showSearch, setShowSearch] = React.useState(false);
  const [problems, setProblems] = React.useState<any[]>([]);
  const [autoSave, setAutoSave] = React.useState(false);
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [newFileDialogOpen, setNewFileDialogOpen] = React.useState(false);
  const [newFileName, setNewFileName] = React.useState('novo_arquivo.txt');

  React.useEffect(() => {
    if (!autoSave || !activeTab || !activeTab.path || !activeTab.isDirty) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await window.electronAPI.writeFile(activeTab.path, activeTab.content);
        setTabs(prev => prev.map(t =>
          t.id === activeTab.id ? { ...t, isModified: false } : t
        ));
        console.log('Auto-save: arquivo salvo', activeTab.path);
      } catch (error) {
        console.error('Auto-save falhou:', error);
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSave, activeTab?.content, activeTab?.id, activeTab?.isDirty, activeTab?.path]);

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        window.electronAPI.newWindow();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFile();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setShowSearch(!showSearch);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, showSearch]);

  const handleDiagnosticsChange = React.useCallback((newDiagnostics: any[]) => {
    if (!activeTabId) return;
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === activeTabId);
      if (!tab) return currentTabs;

      const currentFile = tab.path;

      setProblems(prev => {
        const others = prev.filter(p => p.file !== currentFile);
        const proper = newDiagnostics.map(d => ({ ...d, file: currentFile }));
        return [...others, ...proper];
      });

      return currentTabs;
    });
  }, [activeTabId]);


  const getLanguage = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
      java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp', h: 'c',
      cs: 'csharp', php: 'php', lua: 'lua', r: 'r',
      html: 'html', htm: 'html', css: 'css', scss: 'scss', sass: 'sass', less: 'less',
      json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml',
      md: 'markdown', txt: 'text',
      sql: 'sql', graphql: 'graphql',
      sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', bat: 'batch',
      vue: 'vue', svelte: 'svelte',
      dockerfile: 'dockerfile'
    };
    return languageMap[ext] || 'text';
  };

  React.useEffect(() => {
    const loadSettings = async () => {
      const settings = await window.electronAPI.getAppSettings();
      if (settings.recentProjects) setRecentProjects(settings.recentProjects);
      if (settings.lastProject) {
        console.log('Auto-load disabled for recovery. Last project was:', settings.lastProject);
      }
    };
    loadSettings();
  }, []);

  React.useEffect(() => {
    const resetDrag = () => setIsDragging(false);

    window.addEventListener('dragend', resetDrag);
    window.addEventListener('drop', resetDrag);
    window.addEventListener('dragleave', (e) => {
      if (e.clientX <= 0 || e.clientY <= 0 ||
        e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        resetDrag();
      }
    });

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetDrag();
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('dragend', resetDrag);
      window.removeEventListener('drop', resetDrag);
      window.removeEventListener('keydown', handleEsc);
    };


  }, []);

  const openProject = async (path: string) => {
    setIsLoading(true);
    console.log('Opening project:', path);
    try {
      const stats = await window.electronAPI.getFileStats(path);
      if (stats.success && stats.isDirectory) {
        setProjectRoot(path);

        await window.electronAPI.watchProject(path);
        await new Promise(r => setTimeout(r, 50));

        const dirResult = await window.electronAPI.readDirRecursive(path);
        console.log('Dir Result:', dirResult);

        if (dirResult.success && dirResult.filePaths) {
          setProjectFiles(dirResult.filePaths);

          const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.txt', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.cs', '.php', '.rb', '.swift', '.kt', '.vue', '.svelte', '.sql', '.sh', '.bat', '.ps1', '.yaml', '.yml', '.toml', '.xml'];
          const firstCodeFile = dirResult.filePaths.find((f: { path: string; isDirectory: boolean }) => {
            if (f.isDirectory) return false;
            const ext = f.path.substring(f.path.lastIndexOf('.')).toLowerCase();
            return codeExtensions.includes(ext);
          });

          if (firstCodeFile) {
            const filePath = firstCodeFile.path;
            const result = await window.electronAPI.readFile(filePath);
            if (result.success) {
              const fileName = filePath.split(/[\\/]/).pop() || 'Arquivo';
              const newId = Date.now().toString();
              setTabs(prev => [...prev, {
                id: newId,
                name: fileName,
                path: filePath,
                content: result.content || '',
                isDirty: false,
                language: getLanguage(fileName)
              }]);
              setActiveTabId(newId);
            }
          }
        } else {
          console.error('Failed to read dir:', dirResult.error);
          alert('Falha ao ler diretório: ' + dirResult.error);
        }
        const newRecents = [path, ...recentProjects.filter(p => p !== path)].slice(0, 5);
        setRecentProjects(newRecents);
        await window.electronAPI.setAppSettings({ recentProjects: newRecents, lastProject: path });
      } else {
        console.error('Not a directory or stats failed');
      }
    } catch (error) {
      console.error("CRITICAL ERROR opening project:", error);
      alert('Erro crítico ao abrir projeto. Verifique o console.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeProject = async () => {
    await window.electronAPI.stopWatching();
    setProjectRoot('');
    setProjectFiles([]);
    await window.electronAPI.setAppSettings({ lastProject: null });
  };

  React.useEffect(() => {
    if (!projectRoot) return;
    let timeout: any;
    const cleanup = window.electronAPI.onFsEvent(() => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        console.log('FS Event: Refreshing project files...');
        const dirResult = await window.electronAPI.readDirRecursive(projectRoot);
        if (dirResult.success && dirResult.filePaths) {
          setProjectFiles(dirResult.filePaths);
        }
      }, 500);
    });
    return () => {
      cleanup();
      clearTimeout(timeout);
    };
  }, [projectRoot]);


  const terminalRef = React.useRef<any>(null);

  const handleRunCode = async () => {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    if (tab.isDirty) {
      await saveFile();
    }
    const fileName = tab.path.split(/[\\/]/).pop() || tab.path;
    let cmd = '';

    if (tab.language === 'python' || tab.path.endsWith('.py')) {
      cmd = `py "${fileName}"`;
    } else if (tab.language === 'javascript' || tab.path.endsWith('.js')) {
      cmd = `node "${fileName}"`;
    } else if (tab.language === 'typescript' || tab.path.endsWith('.ts') || tab.path.endsWith('.tsx')) {
      cmd = `npx ts-node "${fileName}"`;
    } else if (tab.path.endsWith('.bat') || tab.path.endsWith('.ps1')) {
      cmd = `"./${fileName}"`;
    }

    if (cmd && terminalRef.current) {
      setShowTerminal(true);
      setTimeout(() => {
        terminalRef.current.runCommand(cmd);
      }, 100);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await saveFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewFile();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false);
        setIsDragging(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile, showSearch]);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    console.log('Drop event detected', files);

    if (files.length > 0) {
      const firstFile = files[0];
      const getPath = (file: any) => file.path || file.name;
      const filePath = getPath(firstFile);
      console.log('Processing first drop item:', filePath);

      if (filePath) {
        try {
          const stats = await window.electronAPI.getFileStats(filePath);
          console.log('File stats:', stats);

          if (stats.success && stats.isDirectory) {
            console.log('Detected directory, opening project...');
            await openProject(filePath);
            return;
          }
          console.log('Detected files, opening tabs...');
          const newTabs: any[] = [];
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const fPath = getPath(f);
            if (fPath) {
              const fStats = await window.electronAPI.getFileStats(fPath);
              if (fStats.success && fStats.isDirectory) continue;

              const fileResult = await window.electronAPI.readFile(fPath);
              if (fileResult.success) {
                const fileName = fPath.split(/[\\/]/).pop() || 'Arquivo';
                if (!tabs.some(t => t.path === fPath)) {
                  newTabs.push({
                    id: Date.now().toString() + i,
                    name: fileName,
                    path: fPath,
                    content: fileResult.content || '',
                    isDirty: false,
                    language: getLanguage(fileName)
                  });
                } else {
                  const existing = tabs.find(t => t.path === fPath);
                  if (existing) setActiveTabId(existing.id);
                }
              } else {
                console.error('Failed to read file:', fPath, fileResult.error);
              }
            }
          }
          if (newTabs.length > 0) {
            console.log('Adding new tabs:', newTabs);
            setTabs(prev => [...prev, ...newTabs]);
            setActiveTabId(newTabs[0].id);
          } else {
            console.log('No new tabs to add. Tabs already exist or no valid files.');
          }
        } catch (err) {
          console.error('Error handling drop:', err);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleNewFile = () => {
    setNewFileName('novo_arquivo.txt');
    setNewFileDialogOpen(true);
  };

  const confirmNewFile = async () => {
    if (!newFileName.trim()) return;

    const newTabId = Date.now().toString();
    const filePath = projectRoot ? `${projectRoot}/${newFileName}` : '';
    if (projectRoot) {
      try {
        await window.electronAPI.writeFile(filePath, '');
      } catch (error) {
        console.error('Erro ao criar arquivo:', error);
      }
    }

    setTabs(prev => [...prev, {
      id: newTabId,
      name: newFileName,
      path: filePath,
      content: '',
      isDirty: false,
      language: getLanguage(newFileName)
    }]);
    setActiveTabId(newTabId);
    setNewFileDialogOpen(false);
  };

  const handleOpenFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (!result.canceled && result.filePaths.length > 0) {
        for (let i = 0; i < result.filePaths.length; i++) {
          const filePath = result.filePaths[i];
          const fileName = filePath.split(/[\\/]/).pop() || 'Arquivo';
          const fileResult = await window.electronAPI.readFile(filePath);
          if (fileResult.success) {
            const newTabId = Date.now().toString() + i;
            setTabs(prev => [...prev, {
              id: newTabId,
              name: fileName,
              path: filePath,
              content: fileResult.content || '',
              isDirty: false,
              language: fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.tsx') ? 'javascript' :
                fileName.endsWith('.py') ? 'python' : 'text'
            }]);
            if (i === 0) setActiveTabId(newTabId);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao abrir dialog', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        transition: 'outline 0.2s, background 0.2s'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <TitleBar
          onToggleChat={() => setShowChat(!showChat)}
          showChat={showChat}
          onToggleTerminal={() => setShowTerminal(!showTerminal)}
          showTerminal={showTerminal}
          onNewFile={handleNewFile}
          onOpenFile={handleOpenFile}
          onOpenFolder={async () => {
            const result = await window.electronAPI.openFolderDialog();
            if (!result.canceled && result.filePaths.length > 0) {
              await openProject(result.filePaths[0]);
            }
          }}
          onSave={saveFile}
          onCloseProject={closeProject}
          recentProjects={recentProjects}
          onOpenRecentProject={openProject}
          onCloseEditor={() => {
            if (activeTabId) {
              closeTab(activeTabId);
            }
          }}
          onRevertFile={async () => {
            if (activeTab && activeTab.path) {
              const result = await window.electronAPI.readFile(activeTab.path);
              if (result.success && result.content !== undefined) {
                updateTabContent(activeTabId, result.content);
              }
            }
          }}
          autoSave={autoSave}
          onToggleAutoSave={() => setAutoSave(!autoSave)}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', marginTop: '30px' }}>
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, flexDirection: 'column' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '15px' }}></div>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Carregando projeto...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          <Sidebar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTabId}
            isVisible={!!projectRoot || tabs.length > 0}
            onRename={renameTabFile}
            onDelete={closeTab}
            onDuplicate={duplicateTabFile}
            projectRoot={projectRoot}
            projectFiles={projectFiles}
            onFileClick={async (path) => {
              const existing = tabs.find(t => t.path === path);
              if (existing) {
                setActiveTabId(existing.id);
                return;
              }
              const result = await window.electronAPI.readFile(path);
              if (result.success) {
                const fileName = path.split(/[\\/]/).pop() || 'Arquivo';
                const newId = Date.now().toString();
                setTabs(prev => [...prev, {
                  id: newId,
                  name: fileName,
                  path: path,
                  content: result.content || '',
                  isDirty: false,
                  language: getLanguage(fileName)
                }]);
                setActiveTabId(newId);
              }
            }}
            onCloseProject={closeProject}
            onOpenFolder={async () => {
              const result = await window.electronAPI.openFolderDialog();
              if (!result.canceled && result.filePaths.length > 0) {
                openProject(result.filePaths[0]);
              }
            }}
            onFileCopied={async () => {
              if (projectRoot) {
                const dirResult = await window.electronAPI.readDirRecursive(projectRoot);
                if (dirResult.success && dirResult.filePaths) {
                  setProjectFiles(dirResult.filePaths);
                }
              }
            }}
            onProjectFileRenamed={(oldPath, newPath) => {
              setTabs(prev => prev.map(t => {
                if (t.path === oldPath) {
                  const newName = newPath.split(/[\\/]/).pop() || t.name;
                  return { ...t, path: newPath, name: newName };
                }
                return t;
              }));
            }}
            onFileDeleted={(deletedPath) => {
              setTabs(prev => prev.filter(t => t.path !== deletedPath));
              if (activeTab && activeTab.path === deletedPath) {
                const remaining = tabs.filter(t => t.path !== deletedPath);
                if (remaining.length > 0) setActiveTabId(remaining[remaining.length - 1].id);
                else setActiveTabId('');
              }
            }}
          />

          <div
            className={isDragging ? 'drag-over' : ''}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Tab Bar Container */}
            {/* Tabs Area */}
            {tabs.length > 0 && (
              <div style={{
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                height: '35px'
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                  scrollbarWidth: 'none',
                  alignItems: 'center'
                }}
                  onWheel={(e) => {
                    const container = e.currentTarget;
                    if (e.deltaY !== 0) {
                      container.scrollLeft += e.deltaY;
                    }
                  }}
                  className="tab-scroll-container"
                >
                  {tabs.map(tab => (
                    <div
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      style={{
                        padding: '5px 10px 5px 15px',
                        background: tab.id === activeTabId ? 'var(--bg-primary)' : 'transparent',
                        fontSize: '12px',
                        borderTop: tab.id === activeTabId ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: tab.id === activeTabId ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: '120px',
                        maxWidth: '200px',
                        justifyContent: 'space-between',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        flexShrink: 0,
                        height: '100%'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tab.name}{tab.isDirty ? ' *' : ''}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        style={{ marginLeft: '8px', opacity: 0.5, fontSize: '14px' }}
                        className="hover:opacity-100 hover:text-red-400"
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>

                {/* Editor Actions (Run Button) */}
                {activeTab && (activeTab.language === 'python' || activeTab.language === 'javascript' || activeTab.language === 'typescript') && (
                  <div style={{ padding: '0 10px', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--border-color)' }}>
                    <button
                      onClick={handleRunCode}
                      title="Executar Arquivo"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4ade80',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}
                      className="hover:bg-slate-800"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      Run
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Workspace Row (Editor+Terminal | Chat) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

              {/* Editor & Terminal Column */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {activeTab && tabs.length > 0 ? (
                    getMediaType(activeTab.name) !== 'code' ? (
                      <MediaViewer path={activeTab.path} type={getMediaType(activeTab.name) as 'image' | 'video' | 'audio' | 'pdf'} />
                    ) : (
                      <Editor
                        key={activeTab.id}
                        content={activeTab.content}
                        onChange={(val) => updateTabContent(activeTab.id, val)}
                        language={activeTab.language}
                        showSearch={showSearch}
                        onToggleSearch={() => setShowSearch(prev => !prev)}
                        onDiagnosticsChange={handleDiagnosticsChange}
                      />
                    )
                  ) : (
                    <StartScreen
                      onNewFile={handleNewFile}
                      onOpenFile={handleOpenFile}
                      onOpenFolder={async () => {
                        const result = await window.electronAPI.openFolderDialog();
                        if (!result.canceled && result.filePaths.length > 0) {
                          await openProject(result.filePaths[0]);
                        }
                      }}
                      recentProjects={recentProjects}
                      onOpenRecent={openProject}
                    />
                  )}
                </div>

                {/* Terminal */}
                <Terminal
                  ref={terminalRef}
                  isVisible={showTerminal}
                  onClose={() => setShowTerminal(false)}
                  projectRoot={projectRoot}
                  problems={problems}
                />
              </div>

              <ChatPanel
                isVisible={showChat}
                onClose={() => setShowChat(false)}
                activeTab={activeTab ? { ...activeTab, language: activeTab.language || 'text' } : null}
              />
              <DropZone
                isVisible={isDragging}
                onCancel={() => setIsDragging(false)}
                onDrop={handleDrop}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Novo Arquivo */}
      {newFileDialogOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px',
            minWidth: '350px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', fontWeight: 600 }}>Novo Arquivo</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmNewFile();
                if (e.key === 'Escape') setNewFileDialogOpen(false);
              }}
              autoFocus
              placeholder="nome_do_arquivo.txt"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                marginBottom: '15px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setNewFileDialogOpen(false)}
                style={{
                  padding: '6px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmNewFile}
                style={{
                  padding: '6px 16px',
                  background: 'var(--accent-color)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
