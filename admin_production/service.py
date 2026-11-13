"""R2 adapter and authenticated administrative service. No business-rule duplication."""
import os,json,time,secrets,hashlib,hmac,base64,tempfile,subprocess,sys,re
from pathlib import Path
from datetime import datetime,timezone
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
PREFIX='reserves-runtime/'
BUCKET='visor-reservas-sunass-runtime'
COOKIE='__Host-reservas_admin'
VERSION=r'\d{8}T\d{6}Z_[a-f0-9]{8}'
BASELINE=Path(__file__).with_name('baseline')
PUBLIC_FILES=('manifest.json','finanzas_eps.json','maestro_eps.json','validation.json','master_validation.json')
FILES=('finanzas_eps.json','validation.json')
def now():return datetime.now(timezone.utc).isoformat()
def encode(b):return base64.b64encode(b).decode()
def decode(s):return base64.b64decode(s,validate=True)
def pack(v):return json.dumps(v,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()
class ApiError(Exception):
    def __init__(self,status,message):self.status=status;super().__init__(message)
class R2:
    def __init__(self):
        if os.environ.get('R2_BUCKET')!=BUCKET:raise ValueError('Bucket exclusivo del nuevo visor requerido.')
        import boto3
        from botocore.config import Config
        self.s3=boto3.client('s3',endpoint_url=os.environ['R2_ENDPOINT'],aws_access_key_id=os.environ['R2_ACCESS_KEY'],aws_secret_access_key=os.environ['R2_SECRET_KEY'],region_name='auto',config=Config(signature_version='s3v4'));self.bucket=os.environ['R2_BUCKET']
    def get(self,key):
        try:r=self.s3.get_object(Bucket=self.bucket,Key=key);return r['Body'].read(),r['ETag']
        except self.s3.exceptions.NoSuchKey:return None,None
    def put(self,key,data,etag=None,new=False,public=False):
        args={'Bucket':self.bucket,'Key':key,'Body':data,'ContentType':'application/json' if public else 'application/octet-stream','CacheControl':'no-store' if key.endswith('current.json') else 'public,max-age=31536000,immutable' if public else 'no-store'}
        if etag:args['IfMatch']=etag
        if new:args['IfNoneMatch']='*'
        try:return self.s3.put_object(**args)['ETag']
        except Exception as e:
            if getattr(e,'response',{}).get('ResponseMetadata',{}).get('HTTPStatusCode') in (409,412):raise ApiError(409,'Estado actualizado por otra operación; vuelva a consultar.')
            raise
    def remove(self,key,etag):self.s3.delete_object(Bucket=self.bucket,Key=key,IfMatch=etag)
    def upload(self,key,size):return self.s3.generate_presigned_url('put_object',Params={'Bucket':self.bucket,'Key':key,'ContentType':'application/octet-stream','ContentLength':size},ExpiresIn=600)
class Service:
    def __init__(self,store,env=None):
        self.store=store;self.env=env or os.environ;self.master=decode(self.env['ADMIN_ENCRYPTION_KEY']);self.origin=self.env['ADMIN_ORIGIN'].rstrip('/');self.public=self.origin+'/runtime/'
        if self.origin!='https://visor-reservas-sunass.vercel.app' and not self.origin.startswith(('http://127.0.0.1:','http://localhost:')):raise ValueError('Origen exclusivo del nuevo visor requerido.')
        if len(self.master)!=32:raise ValueError('ADMIN_ENCRYPTION_KEY debe contener 32 bytes.')
        if not self.origin.startswith('https://') and not self.origin.startswith(('http://127.0.0.1:','http://localhost:')):raise ValueError('HTTPS requerido.')
    def secret_get(self,key):
        b,tag=self.store.get(PREFIX+'private/'+key)
        return (json.loads(AESGCM(self.master).decrypt(b[:12],b[12:],key.encode())) if b else None),tag
    def secret_put(self,key,obj,tag=None,new=False):
        nonce=os.urandom(12);return self.store.put(PREFIX+'private/'+key,nonce+AESGCM(self.master).encrypt(nonce,pack(obj),key.encode()),tag,new)
    def session(self,cookie):
        token=next((v.strip().split('=',1)[1] for v in cookie.split(';') if v.strip().startswith(COOKIE+'=')),None)
        state,_=self.secret_get('session')
        if not token or not state or state['expires']<time.time() or not hmac.compare_digest(state['hash'],hashlib.sha256(token.encode()).hexdigest()):raise ApiError(401,'Sesión administrativa requerida.')
        return state,hmac.new(self.master,token.encode(),hashlib.sha256).hexdigest()
    def request(self,action,body,cookie='',origin='',csrf='',method='POST'):
        if action=='session':
            try:s,c=self.session(cookie);return {'authenticated':True,'csrf':c,'admin':s['user']},None
            except ApiError:return {'authenticated':False},None
        if method!='POST' or origin!=self.origin:raise ApiError(403,'Origen o método no autorizado.')
        if action=='login':
            rate,tag=self.secret_get('login_rate');rate=rate if rate and rate['until']>time.time() else {'until':time.time()+900,'attempts':0}
            if rate['attempts']>=8:raise ApiError(429,'Espere antes de volver a intentar.')
            rate['attempts']+=1;self.secret_put('login_rate',rate,tag,tag is None)
            spec=self.env['ADMIN_PASSWORD_HASH'].split('$')
            if len(spec)!=3 or not spec[0].isdigit() or not 600000<=int(spec[0])<=2000000 or len(decode(spec[1]))<16 or len(decode(spec[2]))!=32:raise ApiError(503,'Configuración de autenticación inválida.')
            derived=hashlib.pbkdf2_hmac('sha256',str(body.get('password','')).encode(),decode(spec[1]),int(spec[0]))
            if not hmac.compare_digest(derived,decode(spec[2])):raise ApiError(401,'Credenciales no válidas.')
            token=secrets.token_urlsafe(48);_,tag=self.secret_get('session');state={'hash':hashlib.sha256(token.encode()).hexdigest(),'expires':time.time()+3600,'user':'admin'};self.secret_put('session',state,tag,tag is None)
            return {'authenticated':True},COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600'
        state,expected=self.session(cookie)
        if not hmac.compare_digest(expected,csrf):raise ApiError(403,'Validación CSRF requerida.')
        if action=='logout':
            _,tag=self.secret_get('session');self.secret_put('session',{'hash':'','expires':0,'user':'admin'},tag);return {'authenticated':False},COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
        if action=='upload':
            size=body.get('size');kind=body.get('kind')
            if kind not in ('financial','benchmark','size') or not isinstance(size,int) or size<1 or size>50*1024*1024 or not str(body.get('name','')).lower().endswith('.xlsx'):raise ApiError(400,'Seleccione Excel .xlsx de hasta 50 MB.')
            ident=secrets.token_hex(16);key=PREFIX+'uploads/'+ident+'.enc';aes=os.urandom(32);ticket={'key':key,'kind':kind,'size':size,'key_aes':encode(aes),'owner':state['hash'],'expires':time.time()+600,'timestamp':now(),'name':re.sub(r'[^a-zA-Z0-9_. -]','_',Path(str(body.get('name','financial.xlsx')).replace('\\','/')).name)[:120]};self.secret_put('upload/'+ident,ticket,new=True)
            return {'id':ident,'url':self.store.upload(key,size+28),'encryptionKey':encode(aes),'expiresIn':600},None
        if action=='status':
            ident=body.get('job','')
            if not re.fullmatch('[0-9a-f]{32}',ident):raise ApiError(400,'Job inválido.')
            result,_=self.secret_get('jobs/'+ident)
            if not result:raise ApiError(404,'Job no encontrado.')
            return result,None
        if action=='overview':return self.overview(),None
        if action=='prepare':return self.prepare(body,state),None
        if action=='activate':return self.activate(body,state),None
        if action=='rollback':return self.rollback(body),None
        raise ApiError(404,'Operación no disponible.')
    def baseline(self):
        p=json.loads((BASELINE/'manifest.json').read_bytes());p['base']=self.public+'versions/'+p['version']+'/'
        return p
    def active(self):
        raw,etag=self.store.get(PREFIX+'current.json')
        return (json.loads(raw) if raw else self.baseline()),etag
    def version_file(self,version,name):
        if not re.fullmatch(VERSION,version) or name not in PUBLIC_FILES:raise ApiError(404,'Recurso no disponible.')
        raw,_=self.store.get(PREFIX+'versions/'+version+'/'+name)
        if raw is None and version==self.baseline()['version']:
            raw=pack(self.baseline()) if name=='manifest.json' else (BASELINE/name).read_bytes()
        if raw is None:raise ApiError(404,'Versión incompleta.')
        return raw
    def verify_version(self,manifest):
        if manifest.get('status')!='validated':raise ApiError(409,'Versión no validada.')
        for name in PUBLIC_FILES:
            raw=self.version_file(manifest['version'],name)
            expected=manifest.get('sha256',{}).get(name)
            if expected and hashlib.sha256(raw).hexdigest()!=expected:raise ApiError(409,'Integridad de versión inválida.')
    def overview(self):
        active,_=self.active();self.verify_version(active)
        return {'active':active,'storage':'connected','eps':50,'themes':['MERESE','GRD'],'cutoff':self.cutoff(json.loads(self.version_file(active['version'],'finanzas_eps.json')))}
    @staticmethod
    def cutoff(data):
        return max((r['fecha'] for e in data['eps'].values() for k in ('implementacion','implementacion_grd_acc') for r in e.get(k,[]) if r.get('fecha')),default=None)
    def prepare(self,body,session):
        # Only this method parses Excel. No pointer write is possible here.
        mode=body.get('mode','financial')
        if mode not in ('financial','master'):raise ApiError(400,'Modo inválido.')
        institutional=body.get('financial_date')
        if mode=='financial':
            try:
                value=datetime.fromisoformat(str(institutional))
                if len(str(institutional))!=10 or value.date()>datetime.now(timezone.utc).date():raise ValueError()
            except ValueError:raise ApiError(400,'Indique fecha institucional válida, no futura.')
        job=secrets.token_hex(16);lock=self.secret_put('update_lock',{'job':job,'started':now()},new=True)
        try:
            before,etag=self.active()
            # Persist the original published baseline as an independent recovery version.
            baseline=self.baseline()
            for name in PUBLIC_FILES:
                key=PREFIX+'versions/'+baseline['version']+'/'+name
                if self.store.get(key)[0] is None:
                    self.store.put(key,pack(baseline) if name=='manifest.json' else (BASELINE/name).read_bytes(),new=True,public=True)
            with tempfile.TemporaryDirectory(prefix='reservas-admin-') as tmp:
                root=Path(tmp);context={'statistics':{'institutions':json.loads(Path(__file__).with_name('institutions.json').read_bytes())}}
                for kind in (('financial',) if mode=='financial' else ('benchmark','size')):
                    ident=body.get(kind,'')
                    if not re.fullmatch('[0-9a-f]{32}',ident):raise ApiError(400,'Referencia inválida.')
                    ticket,tag=self.secret_get('upload/'+ident)
                    if not ticket or ticket['expires']<time.time() or ticket['owner']!=session['hash'] or ticket['kind']!=kind or ticket.get('used'):raise ApiError(400,'Carga expirada, utilizada o ajena.')
                    b,_=self.store.get(ticket['key'])
                    if not b or len(b)!=ticket['size']+28:raise ApiError(400,'Carga incompleta.')
                    raw=AESGCM(decode(ticket['key_aes'])).decrypt(b[:12],b[12:],None)
                    (root/(kind+'.xlsx')).write_bytes(raw);ticket['used']=True;self.secret_put('upload/'+ident,ticket,tag)
                (root/'context.json').write_bytes(pack(context))
                proc=subprocess.run([sys.executable,str(Path(__file__).with_name('worker.py')),str(root),mode],capture_output=True,text=True,timeout=240)
                if proc.returncode:
                    try:errors=json.loads(proc.stdout.strip())['errors']
                    except Exception:errors=['Excel incompatible; revise formato y límites.']
                    raise ApiError(422,'; '.join(errors[:5]))
                stage=root/'derived'
                for name in ('maestro_eps.json','master_validation.json') if mode=='financial' else FILES:
                    (stage/name).write_bytes(self.version_file(before['version'],name))
                version=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'_'+job[:8]
                meta={**before,'version':version,'base':self.public+'versions/'+version+'/','status':'validated','previous_version':before['version'],'prepared_at':now(),'sha256':{},'mode':mode}
                meta.pop('derived_files',None)
                for name in PUBLIC_FILES:
                    if name=='manifest.json':continue
                    raw=(stage/name).read_bytes();meta['sha256'][name]=hashlib.sha256(raw).hexdigest();self.store.put(PREFIX+'versions/'+version+'/'+name,raw,new=True,public=True)
                financial=json.loads((stage/'finanzas_eps.json').read_bytes())
                validation=json.loads((stage/('validation.json' if mode=='financial' else 'master_validation.json')).read_bytes())
                meta.update(cutoff=self.cutoff(financial),eps=50,themes=['MERESE','GRD'],financial_version=version if mode=='financial' else before.get('financial_version',before['version']),master_version=version if mode=='master' else before.get('master_version',before['version']))
                if mode=='financial':meta['financial_updated_at']=institutional+'T12:00:00-05:00'
                self.store.put(PREFIX+'versions/'+version+'/manifest.json',pack(meta),new=True,public=True)
                candidate={'owner':session['hash'],'expires':time.time()+3600,'before_etag':etag,'before':before,'manifest':meta,'validation':validation}
                self.secret_put('candidates/'+job,candidate,new=True)
                self.verify_version(meta)
                return {'status':'validated','job':job,'before':before,'proposed':meta,'validation':validation,'before_cutoff':self.cutoff(json.loads(self.version_file(before['version'],'finanzas_eps.json')))}
        finally:
            self.store.remove(PREFIX+'private/update_lock',lock)
    def activate(self,body,session):
        if body.get('confirm') is not True:raise ApiError(400,'Confirmación explícita requerida.')
        job=body.get('job','')
        if not re.fullmatch('[0-9a-f]{32}',job):raise ApiError(400,'Referencia inválida.')
        lock=self.secret_put('update_lock',{'activate':job},new=True)
        try:
            candidate,tag=self.secret_get('candidates/'+job)
            if not candidate or candidate['owner']!=session['hash'] or candidate['expires']<time.time():raise ApiError(409,'Vista previa expirada o ajena; valide nuevamente.')
            _,etag=self.active()
            if etag!=candidate['before_etag']:raise ApiError(409,'La versión activa cambió; valide nuevamente.')
            meta=candidate['manifest'];self.verify_version(meta)
            meta={**meta,'activated_at':now(),'updated_by':'admin','updated_at':meta.get('financial_updated_at',candidate['before']['updated_at'])}
            self.store.put(PREFIX+'current.json',pack(meta),etag,etag is None,public=True)
            current,_=self.active()
            if current['version']!=meta['version']:raise ApiError(409,'Otra actualización reemplazó el puntero; consulte el estado.')
            return {'status':'completed','active':current}
        finally:self.store.remove(PREFIX+'private/update_lock',lock)
    def rollback(self,body):
        if body.get('confirm') is not True:raise ApiError(400,'Confirme la recuperación.')
        lock=self.secret_put('update_lock',{'rollback':True},new=True)
        try:
            active,etag=self.active();previous=active.get('previous_version')
            if not previous or body.get('version')!=previous:raise ApiError(409,'Solo puede recuperar la versión anterior indicada.')
            meta=json.loads(self.version_file(previous,'manifest.json'));self.verify_version(meta)
            meta.update(recovered_at=now(),previous_version=active['version'])
            self.store.put(PREFIX+'current.json',pack(meta),etag,etag is None,public=True)
            current,_=self.active()
            if current['version']!=previous:raise ApiError(409,'No se pudo confirmar recuperación.')
            return {'status':'completed','active':current}
        finally:self.store.remove(PREFIX+'private/update_lock',lock)
