/** Keep Nuvio hooks unconditional across the archived and pinned Windows 1.0.1 layouts. */
export function repairNuvioHookOrder(source) {
  const marker = '// Mutiny hooks order fix';
  if (source.includes(marker)) return source;
  const state = '  const state = loadNuvioState();';
  const settings = '  const { settings, update } = useSettings();';
  const occurrences = (text, needle) => text.split(needle).length - 1;
  if (occurrences(source, state) !== 1) throw Error('Ambiguous Nuvio state anchor');
  if (occurrences(source, settings) === 1) {
    const conditional = settings + '\n  const addonMode';
    if (occurrences(source, conditional) !== 1 || source.indexOf(settings) < source.indexOf(state)) {
      throw Error('Unrecognized Nuvio conditional settings hook');
    }
    return source.replace(conditional, '  ' + marker + '\n  const addonMode')
      .replace(state, settings + '\n' + state);
  }
  // The exact upstream 1.0.1 card has no settings hook or addon-mode setting.
  // Verify its actual connected-state layout, preserving all existing React hooks.
  if (/\buseSettings\s*\(|\baddonMode\b|settings\.nuvioAddonMode/.test(source)
      || !source.includes('export function NuvioSyncedAddonsCard() {')
      || !source.includes('  const isConnected = state.session != null;')
      || !source.includes('  if (!isConnected) {')
      || source.indexOf('  if (!isConnected) {') < source.indexOf('  useEffect(() => {')) {
    throw Error('Unrecognized pinned Nuvio card; refusing to guess');
  }
  return source.replace(state, '  ' + marker + ': pinned 1.0.1 has no conditional settings hook.\n' + state);
}
