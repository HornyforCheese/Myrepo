package app.mutiny.media;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Tokens and API keys are encrypted by a device-bound Android Keystore key. */
public final class SecureStore implements Secrets {
    private final SharedPreferences preferences;
    private final SecretKey key;
    public SecureStore(Context context) throws Exception {
        preferences = context.getSharedPreferences("credentials", Context.MODE_PRIVATE);
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        String alias = "mutiny.credentials.v1";
        if (!store.containsAlias(alias)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        key = (SecretKey) store.getKey(alias, null);
    }
    public synchronized String get(String name) throws Exception {
        String saved = preferences.getString(name, ""); if (saved.isEmpty()) return "";
        String[] parts = saved.split(":", 2);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8);
    }
    public synchronized void putAll(java.util.Map<String,String> values) throws Exception {
        SharedPreferences.Editor editor = preferences.edit();
        for (java.util.Map.Entry<String,String> entry : values.entrySet()) {
            String value = entry.getValue();
            if (value == null || value.isEmpty()) { editor.remove(entry.getKey()); continue; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            editor.putString(entry.getKey(), Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP));
        }
        if (!editor.commit()) throw new java.io.IOException("Could not persist credential changes");
    }
}
