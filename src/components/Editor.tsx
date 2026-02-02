import React, { useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { vue } from '@codemirror/lang-vue';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { search, selectNextOccurrence } from '@codemirror/search';
import { lintKeymap, forEachDiagnostic, Diagnostic } from '@codemirror/lint';
import { autocompletion, acceptCompletion, completionKeymap } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
import { SearchWidget } from './SearchWidget';

interface EditorProps {
    content: string;
    onChange: (value: string) => void;
    language?: string;
    showSearch: boolean;
    onToggleSearch: () => void;
    onDiagnosticsChange?: (diagnostics: any[]) => void;
}

const scrollTheme = EditorView.theme({
    '&': { height: '100%' },
    '.cm-scroller': { overflow: 'auto !important' },
    '.cm-content': { minHeight: '100%' },
    '.cm-gutters': { minHeight: '100%' },
    '.cm-panels': { display: 'none !important' }
});

export const Editor: React.FC<EditorProps> = ({ content, onChange, language = 'text', showSearch, onToggleSearch, onDiagnosticsChange }) => {
    const [view, setView] = useState<EditorView | null>(null);
    const lastDiagnosticsRef = useRef<string>('');

    const customKeymap = keymap.of([
        {
            key: "Mod-f",
            run: () => {
                onToggleSearch();
                return true;
            },
            preventDefault: true
        },
        {
            key: "Escape",
            run: () => {
                if (showSearch) {
                    onToggleSearch();
                    return true;
                }
                return false;
            }
        },
        {
            key: "Mod-d",
            run: selectNextOccurrence,
            preventDefault: true
        }
    ]);

    const diagnosticsListener = EditorView.updateListener.of((update) => {
        if (onDiagnosticsChange) {
            const diagnostics: Diagnostic[] = [];
            forEachDiagnostic(update.state, (d: Diagnostic) => {
                diagnostics.push(d);
            });

            const serialized = JSON.stringify(diagnostics.map((d: Diagnostic) => ({ from: d.from, to: d.to, msg: d.message })));

            if (serialized !== lastDiagnosticsRef.current) {
                lastDiagnosticsRef.current = serialized;

                const problems = diagnostics.map((d: Diagnostic) => {
                    const lineInfo = update.state.doc.lineAt(d.from);
                    return {
                        message: d.message,
                        severity: d.severity, // 'error' | 'warning' | 'info'
                        line: lineInfo.number,
                        col: d.from - lineInfo.from + 1,
                        source: d.source || 'linter'
                    };
                });

                onDiagnosticsChange(problems);
            }
        }
    });

    const extensions = [
        scrollTheme,
        search({ top: true }),
        customKeymap,
        diagnosticsListener,
        keymap.of(lintKeymap),
        Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
        keymap.of(completionKeymap),
        autocompletion({
            activateOnTyping: true,
            maxRenderedOptions: 15,
            defaultKeymap: true,
            closeOnBlur: false
        })
    ];

    // Mapeamento de linguagens
    const langMap: Record<string, () => any> = {
        'javascript': () => javascript({ jsx: true }),
        'javascriptreact': () => javascript({ jsx: true }),
        'typescript': () => javascript({ jsx: true, typescript: true }),
        'typescriptreact': () => javascript({ jsx: true, typescript: true }),
        'python': () => python(),
        'html': () => html(),
        'css': () => css(),
        'scss': () => css(),
        'sass': () => css(),
        'less': () => css(),
        'json': () => json(),
        'markdown': () => markdown(),
        'rust': () => rust(),
        'go': () => go(),
        'java': () => java(),
        'cpp': () => cpp(),
        'c': () => cpp(),
        'php': () => php(),
        'sql': () => sql(),
        'xml': () => xml(),
        'svg': () => xml(),
        'yaml': () => yaml(),
        'yml': () => yaml(),
        'vue': () => vue(),
        'shell': () => StreamLanguage.define(shell),
        'bash': () => StreamLanguage.define(shell),
        'sh': () => StreamLanguage.define(shell),
        'powershell': () => StreamLanguage.define(shell),
        'lua': () => StreamLanguage.define(lua),
        'ruby': () => StreamLanguage.define(ruby),
        'dockerfile': () => StreamLanguage.define(dockerFile),
        'toml': () => StreamLanguage.define(toml)
    };

    if (langMap[language]) {
        extensions.push(langMap[language]());
    }

    const handleCreateEditor = (view: EditorView) => {
        setView(view);
    };

    return (
        <div style={{
            height: '100%',
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        }}>
            {showSearch && <SearchWidget view={view} onClose={onToggleSearch} />}

            <CodeMirror
                value={content}
                height="100%"
                theme={oneDark}
                extensions={extensions}
                onChange={(val) => onChange(val)}
                onCreateEditor={handleCreateEditor}
                style={{
                    fontSize: '14px',
                    fontFamily: 'var(--font-mono)',
                    flex: 1,
                    overflow: 'hidden'
                }}
                basicSetup={{
                    lineNumbers: true,
                    highlightActiveLineGutter: true,
                    highlightActiveLine: true,
                    foldGutter: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: false,
                    rectangularSelection: true,
                    crosshairCursor: false,
                    highlightSelectionMatches: true,
                    searchKeymap: false,
                    completionKeymap: false,
                }}
            />
        </div>
    );
};
