export type HasChangedResult = { changed: boolean; reason: string };
export type HasChangedCallback = (error?: Error | null, result?: HasChangedResult) => void;
export type ParsedArgs = { version: string; yolo: boolean; dryRun: boolean; publishArgs: string[] };
