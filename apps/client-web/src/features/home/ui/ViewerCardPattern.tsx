import { motion } from 'framer-motion';

export function ViewerCardPattern() {
    return (
        <>
            <motion.line
                x1="80" y1="0" x2="160" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.2, ease: "easeOut" }}
            />
            <motion.line
                x1="150" y1="0" x2="230" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.3, ease: "easeOut" }}
            />
            <motion.line
                x1="220" y1="0" x2="300" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.4, ease: "easeOut" }}
            />
            <motion.line
                x1="290" y1="0" x2="370" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.5, ease: "easeOut" }}
            />
            <motion.line
                x1="50" y1="150" x2="200" y2="150"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.6, ease: "easeOut" }}
            />
            <motion.line
                x1="250" y1="200" x2="350" y2="200"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.7, ease: "easeOut" }}
            />
        </>
    );
}
