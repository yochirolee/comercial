"use client";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">{title}</h1>
          {description && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
