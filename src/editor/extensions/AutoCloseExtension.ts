import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

export const AutoCloseExtension = Extension.create({
    name: 'autoClose',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('autoClose'),
                props: {
                    handleTextInput: (view, from, to, text) => {
                        const { state, dispatch } = view;
                        const { tr, selection } = state;
                        const { $from } = selection;

                        // Map of opening to closing chars
                        const pairs: Record<string, string> = {
                            '(': ')',
                            '{': '}',
                            '[': ']',
                            '"': '"',
                            "'": "'",
                            '`': '`',
                        };

                        const closing = pairs[text];

                        // 1. Type-over Logic
                        // If typed char matches the char AFTER cursor, just move right.
                        // Exception: if it's a quote, we only type-over if we are likely closing a pair (simple heuristic).
                        // For brackets, it's safer.
                        const nextChar = $from.nodeAfter?.text?.charAt(0);
                        if (nextChar === text && ')]}"\'`'.includes(text)) {
                            // Move cursor forward
                            const newPos = state.doc.resolve(from + 1);
                            dispatch(
                                state.tr.setSelection(
                                    (state.selection.constructor as any).near(newPos)
                                )
                            );
                            return true;
                        }

                        // 2. Auto-Close Logic
                        if (closing) {
                            // Special case for '[[ match
                            // If text is '[', and prev char is '[', and next char is ']', we are turning [|] into [[|]].
                            // [|] -> type '[' -> [[|]] (we want [[|]])
                            // Current state: [|] (char before is '[', char after is ']')
                            if (text === '[') {
                                const prevChar = $from.nodeBefore?.text?.slice(-1);
                                if (prevChar === '[' && nextChar === ']') {
                                    // User had [|] and typed [.
                                    // We want to insert [ and ] so we get [[|]]
                                    // Insert ']' at the end, and '[' at cursor?
                                    // No, we just insert '[]' and put cursor in middle.
                                    // Result: [[|]]

                                    // Wait. If we have `[` | `]`.
                                    // User types `[`.
                                    // Default would insert `[` then `]`. -> `[[` | `]]`.
                                    // This seems correct for `[[` support actually!
                                    // Let's verify standard behavior.
                                    // Standard:
                                    // 1. type `[` -> `[|]`
                                    // 2. type `[` -> `[[|]]`
                                    // So actually standard logic works fine recursively?
                                    // Let's trace:
                                    // 1. empty. type `[` -> insert `[]`, move left. `[|]`
                                    // 2. type `[` -> insert `[]`, move left. `[[|]]`
                                    // YES. Recursive logic handles it.
                                }
                            }

                            // Don't auto-close quotes if inside a word (simple heuristic)
                            if ((text === '"' || text === "'" || text === '`') &&
                                $from.nodeBefore?.text &&
                                /\w$/.test($from.nodeBefore.text)) {
                                return false; // Default behavior (just insert char)
                            }

                            // Perform Insertion
                            // Insert: text + closing
                            tr.insertText(text + closing, from, to);

                            // Move cursor back by 1 (between pairs)
                            // Move cursor back by 1 (between pairs)
                            const newPos = tr.doc.resolve(from + text.length);
                            tr.setSelection((state.selection.constructor as any).near(newPos));

                            dispatch(tr);
                            return true;
                        }

                        return false;
                    },
                    handleKeyDown: (view, event) => {
                        if (event.key === 'Backspace') {
                            const { state, dispatch } = view;
                            const { tr, selection } = state;
                            const { $from, empty } = selection;

                            if (!empty) return false;

                            const prevChar = $from.nodeBefore?.text?.slice(-1);
                            const nextChar = $from.nodeAfter?.text?.charAt(0);

                            const pairs: Record<string, string> = {
                                '(': ')',
                                '{': '}',
                                '[': ']',
                                '"': '"',
                                "'": "'",
                                '`': '`',
                            };

                            // If we match a pair, delete both
                            if (prevChar && pairs[prevChar] === nextChar) {
                                // Delete prev (1 char) and next (1 char)
                                tr.delete($from.pos - 1, $from.pos + 1);
                                dispatch(tr);
                                return true;
                            }
                        }
                        return false;
                    }
                },
            }),
        ];
    },
});
