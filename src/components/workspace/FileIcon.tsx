'use client';

import React from 'react';
import { RunixFileIconRegistry } from '@/lib/workspace/icon-registry';

interface FileIconProps {
  filename: string;
  className?: string;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({ filename, className = '', size = 15 }) => {
  const descriptor = RunixFileIconRegistry.resolve(filename);
  const IconComponent = descriptor.IconComponent;

  return (
    <span
      className={`inline-flex items-center justify-center relative shrink-0 ${className}`}
      title={`${descriptor.label} (${filename})`}
      aria-label={descriptor.label}
    >
      <IconComponent size={size} style={{ color: descriptor.color }} strokeWidth={1.8} />
      {descriptor.badge && (
        <span
          className="absolute -top-1 -right-1 text-[8px] font-bold leading-none select-none"
          style={{ color: descriptor.color }}
        >
          {descriptor.badge}
        </span>
      )}
    </span>
  );
};
