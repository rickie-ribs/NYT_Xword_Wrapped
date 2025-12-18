// --- INPUT CONSTANS ---
const DATA_FILES = {
    card1: './card_data/_card1_summary.json',
    card2: './card_data/_card2_weekly_summary.json',
    card3: './card_data/_card3_histograms.json',
    card4: './card_data/_card4_evolution.json',
    card5: './card_data/_card5_struggles.json',
    card6: './card_data/_card6_fast_days.json',
};
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL_NAMES = {
    "Mon": "Monday", 
    "Tue": "Tuesday", 
    "Wed": "Wednesday", 
    "Thu": "Thursday", 
    "Fri": "Friday", 
    "Sat": "Saturday", 
    "Sun": "Sunday"
};
const DAY_COLORS = {
    "Mon": "rgb(247, 218, 33)", // spelling bee yellow
    "Tue": "rgb(180, 168, 255)", // connections purple
    "Wed": "rgb(224, 92, 86)", // letter boxed red
    "Thu": "rgba(127, 220, 208, 1)", // strands teal
    "Fri": "rgba(216, 142, 202, 1)", // Pips purple
    "Sat": "rgba(109, 224, 60, 1)", // Tiles green
    "Sun": "rgba(233, 153, 24, 1)"  // sudoku orange
};

// --- CORE UTILITY FUNCTIONS ---

/**
 * Converts time strings like '5m 46s' or '12m 00s' into '5:46' or '12:00' format.
 * @param {string} timeStr - The time string from the JSON.
 * @returns {string} - The time in MM:SS format.
 */
function formatTimeToMMSS(timeStr) {
    if (!timeStr) return "00:00";
    const parts = timeStr.match(/(\d+)\s*m\s*(\d+)\s*s/);
    if (parts) {
        let minutes = parts[1];
        const seconds = parts[2].padStart(2, '0'); // Seconds always padded (e.g., 05)

        // Remove leading zero from minutes if it exists and is > 0
        if (minutes.length > 1 && minutes.startsWith('0')) {
            minutes = minutes.substring(1);
        }
        
        return `${minutes}:${seconds}`;
    }
    return timeStr; // Return original if format is unexpected
}

// Creation of the histograms used on Card 3
function renderDayHistogram(containerId, chartData, maxFrequency) {
    const margin = { top: 10, right: 20, bottom: 20, left: 0 };
    const containerElem = document.getElementById(containerId);
    const chartWidth = containerElem ? containerElem.clientWidth : 400;
    const chartHeight = 100;

    const width = chartWidth - margin.left - margin.right;
    const height = chartHeight - margin.top - margin.bottom;

    // --- 1. DETECT THE PEAK FOR THIS DAY ---
    const maxVal = d3.max(chartData, d => d.frequency);
    // Extract day from containerId (assuming format "hist-Mon", "hist-Tue", etc.)
    const dayName = containerId.split('-')[1] || "Mon";

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- 2. DEFINE SVG GRADIENTS ---
    const defs = svg.append("defs");
    const dayColors = {
        "Mon": "#9b59b6", "Tue": "#8e44ad", "Wed": "#2980b9", 
        "Thu": "#3498db", "Fri": "#1abc9c", "Sat": "#2ecc71", "Sun": "#f1c40f"
    };
    const gradId = `grad-${dayName}`;
    const baseColor = dayColors[dayName] || "#4d88f9";
    
    const grad = defs.append("linearGradient")
        .attr("id", gradId)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", baseColor);
    grad.append("stop").attr("offset", "100%").attr("stop-color", d3.rgb(baseColor).darker(1.5));

    // --- 3. SCALES ---

    // X Bar Scale: Used ONLY to calculate bar position and width
    const xBar = d3.scaleBand()
        .domain(chartData.map(d => d.bin_index)) // Domain is the 0-7 bin index
        .range([0, width])
        .paddingInner(0.15);

    // X Axis Scale: Used for placing the labels and tick lines at the edges
    // The domain goes from the start of the first bin (0) to the end of the last bin (8).
    const x = d3.scaleLinear()
        .domain([0, chartData.length]) // Domain is 0 to 8 total boundaries
        .range([0, width]);

    // Y Scale: Frequency (Linear Scale, uses the GLOBAL maxFrequency)
    const y = d3.scaleLinear()
        .domain([0, maxFrequency * 1.1])
        .range([height, 0]);

    // Draw Ghost Grid Lines (Vertical)
    svg.selectAll(".grid-line")
        .data(x.ticks(chartData.length))
        .enter().append("line")
        .attr("class", "grid-line")
        .attr("x1", d => x(d))
        .attr("x2", d => x(d))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "rgba(255,255,255,0.05)")
        .attr("stroke-dasharray", "2,2");

    // --- DRAW BARS ---
    svg.selectAll(".hist-bar")
        .data(chartData)
        .enter().append("rect")
        .attr("class", "hist-bar")
        .attr("x", d => xBar(d.bin_index))
        .attr("width", xBar.bandwidth())
        .attr("y", height) // Start from bottom for animation
        .attr("height", 0) 
        .attr("fill", `url(#${gradId})`)
        // Peak Finder Styling
        .style("filter", d => (d.frequency === maxVal && d.frequency > 0) ? "brightness(1.4) drop-shadow(0 0 4px rgba(255,255,255,0.2))" : "none")
        .style("stroke", d => (d.frequency === maxVal && d.frequency > 0) ? "rgba(255,255,255,0.4)" : "none")
        .transition()
        .duration(800)
        .delay((d, i) => i * 40)
        .attr("y", d => y(d.frequency)) 
        .attr("height", d => height - y(d.frequency));
        
    // --- DRAW FREQUENCY LABELS ---
    svg.selectAll(".frequency-label")
        .data(chartData)
        .enter().append("text")
        
        // Filter out any data points where the frequency is 0
        .filter(d => d.frequency > 0) 
        
        // X position: Center of the bar
        .attr("x", d => d.frequency === maxVal ? xBar(d.bin_index) + xBar.bandwidth() / 2 : xBar(d.bin_index) + xBar.bandwidth() / 2 )
        .attr("text-anchor", "middle")
        // Y position: Just above the top of the bar
        .attr("y", d => y(d.frequency) - 5) 
        
        // Text alignment and styling
        .style("font-size", d => d.frequency === maxVal ? "14px" : "11px")
        .style("font-weight", d => d.frequency === maxVal ? "800" : "400")
        .style("fill", dayColors[dayName])
        .style("opacity", 0) // Start invisible
        
        // The text content is the frequency count
        .text(d => d.frequency)
        
        // Animation to fade in the labels
        .transition()
        .duration(800)
        .style("opacity", 1);
    
    
    // --- AXES ---
    // Map the chartData to a lookup object for easy access by bin_index
    const dataLookup = new Map(chartData.map(d => [d.bin_index, d]));
    
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x) // Use the Linear Scale 'x'
            .ticks(chartData.length)
            .tickSize(4)
            .tickFormat(d => {
                const binIndex = d - 1;
                if (binIndex >= 0 && binIndex < chartData.length) { 
                    const dataPoint = dataLookup.get(binIndex);
                    
                    if (dataPoint && dataPoint.time_end_min) {
                        const maxTimeMin = dataPoint.time_end_min;
                        
                        const minutes = Math.floor(maxTimeMin);
                        const seconds = Math.round((maxTimeMin % 1) * 60);
                        const timeString = `${minutes}m ${seconds}s`;
                        
                        return formatTimeToMMSS(timeString);
                    }
                }
                return ''; 
            })
        )
        .call(g => g.select(".domain").attr("stroke", "rgba(255,255,255,0.1)")) // Fade baseline
        .selectAll("text")
        .style("font-size", "10px") // Smaller, cleaner labels
        .style("fill", "#666")
        .style("text-anchor", "middle");

    // Y-Axis (Frequency) - Suppress ticks but keep axis line for cleaner look
    svg.append("g")
        .call(d3.axisLeft(y).ticks(0).tickSizeOuter(0))
        .attr("stroke-opacity", 0.2);
}

// Creation of the legend used on charts in Card 2 and Card 4
function renderLegend(containerElement, dayOrder, dayColors) {
    containerElement.html(''); // Clear existing content
    
    // Create a row of legend items
    const legendItems = containerElement.selectAll(".legend-item")
        .data(dayOrder)
        .enter().append("div")
        .attr("class", "legend-item");        
        
    // Add color swatch (circle)
    legendItems.append("svg")
        .attr("width", 17)
        .attr("height", 17)
        .append("circle")
        .attr("cx", 8.5)
        .attr("cy", 8.5)
        .attr("r", 8)
        .style("fill", d => dayColors[d]);

    // Add label text
    legendItems.append("span")
        .text(d => d);
}

// Drawing of the lines used on Card 4
function drawLineSequentially(index, normalizedDataByDay, svg, lineGenerator, labelContainer, legendContainer, x, y, biggestImprover) {
    
    
    if (index >= DAY_ORDER.length) {
        // --- ALL LINES DRAWN ---
        labelContainer.style("opacity", 0);
        // REVEAL THE TREND SUMMARY
        const summary = d3.select("#trend-summary-container");
        const trendText = d3.select("#trend-text");
        
        trendText.html(`
            You improved on <span class="highlight-day">${biggestImprover.dayName}s</span> faster than any other day, 
            cutting your average by <span class="highlight-day">${biggestImprover.improvement.toFixed(0)}%</span> since January.
        `);

        summary.classed("hidden", false).style("opacity", 1);
        return;
    }

    const day = DAY_ORDER[index];
    const dayData = normalizedDataByDay.get(day);
    const lineDrawDuration = 1800;

    if (dayData && dayData.length > 1) { // Ensure enough points for a line
        const dayFullName = DAY_FULL_NAMES[day];
        const dayColor = DAY_COLORS[day];

        // --- 1. CREATE LINEAR GRADIENT FOR THIS SPECIFIC LINE ---
        // This creates a "Fade-in" effect from left to right
        const gradId = `line-grad-${day}`;
        const defs = svg.select("defs").size() ? svg.select("defs") : svg.append("defs");
        
        const lineGrad = defs.append("linearGradient")
            .attr("id", gradId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", "100%").attr("y2", 0);

        lineGrad.append("stop").attr("offset", "0%").attr("stop-color", dayColor).attr("stop-opacity", 0.5);
        lineGrad.append("stop").attr("offset", "100%").attr("stop-color", dayColor).attr("stop-opacity", 1);

        labelContainer.text(`${dayFullName}`)
                        .style("opacity", 1)
                        .style("color", dayColor);
        
        // --- 2. DRAW THE LINE WITH ANIMATION ---
        const path = svg.append("path")
            .datum(dayData)
            .attr("fill", "none")
            .attr("stroke", `url(#${gradId})`)
            .attr("stroke-width", 2)
            .attr("d", lineGenerator)
            .attr("class", ` line-path day-line-${day}`);

        const length = path.node().getTotalLength();

        // Set the initial state for the transition
        path.attr("stroke-dasharray", length + " " + length)
            .attr("stroke-dashoffset", length);

        // Start the drawing transition
        path.transition()
            .duration(lineDrawDuration)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end", () => {
                // --- 3. ADD END-POINT MARKER ---
                const lastPoint = dayData[dayData.length - 1];
                
                svg.append("circle")
                    .attr("cx", x(lastPoint.day_of_year)) 
                    .attr("cy", y(lastPoint.normalized_time)) 
                    .attr("r", 0) 
                    .attr("fill", dayColor)
                    .style("filter", "drop-shadow(0 0 3px rgba(255,255,255,0.5))")
                    .transition()
                    .duration(400)
                    .attr("r", 4); 
                
                // 4. Once the drawing is complete, start the next line's drawing
                drawLineSequentially(index + 1, normalizedDataByDay, svg, lineGenerator, labelContainer, legendContainer, x, y, biggestImprover);
            });
            
    } else {
        // Skip days with insufficient data
        drawLineSequentially(index + 1, normalizedDataByDay, svg, lineGenerator, labelContainer, legendContainer, x, y, biggestImprover);
    }
}

// Rendering of the completion curve on Card 7
function renderCompletionChart(containerId, chartData, actualSeconds, startDelay, totalSolveDuration) {
    const container = d3.select(containerId);
    container.html(""); // Clear

    const margin = { top: 20, right: 10, bottom: 10, left: 35 };
    const width = container.node().clientWidth - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- SCALES ---
    const x = d3.scaleLinear()
        .domain(d3.extent(chartData, d => d.time))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0]);

    // --- GRADIENT FOR THE LINE ---
    const defs = svg.append("defs");
    const lineGrad = defs.append("linearGradient")
        .attr("id", "chart-line-grad")
        .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
    lineGrad.append("stop").attr("offset", "0%").attr("stop-color", "#f1c40f").attr("stop-opacity", 0.4);
    lineGrad.append("stop").attr("offset", "100%").attr("stop-color", "#f1c40f").attr("stop-opacity", 1);

    const clipRect = defs.append("clipPath")
        .attr("id", "reveal-clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0) 
        .attr("height", height);

    // --- AREA FILL (The "Glow" beneath the line) ---
    const area = d3.area()
        .x(d => x(d.time))
        .y0(height)
        .y1(d => y(d.percent))
        .curve(d3.curveMonotoneX);
    svg.append("path")
        .datum(chartData)
        .attr("fill", "rgba(241, 196, 15, 0.1)") // Increased slightly for better visibility
        .attr("d", area)
        .attr("clip-path", "url(#reveal-clip)"); // Apply the clip path

    // --- THE LINE ---
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.percent))
        .curve(d3.curveMonotoneX);

    const path = svg.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", "url(#chart-line-grad)")
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("clip-path", "url(#reveal-clip)");

    // Animation: Draw the line in sync with the crossword
    clipRect.transition()
        .delay(startDelay)
        .duration(totalSolveDuration)
        .ease(d3.easeLinear)
        .attr("width", width)
        .delay(startDelay)
        .on("end", () => {
            // --- THE CELEBRATION ---
            isConfettiActive = true;
            // 1. Trigger Screen Shake on the main card container
            const card = d3.select("#card-7");
            card.classed("apply-shake", true);
            
            // Remove the class after animation so it can be re-triggered
            setTimeout(() => card.classed("apply-shake", false), 600);

            // 2. Launch Gold Confetti
            const end = Date.now() + (2 * 1000); // 2 seconds of confetti
            const colors = ['#f1c40f', '#e67e22', '#ffffff'];

            // Compute confetti launch origins relative to the centered .app-frame if available
            const _confettiOrigins = (() => {
                const fallback = {
                    left: { x: 0, y: 0.8 },
                    right: { x: 1, y: 0.8 }
                };

                const frameElem = document.querySelector('.app-frame');
                if (!frameElem) return fallback;

                const r = frameElem.getBoundingClientRect();
                const vw = window.innerWidth || document.documentElement.clientWidth;
                const vh = window.innerHeight || document.documentElement.clientHeight;

                // Horizontal insets (8% from left/right edge of the frame)
                const leftX = (r.left + r.width * 0.08) / vw;
                const rightX = (r.left + r.width * 0.92) / vw;

                // Launch roughly from 90% down the frame (near bottom)
                const bottomY = (r.top + r.height * 0.9) / vh;

                const clamp = v => Math.min(Math.max(v, 0), 1);

                return {
                    left: { x: clamp(leftX), y: clamp(bottomY) },
                    right: { x: clamp(rightX), y: clamp(bottomY) }
                };
            })();

            (function frame() {
                if (!isConfettiActive) return;
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: _confettiOrigins.left,
                    colors: colors
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: _confettiOrigins.right,
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                } else {
                    isConfettiActive = false;
                }
            }());
        });

    // --- AXES (Subtle) ---
    svg.append("g")
        .attr("class", "replay-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(0).tickFormat(""));

    svg.append("g")
        .attr("class", "replay-axis")
        .call(d3.axisLeft(y).tickValues([0,25,50,75,100]).tickFormat(d => d + "%"));
    
    // Add Chart Title
    svg.append("text")
        .attr("y", -margin.top/2)        
        .attr("x", width/2)                  
        .style("text-anchor", "middle")
        .style("fill", "#888")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("text-transform", "uppercase")
        .text("Puzzle Completion %");

    // Add Horizontal Grid Lines
    svg.append("g")			
        .attr("class", "replay-grid")
        .selectAll("line")
        .data([25, 50, 75])
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => y(d))
        .attr("y2", d => y(d))
        .attr("stroke", "#333")
        .attr("stroke-dasharray", "4,4")
        .attr("stroke-width", 1);
}

/**
 * Animates the drawing of two nested arcs: Total Completed and Gold Star Completed.
 */
function animateArc(canvas, data) {
    const ctx = canvas.getContext('2d');
    const size = 200;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = 80;
    const thickness = 18;
    
    // Calculate final rates for both metrics
    const finalRateTotal = (data.total_completed / data.total_available) * 100;
    const finalRateGold = (data.gold_star_completed / data.total_available) * 100;
    
    // --- 1. CREATE PREMIUM GRADIENTS ---
    // Blue Gradient for Total
    const gradTotal = ctx.createLinearGradient(0, 0, 0, size);
    gradTotal.addColorStop(0, '#2c3e50'); // Darker slate
    gradTotal.addColorStop(1, '#4d88f9'); // Brighter blue

    // Gold Gradient for Mastery
    const gradGold = ctx.createLinearGradient(0, 0, 0, size);
    gradGold.addColorStop(0, '#fff3a0'); // Highlight
    gradGold.addColorStop(0.5, '#ffc600'); // Mid gold
    gradGold.addColorStop(1, '#e67e22'); // Deep bronze/orange
    
    const duration = 2500; 
    const goldArcDelay = 400;
    let startTime;

    // Drawing logic that handles the animation frame
    function draw(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        
        // Calculate total progress (0 to 1)
        const progressTotal = Math.min(1, elapsed / duration);
        const currentRateTotal = finalRateTotal * progressTotal;
        
        // 1. Calculate Gold Arc Progress with Delay
        // The delay time must be subtracted from the elapsed time.
        const goldElapsed = Math.max(0, elapsed - goldArcDelay);
        const progressGold = Math.min(1, goldElapsed / (duration - goldArcDelay));
        const currentRateGold = finalRateGold * progressGold;

        // 2. Clear the canvas for the new frame
        ctx.clearRect(0, 0, size, size);
        
        // --- 3. Draw Background Arc (Full Circle) ---
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#1a1a1a'; // Deepest grey/black
        ctx.lineWidth = thickness + 2;
        ctx.stroke();
        // Inner "recessed" shadow effect
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // --- 4. Draw Total Completed Arc (The longer, underlying arc) ---
        let startAngle = -Math.PI / 2;
        let endAngleTotal = (currentRateTotal / 100) * 2 * Math.PI + startAngle;

        if (currentRateTotal > 0 && currentRateTotal < 100) {
            endAngleTotal += 0.0001; 
        } else if (currentRateTotal >= 100) {
            endAngleTotal = startAngle + 2 * Math.PI;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngleTotal);
        ctx.strokeStyle = gradTotal;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.stroke();


        // --- 5. Draw Gold Star Completed Arc ---
        if (elapsed >= goldArcDelay) { 
            let endAngleGold = (currentRateGold / 100) * 2 * Math.PI + startAngle;
            
            if (currentRateGold > 0 && currentRateGold < 100) {
                endAngleGold += 0.0001;
            } else if (currentRateGold >= 100) {
                endAngleGold = startAngle + 2 * Math.PI;
            }

            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(255, 198, 0, 0.4)';
            ctx.strokeStyle = gradGold;
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + 0.001);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngleGold);
            ctx.globalAlpha = 0.9 + Math.sin(elapsed / 200) * 0.1;
            ctx.stroke();
            ctx.restore();
        }

        // 6. Update the text in the center
        document.getElementById('completion-rate').textContent = `${currentRateGold.toFixed(0)}%`;
        
        // 7. Continue the loop if not finished
        if (progressTotal < 1) { // Check total progress to determine when to stop
            requestAnimationFrame(draw);
        } else {
             // Ensure the final, correct Gold Star value is displayed
             document.getElementById('completion-rate').textContent = `${finalRateGold.toFixed(0)}%`;

             const differenceElement = document.getElementById('hint-difference');
             
             // Calculate the difference percentage
             const differenceRate = finalRateTotal - finalRateGold;

             // Condition check: Gold < 100% AND Total > Gold
             if (finalRateGold < 100 && differenceRate > 0) {
                 differenceElement.textContent = `+${differenceRate.toFixed(0)}%`;
                 differenceElement.style.opacity = 1; // Make it visible
             } else {
                 differenceElement.textContent = ''; // Clear if the condition is not met
                 differenceElement.style.opacity = 0;
             }
        }
    }

    // Start the animation loop
    requestAnimationFrame(draw);
}

// --- CARD 1 RENDERING ---

async function renderCard1() {
    try {
        const response = await fetch(DATA_FILES.card1);
        const data = await response.json();

        // 1. SELECT ELEMENTS FOR ANIMATION
        // We target the stat boxes and the time summary for the staggered effect
        const container = d3.select("#card-1");
        const animatedElements = container.selectAll(".stat-box, .achievement-container, .time-summary");
        const chartNumber = container.select(".chart-rate-number");
        const differenceElement = document.getElementById('hint-difference');

        // 2. RESET STATE (Hide before reveal)
        animatedElements
            .interrupt() // Stop any previous transitions
            .style("opacity", 0)
            .style("transform", "translateY(30px)");
        chartNumber
            .interrupt() // Stop any previous transitions
            .style("opacity", 0)
            //.style("transform", "translateY(30px)");
        differenceElement.textContent = '';
        differenceElement.style.opacity = 0;
        
        // 3. Update text stats
        document.getElementById('total-puzzles').textContent = data.total_completed;
        document.getElementById('gold-star-puzzles').textContent = data.gold_star_completed;
        document.getElementById('total-time').textContent = data.total_time_dhms;
        // Set the initial rate display to 0% before starting the animation
        document.getElementById('completion-rate').textContent = `0%`;

        // 4. Prepare Canvas
        const canvas = document.getElementById('completion-chart');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        
        // 5. TRIGGER STAGGERED ENTRANCE
        animatedElements.transition()
            .delay((d, i) => i * 250) // 0.25s gap between each box appearing
            .duration(1000)
            .style("opacity", 1)
            .style("transform", "translateY(0)")
            .on("end", function() {
                // 6. START CANVAS ANIMATION
                // We only start the arc animation once the container is visible
                chartNumber.transition()
                    .duration(200)
                    .style("opacity", 1)
                    //.style("transform", "translateY(0)");

                if (d3.select(this).classed("achievement-container")) {
                    animateArc(canvas, { 
                        total_completed: data.total_completed, 
                        gold_star_completed: data.gold_star_completed,
                        total_available: data.total_available 
                    });
                }
            });

    } catch (error) {
        console.error("Error loading or rendering Card 1 data:", error);
    }
}

// --- CARD 2 RENDERING (Day by day timing Bar Chart) ---

async function renderCard2() {
    try {
        const response = await fetch(DATA_FILES.card2);
        const chartData = await response.json(); // Array of objects

        // Define the order of days and map for full names
        const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const dayMap = {
            "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday", 
            "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday"
        };

        // Sort the data using the abbreviation
        chartData.sort((a, b) => dayOrder.indexOf(a.Day_of_Week) - dayOrder.indexOf(b.Day_of_Week));

        const container = document.getElementById('weekly-average-chart');
        container.innerHTML = ''; // Clear existing chart

        const margin = { top: 0, right: 20, bottom: 0, left: 50 };
        const containerWidth = 400;
        const containerHeight = 700; 

        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        // Find the absolute maximum across all data points
        const numericalSlowest = chartData.map(d => d.slowest_in_minutes); 
        const maxSlowest = Math.max(...numericalSlowest); 

        const svg = d3.select(container).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // X-SCALE: Time in Minutes (LINEAR SCALE)
        const x = d3.scaleLinear()
            .domain([0, maxSlowest * 1.1]) // Domain is the time range
            .range([0, width]); // Maps to the chart width

        // Y-SCALE: Days of the Week (BAND SCALE)
        const y = d3.scaleBand()
            .range([0, height]) // Maps to the chart height
            .domain(chartData.map(d => d.Day_of_Week)) 
            .padding(0.3); // Padding controls space between the horizontal bars
        
        // Y1-SCALE: Inner scale for positioning the three bars within a single day's band
        const metricNames = ['fastest', 'average', 'slowest'];

        const y1 = d3.scaleBand()
            .domain(metricNames) // The three categories we are plotting
            .range([0, y.bandwidth()]) // Maps to the width of the main day bar
            .paddingInner(0.05); // Small padding between the three bars

        // Color scale (Lighter to Darker based on Time)
        const colorScale = d3.scaleLinear()
            .domain([d3.min(chartData, d => d.average_in_minutes), d3.max(chartData, d => d.average_in_minutes)])
            .range(["#404040", "var(--accent-color)"]);

        // Group the data: We need to bind the full data object to a group element first
        const dayGroup = svg.selectAll(".day-group")
            .data(chartData)
            .enter().append("g")
            .attr("class", "day-group")
            // Translate the group to the correct Y position for that day
            .attr("transform", d => `translate(0, ${y(d.Day_of_Week)})`);

        // create color gradients for metrics
        // --- 1. DEFINE SVG GRADIENTS ---
        const defs = svg.append("defs");

        // Green Gradient (Fastest)
        const greenGrad = defs.append("linearGradient")
            .attr("id", "grad-green")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%"); // Horizontal gradient
        greenGrad.append("stop").attr("offset", "0%").attr("stop-color", "#24c524");
        greenGrad.append("stop").attr("offset", "100%").attr("stop-color", "#007700");

        // Gold Gradient (Average)
        const goldGrad = defs.append("linearGradient")
            .attr("id", "grad-gold")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        goldGrad.append("stop").attr("offset", "0%").attr("stop-color", "#fff3a0");
        goldGrad.append("stop").attr("offset", "50%").attr("stop-color", "#ffc600");
        goldGrad.append("stop").attr("offset", "100%").attr("stop-color", "#e67e22");

        // Grey Gradient (Slowest)
        const greyGrad = defs.append("linearGradient")
            .attr("id", "grad-grey")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        greyGrad.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff");
        greyGrad.append("stop").attr("offset", "100%").attr("stop-color", "#c4c4c4");

        // Define the metrics to plot for each day
        const metrics = [
            { name: 'fastest', key: 'fastest_in_minutes', timeKey: 'fastest_in_minutes_Time', color: "url(#grad-green)" },
            { name: 'average', key: 'average_in_minutes', timeKey: 'average_in_minutes_Time', color: "url(#grad-gold)" },
            { name: 'slowest', key: 'slowest_in_minutes', timeKey: 'slowest_in_minutes_Time', color: "url(#grad-grey)" }
        ];

        // Bars (Draw three bars for each day group)
        dayGroup.selectAll(".sub-bar")
            .data(d => metrics.map(m => ({
                day: d.Day_of_Week,
                value: d[m.key],
                timeValue: d[m.timeKey],
                name: m.name,
                color: m.color
            })))
            .enter().append("rect")
            .attr("class", d => `sub-bar ${d.name}`)
            // X position starts at 0
            .attr("x", 0) 
            .attr("width", 0) // Starts at 0 width for animation
            // Y position uses the INNER scale (y1)
            .attr("y", d => y1(d.name)) 
            .attr("height", y1.bandwidth()) // Height uses the INNER bandwidth
            .attr("fill", d => d.color)
            .transition()
            .duration(800)
            .delay((d, i) => i * 200)
            .attr("width", d => x(d.value)); // Grows to the X-scale time value

        
        // Value Labels (Three labels for each day)
        dayGroup.selectAll(".sub-label")
            .data(d => metrics.map(m => ({
                day: d.Day_of_Week,
                value: d[m.key],
                timeValue: d[m.timeKey],
                name: m.name,
                color: m.color
            })))
            .enter().append("text")
            .attr("class", "value-label")
            .attr("x", d => x(d.value) + 5) // X position at the end of the bar + offset
            // Y position uses the INNER scale, centered within the bar
            .attr("y", d => y1(d.name) + y1.bandwidth() / 2 + 6) 
            .attr("text-anchor", "start")
            .style("fill", d => d.color) 
            .text(d => formatTimeToMMSS(d.timeValue))
            .style("opacity", 0)
            .transition()
            .duration(500)
            .delay((d, i) => i * 200 + 1200)
            .style("opacity", 1);
        
        // Day Labels (X-axis)
        svg.selectAll(".day-label")
            .data(chartData)
            .enter().append("text")
            .attr("class", "day-label")
            .attr("x", -10) // Positioned outside the chart area (left of 0)
            .attr("y", d => y(d.Day_of_Week) + y.bandwidth() / 2 + 5) // Center vertically + small offset
            .attr("text-anchor", "end") // Right-aligned to the margin
            .text(d => d.Day_of_Week);
        
        // --- LEGEND SETUP ---
        const legendContainer = d3.select("#card2-legend");
        legendContainer.html(''); // Clear previous legend

        const legendData = [
            { label: 'Fastest', color: "url(#grad-green)" }, 
            { label: 'Average', color: "url(#grad-gold)" },
            { label: 'Slowest', color: "url(#grad-grey)" } 
        ];

        // Create a horizontal row of legend items
        const legendItems = legendContainer.selectAll(".legend-item")
            .data(legendData)
            .enter().append("div")
            .attr("class", "legend-item")
            .attr("style", "margin-top: 15px;");
            
        // Add color swatch (small circle)
        legendItems.append("svg")
            .attr("width", 17)
            .attr("height", 17)
            .append("circle")
            .attr("cx", 7.5)
            .attr("cy", 7.5)
            .attr("r", 8)
            .style("fill", d => d.color); // Use the color variable

        // Add label text
        legendItems.append("span")
            .text(d => d.label);

    } catch (error) {
        console.error("Error loading or rendering Card 2 data:", error);
    }
}

// --- CARD 3 RENDERING (Frequency Histograms) ---

async function renderCard3() {
    try {
        const response = await fetch(DATA_FILES.card3);
        const rawData = await response.json();
        
        
        // --- DATA COERCION AND GROUPING ---
        rawData.forEach(d => {
             d.frequency = parseFloat(String(d.frequency).trim());
        });

        const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        
        // Group the flat data array into a map: { "Mon": [ bin0, bin1, ... ], "Tue": [ ... ] }
        const dataByDay = d3.group(rawData, d => d.Day_of_Week);

        // Find the absolute max frequency across ALL days for consistent Y-scale
        const allFrequencies = rawData.map(d => d.frequency);
        const maxFrequency = d3.max(allFrequencies);

        const container = d3.select("#daily-histograms-container").html('')
                                                                    .style("min-height", "750px") 
                                                                    .style("display", "block");;
        
        // --- ITERATE AND RENDER SEVEN CHARTS ---
        dayOrder.forEach((day, i) => {
            const dayData = dataByDay.get(day);
            
            if (dayData && dayData.length > 0) {
                // 1. Immediately create the container (hidden by default)
                const dayContainer = container.append("div")
                    .attr("class", "day-histogram-wrapper")
                    .attr("id", `histogram-wrapper-${day}`)
                    .style("opacity", 0) // Start invisible
                    .style("transform", "translateY(10px)"); 

                // 2. Add structural elements
                dayContainer.append("div")
                    .attr("class", "histogram-day-label")
                    .text(day);

                dayContainer.append("div")
                    .attr("class", "histogram-chart-area")
                    .attr("id", `histogram-${day}`);

                // 3. SET THE DELAYED TRIGGER
                // i * 1000ms means Mon starts at 0s, Tue at 1s, Wed at 2s...
                setTimeout(() => {
                    // Fade in the container
                    dayContainer.transition()
                        .duration(600)
                        .style("opacity", 1)
                        .style("transform", "translateY(0)");

                    // Render the actual chart content
                    renderDayHistogram(`histogram-${day}`, dayData, maxFrequency);
                }, i * 1000); 
            }
        });

    } catch (error) {
        console.error("Error loading or rendering Card 3 data:", error);
    }
}

// --- CARD 4 RENDERING (Running Average Line Chart) ---

async function renderCard4() {
    try {

        // clear the trend summary (disable CSS transition to hide instantly)
        const summary = d3.select("#trend-summary-container");
        summary.interrupt();
        // Temporarily disable the CSS transition so opacity change is immediate
        summary.style("transition", "none").classed("hidden", true).style("opacity", 0);
        // Force reflow to ensure the change is applied immediately
        const _node = summary.node(); if (_node) _node.offsetHeight;
        // Restore the original transition on the next tick so future shows still animate
        setTimeout(() => summary.style("transition", null), 0);

        const response = await fetch(DATA_FILES.card4);
        const rawData = await response.json();
        let chartData = Array.isArray(rawData) ? rawData : rawData.data || [];

        if (chartData.length === 0) { /* ... error handling ... */ return; }

        // --- 1. DATA COERCION AND GROUPING ---
        chartData.forEach(d => {
             d.day_of_year = parseInt(String(d.day_of_year).trim());
             d.average_time_min = parseFloat(String(d.average_time_min).trim());
        });

        // Group data by day of the week
        const dataByDay = d3.group(chartData, d => d.Day_of_Week);
        
        // --- 2. NORMALIZATION ---
        const maxTimeByDay = new Map();
        
        // Find the max time achieved for EACH day of the week across the entire year
        DAY_ORDER.forEach(day => {
            const dayData = dataByDay.get(day) || [];
            maxTimeByDay.set(day, d3.max(dayData, d => d.average_time_min));
        });

        // Calculate the normalized value (percentage)
        chartData.forEach(d => {
            const maxTime = maxTimeByDay.get(d.Day_of_Week);
            // Normalized value: (Time / Max Time) * 100
            d.normalized_time = (d.average_time_min / maxTime) * 100; 
        });

        // Regroup the normalized data
        const normalizedDataByDay = d3.group(chartData, d => d.Day_of_Week);

        // --- 3. CHART SETUP (Similar to Line Chart setup) ---
        const container = document.getElementById('normalized-trend-chart');
        container.innerHTML = ''; 
        const legendContainer = d3.select("#card4-legend");
        const labelContainer = d3.select("#line-in-progress-label");
        
        const margin = { top: 20, right: 30, bottom: 10, left: 50 };
        const containerWidth = 400;
        const containerHeight = 600; 

        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        const svg = d3.select(container).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // --- SCALES ---

        // X Scale: Day of Year (1 to 365)
        const x = d3.scaleLinear()
            .domain([1, 365])
            .range([0, width]);

        // Y Scale:
        // 1. Find the overall minimum normalized time across all data
        const minNormalizedTime = d3.min(chartData, d => d.normalized_time);
        // 2. Calculate the buffer value (10% less than the minimum)
        const yMinDomain = Math.floor(minNormalizedTime * 0.95); // Use 90% of the minimum value, rounded down
        // 3. Set the Y domain to start from this buffer value and go up to 100%
        const y = d3.scaleLinear()
            .domain([100, yMinDomain])
            .range([0, height]);

        // --- AXES ---

        // Create an array of 12 precise Day-of-Year values for the ticks (approx. monthly)
        const monthlyTicks = d3.range(1, 13) // Creates array [1, 2, ..., 12]
                                 .map(m => Math.round(m * 30.5)); // Multiply by ~30.5 days/month
                                                                  // resulting in [31, 61, 92, ..., 366]
                                                                 
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickValues(monthlyTicks)
                .tickFormat(""));

        svg.append("g")
            .call(d3.axisLeft(y)
                .ticks(4)
                .tickFormat(d => d + '%'))
                .selectAll("text")
                .style("font-size", "13px");

        // Y-Axis Label
        svg.append("text")
            .attr("class", "value-label")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left)
            .attr("x", 0 - (height/2))
            .attr("dy", "0.7em")
            .style("text-anchor", "middle")
            .text("% of Max Time per Day");
        
        // --- 4. LINE GENERATOR ---
        const lineGenerator = d3.line()
            .x(d => x(d.day_of_year))
            .y(d => y(d.normalized_time));

        // --- 5. NATIVE D3 SEQUENTIAL DRAWING ORCHESTRATION ---
        renderLegend(legendContainer, DAY_ORDER, DAY_COLORS);

        // --- CALCULATE BIGGEST IMPROVER ---
        let biggestImprover = { day: null, improvement: -Infinity };

        normalizedDataByDay.forEach((data, day) => {
            if (data.length > 1) {
                // Sort by day_of_year to ensure we compare start of year to end of year
                const sorted = [...data].sort((a, b) => a.day_of_year - b.day_of_year);
                const startVal = sorted[0].normalized_time; // Closer to 100%
                const endVal = sorted[sorted.length - 1].normalized_time; // Lower is faster
                
                // Improvement is the drop in percentage points
                const improvement = startVal - endVal;
                
                if (improvement > biggestImprover.improvement) {
                    biggestImprover = { day, improvement, dayName: DAY_FULL_NAMES[day] };
                }
            }
        });

        // Start the process from the first day (index 0)
        setTimeout(() => {
            drawLineSequentially(
                0, 
                normalizedDataByDay, 
                svg, 
                lineGenerator, 
                labelContainer, 
                legendContainer,
                x,
                y,
                biggestImprover
            );
        }, 1000);

        

    } catch (error) {
        console.error("Error loading or rendering Card 4 data:", error);
    }
}

// --- CARD 5 RENDERING (Toughest puzzles) ---

async function renderCard5() {
    const tableId = "#hardest-puzzles-table";
    d3.select("#stumped-authors-summary").text("").transition().duration(0).style("opacity", 0); 
    const containerSelector = d3.select(tableId).node().parentNode; // Get the parent container
    // set parent container height and width
    containerSelector.style.height = '730px';
    containerSelector.style.width = '430px';
    try {
        const response = await fetch(DATA_FILES.card5);
        const rawData = await response.json();
        const tableData = Array.isArray(rawData) ? rawData : rawData.data || [];

        if (tableData.length === 0) {
            d3.select("#hardest-puzzles-table tbody").html('<tr><td colspan="4">No high-deviation puzzles recorded.</td></tr>');
            return;
        }

        const tbody = d3.select("#hardest-puzzles-table tbody");
        
        // --- COUNT AUTHOR APPEARANCES ---
        const authorCounts = {};
        tableData.forEach(d => {
            authorCounts[d.Author] = (authorCounts[d.Author] || 0) + 1;
        });
        // Find authors who appeared more than once
        const frequentAuthors = Object.keys(authorCounts).filter(author => authorCounts[author] > 1);

        // --- DATA BINDING AND RENDERING ---
        
        // Bind data to existing rows (update, exit) and new rows (enter)
        const rows = tbody.selectAll("tr")
            .data(tableData, d => d.Date); // Use Date as the key for efficient updates

        // Remove old rows
        rows.exit().remove();

        // Create new rows for the data
        const newRows = rows.enter().append("tr");

        // Merge enter and update selections
        const allRows = newRows.merge(rows);

        allRows.html(d => {
            const formattedTime = formatTimeToMMSS(d.Time_formatted);
            // Check if the author is one of the frequent ones
            //const authorClass = frequentAuthors.includes(d.Author) ? 'author-stumped-highlight' : '';
            
            return `
                <td class="left-align" style="width: 100px">${DAY_FULL_NAMES[d.Day_of_Week]} <br> ${d.Date}</td>
                <td style="text-align: center"><span data-author="${d.Author}">${d.Author}</span></td>
                <td>${formattedTime}</td>
                <td class="deviation-cell right-align positive-deviation">${d.Deviation_Percent_Label}</td>
            `;
        });

        // --- APPLY ANIMATION AND SUMMARY MESSAGE ---
        if (frequentAuthors.length > 0) {
            
            // Wait for a short moment after the table is drawn to start the animation
            setTimeout(() => {

                // Apply the animation class to the matching author names
                frequentAuthors.forEach(author => {
                    // Select all spans with the matching data-author attribute
                    d3.select(tableId)
                    .selectAll(`span[data-author="${author}"]`)
                    .classed('author-stumped-highlight', true); // Apply the class, triggering animation
                });
                
                // Create the list of authors for the message
                let authorList;
                if (frequentAuthors.length === 1) {
                    authorList = frequentAuthors[0];
                } else if (frequentAuthors.length === 2) {
                    authorList = `${frequentAuthors[0]} and ${frequentAuthors[1]}`;
                } else {
                    // Oxford comma style for 3 or more
                    authorList = frequentAuthors.slice(0, -1).join(', ') + `, and ${frequentAuthors.slice(-1)[0]}`;
                }

                // Construct the message
                const message = frequentAuthors.length === 1
                    ? `${authorList} really stumped you!`
                    : `${authorList} really stumped you!`;

                // Append the message element
                let summaryDiv = d3.select("#stumped-authors-summary");
                
                // If the div doesn't exist, create it below the table
                if (summaryDiv.empty()) {
                    summaryDiv = d3.select(containerSelector)
                        .append("div")
                        .attr("id", "stumped-authors-summary");
                }

                setTimeout(() => {
                // Update text and trigger fade-in animation
                summaryDiv.text(`${message}`)
                            .transition()
                            .duration(800)
                            .style("opacity", 1)
                            .style("transform", "translateY(0)"); // Triggers CSS transition (fade-in)
                }, 1500); // Delay showing the text
                
            }, 3000); // amount of time before showing the highlights

        } else {
             // If no frequent authors, hide or remove the summary message
             d3.select("#stumped-authors-summary").style("opacity", 0).remove();
        }

    } catch (error) {
        console.error("Error loading or rendering Card 5 data:", error);
        d3.select("#hardest-puzzles-table tbody").html('<tr><td colspan="4">Error loading data.</td></tr>');
    }
}

// --- CARD 6 RENDERING (easiest puzzles) ---

async function renderCard6() {
    const tableId = "#easiest-puzzles-table";
    d3.select("#fastest-puzzle-summary").text("").transition().duration(0).style("opacity", 0); 
    const containerSelector = d3.select(tableId).node().parentNode; // Get the parent container
    // set parent container height and width
    containerSelector.style.height = '730px';
    containerSelector.style.width = '430px';

    try {
        const response = await fetch(DATA_FILES.card6);
        const rawData = await response.json();
        const tableData = Array.isArray(rawData) ? rawData : rawData.data || [];

        // This ensures a clean table before the new data even renders
        d3.selectAll("#easiest-puzzles-table tbody tr")
            .interrupt()
            .style("background-color", null);

        if (tableData.length === 0) {
            d3.select("#easiest-puzzles-table tbody").html('<tr><td colspan="4">No low-deviation puzzles recorded.</td></tr>');
            return;
        }

        const tbody = d3.select("#easiest-puzzles-table tbody");
        
        // --- DATA BINDING AND RENDERING ---
        
        // Bind data to existing rows (update, exit) and new rows (enter)
        const rows = tbody.selectAll("tr")
            .data(tableData, d => d.Date); // Use Date as the key for efficient updates

        // Remove old rows
        rows.exit().remove();

        // Create new rows for the data
        const newRows = rows.enter().append("tr");

        // Merge enter and update selections
        const allRows = newRows.merge(rows);

        // Populate the cells for ALL rows (new and existing)
        allRows.html(d => `
            <td class="left-align" style="width: 100px">${DAY_FULL_NAMES[d.Day_of_Week]} <br> ${d.Date}</td>
            <td class="left-center">${d.Author}</td>
            <td>${formatTimeToMMSS(d.Time_formatted)}</td>
            <td class="deviation-cell right-align">${d.Deviation_Percent_Label}</td>`);

        // SET A MESSAGE AT BOTTOM TO VIEW THE FASTEST SOLVE
        // find the object with the lowest Deviation_Percent_Label (fastest)
        // Note: d3.min returns the minimum *value* of the accessor, not the object,
        // so we use d3.least (v7+) or a reduce fallback and parse labels to numbers.
        function _parseDeviation(label) {
            if (label == null) return Infinity;
            const num = parseFloat(String(label).replace(/[^0-9.-]+/g, ''));
            return Number.isFinite(num) ? num : Infinity;
        }

        const _fastestPuzzle = (typeof d3.least === 'function')
            ? d3.least(tableData, d => _parseDeviation(d.Deviation_Percent_Label))
            : tableData.reduce((best, d) => {
                if (!best) return d;
                return _parseDeviation(d.Deviation_Percent_Label) < _parseDeviation(best.Deviation_Percent_Label) ? d : best;
            }, null);

        let summaryDiv = d3.select("#fastest-puzzle-summary");
        
        // If the div doesn't exist, create it below the table
        if (summaryDiv.empty()) {
            summaryDiv = d3.select(containerSelector)
                .append("div")
                .attr("id", "fastest-puzzle-summary");
        }

        setTimeout(() => {
            // Update content and trigger fade-in animation
            if (_fastestPuzzle) {
                // Build three separate lines to allow deliberate line breaks and safer text insertion
                summaryDiv.html(''); // Clear any previous content
                summaryDiv.append('div').attr('class', 'fastest-line fastest-title').text("Let's take a look back at your fastest solve!");
                summaryDiv.append('div').attr('class', 'fastest-line fastest-date').text(`${_fastestPuzzle.Day_of_Week ? DAY_FULL_NAMES[_fastestPuzzle.Day_of_Week] || _fastestPuzzle.Day_of_Week : ''} ${_fastestPuzzle.Date || ''}`);
                summaryDiv.append('div').attr('class', 'fastest-line fastest-author').text(`by ${_fastestPuzzle.Author || 'Unknown'}`);

                // 3. APPLY SUBTLE GREEN HIGHLIGHT TO THE ROW
                // We filter all rows to find the one matching the fastest puzzle date
                allRows.filter(d => d.Date === _fastestPuzzle.Date)
                    .transition()
                    .duration(800)
                    .style("background-color", "rgba(36, 197, 36, 0.25)");
            } else {
                // Fallback when there's no data
                summaryDiv.html('');
            }

            summaryDiv.transition()
                .duration(800)
                .style("opacity", 1)
                .style("transform", "translateY(0)");
        }, 3000); // Delay showing the text

    } catch (error) {
        console.error("Error loading or rendering Card 6 data:", error);
        d3.select("#hardest-puzzles-table tbody").html('<tr><td colspan="4">Error loading data.</td></tr>');
    }
}

// --- CARD 7 RENDERING (fastest solve showcase) ---

let card7Timeouts = []; 
let isConfettiActive = false;
async function renderCard7() {
    // --- STEP A: CLEANUP ---
    
    // 1. Clear all pending timeouts from the last visit
    isConfettiActive = false;
    card7Timeouts.forEach(t => clearTimeout(t));
    card7Timeouts = [];

    // 2. Interrupt any active D3 transitions on the timer and bar
    d3.select("#replay-timer").interrupt().text("0:00");
    d3.select("#replay-progress-fill").interrupt().style("width", "0%");
    
    try {
        // identify fastest puzzle by loading the card6 dataset (fastest puzzles)
        function _parseDeviation(label) {
            if (label == null) return Infinity;
            const num = parseFloat(String(label).replace(/[^0-9.-]+/g, ''));
            return Number.isFinite(num) ? num : Infinity;
        }

        // Load the Card 6 data so we can find the fastest puzzle and its puzzle_id
        const resp6 = await fetch(DATA_FILES.card6);
        const rawTableData = await resp6.json();
        const tableData = Array.isArray(rawTableData) ? rawTableData : rawTableData.data || [];

        if (tableData.length === 0) {
            console.warn("Card 6 dataset is empty — cannot determine fastest puzzle for replay.");
            return;
        }

        const _fastestPuzzle = (typeof d3.least === 'function')
            ? d3.least(tableData, d => _parseDeviation(d.Deviation_Percent_Label))
            : tableData.reduce((best, d) => {
                if (!best) return d;
                return _parseDeviation(d.Deviation_Percent_Label) < _parseDeviation(best.Deviation_Percent_Label) ? d : best;
            }, null);

        if (!_fastestPuzzle || !_fastestPuzzle.puzzle_id) {
            console.warn("No fastest puzzle with a valid puzzle_id found in Card 6 data.");
            return;
        }

        // Add the puzzle info to the subtitle (select the <p class="card-subtitle"> inside #card-7)
        d3.select("#card-7 p.card-subtitle").html(`Let's see how you solved the puzzle from <span class="highlight-date">${_fastestPuzzle.Date}</span>`);
        
        // Fetch the completion JSON from the local folder: parent -> puzzle_completion_data/{puzzle_id}.json
        const puzzleId = _fastestPuzzle.puzzle_id;
        const response = await fetch(`../puzzle_completion_data/${puzzleId}.json`);
        if (!response.ok) {
            console.error(`Failed to load puzzle completion file for ${puzzleId}: ${response.status}`);
            return;
        }

        const data = await response.json();
        const cells = data.board.cells;
        const actualSeconds = data.calcs.secondsSpentSolving;
        // Animation Settings
        const startDelay = 2000; // 2 second before first letter
        const totalSolveDuration = 20000; // 20 seconds total solve

        // --- 1. PREPARE COMPLETION DATA ---
        const sortedFills = cells.filter(c => !c.blank && c.timestamp !== undefined)
            .sort((a, b) => a.timestamp - b.timestamp);
        
        const totalFillable = sortedFills.length;
        const minTS = d3.min(sortedFills, d => d.timestamp);
        const maxTS = d3.max(sortedFills, d => d.timestamp);

        let cumulative = 0;
        const chartData = sortedFills.map(d => {
            cumulative++;
            return {
                time: d.timestamp,
                percent: (cumulative / totalFillable) * 100
            };
        });
        
        // Ensure it starts at 0% at the min timestamp
        chartData.unshift({ time: minTS, percent: 0 });

        // --- RENDER THE CHART ---
        renderCompletionChart("#replay-chart-container", chartData, actualSeconds, startDelay, totalSolveDuration);
        
        // 1. Determine Size (sqrt of total cells)
        const gridSize = Math.sqrt(cells.length);
        const container = d3.select("#crossword-replay-container");
        container.html(""); // Clear previous
        
        // Setup Grid layout
        container.style("grid-template-columns", `repeat(${gridSize}, 1fr)`);

        // 2. Identify Time Bounds for Normalization
        const filledCells = cells.filter(c => !c.blank && c.timestamp !== undefined);

        // 3. Build the Grid
        cells.forEach((cellData, i) => {
            const cell = container.append("div")
                .attr("class", cellData.blank ? "cw-cell blank" : "cw-cell");

            if (!cellData.blank) {
                const letterSpan = cell.append("span")
                    .attr("class", "cw-letter")
                    .text(cellData.guess);

                // 4. Calculate Normalized Delay
                // Range: 0 to 1 multiplied by total solve duration, then add the initial delay
                const normalizedDelay = startDelay + 
                    ((cellData.timestamp - minTS) / (maxTS - minTS)) * totalSolveDuration;

                // 5. Display the text and CAPTURE THE TIMEOUT ID so we can clear it later
                const tId = setTimeout(() => {
                    letterSpan.classed("revealed", true);
                    
                    // Visual feedback: brief highlight when filled
                    cell.style("background-color", "#fff9c4")
                        .transition().duration(500)
                        .style("background-color", "#fff");
                }, normalizedDelay);
                
                card7Timeouts.push(tId); // Add to our tracker
            }
        });

        // 6. Animate the Loading Bar
        // Using the same startDelay and totalSolveDuration as your letters
        d3.select("#replay-progress-fill")
            .transition()
            .delay(startDelay)
            .duration(totalSolveDuration)
            .ease(d3.easeLinear) // Use linear for a smooth, constant fill
            .style("width", "100%");
        
        // 7. Animate the Timer (0 to Actual Seconds Spent)
        const timerDisplay = d3.select("#replay-timer");
        
        timerDisplay.transition()
            .transition()
            .delay(startDelay)
            .duration(totalSolveDuration)
            .ease(d3.easeLinear)
            .tween("text", function() {
                const i = d3.interpolateNumber(0, actualSeconds);
                return function(t) {
                    const currentSec = Math.floor(i(t));
                    const mins = Math.floor(currentSec / 60);
                    const secs = currentSec % 60;
                    this.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                };
            });

    } catch (error) {
        console.error("Error rendering Card 7:", error);
    }
}

// --- SLIDE NAVIGATION ---

let currentCardIndex = 0;
const totalCards = 9; 

function updateCards() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        if (index === currentCardIndex) {
            card.classList.remove('hidden');
            card.classList.remove('leaving');
            setTimeout(() => {
                card.classList.add('active');
            }, 10);
        }
    });

    // Optional: Render the active card's data when it becomes active
    if (currentCardIndex === 0) animateHero();
    if (currentCardIndex === 1) renderCard1();
    if (currentCardIndex === 2) renderCard2();
    if (currentCardIndex === 3) renderCard3();
    if (currentCardIndex === 4) renderCard4();
    if (currentCardIndex === 5) renderCard5();
    if (currentCardIndex === 6) renderCard6();
    if (currentCardIndex === 7) renderCard7();
    if (currentCardIndex === 8) animateHeroFinal();
}

// Hero Animation on first load
function animateHero() {
    // Select children inside the #card-0 container only
    const heroElements = d3.select("#card-0").selectAll(".hero-content > *");
    
    // Hide initially
    heroElements.classed("pulse-active", false).style("opacity", 0).style("transform", "translateY(20px)");

    // Staggered reveal
    heroElements.transition()
        .delay((d, i) => i * 300)
        .duration(1000)
        .style("opacity", 1)
        .style("transform", "translateY(0)")
        .on("end", function() {
            // 3. Check if the element that just finished is the CTA
            if (d3.select(this).classed("hero-cta")) {
                d3.select(this).classed("pulse-active", true);
            }
        });
}

// Hero Animation on first load
function animateHeroFinal() {
    // Select children inside the #card-8 container only
    const heroElements = d3.select("#card-8").selectAll(".hero-content > *");
    
    // Hide initially
    heroElements.classed("pulse-active", false).style("opacity", 0).style("transform", "translateY(20px)");

    // Staggered reveal
    heroElements.transition()
        .delay((d, i) => i * 300)
        .duration(1000)
        .style("opacity", 1)
        .style("transform", "translateY(0)");
}

// Function to move to the next card
function nextCard() {
    const currentCardElement = document.getElementById(`card-${currentCardIndex}`);

    // Transition the current card out
    currentCardElement.classList.remove('active');
    currentCardElement.classList.add('leaving');

    // After the transition, remove the leaving class and set it to the default 'hidden' state
    setTimeout(() => {
        currentCardElement.classList.remove('leaving');
        currentCardElement.classList.add('hidden'); 
    }, 800); // Must match the CSS transition duration

    // Change card index to next card (Looping: 0 -> 1 ... 6 -> 0)
    currentCardIndex = (currentCardIndex + 1) % totalCards;
    updateCards();
}

// Function to move to the previous card
function prevCard() {
    const currentCardElement = document.getElementById(`card-${currentCardIndex}`);

    // Transition the current card out
    currentCardElement.classList.remove('active');
    currentCardElement.classList.add('leaving');

    // After the transition, remove the leaving class and set it to the default 'hidden' state
    setTimeout(() => {
        currentCardElement.classList.remove('leaving');
        currentCardElement.classList.add('hidden'); 
    }, 500); // Must match the CSS transition duration

    // Update the index to previous card (Looping: 0 -> 6, 6 -> 5, etc.)
    currentCardIndex = (currentCardIndex - 1 + totalCards) % totalCards;
    updateCards();
}

// Attach event listeners for easy navigation during recording
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        nextCard();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevCard();
    }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial render of the first card
    //animateHero();
    updateCards(); 
});

function fitAppFrame() {
  const frame = document.querySelector('.app-frame');
  if (!frame) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.min(vw / 540, vh / 960, 1); // don't scale up >1
  frame.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitAppFrame);
window.addEventListener('DOMContentLoaded', () => { fitAppFrame(); setTimeout(fitAppFrame, 0); });