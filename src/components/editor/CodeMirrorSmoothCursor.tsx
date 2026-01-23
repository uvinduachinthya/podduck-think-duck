import { useEffect, useState, useRef } from 'react';
import { EditorView } from '@codemirror/view';

export const CodeMirrorSmoothCursor = ({ view }: { view: EditorView | null }) => {
    const [pos, setPos] = useState({ top: 0, left: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [isBlinking, setIsBlinking] = useState(true);
    const [shouldAnimate, setShouldAnimate] = useState(false);

    const [isHiddenTemp, setIsHiddenTemp] = useState(false);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track block context
    const lastBlockRef = useRef<Element | null>(null);
    // Track if the last interaction was a mouse click
    const wasMouseInteractionRef = useRef(false);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!view) return;

        // Mouse listeners to detect clicks vs keyboard
        const handleMouseDown = () => {
            wasMouseInteractionRef.current = true;
        };

        const handleKeyDown = () => {
            wasMouseInteractionRef.current = false;
        };

        const handleGlobalClick = (e: MouseEvent) => {
            if (!view || !view.dom) return;
            const editorElement = view.dom;
            const target = e.target as Node;
            if (editorElement && !editorElement.contains(target)) {
                setIsVisible(false);
            }
        };

        const updateCursor = (e?: Event) => {
            if (!view) return;
            
            // Check focus
            if (!view.hasFocus) {
                // If we don't have focus, but the selection is still there, we might want to show it? 
                // Usually CodeMirror hides cursor on blur.
                setIsVisible(false);
                return;
            } else {
                setIsVisible(true);
            }

            const state = view.state;
            const selection = state.selection.main;
            const { head } = selection;

            try {
                // Get cursor coordinates
                const coords = view.coordsAtPos(head);

                // Identify the current block element
                // CodeMirror's domAtPos returns {node, offset}
                const domInfo = view.domAtPos(head);
                const node = domInfo.node instanceof Element ? domInfo.node : domInfo.node.parentElement;
                
                // CodeMirror 6 markdown renders lines as div.cm-line usually, or headers.
                const currentBlock = node?.closest('.cm-line, h1, h2, h3, h4, h5, h6, pre, blockquote');

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
                const animate = !!isSameBlock && !wasMouseInteractionRef.current && !isScrollOrResize;
                setShouldAnimate(animate);

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

        const handleCmUpdate = () => {
            updateCursor();
        };

        const handleFocus = () => {
            setIsVisible(true);
            updateCursor();
        };

        const handleBlur = () => {
             setIsVisible(false);
        };

        // Listen for custom event dispatched from CodeMirrorEditor
        view.dom.addEventListener('cm-update', handleCmUpdate);
        view.dom.addEventListener('focus', handleFocus); // Native focus on contentDOM/dom
        view.dom.addEventListener('blur', handleBlur);

        window.addEventListener('mousedown', handleMouseDown, true);
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('scroll', updateCursor, true);
        window.addEventListener('resize', updateCursor);
        document.addEventListener('click', handleGlobalClick, true);

        // Initial check
        if (view.hasFocus) {
            updateCursor();
        }

        return () => {
            view.dom.removeEventListener('cm-update', handleCmUpdate);
            view.dom.removeEventListener('focus', handleFocus);
            view.dom.removeEventListener('blur', handleBlur);

            window.removeEventListener('mousedown', handleMouseDown, true);
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('scroll', updateCursor, true);
            window.removeEventListener('resize', updateCursor);
            document.removeEventListener('click', handleGlobalClick, true);

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [view]);

    if (!isVisible || !view) return null;

    const transitionStyle = shouldAnimate
        ? 'all 0.08s cubic-bezier(0, 0, 0.08, 1)'
        : 'none';

    // Same "Smooth Fade" blinking logic as previous implementation
    // Assuming CSS class .blinking exists in global CSS (it does)
    
    // Note: The previous implementation used window.scroll listener. CodeMirror scroller is internal.
    // We need to listen to scroll on the .cm-scroller element via the view or capture phase.
    // 'scroll' does not bubble, so window listener won't catch editor scroll if standard DOM.
    // CodeMirror 6 scrolls the .cm-scroller div. 
    // We added 'true' (capture) to window scroll listener, which should catch it.
    
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
                zIndex: 100, // Ensure it's on top
                borderRadius: '1px',
                opacity: isHiddenTemp ? 0 : 1
            }}
        />
    );
};
