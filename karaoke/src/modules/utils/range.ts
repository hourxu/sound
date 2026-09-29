export default function range(size: number) {
  console.log("range called with size:", size);
  if (!Number.isFinite(size) || size > 100000 || size < 0) {
    console.warn("Range size invalid:", size);
    return [];
  }
  return [...Array(Math.floor(size)).keys()];
}
