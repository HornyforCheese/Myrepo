package app.mutiny.media;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.RemoteException;
import org.json.JSONObject;

/**
 * Permissionless process boundary for future CloudStream provider execution.
 * Until the compatible host ABI is implemented, all validated calls fail closed.
 */
public final class CloudStreamWorker extends Service {
    static final int REQUEST = 1;
    static final int MAX_REPLY_BYTES = 4096;

    @Override public IBinder onBind(Intent intent) {
        return new Messenger(new Handler(Looper.getMainLooper(), message -> {
            if (message.what != REQUEST || message.replyTo == null) return true;
            Bundle reply = new Bundle();
            try {
                Bundle input = message.getData();
                String encoded = input == null ? null : input.getString("request");
                if (encoded == null || encoded.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > CloudStreamRequest.MAX_REQUEST_BYTES)
                    throw new IllegalArgumentException("Invalid CloudStream request payload");
                CloudStreamRequest.validate(new JSONObject(encoded));
                reply.putString("error", "CloudStream provider execution is not yet supported");
            } catch (Exception invalid) {
                reply.putString("error", "Invalid or unsupported CloudStream request");
            }
            Message response = Message.obtain(null, REQUEST);
            response.setData(reply);
            try { message.replyTo.send(response); } catch (RemoteException ignored) { }
            return true;
        })).getBinder();
    }
}
