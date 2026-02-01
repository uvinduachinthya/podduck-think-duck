import { useEffect, useState } from 'react';
import { useFileSystem, type FileNode } from '../context/FileSystemContext';
import { Link2, ExternalLink, FileText } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

interface LinkItem {
    url: string;
    sourceFile: FileNode;
}

export function LinksList({ hideHeader = false, onSelectFile }: { hideHeader?: boolean; onSelectFile: (file: FileNode) => void }) {
    const { files } = useFileSystem();
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const fetchLinks = async () => {
            setIsLoading(true);
            const foundLinks: LinkItem[] = [];
            const urlRegex = /(https?:\/\/[^\s)]+)/g;

            // Limit processing? 
            // For now, let's process all but maybe in chunks?
            // Simple approach first.
            
            for (const file of files) {
                if (!active) return;
                try {
                    const f = await file.handle.getFile();
                    const text = await f.text();
                    const matches = text.match(urlRegex);
                    if (matches) {
                        // Dedup per file?
                        const uniqueUrls = Array.from(new Set(matches));
                        uniqueUrls.forEach(url => {
                            // Clean trailing chars often caught by simple regex
                            const cleanUrl = url.replace(/[)\];,"']$/, '');
                            foundLinks.push({
                                url: cleanUrl,
                                sourceFile: file
                            });
                        });
                    }
                } catch (e) {
                    // ignore
                }
            }
            
            if (active) {
                setLinks(foundLinks);
                setIsLoading(false);
            }
        };

        fetchLinks();
        return () => { active = false; };
    }, [files]); // Re-scanning all on any file change is expensive. But acceptable for prototype.

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!hideHeader && (
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link2 className="w-6 h-6" />
                    Links
                </h1>
            )}

            {isLoading ? (
                <div style={{ color: 'var(--text-secondary)' }}>Scanning notes for links...</div>
            ) : links.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No external links found in your notes.
                </div>
            ) : (
                 <div style={{ flex: 1, minHeight: 0 }}>
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={links}
                        itemContent={(_index, item) => (
                             <div 
                                style={{ 
                                    padding: '16px',
                                    marginBottom: '12px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}
                             >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ 
                                        width: '32px', 
                                        height: '32px', 
                                        borderRadius: '6px', 
                                        backgroundColor: 'var(--bg-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--primary-color)'
                                    }}>
                                        <ExternalLink className="w-4 h-4" />
                                    </div>
                                    <a 
                                        href={item.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{ 
                                            color: 'var(--primary-color)', 
                                            textDecoration: 'none',
                                            fontWeight: 500,
                                            wordBreak: 'break-all'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {item.url}
                                    </a>
                                </div>
                                
                                <div 
                                    onClick={() => onSelectFile(item.sourceFile)}
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        fontSize: '12px', 
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        alignSelf: 'flex-start'
                                    }}
                                    className="hover-underline"
                                >
                                    <FileText className="w-3 h-3" />
                                    Found in {item.sourceFile.name.replace('.md', '')}
                                </div>
                             </div>
                        )}
                    />
                </div>
            )}
        </div>
    );
}
