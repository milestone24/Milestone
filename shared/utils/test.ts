// type WithBar<T> = T & { bar: string };

// async function b<
//   I extends AsyncIterator<{ foo: string }>,
//   B extends I extends AsyncIterator<infer U> ? U : never,
//   C extends B extends { foo: string } ? WithBar<B> : never
// >(i: I): Promise<C> {
//   return (await i.next()).value;
// }

// const d = b(arrayToAsyncIterator([{ foo: "bar" }]));

// d.then((d) => {
//   d.bar;
// });

// const f = {
//   [Symbol.iterator](): Iterator<{ foo: string }> {
//     return {
//       next: () => {
//         return {
//           value: { foo: "bar" },
//           done: false,
//         };
//       },
//     };
//   },
// };

// for (const b of f) {
//   b.foo;
// }
