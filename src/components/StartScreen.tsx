import React from 'react';
import { FilePlus, FolderOpen, Folder, Clock } from 'lucide-react';

interface StartScreenProps {
    onNewFile: () => void;
    onOpenFile: () => void;
    onOpenFolder?: () => void;
    recentProjects?: string[];
    onOpenRecent?: (path: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onNewFile, onOpenFile, onOpenFolder, recentProjects = [], onOpenRecent }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'linear-gradient(135deg, var(--bg-primary) 0%, #0a1628 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background decoration */}
            <div style={{
                position: 'absolute',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
            }} />

            <div style={{ display: 'flex', gap: '40px', zIndex: 1, alignItems: 'center' }}>
                {/* Main Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
                        <img src="./icons.png" alt="AntNote" style={{ width: '64px', height: '64px', marginBottom: '15px' }} />
                        <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>AntNote</h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>Editor de Texto Leve e Moderno</p>
                    </div>

                    <div style={{ display: 'flex', gap: '20px' }}>
                        <button onClick={onNewFile} className="start-btn" style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '20px 25px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '12px', width: '130px', height: '110px', cursor: 'pointer', transition: 'all 0.2s ease', color: 'var(--text-primary)'
                        }}>
                            <FilePlus size={28} style={{ marginBottom: '10px', color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Novo Arquivo</span>
                        </button>
                        <button onClick={onOpenFile} className="start-btn" style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '20px 25px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)',
                            borderRadius: '12px', width: '130px', height: '110px', cursor: 'pointer', transition: 'all 0.2s ease', color: 'var(--text-primary)'
                        }}>
                            <FolderOpen size={28} style={{ marginBottom: '10px', color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Abrir Arquivo</span>
                        </button>
                        <button onClick={onOpenFolder} className="start-btn" style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '20px 25px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)',
                            borderRadius: '12px', width: '130px', height: '110px', cursor: 'pointer', transition: 'all 0.2s ease', color: 'var(--text-primary)'
                        }}>
                            <Folder size={28} style={{ marginBottom: '10px', color: 'var(--accent-color)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Abrir Pasta</span>
                        </button>
                    </div>
                    {/* Manual hover styles via CSS-in-JS or global styles is better, inline is tricky for hover. */}
                </div>

                {/* Recents */}
                {recentProjects.length > 0 && (
                    <div style={{ width: '1px', height: '300px', background: 'var(--border-color)', opacity: 0.5 }}></div>
                )}

                {recentProjects.length > 0 && (
                    <div style={{ width: '250px', maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: 'var(--text-secondary)' }}>
                            <Clock size={16} style={{ marginRight: '8px' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Recentes</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }} className="custom-scroll">
                            {recentProjects.map((path, idx) => {
                                const name = path.split(/[\\/]/).pop() || path;
                                return (
                                    <div key={idx}
                                        onClick={() => onOpenRecent && onOpenRecent(path)}
                                        style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'transparent'; }}
                                    >
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={path}>{path}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .start-btn:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
            `}</style>

            {/* Keyboard Shortcuts Hint */}
            <div style={{
                position: 'absolute',
                bottom: '30px',
                display: 'flex',
                gap: '30px',
                color: 'var(--text-secondary)',
                fontSize: '12px'
            }}>
                <span><kbd style={{ background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px', marginRight: '5px' }}>Ctrl+N</kbd> Novo</span>
                <span><kbd style={{ background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px', marginRight: '5px' }}>Ctrl+O</kbd> Abrir</span>
                <span><kbd style={{ background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px', marginRight: '5px' }}>Ctrl+S</kbd> Salvar</span>
            </div>
        </div>
    );
};
