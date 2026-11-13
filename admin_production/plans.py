"""MERESE plans: exact institutional/period matching, no changes to financial calculations."""
import json,hashlib,math
from collections import defaultdict
from decimal import Decimal
try:from . import financial_reader as prep
except ImportError:import financial_reader as prep

def total(values):
 v=[Decimal(str(x)) for x in values if x is not None]
 return float(sum(v)) if v else None

def build(source,financial,known,preserved=None):
 w=prep.book(source);groups=defaultdict(list);warnings=[];source_rows=0
 try:
  if 'Base Trabajable' not in w.sheetnames:
   return {'schema':1,'eps':{},'summary':{'source_rows':0,'measures':0,'available_eps':0,'pending_eps':0,'warnings':['Base Trabajable no disponible; esta versión no tiene planes.']}}
  rows=iter(w['Base Trabajable'].iter_rows());head=next(rows)
  expected={0:'TEMA',1:'RESOLUCION',2:'F_INI',3:'COD_EP',5:'ULTIMA_RESO',6:'ANO_DE_PERIODO_REGULATORIO',9:'MEDIDA',**{10+i:'ANO_'+str(i+1) for i in range(5)}}
  for col,name in expected.items():
   if len(head)<=col or prep.key(head[col].value)!=name:raise prep.DataError('Base Trabajable: encabezado inesperado en columna '+str(col+1))
  for row in rows:
   if prep.key(row[0].value)!='MRSE':continue
   source_rows+=1;c=prep.code(row[3].value,known)
   if preserved and preserved.get(c,{}).get('status')=='available':continue
   try:
    if row[9].data_type=='e' or not str(row[9].value or '').strip():raise prep.DataError('Medida ausente o fórmula sin valor válido')
    item={'source_row':row[0].row,'resolution':str(row[1].value or '').strip(),'start':prep.value(row[2]),'last':prep.key(row[5].value),'description':str(row[9].value).strip(),'amounts':[prep.number(cell) for cell in row[10:15]]}
    groups[c].append(item)
   except prep.DataError as e:groups[c].append({'error':str(e),'source_row':row[0].row})
 finally:w.close()
 eps={}
 for code,institution in known.items():
  if preserved and preserved.get(code,{}).get('status')=='available':
   eps[code]=preserved[code];warnings.extend('COD_EP '+code+': '+n for n in eps[code]['notes']);continue
  rows=groups.get(code,[]);r=financial['eps'].get(code,{}).get('regulatorio') or {};start=r.get('FECHA_INICIO_PR');duration=r.get('DURACION_PR');reason=None
  selected=[a for a in rows if not a.get('error') and a['last']=='SI']
  if not rows:reason='Sin medidas MERESE disponibles para esta EPS.'
  elif any(a.get('error') for a in rows):reason='Filas de plan con datos inválidos; requiere revisión.'
  elif not selected:reason='No hay medidas con marca de última resolución SI; requiere revisión.'
  elif len({(a['resolution'],str(a['start'])) for a in selected})!=1:reason='Existen varios planes o resoluciones marcados vigentes; requiere revisión antes de combinarlos.'
  elif duration is not None and any(x is not None for a in selected for x in a['amounts'][min(duration or 5,5):]):reason='Existen importes fuera de la duración aprobada del PR; requiere revisión.'
  base={'code':code,'name':institution['EP'],'status':'pending' if rows else 'unavailable','reason':reason,'start':start,'duration':duration,'current_year':r.get('ANIO_REGULATORIO_VIGENTE',r.get('anio_vigente'))}
  if reason:
   eps[code]=base;warnings.append('COD_EP '+code+': '+reason);continue
  measures=[{'row':a['source_row'],'description':a['description'],'amounts':a['amounts'],'total':total(a['amounts'])} for a in selected]
  annual=[total(a['amounts'][i] for a in selected) for i in range(5)];grand=total(annual)
  estimate=financial['eps'][code].get('ejeseparado',{}).get('MERESE',{}).get('estimacion_anual',[])[:min(duration or 5,5)]
  reference=total(estimate) if duration is not None and len(estimate)==min(duration or 5,5) and all(v is not None for v in estimate) else None
  difference=float(Decimal(str(grand))-Decimal(str(reference))) if grand is not None and reference is not None else None
  notes=[]
  if not start or not duration:notes.append('Metadatos regulatorios no disponibles en el visor; se conservan como no disponibles. Plan único identificado por COD_EP y marca SI; sin conciliación regulatoria completa.')
  if not selected[0]['resolution']:notes.append('Resolución no informada en la fuente; único conjunto de medidas marcado vigente para este COD_EP.')
  if str(selected[0]['start'])!=str(start):notes.append('F_INI auxiliar difiere del inicio validado del visor. Se conserva el inicio del visor sin modificaciones.')
  if any(v is None for a in measures for v in a['amounts'][:min(duration or 5,5)]):notes.append('Totales de importes disponibles; hay montos no informados dentro del PR.')
  if difference is not None and abs(difference)>.005:notes.append('El plan difiere de la estimación de recaudación del PR en S/ '+str(difference)+'. Son conceptos distintos; no se ajustan importes.')
  eps[code]={**base,'status':'available','reason':None,'resolution':selected[0]['resolution'],'source_start':selected[0]['start'],'measures':measures,'annual':annual,'total':grand,'reference_estimate':reference,'difference':difference,'notes':notes}
  warnings.extend('COD_EP '+code+': '+n for n in notes)
 return {'schema':1,'source_sheet':'Base Trabajable','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'eps':eps,'summary':{'source_rows':source_rows,'measures':sum(len(e.get('measures',[])) for e in eps.values()),'available_eps':sum(e['status']=='available' for e in eps.values()),'pending_eps':sum(e['status']=='pending' for e in eps.values()),'warnings':warnings}}
