import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface RoleCardProps extends HTMLMotionProps<"button"> {
    role: string;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    pattern: React.ReactNode;
}

export function RoleCard({ title, subtitle, description, icon, gradient, pattern, className, ...props }: RoleCardProps) {
    return (
        <motion.button
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-12 text-left transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] w-full ${className || ''}`}
            {...props}
        >
            {/* 장식 라인 */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
                    {pattern}
                </svg>
            </div>

            <div className="relative">
                <motion.div
                    className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm"
                    whileHover={{ rotate: [0, -10, 10, -10, 0], transition: { duration: 0.5 } }}
                >
                    {icon}
                </motion.div>
                <h3 className="text-2xl font-bold mb-2 text-white">{title}</h3>
                <p className="text-lg font-medium text-white">{subtitle}</p>
                <p className="mt-4 text-white/90">
                    {description}
                </p>
            </div>
        </motion.button>
    );
}
