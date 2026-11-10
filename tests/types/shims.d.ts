declare module "react" {
  export type ReactNode = unknown;
  export function useMemo<T>(callback:()=>T, deps:readonly unknown[]):T;
  export function useEffect(callback:()=>void | (()=>void),deps?:readonly unknown[]):void;
  export function useState<T>(initial:T | (()=>T)): [T,(update:T|((old:T)=>T))=>void];
}
declare module "react/jsx-runtime" {
  export const jsx: (...args:any[])=>any;
  export const jsxs: (...args:any[])=>any;
  export const Fragment: any;
}
declare module "lucide-react" {
  export const ChevronLeft: any;
  export const ChevronDown: any;
  export const Globe2: any;
  export const Play: any;
  export const Puzzle: any;
  export const ShieldCheck: any;
  export const SlidersHorizontal: any;
  export const X: any;
}
declare module "@/lib/view" {
  export type PlayEpisode={season:number;episode:number;imdbSeason?:number;imdbEpisode?:number;absoluteNumber?:number};
  export function useView():{exitPickerToDetail(meta:any):void};
}
declare module "@/lib/cinemeta" {
  export type Meta={id:string;name:string;type:string;malId?:number;animeFormat?:string};
}
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any; }
}

declare module "@/lib/settings" {
  export function useSettings(): {settings: { tmdbKey?: string }};
}
declare module "@/views/play-picker/use-imdb-id" {
  export function useImdbId(meta: import("@/lib/cinemeta").Meta, tmdbKey: string | undefined): {id: string | null; verified: boolean};
}
