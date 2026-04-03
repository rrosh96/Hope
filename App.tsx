import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const humanBenefitSignals = [
  'helps',
  'help',
  'improves',
  'improve',
  'support',
  'supports',
  'access',
  'affordable',
  'recovery',
  'restore',
  'restored',
  'saves',
  'saved',
  'education',
  'healthcare',
  'treatment',
  'community',
  'jobs',
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

const softCautionSignals = [
  'lawsuit',
  'warning',
  'concern',
  'concerns',
  'decline',
  'slowdown',
  'pressure',
  'pressures',
  'challenge',
  'challenges',
  'risk',
  'risks',
  'probe',
  'investigation',
];

const vagueNeutralSignals = [
  'announces',
  'announcement',
  'says',
  'report says',
  'speaks',
  'talks',
  'update',
  'updates',
  'latest on',
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

const trustedSourceBonusNames = [
  'reuters',
  'bbc',
  'npr',
  'who',
  'science daily',
  'nature',
  'phys org',
  'new scientist',
  'mit technology review',
  'ars technica',
  'techcrunch',
  'espn',
  'positive news',
  'good news network',
  'the better india',
];

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

const categoryConstructiveSignals: Record<NewsCategory, string[]> = {
  All: [],
  World: [
    'humanitarian',
    'peace talks',
    'aid',
    'rebuild',
    'restoration',
    'cooperation',
    'development',
    'relief',
    'clean water',
    'food security',
  ],
  Business: [
    'hiring',
    'expansion',
    'new jobs',
    'small business',
    'startup success',
    'investment',
    'funding',
    'profit growth',
    'affordable',
    'local business',
  ],
  Technology: [
    'launch',
    'rollout',
    'open source',
    'new tool',
    'new app',
    'helps doctors',
    'helps students',
    'faster',
    'safer',
    'efficient',
    'accessibility',
  ],
  Science: [
    'study finds',
    'discovery',
    'trial success',
    'treatment works',
    'conservation',
    'emissions drop',
    'new evidence',
    'researchers develop',
    'breakthrough',
  ],
  Sports: [
    'win',
    'comeback',
    'championship',
    'medal',
    'qualify',
    'sportsmanship',
    'charity match',
    'youth sports',
    'community sports',
    'para sport',
  ],
  Health: [
    'recovery',
    'treatment success',
    'improved access',
    'reduced risk',
    'hospital opens',
    'vaccination',
    'public health success',
    'lives saved',
    'wellness',
  ],
};

const minimumPositiveScore = 2;
const targetStoryCount = 150;
const initialVisibleStoryCount = 5;
const loadMoreBatchSize = 5;
const maxIntroWords = 50;
const maxScore = 10;
const seenStoriesStorageKey = 'hope:seen-stories';
const visitCountStorageKey = 'hope:visit-count';
const storiesCacheStorageKey = 'hope:stories-cache';
const storiesCacheTimestampStorageKey = 'hope:stories-cache-timestamp';
const diagnosticsStorageKey = 'hope:stories-diagnostics';
const seenStoryCooldownMs = 3 * 24 * 60 * 60 * 1000;
const storiesCacheTtlMs = 5 * 60 * 1000;

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

function shuffleArray<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
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
  const baseConstructiveHits = countKeywordHits(combinedText, positiveSignals);
  const categoryConstructiveHits = countKeywordHits(
    combinedText,
    categoryConstructiveSignals[item.category] ?? [],
  );
  const humanBenefitHits = countKeywordHits(combinedText, humanBenefitSignals);
  const softCautionHits = countKeywordHits(combinedText, softCautionSignals);
  const vagueNeutralHits = countKeywordHits(combinedText, vagueNeutralSignals);
  const sourceName = normalizeSourceName(item.source).toLowerCase();
  const trustedSourceBonus = trustedSourceBonusNames.some((name) => sourceName.includes(name))
    ? 1
    : 0;

  let score = 0;
  score += Math.min(baseConstructiveHits, 3) * 2;
  score += Math.min(categoryConstructiveHits, 2) * 2;
  score += Math.min(humanBenefitHits, 2) * 2;
  score += trustedSourceBonus;
  score -= Math.min(softCautionHits, 2) * 2;

  if (baseConstructiveHits + categoryConstructiveHits === 0 && vagueNeutralHits > 0) {
    score -= 2;
  }

  const hasConstructiveSignal = baseConstructiveHits + categoryConstructiveHits + humanBenefitHits > 0;
  if (!hasConstructiveSignal) {
    return { accepted: false, score: 0, reason: 'too_neutral', softCautionHits };
  }

  if (score < minimumPositiveScore + 1) {
    return { accepted: false, score, reason: 'low_impact', softCautionHits };
  }

  return {
    accepted: true,
    score: Math.min(maxScore, Math.max(1, score)),
    reason: 'constructive',
    softCautionHits,
  };
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

  const categoryOrder = shuffleArray(Array.from(groupedStories.keys()));
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

  const strong = shuffleArray(
    decoratedStories.filter(({ story }) => story.positiveScore >= 8),
  );
  const solid = shuffleArray(
    decoratedStories.filter(({ story }) => story.positiveScore >= 5 && story.positiveScore < 8),
  );
  const steady = shuffleArray(
    decoratedStories.filter(({ story }) => story.positiveScore < 5),
  );

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

      return (
        new Date(right.story.publishedAt).getTime() - new Date(left.story.publishedAt).getTime()
      );
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

      const story = {
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
    })
    .filter((item) => {
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

  return { newsItems, diagnostics };
}

async function fetchAllStories(
  locationContext?: LocationContext,
  visitCount = 0,
  seenStories: Record<string, number> = {},
) {
  const acceptedStories = new Map<string, NewsItem>();
  const seenUrls = new Set<string>();
  const diagnostics = createEmptyDiagnostics();
  const categoryFeeds = buildCategoryFeedUrls(locationContext).All;
  const feedUrls: FeedSource[] = rotateArray(categoryFeeds, visitCount);

  for (const feedUrl of feedUrls) {
    let newsItems: NewsItem[] = [];
    let feedDiagnostics = createEmptyDiagnostics();

    try {
      const result = await fetchFeedUrl(feedUrl, feedUrl.category ?? 'All');
      newsItems = result.newsItems;
      feedDiagnostics = result.diagnostics;
    } catch {
      const categoryKey = feedUrl.category ?? 'All';
      diagnostics[categoryKey].feedErrors += 1;
      diagnostics.All.feedErrors += 1;
      continue;
    }

    for (const category of categories) {
      diagnostics[category].fetched += feedDiagnostics[category].fetched;
      diagnostics[category].invalidRejected += feedDiagnostics[category].invalidRejected;
      diagnostics[category].validBase += feedDiagnostics[category].validBase;
      diagnostics[category].sourceRejected += feedDiagnostics[category].sourceRejected;
      diagnostics[category].credibleSource += feedDiagnostics[category].credibleSource;
    }

    for (const item of newsItems) {
      const storyCategory = item.category;

      if (seenUrls.has(item.url)) {
        diagnostics[storyCategory].duplicateRejected += 1;
        diagnostics.All.duplicateRejected += 1;
        continue;
      }
      seenUrls.add(item.url);

      diagnostics[storyCategory].deduped += 1;
      diagnostics.All.deduped += 1;

      if (seenStories[item.url]) {
        diagnostics[storyCategory].seenRejected += 1;
        diagnostics.All.seenRejected += 1;
        continue;
      }

      diagnostics[storyCategory].unseen += 1;
      diagnostics.All.unseen += 1;

      if (!matchesCategory(item, storyCategory)) {
        diagnostics[storyCategory].categoryRejected += 1;
        diagnostics.All.categoryRejected += 1;
        continue;
      }

      diagnostics[storyCategory].categoryMatched += 1;
      diagnostics.All.categoryMatched += 1;

      const safetyResult = passesHardSafety(item);
      if (!safetyResult.accepted) {
        diagnostics[storyCategory].positivityRejected += 1;
        diagnostics.All.positivityRejected += 1;
        continue;
      }
      const result = scoreStory(item);
      diagnostics[storyCategory].cautionPenaltyHits += result.softCautionHits ?? 0;
      diagnostics.All.cautionPenaltyHits += result.softCautionHits ?? 0;

      if (!result.accepted) {
        diagnostics[storyCategory].constructiveRejected += 1;
        diagnostics.All.constructiveRejected += 1;
        diagnostics[storyCategory].positivityRejected += 1;
        diagnostics.All.positivityRejected += 1;
        continue;
      }

      acceptedStories.set(item.url, {
        ...item,
        positiveScore: result.score,
      });
      diagnostics[storyCategory].accepted += 1;
      diagnostics.All.accepted += 1;
    }
  }

  const selectedStories = mixStoriesByFreshness(
    Array.from(acceptedStories.values()),
    locationContext,
    targetStoryCount,
  );

  return {
    stories: selectedStories,
    diagnostics,
  };
}

export default function App() {
  const latestLoadId = useRef(0);
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
          ? { stories: cached.stories, diagnostics: cachedDiagnostics }
          : await fetchAllStories(nextLocationContext, visitCount, nextSeenStories);
        const latestStories = fetchedResult.stories;
        const sanitizedStories = sanitizeStories(latestStories);
        setDiagnostics(fetchedResult.diagnostics);

        if (sanitizedStories.length === 0) {
          setError('No strongly positive stories from the last 30 days were available right now. Try refresh in a bit.');
        }
        setAllStories(sanitizedStories);
        const updatedTimestamp = shouldReuseCache
          ? cached.timestamp
          : await saveStoriesCache(sanitizedStories);
        if (!shouldReuseCache) {
          void saveDiagnosticsCache(fetchedResult.diagnostics);
        }
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
      try {
        let nextContext = locationContext;

        if (!locationContext) {
          nextContext = await detectLocation();
          if (cancelled) {
            return;
          }
        }

        await loadStories('load', nextContext);
      } catch (error) {
        await loadStories('load', locationContext);
      }
    };

    void loadWithLocation();

    return () => {
      cancelled = true;
    };
  }, [detectLocation, loadStories, locationContext]);

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
                  onPress={async () => {
                    setSourceReaderLoading(true);
                    const nextSeenStories = await markStorySeen(story.url);
                    setSeenStories(nextSeenStories);
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
                      Math.min(current + loadMoreBatchSize, availableStories.length),
                    )
                  }
                >
                  <Text style={styles.loadMoreButtonText}>
                    Load more ({availableStories.length - visibleStoryCount} left)
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {refreshing && !loading ? (
          <View style={styles.refreshOverlay}>
            <View style={styles.refreshOverlayCard}>
              <ActivityIndicator size="large" color="#172235" />
              <Text style={styles.refreshOverlayTitle}>Refreshing good news</Text>
              <Text style={styles.refreshOverlayText}>
                Pulling all source pools again for the latest positive stories.
              </Text>
            </View>
          </View>
        ) : null}

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
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.82)',
    paddingHorizontal: 24,
    zIndex: 5,
  },
  refreshOverlayCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#20304a',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  refreshOverlayTitle: {
    marginTop: 16,
    color: '#152033',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  refreshOverlayText: {
    marginTop: 10,
    color: '#526177',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
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
