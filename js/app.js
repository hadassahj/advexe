// =========================================
// SISTEMUL DARK / LIGHT MODE
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // 1. Verificăm dacă utilizatorul are o preferință salvată în browser
    if (localStorage.getItem('advexe_theme') === 'dark') {
        document.body.classList.add('dark-mode');
        if(themeIcon) themeIcon.textContent = '☀️';
    }

    // 2. Ce se întâmplă când dăm click pe buton
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            
            // Salvăm decizia în memoria telefonului/PC-ului
            localStorage.setItem('advexe_theme', isDark ? 'dark' : 'light');
            
            // Schimbăm iconița din Lună în Soare și invers
            themeIcon.textContent = isDark ? '☀️' : '🌙';
        });
    }
});


const SHEET_ID = '1njukwYjPgkTT_rAr5VCZycVRQrEMd3ijlbXeCF-E2e4';
const API_KEY = 'AIzaSyDA9E0fYie3ATrAceDxETVmQvwFxrl_bRM';

let originalItems = [];
let currentItems = [];
let genealogyLinks = [];
let uniqueCategories = [];

const pastelPalette = ['#FFB5E8', '#FF9CEE', '#FFCCF9', '#FCC2FF', '#F6A6FF', '#B28DFF', '#C5A3FF', '#D5AAFF', '#ECD4FF', '#FBE4FF', '#DCD3FF', '#A79AFF', '#B5B9FF', '#97A2FF', '#AFCBFF', '#AFF8DB', '#C4FAF8', '#85E3FF', '#ACE7FF', '#6EB5FF', '#BFFCC6', '#DBFFD6', '#F3FFE3', '#E7FFAC', '#FFFFD1', '#FFC9DE', '#FFABAB', '#FFBEBC', '#FFCBC1', '#FFF5BA'];
const vibrantPalette = ['#2980b9', '#16a085', '#d35400', '#8e44ad', '#27ae60', '#f39c12', '#2c3e50', '#0097e6', '#44bd32', '#e1b12c', '#192a56', '#b33939', '#218c74'];

function getColorForId(idString, isEvent = false) {
    let hash = 0;
    for (let i = 0; i < idString.length; i++) hash = idString.charCodeAt(i) + ((hash << 5) - hash);
    return (isEvent ? vibrantPalette : pastelPalette)[Math.abs(hash) % (isEvent ? vibrantPalette.length : pastelPalette.length)];
}

const container = document.getElementById('visualization');
let width = window.innerWidth;
let height = window.innerHeight;
let centerY = height / 2; 

let panYTop = 0; 
let panYBottom = 0;
let lastTransformY = 0;
let currentMouseX = null; 

const svg = d3.select("#visualization").append("svg").attr("width", width).attr("height", height);

const defs = svg.append("defs");
defs.append("clipPath").attr("id", "avatar-clip").append("circle").attr("cx", 14).attr("cy", 12).attr("r", 9);
defs.append("clipPath").attr("id", "clip-top").append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", centerY);
defs.append("clipPath").attr("id", "clip-bottom").append("rect").attr("x", 0).attr("y", centerY - 10).attr("width", width).attr("height", height - centerY + 10);

const zoom = d3.zoom().scaleExtent([0.1, 1000]).on("zoom", handleZoom);
svg.call(zoom);

const g = svg.append("g");

const todayGroup = g.append("g").attr("class", "today-layer");
const topViewport = g.append("g").attr("clip-path", "url(#clip-top)");
const bottomViewport = g.append("g").attr("clip-path", "url(#clip-bottom)");
const xAxisGroup = g.append("g").attr("class", "axis-line").attr("transform", `translate(0, ${centerY})`);

const linksGroup = topViewport.append("g").attr("class", "links-layer");
const peopleGroup = topViewport.append("g").attr("class", "people-layer");
const eventsGroup = bottomViewport.append("g").attr("class", "events-layer");

const todayLine = todayGroup.append("line").attr("class", "today-line").attr("y1", 0).attr("y2", height);
const todayText = todayGroup.append("text").attr("class", "today-text").text("PREZENT").attr("y", 40);

const crosshairGroup = g.append("g").attr("class", "crosshair-group").style("pointer-events", "none").style("display", "none");
const crosshairLine = crosshairGroup.append("line").attr("class", "crosshair-line").attr("y1", 0).attr("y2", height);
const crosshairBg = crosshairGroup.append("rect").attr("class", "crosshair-bg").attr("rx", 6).attr("ry", 6);
const crosshairText = crosshairGroup.append("text").attr("class", "crosshair-text").attr("y", 26); 

let xScale;

svg.on("mousemove", function(event) {
    currentMouseX = d3.pointer(event)[0];
    updateCrosshair();
});

svg.on("mouseleave", function() {
    currentMouseX = null;
    crosshairGroup.style("display", "none");
});

window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    centerY = height / 2;
    
    svg.attr("width", width).attr("height", height);
    xAxisGroup.attr("transform", `translate(0, ${centerY})`);
    todayLine.attr("y2", height);
    crosshairLine.attr("y2", height); 
    
    d3.select("#clip-top rect").attr("width", width).attr("height", centerY);
    d3.select("#clip-bottom rect").attr("width", width).attr("y", centerY - 10).attr("height", height - centerY + 10);

    if (xScale) {
        xScale.range([0, width]);
        updatePositions(d3.zoomTransform(svg.node()));
    }
});

async function loadData() {
    const ranges = ['Oameni', 'Evenimente'];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?ranges=${ranges.join('&ranges=')}&key=${API_KEY}`;
    try {
        const res = await axios.get(url);
        let loaded = [];
        if (res.data.valueRanges) {
            loaded.push(...parseRows(res.data.valueRanges[0].values, 'people'));
            loaded.push(...parseRows(res.data.valueRanges[1].values, 'events'));
        }
        originalItems = loaded;
       uniqueCategories = [...new Set(originalItems.flatMap(d => d.categories))].filter(c => c !== "");
        buildCategoryFilters();
        applyFilters();
    } catch (e) { console.error(e); }
}

function parseDate(s) {
    if(!s || s.trim() === '') return null;
    const p = s.split('.');
    if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]);
    if (p.length === 1 && !isNaN(p[0])) return new Date(p[0], 0, 1);
    return null;
}

function parseRows(rows, type) {
    if (!rows || rows.length <= 1) return [];
    return rows.slice(1).map((row, i) => {
        const startStr = row[2];
        const endStr = row[3];
        let start = parseDate(startStr);
        if (!start) return null;

        let end = parseDate(endStr);
        let displayDate = startStr;
        let ageText = "";

        if (type === 'people') {
            if (!endStr || endStr.trim() === '') { end = new Date(); displayDate = `${startStr} — Prezent`; } 
            else { displayDate = `${startStr} — ${endStr}`; }
        } else {
            if (endStr && endStr.trim() !== '') { displayDate = `${startStr} — ${endStr}`; } 
            else { end = start; }
        }

        if (start && end && start.getTime() !== end.getTime()) {
            let age = end.getFullYear() - start.getFullYear();
            let m = end.getMonth() - start.getMonth();
            if (m < 0 || (m === 0 && end.getDate() < start.getDate())) { age--; }
            if (age > 0) { ageText = `${age} ani`; } else { ageText = `< 1 an`; }
        }

        let rawLinks = type === 'people' ? row[8] : row[7];
        let customLinks = [];
        if (rawLinks && rawLinks.trim() !== '') {
            customLinks = rawLinks.split(',').map(l => l.trim()).filter(l => l.startsWith('http'));
        }

        return {
            id: type + '_' + (row[0] || i), rawId: row[0] || String(i), type: type, 
            title: row[1], start: start, end: end, ageText: ageText,
            categories: row[4] 
                ? row[4].split(/\s*,\s*/) // Separă prin virgulă și elimină spațiile de lângă ea
                        .map(c => c.trim())
                        .filter(c => c !== "") 
                : ["Fără Categorie"],
            description: row[5] || "Nicio descriere disponibilă.", 
            parents: type === 'people' ? row[6] : null, 
            image: type === 'people' ? row[7] : row[6], 
            links: customLinks, displayDate: displayDate
        };
    }).filter(d => d !== null);
}

function buildCategoryFilters() {
    const container = document.getElementById('dynamic-categories');
    container.innerHTML = uniqueCategories.map(cat => 
        `<label class="filter-label"><input type="checkbox" class="cat-filter" value="${cat}" checked onchange="applyFilters()"> ${cat}</label>`
    ).join('');
}

// function calculateLanes(data) {
//     const people = data.filter(d => d.type === 'people').sort((a, b) => a.start - b.start);
//     const eventRanges = data.filter(d => d.type === 'events' && d.start.getTime() !== d.end.getTime()).sort((a, b) => a.start - b.start);
//     const eventPoints = data.filter(d => d.type === 'events' && d.start.getTime() === d.end.getTime()).sort((a, b) => a.start - b.start);

//     let pLanes = [];
//     people.forEach(p => { let lane = 0; while (pLanes[lane] && pLanes[lane] > p.start) lane++; pLanes[lane] = p.end; p.lane = lane; });

//     let erLanes = [];
//     eventRanges.forEach(e => { let lane = 0; while (erLanes[lane] && erLanes[lane] > e.start) lane++; erLanes[lane] = e.end; e.lane = lane; });

//     let epLanes = [];
//     eventPoints.forEach(e => { let lane = 0; let padding = new Date(e.start.getTime() + (1000 * 60 * 60 * 24 * 60)); while (epLanes[lane] && epLanes[lane] > e.start) lane++; epLanes[lane] = padding; e.lane = lane; });
// }

function calculateLanes(data) {
    // 1. Oameni (rămâne neschimbat)
    const people = data.filter(d => d.type === 'people').sort((a, b) => a.start - b.start);
    let pLanes = [];
    people.forEach(p => { 
        let lane = 0; 
        while (pLanes[lane] && pLanes[lane] > p.start) lane++; 
        pLanes[lane] = p.end; 
        p.lane = lane; 
    });

    // 2. EVENIMENTE (Unificăm punctele și perioadele)
    const events = data.filter(d => d.type === 'events').sort((a, b) => a.start - b.start);
    let eLanes = [];

    events.forEach(e => {
        let lane = 0;
        const isPoint = e.start.getTime() === e.end.getTime();

        // Stabilim o "zonă de ocupare" temporală
        // Dacă e punctual, rezervăm toată luna curentă pentru a evita suprapunerea textului
        // Dacă e punct, rezervăm 4 luni (getMonth() + 4)
        // Dacă e perioadă (acoladă), poți alege să lași e.end sau să adaugi și acolo un buffer
        let busyUntil = isPoint 
            ? new Date(e.start.getFullYear(), e.start.getMonth() + 4, e.start.getDate()) 
            : new Date(e.end.getFullYear(), e.end.getMonth() + 4, e.end.getDate()); // Am adăugat buffer și la perioade pentru siguranță

        // Verificăm coliziunea pe rânduri
        while (eLanes[lane] && eLanes[lane] > e.start) {
            lane++;
        }

        eLanes[lane] = busyUntil;
        e.lane = lane;
    });
}

function generateLinks(data) {
    genealogyLinks = [];
    const people = data.filter(d => d.type === 'people');
    people.forEach(child => {
        if (child.parents && child.parents.trim() !== "") {
            const pIds = child.parents.split(',');
            pIds.forEach(pid => {
                const parent = people.find(p => p.rawId === pid.trim());
                if (parent) genealogyLinks.push({ source: parent, target: child });
            });
        }
    });
}

function getBracePathDown(w, h) {
    const q = Math.min(10, w / 4); const hw = w / 2; 
    return `M 0,0 Q 0,${h} ${q},${h} L ${hw - q},${h} Q ${hw},${h} ${hw},${h + h} Q ${hw},${h} ${hw + q},${h} L ${w - q},${h} Q ${w},${h} ${w},0`;
}

function renderTimeline(data) {
    if(data.length === 0) {
        peopleGroup.selectAll("*").remove(); eventsGroup.selectAll("*").remove(); linksGroup.selectAll("*").remove();
        return;
    }

    calculateLanes(data); generateLinks(data);

    const minDate = d3.min(data, d => d.start);
    const maxDate = new Date(); 
    const padding = (maxDate - minDate) * 0.1;
    
    xScale = d3.scaleTime().domain([new Date(minDate.getTime() - padding), new Date(maxDate.getTime() + padding)]).range([0, width]);

    const p_bars = peopleGroup.selectAll(".person-group").data(data.filter(d => d.type === 'people'), d => d.id);
    p_bars.exit().remove();
    const p_enter = p_bars.enter().append("g")
        .attr("class", "person-group")
        .on("click", (event, d) => openDetail(d))
        .on("mouseover", function() { d3.select("#hover-tooltip").style("opacity", 1); })
        .on("mouseout", function() { d3.select("#hover-tooltip").style("opacity", 0); })
        .on("mousemove", function(event, d) {
            // Aflăm unde e mouse-ul pe axa timpului
            const currentTransform = d3.zoomTransform(svg.node());
            const currentXScale = currentTransform.rescaleX(xScale);
            const mouseX = d3.pointer(event, svg.node())[0];
            const hoveredDate = currentXScale.invert(mouseX);

            // Dacă mouse-ul a ieșit din anii de viață ai persoanei (marginile rotunjite), ascundem
            if (hoveredDate < d.start || hoveredDate > d.end) {
                d3.select("#hover-tooltip").style("opacity", 0);
                return;
            }

            // Calculăm vârsta exactă în acel moment
            let age = hoveredDate.getFullYear() - d.start.getFullYear();
            let m = hoveredDate.getMonth() - d.start.getMonth();
            if (m < 0 || (m === 0 && hoveredDate.getDate() < d.start.getDate())) { age--; }
            if (age < 0) age = 0;

            // Formatăm anul frumos
            let displayYear = hoveredDate.getFullYear();
            let era = displayYear <= 0 ? " î.Hr." : "";
            displayYear = displayYear <= 0 ? Math.abs(displayYear) + 1 : displayYear;

            // Afișăm textul și poziționăm tooltip-ul lângă cursor
            d3.select("#hover-tooltip")
                .html(`În anul <b>${displayYear}${era}</b><br>avea <b>${age} ani</b>`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 40) + "px")
                .style("opacity", 1);
        });

    p_enter.append("rect").attr("class", "person-bar").attr("height", 24).attr("fill", d => getColorForId(d.rawId, false)).attr("rx", 6).attr("ry", 6);
    
    p_enter.filter(d => d.image && d.image.includes('http'))
           .append("image").attr("href", d => d.image).attr("xlink:href", d => d.image)
           .attr("x", 5).attr("y", 3).attr("width", 18).attr("height", 18)
           .attr("preserveAspectRatio", "xMidYMin slice").attr("clip-path", "url(#avatar-clip)")
           .attr("crossorigin", "anonymous");

    p_enter.append("text").attr("class", "person-label").attr("dy", 16)
           .attr("dx", d => (d.image && d.image.includes('http')) ? 28 : 8)
           .text(d => d.title + (d.ageText ? ` (${d.ageText})` : ''));

    const links = linksGroup.selectAll(".genealogy-link").data(genealogyLinks);
    links.exit().remove();
    links.enter().append("path").attr("class", "genealogy-link");

    const ep_nodes = eventsGroup.selectAll(".event-point-group").data(data.filter(d => d.type === 'events' && d.start.getTime() === d.end.getTime()), d => d.id);
    ep_nodes.exit().remove();
    const ep_enter = ep_nodes.enter().append("g").attr("class", "event-point-group").on("click", (event, d) => openDetail(d));
    ep_enter.append("line").attr("class", "event-line");
    ep_enter.append("circle").attr("class", "event-dot").attr("r", 5);
    ep_enter.append("rect").attr("class", "event-label-bg");
    ep_enter.append("text").attr("class", "event-label").attr("text-anchor", "middle").text(d => d.title);

    const er_nodes = eventsGroup.selectAll(".event-range-group").data(data.filter(d => d.type === 'events' && d.start.getTime() !== d.end.getTime()), d => d.id);
    er_nodes.exit().remove();
    const er_enter = er_nodes.enter().append("g").attr("class", "event-range-group").on("click", (event, d) => openDetail(d));
    er_enter.append("path").attr("class", "event-brace-path").attr("stroke", d => getColorForId(d.rawId, true));
    
    er_enter.append("text").attr("class", "event-brace-label").attr("text-anchor", "middle")
            .attr("fill", d => getColorForId(d.rawId, true))
            .text(d => d.title + (d.ageText ? ` (${d.ageText})` : ''));

    panYTop = 0; panYBottom = 0; lastTransformY = d3.zoomIdentity.y;
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    updatePositions(d3.zoomIdentity);
}

function handleZoom(event) { 
    const dy = event.transform.y - lastTransformY;
    lastTransformY = event.transform.y;

    if (event.sourceEvent && (event.sourceEvent.type === 'mousemove' || event.sourceEvent.type === 'touchmove')) {
        let clientY = event.sourceEvent.type === 'touchmove' ? event.sourceEvent.touches[0].clientY : event.sourceEvent.clientY;

        if (clientY < centerY) {
            panYTop += dy;
            const maxTop = (d3.max(currentItems.filter(d => d.type === 'people'), d => d.lane) || 0) * 35;
            if (panYTop < 0) panYTop = 0; 
            if (panYTop > maxTop) panYTop = maxTop;
        } else {
            panYBottom -= dy; 
            const maxBottom = (d3.max(currentItems.filter(d => d.type === 'events'), d => d.lane) || 0) * 50;
            if (panYBottom < 0) panYBottom = 0; 
            if (panYBottom > maxBottom) panYBottom = maxBottom;
        }
    }
    updatePositions(event.transform); 
    updateCrosshair(); 
}

function updatePositions(transform) {
    if (!xScale) return;
    
    const newXScale = transform.rescaleX(xScale);
    // Afișează doar 4 repere pe mobil, 10 pe desktop
    xAxisGroup.call(d3.axisBottom(newXScale).ticks(width < 600 ? 4 : 10).tickSizeOuter(0));

    const todayX = newXScale(new Date());
    todayGroup.attr("transform", `translate(${todayX}, 0)`);
    todayText.attr("x", 5);

    // 1. OAMENI (Păstrăm Sticky Labels pentru nume și poze)
    peopleGroup.selectAll(".person-group").attr("transform", d => `translate(${newXScale(d.start)}, ${centerY - 28 - (d.lane * 35) + panYTop})`);
    peopleGroup.selectAll(".person-bar").attr("width", d => Math.max(5, newXScale(d.end) - newXScale(d.start)));

    peopleGroup.selectAll(".person-label, image")
        .attr("transform", d => {
            const startX = newXScale(d.start);
            const endX = newXScale(d.end);
            const barWidth = endX - startX;
            let shiftX = 0;
            if (startX < 0 && endX > 20) {
                shiftX = Math.abs(startX) + 10;
                const maxShift = Math.max(0, barWidth - 40); 
                shiftX = Math.min(shiftX, maxShift);
            }
            return `translate(${shiftX}, 0)`;
        });

    // 2. LINKURI GENEALOGICE
    linksGroup.selectAll(".genealogy-link").attr("d", d => {
        const parentX = newXScale(d.source.start) + 15; 
        const parentY = centerY - 28 - (d.source.lane * 35) + 24 + panYTop; 
        const childX = newXScale(d.target.start);
        const childY = centerY - 28 - (d.target.lane * 35) + 12 + panYTop; 
        return `M ${parentX},${parentY} C ${parentX},${childY} ${childX - 20},${childY} ${childX},${childY}`;
    });

    // 3. EVENIMENTE TIP PERIOADĂ (Acolade - Distanțare la 50px)
    eventsGroup.selectAll(".event-range-group")
        .attr("transform", d => `translate(${newXScale(d.start)}, ${centerY + 18 + (d.lane * 50) - panYBottom})`);
    
    eventsGroup.selectAll(".event-brace-path")
        .attr("d", d => getBracePathDown(Math.max(10, newXScale(d.end) - newXScale(d.start)), 10));

    eventsGroup.selectAll(".event-brace-label")
        .attr("dx", d => {
            const startX = newXScale(d.start);
            const endX = newXScale(d.end);
            const visibleStart = Math.max(0, startX);
            const visibleEnd = Math.min(width, endX);
            const visibleCenter = visibleStart + (visibleEnd - visibleStart) / 2;
            return Math.max(10, visibleCenter - startX);
        })
        .attr("dy", 35);

    // 4. EVENIMENTE PUNCTUALE (Unificate la 50px pentru a nu se suprapune cu perioadele)
    eventsGroup.selectAll(".event-point-group")
        .attr("transform", d => `translate(${newXScale(d.start)}, 0)`);

    eventsGroup.selectAll(".event-line")
        .attr("y1", centerY)
        .attr("y2", d => centerY + 40 + (d.lane * 50) - panYBottom); 

    eventsGroup.selectAll(".event-dot")
        .attr("cy", centerY);

    eventsGroup.selectAll(".event-label")
        .attr("y", d => centerY + 55 + (d.lane * 50) - panYBottom); 

    eventsGroup.selectAll(".event-label-bg")
        .attr("x", function() { return -this.parentNode.querySelector('text').getBBox().width/2 - 5; })
        .attr("y", d => centerY + 42 + (d.lane * 50) - panYBottom)
        .attr("width", function() { return this.parentNode.querySelector('text').getBBox().width + 10; })
        .attr("height", 18).attr("rx", 4);
}

function formatHoverDate(date) {
    let year = date.getFullYear();
    let currentYear = new Date().getFullYear();
    let yearsAgo = currentYear - year;
    let era = "d.Hr.";
    let displayYear = year;
    
    if (year <= 0) {
        era = "î.Hr.";
        displayYear = Math.abs(year) + 1; 
    }
    return `Acum ${yearsAgo} ani • Anul ${displayYear} ${era}`;
}

function updateCrosshair() {
    if (currentMouseX === null || !xScale) { crosshairGroup.style("display", "none"); return; }
    crosshairGroup.style("display", null);
    
    const currentTransform = d3.zoomTransform(svg.node());
    const currentXScale = currentTransform.rescaleX(xScale);
    const hoveredDate = currentXScale.invert(currentMouseX);
    
    crosshairLine.attr("x1", currentMouseX).attr("x2", currentMouseX);
    const textStr = formatHoverDate(hoveredDate);
    crosshairText.text(textStr).attr("x", currentMouseX);
    
    const bbox = crosshairText.node().getBBox();
    crosshairBg.attr("x", currentMouseX - bbox.width / 2 - 10).attr("y", 12).attr("width", bbox.width + 20).attr("height", 22);
}

function goToPresent() {
    if (!xScale) return;
    const targetScale = 3; 
    const todayX = xScale(new Date());
    const targetTranslateX = width / 2 - (todayX * targetScale);
    panYTop = 0; panYBottom = 0; 
    svg.transition().duration(1200).call(zoom.transform, d3.zoomIdentity.translate(targetTranslateX, lastTransformY).scale(targetScale));
}

function openExportModal() {
    document.getElementById('drawer').classList.remove('open'); 
    document.getElementById('detail-modal').classList.remove('active');
    closeIframe(); 
    
    document.getElementById('main-overlay').classList.add('active');
    document.getElementById('export-modal').classList.add('active');
}

function processExport(type) {
    closeAll();
    
    const exportBtn = document.querySelector('.btn-export');
    const originalBtnText = exportBtn.innerHTML;
    exportBtn.innerHTML = `⏳ Se procesează...`;
    
    // Definim variabilele în siguranță la nivel înalt
    let exportWidth = width;
    let exportHeight = height;
    let oldCenterY = centerY;
    let currentTransform = d3.zoomTransform(svg.node());
    
    // DETECTĂM MOBILUL DUPĂ SISTEMUL DE OPERARE, NU DUPĂ LĂȚIME!
    // Astfel, un laptop micșorat nu va mai fi confundat niciodată cu un telefon.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Funcția care aduce graficul înapoi la normal (o definim aici ca să o putem folosi oriunde)
    function resetView() {
        if (type === 'full') {
            centerY = oldCenterY;
            svg.attr("width", width).attr("height", height);
            xAxisGroup.attr("transform", `translate(0, ${centerY})`);
            todayLine.attr("y2", height);
            d3.select("#clip-top rect").attr("width", width).attr("height", centerY);
            d3.select("#clip-bottom rect").attr("width", width).attr("y", centerY - 10).attr("height", height - centerY + 10);
            xScale.range([0, width]);
            updatePositions(currentTransform);
        }
    }

    setTimeout(() => {
        try {
            crosshairGroup.style("display", "none");

            if (type === 'full') {
                // Lățime adaptată (2500 pe mobil e suficient de clar, 5000 pe PC e HD pur)
                exportWidth = isMobile ? 2500 : 5000;
                const maxPLane = d3.max(currentItems.filter(d => d.type === 'people'), d => d.lane) || 0;
                const maxELane = d3.max(currentItems.filter(d => d.type === 'events'), d => d.lane) || 0;
                const neededTop = (maxPLane * 35) + 150;
                const neededBottom = (maxELane * 50) + 150;
                
                exportHeight = Math.max(height, neededTop + neededBottom);
                centerY = neededTop;
                
                svg.attr("width", exportWidth).attr("height", exportHeight);
                xAxisGroup.attr("transform", `translate(0, ${centerY})`);
                todayLine.attr("y2", exportHeight);
                
                d3.select("#clip-top rect").attr("width", exportWidth).attr("height", centerY);
                d3.select("#clip-bottom rect").attr("width", exportWidth).attr("y", centerY - 10).attr("height", exportHeight - centerY + 10);

                xScale.range([0, exportWidth]);
                updatePositions(d3.zoomIdentity);
            }

            const svgNode = document.querySelector("#visualization svg");
            const clone = svgNode.cloneNode(true);
            
            clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            clone.style.backgroundColor = "#fdfdfd";

            // Curățăm pozele din interior ca să fentăm securitatea pe iOS/Android
            const images = clone.querySelectorAll("image");
            images.forEach(img => img.remove());
            
            const crosshair = clone.querySelector(".crosshair-group");
            if(crosshair) crosshair.remove();

            // Injectăm un CSS ultra-curat direct în inimă
            const style = document.createElement('style');
            style.textContent = `
                path, line, rect { fill-opacity: 1; }
                .axis-line path { stroke: #cbd5e1; stroke-width: 2px; }
                .axis-line line { stroke: #cbd5e1; stroke-opacity: 0.5; }
                .axis-line text { fill: #94a3b8; font-family: sans-serif; font-size: 12px; }
                .person-bar { stroke: rgba(0,0,0,0.1); stroke-width: 1px; }
                .person-label { fill: #111; font-size: 12px; font-family: sans-serif; font-weight: bold; }
                .genealogy-link { fill: none; stroke: #94a3b8; stroke-width: 2px; stroke-dasharray: 4,4; opacity: 0.5; }
                .event-line { stroke: #c0392b; stroke-width: 1.5px; opacity: 0.7; }
                .event-dot { fill: white; stroke: #c0392b; stroke-width: 2.5px; }
                .event-label { fill: #111; font-size: 12px; font-family: sans-serif; font-weight: bold; }
                .event-label-bg { fill: white; opacity: 0.9; }
                .event-brace-path { fill: none; stroke-width: 2.5px; opacity: 0.85; }
                .event-brace-label { fill: #111; font-size: 12px; font-family: sans-serif; font-weight: bold; }
                .today-line { stroke: #e74c3c; stroke-width: 1.5px; stroke-dasharray: 5,5; opacity: 0.7; }
                .today-text { fill: #e74c3c; font-size: 11px; font-weight: bold; font-family: sans-serif; }
            `;
            clone.insertBefore(style, clone.firstChild);

            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(clone);
            
            // Această codare cu btoa + unescape este secretul succesului pentru diacritice și telefoane
            const encodedData = window.btoa(unescape(encodeURIComponent(svgString)));
            const imgSrc = "data:image/svg+xml;base64," + encodedData;

            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement("canvas");
                    const scale = isMobile ? 1 : 2; // Rezoluție sigură pe mobil, HD nativ pe PC
                    canvas.width = exportWidth * scale;
                    canvas.height = exportHeight * scale;
                    
                    const ctx = canvas.getContext("2d");
                    ctx.fillStyle = "#fdfdfd";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.scale(scale, scale);
                    ctx.drawImage(img, 0, 0);

                    const pngUrl = canvas.toDataURL("image/png");
                    exportBtn.innerHTML = originalBtnText;

                    if (isMobile) {
                        // Mobil: Fereastra pentru "Long Press"
                        document.getElementById('mobile-export-img').src = pngUrl;
                        document.getElementById('main-overlay').classList.add('active');
                        document.getElementById('mobile-export-modal').classList.add('active');
                    } else {
                        // Laptop / PC: Descărcare curată și automată (chiar și cu fereastra mică)
                        const a = document.createElement("a");
                        a.download = type === 'full' ? "Cronologie_Panorama.png" : "Cronologie_Detaliu.png";
                        a.href = pngUrl;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }
                } catch (e) {
                    alert("Eroare la crearea imaginii: " + e.message);
                    exportBtn.innerHTML = originalBtnText;
                } finally {
                    resetView();
                }
            };
            
            img.onerror = function() {
                alert("Securitatea browser-ului a blocat preluarea.");
                exportBtn.innerHTML = originalBtnText;
                resetView();
            };

            img.src = imgSrc;

        } catch (err) {
            alert("Eroare critică: " + err.message);
            exportBtn.innerHTML = originalBtnText;
            resetView();
        }
    }, 150);
}

function applyFilters() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const showP = document.getElementById('check-people').checked;
    const showE = document.getElementById('check-events').checked;
    const checkedCats = Array.from(document.querySelectorAll('.cat-filter:checked')).map(cb => cb.value);

    currentItems = originalItems.filter(item => {
        const matchText = item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
        const matchMainType = (item.type === 'people' && showP) || (item.type === 'events' && showE);
        const matchCat = item.categories.some(cat => checkedCats.includes(cat));
        return matchText && matchMainType && matchCat;
    });
    
    panYTop = 0; panYBottom = 0; 
    renderTimeline(currentItems);
}

function openMapIframe(url, title) {
    document.getElementById('iframe-title').innerText = title;
    document.getElementById('iframe-fallback-btn').href = url; 
    document.getElementById('map-frame').src = url;
    
    document.getElementById('detail-modal').classList.remove('active'); 
    document.getElementById('iframe-modal').classList.add('active'); 
}

function closeIframeAndReturn() {
    document.getElementById('iframe-modal').classList.remove('active');
    setTimeout(() => { document.getElementById('map-frame').src = ''; }, 300);
    document.getElementById('detail-modal').classList.add('active'); 
}

function closeIframe() {
    document.getElementById('iframe-modal').classList.remove('active');
    setTimeout(() => { document.getElementById('map-frame').src = ''; }, 300);
}

function openDrawer() { document.getElementById('main-overlay').classList.add('active'); document.getElementById('drawer').classList.add('open'); }

function closeAll() { 
    // redăm scrollul paginii
    document.body.classList.remove('modal-open');

    // redăm hărții capacitatea de a simți atingerile
    const svgElement = document.querySelector('svg');
    if (svgElement) svgElement.style.pointerEvents = 'auto';

    document.getElementById('main-overlay').classList.remove('active'); 
    document.getElementById('drawer').classList.remove('open'); 
    document.getElementById('detail-modal').classList.remove('active'); 
    document.getElementById('export-modal').classList.remove('active'); 
    
    closeIframe(); 
}

function openDetail(item) {
    // 1. Oprim harta să mai fure atingerile degetului (esențial pentru scroll pe mobil)
    document.body.classList.add('modal-open');
    const svgElement = document.querySelector('svg');
    if (svgElement) svgElement.style.pointerEvents = 'none';

    const badge = document.getElementById('modal-badge');

    // Verificăm dacă avem categorii reale (diferite de cea default)
    const hasRealCategories = item.categories.length > 0 && item.categories[0] !== "Fără Categorie";

    // Dacă avem categorii, le unim cu un punct. Dacă nu, punem tipul (Persoană/Eveniment)
    badge.innerText = hasRealCategories 
        ? item.categories.join(' • ') 
        : (item.type === 'people' ? 'Persoană' : 'Eveniment');

    // Culorile rămân neschimbate, sunt foarte bune
    badge.style.backgroundColor = item.type === 'people' ? '#e8f8f5' : '#ebf5fb';
    badge.style.color = item.type === 'people' ? '#27ae60' : '#2980b9';
    document.getElementById('modal-title').innerText = item.title;
    document.getElementById('modal-desc').innerText = item.description; 
    
    let ageStr = item.ageText ? ` • ${item.ageText}` : '';
    document.getElementById('modal-date').innerText = item.displayDate + ageStr;
    
    const imgBox = document.getElementById('modal-img-box');
    const modalImg = document.getElementById('modal-img'); // Luăm referința imaginii

    if(item.image && item.image.includes('http')) {
        modalImg.src = item.image;
        
        // Dacă elementul este o persoană, aliniem poza la marginea de sus (top)
        // Dacă este un eveniment, o lăsăm centrată (center) ca până acum
        modalImg.style.objectPosition = item.type === 'people' ? 'center 15%' : 'center';
        
        imgBox.style.display = 'block';
    } else { imgBox.style.display = 'none'; }
    
    const linksContainer = document.getElementById('modal-links');
    const customLinksContainer = document.getElementById('custom-links');
    linksContainer.innerHTML = ''; 
    customLinksContainer.innerHTML = '';

    if (item.start) {
        const an = item.start.getFullYear();
        let displayYear = an > 0 ? an : Math.abs(an) + 1 + ' î.Hr.';

        const urlRR = `https://runningreality.org/#01/01/${an}&46.00,15.00&zoom=5`;
        const btnRR = document.createElement('a');
        btnRR.href = "javascript:void(0)"; 
        btnRR.className = "external-btn rr-btn";
        btnRR.innerHTML = `🌍 Harta Politică ${displayYear} (Running Reality)`;
        btnRR.onclick = () => openMapIframe(urlRR, `Running Reality - Lumea în anul ${displayYear}`);
        linksContainer.appendChild(btnRR);

        const urlOM = `https://www.oldmapsonline.org/en/history/regions#position=5/46.00/15.00&year=${an}`;
        const btnOM = document.createElement('a');
        btnOM.href = "javascript:void(0)";
        btnOM.className = "external-btn om-btn";
        btnOM.innerHTML = `📜 Arhiva de Hărți ${displayYear} (Old Maps Online)`;
        btnOM.onclick = () => openMapIframe(urlOM, `Old Maps Online - Lumea în anul ${displayYear}`);
        linksContainer.appendChild(btnOM);
    }

    if (item.links && item.links.length > 0) {
        document.getElementById('custom-links-title').style.display = 'block';
        item.links.forEach((link, index) => {
            const btnCustom = document.createElement('a');
            btnCustom.href = link;
            btnCustom.target = "_blank";
            btnCustom.className = "external-btn";
            btnCustom.innerHTML = `🔗 Accesează Sursa ${index + 1}`;
            customLinksContainer.appendChild(btnCustom);
        });
    } else {
        document.getElementById('custom-links-title').style.display = 'none';
    }

    document.getElementById('drawer').classList.remove('open');
    document.getElementById('main-overlay').classList.add('active');
    setTimeout(() => { document.getElementById('detail-modal').classList.add('active'); }, 50);
}

window.onload = loadData;
