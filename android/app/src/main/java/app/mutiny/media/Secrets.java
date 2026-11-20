package app.mutiny.media;

public interface Secrets {
    String get(String key) throws Exception;
    void putAll(java.util.Map<String,String> values) throws Exception;
    default void put(String key, String value) throws Exception {
        putAll(java.util.Collections.singletonMap(key, value));
    }
}
