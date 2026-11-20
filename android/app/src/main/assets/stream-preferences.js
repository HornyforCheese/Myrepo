function description(stream) {
  return [stream?.name, stream?.title, stream?.description].filter(value => typeof value === 'string').join(' ');
}

export function animeStreamTags(stream) {
  const label = description(stream);
  const dual = /\bdual[ ._-]*audio\b/i.test(label) && !/\b(?:no|not|without)[ ._-]+dual[ ._-]*audio\b/i.test(label);
  const english = /\b(?:eng(?:lish)?[ ._-]*(?:dub(?:bed)?|audio)|dubbed[ ._-]*english)\b/i.test(label)
    && !/\b(?:no|not|without)[ ._-]+(?:eng(?:lish)?[ ._-]*(?:dub(?:bed)?|audio)|dubbed[ ._-]*english)\b/i.test(label);
  const japanese = /\b(?:japanese|jpn)[ ._-]*(?:audio|dub)\b/i.test(label)
    && !/\b(?:no|not|without)[ ._-]+(?:japanese|jpn)[ ._-]*(?:audio|dub)\b/i.test(label);
  const subtitles = /\b(?:eng(?:lish)?[ ._-]*(?:sub(?:s|bed|titles?)?)|subbed|subtitles?)\b/i.test(label)
    && !/\b(?:no|not|without)[ ._-]+(?:eng(?:lish)?[ ._-]*(?:sub(?:s|bed|titles?)?)|subbed|subtitles?)\b/i.test(label);
  const dub = english;
  const sub = japanese && subtitles;
  const uncensored = /\buncensored\b/i.test(label) && !/\bnot[ ._-]+uncensored\b/i.test(label);
  return {dub, sub, dual, uncensored, audioKnown:english || japanese || dual,
    releaseKnown:uncensored || /\bcensored\b/i.test(label)};
}

export function animeStreamMatch(stream, preferences) {
  const tags = animeStreamTags(stream);
  const audio = preferences.animeAudio || 'any';
  const matches = (audio === 'any' || tags[audio] === true) &&
    (preferences.animeRelease !== 'uncensored' || tags.uncensored);
  return {matches, tags};
}

export function rankStreams(rows, preferences) {
  const preferred = preferences.lowBandwidth ? 480 : Number(preferences.quality);
  if (![480,720,1080,2160].includes(preferred)) return rows;
  function score({stream}) {
    const label = description(stream);
    const match = label.match(/\b(360|480|576|720|1080|1440|2160)p\b/i);
    const height = match ? Number(match[1]) : /\b4k\b/i.test(label) ? 2160 : 0;
    if (!height) return Infinity;
    return height <= preferred ? preferred - height : 3000 + height - preferred;
  }
  return rows.slice().sort((a,b) => score(a) - score(b));
}
