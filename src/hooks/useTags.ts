import { useState, useEffect } from 'react';
import { useFileSystem, type FileNode } from '../context/FileSystemContext';

export interface TagInfo {
    tag: string;
    count: number;
    notes: FileNode[];
}

export function useTags() {
    const { files } = useFileSystem();
    const [tagsMap, setTagsMap] = useState<Map<string, TagInfo>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const extractTags = async () => {
            setLoading(true); // Moved inside async function
            const map = new Map<string, TagInfo>();
            const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_\-/]+)/g;

            // Process files in batches to avoid blocking UI too much?
            // For now parallel is fine given simple regex.
            await Promise.all(files.map(async (fileNode) => {
                if (!isMounted) return;
                try {
                    const file = await fileNode.handle.getFile();
                    const text = await file.text();
                    
                    const matches = Array.from(text.matchAll(tagRegex));
                    
                    for (const match of matches) {
                        const tag = match[1];
                        if (!map.has(tag)) {
                            map.set(tag, {
                                tag,
                                count: 0,
                                notes: []
                            });
                        }
                        const info = map.get(tag)!;
                        
                        // Check if we already counted this note for this tag
                        if (!info.notes.some(n => n.name === fileNode.name)) {
                            info.notes.push(fileNode);
                            info.count++;
                        }
                    }
                } catch (err) {
                    console.error("Error reading file for tags:", fileNode.name, err);
                }
            }));

            if (isMounted) {
                setTagsMap(map);
                setLoading(false);
            }
        };

        if (files.length > 0) {
            extractTags();
        } else {
            setTagsMap(new Map());
            setLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [files]);

    return { tagsMap, loading };
}
