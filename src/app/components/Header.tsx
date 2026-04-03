import { MapPin, Sunrise } from 'lucide-react';

interface HeaderProps {
  location: string;
}

export function Header({ location }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Sunrise className="w-6 h-6 text-green-600" />
            <div>
              <h1 className="text-green-700">Hope</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{location}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
