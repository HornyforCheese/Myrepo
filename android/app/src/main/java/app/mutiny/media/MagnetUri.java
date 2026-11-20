package app.mutiny.media;

import java.net.URI;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Locale;

final class MagnetUri {
    static String normalize(String input) {
        if (input == null || input.length() > 20000 || !input.regionMatches(true,0,"magnet:?",0,8))
            throw new IllegalArgumentException("Enter a BitTorrent v1 magnet link");
        URI uri = URI.create(input);
        if (uri.getRawFragment() != null) throw new IllegalArgumentException("Invalid magnet fragment");
        String hash = null;
        ArrayList<String> extras = new ArrayList<>();
        for (String pair : input.substring(8).split("&")) {
            int split = pair.indexOf('=');
            if (split < 1) continue;
            if (pair.substring(0,split).equalsIgnoreCase("xt")) {
                String topic;
                try { topic = URLDecoder.decode(pair.substring(split+1),"UTF-8"); }
                catch (java.io.UnsupportedEncodingException impossible) { throw new AssertionError(impossible); }
                if (topic.regionMatches(true,0,"urn:btih:",0,9)) {
                    String value = topic.substring(9).toLowerCase(Locale.ROOT);
                    if (!value.matches("(?:[0-9a-f]{40}|[a-z2-7]{32})") || (hash != null && !hash.equals(value)))
                        throw new IllegalArgumentException("Invalid or conflicting BitTorrent info hash");
                    hash = value;
                    continue;
                }
            }
            extras.add(pair);
        }
        if (hash == null) throw new IllegalArgumentException("Magnet link has no BitTorrent v1 info hash");
        if (hash.length() == 32) hash = hash.toUpperCase(Locale.ROOT);
        return "magnet:?xt=urn:btih:" + hash + (extras.isEmpty() ? "" : "&" + String.join("&",extras));
    }
}
