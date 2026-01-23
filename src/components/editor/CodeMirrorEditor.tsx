import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, Decoration, type DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { CodeMirrorSmoothCursor } from './CodeMirrorSmoothCursor';
import { useState } from 'react';

// --- Theme ---
const editorTheme = EditorView.theme({
    "&": {
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        height: "100%",
        fontSize: "16px",
    },
    "&.cm-focused": {
        outline: "none",
    },
    ".cm-content": {
        fontFamily: "var(--font-family)",
        padding: "0",
        maxWidth: "900px", 
        margin: "0 auto",
    },
    ".cm-line": {
        padding: "0.2em 0",
        lineHeight: "1.6",
    },
    ".cm-cursor, .cm-dropCursor": {
        display: "none !important", // Hide native cursor in favor of smooth cursor
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--primary-faded) !important",
    },
    ".cm-activeLine": {
        backgroundColor: "transparent",
    },
    ".cm-gutters": {
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-muted)",
        border: "none",
    },
    // Markdown Specifics
    ".cm-header": {
        fontWeight: "bold",
        color: "var(--text-primary)",
    },
    ".cm-header-1": { fontSize: "2.0em", lineHeight: "1.2", marginBottom: "0.5em" },
    ".cm-header-2": { fontSize: "1.6em", lineHeight: "1.3", marginBottom: "0.5em" },
    ".cm-header-3": { fontSize: "1.4em", marginBottom: "0.5em" },
    ".cm-quote": {
        borderLeft: "4px solid var(--border-color)",
        paddingLeft: "1em",
        color: "var(--text-secondary)",
        fontStyle: "italic"
    },
    ".cm-link": {
        color: "var(--primary-color)",
        textDecoration: "underline"
    },
    ".cm-url": {
        color: "var(--text-tertiary)",
    }
});

// --- Live Preview Plugins ---

const headerPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
        this.decorations = this.getDecorations(view);
    }
    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.getDecorations(update.view);
        }
    }
    getDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const { state } = view;
        const selectionInfo = state.selection.ranges[0]; // Simple selection check

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(state).iterate({
                from, to,
                enter: (node) => {
                    if (node.name.startsWith("ATXHeading")) {
                        // Check if cursor is on this line
                        const line = state.doc.lineAt(node.from);
                        const isFocused = selectionInfo.from >= line.from && selectionInfo.to <= line.to;

                        if (!isFocused) {
                           // Find the hashmarks
                           const text = state.sliceDoc(node.from, node.to);
                           const match = text.match(/^#+\s/);
                           if (match) {
                               // Hide the hashmarks
                               builder.add(node.from, node.from + match[0].length, Decoration.replace({}));
                           }
                        }
                    }
                }
            });
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});


interface CodeMirrorEditorProps {
    content: string;
    onChange: (value: string) => void;
    onEditorReady?: (view: EditorView) => void;
}

export function CodeMirrorEditor({ content, onChange, onEditorReady }: CodeMirrorEditorProps) {
    
    // Auto-save wrapper
    const handleChange = useCallback((val: string) => {
        onChange(val);
    }, [onChange]);

    const extensions = useMemo(() => [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        editorTheme,
        EditorView.updateListener.of((update) => {
             if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                 // Dispatch event for React component to pick up
                 update.view.dom.dispatchEvent(new Event('cm-update'));
             }
        }),
        headerPlugin,
        // Add more live preview plugins here
    ], []);

    const [view, setView] = useState<EditorView | null>(null);

    return (
        <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
            <CodeMirror
                value={content}
                height="100%"
                extensions={extensions}
                onChange={handleChange}
                onCreateEditor={(v) => {
                    setView(v);
                    if (onEditorReady) onEditorReady(v);
                }}
                theme="none"
                basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    highlightActiveLine: false,
                }}
            />
            <CodeMirrorSmoothCursor view={view} />
        </div>
    );
}
