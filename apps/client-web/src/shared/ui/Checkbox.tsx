import type { InputHTMLAttributes } from 'react';

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
    onCheckedChange?: (checked: boolean) => void;
};

export default function Checkbox({ className = '', onCheckedChange, onChange, ...props }: CheckboxProps) {
    return (
        <input
            type="checkbox"
            className={`h-4 w-4 rounded border-gray-300 text-[#E8753A] focus:ring-[#E8753A] ${className}`}
            onChange={(e) => {
                onChange?.(e);
                onCheckedChange?.(e.target.checked);
            }}
            {...props}
        />
    );
}
