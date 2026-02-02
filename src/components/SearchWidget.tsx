import React, { useState, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { SearchQuery, setSearchQuery, findNext, findPrevious, replaceNext, replaceAll } from '@codemirror/search';
import { ChevronRight, ChevronDown, X, ArrowUp, ArrowDown, Check } from 'lucide-react';

interface SearchWidgetProps {
    view: EditorView | null;
    onClose: () => void;
}

export const SearchWidget: React.FC<SearchWidgetProps> = ({ view, onClose }) => {
    const [searchText, setSearchText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [matchCount, setMatchCount] = useState(0);

    const [matchCase, setMatchCase] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);
    const [isRegex, setIsRegex] = useState(false);

    useEffect(() => {
        if (view) {
            const selection = view.state.sliceDoc(
                view.state.selection.main.from,
                view.state.selection.main.to
            );
            if (selection && selection.length < 100 && !selection.includes('\n')) {
                setSearchText(selection);
            }
        }
    }, [view]);

    useEffect(() => {
        if (!view) return;
        const query = new SearchQuery({
            search: searchText,
            caseSensitive: matchCase,
            literal: !isRegex,
            regexp: isRegex,
            wholeWord: wholeWord,
            replace: replaceText
        });
        view.dispatch({ effects: setSearchQuery.of(query) });

        if (!searchText) {
            setMatchCount(0);
            return;
        }

        let count = 0;
        try {
            const cursor = query.getCursor(view.state);
            while (!cursor.next().done) {
                count++;
                if (count > 1000) break;
            }
        } catch (e) {
            console.error("Regex error", e);
        }
        setMatchCount(count);

    }, [searchText, replaceText, matchCase, wholeWord, isRegex, view]);

    const handleNext = () => { if (view) findNext(view); };
    const handlePrev = () => { if (view) findPrevious(view); };
    const handleReplace = () => { if (view) replaceNext(view); };
    const handleReplaceAll = () => { if (view) replaceAll(view); };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) handlePrev();
            else handleNext();
            e.preventDefault();
        }
        if (e.key === 'Escape') {
            onClose();
            view?.focus();
        }
    };

    return (
        <div className="search-widget" style={{
            position: 'absolute',
            top: 0,
            right: 20,
            zIndex: 300,
            background: '#252526',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            borderRadius: '0 0 6px 6px',
            border: '1px solid #454545',
            borderTop: 'none',
            display: 'flex',
            flexDirection: 'column',
            width: 'auto',
            minWidth: '250px',
            maxWidth: 'calc(100% - 40px)',
            padding: '6px'
        }}>
            {/* Row 1: Find */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        color: '#cccccc',
                        flexShrink: 0
                    }}
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                <div className="input-container" style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: '0' }}>
                    <input
                        autoFocus
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Localizar..."
                        style={{
                            width: '100%',
                            background: '#3c3c3c',
                            border: '1px solid #3c3c3c',
                            color: '#cccccc',
                            padding: '4px 6px',
                            paddingRight: matchCount > 0 ? '80px' : '62px',
                            fontSize: '13px',
                            outline: 'none',
                            borderRadius: '2px',
                            minWidth: '50px'
                        }}
                    />

                    {/* Count Display */}
                    {searchText && (
                        <div style={{
                            position: 'absolute',
                            right: '64px',
                            color: '#858585',
                            fontSize: '11px',
                            pointerEvents: 'none'
                        }}>
                            {matchCount > 999 ? '999+' : matchCount}
                        </div>
                    )}

                    {/* Inline Toggles */}
                    <div style={{ position: 'absolute', right: 2, display: 'flex', gap: '0px' }}>
                        <ToggleIcon active={matchCase} onClick={() => setMatchCase(!matchCase)} label="Aa" title="Maiúsculas/Minúsculas" />
                        <ToggleIcon active={wholeWord} onClick={() => setWholeWord(!wholeWord)} label="ab" title="Palavra Inteira" />
                        <ToggleIcon active={isRegex} onClick={() => setIsRegex(!isRegex)} label=".*" title="Expressão Regular" />
                    </div>
                </div>

                {/* Nav Buttons */}
                <div style={{ display: 'flex', flexShrink: 0 }}>
                    <IconButton onClick={handlePrev} icon={<ArrowUp size={14} />} title="Anterior (Shift+Enter)" />
                    <IconButton onClick={handleNext} icon={<ArrowDown size={14} />} title="Próximo (Enter)" />
                    <IconButton onClick={onClose} icon={<X size={16} />} title="Fechar (Esc)" style={{ marginLeft: '4px' }} />
                </div>
            </div>

            {/* Row 2: Replace (Collapsible) */}
            {expanded && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', paddingLeft: '24px' }}>
                    <div className="input-container" style={{ flex: 1 }}>
                        <input
                            value={replaceText}
                            onChange={e => setReplaceText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Substituir..."
                            style={{
                                width: '100%',
                                background: '#3c3c3c',
                                border: '1px solid #3c3c3c',
                                color: '#cccccc',
                                padding: '4px 6px',
                                fontSize: '13px',
                                outline: 'none',
                                borderRadius: '2px'
                            }}
                        />
                    </div>
                    <IconButton onClick={handleReplace} icon={<Check size={14} />} title="Substituir (Enter)" />
                    <IconButton onClick={handleReplaceAll} icon={<span style={{ fontSize: '10px', fontWeight: 'bold' }}>All</span>} title="Substituir Tudo" />
                </div>
            )}
        </div>
    );
};

const ToggleIcon = ({ active, onClick, label, title }: any) => (
    <div
        onClick={onClick}
        title={title}
        style={{
            cursor: 'pointer',
            padding: '2px 3px',
            borderRadius: '2px',
            background: active ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
            color: active ? '#60a5fa' : '#858585',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            border: '1px solid transparent'
        }}
    >
        {label}
    </div>
);

const IconButton = ({ onClick, icon, title, style }: any) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            background: 'transparent',
            border: 'none',
            color: '#cccccc',
            cursor: 'pointer',
            padding: '3px',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '22px',
            ...style
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
        {icon}
    </button>
);
