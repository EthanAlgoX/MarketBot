"""Replay README workflows using installed CLI processes and local protocol fixtures.

No real accounts or external writes. --network additionally probes public sources.
Use --python /absolute/venv/bin/python to verify a clean wheel outside the repo.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
from datetime import UTC, datetime
from email.utils import format_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FixtureHandler(BaseHTTPRequestHandler):
    model_calls = 0
    tool_result = None

    def log_message(self, *_args):
        pass

    def do_GET(self):  # noqa: N802
        stamp = format_datetime(datetime.now(UTC))
        body = (f'<?xml version="1.0"?><rss version="2.0"><channel><title>README fixture</title>'
                f'<link>http://127.0.0.1/</link><description>Illustrative data</description>'
                f'<item><guid>readme-one</guid><title>SPY illustrative event</title><link>http://127.0.0.1/one</link><pubDate>{stamp}</pubDate><description>Fixture only, no investment fact.</description></item>'
                f'<item><guid>readme-two</guid><title>Second illustrative event</title><link>http://127.0.0.1/two</link><pubDate>{stamp}</pubDate><description>Protocol verification.</description></item>'
                '</channel></rss>').encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/rss+xml; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        FixtureHandler.model_calls += 1
        results = [message for message in payload.get('messages', []) if message.get('role') == 'tool']
        if results:
            parsed = json.loads(results[-1]['content'])
            FixtureHandler.tool_result = parsed
            message = {'role': 'assistant', 'content': f"README_PROTOCOL_OK totalValue={parsed.get('totalValue')} evidence={parsed.get('evidenceRecordId')}"}
            finish = 'stop'
        else:
            assert any(tool['function']['name'] == 'portfolio_risk' for tool in payload.get('tools', [])), 'Native portfolio tool not available'
            arguments = {'baseCurrency': 'USD', 'holdings': [{'symbol': 'AAPL', 'quantity': '0.1', 'price': '0.2', 'currency': 'USD'}]}
            message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'readme-call', 'type': 'function', 'function': {'name': 'portfolio_risk', 'arguments': json.dumps(arguments)}}]}
            finish = 'tool_calls'
        result = {'id': 'readme-fixture', 'object': 'chat.completion', 'created': int(time.time()), 'model': 'readme-protocol-fixture', 'choices': [{'index': 0, 'message': message, 'finish_reason': finish}], 'usage': {'prompt_tokens': 1, 'completion_tokens': 1, 'total_tokens': 2}}
        body = json.dumps(result).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class Walkthrough:
    def __init__(self, python: Path, directory: Path):
        self.python = str(python)
        self.directory = directory
        self.workspace = directory / 'workspace'
        self.config = directory / 'config.json'
        self.checks = []
        self.env = dict(os.environ, NO_COLOR='1', COLUMNS='240', TERM='dumb',
                        LITELLM_LOCAL_MODEL_COST_MAP='True', LITELLM_LOCAL_ANTHROPIC_BETA_HEADERS='True')
        self.env.pop('PYTHONPATH', None)
        self.env.pop('MARKETBOT_FINANCE_CONFIG', None)

    def run(self, arguments, *, expect=0, timeout=40):
        result = subprocess.run([self.python, '-m', 'marketbot', '--config', str(self.config), '--workspace', str(self.workspace), *map(str, arguments)], cwd=self.directory, env=self.env, capture_output=True, text=True, timeout=timeout)
        assert result.returncode == expect, f'{arguments}: exit {result.returncode}, expected {expect}: {(result.stdout + result.stderr)[-2500:]}'
        return result.stdout

    def code(self, source, *args, timeout=40):
        result = subprocess.run([self.python, '-c', source, *map(str, args)], cwd=self.directory, env=self.env, capture_output=True, text=True, timeout=timeout)
        assert result.returncode == 0, (result.stdout + result.stderr)[-2500:]
        return result.stdout

    def call(self, tool, arguments=None, *, example=None, expect=0):
        path = ROOT / 'examples' / 'finance' / example if example else self.directory / 'input.json'
        if example is None:
            path.write_text(json.dumps(arguments or {}))
        return json.loads(self.run(['finance', 'call', tool, '--input', path], expect=expect))

    def check(self, name, function, *, data='local/illustrative'):
        started = time.monotonic()
        try:
            details = function()
            self.checks.append({'scenario': name, 'passed': True, 'data': data, 'details': details, 'seconds': round(time.monotonic() - started, 2)})
        except Exception as exc:
            self.checks.append({'scenario': name, 'passed': False, 'data': data, 'error': str(exc)[:3500], 'seconds': round(time.monotonic() - started, 2)})
        print(f"{'PASS' if self.checks[-1]['passed'] else 'FAIL'} {name}", flush=True)

    def bootstrap(self):
        self.run(['onboard'])
        assert self.config.is_file() and (self.workspace / 'AGENTS.md').is_file()
        self.run(['onboard', '--refresh'])
        payload = json.loads(self.run(['status', '--json']))
        assert str(self.workspace) in json.dumps(payload)
        return {'initialized': True, 'refresh': True}

    def inventory(self):
        source = '''import json,io
from contextlib import redirect_stdout
import click
from typer.main import get_command
from marketbot.cli.commands import app
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market.plugin import create_market_tools
from importlib.resources import files
from pathlib import Path
root=get_command(app)
rows={}
def visit(command,path):
    ctx=click.Context(command, info_name=path[-1] if path else "marketbot")
    output=io.StringIO()
    with redirect_stdout(output): help_text=command.get_help(ctx)
    assert help_text or output.getvalue()
    rows[" ".join(path)]=sorted({o for p in command.params for o in p.opts+p.secondary_opts}|{"--help"})
    for name,child in getattr(command,"commands",{}).items():visit(child,path+[name])
visit(root,[])
assert len(create_market_tools(MarketToolsConfig(),Path("workspace")))==18
skills=list(files("marketbot").joinpath("skills").rglob("SKILL.md"))
assert len(skills)==63, len(skills)
print(json.dumps({"commands":rows,"nativeTools":18,"skills":len(skills)}))'''
        inventory = json.loads(self.code(source))
        commands = inventory['commands']
        checked = 0
        import shlex
        for name in ('README.md', 'README_en.md', 'docs/integrations.md'):
            for line in (ROOT / name).read_text().splitlines():
                if not line.startswith('marketbot '):
                    continue
                tokens = shlex.split(line)
                index, path = 1, []
                while index < len(tokens):
                    token = tokens[index]
                    if token in ('--config', '--workspace'):
                        index += 2
                    elif ' '.join([*path, token]) in commands:
                        path.append(token)
                        index += 1
                    else:
                        break
                command_path = ' '.join(path)
                assert command_path, f'{name}: no command in {line}'
                options = set(commands[command_path])
                for token in tokens[index:]:
                    if token.startswith('-'):
                        assert token.split('=')[0] in options, f'{name}: unsupported option {token} for {command_path}'
                checked += 1
        return {**{k: v for k, v in inventory.items() if k != 'commands'}, 'cliEntriesWithHelp': len(commands), 'documentedCommandsValidated': checked}

    def portfolio(self):
        result = self.call('portfolio_risk', example='portfolio.json')
        assert result['totalValue'] == '60000' and result['scenarios'][0]['stressedTotalValue'] == '50000', result
        evidence = self.call('evidence_get', {'evidenceId': result['evidenceRecordId']})
        assert evidence['found'] and evidence['evidence']['payload']['totalValue'] == '60000'
        assert self.call('evidence_list')['records']
        missing = json.loads((ROOT / 'examples/finance/portfolio.json').read_text())
        del missing['fxRates']['HKD']
        error = self.call('portfolio_risk', missing, expect=1)
        assert not error['ok'] and 'totalValue' not in error
        return {'totalValue': '60000', 'stressedTotalValue': '50000', 'missingFxRejected': True, 'evidenceReadBack': True}

    def thesis(self):
        saved = self.call('thesis_tracker', example='thesis.json')
        thesis_id = saved['thesis']['id']
        assert saved['thesis']['confidence'] == 0
        got = self.call('thesis_tracker', {'action': 'get', 'thesisId': thesis_id})
        assert got['thesis']['id'] == thesis_id
        update = self.call('thesis_tracker', {'action': 'update', 'thesisId': thesis_id, 'evidence': 'Illustrative negative comment, not a fact'})
        assert update['verdict'] == 'unchanged'
        review = self.call('thesis_tracker', {'action': 'review', 'thesisId': thesis_id, 'observations': []})
        assert review['verificationStatus'] == 'inconclusive' and review['thesis']['status'] == 'active'
        assert self.call('thesis_tracker', {'action': 'list'})['theses']
        return {'zeroConfidencePreserved': True, 'commentDoesNotFalsify': True, 'missingEvidenceInconclusive': True}

    def watch(self):
        result = self.call('market_watch', example='watch.json')
        watch_id = result['watch']['watchId']
        assert self.call('market_watch', {'action': 'get', 'watchId': watch_id})['watch']
        assert self.call('market_watch', {'action': 'list'})['watches']
        gap = self.call('market_watch', {'action': 'evaluate', 'watchId': watch_id, 'observations': []}, expect=1)
        assert gap['status'] == 'data_gap'
        outbox = self.call('market_watch', {'action': 'outbox', 'watchId': watch_id})
        for alert in outbox['alerts']:
            self.call('market_watch', {'action': 'ack', 'alertId': alert['alertId']})
        assert not self.call('market_watch', {'action': 'outbox', 'watchId': watch_id})['alerts']
        self.run(['finance', 'schedule', watch_id, '--every-minutes', '15'])
        jobs = json.loads(self.run(['finance', 'schedule-list']))
        assert jobs['count'] == 1 and jobs['jobs'][0]['watchId'] == watch_id
        self.run(['finance', 'unschedule', jobs['jobs'][0]['jobId']])
        assert json.loads(self.run(['finance', 'schedule-list']))['count'] == 0
        return {'createQueryAndDataGap': True, 'outboxAcknowledged': True, 'scheduleListAndRemove': True}

    def skills_channels(self):
        assert 'portfolio' in self.run(['skills', 'search', 'portfolio']).lower()
        json.loads(self.run(['skills', 'score', 'show', '--json']))
        self.run(['skills', 'score', 'reset', '--all'])
        channels = json.loads(self.run(['channels', 'status', '--json']))
        assert len(channels['channels']) == 10 and any(row['name'] == 'matrix' for row in channels['channels']), channels
        return {'skillSearchAndScoring': True, 'channels': 10, 'externalAuthentication': 'not_tested'}

    def report_heartbeat(self):
        original = self.config.read_text()
        data = json.loads(original)
        data['tools']['market'].update(quoteSource='mock', newsSources=[], macroSource='manual')
        self.config.write_text(json.dumps(data))
        try:
            event = self.call('market_event_extract', {'headline': 'Illustrative rate cut event', 'symbols': ['600519']})
            assert event.get('evidenceRecordId')
            brief = self.call('market_brief', {'symbols': ['600519'], 'includeNews': False, 'includeMacro': False, 'includeSocial': False, 'includeChips': False, 'includeFundamentals': False})
            assert brief.get('evidenceRecordId') and 'mock' in json.dumps(brief).lower()
            self.run(['market', 'heartbeat-setup', '--symbols', '600519'])
            assert '600519' in (self.workspace / 'HEARTBEAT.md').read_text()
        finally:
            self.config.write_text(original)
        return {'mockDataExplicitlyLabeled': True, 'briefEvidenceRecorded': True, 'heartbeatTemplateWritten': True, 'heartbeatModelExecution': 'not_tested', 'reportCLI': 'only tested with --network; its default supplemental providers require network'}

    def intelligence(self, url):
        self.run(['intel', 'source-add', '--name', 'README fixture', '--type', 'rss', '--url', url])
        assert 'README fixture' in self.run(['intel', 'source-list'])
        self.run(['intel', 'collect'])
        self.run(['intel', 'collect'])
        with sqlite3.connect(self.workspace / 'data' / 'intel.db') as conn:
            assert conn.execute('SELECT count(*) FROM intel_raw_items').fetchone()[0] == 2
        self.run(['intel', 'digest-daily', '--hours', '24', '--limit', '20'])
        self.run(['intel', 'digest-list'])
        with sqlite3.connect(self.workspace / 'data' / 'intel.db') as conn:
            digest_id = conn.execute('SELECT max(id) FROM intel_digests').fetchone()[0]
        assert 'illustrative' in self.run(['intel', 'digest-show', digest_id]).lower()
        self.run(['intel', 'schedule-daily', '--every-minutes', '60'])
        assert 'intel_digest' in self.run(['intel', 'schedule-list'])
        with open(self.workspace / 'cron' / 'jobs.json') as stream:
            jobs = json.load(stream)['jobs']
        self.run(['intel', 'schedule-remove', jobs[0]['id']])
        return {'rssItems': 2, 'deduplicated': True, 'digestStoredAndRead': True, 'intervalScheduling': True}

    def gateway(self):
        # Accelerate only the fixture's polling interval; use the actual persisted job format.
        self.run(['intel', 'schedule-collect', '--every-minutes', '1'])
        store = self.workspace / 'cron' / 'jobs.json'
        jobs = json.loads(store.read_text())
        job = jobs['jobs'][0]
        job['schedule']['everyMs'] = 1000
        job['state']['nextRunAtMs'] = int(time.time() * 1000) + 1500
        store.write_text(json.dumps(jobs))
        with (self.directory / 'gateway.log').open('w') as log:
            process = subprocess.Popen([self.python, '-m', 'marketbot', '--config', str(self.config), '--workspace', str(self.workspace), 'gateway', '--finance-only'], cwd=self.directory, env=self.env, stdout=log, stderr=subprocess.STDOUT)
            success = False
            try:
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        break
                    current = json.loads(store.read_text())['jobs'][0]['state']
                    if current.get('lastStatus') == 'ok' and current.get('lastRunAtMs'):
                        success = True
                        break
                    time.sleep(0.2)
            finally:
                if process.poll() is None:
                    process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        logs = (self.directory / 'gateway.log').read_text()
        assert success and process.returncode == 0, logs[-2500:]
        self.run(['intel', 'schedule-remove', job['id']])
        return {'nativeCronActuallyExecuted': True, 'providerRequired': False, 'sigintExit': 0, 'fixtureIntervalSeconds': 1}

    def mcp(self):
        source = '''import asyncio,json,sys
from mcp import ClientSession,StdioServerParameters
from mcp.client.stdio import stdio_client
async def main():
    params=StdioServerParameters(command=sys.executable,args=["-m","marketbot.mcp.finance","--config",sys.argv[1],"--workspace",sys.argv[2]])
    async with stdio_client(params) as (read,write):
        async with ClientSession(read,write) as session:
            await session.initialize()
            tools=(await session.list_tools()).tools
            assert len(tools)==12 and all(t.annotations.readOnlyHint for t in tools)
            response=await session.call_tool("portfolio_risk",{"baseCurrency":"USD","holdings":[{"symbol":"AAPL","quantity":"0.1","price":"0.2","currency":"USD"}]})
            payload=json.loads(response.content[0].text)
            assert not response.isError and payload["totalValue"]=="0.02"
            invalid=await session.call_tool("portfolio_risk",{"holdings":[]})
            assert invalid.isError
            print(json.dumps({"readOnlyTools":len(tools),"totalValue":payload["totalValue"],"invalidInputRejected":True}))
asyncio.run(main())'''
        return json.loads(self.code(source, self.config, self.workspace))

    def agent(self, url):
        data = json.loads(self.config.read_text())
        data['agents']['defaults'].update(provider='custom', model='readme-protocol-fixture')
        data['providers']['custom'].update(apiKey='no-key', apiBase=url + '/v1')
        self.config.write_text(json.dumps(data))
        output = self.run(['agent', '--no-markdown', '-m', 'Calculate a supplied USD holding: AAPL quantity 0.1, price 0.2. Use portfolio_risk.'], timeout=55)
        assert 'README_PROTOCOL_OK' in output and 'totalValue=0.02' in output, output
        assert FixtureHandler.model_calls == 2 and FixtureHandler.tool_result['evidenceRecordId']
        assert list((self.workspace / 'sessions').glob('*.jsonl'))
        return {'httpModelCalls': 2, 'realToolTotalValue': '0.02', 'evidenceRecorded': True, 'sessionSaved': True, 'actualModelQuality': 'not_tested'}

    def rl(self):
        episode = self.directory / 'episodes.jsonl'
        dataset = self.directory / 'dataset.jsonl'
        self.run(['rl', 'evaluate', '--symbol', 'SPY', '--prices', '100,101,99,103', '--action', 'buy', '--json'])
        self.run(['rl', 'collect', '--symbol', 'SPY', '--prices', '100,101,99,103', '--output', episode, '--json'])
        self.run(['rl', 'build-dataset', '--input', episode, '--output', dataset])
        assert episode.is_file() and dataset.read_text().strip()
        self.run(['rl', 'train', '--dataset', dataset, '--output-dir', self.directory / 'trainer', '--dry-run', '--json'])
        bundle = self.directory / 'openclaw'
        self.run(['rl', 'export-openclaw', '--dataset', dataset, '--output-dir', bundle, '--dry-run', '--json'])
        self.run(['rl', 'inspect-openclaw-run', '--bundle-dir', bundle, '--json'])
        assert list(bundle.glob('*.sh'))
        return {'simulationDatasetAndExports': True, 'parameterTraining': 'not_implemented'}

    def network(self):
        # Probe with financial defaults, no model or paid credentials.
        data = json.loads(self.config.read_text())
        data['tools']['market']['quoteSource'] = 'auto'
        self.config.write_text(json.dumps(data))
        snapshot = self.call('market_snapshot', {'symbols': ['600519', '0700.HK', 'SPY']})
        assert snapshot.get('quotes'), snapshot
        assert all(row.get('provider') and row.get('currency') for row in snapshot['quotes'])
        assert snapshot.get('evidenceRecordId')
        news = self.call('market_news', {'symbols': ['600519'], 'limit': 3})
        macro = self.call('market_macro', {})
        self.run(['market', 'report', '--symbols', '600519', '--save'], timeout=90)
        reports = list((self.workspace / 'reports').glob('*.md'))
        assert reports and any('Quote Observations' in path.read_text() for path in reports)
        result = {'quotes': [{k: row.get(k) for k in ('symbol', 'provider', 'currency', 'observedAt', 'freshness')} for row in snapshot['quotes']], 'newsCount': len(news.get('items', [])), 'newsWarnings': news.get('warnings', []), 'macroWarnings': macro.get('warnings', []), 'accuracy': 'not_independently_verified'}
        result['reportSavedInSelectedWorkspace'] = True
        (self.directory / 'network.json').write_text(json.dumps(result))
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--python', type=Path, default=Path(sys.executable))
    parser.add_argument('--output', type=Path)
    parser.add_argument('--network', action='store_true')
    args = parser.parse_args()
    python = args.python.absolute()  # Do not resolve venv symlinks to the system interpreter.
    with tempfile.TemporaryDirectory(prefix='marketbot-readme-') as directory:
        run = Walkthrough(python, Path(directory))
        server = ThreadingHTTPServer(('127.0.0.1', 0), FixtureHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}'
        try:
            run.check('README_command_options_and_complete_help_inventory', run.inventory)
            run.check('isolated_onboard_refresh_status', run.bootstrap)
            run.check('portfolio_fx_stress_and_evidence', run.portfolio)
            run.check('thesis_zero_confidence_and_explicit_review', run.thesis)
            run.check('watch_data_gap_outbox_and_schedule_management', run.watch)
            run.check('skills_scores_and_ten_channel_status', run.skills_channels)
            run.check('market_brief_evidence_and_heartbeat_template', run.report_heartbeat)
            run.check('RSS_collect_deduplicate_digest_and_schedule', lambda: run.intelligence(url), data='local HTTP RSS fixture')
            run.check('finance_only_gateway_actual_cron_and_shutdown', run.gateway, data='local HTTP RSS fixture')
            run.check('MCP_stdio_initialize_list_and_call', run.mcp, data='real stdio, illustrative portfolio')
            run.check('RL_simulate_collect_dataset_export_and_inspect', run.rl)
            run.check('agent_HTTP_tool_evidence_session_roundtrip', lambda: run.agent(url), data='local HTTP OpenAI-compatible fixture')
            if args.network:
                run.check('public_quote_news_macro_probe', run.network, data='real public sources, no paid credentials')
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)
        result = {'evaluation': 'README installed CLI walkthrough', 'generatedAt': datetime.now(UTC).isoformat(), 'passed': sum(c['passed'] for c in run.checks), 'total': len(run.checks), 'checks': run.checks, 'limitations': ['Real model quality and authenticated channel delivery are not tested', 'Optional browser/Lark/Twitter/Xiaohongshu account workflows are not tested', 'GPU/Slime training and actual Docker image execution are not tested', 'Illustrative fixtures do not establish returns or live-source accuracy']}
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + '\n', encoding='utf-8')
    raise SystemExit(0 if result['passed'] == result['total'] else 1)


if __name__ == '__main__':
    main()
