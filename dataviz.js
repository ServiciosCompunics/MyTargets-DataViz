  // Load sqj.js module and database
  const sqlPromise = initSqlJs({
    locateFile: file => `./dist/${file}`
  });
  const dataPromise = fetch("data.db").then(res => res.arrayBuffer());
  const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
  const db = new SQL.Database(new Uint8Array(buf));

  // Grab the rundenInfo element
  const rundenInfo = document.getElementById( "rundenInfo" );
  const trainingInfo = document.getElementById( "trainingInfo" );
  rundenInfo.innerHTML = '';
  trainingInfo.innerHTML = '';

  // Get dates of first and last Training - whole months
  var stmt = db.prepare("SELECT min(date(date, 'start of month')) AS F, max(date(date, 'start of month','+1 month')) AS T FROM Training");
  stmt.getAsObject({});
  var FromTo = stmt.getAsObject();

  var stmt = db.prepare("SELECT id AS TID, date AS D, location AS L, reachedPoints AS RP, totalPoints AS TP, round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC FROM Training ORDER BY date ASC");
  var TLdata = [];
  while(stmt.step()) {
    var Trainings = stmt.getAsObject();
    TLdata.push({
      'id': Trainings['TID'], 'start': new Date( Trainings['D'] ), 'content': Trainings['L'], 'title': Trainings['RP']+"/"+Trainings['TP']+"/"+Trainings['PC']+"%",
    });
  }

  var items = new vis.DataSet( TLdata );
  // create timeline
  var container = document.getElementById('timeline');
  var options = {
    height: '300px',
    min: new Date( FromTo['F'] ),             // lower limit of visible range
    max: new Date( FromTo['T'] ),             // upper limit of visible range
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

  // event handlers
  timeline.on('select', function(properties) {
    showTimelineGraph(properties);
  });
  timeline.on('doubleClick', function(properties) {
    console.log("event: doubelClick");
  });
  timeline.on('contextmenu', function(properties) {
    console.log("event: contextmenue");
  });
  timeline.on('rangechanged', function(properties) {
    console.log("event: rangechanged");
  });

  function showTimelineGraph (properties) {
    var stmt = db.prepare("SELECT id, date AS D, reachedPoints AS RP, totalPoints AS TP, round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC FROM Training WHERE id IN (" + properties.items + ") ORDER BY date ASC");
    var TLdata = [];
    while(stmt.step()) {
      var Trainings = stmt.getAsObject();
      TLdata.push({
        date: Trainings['D'],  percent: Trainings['PC'], tooltip: Trainings['RP']+"/"+Trainings['TP']+"/"+Trainings['PC']+"%",
      });
    }
    //rundenInfo.innerHTML = "training: " + stringifyObject(TLdata);
    new Chart("trainingInfo", {
      type: "bar",
      data: {
        labels: TLdata.map( row => row.date ),
        datasets: [{
          data: TLdata.map( row => row.percent ),
        }]
      },
      options: {
        legend: {display: false},
        events: ['click'],
      }
    });
  }

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
