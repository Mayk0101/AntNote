import React, { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { Send, User, X, Plus, Trash2, Clock } from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    timestamp: number;
}

interface ChatPanelProps {
    isVisible: boolean;
    onClose: () => void;
    activeTab?: { name: string; content: string; language: string; path: string } | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ isVisible, onClose, activeTab: _activeTab }) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [lastUsage, setLastUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await window.electronAPI.getChatHistory();
                if (data && data.sessions && data.sessions.length > 0) {
                    setSessions(data.sessions);
                    setCurrentId(data.currentSessionId || data.sessions[0].id);
                } else {
                    handleNewChat();
                }
            } catch (e) {
                console.error("Failed to load history", e);
                handleNewChat();
            }
        };
        if (isVisible) loadHistory();
    }, [isVisible]);

    // Auto-save on change
    useEffect(() => {
        if (sessions.length > 0) {
            const timer = setTimeout(() => {
                window.electronAPI.saveChatHistory({ sessions, currentSessionId: currentId });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [sessions, currentId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [sessions, currentId]);

    const getCurrentSession = () => sessions.find(s => s.id === currentId);

    const handleNewChat = () => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'Nova Conversa',
            messages: [{
                role: 'assistant',
                content: 'Olá, como posso ajudar você hoje?'
            }],
            timestamp: Date.now()
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentId(newSession.id);
        setShowHistory(false);
        setLastUsage(null);
    };

    const handleDeleteSession = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSessions = sessions.filter(s => s.id !== id);
        setSessions(newSessions);
        if (currentId === id) {
            setCurrentId(newSessions.length > 0 ? newSessions[0].id : null);
            if (newSessions.length === 0) handleNewChat();
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userMsg = input.trim();
        setInput('');

        // Update Title if it's the first user message
        const currentSession = getCurrentSession();
        const isFirstUserMsg = currentSession?.messages.length === 1;

        setSessions(prev => prev.map(s => {
            if (s.id === currentId) {
                return {
                    ...s,
                    title: isFirstUserMsg ? (userMsg.slice(0, 30) + (userMsg.length > 30 ? '...' : '')) : s.title,
                    messages: [...s.messages, { role: 'user', content: userMsg }],
                    timestamp: Date.now()
                };
            }
            return s;
        }));

        setIsLoading(true);

        try {
            const contextMessage = userMsg;
            // File context disabled as per user request for stability
            // if (activeTab) { ... }

            const currentMsgs = sessions.find(s => s.id === currentId)?.messages || [];
            const historyForAi = [...currentMsgs, { role: 'user', content: userMsg }];

            const result = await window.electronAPI.askAntagonista(contextMessage, historyForAi);

            if (result.success) {
                if (result.usage) setLastUsage(result.usage);
                setSessions(prev => prev.map(s => {
                    if (s.id === currentId) {
                        return { ...s, messages: [...s.messages, { role: 'assistant', content: result.response || '' }] };
                    }
                    return s;
                }));
            } else {
                setSessions(prev => prev.map(s => {
                    if (s.id === currentId) {
                        return { ...s, messages: [...s.messages, { role: 'assistant', content: `Erro: ${result.error}` }] };
                    }
                    return s;
                }));
            }
        } catch (error) {
            setSessions(prev => prev.map(s => {
                if (s.id === currentId) {
                    return { ...s, messages: [...s.messages, { role: 'assistant', content: "Erro de comunicação com o sistema." }] };
                }
                return s;
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatContent = (text: string) => {
        if (!text) return null;

        // Custom Tag Pre-processor for stubborn AI
        // Converts [CODE]language ... [/CODE] to ```language ... ```
        // Also fixes indentation tokens (» -> 4 spaces) inside the code content
        let processedText = text;

        // Match [CODE] blocks to process indentation only inside them
        processedText = processedText.replace(/\[CODE\](\w*)([\s\S]*?)\[\/CODE\]/g, (_match, lang, code) => {
            // Replace '»' with 4 spaces inside the code block and trim extra newlines
            const cleanCode = code.replace(/»/g, '    ').trim();
            return '```' + lang + '\n' + cleanCode + '\n```';
        });

        // Fallback for any leftover [CODE] tags (though regex above should catch pairs)
        processedText = processedText.replace(/\[CODE\](\w*)/g, '```$1');
        processedText = processedText.replace(/\[\/CODE\]/g, '```');

        // Split by code blocks (catch unclosed ones at the end too)
        // Regex: (```language? \n content ```) OR (```language? \n content $ (unclosed))
        const parts = processedText.split(/(```[\w-]*\n[\s\S]*?(?:```|$))/g);

        return parts.map((part, index) => {
            if (part.startsWith('```')) {
                const firstLineEnd = part.indexOf('\n');
                let language = 'text';
                let content = '';

                if (firstLineEnd !== -1) {
                    const langStr = part.substring(3, firstLineEnd).trim();
                    if (langStr) language = langStr;
                    content = part.substring(firstLineEnd + 1);
                } else {
                    // Just ``` without newline
                    content = part.substring(3);
                }

                // Remove closing ``` if present
                if (content.endsWith('```')) {
                    content = content.substring(0, content.length - 3);
                } else if (content.endsWith('```\n')) { // edge case
                    content = content.substring(0, content.length - 4);
                }

                const CodeBlock: React.FC<{ language: string; content: string }> = ({ language, content }) => {
                    const [copied, setCopied] = useState(false);

                    const handleCopy = () => {
                        navigator.clipboard.writeText(content);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    };

                    // Determine extensions based on language
                    const getExtensions = () => {
                        const lang = language.toLowerCase();
                        const exts = [EditorView.lineWrapping]; // Wrap long lines
                        if (lang.includes('js') || lang.includes('type') || lang.includes('react')) exts.push(javascript({ jsx: true, typescript: true }));
                        else if (lang.includes('py')) exts.push(python());
                        else if (lang.includes('html')) exts.push(html());
                        else if (lang.includes('css')) exts.push(css());
                        else if (lang.includes('json')) exts.push(json());
                        else if (lang.includes('md') || lang.includes('mark')) exts.push(markdown());
                        return exts;
                    };

                    return (
                        <div style={{ margin: '12px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxWidth: '100%' }}>
                            <div style={{ background: '#1e293b', padding: '6px 12px', fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{language}</span>
                                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{content.split('\n').length} linhas</span>
                                </div>
                                <button
                                    onClick={handleCopy}
                                    style={{
                                        background: 'transparent',
                                        border: '1px solid #334155',
                                        borderRadius: '4px',
                                        color: copied ? '#4ade80' : '#cbd5e1',
                                        cursor: 'pointer',
                                        padding: '2px 8px',
                                        fontSize: '10px',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    {copied ? (
                                        <><span>✓</span> Copiado</>
                                    ) : (
                                        <><span>📋</span> Copiar</>
                                    )}
                                </button>
                            </div>
                            <div style={{ fontSize: '13px', background: '#0f172a' }}>
                                <CodeMirror
                                    value={content}
                                    theme={oneDark}
                                    extensions={getExtensions()}
                                    editable={false}
                                    readOnly={true}
                                    basicSetup={{
                                        lineNumbers: false,
                                        foldGutter: false,
                                        highlightActiveLine: false,
                                        highlightActiveLineGutter: false,
                                        dropCursor: false,
                                        allowMultipleSelections: true,
                                        indentOnInput: false,
                                    }}
                                    style={{
                                        fontSize: '13px',
                                        fontFamily: 'var(--font-mono)',
                                    }}
                                />
                            </div>
                        </div>
                    );
                };
                return <CodeBlock key={index} language={language} content={content} />;
            }
            // Normal text: render paragraphs
            return part.split('\n\n').map((p, idx) => {
                if (!p.trim()) return null;
                return <p key={`${index}-${idx}`} style={{ whiteSpace: 'pre-wrap', margin: '8px 0', lineHeight: '1.6' }}>{p}</p>;
            });
        });
    };

    // --- Helpers for Token Estimation ---
    const calculateTokens = (text: string) => Math.ceil(text.length / 4);

    const getInputTokens = () => {
        return calculateTokens(input);
    };

    const currentTokens = getInputTokens();
    const tokenColor = currentTokens > 1500 ? '#ef4444' : currentTokens > 800 ? '#eab308' : '#64748b';

    if (!isVisible) return null;

    const currentSession = getCurrentSession();

    return (
        <div style={{
            width: '350px',
            background: '#0f172a',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            flexShrink: 0,
            zIndex: 50
        }}>
            {/* Header */}
            <div style={{
                padding: '0 16px',
                height: '40px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#1e293b'
            }}>
                {showHistory ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                        <Clock size={16} color="#94a3b8" />
                        <span>Histórico</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                        <img src="./icons.png" alt="AI" style={{ width: '16px', height: '16px' }} />
                        <span>Antagonista v1.2</span>
                        {lastUsage && (
                            <span style={{ fontSize: '10px', color: '#64748b', marginLeft: '8px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }} title="Estimativa de Tokens (Prompt + Resposta)">
                                ~{lastUsage.total_tokens}t
                            </span>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        title="Histórico"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: showHistory ? '#fff' : '#94a3b8' }}
                    >
                        <Clock size={16} />
                    </button>
                    <button
                        onClick={handleNewChat}
                        title="Novo Chat"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        onClick={onClose}
                        title="Fechar"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {showHistory ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0', display: 'flex', flexDirection: 'column' }}>
                    {sessions.map(s => (
                        <div
                            key={s.id}
                            onClick={() => { setCurrentId(s.id); setShowHistory(false); }}
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                cursor: 'pointer',
                                background: s.id === currentId ? 'rgba(255,255,255,0.05)' : 'transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                            className="hover:bg-slate-800"
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                <span style={{ color: '#e2e8f0', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{s.title}</span>
                                <span style={{ color: '#64748b', fontSize: '11px' }}>{new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString().slice(0, 5)}</span>
                            </div>
                            <button
                                onClick={(e) => handleDeleteSession(e, s.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }}
                                title="Excluir"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                            Nenhum histórico encontrado.
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {currentSession?.messages.map((msg, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                gap: '12px',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                            }}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: msg.role === 'user' ? '#3b82f6' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    overflow: 'hidden'
                                }}>
                                    {msg.role === 'user' ? <User size={16} color="#fff" /> : <img src="./icons.png" alt="AI" style={{ width: '20px', height: '20px' }} />}
                                </div>
                                <div style={{
                                    background: msg.role === 'user' ? '#1e293b' : 'transparent',
                                    padding: msg.role === 'user' ? '8px 12px' : '0',
                                    borderRadius: '8px',
                                    maxWidth: '85%',
                                    fontSize: '13px',
                                    color: '#e2e8f0',
                                    userSelect: 'text', // Allow selection
                                    cursor: 'text'
                                }}>
                                    {formatContent(msg.content)}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                    <img src="./icons.png" alt="AI" style={{ width: '20px', height: '20px' }} />
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                                    Pensando...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input with Token Counter */}
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: '#0f172a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Entrada</span>
                            <span style={{ fontSize: '10px', color: tokenColor, transition: 'color 0.3s' }} title="Estimativa de Tokens">
                                ~{currentTokens} tokens
                            </span>
                        </div>
                        <div style={{
                            display: 'flex',
                            background: '#1e293b',
                            borderRadius: '6px',
                            padding: '8px',
                            border: '1px solid #334155'
                        }}>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Pergunte ao v1.2..."
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '13px',
                                    resize: 'none',
                                    height: '40px',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                                    color: isLoading || !input.trim() ? '#475569' : '#3b82f6',
                                    padding: '0 8px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
