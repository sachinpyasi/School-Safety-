'use client';

// A form that asks before it submits. The server action is passed in as a prop — Next lets a server
// action cross the boundary — so the page can stay a server component and only this tiny wrapper
// needs to run in the browser. Without JavaScript the form submits directly, which is acceptable for
// a revoke (grant it again). Deleting a year is NOT undoable, so that action re-checks a typed
// confirmation on the server as well (app/(app)/posh/actions.ts).
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
