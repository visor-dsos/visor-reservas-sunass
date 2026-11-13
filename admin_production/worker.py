"""Financial-only worker; imports the exact reader used by the local updater."""
import sys,json,zipfile,hashlib
from pathlib import Path
import financial_reader as prep

def dump(p,obj):
    p.write_text(json.dumps(obj,ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf-8')

def add_ejeseparado(source, data, known, warnings):
    w=prep.book(source)
    try:
        sheet=prep.sheet(w,'Ejeseparado')
        rows=iter(sheet.iter_rows());head=next(rows,())
        if len(head)<31 or prep.key(head[0].value)!='COD_EP':
            raise prep.DataError('Ejeseparado: falta estructura COD_EP en A y bloques G:P / V:AE.')
        for start,token in ((6,'PROGRAMADO'),(11,'EJECUCION'),(21,'PROGRAMADO'),(26,'EJECUCION')):
            for i in range(5):
                h=prep.key(head[start+i].value)
                if not h or not h.endswith(str(i+1)) or not (token in h or token=='PROGRAMADO' and ('ESTIMACION' in h or 'RECAUDACION' in h)):
                    raise prep.DataError('Ejeseparado: encabezado anual inesperado en columna '+str(start+i+1))
        seen=set()
        for row in rows:
            if all(c.value is None for c in row):continue
            code=prep.code(row[0].value,known)
            if code in seen:raise prep.DataError('Ejeseparado: COD_EP duplicado '+code)
            seen.add(code)
            blocks={}
            for theme,a,b in (('MERESE',6,11),('GRD_ACC',21,26)):
                blocks[theme]={'estimacion_anual':[prep.number(row[a+i]) for i in range(5)],'ejecucion_anual':[prep.number(row[b+i]) for i in range(5)]}
            data['eps'][code]['ejeseparado']=blocks
            canonical=data['eps'][code].get('regulatorio')
            source_ar=prep.number(row[5])
            if canonical and source_ar is not None and source_ar!=canonical.get('ANIO_REGULATORIO_VIGENTE',canonical.get('anio_vigente')):
                warnings.append('Ejeseparado COD_EP '+code+': AR vigente difiere; se conserva Ejecucion como fuente canÃ³nica.')
        if not seen:raise prep.DataError('Ejeseparado: no contiene registros EPS.')
        for code in sorted(set(known)-seen):warnings.append('Ejeseparado sin registro COD_EP '+code+'; valores anuales no disponibles.')
        data['ejeseparado_schema']=1
        return len(seen)
    finally:w.close()

def run(root,mode="financial"):
    root=Path(root);ctx=prep.read(root/'context.json');stage=root/'derived';stage.mkdir(exist_ok=True)
    if mode=='master':
        from complement import build
        master=build(root/'benchmark.xlsx',root/'size.xlsx',ctx['statistics']['institutions'])
        dump(stage/'maestro_eps.json',master)
        dump(stage/'master_validation.json',{'status':'validated','errors':[],'warnings':[],'warnings_count':0,'eps':len(master['eps']),'themes':['Maestro EPS'],'records':{'Benchmarking':len(master['eps']),'TamaÃ±o EP':len(master['eps'])}})
        return
    source=root/'financial.xlsx'
    if not zipfile.is_zipfile(source):raise prep.DataError('Archivo no es un XLSX vÃ¡lido.')
    with zipfile.ZipFile(source) as z:
        names=z.namelist()
        if len(names)>5000 or sum(i.file_size for i in z.infolist())>300*1024*1024:raise prep.DataError('Excel excede el tamaÃ±o descomprimido permitido.')
        if '[Content_Types].xml' not in names or 'xl/workbook.xml' not in names or any('vbaproject' in n.lower() for n in names):raise prep.DataError('Se requiere XLSX sin macros.')
    institutions=ctx['statistics']['institutions'];known={str(i['COD_EP']):i for i in institutions}
    if not known or len(known)!=len(institutions):raise prep.DataError('CatÃ¡logo institucional invÃ¡lido.')
    cfg={'finanzas_excel':str(source),'implementacion_hoja':'Implementacion','ejecucion_hoja':'Ejecucion'}
    warnings=[];f,counts=prep.finance(cfg,known,warnings)
    if set(f['eps'])!=set(known):raise prep.DataError('CatÃ¡logo financiero incompatible.')
    themes={k:sum(len(e[k]) for e in f['eps'].values()) for k in ('implementacion','implementacion_grd_acc')}
    if not all(themes.values()):raise prep.DataError('Se requieren registros MERESE y GRD Y ACC.')
    for e in f['eps'].values():
        if not isinstance(e['implementacion'],list) or not isinstance(e['implementacion_grd_acc'],list):raise prep.DataError('Estructura incompatible.')
        r=e['regulatorio']
        if r and any(len(block[field])!=5 for block in (r,r['grd_acc']) for field in ('programado','ejecucion_real','meta_gestion')):raise prep.DataError('Bloques regulatorios incompatibles.')
    counts['Ejeseparado']=add_ejeseparado(source,f,known,warnings)
    f['fuente']='Reportes Regulatorios DRE-SUNASS'
    dump(stage/'finanzas_eps.json',f)
    from plans import build
    plans=build(source,f,known)
    plans['financial_sha256']=hashlib.sha256((stage/'finanzas_eps.json').read_bytes()).hexdigest()
    dump(stage/'planes_merese.json',plans)
    warnings.extend(plans['summary']['warnings'])
    dump(stage/'validation.json',{'status':'validated','errors':[],'warnings':warnings,'warnings_count':len(warnings),'eps':len(known),'records':counts,'themes':['MERESE','GRD Y ACC'],'plans':plans['summary'],'sheets':['Implementacion','Ejecucion','Ejeseparado','Base Trabajable'],'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_size':source.stat().st_size})
if __name__=='__main__':
    try:run(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else "financial")
    except Exception as e:
        print(json.dumps({'errors':[str(e) if isinstance(e,(prep.DataError,ValueError)) else 'No se pudo generar la versiÃ³n: '+type(e).__name__]}));sys.exit(1)
