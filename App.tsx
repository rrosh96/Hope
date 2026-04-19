import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFonts } from 'expo-font';
import { XMLParser } from 'fast-xml-parser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import {
  buildCategoryFeedUrls,
  categories,
  type FeedSource,
  type LocationContext,
  type NewsCategory,
  type NewsItem,
} from './src/app/data/mockNews';
import {
  classifyStoriesWithMobileBert,
  type MobileBertClassificationResult,
} from './src/app/ml/mobilebertClassifier';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
});

const palette = {
  deepBlue: '#1d3557',
  turquoise: '#457b9d',
  cream: '#f1faee',
  peach: '#a8dadc',
  coral: '#e63946',
  white: '#ffffff',
  ink: '#1d3557',
  mutedInk: '#457b9d',
};

const alpha = (hex: string, opacity: number) => {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

const theme = {
  backgroundTop: palette.cream,
  backgroundMiddle: palette.peach,
  backgroundBottom: palette.white,
  surfacePrimary: alpha(palette.cream, 0.92),
  surfaceSecondary: alpha(palette.white, 0.92),
  surfaceMuted: alpha(palette.peach, 0.72),
  surfaceOverlay: alpha(palette.cream, 0.86),
  surfaceOverlayCard: alpha(palette.white, 0.94),
  surfaceBadge: palette.cream,
  surfaceError: palette.peach,
  surfaceHeader: palette.deepBlue,
  surfaceReader: palette.cream,
  surfaceReaderMeta: palette.peach,
  surfaceReaderWeb: palette.white,
  textPrimary: palette.ink,
  textSecondary: palette.mutedInk,
  textOnDark: palette.white,
  textMutedOnDark: palette.cream,
  accentPrimary: palette.turquoise,
  accentSecondary: palette.deepBlue,
  accentWarm: palette.coral,
  borderSoft: palette.peach,
  shadow: palette.deepBlue,
};

/** iOS: system Avenir Next. Android/Web: bundled Inter (expo-font keys Inter_400 … Inter_800). */
const fontSans = {
  w400: Platform.select({
    ios: 'AvenirNext-Regular',
    android: 'Inter_400',
    web: 'Inter_400',
    default: 'Inter_400',
  }),
  w500: Platform.select({
    ios: 'AvenirNext-Medium',
    android: 'Inter_500',
    web: 'Inter_500',
    default: 'Inter_500',
  }),
  w600: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'Inter_600',
    web: 'Inter_600',
    default: 'Inter_600',
  }),
  w700: Platform.select({
    ios: 'AvenirNext-Bold',
    android: 'Inter_700',
    web: 'Inter_700',
    default: 'Inter_700',
  }),
  w800: Platform.select({
    ios: 'AvenirNext-Heavy',
    android: 'Inter_800',
    web: 'Inter_800',
    default: 'Inter_800',
  }),
};

const htmlEntityMap: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '-',
  '&mdash;': '-',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&hellip;': '...',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&#39;': "'",
};

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

const introBoilerplatePatterns = [
  /comprehensive,\s*up-to-date news coverage/i,
  /aggregated from sources all over the world by google news/i,
  /read full article/i,
  /read full story/i,
  /full coverage/i,
  /see full coverage/i,
  /more for you/i,
  /more on this story/i,
  /continue reading/i,
  /follow us/i,
  /google news/i,
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

const categorySignals: Record<NewsCategory, string[]> = {
  All: [],
  World: [
    'world',
    'global',
    'international',
    'community',
    'humanitarian',
    'development',
    'nation',
    'country',
  ],
  Business: [
    'business',
    'startup',
    'company',
    'market',
    'economy',
    'investment',
    'jobs',
    'expansion',
    'funding',
    'industry',
  ],
  Technology: [
    'technology',
    'tech',
    'ai',
    'software',
    'app',
    'robot',
    'digital',
    'innovation',
    'startup technology',
    'platform',
  ],
  Science: [
    'science',
    'research',
    'study',
    'scientist',
    'discovery',
    'medical',
    'climate',
    'lab',
    'university',
    'breakthrough',
  ],
  Sports: [
    'sports',
    'sport',
    'athlete',
    'team',
    'match',
    'tournament',
    'championship',
    'league',
    'coach',
    'medal',
    'goal',
    'win',
    'comeback',
  ],
  Health: [
    'health',
    'hospital',
    'treatment',
    'medical',
    'doctor',
    'patient',
    'wellness',
    'recovery',
    'vaccine',
    'public health',
  ],
};

const targetStoryCount = 150;
const categoryTargetStoryCount = 20;
const feedParallelism = 6;
const initialVisibleStoryCount = 5;
const loadMoreBatchSize = 5;
const maxIntroWords = 50;
const maxScore = 10;
const seenStoriesStorageKey = 'hope:seen-stories';
const visitCountStorageKey = 'hope:visit-count';
const storiesCacheStorageKey = 'hope:stories-cache';
const storiesCacheTimestampStorageKey = 'hope:stories-cache-timestamp';
const diagnosticsStorageKey = 'hope:stories-diagnostics';
const metricsHistoryStorageKey = 'hope:metrics-history';
const seenStoryCooldownMs = 3 * 24 * 60 * 60 * 1000;
const storiesCacheTtlMs = 5 * 60 * 1000;
const metricsHistoryLimit = 20;
const googleSheetsLogUrl =
  'https://script.google.com/macros/s/AKfycbyW1auT3ZLBD6mrwSqX8j6rB_8k-bMwsxeXog4cdgQbqTNxc8GYccETrYVkSeYoBGQb/exec';

const SPLASH_ARTBOARD_W = 402;
const SPLASH_ARTBOARD_H = 874;
const SPLASH_CORNER_RADIUS = 20;
const SPLASH_TEAL = '#006E78';
const SPLASH_HEADLINE_TOP = 176;
const SPLASH_HEADLINE_LEFT = 73;
const SPLASH_HEADLINE_W = 255;
const SPLASH_HEADLINE_SIZE = 19.5;
const SPLASH_HEADLINE_LINE_HEIGHT = 27;
// Figma/CSS uses a wide teal block; visually it reads as the top of a huge circle.
// We model it as a full circle clipped by the artboard so the top edge is a smooth arc.
// Keep the orb below the artboard midpoint so the face sits in the bottom half of the splash.
const SPLASH_ARTBOARD_MID = SPLASH_ARTBOARD_H / 2;
const SPLASH_ORB_DIAMETER = 900;
const SPLASH_ORB_LEFT = (SPLASH_ARTBOARD_W - SPLASH_ORB_DIAMETER) / 2;
const SPLASH_ORB_TOP = SPLASH_ARTBOARD_MID + 20;
const SPLASH_EYE_SIZE = 15;
const SPLASH_EYE_LEFT = 152;
const SPLASH_EYE_RIGHT = 221;
const SPLASH_EYE_TOP = SPLASH_ORB_TOP + 110;
const SPLASH_MOUTH_LEFT = 164.5;
const SPLASH_MOUTH_TOP = SPLASH_EYE_TOP + 36.5;
const SPLASH_MOUTH_W = 61;
const SPLASH_MOUTH_H = 20;
const SPLASH_MOUTH_STROKE = 4;
const SPLASH_MOUTH_CY_REST = 13.5;
const SPLASH_MOUTH_CY_PEAK = 16.8;

function ReferenceSplashArtboard() {
  const breathPhase = useRef(new Animated.Value(0)).current;
  const eyeDriftX = useRef(new Animated.Value(-2)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const mouthMorph = useRef(new Animated.Value(0)).current;
  const [mouthPathD, setMouthPathD] = useState(
    `M 2 7 Q 30.5 ${SPLASH_MOUTH_CY_REST} 59 7`,
  );

  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathPhase, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathPhase, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const eyeDriftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(eyeDriftX, {
          toValue: 2,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(eyeDriftX, {
          toValue: -2,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const mouthMorphLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mouthMorph, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(mouthMorph, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );

    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.delay(2600),
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const mouthMorphId = mouthMorph.addListener(({ value }) => {
      const t = value <= 0.5 ? value * 2 : (1 - value) * 2;
      const cy = SPLASH_MOUTH_CY_REST + (SPLASH_MOUTH_CY_PEAK - SPLASH_MOUTH_CY_REST) * t;
      setMouthPathD(`M 2 7 Q 30.5 ${cy} 59 7`);
    });

    breathLoop.start();
    eyeDriftLoop.start();
    mouthMorphLoop.start();
    blinkLoop.start();

    return () => {
      breathLoop.stop();
      eyeDriftLoop.stop();
      mouthMorphLoop.stop();
      blinkLoop.stop();
      mouthMorph.removeListener(mouthMorphId);
    };
  }, [blinkAnim, breathPhase, eyeDriftX, mouthMorph]);

  const orbTranslateY = breathPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });
  const mouthTranslateY = breathPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });

  return (
    <View style={referenceSplashStyles.artboard}>
      <Text style={referenceSplashStyles.headline}>Pulling in good news{'\n'}for you</Text>

      <Animated.View style={{ transform: [{ translateY: orbTranslateY }] }}>
        <Animated.View style={referenceSplashStyles.tealOrb}>
          <Animated.View
            style={{
              position: 'absolute',
              left: SPLASH_EYE_LEFT - SPLASH_ORB_LEFT,
              top: SPLASH_EYE_TOP - SPLASH_ORB_TOP,
              width: SPLASH_EYE_SIZE,
              height: SPLASH_EYE_SIZE,
              transform: [{ translateX: eyeDriftX }],
            }}
          >
            <Animated.View
              style={{
                width: SPLASH_EYE_SIZE,
                height: SPLASH_EYE_SIZE,
                borderRadius: SPLASH_EYE_SIZE / 2,
                backgroundColor: '#FFFFFF',
                transform: [{ scaleY: blinkAnim }],
              }}
            />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              left: SPLASH_EYE_RIGHT - SPLASH_ORB_LEFT,
              top: SPLASH_EYE_TOP - SPLASH_ORB_TOP,
              width: SPLASH_EYE_SIZE,
              height: SPLASH_EYE_SIZE,
              transform: [{ translateX: eyeDriftX }],
            }}
          >
            <Animated.View
              style={{
                width: SPLASH_EYE_SIZE,
                height: SPLASH_EYE_SIZE,
                borderRadius: SPLASH_EYE_SIZE / 2,
                backgroundColor: '#FFFFFF',
                transform: [{ scaleY: blinkAnim }],
              }}
            />
          </Animated.View>

          <Animated.View
            style={[
              referenceSplashStyles.mouthHost,
              {
                left: SPLASH_MOUTH_LEFT - SPLASH_ORB_LEFT,
                top: SPLASH_MOUTH_TOP - SPLASH_ORB_TOP,
                transform: [{ translateY: mouthTranslateY }],
              },
            ]}
          >
            <Svg width={SPLASH_MOUTH_W} height={SPLASH_MOUTH_H} viewBox={`0 0 ${SPLASH_MOUTH_W} ${SPLASH_MOUTH_H}`}>
              <Path
                d={mouthPathD}
                stroke="#FFFFFF"
                strokeWidth={SPLASH_MOUTH_STROKE}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function ReferenceSplashOverlay({ fontsReady }: { fontsReady: boolean }) {
  const { width, height } = useWindowDimensions();
  const coverScale = Math.max(width / SPLASH_ARTBOARD_W, height / SPLASH_ARTBOARD_H);
  const offsetX = (width - SPLASH_ARTBOARD_W * coverScale) / 2;
  const offsetY = (height - SPLASH_ARTBOARD_H * coverScale) / 2;

  return (
    <View style={referenceSplashStyles.overlayRoot} pointerEvents="auto">
      {!fontsReady ? (
        <View style={referenceSplashStyles.fontFallback}>
          <ActivityIndicator size="large" color={SPLASH_TEAL} />
        </View>
      ) : (
        <Animated.View
          style={[
            referenceSplashStyles.overlayCard,
            {
              width: SPLASH_ARTBOARD_W,
              height: SPLASH_ARTBOARD_H,
              left: offsetX,
              top: offsetY,
              transform: [{ scale: coverScale }],
            },
          ]}
        >
          <ReferenceSplashArtboard />
        </Animated.View>
      )}
    </View>
  );
}

const referenceSplashStyles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 50,
  },
  overlayCard: {
    position: 'absolute',
    borderRadius: SPLASH_CORNER_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  fontFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  artboard: {
    width: SPLASH_ARTBOARD_W,
    height: SPLASH_ARTBOARD_H,
    backgroundColor: '#FFFFFF',
  },
  headline: {
    position: 'absolute',
    left: SPLASH_HEADLINE_LEFT,
    top: SPLASH_HEADLINE_TOP,
    width: SPLASH_HEADLINE_W,
    fontSize: SPLASH_HEADLINE_SIZE,
    lineHeight: SPLASH_HEADLINE_LINE_HEIGHT,
    fontWeight: 'normal',
    color: '#000000',
    textAlign: 'center',
    fontFamily: fontSans.w500,
  },
  tealOrb: {
    position: 'absolute',
    left: SPLASH_ORB_LEFT,
    top: SPLASH_ORB_TOP,
    width: SPLASH_ORB_DIAMETER,
    height: SPLASH_ORB_DIAMETER,
    borderRadius: SPLASH_ORB_DIAMETER / 2,
    backgroundColor: SPLASH_TEAL,
  },
  mouthHost: {
    position: 'absolute',
    width: SPLASH_MOUTH_W,
    height: SPLASH_MOUTH_H,
  },
});

interface CategoryFetchMetrics {
  category: Exclude<NewsCategory, 'All'>;
  durationMs: number;
  acceptedCount: number;
  attemptedFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  scannedTiers: Array<NonNullable<FeedSource['tier']>>;
  mobileBertFreshClassified: number;
  mobileBertCacheHits: number;
  mobileBertClassified: number;
  ruleFilteredCount: number;
  ruleClassified: number;
}

interface RefreshMetrics {
  timestamp: number;
  mode: 'load' | 'refresh';
  cacheUsed: boolean;
  durationMs: number;
  locationLabel: string;
  totalAcceptedStories: number;
  allVisiblePoolCount: number;
  shownStoriesCount: number;
  funnel: {
    fetched: number;
    validBase: number;
    credibleSource: number;
    deduped: number;
    unseen: number;
    categoryMatched: number;
    accepted: number;
    invalidRejected: number;
    sourceRejected: number;
    duplicateRejected: number;
    seenRejected: number;
    categoryRejected: number;
    constructiveRejected: number;
    positivityRejected: number;
    feedErrors: number;
    ruleFilteredCount: number;
    mobileBertFreshClassified: number;
    mobileBertCacheHits: number;
    mobileBertClassified: number;
    ruleClassified: number;
  };
  categoryMetrics: CategoryFetchMetrics[];
}

interface CategoryDiagnostics {
  fetched: number;
  feedErrors: number;
  invalidRejected: number;
  validBase: number;
  sourceRejected: number;
  credibleSource: number;
  duplicateRejected: number;
  deduped: number;
  seenRejected: number;
  unseen: number;
  categoryRejected: number;
  categoryMatched: number;
  positivityRejected: number;
  accepted: number;
  constructiveRejected: number;
  ruleFilteredCount: number;
  cautionPenaltyHits: number;
}

type DiagnosticsMap = Record<NewsCategory, CategoryDiagnostics>;

function createCategoryDiagnostics(): CategoryDiagnostics {
  return {
    fetched: 0,
    feedErrors: 0,
    invalidRejected: 0,
    validBase: 0,
    sourceRejected: 0,
    credibleSource: 0,
    duplicateRejected: 0,
    deduped: 0,
    seenRejected: 0,
    unseen: 0,
    categoryRejected: 0,
    categoryMatched: 0,
    positivityRejected: 0,
    accepted: 0,
    constructiveRejected: 0,
    ruleFilteredCount: 0,
    cautionPenaltyHits: 0,
  };
}

function createEmptyDiagnostics(): DiagnosticsMap {
  return {
    All: createCategoryDiagnostics(),
    World: createCategoryDiagnostics(),
    Business: createCategoryDiagnostics(),
    Technology: createCategoryDiagnostics(),
    Science: createCategoryDiagnostics(),
    Sports: createCategoryDiagnostics(),
    Health: createCategoryDiagnostics(),
  };
}

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

function rotateArray<T>(items: T[], offset: number) {
  if (items.length === 0) {
    return items;
  }

  const normalizedOffset = offset % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function mergeDiagnostics(target: DiagnosticsMap, source: DiagnosticsMap) {
  for (const category of categories) {
    target[category].fetched += source[category].fetched;
    target[category].feedErrors += source[category].feedErrors;
    target[category].invalidRejected += source[category].invalidRejected;
    target[category].validBase += source[category].validBase;
    target[category].sourceRejected += source[category].sourceRejected;
    target[category].credibleSource += source[category].credibleSource;
    target[category].duplicateRejected += source[category].duplicateRejected;
    target[category].deduped += source[category].deduped;
    target[category].seenRejected += source[category].seenRejected;
    target[category].unseen += source[category].unseen;
    target[category].categoryRejected += source[category].categoryRejected;
    target[category].categoryMatched += source[category].categoryMatched;
    target[category].positivityRejected += source[category].positivityRejected;
    target[category].accepted += source[category].accepted;
    target[category].constructiveRejected += source[category].constructiveRejected;
    target[category].ruleFilteredCount += source[category].ruleFilteredCount;
    target[category].cautionPenaltyHits += source[category].cautionPenaltyHits;
  }
}

function isStoryFromToday(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function computeLocalityScore(story: NewsItem, locationContext?: LocationContext) {
  if (!locationContext) {
    return 0;
  }

  const haystack = `${story.title} ${story.description} ${story.location} ${story.source}`.toLowerCase();
  let score = 0;

  for (const term of [locationContext.city, locationContext.region, locationContext.country]) {
    if (!term) {
      continue;
    }

    if (haystack.includes(term.toLowerCase())) {
      score += 1;
    }
  }

  return score;
}

async function loadSeenStories() {
  try {
    const rawValue = await AsyncStorage.getItem(seenStoriesStorageKey);
    const parsed = rawValue ? (JSON.parse(rawValue) as Record<string, number>) : {};
    const now = Date.now();
    const prunedEntries = Object.entries(parsed).filter(
      ([, seenAt]) => now - seenAt < seenStoryCooldownMs,
    );
    const prunedMap = Object.fromEntries(prunedEntries);

    if (prunedEntries.length !== Object.keys(parsed).length) {
      await AsyncStorage.setItem(seenStoriesStorageKey, JSON.stringify(prunedMap));
    }

    return prunedMap;
  } catch {
    return {};
  }
}

async function markStorySeen(url: string) {
  const seenStories = await loadSeenStories();
  seenStories[url] = Date.now();
  await AsyncStorage.setItem(seenStoriesStorageKey, JSON.stringify(seenStories));
  return seenStories;
}

async function bumpVisitCount() {
  try {
    const rawValue = await AsyncStorage.getItem(visitCountStorageKey);
    const currentValue = rawValue ? Number(rawValue) : 0;
    const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;
    await AsyncStorage.setItem(visitCountStorageKey, String(nextValue));
    return nextValue;
  } catch {
    return 1;
  }
}

async function loadStoriesCache() {
  try {
    const [rawStories, rawTimestamp] = await Promise.all([
      AsyncStorage.getItem(storiesCacheStorageKey),
      AsyncStorage.getItem(storiesCacheTimestampStorageKey),
    ]);

    const stories = rawStories ? (JSON.parse(rawStories) as NewsItem[]) : [];
    const timestamp = rawTimestamp ? Number(rawTimestamp) : 0;

    return {
      stories,
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    };
  } catch {
    return {
      stories: [],
      timestamp: 0,
    };
  }
}

async function saveStoriesCache(stories: NewsItem[]) {
  const timestamp = Date.now();
  await Promise.all([
    AsyncStorage.setItem(storiesCacheStorageKey, JSON.stringify(stories)),
    AsyncStorage.setItem(storiesCacheTimestampStorageKey, String(timestamp)),
  ]);
  return timestamp;
}

async function loadDiagnosticsCache() {
  try {
    const rawValue = await AsyncStorage.getItem(diagnosticsStorageKey);
    return rawValue ? (JSON.parse(rawValue) as DiagnosticsMap) : createEmptyDiagnostics();
  } catch {
    return createEmptyDiagnostics();
  }
}

async function saveDiagnosticsCache(diagnostics: DiagnosticsMap) {
  await AsyncStorage.setItem(diagnosticsStorageKey, JSON.stringify(diagnostics));
}

async function appendRefreshMetrics(metrics: RefreshMetrics) {
  try {
    const rawValue = await AsyncStorage.getItem(metricsHistoryStorageKey);
    const history = rawValue ? (JSON.parse(rawValue) as RefreshMetrics[]) : [];
    const nextHistory = [metrics, ...history].slice(0, metricsHistoryLimit);
    await AsyncStorage.setItem(metricsHistoryStorageKey, JSON.stringify(nextHistory));
  } catch {
    // Ignore metrics write failures so the feed never breaks for telemetry.
  }
}

function logRefreshMetrics(metrics: RefreshMetrics) {
  const categorySummary = metrics.categoryMetrics
    .map(
      (entry) =>
        `${entry.category}:${entry.acceptedCount} in ${entry.durationMs}ms (${entry.successfulFeeds}/${entry.attemptedFeeds} feeds)`,
    )
    .join(' | ');

  console.info(
    `[Hope Metrics] mode=${metrics.mode} cacheUsed=${metrics.cacheUsed} durationMs=${metrics.durationMs} totalAccepted=${metrics.totalAcceptedStories} visiblePool=${metrics.allVisiblePoolCount}`,
  );
  console.info(
    `[Hope Funnel] fetched=${metrics.funnel.fetched} valid=${metrics.funnel.validBase} source=${metrics.funnel.credibleSource} deduped=${metrics.funnel.deduped} unseen=${metrics.funnel.unseen} matched=${metrics.funnel.categoryMatched} accepted=${metrics.funnel.accepted} rejected=${metrics.funnel.positivityRejected} ruleFiltered=${metrics.funnel.ruleFilteredCount} mobilebertFresh=${metrics.funnel.mobileBertFreshClassified} mobilebertCacheHits=${metrics.funnel.mobileBertCacheHits} mobilebertTotal=${metrics.funnel.mobileBertClassified} ruleClassifier=${metrics.funnel.ruleClassified}`,
  );
  console.info(`[Hope Categories] ${categorySummary}`);
}

async function postRefreshMetricsToGoogleSheets(metrics: RefreshMetrics) {
  if (!googleSheetsLogUrl) {
    return;
  }

  const timestampIst = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(metrics.timestamp));

  const feedsAttempted = metrics.categoryMetrics.reduce((total, entry) => total + entry.attemptedFeeds, 0);
  const feedsSucceeded = metrics.categoryMetrics.reduce((total, entry) => total + entry.successfulFeeds, 0);
  const feedsFailed = metrics.categoryMetrics.reduce((total, entry) => total + entry.failedFeeds, 0);
  const totalClassified = metrics.funnel.mobileBertClassified + metrics.funnel.ruleClassified;
  const mobilebertPercent =
    totalClassified > 0 ? Number(((metrics.funnel.mobileBertClassified / totalClassified) * 100).toFixed(2)) : 0;
  const rulePercent =
    totalClassified > 0 ? Number(((metrics.funnel.ruleClassified / totalClassified) * 100).toFixed(2)) : 0;

  try {
    await fetch(googleSheetsLogUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_sheet: 'Hope_Funnel_V2',
        schema_version: 2,
        timestamp: `${timestampIst} IST`,
        mode: metrics.mode,
        location_label: metrics.locationLabel,
        cache_used: metrics.cacheUsed,
        duration_ms: metrics.durationMs,
        total_accepted_stories: metrics.totalAcceptedStories,
        visible_pool_count: metrics.allVisiblePoolCount,
        shown_stories_count: metrics.shownStoriesCount,
        feeds_attempted: feedsAttempted,
        feeds_succeeded: feedsSucceeded,
        feeds_failed: feedsFailed,
        fetched: metrics.funnel.fetched,
        valid_base: metrics.funnel.validBase,
        credible_source: metrics.funnel.credibleSource,
        deduped: metrics.funnel.deduped,
        unseen: metrics.funnel.unseen,
        category_matched: metrics.funnel.categoryMatched,
        accepted: metrics.funnel.accepted,
        invalid_rejected: metrics.funnel.invalidRejected,
        source_rejected: metrics.funnel.sourceRejected,
        duplicate_rejected: metrics.funnel.duplicateRejected,
        seen_rejected: metrics.funnel.seenRejected,
        category_rejected: metrics.funnel.categoryRejected,
        constructive_rejected: metrics.funnel.constructiveRejected,
        positivity_rejected: metrics.funnel.positivityRejected,
        rule_filtered_count: metrics.funnel.ruleFilteredCount,
        feed_errors: metrics.funnel.feedErrors,
        mobilebert_fresh_classified: metrics.funnel.mobileBertFreshClassified,
        mobilebert_cache_hits: metrics.funnel.mobileBertCacheHits,
        mobilebert_classified: metrics.funnel.mobileBertClassified,
        rule_classified: metrics.funnel.ruleClassified,
        mobilebert_percent: mobilebertPercent,
        rule_percent: rulePercent,
        category_metrics_json: metrics.categoryMetrics,
      }),
    });
  } catch {
    // Ignore logging failures so feed UX is never blocked by analytics.
  }
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

  if (introBoilerplatePatterns.some((pattern) => pattern.test(normalized))) {
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

function passesHardSafety(item: NewsItem) {
  const combinedText = `${item.title} ${item.description} ${item.source}`.toLowerCase();
  const negativeScore = countKeywordHits(combinedText, negativeSignals);
  const clickbait = isLikelyClickbait(item.title);

  if (!hasCredibleSource(item.source)) {
    return { accepted: false, score: -3, reason: 'source_not_credible' };
  }

  if (clickbait) {
    return { accepted: false, score: -4, reason: 'clickbait' };
  }

  if (negativeScore >= 1) {
    return { accepted: false, score: -3, reason: 'negative' };
  }

  return { accepted: true, score: 0, reason: 'safe' };
}

function matchesCategory(item: NewsItem, category: NewsCategory) {
  if (category === 'All') {
    return true;
  }

  const signals = categorySignals[category];
  const haystack = `${item.title} ${item.description} ${item.source}`.toLowerCase();
  const hitCount = countKeywordHits(haystack, signals);

  if (category === 'World') {
    return hitCount >= 1;
  }

  return hitCount >= 1 || signals.some((signal) => item.title.toLowerCase().includes(signal));
}

function decodeHtml(text: string) {
  return text
    .replace(/&#(\d+);/g, (match, decimalCode) => {
      const codePoint = Number.parseInt(decimalCode, 10);

      if (!Number.isFinite(codePoint)) {
        return match;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hexCode) => {
      const codePoint = Number.parseInt(hexCode, 16);

      if (!Number.isFinite(codePoint)) {
        return match;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    })
    .replace(/&[a-z]+;/gi, (match) => htmlEntityMap[match.toLowerCase()] ?? match);
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

function isWithinLast30Days(dateString?: string) {
  if (!dateString) {
    return false;
  }

  const publishedDate = new Date(dateString);
  if (Number.isNaN(publishedDate.getTime())) {
    return false;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return publishedDate >= thirtyDaysAgo && publishedDate <= now;
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

function mixAllCategoryStories(stories: NewsItem[]) {
  const groupedStories = new Map<NewsCategory, NewsItem[]>();

  for (const story of stories) {
    if (story.category === 'All') {
      continue;
    }

    const group = groupedStories.get(story.category) ?? [];
    group.push(story);
    groupedStories.set(story.category, group);
  }

  const categoryOrder = Array.from(groupedStories.keys()).sort((a, b) => {
    const indexA = categories.indexOf(a);
    const indexB = categories.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
  const mixedStories: NewsItem[] = [];
  let addedInPass = true;

  while (addedInPass) {
    addedInPass = false;

    for (const category of categoryOrder) {
      const group = groupedStories.get(category);

      if (!group || group.length === 0) {
        continue;
      }

      const nextStory = group.shift();
      if (!nextStory) {
        continue;
      }

      mixedStories.push(nextStory);
      addedInPass = true;
    }
  }

  return mixedStories;
}

function getStoriesForCategory(
  stories: NewsItem[],
  category: NewsCategory,
  locationContext?: LocationContext,
) {
  if (category === 'All') {
    return mixAllCategoryStories(
      mixStoriesByFreshness(stories.filter((story) => story.category !== 'All'), locationContext, targetStoryCount),
    );
  }

  return mixStoriesByFreshness(
    stories.filter((story) => story.category === category),
    locationContext,
    targetStoryCount,
  );
}

function mixStoriesByFreshness(
  stories: NewsItem[],
  locationContext: LocationContext | undefined,
  targetCount: number,
) {
  const decoratedStories = stories.map((story) => ({
    story,
    localityScore: computeLocalityScore(story, locationContext),
  }));

  const strong = decoratedStories.filter(({ story }) => story.positiveScore >= 8);
  const solid = decoratedStories.filter(
    ({ story }) => story.positiveScore >= 5 && story.positiveScore < 8,
  );
  const steady = decoratedStories.filter(({ story }) => story.positiveScore < 5);

  const qualityBands = [strong, solid, steady];
  const orderedStories = qualityBands.flatMap((band) =>
    band.sort((left, right) => {
      const leftFresh = isStoryFromToday(left.story.publishedAt) ? 1 : 0;
      const rightFresh = isStoryFromToday(right.story.publishedAt) ? 1 : 0;

      if (rightFresh !== leftFresh) {
        return rightFresh - leftFresh;
      }

      if (right.localityScore !== left.localityScore) {
        return right.localityScore - left.localityScore;
      }

      const dateDiff =
        new Date(right.story.publishedAt).getTime() - new Date(left.story.publishedAt).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return left.story.url.localeCompare(right.story.url);
    }),
  );

  const buckets = {
    todayLocal: orderedStories.filter(
      ({ story, localityScore }) => isStoryFromToday(story.publishedAt) && localityScore > 0,
    ),
    today: orderedStories.filter(
      ({ story, localityScore }) => isStoryFromToday(story.publishedAt) && localityScore === 0,
    ),
    weekLocal: orderedStories.filter(
      ({ story, localityScore }) => !isStoryFromToday(story.publishedAt) && localityScore > 0,
    ),
    week: orderedStories.filter(
      ({ story, localityScore }) => !isStoryFromToday(story.publishedAt) && localityScore === 0,
    ),
  };

  const selectedStories: NewsItem[] = [];
  const usedUrls = new Set<string>();

  const appendFromBucket = (bucket: Array<{ story: NewsItem }>) => {
    for (const entry of bucket) {
      if (usedUrls.has(entry.story.url)) {
        continue;
      }

      usedUrls.add(entry.story.url);
      selectedStories.push(entry.story);

      if (selectedStories.length >= targetCount) {
        return;
      }
    }
  };

  appendFromBucket(buckets.todayLocal);
  appendFromBucket(buckets.today);
  appendFromBucket(buckets.weekLocal);
  appendFromBucket(buckets.week);

  return selectedStories.slice(0, targetCount);
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

  const diagnostics = createEmptyDiagnostics();

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

      const story: NewsItem = {
        id:
          typeof item.guid === 'string' && item.guid.trim()
            ? item.guid.trim()
            : `${category}-${index}`,
        title: cleanTitle(typeof item.title === 'string' ? item.title : undefined),
        description: description || `Latest ${category.toLowerCase()} story from ${source}.`,
        category: feed.category ?? category,
        location: inferLocation(description),
        time: formatRelativeTime(publishedAt),
        publishedAt,
        source: trustedSource,
        url,
        positiveScore: 0,
      };
      const storyCategory = story.category;
      diagnostics[storyCategory].fetched += 1;
      diagnostics.All.fetched += 1;

      return story;
    });

  const filteredNewsItems: NewsItem[] = newsItems.filter((item) => {
      const storyCategory = item.category;

      if (!item.title || !item.url || !isWithinLast30Days(item.publishedAt)) {
        diagnostics[storyCategory].invalidRejected += 1;
        diagnostics.All.invalidRejected += 1;
        return false;
      }

      diagnostics[storyCategory].validBase += 1;
      diagnostics.All.validBase += 1;

      if (!hasCredibleSource(item.source)) {
        diagnostics[storyCategory].sourceRejected += 1;
        diagnostics.All.sourceRejected += 1;
        return false;
      }

      diagnostics[storyCategory].credibleSource += 1;
      diagnostics.All.credibleSource += 1;

      return true;
    });

  return {
    newsItems: filteredNewsItems,
    diagnostics,
  };
}

async function fetchAllStories(
  locationContext?: LocationContext,
  visitCount = 0,
  seenStories: Record<string, number> = {},
) {
  const fetchStartedAt = Date.now();
  const diagnostics = createEmptyDiagnostics();
  const allAcceptedStories = new Map<string, NewsItem>();
  const categoryFeedMap = buildCategoryFeedUrls(locationContext);
  const categoriesToFetch = categories.filter(
    (category): category is Exclude<NewsCategory, 'All'> => category !== 'All',
  );

  const categoryResults = await Promise.all(
    categoriesToFetch.map(async (category, categoryIndex) => {
      const categoryStartedAt = Date.now();
      const categoryDiagnostics = createEmptyDiagnostics();
      const acceptedStories = new Map<string, NewsItem>();
      const seenUrls = new Set<string>();
      const feeds = rotateArray(categoryFeedMap[category], visitCount + categoryIndex);
      const tiers: Array<NonNullable<FeedSource['tier']>> = ['priority', 'secondary', 'fallback'];
      const scannedTiers = new Set<NonNullable<FeedSource['tier']>>();
      let attemptedFeeds = 0;
      let successfulFeeds = 0;
      let failedFeeds = 0;
      let mobileBertFreshClassified = 0;
      let mobileBertCacheHits = 0;
      let mobileBertClassified = 0;
      let ruleFilteredCount = 0;
      const ruleClassified = 0;

      for (const tier of tiers) {
        if (acceptedStories.size >= categoryTargetStoryCount) {
          break;
        }

        const tierFeeds = feeds.filter((feed) => (feed.tier ?? 'secondary') === tier);
        if (tierFeeds.length > 0) {
          scannedTiers.add(tier);
        }

        for (const feedChunk of chunkArray(tierFeeds, feedParallelism)) {
          if (acceptedStories.size >= categoryTargetStoryCount) {
            break;
          }

          attemptedFeeds += feedChunk.length;

          const settledResults = await Promise.allSettled(
            feedChunk.map((feed) => fetchFeedUrl(feed, category)),
          );

          for (let index = 0; index < settledResults.length; index += 1) {
            const settledResult = settledResults[index];

            if (settledResult.status === 'rejected') {
              failedFeeds += 1;
              categoryDiagnostics[category].feedErrors += 1;
              categoryDiagnostics.All.feedErrors += 1;
              continue;
            }

            successfulFeeds += 1;
            const { newsItems, diagnostics: feedDiagnostics } = settledResult.value;
            mergeDiagnostics(categoryDiagnostics, feedDiagnostics);
            const safeCandidates: NewsItem[] = [];

            for (const item of newsItems) {
              if (acceptedStories.size >= categoryTargetStoryCount) {
                break;
              }

              const storyCategory = item.category;

              if (seenUrls.has(item.url)) {
                categoryDiagnostics[storyCategory].duplicateRejected += 1;
                categoryDiagnostics.All.duplicateRejected += 1;
                continue;
              }
              seenUrls.add(item.url);

              categoryDiagnostics[storyCategory].deduped += 1;
              categoryDiagnostics.All.deduped += 1;

              if (seenStories[item.url]) {
                categoryDiagnostics[storyCategory].seenRejected += 1;
                categoryDiagnostics.All.seenRejected += 1;
                continue;
              }

              categoryDiagnostics[storyCategory].unseen += 1;
              categoryDiagnostics.All.unseen += 1;

              if (!matchesCategory(item, storyCategory)) {
                categoryDiagnostics[storyCategory].categoryRejected += 1;
                categoryDiagnostics.All.categoryRejected += 1;
                continue;
              }

              categoryDiagnostics[storyCategory].categoryMatched += 1;
              categoryDiagnostics.All.categoryMatched += 1;

              const safetyResult = passesHardSafety(item);
              if (!safetyResult.accepted) {
                categoryDiagnostics[storyCategory].ruleFilteredCount += 1;
                categoryDiagnostics.All.ruleFilteredCount += 1;
                ruleFilteredCount += 1;
                categoryDiagnostics[storyCategory].positivityRejected += 1;
                categoryDiagnostics.All.positivityRejected += 1;
                continue;
              }

              safeCandidates.push(item);
            }

            let semanticResults = new Map<string, MobileBertClassificationResult>();

            if (safeCandidates.length > 0) {
              try {
                const classificationResult = await classifyStoriesWithMobileBert(
                  safeCandidates,
                );
                semanticResults = classificationResult.results;
                mobileBertFreshClassified += classificationResult.freshClassified;
                mobileBertCacheHits += classificationResult.cacheHits;
                mobileBertClassified += classificationResult.cacheHits + classificationResult.freshClassified;
              } catch {
                semanticResults = new Map();
              }
            }

            for (const item of safeCandidates) {
              if (acceptedStories.size >= categoryTargetStoryCount) {
                break;
              }

              const storyCategory = item.category;
              const result = semanticResults.get(item.url);

              if (!result) {
                categoryDiagnostics[storyCategory].constructiveRejected += 1;
                categoryDiagnostics.All.constructiveRejected += 1;
                categoryDiagnostics[storyCategory].positivityRejected += 1;
                categoryDiagnostics.All.positivityRejected += 1;
                continue;
              }

              if (!result.accepted) {
                categoryDiagnostics[storyCategory].constructiveRejected += 1;
                categoryDiagnostics.All.constructiveRejected += 1;
                categoryDiagnostics[storyCategory].positivityRejected += 1;
                categoryDiagnostics.All.positivityRejected += 1;
                continue;
              }

              acceptedStories.set(item.url, {
                ...item,
                positiveScore: result.score,
              });
              categoryDiagnostics[storyCategory].accepted += 1;
              categoryDiagnostics.All.accepted += 1;
            }
          }
        }
      }

      return {
        category,
        stories: mixStoriesByFreshness(
          Array.from(acceptedStories.values()),
          locationContext,
          categoryTargetStoryCount,
        ),
        diagnostics: categoryDiagnostics,
        metrics: {
          category,
          durationMs: Date.now() - categoryStartedAt,
          acceptedCount: acceptedStories.size,
          attemptedFeeds,
          successfulFeeds,
          failedFeeds,
          scannedTiers: Array.from(scannedTiers),
          mobileBertFreshClassified,
          mobileBertCacheHits,
          mobileBertClassified,
          ruleFilteredCount,
          ruleClassified,
        } satisfies CategoryFetchMetrics,
      };
    }),
  );

  for (const result of categoryResults) {
    mergeDiagnostics(diagnostics, result.diagnostics);

    for (const story of result.stories) {
      if (!allAcceptedStories.has(story.url)) {
        allAcceptedStories.set(story.url, story);
      }
    }
  }

  const selectedStories = mixStoriesByFreshness(
    Array.from(allAcceptedStories.values()),
    locationContext,
    targetStoryCount,
  );

  return {
    stories: selectedStories,
    diagnostics,
    metrics: {
      timestamp: Date.now(),
      mode: 'refresh',
      cacheUsed: false,
      durationMs: Date.now() - fetchStartedAt,
      locationLabel:
        [locationContext?.city, locationContext?.region].filter(Boolean).join(', ') ||
        locationContext?.country ||
        'Global edition',
      totalAcceptedStories: Array.from(allAcceptedStories.values()).length,
      allVisiblePoolCount: selectedStories.length,
      shownStoriesCount: 0,
      funnel: {
        fetched: diagnostics.All.fetched,
        validBase: diagnostics.All.validBase,
        credibleSource: diagnostics.All.credibleSource,
        deduped: diagnostics.All.deduped,
        unseen: diagnostics.All.unseen,
        categoryMatched: diagnostics.All.categoryMatched,
        accepted: diagnostics.All.accepted,
        invalidRejected: diagnostics.All.invalidRejected,
        sourceRejected: diagnostics.All.sourceRejected,
        duplicateRejected: diagnostics.All.duplicateRejected,
        seenRejected: diagnostics.All.seenRejected,
        categoryRejected: diagnostics.All.categoryRejected,
        constructiveRejected: diagnostics.All.constructiveRejected,
        positivityRejected: diagnostics.All.positivityRejected,
        feedErrors: diagnostics.All.feedErrors,
        ruleFilteredCount: diagnostics.All.ruleFilteredCount,
        mobileBertFreshClassified: categoryResults.reduce(
          (total, result) => total + result.metrics.mobileBertFreshClassified,
          0,
        ),
        mobileBertCacheHits: categoryResults.reduce(
          (total, result) => total + result.metrics.mobileBertCacheHits,
          0,
        ),
        mobileBertClassified: categoryResults.reduce(
          (total, result) => total + result.metrics.mobileBertClassified,
          0,
        ),
        ruleClassified: categoryResults.reduce(
          (total, result) => total + result.metrics.ruleClassified,
          0,
        ),
      },
      categoryMetrics: categoryResults.map((result) => result.metrics),
    } satisfies RefreshMetrics,
  };
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400: require('./assets/fonts/Inter-Regular.ttf'),
    Inter_500: require('./assets/fonts/Inter-Medium.ttf'),
    Inter_600: require('./assets/fonts/Inter-SemiBold.ttf'),
    Inter_700: require('./assets/fonts/Inter-Bold.ttf'),
    Inter_800: require('./assets/fonts/Inter-ExtraBold.ttf'),
  });
  const splashFontsReady = Platform.OS === 'ios' || fontsLoaded;

  const latestLoadId = useRef(0);
  const initialLoadStartedRef = useRef(false);
  const activeCategoryRef = useRef<NewsCategory>('All');
  const locationContextRef = useRef<LocationContext | undefined>(undefined);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('All');
  const [userLocation, setUserLocation] = useState('Finding your local edition...');
  const [locationContext, setLocationContext] = useState<LocationContext | undefined>(undefined);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [allStories, setAllStories] = useState<NewsItem[]>([]);
  const [visibleStoryCount, setVisibleStoryCount] = useState(initialVisibleStoryCount);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceReaderLoading, setSourceReaderLoading] = useState(false);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('Not updated yet');
  const [seenStories, setSeenStories] = useState<Record<string, number>>({});
  const [, setDiagnostics] = useState<DiagnosticsMap>(createEmptyDiagnostics());

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    locationContextRef.current = locationContext;
  }, [locationContext]);

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
        const loadStartedAt = Date.now();
        const loadId = Date.now();
        latestLoadId.current = loadId;
        const [nextSeenStories, visitCount] = await Promise.all([
          loadSeenStories(),
          bumpVisitCount(),
        ]);
        setSeenStories(nextSeenStories);
        const [cached, cachedDiagnostics] = await Promise.all([
          loadStoriesCache(),
          loadDiagnosticsCache(),
        ]);
        const shouldReuseCache =
          mode === 'load' &&
          cached.stories.length > 0 &&
          Date.now() - cached.timestamp < storiesCacheTtlMs;

        const fetchedResult = shouldReuseCache
          ? {
              stories: cached.stories,
              diagnostics: cachedDiagnostics,
              metrics: {
                timestamp: Date.now(),
                mode,
                cacheUsed: true,
                durationMs: Date.now() - loadStartedAt,
                locationLabel:
                  [nextLocationContext?.city, nextLocationContext?.region].filter(Boolean).join(', ') ||
                  nextLocationContext?.country ||
                  'Global edition',
              totalAcceptedStories: cached.stories.length,
              allVisiblePoolCount: cached.stories.length,
              shownStoriesCount: 0,
              funnel: {
                fetched: cachedDiagnostics.All.fetched,
                validBase: cachedDiagnostics.All.validBase,
                  credibleSource: cachedDiagnostics.All.credibleSource,
                  deduped: cachedDiagnostics.All.deduped,
                  unseen: cachedDiagnostics.All.unseen,
                  categoryMatched: cachedDiagnostics.All.categoryMatched,
                  accepted: cachedDiagnostics.All.accepted,
                  invalidRejected: cachedDiagnostics.All.invalidRejected,
                  sourceRejected: cachedDiagnostics.All.sourceRejected,
                  duplicateRejected: cachedDiagnostics.All.duplicateRejected,
                  seenRejected: cachedDiagnostics.All.seenRejected,
                  categoryRejected: cachedDiagnostics.All.categoryRejected,
                constructiveRejected: cachedDiagnostics.All.constructiveRejected,
                positivityRejected: cachedDiagnostics.All.positivityRejected,
                feedErrors: cachedDiagnostics.All.feedErrors,
                ruleFilteredCount: cachedDiagnostics.All.ruleFilteredCount,
                mobileBertFreshClassified: 0,
                mobileBertCacheHits: 0,
                mobileBertClassified: 0,
                ruleClassified: 0,
              },
              categoryMetrics: [],
            } satisfies RefreshMetrics,
            }
          : await fetchAllStories(nextLocationContext, visitCount, nextSeenStories);
        const latestStories = fetchedResult.stories;
        const sanitizedStories = sanitizeStories(latestStories);
        setDiagnostics(fetchedResult.diagnostics);

        if (sanitizedStories.length === 0) {
          setError('No strongly positive stories from the last 30 days were available right now. Try refresh in a bit.');
        }
        setAllStories(sanitizedStories);
        const shownStoriesCount = getStoriesForCategory(
          sanitizeStories(sanitizedStories).filter((story) => !nextSeenStories[story.url]),
          activeCategoryRef.current,
          nextLocationContext ?? locationContextRef.current,
        ).slice(0, initialVisibleStoryCount).length;
        const updatedTimestamp = shouldReuseCache
          ? cached.timestamp
          : await saveStoriesCache(sanitizedStories);
        if (!shouldReuseCache) {
          void saveDiagnosticsCache(fetchedResult.diagnostics);
        }
        const metrics = {
          ...fetchedResult.metrics,
          mode,
          cacheUsed: shouldReuseCache,
          durationMs: Date.now() - loadStartedAt,
          totalAcceptedStories: sanitizedStories.length,
          allVisiblePoolCount: sanitizedStories.length,
          shownStoriesCount,
        } satisfies RefreshMetrics;
        void appendRefreshMetrics(metrics);
        logRefreshMetrics(metrics);
        void postRefreshMetricsToGoogleSheets(metrics);
        setLastUpdatedLabel(new Date(updatedTimestamp).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }));

        void enrichStories(sanitizedStories).then((enrichedStories) => {
          if (latestLoadId.current !== loadId) {
            return;
          }

          const finalStories = sanitizeStories(enrichedStories);
          setAllStories(finalStories);
          void saveStoriesCache(finalStories);
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
      if (initialLoadStartedRef.current) {
        return;
      }

      initialLoadStartedRef.current = true;

      try {
        let nextContext = locationContextRef.current;

        if (!nextContext) {
          nextContext = await detectLocation();
          if (cancelled) {
            return;
          }
        }

        await loadStories('load', nextContext);
      } catch (error) {
        await loadStories('load', locationContextRef.current);
      }
    };

    void loadWithLocation();

    return () => {
      cancelled = true;
    };
  }, [detectLocation, loadStories]);

  useEffect(() => {
    setVisibleStoryCount(initialVisibleStoryCount);
  }, [activeCategory]);

  const availableStories = getStoriesForCategory(
    sanitizeStories(allStories).filter((story) => !seenStories[story.url]),
    activeCategory,
    locationContext,
  );
  const visibleStories = availableStories.slice(0, visibleStoryCount);
  const canLoadMore = visibleStoryCount < availableStories.length;
  return (
    <LinearGradient
      colors={[theme.backgroundTop, theme.backgroundMiddle, theme.backgroundBottom]}
      style={styles.screen}
    >
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
                await loadStories('refresh', nextContext);
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
                  onPress={async () => {
                    setSourceReaderLoading(true);
                    const nextSeenStories = await markStorySeen(story.url);
                    setSeenStories(nextSeenStories);
                    setSelectedNews(story);
                  }}
                >
                  <View style={styles.storyVisualFallback}>
                    <Text style={styles.storyVisualHeadline} numberOfLines={2}>
                      {story.title}
                    </Text>
                    <Text style={styles.storyVisualSource}>{story.source}</Text>
                  </View>

                  <View style={styles.storyBody}>
                    <Text style={styles.storyDescription}>{story.description}</Text>

                    <View style={styles.storyCardFooter}>
                      <Text style={styles.storyScoreText}>
                        <Text style={styles.storyScoreIcon}>✦ </Text>
                        {story.positiveScore}/{maxScore}
                      </Text>
                      <Text style={styles.storyMetaRight} numberOfLines={1}>
                        <Text style={styles.storyCategory}>{story.category}</Text>
                        <Text style={styles.storyTime}> • {story.time}</Text>
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}

              {canLoadMore ? (
                <Pressable
                  style={styles.loadMoreButton}
                  onPress={() =>
                    setVisibleStoryCount((current) =>
                      Math.min(current + loadMoreBatchSize, availableStories.length),
                    )
                  }
                >
                  <Text style={styles.loadMoreButtonText}>Load more</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {loading || refreshing ? <ReferenceSplashOverlay fontsReady={splashFontsReady} /> : null}

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
                    <ActivityIndicator size="large" color={theme.accentSecondary} />
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
    backgroundColor: theme.surfacePrimary,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: theme.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  eyebrow: {
    color: theme.accentSecondary,
    fontSize: 13,
    fontFamily: fontSans.w700,
    fontWeight: 'normal',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 36,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
    marginBottom: 10,
  },
  lastUpdatedText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
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
    backgroundColor: theme.surfaceReaderMeta,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationValue: {
    color: theme.textPrimary,
    fontSize: 14,
    fontFamily: fontSans.w700,
    fontWeight: 'normal',
  },
  categoryRow: {
    paddingBottom: 8,
    paddingRight: 18,
  },
  categoryChip: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: theme.accentPrimary,
  },
  categoryChipText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontFamily: fontSans.w700,
    fontWeight: 'normal',
  },
  categoryChipTextActive: {
    color: theme.textOnDark,
  },
  errorCard: {
    backgroundColor: theme.surfaceError,
    borderRadius: 24,
    padding: 18,
    marginTop: 14,
  },
  errorTitle: {
    color: theme.accentWarm,
    fontSize: 16,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
    marginBottom: 6,
  },
  errorText: {
    color: theme.textPrimary,
    lineHeight: 22,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
  },
  storyList: {
    marginTop: 14,
    gap: 16,
  },
  storyCard: {
    flexDirection: 'column',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  storyVisualFallback: {
    backgroundColor: theme.surfaceHeader,
    padding: 18,
    justifyContent: 'flex-start',
    gap: 8,
  },
  storyVisualHeadline: {
    color: theme.textOnDark,
    fontSize: 22,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
    lineHeight: 28,
  },
  storyVisualSource: {
    color: theme.textMutedOnDark,
    fontSize: 13,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  storyBody: {
    padding: 16,
    gap: 12,
  },
  storyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyScoreText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
  },
  storyScoreIcon: {
    color: theme.accentSecondary,
    fontSize: 14,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
  },
  storyMetaRight: {
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  storyCategory: {
    color: theme.accentPrimary,
    fontSize: 13,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
  },
  storyTime: {
    color: theme.textSecondary,
    fontSize: 12,
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
  },
  loadMoreButton: {
    marginTop: 4,
    backgroundColor: theme.accentPrimary,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  loadMoreButtonText: {
    color: theme.textOnDark,
    fontSize: 15,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
  },
  storyDescription: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: theme.surfaceReader,
  },
  readerScreen: {
    flex: 1,
    backgroundColor: theme.surfaceReader,
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.borderSoft,
    backgroundColor: theme.surfaceReader,
  },
  readerHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  readerEyebrow: {
    color: theme.accentSecondary,
    fontSize: 11,
    fontFamily: fontSans.w700,
    fontWeight: 'normal',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  readerTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
  },
  readerSubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
    marginTop: 4,
  },
  readerCloseButton: {
    backgroundColor: theme.accentPrimary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  readerCloseButtonText: {
    color: theme.textOnDark,
    fontFamily: fontSans.w800,
    fontWeight: 'normal',
  },
  readerMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surfaceReaderMeta,
    gap: 8,
  },
  readerMetaText: {
    color: theme.textPrimary,
    fontSize: 12,
    fontFamily: fontSans.w700,
    fontWeight: 'normal',
  },
  readerMetaDot: {
    color: theme.accentWarm,
    fontSize: 12,
    fontFamily: fontSans.w700,
    fontWeight: 'normal',
  },
  readerWebView: {
    flex: 1,
    backgroundColor: theme.surfaceReaderWeb,
  },
  readerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: alpha(theme.surfaceReader, 0.95),
  },
  readerLoadingText: {
    color: theme.textSecondary,
    fontSize: 15,
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
  },
});
