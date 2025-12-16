import { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';

export const SmoothCursor = ({ editor }: { editor: Editor | null }) => {
    const [pos, setPos] = useState({ top: 0, left: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [isBlinking, setIsBlinking] = useState(true);
    const [shouldAnimate, setShouldAnimate] = useState(false);

    const [isHiddenTemp, setIsHiddenTemp] = useState(false);
    const hideTimeoutRef = useRef<any>(null);

    // Track block context
    const lastBlockRef = useRef<Element | null>(null);
    // Track if the last interaction was a mouse click
    const wasMouseInteractionRef = useRef(false);

    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        if (!editor || editor.isDestroyed || !editor.view) return;

        // Mouse listeners to detect clicks vs keyboard
        const handleMouseDown = () => {
            wasMouseInteractionRef.current = true;
        };

        const handleKeyDown = () => {
            wasMouseInteractionRef.current = false;
        };

        const updateCursor = (e?: any) => {
            if (editor.isDestroyed || !editor.view) return;
            const { selection } = editor.state;

            // Hide cursor for NodeSelections (like Images)
            if (selection instanceof NodeSelection) {
                setIsVisible(false);
                return;
            } else {
                setIsVisible(true);
            }

            const { from } = selection;

            try {
                // Get cursor coordinates
                const coords = editor.view.coordsAtPos(from);

                // Identify the current block element
                const domInfo = editor.view.domAtPos(from);
                const node = domInfo.node instanceof Element ? domInfo.node : domInfo.node.parentElement;
                const currentBlock = node?.closest('p, h1, h2, h3, h4, h5, h6, pre, blockquote');

                // Check if we are in the same block
                const isSameBlock = currentBlock && lastBlockRef.current === currentBlock;
                lastBlockRef.current = currentBlock || null;

                // Check for scroll or resize
                const isScrollOrResize = e && (e.type === 'scroll' || e.type === 'resize');

                // Handle temporary hiding on scroll/resize
                if (isScrollOrResize) {
                    setIsHiddenTemp(true);
                    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                    hideTimeoutRef.current = setTimeout(() => setIsHiddenTemp(false), 200);
                } else {
                    setIsHiddenTemp(false);
                }

                // Determine animation eligibility
                // 1. Must be in the same block
                // 2. Must NOT be a mouse interaction
                // 3. Must NOT be scrolling or resizing
                const animate = !!isSameBlock && !wasMouseInteractionRef.current && !isScrollOrResize;
                setShouldAnimate(animate);

                // Reset mouse flag after processing a "snap" if needed
                // But we mainly rely on keydown to clear it for typing. 
                // However, for subsequent clicks, it stays true.
                // For arrow keys, handleKeyDown clears it, so arrows will glide.

                if (coords) {
                    setPos({
                        top: coords.top,
                        left: coords.left,
                        height: coords.bottom - coords.top
                    });

                    // Reset blinking
                    setIsBlinking(false);
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    timeoutRef.current = setTimeout(() => setIsBlinking(true), 500);
                }
            } catch (e) {
                console.warn('SmoothCursor update failed', e);
            }
        };

        const handleFocus = () => setIsVisible(true);
        const handleBlur = () => setIsVisible(false);

        editor.on('selectionUpdate', updateCursor);
        editor.on('update', updateCursor);
        editor.on('focus', handleFocus);
        editor.on('blur', handleBlur);

        // Use capture to ensure we catch events before Tiptap processes them
        window.addEventListener('mousedown', handleMouseDown, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('scroll', updateCursor, true);
        window.addEventListener('resize', updateCursor);

        if (!editor.isDestroyed && editor.view && editor.isFocused) {
            updateCursor();
            setIsVisible(true);
        }

        return () => {
            editor.off('selectionUpdate', updateCursor);
            editor.off('update', updateCursor);
            editor.off('focus', handleFocus);
            editor.off('blur', handleBlur);

            window.removeEventListener('mousedown', handleMouseDown, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('scroll', updateCursor, true);
            window.removeEventListener('resize', updateCursor);

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [editor]);

    if (!isVisible || !editor || editor.isDestroyed || !editor.view) return null;

    // Transition styles
    const transitionStyle = shouldAnimate
        ? 'all 0.1s cubic-bezier(0, 0, 0.1, 1)'
        : 'none';

    // Combine blinking opacity with hidden state
    const opacity = isHiddenTemp ? 0 : 1;

    return (
        <div
            className={`smooth-cursor ${isBlinking && !isHiddenTemp ? 'blinking' : ''}`}
            style={{
                position: 'fixed',
                top: `${pos.top}px`,
                left: `${pos.left - 1}px`,
                height: `${pos.height}px`,
                width: '2px',
                backgroundColor: 'var(--primary-color)',
                transition: transitionStyle,
                pointerEvents: 'none',
                zIndex: 10,
                borderRadius: '1px',
                opacity: opacity
            }}
        />
    );
};
