export function isValidEmailAddress(value: string): boolean {
  return (
    value.length <= 254 &&
    !/[\r\n]/u.test(value) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
  );
}
