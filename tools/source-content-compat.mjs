/** Windows checkout line endings are equivalent for TypeScript; binary assets stay exact. */
export function sameSourceContent(relative, left, right) {
  if (/\.tsx?$/i.test(relative)) {
    const normalize = data => data.toString('utf8').replace(/\r\n/g, '\n');
    return normalize(left) === normalize(right);
  }
  return left.equals(right);
}
