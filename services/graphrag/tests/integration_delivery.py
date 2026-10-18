"""Explicit disposable-engine verification; never runs against the application graph."""
import hashlib
import os
import unittest
import uuid
import json
from pathlib import Path

from graphrag_sdk import ConnectionConfig, FalkorDBConnection
from aiohttp.test_utils import TestClient, TestServer
from delivery.config import Settings
from delivery.context import implementation_context
from delivery.documents import index_document, document_passages, record_index_failure
from delivery.graph import DeliveryGraph
from delivery.retrieval import search_delivery
from delivery.server import create_app
from delivery.encoder import LocalEncoder
from delivery.semantic import SemanticIndex


class EngineTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.name = 'brainee_test_rag_' + uuid.uuid4().hex
        self.connection = FalkorDBConnection(ConnectionConfig(host=os.environ.get('GRAPH_TEST_HOST', '127.0.0.1'),
            port=int(os.environ['GRAPH_TEST_PORT']), graph_name=self.name, retry_count=1))
        self.graph = DeliveryGraph(self.connection)
        self.content = b'SSO authentication uses an identity provider. Original estimate: eight hours.'
        await self.connection.graph.query('''CREATE (a:Employee {id:'reader',isActive:true}),
(dead:Employee {id:'inactive',isActive:false}),
(p:Project {id:'old',code:'OLD',name:'Customer portal',status:'active',description:'SSO login'}),
(q:Project {id:'new',code:'NEW',name:'New portal',status:'active'}),
(t:Task {id:'root',projectId:'old',taskNumber:1,title:'Single sign on',description:'SSO authentication and payment checkout webhook',status:'done',estimateHours:100}),
(c:Task {id:'child',projectId:'old',parentTaskId:'root',taskNumber:2,title:'Identity provider callback',description:'SSO callback',status:'done',estimateHours:8,actualHours:10}),
(m:Task {id:'missing',projectId:'old',parentTaskId:'root',taskNumber:3,title:'SSO tests',status:'in_progress'}),
(p)-[:HAS_TASK]->(t),(p)-[:HAS_TASK]->(c),(p)-[:HAS_TASK]->(m),
(c)-[:PARENT_TASK]->(t),(m)-[:PARENT_TASK]->(t),
(d:DocumentVersion {id:'doc',projectId:'old',title:'SSO spec',version:1,status:'final',mimeType:'text/plain',checksum:$checksum,r2Key:'private/storage'}),
(d)-[:IN_PROJECT]->(p),
(n:Comment {id:'decision',projectId:'old',isDecision:true,body:'SSO uses OpenID Connect',createdAt:1}),(n)-[:IN_PROJECT]->(p),
(u:DailyUpdate {id:'update',projectId:'old',status:'submitted',date:'2026-10-17',summary:'SSO callback complete',blockers:'Waiting for provider'}),(u)-[:IN_PROJECT]->(p),
(e:Employee {id:'contributor',name:'Sample person',isActive:true,salary:99999}),
(pm:ProjectMembership {id:'member',isCurrent:true,role:'developer'}),
(e)-[:HAS_MEMBERSHIP]->(pm),(pm)-[:IN_PROJECT]->(p)''', params={'checksum': hashlib.sha256(self.content).hexdigest()})

    async def asyncTearDown(self):
        assert self.name.startswith('brainee_test_rag_')
        await self.connection.graph.delete()
        await self.connection.close()

    async def test_cross_project_search_and_hierarchy(self):
        await self.graph.authenticate('reader')
        result = await search_delivery(self.graph, 'reader', {'query':'login','concepts':['sso'], 'limit':50})
        self.assertIn('root', [item['id'] for item in result['matches']])
        self.assertNotIn('private/storage', str(result))
        result = await implementation_context(self.graph, 'reader', {'projectId':'OLD','taskId':'child','limit':1})
        self.assertEqual(result['rootTaskId'], 'root')
        self.assertTrue(result['tasks']['hasMore'])
        self.assertEqual(result['estimateSummary']['estimatedHours'], 8)
        self.assertEqual(result['estimateSummary']['actualHours'], 10)
        self.assertEqual(result['estimateSummary']['missingLeafEstimates'], 1)
        self.assertFalse(result['estimateSummary']['completeEstimates'])
        self.assertNotIn('salary', str(result))
        with self.assertRaises(ValueError):
            await implementation_context(self.graph, 'reader', {'projectId':'new','taskId':'child'})
        with self.assertRaises(PermissionError):
            await self.graph.authenticate('inactive')

    async def test_payments_reference_example(self):
        result = await search_delivery(self.graph, 'reader', {'query':'payments',
            'concepts':['payment','checkout','webhook'], 'limit':10})
        match = next(item for item in result['matches'] if item['id'] == 'root')
        self.assertEqual(match['source']['label'], 'OLD #1')
        self.assertEqual(result['documentCoverage']['unindexedDocuments'], 1)
        context = await implementation_context(self.graph, 'reader', {'projectId':match['projectId'], 'taskId':match['id']})
        self.assertEqual(context['estimateSummary']['estimatedHours'], 8)

    async def test_semantic_index_paraphrase_and_changed_source(self):
        index = SemanticIndex(self.graph, LocalEncoder())
        self.graph.semantic = index
        await index.setup()
        await index.sync()
        exact = await index.search('reader', 'Identity provider callback SSO callback', 10)
        self.assertEqual(exact[0]['item']['id'], 'child')
        self.assertGreater(exact[0]['semanticScore'], 0.9)
        result = await search_delivery(self.graph, 'reader', {'query': 'Handle payment gateway webhook callbacks', 'limit': 10})
        self.assertIn('root', [item['id'] for item in result['matches']])
        self.assertTrue(any('semantic' in item['retrievalReasons'] for item in result['matches']))
        await self.connection.graph.query("MATCH (t:Task {id:'root'}) SET t.description='Prepare team calendar' RETURN t.id")
        # Stale vectors cannot replay evidence from an earlier version.
        rows = await index.search('reader', 'payment checkout', 10)
        self.assertNotIn('root', [row['item']['id'] for row in rows])
        await index.sync()
        self.assertEqual(index.stats['state'], 'ready')
        await self.connection.graph.query("MATCH (d:DocumentVersion {id:'doc'}) SET d.status='superseded' RETURN d.id")
        rows = await index.search('reader', 'SSO specification identity provider', 10)
        self.assertNotIn('doc', [row['item']['id'] for row in rows])

    async def test_retrieval_quality_corpus(self):
        fixtures = [
            {'id': 'payment', 'title': 'Charge customer cards with Stripe', 'description': 'Checkout authorizes and captures credit card transactions.'},
            {'id': 'refund', 'title': 'Return funds to the original card', 'description': 'Refunds reverse purchases and reconcile gateway events with ledger entries.'},
            {'id': 'sso', 'title': 'Corporate identity provider sign-in', 'description': 'Staff authenticate using corporate accounts with OpenID Connect single sign on and employee login federation.'},
            {'id': 'notification', 'title': 'Notify users when an order ships', 'description': 'Send shipment status email, package dispatch messages and delivery alerts to customers.'},
            {'id': 'ingestion', 'title': 'Upload documents into the knowledge base', 'description': 'Make incoming files searchable, extract attachment text, and track indexing failures.'},
        ]
        await self.connection.graph.query('''MATCH (p:Project {id:'old'}) UNWIND $fixtures AS item
CREATE (t:Task {id:item.id,projectId:'old',title:item.title,description:item.description,status:'done'})
MERGE (p)-[:HAS_TASK]->(t)''', params={'fixtures': fixtures})
        self.graph.semantic = SemanticIndex(self.graph, LocalEncoder())
        await self.graph.semantic.setup()
        await self.graph.semantic.sync()
        await self.connection.graph.query("""MATCH (p:Project {id:'old'})
CREATE (n:Comment {id:'explicit-task-evidence',taskId:'payment',projectId:'old',isDecision:true,
body:'Approval applies to this implementation',createdAt:2}) MERGE (n)-[:IN_PROJECT]->(p)""")
        cases = json.loads((Path(__file__).parent / 'retrieval_corpus.json').read_text())
        outcomes = []
        for case in cases:
            result = await search_delivery(self.graph, 'reader', {'query': case['query'], 'limit': 15})
            for item in result['matches']:
                if item.get('semanticScore') is not None:
                    self.assertGreaterEqual(item['semanticScore'], 0.28)
                    self.assertLessEqual(item['semanticScore'], 1.000001)
            ids = [item['id'] for item in result['matches'] if item['type'] == 'task'][:5]
            rank = ids.index(case['expected']) + 1 if case['expected'] in ids else None
            outcomes.append({**case, 'returned': ids, 'rank': rank, 'latencyMs': result['diagnostics']['latencyMs']})
        mrr = sum(1 / row['rank'] if row['rank'] else 0 for row in outcomes) / len(outcomes)
        recall = sum(bool(row['rank']) for row in outcomes) / len(outcomes)
        print('RETRIEVAL_EVALUATION ' + json.dumps({'cases': outcomes, 'recallAt5': recall, 'mrrAt5': mrr}))
        self.assertGreaterEqual(recall, 0.9)
        self.assertGreaterEqual(mrr, 0.65)
        unrelated = await search_delivery(self.graph, 'reader', {'query':'Cultivate tomato seedlings in a greenhouse', 'limit':15})
        self.assertEqual(unrelated['matches'], [])
        result = await search_delivery(self.graph, 'reader', {'query':'Charge customer cards with Stripe', 'limit':50})
        linked = next(item for item in result['matches'] if item['id']=='explicit-task-evidence')
        self.assertEqual(linked['evidencePath']['fromId'], 'payment')

    async def test_document_index_checksum_and_current_version(self):
        for _ in range(5):
            await record_index_failure(self.graph, 'reader', 'doc')
        failed = await self.connection.graph.ro_query("MATCH (d:DocumentVersion {id:'doc'}) RETURN d.deliveryIndexStatus,d.deliveryIndexAttempts")
        self.assertEqual(failed.result_set[0], ['failed', 5])
        await index_document(self.graph, 'reader', 'doc', self.content)
        result = await document_passages(self.graph, 'reader', {'documentId':'doc','query':'identity'})
        self.assertEqual(len(result['passages']), 1)
        self.assertIn('identity provider', result['passages'][0]['text'])
        await self.connection.graph.query("MATCH (d:DocumentVersion {id:'doc'}) SET d.checksum='changed'")
        result = await document_passages(self.graph, 'reader', {'documentId':'doc'})
        self.assertEqual(result['document']['indexStatus'], 'not_indexed')
        self.assertEqual(result['passages'], [])
        await record_index_failure(self.graph, 'reader', 'doc')
        changed = await self.connection.graph.ro_query("MATCH (d:DocumentVersion {id:'doc'}) RETURN d.deliveryIndexAttempts")
        self.assertEqual(changed.result_set[0][0], 1)

    async def test_http_boundaries(self):
        client = TestClient(TestServer(create_app(Settings(self.connection.config if hasattr(self.connection,'config') else None, 'private-token'), self.graph)))
        await client.start_server()
        try:
            self.assertEqual((await client.post('/operations',json={})).status,401)
            headers={'authorization':'Bearer private-token'}
            base={'actorId':'reader','operation':'delivery.search','payload':{'query':'SSO'}}
            self.assertEqual((await client.post('/operations',headers=headers,json=base)).status,200)
            upload_headers = {**headers, 'x-graph-actor':'reader'}
            self.assertEqual((await client.post('/documents/doc/index', headers=upload_headers, data=b'wrong')).status, 400)
            response = await client.post('/documents/doc/index', headers=upload_headers, data=self.content)
            self.assertEqual(response.status, 200)
            self.assertEqual((await response.json())['data']['status'], 'indexed')
            self.assertEqual((await client.get('/ready', headers=headers)).status, 200)
            base['operation']='data.execute'
            self.assertEqual((await client.post('/operations',headers=headers,json=base)).status,400)
            base['operation']='delivery.search';base['actorId']='inactive'
            self.assertEqual((await client.post('/operations',headers=headers,json=base)).status,400)
        finally:
            await client.close()


if __name__ == '__main__':
    unittest.main()
