"""Explicit disposable-engine verification; never runs against the application graph."""
import hashlib
import os
import unittest
import uuid

from graphrag_sdk import ConnectionConfig, FalkorDBConnection
from aiohttp.test_utils import TestClient, TestServer
from delivery.config import Settings
from delivery.context import implementation_context
from delivery.documents import index_document, document_passages
from delivery.graph import DeliveryGraph
from delivery.retrieval import search_delivery
from delivery.server import create_app


class EngineTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.name = 'brainee_test_rag_' + uuid.uuid4().hex
        self.connection = FalkorDBConnection(ConnectionConfig(host='127.0.0.1',
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

    async def test_document_index_checksum_and_current_version(self):
        await index_document(self.graph, 'reader', 'doc', self.content)
        result = await document_passages(self.graph, 'reader', {'documentId':'doc','query':'identity'})
        self.assertEqual(len(result['passages']), 1)
        self.assertIn('identity provider', result['passages'][0]['text'])
        await self.connection.graph.query("MATCH (d:DocumentVersion {id:'doc'}) SET d.checksum='changed'")
        result = await document_passages(self.graph, 'reader', {'documentId':'doc'})
        self.assertEqual(result['document']['indexStatus'], 'not_indexed')
        self.assertEqual(result['passages'], [])

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
