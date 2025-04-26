  // Load sqj.js module and database
  const sqlPromise = initSqlJs({
    locateFile: file => `./dist/${file}`
  });
  const dataPromise = fetch("data.db").then(res => res.arrayBuffer());
  const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
  const db = new SQL.Database(new Uint8Array(buf));

  // Grab the HTML positioning elements
  const timelineDiv   = document.getElementById( "timeline" );
  const rundenGraph   = document.getElementById( "rundenGraph" );
  const rundenInfo    = document.getElementById( "rundenInfo" );
  const passeInfo     = document.getElementById( "passeInfo" );
  let TrainingChart;
  let RundenChart;

  // Get dates of first and last Training - whole months
  var stmt = db.prepare("\
    SELECT min(date(date, 'start of month')) AS Start, max(date(date, 'start of month','+1 month')) AS End \
    FROM Training");
  stmt.getAsObject({});
  var TLRange = stmt.getAsObject();

  // Get locations to be used as filter
  const selLocation = document.getElementById( "selLocation" );
  var stmt = db.prepare("SELECT DISTINCT location FROM Training");
  while(stmt.step()) {
    var option = document.createElement("option");
    option.text = stmt.getAsObject().location;
    selLocation.add(option); 
  }

  // Get distances to be used as filter
  const selDistance = document.getElementById( "selDistance" );
  var stmt = db.prepare("SELECT DISTINCT distance FROM Round ORDER BY distance DESC");
  while(stmt.step()) {
    var option = document.createElement("option");
    var opt = stmt.getAsObject();
    option.text = opt.distance;
    selDistance.add(option); 
  }

  // Get targets to be used as filter
  const selTarget = document.getElementById( "selTarget" );
  var stmt = db.prepare("SELECT DISTINCT targetDiameter FROM Round ORDER BY cast(targetDiameter as unsigned) ASC");
  while(stmt.step()) {
    var option = document.createElement("option");
    var opt = stmt.getAsObject();
    option.text = opt.targetDiameter;
    selTarget.add(option); 
  }

  // Get bows to be used as filter
  const selBow = document.getElementById( "selBow" );
  var stmt = db.prepare("SELECT DISTINCT name FROM Bow");
  while(stmt.step()) {
    var option = document.createElement("option");
    option.text = stmt.getAsObject().name;
    selBow.add(option); 
  }

  function showTimeline(mode) {
    if( mode=='upd') { TL.destroy(); }
    // optional filters for SQL-timeline
    var fLocation="";
    var selLocation = document.getElementById("selLocation").value;
    selLocation == "" ? fLocation="" : fLocation=" AND location='" + selLocation + "'";
    var fDistance="";
    var selDistance = document.getElementById("selDistance").value;
    selDistance == "" ? fDistance="" : fDistance=" AND distance='" + selDistance + "'";
    var fTarget="";
    var selTarget = document.getElementById("selTarget").value;
    selTarget == "" ? fTarget="" : fTarget=" AND targetDiameter='" + selTarget + "'";
    var fBow="";
    var selBow = document.getElementById("selBow").value;
    selBow == "" ? fBow="" : fBow=" AND bow='" + selBow + "'";

    // Get Training-info => Timeline overview
    var stmt = db.prepare("\
      SELECT DISTINCT T.id AS TID, date AS D, title AS TT, location AS L, distance, T.reachedPoints AS RP, T.totalPoints AS TP, T.comment AS C, \
        round(((T.reachedPoints*1.0)/(T.totalPoints*1.0)*100)) AS PC, B.name AS bow  \
      FROM Training AS T, Round AS R, Bow AS B \
      WHERE T.id=T.id AND T.id=R.trainingId AND T.bowId=B.id" + fLocation + fDistance + fTarget + fBow + "\
      GROUP BY T.id \
      ORDER BY date ASC");
    var TLevents=[];
    while(stmt.step()) {
      var Trainings = stmt.getAsObject();
      TLevents.push({
          'id': Trainings['TID'], 'start': new Date( Trainings['D'] ), 'content': +Trainings['RP']+" / "+Trainings['TP']+" / "+Trainings['PC']+"%", 'title': Trainings['D'] + ": " + Trainings['L'] +"<br>" + Trainings['C']
      });
    }
    var items = new vis.DataSet( TLevents );
  
    const oneMonth = 1000 * 60 * 60 * 24 * 30;
    var start = new Date( TLRange['End'] ) - oneMonth;
    // timeline config
    var options = {
      locale: 'de',
      height: '20vH',
      stack: true,
      verticalScroll: true,
      zoomKey: 'ctrlKey',
      start: start,                             // start with last month
      min: new Date( TLRange['Start'] ),        // lower limit of visible range
      max: new Date( TLRange['End'] ),          // upper limit of visible range
      tooltip: { followMouse: true },
      selectable: true,
      multiselect: true,
    };
  
    // create the timeline
    var timeline = new vis.Timeline(timelineDiv);
    timeline.setOptions(options);
    timeline.setItems(items);
  
    // menu navigation helpers
    function move (percentage) {
      var range = timeline.getWindow();
      var interval = range.end - range.start;
      timeline.setWindow({
        start: range.start.valueOf() - interval * percentage,
        end:   range.end.valueOf()   - interval * percentage
      });
    };
  
    // attach events to the navigation buttons
    document.getElementById('zoomIn').onclick    = function () { timeline.zoomIn( 0.2); };
    document.getElementById('zoomOut').onclick   = function () { timeline.zoomOut( 0.2); };
    document.getElementById('zoomInMax').onclick = function () { timeline.zoomIn( 1.0 ); };
    document.getElementById('zoomOutMax').onclick= function () { timeline.zoomOut( 1.0 ); };
    document.getElementById('moveLeftX').onclick = function () { move( 0.2); };
    document.getElementById('moveLeftXL').onclick = function () { move( 1.0); };
    document.getElementById('moveLeftMax').onclick  = function () { timeline.moveTo( TLRange['Start'] ); };
    document.getElementById('moveRightX').onclick = function () { move(-0.2); };
    document.getElementById('moveRightXL').onclick = function () { move(-1.0); };
    document.getElementById('moveRightMax').onclick = function () { timeline.moveTo( TLRange['End'] ); };
  
    // timeline event handlers
    timeline.on('select', function(properties) {
      showRundenInfo( properties);
      showPasseInfo( 0 );
    });
    timeline.on('rangechanged', function(properties) {
      var visibleItems = timeline.getVisibleItems();
      timeline.setSelection('');
      showRundenInfo( {"items": [ visibleItems ]});
      showPasseInfo( 0 );
    });
    return timeline;
  };

  // filter functions
  selLocation.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showRundenInfo( {"items": [ visibleItems ]});
    //showPasseInfo( {"items": [ visibleItems ]});
  };
  selDistance.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showRundenInfo( {"items": [ visibleItems ]});
    //showPasseInfo( {"items": [ visibleItems ]});
  };
  selTarget.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showRundenInfo( {"items": [ visibleItems ]});
    //showPasseInfo( {"items": [ visibleItems ]});
  };
  selBow.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showRundenInfo( {"items": [ visibleItems ]});
    //showPasseInfo( {"items": [ visibleItems ]});
  };

  function showRundenInfo (properties) {
    rundenInfo.innerHTML = '';
    var fLocation="";
    var selLocation = document.getElementById("selLocation").value;
    selLocation == "" ? fLocation="" : fLocation=" AND location='" + selLocation + "'";
    var fDistance="";
    var selDistance = document.getElementById("selDistance").value;
    selDistance == "" ? fDistance="" : fDistance=" AND distance='" + selDistance + "'";
    var fTarget="";
    var selTarget = document.getElementById("selTarget").value;
    selTarget == "" ? fTarget="" : fTarget=" AND targetDiameter='" + selTarget + "'";
    var stmt = db.prepare("\
      SELECT T.id AS TID, R.id AS RID, T.location AS Ort, T.date AS Datum, distance AS Distanz, R.reachedPoints AS Punkte, \
        R.totalPoints AS Max, round(((R.reachedPoints*1.0)/(R.totalPoints*1.0)*100)) AS Prozent \
      FROM Round AS R, Training AS T \
      WHERE R.trainingId = T.id AND R.trainingId IN (" + properties.items + ")" + fDistance + fTarget + fLocation + "\
      GROUP BY R.id \
      ORDER BY date ASC");
    const rundenTable = document.createElement("TABLE");
    rundenTable.classList.add('ChartTable');
    const thead = rundenTable.createTHead();
    thead.classList.add('ChartTableHead');
    thead.insertRow(0);
    const rundenCols = [ '#', 'Datum', 'Ort', 'Distanz', 'Punkte', 'Max', 'Prozent' ];
    for( let i=0; i< rundenCols.length; i++){
      thead.rows[0].insertCell(i).innerText = rundenCols[i];
    };

    const tbody = rundenTable.createTBody();
    tbody.classList.add('ChartTableBody');
    let i=0;
    var RDdata = [];
    while(stmt.step()) {
      var Runden = stmt.getAsObject();
      RDdata.push({
        date: Runden['Datum'], tid: Runden['TID'], loc: Runden['Ort'], rid: Runden['RID'], dist: Runden['Distanz'], points: Runden['Punkte'], max: Runden['Max'], percent: Runden['Prozent'],
      });
      tbody.insertRow(i);
      tbody.rows[i].insertCell(0).innerText = i+1;
      for( let j=1; j< rundenCols.length; j++){
        tbody.rows[i].insertCell(j).innerText = Runden[rundenCols[j]];
      };
      i++;
    }
    rundenInfo.appendChild(rundenTable);

    const RChartTTtitle = (tooltipItems) => {
      return tooltipItems[0].label + ' #' + (tooltipItems[0].dataIndex+1);
    }

    const RChartTTlabel = (tooltipItems) => {
      return RDdata[tooltipItems.dataIndex].percent + '% (' + RDdata[tooltipItems.dataIndex].points + ' von ' + RDdata[tooltipItems.dataIndex].max + ') ' + RDdata[tooltipItems.dataIndex].dist + ' ' + RDdata[tooltipItems.dataIndex].loc;
    }
  
    const RChartTTafterBody = (tooltipItems) => {
      let sumPoints = 0;
      let sumMax = 0;
      let sumPercent = 0;
      for( let i=0; i< RDdata.length; i++) {
        sumPoints += RDdata[i].points;
        sumMax += RDdata[i].max;
      }
      sumPercent = (sumPoints/sumMax)*100;
      return 'Alle Runden: ' + sumPercent.toFixed(0) + "% (" + sumPoints + ' von ' + sumMax + ") " + selDistance + " " + selLocation;
    }

    if( RundenChart ){ RundenChart.destroy(); }
      RundenChart = new Chart("rundenGraph", {
      type: "bar",
      data: {
        labels: RDdata.map( row => row.date ),
        datasets: [{
          barPercentage: 0.9,
          categoryPercentage: 1.0,
          data: RDdata.map( row => row.percent ),
	  hoverBackgroundColor: 'rgba(0,0,0,0.1)',
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
        legend: {display: false},
          tooltip: {
            callbacks: {
              title: RChartTTtitle,
              label: RChartTTlabel,
              afterBody: RChartTTafterBody,
            },
          },
          title: {
            display: true,
            text: "Runden"
          }
        },
        scales: {
          x: {
          },
          y: {
            min: 20,
            max: 100,
          }
        },
        //onHover: function(c,i) {
          //var e = i[0];
          //var x_value = this.data.labels[e.index];
          //var y_value = this.data.datasets[e.datasetIndex].data[e.index];
          //console.log("x=" + x_value + " y=" + y_value);
        //},
        onClick: function(c,i) {
          var e = i[0];
          showPasseInfo( RDdata[e.index].rid );
        }
      }
    });
  };

  function showPasseInfo (properties) {
    passeInfo.innerHTML = '';
    var fLocation="";
    var selected = document.getElementById("selLocation").value;
    selected == "" ? fLocation="" : fLocation=" AND location='" + selected + "'";
    var fDistance="";
    var selected = document.getElementById("selDistance").value;
    selected == "" ? fDistance="" : fDistance=" AND distance='" + selected + "'";
    var fTarget="";
    var selTarget = document.getElementById("selTarget").value;
    selTarget == "" ? fTarget="" : fTarget=" AND targetDiameter='" + selTarget + "'";
    var stmt = db.prepare("\
      SELECT T.date AS Datum, T.location AS Ort, distance AS Distanz, E.reachedPoints AS Punkte, \
        E.totalPoints AS Max, round(((E.reachedPoints*1.0)/(E.totalPoints*1.0)*100)) AS Prozent, E.shotCount AS Schuss, \
        S.scoringRing AS Ring, round(S.x,2) AS xPos, round(S.y,2) AS yPos \
      FROM Shot AS S, End AS E, Round AS R, Training AS T \
      WHERE S.endId=E.id AND E.roundId = R.id AND R.trainingId = T.id AND R.id IN (" + properties + ")" + fDistance + fTarget + fLocation + "\
      GROUP BY S.id, E.id, R.id \
      ORDER BY date ASC");

    const passeTable = document.createElement("TABLE");
    passeTable.classList.add('ChartTable');
    const thead = passeTable.createTHead();
    thead.classList.add('ChartTableHead');
    thead.insertRow(0);
    const passeCols = [ 'Datum', 'Ort', 'Distanz', 'Punkte', 'Max', 'Prozent', 'Schuss', '1', '2', '3', '4', '5', '6' ];
    for( let i=0; i< passeCols.length; i++){
      thead.rows[0].insertCell(i).innerText = passeCols[i];
    };

    const tbody = passeTable.createTBody();
    tbody.classList.add('ChartTableBody');
    let i=0;
    let c=0;
    let r=[];
    let x=[];
    let y=[];
    while(stmt.step()) {
      var Runden = stmt.getAsObject();
      // prepare Graph

      // fill table body..
      if( c < Runden['Schuss']-1) {
        // save shot result
        r.push(Runden['Ring']);
        x.push(Runden['xPos']);
        y.push(Runden['yPos']);
        c++;
      } else {
        r.push(Runden['Ring']);
        x.push(Runden['xPos']);
        y.push(Runden['yPos']);
        tbody.insertRow(i);
        // insert round data
        let j=0;
        let n=0;
        tbody.rows[i].insertCell(j).innerHTML = '<button onmouseover="showTrefferBild(['+x+'],['+y+'],['+r+'])">'+Runden[passeCols[j]]+'</button>';
        //tbody.rows[i].insertCell(j).innerHTML = '<button onclick="showTrefferBild(['+x+'],['+y+'],['+r+'])">'+Runden[passeCols[j]]+'</button>';
        for( let j=1; j<(passeCols.length-Runden['Schuss']); j++){
          tbody.rows[i].insertCell(j).innerText = Runden[passeCols[j]];
        }
        // add shot results for this passe
        let l=(passeCols.length-Runden['Schuss']);
        for( let sc=0; sc < r.length; sc++) {
            tbody.rows[i].insertCell(l++).innerHTML = '<img src="./img/' + r[sc] + '-50.png" alt="R:'+r[sc]+'">';
        }
        i++;
        r=[];
        x=[];
        y=[];
        c=0;
      }
    }
    if( properties > 0){
      passeInfo.appendChild(passeTable);
    }
  };

  // now show the Timeline Overview
  let TL=showTimeline('init');
