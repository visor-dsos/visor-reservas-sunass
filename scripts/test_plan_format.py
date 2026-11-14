"""Only revised workbook format and Tumbes policy; no source reconciliation."""
import sys,json,hashlib
from pathlib import Path
from io import BytesIO
import openpyxl
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.plan_export import export
from admin_production.plan_policy import UNAPPROVED_MERESE
root=Path(__file__).resolve().parents[1];base=root/'admin_production/baseline';data=json.loads((base/'planes_merese.json').read_bytes());checks=[]
def check(ok,label):
 assert ok,label
 checks.append(label)
check(data['summary']['available_eps']==49 and data['summary']['measures']==333,'49 approved EPS / 333 retained measures')
check(data['eps']['8']['status']=='unapproved' and '8' in UNAPPROVED_MERESE,'Tumbes blocked')
check(len(data['eps']['8']['measures'])==9 and data['eps']['8']['total']==300000,'Tumbes traceability intact')
check(data['financial_sha256']==hashlib.sha256((base/'finanzas_eps.json').read_bytes()).hexdigest(),'Financial binding unchanged')
for code in ['11','10']:
 p=data['eps'][code];raw=export(p,data['financial_version'],'2026-08');w=openpyxl.load_workbook(BytesIO(raw));s=w.active
 check(w.sheetnames==['Plan de intervenciones'],'Single sheet '+code)
 check(s.max_row==len(p['measures'])+5,'All measures '+code)
 check([c.value for c in s[4]]==['Medida o actividad','Año 1','Año 2','Año 3','Año 4','Año 5','Total'],'Five years '+code)
 check(s['A2'].value=='EPS: '+p['name'] and 'Inicio del PR:' in s['A3'].value,'Compact metadata '+code)
 check(s['A5'].value==p['measures'][0]['description'],'Complete description '+code)
 check(s.cell(s.max_row,7).value==p['total'],'Numeric total '+code)
 check(not any(c.data_type=='f' or c.hyperlink for row in s for c in row),'No external formulas '+code)
 if code=='11':check(p['total']==3603250.67,'SEDACAJ regression')
 if code=='10':check(s['E5'].value=='No aplica' and s['F5'].value=='No aplica' and s['B5'].value==0,'Zero and inapplicable distinct')
 (root.parent/('plan-final-'+code+'.xlsx')).write_bytes(raw)
print(json.dumps({'passed':len(checks),'checks':checks}))
