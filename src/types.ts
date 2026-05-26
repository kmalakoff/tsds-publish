export type HasChangedResult = { changed: boolean; reason: string };
export type HasChangedCallback = (error?: Error | null, result?: HasChangedResult) => void;
