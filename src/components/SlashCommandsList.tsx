import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';


export interface SlashCommandItem {
    title: string;
    description: string;
    icon: any;
    command: (props: { editor: any; range: any }) => void;
}

export interface SlashCommandsListProps {
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
}

export interface SlashCommandsListHandle {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandsList = forwardRef<SlashCommandsListHandle, SlashCommandsListProps>(
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
                    minWidth: '250px',
                }}
            >
                {props.items.length > 0 ? (
                    props.items.map((item, index) => (
                        <button
                            key={index}
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
                            }}
                        >
                            {/* Icon */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <item.icon size={18} />
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{item.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {item.description}
                                </div>
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
                        No matching commands
                    </div>
                )}
            </div>
        );
    }
);

SlashCommandsList.displayName = 'SlashCommandsList';
