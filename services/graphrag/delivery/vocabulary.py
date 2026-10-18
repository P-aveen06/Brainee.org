"""Small inspectable recall aid; semantic vectors remain the general matcher."""
import re

FAMILIES = [
    ("payment", "payments", "checkout", "billing", "refund", "refunds", "gateway", "transaction"),
    ("authentication", "login", "sign in", "single sign on", "sso", "identity provider"),
    ("notification", "notifications", "alert", "alerts", "messaging"),
    ("upload", "attachment", "document ingestion", "file import"),
]


def expand_vocabulary(terms):
    result = list(terms)
    for family in FAMILIES:
        if any(re.search(r"\b" + re.escape(word) + r"\b", term) for word in family for term in terms):
            result.extend(family)
    return list(dict.fromkeys(result))[:48]
