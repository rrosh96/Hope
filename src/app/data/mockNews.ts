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
}

const REGION = 'IN:en';
const LANGUAGE = 'en-IN';
const COUNTRY = 'IN';

const buildSearchFeed = (query: string): FeedSource => ({
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${LANGUAGE}&gl=${COUNTRY}&ceid=${REGION}`,
});

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

  return {
    All: [
      buildSearchFeed(`${localNews}`),
      buildSearchFeed(`${localCommunity}`),
      buildSearchFeed(`${regionalNews}`),
      buildSearchFeed(`positive news ${joinedPlaces}`),
      buildSearchFeed('positive world news'),
    ],
    World: [
      buildSearchFeed(`${localNews}`),
      buildSearchFeed(`${primaryPlace} humanitarian OR community OR development`),
      buildSearchFeed(`positive world news ${joinedPlaces}`),
      buildSearchFeed('global recovery OR global breakthrough OR humanitarian success'),
    ],
    Business: [
      buildSearchFeed(`${primaryPlace} business`),
      buildSearchFeed(`${secondaryPlace} startup OR small business`),
      buildSearchFeed(`${primaryPlace} jobs OR expansion OR investment`),
      buildSearchFeed('affordable solution business progress'),
    ],
    Technology: [
      buildSearchFeed(`${primaryPlace} technology`),
      buildSearchFeed(`${secondaryPlace} startup technology`),
      buildSearchFeed(`${primaryPlace} AI OR innovation OR research`),
      buildSearchFeed('tech innovation improves lives'),
    ],
    Science: [
      buildSearchFeed(`${primaryPlace} science`),
      buildSearchFeed(`${secondaryPlace} research OR medical discovery`),
      buildSearchFeed(`${primaryPlace} university OR health research`),
      buildSearchFeed('climate solution research success'),
    ],
    Sports: [
      buildSearchFeed(`${primaryPlace} sports`),
      buildSearchFeed(`${secondaryPlace} athlete OR team win`),
      buildSearchFeed(`${primaryPlace} tournament OR championship`),
      buildSearchFeed('sportsmanship rescue charity sports'),
    ],
    Health: [
      buildSearchFeed(`${primaryPlace} health`),
      buildSearchFeed(`${secondaryPlace} hospital OR treatment OR public health`),
      buildSearchFeed(`${primaryPlace} medical OR wellness OR recovery`),
      buildSearchFeed('medical innovation improves lives'),
    ],
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
