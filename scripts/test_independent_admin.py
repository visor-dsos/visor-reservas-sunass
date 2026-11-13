"""Focused administrative tests: memory store + temporary synthetic XLSX, no network."""
import sys,json,secrets,hashlib,tempfile,time
from pathlib import Path
from datetime import datetime
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.service import Service,ApiError,PREFIX,BUCKET,COOKIE,encode,pack,R2
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from openpyxl import Workbook
class Memory:
 def __init__(self):self.data={};self.fail=False
 def get(self,k):return self.data.get(k,(None,None))
 def put(self,k,b,etag=None,new=False,public=False):
  if self.fail and k==PREFIX+'current.json':raise ApiError(503,'Injected storage failure')
  old=self.get(k)[1]
  if new and old is not None or etag and old!=etag:raise ApiError(409,'Conflict')
  tag=hashlib.sha256(b).hexdigest();self.data[k]=(b,tag);return tag
 def remove(self,k,etag):
  assert self.get(k)[1]==etag;del self.data[k]
 def upload(self,k,size):return 'https://upload.invalid/'+k
checks=[]
def check(v,label):assert v,label;checks.append(label)
def rejects(fn,status,label):
 try:fn()
 except ApiError as e:check(e.status==status,label)
 else:raise AssertionError(label)
salt=secrets.token_bytes(24);password=secrets.token_urlsafe(24)
env={'ADMIN_ENCRYPTION_KEY':encode(secrets.token_bytes(32)),'ADMIN_ORIGIN':'https://visor-reservas-sunass.vercel.app','ADMIN_PASSWORD_HASH':'600000$'+encode(salt)+'$'+encode(hashlib.pbkdf2_hmac('sha256',password.encode(),salt,600000))}
store=Memory();s=Service(store,env);origin=env['ADMIN_ORIGIN']
rejects(lambda:s.request('upload',{},origin=origin),401,'Unauthenticated uploads rejected')
rejects(lambda:s.request('activate',{},origin=origin),401,'Unauthenticated activation rejected')
rejects(lambda:s.request('login',{'password':password},origin='https://visor-merese-sunass.vercel.app'),403,'Original origin rejected')
_,cookie=s.request('login',{'password':password},origin=origin);cookie=cookie.split(';')[0];session,csrf=s.session(cookie)
check(cookie.startswith(COOKIE+'='),'Independent host cookie')
rejects(lambda:s.request('overview',{},cookie,origin,'bad'),403,'CSRF rejected')
check(s.overview()['eps']==50,'Baseline 50 EPS');baseline=s.active()[0]
rejects(lambda:s.request('upload',{'kind':'financial','size':2,'name':'bad.xls'},cookie,origin,csrf),400,'Non XLSX rejected')
def grant(raw):
 g,_=s.request('upload',{'kind':'financial','name':'test.xlsx','size':len(raw)},cookie,origin,csrf);t,_=s.secret_get('upload/'+g['id']);nonce=secrets.token_bytes(12);store.put(t['key'],nonce+AESGCM(__import__('base64').b64decode(g['encryptionKey'])).encrypt(nonce,raw,None));return {'financial':g['id'],'mode':'financial','financial_date':'2026-10-26'}
rejects(lambda:s.prepare(grant(b'not an excel'),session),422,'Corrupt XLSX rejected')
check(store.get(PREFIX+'current.json')[0] is None,'Invalid input preserves pointer')
with tempfile.TemporaryDirectory() as tmp:
 w=Workbook();a=w.active;a.title='Implementacion';a.append(['COD_EP','Fecha','Tematica','Saldo_acumulado','x4','x5','x6','x7','x8','Ejecucion'])
 codes=list(json.loads(s.version_file(baseline['version'],'finanzas_eps.json'))['eps'])
 for c in codes:
  for theme in ['MERESE','GRD Y ACC']:a.append([int(c),datetime(2026,8,1),theme,100,None,None,None,None,None,0])
 e=w.create_sheet('Ejecucion');head=['COD_EP','EP','ODS','FECHA_INICIO_PR','DURACION_PR','AÑO REGULATORIO VIGENTE']
 for prefix in ['PROGRAMADO','EJECUCION','% META','GRD PROGRAMADO','GRD EJECUCION','GRD % META']:head += [prefix+' '+str(n) for n in range(1,6)]
 e.append(head)
 for c in codes:e.append([int(c),'EPS','ODS',datetime(2022,1,1),5,5]+[None]*30)
 a=w.create_sheet('Ejeseparado');h=['COD_EP']+[f'col{i}' for i in range(1,31)]
 for start,prefix in [(6,'PROGRAMADO'),(11,'EJECUCION'),(21,'GRD PROGRAMADO'),(26,'GRD EJECUCION')]:
  for i in range(5):h[start+i]=prefix+' '+str(i+1)
 a.append(h)
 for c in codes:a.append([int(c)]+[None]*30)
 path=Path(tmp)/'fixture.xlsx';w.save(path)
 report=s.prepare(grant(path.read_bytes()),session)
check(report['status']=='validated','Valid XLSX staged')
check(store.get(PREFIX+'current.json')[0] is None,'Preview cannot activate')
check(report['proposed']['cutoff']=='2026-08-01','Cutoff comes from data')
check(report['before']['updated_at']==baseline['updated_at'],'Preview preserves financial date')
version=report['proposed']['version'];data=json.loads(s.version_file(version,'finanzas_eps.json'))
check(data['eps'][codes[0]]['implementacion'][0]['ejecucion']==0,'Zero preserved')
check(data['eps'][codes[0]]['regulatorio']['programado'][0] is None,'Null preserved')
check(s.version_file(version,'maestro_eps.json')==s.version_file(baseline['version'],'maestro_eps.json'),'Financial update preserves master')
rejects(lambda:s.activate({'job':report['job']},session),400,'Explicit activation required')
store.fail=True;rejects(lambda:s.activate({'job':report['job'],'confirm':True},session),503,'Storage activation failure surfaced');store.fail=False
check(s.active()[0]==baseline,'Failed activation preserves baseline and financial timestamp')
with patch('admin_production.service.now',return_value='2026-11-14T02:30:00+00:00'):
 r=s.activate({'job':report['job'],'confirm':True},session)
check(r['active']['financial_updated_at']=='2026-11-14T02:30:00+00:00','Financial date uses server activation (13 November in Lima), not declared date')
check(r['active']['activated_at']==r['active']['financial_updated_at'],'One atomic activation timestamp')
check(r['active']['version']==version,'Activation persisted')
check(Service(store,env).active()[0]['version']==version,'New process reads persisted version')
rejects(lambda:s.activate({'job':report['job'],'confirm':True},session),409,'Stale preview rejected')
rejects(lambda:s.rollback({'version':baseline['version']}),400,'Rollback confirmation required')
s.rollback({'version':baseline['version'],'confirm':True});check(s.active()[0]['version']==baseline['version'],'Rollback restores previous version')
check(s.active()[0]['updated_at']==baseline['updated_at'],'Recovery preserves original financial date')
s.rollback({'version':version,'confirm':True})
check(s.active()[0]['financial_updated_at']=='2026-11-14T02:30:00+00:00','Recovery retains activated financial date without changing immutable manifest')
# Reuse staged files to isolate master-only timestamp semantics; no additional Excel processing.
before,etag=s.active();job=secrets.token_hex(16);meta={**before,'mode':'master'}
s.secret_put('candidates/'+job,{'owner':session['hash'],'expires':time.time()+60,'before_etag':etag,'before':before,'manifest':meta},new=True)
with patch('admin_production.service.now',return_value='2026-11-15T06:00:00+00:00'):
 result=s.activate({'job':job,'confirm':True},session)['active']
check(result['financial_updated_at']==before['financial_updated_at'],'Master-only activation preserves financial timestamp')
check(result['activated_at']=='2026-11-15T06:00:00+00:00','Master activation records its own operation time')
check(s.overview()['ods']==25 and s.overview()['themes']==['MERESE','GRD'],'Overview derives institutional and thematic summary')
check(s.version_file(version,'finanzas_eps.json') is not None,'Backup retained')
check(all(k.startswith(PREFIX) for k in store.data),'All writes isolated under new prefix')
with patch.dict('os.environ',{'R2_BUCKET':'visor-merese-sunass'}):
 try:R2()
 except ValueError:check(True,'Original bucket refused')
 else:raise AssertionError('Original bucket accepted')
s.request('logout',{},cookie,origin,csrf);rejects(lambda:s.session(cookie),401,'Logout revokes session')
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False))
