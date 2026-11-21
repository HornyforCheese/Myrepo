package app.mutiny.media;

public interface Secrets {
    String get(String key) throws Exception;
    void put(String key, String value) throws Exception;
}
