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
  const rundenInfo    = document.getElementById( "rundenInfo" );
  const passeInfo     = document.getElementById( "passeInfo" );
  passeInfo.innerHTML = 'PASSE';

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
    });
    return timeline;
  };

  // filter functions
  selLocation.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenInfo( {"items": [ visibleItems ]});
  };
  selDistance.onchange = function () {
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenInfo( {"items": [ visibleItems ]});
  };
  selBow.onchange = function () {
    console.log(this.value);
    var visibleItems = TL.getVisibleItems();
    TL=showTimeline('upd');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenInfo( {"items": [ visibleItems ]});
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
    new Chart("trainingGraph", {
      type: "bar",
      data: {
        labels: TLdata.map( row => row.date ),
        datasets: [{
          data: TLdata.map( row => row.percent ),
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: "Trainings"
          }
        },
        legend: {display: false},
        events: ['click'],
        scales: {
          yAxes: [{
            ticks: {
              min: 0,
              max: 100,
            }
          }]
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
      SELECT R.id AS ID, T.date AS Datum, distance AS Distanz, R.reachedPoints AS Punkte, \
        R.totalPoints AS Max, round(((R.reachedPoints*1.0)/(R.totalPoints*1.0)*100)) AS Prozent \
      FROM Round AS R, Training AS T \
      WHERE R.trainingId = T.id AND R.trainingId IN (" + properties.items + ")" + fDistance + fLocation + "\
      GROUP BY R.id \
      ORDER BY date ASC");
    const rundenTable = document.createElement("TABLE");
    const thead = rundenTable.createTHead();
    thead.insertRow(0);
    const rundenCols = [ 'ID', 'Datum', 'Distanz', 'Punkte', 'Max', 'Prozent' ];
    for( let i=0; i< rundenCols.length; i++){
      thead.rows[0].insertCell(i).innerText = rundenCols[i];
    };

    const tbody = rundenTable.createTBody();
    let i=0;
    while(stmt.step()) {
      tbody.insertRow(i);
      var Runden = stmt.getAsObject();
      for( let j=0; j< rundenCols.length; j++){
        tbody.rows[i].insertCell(j).innerText = Runden[rundenCols[j]];
      };
      i++;
    }
    rundenInfo.appendChild(rundenTable);
  };

  // now show the Timeline Overview
  let TL=showTimeline('init');
