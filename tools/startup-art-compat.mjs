/** Replace the actual boot mark while preserving boot IDs, cache keys and startup scripts. */
export function repairStartupArt(source) {
  const boot = '<div id="harbor-boot">';
  if (source.split(boot).length !== 2) throw Error('Expected one Windows 1.0.1 boot container');
  const pattern = /(<div id="harbor-boot">\s*)(<svg\b[^>]*>[\s\S]*?<\/svg>|<img\b(?=[^>]*\bclass="mutiny-boot-mark")[^>]*\/?>)/g;
  if ([...source.matchAll(pattern)].length !== 1) throw Error('Unknown Windows startup mark');
  return source.replace(pattern, '$1<img class="mutiny-boot-mark" src="/mutiny-mark.png" alt="Mutiny Media startup art" />')
    .replace(/<title>[^<]*<\/title>/, '<title>Mutiny Media</title>')
    .replaceAll('#harbor-boot > svg', '#harbor-boot > .mutiny-boot-mark')
    .replace('if (art &&', 'if (false && art &&');
}
