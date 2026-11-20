package app.mutiny.media;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Message;
import android.os.Messenger;
import android.os.ParcelFileDescriptor;
import android.os.RemoteException;
import java.security.MessageDigest;
import org.json.JSONObject;

/**
 * Isolated process boundary for the pinned StreamPlay archive.
 * This stage verifies the actual descriptor contents; no DEX is executed.
 */
public final class CloudStreamWorker extends Service {
    static final int REQUEST = 1;
    static final int MAX_REPLY_BYTES = 4096;
    private HandlerThread workerThread;
    private Messenger messenger;

    @Override public void onCreate() {
        super.onCreate();
        workerThread = new HandlerThread("streamplay-archive-worker");
        workerThread.start();
        messenger = new Messenger(new Handler(workerThread.getLooper(), this::handle));
    }

    @Override public IBinder onBind(Intent intent) { return messenger.getBinder(); }

    private boolean handle(Message message) {
        if (message.what != REQUEST || message.replyTo == null) return true;
        Bundle reply = new Bundle();
        try {
            Bundle input = message.getData();
            if (input == null) throw new IllegalArgumentException("Missing IPC request");
            input.setClassLoader(ParcelFileDescriptor.class.getClassLoader());
            String encoded = input.getString("request");
            String expected = input.getString("sha256");
            if (encoded == null || encoded.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > CloudStreamRequest.MAX_REQUEST_BYTES)
                throw new IllegalArgumentException("Invalid request payload");
            CloudStreamRequest.validate(new JSONObject(encoded));
            if (!"94d7ec68ed45cf3527fb71d92460047cd3d1d5de8c92aa912122f7ed1117e332".equals(expected))
                throw new IllegalArgumentException("Unexpected plugin version");
            ParcelFileDescriptor descriptor = input.getParcelable("archive");
            if (descriptor == null) throw new IllegalArgumentException("Missing archive descriptor");
            try (ParcelFileDescriptor.AutoCloseInputStream stream = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long total = 0;
                byte[] block = new byte[16384];
                int n;
                while ((n = stream.read(block)) != -1) {
                        if (n > CloudStreamArchive.MAX_BYTES - total) throw new IllegalArgumentException("Oversized archive");
                        total += n;
                        digest.update(block, 0, n);
                    }
                if (total < 100 || !expected.equals(CloudStreamArchive.asHex(digest.digest())))
                    throw new IllegalArgumentException("Archive digest mismatch");
            }
            reply.putString("error", "StreamPlay v715 verified but CloudStream host ABI is not implemented");
        } catch (Exception invalid) {
            reply.putString("error", "Invalid StreamPlay archive or request");
        }
        Message response = Message.obtain(null, REQUEST);
        response.setData(reply);
        try { message.replyTo.send(response); } catch (RemoteException ignored) { }
        return true;
    }

    @Override public void onDestroy() {
        if (workerThread != null) workerThread.quitSafely();
        super.onDestroy();
    }
}
