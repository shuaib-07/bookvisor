use url::Url;

const TRACKING_PARAMS: &[&str] = &[
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_name",
    "utm_id",
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "msclkid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "ref_url",
    "twclid",
    "yclid",
    "_hsenc",
    "_hsmi",
    "source",
    "share",
    "spm",
];

pub fn clean_url(raw_url: &str) -> String {
    let raw = raw_url.trim();
    if raw.is_empty() {
        return String::new();
    }

    if let Ok(mut parsed) = Url::parse(raw) {
        // Strip tracking query parameters
        let filtered_pairs: Vec<(String, String)> = parsed
            .query_pairs()
            .filter(|(k, _)| {
                let k_lower = k.to_lowercase();
                !TRACKING_PARAMS.contains(&k_lower.as_str())
            })
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        if filtered_pairs.is_empty() {
            parsed.set_query(None);
        } else {
            let mut serializer = url::form_urlencoded::Serializer::new(String::new());
            for (k, v) in filtered_pairs {
                serializer.append_pair(&k, &v);
            }
            parsed.set_query(Some(&serializer.finish()));
        }

        // Clean trailing slash for simple paths
        let mut clean_str = parsed.to_string();
        if clean_str.ends_with('/') && parsed.path() == "/" && parsed.query().is_none() {
            clean_str.pop();
        }
        clean_str
    } else {
        raw.to_string()
    }
}

pub fn extract_domain(url_str: &str) -> String {
    if let Ok(parsed) = Url::parse(url_str) {
        if let Some(host) = parsed.host_str() {
            let h = host.to_lowercase();
            return if let Some(stripped) = h.strip_prefix("www.") {
                stripped.to_string()
            } else {
                h
            };
        }
    }
    "unknown".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_url() {
        let dirty = "https://github.com/rust-lang/rust?utm_source=twitter&utm_medium=social&ref=producthunt";
        assert_eq!(clean_url(dirty), "https://github.com/rust-lang/rust");
    }

    #[test]
    fn test_extract_domain() {
        assert_eq!(extract_domain("https://www.21st.dev/components"), "21st.dev");
        assert_eq!(extract_domain("https://github.com/shadcn-ui/ui"), "github.com");
    }
}

