import json,sys
from pathlib import Path
from io import BytesIO
import openpyxl
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.plan_export import export
root=Path(__file__).resolve().parents[1];p=json.loads((root/'admin_production/baseline/planes_merese.json').read_bytes());f=json.loads((root/'admin_production/baseline/finanzas_eps.json').read_bytes());count=0
for c in ['14','43','45','31','37','42','16','8']:
 plan=p['eps'][c];r=f['eps'][c]['regulatorio'] or {};assert plan['status']=='available';assert plan['start']==r.get('FECHA_INICIO_PR') and plan['duration']==r.get('DURACION_PR');assert plan['current_year']==r.get('ANIO_REGULATORIO_VIGENTE',r.get('anio_vigente'))
 if c!='8':assert plan['difference']==0
 else:assert plan['reference_estimate'] is None and plan['total']==300000
 w=openpyxl.load_workbook(BytesIO(export(plan,p['financial_version'],'2026-08-01')));assert w['Plan de intervenciones'].max_row==len(plan['measures'])+4;assert w['Plan de intervenciones']['G3'].value=='Año regulatorio 5';assert w['Resumen']['B7'].value==(plan['duration'] if plan['duration'] is not None else 'No disponible');count+=1
print(json.dumps({'remaining_eps_passed':count,'source_rows':p['summary']['source_rows'],'financial_metadata_preserved':True,'tumbes_reference_unavailable':True}))
