import { motion } from 'framer-motion';

export function HostCardPattern() {
    return (
        <>
            <motion.line
                x1="200" y1="0" x2="280" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.2, ease: "easeOut" }}
            />
            <motion.line
                x1="240" y1="0" x2="320" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.3, ease: "easeOut" }}
            />
            <motion.line
                x1="280" y1="0" x2="360" y2="300"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.4, ease: "easeOut" }}
            />
            <motion.line
                x1="200" y1="200" x2="350" y2="200"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.5, ease: "easeOut" }}
            />
            <motion.line
                x1="250" y1="250" x2="280" y2="220"
                stroke="white" strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 1.6, ease: "easeOut" }}
            />
        </>
    );
}
