import type { PropsWithChildren, ReactNode, HTMLAttributes } from "react";

export interface CardProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
    title?: string;
    subtitle?: string;
    right?: ReactNode;
}

export default function Card({
    title,
    subtitle,
    right,
    className = '',
    children,
    ...rest
}: CardProps) {
    const baseClasses = "rounded-xl border bg-card text-card-foreground shadow-sm bg-white";
    const cls = [baseClasses, className].filter(Boolean).join(" ");

    return (
        <section className={cls} {...rest}>
            {(title || right) && (
                <header className="flex flex-col space-y-1.5 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            {title && <h3 className="font-semibold leading-none tracking-tight">{title}</h3>}
                            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                        </div>
                        {right && <div>{right}</div>}
                    </div>
                </header>
            )}

            <div className="p-6 pt-0">{children}</div>
        </section>
    );
}
