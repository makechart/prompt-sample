<div>
<script type="@plotdb/block">
module.exports = {
  pkg: {
    extend: {ns: "local", name: "chartbase", path: "index.html", version: "main"},
    dependencies: [
      {url: "https://d3js.org/d3.v7.min.js"},
      {url: "https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js"},
      {url: "https://cdn.jsdelivr.net/npm/ldcolor@1.0.0/index.min.js"}
    ]
  },
  init: function(opt) {
    var d3 = opt.ctx.d3;
    var ldcolor = opt.ctx.ldcolor;
    // d3-sankey extends the d3 object directly
    var root = opt.root;
    var svg = d3.select(root).append("svg").attr("width", "100%").attr("height", "100%");
    var g = svg.append("g"); // Will be positioned with margins in resize()
    
    // Store root element for tooltip positioning
    this.rootElement = root;
    
    // Create tooltip div
    var tooltip = d3.select(root)
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "3px")
      .style("padding", "8px")
      .style("pointer-events", "none")
      .style("font-size", "12px") // Default size, will be updated in render
      .style("box-shadow", "0 1px 3px rgba(0,0,0,0.12)")
      .style("z-index", "1000"); // Ensure tooltip appears above other elements
    
    opt.pubsub.fire("init", {mod: {
      config: {
        nodeWidth: {
          name: "節點寬度", 
          type: "number", 
          default: 15, 
          min: 1, 
          max: 50, 
          step: 1
        },
        nodePadding: {
          name: "節點間距", 
          type: "number", 
          default: 10, 
          min: 1, 
          max: 50, 
          step: 1
        },
        iterations: {
          name: "迭代次數", 
          type: "number", 
          default: 6, 
          min: 1, 
          max: 32, 
          step: 1
        },
        linkOpacity: {
          name: "連結透明度", 
          type: "number", 
          default: 0.5, 
          min: 0.1, 
          max: 1, 
          step: 0.1
        },
        nodeColor: {
          name: "節點顏色", 
          type: "color", 
          default: "#69b3a2"
        },
        linkColor: {
          name: "連結顏色", 
          type: "color", 
          default: "#aaa"
        },
        palette: {
          name: "色盤", 
          type: "palette", 
          default: {
            colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]
          }
        },
        nodeLabelFontSize: {
          name: "節點標籤字體大小",
          type: "number",
          default: 10,
          min: 8,
          max: 24,
          step: 1
        },
        tooltipFontSize: {
          name: "提示框字體大小",
          type: "number",
          default: 12,
          min: 8,
          max: 24,
          step: 1
        },
        labelPosition: {
          name: "標籤位置", 
          type: "choice", 
          values: ["inside", "outside"], 
          default: "outside"
        }
      },
      dimension: {
        source: {},
        target: {},
        value: {}
      },
      init: function() {
        this.svg = svg;
        this.g = g;
        this.tooltip = tooltip;
        this.rootElement = root; // Store reference to root element
        this.width = 0;
        this.height = 0;
        this.sankey = null;
        
        // Initialize with empty data structure to prevent errors
        this.parsed = {
          nodes: [],
          links: []
        };
        
        // Initialize sankey generator with default values
        // This ensures it's always available even if resize hasn't been called
        this.sankey = d3.sankey()
          .nodeWidth(15) // Default value
          .nodePadding(10) // Default value
          .extent([[0, 0], [100, 100]]) // Will be updated in resize
          .iterations(6); // Default value
      },
      sample: function() {
        return {
          binding: {
            source: {key: "source"},
            target: {key: "target"},
            value: {key: "value"}
          },
          raw: [
            {source: "煤炭", target: "火力發電", value: 200},
            {source: "天然氣", target: "火力發電", value: 150},
            {source: "火力發電", target: "工業用電", value: 180},
            {source: "火力發電", target: "住宅用電", value: 120},
            {source: "火力發電", target: "商業用電", value: 50},
            {source: "太陽能", target: "再生能源發電", value: 80},
            {source: "風力", target: "再生能源發電", value: 70},
            {source: "水力", target: "再生能源發電", value: 60},
            {source: "再生能源發電", target: "工業用電", value: 70},
            {source: "再生能源發電", target: "住宅用電", value: 80},
            {source: "再生能源發電", target: "商業用電", value: 60},
            {source: "核能", target: "核能發電", value: 120},
            {source: "核能發電", target: "工業用電", value: 50},
            {source: "核能發電", target: "住宅用電", value: 40},
            {source: "核能發電", target: "商業用電", value: 30}
          ]
        };
      },
      bind: function() {
        // Process data for Sankey diagram
        var nodes = [];
        var nodeMap = {};
        var links = [];
        
        try {
          // Check if we have valid data
          if (!this.data || !this.data.length) {
            // If no data is provided, use sample data
            var sample = this.sample();
            if (sample && sample.raw && sample.raw.length) {
              console.log("No data provided, using sample data");
              
              // Convert sample data to the expected format
              var sampleData = [];
              sample.raw.forEach(function(d) {
                sampleData.push({
                  source: d[sample.binding.source.key],
                  target: d[sample.binding.target.key],
                  value: d[sample.binding.value.key]
                });
              });
              
              // Use the sample data
              this.data = sampleData;
            }
          }
          
          // Create nodes and links from data
          if (this.data && this.data.length) {
            this.data.forEach(function(d) {
              if (!nodeMap[d.source]) {
                nodeMap[d.source] = {name: d.source};
                nodes.push(nodeMap[d.source]);
              }
              if (!nodeMap[d.target]) {
                nodeMap[d.target] = {name: d.target};
                nodes.push(nodeMap[d.target]);
              }
              links.push({
                source: nodeMap[d.source],
                target: nodeMap[d.target],
                value: +d.value || 0 // Ensure value is a number, default to 0
              });
            });
          }
        } catch (e) {
          console.error("Error processing data:", e);
          // If there's an error, ensure we have at least an empty structure
          nodes = [];
          links = [];
        }
        
        // Store processed data
        this.parsed = {
          nodes: nodes,
          links: links
        };
      },
      resize: function() {
        try {
          // Handle both cases: this.svg could be a D3 selection or a raw DOM element
          var box = (typeof this.svg.node === 'function')
            ? this.svg.node().getBoundingClientRect()
            : this.svg.getBoundingClientRect();
          
          // Ensure we have valid dimensions
          this.width = box.width || 300; // Default width if not available
          this.height = box.height || 200; // Default height if not available
          
          // Calculate margins based on label position and font size
          var isOutside = this.cfg && this.cfg.labelPosition === "outside";
          var fontSize = this.cfg && this.cfg.nodeLabelFontSize || 10; // Default if not set
          
          // Set margins to accommodate labels
          this.margin = {
            top: 20,
            right: isOutside ? Math.max(60, fontSize * 6) : 20, // More space for right labels
            bottom: 20,
            left: isOutside ? Math.max(60, fontSize * 6) : 20   // More space for left labels
          };
          
          // Effective width and height for the diagram
          this.innerWidth = Math.max(1, this.width - this.margin.left - this.margin.right);
          this.innerHeight = Math.max(1, this.height - this.margin.top - this.margin.bottom);
          
          // Handle both cases for setting attributes
          if (typeof this.svg.attr === 'function') {
            // Position the group with margins
            this.g.attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
          } else {
            // Position the group with margins
            this.g.setAttribute("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
          }
          
          // Update sankey generator with proper extent and config
          if (this.sankey) {
            this.sankey
              .nodeWidth(this.cfg && this.cfg.nodeWidth || 15)
              .nodePadding(this.cfg && this.cfg.nodePadding || 10)
              .extent([[0, 0], [this.innerWidth, this.innerHeight]])
              .iterations(this.cfg && this.cfg.iterations || 6);
          } else {
            // Create sankey generator if it doesn't exist
            this.sankey = d3.sankey()
              .nodeWidth(this.cfg && this.cfg.nodeWidth || 15)
              .nodePadding(this.cfg && this.cfg.nodePadding || 10)
              .extent([[0, 0], [this.innerWidth, this.innerHeight]])
              .iterations(this.cfg && this.cfg.iterations || 6);
          }
        } catch (e) {
          console.error("Error in resize:", e);
          // Set default values if there's an error
          this.width = 300;
          this.height = 200;
          this.innerWidth = 260;
          this.innerHeight = 160;
          this.margin = {top: 20, right: 20, bottom: 20, left: 20};
          
          // Ensure sankey is initialized
          if (!this.sankey) {
            this.sankey = d3.sankey()
              .nodeWidth(15)
              .nodePadding(10)
              .extent([[0, 0], [this.innerWidth, this.innerHeight]])
              .iterations(6);
          }
        }
      },
      render: function() {
        var that = this;
        
        try {
          // Ensure we have data and sankey is initialized
          if (!this.parsed) {
            console.log("No parsed data available, calling bind");
            this.bind();
          }
          
          // If we still don't have nodes, there's nothing to render
          if (!this.parsed.nodes.length) {
            console.log("No nodes to render");
            return;
          }
          
          // Ensure sankey is initialized
          if (!this.sankey) {
            console.log("Sankey not initialized, calling resize");
            this.resize();
          }
          
          // Clear previous elements
          if (this.g && typeof this.g.selectAll === 'function') {
            this.g.selectAll("*").remove();
          }
          
          // Update tooltip font size
          if (this.tooltip) {
            this.tooltip.style("font-size", (this.cfg && this.cfg.tooltipFontSize || 12) + "px");
          }
          
          // Get color palette
          // Create color scale with ldcolor for proper color handling
          var colorList = [];
          if (this.cfg && this.cfg.palette && this.cfg.palette.colors) {
            colorList = this.cfg.palette.colors.map(function(c) {
              return ldcolor.web(c); // Convert to web color format
            });
          } else {
            // Default colors if palette is not available
            colorList = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];
          }
          
          var colorScale = d3.scaleOrdinal()
            .domain(this.parsed.nodes.map(function(d) { return d.name; }))
            .range(colorList);
          
          // Apply the sankey layout
          try {
            this.sankey(this.parsed);
          } catch (e) {
            console.error("Error applying sankey layout:", e);
            return; // Exit if sankey layout fails
          }
        } catch (e) {
          console.error("Error in render preparation:", e);
          return; // Exit if there's an error in preparation
        }
        
        // Draw the links
        var link = this.g.append("g")
          .attr("fill", "none")
          .attr("stroke-opacity", this.cfg.linkOpacity)
          .selectAll("path")
          .data(this.parsed.links)
          .enter().append("path")
          .attr("d", d3.sankeyLinkHorizontal())
          .attr("stroke", function(d) { 
            return d.color || that.cfg.linkColor; 
          })
          .attr("stroke-width", function(d) { 
            return Math.max(1, d.width); 
          });
        
        // Add hover effects to links
        link.on("mouseover", function(event, d) {
            d3.select(this)
              .attr("stroke-opacity", 1);
              
            that.tooltip.transition()
              .duration(200)
              .style("opacity", 0.9);
              
            // Get container position for proper tooltip positioning
            var containerRect = root.getBoundingClientRect();
            var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            that.tooltip.html(
              d.source.name + " → " + d.target.name + "<br/>" +
              "數值: " + d.value
            )
              .style("left", (event.clientX - containerRect.left + scrollLeft + 10) + "px")
              .style("top", (event.clientY - containerRect.top + scrollTop - 28) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("stroke-opacity", that.cfg.linkOpacity);
              
            that.tooltip.transition()
              .duration(500)
              .style("opacity", 0);
          });
        
        // Draw the nodes
        var node = this.g.append("g")
          .selectAll("rect")
          .data(this.parsed.nodes)
          .enter().append("rect")
          .attr("x", function(d) { return d.x0; })
          .attr("y", function(d) { return d.y0; })
          .attr("height", function(d) { return d.y1 - d.y0; })
          .attr("width", function(d) { return d.x1 - d.x0; })
          .attr("fill", function(d) { 
            return colorScale(d.name); 
          })
          .attr("stroke", function(d) {
            return d3.rgb(colorScale(d.name)).darker(0.5);
          });
        
        // Add hover effects to nodes
        node.on("mouseover", function(event, d) {
            d3.select(this)
              .attr("stroke-width", 2);
              
            link.filter(function(l) { 
              return l.source === d || l.target === d; 
            })
              .attr("stroke-opacity", 1);
              
            that.tooltip.transition()
              .duration(200)
              .style("opacity", 0.9);
              
            // Get container position for proper tooltip positioning
            var containerRect = root.getBoundingClientRect();
            var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            that.tooltip.html(
              "節點: " + d.name + "<br/>" +
              "總數值: " + d.value
            )
              .style("left", (event.clientX - containerRect.left + scrollLeft + 10) + "px")
              .style("top", (event.clientY - containerRect.top + scrollTop - 28) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("stroke-width", 1);
              
            link.attr("stroke-opacity", that.cfg.linkOpacity);
              
            that.tooltip.transition()
              .duration(500)
              .style("opacity", 0);
          });
        
        // Add node labels
        var isOutside = this.cfg.labelPosition === "outside";
        var midpoint = this.innerWidth / 2;
        
        this.g.append("g")
          .selectAll("text")
          .data(this.parsed.nodes)
          .enter().append("text")
          .attr("x", function(d) {
            return isOutside ?
              (d.x0 < midpoint ? d.x0 - 10 : d.x1 + 10) : // Increased spacing from node edges
              (d.x0 + d.x1) / 2;
          })
          .attr("y", function(d) { return (d.y0 + d.y1) / 2; })
          .attr("dy", "0.35em")
          .attr("text-anchor", function(d) {
            if (isOutside) {
              return d.x0 < midpoint ? "end" : "start";
            } else {
              return "middle";
            }
          })
          .text(function(d) { return d.name; })
          .attr("font-size", this.cfg.nodeLabelFontSize + "px")
          .attr("fill", function(d) {
            return isOutside ? "#000" : d3.rgb(colorScale(d.name)).darker(3);
          })
          .attr("pointer-events", "none");
      },
      destroy: function() {
        try {
          // Clean up
          if (this.svg) {
            // Handle both cases for removing children
            if (typeof this.svg.selectAll === 'function') {
              this.svg.selectAll("*").remove();
            } else if (this.svg.firstChild) {
              while (this.svg.firstChild) {
                this.svg.removeChild(this.svg.firstChild);
              }
            }
          }
          if (this.tooltip && typeof this.tooltip.remove === 'function') {
            this.tooltip.remove();
          }
          
          // Clear references
          this.parsed = null;
          this.sankey = null;
        } catch (e) {
          console.error("Error in destroy:", e);
        }
      }
    }});
  }
};
</script>
</div>
