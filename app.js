// All analytical estimates are calculated in analysis.py from historical rows.
const palette = {'1号线':'#e64b4b','2号线':'#2f80ed','3号线':'#f2994a','5号线':'#9b51e0','6号线':'#27ae60','8号线':'#56ccf2','13号线':'#bb6bd9','广佛线':'#828282'};
const routePaths = {'1号线':'M80 310 L160 270 L260 280 L335 225 L420 240 L510 190 L625 205','2号线':'M110 100 L185 150 L270 190 L355 225 L445 265 L560 310 L650 340','3号线':'M72 350 L150 320 L245 300 L350 300 L470 330 L620 365','5号线':'M75 190 L175 210 L265 195 L350 225 L460 205 L560 160 L650 130','6号线':'M200 55 L230 120 L265 190 L300 260 L330 350','8号线':'M90 135 L180 170 L265 195 L350 225 L430 300 L520 360','13号线':'M355 62 L355 140 L350 225 L350 300 L350 390','广佛线':'M100 390 L190 360 L280 345 L350 300 L440 260 L540 250 L655 260'};
const metricLabels = {energy_10kwh:'总能耗',trac_10kwh:'牵引能耗',station_10kwh:'车站能耗'};
// Source energy fields retain their original 10 kWh unit; convert once at display.
const unit = DATA.meta.display_unit;
const energyFactor = DATA.meta.display_energy_multiplier;
let selected = DATA.lines[0];
let driverMetric = 'energy_10kwh';
const el = id => document.getElementById(id);
const fmt = (n,d=1) => typeof n==='number' && Number.isFinite(n)
  ? n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}) : '数据缺失';
const signed = (n,d=1) => (n>=0?'+':'')+fmt(n,d);
const energyFmt = (n,d=1) => typeof n==='number' && Number.isFinite(n)
  ? (n*energyFactor).toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:d}) : '数据缺失';
const signedEnergy = (n,d=2) => (n>=0?'+':'')+energyFmt(n,d);
const summary = line => DATA.summary.find(x=>x.line===line);
const actual = line => DATA.actual.filter(x=>x.line===line).sort((a,b)=>a.year-b.year||a.month-b.month);
const forecast = line => DATA.forecast.filter(x=>x.line===line).sort((a,b)=>a.month-b.month);
const scale = (v,min,max,a,b) => a+(v-min)/(max-min||1)*(b-a);

function renderRoutes(){
  el('routeList').innerHTML=DATA.lines.map(line=>{
    const s=summary(line);
    return `<button type="button" class="route-btn ${line===selected?'active':''}" aria-pressed="${line===selected}" data-line="${line}" style="--route-color:${palette[line]}"><span class="route-name"><i class="route-dot"></i>${line}</span><span class="route-energy">${energyFmt(s.avg_monthly_energy_2025)} /月</span></button>`;
  }).join('');
  el('routeList').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectLine(b.dataset.line)));
}
function selectLine(line){selected=line;render();}
function renderOverview(){
  const s=summary(selected);
  el('overview').innerHTML=[
    ['2025 月均能耗',energyFmt(s.avg_monthly_energy_2025),unit],
    ['2026 预测总量',energyFmt(s.forecast_energy_2026),unit],
    ['同比变化',`${signed(s.growth_pct,2)}%`,'相对 2025 年'],
    ['线路规模',`${fmt(s.km)} km`,`${s.stations} 座车站`],
  ].map(x=>`<div class="panel metric"><div class="metric-label">${x[0]}</div><div class="metric-value">${x[1]}</div><div class="metric-foot">${x[2]}</div></div>`).join('');
  el('heroLine').textContent=selected;
  el('heroMode').textContent=s.mode;
  el('chartTitle').textContent=`${selected} · 月度总能耗`;
  el('mapLegend').textContent=selected;
  el('mapSwatch').style.background=palette[selected];
}
function renderChart(){
  const svg=el('energyChart'),a=actual(selected),f=forecast(selected);
  const width=Math.max(300,svg.getBoundingClientRect().width),height=280;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const left=58,right=width-18,top=22,bottom=230;
  const low=Math.min(...a.map(d=>d.energy_10kwh),...f.map(d=>d.energy_lower_10kwh))*.92;
  const high=Math.max(...a.map(d=>d.energy_10kwh),...f.map(d=>d.energy_upper_10kwh))*1.06;
  const x=i=>left+i/83*(right-left),y=v=>scale(v,low,high,bottom,top);
  let out='';
  [0,.25,.5,.75,1].forEach(t=>{
    const yy=bottom-(bottom-top)*t;
    out+=`<line class="gridline" x1="${left}" x2="${right}" y1="${yy}" y2="${yy}"/><text class="axis" text-anchor="end" x="${left-8}" y="${yy+4}">${energyFmt(low+(high-low)*t,0)}</text>`;
  });
  const ticks=width<500?[[0,'2020'],[36,'2023'],[72,'2026']]:[[0,'2020'],[12,'2021'],[24,'2022'],[36,'2023'],[48,'2024'],[60,'2025'],[72,'2026']];
  ticks.forEach(([i,label])=>out+=`<text class="axis" text-anchor="middle" x="${x(i)}" y="252">${label}</text>`);
  const path=(arr,offset)=>arr.map((d,i)=>`${i?'L':'M'} ${x(i+offset)} ${y(d.energy_10kwh)}`).join(' ');
  const band=f.map((d,i)=>`${i?'L':'M'} ${x(72+i)} ${y(d.energy_upper_10kwh)}`).join(' ')+' '+f.slice().reverse().map((d,i)=>`L ${x(83-i)} ${y(d.energy_lower_10kwh)}`).join(' ')+' Z';
  out+=`<defs><clipPath id="energyClip"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs><g clip-path="url(#energyClip)"><line x1="${x(71.5)}" x2="${x(71.5)}" y1="${top}" y2="${bottom}" stroke="#c9d4df" stroke-dasharray="3 5"/><path class="forecast-band" d="${band}"/><path class="actual-line" d="${path(a,0)}"/><path class="forecast-line" d="${path([a[a.length-1],...f],71)}"/></g>`;
  svg.innerHTML=out;
}
function renderMap(){
  const g=el('mapLines');
  g.innerHTML=DATA.lines.map(line=>{
    const p=routePaths[line],dots=p.match(/\d+ \d+/g)||[];
    return `<g data-map-line="${line}" role="button" tabindex="0" aria-label="选择${line}" aria-pressed="${line===selected}"><path class="map-line ${line===selected?'active':''}" style="--route-color:${palette[line]}" d="${p}"/><text x="${dots[0].split(' ')[0]}" y="${Number(dots[0].split(' ')[1])-10}" class="map-label strong">${line}</text>${dots.filter((_,i)=>i%2===0).map(d=>{const [cx,cy]=d.split(' ');return `<circle class="station ${line===selected?'active':''}" style="--route-color:${palette[line]}" cx="${cx}" cy="${cy}" r="5"/>`;}).join('')}</g>`;
  }).join('');
  g.querySelectorAll('[data-map-line]').forEach(node=>{
    node.addEventListener('click',()=>selectLine(node.dataset.mapLine));
    node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectLine(node.dataset.mapLine);}});
  });
  const s=summary(selected);
  el('mapLineTitle').textContent=selected;
  el('mapDesc').textContent=`${s.mode}线路 · ${fmt(s.km)} km · ${s.stations} 座车站`;
  el('mapAvg').textContent=`${energyFmt(s.avg_monthly_energy_2025)} ${unit}`;
  el('mapForecast').textContent=`${energyFmt(s.forecast_energy_2026)} ${unit}`;
  el('mapGrowth').textContent=`${signed(s.growth_pct,2)}%`;
}
function renderTable(){
  el('forecastTable').innerHTML=forecast(selected).map(x=>`<tr><td>2026.${String(x.month).padStart(2,'0')}</td><td>${fmt(x.passenger_wan)}</td><td>${fmt(x.trains_day)}</td><td class="forecast-cell">${energyFmt(x.trac_10kwh)}</td><td class="forecast-cell">${energyFmt(x.station_10kwh)}</td><td class="forecast-cell">${energyFmt(x.energy_10kwh)}</td><td>${energyFmt(x.energy_lower_10kwh)} – ${energyFmt(x.energy_upper_10kwh)}</td></tr>`).join('');
}

function setupDrivers(){
  const section=document.createElement('section');
  section.className='panel main-panel drivers-panel';
  section.id='driversPanel';
  section.innerHTML=`
    <div class="panel-head driver-heading">
      <div><h3 id="driverTitle">温度与客流 · 能耗关联分析</h3><p>2020–2025 历史实测 · 每条线路 72 个月 · 能耗单位：${unit}</p></div>
      <label class="driver-select">分析指标 <select id="driverMetric" aria-label="分析能耗指标"><option value="energy_10kwh">总能耗</option><option value="station_10kwh">车站能耗</option><option value="trac_10kwh">牵引能耗</option></select></label>
    </div>
    <div class="driver-stats" id="driverStats" aria-live="polite"></div>
    <div class="scatter-grid">
      <figure><figcaption>温度与能耗 <span id="temperatureCorr"></span></figcaption><svg id="temperatureScatter" class="scatter-chart" role="img" aria-label="温度与能耗历史散点图"></svg></figure>
      <figure><figcaption>客流与能耗 <span id="passengerCorr"></span></figcaption><svg id="passengerScatter" class="scatter-chart" role="img" aria-label="客流与能耗历史散点图"></svg></figure>
    </div>
    <div class="driver-legend"><span><i class="scatter-key"></i>历史月份（悬停查看明细）</span><span><i class="fit-key"></i>单变量趋势线</span></div>
    <h4 class="effects-title">控制其他因素后的关联</h4>
    <div class="table-wrap"><table class="data-table effects-table"><thead><tr><th>因素变化</th><th>能耗关联变化（${unit}）</th><th>近似 95% 系数区间</th><th>区间解读</th></tr></thead><tbody id="effectTable"></tbody></table></div>
    <p class="driver-insight" id="driverInsight" aria-live="polite"></p>
    <details class="driver-method"><summary>查看分析方法与使用范围</summary><p>散点图和 Pearson r 表示单变量相关性（r 介于 −1 至 +1）。下表使用同一线路的多元线性回归，同时纳入温度、客流、日车次、时间趋势与月份固定效应。温度系数表示客流、车次、月份和趋势相同条件下，温度每升高 1°C 对应的能耗变化；客流系数表示温度等其他变量相同条件下，客流字段每增加 10 万人对应的变化。</p><p>系数区间使用 HC3 稳健标准误与正态近似；72 个样本中估计 16 个参数，短序列及时间相关可能影响区间可靠性。区间跨 0 时，方向不确定。样本内 R² 是拟合程度，不代表预测准确率。历史关联不能证明因果，未用于重估已有 2026 年趋势季节预测。</p></details>`;
  document.querySelector('.map-panel').before(section);
  el('driverMetric').addEventListener('change',event=>{driverMetric=event.target.value;renderDrivers();});
}
function renderScatter(id,column,xLabel,correlation){
  const svg=el(id),rows=actual(selected);
  const width=Math.max(270,svg.getBoundingClientRect().width),height=265;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const left=62,right=width-16,top=26,bottom=210;
  const xs=rows.map(d=>d[column]),ys=rows.map(d=>d[driverMetric]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const xpad=(xmax-xmin)*.06||1,ypad=(ymax-ymin)*.1||1;
  const x=v=>scale(v,xmin-xpad,xmax+xpad,left,right),y=v=>scale(v,ymin-ypad,ymax+ypad,bottom,top);
  let out=`<defs><clipPath id="${id}Clip"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath></defs>`;
  [0,1/3,2/3,1].forEach(t=>{
    const yv=ymin-ypad+(ymax-ymin+2*ypad)*t;
    const xv=xmin+(xmax-xmin)*t;
    out+=`<line class="gridline" x1="${left}" x2="${right}" y1="${y(yv)}" y2="${y(yv)}"/><text class="axis" x="${left-8}" y="${y(yv)+4}" text-anchor="end">${energyFmt(yv,0)}</text><text class="axis" x="${x(xv)}" y="230" text-anchor="middle">${fmt(xv,1)}</text>`;
  });
  out+=`<text class="scatter-unit" x="${left}" y="14">${metricLabels[driverMetric]}（${unit}）</text><text class="scatter-unit" x="${(left+right)/2}" y="254" text-anchor="middle">${xLabel}</text><g clip-path="url(#${id}Clip)"><line class="scatter-fit" x1="${x(xmin)}" x2="${x(xmax)}" y1="${y(correlation.intercept+correlation.slope*xmin)}" y2="${y(correlation.intercept+correlation.slope*xmax)}"/>`;
  out+=rows.map(d=>`<circle class="scatter-point" cx="${x(d[column])}" cy="${y(d[driverMetric])}" r="4"><title>${selected} · ${d.year}.${String(d.month).padStart(2,'0')}\n温度 Temperature：${fmt(d.temp_c)}℃\n客流：${fmt(d.passenger_wan)} 万人\n${metricLabels[driverMetric]}：${energyFmt(d[driverMetric])} ${unit}</title></circle>`).join('')+'</g>';
  svg.innerHTML=out;
  svg.setAttribute('aria-label',`${selected} ${xLabel}与${metricLabels[driverMetric]}，72 个历史月度样本，相关系数 ${fmt(correlation.r,3)}`);
}
function renderDrivers(){
  const analysis=DATA.drivers.find(d=>d.line===selected),d=analysis.targets[driverMetric];
  el('driverTitle').textContent=`${selected} · 温度与客流关联分析`;
  const tc=d.correlations.temperature,pc=d.correlations.passenger;
  const rows=actual(selected),mean=field=>rows.reduce((total,row)=>total+row[field],0)/rows.length;
  el('driverStats').innerHTML=[
    ['温度 Temperature（℃）',fmt(mean('temp_c')),'2020–2025 月度温度均值'],
    ['客流（万人）',fmt(mean('passenger_wan')),'2020–2025 客流均值'],
    ['多元模型 · 样本内 R²',fmt(d.r_squared,3),`${analysis.n} 个月 · ${analysis.parameters} 个参数`],
  ].map(v=>`<div class="driver-stat"><span>${v[0]}</span><strong>${v[1]}</strong><small>${v[2]}</small></div>`).join('');
  el('temperatureCorr').textContent=`r = ${signed(tc.r,3)}`;
  el('passengerCorr').textContent=`r = ${signed(pc.r,3)}`;
  renderScatter('temperatureScatter','temp_c','温度 Temperature（℃）',tc);
  renderScatter('passengerScatter','passenger_wan','客流（万人）',pc);
  const factors=[['temperature','温度 +1℃'],['passenger','客流 +10 万人']];
  el('effectTable').innerHTML=factors.map(([key,label])=>{
    const e=d.adjusted_effects[key],uncertain=e.ci_lower<=0&&e.ci_upper>=0;
    return `<tr><td>${label}</td><td>${signedEnergy(e.estimate)}</td><td>${signedEnergy(e.ci_lower)} ～ ${signedEnergy(e.ci_upper)}</td><td>${uncertain?'跨 0，方向不确定':e.estimate>0?'区间为正':'区间为负'}</td></tr>`;
  }).join('');
  const te=d.adjusted_effects.temperature,pe=d.adjusted_effects.passenger;
  const describe=(e,name)=>e.ci_lower<=0&&e.ci_upper>=0?`${name}的条件关联系数区间跨 0，方向仍不确定。`:`控制其他变量后，${name}与${metricLabels[driverMetric]}呈${e.estimate>=0?'正':'负'}向关联。`;
  el('driverInsight').textContent=describe(te,'温度')+describe(pe,'客流')+'相关性不代表因果关系。';
}
function render(){renderRoutes();renderOverview();renderChart();renderMap();renderTable();renderDrivers();}
setupDrivers();
render();
new ResizeObserver(()=>{renderChart();renderDrivers();}).observe(document.querySelector('.content'));
