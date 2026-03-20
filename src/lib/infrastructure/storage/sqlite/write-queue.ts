export interface SqliteWriteQueue {
	enqueue<T>(operation: () => Promise<T>, onSuccess?: (result: T) => void): void;
	flush(): Promise<void>;
}

export function createSqliteWriteQueue(onError: (error: unknown) => void): SqliteWriteQueue {
	let pending = Promise.resolve();

	async function run<T>(operation: () => Promise<T>, onSuccess?: (result: T) => void): Promise<void> {
		try {
			const result = await operation();
			onSuccess?.(result);
		} catch (error) {
			onError(error);
			throw error;
		}
	}

	return {
		enqueue<T>(operation: () => Promise<T>, onSuccess?: (result: T) => void): void {
			pending = pending.then(() => run(operation, onSuccess), () => run(operation, onSuccess));
		},

		flush(): Promise<void> {
			return pending;
		}
	};
}
