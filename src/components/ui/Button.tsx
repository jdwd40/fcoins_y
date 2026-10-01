import React from 'react';
import { Link } from 'react-router-dom';

// After-Hours Exchange shared button. Variants map to the semantic palette:
// buy = up/green, sell = down/red, primary = brand, ghost/subtle = surfaces.

export type ButtonVariant = 'primary' | 'buy' | 'sell' | 'ghost' | 'subtle';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-gold',
  buy: 'btn-up',
  sell: 'btn-down',
  ghost: 'btn-ink',
  subtle: 'btn-ink'
};

const classes = (variant: ButtonVariant, block: boolean, className: string) =>
  `${VARIANT_CLASS[variant]} ${block ? 'w-full' : ''} ${className}`.trim();

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Full-width block button. */
  block?: boolean;
}

export function Button({ variant = 'primary', block = false, className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, block, className)}
      {...rest}
    />
  );
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  /** Full-width block link. */
  block?: boolean;
}

/** A link styled exactly like a Button. Use this instead of nesting a
 *  <Button> inside a <Link> — nested interactive elements are invalid HTML
 *  and break assistive-tech announcements. */
export function ButtonLink({ variant = 'primary', block = false, className = '', ...rest }: ButtonLinkProps) {
  return (
    <Link
      className={classes(variant, block, className)}
      {...rest}
    />
  );
}
