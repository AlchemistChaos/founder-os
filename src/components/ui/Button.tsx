import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'difficulty-easy' | 'difficulty-medium' | 'difficulty-hard'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-full transition-all duration-200 active:scale-95 touch-target'
  
  const variantClasses = {
    primary: 'bg-white text-black hover:bg-gray-100',
    secondary: 'bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700',
    outline: 'bg-transparent border border-neutral-600 text-neutral-300 hover:bg-neutral-800 hover:text-white',
    'difficulty-easy': 'bg-green-500/10 border border-green-600 text-green-300 hover:bg-green-500/20',
    'difficulty-medium': 'bg-yellow-500/10 border border-yellow-600 text-yellow-300 hover:bg-yellow-500/20',
    'difficulty-hard': 'bg-red-500/10 border border-red-600 text-red-300 hover:bg-red-500/20'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}