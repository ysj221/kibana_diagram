import { uiModules } from 'ui/modules'
import { notify } from 'ui/notify'
import { FilterBarQueryFilterProvider } from 'ui/filter_bar/query_filter'
import { AggTypesBucketsCreateFilterTermsProvider } from 'ui/agg_types/buckets/create_filter/terms'
import { AggTypesBucketsCreateFilterFiltersProvider } from 'ui/agg_types/buckets/create_filter/filters'
import { AggResponseTabifyProvider } from 'ui/agg_response/tabify/tabify'

const module = uiModules.get('kibana/kibana_diagram', ['kibana'])

const mscgenjs = require('mscgenjs/dist/webpack-issue-5316-workaround')

module.controller('KbnDiagramController', function ($scope, $sce, $timeout, Private) {
  var network_id = 'diagram_' + $scope.$id
  var svg_id = 'mscgenjsdiagram_' + $scope.$id

  const queryFilter = Private(FilterBarQueryFilterProvider)
  const createTermsFilter = Private(AggTypesBucketsCreateFilterTermsProvider)
  const createFilter = Private(AggTypesBucketsCreateFilterFiltersProvider)
  const tabifyAggResponse = Private(AggResponseTabifyProvider)

  function hashCode(str) { // java String#hashCode
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  function intToARGB(i){
    return ((i>>24)&0xFF).toString(16) + 
           ((i>>16)&0xFF).toString(16) + 
           ((i>>8)&0xFF).toString(16) + 
           (i&0xFF).toString(16);
  }

  $scope.errorCustom = function (message, hide) {
    if (!message) message = 'General Error. Please undo your changes.'
    if (hide) {
      $('#' + network_id).hide()
    }
    notify.error(message)
  }

  $scope.initialShows = function () {
    $('#net').show()
    $('#errorHtml').hide()
  }

  $scope.doneLoading = function () {
    $('#net').show()
    $('#errorHtml').hide()
  }

  $scope.uniqueIds = [];
  $scope.uniqueHeaders = [];
  $scope.safeReturn = function(val) {
	if (!val||val=='') val = 'undef';
	if ($scope.uniqueIds.indexOf(val) === -1){
		var col = intToARGB(hashCode(val));
		$scope.uniqueIds.push(val);
		$scope.uniqueHeaders.push('"'+ val +'" [linecolor="#'+col+'", textbgcolor="#'+col+'", arclinecolor="#'+col+'"]');
	}
	return val;
  }

  $scope.$parent.$watchMulti(['esResponse'], function ([resp]) {
    if (resp && $scope.vis) {
	  var rawResponse = $scope.vis.aggs.toDsl()
      $timeout(function () {
        if ($scope.vis.aggs.bySchemaName['first'].length >= 1) {
          try {
            $scope.tableGroups = resp;
	    $scope.mscScript = 'msc { ';
	    $scope.mscScript += ' width="auto"; ';

  	    $scope.uniqueIds = [];
	    $scope.uniqueHeaders = [];
            var tmp = '';
            console.log('tableGroups ready! Scope is:', $scope)

            if (!$scope.tableGroups.tables && !$scope.tableGroups.tables[0].rows) return
            $scope.tableGroups.tables[0].rows.forEach(function (row) {
              var t = 0;
              var columns = $scope.tableGroups.tables[0].columns.length;
              for (t = 0; t < columns; t++) {
                if (t % 2 === 0) {
		  if (row[t + 2]) {
			    tmp += '"' + $scope.safeReturn(row[t].value) + '"'
				+ ' => ' + '"' + $scope.safeReturn(row[t+2].value) + '"'
				+ ' [label="' + row[t+1].value + '"];';
		  }
                }
              }
            })
            $scope.mscScript += $scope.uniqueHeaders.join(', ') + '; ';
            $scope.mscScript += tmp;
	    $scope.mscScript += " }";

            console.log('mscg ready! script is:', $scope.mscScript)
          } catch (e) {
            $scope.errorCustom('tabifyAggResponse error! ' + e)
          }

          // Prep containers
          var container = document.getElementById(network_id)
          container.style.height = container.getBoundingClientRect().height
          container.height = container.getBoundingClientRect().height
          // Cleanup any existing diagram
          var svg = document.getElementById(svg_id)
          if (svg) svg.remove()

          $scope.initialShows()

          mscgenjs.renderMsc(
		  $scope.mscScript || 'msc {}',
		  {
		    elementId: network_id,
		    inputType: 'xu',
		    width: 'auto',
		    additionalTemplate: $scope.vis.params.diagramStyle || 'classic',
	            mirrorEntitiesOnBottom: $scope.vis.params.mirrorEntitiesOnBottom || true
		  },
		  handleRenderMscResult
          )

          function handleRenderMscResult (pError, pSuccess) {
		  if (pError) { console.log('msc error: ',pError,$scope.mscScript);
		  } else { $scope.doneLoading(); }
          }
        } else {
          $scope.errorCustom('Error: Please select at least one aggregation', 1)
        }

      // $timeout tail
      })
    }
  })
})
