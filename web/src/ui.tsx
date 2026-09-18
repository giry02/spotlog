import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'regular' | 'compact' | 'card';
  loading?: boolean;
};

/** Shared actions: screens set layout, variants own visual identity. */
export function Button({ variant = 'primary', size = 'regular', loading = false, disabled, className = '', children, type = 'button', ...props }: ButtonProps) {
  const originalRole = size === 'regular' ? (variant === 'primary' ? 'primary' : variant === 'secondary' ? 'outline' : '') : size === 'card' && props['aria-pressed'] === true ? 'saved' : '';
  return <button {...props} type={type} className={`${originalRole} ui-button ui-button--${variant} ui-button--${size} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading && <LoaderCircle className="ui-spinner" size={18} aria-hidden="true" />}{children}
  </button>;
}

export function IconButton({ className = '', variant = 'secondary', ...props }: Omit<ButtonProps, 'size'> & { 'aria-label': string }) {
  return <Button {...props} variant={variant} size="compact" className={`ui-icon-button ${className}`} />;
}

export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return <label className={`ui-field ${className}`}><span className="ui-field-label">{label}</span>{children}{hint && <span className="ui-field-hint">{hint}</span>}</label>;
}

/** Native picker stays functional, while its visible trigger uses the same button. */
export function FileUpload({ label, hint, accept, onSelect, disabled = false }: {
  label: string;
  hint?: string;
  accept: string;
  onSelect: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="ui-file-upload ui-stack">
    <span className="ui-sr-only" id={`${id}-label`}>{label}</span>
    <input ref={input} type="file" accept={accept} hidden disabled={disabled || busy} aria-labelledby={`${id}-label`} onChange={async (event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      setFileName(file.name); setError(''); setBusy(true);
      try { await onSelect(file); } catch { setError('파일을 처리하지 못했습니다. 다시 선택해 주세요.'); }
      finally { setBusy(false); }
    }} />
    <Button variant="secondary" disabled={disabled} loading={busy} onClick={() => input.current?.click()} aria-describedby={hint ? `${id}-hint` : undefined}><Upload size={18} />{label}</Button>
    {fileName && <p className="ui-file-name" role="status">{fileName}</p>}
    {hint && <p className="ui-field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="ui-error" role="alert">{error}</p>}
  </div>;
}
