package app.mutiny.media;

import java.io.*;
import java.nio.file.Files;
import java.util.zip.*;

public class CloudStreamArchiveTest {
    static File archive(String manifest, boolean dex) throws IOException {
        File file = Files.createTempFile("mutiny-fixture-", ".zip").toFile();
        file.deleteOnExit();
        try (ZipOutputStream zip = new ZipOutputStream(new FileOutputStream(file))) {
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(manifest.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            if (dex) {
                zip.putNextEntry(new ZipEntry("classes.dex"));
                zip.write(new byte[]{'d','e','x',10,'0','3','5',0});
                zip.write(new byte[104]);
            }
        }
        return file;
    }
    static org.json.JSONObject inspect(File file) throws Exception {
        try (InputStream in = new FileInputStream(file)) { return CloudStreamArchive.inspect(in); }
    }
    public static void main(String[] args) throws Exception {
        String manifest = "{pluginClassName:'fixture.Demo',name:'Fixture'}";
        if (!inspect(archive(manifest,true)).getString("name").equals("Fixture")) throw new AssertionError();
        for (File invalid : new File[]{archive(manifest,false), archive("{}",true), archive("a".repeat(70000),true)}) {
            try { inspect(invalid); throw new AssertionError("Invalid package accepted"); }
            catch (IOException expected) {}
        }
        String hash = "ab".repeat(32);
        CloudStreamArchive.verifyHash(hash,hash.toUpperCase());
        try { CloudStreamArchive.verifyHash(hash,"cd".repeat(32)); throw new AssertionError("Checksum mismatch accepted"); }
        catch (IllegalArgumentException expected) {}
        System.out.println("CS3 archive structure, manifest size, entry point and checksum fixtures passed");
    }
}
