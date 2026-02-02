import React, { useState, useRef, useEffect } from 'react';
import { Bot, Terminal as TerminalIcon, Minus, Square, X, ChevronDown } from 'lucide-react';

interface TitleBarProps {
    onToggleChat?: () => void;
    showChat?: boolean;
    onToggleTerminal?: () => void;
    showTerminal?: boolean;
    onNewFile?: () => void;
    onOpenFile?: () => void;
    onOpenFolder?: () => void;
    onSave?: () => void;
    onSaveAs?: () => void;
    onCloseProject?: () => void;
    recentProjects?: string[];
    onOpenRecentProject?: (path: string) => void;
    onCloseEditor?: () => void;
    onRevertFile?: () => void;
    autoSave?: boolean;
    onToggleAutoSave?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
    onToggleChat, showChat, onToggleTerminal, showTerminal,
    onNewFile, onOpenFile, onOpenFolder, onSave, onSaveAs, onCloseProject,
    recentProjects = [], onOpenRecentProject,
    onCloseEditor, onRevertFile, autoSave, onToggleAutoSave
}) => {
    const [fileMenuOpen, setFileMenuOpen] = useState(false);
    const [recentSubmenuOpen, setRecentSubmenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setFileMenuOpen(false);
                setRecentSubmenuOpen(false);
            }
        };
        if (fileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [fileMenuOpen]);

    const menuItemStyle: React.CSSProperties = {
        padding: '6px 24px 6px 12px',
        fontSize: '13px',
        color: '#e2e8f0',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        whiteSpace: 'nowrap'
    };

    const shortcutStyle: React.CSSProperties = {
        fontSize: '11px',
        color: '#64748b',
        marginLeft: '24px'
    };

    const MenuItem = ({ label, shortcut, onClick, disabled }: { label: string; shortcut?: string; onClick?: () => void; disabled?: boolean }) => (
        <div
            onClick={() => { if (!disabled && onClick) { onClick(); setFileMenuOpen(false); } }}
            style={{ ...menuItemStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer' }}
            className={disabled ? '' : 'hover-item'}
        >
            <span>{label}</span>
            {shortcut && <span style={shortcutStyle}>{shortcut}</span>}
        </div>
    );

    const Separator = () => <div style={{ height: '1px', background: '#334155', margin: '4px 0' }} />;

    return (
        <div
            style={{
                height: '30px',
                WebkitAppRegion: 'drag',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '10px',
                paddingRight: '10px',
                justifyContent: 'space-between',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                userSelect: 'none',
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000
            } as React.CSSProperties & { WebkitAppRegion?: string }}
            className="title-bar glass"
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src="./icons.png" alt="Logo" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '8px' }}>AntNote</span>

                {/* Menu Arquivo */}
                <div ref={menuRef} style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as any}>
                    <button
                        onClick={() => setFileMenuOpen(!fileMenuOpen)}
                        style={{
                            background: fileMenuOpen ? '#334155' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                        className="hover:bg-slate-700"
                    >
                        Arquivo <ChevronDown size={12} />
                    </button>

                    {fileMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '2px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '4px 0',
                            minWidth: '220px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            zIndex: 2000
                        }}>
                            <MenuItem label="Novo Arquivo de Texto" shortcut="Ctrl+N" onClick={onNewFile} />
                            <MenuItem label="Novo Arquivo..." shortcut="Ctrl+Alt+N" onClick={onNewFile} />
                            <MenuItem label="Nova Janela" shortcut="Ctrl+Shift+N" onClick={() => window.electronAPI.newWindow()} />
                            <MenuItem label="Nova Janela com Perfil" disabled />
                            <Separator />
                            <MenuItem label="Abrir Arquivo..." shortcut="Ctrl+O" onClick={onOpenFile} />
                            <MenuItem label="Abrir Pasta..." shortcut="Ctrl+K Ctrl+O" onClick={onOpenFolder} />

                            {/* Submenu Recentes */}
                            <div
                                style={{ ...menuItemStyle, position: 'relative' }}
                                className="hover-item"
                                onMouseEnter={() => setRecentSubmenuOpen(true)}
                                onMouseLeave={() => setRecentSubmenuOpen(false)}
                            >
                                <span>Abrir Recente</span>
                                <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />

                                {recentSubmenuOpen && recentProjects.length > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        left: '100%',
                                        top: 0,
                                        marginLeft: '2px',
                                        background: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        padding: '4px 0',
                                        minWidth: '200px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                                    }}>
                                        {recentProjects.map((p, i) => (
                                            <div
                                                key={i}
                                                onClick={() => { onOpenRecentProject?.(p); setFileMenuOpen(false); }}
                                                style={{ ...menuItemStyle }}
                                                className="hover-item"
                                            >
                                                {p.split(/[\\/]/).pop()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Separator />
                            <MenuItem label="Salvar" shortcut="Ctrl+S" onClick={onSave} />
                            <MenuItem label="Salvar Como..." shortcut="Ctrl+Shift+S" onClick={onSaveAs} />
                            <div
                                onClick={() => { if (onToggleAutoSave) { onToggleAutoSave(); setFileMenuOpen(false); } }}
                                style={{ ...menuItemStyle, cursor: 'pointer' }}
                                className="hover-item"
                            >
                                <span>Salvamento Automático</span>
                                <span style={{ fontSize: '11px', color: autoSave ? '#22c55e' : '#64748b' }}>{autoSave ? '✓' : ''}</span>
                            </div>
                            <Separator />
                            <MenuItem label="Reverter Arquivo" onClick={onRevertFile} />
                            <MenuItem label="Fechar Editor" shortcut="Ctrl+W" onClick={onCloseEditor} />
                            <MenuItem label="Fechar Pasta" onClick={onCloseProject} />
                            <MenuItem label="Fechar Janela" shortcut="Ctrl+Shift+W" onClick={() => window.electronAPI.closeWindow()} />
                            <Separator />
                            <MenuItem label="Sair" shortcut="Alt+F4" onClick={() => window.electronAPI.closeWindow()} />
                        </div>
                    )}
                </div>

                {/* Shortcuts - After Menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', WebkitAppRegion: 'no-drag' } as any}>
                    <button
                        onClick={onToggleTerminal}
                        title={showTerminal ? "Ocultar Terminal" : "Abrir Terminal"}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: showTerminal ? 'var(--accent-color)' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '24px',
                            width: '24px',
                            borderRadius: '4px'
                        }}
                        className="hover:bg-slate-700"
                    >
                        <TerminalIcon size={16} />
                    </button>

                    <button
                        onClick={onToggleChat}
                        title={showChat ? "Ocultar IA" : "Chat Antagonista"}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: showChat ? '#eab308' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '24px',
                            width: '24px',
                            borderRadius: '4px'
                        }}
                        className="hover:bg-slate-700"
                    >
                        <Bot size={16} />
                    </button>
                </div>
            </div>

            {/* Window Controls (Custom) - Right Side */}
            <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={() => window.electronAPI.minimizeWindow()}
                    title="Minimizar"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        width: '40px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    className="hover:bg-slate-700"
                >
                    <Minus size={16} />
                </button>
                <button
                    onClick={() => window.electronAPI.maximizeWindow()}
                    title="Maximizar"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        width: '40px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    className="hover:bg-slate-700"
                >
                    <Square size={14} />
                </button>
                <button
                    onClick={() => window.electronAPI.closeWindow()}
                    title="Fechar"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        width: '46px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
