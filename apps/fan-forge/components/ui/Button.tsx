interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold transition-colors focus:outline-none';
  const variants = {
    primary:
      'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200',
    secondary:
      'border border-black/20 text-black hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/5',
  };

  return (
    <button type="button" onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
