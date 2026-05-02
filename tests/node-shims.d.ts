declare module 'fs';
declare module 'node:child_process';
declare module 'node:util';
declare module 'path';

declare const process: {
	cwd(): string;
	env: Record<string, string | undefined>;
};
