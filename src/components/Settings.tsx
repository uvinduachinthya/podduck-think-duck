import { X, Sun, Type, RotateCcw, HardDrive, Command } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/thinkduck-logo.png';
import { AboutIcon } from './AboutIcon';
import { APP_VERSION } from '../version';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import * as Slider from '@radix-ui/react-slider';
import { useFileSystem } from '../context/FileSystemContext';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="modal-overlay" />
                <Dialog.Content className="settings-modal" aria-describedby={undefined}>
                    <Dialog.Title className="sr-only">Settings</Dialog.Title>
                    <SettingsTabs />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function SettingsTabs() {
    return (
        <Tabs.Root defaultValue="theme" orientation="vertical" style={{ display: 'flex', width: '100%', height: '100%' }}>
            <Tabs.List className="settings-sidebar" aria-label="Settings tabs">
                <h2>Settings</h2>
                
                <Tabs.Trigger value="theme" className="settings-nav-item" asChild>
                    <button className="settings-tab-trigger">
                        <Sun className="w-[18px] h-[18px]" />
                        <span>Theme</span>
                    </button>
                </Tabs.Trigger>

                <Tabs.Trigger value="typography" className="settings-nav-item" asChild>
                    <button className="settings-tab-trigger">
                        <Type className="w-[18px] h-[18px]" />
                        <span>Typography</span>
                    </button>
                </Tabs.Trigger>

                <Tabs.Trigger value="filesaves" className="settings-nav-item" asChild>
                    <button className="settings-tab-trigger">
                        <HardDrive className="w-[18px] h-[18px]" />
                        <span>File Saves</span>
                    </button>
                </Tabs.Trigger>

                <Tabs.Trigger value="shortcuts" className="settings-nav-item" asChild>
                    <button className="settings-tab-trigger">
                        <Command className="w-[18px] h-[18px]" />
                        <span>Shortcuts</span>
                    </button>
                </Tabs.Trigger>

                <Tabs.Trigger value="about" className="settings-nav-item" asChild>
                    <button className="settings-tab-trigger">
                        <AboutIcon style={{ width: 18, height: 18 }} />
                        <span>About</span>
                    </button>
                </Tabs.Trigger>
            </Tabs.List>

            <div className="settings-content">
                <Dialog.Close asChild>
                    <button className="settings-close-btn" aria-label="Close">
                        <X className="w-6 h-6" />
                    </button>
                </Dialog.Close>

                <Tabs.Content value="theme" style={{ outline: 'none' }}>
                    <ThemeSection />
                </Tabs.Content>

                <Tabs.Content value="typography" style={{ outline: 'none' }}>
                    <TypographySection />
                </Tabs.Content>

                <Tabs.Content value="filesaves" style={{ outline: 'none' }}>
                    <FileSavesSection />
                </Tabs.Content>

                <Tabs.Content value="shortcuts" style={{ outline: 'none' }}>
                    <ShortcutsSection />
                </Tabs.Content>

                <Tabs.Content value="about" style={{ height: '100%', outline: 'none' }}>
                    <AboutSection />
                </Tabs.Content>
            </div>
        </Tabs.Root>
    );
}

function ShortcutsSection() {
    const shortcuts = [
        { category: "Application", items: [
            { label: "Search", keys: ["Cmd", "P"] },
            { label: "Toggle Sidebar", keys: ["Cmd", "\\"] },
            { label: "Toggle Theme", keys: ["Cmd", "Shift", "L"] },
            { label: "Close Settings", keys: ["Esc"] },
        ]},
        { category: "Editor", items: [
            { label: "Slash Menu", keys: ["/"] },
            { label: "Emoji Pickle", keys: [":"] },
            { label: "Link Note", keys: ["[["] },
            { label: "Bold", keys: ["Cmd", "B"] },
            { label: "Italic", keys: ["Cmd", "I"] },
            { label: "Inline Code", keys: ["Cmd", "E"] },
            { label: "Quote", keys: ["Cmd", "'"] },
            { label: "Double Quote", keys: ["Cmd", "Shift", "'"] },
            { label: "Superscript", keys: ["Cmd", "Shift", "="] },
            { label: "Subscript", keys: ["Cmd", "Shift", "-"] },
            { label: "Strikethrough", keys: ["Cmd", "Shift", "S"] },
            { label: "Highlight", keys: ["Cmd", "Shift", "H"] },
            { label: "Underline", keys: ["Cmd", "U"] },
            { label: "Code Block", keys: ["Cmd", "Shift", "E"] },
        ]}
    ];

    return (
        <div>
            {shortcuts.map((section) => (
                <div key={section.category} className="settings-section">
                    <h4 className="settings-section-title">{section.category}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {section.items.map((item) => (
                            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {item.keys.map((key) => (
                                        <kbd key={key} style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '4px',
                                            padding: '2px 6px',
                                            fontSize: '11px',
                                            color: 'var(--text-secondary)',
                                            fontFamily: 'var(--font-family)',
                                            minWidth: '20px',
                                            textAlign: 'center'
                                        }}>
                                            {key}
                                        </kbd>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ThemeSection() {
    const { theme, setTheme, primaryColor, setPrimaryColor } = useTheme();

    const colors = [
        { name: 'Default', value: '#4F65F2', color: '#4F65F2' },
        { name: 'Purple', value: '#a855f7', color: '#a855f7' },
        { name: 'Blue', value: '#3b82f6', color: '#3b82f6' },
        { name: 'Green', value: '#22c55e', color: '#22c55e' },
        { name: 'Yellow', value: '#eab308', color: '#eab308' },
    ];

    return (
        <div>
            {/* Theme Selection */}
            <div className="settings-section">
                <h4 className="settings-section-title">Theme</h4>
                <div className="theme-grid">
                    {/* Default Theme */}
                    <div className="theme-card" onClick={() => setTheme('default')}>
                        <div className={`theme-preview ${theme === 'default' ? 'active' : ''}`}>
                            <div className="theme-preview-sidebar" style={{ backgroundColor: '#202020' }} />
                            <div className="theme-preview-main" style={{ backgroundColor: '#FBFBFB' }} />
                        </div>
                        <p className="theme-label">Default</p>
                    </div>

                    {/* Dark Theme */}
                    <div className="theme-card" onClick={() => setTheme('dark')}>
                        <div className={`theme-preview ${theme === 'dark' ? 'active' : ''}`}>
                            <div className="theme-preview-sidebar" style={{ backgroundColor: '#1a1a1a' }} />
                            <div className="theme-preview-main" style={{ backgroundColor: '#2a2a2a' }} />
                        </div>
                        <p className="theme-label">Dark</p>
                    </div>
                </div>
            </div>

            {/* Color Selection */}
            <div>
                <h4 className="settings-section-title">Color</h4>
                <div className="color-grid">
                    {colors.map((colorOption) => (
                        <div
                            key={colorOption.value}
                            onClick={() => setPrimaryColor(colorOption.value)}
                            className="color-swatch-container"
                        >
                            <div
                                className={`color-swatch ${primaryColor === colorOption.value ? 'active' : ''}`}
                                style={{ backgroundColor: colorOption.color }}
                            />
                            <p className="color-label">{colorOption.name}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TypographySection() {
    const { fontFamily, setFontFamily, systemFontSize, setSystemFontSize, editorFontSize, setEditorFontSize } = useTheme();

    const fonts = [
        { name: 'Default', value: 'default', family: "'Inclusive Sans', sans-serif" },
        { name: 'Classic', value: 'classic', family: "'Arbutus Slab', serif" },
        { name: 'Mono', value: 'mono', family: "'Roboto Mono', monospace" },
        { name: 'Cozy', value: 'cozy', family: "'Gaegu', cursive" },
        { name: 'System', value: 'system', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
    ];

    return (
        <div>
            {/* Font Style Selection */}
            <div className="settings-section">
                <h4 className="settings-section-title">Font</h4>
                <div className="font-grid">
                    {fonts.map((font) => (
                        <div
                            key={font.value}
                            onClick={() => setFontFamily(font.value)}
                            className={`font-card ${fontFamily === font.value ? 'active' : ''}`}
                        >
                            <span className="font-preview" style={{ fontFamily: font.family }}>Aa</span>
                            <span className="font-label">{font.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* System Font Size */}
            <div className="settings-section">
                <div className="settings-flex-header">
                    <h4 className="settings-section-title" style={{ marginBottom: 0 }}>System Font Size</h4>
                    <button
                        onClick={() => setSystemFontSize(1)}
                        className="settings-reset-btn"
                        title="Reset to default"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
                <FontSizeSlider
                    selectedSize={systemFontSize}
                    onSizeChange={setSystemFontSize}
                />
            </div>

            {/* Editor Font Size */}
            <div>
                <div className="settings-flex-header">
                    <h4 className="settings-section-title" style={{ marginBottom: 0 }}>Editor Font Size</h4>
                    <button
                        onClick={() => setEditorFontSize(2)}
                        className="settings-reset-btn"
                        title="Reset to default"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
                <FontSizeSlider
                    selectedSize={editorFontSize}
                    onSizeChange={setEditorFontSize}
                />
            </div>
        </div>
    );
}

function FontSizeSlider({ selectedSize, onSizeChange }: { selectedSize: number; onSizeChange: (size: number) => void }) {
    const sizes = [
        { label: 'XS', value: 0 },
        { label: 'S', value: 1 },
        { label: 'M', value: 2 },
        { label: 'L', value: 3 },
        { label: 'XL', value: 4 },
    ];

    return (
        <div className="slider-root">
            <Slider.Root
                className="slider-root-element"
                value={[selectedSize]}
                min={0}
                max={4}
                step={1}
                onValueChange={(vals) => onSizeChange(vals[0])}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', userSelect: 'none', touchAction: 'none', height: '20px' }}
            >
                <Slider.Track className="slider-track" style={{ flexGrow: 1, position: 'relative', height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-color)' }}>
                    <Slider.Range className="slider-fill" style={{ position: 'absolute', height: '100%', borderRadius: 'inherit', backgroundColor: 'var(--primary-color)' }} />
                </Slider.Track>
                <Slider.Thumb
                    className="slider-knob active"
                    aria-label="Font size"
                    style={{
                        display: 'block',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--border-color)',
                        border: '2px solid var(--bg-primary)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                        cursor: 'grab'
                    }}
                />
            </Slider.Root>

             {/* Size Markers (Visual Only now, effectively) - Or clearer to position under the slider */}
            <div className="slider-marks" style={{ marginTop: '4px' }}>
                {sizes.map((size) => (
                    <div
                        key={size.value}
                        className="slider-mark-container"
                        onClick={() => onSizeChange(size.value)}
                        style={{ width: '0' }} // Let them position naturally
                    >
                        {/* We don't need the mark dot anymore as the slider thumb handles it, just labels */}
                         <div style={{ position: 'relative', left: `${(size.value / 4) * 100}%` }}>
                            {/* Ideally we'd position these absolutely along the track. 
                                Since we replaced the custom slider implementation, we need to ensure the visual alignment matches.
                                The Radix slider handles the input. The labels are just visual.
                            */}
                         </div>
                    </div>
                ))}
            </div>
             
             {/* Better label rendering matching previous style */}
             <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                 {sizes.map((size) => (
                     <span 
                        key={size.value}
                        onClick={() => onSizeChange(size.value)}
                        style={{ 
                            fontSize: '11px', 
                            color: selectedSize === size.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: selectedSize === size.value ? 600 : 400,
                            cursor: 'pointer'
                        }}
                     >
                        {size.label}
                     </span>
                 ))}
             </div>
        </div>
    );
}



function FileSavesSection() {
    const { folderName, openDirectory, closeDirectory } = useFileSystem();

    return (
        <div>
            <h4 className="settings-section-title">File System</h4>
            
            <div style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ 
                        display: 'block', 
                        fontSize: '12px', 
                        color: 'var(--text-secondary)', 
                        marginBottom: '8px',
                        fontWeight: 500
                    }}>
                        Current Location
                    </label>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        fontWeight: 500
                    }}>
                        <HardDrive className="w-4 h-4" />
                        <span>{folderName || 'No folder selected'}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        onClick={() => openDirectory()}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                    >
                        Switch Folder
                    </button>
                    
                    <button 
                        onClick={() => closeDirectory()}
                        disabled={!folderName}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: folderName ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: folderName ? 'pointer' : 'not-allowed',
                            opacity: folderName ? 1 : 0.6,
                            transition: 'background-color 0.2s'
                        }}
                         onMouseOver={(e) => {
                            if (folderName) e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                         }}
                         onMouseOut={(e) => {
                            if (folderName) e.currentTarget.style.backgroundColor = 'transparent'
                         }}
                    >
                        Close Folder
                    </button>
                </div>
            </div>
            
            <p style={{ 
                marginTop: '16px', 
                fontSize: '13px', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.5' 
            }}>
                Thinkduck saves your notes directly to your local file system. 
                Use "Switch Folder" to open a different directory or "Close Folder" to disconnect safely.
            </p>
        </div>
    );
}

function AboutSection() {
    return (
        <div className="about-container">
            {/* Logo */}
            <div className="about-logo">
                <img
                    src={logo}
                    alt="Thinkduck Logo"
                />
            </div>

            {/* App Name */}
            <h2 className="about-title">Thinkduck</h2>

            {/* Version */}
            <p className="about-version">Version {APP_VERSION}</p>

            {/* Description */}
            <p className="about-desc">
                A beautiful, markdown note-taking app designed for your thoughts to flow freely.
            </p>

            {/* Copyright */}
            <div className="about-footer">
                <p className="about-copyright">
                    Copyright © {new Date().getFullYear()} podduck.org
                </p>
            </div>
        </div>
    );
}
