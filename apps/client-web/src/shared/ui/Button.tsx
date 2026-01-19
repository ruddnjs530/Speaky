import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonProps = PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary';
    fullWidth?: boolean;
}
>;

export default function Button({
                                   children,
                                   className = '',
                                   variant = 'primary',
                                   fullWidth = true,
                                   disabled,
                                   ...props
                               }: ButtonProps) {
    const classes = [
        'btn',
        variant === 'primary' ? 'btn--primary' : 'btn--secondary',
        fullWidth ? 'btn--full' : '',
        disabled ? 'btn--disabled' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button className={classes} disabled={disabled} {...props}>
            {children}
        </button>
    );
}
