import { Clock, MapPin } from 'lucide-react';

interface NewsCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  time: string;
  image: string;
  source: string;
  onClick?: () => void;
}

export function NewsCard({ title, description, category, location, time, image, source, onClick }: NewsCardProps) {
  return (
    <article
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="aspect-video w-full overflow-hidden bg-gray-200">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
            {category}
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{location}</span>
          </div>
        </div>

        <h2 className="text-gray-900 mb-2 line-clamp-2">
          {title}
        </h2>

        <p className="text-sm text-gray-600 mb-3 line-clamp-3">
          {description}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="text-gray-700">{source}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{time}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
