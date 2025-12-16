import { Database } from 'emoji-picker-element';

const db = new Database();

export interface EmojiItem {
    name: string;
    char: string;
    shortcodes: string[];
}

export const searchEmojis = async (query: string): Promise<EmojiItem[]> => {
    // Return empty list for very short queries to avoid performance hit
    if (!query || query.length < 2) return [];

    try {
        const emojis = await db.getEmojiBySearchQuery(query);
        return emojis
            .filter((emoji: any) => 'unicode' in emoji)
            .map((emoji: any) => ({
                name: emoji.annotation || emoji.name,
                char: emoji.unicode,
                shortcodes: emoji.shortcodes || []
            }))
            .slice(0, 10); // Limit results
    } catch (err) {
        console.error('Error searching emojis:', err);
        return [];
    }
};
