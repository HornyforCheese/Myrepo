export type LocalVideoOptions = {
  title: string;
  directory: false;
  multiple: false;
  filters: { name: string; extensions: string[] }[];
};

/** Keep native filesystem paths intact when handing them to the existing player. */
export async function chooseLocalVideo(
  pick: (options: LocalVideoOptions) => Promise<string | string[] | null>,
  play: (path: string) => void,
): Promise<boolean> {
  const selected = await pick({
    title: "Open local video",
    directory: false,
    multiple: false,
    filters: [{ name: "Video files", extensions: ["mp4", "mkv", "webm", "mov", "avi", "m4v", "wmv", "mpg", "mpeg", "ts", "m2ts", "mts", "3gp", "ogv"] }],
  });
  if (typeof selected !== "string" || !selected.trim()) return false;
  play(selected);
  return true;
}
