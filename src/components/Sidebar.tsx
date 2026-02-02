import { FileText, ChevronRight, ChevronDown, MoreVertical, Trash2, Edit2, Copy, Folder, FolderOpen, Scissors, Clipboard as ClipboardIcon, FilePlus, FolderPlus } from 'lucide-react';
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface SidebarProps {
    tabs: { id: string; name: string; path: string; isDirty: boolean; language?: string }[];
    activeTabId: string;
    onTabSelect: (id: string) => void;
    isVisible: boolean;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    projectRoot?: string;
    projectFiles?: { path: string; isDirectory: boolean }[];
    onFileClick?: (path: string) => void;
    onCloseProject?: () => void;
    onOpenFolder?: () => void;
    onFileCopied?: () => void;
    onProjectFileRenamed?: (oldPath: string, newPath: string) => void;
    onFileDeleted?: (path: string) => void;
}

interface TreeNode {
    name: string;
    path: string;
    kind: 'file' | 'directory';
    children?: TreeNode[];
}

const buildTree = (entries: { path: string; isDirectory: boolean }[], rootPath: string): TreeNode[] => {
    const root: TreeNode = { name: 'root', path: rootPath, kind: 'directory', children: [] };
    const cleanRoot = rootPath.replace(/[\\/]$/, '');

    const isDirectoryMap = new Map<string, boolean>();
    entries.forEach(entry => isDirectoryMap.set(entry.path, entry.isDirectory));

    entries.forEach(entry => {
        const fullPath = entry.path;
        if (!fullPath.startsWith(cleanRoot)) return;
        const relative = fullPath.substring(cleanRoot.length + 1);
        if (!relative) return;

        const parts = relative.split(/[\\/]/);
        let currentNode = root;

        parts.forEach((part, index) => {
            if (!part) return;
            const isLastPart = index === parts.length - 1;
            const isDir = isLastPart ? entry.isDirectory : true;

            let child = currentNode.children?.find(c => c.name === part);

            if (!child) {
                const sep = cleanRoot.includes('\\') ? '\\' : '/';
                const nodePath = cleanRoot + sep + parts.slice(0, index + 1).join(sep);

                child = {
                    name: part,
                    path: nodePath,
                    kind: isDir ? 'directory' : 'file',
                    children: isDir ? [] : undefined
                };
                currentNode.children?.push(child);
            }
            if (isDir) {
                currentNode = child;
            }
        });
    });

    const sortNodes = (nodes?: TreeNode[]) => {
        if (!nodes) return;
        nodes.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
        nodes.forEach(n => sortNodes(n.children));
    };

    sortNodes(root.children);
    return root.children || [];
};

export const Sidebar: React.FC<SidebarProps> = ({ tabs, activeTabId, onTabSelect, isVisible, onRename, onDelete, onDuplicate, projectRoot, projectFiles = [], onFileClick, onCloseProject, onOpenFolder, onFileCopied, onProjectFileRenamed, onFileDeleted }) => {
    const [width, setWidth] = useState(250);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const [openFilesExpanded, setOpenFilesExpanded] = useState(true);
    const [projectExpanded, setProjectExpanded] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [clipboard, setClipboard] = useState<{ path: string, mode: 'copy' | 'move' } | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, tabId: string, isProjectItem: boolean, path?: string, isFolder?: boolean } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const [nameDialog, setNameDialog] = useState<{ type: 'file' | 'folder', parentPath: string } | null>(null);
    const [newNameInput, setNewNameInput] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const headerMenuRef = useRef<HTMLDivElement>(null);
    const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

    const handleFolderDrop = async (e: React.DragEvent, folderPath: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTargetPath(null);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const file = e.dataTransfer.files[i];
                const sourcePath = (file as any).path;
                if (sourcePath) {
                    const result = await window.electronAPI.copyFileToProject(sourcePath, folderPath);
                    if (!result.success) {
                        console.error('Failed to copy:', result.error);
                    }
                }
            }
            if (onFileCopied) onFileCopied();
        }
    };

    const handleCreateItem = async () => {
        if (!nameDialog || !newNameInput.trim()) return;

        const parent = nameDialog.parentPath;
        const name = newNameInput.trim();
        const sep = parent.includes('\\') ? '\\' : '/';
        const fullPath = `${parent}${sep}${name}`;

        try {
            if (nameDialog.type === 'file') {
                await window.electronAPI.writeFile(fullPath, '');
            } else {
                await window.electronAPI.createFolder(fullPath);
            }
            if (onFileCopied) onFileCopied();
        } catch (e) {
            console.error(e);
        }
        setNameDialog(null);
        setNewNameInput('');
    };

    const handleCopy = (path: string) => {
        setClipboard({ path, mode: 'copy' });
        setContextMenu(null);
    };

    const handleCut = (path: string) => {
        setClipboard({ path, mode: 'move' });
        setContextMenu(null);
    };

    const handlePaste = async (destFolder: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (!clipboard) return;
        if (e) e.stopPropagation();

        try {
            const fileName = clipboard.path.split(/[\\/]/).pop();
            if (!fileName) return;

            if (clipboard.mode === 'copy') {
                await window.electronAPI.copyFileToProject(clipboard.path, destFolder);
            } else {
                // Move
                const sep = destFolder.includes('\\') ? '\\' : '/';
                const cleanDest = destFolder.replace(/[\\/]$/, '');
                const newPath = `${cleanDest}${sep}${fileName}`;
                if (newPath !== clipboard.path) {
                    await window.electronAPI.renameFile(clipboard.path, newPath);
                    if (onProjectFileRenamed) onProjectFileRenamed(clipboard.path, newPath);
                    setClipboard(null);
                }
            }
            if (onFileCopied) onFileCopied();
            setContextMenu(null);
        } catch (error) {
            console.error('Paste error:', error);
        }
    };

    const tree = useMemo(() => {
        if (!projectRoot || projectFiles.length === 0) return [];
        return buildTree(projectFiles, projectRoot);
    }, [projectFiles, projectRoot]);

    const toggleFolder = (path: string) => {
        const newSet = new Set(expandedFolders);
        if (newSet.has(path)) newSet.delete(path);
        else newSet.add(path);
        setExpandedFolders(newSet);
    };

    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing = useCallback(() => setIsResizing(false), []);
    const resize = useCallback((e: MouseEvent) => {
        if (isResizing && sidebarRef.current) {
            const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
            if (newWidth >= 180 && newWidth <= 600) setWidth(newWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        const handleClick = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        window.addEventListener('mousedown', handleClick);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('mousedown', handleClick);
        };
    }, [resize, stopResizing]);

    const handleContextMenu = (e: React.MouseEvent, id: string, isProjectItem: boolean, path?: string, isFolder?: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        const menuWidth = 200;
        const menuHeight = isProjectItem ? 350 : 150;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 10;
        }

        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 10;
        }

        setContextMenu({ x, y, tabId: id, isProjectItem, path, isFolder });
    };

    const confirmRename = async () => {
        if (editingId && editName.trim()) {
            if (editingId.includes('/') || editingId.includes('\\')) {
                const oldPath = editingId;
                const dir = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
                const newPath = `${dir}${dir.includes('/') ? '/' : '\\'}${editName.trim()}`;

                if (oldPath !== newPath) {
                    await window.electronAPI.renameFile(oldPath, newPath);
                    if (onFileCopied) onFileCopied();
                    if (onProjectFileRenamed) onProjectFileRenamed(oldPath, newPath);
                }
            } else {
                onRename(editingId, editName.trim());
            }
        }
        setEditingId(null);
    };

    const startRenaming = (tabId: string, currentName: string) => {
        setEditingId(tabId);
        setEditName(currentName);
        setContextMenu(null);
    };

    const handleKeyDown = async (e: React.KeyboardEvent, id: string, isProject: boolean) => {
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'c' && isProject) {
                handleCopy(id);
                return;
            }
            if (e.key === 'x' && isProject) {
                handleCut(id);
                return;
            }
            if (e.key === 'v') {
                let dest = id;
                const hasExt = id.split(/[\\/]/).pop()?.includes('.');
                if (hasExt) {
                    dest = id.substring(0, Math.max(id.lastIndexOf('/'), id.lastIndexOf('\\')));
                }
                handlePaste(dest, e);
                return;
            }
        }

        if (e.key === 'F2') {
            if (isProject) {
                const fileName = id.split(/[\\/]/).pop() || '';
                startRenaming(id, fileName);
            } else {
                const tab = tabs.find(t => t.id === id);
                if (tab) startRenaming(id, tab.name);
            }
        }

        if (e.key === 'Delete') {
            if (isProject) {
                await window.electronAPI.deleteFile(id);
                if (onFileCopied) onFileCopied();
                if (onFileDeleted) onFileDeleted(id);
            } else {
                onDelete(id);
            }
        }
    };

    const getFileColor = (fileName: string): string => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const colors: Record<string, string> = {
            js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6',
            py: '#3776ab', html: '#e34c26', css: '#264de4', json: '#cbcb41', md: '#083fa1',
            // ... add more if needed
        };
        return colors[ext] || '#64748b';
    };

    const FileNode = ({ node, depth }: { node: TreeNode, depth: number }) => {
        const isFolder = node.kind === 'directory';
        const isOpen = expandedFolders.has(node.path);
        const paddingLeft = 14 + (depth * 10);
        const fileColor = !isFolder ? getFileColor(node.name) : '#64748b';
        const isSelected = !isFolder && tabs.some(t => t.path === node.path && t.id === activeTabId);

        return (
            <div>
                <div
                    draggable={true}
                    onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ path: node.path }));
                        e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(e) => {
                        e.currentTarget.focus();
                        if (isFolder) toggleFolder(node.path);
                        else if (onFileClick) onFileClick(node.path);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, node.path, true, node.path, isFolder)}
                    tabIndex={0}
                    onKeyDown={(e) => handleKeyDown(e, node.path, true)}
                    onDragOver={(e) => {
                        if (isFolder) {
                            e.preventDefault();
                            setDropTargetPath(node.path);
                        }
                    }}
                    onDragLeave={() => setDropTargetPath(null)}
                    onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropTargetPath(null);

                        let targetPath = node.path;
                        if (!isFolder) {
                            targetPath = node.path.substring(0, Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\')));
                        }

                        const data = e.dataTransfer.getData('application/json');
                        if (data) {
                            try {
                                const { path: sourcePath } = JSON.parse(data);
                                if (sourcePath === targetPath) return;
                                if (sourcePath === node.path) return;

                                const fileName = sourcePath.split(/[\\/]/).pop();
                                const sep = targetPath.includes('\\') ? '\\' : '/';
                                const newPath = `${targetPath}${sep}${fileName}`;

                                if (newPath !== sourcePath) {
                                    await window.electronAPI.moveFile(sourcePath, newPath);
                                    if (onProjectFileRenamed) onProjectFileRenamed(sourcePath, newPath);
                                    if (onFileCopied) onFileCopied();
                                }
                            } catch (err) { console.error(err); }
                        } else {
                            await handleFolderDrop(e, targetPath);
                        }
                    }}
                    style={{
                        padding: `2px 10px 2px ${paddingLeft}px`,
                        display: 'flex', alignItems: 'center', cursor: 'pointer',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        fontSize: '13px',
                        background: dropTargetPath === node.path ? 'rgba(56, 189, 248, 0.3)' :
                            isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                        height: '24px',
                        border: dropTargetPath === node.path ? '1px dashed var(--accent-color)' : '1px solid transparent',
                        outline: 'none'
                    }}
                    className="sidebar-item"
                    onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <span style={{ marginRight: '6px', opacity: 0.9, display: 'flex' }}>
                        {isFolder ? (
                            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : (
                            <FileText size={13} color={isSelected ? 'var(--accent-color)' : fileColor} />
                        )}
                    </span>
                    {isFolder && (
                        <span style={{ marginRight: '6px' }}>
                            {isOpen ? <FolderOpen size={14} color="#eab308" /> : <Folder size={14} color="#eab308" />}
                        </span>
                    )}

                    {editingId === node.path ? (
                        <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={confirmRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                                if (e.key === 'Escape') setEditingId(null);
                                e.stopPropagation();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: '#020617', border: '1px solid var(--accent-color)', color: '#fff',
                                fontSize: '13px', width: '100%', padding: '0 4px', borderRadius: '2px', height: '20px', outline: 'none'
                            }}
                        />
                    ) : (
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.name}
                        </span>
                    )}
                </div>
                {isFolder && isOpen && node.children && (
                    <div>
                        {node.children.map(child => <FileNode key={child.path} node={child} depth={depth + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    if (!isVisible) return null;

    return (
        <div ref={sidebarRef} style={{ width: `${width}px`, minWidth: '180px', maxWidth: '600px', background: '#0b1121', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            {/* Header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '35px', position: 'relative' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Explorador</span>
                <div style={{ position: 'relative' }}>
                    <MoreVertical
                        size={14} color="var(--text-secondary)" style={{ cursor: 'pointer' }}
                        onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                    />
                    {headerMenuOpen && (
                        <div ref={headerMenuRef} style={{ position: 'absolute', top: '20px', right: 0, background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 1000, padding: '4px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                            <div onClick={() => { if (onOpenFolder) onOpenFolder(); setHeaderMenuOpen(false); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} className="hover-item">
                                <Folder size={14} style={{ marginRight: '8px' }} /> Abrir Pasta
                            </div>
                            {projectRoot && (
                                <div onClick={() => { if (onCloseProject) onCloseProject(); setHeaderMenuOpen(false); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} className="hover-item">
                                    <Trash2 size={14} style={{ marginRight: '8px' }} /> Fechar Projeto
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }} className="custom-scroll">
                {/* Section: Open Editors */}
                {tabs.length > 0 && (
                    <div style={{ flexShrink: 0 }}>
                        <div onClick={() => setOpenFilesExpanded(!openFilesExpanded)} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700, fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.9, textTransform: 'uppercase' }}>
                            {openFilesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span style={{ marginLeft: '4px' }}>ABERTOS</span>
                        </div>
                        {openFilesExpanded && (
                            <div>
                                {tabs.map(tab => (
                                    <div key={tab.id}
                                        onClick={() => onTabSelect(tab.id)}
                                        onContextMenu={(e) => handleContextMenu(e, tab.id, false, tab.path, false)}
                                        onKeyDown={(e) => handleKeyDown(e, tab.id, false)}
                                        tabIndex={0}
                                        style={{
                                            padding: '2px 12px 2px 24px', display: 'flex', alignItems: 'center', cursor: 'pointer',
                                            background: tab.id === activeTabId ? '#1e293b' : 'transparent',
                                            color: tab.id === activeTabId ? '#fff' : 'var(--text-secondary)',
                                            borderLeft: tab.id === activeTabId ? '2px solid var(--accent-color)' : '2px solid transparent',
                                            height: '24px', outline: 'none'
                                        }}
                                        className="sidebar-item"
                                    >
                                        <FileText size={13} style={{ marginRight: '8px', flexShrink: 0 }} color={tab.id === activeTabId ? 'var(--accent-color)' : '#64748b'} />
                                        {editingId === tab.id ? (
                                            <input
                                                autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={confirmRename}
                                                onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingId(null); e.stopPropagation(); }}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ background: '#020617', border: '1px solid var(--accent-color)', color: '#fff', fontSize: '13px', width: '100%', padding: '0 4px', borderRadius: '2px', height: '20px' }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.name}</span>
                                        )}
                                        {tab.isDirty && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-secondary)', marginLeft: 'auto' }} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Section: Project */}
                {projectRoot && (
                    <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', flex: 1 }}
                        onContextMenu={(e) => {
                            handleContextMenu(e, 'root', true, projectRoot, true);
                        }}
                    >
                        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <div onClick={() => setProjectExpanded(!projectExpanded)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
                                {projectExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span style={{ marginLeft: '4px' }}>PROJETO</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div title="Novo Arquivo">
                                    <FilePlus
                                        size={14}
                                        style={{ cursor: 'pointer', opacity: 0.8 }}
                                        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
                                        onClick={(e) => { e.stopPropagation(); setNameDialog({ type: 'file', parentPath: projectRoot }); setNewNameInput(''); }}
                                    />
                                </div>
                                <div title="Nova Pasta">
                                    <FolderPlus
                                        size={14}
                                        style={{ cursor: 'pointer', opacity: 0.8 }}
                                        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseOut={(e) => e.currentTarget.style.opacity = '0.8'}
                                        onClick={(e) => { e.stopPropagation(); setNameDialog({ type: 'folder', parentPath: projectRoot }); setNewNameInput(''); }}
                                    />
                                </div>
                            </div>
                        </div>

                        {projectExpanded && (
                            <div style={{ paddingBottom: '10px', minHeight: '200px', flex: 1 }}
                                onDragOver={(e) => { e.preventDefault(); }}
                                onDrop={async (e) => {
                                    e.preventDefault(); e.stopPropagation();
                                    const data = e.dataTransfer.getData('application/json');
                                    if (data && projectRoot) {
                                        try {
                                            const { path: sourcePath } = JSON.parse(data);
                                            const fileName = sourcePath.split(/[\\/]/).pop();
                                            const sep = projectRoot.includes('\\') ? '\\' : '/';
                                            const cleanRoot = projectRoot.replace(/[\\/]$/, '');
                                            const newPath = `${cleanRoot}${sep}${fileName}`;
                                            if (newPath !== sourcePath) {
                                                await window.electronAPI.moveFile(sourcePath, newPath);
                                                if (onProjectFileRenamed) onProjectFileRenamed(sourcePath, newPath);
                                                if (onFileCopied) onFileCopied();
                                            }
                                        } catch (err) { console.error(err); }
                                    } else if (projectRoot) {
                                        await handleFolderDrop(e, projectRoot);
                                    }
                                }}
                            >
                                {tree.map(node => <FileNode key={node.path} node={node} depth={0} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div onMouseDown={startResizing} style={{ position: 'absolute', right: -2, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', zIndex: 20 }} />

            {/* Context Menu for Tabs */}
            {contextMenu && !contextMenu.isProjectItem && (
                <div ref={contextMenuRef} style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 1000, padding: '4px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    <div onClick={() => { const tab = tabs.find(t => t.id === contextMenu.tabId); if (tab) startRenaming(contextMenu.tabId, tab.name); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} className="hover-item">
                        <Edit2 size={14} style={{ marginRight: '8px' }} /> Renomear (F2)
                    </div>
                    <div onClick={() => { onDuplicate(contextMenu.tabId); setContextMenu(null); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} className="hover-item">
                        <Copy size={14} style={{ marginRight: '8px' }} /> Duplicar
                    </div>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                    <div onClick={() => { onDelete(contextMenu.tabId); setContextMenu(null); }} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} className="hover-item">
                        <Trash2 size={14} style={{ marginRight: '8px' }} /> Excluir
                    </div>
                </div>
            )}

            {/* Context Menu for Project Items */}
            {contextMenu && contextMenu.isProjectItem && (
                <div ref={contextMenuRef} style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '6px', zIndex: 1000, padding: '4px', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    <div style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                        {contextMenu.path?.split(/[\\/]/).pop() || 'Raiz'}
                    </div>

                    <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => {
                        const parent = (contextMenu.path && !contextMenu.isFolder)
                            ? (contextMenu.path.substring(0, Math.max(contextMenu.path.lastIndexOf('/'), contextMenu.path.lastIndexOf('\\'))))
                            : (contextMenu.path || projectRoot!);

                        setNameDialog({ type: 'file', parentPath: parent });
                        setNewNameInput('');
                        setContextMenu(null);
                    }}>
                        <FileText size={14} style={{ marginRight: '8px' }} /> Novo Arquivo
                    </div>
                    <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => {
                        const parent = (contextMenu.path && !contextMenu.isFolder)
                            ? (contextMenu.path.substring(0, Math.max(contextMenu.path.lastIndexOf('/'), contextMenu.path.lastIndexOf('\\'))))
                            : (contextMenu.path || projectRoot!);

                        setNameDialog({ type: 'folder', parentPath: parent });
                        setNewNameInput('');
                        setContextMenu(null);
                    }}>
                        <Folder size={14} style={{ marginRight: '8px' }} /> Nova Pasta
                    </div>

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                    {contextMenu.path && (
                        <>
                            <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => handleCopy(contextMenu.path!)}>
                                <Copy size={14} style={{ marginRight: '8px' }} /> Copiar (Ctrl+C)
                            </div>
                            <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => handleCut(contextMenu.path!)}>
                                <Scissors size={14} style={{ marginRight: '8px' }} /> Recortar (Ctrl+X)
                            </div>
                        </>
                    )}

                    {clipboard && (
                        <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => {
                            let dest = projectRoot!;
                            if (contextMenu.path) {
                                dest = (contextMenu.isFolder) ? contextMenu.path : contextMenu.path.substring(0, Math.max(contextMenu.path.lastIndexOf('/'), contextMenu.path.lastIndexOf('\\')));
                            }
                            handlePaste(dest);
                        }}>
                            <ClipboardIcon size={14} style={{ marginRight: '8px' }} /> Colar (Ctrl+V)
                        </div>
                    )}

                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                    {contextMenu.path && (
                        <>
                            <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => {
                                if (contextMenu.path) {
                                    navigator.clipboard.writeText(contextMenu.path);
                                    setContextMenu(null);
                                }
                            }}>
                                <FileText size={14} style={{ marginRight: '8px' }} /> Copiar Caminho
                            </div>

                            <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

                            <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={() => {
                                const fileName = contextMenu.path?.split(/[\\/]/).pop() || '';
                                startRenaming(contextMenu.path!, fileName);
                            }}>
                                <Edit2 size={14} style={{ marginRight: '8px' }} /> Renomear (F2)
                            </div>

                            <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px' }} onClick={async () => {
                                if (contextMenu.path) {
                                    await window.electronAPI.duplicateFile(contextMenu.path);
                                    if (onFileCopied) onFileCopied();
                                    setContextMenu(null);
                                }
                            }}>
                                <Copy size={14} style={{ marginRight: '8px' }} /> Duplicar
                            </div>

                            <div className="hover-item" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} onClick={async () => {
                                if (contextMenu.path) {
                                    await window.electronAPI.deleteFile(contextMenu.path);
                                    if (onFileCopied) onFileCopied();
                                    if (onFileDeleted) onFileDeleted(contextMenu.path);
                                    setContextMenu(null);
                                }
                            }}>
                                <Trash2 size={14} style={{ marginRight: '8px' }} /> Excluir (Del)
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Name Input Modal */}
            {nameDialog && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 2000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setNameDialog(null)}>
                    <div onClick={e => e.stopPropagation()} style={{
                        background: '#1e293b', border: '1px solid var(--accent-color)', borderRadius: '6px',
                        padding: '12px', width: '250px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#fff' }}>
                            {nameDialog.type === 'file' ? 'Novo Arquivo' : 'Nova Pasta'}
                        </div>
                        <input
                            autoFocus
                            value={newNameInput}
                            onChange={e => setNewNameInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleCreateItem();
                                if (e.key === 'Escape') setNameDialog(null);
                            }}
                            placeholder="Nome..."
                            style={{
                                width: '100%', background: '#0f172a', border: '1px solid var(--border-color)',
                                color: '#fff', padding: '4px 8px', borderRadius: '4px', outline: 'none', fontSize: '13px'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '6px' }}>
                            <button onClick={() => setNameDialog(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleCreateItem} style={{ background: 'var(--accent-color)', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '2px', cursor: 'pointer' }}>Criar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
