import {lexicon,has} from './lexicon';
import type {Plan} from './types';
export const families=['rankingEjecucionEPS','listarEjecucionEPS','epsSinEjecucion','ejecucionEPSPeriodo','rankingSaldoEPS','listarSaldosEPS','saldoEPS','filtrosEjecucionYSaldo','resumenEPS','resumenODS','resumenNacional','compararEPS','compararODS','intervencionesEPS','intervencionesODS','intervencionesPorAnio','intervencionesPorTipo','intervencionesPorRelacionCuenca','ejecucionFisicaEPS','ejecucionFisicaODS','rankingArea','rankingLongitud','epsConIntervenciones','epsSinIntervenciones','conteoEPS','conteoIntervenciones','totalEjecucion','totalSaldo','rangoPeriodo','seguimientoResultadoAnterior','variacionEjecucionEPS','tendenciaEjecucionEPS','compararPeriodosEPS','compararPeriodosODS','rankingVariacionEjecucion','participacionEjecucionEPS','participacionEjecucionODS','diferenciaSaldoEjecucion','ratioEjecucionSaldo','acumuladoTopN','excluirEPS','excluirODS','filtroMultiplesODS','filtroMultiplesEPS','seleccionPosicional','disponibilidadDatosEPS','disponibilidadDatosODS','consultasRegulatorias','crucesFisicoFinancierosAvanzados','salidaPersonalizada','porcentajeMetaGestionEPS','historicoMetaGestionEPS','porcentajeMetaGestionAnio','rankingMetaGestionReferencia','rankingMetaGestionPorAnio','filtrarMetaGestion','compararMetaGestionEPS','resumenRegulatorioEPS','epsPorAnioRegulatorio','consultaMetaGestionReferencia'];
export function classify(p:Plan,text:string){
 if(p.followUp)return 'seguimientoResultadoAnterior';if(p.range)return 'rangoPeriodo';
 if(has(text,lexicon.compare))return p.level==='ods'?'compararODS':'compararEPS';
 if(p.count)return p.level==='interventions'?'conteoIntervenciones':'conteoEPS';
 if(p.level==='national')return p.metric==='SALDO'?'totalSaldo':has(text,lexicon.summary)?'resumenNacional':'totalEjecucion';
 if(p.level==='interventions')return p.physical.anio?'intervencionesPorAnio':p.physical.relacionCuenca?'intervencionesPorRelacionCuenca':p.physical.tipoIntervencion?'intervencionesPorTipo':p.ods.length?'intervencionesODS':'intervencionesEPS';
 if(p.conditions.some(c=>c.metric==='EJECUCION_MERESE')&&p.conditions.some(c=>c.metric==='SALDO'))return 'filtrosEjecucionYSaldo';
 if(p.conditions.some(c=>c.metric==='EJECUCION_MERESE'&&c.op==='eq'&&c.value===0))return 'epsSinEjecucion';
 if(p.conditions.some(c=>c.metric==='INTERVENCIONES'))return p.conditions.some(c=>c.metric==='INTERVENCIONES'&&c.op==='eq')?'epsSinIntervenciones':'epsConIntervenciones';
 if(p.metric==='AREA_HA'||p.metric==='LONGITUD_KM')return has(text,lexicon.ranking)?p.metric==='AREA_HA'?'rankingArea':'rankingLongitud':p.level==='ods'?'ejecucionFisicaODS':'ejecucionFisicaEPS';
 if(p.summary)return p.level==='ods'?'resumenODS':'resumenEPS';
 if(p.metric==='SALDO')return p.codes.length===1?'saldoEPS':has(text,lexicon.ranking)?'rankingSaldoEPS':'listarSaldosEPS';
 return p.codes.length===1?'ejecucionEPSPeriodo':has(text,lexicon.ranking)?'rankingEjecucionEPS':'listarEjecucionEPS';
}
