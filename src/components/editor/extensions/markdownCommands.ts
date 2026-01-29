import { type StateCommand, EditorSelection, Transaction } from '@codemirror/state';
import { keymap } from '@codemirror/view';

// Generic helper to toggle wrapping characters
const toggleWrapper = (start: string, end: string = start): StateCommand => ({ state, dispatch }) => {
    const changes = state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to);
        const startLen = start.length;
        const endLen = end.length;
        
        // Check if wrapped
        // For complex asymmetric equality (like * vs **), we rely on lengths and simple string matching
        // Ideally we shouldn't match if it's part of a larger token, but "start" and "end" checks usually suffice for toggle logic.
        const isWrapped = text.startsWith(start) && text.endsWith(end) && text.length >= startLen + endLen;
        
        // Safety check for ambiguous tokens (like * vs **)
        let safeIsWrapped = isWrapped;
        if (start === '*' && end === '*' && text.startsWith('**') && text.endsWith('**') && text.length >= 4) {
             safeIsWrapped = false;
        }

        if (safeIsWrapped) {
            // Unwrap
            return {
                range: EditorSelection.range(range.from, range.to - (startLen + endLen)),
                changes: [
                    { from: range.from, to: range.from + startLen, insert: '' },
                    { from: range.to - endLen, to: range.to, insert: '' }
                ]
            };
        } else {
            // Wrap
            if (range.empty) {
                return {
                    range: EditorSelection.cursor(range.from + startLen),
                    changes: { from: range.from, insert: start + end }
                };
            }
            return {
                range: EditorSelection.range(range.from, range.to + (startLen + endLen)),
                changes: [
                    { from: range.from, insert: start },
                    { from: range.to, insert: end }
                ]
            };
        }
    });

    dispatch(
        state.update(changes, {
            scrollIntoView: true,
            annotations: Transaction.userEvent.of('input')
        })
    );

    return true;
};

// Standard Markdown
export const toggleBold = toggleWrapper('**');
export const toggleItalic = toggleWrapper('*');
export const toggleInlineCode = toggleWrapper('`');
export const toggleSingleQuote = toggleWrapper("'");
export const toggleDoubleQuote = toggleWrapper('"');

// Extended Syntax
export const toggleSuperscript = toggleWrapper('^');
export const toggleSubscript = toggleWrapper('~');
export const toggleStrikethrough = toggleWrapper('~~');
export const toggleHighlight = toggleWrapper('==');
export const toggleUnderline = toggleWrapper('_'); // This conflicts with Italic in some parsers but requested by user
export const toggleCodeBlock = toggleWrapper('```'); // Inline/Block generic toggle
export const toggleInlineLatex = toggleWrapper('$');
export const toggleBlockLatex = toggleWrapper('$$');

export const markdownKeymap = keymap.of([
    { key: 'Mod-b', run: toggleBold },
    { key: 'Mod-i', run: toggleItalic },
    { key: 'Mod-e', run: toggleInlineCode },
    { key: "Mod-'", run: toggleSingleQuote },
    { key: "Mod-Shift-'", run: toggleDoubleQuote },
    
    // Extended
    { key: 'Mod-Shift-=', run: toggleSuperscript },
    { key: 'Mod-Shift--', run: toggleSubscript },
    { key: 'Mod-Shift-s', run: toggleStrikethrough },
    { key: 'Mod-Shift-h', run: toggleHighlight },
    { key: 'Mod-m', run: toggleInlineLatex },
    { key: 'Mod-Shift-m', run: toggleBlockLatex },
    { key: 'Mod-u', run: toggleUnderline },
    { key: 'Mod-Shift-e', run: toggleCodeBlock },
]);
