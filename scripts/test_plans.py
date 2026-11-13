"""Focused plan tests; local memory and temporary workbooks only."""
import sys,json,hashlib,tempfile,secrets,time,copy
from pathlib import Path
from io import BytesIO
from unittest.mock import patch
from datetime import datetime
import openpyxl
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.plans import build
from admin_production.plan_export import export
from admin_production.service import Service,PREFIX,pack,encode,ApiError
root=Path(__file__).resolve().parents[1];baseline=root/'admin_production/baseline';data=json.loads((baseline/'planes_merese.json').read_bytes());financial=json.loads((baseline/'finanzas_eps.json').read_bytes());version=json.loads((baseline/'manifest.json').read_bytes())['version'];known={i['COD_EP']:i for i in json.loads((root/'admin_production/institutions.json').read_bytes())};checks=[]
def check(ok,name):assert ok,name;checks.append(name)
check(data['summary']['source_rows']==342,'342 MRSE source measures')
check(data['summary']['measures']==342 and data['summary']['available_eps']==50,'342 applicable measures / 50 EPS')
check(sum(e['total'] or 0 for e in data['eps'].values() if e['status']=='available')==131931684.67,'Selected plan total')
check(all(e['difference']==0 for e in data['eps'].values() if e['status']=='available' and e['reference_estimate'] is not None),'Exact reconciliation to annual estimates for comparable EPS')
check(data['financial_sha256']==hashlib.sha256((baseline/'finanzas_eps.json').read_bytes()).hexdigest(),'Initial plans bound to unchanged active financial bytes')
for code in ['3','10']:
 p=data['eps'][code];raw=export(p,version,'2026-08-01');w=openpyxl.load_workbook(BytesIO(raw));s=w['Plan de intervenciones']
 check(w.sheetnames==['Resumen','Plan de intervenciones'],'Two sheets '+code)
 check(s.max_row==len(p['measures'])+4,'Every measure retained '+code)
 check(s.max_column==8 and s['G3'].value=='Año regulatorio 5','All five years '+code)
 check(s.freeze_panes=='C4' and s.auto_filter.ref=='A3:H'+str(s.max_row-1),'Freeze and filter '+code)
 check(s.page_setup.orientation=='landscape','Print landscape '+code)
 check(not any(c.data_type=='f' or c.hyperlink for sh in w for row in sh for c in row),'No executable formulas or external links '+code)
 check(s['B4'].value==p['measures'][0]['description'],'Full description '+code)
 check(s.cell(s.max_row,8).value==p['total'],'Totals numeric '+code)
 if code=='10':check(s['F4'].value=='No aplica' and s['G4'].value=='No aplica' and s['C4'].value==0,'Short PR / no applicability / zero distinct')
 (root.parent/('plan-sample-'+code+'.xlsx')).write_bytes(raw)
check(data['eps']['8']['status']=='available' and data['eps']['8']['duration'] is None,'Unavailable regulatory metadata is not invented')
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp)/'source.xlsx';w=openpyxl.Workbook();s=w.active;s.title='Base Trabajable';s.append(['TEMA','Resolución','F_INI','Cod EP','EP','Ultima Reso','Año de Periodo Regulatorio','CAT1','CAT2','MEDIDA','Año 1','Año 2','Año 3','Año 4','Año 5'])
 start=datetime.fromisoformat(financial['eps']['3']['regulatorio']['FECHA_INICIO_PR']);s.append([' MRSE ','R-1',start,3,'Wrong name','SI',99,None,None,'=HYPERLINK("https://example.invalid")',0,1,2,3,4]);s['J2'].data_type='s';s.append(['GRDyACC','R-1',start,3,'Wrong','SI',99,None,None,'GRD',999,999,999,999,999]);s.append(['MRSE','Historical',datetime(2010,1,1),3,'Wrong','NO',99,None,None,'Old',999,999,999,999,999]);w.save(p)
 result=build(p,financial,known);plan=result['eps']['3'];check(len(plan['measures'])==1 and plan['total']==10,'MRSE only, historical resolution excluded')
 check(plan['name']==known['3']['EP'] and plan['current_year']!=99,'Canonical identity and regulatory metadata; G ignored')
 check(result['eps']['10']['status']=='unavailable','EPS without measures unavailable')
 out=openpyxl.load_workbook(BytesIO(export(plan,version,'2026-08-01')));check(out['Plan de intervenciones']['B4'].data_type=='s','Formula-like description remains text')
 s.append(['MRSE','R-2',start,3,'Wrong','SI',99,None,None,'Ambiguous',1,2,3,4,5]);w.save(p);check(build(p,financial,known)['eps']['3']['status']=='pending','Ambiguous amendments not combined')
class Memory:
 def __init__(self):self.data={};self.fail=False
 def get(self,k):return self.data.get(k,(None,None))
 def put(self,k,b,etag=None,new=False,public=False):
  if self.fail and k==PREFIX+'current.json':raise ApiError(503,'test failure')
  old=self.get(k)[1]
  if new and old or etag and old!=etag:raise ApiError(409,'conflict')
  tag=hashlib.sha256(b).hexdigest();self.data[k]=(b,tag);return tag
 def remove(self,k,etag):del self.data[k]
store=Memory();svc=Service(store,{'ADMIN_ORIGIN':'https://visor-reservas-sunass.vercel.app','ADMIN_ENCRYPTION_KEY':encode(secrets.token_bytes(32))});before,_=svc.active();new='20261113T220000Z_aabbccdd';sha={}
for name in ['finanzas_eps.json','maestro_eps.json','validation.json','master_validation.json','planes_merese.json']:
 b=(baseline/name).read_bytes();store.put(PREFIX+'versions/'+new+'/'+name,b);sha[name]=hashlib.sha256(b).hexdigest()
meta={**before,'version':new,'mode':'financial','previous_version':before['version'],'sha256':sha};job='a'*32;session={'hash':'local'};store.put(PREFIX+'versions/'+new+'/manifest.json',pack(meta));svc.secret_put('candidates/'+job,{'owner':'local','expires':time.time()+60,'before_etag':None,'before':before,'manifest':meta},new=True)
check(svc.active()[0]==before,'Staged plans cannot activate finances or date')
store.fail=True
try:svc.activate({'job':job,'confirm':True},session)
except ApiError:pass
store.fail=False;check(svc.active()[0]==before,'Failed activation keeps prior plans/version/date')
svc.activate({'job':job,'confirm':True},session);active=svc.active()[0];check(svc.version_file(active['version'],'planes_merese.json')== (baseline/'planes_merese.json').read_bytes(),'Atomic version includes plan dataset')
svc.rollback({'version':before['version'],'confirm':True});check(svc.active()[0]['version']==before['version'] and svc.version_file(before['version'],'planes_merese.json')==(baseline/'planes_merese.json').read_bytes(),'Rollback restores matching plans')
check(all(k.startswith(PREFIX) for k in store.data),'Exclusive namespace')
print(json.dumps({'passed':len(checks),'checks':checks}))
