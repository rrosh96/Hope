import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CategoryTabs } from './components/CategoryTabs';
import { NewsCard } from './components/NewsCard';
import { StoryModal } from './components/StoryModal';
import { mockNewsData, categories, NewsItem } from './data/mockNews';

export default function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [userLocation, setUserLocation] = useState('Detecting location...');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  useEffect(() => {
    // Mock location detection
    setTimeout(() => {
      setUserLocation('San Francisco, CA');
    }, 1000);
  }, []);

  const filteredNews = activeCategory === 'All'
    ? mockNewsData
    : mockNewsData.filter(news => news.category === activeCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header location={userLocation} />

      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <main className="px-4 py-6 pb-20">
        <div className="max-w-2xl mx-auto space-y-4">
          {filteredNews.map((news) => (
            <NewsCard
              key={news.id}
              {...news}
              onClick={() => setSelectedNews(news)}
            />
          ))}
        </div>

        {filteredNews.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No stories found in this category.</p>
            <p className="text-sm mt-2">Check back soon for updates!</p>
          </div>
        )}
      </main>

      <StoryModal
        news={selectedNews}
        onClose={() => setSelectedNews(null)}
      />
    </div>
  );
}