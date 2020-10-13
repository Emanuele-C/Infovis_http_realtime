const reverseDNSCache = {};
const getReverseDNS = function (item) {
    let promise;
    if (reverseDNSCache[item.ip]) {
        console.log("cached");
        promise = Promise.resolve(reverseDNSCache[item.ip]);
    } else {
        promise = axios({
            method: "GET",
            url: "https://stat.ripe.net/data/reverse-dns-ip/data.json?resource=" + item.ip,
            responseType: "json"
        })
            .then(r => {
                try {
                    return r.data.data.result[0];
                } catch (e) {
                    return null;
                }
            })
    }
    return promise
        .then(r => {
            item.domain = r;
            reverseDNSCache[item.ip] = r;
        })
}

const initBarChart = function(targetID) {
    let data = {};
    let started = false;

    // Initial configuration of the svg main component
    let margin = { top: 0, right: 0, bottom: 0, left: 0 },
        width = window.innerWidth / 2 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        categoryIndent = 4 * 15 + 5,
        defaultBarWidth = 10;

    let x = d3.scaleLinear()
        .domain([0, defaultBarWidth])
        .range([0, width]);

    let y = d3.scaleBand()
        .range([0, height])
        .round(true)
        .padding(0.1)
        .paddingOuter(0);
    
    let tooltip = d3
        .select(targetID)
        .append('div')
        .attr('id', 'tooltip')
        .attr('style', ' line-height: 5; font-weight: bold;  padding: 12px; background: rgb(219, 237, 240, 0.92); color: black;  border-radius: 10px;position: absolute;');

    let svg = d3.select(targetID)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        
    const updateChart = function () {
        const top = JSON.parse(JSON.stringify(Object // To avoid side-effects during transitions
            .values(data)
            .sort(function (a,b) {
                return b.value - a.value;
            })
            .slice(0, 10)));

        Promise
            .all(top.map(item => getReverseDNS(item)))
            .then(() => {
                const max = top[0].value;

                let x = d3.scaleLinear()
                    .domain([0, max])
                    .range([0, width]);

                const y = d3.scaleBand()
                    .range([ 0, height ])
                    .domain(top.map(function(d) { return d.ip; }))
                    .padding(.1);

                svg.selectAll(".bar")
                    .data(top)
                    .enter()
                    .append("rect")
                    .attr("class", "bar")
                    .attr("x", x(0) )
                    .attr("y", function(d) { return y(d.ip); })
                    .attr("width", function(d) { return x(d.value); })
                    .attr("height", y.bandwidth())
                    .attr("fill", "#69b3a2")
                    .on('mouseover', function (d) {    
                        tooltip
                            .style('opacity', 1)
                            .html("N° measurements: "+ d.value +"  <br/>Target: "+(d.domain || d.ip) + "<br/>Avarage RT: "+ parseFloat(d.arrt.toFixed(2)));
                    })
                    .on('mouseout', function (d) {
                        tooltip
                        .style("opacity", 0);
                    })
                    .on('mousemove', function () {
                        tooltip
                            .style('left', (d3.event.pageX + 30) + 'px').style('top', (d3.event.pageY + 30) + 'px')
                    });


                svg.selectAll(".label")
                    .data(top)
                    .enter()
                    .append("text")
                    .attr("class", "label")
                    .attr("y", function(d) { return y(d.ip) + (y.bandwidth() / 2) + 8 })
                    .attr("x", function(d) { return x(0); })
                    .text(function (d) {
                        return ` [${d.value}] ${d.domain || d.ip} `;
                    })
                    .on('mouseover', function (d) { 
                                         
                        tooltip
                            .style('opacity', 1)
                            .html("N° measurements: "+ d.value +"<br/>Target: "+(d.domain || d.ip)+"<br/>Avarage RT: " + parseFloat(d.arrt.toFixed(2)));
                })
                    .on('mouseout', function (d) {
                         tooltip
                            .style("opacity", 0);
                    })
                    .on('mousemove', function () {
                        tooltip
                            .style('left', (d3.event.pageX + 30) + 'px').style('top', (d3.event.pageY + 30) + 'px')
                    });

                svg.selectAll(".label")
                    .data(top)
                    .exit()
                    .remove();

                svg.selectAll(".bar")
                    .data(top)
                    .exit()
                    .remove()

                svg.selectAll(".bar")
                    .data(top)
                    .transition()
                    .duration(500)
                    .attr("y", function(d) {  return y(d.ip); })
                    .attr("width", function(d) {  return x(d.value); })
                    .attr("height", y.bandwidth() )
                    .attr("fill", "#69b3a2");

                svg.selectAll(".label")
                    .data(top)
                    .transition()
                    .duration(500)
                    .attr("y", function(d) { return y(d.ip) + (y.bandwidth() / 2) + 8 })
                    .attr("x", function(d) { return x(0); })
                    .text(function (d) {
                        return `[${d.value}] ${d.domain || d.ip}`;
                    });

                setTimeout( updateChart, 3000);
            });
    }

    return function (result) {
        const sourceIp = result.result[0].dst_addr;
        const rtime = result.result[0].rt;
        let avarageRT;
        if (sourceIp && !result.result[0].err && rtime ) {
         
            data[sourceIp] = data[sourceIp] || {ip: sourceIp, domain: "", value: 0, arrt:rtime};
            data[sourceIp].value++;
            if(data[sourceIp].value!=1){
                avarageRT = (data[sourceIp].arrt + rtime)/(data[sourceIp].value);
                data[sourceIp].arrt = avarageRT;  
            }   
        }

        

        // We could update directly when we receive a data sample,
        // but there are too many samples and the application hangs
        if (!started) {
            started = true;
            updateChart()
        }
    }
}
