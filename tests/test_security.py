import importlib

from app import security


def test_missing_secret_key_generates_a_new_runtime_value(monkeypatch):
    monkeypatch.delenv("TJW_SECRET_KEY", raising=False)

    first_secret = importlib.reload(security).SECRET_KEY
    second_secret = importlib.reload(security).SECRET_KEY

    assert first_secret != "local-development-key-change-before-deployment"
    assert second_secret != "local-development-key-change-before-deployment"
    assert first_secret != second_secret


def test_configured_secret_key_is_used(monkeypatch):
    monkeypatch.setenv("TJW_SECRET_KEY", "test-configured-secret-key")

    assert importlib.reload(security).SECRET_KEY == "test-configured-secret-key"
