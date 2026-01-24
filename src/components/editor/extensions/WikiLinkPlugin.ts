import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Regex for [[Link]] or [[Link|Label]] or [[Link#^block]]
// Captures full brackets [[...]]
const wikiLinkRegex = /\[\[(.*?)\]\]/g;

class WikiLinkWidget extends WidgetType {
    readonly displayText: string;
    readonly originalTarget: string;

    constructor(displayText: string, originalTarget: string) {
        super();
        this.displayText = displayText;
        this.originalTarget = originalTarget;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-md-link"; // Re-use md link styling
        span.textContent = this.displayText;
        span.style.cursor = "pointer";
        // We can add data attribute to identify it?
        span.dataset.linkTarget = this.originalTarget;
        return span;
    }

    ignoreEvent() { return false; }
}

export const wikiLinkPlugin = ViewPlugin.fromClass(class {
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
        const { from, to } = view.viewport;
        const text = view.state.doc.sliceString(from, to);
        const ranges = view.state.selection.ranges;
        
        let match;
        while ((match = wikiLinkRegex.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            
            // Check if cursor is touching this link
            // Expanded logic: overlap includes touching start/end to allow entering
            let isSelected = false;
            for (const range of ranges) {
                if (range.from >= start && range.from <= end) {
                    isSelected = true; 
                    break;
                }
                if (range.to >= start && range.to <= end) {
                    isSelected = true; 
                    break;
                }
                // Check if selection covers the link fully
                if (range.from < start && range.to > end) {
                    isSelected = true;
                    break;
                }
            }

            const content = match[1]; // "Link" or "Link|Alias"
            let target = content;
            let display = content;

            const pipeIndex = content.indexOf('|');
            if (pipeIndex !== -1) {
                target = content.slice(0, pipeIndex);
                display = content.slice(pipeIndex + 1).replace(/\s\^[a-zA-Z0-9-]+$/, '');
            }

            if (isSelected) {
                // Show raw text with styling
                builder.add(start, end, Decoration.mark({ 
                    class: 'cm-link', // or keep custom class
                    attributes: { 'data-link-target': target } 
                }));
            } else {
                // Live Preview: Replace with widget
                builder.add(start, end, Decoration.replace({
                    widget: new WikiLinkWidget(display, target)
                }));
            }
        }
        
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
