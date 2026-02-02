import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
};

export default function Input({
    label,
    error,
    className = '',
    id,
    ...props
}: InputProps) {
    const inputId = id ?? props.name;

    return (
        <div className="space-y-2 w-full">
            {label && (
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor={inputId}>
                    {label}
                </label>
            )}

            <input
                id={inputId}
                className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500' : 'border-gray-300'} ${className}`}
                {...props}
            />

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
    );
}
