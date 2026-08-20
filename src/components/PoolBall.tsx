import React from 'react';
import { POOL_BALL_COLORS } from '../utils/cardUtils';

interface PoolBallProps {
  number: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const PoolBall: React.FC<PoolBallProps> = ({
  number,
  size = 'md',
  isSelected = false,
  onClick,
  disabled = false,
  className = '',
}) => {
  const ballInfo = POOL_BALL_COLORS[number] || {
    bg: '#334155',
    text: '#ffffff',
    isStripe: false,
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base font-bold',
    xl: 'w-18 h-18 text-xl font-bold',
  }[size];

  const centerCircleSize = {
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-7 h-7 text-sm',
    xl: 'w-9 h-9 text-base',
  }[size];

  const baseClasses = `relative rounded-full shrink-0 flex items-center justify-center transition-all transform shadow-md select-none ${sizeClasses} ${
    isSelected ? 'ring-4 ring-amber-400 scale-110 shadow-amber-400/40' : onClick ? 'hover:scale-105 active:scale-95' : ''
  } ${disabled ? 'opacity-40 cursor-not-allowed' : onClick ? 'cursor-pointer' : ''} ${className}`;

  const ballContent = (
    <>
      {/* Stripe band for balls 9-15 */}
      {ballInfo.isStripe && (
        <div
          className="absolute inset-y-1.5 inset-x-0 w-full flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: ballInfo.bg }}
        />
      )}

      {/* 3D Sphere Lighting Shadow Overlay */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/40 via-transparent to-white/40 pointer-events-none" />

      {/* White center circle with black number */}
      <div
        className={`relative z-10 rounded-full bg-white text-black font-extrabold flex items-center justify-center shadow-inner ${centerCircleSize}`}
      >
        {number}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        id={`pool-ball-${number}`}
        onClick={onClick}
        disabled={disabled}
        className={baseClasses}
        style={{
          backgroundColor: ballInfo.isStripe ? '#f8fafc' : ballInfo.bg,
        }}
      >
        {ballContent}
      </button>
    );
  }

  return (
    <div
      id={`pool-ball-${number}`}
      className={baseClasses}
      style={{
        backgroundColor: ballInfo.isStripe ? '#f8fafc' : ballInfo.bg,
      }}
    >
      {ballContent}
    </div>
  );
};
