
import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Type, ArrowRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

// It's better to export the context from a separate file, but App.tsx has it. 
// However, direct import from App is okay if it's just the hook, provided no cyles.
// But App.tsx imports SearchModal.tsx -> cycle.
// To avoid cycle, SearchModal should receive props instead of using context, or I should extract Context.
// For now, I'll pass everything as props.

import type { SearchResult } from '../hooks/useSearchWorker';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (file: string, blockId?: string) => void;
    search: (query: string) => Promise<SearchResult[]>;
}

export function SearchModal({ isOpen, onClose, onNavigate, search }: SearchModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial search and reset when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);

            // Initial search to show recent files
            search('').then(setResults);
        }
    }, [isOpen, search]);

    // Handle search (Debounced)
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (isOpen) {
                const res = await search(query);
                setResults(res);
                setSelectedIndex(0);
            }
        }, 150); 

        return () => clearTimeout(timeoutId);
    }, [query, isOpen, search]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[selectedIndex]) {
                const item = results[selectedIndex];
                onNavigate(item.pageId || '', item.type === 'block' ? item.id : undefined);
                onClose();
            }
        } 
        // Escape is handled by Radix Dialog
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(2px)',
                        zIndex: 2000,
                    }} 
                />
                <Dialog.Content 
                    aria-describedby={undefined}
                    onOpenAutoFocus={(e) => {
                        // Focus the input
                        e.preventDefault();
                        inputRef.current?.focus();
                    }}
                    style={{
                        position: 'fixed',
                        top: '20%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '600px',
                        maxHeight: '400px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '12px',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 2001,
                        border: '1px solid var(--border-color)',
                        outline: 'none' 
                    }}
                >
                    <Dialog.Title className="sr-only">Search</Dialog.Title>
                    
                    {/* Search Bar */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <Search className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search notes and blocks..."
                            style={{
                                flex: 1,
                                border: 'none',
                                background: 'transparent',
                                fontSize: '18px',
                                color: 'var(--text-primary)',
                                outline: 'none',
                            }}
                        />
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                        }}>
                            ESC to close
                        </div>
                    </div>

                    {/* Results List */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px',
                    }}>
                        {results.length === 0 ? (
                            <div style={{
                                padding: '32px',
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                            }}>
                                {query ? 'No results found' : 'Type to search...'}
                            </div>
                        ) : (
                            results.map((item, index) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => {
                                        onNavigate(item.pageId || '', item.type === 'block' ? item.id : undefined);
                                        onClose();
                                    }}
                                    onMouseOver={() => setSelectedIndex(index)}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: '6px',
                                        backgroundColor: index === selectedIndex ? 'var(--sidebar-active)' : 'transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}
                                >
                                    {item.type === 'page' ? (
                                        <FileText className="w-5 h-5" style={{ color: 'var(--primary-color)' }} />

                                    ) : (
                                        <Type className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                    )}

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            color: 'var(--text-primary)',
                                            fontWeight: 500,
                                            fontSize: '14px',
                                            marginBottom: item.type === 'block' ? '2px' : '0',
                                        }}>
                                            {item.title}
                                        </div>
                                        {item.type === 'block' && (
                                            <div style={{
                                                color: 'var(--text-secondary)',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                            }}>
                                                <span>in {item.pageName}</span>
                                            </div>
                                        )}
                                    </div>

                                    {index === selectedIndex && (
                                        <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
