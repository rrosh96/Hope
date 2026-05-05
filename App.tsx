import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFonts } from 'expo-font';
import { XMLParser } from 'fast-xml-parser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
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

/** Figma-aligned palette (Hope RN). */
const palette = {
  white: '#FFFFFF',
  pageBlue: '#F8FAFC',
  headerBlue: '#DBEAFE',
  cardBlue: '#EFF6FF',
  bodySlate: '#64748B',
  headingSlate: '#1E293B',
  metaSlate: '#64748B',
  timestampSlate: '#64748B',
  borderSlate: '#94A3B8',
  ctaBlue: '#64748B',
  softMint: '#A6DFDF',
  errorRose: '#FFE8E4',
  coral: '#e63946',
};

const alpha = (hex: string, opacity: number) => {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
};

const theme = {
  backgroundTop: palette.pageBlue,
  backgroundMiddle: palette.pageBlue,
  backgroundBottom: palette.pageBlue,
  surfacePrimary: palette.headerBlue,
  surfaceSecondary: palette.cardBlue,
  surfaceOverlay: alpha(palette.headingSlate, 0.45),
  surfaceError: palette.errorRose,
  surfaceHeader: palette.cardBlue,
  surfaceReader: palette.pageBlue,
  surfaceReaderMeta: palette.cardBlue,
  surfaceReaderWeb: palette.white,
  textPrimary: palette.headingSlate,
  textSecondary: palette.bodySlate,
  textMeta: palette.metaSlate,
  textTimestamp: palette.timestampSlate,
  textOnDark: palette.white,
  textMutedOnDark: palette.metaSlate,
  heroTitle: palette.headingSlate,
  accentPrimary: palette.ctaBlue,
  accentSecondary: palette.ctaBlue,
  accentWarm: palette.coral,
  borderSoft: palette.borderSlate,
  shadow: palette.headingSlate,
};

const liquidGradient = {
  color1: '#DBEAFE',
  color2: '#EFF6FF',
  color3: '#F8FAFC',
  color4: '#FFFFFF',
  accentBlue: '#A0C8FF',
  deepBlue: '#78AAFF',
};

const liquidShaderHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
  /* The user's JS sets container z-index to -1 (intended for embedding behind page content);
     in our standalone WebView there is no body content, so we promote it to z-index 0 to keep it visible. */
  #liquid-bg { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 0 !important; }
  canvas { width: 100% !important; height: 100% !important; display: block; }
</style>
</head>
<body>
<div id="liquid-bg"></div>

<script>
(function () {
  const container = document.getElementById("liquid-bg");

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  const gl = canvas.getContext("webgl");

  function resize() {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  resize();
  window.addEventListener("resize", resize);

  // Make it behave like a background
  Object.assign(container.style, {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: -1,
  });

  Object.assign(canvas.style, {
    width: "100%",
    height: "100%",
    display: "block",
  });

  const vertexShaderSource = \`
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
  \`;

  const fragmentShaderSource = \`
  precision mediump float;

  uniform vec2 resolution;
  uniform float time;

  vec3 color1 = vec3(219.0/255.0, 234.0/255.0, 254.0/255.0);
  vec3 color2 = vec3(239.0/255.0, 246.0/255.0, 255.0/255.0);
  vec3 color3 = vec3(248.0/255.0, 250.0/255.0, 252.0/255.0);
  vec3 color4 = vec3(1.0, 1.0, 1.0);

  vec3 accentBlue = vec3(160.0/255.0, 200.0/255.0, 255.0/255.0);
  vec3 deepBlue   = vec3(120.0/255.0, 170.0/255.0, 255.0/255.0);

  void main() {
      vec2 uv = gl_FragCoord.xy / resolution;

      float wave1 = sin(uv.x * 4.0 + time * 0.8) * 0.18;
      float wave2 = cos(uv.y * 5.0 + time * 1.0) * 0.18;

      uv += vec2(wave1, wave2);

      float t1 = sin(time * 0.5 + uv.x * 3.0) * 0.5 + 0.5;
      float t2 = cos(time * 0.6 + uv.y * 2.5) * 0.5 + 0.5;

      vec3 baseMix = mix(color1, color2, t1);
      vec3 softMix = mix(color3, color4, t2);

      float blueWave = sin(time * 0.4 + (uv.x + uv.y) * 4.0) * 0.5 + 0.5;
      vec3 blueLayer = mix(baseMix, accentBlue, blueWave * 0.05);

      float depth = sin((uv.x - uv.y) * 5.0 + time * 0.7) * 0.5 + 0.5;
      vec3 depthLayer = mix(blueLayer, deepBlue, depth * 0.2);

      vec3 finalColor = mix(depthLayer, softMix, 0.3);

      gl_FragColor = vec4(finalColor, 1.0);
  }
  \`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const timeLocation = gl.getUniformLocation(program, "time");
  const resolutionLocation = gl.getUniformLocation(program, "resolution");

  function render(t) {
    resize();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, t * 0.001);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>
</body>
</html>`;

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
const SPLASH_TEAL = palette.headerBlue;
const SPLASH_FACE_DARK = '#142236';
const SPLASH_BRAND_ROW_TOP = 97;
const SPLASH_BRAND_ROW_LEFT = 92;
const SPLASH_BRAND_ROW_W = 194;
const SPLASH_BRAND_ROW_H = 104;
const SPLASH_BRAND_ICON_SIZE = 104;
const SPLASH_BRAND_GAP = 11;
const SPLASH_BRAND_TEXT_W = 79;
const SPLASH_BRAND_TEXT_H = 46;
const SPLASH_HEADLINE_TOP = 278;
const SPLASH_HEADLINE_LEFT = 73;
const SPLASH_HEADLINE_W = 253;
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
const motion = {
  duration: {
    fast: 120,
    normal: 220,
    slow: 320,
    card: 420,
    modal: 280,
  },
  easing: {
    easeOut: Easing.out(Easing.cubic),
    pressOut: Easing.out(Easing.quad),
  },
  distance: {
    cardEnterY: 16,
    modalEnterY: 24,
    heroScrollY: 12,
    categoryScrollY: 8,
  },
  scale: {
    press: 0.98,
    cardPress: 0.985,
  },
  opacity: {
    cardFrom: 0,
    cardTo: 1,
  },
  staggerMs: 60,
};

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function animateIn(
  value: Animated.Value,
  toValue: number,
  duration = motion.duration.normal,
  easing = motion.easing.easeOut,
  useNativeDriver = true,
) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver,
  });
}

function pressInOut(value: Animated.Value, pressed: boolean, pressScale = motion.scale.press) {
  return Animated.timing(value, {
    toValue: pressed ? pressScale : 1,
    duration: pressed ? motion.duration.fast : motion.duration.normal,
    easing: pressed ? Easing.linear : motion.easing.pressOut,
    useNativeDriver: true,
  });
}

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
      <View style={referenceSplashStyles.brandRow}>
        <Image
          source={require('./assets/icons/hope-icon-1024.png')}
          style={referenceSplashStyles.brandIcon}
          resizeMode="cover"
        />
        <View style={referenceSplashStyles.brandTextWrap}>
          <Text style={referenceSplashStyles.brandTitle} numberOfLines={1}>
            Hope
          </Text>
          <Text style={referenceSplashStyles.brandByline} numberOfLines={1}>
            by mrpotato
          </Text>
        </View>
      </View>
      <Text style={referenceSplashStyles.headline}>Pulling in good news for you</Text>

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
                backgroundColor: SPLASH_FACE_DARK,
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
                backgroundColor: SPLASH_FACE_DARK,
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
                stroke={SPLASH_FACE_DARK}
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
  brandRow: {
    position: 'absolute',
    top: SPLASH_BRAND_ROW_TOP,
    left: SPLASH_BRAND_ROW_LEFT,
    width: SPLASH_BRAND_ROW_W,
    height: SPLASH_BRAND_ROW_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: SPLASH_BRAND_GAP,
  },
  brandIcon: {
    width: SPLASH_BRAND_ICON_SIZE,
    height: SPLASH_BRAND_ICON_SIZE,
    borderRadius: 18,
  },
  brandTextWrap: {
    width: SPLASH_BRAND_TEXT_W,
    height: SPLASH_BRAND_TEXT_H,
    justifyContent: 'flex-start',
  },
  brandTitle: {
    color: '#000000',
    fontSize: 19.5,
    lineHeight: 27,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
  },
  brandByline: {
    color: '#000000',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
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
    fontFamily: fontSans.w400,
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
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [allStories, setAllStories] = useState<NewsItem[]>([]);
  const [visibleStoryCount, setVisibleStoryCount] = useState(initialVisibleStoryCount);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceReaderLoading, setSourceReaderLoading] = useState(false);
  const [seenStories, setSeenStories] = useState<Record<string, number>>({});
  const [, setDiagnostics] = useState<DiagnosticsMap>(createEmptyDiagnostics());
  const sourceLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const cardOpacityAnimsRef = useRef(new Map<string, Animated.Value>());
  const cardTranslateAnimsRef = useRef(new Map<string, Animated.Value>());
  const pressScaleAnimsRef = useRef(new Map<string, Animated.Value>());
  const prevVisibleUrlsRef = useRef<string[]>([]);
  const categoryModalOpacity = useRef(new Animated.Value(0)).current;
  const categoryModalTranslateY = useRef(new Animated.Value(motion.distance.modalEnterY)).current;
  const readerModalOpacity = useRef(new Animated.Value(0)).current;
  const readerModalTranslateY = useRef(new Animated.Value(motion.distance.modalEnterY)).current;

  const getPressScale = useCallback((key: string) => {
    const existing = pressScaleAnimsRef.current.get(key);
    if (existing) {
      return existing;
    }

    const created = new Animated.Value(1);
    pressScaleAnimsRef.current.set(key, created);
    return created;
  }, []);

  const setPressed = useCallback(
    (key: string, pressed: boolean, pressScale = motion.scale.press) => {
      const scaleValue = getPressScale(key);
      pressInOut(scaleValue, pressed, pressScale).start();
    },
    [getPressScale],
  );

  const getCardOpacity = useCallback((key: string) => {
    const existing = cardOpacityAnimsRef.current.get(key);
    if (existing) {
      return existing;
    }

    const created = new Animated.Value(motion.opacity.cardFrom);
    cardOpacityAnimsRef.current.set(key, created);
    return created;
  }, []);

  const getCardTranslateY = useCallback((key: string) => {
    const existing = cardTranslateAnimsRef.current.get(key);
    if (existing) {
      return existing;
    }

    const created = new Animated.Value(motion.distance.cardEnterY);
    cardTranslateAnimsRef.current.set(key, created);
    return created;
  }, []);

  const clearSourceLoadTimeout = useCallback(() => {
    if (!sourceLoadTimeoutRef.current) {
      return;
    }

    clearTimeout(sourceLoadTimeoutRef.current);
    sourceLoadTimeoutRef.current = null;
  }, []);

  const handleSourceLoadTimeout = useCallback(() => {
    setSourceReaderLoading(false);
    setSelectedNews(null);
    Alert.alert(
      'Unable to open source',
      'This story is taking too long to load. Please try another story or try again in a moment.',
    );
  }, []);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    locationContextRef.current = locationContext;
  }, [locationContext]);

  useEffect(() => {
    clearSourceLoadTimeout();

    if (selectedNews && sourceReaderLoading) {
      sourceLoadTimeoutRef.current = setTimeout(() => {
        handleSourceLoadTimeout();
      }, 10000);
    }

    return () => {
      clearSourceLoadTimeout();
    };
  }, [clearSourceLoadTimeout, handleSourceLoadTimeout, selectedNews, sourceReaderLoading]);

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
        if (!shouldReuseCache) {
          await saveStoriesCache(sanitizedStories);
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

  useEffect(() => {
    if (categoryPickerVisible) {
      categoryModalOpacity.setValue(0);
      categoryModalTranslateY.setValue(motion.distance.modalEnterY);
      Animated.parallel([
        animateIn(categoryModalOpacity, 1, motion.duration.modal, motion.easing.easeOut),
        animateIn(categoryModalTranslateY, 0, motion.duration.modal, motion.easing.easeOut),
      ]).start();
      return;
    }

    categoryModalOpacity.setValue(0);
    categoryModalTranslateY.setValue(motion.distance.modalEnterY);
  }, [categoryPickerVisible, categoryModalOpacity, categoryModalTranslateY]);

  useEffect(() => {
    if (selectedNews) {
      readerModalOpacity.setValue(0);
      readerModalTranslateY.setValue(motion.distance.modalEnterY);
      Animated.parallel([
        animateIn(readerModalOpacity, 1, motion.duration.modal, motion.easing.easeOut),
        animateIn(readerModalTranslateY, 0, motion.duration.modal, motion.easing.easeOut),
      ]).start();
      return;
    }

    readerModalOpacity.setValue(0);
    readerModalTranslateY.setValue(motion.distance.modalEnterY);
  }, [selectedNews, readerModalOpacity, readerModalTranslateY]);

  const availableStories = getStoriesForCategory(
    sanitizeStories(allStories).filter((story) => !seenStories[story.url]),
    activeCategory,
    locationContext,
  );
  const visibleStories = availableStories.slice(0, visibleStoryCount);
  const canLoadMore = visibleStoryCount < availableStories.length;

  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, 300],
    outputRange: [0, -motion.distance.heroScrollY],
    extrapolate: 'clamp',
  });
  const categoryTranslateY = scrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [0, -motion.distance.categoryScrollY],
    extrapolate: 'clamp',
  });
  const categoryOpacity = scrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });
  useEffect(() => {
    const previousUrls = prevVisibleUrlsRef.current;
    const previousSet = new Set(previousUrls);
    const nextUrls = visibleStories.map((story) => story.url);
    const anims: Animated.CompositeAnimation[] = [];

    nextUrls.forEach((url, index) => {
      const opacity = getCardOpacity(url);
      const translateY = getCardTranslateY(url);
      const isNew = !previousSet.has(url);

      if (isNew) {
        opacity.setValue(motion.opacity.cardFrom);
        translateY.setValue(motion.distance.cardEnterY);
      }

      anims.push(
        Animated.sequence([
          Animated.delay(index * motion.staggerMs),
          Animated.parallel([
            animateIn(opacity, motion.opacity.cardTo, motion.duration.card, motion.easing.easeOut),
            animateIn(translateY, 0, motion.duration.card, motion.easing.easeOut),
          ]),
        ]),
      );
    });

    if (anims.length > 0) {
      Animated.parallel(anims).start();
    }

    prevVisibleUrlsRef.current = nextUrls;
  }, [visibleStories, activeCategory, getCardOpacity, getCardTranslateY]);
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.shaderBackground}>
        <WebView
          originWhitelist={['*']}
          source={{ html: liquidShaderHtml }}
          style={styles.shaderWebView}
          containerStyle={styles.shaderWebView}
          javaScriptEnabled
          scrollEnabled={false}
          androidLayerType="hardware"
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          allowsLinkPreview={false}
          opaque={false}
        />
      </View>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />

        <AnimatedScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.accentPrimary}
              onRefresh={async () => {
                const nextContext = await detectLocation();
                await loadStories('refresh', nextContext);
              }}
            />
          }
        >
          <Animated.View style={[styles.heroCard, { transform: [{ translateY: heroTranslateY }] }]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.eyebrow}>{userLocation}</Text>
            </View>
            <Text style={styles.title}>Hope</Text>
            <Text style={styles.subtitle}>
              A daily dose of good in a noisy world
            </Text>
          </Animated.View>

          <Animated.View
            style={{ transform: [{ translateY: categoryTranslateY }], opacity: categoryOpacity }}
          >
            <Pressable
              style={styles.categoryDropdown}
              onPressIn={() => setPressed('category-dropdown', true)}
              onPressOut={() => setPressed('category-dropdown', false)}
              onPress={() => setCategoryPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Category, ${activeCategory}. Opens list.`}
            >
              <Animated.View
                style={[
                  styles.categoryDropdownInner,
                  { transform: [{ scale: getPressScale('category-dropdown') }] },
                ]}
              >
                <Text style={styles.categoryDropdownLabel}>{activeCategory}</Text>
                <View style={styles.categoryDropdownChevronWrap}>
                  <Svg width={12} height={8} viewBox="0 0 12 8" accessibilityElementsHidden>
                    <Path
                      d="M1 2 L6 6.5 L11 2"
                      stroke={theme.textMeta}
                      strokeWidth={1.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Live feed unavailable</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!loading && !error ? (
            <View style={styles.storyList}>
              {visibleStories.map((story) => (
                <Animated.View
                  key={story.url}
                  style={{
                    opacity: getCardOpacity(story.url),
                    transform: [
                      { translateY: getCardTranslateY(story.url) },
                      { scale: getPressScale(`story:${story.url}`) },
                    ],
                  }}
                >
                  <Pressable
                    style={styles.storyCard}
                    onPressIn={() => setPressed(`story:${story.url}`, true, motion.scale.cardPress)}
                    onPressOut={() => setPressed(`story:${story.url}`, false, motion.scale.cardPress)}
                    onPress={async () => {
                      setSourceReaderLoading(true);
                      setSelectedNews(story);
                      void markStorySeen(story.url);
                    }}
                  >
                    <View style={styles.storyVisualFallback}>
                      <Text style={styles.storyVisualHeadline}>{story.title}</Text>
                      <Text style={styles.storyVisualSource}>{story.source}</Text>
                    </View>

                    <View style={styles.storyBody}>
                      <Text style={styles.storyDescription}>{story.description}</Text>

                      <View style={styles.storyCardFooter}>
                        <Text style={styles.storyCategory} numberOfLines={1}>
                          {story.category}
                        </Text>
                        <Text style={styles.storyTime} numberOfLines={1}>
                          {story.time}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}

              {canLoadMore ? (
                <Pressable
                  style={styles.loadMoreButton}
                  onPressIn={() => setPressed('load-more', true)}
                  onPressOut={() => setPressed('load-more', false)}
                  onPress={() =>
                    setVisibleStoryCount((current) =>
                      Math.min(current + loadMoreBatchSize, availableStories.length),
                    )
                  }
                >
                  <Animated.Text
                    style={[styles.loadMoreButtonText, { transform: [{ scale: getPressScale('load-more') }] }]}
                  >
                    Load more
                  </Animated.Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </AnimatedScrollView>

        {loading || refreshing ? <ReferenceSplashOverlay fontsReady={splashFontsReady} /> : null}

        <Modal
          visible={categoryPickerVisible}
          transparent
          animationType="none"
          onRequestClose={() => setCategoryPickerVisible(false)}
        >
          <View style={styles.categoryPickerRoot}>
            <Animated.View
              style={[
                styles.categoryPickerBackdrop,
                { opacity: categoryModalOpacity },
              ]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPressIn={() => setPressed('category-backdrop', true)}
                onPressOut={() => setPressed('category-backdrop', false)}
                onPress={() => setCategoryPickerVisible(false)}
                accessibilityLabel="Dismiss category list"
              />
            </Animated.View>
            <Animated.View
              style={[
                styles.categoryPickerSheet,
                {
                  opacity: categoryModalOpacity,
                  transform: [
                    { translateY: categoryModalTranslateY },
                    { scale: getPressScale('category-backdrop') },
                  ],
                },
              ]}
            >
              {categories.map((category) => (
                <Pressable
                  key={category}
                  onPressIn={() => setPressed(`category-row:${category}`, true)}
                  onPressOut={() => setPressed(`category-row:${category}`, false)}
                  onPress={() => {
                    setActiveCategory(category);
                    setCategoryPickerVisible(false);
                  }}
                  style={[
                    styles.categoryPickerRow,
                    category === activeCategory && styles.categoryPickerRowActive,
                  ]}
                >
                  <Animated.View
                    style={{ transform: [{ scale: getPressScale(`category-row:${category}`) }] }}
                  >
                    <Text
                      style={[
                        styles.categoryPickerRowText,
                        category === activeCategory && styles.categoryPickerRowTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </Animated.View>
                </Pressable>
              ))}
            </Animated.View>
          </View>
        </Modal>

        <Modal
          visible={selectedNews !== null}
          animationType="none"
          presentationStyle="fullScreen"
          onRequestClose={() => {
            clearSourceLoadTimeout();
            setSourceReaderLoading(false);
            setSelectedNews(null);
          }}
        >
          <Animated.View
            style={[
              styles.modalScreen,
              {
                opacity: readerModalOpacity,
                transform: [{ translateY: readerModalTranslateY }],
              },
            ]}
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
                    onPressIn={() => setPressed('reader-close', true)}
                    onPressOut={() => setPressed('reader-close', false)}
                    onPress={() => setSelectedNews(null)}
                  >
                    <Animated.Text
                      style={[
                        styles.readerCloseButtonText,
                        { transform: [{ scale: getPressScale('reader-close') }] },
                      ]}
                    >
                      Done
                    </Animated.Text>
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
                  onLoadEnd={() => {
                    clearSourceLoadTimeout();
                    setSourceReaderLoading(false);
                  }}
                  style={styles.readerWebView}
                />
              </View>
            ) : null}
            </SafeAreaView>
          </Animated.View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.backgroundTop,
  },
  shaderBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: liquidGradient.color2,
  },
  shaderWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: theme.surfacePrimary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
    shadowColor: theme.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  eyebrow: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
  },
  title: {
    color: theme.heroTitle,
    fontSize: 32,
    lineHeight: 44,
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
    marginTop: 10,
    marginBottom: 6,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
    marginBottom: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  categoryDropdown: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: theme.textMeta,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  categoryDropdownInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryDropdownLabel: {
    color: theme.textMeta,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  categoryDropdownChevronWrap: {
    height: 19,
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPickerRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  categoryPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.surfaceOverlay,
  },
  categoryPickerSheet: {
    backgroundColor: theme.surfaceSecondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 8,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.borderSoft,
  },
  categoryPickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  categoryPickerRowActive: {
    backgroundColor: alpha(theme.textMeta, 0.12),
  },
  categoryPickerRowText: {
    color: theme.textPrimary,
    fontSize: 16,
    fontFamily: fontSans.w400,
    fontWeight: 'normal',
  },
  categoryPickerRowTextActive: {
    fontFamily: fontSans.w600,
    color: theme.accentPrimary,
  },
  errorCard: {
    backgroundColor: theme.surfaceError,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
  },
  errorTitle: {
    color: theme.textSecondary,
    fontSize: 16,
    fontFamily: fontSans.w600,
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
    marginTop: 0,
    gap: 20,
  },
  storyCard: {
    flexDirection: 'column',
    backgroundColor: theme.surfaceSecondary,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  storyVisualFallback: {
    backgroundColor: theme.surfaceHeader,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'flex-start',
    gap: 16,
  },
  storyVisualHeadline: {
    color: theme.textPrimary,
    fontSize: 16,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
    lineHeight: 22,
  },
  storyVisualSource: {
    color: theme.textMeta,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
  },
  storyBody: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.borderSoft,
  },
  storyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 0,
  },
  storyCategory: {
    color: theme.textMeta,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
    flexShrink: 1,
    marginRight: 8,
  },
  storyTime: {
    color: theme.textTimestamp,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
    flexShrink: 0,
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
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
  },
  storyDescription: {
    color: theme.textMeta,
    fontSize: 14,
    lineHeight: 19,
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
    color: theme.textSecondary,
    fontSize: 12,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
    marginBottom: 4,
  },
  readerTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
  },
  readerSubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 19,
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
    fontFamily: fontSans.w600,
    fontWeight: 'normal',
    fontSize: 15,
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
    color: theme.textMeta,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
  },
  readerMetaDot: {
    color: theme.textMeta,
    fontSize: 12,
    fontFamily: fontSans.w500,
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
    fontFamily: fontSans.w500,
    fontWeight: 'normal',
  },
});
