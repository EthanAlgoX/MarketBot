"""Run the actual agent loop with scripted model responses and real finance stores."""

import json

import pytest

from marketbot.agent.loop import AgentLoop
from marketbot.bus.queue import MessageBus
from marketbot.domain.market.evidence import EvidenceStore
from marketbot.providers.base import LLMProvider, LLMResponse, ToolCallRequest


@pytest.mark.asyncio
async def test_agent_turn_preserves_calculation_and_evidence_end_to_end(tmp_path):
    class ScriptedProvider(LLMProvider):
        def __init__(self):
            super().__init__()
            self.calls = 0
            self.reference = None

        def get_default_model(self):
            return 'scripted-evaluation'

        async def chat(self, **kwargs):
            self.calls += 1
            definitions = {item['function']['name'] for item in kwargs['tools']}
            assert {'portfolio_risk', 'evidence_get', 'market_watch', 'thesis_tracker'} <= definitions
            if self.calls == 1:
                return LLMResponse(content=None, tool_calls=[ToolCallRequest(
                    id='risk-case', name='portfolio_risk',
                    arguments={'baseCurrency': 'USD', 'holdings': [{'symbol': 'AAPL', 'quantity': '0.1', 'price': '0.2', 'currency': 'USD'}]},
                )])
            results = [message for message in kwargs['messages'] if message.get('role') == 'tool' and message.get('name') == 'portfolio_risk']
            assert results
            data = json.loads(results[-1]['content'])
            assert data['totalValue'] == '0.02'
            self.reference = data['evidenceRecordId']
            assert EvidenceStore(tmp_path).verify(self.reference)
            return LLMResponse(content=f"Total supplied portfolio value: 0.02 USD. Evidence: {self.reference}. Observation time was not provided.")

    provider = ScriptedProvider()
    loop = AgentLoop(bus=MessageBus(), provider=provider, workspace=tmp_path, model=provider.get_default_model())
    response = await loop.process_direct('Calculate my holdings: AAPL 0.1 shares at 0.2 USD; base currency USD.', session_key='cli:finance-evaluation')
    assert '0.02 USD' in response and provider.reference in response
    assert provider.calls == 2
    assert EvidenceStore(tmp_path).get(provider.reference).payload['holdings'][0]['valueBase'] == '0.02'
    saved = loop.sessions.get_or_create('cli:finance-evaluation').messages[-1]['content']
    assert '0.02 USD' in saved and provider.reference in saved
