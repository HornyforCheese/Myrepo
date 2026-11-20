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
                zip.write(new byte[]{1});
            }
        }
        return file;
    }
    public static void main(String[] args) throws Exception {
        String manifest = "{pluginClassName:'fixture.Demo',name:'Fixture'}";
        if (!CloudStreamArchive.inspect(archive(manifest,true)).getString("name").equals("Fixture")) throw new AssertionError();
        for (File invalid : new File[]{archive(manifest,false), archive("{}",true), archive("a".repeat(70000),true)}) {
            try { CloudStreamArchive.inspect(invalid); throw new AssertionError("Invalid package accepted"); }
            catch (IOException expected) {}
        }
        String hash = "ab".repeat(32);
        CloudStreamArchive.verifyHash(hash,hash.toUpperCase());
        try { CloudStreamArchive.verifyHash(hash,"cd".repeat(32)); throw new AssertionError("Checksum mismatch accepted"); }
        catch (IllegalArgumentException expected) {}
        System.out.println("CS3 archive structure, manifest size, entry point and checksum fixtures passed");
    }
}
