import { CompletionContext, type CompletionResult } from "@codemirror/autocomplete";

export function tagCompletion(context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/#\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    
    // Check if we are inside a code block or other non-text node?
    // Basic check: Ensure we are matching a hashtag pattern.
    
    // For now, static list or extracting from doc
    // Let's implement dynamic extraction from current doc + some defaults
    
    const text = context.state.doc.toString();
    const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_\-/]+)/g;
    const foundTags = new Set<string>();
    
    // Default tags/Suggestions
    foundTags.add("#ideas");
    foundTags.add("#todo");
    foundTags.add("#project");
    
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        foundTags.add(match[1]);
    }

    return {
        from: word.from,
        options: Array.from(foundTags).map(tag => ({
            label: tag,
            type: "keyword", // Icon type
            // detail: "Tag",
            apply: tag // what to insert
        }))
    };
}
