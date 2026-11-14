const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {evaluatedBalance,sunassAlert,alertExportColumns}=require('../src/reserveAlertBalance.ts');
let passed=0;const eq=(a,b)=>{assert.deepEqual(a,b);passed++};
const finance=(records,start='2025-01-01',ar=2)=>({regulatorio:{FECHA_INICIO_PR:start,ANIO_REGULATORIO_VIGENTE:ar},implementacion:records.map(([fecha,saldo])=>({fecha,saldo}))});
let f=finance([['2024-12-31',9e6],['2025-10-31',2e6],['2025-11-30',3e6],['2025-12-31',null],['2026-08-31',5e5]]);
let b=evaluatedBalance(f,1,'2026-08');eq(b.SALDO_EVALUADO,3e6);eq(b.FECHA_SALDO_EVALUADO,'2025-11-30');
eq(sunassAlert({...b,ANIO_EVALUADO:1,PCT_EJECUCION_ACUMULADA:20,SALDO:5e5}),'Sí');
eq(sunassAlert({...b,SALDO_EVALUADO:5e5,ANIO_EVALUADO:1,PCT_EJECUCION_ACUMULADA:20,SALDO:3e6}),'No');
eq(evaluatedBalance(f,1,'2025-10').SALDO_EVALUADO,2e6);
eq(evaluatedBalance(finance([['2024-12-31',9e6],['2026-01-01',9e6]]),1,'2026-08').SALDO_EVALUADO,null);
eq(evaluatedBalance(finance([['2025-12-31',0]]),1,'2026-08').SALDO_EVALUADO,0);
b=evaluatedBalance(finance([['2024-06-30',99],['2025-06-30',77],['2025-07-01',88]],'2024-07-01'),1,'2026-08');eq(b.SALDO_EVALUADO,77);eq(b.FIN_ANIO_EVALUADO,'2025-06-30');
b=evaluatedBalance(finance([],'2026-01-01',1),null,'2026-08');eq(b.ESTADO_SALDO_EVALUADO,'No aplica');eq(sunassAlert({...b,ANIO_EVALUADO:null,PCT_EJECUCION_ACUMULADA:0}),'No determinable');
eq(sunassAlert({INICIO_ANIO_EVALUADO:'2025-01-01',ANIO_EVALUADO:1,SALDO_EVALUADO:null,PCT_EJECUCION_ACUMULADA:20}),'No determinable');
eq(sunassAlert({INICIO_ANIO_EVALUADO:'2025-01-01',ANIO_EVALUADO:1,SALDO_EVALUADO:null,PCT_EJECUCION_ACUMULADA:25}),'No');
eq(alertExportColumns.includes('FECHA_SALDO_EVALUADO')&&alertExportColumns.includes('FECHA_ULTIMO_SALDO'),true);
const {selectReserve}=require('../src/reserveSelection.ts'),{createMereseQueryEngine}=require('../src/mereseQueryEngine.ts'),{reserveRows}=require('../src/reserveMonitoring.ts');
const themed={x:{...finance([['2025-12-31',2e6]]),implementacion_grd_acc:[{fecha:'2025-12-31',saldo:100}]}};
eq(evaluatedBalance(selectReserve(themed,'MERESE').x,1,'2026-08').SALDO_EVALUADO,2e6);eq(evaluatedBalance(selectReserve(themed,'GRD_ACC').x,1,'2026-08').SALDO_EVALUADO,100);
const root=path.resolve(__dirname,'..'),raw=JSON.parse(fs.readFileSync(path.join(root,'admin_production/baseline/finanzas_eps.json'))).eps,members=JSON.parse(fs.readFileSync(path.join(root,'admin_production/institutions.json'))),report={};
for(const theme of ['MERESE','GRD_ACC']){
 const data=selectReserve(raw,theme),rows=reserveRows(createMereseQueryEngine(data,members,[]),data,members,'2016-11','2026-08','vigente');
 const old=r=>typeof r.SALDO==='number'&&r.SALDO>1e6&&typeof r.PCT_EJECUCION_ACUMULADA==='number'&&r.PCT_EJECUCION_ACUMULADA<25?'Sí':r.SALDO==null||r.PCT_EJECUCION_ACUMULADA==null?'No determinable':'No';
 report[theme]={before:rows.filter(r=>old(r)==='Sí').length,after:rows.filter(r=>sunassAlert(r)==='Sí').length,changes:rows.filter(r=>old(r)!==sunassAlert(r)).map(r=>({code:r.COD_EP,eps:r.EPS,before:old(r),after:sunassAlert(r),actual:r.SALDO,evaluated:r.SALDO_EVALUADO,date:r.FECHA_SALDO_EVALUADO,percent:r.PCT_EJECUCION_ACUMULADA}))};
 eq(rows.length,50);
}
console.log(JSON.stringify({passed,report},null,2));
