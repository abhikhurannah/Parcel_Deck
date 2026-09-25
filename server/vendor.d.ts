declare module 'json-dup-key-validator' {
  const validator: { parse(input: string, allowDuplicatedKeys?: boolean): unknown };
  export default validator;
}
