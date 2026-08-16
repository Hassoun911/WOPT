from pathlib import Path

path = Path("pwa/app/QuranAudioSystem.tsx")
text = path.read_text()

old_clear = '''    const clearHighlight = () => document.querySelectorAll(".wopt-audio2-follow").forEach((node) => node.classList.remove("wopt-audio2-follow"));'''
new_clear = '''    const clearHighlight = () => {
      document.querySelectorAll<HTMLElement>("[data-wopt-audio-highlight='true']").forEach((node) => {
        node.classList.remove("wopt-audio2-follow");
        node.removeAttribute("data-wopt-audio-highlight");
        node.style.removeProperty("background-color");
        node.style.removeProperty("box-shadow");
        node.style.removeProperty("border-radius");
      });
      document.querySelectorAll<HTMLElement>("[data-wopt-audio-highlight-child='true']").forEach((node) => {
        node.removeAttribute("data-wopt-audio-highlight-child");
        node.style.removeProperty("background-color");
        node.style.removeProperty("border-color");
        node.style.removeProperty("border-radius");
        node.style.removeProperty("color");
      });
    };

    const paintHighlight = (target: HTMLElement) => {
      target.classList.add("wopt-audio2-follow");
      target.dataset.woptAudioHighlight = "true";
      target.style.setProperty("background-color", "rgba(24, 156, 122, .24)", "important");
      target.style.setProperty("box-shadow", "0 0 0 4px rgba(24, 156, 122, .14)", "important");
      target.style.setProperty("border-radius", "7px", "important");
      target.querySelectorAll<HTMLElement>(".quran-word").forEach((word) => {
        word.dataset.woptAudioHighlightChild = "true";
        word.style.setProperty("background-color", "rgba(24, 156, 122, .18)", "important");
        word.style.setProperty("border-radius", "5px", "important");
      });
      target.querySelectorAll<HTMLElement>(".ayah-marker,.wopt-printed-marker").forEach((marker) => {
        marker.dataset.woptAudioHighlightChild = "true";
        marker.style.setProperty("background-color", "#147a64", "important");
        marker.style.setProperty("border-color", "#147a64", "important");
        marker.style.setProperty("color", "#fff", "important");
      });
    };'''

old_sort = '''      }).sort((a, b) => Number(b.printed) - Number(a.printed) || Number(b.visible) - Number(a.visible) || b.overlap - a.overlap || a.centerDistance - b.centerDistance);'''
new_sort = '''      }).sort((a, b) => Number(b.visible) - Number(a.visible) || Number(b.printed) - Number(a.printed) || b.overlap - a.overlap || a.centerDistance - b.centerDistance);'''

old_targets = '''      const visibleMatches = nodesForKey(key).filter((candidate) => Boolean(candidate.closest(".wopt-printed-reader")) && isVisible(candidate));
      const targets = visibleMatches.length ? visibleMatches : [node];
      targets.forEach((target) => target.classList.add("wopt-audio2-follow"));'''
new_targets = '''      const visibleMatches = nodesForKey(key).filter(isVisible);
      const targets = visibleMatches.length ? visibleMatches : [node];
      targets.forEach(paintHighlight);'''

for old, new, label in [
    (old_clear, new_clear, "clearHighlight"),
    (old_sort, new_sort, "bestNode sort"),
    (old_targets, new_targets, "highlight targets"),
]:
    if old not in text:
        raise SystemExit(f"{label} target not found")
    text = text.replace(old, new, 1)

path.write_text(text)
