from pathlib import Path

path = Path("pwa/app/QuranHeaderSearchEnhancer.tsx")
text = path.read_text()

old = '''    const isVisibleVerseNode = (node: HTMLElement) => {\n      const style = window.getComputedStyle(node);\n      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;\n      const rect = node.getBoundingClientRect();\n      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;\n    };'''
new = '''    const isRenderedVerseNode = (node: HTMLElement) => {\n      const style = window.getComputedStyle(node);\n      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;\n      const rect = node.getBoundingClientRect();\n      return rect.width > 0 && rect.height > 0;\n    };'''
if old not in text:
    raise SystemExit("visibility helper target not found")
text = text.replace(old, new, 1)
text = text.replace('isVisibleVerseNode(node))\n        || matches.find(isVisibleVerseNode)', 'isRenderedVerseNode(node))\n        || matches.find(isRenderedVerseNode)', 1)
text = text.replace('const local = localNodes.find(isVisibleVerseNode) || localNodes[0];', 'const local = localNodes.find(isRenderedVerseNode) || localNodes[0];', 1)
path.write_text(text)
