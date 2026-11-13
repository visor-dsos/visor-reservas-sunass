"""Two-sheet Excel export for one validated EPS; no external formulas or links."""
from io import BytesIO
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins
MONEY='"S/ "#,##0.00'
def export(plan,version,cutoff):
 w=Workbook();summary=w.active;summary.title='Resumen';s=w.create_sheet('Plan de intervenciones')
 values=[['PLAN DE INTERVENCIONES MERESE'],['EPS',plan['name']],['COD_EP',plan['code']],['Reserva','MERESE'],['Resolución vigente',plan['resolution'] or 'No disponible'],['Fecha de inicio',date.fromisoformat(plan['start']) if plan['start'] else 'No disponible'],['Duración del PR (años)',plan['duration'] if plan['duration'] is not None else 'No disponible'],['Año regulatorio vigente',plan['current_year'] if plan['current_year'] is not None else 'No disponible'],['Periodo de referencia',cutoff or 'No disponible'],['Versión financiera',version],['Total programado disponible',plan['total']],['Estimación de recaudación PR (referencia)',plan['reference_estimate']],['Diferencia plan − estimación',plan['difference']],['Fuente','Base Trabajable · MRSE · MEDIDA y Año 1–5'],['Criterio de selección','COD_EP exacto y un único plan marcado SI. Inicio, duración y año vigente: metadatos del visor; F_INI es auxiliar.'],['Notas','Programación del plan; no representa ejecución ni recaudación percibida.'],['Montos no informados','Las celdas vacías no equivalen a cero. No aplica identifica años fuera del PR.']]+([['F_INI auxiliar de la fuente',str(plan['source_start'] or 'No disponible')]] if 'source_start' in plan else [])+[['Advertencia',n] for n in plan['notes']]
 for row in values:summary.append(row)
 summary.merge_cells('A1:B1');summary.column_dimensions['A'].width=39;summary.column_dimensions['B'].width=100;summary['B6'].number_format='dd/mm/yyyy'
 for n in (11,12,13):summary.cell(n,2).number_format=MONEY
 s.append(['PLAN DE INTERVENCIONES MERESE']);s.merge_cells('A1:H1');s.append([plan['name']+' · COD_EP '+plan['code']]);s.merge_cells('A2:H2');s.append(['N.º','Medida o actividad']+['Año regulatorio '+str(i) for i in range(1,6)]+['Total programado por medida'])
 for n,m in enumerate(plan['measures'],1):s.append([n,m['description']]+[v if (plan['duration'] is None or i<plan['duration']) else 'No aplica' for i,v in enumerate(m['amounts'])]+[m['total']])
 last=s.max_row;s.append(['','TOTAL PROGRAMADO DISPONIBLE']+[v if (plan['duration'] is None or i<plan['duration']) else 'No aplica' for i,v in enumerate(plan['annual'])]+[plan['total']]);s.auto_filter.ref='A3:H'+str(last);s.freeze_panes='C4'
 s.column_dimensions['A'].width=7;s.column_dimensions['B'].width=85
 for col in range(3,9):s.column_dimensions[get_column_letter(col)].width=21
 for ws in w:
  ws.sheet_view.showGridLines=False;ws.freeze_panes=ws.freeze_panes or 'B2';ws.print_options.horizontalCentered=True;ws.page_setup.orientation='landscape';ws.page_setup.paperSize=ws.PAPERSIZE_A4;ws.page_setup.fitToWidth=1;ws.page_setup.fitToHeight=0;ws.sheet_properties.pageSetUpPr.fitToPage=True;ws.page_margins=PageMargins(left=.25,right=.25,top=.4,bottom=.4,header=.15,footer=.15)
  for row in ws:
   for c in row:
    c.font=Font(name='Calibri',size=11,color='173C59');c.alignment=Alignment(vertical='top',wrap_text=True)
    if isinstance(c.value,str):c.data_type='s' # descriptions beginning '=' remain literal text
   length=max((len(str(c.value or '')) for c in row),default=0);ws.row_dimensions[row[0].row].height=max(28,min(409,16*(length//70+1)))
  for c in ws[1]:c.fill=PatternFill('solid',fgColor='006EC7');c.font=Font(name='Calibri',size=15,bold=True,color='FFFFFF')
  ws.row_dimensions[1].height=34
 for row in s.iter_rows(min_row=4,min_col=3):
  for c in row:c.number_format=MONEY
 for n in (3,s.max_row):
  for c in s[n]:c.fill=PatternFill('solid',fgColor='E5F4FC');c.font=Font(name='Calibri',bold=True,color='005B9E')
 s.print_title_rows='1:3';s.print_area='A1:H'+str(s.max_row);summary.print_area='A1:B'+str(summary.max_row)
 out=BytesIO();w.save(out);return out.getvalue()
