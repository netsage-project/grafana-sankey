/*
 * (C) 2018 Tyson Seto-Mook, Laboratory for Advanced Visualization and Applications, University of Hawaii at Manoa.
 */


/*
Copyright 2018 The Trustees of Indiana University

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


import {MetricsPanelCtrl} from 'app/plugins/sdk';
import _ from 'lodash';
import {Scale} from './scale';
import {CustomHover} from './CustomHover';
import './css/sankeynetsage_sankey.css!';
import d3 from './js/sankeynetsage_d3.v3';
import d3sankey from './js/sankeynetsage_sankey.js';
d3.sankey = d3sankey;

////// place global variables here ////
const panelDefaults = {
    //docs_editor variables
    docs_editor_aggregation_options: [ 'Total', 'Average', 'Max', 'Min' ],
    docs_editor_aggregation: 'Total',
    docs_editor_link_width_input: '',
    docs_editor_to_Byte: false,
    docs_editor_choices: [],
    docs_editor_option_nodes: [],
    docs_data: [],
    // table_editor variables
    table_editor_link_width_label: '',
    table_editor_link_width_units: '',
    table_editor_choices: [],
    table_editor_node_labels: [],
    table_editor_option_nodes: [], // used to store data mapping
    table_editor_unitFormats_TEMP: [ { text: "kbn.getUnitFormats()", submenu:[
                                        {text:'Not implemented yet', value:'kbn.getUnitFormats()'},
                                        {text:'test unit', value:'short'}]
                                      } ],
    table_editor_unitFormats: 'kbn.getUnitFormats()',
    table_data_type: '',
    table_data: [],
    // other variables
    label_nodes: [],
    data_type: "",
    // other unused variables
    color: {
        mode: 'spectrum',
        cardColor: '#b4ff00',
        colorScale: 'linear',
        exponent: 0.5,
        colorScheme: 'interpolateOranges',
        fillBackground: false
    },
    legend: {
        show: true,
        legend_colors: []
    },
    tooltip:{
        show: true,
        showDefault: true,
        content: ' '
    },
    scales: ['linear', 'sqrt'],
    colorScheme : 'NetSage',
    rgb_values:[],
    hex_values:[],
    //colorModes : ['opacity','spectrum'],
    colorModes : ['spectrum'],
    custom_hover: ' '
};

var tempArray=[];


export class NetSageSankey extends MetricsPanelCtrl {



  constructor($scope, $injector) {
    super($scope, $injector);

    _.defaults(this.panel, panelDefaults);
      this.sankeynetsage_holder_id = 'sankeynetsage_' + this.panel.id;
      this.containerDivId = 'container_'+this.sankeynetsage_holder_id;
      this.custom_hover = new CustomHover(this.panel.tooltip.content);
      this.scale = new Scale(this.colorScheme);
      this.colorSchemes=this.scale.getColorSchemes();
      this.events.on('data-received', this.onDataReceived.bind(this));
      this.events.on('data-error', this.onDataError.bind(this));
      this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
      this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
      this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
  }



  onDataReceived(dataList) {
    this.panel.docs_data = [];
    this.panel.docs_table_data = [];
    this.panel.label_nodes = [];
    this.panel.data_type = "";
    this.process_data(dataList);
    this.render();
  }


  // process "table" or "docs" data types
  // "table" == aggregated data
  // "docs" == full record
  process_data(dataList){

    if(dataList.length > 0){
      // set current data type
      this.panel.data_type = dataList[0].type;

      // check if data type is full record
      if (this.panel.data_type === "docs") {
        this.panel.label_nodes = this.panel.docs_editor_option_nodes.slice(0);
        this.process_docs_data(dataList);
      } else if (this.panel.data_type === "table") {
        this.panel.label_nodes = this.panel.table_editor_node_labels.slice(0);
        this.process_table_data(dataList);
      } else {
        console.error("[!] Sankey plugin Error:  Unknown data type '",this.panel.data_type,"' cannot process data");
      }
    } else {
      console.error("[!] Sankey plugin Error: No data to visualize");
    }

  }



  process_table_data(dataList){
    this.panel.table_editor_option_nodes = [];
    this.panel.table_data_type = dataList[0].columns[dataList[0].columns.length-1].text;
    var self = this;
    for(var i = 0; i< dataList[0].columns.length-1; i++){
      self.panel.table_editor_option_nodes.push(dataList[0].columns[i].text);
    }
    this.panel.table_data = dataList[0].rows.slice(0);
  }



  process_docs_data(dataList) {
      function matchingFlow(elk_datapoint, agData){
        return ( elk_datapoint.meta.src_ip === agData.meta.src_ip &&
                 elk_datapoint.meta.src_asn === agData.meta.src_asn &&
                 elk_datapoint.meta.src_port === agData.meta.src_port &&
                 elk_datapoint.meta.protocol === agData.meta.protocol &&
                 elk_datapoint.meta.dst_port === agData.meta.dst_port &&
                 elk_datapoint.meta.dst_asn === agData.meta.dst_asn &&
                 elk_datapoint.meta.dst_ip === agData.meta.dst_ip )
      }

      // process full records here
      var self = this;
      //update with the data!
      _.forEach(dataList, function(data){
        for (var i = 0; i < data.datapoints.length; i++){
          var elk_datapoint = data.datapoints[i];

          var flowNotExists = true;
          if(self.panel.docs_data.length > 0 ){
            _.forEach(self.panel.docs_data, function(agData){
              if( matchingFlow(elk_datapoint, agData) ){
                flowNotExists = false;
                //count total flows
                agData.sankey_totalFlows++;
                //aggregate data
                switch(self.panel.aggregation) {
                  case 'Average':
                    for( var k in agData.values ){
                      agData.values[k] += elk_datapoint.values[k];
                    }
                    break;
                  case  'Total':
                    for( var k in agData.values ){
                      agData.values[k] += elk_datapoint.values[k];
                    }
                    break;
                  case  'Max':
                    for( var k in agData.values ){
                      if(agData.values[k] != elk_datapoint.values[k])
                        console.log(agData._id)
                      agData.values[k] = Math.max(agData.values[k], elk_datapoint.values[k]);
                    }
                    break;
                  case 'Min':
                    for( var k in agData.values ){
                      agData.values[k] = Math.min(agData.values[k], elk_datapoint.values[k]);
                    }
                    break;
                  default:
                    elk_datapoint.sankey_totalFlows++;
                    for( var k in agData.values ){
                      agData.values[k] += elk_datapoint.values[k];
                    }
                }
              }
            });
          }
          // add flow if it doesnt exists in aggregated data
          if(flowNotExists){
            elk_datapoint.sankey_totalFlows = 1
            self.panel.docs_data.push(elk_datapoint);
          }
        }

      });

      // calculate averages for doc type
      if(self.panel.docs_data.length > 0 ){
        _.forEach(self.panel.docs_data, function(agData){
          switch(self.panel.aggregation) {
            case 'Average':
              for( var k in agData.values ){
                agData.values[k] = agData.values[k]/agData.sankey_totalFlows;
              }
              break;
            default:
              break;
          }
        });
      }
  }



  onDataError(err) {
    this.dataRaw = [];
  }



  onInitEditMode() {
    this.addEditorTab('Raw Documents Options', 'public/plugins/netsage-sankey/docs_editor.html', 2);
    this.addEditorTab('Aggregated Data Options', 'public/plugins/netsage-sankey/table_editor.html', 2);
    //this.addEditorTab('Display', 'public/plugins/netsage-sankey/display_editor.html', 3);
    tempArray=this.scale.displayColor(this.panel.colorScheme);
    this.render();
  }

  onInitPanelActions(actions) {
    this.render();
  }


  docs_editor_addNewChoice() {
    var num = this.panel.docs_editor_choices.length + 1;
    this.panel.docs_editor_choices.push(num);
    this.panel.docs_editor_option_nodes.push('');
  }


  docs_editor_removeChoice(index) {
    this.panel.docs_editor_choices.splice(index,1);
    this.panel.docs_editor_option_nodes.splice(index,1);
    if(this.panel.docs_editor_choices.length < 1)
      this.panel.docs_editor_option_nodes = [];
  }


  table_editor_addNewChoice() {
    var num = this.panel.table_editor_choices.length + 1;
    this.panel.table_editor_choices.push(num);
    this.panel.table_editor_node_labels.push('');
  }


  table_editor_removeChoice(index) {
    this.panel.table_editor_choices.splice(index,1);
    this.panel.table_editor_node_labels.splice(index,1);
    if(this.panel.table_editor_choices.length < 1)
      this.panel.table_editor_node_labels = [];
  }


  display() {
    this.panel.colors=this.scale.displayColor(this.panel.colorScheme);
    this.panel.rgb_values = this.panel.colors.rgb_values;
    this.panel.hex_values = this.panel.colors.hex_values;
  }


  getHtml(htmlContent){
    return this.custom_hover.parseHtml(htmlContent);
    ///use in link///
    //             let html_content = ctrl.getHtml(ctrl.panel.tooltip.content);
    //             ctrl.panel.tooltip.content = html_content;
  }


  setUnitFormat(subItem) {
    this.panel.table_editor_unitFormats = subItem.value;
    this.render();
  }


  formatBytes(val) {
    var hrFormat = null;
    var factor = 1024.0
    val = val/8.0;

    var b = val;
    var k = val/factor;
    var m = ((val/factor)/factor);
    var g = (((val/factor)/factor)/factor);
    var t = ((((val/factor)/factor)/factor)/factor);
    var p = (((((val/factor)/factor)/factor)/factor)/factor);

    if ( p>1 ) {
        hrFormat = p.toFixed(2)+"(PB)";
    } else if ( t>1 ) {
        hrFormat = t.toFixed(2)+"(TB)";
    } else if ( g>1 ) {
        hrFormat = g.toFixed(2)+"(GB)";
    } else if ( m>1 ) {
        hrFormat = m.toFixed(2)+"(MB)";
    } else if ( k>1 ) {
        hrFormat = k.toFixed(2)+"(KB)";
    } else {
        hrFormat = b.toFixed(2)+"(Bytes)";
    }

      return hrFormat
  }

  formatBits(val) {
    var hrFormat = null;
    var factor = 1024.0

    var b = val;
    var k = val/factor;
    var m = ((val/factor)/factor);
    var g = (((val/factor)/factor)/factor);
    var t = ((((val/factor)/factor)/factor)/factor);
    var p = (((((val/factor)/factor)/factor)/factor)/factor);

    if ( p>1 ) {
        hrFormat = p.toFixed(2)+"(Pb)";
    } else if ( t>1 ) {
        hrFormat = t.toFixed(2)+"(Tb)";
    } else if ( g>1 ) {
        hrFormat = g.toFixed(2)+"(Gb)";
    } else if ( m>1 ) {
        hrFormat = m.toFixed(2)+"(Mb)";
    } else if ( k>1 ) {
        hrFormat = k.toFixed(2)+"(Kb)";
    } else {
        hrFormat = b.toFixed(2)+"(bits)";
    }

      return hrFormat
  }



  link(scope, elem, attrs, ctrl){
    var self = this;
    ctrl.events.on('render', function() {
      if(document.getElementById(ctrl.sankeynetsage_holder_id)){
        // intialize colors
        ctrl.display();

        function getValueFromString(flowRecord, keyString){
          return eval('flowRecord["'+(keyString.trim().split('.').join('"]["'))+'"]');
        }

        var sankeyData = [];

        if( ctrl.panel.data_type === 'docs'){
          // update node labels
          // convert docs data to sankey data
          if( ctrl.panel.docs_data.length > 0 ){
            _.forEach(ctrl.panel.docs_data, function(agData,index){
              for(var i=0; i<ctrl.panel.docs_editor_option_nodes.length-1; i++){
                //get links info
                let source = getValueFromString(agData,ctrl.panel.docs_editor_option_nodes[i]);
                let target = getValueFromString(agData,ctrl.panel.docs_editor_option_nodes[i+1]);
                let value = getValueFromString(agData,ctrl.panel.docs_editor_link_width_input);

                // to avoid cyclic sankey, appending (src) and (dst) to names
                let source_option=ctrl.panel.docs_editor_option_nodes[i];
                let target_option=ctrl.panel.docs_editor_option_nodes[i+1];
                source += ((source_option.includes("src_") || source_option.includes("dst_")) ?
                             (source_option.includes("src_") ? " (src)" : " (dst)") :
                           "");
                target += ((target_option.includes("src_") || target_option.includes("dst_")) ?
                             (target_option.includes("src_") ? " (src)" : " (dst)") :
                           "");

                // add to sankeyData array
                sankeyData.push({"source":source,
                                 "target":target,
                                  "value":value,
                                  //"label":"flow-"+index});
                                  "label":ctrl.sankeynetsage_holder_id+"_flow-"+index});
              }
            });
          }
        } else if( ctrl.panel.data_type === 'table'){
          // update node labels
          if(ctrl.panel.table_editor_node_labels.length > 0){
            ctrl.panel.label_nodes = ctrl.panel.table_editor_node_labels.slice(0);
          } else {
            ctrl.panel.label_nodes = ctrl.panel.table_editor_option_nodes.slice(0);
          }
          // convert table data to sankey data
          if( ctrl.panel.table_data.length > 0 ){
            _.forEach(ctrl.panel.table_data, function(tData,index){
              for(var i=0; i<tData.length-2; i++){ // last index is value, so -2 to prevent using value as a node
                //get links info
                let source = tData[i];
                let target = tData[i+1];
                let value = tData[tData.length-1];

                // to avoid cyclic sankey, appending (src) and (dst) to names
                let source_option=ctrl.panel.table_editor_option_nodes[i];
                let target_option=ctrl.panel.table_editor_option_nodes[i+1];
                source += ((source_option.includes("src_") || source_option.includes("dst_")) ?
                             (source_option.includes("src_") ? " (src)" : " (dst)") :
                           "");
                target += ((target_option.includes("src_") || target_option.includes("dst_")) ?
                             (target_option.includes("src_") ? " (src)" : " (dst)") :
                           "");

                // add to sankeyData array
                sankeyData.push({"source":source,
                                 "target":target,
                                  "value":value,
                                  //"label":"flow-"+index});
                                  "label":ctrl.sankeynetsage_holder_id+"_flow-"+index});
              }
            });
          }
        }

        // get sankey graph from data
        var graph = createSankeyGraphFromData(sankeyData);
        //render sankey
        renderSankey(graph);


        // converts data into sankey node/link form
        function createSankeyGraphFromData(data){
          //set up graph in same style as original example but empty
          var graph = {"nodes" : [], "links" : []};

            data.forEach(function (d) {
              graph.nodes.push({ "name": d.source });
              graph.nodes.push({ "name": d.target });
              graph.links.push({ "source": d.source,
                                 "target": d.target,
                                 "value": +d.value,
                                 "label": d.label});
             });

             // return only the distinct / unique nodes
             graph.nodes = d3.keys(d3.nest()
               .key(function (d) { return d.name; })
               .map(graph.nodes));

             // loop through each link replacing the text with its index from node
             graph.links.forEach(function (d, i) {
               graph.links[i].source = graph.nodes.indexOf(graph.links[i].source);
               graph.links[i].target = graph.nodes.indexOf(graph.links[i].target);
             });

             //now loop through each nodes to make nodes an array of objects
             // rather than an array of strings
             graph.nodes.forEach(function (d, i) {
               graph.nodes[i] = { "name": d };
             });

          return graph;
        }

        // make sankey chart
        function renderSankey(graph){
          d3.select('#'+ctrl.containerDivId).selectAll('g').remove();

          var units = "Widgets";

          var offw = 900;
          var offh = 450;
          if (document.getElementById(ctrl.sankeynetsage_holder_id)) {
            offw = document.getElementById(ctrl.sankeynetsage_holder_id).offsetWidth;
            offh = document.getElementById(ctrl.sankeynetsage_holder_id).offsetHeight;
          }

          var margin = {top: 10, right: 10, bottom: 10, left: 10};
          var width = offw - margin.left - margin.right;
          var height = offh - margin.top - margin.bottom;

          var formatNumber = d3.format(",.0f");    // zero decimal places
          //var format = function(d) { return formatNumber(d) + " " + units; };
          var format = function(d) { return ctrl.panel.data_type === 'docs' ?
              (ctrl.panel.docs_editor_to_Byte ? ctrl.formatBytes(d) : ctrl.formatBits(d)) :
              d+' '+ctrl.panel.table_editor_link_width_label+' ('+ctrl.panel.table_data_type+')';
          };
          var color = d3.scale.category20();

          // append the svg canvas to the page
          var svg = d3.select('#sankey_svg_'+ctrl.panel.id);
          if(svg.empty()){
            svg = d3.select('#'+ctrl.containerDivId).append("svg")
                                                .attr("width", "100%")
                                                .attr("height", "100%")
                                                .attr("id", "sankey_svg_"+ctrl.panel.id)
                                                .attr("class", "sankey")
                                                .append("g")
          }

          // Set the sankey diagram properties
          var sankey = d3.sankey()
              .nodeWidth(36)
              .nodePadding(40)
              .size([width, height]);

          var path = sankey.link();

          sankey
            .nodes(graph.nodes)
            .links(graph.links)
            .layout(32);

          // move nodes down to make space for labels
          for(let i=0; i< sankey.nodes().length; i++){
            if(sankey.nodes()[i].y < 25){
              sankey.nodes()[i].y = 25;
            }
          }
          sankey.relayout();

          // create node location object
          var nodeLocations = {}
          // store only unique x positions of the nodes
          _.forEach(graph.nodes, function(n) {
            if (!(n.x in nodeLocations)){
              nodeLocations[(n.x+n.dx/2)]=1;
            }
          });
          // convert from string to Numbers
          nodeLocations = Object.keys(nodeLocations).map(Number);
          nodeLocations = nodeLocations.sort((a, b) => a - b);
          // add first value to last node value
          nodeLocations[nodeLocations.length-1] += nodeLocations[0];
          // set first value to 0
          nodeLocations[0] = 0;

          // add node labels
          var node_labels = svg.append("g").selectAll(".node-label")
            .data(ctrl.panel.label_nodes)
            .enter().append("text")
            .attr("class", "node-label")
            .attr("x", function(d) {return nodeLocations[ctrl.panel.label_nodes.indexOf(d)]} )
            .attr("y", (margin.top+5))
            .attr("text-anchor", function(d){
              switch(ctrl.panel.label_nodes.indexOf(d)){
                case 0:
                  return "start";
                case ctrl.panel.label_nodes.length-1:
                  return "end";
                default:
                  return "middle";
              }})
            .text(function(d) { return d.replace('meta.','')
                                        .replace('.keyword','')
                                        .replace(new RegExp('_','g'),' ')
                                        .replace('src','Source')
                                        .replace('dst','Destination')} );

          // add in the links
          var link = svg.append("g").selectAll(".link")
              .data(graph.links)
            .enter().append("path")
            .attr("class", function(d) {return "link"+" "+d.label})
              .attr("d", path)
              .style("stroke-width", function(d) { return Math.max(1, d.dy); })
              .sort(function(a, b) { return b.dy - a.dy; })
            .on('mouseover', function(event){
              _.forEach(document.getElementsByClassName(event.label), function(el) {
                el.classList.add("link-highlight");
              });
            })
            .on('mouseout', function(event){
              _.forEach(document.getElementsByClassName(event.label), function(el) {
                el.classList.remove("link-highlight");
              });
            });

          // add the link titles
          link.append("title")
                .text(function(d) {
                return d.source.name + " → " +
                        d.target.name + "\n" + format(d.value); });

          // add in the nodes
          var node = svg.append("g").selectAll(".node")
              .data(graph.nodes)
            .enter().append("g")
              .attr("class", "node")
              .attr("transform", function(d) {
              return "translate(" + d.x + "," + d.y + ")"; })
            .call(d3.behavior.drag()
              .origin(function(d) { return d; })
              .on("dragstart", function() {
              this.parentNode.appendChild(this); })
              .on("drag", dragmove))
            .on('mouseover', function(event){
              let hl = [];
              _.forEach(event.sourceLinks, function(sl){
                hl.push(sl.label);
              });
              _.forEach(event.targetLinks, function(tl){
                hl.push(tl.label);
              });
              _.forEach(hl, function(flow){
                _.forEach(document.getElementsByClassName(flow), function(el) {
                  el.classList.add("link-highlight");
                });
              });
            })
            .on('mouseout', function(event){
              let hl = [];
              _.forEach(event.sourceLinks, function(sl){
                hl.push(sl.label);
              });
              _.forEach(event.targetLinks, function(tl){
                hl.push(tl.label);
              });
              _.forEach(hl, function(flow){
                _.forEach(document.getElementsByClassName(flow), function(el) {
                  el.classList.remove("link-highlight");
                });
              });
            });

          // add the rectangles for the nodes
          node.append("rect")
              .attr("height", function(d) { return d.dy; })
              .attr("width", sankey.nodeWidth())
              .attr("rx", 3)
              .style("fill", function(d) {
                d.color = "#cdcdcd"
                if (d.targetLinks.length === 0){
                  d.color = color(d.name.replace(/ .*/, ""));
                  let cl = [];
                  _.forEach(d.sourceLinks, function(sl){
                    cl.push(sl.label);
                  });
                  _.forEach(cl, function(flow){
                    _.forEach(document.getElementsByClassName(flow), function(el) {
                      el.style.cssText += "stroke:"+d.color+";";
                    });
                  });
                }
                return d.color })
              .style("stroke", function(d) {
              return d3.rgb(d.color).darker(2); })
            .append("title")
              .text(function(d) {
              return d.name + "\n" + format(d.value); });

          // add in the title for the nodes
          node.append("text")
              .attr("x", -6)
              .attr("y", function(d) { return d.dy / 2; })
              .attr("dy", ".35em")
              .attr("text-anchor", "end")
              .attr("transform", null)
              .text(function(d) { return d.name; })
            .filter(function(d) { return d.x < width / 2; })
              .attr("x", 6 + sankey.nodeWidth())
              .attr("text-anchor", "start");

          // the function for moving the nodes
          function dragmove(d) {
            d3.select(this).attr("transform",
                "translate(" + d.x + "," + (
                        d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
                    ) + ")");
            sankey.relayout();
            link.attr("d", path);
          }
        }

      }
    });
  }

}

NetSageSankey.templateUrl = 'module.html';

