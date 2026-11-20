package app.mutiny.media;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Bounded, one-shot IPC transport. Never invoke on the Android main thread. */
final class CloudStreamTransport {
    private static final int TIMEOUT_SECONDS = 8;
    private CloudStreamTransport() { }

    static JSONObject request(Context context, String sha256, JSONObject request) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper())
            throw new IllegalStateException("CloudStream requests require a worker thread");
        if (!CloudStreamPackageStore.isInstalled(context, sha256))
            throw new IOException("CloudStream package missing or digest changed");
        final String payload = CloudStreamRequest.validate(request).toString();
        final File archive = new File(context.getFilesDir(), "cloudstream-extensions/" + sha256 + ".cs3");
        final ArrayBlockingQueue<Bundle> replies = new ArrayBlockingQueue<>(1);
        final Messenger callback = new Messenger(new Handler(Looper.getMainLooper(), message -> {
            if (message.what == CloudStreamWorker.REQUEST) replies.offer(message.getData());
            return true;
        }));
        try (ParcelFileDescriptor archiveFd = ParcelFileDescriptor.open(archive, ParcelFileDescriptor.MODE_READ_ONLY)) {
        ServiceConnection connection = new ServiceConnection() {
            private void fail() {
                Bundle result = new Bundle();
                result.putString("error", "CloudStream worker disconnected");
                replies.offer(result);
            }
            @Override public void onServiceConnected(ComponentName name, IBinder binder) {
                Message message = Message.obtain(null, CloudStreamWorker.REQUEST);
                Bundle data = new Bundle();
                data.putString("request", payload);
                data.putString("sha256", sha256);
                data.putParcelable("archive", archiveFd);
                message.setData(data);
                message.replyTo = callback;
                try { new Messenger(binder).send(message); }
                catch (RemoteException error) { fail(); }
            }
            @Override public void onServiceDisconnected(ComponentName name) { fail(); }
            @Override public void onBindingDied(ComponentName name) { fail(); }
            @Override public void onNullBinding(ComponentName name) { fail(); }
        };
        if (!context.bindService(new Intent(context, CloudStreamWorker.class), connection, Context.BIND_AUTO_CREATE))
            throw new IOException("CloudStream worker unavailable");
        try {
            Bundle reply = replies.poll(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (reply == null) throw new IOException("CloudStream worker timed out");
            String error = reply.getString("error");
            if (error != null) throw new IOException(error);
            String result = reply.getString("result");
            if (result == null || result.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > CloudStreamWorker.MAX_REPLY_BYTES)
                throw new IOException("Invalid CloudStream worker response");
            return new JSONObject(result);
        } finally {
            context.unbindService(connection);
        }
        }
    }
}
