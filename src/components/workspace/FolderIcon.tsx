'use client';

import React from 'react';
import { RunixFolderIconRegistry } from '@/lib/workspace/icon-registry';

interface FolderIconProps {
  folderName: string;
  isOpen?: boolean;
  className?: string;
  size?: number;
}

export const FolderIcon: React.FC<FolderIconProps> = ({
  folderName,
  isOpen = false,
  className = '',
  size = 15,
}) => {
  const descriptor = RunixFolderIconRegistry.resolve(folderName, isOpen);
  const IconComponent = descriptor.IconComponent;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      title={`${descriptor.label} folder (${folderName})`}
      aria-label={`${descriptor.label} folder, ${isOpen ? 'open' : 'closed'}`}
    >
      <IconComponent size={size} style={{ color: descriptor.color }} strokeWidth={1.8} />
    </span>
  );
};
