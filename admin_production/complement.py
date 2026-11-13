"""Read-only complementary EPS workbook ingestion; COD_EP is the only join key."""
import math, unicodedata, zipfile, hashlib
from datetime import datetime, timezone
from openpyxl import load_workbook

class ComplementError(ValueError): pass

def norm(v):
    return " ".join("".join(c for c in unicodedata.normalize("NFD",str(v or "").lower().replace("_"," ")) if not unicodedata.combining(c)).split())

def rows(path, required):
    with zipfile.ZipFile(path) as z:
        if len(z.infolist())>5000 or sum(i.file_size for i in z.infolist())>300*1024*1024 or any("vbaproject" in i.filename.lower() for i in z.infolist()):
            raise ComplementError("Excel incompatible o demasiado grande.")
    w=load_workbook(path,read_only=True,data_only=True)
    matches=[]
    try:
        for sheet in w:
            it=sheet.iter_rows(values_only=True)
            header=next(it,()); mapping={norm(v):i for i,v in enumerate(header)}
            if all(norm(h) in mapping for h in required.values()):
                matches.append((sheet.title,[{k:r[mapping[norm(h)]] if mapping[norm(h)]<len(r) else None for k,h in required.items()} for r in it if any(v is not None for v in r)]))
        if len(matches)!=1: raise ComplementError("Debe existir una única hoja con los encabezados requeridos: "+", ".join(required.values()))
        return matches[0]
    finally:w.close()

def number(v,label,percent=False):
    if v is None:return None
    if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<0:raise ComplementError(label+": valor numérico no válido.")
    if percent:
        if v>1:raise ComplementError(label+": se espera fracción Excel entre 0 y 1.")
        return v*100
    return v

def build(benchmark,size,institutions):
    known={str(i['COD_EP']) for i in institutions}
    bs,br=rows(benchmark,{'COD_EP':'COD_EP','REGION':'Region Geográfica','POBLACION':'Poblacion ambito','CONEXIONES':'Nro de conexiones administradas','PCT_ACTIVAS':'Porcentaje de conexiones activas'})
    ts,tr=rows(size,{'COD_EP':'COD_EP','T_EPS':'T_EPS'})
    def keyed(records):
        result={}
        for r in records:
            v=r['COD_EP']
            if isinstance(v,bool) or not str(v).replace('.0','').isdigit():raise ComplementError('COD_EP inválido.')
            code=str(int(v))
            if code not in known:raise ComplementError('COD_EP ajeno al maestro: '+code)
            if code in result:raise ComplementError('COD_EP duplicado: '+code)
            result[code]=r
        if set(result)!=known:raise ComplementError('COD_EP faltantes: '+', '.join(sorted(known-set(result))))
        return result
    b,t=keyed(br),keyed(tr);eps={}
    for code in sorted(known,key=int):
        r=b[code];region=str(r['REGION'] or '').strip();cat=str(t[code]['T_EPS'] or '').strip()
        if region not in ('Costa','Sierra','Selva'):raise ComplementError('Región no válida: COD_EP '+code)
        if cat not in ('P','M','G1','G2','SEDAPAL'):raise ComplementError('T_EPS no válido: COD_EP '+code)
        eps[code]={'COD_EP':code,'REGION':region,'T_EPS':cat,'POBLACION':number(r['POBLACION'],'Población '+code),'CONEXIONES':number(r['CONEXIONES'],'Conexiones '+code),'PCT_ACTIVAS':number(r['PCT_ACTIVAS'],'Conexiones activas '+code,True)}
    return {'schemaVersion':1,'updated_at':datetime.now(timezone.utc).isoformat(),'source':'Benchmarking / Tamaño EP; clasificación oficial por COD_EP','source_sheets':[bs,ts],'source_hashes':{'benchmark':hashlib.sha256(benchmark.read_bytes()).hexdigest(),'size':hashlib.sha256(size.read_bytes()).hexdigest()},'eps':eps}
