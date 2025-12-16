import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from 'prosemirror-state';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { SlashCommandsList, type SlashCommandItem } from '../../components/SlashCommandsList';
import { Clock, Calendar } from 'lucide-react';

export const SlashCommandExtension = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }: any) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                pluginKey: new PluginKey('slashCommandSuggestion'),
                ...this.options.suggestion,
            }),
        ];
    },
});

const getCommands = (): SlashCommandItem[] => [
    {
        title: 'Current Time',
        description: 'Insert the current time (HH:mm)',
        icon: Clock,
        command: ({ editor, range }) => {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertContent(timeString)
                .run();
        },
    },
    {
        title: "Today's Date",
        description: 'Insert today\'s date (YYYY-MM-DD)',
        icon: Calendar,
        command: ({ editor, range }) => {
            const now = new Date();
            const dateString = now.toISOString().split('T')[0];
            editor
                .chain()
                .focus()
                .deleteRange(range)
                .insertContent(dateString)
                .run();
        },
    },
];

export const SlashCommandOptions = {
    items: ({ query }: { query: string }) => {
        return getCommands().filter(item =>
            item.title.toLowerCase().startsWith(query.toLowerCase())
        );
    },

    render: () => {
        let component: any;
        let popup: any;

        return {
            onStart: (props: any) => {
                component = new ReactRenderer(SlashCommandsList, {
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
};
