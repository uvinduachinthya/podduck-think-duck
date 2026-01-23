import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ThemeContextType {
    theme: 'default' | 'dark';
    setTheme: (theme: 'default' | 'dark') => void;
    primaryColor: string;
    setPrimaryColor: (color: string) => void;
    fontFamily: string;
    setFontFamily: (family: string) => void;
    systemFontSize: number;
    setSystemFontSize: (size: number) => void;
    editorFontSize: number;
    setEditorFontSize: (size: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<'default' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved === 'dark' ? 'dark' : 'default') as 'default' | 'dark';
    });
    const [primaryColor, setPrimaryColor] = useState(() => {
        const saved = localStorage.getItem('primaryColor');
        return saved || '#d7494c';
    });
    const [fontFamily, setFontFamily] = useState(() => {
        const saved = localStorage.getItem('fontFamily');
        return saved || 'default';
    });
    const [systemFontSize, setSystemFontSize] = useState(() => {
        const saved = localStorage.getItem('systemFontSize');
        return saved ? parseInt(saved) : 1; // Default: Small
    });
    const [editorFontSize, setEditorFontSize] = useState(() => {
        const saved = localStorage.getItem('editorFontSize');
        return saved ? parseInt(saved) : 2; // Default: Medium
    });

    useEffect(() => {
        // Apply theme by setting CSS variables on :root
        const root = document.documentElement;

        // Primary color (same for both themes)
        root.style.setProperty('--primary-color', primaryColor);
        root.style.setProperty('--primary-hover', '#bf3e41');

        if (theme === 'dark') {
            // Dark theme colors
            // Sidebar colors (lighter in dark mode for contrast)
            root.style.setProperty('--sidebar-bg', '#1a1a1a');
            root.style.setProperty('--sidebar-text', '#e0e0e0');
            root.style.setProperty('--sidebar-text-muted', '#888888');
            root.style.setProperty('--sidebar-hover', '#2a2a2a');
            root.style.setProperty('--sidebar-active', '#333333');
            root.style.setProperty('--sidebar-border', '#2a2a2a');

            // Editor colors (dark)
            root.style.setProperty('--bg-primary', '#1e1e1e');
            root.style.setProperty('--bg-secondary', '#252525');
            root.style.setProperty('--text-primary', '#e0e0e0');
            root.style.setProperty('--text-secondary', '#a0a0a0');
            root.style.setProperty('--text-muted', '#707070');
            root.style.setProperty('--border-color', '#333333');

            // Interactive elements
            root.style.setProperty('--hover-bg', '#2a2a2a');
            root.style.setProperty('--active-bg', '#333333');
        } else {
            // Default (light) theme colors
            // Sidebar colors (dark)
            root.style.setProperty('--sidebar-bg', '#202020');
            root.style.setProperty('--sidebar-text', '#e0e0e0');
            root.style.setProperty('--sidebar-text-muted', '#888888');
            root.style.setProperty('--sidebar-hover', '#333333');
            root.style.setProperty('--sidebar-active', '#404040');
            root.style.setProperty('--sidebar-border', '#333333');

            // Editor colors (light)
            root.style.setProperty('--bg-primary', '#FBFBFB');
            root.style.setProperty('--bg-secondary', '#f9f9f9');
            root.style.setProperty('--text-primary', '#202020');
            root.style.setProperty('--text-secondary', '#666666');
            root.style.setProperty('--text-muted', '#999999');
            root.style.setProperty('--border-color', '#e0e0e0');

            // Interactive elements
            root.style.setProperty('--hover-bg', '#f0f0f0');
            root.style.setProperty('--active-bg', '#f8f9fa');
        }

        // Font Family
        const fontMap: Record<string, string> = {
            'default': "'Inclusive Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            'classic': "'Goudy Bookletter 1911', Georgia, serif",
            'mono': "'Fira Code', monospace",
            'cozy': "'Gaegu', 'Comic Sans MS', cursive",
            'system': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        };
        root.style.setProperty('--font-family', fontMap[fontFamily] || fontMap.default);

        // Font Sizes
        const systemSizes = ['13px', '14px', '16px', '18px', '20px'];
        const editorSizes = ['14px', '16px', '18px', '20px', '24px'];
        root.style.setProperty('--system-font-size', systemSizes[systemFontSize]);
        root.style.setProperty('--editor-font-size', editorSizes[editorFontSize]);

    }, [theme, primaryColor, fontFamily, systemFontSize, editorFontSize]);

    // Persist fontFamily to localStorage
    useEffect(() => {
        localStorage.setItem('fontFamily', fontFamily);
    }, [fontFamily]);

    // Persist systemFontSize to localStorage
    useEffect(() => {
        localStorage.setItem('systemFontSize', systemFontSize.toString());
    }, [systemFontSize]);

    // Persist editorFontSize to localStorage
    useEffect(() => {
        localStorage.setItem('editorFontSize', editorFontSize.toString());
    }, [editorFontSize]);

    // Persist primaryColor to localStorage
    useEffect(() => {
        localStorage.setItem('primaryColor', primaryColor);
    }, [primaryColor]);

    // Persist theme to localStorage
    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, primaryColor, setPrimaryColor, fontFamily, setFontFamily, systemFontSize, setSystemFontSize, editorFontSize, setEditorFontSize }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
