/** Replace graphical startup branding that cannot be found by a UI text scan. */
export function brandBigPictureIntro(source) {
  if (source.includes('// MUTINY_BIG_PICTURE_BRANDING')) {
    if (!source.includes('src="/mutiny-mark.png"') || source.includes('harbor-lottie.json')) throw Error('Incomplete Big Picture branding');
    return source;
  }
  const start = '// The logo animation is 161 frames.';
  const end = 'function BpIntroSpinner';
  const artwork = '<CustomArtwork role="launch" className="h-[min(22vh,200px)] w-[min(24vw,200px)]" fallback={<BpIntroMark settled={handoff.current} />} />';
  for (const anchor of [start, end, artwork, 'import { CustomArtwork } from "@/components/custom-artwork";']) {
    if (source.split(anchor).length !== 2) throw Error('Unknown Big Picture intro layout: '+anchor);
  }
  const from = source.indexOf(start), to = source.indexOf(end);
  if (to <= from) throw Error('Invalid Big Picture intro order');
  const mark = `// MUTINY_BIG_PICTURE_BRANDING
// Big Picture uses its own intro rather than the desktop boot page. Always
// show the supplied product mark here, including the settled/reduced-motion
// path, instead of loading the upstream graphical wordmark or saved launch art.
function BpIntroMark({ settled }: { settled: boolean }) {
  return (
    <div className={\`flex flex-col items-center gap-5 \${settled ? "" : "[animation:bp-intro-mark_1200ms_var(--bp-ease)_both] motion-reduce:[animation:none]"}\`}>
      <img src="/mutiny-mark.png" alt="Mutiny Media" draggable={false}
        className="h-[min(22vh,200px)] w-[min(24vw,200px)] object-contain" />
      <span className="font-display text-[clamp(18px,2.4vw,32px)] font-semibold tracking-[0.18em] text-ink">MUTINY MEDIA</span>
    </div>
  );
}

`;
  return (source.slice(0, from) + mark + source.slice(to))
    .replace('import { CustomArtwork } from "@/components/custom-artwork";\n', '')
    .replace(artwork, '<BpIntroMark settled={handoff.current} />');
}

export function brandBigPictureBoot(source) {
  if (source.includes('data-mutiny-bp-boot')) return source;
  const pattern = /<svg\b(?=[^>]*\bclass="boot-mark")[^>]*>[\s\S]*?<\/svg>/g;
  if ([...source.matchAll(pattern)].length !== 1) throw Error('Unknown Big Picture boot mark');
  return source.replace(pattern, '<img class="boot-mark" data-mutiny-bp-boot src="/mutiny-mark.png" alt="Mutiny Media" style="object-fit:contain" />')
    .replace('if (art &&', 'if (false && art &&');
}
