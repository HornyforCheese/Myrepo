import app.mutiny.media.*;
import org.json.*;
import java.util.*;

public class AccountSessionTest {
    public static void main(String[] args) throws Exception {
        Map<String,String> data = new HashMap<>();
        int[] writes = {0};
        Secrets store = new Secrets() {
            public String get(String name) { return data.getOrDefault(name, ""); }
            public void putAll(Map<String,String> batch) { writes[0]++; data.putAll(batch); }
        };
        JSONObject response = new JSONObject().put("access_token","fixture").put("refresh_token","fixture");
        boolean[] locked = {true};
        int[] mutations = {0};
        Accounts accounts = new Accounts(store, (url,method,headers,body) -> {
            if (url.contains("/profiles?")) return new JSONArray().put(new JSONObject().put("profile_index",1).put("pin_enabled", locked[0]));
            if (url.contains("/rpc/")) mutations[0]++;
            return response;
        });
        try { accounts.login("nuvio","user@example.com","fixture"); throw new AssertionError("Missing identity accepted"); }
        catch (IllegalStateException expected) {}
        if (writes[0] != 0) throw new AssertionError("Partial session");
        response.put("user",new JSONObject().put("id","user1"));
        accounts.login("nuvio","user@example.com","fixture");
        if (writes[0] != 1 || !"1".equals(data.get("account.profile"))) throw new AssertionError("Split session");
        JSONObject meta = new JSONObject().put("id","tt1234567").put("scope", accounts.activeScope());
        try { accounts.bookmark(meta,false); throw new AssertionError("Protected profile"); }
        catch (IllegalStateException expected) {}
        locked[0] = false;
        accounts.progress(new JSONObject(meta.toString()).put("scope","other"),2000,10000);
        if (mutations[0] != 0) throw new AssertionError("Stale playback scope");
        accounts.bookmark(meta,false);
        if (mutations[0] != 1) throw new AssertionError("Unlocked bookmark missing");
        int beforeLogout = writes[0];
        accounts.logout("nuvio");
        if (writes[0] != beforeLogout + 1 || accounts.status().getJSONObject("nuvio").getBoolean("signedIn")) throw new AssertionError("Incomplete logout");
        System.out.println("Account identity, session and logout fixtures passed");
    }
}
