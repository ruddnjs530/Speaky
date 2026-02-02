import React from 'react';

interface RoleCardProps {
    role: string;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    onClick: () => void;
    pattern: React.ReactNode;
}

export function RoleCard({ title, subtitle, description, icon, gradient, onClick, pattern }: RoleCardProps) {
    return (
        <button
            onClick={onClick}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-12 text-left transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] w-full`}
        >
            {/* Decorative Lines */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
                    {pattern}
                </svg>
            </div>

            <div className="relative">
                <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                    {icon}
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">{title}</h3>
                <p className="text-lg font-medium text-white">{subtitle}</p>
                <p className="mt-4 text-white/90">
                    {description}
                </p>
            </div>
        </button>
    );
}
