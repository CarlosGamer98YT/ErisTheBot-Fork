export function decode(chunk: Uint8Array): { keyword: string; text: string };
export function encode(keyword: string, text: string): Uint8Array;
