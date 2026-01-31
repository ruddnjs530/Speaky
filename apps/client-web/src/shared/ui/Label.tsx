import type { LabelHTMLAttributes, PropsWithChildren } from 'react';

type LabelProps = PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>;

export default function Label({ children, className = '', ...props }: LabelProps) {
    return (
        <label
            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
            {...props}
        >
            {children}
        </label>
    );
}
