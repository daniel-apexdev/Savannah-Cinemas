import * as WebBrowser from 'expo-web-browser';
import { createElement, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { colors, space } from '@/theme';

import { Button, IconButton } from './controls';
import { CloseIcon } from './icons';
import { Body, Display, Label } from './type';

/** YouTube id from watch?v=, youtu.be/, /embed/ or /shorts/ links. */
export function youTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|v)\/([\w-]{11})/);
  return m ? m[1] : null;
}

// YouTube refuses embeds that arrive with no page origin (error 152/153),
// so the player is served from a small HTML page with a real https origin.
const ORIGIN = 'https://savannahcinemas.app';

function playerHtml(id: string) {
  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(ORIGIN)}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
<body><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
}

/**
 * Trailer in a modal over the current screen: black stage, 16:9 player,
 * the film's title in a marquee line, close top-right. Non-YouTube links
 * (or a player that fails) fall back to opening the link.
 */
export function TrailerModal({
  url,
  title,
  visible,
  onClose,
}: {
  url?: string | null;
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const id = youTubeId(url);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Fit 16:9 inside the screen (portrait: full width; landscape: full height)
  const maxW = Math.min(width, 960);
  const playerW = Math.min(maxW, Math.round((height - insets.top - insets.bottom - 140) * (16 / 9)));
  const playerH = Math.round(playerW * (9 / 16));

  const openOutside = () => {
    if (url) WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
      onShow={() => {
        setLoading(true);
        setFailed(false);
      }}>
      <View style={[styles.stage, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close trailer" />

        <View style={[styles.bar, { width: playerW }]}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Label color={colors.laterite}>TRAILER</Label>
            <Display size={24} numberOfLines={1}>
              {title}
            </Display>
          </View>
          <IconButton label="Close trailer" onPress={onClose} style={styles.close}>
            <CloseIcon />
          </IconButton>
        </View>

        <View style={{ width: playerW, height: playerH, backgroundColor: '#000' }}>
          {!id || failed ? (
            <View style={styles.center}>
              <Body color={colors.boneSoft} style={{ textAlign: 'center' }}>
                {id ? 'The trailer couldn’t play here.' : 'This trailer isn’t on YouTube.'}
              </Body>
              {url ? <Button label="Open trailer" variant="outline" onPress={openOutside} /> : null}
            </View>
          ) : Platform.OS === 'web' ? (
            createElement('iframe', {
              src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`,
              allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
              allowFullScreen: true,
              title: `${title} trailer`,
              style: { width: '100%', height: '100%', border: 0 },
              onLoad: () => setLoading(false),
            })
          ) : (
            <WebView
              source={{ html: playerHtml(id), baseUrl: ORIGIN }}
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              setSupportMultipleWindows={false}
              onLoadEnd={() => setLoading(false)}
              onError={() => setFailed(true)}
              onHttpError={() => setFailed(true)}
              // Keep taps on the player; links out open in the browser
              onShouldStartLoadWithRequest={(req) => {
                const ok =
                  req.url.startsWith('about:') ||
                  req.url.startsWith(ORIGIN) ||
                  /youtube(-nocookie)?\.com\/embed\//.test(req.url) ||
                  !req.isTopFrame;
                if (!ok) WebBrowser.openBrowserAsync(req.url).catch(() => {});
                return ok;
              }}
            />
          )}
          {loading && id && !failed ? (
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <ActivityIndicator color={colors.bone} />
            </View>
          ) : null}
        </View>

        {id && !failed ? (
          <Pressable accessibilityRole="button" onPress={openOutside} style={{ height: 44, justifyContent: 'center', marginTop: 8 }}>
            <Label>NOT PLAYING? OPEN IN YOUTUBE</Label>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: 'rgba(6,5,4,0.96)', alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: space.gutter, marginBottom: 12 },
  close: { borderWidth: 1.5, borderColor: colors.rule },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: space.gutter },
});
