import { X, Clock, MapPin } from 'lucide-react';
import { NewsItem } from '../data/mockNews';

interface StoryModalProps {
  news: NewsItem | null;
  onClose: () => void;
}

export function StoryModal({ news, onClose }: StoryModalProps) {
  if (!news) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-slide-up sm:animate-scale-up">
        {/* Header Image */}
        <div className="relative aspect-video w-full overflow-hidden bg-gray-200">
          <img
            src={news.image}
            alt={news.title}
            className="w-full h-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-240px)] sm:max-h-[calc(85vh-240px)]">
          <div className="p-6">
            {/* Meta Info */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full">
                {news.category}
              </span>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                <span>{news.location}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{news.time}</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-gray-900 mb-2">
              {news.title}
            </h1>

            {/* Source */}
            <p className="text-sm text-gray-600 mb-6">
              By {news.source}
            </p>

            {/* Full Story */}
            {news.fullStory ? (
              <div className="prose prose-sm max-w-none">
                {news.fullStory.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="text-gray-700 mb-4 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-2">Full story not available yet.</p>
                <p className="text-sm">Check back later for more details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
