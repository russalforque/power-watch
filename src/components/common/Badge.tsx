import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'amber' | 'blue' | 'green' | 'red' | 'slate';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'slate',
  size = 'md',
  className = '',
  dot = false
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs font-semibold px-2.5 py-1'
  };

  const variantStyles = {
    amber: 'bg-amber-100 text-amber-900 border border-amber-200/80',
    blue: 'bg-blue-50 text-blue-800 border border-blue-200',
    green: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    red: 'bg-rose-50 text-rose-800 border border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border border-slate-200'
  };

  const dotColors = {
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    slate: 'bg-slate-500'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-tight whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
