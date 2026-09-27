import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor: string;
  help?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Label above, helper and error below. */
export function Field({ label, htmlFor, help, error, className, children }: FieldProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={htmlFor} className="vw-label">
        {label}
      </label>
      {children}
      {help && !error && <p className="vw-help">{help}</p>}
      {error && (
        <p className="text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('vw-input', className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('vw-input resize-none', className)} {...props} />;
}
