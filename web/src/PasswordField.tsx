import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './password-field.css';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  label: string;
  hint?: ReactNode;
  value: string;
};

/** One controlled password input; visibility never changes its value or submits the form. */
export function PasswordField({ label, hint, value, disabled, id: suppliedId, ...props }: PasswordFieldProps) {
  const generatedId = useId(), id = suppliedId ?? generatedId;
  const input = useRef<HTMLInputElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const selection = useRef<{ start: number; end: number; direction: 'forward' | 'backward' | 'none'; focus: boolean } | null>(null);
  const restoreFrame = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const hasValue = value.length > 0;
  const visible = revealed && !disabled;
  useLayoutEffect(() => { if (disabled || !hasValue) setRevealed(false); }, [disabled, hasValue]);
  useLayoutEffect(() => {
    const previous = selection.current, target = input.current;
    selection.current = null;
    if (!previous || !target) return;
    const restore = () => {
      if (previous.focus && document.activeElement !== target && document.activeElement !== toggleButton.current) return;
      if (previous.focus) target.focus({ preventScroll: true });
      // Some WebViews finish changing input type after the React commit.
      try { target.setSelectionRange(previous.start, previous.end, previous.direction); } catch { /* Keep the value and focus if selection APIs are unavailable. */ }
    };
    restore();
    restoreFrame.current = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(restoreFrame.current);
  }, [visible]);
  const rememberSelection = () => {
    const target = input.current;
    if (!target) return;
    if (target.selectionStart !== null && target.selectionEnd !== null) selection.current = {
      start: target.selectionStart, end: target.selectionEnd, direction: target.selectionDirection ?? 'none', focus: document.activeElement === target,
    };
  };
  const toggle = () => {
    if (disabled) return;
    if (!selection.current) rememberSelection();
    setRevealed(current => !current);
  };
  const hintId = hint ? `${id}-hint` : undefined;
  return <div className="ui-field account-password-field">
    <label className="ui-field-label" htmlFor={id}>{label}</label>
    <div className="account-password-control">
      <input {...props} ref={input} id={id} type={visible ? 'text' : 'password'} value={value} disabled={disabled} aria-describedby={[props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined}
        onKeyDown={event => { cancelAnimationFrame(restoreFrame.current); selection.current = null; props.onKeyDown?.(event); }}
        onPointerDown={event => { cancelAnimationFrame(restoreFrame.current); selection.current = null; props.onPointerDown?.(event); }}
        onChange={event => { cancelAnimationFrame(restoreFrame.current); selection.current = null; props.onChange?.(event); }}/>
      <button ref={toggleButton} type="button" className="account-password-toggle" disabled={disabled} aria-label={`${label} ${visible ? '숨기기' : '보기'}`} aria-controls={id} aria-pressed={visible}
        onPointerDown={event => { rememberSelection(); if (document.activeElement === input.current) event.preventDefault(); }} onClick={toggle}>
        {visible ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}<span>{visible ? '숨기기' : '보기'}</span>
      </button>
    </div>
    {hint && <span className="ui-field-hint" id={hintId}>{hint}</span>}
  </div>;
}
