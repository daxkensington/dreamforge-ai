"""Submit dreamforgex.ai sitemap to Google Search Console via service account.

Uses the mm-gsc service account (has siteOwner access to sc-domain:dreamforgex.ai
per reference_gsc_sites.md).
"""
import json
import pathlib
import ssl
import sys
import time
import urllib.parse
import urllib.request

try:
    import jwt  # PyJWT
except ImportError:
    print("ERROR: pip install PyJWT cryptography", file=sys.stderr)
    sys.exit(1)

SA_PATH = pathlib.Path.home() / "Downloads" / "mm-gsc-492615-0c088bf6d01f.json"
SITE_URL = "sc-domain:dreamforgex.ai"
SITEMAP_URL = "https://dreamforgex.ai/sitemap.xml"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/webmasters"


def sa_creds() -> dict:
    return json.loads(SA_PATH.read_text())


def get_access_token(sa: dict) -> str:
    now = int(time.time())
    claims = {
        "iss": sa["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "exp": now + 3600,
        "iat": now,
    }
    assertion = jwt.encode(claims, sa["private_key"], algorithm="RS256")
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
    }).encode()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())["access_token"]


def submit_sitemap(token: str) -> None:
    encoded_site = urllib.parse.quote(SITE_URL, safe="")
    encoded_sitemap = urllib.parse.quote(SITEMAP_URL, safe="")
    url = f"https://www.googleapis.com/webmasters/v3/sites/{encoded_site}/sitemaps/{encoded_sitemap}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}, method="PUT")
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        print(f"submit sitemap: HTTP {r.status}")


def list_sitemaps(token: str) -> None:
    encoded_site = urllib.parse.quote(SITE_URL, safe="")
    url = f"https://www.googleapis.com/webmasters/v3/sites/{encoded_site}/sitemaps"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        data = json.loads(r.read())
    sitemaps = data.get("sitemap", [])
    print(f"sitemaps registered: {len(sitemaps)}")
    for s in sitemaps:
        print(f"  - {s.get('path')} — lastSubmitted={s.get('lastSubmitted')}, isPending={s.get('isPending')}, warnings={s.get('warnings')}, errors={s.get('errors')}, contents={[{'type': c.get('type'), 'submitted': c.get('submitted'), 'indexed': c.get('indexed')} for c in s.get('contents', [])]}")


if __name__ == "__main__":
    sa = sa_creds()
    token = get_access_token(sa)
    submit_sitemap(token)
    list_sitemaps(token)
