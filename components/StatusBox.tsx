
import React from 'react';
import type { Status } from '../types';

interface StatusBoxProps {
  status: Status;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ status }) => {
  const baseClasses = 'p-3 rounded-md text-sm text-center transition-all duration-300';
  
  const typeClasses = {
    info: 'bg-blue-100 text-blue-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <div id="statusBox" className={`${baseClasses} ${typeClasses[status.type]}`}>
      {status.message}
    </div>
  );
};
