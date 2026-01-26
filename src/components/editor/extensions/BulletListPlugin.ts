import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

class BulletWidget extends WidgetType {
    constructor() {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'bullet-point';
        const dot = document.createElement('span');
        dot.className = 'bullet-dot';
        span.appendChild(dot);
        return span;
    }
}

export const bulletListPlugin = ViewPlugin.fromClass(class {
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

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(state).iterate({
                from, to,
                enter: (node) => {
                    if (node.name === 'ListMark') {
                        // Check if it's an unordered list mark (hyphen, asterisk, plus)
                        const markText = state.sliceDoc(node.from, node.to);
                        if (/^[-*+]\s?$/.test(markText)) {
                             builder.add(node.from, node.to, Decoration.replace({
                                 widget: new BulletWidget()
                             }));
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
