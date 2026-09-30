"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { CloseIcon } from "./icons";

interface Props {
  open: boolean;
  onClose(): void;
  title: string;
  variant?: "modal" | "drawer";
  children: ReactNode;
}

/** Native <dialog> (focus trap, Esc, inert background) driven by an `open` prop. */
export default function Dialog({ open, onClose, title, variant = "modal", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant}`}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicks on the backdrop land on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          <header className="dialog-header">
            <h2>{title}</h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
