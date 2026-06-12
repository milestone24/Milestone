export function arrayToAsyncIterator<T>(arr: T[]): AsyncIterator<T> {
  let i = 0;
  return {
    next: async () => {
      if (i < arr.length) {
        // Only return value: T when done is false
        return { value: arr[i++], done: false } as IteratorYieldResult<T>;
      } else {
        // Only return value: undefined when done is true
        return { value: undefined, done: true } as IteratorReturnResult<T>;
      }
    }
  };
}
