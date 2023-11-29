  // Load sqj.js module and database
  const sqlPromise = initSqlJs({
    locateFile: file => `./dist/${file}`
  });
  const dataPromise = fetch("data.db").then(res => res.arrayBuffer());
  const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
  const db = new SQL.Database(new Uint8Array(buf));

  // Grab the HTML positioning elements
  const timelineDiv   = document.getElementById( "timeline" );
  const trainingGraph = document.getElementById( "trainingGraph" );
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
  var stmt = db.prepare("SELECT DISTINCT distance FROM Round");
  while(stmt.step()) {
    var option = document.createElement("option");
    var opt = stmt.getAsObject();
    option.text = opt.distance;
    selDistance.add(option); 
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
    var selected = document.getElementById("selLocation").value;
    selected == "" ? fLocation="" : fLocation=" AND location='" + selected + "'";
    var fDistance="";
    var selected = document.getElementById("selDistance").value;
    selected == "" ? fDistance="" : fDistance=" AND distance='" + selected + "'";
    var fBow="";
    var selected = document.getElementById("selBow").value;
    selected == "" ? fBow="" : fBow=" AND bow='" + selected + "'";

    // Get Training-info => Timeline overview
    var stmt = db.prepare("\
      SELECT DISTINCT T.id AS TID, date AS D, title AS TT, location AS L, distance, T.reachedPoints AS RP, T.totalPoints AS TP, \
        round(((T.reachedPoints*1.0)/(T.totalPoints*1.0)*100)) AS PC, B.name AS bow  \
      FROM Training AS T, Round AS R, Bow AS B \
      WHERE T.id=T.id AND T.id=R.trainingId AND T.bowId=B.id" + fLocation + fDistance + fBow + "\
      GROUP BY T.id \
      ORDER BY date ASC");
    var TLevents=[];
    while(stmt.step()) {
      var Trainings = stmt.getAsObject();
      TLevents.push({
          'id': Trainings['TID'], 'start': new Date( Trainings['D'] ), 'content': Trainings['TT'], 'title': Trainings['L']+": "+Trainings['RP']+"/"+Trainings['TP']+"/"+Trainings['PC']+"%",
      });
    }
    var items = new vis.DataSet( TLevents );
  
    // timeline config
    var options = {
      height: '20vH',
      stack: true,
      verticalScroll: true,
      zoomKey: 'ctrlKey',
      min: new Date( TLRange['Start'] ),        // lower limit of visible range
      max: new Date( TLRange['End'] ),          // upper limit of visible range
      zoomMin: 1000 * 60 * 60 * 24,             // one day in milliseconds
      zoomMax: 1000 * 60 * 60 * 24 * 31 * 3,    // about three months in milliseconds
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
    document.getElementById('moveLeft').onclick  = function () { move( 0.2); };
    document.getElementById('moveRight').onclick = function () { move(-0.2); };
  
    // timeline event handlers
    timeline.on('select', function(properties) {
      showTimelineGraph(properties);
      showRundenInfo( properties);
      showPasseInfo( properties);
    });
    timeline.on('doubleClick', function(properties) {
      console.log("event: doubelClick");
    });
    timeline.on('contextmenu', function(properties) {
      console.log(properties);
      event.preventDefault();
    });
    timeline.on('rangechanged', function(properties) {
      var visibleItems = timeline.getVisibleItems();
      timeline.setSelection('');
      showTimelineGraph( {"items": [ visibleItems ]});
      showRundenInfo( {"items": [ visibleItems ]});
      showPasseInfo( {"items": [ visibleItems ]});
    });
    return timeline;
  };

  // filter functions
  selLocation.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenInfo( {"items": [ visibleItems ]});
    showPasseInfo( {"items": [ visibleItems ]});
  };
  selDistance.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenInfo( {"items": [ visibleItems ]});
    showPasseInfo( {"items": [ visibleItems ]});
  };
  selBow.onchange = function () {
    console.log(this.value);
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenInfo( {"items": [ visibleItems ]});
    showPasseInfo( {"items": [ visibleItems ]});
  };

  function showTimelineGraph (properties) {
    var stmt = db.prepare("\
      SELECT id, date AS D, reachedPoints AS RP, totalPoints AS TP, \
        round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC \
      FROM Training AS T \
      WHERE id IN (" + properties.items + ") \
      ORDER BY date ASC");
    var TLdata = [];
    while(stmt.step()) {
      var Trainings = stmt.getAsObject();
      TLdata.push({
        date: Trainings['D'],  percent: Trainings['PC'], tooltip: Trainings['RP']+"/"+Trainings['TP']+"/"+Trainings['PC']+"%",
      });
    }
    if( TrainingChart ){ TrainingChart.destroy(); }
      TrainingChart = new Chart("trainingGraph", {
      type: "bar",
      data: {
        labels: TLdata.map( row => row.date ),
        datasets: [{
          data: TLdata.map( row => row.percent ),
        }]
      },
      options: {
        plugins: {
        legend: {display: false},
          title: {
            display: true,
            text: "Trainings"
          }
        },
        events: ['click'],
        scales: {
          x: {
          },
          y: {
            min: 0,
            max: 100,
          }
        }
      }
    });
  };

  function showRundenInfo (properties) {
    rundenInfo.innerHTML = '';
    var fLocation="";
    var selected = document.getElementById("selLocation").value;
    selected == "" ? fLocation="" : fLocation=" AND location='" + selected + "'";
    var fDistance="";
    var selected = document.getElementById("selDistance").value;
    selected == "" ? fDistance="" : fDistance=" AND distance='" + selected + "'";
    var stmt = db.prepare("\
      SELECT T.date AS Datum, distance AS Distanz, R.reachedPoints AS Punkte, \
        R.totalPoints AS Max, round(((R.reachedPoints*1.0)/(R.totalPoints*1.0)*100)) AS Prozent \
      FROM Round AS R, Training AS T \
      WHERE R.trainingId = T.id AND R.trainingId IN (" + properties.items + ")" + fDistance + fLocation + "\
      GROUP BY R.id \
      ORDER BY date ASC");
    const rundenTable = document.createElement("TABLE");
    const thead = rundenTable.createTHead();
    thead.insertRow(0);
    const rundenCols = [ 'Datum', 'Distanz', 'Punkte', 'Max', 'Prozent' ];
    for( let i=0; i< rundenCols.length; i++){
      thead.rows[0].insertCell(i).innerText = rundenCols[i];
    };

    const tbody = rundenTable.createTBody();
    let i=0;
    var RDdata = [];
    while(stmt.step()) {
      var Runden = stmt.getAsObject();
      RDdata.push({
        date: Runden['Datum'], points: Runden['Punkte'], max: Runden['Max'], percent: Runden['Prozent'],
      });
      tbody.insertRow(i);
      for( let j=0; j< rundenCols.length; j++){
        tbody.rows[i].insertCell(j).innerText = Runden[rundenCols[j]];
      };
      i++;
    }
    rundenInfo.appendChild(rundenTable);

    if( RundenChart ){ RundenChart.destroy(); }
      RundenChart = new Chart("rundenGraph", {
      type: "bar",
      data: {
        labels: RDdata.map( row => row.date ),
        datasets: [{
          data: RDdata.map( row => row.percent ),
        }]
      },
      options: {
        plugins: {
        legend: {display: false},
          title: {
            display: true,
            text: "Runden"
          }
        },
        events: ['click'],
        scales: {
          x: {
          },
          y: {
            min: 0,
            max: 100,
          }
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
    var stmt = db.prepare("\
      SELECT T.date AS Datum, distance AS Distanz, E.reachedPoints AS Punkte, \
        E.totalPoints AS Max, round(((E.reachedPoints*1.0)/(E.totalPoints*1.0)*100)) AS Prozent, E.shotCount AS Schuss, \
        S.scoringRing AS Ring, round(S.x,2) AS xPos, round(S.y,2) AS yPos \
      FROM Shot AS S, End AS E, Round AS R, Training AS T \
      WHERE S.endId=E.id AND E.roundId = R.id AND R.trainingId = T.id AND R.trainingId IN (" + properties.items + ")" + fDistance + fLocation + "\
      GROUP BY S.id, E.id, R.id \
      ORDER BY date ASC");

    const passeTable = document.createElement("TABLE");
    const thead = passeTable.createTHead();
    thead.insertRow(0);
    const passeCols = [ 'Datum', 'Distanz', 'Punkte', 'Max', 'Prozent', 'Schuss', '1', '2', '3', '4', '5', '6' ];
    for( let i=0; i< passeCols.length; i++){
      thead.rows[0].insertCell(i).innerText = passeCols[i];
    };

    const tbody = passeTable.createTBody();
    let i=0;
    let c=0;
    let r=[];
    let x=[];
    let y=[];
    var RDdata = [];
    while(stmt.step()) {
      var Runden = stmt.getAsObject();
      // prepare Graph
      RDdata.push({
        date: Runden['Datum'], points: Runden['Punkte'], max: Runden['Max'], percent: Runden['Prozent'],
      });

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
        tbody.rows[i].insertCell(j).innerHTML = '<button onclick="showTrefferBild(['+x+'],['+y+'])">'+Runden[passeCols[j]]+'</button>';
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
    passeInfo.appendChild(passeTable);
  };

  // now show the Timeline Overview
  let TL=showTimeline('init');
