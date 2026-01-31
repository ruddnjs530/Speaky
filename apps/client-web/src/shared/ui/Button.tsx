import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';

type ButtonProps = PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: ButtonVariant;
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

    const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";

    const variants = {
        primary: "bg-[#E8753A] text-white hover:bg-[#D45A3A] shadow",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
    };

    const widthClass = fullWidth ? 'w-full' : '';
    const variantClass = variants[variant] || variants.primary;

    const classes = [
        baseStyles,
        variantClass,
        widthClass,
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
