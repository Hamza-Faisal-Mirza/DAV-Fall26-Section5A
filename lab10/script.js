// Lab Manual 10 — D3.js time-series visualizations
const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%d %b %Y");
const formatMonth = d3.timeFormat("%b");
const margin = {top: 25, right: 35, bottom: 55, left: 70};
const width = 1000;

d3.csv("dataset/air_quality_2025.csv", d => ({
  date: parseDate(d.date),
  pm25_city: +d.pm25_city,
  pm25_suburb: +d.pm25_suburb,
  temp_c: +d.temp_c
})).then(data => {
  data.sort((a,b) => a.date - b.date);
  const fullDates = d3.timeDay.range(new Date(2025,0,1), new Date(2026,0,1));
  const recorded = new Set(data.map(d => +d.date));
  const missingDates = fullDates.filter(d => !recorded.has(+d));
  const missingCount = missingDates.length;
  const daysAbove15 = data.filter(d => d.pm25_city > 15).length;
  const daysAbove75 = data.filter(d => d.pm25_city > 75).length;
  const topTwo = [...data].sort((a,b) => d3.descending(a.pm25_city,b.pm25_city)).slice(0,2);

  // Task 1: dataset audit
  const first = d3.min(data,d=>d.date), last = d3.max(data,d=>d.date);
  d3.select("#task1").html(`
    <div class="stat">Recorded rows<strong>${data.length}</strong></div>
    <div class="stat">Expected days in 2025<strong>${fullDates.length}</strong></div>
    <div class="stat">Missing days<strong>${missingCount}</strong></div>
    <div class="stat">Date range<strong style="font-size:18px">${formatDate(first)} – ${formatDate(last)}</strong></div>
  `);

  const xTime = d3.scaleTime().domain(d3.extent(fullDates)).range([margin.left,width-margin.right]);
  const yFor = (values, key, height=390) => d3.scaleLinear()
    .domain([0, d3.max(values,d=>d[key]) * 1.12]).nice()
    .range([height-margin.bottom,margin.top]);
  function axes(svg,x,y,h, xFormat=d3.timeFormat("%b")) {
    svg.append("g").attr("class","axis").attr("transform",`translate(0,${h-margin.bottom})`)
      .call(d3.axisBottom(x).ticks(12).tickFormat(xFormat));
    svg.append("g").attr("class","axis").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));
    svg.append("text").attr("x",width/2).attr("y",h-8).attr("text-anchor","middle").text("Date");
    svg.append("text").attr("transform","rotate(-90)").attr("x",-h/2).attr("y",18).attr("text-anchor","middle").text("PM2.5 (µg/m³)");
  }
  function addGrid(svg,y,h) {
    svg.append("g").attr("class","grid").attr("transform",`translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(-(width-margin.left-margin.right)).tickFormat(""));
  }

  // Task 2: city line, WHO guide lines, and two highest days
  d3.select("#task2stats").text(`Above 15 µg/m³: ${daysAbove15} days   |   Above 75 µg/m³: ${daysAbove75} days`);
  {
    const h=390, svg=d3.select("#chart2"), x=xTime, y=d3.scaleLinear().domain([0,d3.max(data,d=>d.pm25_city)*1.12]).nice().range([h-margin.bottom,margin.top]);
    addGrid(svg,y,h); axes(svg,x,y,h);
    [15,75].forEach((v,i)=>{
      svg.append("line").attr("x1",margin.left).attr("x2",width-margin.right).attr("y1",y(v)).attr("y2",y(v))
        .attr("stroke",i===0?"#e09b27":"#d64545").attr("stroke-dasharray","7,5").attr("stroke-width",2);
      svg.append("text").attr("x",width-margin.right-5).attr("y",y(v)-7).attr("text-anchor","end")
        .attr("fill",i===0?"#b8750c":"#c12f2f").text(`${v} µg/m³`);
    });
    const line=d3.line().x(d=>x(d.date)).y(d=>y(d.pm25_city));
    svg.append("path").datum(data).attr("fill","none").attr("stroke","#2563c7").attr("stroke-width",2).attr("d",line);
    topTwo.forEach((d,i)=>{
      svg.append("circle").attr("cx",x(d.date)).attr("cy",y(d.pm25_city)).attr("r",5).attr("fill","#d62828");
      svg.append("text").attr("x",x(d.date)+(i===0?-8:8)).attr("y",y(d.pm25_city)-12)
        .attr("text-anchor",i===0?"end":"start").attr("font-size",12).attr("font-weight","bold")
        .text(`${formatDate(d.date)}: ${d.pm25_city}`);
    });
  }

  // Task 3: running cumulative count of unhealthy days
  {
    let total=0;
    const cumulative=data.map(d=>({...d, running:(total += d.pm25_city>75 ? 1 : 0)}));
    const h=340, svg=d3.select("#chart3"), x=xTime;
    const y=d3.scaleLinear().domain([0,daysAbove75*1.08]).nice().range([h-48,25]);
    svg.append("g").attr("class","axis").attr("transform",`translate(0,${h-48})`).call(d3.axisBottom(x).ticks(12));
    svg.append("g").attr("class","axis").attr("transform","translate(70,0)").call(d3.axisLeft(y));
    const area=d3.area().x(d=>x(d.date)).y0(y(0)).y1(d=>y(d.running));
    svg.append("path").datum(cumulative).attr("fill","#7bb6e8").attr("opacity",.8).attr("d",area);
    svg.append("path").datum(cumulative).attr("fill","none").attr("stroke","#205b9d").attr("stroke-width",2).attr("d",d3.line().x(d=>x(d.date)).y(d=>y(d.running)));
    svg.append("text").attr("x",width-40).attr("y",y(daysAbove75)-10).attr("text-anchor","end").attr("font-weight","bold").text(`Final total: ${daysAbove75}`);
    svg.append("text").attr("transform","rotate(-90)").attr("x",-145).attr("y",18).attr("text-anchor","middle").text("Running unhealthy-day total");
  }

  // Task 4: compare city and suburb on one set of axes
  {
    const h=360, svg=d3.select("#chart4"), x=xTime;
    const max=d3.max(data,d=>Math.max(d.pm25_city,d.pm25_suburb));
    const y=d3.scaleLinear().domain([0,max*1.1]).nice().range([h-margin.bottom,margin.top]);
    addGrid(svg,y,h); axes(svg,x,y,h);
    [{key:"pm25_city",color:"#2563c7",label:"City centre"},{key:"pm25_suburb",color:"#e07a27",label:"Suburb"}].forEach(s=>{
      svg.append("path").datum(data).attr("fill","none").attr("stroke",s.color).attr("stroke-width",1.8)
        .attr("d",d3.line().x(d=>x(d.date)).y(d=>y(d[s.key])));
      d3.select("#legend4").append("span").html(`<i class="swatch" style="background:${s.color}"></i>${s.label}`);
    });
  }

  // Task 5: monthly stacked counts by pollution level
  {
    const levels=["Low","Moderate","High","Severe"], colors=["#d9f0e5","#8bc9a9","#f2b35e","#c94b4b"];
    const monthData=d3.rollups(data,v=>{
      const o={month:new Date(v[0].date.getFullYear(),v[0].date.getMonth(),1)};
      levels.forEach((level,i)=>o[level]=v.filter(d=>{
        const n=d.pm25_city; return i===0?n<=35:i===1?n>35&&n<=75:i===2?n>75&&n<=150:n>150;
      }).length);
      return o;
    },d=>d.date.getMonth()).map(d=>d[1]).sort((a,b)=>a.month-b.month);
    const h=360, svg=d3.select("#chart5");
    const x=d3.scaleBand().domain(monthData.map(d=>formatMonth(d.month))).range([margin.left,width-margin.right]).padding(.18);
    const stack=d3.stack().keys(levels), series=stack(monthData);
    const y=d3.scaleLinear().domain([0,d3.max(monthData,d=>levels.reduce((s,k)=>s+d[k],0))]).nice().range([h-margin.bottom,margin.top]);
    svg.append("g").attr("class","axis").attr("transform",`translate(0,${h-margin.bottom})`).call(d3.axisBottom(x));
    svg.append("g").attr("class","axis").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));
    svg.append("text").attr("transform","rotate(-90)").attr("x",-h/2).attr("y",18).attr("text-anchor","middle").text("Number of recorded days");
    series.forEach((s,i)=>{
      svg.append("g").selectAll("rect").data(s).join("rect").attr("x",d=>x(formatMonth(d.data.month)))
        .attr("y",d=>y(d[1])).attr("height",d=>y(d[0])-y(d[1])).attr("width",x.bandwidth()).attr("fill",colors[i])
        .append("title").text(d=>`${s.key}: ${d[1]-d[0]} days`);
      d3.select("#legend5").append("span").html(`<i class="swatch" style="background:${colors[i]}"></i>${levels[i]}`);
    });
  }

  // Task 6: month x weekday heatmap
  {
    const weekdays=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const months=d3.timeMonth.range(new Date(2025,0,1),new Date(2026,0,1));
    const cells=[];
    months.forEach((m,mi)=>weekdays.forEach((day,di)=>{
      const vals=data.filter(d=>d.date.getMonth()===mi && ((d.date.getDay()+6)%7)===di).map(d=>d.pm25_city);
      cells.push({month:formatMonth(m),weekday:day,avg:vals.length?d3.mean(vals):null});
    }));
    const h=420, svg=d3.select("#chart6");
    const x=d3.scaleBand().domain(weekdays).range([margin.left,width-margin.right]).padding(.06);
    const y=d3.scaleBand().domain(months.map(formatMonth)).range([margin.top,h-45]).padding(.06);
    const color=d3.scaleSequential().domain(d3.extent(cells.filter(d=>d.avg!==null),d=>d.avg)).interpolator(d3.interpolateYlOrRd);
    svg.selectAll("rect").data(cells).join("rect").attr("x",d=>x(d.weekday)).attr("y",d=>y(d.month))
      .attr("width",x.bandwidth()).attr("height",y.bandwidth()).attr("fill",d=>d.avg===null?"#eee":color(d.avg))
      .append("title").text(d=>d.avg===null?`${d.month} ${d.weekday}: no data`:`${d.month} ${d.weekday}: ${d.avg.toFixed(1)} µg/m³`);
    svg.append("g").attr("class","axis").attr("transform",`translate(0,${h-45})`).call(d3.axisBottom(x));
    svg.append("g").attr("class","axis").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));
    const defs=svg.append("defs"), grad=defs.append("linearGradient").attr("id","heatGrad");
    grad.append("stop").attr("offset","0%").attr("stop-color",color.range()[0]);
    grad.append("stop").attr("offset","100%").attr("stop-color",color.range()[1]);
    svg.append("rect").attr("x",width-230).attr("y",15).attr("width",160).attr("height",10).attr("fill","url(#heatGrad)");
    svg.append("text").attr("x",width-230).attr("y",38).attr("font-size",11).text("Lower average");
    svg.append("text").attr("x",width-70).attr("y",38).attr("text-anchor","end").attr("font-size",11).text("Higher average");
  }

  // Task 7: monthly min-max band and mean
  {
    const monthly=d3.rollups(data,v=>({month:new Date(v[0].date.getFullYear(),v[0].date.getMonth(),1),
      min:d3.min(v,d=>d.pm25_city),max:d3.max(v,d=>d.pm25_city),mean:d3.mean(v,d=>d.pm25_city)}),
      d=>d.date.getMonth()).map(d=>d[1]).sort((a,b)=>a.month-b.month);
    const h=360, svg=d3.select("#chart7"), x=d3.scaleTime().domain([new Date(2025,0,1),new Date(2026,0,1)]).range([margin.left,width-margin.right]);
    const y=d3.scaleLinear().domain([0,d3.max(monthly,d=>d.max)*1.1]).nice().range([h-margin.bottom,margin.top]);
    addGrid(svg,y,h); axes(svg,x,y,h);
    svg.append("path").datum(monthly).attr("fill","#8eb9e8").attr("opacity",.45)
      .attr("d",d3.area().x(d=>x(d.month)).y0(d=>y(d.min)).y1(d=>y(d.max)));
    svg.append("path").datum(monthly).attr("fill","none").attr("stroke","#1f579b").attr("stroke-width",3)
      .attr("d",d3.line().x(d=>x(d.month)).y(d=>y(d.mean)));
    svg.selectAll("circle").data(monthly).join("circle").attr("cx",d=>x(d.month)).attr("cy",d=>y(d.mean)).attr("r",4).attr("fill","#1f579b")
      .append("title").text(d=>`${formatMonth(d.month)} mean ${d.mean.toFixed(1)}, min ${d.min}, max ${d.max}`);
  }

  // Task 8: daily line with an honest break and 7 consecutive-day moving average
  {
    const h=390, svg=d3.select("#chart8"), x=xTime;
    const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.pm25_city)*1.1]).nice().range([h-margin.bottom,margin.top]);
    addGrid(svg,y,h); axes(svg,x,y,h);
    const gaps=[];
    for(let i=1;i<data.length;i++){
      const days=d3.timeDay.count(data[i-1].date,data[i].date);
      if(days>1) gaps.push({start:d3.timeDay.offset(data[i-1].date,1),end:d3.timeDay.offset(data[i].date,-1),count:days-1});
    }
    gaps.forEach(g=>{
      svg.append("rect").attr("x",x(g.start)).attr("y",margin.top).attr("width",Math.max(2,x(g.end)-x(g.start))).attr("height",h-margin.top-margin.bottom)
        .attr("fill","#f5b7b7").attr("opacity",.45);
      svg.append("text").attr("x",(x(g.start)+x(g.end))/2).attr("y",margin.top+18).attr("text-anchor","middle").attr("fill","#a52a2a").attr("font-size",12)
        .text("No data: sensor offline");
    });
    const segments=[]; let segment=[];
    data.forEach((d,i)=>{
      if(i>0 && d3.timeDay.count(data[i-1].date,d.date)>1){segments.push(segment);segment=[];}
      segment.push(d);
    }); if(segment.length) segments.push(segment);
    const dailyLine=d3.line().x(d=>x(d.date)).y(d=>y(d.pm25_city));
    segments.forEach(s=>svg.append("path").datum(s).attr("fill","none").attr("stroke","#9aa6b5").attr("stroke-width",1).attr("opacity",.7).attr("d",dailyLine));
    const moving=[];
    segments.forEach(s=>s.forEach((d,i)=>{
      if(i>=6) moving.push({...d,ma:d3.mean(s.slice(i-6,i+1),v=>v.pm25_city)});
    }));
    // Draw a separate average path for each continuous segment.
    segments.forEach(s=>{
      const avg=s.slice(6).map((d,i)=>({...d,ma:d3.mean(s.slice(i,i+7),v=>v.pm25_city)}));
      if(avg.length) svg.append("path").datum(avg).attr("fill","none").attr("stroke","#173f75").attr("stroke-width",3).attr("d",d3.line().x(d=>x(d.date)).y(d=>y(d.ma)));
    });
    svg.append("text").attr("x",margin.left).attr("y",h-12).attr("font-size",12).attr("fill","#a52a2a")
      .text(`Missing dates: ${missingCount} (${missingDates.length?formatDate(missingDates[0])+" to "+formatDate(missingDates[missingDates.length-1]):"none"})`);
    svg.append("text").attr("x",width-margin.right).attr("y",margin.top+15).attr("text-anchor","end").attr("font-size",12).attr("fill","#173f75").text("7-day moving average");
  }

  // Task 9: overview brush controls the main chart's date window
  {
    const main=d3.select("#chart9main"), overview=d3.select("#chart9brush");
    const h=330, mainX=d3.scaleTime().domain(d3.extent(fullDates)).range([margin.left,width-margin.right]);
    const y=d3.scaleLinear().domain([0,d3.max(data,d=>d.pm25_city)*1.1]).nice().range([h-margin.bottom,margin.top]);
    function drawMain(domain){
      main.selectAll("*").remove();
      const x=d3.scaleTime().domain(domain).range([margin.left,width-margin.right]);
      main.append("g").attr("class","axis").attr("transform",`translate(0,${h-margin.bottom})`).call(d3.axisBottom(x));
      main.append("g").attr("class","axis").attr("transform",`translate(${margin.left},0)`).call(d3.axisLeft(y));
      main.append("path").datum(data.filter(d=>d.date>=domain[0]&&d.date<=domain[1])).attr("fill","none").attr("stroke","#2457c5").attr("stroke-width",2.2)
        .attr("d",d3.line().defined(d=>d.pm25_city!=null).x(d=>x(d.date)).y(d=>y(d.pm25_city)));
    }
    const brushX=d3.scaleTime().domain(d3.extent(fullDates)).range([margin.left,width-margin.right]);
    const by=d3.scaleLinear().domain([0,d3.max(data,d=>d.pm25_city)]).range([115,10]);
    overview.append("path").datum(data).attr("fill","none").attr("stroke","#7895bd").attr("stroke-width",1.5)
      .attr("d",d3.line().x(d=>brushX(d.date)).y(d=>by(d.pm25_city)));
    const brush=d3.brushX().extent([[margin.left,8],[width-margin.right,125]]).on("brush end",event=>{
      if(!event.selection) return;
      const selected=event.selection.map(brushX.invert);
      drawMain(selected);
    });
    overview.append("g").attr("class","brush").call(brush).call(brush.move,[brushX(new Date(2025,0,1)),brushX(new Date(2026,0,1))]);
    drawMain(d3.extent(fullDates));
    d3.select("#resetZoom").on("click",()=>overview.select(".brush").call(brush.move,[brushX(new Date(2025,0,1)),brushX(new Date(2026,0,1))]));
  }

}).catch(error => {
  console.error("Could not load the CSV file:", error);
  d3.select("body").append("p").style("color","red").text("CSV could not be loaded. Check that dataset/air_quality_2025.csv exists and run this page with Live Server.");
});
