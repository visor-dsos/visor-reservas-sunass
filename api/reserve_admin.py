"""Vercel Python Function entry point. Configure private environment only."""
import sys,json,os
from pathlib import Path
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from admin_production.service import Service,R2,ApiError
class handler(BaseHTTPRequestHandler):
    def do_GET(self):self.handle_admin_request()
    def do_POST(self):self.handle_admin_request()
    def handle_admin_request(self):
        status=200;cookie=None
        try:
            action=parse_qs(urlparse(self.path).query).get('action',['session'])[0]
            if self.command=='GET' and action!='session':raise ApiError(405,'POST requerido.')
            length=int(self.headers.get('Content-Length','0'))
            if length>16384:raise ApiError(413,'Solo referencias JSON; no cargue Excel a esta Function.')
            if self.command=='POST' and self.headers.get('Content-Type','').split(';')[0]!='application/json':raise ApiError(415,'JSON requerido.')
            body=json.loads(self.rfile.read(length)) if length else {}
            result,cookie=Service(R2()).request(action,body,self.headers.get('Cookie',''),self.headers.get('Origin',''),self.headers.get('X-CSRF-Token',''),self.command)
        except ApiError as e:status=e.status;result={'error':str(e)}
        except Exception:status=503;result={'error':'Administración no configurada o servicio no disponible.'}
        raw=json.dumps(result,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        if cookie:self.send_header('Set-Cookie',cookie)
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
