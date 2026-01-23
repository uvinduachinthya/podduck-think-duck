import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Regex for [[Link]] or [[Link|Label]] or [[Link#^block]]
// Captures full brackets [[...]]
const wikiLinkRegex = /\[\[(.*?)\]\]/g;

export const wikiLinkPlugin = ViewPlugin.fromClass(class {
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
        const { from, to } = view.viewport;
        const text = view.state.doc.sliceString(from, to);
        
        let match;
        while ((match = wikiLinkRegex.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            
            // Apply styling processing to the whole link
            builder.add(start, end, Decoration.mark({ 
                class: 'cm-link',
                attributes: { 'data-link-target': match[1] } // Store target for easier clicking
            }));
        }
        
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
