import json,unicodedata,re,math,os
from datetime import date,datetime
from pathlib import Path
import openpyxl

class DataError(ValueError):pass

def localpath(p):
    p=Path(p).absolute()
    return Path('\\\\?\\'+str(p)) if os.name=='nt' and not str(p).startswith('\\\\?\\') else p

def key(v):return re.sub(r'[^A-Z0-9]+','_', ''.join(c for c in unicodedata.normalize('NFKD',str(v or '').strip()) if not unicodedata.combining(c)).upper()).strip('_')

def read(p):return json.loads(localpath(p).read_text(encoding='utf-8-sig'))

def book(p):
    try:return openpyxl.load_workbook(localpath(p),read_only=True,data_only=True)
    except Exception as e:raise DataError('No se pudo leer el archivo. Guarde y cierre el Excel e intente nuevamente. '+Path(p).name) from e

def sheet(w,n):
    if n not in w.sheetnames:raise DataError('Falta hoja obligatoria: '+n)
    return w[n]

def headers(row,required):
    h={};original={}
    for i,c in enumerate(row):
        if c.value is None:continue
        n=key(c.value)
        if not n or n in h:raise DataError('Encabezados normalizados conflictivos: '+str(c.value))
        h[n]=i;original[n]=str(c.value)
    missing=[n for n in required if key(n) not in h]
    if missing:raise DataError('Faltan columnas obligatorias: '+', '.join(missing))
    return h,original

def value(c):
    v=c.value
    if v is None or isinstance(v,str) and v.strip() in ('','null','—'):return None
    if isinstance(v,(datetime,date)):return v.date().isoformat() if isinstance(v,datetime) else v.isoformat()
    if isinstance(v,float) and not math.isfinite(v):raise DataError('Número no finito: '+c.coordinate)
    return v

def number(c,percent=False):
    v=c.value
    if v is None or isinstance(v,str) and v.strip().casefold() in ('','sin mg','no aplica','-','—'):return None
    if percent and isinstance(v,str) and v.strip().endswith('%'):
        try:return float(v.strip()[:-1].replace(',','.'))
        except ValueError:pass
    if isinstance(v,str):
        text=re.sub(r'^S/\.?\s*','',v.strip())
        if re.fullmatch(r'[+-]?(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?',text):v=float(text.replace(',',''))
    if not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v):raise DataError('Valor numérico inválido: '+c.coordinate)
    return v*100 if percent and '%' in c.number_format else v

def code(v,known):
    s=str(int(v)) if isinstance(v,float) and v.is_integer() else str(v).strip()
    if isinstance(v,bool) or s not in known:raise DataError('COD_EP no pertenece al maestro: '+s)
    return s

def datevalue(c):
    if isinstance(c.value,(date,datetime)):return c.value.date().isoformat() if isinstance(c.value,datetime) else c.value.isoformat()
    if isinstance(c.value,str):
        text=c.value.strip()
        try:return date.fromisoformat(text).isoformat()
        except ValueError:
            try:return datetime.strptime(text,'%d/%m/%Y').date().isoformat()
            except ValueError:pass
    raise DataError('Fecha inválida: '+c.coordinate)

def finance(config,known,warnings):
    data={c:{'implementacion':[],'implementacion_grd_acc':[],'regulatorio':None} for c in known};counts={};w=book(config['finanzas_excel'])
    try:
        rows=iter(sheet(w,config['implementacion_hoja']).iter_rows());h,_=headers(next(rows),['COD_EP','Fecha','Ejecucion','Saldo_acumulado','Tematica'])
        if h['COD_EP']!=0 or h['EJECUCION']!=9:raise DataError('Implementacion: COD_EP en A y Ejecucion en J requeridos')
        count=0;text_amounts={}
        for row in rows:
            if all(c.value is None for c in row):continue
            theme=str(row[h['TEMATICA']].value or '').strip().upper()
            if theme not in ('MERESE','GRD Y ACC'):continue
            target='implementacion' if theme=='MERESE' else 'implementacion_grd_acc'
            if theme=='GRD Y ACC' and value(row[h['FECHA']]) is None and number(row[9]) is None and number(row[h['SALDO_ACUMULADO']]) is None:
                warnings.append(f'Implementacion fila {row[0].row}: GRD sin fecha, ejecución ni saldo; sin observación temporal, no equivale a cero.')
                continue
            c=code(row[0].value,known)
            for j in (9,h['SALDO_ACUMULADO']):
                if isinstance(row[j].value,str) and number(row[j]) is not None:text_amounts[c]=text_amounts.get(c,0)+1
            data[c][target].append({'fecha':datevalue(row[h['FECHA']]),'ejecucion':number(row[9]),'saldo':number(row[h['SALDO_ACUMULADO']])});count+=1
        counts['Implementacion']=count
        for c,n in text_amounts.items():warnings.append(f'COD_EP {c}: {n} importes textuales leídos como números según su formato explícito; fuente intacta.')
        for f in data.values():
            for target in ('implementacion','implementacion_grd_acc'):f[target].sort(key=lambda r:r['fecha'])
        rows=iter(sheet(w,config['ejecucion_hoja']).iter_rows());head=next(rows);h,_=headers(head,['COD_EP','AÑO REGULATORIO VIGENTE'])
        if h['COD_EP']!=0 or h['ANO_REGULATORIO_VIGENTE']!=5 or len(head)<21 or key(head[3].value)!='FECHA_INICIO_PR' or key(head[4].value)!='DURACION_PR':raise DataError('Ejecucion: estructura A/D:F/G:K/Q:U ausente')
        for i in range(5):
            if 'PROGRAMADO' not in key(head[6+i].value) or not key(head[6+i].value).endswith(str(i+1)):raise DataError('Ejecucion: encabezado G:K inesperado')
            if '%' not in str(head[16+i].value) or not key(head[16+i].value).endswith(str(i+1)):raise DataError('Ejecucion: encabezado Q:U inesperado')
        if len(head)<36:raise DataError('Ejecucion: faltan columnas GRD V:AJ')
        for start_col,token in ((21,'PROGRAMADO'),(26,'EJECUCION'),(31,'%')):
            for i in range(5):
                label=str(head[start_col+i].value or '')
                if token not in (label if token=='%' else key(label)) or not key(label).endswith(str(i+1)):raise DataError('Encabezado GRD inesperado: '+head[start_col+i].coordinate)
        seen=set()
        for row in rows:
            if all(c.value is None for c in row):continue
            c=code(row[0].value,known)
            if c in seen:raise DataError('COD_EP duplicado en Ejecucion: '+c)
            seen.add(c);year=number(row[5])
            if year is not None and (year<1 or int(year)!=year):raise DataError('Año regulatorio inválido: '+c)
            values=[number(cell,True) for cell in row[16:21]];ref=min(max(year-1,1),5) if year is not None else None
            start=datevalue(row[3]) if value(row[3]) is not None else None;duration=number(row[4])
            if duration is not None and (duration<1 or int(duration)!=duration):raise DataError('DURACION_PR inválida: '+c)
            program=[number(cell) for cell in row[6:11]]
            data[c]['regulatorio']={'FECHA_INICIO_PR':start,'DURACION_PR':int(duration) if duration is not None else None,'ANIO_REGULATORIO_VIGENTE':year,'anio_vigente':year,'programado':program,**{f'PROGRAMADO_ACUMULADO_ANIO_{i+1}':v for i,v in enumerate(program)},'meta_gestion':values,'anio_meta_gestion_referencia':ref,'pct_meta_gestion_referencia':values[int(ref)-1] if ref else None}
            r=data[c]['regulatorio']
            r['ejecucion_real']=[number(cell) for cell in row[11:16]]
            r['grd_acc']={'programado':[number(cell) for cell in row[21:26]],'ejecucion_real':[number(cell) for cell in row[26:31]],'meta_gestion':[number(cell,True) for cell in row[31:36]]}
        counts['Ejecucion']=len(seen)
        for c in sorted(set(known)-seen):warnings.append('Sin fila Ejecucion para COD_EP '+c+'; regulación no disponible.')
    finally:w.close()
    return {'fuente':Path(config['finanzas_excel']).name,'llave':'COD_EP (columna A)','tematicas':['MERESE','GRD Y ACC'],'eps':data},counts
