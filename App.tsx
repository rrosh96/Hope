import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { XMLParser } from 'fast-xml-parser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  buildCategoryFeedUrls,
  categories,
  fallbackPositiveFeeds,
  type FeedSource,
  type LocationContext,
  type NewsCategory,
  type NewsItem,
} from './src/app/data/mockNews';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
});

const htmlEntityMap: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const positiveSignals = [
  'breakthrough',
  'recovery',
  'recover',
  'improve',
  'improved',
  'improves',
  'improvement',
  'hope',
  'hopeful',
  'help',
  'helps',
  'helping',
  'support',
  'supports',
  'supporting',
  'rescue',
  'rescues',
  'rescued',
  'save',
  'saves',
  'saved',
  'saving',
  'cure',
  'treatment',
  'healing',
  'innovation',
  'innovative',
  'clean energy',
  'solar',
  'conservation',
  'restore',
  'restored',
  'restoring',
  'growth',
  'record high',
  'wins',
  'won',
  'achievement',
  'milestone',
  'success',
  'succeeds',
  'solution',
  'solutions',
  'community',
  'volunteer',
  'education',
  'discovery',
  'discover',
  'progress',
  'promising',
  'affordable',
  'access',
  'expands',
  'uplift',
  'good news',
  'opens',
  'launches',
];

const negativeSignals = [
  'killed',
  'killing',
  'kills',
  'dead',
  'death',
  'dies',
  'died',
  'murder',
  'attack',
  'attacks',
  'bomb',
  'bombing',
  'war',
  'missile',
  'airstrike',
  'crash',
  'plane crash',
  'earthquake',
  'flood',
  'wildfire',
  'hurricane',
  'disaster',
  'explosion',
  'shooting',
  'massacre',
  'hostage',
  'violence',
  'violent',
  'abuse',
  'assault',
  'rape',
  'terror',
  'terrorist',
  'suicide',
  'outbreak',
  'epidemic',
  'pandemic',
  'layoffs',
  'fired',
  'job cuts',
  'collapse',
  'scandal',
  'fraud',
  'corruption',
  'lawsuit',
  'rage',
  'outrage',
  'furious',
  'slams',
  'blasts',
  'shocking',
  'devastating',
  'grim',
  'fear',
  'panic',
  'crisis',
  'warning',
  'arrested',
  'arrest',
  'prison',
  'sentenced',
];

const clickbaitSignals = [
  'you won’t believe',
  "you won't believe",
  'what happened next',
  'goes viral',
  'internet reacts',
  'breaks the internet',
  'shocking reason',
  'stuns',
  'stunned',
  'this is why',
  'watch',
  'must see',
  'epic',
  'unbelievable',
  'jaw-dropping',
];

const vagueSourceNames = new Set([
  'unknown source',
  'google news',
  'feedspot',
  'rss feed',
  'rss',
  'news',
  'admin',
  'staff',
  'editor',
]);

const untrustedSourceFragments = [
  'feedspot',
  'rss',
  'blogspot',
  'wordpress',
  'substack',
  'tumblr',
];

const publisherNameMap: Record<string, string> = {
  'abc.net.au': 'ABC News Australia',
  'bbc.com': 'BBC',
  'goodnewsnetwork.org': 'Good News Network',
  'nytimes.com': 'The New York Times',
  'positive.news': 'Positive News',
  'reasonstobecheerful.world': 'Reasons to be Cheerful',
  'reuters.com': 'Reuters',
  'thebetterindia.com': 'The Better India',
  'washingtonpost.com': 'The Washington Post',
  'yesmagazine.org': 'YES! Magazine',
};

const minimumPositiveScore = 2;
const targetStoryCount = 30;
const initialVisibleStoryCount = 5;
const loadMoreBatchSize = 5;
const maxIntroWords = 50;
const maxScore = 10;

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.reduce((total, keyword) => {
    return text.includes(keyword) ? total + 1 : total;
  }, 0);
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(' ');
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
}

function isReadableIntro(text: string) {
  const normalized = stripHtml(text);

  if (!normalized || normalized.length < 35) {
    return false;
  }

  if (normalized.length > 320) {
    return false;
  }

  if (!/[a-z]{3,}/i.test(normalized)) {
    return false;
  }

  if (!/[.!?]/.test(normalized) && normalized.split(/\s+/).length < 10) {
    return false;
  }

  if (/[{}<>_=#]/.test(normalized)) {
    return false;
  }

  if (/\.cls-\d|fill:|opacity:|isolate:|url\(#|google-news follow us/i.test(normalized)) {
    return false;
  }

  const words = normalized.split(/\s+/);
  const veryLongWords = words.filter((word) => word.length > 24);
  if (veryLongWords.length >= 2) {
    return false;
  }

  return true;
}

function isLikelyClickbait(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (countKeywordHits(normalizedTitle, clickbaitSignals) > 0) {
    return true;
  }

  const punctuationCount = (title.match(/[!?]/g) ?? []).length;
  if (punctuationCount >= 3) {
    return true;
  }

  const uppercaseWords = title.split(/\s+/).filter((word) => {
    const lettersOnly = word.replace(/[^a-z]/gi, '');
    return lettersOnly.length >= 4 && lettersOnly === lettersOnly.toUpperCase();
  });

  return uppercaseWords.length >= 2;
}

function scoreStory(item: NewsItem) {
  const combinedText = `${item.title} ${item.description} ${item.source}`.toLowerCase();
  const positiveScore = countKeywordHits(combinedText, positiveSignals);
  const negativeScore = countKeywordHits(combinedText, negativeSignals);
  const clickbait = isLikelyClickbait(item.title);

  let score = positiveScore * 2 - negativeScore * 3;

  if (hasCredibleSource(item.source)) {
    score += 1;
  }

  if (!hasCredibleSource(item.source)) {
    return { accepted: false, score: -3, reason: 'source_not_credible' };
  }

  if (clickbait) {
    return { accepted: false, score: -4, reason: 'clickbait' };
  }

  if (negativeScore >= 1) {
    return { accepted: false, score, reason: 'negative' };
  }

  if (positiveScore < minimumPositiveScore) {
    return { accepted: false, score, reason: 'not_positive_enough' };
  }

  if (score < minimumPositiveScore) {
    return { accepted: false, score, reason: 'low_score' };
  }

  return { accepted: true, score: Math.min(maxScore, Math.max(1, score)), reason: 'positive' };
}

function decodeHtml(text: string) {
  return text.replace(/&(amp|lt|gt|quot|#39);/g, (match) => htmlEntityMap[match] ?? match);
}

function stripHtml(text?: string) {
  if (!text) {
    return '';
  }

  return decodeHtml(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html: string, key: string, attribute: 'name' | 'property') {
  const regex = new RegExp(
    `<meta[^>]+${attribute}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  const reversedRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${key}["'][^>]*>`,
    'i',
  );

  return regex.exec(html)?.[1] ?? reversedRegex.exec(html)?.[1] ?? '';
}

function extractParagraphIntro(html: string) {
  const paragraphMatches = [...html.matchAll(/<p\b[^>]*>(.*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => isReadableIntro(paragraph));

  return paragraphMatches.slice(0, 2).join(' ');
}

function buildIntroFromHtml(html: string, fallbackText: string) {
  const candidates = [
    extractMetaContent(html, 'og:description', 'property'),
    extractMetaContent(html, 'twitter:description', 'name'),
    extractMetaContent(html, 'description', 'name'),
    extractParagraphIntro(html),
    fallbackText,
  ]
    .map((candidate) => stripHtml(candidate))
    .filter((candidate) => isReadableIntro(candidate));

  const safeFallback = truncateWords(stripHtml(fallbackText), maxIntroWords);

  return truncateWords(candidates[0] ?? safeFallback, maxIntroWords);
}

function formatRelativeTime(dateString?: string) {
  if (!dateString) {
    return 'Just now';
  }

  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) {
    return 'Latest';
  }

  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function isCurrentWeek(dateString?: string) {
  if (!dateString) {
    return false;
  }

  const publishedDate = new Date(dateString);
  if (Number.isNaN(publishedDate.getTime())) {
    return false;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = startOfToday.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  return publishedDate >= startOfWeek && publishedDate <= now;
}

function deriveSource(item: Record<string, unknown>) {
  const sourceNode = item.source;

  if (typeof sourceNode === 'string' && sourceNode.trim()) {
    return sourceNode.trim();
  }

  if (
    sourceNode &&
    typeof sourceNode === 'object' &&
    'text' in sourceNode &&
    typeof sourceNode.text === 'string' &&
    sourceNode.text.trim()
  ) {
    return sourceNode.text.trim();
  }

  const title = typeof item.title === 'string' ? item.title : '';
  const parts = title.split(' - ');

  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }

  return 'Unknown source';
}

function cleanTitle(title?: string) {
  if (!title) {
    return 'Untitled story';
  }

  const decoded = decodeHtml(title).trim();
  const lastDashIndex = decoded.lastIndexOf(' - ');

  if (lastDashIndex > 20) {
    return decoded.slice(0, lastDashIndex).trim();
  }

  return decoded;
}

function inferLocation(description: string) {
  const match = description.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s?[A-Z]{2,})\b/);
  return match?.[0] ?? 'Global';
}

function titleCaseWord(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function deriveSourceFromUrl(url: string) {
  try {
    const hostname = new URL(url).hostname
      .replace(/^www\./, '')
      .replace(/^m\./, '');
    const mapped = publisherNameMap[hostname];

    if (mapped) {
      return mapped;
    }

    const root = hostname.split('.').slice(0, -1).join('.') || hostname;
    const normalized = root
      .split(/[.-]/)
      .filter(Boolean)
      .map(titleCaseWord)
      .join(' ')
      .trim();

    return normalized || 'Unknown source';
  } catch {
    return 'Unknown source';
  }
}

function normalizeSourceName(source: string) {
  return source.replace(/\s+/g, ' ').trim();
}

function hasCredibleSource(source: string) {
  const normalized = normalizeSourceName(source).toLowerCase();

  if (!normalized || vagueSourceNames.has(normalized)) {
    return false;
  }

  if (normalized.length < 4) {
    return false;
  }

  if (untrustedSourceFragments.some((fragment) => normalized.includes(fragment))) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return false;
  }

  return /[a-z]/.test(normalized);
}

function sanitizeStories(stories: NewsItem[]) {
  return stories.filter((story) => hasCredibleSource(story.source));
}

async function enrichStoryIntro(story: NewsItem) {
  try {
    const response = await fetch(story.url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      return {
        ...story,
        description: truncateWords(story.description, maxIntroWords),
      };
    }

    const html = await response.text();
    return {
      ...story,
      description: buildIntroFromHtml(html, story.description),
    };
  } catch {
    return {
      ...story,
      description: truncateWords(story.description, maxIntroWords),
    };
  }
}

async function enrichStories(stories: NewsItem[]) {
  return Promise.all(stories.map((story) => enrichStoryIntro(story)));
}

async function fetchFeedUrl(feed: FeedSource, category: NewsCategory) {
  const separator = feed.url.includes('?') ? '&' : '?';
  const freshUrl = `${feed.url}${separator}t=${Date.now()}`;
  const response = await fetch(freshUrl, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const newsItems: NewsItem[] = items
    .map((item: Record<string, unknown>, index: number) => {
      const publishedAt =
        typeof item.pubDate === 'string' ? item.pubDate : '';
      const description = stripHtml(
        typeof item.description === 'string' ? item.description : '',
      );
      const url =
        typeof item.link === 'string' && item.link.trim()
          ? item.link.trim()
          : 'https://news.google.com';
      const source = normalizeSourceName(feed.sourceName ?? deriveSource(item));
      const fallbackSource = deriveSourceFromUrl(url);
      const trustedSource = hasCredibleSource(source) ? source : fallbackSource;

      return {
        id:
          typeof item.guid === 'string' && item.guid.trim()
            ? item.guid.trim()
            : `${category}-${index}`,
        title: cleanTitle(typeof item.title === 'string' ? item.title : undefined),
        description: description || `Latest ${category.toLowerCase()} story from ${source}.`,
        category,
        location: inferLocation(description),
        time: formatRelativeTime(publishedAt),
        publishedAt,
        source: trustedSource,
        url,
        positiveScore: 0,
      };
    })
    .filter(
      (item) =>
        item.title &&
        item.url &&
        isCurrentWeek(item.publishedAt) &&
        hasCredibleSource(item.source),
    );

  return newsItems;
}

async function fetchFeed(category: NewsCategory, locationContext?: LocationContext) {
  const positiveStories = new Map<string, NewsItem>();
  const feedUrls: FeedSource[] = [
    ...buildCategoryFeedUrls(locationContext)[category],
    ...fallbackPositiveFeeds,
  ];

  for (const feedUrl of feedUrls) {
    const newsItems = await fetchFeedUrl(feedUrl, category);

    for (const item of newsItems) {
      if (positiveStories.has(item.url)) {
        continue;
      }

      const result = scoreStory(item);

      if (!result.accepted) {
        continue;
      }

      positiveStories.set(item.url, {
        ...item,
        positiveScore: result.score,
      });

      if (positiveStories.size >= targetStoryCount) {
        break;
      }
    }

    if (positiveStories.size >= targetStoryCount) {
      break;
    }
  }

  return Array.from(positiveStories.values())
    .sort((a, b) => {
      const scoreDiff = b.positiveScore - a.positiveScore;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, targetStoryCount);
}

export default function App() {
  const latestLoadId = useRef(0);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('All');
  const [userLocation, setUserLocation] = useState('Finding your local edition...');
  const [locationContext, setLocationContext] = useState<LocationContext | undefined>(undefined);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [stories, setStories] = useState<NewsItem[]>([]);
  const [visibleStoryCount, setVisibleStoryCount] = useState(initialVisibleStoryCount);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceReaderLoading, setSourceReaderLoading] = useState(false);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('Not updated yet');

  const detectLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setUserLocation('Global edition');
        setLocationContext(undefined);
        return undefined;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const places = await Location.reverseGeocodeAsync({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });

      const place = places[0];
      const nextLocationContext: LocationContext | undefined = place
        ? {
            city: place.city ?? place.subregion ?? undefined,
            region: place.region ?? place.subregion ?? undefined,
            country: place.country ?? undefined,
          }
        : undefined;

      setLocationContext(nextLocationContext);

      const locationLabel = [nextLocationContext?.city, nextLocationContext?.region]
        .filter(Boolean)
        .join(', ');

      setUserLocation(locationLabel || nextLocationContext?.country || 'Global edition');
      return nextLocationContext;
    } catch (error) {
      setUserLocation('Global edition');
      setLocationContext(undefined);
      return undefined;
    }
  }, []);

  const loadStories = useCallback(
    async (
      category: NewsCategory,
      mode: 'load' | 'refresh' = 'load',
      nextLocationContext?: LocationContext,
    ) => {
      if (mode === 'load') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);
      setVisibleStoryCount(initialVisibleStoryCount);

      try {
        const loadId = Date.now();
        latestLoadId.current = loadId;
        const latestStories = await fetchFeed(category, nextLocationContext);
        const sanitizedStories = sanitizeStories(latestStories);

        if (sanitizedStories.length === 0) {
          setError('No strongly positive stories from this week were available right now. Try refresh in a bit.');
        }
        setStories(sanitizedStories);
        setLastUpdatedLabel(new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }));

        void enrichStories(sanitizedStories).then((enrichedStories) => {
          if (latestLoadId.current !== loadId) {
            return;
          }

          setStories(sanitizeStories(enrichedStories));
        });
      } catch (loadError) {
        setError('Could not load live news right now. Pull to refresh and try again.');
      } finally {
        if (mode === 'load') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const loadWithLocation = async () => {
      try {
        let nextContext = locationContext;

        if (!locationContext) {
          nextContext = await detectLocation();
          if (cancelled) {
            return;
          }
        }

        await loadStories(activeCategory, 'load', nextContext);
      } catch (error) {
        await loadStories(activeCategory, 'load', locationContext);
      }
    };

    void loadWithLocation();

    return () => {
      cancelled = true;
    };
  }, [activeCategory, detectLocation, loadStories, locationContext]);

  const visibleStories = sanitizeStories(stories).slice(0, visibleStoryCount);
  const canLoadMore = visibleStoryCount < sanitizeStories(stories).length;

  return (
    <LinearGradient colors={['#eef7ff', '#f8f2eb', '#fffdf8']} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                const nextContext = await detectLocation();
                await loadStories(activeCategory, 'refresh', nextContext);
              }}
            />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Text style={styles.eyebrow}>Live good news</Text>

              <View style={styles.locationPill}>
                <Text style={styles.locationValue}>{userLocation}</Text>
              </View>
            </View>
            <Text style={styles.title}>Hope</Text>
            <Text style={styles.subtitle}>
              A daily dose of Good in a noisy world
            </Text>
            <Text style={styles.lastUpdatedText}>Last updated {lastUpdatedLabel}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((category) => {
              const isActive = category === activeCategory;

              return (
                <Pressable
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isActive && styles.categoryChipTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#172235" />
              <Text style={styles.loadingText}>Loading live headlines...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Live feed unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!loading && !error ? (
            <View style={styles.storyList}>
              {visibleStories.map((story) => (
                <Pressable
                  key={story.url}
                  style={styles.storyCard}
                  onPress={() => {
                    setSourceReaderLoading(true);
                    setSelectedNews(story);
                  }}
                >
                  <View style={styles.storyVisualFallback}>
                    <Text style={styles.storyVisualHeadline} numberOfLines={3}>
                      {story.title}
                    </Text>
                    <Text style={styles.storyVisualSource}>{story.source}</Text>
                  </View>

                  <View style={styles.storyBody}>
                    <View style={styles.storyMetaRow}>
                      <Text style={styles.storyCategory}>{story.category}</Text>
                      <Text style={styles.storyTime}>{story.time}</Text>
                    </View>
                    <Text style={styles.storyDescription}>{story.description}</Text>

                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreBadgeLabel}>Score</Text>
                      <Text style={styles.scoreBadgeText}>✦ {story.positiveScore}/{maxScore}</Text>
                    </View>

                    <Text style={styles.storyFooter}>{story.location}</Text>
                  </View>
                </Pressable>
              ))}

              {canLoadMore ? (
                <Pressable
                  style={styles.loadMoreButton}
                  onPress={() =>
                    setVisibleStoryCount((current) =>
                      Math.min(current + loadMoreBatchSize, stories.length),
                    )
                  }
                >
                  <Text style={styles.loadMoreButtonText}>
                    Load more ({stories.length - visibleStoryCount} left)
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <Modal
          visible={selectedNews !== null}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setSelectedNews(null)}
        >
          <SafeAreaView style={styles.modalScreen}>
            {selectedNews ? (
              <View style={styles.readerScreen}>
                <View style={styles.readerHeader}>
                  <View style={styles.readerHeaderText}>
                    <Text style={styles.readerEyebrow}>{selectedNews.category}</Text>
                    <Text style={styles.readerTitle}>{selectedNews.source}</Text>
                    <Text style={styles.readerSubtitle} numberOfLines={2}>
                      {selectedNews.title}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.readerCloseButton}
                    onPress={() => setSelectedNews(null)}
                  >
                    <Text style={styles.readerCloseButtonText}>Done</Text>
                  </Pressable>
                </View>

                {sourceReaderLoading ? (
                  <View pointerEvents="none" style={styles.readerLoadingOverlay}>
                    <ActivityIndicator size="large" color="#172235" />
                    <Text style={styles.readerLoadingText}>Opening source...</Text>
                  </View>
                ) : null}

                <View style={styles.readerMetaBar}>
                  <Text style={styles.readerMetaText}>{selectedNews.time}</Text>
                  <Text style={styles.readerMetaDot}>•</Text>
                  <Text style={styles.readerMetaText}>{selectedNews.location}</Text>
                </View>

                <WebView
                  source={{ uri: selectedNews.url }}
                  startInLoadingState
                  onLoadStart={() => setSourceReaderLoading(true)}
                  onLoadEnd={() => setSourceReaderLoading(false)}
                  style={styles.readerWebView}
                />
              </View>
            ) : null}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: '#20304a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  eyebrow: {
    color: '#5f6f85',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: '#152033',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#46556b',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
  },
  lastUpdatedText: {
    color: '#6e7b8e',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  locationPill: {
    backgroundColor: '#eef1f4',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationValue: {
    color: '#2f3b4b',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryRow: {
    paddingBottom: 8,
    paddingRight: 18,
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: '#1da88d',
  },
  categoryChipText: {
    color: '#324155',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#fffaf3',
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 14,
    color: '#526177',
    fontSize: 15,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#eef8f5',
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
  },
  errorTitle: {
    color: '#166a5a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  errorText: {
    color: '#2c6f63',
    lineHeight: 22,
  },
  storyList: {
    marginTop: 14,
    gap: 16,
  },
  storyCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#24324a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  storyVisualFallback: {
    minHeight: 130,
    backgroundColor: '#172235',
    padding: 18,
    justifyContent: 'space-between',
  },
  storyVisualHeadline: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  storyVisualSource: {
    color: '#93e2d2',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  storyBody: {
    padding: 16,
  },
  storyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  storyCategory: {
    color: '#1da88d',
    fontSize: 13,
    fontWeight: '800',
  },
  storyTime: {
    color: '#6d7a8d',
    fontSize: 12,
    fontWeight: '600',
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6f7f3',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
    marginBottom: 12,
  },
  scoreBadgeLabel: {
    color: '#2e7b69',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  scoreBadgeText: {
    color: '#0f5c4d',
    fontSize: 14,
    fontWeight: '800',
  },
  loadMoreButton: {
    marginTop: 4,
    backgroundColor: '#1da88d',
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  loadMoreButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  storyDescription: {
    color: '#4f5f74',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 0,
  },
  storyFooter: {
    color: '#7a8798',
    fontSize: 13,
    fontWeight: '600',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#fffaf5',
  },
  readerScreen: {
    flex: 1,
    backgroundColor: '#fffaf5',
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d7deea',
    backgroundColor: '#fffaf5',
  },
  readerHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  readerEyebrow: {
    color: '#6b7a8d',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  readerTitle: {
    color: '#172235',
    fontSize: 18,
    fontWeight: '800',
  },
  readerSubtitle: {
    color: '#4f5f74',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  readerCloseButton: {
    backgroundColor: '#172235',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  readerCloseButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  readerMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#eef4fb',
    gap: 8,
  },
  readerMetaText: {
    color: '#526177',
    fontSize: 12,
    fontWeight: '700',
  },
  readerMetaDot: {
    color: '#8b97a9',
    fontSize: 12,
    fontWeight: '700',
  },
  readerWebView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  readerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,250,245,0.95)',
  },
  readerLoadingText: {
    color: '#526177',
    fontSize: 15,
    fontWeight: '600',
  },
});
