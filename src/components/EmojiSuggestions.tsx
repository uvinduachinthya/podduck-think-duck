import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { EmojiItem } from '../utils/emojiData';

export interface EmojiSuggestionsProps {
    items: EmojiItem[];
    command: (item: EmojiItem) => void;
}

export interface EmojiSuggestionsHandle {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const EmojiSuggestions = forwardRef<EmojiSuggestionsHandle, EmojiSuggestionsProps>(
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
            }
        };

        const upHandler = () => {
            setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        };

        const downHandler = () => {
            setSelectedIndex((selectedIndex + 1) % props.items.length);
        };

        const enterHandler = () => {
            selectItem(selectedIndex);
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
                    enterHandler();
                    return true;
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
                    minWidth: '200px',
                    maxWidth: '300px',
                }}
            >
                {props.items.length > 0 ? (
                    props.items.map((item, index) => (
                        <button
                            key={`${item.char}-${index}`}
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
                                    fontSize: '18px',
                                }}
                            >
                                {item.char}
                            </div>

                            {/* Content */}
                            <div
                                style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.name}
                            </div>
                        </button>
                    ))
                ) : (
                    <div
                        style={{
                            padding: '8px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '13px',
                        }}
                    >
                        No matching emojis
                    </div>
                )}
            </div>
        );
    }
);

EmojiSuggestions.displayName = 'EmojiSuggestions';
