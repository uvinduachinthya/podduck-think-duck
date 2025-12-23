import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { FileText, Hash } from 'lucide-react';
import type { SearchableItem } from '../utils/searchIndex';

export interface BacklinkSuggestionsProps {
    items: SearchableItem[];
    command: (item: SearchableItem) => void;
}

export interface BacklinkSuggestionsHandle {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const BacklinkSuggestions = forwardRef<BacklinkSuggestionsHandle, BacklinkSuggestionsProps>(
    (props, ref) => {
        const [selectedIndex, setSelectedIndex] = useState(0);

        // Reset selection when items change
        useEffect(() => {
            setSelectedIndex(0);
        }, [props.items]);

        const selectItem = (index: number) => {
            const item = props.items[index];
            if (item) {
                props.command(item);
                return true;
            }
            return false;
        };

        const upHandler = () => {
            setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        };

        const downHandler = () => {
            setSelectedIndex((selectedIndex + 1) % props.items.length);
        };

        const enterHandler = () => {
            return selectItem(selectedIndex);
        };

        useImperativeHandle(ref, () => ({
            onKeyDown: ({ event }) => {
                if (event.key === 'ArrowUp') {
                    upHandler();
                    return true;
                }

                if (event.key === 'ArrowDown') {
                    downHandler();
                    return true;
                }

                if (event.key === 'Enter') {
                    return enterHandler();
                }

                return false;
            },
        }));

        return (
            <div
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    padding: '4px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-family)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    minWidth: '280px',
                    maxWidth: '400px',
                }}
            >
                {props.items.length > 0 ? (
                    props.items.map((item, index) => (
                        <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => selectItem(index)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                border: 'none',
                                background: index === selectedIndex ? 'var(--hover-bg)' : 'transparent',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'background 0.15s',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                            }}
                        >
                            {/* Icon */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    color: item.type === 'page' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                }}
                            >
                                {item.type === 'page' ? (
                                    <FileText size={18} />
                                ) : (
                                    <Hash size={16} />
                                )}
                            </div>

                            {/* Content */}
                            <div
                                style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: item.type === 'page' ? 500 : 400,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {item.title}
                                </div>
                                {item.type === 'block' && (
                                    <div
                                        style={{
                                            fontSize: '12px',
                                            color: 'var(--text-muted)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        in {item.pageName}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))
                ) : (
                    <div
                        style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '13px',
                        }}
                    >
                        No results found
                    </div>
                )}
            </div>
        );
    }
);

BacklinkSuggestions.displayName = 'BacklinkSuggestions';
