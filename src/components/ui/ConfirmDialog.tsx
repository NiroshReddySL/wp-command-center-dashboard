import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  /** What will actually happen. Name the specific thing being acted on —
   *  "Remove Akismet?" beats "Are you sure?" every time. */
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as danger. Destructive by default, because
   *  that is the only reason to interrupt someone with a dialog. */
  destructive?: boolean
  pending?: boolean
}

/**
 * Confirmation for an action worth pausing over.
 *
 * Cancel takes focus rather than confirm: a dialog that appears under a
 * cursor already moving toward a button should not have the destructive
 * option armed and waiting for Enter. Escape and the backdrop both cancel,
 * so every accidental dismissal is the safe one.
 */
export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  pending = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      // Deliberately not the confirm button — see the note above.
      const id = requestAnimationFrame(() => cancelRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  return (
    <Modal open={open} onClose={pending ? () => {} : onCancel} size="sm">
      <div className="flex gap-3">
        {destructive && (
          <span
            aria-hidden
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"
          >
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-text-primary dark:text-text-primary-dark">
            {title}
          </h2>
          <div className="mt-1 text-[13px] leading-relaxed text-text-secondary dark:text-text-secondary-dark">
            {children}
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button ref={cancelRef} variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
