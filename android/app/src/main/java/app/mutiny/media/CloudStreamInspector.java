package app.mutiny.media;

import android.app.Service;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.*;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Reads archive metadata from one read-only descriptor in a permissionless Android process. */
public final class CloudStreamInspector extends Service {
    @Override public IBinder onBind(Intent intent) {
        return new Messenger(new Handler(Looper.getMainLooper(), request -> {
            Bundle result = new Bundle();
            try (ParcelFileDescriptor descriptor = request.getData().getParcelable("archive")) {
                if (descriptor == null) throw new IOException("Missing package");
                result.putString("metadata", CloudStreamArchive.inspect(new ParcelFileDescriptor.AutoCloseInputStream(descriptor)).toString());
            } catch (Exception invalid) {
                result.putString("error", "Invalid CS3 archive, manifest or DEX entry.");
            }
            Message reply = Message.obtain();
            reply.setData(result);
            try { if (request.replyTo != null) request.replyTo.send(reply); } catch (RemoteException ignored) {}
            return true;
        })).getBinder();
    }

    // Called from the import worker. Android delivers connection and reply callbacks on the main looper.
    static JSONObject inspect(Context context, File file) throws Exception {
        ArrayBlockingQueue<Bundle> replies = new ArrayBlockingQueue<>(1);
        Messenger callback = new Messenger(new Handler(Looper.getMainLooper(), response -> {
            replies.offer(response.getData());
            return true;
        }));
        try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)) {
            ServiceConnection connection = new ServiceConnection() {
                public void onServiceConnected(ComponentName name, IBinder binder) {
                    Bundle input = new Bundle();
                    input.putParcelable("archive", descriptor);
                    Message request = Message.obtain();
                    request.setData(input);
                    request.replyTo = callback;
                    try { new Messenger(binder).send(request); } catch (RemoteException failure) { disconnected(); }
                }
                public void onServiceDisconnected(ComponentName name) { disconnected(); }
                public void onBindingDied(ComponentName name) { disconnected(); }
                public void onNullBinding(ComponentName name) { disconnected(); }
                private void disconnected() {
                    Bundle failure = new Bundle();
                    failure.putString("error","Package inspection service disconnected");
                    replies.offer(failure);
                }
            };
            if (!context.bindService(new Intent(context,CloudStreamInspector.class),connection,Context.BIND_AUTO_CREATE))
                throw new IOException("Cannot start isolated package inspection");
            try {
                Bundle response = replies.poll(20, TimeUnit.SECONDS);
                if (response == null) throw new IOException("Package inspection timed out");
                if (!response.containsKey("metadata")) throw new IOException(response.getString("error","Package inspection failed"));
                return new JSONObject(response.getString("metadata"));
            } finally {
                context.unbindService(connection);
            }
        }
    }
}
