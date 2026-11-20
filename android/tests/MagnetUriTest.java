package app.mutiny.media;
public class MagnetUriTest {
    public static void main(String[] args) {
        String hash = "12ab".repeat(10);
        String alternate = "MAGNET:?dn=Media&xt=urn%3Abtih%3A" + hash.toUpperCase();
        if (!MagnetUri.normalize(alternate).equals("magnet:?xt=urn:btih:" + hash + "&dn=Media")) throw new AssertionError();
        for (String invalid : new String[]{"magnet:?dn=xt=urn:btih:"+hash,"magnet:?xt=urn:btih:bad","magnet:?xt=urn:btih:"+hash+"&xt=urn:btih:"+"b".repeat(40)}) {
            try { MagnetUri.normalize(invalid); throw new AssertionError("Invalid magnet accepted"); }
            catch (IllegalArgumentException expected) {}
        }
        System.out.println("Magnet topic, order, percent encoding and conflict fixtures passed");
    }
}
