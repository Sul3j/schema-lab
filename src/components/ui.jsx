import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Tooltip renderowany w portalu – nie jest obcinany przez przewijane panele */
export function Tooltip({ content, children, side = 'top', width = 260, className = '', delay = 120 }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const [pos, setPos] = useState(null);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const s = side === 'top' && r.top < 140 ? 'bottom' : side;
      setPos({ x: r.left + r.width / 2, top: r.top, bottom: r.bottom, side: s });
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setPos(null);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!content) return children;

  const left = pos ? Math.min(Math.max(8, pos.x - width / 2), window.innerWidth - width - 8) : 0;

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide} onPointerDown={hide} className={`inline-flex ${className}`}>
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left,
              width,
              top: pos.side === 'top' ? pos.top - 8 : pos.bottom + 8,
              transform: pos.side === 'top' ? 'translateY(-100%)' : undefined,
            }}
            className="animate-pop pointer-events-none z-[200] rounded-lg bg-slate-900/95 px-3 py-2.5 text-xs leading-relaxed text-slate-100 shadow-xl ring-1 ring-white/10 backdrop-blur"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

/** Treść tooltipa z tytułem */
export const TipBody = ({ title, children, example }) => (
  <div>
    {title && <div className="mb-1 font-semibold text-white">{title}</div>}
    <div className="text-slate-300">{children}</div>
    {example && <div className="mt-1.5 font-mono text-[11px] text-indigo-300">{example}</div>}
  </div>
);

export function Modal({ open, onClose, title, icon: Icon, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div
        className={`animate-pop flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Icon size={18} />
            </div>
          )}
          <h2 className="flex-1 text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Zamknij">
            <X size={18} />
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

const BTN = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  'danger-ghost': 'text-rose-600 hover:bg-rose-50',
};

export function Button({ variant = 'secondary', size = 'md', icon: Icon, children, className = '', ...props }) {
  const sz = size === 'sm' ? 'h-8 px-2.5 text-[13px] gap-1.5' : 'h-9 px-3.5 text-sm gap-2';
  return (
    <button
      {...props}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${sz} ${BTN[variant]} ${className}`}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, tip, className = '', size = 16, ...props }) {
  const btn = (
    <button
      {...props}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
    >
      <Icon size={size} />
    </button>
  );
  return tip ? (
    <Tooltip content={tip} width={200}>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

export const inputBase =
  'h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100';

export const inputCls =
  'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100';

export const Label = ({ children, hint }) => (
  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
    {children}
    {hint}
  </label>
);

/** Autofocus + zaznaczenie tekstu */
export function useAutoFocus(open) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (open) setTimeout(() => ref.current?.select?.(), 30);
  }, [open]);
  return ref;
}

export function Toast({ toast }) {
  if (!toast) return null;
  return createPortal(
    <div key={toast.id} className="animate-pop fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl">
      {toast.text}
    </div>,
    document.body
  );
}

export function ConfirmModal({ confirm, onClose }) {
  return (
    <Modal
      open={!!confirm}
      onClose={onClose}
      title={confirm?.title}
      icon={confirm?.icon}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>Anuluj</Button>
          <Button
            variant={confirm?.danger ? 'danger' : 'primary'}
            onClick={() => {
              confirm?.onConfirm();
              onClose();
            }}
          >
            {confirm?.confirmLabel ?? 'Potwierdź'}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{confirm?.message}</p>
    </Modal>
  );
}
