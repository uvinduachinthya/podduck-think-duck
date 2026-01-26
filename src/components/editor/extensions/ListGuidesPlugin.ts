import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

export const listGuidesPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.getDecorations(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.getDecorations(update.view);
        }
    }

    getDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const { state } = view;

        for (const { from, to } of view.visibleRanges) {
            const startLine = state.doc.lineAt(from);
            const endLine = state.doc.lineAt(to);

            for (let i = startLine.number; i <= endLine.number; i++) {
                const line = state.doc.line(i);
                const text = line.text;
                
                // Check if it's a list item
                // Starts with whitespace, then bullet/number
                const listMatch = text.match(/^(\s*)([-*+]|\d+\.)\s/);
                
                if (listMatch) {
                    const indent = listMatch[1];
                    let pos = 0;
                    const step = 4; // Standardize on 4 spaces for the guide lines to avoid noise
                    
                    while (pos < indent.length) {
                        // Mark the full block of 4 spaces
                        if (pos + step <= indent.length) {
                             builder.add(line.from + pos, line.from + pos + step, Decoration.mark({
                                 class: 'cm-indent-guide' 
                             }));
                        }
                        pos += step;
                    }
                }
            }
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
