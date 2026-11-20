package app.mutiny.media;

/** A single RFC 7233 range. Invalid or unsatisfiable requests fail explicitly. */
public final class ByteRange {
    public final long start, end;
    public final boolean partial;
    private ByteRange(long start, long end, boolean partial) { this.start = start; this.end = end; this.partial = partial; }
    public static ByteRange parse(String header, long size) {
        if (size <= 0) throw new IllegalArgumentException("Empty file");
        if (header == null) return new ByteRange(0, size - 1, false);
        if (!header.matches("bytes=(?:[0-9]+-[0-9]*|-[0-9]+)")) throw new IllegalArgumentException("Invalid range");
        String[] parts = header.substring(6).split("-", -1);
        long start, end;
        if (parts[0].isEmpty()) { long suffix = Long.parseLong(parts[1]); if (suffix == 0) throw new IllegalArgumentException("Empty suffix"); start = Math.max(0, size - suffix); end = size - 1; }
        else { start = Long.parseLong(parts[0]); end = parts[1].isEmpty() ? size - 1 : Math.min(Long.parseLong(parts[1]), size - 1); }
        if (start >= size || start > end) throw new IllegalArgumentException("Unsatisfiable range");
        return new ByteRange(start, end, true);
    }
}
