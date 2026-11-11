const TABLES = {
  MM: { sale: {table:'A_2024_00045',cls:'530019',item:'100001'}, jeonse: {table:'A_2024_00050',cls:'530019',item:'100001'} },
  WK: { sale: {table:'T244183132827305',cls:'50051',item:'10001'}, jeonse: {table:'T247713133046872',cls:'50051',item:'10001'} }
};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function redact(text,env){for(const key of [env.MOLIT_API_KEY,env.REB_API_KEY].filter(Boolean))text=text.replaceAll(key,'[REDACTED]').replaceAll(encodeURIComponent(key),'[REDACTED]');return text}
export default {async fetch(request,env){
  const u=new URL(request.url);
  if(u.pathname==='/api/status')return json({molit:!!env.MOLIT_API_KEY,reb:!!env.REB_API_KEY,region:'성북구',regionCode:'11290'});
  if(u.pathname==='/api/transactions'){
    if(!env.MOLIT_API_KEY)return json({error:'공공데이터포털 API 키가 설정되지 않았습니다.'},503);
    const month=u.searchParams.get('month'),type=u.searchParams.get('type'),page=u.searchParams.get('page')||'1';
    if(!/^\d{4}(0[1-9]|1[0-2])$/.test(month||'')||!['sale','jeonse','rent'].includes(type)||!/^([1-9]|[1-9]\d|100)$/.test(page))return json({error:'유효한 month=YYYYMM, type=sale|jeonse|rent, page=1~100이 필요합니다.'},400);
    const api=type==='sale'?'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev':'RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
    const target=new URL('https://apis.data.go.kr/1613000/'+api);
    target.search=new URLSearchParams({serviceKey:env.MOLIT_API_KEY,LAWD_CD:'11290',DEAL_YMD:month,numOfRows:'1000',pageNo:page});
    try{const r=await fetch(target,{signal:AbortSignal.timeout(25000),cf:{cacheTtl:900,cacheEverything:true}});const text=redact(await r.text(),env);if(!r.ok)return json({error:'국토교통부 API 응답 오류 (HTTP '+r.status+')'},502);return new Response(text,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'private, max-age=300'}})}catch{return json({error:'국토교통부 API 연결 지연 또는 실패. 잠시 후 다시 조회하세요.'},502)}
  }
  if(u.pathname==='/api/reb'){
    if(!env.REB_API_KEY)return json({error:'한국부동산원 API 키가 설정되지 않았습니다.'},503);
    const cycle=u.searchParams.get('cycle')||'MM',kind=u.searchParams.get('kind')||'sale',end=u.searchParams.get('end')||new Date().toISOString().slice(0,10);
    if(!TABLES[cycle]?.[kind]||!validDate(end))return json({error:'cycle=MM|WK, kind=sale|jeonse, end=YYYY-MM-DD 형식이 필요합니다.'},400);
    const config=TABLES[cycle][kind],year=+end.slice(0,4),target=new URL('https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do');
    // WK identifiers are YYYYWW, not calendar dates. Filter by WRTTIME_DESC after retrieval.
    target.search=new URLSearchParams({KEY:env.REB_API_KEY,STATBL_ID:config.table,CLS_ID:config.cls,ITM_ID:config.item,DTACYCLE_CD:cycle,Type:'json',START_WRTTIME:(year-1)+'01',END_WRTTIME:cycle==='WK'?year+'53':end.slice(0,7).replace('-',''),pIndex:'1',pSize:'1000'});
    try{const res=await fetch(target,{signal:AbortSignal.timeout(25000),cf:{cacheTtl:1800,cacheEverything:true}});if(!res.ok)return json({error:'한국부동산원 API 응답 오류 (HTTP '+res.status+')'},502);const data=await res.json();if(data.RESULT&&data.RESULT.CODE!=='INFO-000')return json({error:redact(data.RESULT.MESSAGE||'한국부동산원 조회 결과가 없습니다.',env)},data.RESULT.CODE==='INFO-200'?200:502);
      const all=data.SttsApiTblData?.flatMap(x=>x.row||[])||[];
      const points=all.filter(r=>String(r.CLS_ID)===config.cls&&String(r.ITM_ID)===config.item&&r.CLS_NM==='성북구'&&r.DTA_VAL!==null&&r.DTA_VAL!==''&&Number.isFinite(Number(r.DTA_VAL))).map(r=>({id:String(r.WRTTIME_IDTFR_ID),date:cycle==='WK'?r.WRTTIME_DESC:String(r.WRTTIME_IDTFR_ID).slice(0,4)+'-'+String(r.WRTTIME_IDTFR_ID).slice(4,6)+'-01',label:r.WRTTIME_DESC,value:Number(r.DTA_VAL)})).filter(p=>validDate(p.date)&&p.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
      return json({region:'성북구',scope:'구 전체 · 동별 지수 아님',source:'한국부동산원 R-ONE',cycle,kind,table:config.table,points,latest:points.at(-1)||null,previous:points.at(-2)||null,retrievedAt:new Date().toISOString()});
    }catch{return json({error:'한국부동산원 API 연결 지연 또는 응답 해석 실패. 잠시 후 다시 조회하세요.'},502)}
  }
  if(u.pathname.startsWith('/api/'))return json({error:'지원하지 않는 API 경로입니다.'},404);
  return new Response('',{headers:{'Content-Type':'text/html; charset=utf-8'}})
}};