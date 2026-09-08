from pathlib import Path
import re
import subprocess

# YouTube watch/short/share URLs are web pages, not direct media streams. Install the
# native WebView used to render YouTube's embeddable player behind the prayer UI.
subprocess.run(['npx', 'expo', 'install', 'react-native-webview', '--npm'], cwd='mobile', check=True)

page_path = Path('mobile/src/MasjidDisplayPage.tsx')
page = page_path.read_text(encoding='utf-8')

if 'from "react-native-webview"' not in page:
    import_anchor = 'import { useVideoPlayer, VideoView } from "expo-video";\n'
    if import_anchor not in page:
        raise SystemExit('YouTube background patch: expo-video import missing')
    page = page.replace(import_anchor, import_anchor + 'import { WebView } from "react-native-webview";\n', 1)

helper_anchor = 'function humanLeft(seconds: number) {\n'
if 'function youtubeVideoId(' not in page:
    helper = '''function youtubeVideoId(raw: string) {\n  const value = String(raw || "").trim();\n  if (!value) return "";\n  const patterns = [\n    /(?:youtube\\.com\\/watch\\?[^#]*v=)([A-Za-z0-9_-]{11})/,\n    /(?:youtu\\.be\\/)([A-Za-z0-9_-]{11})/,\n    /(?:youtube\\.com\\/shorts\\/)([A-Za-z0-9_-]{11})/,\n    /(?:youtube\\.com\\/embed\\/)([A-Za-z0-9_-]{11})/,\n  ];\n  for (const pattern of patterns) {\n    const match = value.match(pattern);\n    if (match?.[1]) return match[1];\n  }\n  return "";\n}\n\n'''
    if helper_anchor not in page:
        raise SystemExit('YouTube background patch: helper anchor missing')
    page = page.replace(helper_anchor, helper + helper_anchor, 1)

video_decl = '  const backgroundVideoUrl = typeof remoteTheme.backgroundVideoUrl === "string" ? remoteTheme.backgroundVideoUrl.trim() : "";\n'
if video_decl not in page:
    raise SystemExit('YouTube background patch: backgroundVideoUrl declaration missing')
if 'const backgroundYouTubeId =' not in page:
    insert = '''  const backgroundYouTubeId = youtubeVideoId(backgroundVideoUrl);\n  const backgroundYouTubeUrl = backgroundYouTubeId ? `https://www.youtube.com/embed/${backgroundYouTubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${backgroundYouTubeId}&playsinline=1&rel=0&modestbranding=1` : "";\n'''
    page = page.replace(video_decl, video_decl + insert, 1)

old_player = '  const backgroundPlayer = useVideoPlayer(backgroundMode === "video" && backgroundVideoUrl ? backgroundVideoUrl : null, player => { player.loop = true; player.muted = true; if (backgroundVideoUrl) player.play(); });\n'
new_player = '  const backgroundPlayer = useVideoPlayer(backgroundMode === "video" && backgroundVideoUrl && !backgroundYouTubeId ? backgroundVideoUrl : null, player => { player.loop = true; player.muted = true; if (backgroundVideoUrl && !backgroundYouTubeId) player.play(); });\n'
if old_player in page:
    page = page.replace(old_player, new_player, 1)
elif new_player not in page:
    raise SystemExit('YouTube background patch: background player declaration missing')

video_layer = '        {backgroundMode === "video" && backgroundVideoUrl ? <VideoView player={backgroundPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : null}\n'
youtube_layer = '''        {backgroundMode === "video" && backgroundYouTubeUrl ? <WebView source={{ uri: backgroundYouTubeUrl }} style={StyleSheet.absoluteFill} javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} scrollEnabled={false} bounces={false} pointerEvents="none" /> : null}\n        {backgroundMode === "video" && backgroundVideoUrl && !backgroundYouTubeId ? <VideoView player={backgroundPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} /> : null}\n'''
if video_layer in page:
    page = page.replace(video_layer, youtube_layer, 1)
elif 'backgroundYouTubeUrl ? <WebView' not in page:
    raise SystemExit('YouTube background patch: background video layer missing')

for marker in ['youtubeVideoId(', 'backgroundYouTubeId', 'backgroundYouTubeUrl', 'react-native-webview', 'mediaPlaybackRequiresUserAction={false}']:
    if marker not in page:
        raise SystemExit(f'YouTube background patch missing marker: {marker}')
page_path.write_text(page, encoding='utf-8')

controller_path = Path('mobile/src/ConnectDisplayPage.tsx')
controller = controller_path.read_text(encoding='utf-8')
old_help = 'Use a direct MP4/video URL. The tablet loops it silently behind the prayer display.'
new_help = 'Paste a YouTube link (watch, youtu.be, Shorts) or a direct MP4/video URL. It plays silently and loops behind the prayer display.'
if old_help in controller:
    controller = controller.replace(old_help, new_help, 1)
elif new_help not in controller:
    raise SystemExit('YouTube background patch: video URL help text missing')
controller_path.write_text(controller, encoding='utf-8')

print('HASSOUN_TABLET_YOUTUBE_BACKGROUND_V1 applied: YouTube/direct video URL backgrounds supported')
