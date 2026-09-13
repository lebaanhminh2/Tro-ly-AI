export type TimeRange={start:number;end:number};
export type Availability={range:TimeRange;source:'confirmed'|'assumed'};
export function mergeRanges(ranges:TimeRange[]):TimeRange[]{
 const sorted=ranges.map(r=>{
  if(!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start)throw Error('INVALID_RANGE');
  return {...r};
 }).sort((a,b)=>a.start-b.start||a.end-b.end);
 const result:TimeRange[]=[];
 for(const r of sorted){
  const last=result.at(-1);
  if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else result.push(r);
 }
 return result;
}
export function availableRanges(base:TimeRange[],busy:TimeRange[],now:number):TimeRange[]{
 const blocks=mergeRanges(busy);
 let available=mergeRanges(base).map(r=>({start:Math.max(now,r.start),end:r.end})).filter(r=>r.start<r.end);
 for(const block of blocks)available=available.flatMap(r=>{
  if(block.end<=r.start||block.start>=r.end)return [r];
  return [...(block.start>r.start?[{start:r.start,end:block.start}]:[]),...(block.end<r.end?[{start:block.end,end:r.end}]:[])];
 });
 return available;
}
