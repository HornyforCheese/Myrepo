import app.mutiny.media.CloudStreamRepository;
import org.json.*;

public class CloudStreamRepositoryTest {
    public static void main(String[] args) throws Exception {
        String root="https://repo.example/repo.json";
        JSONObject result=CloudStreamRepository.discover(root, (url, method, headers, body) -> {
            if (url.equals(root)) return new JSONObject("{pluginLists:['index.json','http://localhost/list']}");
            if (!url.equals("https://repo.example/index.json")) throw new AssertionError(url);
            return new JSONArray("[{name:'Fixture',url:'extension.cs3'},{name:'Duplicate',url:'extension.cs3'},{name:'Disabled',url:'other.cs3',status:0}]");
        });
        if (result.getJSONArray("extensions").length()!=1 || result.getInt("failedLists")!=1 || result.getBoolean("executionSupported"))
            throw new AssertionError(result);
        System.out.println("CS3 discovery, unsafe list, relative path and duplicate fixtures passed");
    }
}
