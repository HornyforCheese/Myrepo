import type { Addon } from "@/lib/addons";

/** Adds account collections only after the user explicitly selects combined mode. */
export async function combinedAccountAddons(enabled?: boolean): Promise<Addon[]> {
  if (enabled === undefined) {
    try {
      const state = JSON.parse(localStorage.getItem("harbor.profiles.v1") || "{}");
      const id = typeof state.activeId === "string" ? state.activeId : "default";
      const profile = Array.isArray(state.profiles) ? state.profiles.find((p: { id?: string }) => p.id === id) : null;
      const { loadEffective } = await import("@/lib/settings/profile-store");
      enabled = loadEffective(id, profile?.settingsLinked !== false).nuvioAddonMode === "combined";
    } catch { enabled = false; }
  }
  if (!enabled) return [];
  const [{ readPrimaryStremioSession }, { userAddons }, { fetchManifestAt, filterEnabled }, nuvio, sync] = await Promise.all([
    import("@/lib/auth"), import("@/lib/addons"), import("@/lib/addon-store"),
    import("@/lib/nuvio/nuvio-client"), import("@/lib/nuvio/nuvio-sync"),
  ]);
  const key = readPrimaryStremioSession()?.authKey;
  const [stremio, items] = await Promise.all([
    key ? userAddons(key).catch(() => [] as Addon[]) : Promise.resolve([] as Addon[]),
    nuvio.isNuvioSignedIn() ? sync.pullAddonsFromNuvio(`nuvio-${nuvio.loadNuvioState().activeProfileIndex || 1}`) : Promise.resolve([]),
  ]);
  const found: Addon[] = [...stremio];
  const queue = items.slice(0, 200);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      try {
        const manifest = await fetchManifestAt(item.url);
        found.push({ transportUrl: item.url, manifest });
      } catch { /* One unavailable manifest must not discard other account sources. */ }
    }
  }));
  return filterEnabled(found).filter((addon, index, all) => all.findIndex(other => other.transportUrl === addon.transportUrl) === index);
}
