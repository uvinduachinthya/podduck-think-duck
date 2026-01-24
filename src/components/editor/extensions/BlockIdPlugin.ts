import { Extension } from "@uiw/react-codemirror";
import { ViewPlugin, Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Regex for block ID at end of line: whitespace + ^ + alphanumeric/dash
const blockIdRegex = /\s\^[a-zA-Z0-9-]+$/;

class HiddenBlockIdWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        // We can leave it empty to completely hide it
        // or add a class if we want to show a subtle icon on hover
        span.className = "cm-block-id-hidden";
        return span;
    }
}

const blockIdPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.getDecorations(view);
        }

        update(update: any) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.getDecorations(update.view);
            }
        }

        getDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { from, to } = view.viewport;

            // Iterate over lines in viewport
            for (let pos = from; pos <= to;) {
                const line = view.state.doc.lineAt(pos);
                // Check if line ends with block ID
                const match = line.text.match(blockIdRegex);
                
                if (match && match.index !== undefined) {
                    const start = line.from + match.index;
                    const end = line.from + line.text.length; // End of line

                    // Hide the block ID
                    // We use replace to make it atomic and hidden
                    builder.add(start, end, Decoration.replace({
                        widget: new HiddenBlockIdWidget(),
                        inclusive: true 
                    }));
                }
                pos = line.to + 1;
            }

            return builder.finish();
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

export default blockIdPlugin;
