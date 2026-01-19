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
        <div className="input-field">
            {label && (
                <label className="input-label" htmlFor={inputId}>
                    {label}
                </label>
            )}

            <input
                id={inputId}
                className={['input', error ? 'input--error' : '', className].filter(Boolean).join(' ')}
                {...props}
            />

            {error && <p className="input-error">{error}</p>}
        </div>
    );
}
