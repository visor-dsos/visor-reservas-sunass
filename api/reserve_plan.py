"""Public EPS-scoped plans gateway. Never exposes the complete source workbook."""
import json,re,sys,hashlib
from pathlib import Path
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.service import R2,PREFIX,BASELINE,VERSION
from admin_production.plan_export import export
class handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   q=parse_qs(urlparse(self.path).query);version=q.get('version',[''])[0];code=q.get('code',[''])[0];download=q.get('download',[''])[0]=='1'
   if not re.fullmatch(VERSION,version) or not re.fullmatch(r'\d{1,3}',code):return self.reply(400,{'error':'Seleccione una EPS válida y una versión financiera.'})
   store=R2();baseline=json.loads((BASELINE/'manifest.json').read_bytes())
   def read(name):
    raw,_=store.get(PREFIX+'versions/'+version+'/'+name)
    if raw is None and version==baseline['version'] and (BASELINE/name).exists():raw=(BASELINE/name).read_bytes()
    return raw
   raw=read('planes_merese.json')
   if raw is None:return self.reply(404,{'error':'Esta versión no dispone de planes. Cargue y active el Excel con Base Trabajable desde el administrador.'})
   plans=json.loads(raw);p=plans.get('eps',{}).get(code)
   if not p or p['status']!='available':return self.reply(422,{'error':p.get('reason') if p else 'Sin medidas disponibles para esta EPS en la versión seleccionada.'})
   financial=read('finanzas_eps.json')
   if not financial or hashlib.sha256(financial).hexdigest()!=plans.get('financial_sha256'):return self.reply(409,{'error':'El plan no corresponde a esta versión financiera; requiere validación.'})
   manifest=json.loads(read('manifest.json'));cutoff=manifest.get('cutoff') or max((r['fecha'] for e in json.loads(financial)['eps'].values() for k in ('implementacion','implementacion_grd_acc') for r in e.get(k,[]) if r.get('fecha')),default=None)
   if download:
    body=export(p,manifest.get('financial_version',version),cutoff);self.send_response(200);self.send_header('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');self.send_header('Content-Disposition','attachment; filename="Plan_Intervenciones_MERESE_COD_EP_'+code+'.xlsx"');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
   else:self.reply(200,{'code':code,'name':p['name'],'measures':len(p['measures']),'resolution':p['resolution'],'notes':p['notes']})
  except Exception:self.reply(503,{'error':'No se pudo consultar el plan. Intente nuevamente.'})
 def reply(self,status,data):
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(json.dumps(data,ensure_ascii=False).encode())
