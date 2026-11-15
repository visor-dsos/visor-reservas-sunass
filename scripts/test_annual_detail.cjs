const fs=require('fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {annualDetail,annualExportRows}=require('../src/reserveAnnualDetail.ts'),{selectReserve}=require('../src/reserveSelection.ts'),{financial}=require('../src/interventionIndicators.ts');
let passed=0;const eq=(a,b)=>{assert.deepEqual(a,b);passed++};
const members=[{COD_EP:'1',EP:'One',ODS:'A'},{COD_EP:'2',EP:'Two',ODS:'B'}];
const data={'1':{implementacion:[['2020-12-01',10,99],['2021-01-01',20,5],['2021-12-01',30,7],['2022-10-01',null,8],['2023-01-01',0,0],['2026-08-01',40,9],['2026-09-01',999,999],['2027-01-01',50,10]].map(([fecha,ejecucion,saldo])=>({fecha,ejecucion,saldo})),implementacion_grd_acc:[{fecha:'2021-12-01',ejecucion:3,saldo:4}]},'2':{implementacion:[]}};
let e=annualDetail(data,members,'2016-11','2026-08','execution'),b=annualDetail(data,members,'2016-11','2026-08','balance');
eq(e.columns,['EPS','ODS','2016–2020','2021','2022','2023','2024','2025','2026','TOTAL']);eq(e.rows[0]['2021'],50);eq(e.rows[0].TOTAL,100);eq(e.rows[0]['2023'],0);eq(e.rows[1].TOTAL,null);
eq(b.columns.includes('TOTAL'),false);eq(b.rows[0]['2021'],7);eq(b.rows[0].FECHA_2021,'2021-12-01');eq(b.rows[0]['2022'],8);eq(b.rows[0].FECHA_2022,'2022-10-01');eq(b.rows[0]['2023'],0);eq(b.rows[0]['2024'],null);eq(b.rows[0]['2026'],9);
eq(annualDetail(data,members,'2021-06','2026-07','execution').rows[0].TOTAL,30);eq(annualDetail(data,members,'2021-06','2026-07','balance').rows[0]['2026'],null);eq(annualDetail(data,members,'2027-01','2027-01','execution').columns,['EPS','ODS','2027','TOTAL']);
eq(annualDetail(selectReserve(data,'GRD_ACC'),members,'2021-01','2026-08','execution').rows[0]['2021'],3);eq(annualDetail(data,[members[1]],'2021-01','2026-08','balance').rows.length,1);
eq(annualExportRows(e,e.rows).at(-1).TOTAL,100);eq(annualExportRows(b,b.rows).length,2);
const raw=JSON.parse(fs.readFileSync('admin_production/baseline/finanzas_eps.json')).eps,inst=JSON.parse(fs.readFileSync('admin_production/institutions.json')),report={};
for(const theme of ['MERESE','GRD_ACC']){const f=selectReserve(raw,theme),detail=annualDetail(f,inst,'2016-11','2026-08','execution'),total=annualExportRows(detail,detail.rows).at(-1),kpi=financial(Object.values(f),'2016-11','2026-08').total;assert.ok(Math.abs(total.TOTAL-kpi)<1e-6);passed++;report[theme]={total:total.TOTAL,kpi,early:total['2016–2020'],columns:detail.columns};}
console.log(JSON.stringify({passed,report},null,2));
