import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an action once at a time and says when it is still going, so its button can show a spinner. */
export function usePending<A extends unknown[]>(work: (...args: A) => unknown): [boolean, (...args: A) => void] {
	const [pending, setPending] = useState(false);
	const busy = useRef(false);
	const live = useRef(true);
	const latest = useRef(work);
	latest.current = work;

	useEffect(() => {
		live.current = true;
		return () => {
			live.current = false;
		};
	}, []);

	const run = useCallback((...args: A) => {
		if (busy.current) return;
		busy.current = true;
		setPending(true);
		void Promise.resolve()
			.then(() => latest.current(...args))
			.catch(() => undefined)
			.finally(() => {
				busy.current = false;
				if (live.current) setPending(false);
			});
	}, []);

	return [pending, run];
}
