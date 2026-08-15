from ai.providers.deepgram_provider import DeepgramSTTProvider


def test_listen_params_include_repeated_keyterms():
    provider = DeepgramSTTProvider.__new__(DeepgramSTTProvider)
    provider.model = "nova-3"
    pairs = provider._listen_params(["ReactRouter", "get_user", "  spaced  "])
    assert ("model", "nova-3") in pairs
    assert ("smart_format", "true") in pairs
    keyterms = [v for k, v in pairs if k == "keyterm"]
    assert keyterms == ["ReactRouter", "get_user", "spaced"]
