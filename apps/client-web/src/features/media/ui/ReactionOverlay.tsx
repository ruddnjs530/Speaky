import { useState, useEffect } from 'react';
import './ReactionOverlay.css';

// Using paths relative to 'public' folder
const GIFS = [
    { src: '/virtual/fit.gif', alt: 'Fit' },
    { src: '/virtual/rg.gif', alt: 'RG' },
    { src: '/virtual/staty.gif', alt: 'Staty' },
    { src: '/virtual/wise.gif', alt: 'Wise' },
];

export default function ReactionOverlay() {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // Preload images to prevent flickering
        GIFS.forEach((item) => {
            const img = new Image();
            img.src = item.src;
        });

        // Change GIF every 3 seconds (adjust timing as needed)
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % GIFS.length);
        }, 3000);

        return () => clearInterval(timer);
    }, []);

    const gif = GIFS[currentIndex];

    return (
        <div className="reaction-overlay">
            <div className="reaction-item" key={gif.src}>
                <img
                    src={gif.src}
                    alt={gif.alt}
                    className="reaction-gif"
                />
            </div>
        </div>
    );
}
