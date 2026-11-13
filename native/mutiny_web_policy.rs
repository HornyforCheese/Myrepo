//! Main-window navigation policy. Child player frames retain their own origins.
pub fn allowed_main_navigation(scheme: &str, host: Option<&str>, port: Option<u16>, debug: bool) -> bool {
    match (scheme, host, port) {
        ("tauri", Some("localhost"), None) => true,
        ("http" | "https", Some("tauri.localhost"), None) => true,
        ("http", Some("localhost" | "127.0.0.1"), Some(1420)) if debug => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn production_allows_only_the_app_origin() {
        for (scheme, host) in [("tauri", "localhost"), ("http", "tauri.localhost"), ("https", "tauri.localhost")] {
            assert!(allowed_main_navigation(scheme, Some(host), None, false));
        }
        for (scheme, host, port) in [
            ("https", "player.example", None),
            ("https", "tauri.localhost.attacker.example", None),
            ("http", "localhost", Some(1420)),
            ("http", "127.0.0.1", Some(8080)),
            ("file", "localhost", None),
            ("javascript", "tauri.localhost", None),
            ("https", "tauri.localhost", Some(8443)),
        ] {
            assert!(!allowed_main_navigation(scheme, Some(host), port, false));
        }
    }
    #[test]
    fn developer_server_exception_is_narrow() {
        assert!(allowed_main_navigation("http", Some("localhost"), Some(1420), true));
        assert!(!allowed_main_navigation("https", Some("player.example"), None, true));
        assert!(!allowed_main_navigation("http", Some("localhost"), Some(8080), true));
    }
}
