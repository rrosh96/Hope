export const categories = [
  'All',
  'World',
  'Business',
  'Technology',
  'Science',
  'Sports',
  'Health',
] as const;

export type NewsCategory = (typeof categories)[number];

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  category: NewsCategory;
  location: string;
  time: string;
  publishedAt: string;
  image?: string;
  source: string;
  url: string;
  positiveScore: number;
}

export interface LocationContext {
  city?: string;
  region?: string;
  country?: string;
}

export interface FeedSource {
  url: string;
  sourceName?: string;
  category?: NewsCategory;
}

const REGION = 'IN:en';
const LANGUAGE = 'en-IN';
const COUNTRY = 'IN';

const buildSearchFeed = (query: string, category?: NewsCategory): FeedSource => ({
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${LANGUAGE}&gl=${COUNTRY}&ceid=${REGION}`,
  category,
});

const uniqueFeeds = (feeds: FeedSource[]) => {
  const byUrl = new Map<string, FeedSource>();

  for (const feed of feeds) {
    byUrl.set(feed.url, feed);
  }

  return Array.from(byUrl.values());
};

function buildPlaceTerms(location?: LocationContext) {
  const rawTerms = [location?.city, location?.region, location?.country].filter(Boolean) as string[];
  const uniqueTerms = Array.from(new Set(rawTerms.map((term) => term.trim()).filter(Boolean)));

  if (uniqueTerms.length === 0) {
    return ['my area', 'local community'];
  }

  return uniqueTerms;
}

export function buildCategoryFeedUrls(location?: LocationContext): Record<NewsCategory, FeedSource[]> {
  const placeTerms = buildPlaceTerms(location);
  const primaryPlace = placeTerms[0];
  const secondaryPlace = placeTerms[1] ?? primaryPlace;
  const joinedPlaces = placeTerms.join(' OR ');
  const localNews = `${primaryPlace} news`;
  const localCommunity = `${primaryPlace} community`;
  const regionalNews = `${secondaryPlace} news`;
  const worldQueries = [
    `${localNews}`,
    `${primaryPlace} humanitarian OR community OR development`,
    `positive world news ${joinedPlaces}`,
    'global recovery OR global breakthrough OR humanitarian success',
    'AP world news positive',
    'UN world humanitarian success',
    'global education success',
    'global health improvement',
    'international community success',
    'world climate solution success',
    'global poverty reduction progress',
    'world peace initiative success',
    'international rescue success',
    'global development milestone',
    'world children support success',
    'global women empowerment progress',
    'world clean water success',
    'international volunteer success',
    'world refugee support progress',
    'global food security improvement',
    'international aid success',
    'world local heroes success',
    'global sustainability progress',
    'world human rights progress',
    'international cooperation success',
    'world clean energy progress',
    'global healthcare access improvement',
    'world rebuilding success',
    'global conservation success',
    'international innovation for good',
    'world civic improvement success',
    'global community resilience',
    'world infrastructure improvement',
    'global children health progress',
    'international diplomacy success',
    'world relief success',
  ];
  const businessQueries = [
    `${primaryPlace} business`,
    `${secondaryPlace} startup OR small business`,
    `${primaryPlace} jobs OR expansion OR investment`,
    'positive business news',
    'startup success OR company growth OR investment win',
    'affordable solution business progress',
    'AP business positive news',
    'BBC business positive growth',
    'NPR business positive',
    'small business growth success',
    'company expansion good news',
    'startup funding success',
    'jobs growth positive business',
    'women entrepreneurs success',
    'social enterprise success',
    'green business growth',
    'ethical business innovation',
    'small business hiring growth',
    'local business success story',
    'business turnaround success',
    'company helps community',
    'manufacturing growth success',
    'inclusive workplace success',
    'retail business comeback',
    'business leadership for good',
    'minority business success',
    'family business growth',
    'business recovery success',
    'small business expansion',
    'sustainable business success',
    'impact investing success',
    'entrepreneurship good news',
    'business innovation improves lives',
    'community business support success',
    'local startup wins',
    'job creation success story',
  ];
  const sportsQueries = [
    `${primaryPlace} sports`,
    `${secondaryPlace} athlete OR team win`,
    `${primaryPlace} tournament OR championship`,
    'positive sports news',
    'athlete comeback OR team win OR championship success',
    'sportsmanship rescue charity sports',
    'local team wins championship',
    'athlete inspires community',
    'sports comeback success',
    'youth sports success story',
    'charity match success',
    'sports team community support',
    'underdog team victory',
    'medal win inspiring story',
    'para athlete success',
    'coach changes lives success',
    'school sports success',
    'women sports achievement',
    'sports fair play success',
    'community sports growth',
    'athlete recovery success',
    'sports volunteer success',
    'team rescue success',
    'sports inclusion success',
    'local athlete breakthrough',
    'championship positive story',
    'sports festival success',
    'marathon charity success',
    'olympic hopeful inspiring story',
    'sports program helps children',
    'adaptive sports success',
    'league comeback win',
    'grassroots sports success',
    'student athlete success',
    'sports team gives back',
    'historic win sports',
  ];
  const healthQueries = [
    `${primaryPlace} health`,
    `${secondaryPlace} hospital OR treatment OR public health`,
    `${primaryPlace} medical OR wellness OR recovery`,
    'positive health news',
    'treatment success OR recovery OR hospital innovation',
    'medical innovation improves lives',
    'public health success story',
    'hospital saves lives breakthrough',
    'vaccine success progress',
    'disease prevention success',
    'mental health support success',
    'community health improvement',
    'patient recovery success',
    'healthcare access improvement',
    'medical breakthrough recovery',
    'child health improvement success',
    'maternal health progress',
    'public health milestone',
    'wellness program success',
    'doctor innovation success',
    'nurse community support success',
    'health education success',
    'medical charity success',
    'hospital care improvement',
    'cancer treatment progress',
    'heart health breakthrough',
    'rehabilitation success story',
    'rare disease treatment success',
    'healthcare technology success',
    'disability care improvement',
    'nutrition program success',
    'rural health improvement',
    'public health campaign success',
    'life saving treatment success',
    'health equity progress',
    'wellness recovery success',
  ];

  const worldFeeds: FeedSource[] = [
    ...worldQueries.map((query) => buildSearchFeed(query, 'World')),
    { url: 'https://feeds.reuters.com/Reuters/worldNews', sourceName: 'Reuters', category: 'World' },
    { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', sourceName: 'BBC', category: 'World' },
    { url: 'https://feeds.npr.org/1004/rss.xml', sourceName: 'NPR', category: 'World' },
    { url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', sourceName: 'UN News', category: 'World' },
  ];

  const businessFeeds: FeedSource[] = [
    ...businessQueries.map((query) => buildSearchFeed(query, 'Business')),
    { url: 'https://feeds.reuters.com/reuters/businessNews', sourceName: 'Reuters', category: 'Business' },
    { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', sourceName: 'CNBC', category: 'Business' },
    { url: 'https://www.entrepreneur.com/latest.rss', sourceName: 'Entrepreneur', category: 'Business' },
    { url: 'http://feeds.bbci.co.uk/news/business/rss.xml', sourceName: 'BBC', category: 'Business' },
    { url: 'https://feeds.npr.org/1006/rss.xml', sourceName: 'NPR', category: 'Business' },
  ];

  const technologyFeeds: FeedSource[] = [
    buildSearchFeed(`${primaryPlace} technology`, 'Technology'),
    buildSearchFeed(`${secondaryPlace} startup technology`, 'Technology'),
    buildSearchFeed(`${primaryPlace} AI OR innovation OR research`, 'Technology'),
    buildSearchFeed('positive technology news', 'Technology'),
    buildSearchFeed('AI breakthrough OR software helps OR tech innovation', 'Technology'),
    buildSearchFeed('tech innovation improves lives', 'Technology'),
    { url: 'https://techcrunch.com/feed/', sourceName: 'TechCrunch', category: 'Technology' },
    { url: 'https://www.wired.com/feed/rss', sourceName: 'WIRED', category: 'Technology' },
    { url: 'https://www.technologyreview.com/feed/', sourceName: 'MIT Technology Review', category: 'Technology' },
    { url: 'https://feeds.arstechnica.com/arstechnica/index', sourceName: 'Ars Technica', category: 'Technology' },
  ];

  const scienceFeeds: FeedSource[] = [
    buildSearchFeed(`${primaryPlace} science`, 'Science'),
    buildSearchFeed(`${secondaryPlace} research OR medical discovery`, 'Science'),
    buildSearchFeed(`${primaryPlace} university OR health research`, 'Science'),
    buildSearchFeed('positive science news', 'Science'),
    buildSearchFeed('science breakthrough OR research success OR discovery', 'Science'),
    buildSearchFeed('climate solution research success', 'Science'),
    { url: 'https://www.sciencedaily.com/rss/top/science.xml', sourceName: 'ScienceDaily', category: 'Science' },
    { url: 'https://www.nature.com/nature.rss', sourceName: 'Nature', category: 'Science' },
    { url: 'https://phys.org/rss-feed/', sourceName: 'Phys.org', category: 'Science' },
    { url: 'https://www.newscientist.com/feed/home/', sourceName: 'New Scientist', category: 'Science' },
  ];

  const sportsFeeds: FeedSource[] = [
    ...sportsQueries.map((query) => buildSearchFeed(query, 'Sports')),
    { url: 'https://www.espn.com/espn/rss/news', sourceName: 'ESPN', category: 'Sports' },
    { url: 'http://feeds.bbci.co.uk/sport/rss.xml?edition=uk', sourceName: 'BBC Sport', category: 'Sports' },
  ];

  const healthFeeds: FeedSource[] = [
    ...healthQueries.map((query) => buildSearchFeed(query, 'Health')),
    { url: 'https://www.sciencedaily.com/rss/top/health.xml', sourceName: 'ScienceDaily', category: 'Health' },
    { url: 'https://www.sciencedaily.com/rss/top/technology.xml', sourceName: 'ScienceDaily', category: 'Health' },
    { url: 'https://www.afro.who.int/rss-feeds', sourceName: 'WHO AFRO', category: 'Health' },
    { url: 'https://www.emro.who.int/rss-feeds_3036/rss-feeds.html', sourceName: 'WHO EMRO', category: 'Health' },
  ];

  const allFeeds = uniqueFeeds([
    ...worldFeeds,
    ...businessFeeds,
    ...technologyFeeds,
    ...scienceFeeds,
    ...sportsFeeds,
    ...healthFeeds,
  ]);

  return {
    All: allFeeds,
    World: uniqueFeeds(worldFeeds),
    Business: uniqueFeeds(businessFeeds),
    Technology: uniqueFeeds(technologyFeeds),
    Science: uniqueFeeds(scienceFeeds),
    Sports: uniqueFeeds(sportsFeeds),
    Health: uniqueFeeds(healthFeeds),
  };
}

export const fallbackPositiveFeeds: FeedSource[] = [
  {
    url: 'https://www.goodnewsnetwork.org/feed/',
    sourceName: 'Good News Network',
  },
  {
    url: 'https://positive.news/feed/',
    sourceName: 'Positive News',
  },
  {
    url: 'https://reasonstobecheerful.world/feed/',
    sourceName: 'Reasons to be Cheerful',
  },
  {
    url: 'https://www.yesmagazine.org/feed',
    sourceName: 'YES! Magazine',
  },
  {
    url: 'https://thebetterindia.com/feed/',
    sourceName: 'The Better India',
  },
];
