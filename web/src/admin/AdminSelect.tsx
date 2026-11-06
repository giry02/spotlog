import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

type Option = { value: string; label: string; disabled: boolean };
const text = (node: ReactNode): string => Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : String(child)).join('');
function optionsFrom(children: ReactNode, group = '', disabled = false): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean }>(child)) return [];
    if (child.type === 'option') { const label = child.props.label ?? text(child.props.children); return [{ value: String(child.props.value ?? label), label: group ? `${group} · ${label}` : label, disabled: disabled || !!child.props.disabled }]; }
    return optionsFrom(child.props.children, child.type === 'optgroup' ? child.props.label ?? group : group, disabled || !!child.props.disabled);
  });
}
const searchKey = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, '');

/** A bounded browser popover; native select remains only for form/change semantics. */
export function AdminSelect({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode }) {
  const generated = useId(), id = props.id ?? generated, listId = `${id}-options`;
  const native = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 280, height: 320 });
  const options = useMemo(() => optionsFrom(children), [children]);
  const selectedValue = String(props.value ?? native.current?.value ?? props.defaultValue ?? options[0]?.value ?? '');
  const selected = options.find(option => option.value === selectedValue);
  const filtered = options.filter(option => searchKey(option.label).includes(searchKey(query))), searchable = options.length > 8;
  const name = props['aria-label'] ?? (label ? text(label) : '항목 선택');
  const close = (focus = false) => { setOpen(false); setQuery(''); if (focus) trigger.current?.focus(); };
  const choose = (option: Option) => {
    if (option.disabled || native.current?.matches(':disabled')) return;
    if (native.current) { native.current.value = option.value; native.current.dispatchEvent(new Event('change', { bubbles: true })); }
    close(true);
  };
  const show = () => {
    if (native.current?.matches(':disabled')) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (rect && window.innerHeight - rect.bottom < 180) trigger.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    setQuery(''); setActive(Math.max(0, options.findIndex(option => option.value === selectedValue))); setOpen(true);
  };
  const positionPopup = () => {
    const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
    const width = Math.min(Math.max(rect.width, 220), 360, window.innerWidth - 24), top = rect.bottom + 6;
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top, width, height: Math.max(40, Math.min(340, window.innerHeight - top - 12)) });
  };
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    positionPopup();
    const frame = requestAnimationFrame(() => { if (searchable) search.current?.focus(); });
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => { const target = event.target as Node; if (!popup.current?.contains(target) && !trigger.current?.contains(target)) close(); };
    const scrolled = (event: Event) => { if (!popup.current?.contains(event.target as Node)) { const rect = trigger.current?.getBoundingClientRect(); if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) close(); else positionPopup(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('focusin', dismiss); window.addEventListener('resize', scrolled); document.addEventListener('scroll', scrolled, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss); window.removeEventListener('resize', scrolled); document.removeEventListener('scroll', scrolled, true); };
  }, [open]);
  useEffect(() => { if (props.disabled) close(); }, [props.disabled]);
  useEffect(() => { if (open) popup.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  const keyDown = (event: KeyboardEvent, editing = false) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp', ...(!editing ? ['Home', 'End'] : [])].includes(event.key)) {
      event.preventDefault(); if (!open) { show(); return; }
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      let next = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1 : active + direction;
      for (let attempts = 0; attempts < filtered.length; attempts++) { next = (next + filtered.length) % filtered.length; if (!filtered[next].disabled) break; next += direction; }
      setActive(Math.max(0, next));
    } else if (event.key === 'Enter' || (!editing && event.key === ' ')) { event.preventDefault(); if (!open) show(); else if (filtered[active]) choose(filtered[active]); }
  };
  return <div className={'admin-select ' + (props.className ?? '')}>
    <select {...props} id={`${id}-native`} ref={native} hidden aria-hidden="true" aria-label={undefined} aria-labelledby={undefined} tabIndex={-1}>{children}</select>
    <button type="button" id={id} ref={trigger} className="admin-select-trigger" role="combobox" aria-label={name} aria-labelledby={props['aria-labelledby']} aria-describedby={[`${id}-value`, props['aria-describedby']].filter(Boolean).join(' ')} aria-required={props.required} aria-invalid={props['aria-invalid']} aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && !searchable && filtered[active] ? `${listId}-${active}` : undefined} disabled={props.disabled} onClick={() => open ? close() : show()} onKeyDown={event => keyDown(event)}><span id={`${id}-value`}>{selected?.label ?? '선택해 주세요'}</span><ChevronDown size={16} aria-hidden="true" /></button>
    {open && createPortal(<div ref={popup} className="admin-select-popup" style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.height }}>
      {searchable && <div className="admin-select-search"><Search size={16} aria-hidden="true" /><input ref={search} type="search" aria-label={`${name} 검색`} placeholder="이름으로 찾기" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => keyDown(event, true)} aria-controls={listId} aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined} /></div>}
      <div id={listId} className="admin-select-options" role="listbox" aria-label={name}>{filtered.length ? filtered.map((option, index) => <button type="button" role="option" tabIndex={-1} id={`${listId}-${index}`} key={option.value} data-value={option.value} data-option-index={index} aria-selected={option.value === selectedValue} aria-disabled={option.disabled} className={index === active ? 'is-active' : ''} onPointerMove={() => setActive(index)} onClick={() => choose(option)}><span>{option.label}</span>{option.value === selectedValue && <Check size={16} aria-hidden="true" />}</button>) : <div className="admin-select-empty" role="status">검색 결과가 없어요.</div>}</div>
    </div>, document.body)}
  </div>;
}
