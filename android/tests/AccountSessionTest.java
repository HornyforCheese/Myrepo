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
        Accounts accounts = new Accounts(store, (url,method,headers,body) -> response);
        try { accounts.login("nuvio","user@example.com","fixture"); throw new AssertionError("Missing identity accepted"); }
        catch (IllegalStateException expected) {}
        if (writes[0] != 0) throw new AssertionError("Partial session");
        response.put("user",new JSONObject().put("id","user1"));
        accounts.login("nuvio","user@example.com","fixture");
        if (writes[0] != 1 || !"1".equals(data.get("account.profile"))) throw new AssertionError("Split session");
        accounts.logout("nuvio");
        if (writes[0] != 2 || accounts.status().getJSONObject("nuvio").getBoolean("signedIn")) throw new AssertionError("Incomplete logout");
        System.out.println("Account identity, session and logout fixtures passed");
    }
}
