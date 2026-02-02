import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, MonitorPlay, Plus, Trash2, AlertCircle, AlertTriangle, Info, Square } from 'lucide-react';

export interface Problem {
    file: string;
    message: string;
    line: number;
    col: number;
    severity: 'error' | 'warning' | 'info' | number;
    source?: string;
}

interface TerminalProps {
    isVisible: boolean;
    onClose: () => void;
    projectRoot?: string;
    problems?: Problem[];
}

export interface TerminalHandle {
    runCommand: (cmd: string) => void;
}

interface TerminalSession {
    id: string;
    name: string;
    history: string[];
    input: string;
    isRunning: boolean;
    currentProcessId: number | null;
}

const IconButton = ({ children, onClick, title }: any) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            padding: '4px',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
        }}
        className="hover:bg-slate-700 hover:text-white"
    >
        {children}
    </button>
);

const TabButton = ({ active, icon, label, onClick, badge }: any) => (
    <button
        onClick={onClick}
        style={{
            height: '100%',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: active ? '2px solid var(--accent-color)' : '2px solid transparent',
            cursor: 'pointer'
        }}
        className="hover:opacity-100"
    >
        {icon}
        {label}
        {badge !== undefined && badge > 0 && (
            <span style={{
                background: 'var(--accent-color)',
                color: '#fff',
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '10px'
            }}>{badge}</span>
        )}
    </button>
);

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ isVisible, onClose, projectRoot, problems = [] }, ref) => {
    useEffect(() => {
        console.log('Terminal Problems Prop:', problems);
    }, [problems]);

    const [activeTab, setActiveTab] = useState<'terminal' | 'problems'>('terminal');

    const [sessions, setSessions] = useState<TerminalSession[]>([
        { id: '1', name: 'powershell', history: [], input: '', isRunning: false, currentProcessId: null }
    ]);
    const [activeSessionId, setActiveSessionId] = useState('1');
    const [isMaximized, setIsMaximized] = useState(false);

    const [sidebarWidth, setSidebarWidth] = useState(140);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [terminalHeight, setTerminalHeight] = useState(300);
    const [isResizingHeight, setIsResizingHeight] = useState(false);

    const terminalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

    const updateSession = (id: string, updates: Partial<TerminalSession>) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const getPrompt = () => {
        const root = projectRoot || 'F:\\ant-edit';
        return `PS ${root}>`;
    };

    useImperativeHandle(ref, () => ({
        runCommand: async (cmd: string) => {
            setActiveTab('terminal');
            setSessions(currentSessions => {
                const session = currentSessions.find(s => s.id === activeSessionId) || currentSessions[0];
                if (!session) return currentSessions;

                const promptLine = `${getPrompt()} ${cmd}`;
                const updatedSession = {
                    ...session,
                    history: [...session.history, promptLine],
                    isRunning: true,
                    input: ''
                };
                executeCommand(cmd, session.id);

                return currentSessions.map(s => s.id === session.id ? updatedSession : s);
            });
        }
    }));

    const executeCommand = async (cmd: string, sessionId: string) => {
        try {
            const cwd = projectRoot || '.';
            const result = await window.electronAPI.runCommandStream(cmd, cwd);
            const processId = result.processId;
            setSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, currentProcessId: processId } : s
            ));

        } catch (err) {
            setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s,
                history: [...s.history, `Erro fatal: ${err}`],
                isRunning: false,
                currentProcessId: null
            } : s));
        }
    };

    useEffect(() => {
        const cleanupOutput = window.electronAPI.onTerminalOutput((data) => {
            setSessions(prev => prev.map(s => {
                if (s.currentProcessId === data.processId) {
                    const normalizedData = data.data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    const newLines = normalizedData.split('\n');
                    const filteredLines = newLines.filter((line: string, idx: number) => {
                        if (idx < newLines.length - 1) return true;
                        return line.length > 0;
                    });

                    if (filteredLines.length > 0) {
                        return { ...s, history: [...s.history, ...filteredLines] };
                    }
                }
                return s;
            }));
        });

        const cleanupExit = window.electronAPI.onTerminalExit((data) => {
            setSessions(prev => prev.map(s => {
                if (s.currentProcessId === data.processId) {
                    const exitMsg = data.code === 0
                        ? ''
                        : `Processo encerrado com código ${data.code}`;
                    const newHistory = exitMsg ? [...s.history, exitMsg] : s.history;
                    return { ...s, history: newHistory, isRunning: false, currentProcessId: null };
                }
                return s;
            }));
        });

        const cleanupError = window.electronAPI.onTerminalError((data) => {
            setSessions(prev => prev.map(s => {
                if (s.currentProcessId === data.processId) {
                    return {
                        ...s,
                        history: [...s.history, `Erro: ${data.error}`],
                        isRunning: false,
                        currentProcessId: null
                    };
                }
                return s;
            }));
        });

        return () => {
            cleanupOutput();
            cleanupExit();
            cleanupError();
        };
    }, []);

    const stopCurrentProcess = async () => {
        const session = sessions.find(s => s.id === activeSessionId);
        if (session?.currentProcessId) {
            await window.electronAPI.killProcess(session.currentProcessId);
            setSessions(prev => prev.map(s =>
                s.id === activeSessionId
                    ? { ...s, history: [...s.history, '^C'], isRunning: false, currentProcessId: null }
                    : s
            ));
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingSidebar) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 50 && newWidth < 400) {
                    setSidebarWidth(newWidth);
                }
            }
            if (isResizingHeight) {
                const newHeight = window.innerHeight - e.clientY;
                if (newHeight > 100 && newHeight < window.innerHeight - 50) {
                    setTerminalHeight(newHeight);
                }
            }
        };

        const handleMouseUp = () => {
            setIsResizingSidebar(false);
            setIsResizingHeight(false);
            document.body.style.cursor = 'default';
        };

        if (isResizingSidebar || isResizingHeight) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'ns-resize';
        } else {
            document.body.style.cursor = 'default';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isResizingSidebar, isResizingHeight]);

    const renderColoredLine = (line: string) => {
        const promptMatch = line.match(/^(PS .*?>\s)(.*)/);
        if (promptMatch) {
            const prompt = promptMatch[1];
            const fullCmd = promptMatch[2];
            const [cmd, ...args] = fullCmd.split(' ');
            return (
                <span>
                    <span style={{ color: 'var(--text-secondary)' }}>{prompt}</span>
                    <span style={{ color: '#fbbf24' }}>{cmd}</span>
                    {' '}
                    <span style={{ color: '#e2e8f0' }}>{args.join(' ')}</span>
                </span>
            );
        }
        if (line.startsWith('Erro')) {
            return <span style={{ color: '#ef4444' }}>{line}</span>;
        }
        return <span style={{ color: '#cccccc' }}>{line}</span>;
    };

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [activeSession.history, activeSession.input, activeTab]);

    useEffect(() => {
        if (isVisible && activeTab === 'terminal' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isVisible, activeTab, activeSessionId]);

    const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'c') {
            const session = sessions.find(s => s.id === activeSessionId);
            if (session?.isRunning && session?.currentProcessId) {
                e.preventDefault();
                stopCurrentProcess();
                return;
            }
        }

        if (e.key === 'Enter') {
            const current = activeSession;
            if (!current) return;

            if (!current.input.trim()) {
                updateSession(current.id, { history: [...current.history, `${getPrompt()} `] });
                return;
            }

            const cmd = current.input;
            const promptLine = `${getPrompt()} ${cmd}`;

            updateSession(current.id, {
                history: [...current.history, promptLine],
                input: '',
                isRunning: true
            });

            executeCommand(cmd, current.id);
        }
    };

    const addNewTerminal = () => {
        const newId = Date.now().toString();
        setSessions(prev => [...prev, {
            id: newId,
            name: 'powershell',
            history: [],
            input: '',
            isRunning: false,
            currentProcessId: null
        }]);
        setActiveSessionId(newId);
    };

    const removeTerminal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (sessions.length <= 1) return;

        const newSessions = sessions.filter(s => s.id !== id);
        setSessions(newSessions);
        if (activeSessionId === id) {
            setActiveSessionId(newSessions[newSessions.length - 1].id);
        }
    };

    const handleContainerClick = () => {
        if (activeTab === 'terminal') inputRef.current?.focus();
    };

    if (!isVisible) return null;

    return (
        <div style={{
            position: isMaximized ? 'fixed' : 'relative',
            top: isMaximized ? 0 : undefined,
            bottom: 0,
            left: 0,
            right: 0,
            height: isMaximized ? '100vh' : `${terminalHeight}px`,
            paddingTop: isMaximized ? '35px' : 0,
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: isMaximized ? 1000 : 10,
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--text-primary)'
        }}>
            {/* Top Resize Handle */}
            {!isMaximized && (
                <div
                    onMouseDown={() => setIsResizingHeight(true)}
                    style={{
                        position: 'absolute',
                        top: '-3px',
                        left: 0,
                        right: 0,
                        height: '6px',
                        cursor: 'ns-resize',
                        background: 'transparent',
                        zIndex: 20
                    }}
                    className="hover:bg-accent"
                />
            )}

            {/* Main Tabs Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                height: '36px'
            }}>
                <div style={{ display: 'flex', height: '100%' }}>
                    <TabButton
                        active={activeTab === 'terminal'}
                        icon={<TerminalIcon size={14} />}
                        label="TERMINAL"
                        onClick={() => setActiveTab('terminal')}
                    />
                    <TabButton
                        active={activeTab === 'problems'}
                        icon={<AlertCircle size={14} />}
                        label="PROBLEMAS"
                        badge={problems.length}
                        onClick={() => setActiveTab('problems')}
                    />
                </div>
                <div style={{ display: 'flex', gap: '4px', paddingRight: '8px' }}>
                    {activeSession.isRunning && (
                        <IconButton title="Parar Processo (Ctrl+C)" onClick={stopCurrentProcess}>
                            <Square size={14} fill="#ef4444" color="#ef4444" />
                        </IconButton>
                    )}
                    <IconButton title="Maximizar" onClick={() => setIsMaximized(!isMaximized)}>
                        {isMaximized ? <MonitorPlay size={14} /> : <Maximize2 size={14} />}
                    </IconButton>
                    <IconButton title="Fechar Panel" onClick={onClose}>
                        <X size={14} />
                    </IconButton>
                </div>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Main Content Area (Output) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {activeTab === 'terminal' && (
                        <div
                            ref={terminalRef}
                            onClick={handleContainerClick}
                            onKeyDown={handleTerminalKeyDown}
                            tabIndex={0}
                            className="custom-scroll"
                            style={{
                                flex: 1,
                                padding: '10px 15px',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                cursor: 'text',
                                fontFamily: 'Consolas, "Courier New", monospace',
                                fontSize: '14px',
                                userSelect: 'text',
                                outline: 'none'
                            }}
                        >
                            {activeSession.history.map((line, i) => (
                                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.4' }}>
                                    {renderColoredLine(line)}
                                </div>
                            ))}

                            {!activeSession.isRunning && (
                                <div style={{ display: 'flex', alignItems: 'center', lineHeight: '1.4', position: 'relative' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '6px', whiteSpace: 'nowrap' }}>{getPrompt()}</span>
                                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, pointerEvents: 'none', whiteSpace: 'pre', overflow: 'hidden', color: 'transparent' }}>
                                            {(() => {
                                                const [cmd, ...args] = activeSession.input.split(' ');
                                                return (
                                                    <>
                                                        <span style={{ color: '#fbbf24' }}>{cmd}</span>
                                                        {' '}
                                                        <span style={{ color: '#e2e8f0' }}>{args.join(' ')}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <input
                                            ref={inputRef}
                                            value={activeSession.input}
                                            onChange={e => updateSession(activeSession.id, { input: e.target.value })}
                                            onKeyDown={handleTerminalKeyDown}
                                            autoFocus
                                            spellCheck={false}
                                            autoComplete="off"
                                            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'transparent', caretColor: '#ffffff', fontFamily: 'inherit', fontSize: 'inherit', padding: 0, margin: 0, zIndex: 1 }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'problems' && (
                        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0', display: 'flex', flexDirection: 'column' }}>
                            {(!problems || problems.length === 0) ? (
                                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                                    <div style={{ marginBottom: '10px' }}><MonitorPlay size={40} opacity={0.5} /></div>
                                    <p>Nenhum problema detectado no workspace.</p>
                                    <p style={{ fontSize: '11px', marginTop: '5px' }}>Os erros de lint aparecerão aqui.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {problems.map((p, i) => (
                                        <div key={i} style={{ display: 'flex', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', userSelect: 'text' }} className="hover:bg-slate-800">
                                            <div style={{ paddingTop: '2px' }}>
                                                {p.severity === 'error' && <AlertCircle size={14} color="#ef4444" />}
                                                {p.severity === 'warning' && <AlertTriangle size={14} color="#eab308" />}
                                                {p.severity === 'info' && <Info size={14} color="#3b82f6" />}
                                                {typeof p.severity === 'number' && <AlertCircle size={14} color="#ef4444" />}
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.message}</span>
                                                    {p.source && <span style={{ color: 'var(--text-secondary)', fontSize: '10px', opacity: 0.8 }}>{p.source}</span>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textDecoration: 'underline', opacity: 0.8 }}>{p.file.split(/[\\/]/).pop()}</span>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', opacity: 0.6 }}>[{p.line}, {p.col}]</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Resizer Handle (Sidebar) */}
                {activeTab === 'terminal' && (
                    <div
                        onMouseDown={() => setIsResizingSidebar(true)}
                        style={{ width: '4px', cursor: 'col-resize', background: isResizingSidebar ? 'var(--accent-color)' : 'transparent', zIndex: 20 }}
                        className="hover:bg-slate-700"
                    />
                )}

                {/* Vertical Sidebar */}
                {activeTab === 'terminal' && (
                    <div style={{ width: `${sidebarWidth}px`, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Sessões</span>
                            <span onClick={addNewTerminal} title="Nova Sessão" style={{ cursor: 'pointer', padding: '2px', borderRadius: '3px', background: 'var(--bg-tertiary)' }}>
                                <Plus size={12} />
                            </span>
                        </div>
                        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                            {sessions.map(s => (
                                <div key={s.id} onClick={() => setActiveSessionId(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', cursor: 'pointer', background: activeSessionId === s.id ? 'var(--bg-tertiary)' : 'transparent', color: activeSessionId === s.id ? 'var(--accent-color)' : 'var(--text-secondary)', borderLeft: activeSessionId === s.id ? '2px solid var(--accent-color)' : '2px solid transparent', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                    <TerminalIcon size={12} style={{ flexShrink: 0 }} />
                                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.id === '1' ? 'powershell' : `bash (${s.id.slice(-3)})`}</div>
                                    {sessions.length > 1 && (
                                        <div onClick={(e) => removeTerminal(s.id, e)} style={{ opacity: 0.6 }} className="hover:text-red-500 hover:opacity-100">
                                            <Trash2 size={12} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
