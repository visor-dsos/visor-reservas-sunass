"""Read-only public runtime gateway. No private/upload keys are addressable."""
import json,re,sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.service import R2,PREFIX,BASELINE,VERSION,PUBLIC_FILES
class handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   query=parse_qs(urlparse(self.path).query);version=query.get('version',[''])[0];name=query.get('file',['current.json'])[0];store=R2()
   baseline=json.loads((BASELINE/'manifest.json').read_bytes())
   if not version and name=='current.json':
    raw,_=store.get(PREFIX+'current.json');raw=raw or json.dumps(baseline).encode()
   elif re.fullmatch(VERSION,version) and name in PUBLIC_FILES:
    raw,_=store.get(PREFIX+'versions/'+version+'/'+name)
    if raw is None and version==baseline['version']:raw=(BASELINE/name).read_bytes()
    if raw is None:self.send_error(404);return
   else:self.send_error(404);return
   self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(raw)
  except Exception:
   self.send_response(503);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b'{"error":"Runtime unavailable"}')
