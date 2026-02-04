import { useEffect, useRef, useState } from 'react';

export function useIntersectionObserver(options = {}) {
    const elementRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                // Optional: Stop observing once visible if you only want it to trigger once
                if (elementRef.current) {
                    observer.unobserve(elementRef.current);
                }
            }
        }, { threshold: 0.1, ...options });

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => {
            if (elementRef.current) {
                observer.unobserve(elementRef.current);
            }
        };
    }, []);

    return { elementRef, isVisible };
}
