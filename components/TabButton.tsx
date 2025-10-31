
import React from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {
  const activeClasses = 'border-indigo-500 text-indigo-600';
  const inactiveClasses = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';

  return (
    <button
      onClick={onClick}
      className={`py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors duration-200 focus:outline-none ${isActive ? activeClasses : inactiveClasses}`}
    >
      {label}
    </button>
  );
};
