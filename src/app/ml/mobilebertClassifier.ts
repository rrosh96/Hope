import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ort from 'onnxruntime-react-native';
import type { NewsItem } from '../data/mockNews';

const modelRepoBase = 'https://huggingface.co/Xenova/mobilebert-uncased-mnli/resolve/main';
const modelUrl = `${modelRepoBase}/onnx/model_quantized.onnx`;
const vocabUrl = `${modelRepoBase}/vocab.txt`;
const configUrl = `${modelRepoBase}/config.json`;
const classificationCacheStorageKey = 'hope:mobilebert-classification-cache';
const classificationCacheTtlMs = 24 * 60 * 60 * 1000;
const positiveLabel = 'constructive positive news';
const neutralLabel = 'neutral factual update';
const negativeLabel = 'negative harmful news';
const candidateLabels = [positiveLabel, neutralLabel, negativeLabel] as const;
const hypothesisTemplate = 'This news story is {}.';
const modelFileName = 'hope-mobilebert-mnli.onnx';
const vocabFileName = 'hope-mobilebert-vocab.txt';
const configFileName = 'hope-mobilebert-config.json';
const maxSequenceLength = 256;

export type MobileBertClassificationResult = {
  accepted: boolean;
  score: number;
  reason: 'mobilebert_positive' | 'mobilebert_neutral' | 'mobilebert_negative';
  positiveConfidence: number;
  neutralConfidence: number;
  negativeConfidence: number;
};

type CacheEntry = MobileBertClassificationResult & {
  cachedAt: number;
};

type ModelConfig = {
  entailmentIndex: number;
};

type TokenizerState = {
  vocab: Map<string, number>;
  clsTokenId: number;
  sepTokenId: number;
  padTokenId: number;
  unkTokenId: number;
};

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let tokenizerPromise: Promise<TokenizerState> | null = null;
let modelConfigPromise: Promise<ModelConfig> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function softmax(values: number[]) {
  const maxValue = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - maxValue));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

function normalizeText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function basicTokenize(text: string) {
  const normalized = normalizeText(text);
  const matches = normalized.match(/[a-z0-9]+|[^\s\w]/g);
  return matches ?? [];
}

function wordpieceTokenize(token: string, vocab: Map<string, number>, unkToken = '[UNK]') {
  if (vocab.has(token)) {
    return [token];
  }

  const pieces: string[] = [];
  let start = 0;

  while (start < token.length) {
    let end = token.length;
    let currentPiece: string | null = null;

    while (start < end) {
      const substring = token.slice(start, end);
      const candidate = start === 0 ? substring : `##${substring}`;

      if (vocab.has(candidate)) {
        currentPiece = candidate;
        break;
      }

      end -= 1;
    }

    if (!currentPiece) {
      return [unkToken];
    }

    pieces.push(currentPiece);
    start = end;
  }

  return pieces;
}

function tokenizeToIds(text: string, tokenizer: TokenizerState) {
  return basicTokenize(text)
    .flatMap((token) => wordpieceTokenize(token, tokenizer.vocab))
    .map((token) => tokenizer.vocab.get(token) ?? tokenizer.unkTokenId);
}

function truncatePair(premiseIds: number[], hypothesisIds: number[], maxLength: number) {
  const availableLength = maxLength - 3;

  while (premiseIds.length + hypothesisIds.length > availableLength) {
    if (premiseIds.length >= hypothesisIds.length) {
      premiseIds.pop();
    } else {
      hypothesisIds.pop();
    }
  }
}

function encodePair(premise: string, hypothesis: string, tokenizer: TokenizerState) {
  const premiseIds = tokenizeToIds(premise, tokenizer);
  const hypothesisIds = tokenizeToIds(hypothesis, tokenizer);

  truncatePair(premiseIds, hypothesisIds, maxSequenceLength);

  const inputIds = [
    tokenizer.clsTokenId,
    ...premiseIds,
    tokenizer.sepTokenId,
    ...hypothesisIds,
    tokenizer.sepTokenId,
  ];

  const tokenTypeIds = [
    ...new Array(premiseIds.length + 2).fill(0),
    ...new Array(hypothesisIds.length + 1).fill(1),
  ];

  const attentionMask = new Array(inputIds.length).fill(1);

  while (inputIds.length < maxSequenceLength) {
    inputIds.push(tokenizer.padTokenId);
    tokenTypeIds.push(0);
    attentionMask.push(0);
  }

  return {
    inputIds,
    tokenTypeIds,
    attentionMask,
  };
}

function buildClassificationText(story: NewsItem) {
  const summary = [story.title, story.description, `${story.category} news`, `Source ${story.source}`]
    .filter(Boolean)
    .join('. ')
    .replace(/\s+/g, ' ')
    .trim();

  return summary.length > 512 ? `${summary.slice(0, 509)}...` : summary;
}

function buildResult(scoresByLabel: Record<(typeof candidateLabels)[number], number>): MobileBertClassificationResult {
  const positive = scoresByLabel[positiveLabel];
  const neutral = scoresByLabel[neutralLabel];
  const negative = scoresByLabel[negativeLabel];

  const ranked = [
    { label: positiveLabel, value: positive },
    { label: neutralLabel, value: neutral },
    { label: negativeLabel, value: negative },
  ].sort((left, right) => right.value - left.value);

  const topLabel = ranked[0]?.label ?? neutralLabel;
  const semanticMargin = positive - Math.max(negative, neutral * 0.85);
  const accepted =
    (topLabel === positiveLabel && positive >= 0.38 && negative <= 0.28) ||
    (positive >= 0.44 && semanticMargin >= 0.08);
  const blendedScore = clamp(
    Math.round((positive * 0.7 + Math.max(0, positive - negative) * 0.3) * 10),
    1,
    10,
  );

  return {
    accepted,
    score: blendedScore,
    reason: accepted
      ? 'mobilebert_positive'
      : negative >= neutral
        ? 'mobilebert_negative'
        : 'mobilebert_neutral',
    positiveConfidence: positive,
    neutralConfidence: neutral,
    negativeConfidence: negative,
  };
}

async function ensureDownloadedFile(url: string, fileName: string) {
  const localUri = `${FileSystem.cacheDirectory}${fileName}`;
  const fileInfo = await FileSystem.getInfoAsync(localUri);

  if (!fileInfo.exists) {
    await FileSystem.downloadAsync(url, localUri);
  }

  return localUri;
}

async function loadClassificationCache() {
  try {
    const rawValue = await AsyncStorage.getItem(classificationCacheStorageKey);
    const parsed = rawValue ? (JSON.parse(rawValue) as Record<string, CacheEntry>) : {};
    const now = Date.now();
    const nextEntries = Object.entries(parsed).filter(
      ([, entry]) => now - entry.cachedAt < classificationCacheTtlMs,
    );
    const nextCache = Object.fromEntries(nextEntries);

    if (nextEntries.length !== Object.keys(parsed).length) {
      await AsyncStorage.setItem(classificationCacheStorageKey, JSON.stringify(nextCache));
    }

    return nextCache;
  } catch {
    return {};
  }
}

async function saveClassificationCache(cache: Record<string, CacheEntry>) {
  await AsyncStorage.setItem(classificationCacheStorageKey, JSON.stringify(cache));
}

export async function clearMobileBertClassificationCache() {
  await AsyncStorage.removeItem(classificationCacheStorageKey);
}

async function getModelConfig() {
  if (!modelConfigPromise) {
    modelConfigPromise = (async () => {
      const localConfigUri = await ensureDownloadedFile(configUrl, configFileName);
      const rawConfig = await FileSystem.readAsStringAsync(localConfigUri);
      const config = JSON.parse(rawConfig) as {
        label2id?: Record<string, number>;
        id2label?: Record<string, string>;
      };

      let entailmentIndex = 2;
      const label2id = config.label2id ?? {};
      const normalizedEntries = Object.entries(label2id).map(([label, id]) => [label.toLowerCase(), id] as const);
      const entailmentEntry = normalizedEntries.find(([label]) => label.includes('entail'));

      if (entailmentEntry) {
        entailmentIndex = entailmentEntry[1];
      }

      return { entailmentIndex };
    })();
  }

  return modelConfigPromise;
}

async function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      const localVocabUri = await ensureDownloadedFile(vocabUrl, vocabFileName);
      const rawVocab = await FileSystem.readAsStringAsync(localVocabUri);
      const vocab = new Map<string, number>();

      rawVocab.split(/\r?\n/).forEach((token, index) => {
        const trimmed = token.trim();
        if (trimmed) {
          vocab.set(trimmed, index);
        }
      });

      const clsTokenId = vocab.get('[CLS]');
      const sepTokenId = vocab.get('[SEP]');
      const padTokenId = vocab.get('[PAD]');
      const unkTokenId = vocab.get('[UNK]');

      if (
        clsTokenId === undefined ||
        sepTokenId === undefined ||
        padTokenId === undefined ||
        unkTokenId === undefined
      ) {
        throw new Error('MobileBERT vocab is missing required special tokens.');
      }

      return {
        vocab,
        clsTokenId,
        sepTokenId,
        padTokenId,
        unkTokenId,
      };
    })();
  }

  return tokenizerPromise;
}

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const localModelUri = await ensureDownloadedFile(modelUrl, modelFileName);
      return ort.InferenceSession.create(localModelUri, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
    })();
  }

  return sessionPromise;
}

async function scoreHypothesis(premise: string, hypothesis: string) {
  const [tokenizer, session, config] = await Promise.all([
    getTokenizer(),
    getSession(),
    getModelConfig(),
  ]);
  const encoded = encodePair(premise, hypothesis, tokenizer);

  const feeds: Record<string, ort.Tensor> = {
    input_ids: new ort.Tensor(
      'int64',
      BigInt64Array.from(encoded.inputIds, (value) => BigInt(value)),
      [1, maxSequenceLength],
    ),
    attention_mask: new ort.Tensor(
      'int64',
      BigInt64Array.from(encoded.attentionMask, (value) => BigInt(value)),
      [1, maxSequenceLength],
    ),
    token_type_ids: new ort.Tensor(
      'int64',
      BigInt64Array.from(encoded.tokenTypeIds, (value) => BigInt(value)),
      [1, maxSequenceLength],
    ),
  };

  const outputs = await session.run(feeds);
  const outputName = session.outputNames[0];
  const output = outputName ? outputs[outputName] : undefined;

  if (!output || !('data' in output)) {
    throw new Error('MobileBERT ONNX session did not return logits.');
  }

  const logits = Array.from(output.data as Float32Array | number[]);
  if (logits.length <= config.entailmentIndex) {
    throw new Error('MobileBERT ONNX logits shape is unexpected.');
  }

  return logits[config.entailmentIndex];
}

export async function classifyStoriesWithMobileBert(stories: NewsItem[]) {
  const cache = await loadClassificationCache();
  const results = new Map<string, MobileBertClassificationResult>();
  let cacheHits = 0;
  const uncachedStories = stories.filter((story) => {
    const cached = cache[story.url];
    if (!cached) {
      return true;
    }

    results.set(story.url, cached);
    cacheHits += 1;
    return false;
  });

  if (uncachedStories.length === 0) {
    return {
      results,
      cacheHits,
      freshClassified: 0,
    };
  }

  const now = Date.now();

  for (const story of uncachedStories) {
    const premise = buildClassificationText(story);
    const entailmentLogits = await Promise.all(
      candidateLabels.map((label) => scoreHypothesis(premise, hypothesisTemplate.replace('{}', label))),
    );
    const normalizedScores = softmax(entailmentLogits);
    const result = buildResult({
      [positiveLabel]: normalizedScores[0] ?? 0,
      [neutralLabel]: normalizedScores[1] ?? 0,
      [negativeLabel]: normalizedScores[2] ?? 0,
    });

    results.set(story.url, result);
    cache[story.url] = {
      ...result,
      cachedAt: now,
    };
  }

  await saveClassificationCache(cache);

  return {
    results,
    cacheHits,
    freshClassified: uncachedStories.length,
  };
}
