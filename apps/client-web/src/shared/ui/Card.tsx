import type { PropsWithChildren, ReactNode, HTMLAttributes } from "react";
import "./Card.css";

export interface CardProps extends PropsWithChildren, HTMLAttributes<HTMLElement> {
    title?: string;
    subtitle?: string;
    right?: ReactNode;
}

export default function Card({
                                 title,
                                 subtitle,
                                 right,
                                 className,
                                 children,
                                 ...rest
                             }: CardProps) {
    const cls = ["card", className].filter(Boolean).join(" ");

    return (
        <section className={cls} {...rest}>
            {(title || right) && (
                <header className="card__header">
                    <div className="card__headerText">
                        {title && <h3 className="card__title">{title}</h3>}
                        {subtitle && <p className="card__subtitle">{subtitle}</p>}
                    </div>
                    {right && <div className="card__right">{right}</div>}
                </header>
            )}

            <div className="card__body">{children}</div>
        </section>
    );
}
