  // Load sqj.js modue and database
  const sqlPromise = initSqlJs({
    locateFile: file => `./dist/${file}`
  });
  const dataPromise = fetch("data.db").then(res => res.arrayBuffer());
  const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
  const db = new SQL.Database(new Uint8Array(buf));

  // Grab the HTML positioning elements
  const trainingGraph = document.getElementById( "trainingGraph" );
  const rundenGraph  = document.getElementById( "rundenGraph" );

  // Get dates of first and last Training - whole months
  var stmt = db.prepare("SELECT min(date(date, 'start of month')) AS Start, max(date(date, 'start of month','+1 month')) AS End FROM Training");
  stmt.getAsObject({});
  var TLRange = stmt.getAsObject();

  var stmt = db.prepare("SELECT id AS TID, date AS D, location AS L, reachedPoints AS RP, totalPoints AS TP, round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC FROM Training ORDER BY date ASC");
  var TLevents   = [];
  var TLeventids = [];
  while(stmt.step()) {
    var Trainings = stmt.getAsObject();
    TLevents.push({
      'id': Trainings['TID'], 'start': new Date( Trainings['D'] ), 'content': Trainings['L'], 'title': Trainings['RP']+"/"+Trainings['TP']+"/"+Trainings['PC']+"%",
    });
    TLeventids.push( Trainings['TID'],);
  }

  var items = new vis.DataSet( TLevents );
  // create timeline config
  var container = document.getElementById('timeline');
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
  var timeline = new vis.Timeline(container);
  timeline.setOptions(options);
  timeline.setItems(items);

  // helpers
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
    showRundenGraph( properties);
  });
  timeline.on('doubleClick', function(properties) {
    console.log("event: doubelClick");
  });
  timeline.on('contextmenu', function(properties) {
    console.log("event: contextmenu");
    //event.preventDefault();
  });
  timeline.on('rangechanged', function(properties) {
    var visibleItems = timeline.getVisibleItems();
    timeline.setSelection('');
    showTimelineGraph( {"items": [ visibleItems ]});
    showRundenGraph( {"items": [ visibleItems ]});
  });

  function showRundenGraph (properties) {
console.log(properties);
    var stmt = db.prepare("SELECT id, distance AS DIST, reachedPoints AS RP, totalPoints AS TP, round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC FROM Round WHERE trainingId IN (" + properties.items[0] + ") ORDER BY id ASC");
    var RDdata = [];
    while(stmt.step()) {
      var Runden = stmt.getAsObject();
      RDdata.push({
        id: Runden['id'], dist: Runden['DIST'], percent: Runden['PC'], tooltip: Runden['RP']+"/"+Runden['TP']+"/"+Runden['PC']+"%",
      });
    }
    new Chart("rundenGraph", {
      type: "bar",
      //type: "line",
      data: {
        labels: RDdata.map( row => row.dist ),
        datasets: [{
          data: RDdata.map( row => row.percent ),
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: "Runden",
          },
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
  }

  function showTimelineGraph (properties) {
console.log(properties.items);
    var stmt = db.prepare("SELECT id, date AS D, reachedPoints AS RP, totalPoints AS TP, round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC FROM Training WHERE id IN (" + properties.items + ") ORDER BY date ASC");
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
  }

  // needed for debugging
  function stringifyObject (object) {
    if (!object) return;
    var replacer = function(key, value) {
      if (value && value.tagName) {
        return "DOM Element";
      } else {
        return value;
      }
    }
    return JSON.stringify(object, replacer)
  }
