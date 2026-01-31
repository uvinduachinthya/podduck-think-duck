import { useEffect, useState, useRef } from 'react';

export const SmoothInputCursor = ({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) => {
    const [pos, setPos] = useState({ top: 0, left: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [isBlinking, setIsBlinking] = useState(true);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    
    // Internal state
    const wasMouseInteractionRef = useRef(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const measureSpanRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        // Create measurement span if it doesn't exist (or just use the ref)
        // We render it in the JSX effectively

        const updateCursor = () => {
            if (!input || !measureSpanRef.current) return;

            const selectionStart = input.selectionStart || 0;
            const text = input.value;
            const textBeforeCaret = text.substring(0, selectionStart);

            // Update measurement span styles to match input completely
            const computedStyle = window.getComputedStyle(input);
            measureSpanRef.current.style.font = computedStyle.font;
            measureSpanRef.current.style.fontSize = computedStyle.fontSize;
            measureSpanRef.current.style.fontWeight = computedStyle.fontWeight;
            measureSpanRef.current.style.letterSpacing = computedStyle.letterSpacing;
            measureSpanRef.current.textContent = textBeforeCaret;

            // Get Measurement
            const spanWidth = measureSpanRef.current.getBoundingClientRect().width;
            
            // Calculate absolute position
            const inputRect = input.getBoundingClientRect();
            
            // Adjust for padding/scroll if needed (input text aligns left usually)
            // Assuming simplified input styles (no horizontal scroll for title usually)
            // If title is long and scrolls, this logic needs scrollLeft.
            
            const paddingLeft = parseFloat(computedStyle.paddingLeft);
            const left = inputRect.left + paddingLeft + spanWidth - input.scrollLeft;
            const top = inputRect.top + parseFloat(computedStyle.paddingTop);
            
            // Height approximation based on font size or computed height
            // Using computed line height or simple calculation
             const height = parseFloat(computedStyle.fontSize) * 1.4; // rough multiplier or use line-height
             
             // Check animation eligibility
             const animate = !wasMouseInteractionRef.current;
             setShouldAnimate(animate);

             setPos({
                 top: top + (inputRect.height - height) / 2, // Center vertically roughly
                 left: left,
                 height: height
             });

             // Reset blinking
             setIsBlinking(false);
             if (timeoutRef.current) clearTimeout(timeoutRef.current);
             timeoutRef.current = setTimeout(() => setIsBlinking(true), 500);
        };

        const handleMouseDown = () => { wasMouseInteractionRef.current = true; };
        const handleKeyDown = () => { wasMouseInteractionRef.current = false; };
        
        const handleInput = () => {
            updateCursor();
        };

        const handleFocus = () => {
            setIsVisible(true);
            updateCursor();
        };

        const handleBlur = () => {
            setIsVisible(false);
        };
        
        // Selection change detection (arrow keys)
        const handleSelectionChange = () => {
             if (document.activeElement === input) {
                 updateCursor();
             }
        };

        input.addEventListener('mousedown', handleMouseDown);
        input.addEventListener('keydown', handleKeyDown);
        input.addEventListener('input', handleInput);
        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);
        document.addEventListener('selectionchange', handleSelectionChange);
        window.addEventListener('resize', updateCursor);

        // Initial check
        if (document.activeElement === input) {
            handleFocus();
        }

        return () => {
            input.removeEventListener('mousedown', handleMouseDown);
            input.removeEventListener('keydown', handleKeyDown);
            input.removeEventListener('input', handleInput);
            input.removeEventListener('focus', handleFocus);
            input.removeEventListener('blur', handleBlur);
            document.removeEventListener('selectionchange', handleSelectionChange);
            window.removeEventListener('resize', updateCursor);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [inputRef]);

    if (!isVisible) return <span ref={measureSpanRef} style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' }} />;

    const transitionStyle = shouldAnimate
        ? 'all 0.08s cubic-bezier(0, 0, 0.08, 1)'
        : 'none';

    return (
        <>
            <span ref={measureSpanRef} style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' }} />
            <div
                className={`smooth-cursor ${isBlinking ? 'blinking' : ''}`}
                style={{
                    position: 'fixed',
                    top: `${pos.top}px`,
                    left: `${pos.left}px`,
                    height: `${pos.height}px`,
                    width: '2px',
                    backgroundColor: 'var(--primary-color)',
                    transition: transitionStyle,
                    pointerEvents: 'none',
                    zIndex: 100,
                    borderRadius: '1px'
                }}
            />
        </>
    );
};
