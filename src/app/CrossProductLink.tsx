import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';

type PreparedHref = { ok: true; href: string } | { ok: false };

type SharedProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'target' | 'rel' | 'onClick' | 'children'
> & {
  href: string;
  children: ReactNode;
};

/** A product-boundary link always preserves the product in the current tab. */
export function CrossProductLink({ href, children, ...props }: SharedProps) {
  return (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

interface CrossProductActionProps extends SharedProps {
  prepareHref: () => PreparedHref;
  onPrepareFailure?: () => void;
  disabledReason?: string;
}

/**
 * Creates a synchronous browser handoff (for example an import intent), then
 * lets the trusted anchor click open the prepared URL in a new tab.
 */
export function CrossProductAction({
  href,
  children,
  prepareHref,
  onPrepareFailure,
  disabledReason,
  className,
  ...props
}: CrossProductActionProps) {
  if (disabledReason) {
    return (
      <span
        {...props}
        role="link"
        aria-disabled="true"
        title={disabledReason}
        className={className}
      >
        {children}
      </span>
    );
  }

  const prepare = (event: MouseEvent<HTMLAnchorElement>) => {
    const result = prepareHref();
    if (!result.ok) {
      event.preventDefault();
      onPrepareFailure?.();
      return;
    }
    event.currentTarget.href = result.href;
  };

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={prepare}
    >
      {children}
    </a>
  );
}
