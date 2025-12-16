import { Node, mergeAttributes } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { BacklinkSuggestions, type BacklinkSuggestionsHandle } from '../../components/BacklinkSuggestions';
import { searchItems, type SearchableItem } from '../../utils/searchIndex';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { Plugin, PluginKey } from 'prosemirror-state';

export interface BacklinkOptions {
    HTMLAttributes: Record<string, any>;
    renderLabel: (props: { node: any }) => string;
    onNavigate?: (pageId: string, type: 'page' | 'block', blockId?: string) => void;
    suggestion: Omit<SuggestionOptions, 'editor'>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        backlink: {
            insertBacklink: (item: SearchableItem) => ReturnType;
        };
    }
}

export const Backlink = Node.create<BacklinkOptions>({
    name: 'backlink',

    group: 'inline',

    inline: true,

    selectable: false,

    atom: true,

    addOptions() {
        return {
            HTMLAttributes: {},
            renderLabel({ node }) {
                return `@${node.attrs.label}`;
            },
            onNavigate: undefined,
            suggestion: {
                char: '@',
                command: ({ editor, range, props }) => {
                    editor
                        .chain()
                        .focus()
                        .insertContentAt(range, [
                            {
                                type: 'backlink',
                                attrs: props,
                            },
                            {
                                type: 'text',
                                text: ' ',
                            },
                        ])
                        .run();
                },
                items: ({ query }) => {
                    return searchItems(query);
                },
                render: () => {
                    let component: ReactRenderer<BacklinkSuggestionsHandle>;
                    let popup: TippyInstance[];

                    return {
                        onStart: (props: any) => {
                            component = new ReactRenderer(BacklinkSuggestions, {
                                props,
                                editor: props.editor,
                            });

                            if (!props.clientRect) {
                                return;
                            }

                            popup = tippy('body', {
                                getReferenceClientRect: props.clientRect,
                                appendTo: () => document.body,
                                content: component.element,
                                showOnCreate: true,
                                interactive: true,
                                trigger: 'manual',
                                placement: 'bottom-start',
                            });
                        },

                        onUpdate(props: any) {
                            component.updateProps(props);

                            if (!props.clientRect) {
                                return;
                            }

                            popup[0].setProps({
                                getReferenceClientRect: props.clientRect,
                            });
                        },

                        onKeyDown(props: any) {
                            if (props.event.key === 'Escape') {
                                popup[0].hide();
                                return true;
                            }

                            return component.ref?.onKeyDown(props) ?? false;
                        },

                        onExit() {
                            popup[0].destroy();
                            component.destroy();
                        },
                    };
                },
            },
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-id'),
                renderHTML: (attributes) => {
                    if (!attributes.id) {
                        return {};
                    }

                    return {
                        'data-id': attributes.id,
                    };
                },
            },
            label: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-label'),
                renderHTML: (attributes) => {
                    if (!attributes.label) {
                        return {};
                    }

                    return {
                        'data-label': attributes.label,
                    };
                },
            },
            type: {
                default: 'page',
                parseHTML: (element) => element.getAttribute('data-type'),
                renderHTML: (attributes) => {
                    return {
                        'data-type': attributes.type,
                    };
                },
            },
            pageId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-page-id'),
                renderHTML: (attributes) => {
                    if (!attributes.pageId) {
                        return {};
                    }

                    return {
                        'data-page-id': attributes.pageId,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-backlink]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(
                { 'data-backlink': '' },
                this.options.HTMLAttributes,
                HTMLAttributes
            ),
            this.options.renderLabel({ node }),
        ];
    },

    renderText({ node }) {
        return this.options.renderLabel({ node });
    },

    addKeyboardShortcuts() {
        return {
            Backspace: () =>
                this.editor.commands.command(({ tr, state }) => {
                    let isBacklink = false;
                    const { selection } = state;
                    const { empty, anchor } = selection;

                    if (!empty) {
                        return false;
                    }

                    state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
                        if (node.type.name === this.name) {
                            isBacklink = true;
                            tr.insertText('', pos, pos + node.nodeSize);

                            return false;
                        }
                    });

                    return isBacklink;
                }),
        };
    },

    addProseMirrorPlugins() {
        const plugins = [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];

        // Add click handling if onNavigate is provided
        if (this.options.onNavigate) {
            const clickPlugin = new Plugin({
                key: new PluginKey('backlinkClick'),
                props: {
                    handleClick: (view, pos, event) => {
                        const { doc } = view.state;
                        const clickedNode = doc.nodeAt(pos);

                        if (clickedNode && clickedNode.type.name === 'backlink') {
                            const { pageId, type, id } = clickedNode.attrs;

                            // Call the navigation callback
                            if (this.options.onNavigate) {
                                this.options.onNavigate(pageId, type, id);
                            }

                            return true; // Prevent default behavior
                        }

                        return false;
                    },
                },
            });

            plugins.push(clickPlugin);
        }

        return plugins;
    },
});
