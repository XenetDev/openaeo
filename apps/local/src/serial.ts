export function createSerial() {
	const tails = new Map<string, Promise<void>>();

	return function serial<T>(key: string, task: () => Promise<T>): Promise<T> {
		const result = (tails.get(key) ?? Promise.resolve()).then(task);
		const tail = result.then(
			() => {},
			() => {},
		);
		tails.set(key, tail);
		tail.then(() => {
			if (tails.get(key) === tail) tails.delete(key);
		});
		return result;
	};
}
