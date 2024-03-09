/* eslint-disable function-paren-newline, consistent-return, implicit-arrow-linebreak */

export const wait = (milliseconds: number) => new Promise<void>((resolve) =>
	// eslint-disable-next-line no-promise-executor-return
	setTimeout(resolve, milliseconds)
);

export const awaitCallback = (
	// eslint-disable-next-line no-unused-vars
	handler?: (cb: (e?: Error | null | undefined) => unknown) => unknown
) => new Promise<void>((resolve, reject) => {
	// eslint-disable-next-line no-promise-executor-return, no-unused-vars
	if (!handler) return resolve();

	handler((e?: Error | null | undefined) => {
		if (!e) resolve();
		else reject(e);
	});
});

export const awaitValue = <T>(
	// eslint-disable-next-line no-unused-vars
	handler: (cb: (value: T) => unknown) => unknown
) => new Promise<T>((resolve) => {
	handler((value: T) => {
		resolve(value);
	});
});
