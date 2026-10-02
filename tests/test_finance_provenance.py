"""Source times and attribution must survive caching and evidence capture."""

import json
from datetime import UTC, datetime

import pytest

from marketbot.agent.tools.finance_evidence import capture_finance_result
from marketbot.agent.tools.market import MarketSnapshotTool
from marketbot.cache.market_cache import MarketCache
from marketbot.domain.market.evidence import EvidenceStore
from marketbot.domain.market.provenance import source_timestamp


@pytest.mark.parametrize('raw,zone,expected', [
    ('20260930161458', 'Asia/Shanghai', '2026-09-30T08:14:58Z'),
    ('2026/10/02 16:08:10', 'Asia/Hong_Kong', '2026-10-02T08:08:10Z'),
    ('2026-10-02 12:15:40', None, None),
    ('Fri, 02 Oct 2026 10:00:00 GMT', None, '2026-10-02T10:00:00Z'),
    ('2026-10-02', None, None),
    ('2 hours ago', None, None),
    (float('nan'), None, None),
    (True, None, None),
])
def test_unknown_source_time_never_becomes_now(raw, zone, expected):
    assert source_timestamp(raw, zone=zone) == expected


def test_capture_preserves_unknown_quote_time_and_full_numbers(tmp_path):
    result = capture_finance_result(tmp_path, 'market_snapshot', json.dumps({
        'asOf': datetime.now(UTC).isoformat(), 'source': 'tencent_us', 'symbols': ['AAPL'],
        'quotes': [{'symbol': 'AAPL', 'price': '123.456789123456789', 'currency': 'USD', 'provider': 'tencent_us', 'observedAt': None}],
    }))
    payload = json.loads(result)
    row = payload['quotes'][0]
    record = EvidenceStore(tmp_path).get(row['evidenceId'])
    assert record.observed_at is None
    assert record.payload['price'] == '123.456789123456789'
    assert record.retrieved_at is not None
    assert EvidenceStore(tmp_path).verify(payload['evidenceRecordId'])


def test_capture_cannot_claim_saved_credential_payload(tmp_path):
    payload = json.loads(capture_finance_result(tmp_path, 'market_news', json.dumps({'apiKey': 'secret', 'items': []})))
    assert payload['evidenceRecording']['ok'] is False
    assert 'evidenceRecordId' not in payload


def test_cache_results_do_not_mutate_original_evidence(tmp_path):
    cache = MarketCache(tmp_path)
    value = {'quotes': [{'price': 10}]}
    cache.set(value, 'quotes')
    value['quotes'][0]['price'] = 99
    first = cache.get('quotes')
    first['quotes'][0]['price'] = 42
    assert cache.get('quotes')['quotes'][0]['price'] == 10
    assert MarketCache(tmp_path).get('quotes')['quotes'][0]['price'] == 10


@pytest.mark.asyncio
async def test_quote_aliases_disclose_actual_provider(monkeypatch):
    tool = MarketSnapshotTool()
    async def yahoo(_symbols):
        return [{'symbol': 'SPY', 'price': 100}], []
    monkeypatch.setattr(tool, '_fetch_yahoo', yahoo)
    for adapter in (tool._fetch_yfinance, tool._fetch_tradingview):
        rows, warnings = await adapter(['SPY'])
        assert rows[0]['provider'] == 'yahoo'
        assert warnings


@pytest.mark.asyncio
@pytest.mark.parametrize('market,symbol,provider_symbol,raw_time,expected_time', [
    ('us', 'BRK.B', 'BRK.B.N', '2026-10-02 12:15:40', None),
    ('cn', '600519', '600519', '20260930161458', '2026-09-30T08:14:58Z'),
    ('hk', '0700.HK', '00700', '2026/10/02 16:08:10', '2026-10-02T08:08:10Z'),
])
async def test_public_quote_fields_preserve_share_class_and_source_time(monkeypatch, market, symbol, provider_symbol, raw_time, expected_time):
    import httpx

    from marketbot.domain.market.services import MarketSnapshotService

    fields = [''] * 50
    fields[1], fields[2], fields[3], fields[4], fields[5], fields[6] = 'Example', provider_symbol, '100', '99', '99', '1000'
    fields[30], fields[31], fields[32], fields[33], fields[34], fields[35], fields[37] = raw_time, '1', '1', '101', '98', 'USD', '10000'
    response_text = 'v_quote="' + '~'.join(fields) + '";'
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(lambda request: httpx.Response(200, text=response_text)), **kwargs))
    rows, warnings = await MarketSnapshotService()._fetch_tencent_quotes_uncached(symbols=[symbol], market=market)
    assert not warnings
    assert rows[0]['symbol'] == provider_symbol if market != 'us' else rows[0]['symbol'] == 'BRK.B'
    assert rows[0]['observedAt'] == expected_time
    assert rows[0]['provider'] == f'tencent_{market}'
    assert rows[0]['marketState'] == 'UNKNOWN'


@pytest.mark.asyncio
async def test_news_missing_publication_time_is_explicit(monkeypatch):
    import httpx

    from marketbot.domain.market.services import MarketNewsService

    original = httpx.AsyncClient
    xml = '<rss><channel><item><title>Example announcement</title><link>https://example.org/news</link></item></channel></rss>'
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(lambda request: httpx.Response(200, text=xml)), **kwargs))
    items, warnings = await MarketNewsService().fetch_google_rss('AAPL', 1)
    assert not warnings
    assert items[0]['publishedAt'] is None
    assert items[0]['retrievedAt'] is not None


@pytest.mark.asyncio
@pytest.mark.parametrize('value', [float('nan'), float('inf'), -float('inf'), True, 'NaN'])
async def test_signal_cannot_turn_invalid_number_into_buy(value):
    from marketbot.agent.tools.market import MarketSignalTool

    result = json.loads(await MarketSignalTool().execute(symbol='AAPL', priceChangePct=value, newsSentiment=1, socialSentiment=1))
    assert result['ok'] is False
    assert 'action' not in result


@pytest.mark.asyncio
async def test_invalid_provider_quote_cannot_become_market_signal(monkeypatch):
    tool = MarketSnapshotTool()
    async def invalid(_symbols):
        return [{'symbol': 'AAPL', 'price': float('nan'), 'changePct': 10}], []
    monkeypatch.setattr(tool, '_fetch_tencent_us', invalid)
    result = json.loads(await tool.execute(symbols=['AAPL']))
    assert result['quotes'] == []
    assert result['missingSymbols'] == ['AAPL']
    assert result['warnings']
