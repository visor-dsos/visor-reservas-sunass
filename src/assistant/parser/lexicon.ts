export const lexicon={
 execution:['ejecucion','ejecuta','ejecutan','ejecuto','ejecutaron','ejecutado','ejecutada','monto ejecutado','monto de ejecucion','gasto ejecutado','ejecucion merese','ejecutadas','ejecutados','ejecutando'],
 balance:['saldo','saldos','saldo bancario','saldo acumulado','saldo disponible','fondo disponible','fondos disponibles','monto disponible'],
 eps:['eps','empresa prestadora','empresas prestadoras','empresa','empresas','prestadora','prestadoras'],
 ods:['ods','oficina desconcentrada','oficinas desconcentradas','oficina','ambito ods'],
 interventions:['intervencion','intervenciones','acciones','accion','intervenciones merese'],
 area:['area','areas','hectarea','hectareas','ha','superficie intervenida','area intervenida'],
 length:['longitud','longitudes','kilometro','kilometros','km','longitud intervenida'],
 ranking:['ranking','top','mayores','mas altos','mas grandes','primeras','principales','mayor','menor','mas','menos'],
 desc:['mayor a menor','descendente','de mas a menos','orden descendente'],
 asc:['menor a mayor','ascendente','de menos a mas'],
 follow:['esas','esas eps','las anteriores','las mismas','de esas','ahora','solo ellas','las primeras','las ultimas','ordenalas','ordenalos','ordena esas','solo las','solo los'],
 summary:['resume','resumen','situacion','resumeme','panorama'],
 compare:['compara','comparar','comparacion','comparame','versus','vs'],
 latest:['ultimo corte','ultima fecha','mas reciente','actualmente','actual'],
 range:['rango','periodo disponible','fechas disponibles','desde cuando','hasta cuando'],
 total:['total','suma','en conjunto','acumulado nacional'],
 export:['descarga','descargalo','descargalas','descargame','exporta','exportalo','quiero el excel','quiero el csv'],
 graph:['grafica','graficalo','graficalas','grafico','barras'],
};
export const spelling:Record<string,string>={ejcucion:'ejecucion',ejecuccion:'ejecucion',intervencines:'intervenciones',intervencione:'intervenciones',sedacuzco:'sedacusco','seda cusco':'sedacusco'};
export const numberWords:Record<string,number>={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,veinte:20};
export const has=(text:string,terms:readonly string[])=>terms.some(s=>new RegExp('(?:^|\\s)'+s+'(?=$|\\s)').test(text));
