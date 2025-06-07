import React from 'react'

interface CardProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  className?: string
  variant?: 'primary' | 'secondary'
}

export function Card({ 
  children, 
  title, 
  subtitle, 
  className = '',
  variant = 'primary'
}: CardProps) {
  const baseClasses = 'rounded-2xl p-5'
  
  const variantClasses = {
    primary: 'bg-[#1A1A1A] shadow-[0_4px_12px_rgba(0,0,0,0.15)]',
    secondary: 'bg-neutral-800 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200'
  }
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`
  
  return (
    <div className={classes}>
      {title && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-[#888888] mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}