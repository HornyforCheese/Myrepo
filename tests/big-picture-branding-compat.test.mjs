import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandBigPictureIntro, brandBigPictureBoot } from '../tools/big-picture-branding-compat.mjs';
const source = `import { CustomArtwork } from "@/components/custom-artwork";
function BpIntro() { return <CustomArtwork role="launch" className="h-[min(22vh,200px)] w-[min(24vw,200px)]" fallback={<BpIntroMark settled={handoff.current} />} />; }
// The logo animation is 161 frames.
function BpIntroStaticMark() { return <svg><path d="legacy-logo" /></svg>; }
function BpIntroMark() { return import("@/assets/harbor-lottie.json"); }
function BpIntroSpinner() { return <span>spinner</span>; }
`;
test('Big Picture replaces animated and static legacy artwork and bypasses stored launch overrides', () => {
  const result = brandBigPictureIntro(source);
  assert.ok(result.includes('src="/mutiny-mark.png"'));
  assert.ok(result.includes('>MUTINY MEDIA</span>'));
  assert.ok(result.includes('settled ? ""'));
  assert.ok(result.includes('motion-reduce:[animation:none]'));
  assert.ok(result.includes('<BpIntroMark settled={handoff.current} />'));
  assert.ok(result.includes('function BpIntroSpinner() { return <span>spinner</span>; }'));
  assert.ok(!result.includes('harbor-lottie.json'));
  assert.ok(!result.includes('legacy-logo'));
  assert.ok(!result.includes('CustomArtwork'));
  assert.equal(brandBigPictureIntro(result),result);
});
test('Big Picture branding refuses unfamiliar or duplicate layouts', () => {
  assert.throws(()=>brandBigPictureIntro(source.replace('// The logo animation is 161 frames.','// unknown')));
  assert.throws(()=>brandBigPictureIntro(source+source));
});
test('early TV boot matches the product mark and preserves boot state and saved keys', () => {
  const html = '<div id="boot"><svg class="boot-mark"><path d="legacy" /></svg><span class="boot-spin">spinner</span></div><script>localStorage.getItem("harbor.custom-artwork.v1"); if (art && valid) replaceMark();</script>';
  const result=brandBigPictureBoot(html);
  assert.ok(result.includes('id="boot"'));
  assert.ok(result.includes('class="boot-spin"'));
  assert.ok(result.includes('src="/mutiny-mark.png"'));
  assert.ok(result.includes('harbor.custom-artwork.v1'));
  assert.ok(result.includes('if (false && art &&'));
  assert.ok(!result.includes('<svg'));
  assert.equal(brandBigPictureBoot(result),result);
  assert.throws(()=>brandBigPictureBoot(html+html));
});
