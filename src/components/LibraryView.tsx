import React, { useState, useEffect } from 'react';
import { AllNotesList } from './AllNotesList';
import { DailyNotesList } from './DailyNotesList';
import { TagsList } from './TagsList';
import { LinksList } from './LinksList';
import type { FileNode } from '../context/FileSystemContext';
import { FileText, Calendar, Hash, Link2, Library } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';

type TabId = 'notes' | 'daily' | 'tags' | 'links';

export function LibraryView({ 
    initialTab = 'notes', 
    onSelectFile 
}: { 
    initialTab?: TabId; 
    onSelectFile: (file: FileNode) => void;
}) {
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    // Update active tab if initialTab changes (e.g. navigation from sidebar)
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: '40px 40px 0 40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Library className="w-6 h-6" />
                    Library
                </h1>
            </div>

            <Tabs.Root 
                value={activeTab} 
                onValueChange={setActiveTab}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
                <div style={{ padding: '0 40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                    <Tabs.List style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '0' }}>
                        <Tabs.Trigger 
                            value="notes"
                            className="library-tab-trigger"
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '12px 0',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                color: activeTab === 'notes' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                borderBottom: activeTab === 'notes' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <FileText className="w-4 h-4" />
                            Notes
                        </Tabs.Trigger>
                         <Tabs.Trigger 
                            value="daily"
                            className="library-tab-trigger"
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '12px 0',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                color: activeTab === 'daily' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                borderBottom: activeTab === 'daily' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Calendar className="w-4 h-4" />
                            Daily Notes
                        </Tabs.Trigger>
                        <Tabs.Trigger 
                            value="tags"
                            className="library-tab-trigger"
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '12px 0',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                color: activeTab === 'tags' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                borderBottom: activeTab === 'tags' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Hash className="w-4 h-4" />
                            Tags
                        </Tabs.Trigger>
                        <Tabs.Trigger 
                            value="links"
                            className="library-tab-trigger"
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '12px 0',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                color: activeTab === 'links' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                borderBottom: activeTab === 'links' ? '2px solid var(--primary-color)' : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Link2 className="w-4 h-4" />
                            Links
                        </Tabs.Trigger>
                    </Tabs.List>
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Tabs.Content value="notes" style={{ height: '100%' }}>
                        <AllNotesList onSelect={onSelectFile} hideHeader={true} />
                    </Tabs.Content>
                    <Tabs.Content value="daily" style={{ height: '100%' }}>
                        <DailyNotesList onSelect={onSelectFile} hideHeader={true} />
                    </Tabs.Content>
                     <Tabs.Content value="tags" style={{ height: '100%' }}>
                        <TagsList onSelect={onSelectFile} hideHeader={true} />
                    </Tabs.Content>
                    <Tabs.Content value="links" style={{ height: '100%' }}>
                        <LinksList onSelectFile={onSelectFile} hideHeader={true} />
                    </Tabs.Content>
                </div>
            </Tabs.Root>
        </div>
    );
}
