import { X, Sun, Type, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/thinkduck-logo.png';
import { AboutIcon } from './AboutIcon';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsSection = 'theme' | 'typography' | 'about';

export function Settings({ isOpen, onClose }: SettingsProps) {
    const [activeSection, setActiveSection] = useState<SettingsSection>('theme');

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose} />

            <div className="settings-modal">
                {/* Left Sidebar */}
                <div className="settings-sidebar">
                    <h2>Settings</h2>

                    {/* Theme Section */}
                    <div
                        onClick={() => setActiveSection('theme')}
                        className={`settings-nav-item ${activeSection === 'theme' ? 'active' : ''}`}
                    >
                        <Sun className="w-[18px] h-[18px]" />
                        <span>Theme</span>
                    </div>

                    {/* Typography Section */}
                    <div
                        onClick={() => setActiveSection('typography')}
                        className={`settings-nav-item ${activeSection === 'typography' ? 'active' : ''}`}
                    >
                        <Type className="w-[18px] h-[18px]" />
                        <span>Typography</span>
                    </div>

                    {/* About Section */}
                    <div
                        onClick={() => setActiveSection('about')}
                        className={`settings-nav-item ${activeSection === 'about' ? 'active' : ''}`}
                    >
                        <AboutIcon style={{ width: 18, height: 18 }} />
                        <span>About</span>
                    </div>
                </div>

                {/* Right Content Area */}
                <div className="settings-content">
                    <button onClick={onClose} className="settings-close-btn">
                        <X className="w-6 h-6" />
                    </button>

                    {activeSection === 'theme' && <ThemeSection />}
                    {activeSection === 'typography' && <TypographySection />}
                    {activeSection === 'about' && <AboutSection />}
                </div>
            </div>
        </>
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
            {/* Track */}
            <div className="slider-track">
                {/* Active Track */}
                <div
                    className="slider-fill"
                    style={{ width: `${(selectedSize / 4) * 100}%` }}
                />
            </div>

            {/* Size Markers */}
            <div className="slider-marks">
                {sizes.map((size) => (
                    <div
                        key={size.value}
                        onClick={() => onSizeChange(size.value)}
                        className="slider-mark-container"
                    >
                        {/* Circle Marker */}
                        <div className={`slider-knob ${selectedSize === size.value ? 'active' : ''}`} />

                        {/* Label */}
                        <span className={`slider-label ${selectedSize === size.value ? 'active' : ''}`}>
                            {size.label}
                        </span>
                    </div>
                ))}
            </div>
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
            <p className="about-version">Version 1.0.1 Beta</p>

            {/* Description */}
            <p className="about-desc">
                A beautiful, block-based note-taking app designed for your thoughts to flow freely.
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
